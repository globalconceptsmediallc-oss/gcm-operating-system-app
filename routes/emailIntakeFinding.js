/* =========================================================
   Global Concepts Media Operating System
   File: routes/emailIntakeFinding.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Signal Review — Human Findings Capture
   Purpose:
   Save the useful details learned during a human-led email/report review.
   The source email remains evidence in email_intake. The permanent record is
   the finding, not the fact that an email arrived.
   ========================================================= */

import { ACTIONS } from "../shared/config.js";
import { getDatabase } from "../shared/database.js";
import { jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";

export const EMAIL_INTAKE_FINDING_VERSION = "1.0.0";

export async function handleEmailIntakeFinding(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
      error:"The production D1 binding is unavailable."
    },503);
  }

  const intakeId = Number(body?.intakeId);
  const clientId = Number(body?.clientId);
  const workspaceKey = clean(body?.workspaceKey) || "gcm";
  const reportingPeriod = clean(body?.reportingPeriod);
  const details = clean(body?.details);
  const analysis = clean(body?.analysis);
  const decision = clean(body?.decision);
  const owner = clean(body?.owner) || "Andrew";

  if (!Number.isInteger(intakeId) || intakeId <= 0) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
      error:"A valid intakeId is required."
    },400);
  }

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
      error:"Choose the client before saving the finding."
    },400);
  }

  if (!details) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
      error:"Enter the important details learned during review before saving."
    },400);
  }

  try {
    const intake = await loadIntake(db, intakeId, workspaceKey);

    if (!intake) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
        error:`Email intake record #${intakeId} was not found.`
      },404);
    }

    if (
      intake.processing_status === "processed" &&
      Number(intake.finding_id) > 0
    ) {
      return success({
        requestId,
        intakeId,
        clientId:Number(intake.client_id || clientId),
        findingId:Number(intake.finding_id),
        duplicate:true,
        findingCreated:false
      });
    }

    if (intake.processing_status !== "ready_for_review") {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
        error:`Email intake record #${intakeId} is not ready for review.`,
        processingStatus:intake.processing_status || null
      },409);
    }

    if (hasLegacyDownstreamLink(intake)) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
        error:"Finding save was blocked because this intake already has a legacy downstream record."
      },409);
    }

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
        action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
        error:`Client #${clientId} was not found.`
      },404);
    }

    const sourceReference = `email-intake:${workspaceKey}:${intakeId}`;
    let finding = await db.prepare(`
      SELECT id
      FROM client_findings
      WHERE source_type = 'email_intake_review'
        AND source_reference = ?
      LIMIT 1
    `).bind(sourceReference).first();

    let findingCreated = false;

    if (!finding?.id) {
      const result = await db.prepare(`
        INSERT INTO client_findings (
          client_id,
          category,
          source_type,
          source_reference,
          source_title,
          source_date,
          reporting_period,
          details,
          analysis,
          decision,
          owner,
          created_at,
          updated_at
        ) VALUES (?, 'Marketing Intelligence', 'email_intake_review', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        Number(client.id),
        sourceReference,
        clean(intake.subject) || "(No subject)",
        clean(intake.source_date) || clean(intake.received_at) || null,
        reportingPeriod || null,
        details,
        analysis,
        decision,
        owner
      ).run();

      finding = {id:Number(result?.meta?.last_row_id || 0)};
      findingCreated = true;
    }

    let findingId = Number(finding?.id);

    if (!Number.isInteger(findingId) || findingId <= 0) {
      finding = await db.prepare(`
        SELECT id
        FROM client_findings
        WHERE source_type = 'email_intake_review'
          AND source_reference = ?
        LIMIT 1
      `).bind(sourceReference).first();

      findingId = Number(finding?.id);
    }

    if (!Number.isInteger(findingId) || findingId <= 0) {
      throw new Error("The client finding was not available after save.");
    }

    const classificationJson = JSON.stringify({
      disposition:"monitoring",
      route:"human_review_finding",
      operator:"human",
      clientId:Number(client.id),
      findingId,
      evidenceRetained:true
    });

    const update = await db.prepare(`
      UPDATE email_intake
      SET
        processing_status = 'processed',
        disposition = 'monitoring',
        classification_source = 'human_review',
        classification_json = ?,
        classification_confidence = 'high',
        client_id = ?,
        finding_id = ?,
        processed_at = CURRENT_TIMESTAMP,
        failure_stage = NULL,
        failure_message = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND workspace_key = ?
        AND processing_status = 'ready_for_review'
        AND communication_id IS NULL
        AND activity_record_id IS NULL
        AND investigation_id IS NULL
        AND work_item_id IS NULL
    `).bind(
      classificationJson,
      Number(client.id),
      findingId,
      intakeId,
      workspaceKey
    ).run();

    if (Number(update?.meta?.changes || 0) !== 1) {
      const reconciled = await loadIntake(db, intakeId, workspaceKey);
      if (
        reconciled?.processing_status === "processed" &&
        Number(reconciled?.finding_id) === findingId
      ) {
        return success({
          requestId,
          intakeId,
          clientId:Number(reconciled.client_id || client.id),
          findingId,
          duplicate:true,
          findingCreated:false
        });
      }

      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
        error:"The intake record changed before the finding could be saved. Refresh Intake and review it again."
      },409);
    }

    return success({
      requestId,
      intakeId,
      clientId:Number(client.id),
      findingId,
      duplicate:false,
      findingCreated
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
      stage:"d1_email_intake_finding",
      error
    });

    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
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
      from_address,
      from_name,
      subject,
      body_text,
      processing_status,
      disposition,
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

function hasLegacyDownstreamLink(record) {
  return [
    record?.communication_id,
    record?.activity_record_id,
    record?.investigation_id,
    record?.work_item_id
  ].some(value => value !== null && value !== undefined);
}

function success({
  requestId,
  intakeId,
  clientId,
  findingId,
  duplicate,
  findingCreated
}) {
  return jsonResponse({
    ok:true,
    requestId,
    action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
    emailIntakeFindingVersion:EMAIL_INTAKE_FINDING_VERSION,
    intakeId,
    clientId,
    findingId,
    processingStatus:"processed",
    disposition:"monitoring",
    evidenceRetained:true,
    duplicate:Boolean(duplicate),
    findingsCreated:findingCreated ? 1 : 0,
    communicationsCreated:0,
    activityRecordsCreated:0,
    investigationsCreated:0,
    workItemsCreated:0
  });
}

function clean(value) {
  return String(value ?? "").trim();
}
