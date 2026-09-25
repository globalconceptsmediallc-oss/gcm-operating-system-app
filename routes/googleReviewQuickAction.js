/* =========================================================
   Global Concepts Media Operating System
   File: routes/googleReviewQuickAction.js
   Version: 1.0.1
   Status: Production Road-Test Candidate
   Sprint: Google Review Quick Action
   Purpose:
   Handle routine Google Business Profile review notifications without sending
   them through the full Finding / Communication / Investigation / Work flow.
   The source email remains durable evidence in email_intake. The only business
   metric exposed by this route is the client's count of processed reviews for
   the month. One intake can be counted only once.
   ========================================================= */

import { ACTIONS, VERSION } from "../shared/config.js";
import { getDatabase } from "../shared/database.js";
import { jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";

export const GOOGLE_REVIEW_QUICK_ACTION_VERSION = "1.0.1";

const CLASSIFICATION_SOURCE = "google_review_quick_action";

export async function handleGoogleReviewQuickAction(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
      error:"The production D1 binding is unavailable."
    },503);
  }

  const operation = clean(body?.operation).toLowerCase();
  const workspaceKey = clean(body?.workspaceKey) || "gcm";
  const clientId = Number(body?.clientId);

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
      error:"Choose the client before handling this review."
    },400);
  }

  try {
    const client = await db.prepare(`
      SELECT id, client_code, name
      FROM clients
      WHERE id = ?
      LIMIT 1
    `).bind(clientId).first();

    if (!client) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
        error:`Client #${clientId} was not found.`
      },404);
    }

    if (operation === "get_month_count") {
      const reviewMonth = normalizeMonth(body?.reviewMonth);

      if (!reviewMonth) {
        return jsonResponse({
          ok:false,
          requestId,
          action:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
          error:"A reviewMonth in YYYY-MM format is required."
        },400);
      }

      const monthlyCount = await getMonthlyCount(
        db,
        workspaceKey,
        clientId,
        reviewMonth
      );

      return jsonResponse({
        ok:true,
        requestId,
        action:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
        googleReviewQuickActionVersion:GOOGLE_REVIEW_QUICK_ACTION_VERSION,
        operation,
        workspaceKey,
        clientId,
        clientName:client.name || client.client_code || `Client #${clientId}`,
        reviewMonth,
        monthlyCount
      });
    }

    if (operation !== "count_and_close") {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
        error:"Supported operations are get_month_count and count_and_close."
      },400);
    }

    const intakeId = Number(body?.intakeId);

    if (!Number.isInteger(intakeId) || intakeId <= 0) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
        error:"A valid intakeId is required."
      },400);
    }

    const intake = await loadIntake(db, intakeId, workspaceKey);

    if (!intake) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
        error:`Email intake record #${intakeId} was not found.`
      },404);
    }

    const reviewMonth =
      normalizeMonth(body?.reviewMonth) ||
      monthFromDate(intake.source_date) ||
      monthFromDate(intake.received_at);

    if (!reviewMonth) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
        error:"The review month could not be determined from the source email."
      },400);
    }

    if (
      intake.processing_status === "processed" &&
      intake.classification_source === CLASSIFICATION_SOURCE
    ) {
      const monthlyCount = await getMonthlyCount(
        db,
        workspaceKey,
        Number(intake.client_id || clientId),
        reviewMonth
      );

      return success({
        requestId,
        workspaceKey,
        intakeId,
        client,
        reviewMonth,
        monthlyCount,
        duplicate:true
      });
    }

    if (intake.processing_status !== "ready_for_review") {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
        error:`Email intake record #${intakeId} is not ready for review.`,
        processingStatus:intake.processing_status || null
      },409);
    }

    if (hasDownstreamLink(intake)) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
        error:"Google Review Quick Action was blocked because this intake already has a downstream OS record."
      },409);
    }

    const classificationJson = JSON.stringify({
      route:"google_review_quick_action",
      metric:"monthly_review_count",
      reviewMonth,
      responded:true,
      operator:"human",
      evidenceRetained:true
    });

    const update = await db.prepare(`
      UPDATE email_intake
      SET
        processing_status = 'processed',
        disposition = 'monitoring',
        classification_source = ?,
        classification_json = ?,
        classification_confidence = 'high',
        client_id = ?,
        processed_at = CURRENT_TIMESTAMP,
        failure_stage = NULL,
        failure_message = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND workspace_key = ?
        AND processing_status = 'ready_for_review'
        AND finding_id IS NULL
        AND communication_id IS NULL
        AND activity_record_id IS NULL
        AND investigation_id IS NULL
        AND work_item_id IS NULL
    `).bind(
      CLASSIFICATION_SOURCE,
      classificationJson,
      clientId,
      intakeId,
      workspaceKey
    ).run();

    if (Number(update?.meta?.changes || 0) !== 1) {
      const reconciled = await loadIntake(db, intakeId, workspaceKey);

      if (
        reconciled?.processing_status === "processed" &&
        reconciled?.classification_source === CLASSIFICATION_SOURCE
      ) {
        const monthlyCount = await getMonthlyCount(
          db,
          workspaceKey,
          Number(reconciled.client_id || clientId),
          reviewMonth
        );

        return success({
          requestId,
          workspaceKey,
          intakeId,
          client,
          reviewMonth,
          monthlyCount,
          duplicate:true
        });
      }

      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
        error:"The review intake changed before it could be counted. Refresh Intake and try again."
      },409);
    }

    const monthlyCount = await getMonthlyCount(
      db,
      workspaceKey,
      clientId,
      reviewMonth
    );

    return success({
      requestId,
      workspaceKey,
      intakeId,
      client,
      reviewMonth,
      monthlyCount,
      duplicate:false
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
      stage:"d1_google_review_quick_action",
      error
    });

    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
      error:safeErrorMessage(error)
    },500);
  }
}

async function loadIntake(db, intakeId, workspaceKey) {
  return db.prepare(`
    SELECT
      id,
      workspace_key,
      received_at,
      source_date,
      processing_status,
      disposition,
      classification_source,
      client_id,
      finding_id,
      communication_id,
      activity_record_id,
      investigation_id,
      work_item_id
    FROM email_intake
    WHERE id = ?
      AND workspace_key = ?
    LIMIT 1
  `).bind(intakeId, workspaceKey).first();
}

async function getMonthlyCount(db, workspaceKey, clientId, reviewMonth) {
  const result = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM email_intake
    WHERE workspace_key = ?
      AND client_id = ?
      AND processing_status = 'processed'
      AND classification_source = ?
      AND classification_json LIKE ?
  `).bind(
    workspaceKey,
    clientId,
    CLASSIFICATION_SOURCE,
    `%"reviewMonth":"${reviewMonth}"%`
  ).first();

  return Number(result?.count || 0);
}

function hasDownstreamLink(record) {
  return [
    record?.finding_id,
    record?.communication_id,
    record?.activity_record_id,
    record?.investigation_id,
    record?.work_item_id
  ].some(value => value !== null && value !== undefined);
}

function monthFromDate(value) {
  const raw = clean(value);
  const match = raw.match(/^(\d{4}-\d{2})/);
  return match?.[1] || "";
}

function normalizeMonth(value) {
  const raw = clean(value);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : "";
}

function success({
  requestId,
  workspaceKey,
  intakeId,
  client,
  reviewMonth,
  monthlyCount,
  duplicate
}) {
  return jsonResponse({
    ok:true,
    requestId,
    action:ACTIONS.GOOGLE_REVIEW_QUICK_ACTION,
    version:VERSION,
    googleReviewQuickActionVersion:GOOGLE_REVIEW_QUICK_ACTION_VERSION,
    operation:"count_and_close",
    workspaceKey,
    intakeId,
    clientId:Number(client.id),
    clientName:client.name || client.client_code || `Client #${client.id}`,
    reviewMonth,
    monthlyCount,
    duplicate:Boolean(duplicate),
    evidenceRetained:true,
    findingCreated:false,
    communicationCreated:false,
    activityRecordCreated:false,
    investigationCreated:false,
    workItemCreated:false
  });
}

function clean(value) {
  return String(value ?? "").trim();
}
