/* =========================================================
   Global Concepts Media Operating System
   File: routes/emailIntakeDisposition.js
   Version: 1.1.0
   Status: Production Road-Test Candidate
   Sprint: Universal Email Intake — Human Disposition
   Purpose:
   Apply the operator's explicit disposition to a durable email_intake record
   without calling Gmail and without deleting source evidence from D1.

   Safety update — 1.1.0:
   - Requires an explicit backend confirmation token before any no-action write.
   - A missing or incorrect confirmation is rejected before D1 is read or changed.
   - Prevents refreshes, stale handlers, or accidental single requests from processing intake.

   Phase 1 behavior:
   - Supports Delete — No Action Required only.
   - Marks the intake record processed with disposition=delete.
   - Retains the full source email evidence in email_intake.
   - Creates 0 Communications, 0 Investigations, 0 Work Items, and 0 Proof rows.
   ========================================================= */

import { ACTIONS } from "../shared/config.js";
import { getDatabase } from "../shared/database.js";
import { jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";

export const EMAIL_INTAKE_DISPOSITION_VERSION = "1.1.0";

export async function handleEmailIntakeDisposition(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
      error:"The production D1 binding is unavailable."
    },503);
  }

  const intakeId = Number(body?.intakeId);
  const workspaceKey = clean(body?.workspaceKey) || "gcm";
  const disposition = clean(body?.disposition).toLowerCase();
  const confirmed = body?.confirmed === true;
  const confirmation = clean(body?.confirmation).toLowerCase();

  if (!confirmed || confirmation !== "delete-no-action-required") {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
      error:"Explicit confirmation is required before Delete — No Action Required can be saved."
    },400);
  }

  if (!Number.isInteger(intakeId) || intakeId <= 0) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
      error:"A valid intakeId is required."
    },400);
  }

  if (disposition !== "delete") {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
      error:"This phase supports only Delete — No Action Required."
    },400);
  }

  try {
    const existing = await db.prepare(`
      SELECT
        id,
        processing_status,
        disposition,
        communication_id,
        activity_record_id,
        investigation_id,
        work_item_id
      FROM email_intake
      WHERE id = ?
        AND workspace_key = ?
      LIMIT 1
    `).bind(intakeId, workspaceKey).first();

    if (!existing) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
        error:`Email intake record #${intakeId} was not found.`
      },404);
    }

    if (
      existing.processing_status === "processed" &&
      existing.disposition === "delete"
    ) {
      return successResponse({
        requestId,
        intakeId,
        workspaceKey,
        duplicate:true
      });
    }

    if (existing.processing_status !== "ready_for_review") {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
        error:`Email intake record #${intakeId} is not ready for review.`,
        processingStatus:existing.processing_status || null,
        disposition:existing.disposition || null
      },409);
    }

    const linkedRecord = [
      existing.communication_id,
      existing.activity_record_id,
      existing.investigation_id,
      existing.work_item_id
    ].some(value => value !== null && value !== undefined);

    if (linkedRecord) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
        error:"No-action disposition was blocked because downstream OS records are already linked to this intake record."
      },409);
    }

    const update = await db.prepare(`
      UPDATE email_intake
      SET
        processing_status = 'processed',
        disposition = 'delete',
        classification_source = 'human_operator',
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
    `).bind(intakeId, workspaceKey).run();

    const changes = Number(update?.meta?.changes || 0);

    if (changes !== 1) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
        error:"The intake record changed before the no-action disposition could be saved. Refresh Morning Command and review it again."
      },409);
    }

    return successResponse({
      requestId,
      intakeId,
      workspaceKey,
      duplicate:false
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
      stage:"d1_email_intake_disposition",
      error
    });

    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
      error:safeErrorMessage(error)
    },500);
  }
}

function successResponse({ requestId, intakeId, workspaceKey, duplicate }) {
  return jsonResponse({
    ok:true,
    requestId,
    action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
    emailIntakeDispositionVersion:EMAIL_INTAKE_DISPOSITION_VERSION,
    intakeId,
    workspaceKey,
    disposition:"delete",
    processingStatus:"processed",
    evidenceRetained:true,
    duplicate:Boolean(duplicate),
    writesPerformed:0,
    communicationsCreated:0,
    activityRecordsCreated:0,
    investigationsCreated:0,
    workItemsCreated:0
  });
}

function clean(value) {
  return String(value ?? "").trim();
}
