/* =========================================================
   Global Concepts Media Operating System
   File: routes/emailIntakeFinding.js
   Version: 1.1.0
   Status: Production Road-Test Candidate
   Sprint: Signal Review — Explicit Human Routing
   Purpose:
   Save the useful details learned during a human-led email/report review,
   require an explicit operator route, preserve the source email as evidence,
   and create only the downstream record(s) required by that selected route.

   Changes — 1.1.0:
   - Adds explicit Monitoring, Information, Investigation, and Work Item routing
     to the reviewed Finding save path.
   - Preserves the three human-reviewed finding fields for every routed signal.
   - Reuses the verified email-intake disposition engine for downstream writes.
   - Defaults omitted legacy requests to Monitoring for backward compatibility.
   ========================================================= */

import { ACTIONS } from "../shared/config.js";
import { getDatabase } from "../shared/database.js";
import { jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";
import { handleEmailIntakeDisposition } from "./emailIntakeDisposition.js";

export const EMAIL_INTAKE_FINDING_VERSION = "1.1.0";
const SUPPORTED_DISPOSITIONS = new Set([
  "monitoring",
  "information",
  "investigation",
  "requested_work"
]);

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
  const disposition = normalizeDisposition(body?.disposition);

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

  if (!SUPPORTED_DISPOSITIONS.has(disposition)) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
      error:"Choose Monitoring, Information, Investigation, or Work Item before saving."
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

    const alreadyProcessed = intake.processing_status === "processed";
    const existingDisposition = clean(intake.disposition).toLowerCase();

    if (alreadyProcessed && existingDisposition && existingDisposition !== disposition) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
        error:`Email intake record #${intakeId} is already processed as ${existingDisposition}. Its route cannot be silently changed.`,
        processingStatus:intake.processing_status || null,
        disposition:existingDisposition
      },409);
    }

    if (!alreadyProcessed && intake.processing_status !== "ready_for_review") {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
        error:`Email intake record #${intakeId} is not ready for review.`,
        processingStatus:intake.processing_status || null
      },409);
    }

    if (
      !alreadyProcessed &&
      disposition === "monitoring" &&
      hasLegacyDownstreamLink(intake)
    ) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
        error:"Monitoring save was blocked because this intake already has a downstream OS record."
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

    if (alreadyProcessed) {
      if (Number(intake.finding_id) !== findingId) {
        await db.prepare(`
          UPDATE email_intake
          SET
            finding_id = ?,
            client_id = COALESCE(client_id, ?),
            classification_source = 'human_review',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND workspace_key = ?
            AND processing_status = 'processed'
            AND disposition = ?
        `).bind(
          findingId,
          Number(client.id),
          intakeId,
          workspaceKey,
          disposition
        ).run();
      }

      return success({
        requestId,
        intakeId,
        clientId:Number(intake.client_id || client.id),
        findingId,
        disposition,
        duplicate:true,
        findingCreated,
        routePayload:existingRoutePayload(intake, disposition)
      });
    }

    if (disposition === "monitoring") {
      const classificationJson = JSON.stringify({
        disposition,
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
          clean(reconciled?.disposition).toLowerCase() === "monitoring"
        ) {
          if (Number(reconciled?.finding_id) !== findingId) {
            await db.prepare(`
              UPDATE email_intake
              SET finding_id = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND workspace_key = ?
            `).bind(findingId,intakeId,workspaceKey).run();
          }

          return success({
            requestId,
            intakeId,
            clientId:Number(reconciled.client_id || client.id),
            findingId,
            disposition,
            duplicate:true,
            findingCreated:false,
            routePayload:existingRoutePayload(reconciled, disposition)
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
        disposition,
        duplicate:false,
        findingCreated,
        routePayload:null
      });
    }

    const routeResponse = await handleEmailIntakeDisposition({
      workspaceKey,
      intakeId,
      clientId:Number(client.id),
      disposition,
      owner
    },env,requestId);

    const routePayload = await routeResponse.clone().json().catch(() => null);

    if (!routeResponse.ok || routePayload?.ok !== true) {
      return routeResponse;
    }

    const linkUpdate = await db.prepare(`
      UPDATE email_intake
      SET
        finding_id = ?,
        classification_source = 'human_review',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND workspace_key = ?
        AND processing_status = 'processed'
        AND disposition = ?
    `).bind(
      findingId,
      intakeId,
      workspaceKey,
      disposition
    ).run();

    if (Number(linkUpdate?.meta?.changes || 0) !== 1) {
      const reconciled = await loadIntake(db, intakeId, workspaceKey);
      if (
        reconciled?.processing_status !== "processed" ||
        clean(reconciled?.disposition).toLowerCase() !== disposition
      ) {
        return jsonResponse({
          ok:false,
          requestId,
          action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
          error:"The selected route was created, but the reviewed finding could not be linked. Refresh Intake before taking any further action."
        },409);
      }
    }

    return success({
      requestId,
      intakeId,
      clientId:Number(client.id),
      findingId,
      disposition,
      duplicate:Boolean(routePayload?.duplicate),
      findingCreated,
      routePayload
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
  disposition,
  duplicate,
  findingCreated,
  routePayload
}) {
  const payload = routePayload && typeof routePayload === "object"
    ? routePayload
    : {};

  return jsonResponse({
    ok:true,
    requestId,
    action:ACTIONS.SAVE_EMAIL_INTAKE_FINDING,
    emailIntakeFindingVersion:EMAIL_INTAKE_FINDING_VERSION,
    intakeId,
    clientId,
    findingId,
    processingStatus:"processed",
    disposition,
    evidenceRetained:true,
    duplicate:Boolean(duplicate),
    findingsCreated:findingCreated ? 1 : 0,
    communicationId:Number(payload.communicationId || 0) || null,
    activityRecordId:Number(payload.activityRecordId || 0) || null,
    investigationId:Number(payload.investigationId || 0) || null,
    workItemId:Number(payload.workItemId || 0) || null,
    communicationsCreated:Number(payload.communicationsCreated || 0),
    activityRecordsCreated:Number(payload.activityRecordsCreated || 0),
    investigationsCreated:Number(payload.investigationsCreated || 0),
    workItemsCreated:Number(payload.workItemsCreated || 0)
  });
}

function existingRoutePayload(intake, disposition) {
  return {
    duplicate:true,
    communicationId:Number(intake?.communication_id || 0) || null,
    activityRecordId:Number(intake?.activity_record_id || 0) || null,
    investigationId:Number(intake?.investigation_id || 0) || null,
    workItemId:Number(intake?.work_item_id || 0) || null,
    communicationsCreated:0,
    activityRecordsCreated:0,
    investigationsCreated:0,
    workItemsCreated:0,
    disposition
  };
}

function normalizeDisposition(value) {
  const normalized = clean(value).toLowerCase();
  return normalized || "monitoring";
}

function clean(value) {
  return String(value ?? "").trim();
}
