/* =========================================================
   Global Concepts Media Operating System
   File: routes/investigationProcessing.js
   Version: 7.2.0
   Status: Production Candidate
   Source: Production Worker 7.1.1
   Sprint: Investigation Processing — Road Test #21
   Purpose: Process an existing Investigation after review by
            recording the finding and closing it when no Work
            Item is required.
   ========================================================= */

import {
  VERSION,
  ACTIONS
} from "../shared/config.js";

import {
  clean,
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "../shared/http.js";

import {
  getDatabase
} from "../shared/database.js";

/* =========================================================
   Investigation Processing — Existing Investigation Update
   ========================================================= */

export async function handleProcessInvestigation(body, env, requestId) {
  const db = getDatabase(env);

  const clientCode = clean(body?.clientCode || body?.client);
  const investigationId = Number(body?.investigationId || body?.investigation_id);
  const findingSummary = clean(body?.findingSummary || body?.finding_summary);
  const outcome = clean(body?.outcome).toLowerCase();

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error:
        "The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."
    }, 503);
  }

  if (!clientCode) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error: "A clientCode is required."
    }, 400);
  }

  if (!Number.isInteger(investigationId) || investigationId <= 0) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error: "A valid investigationId is required."
    }, 400);
  }

  if (!findingSummary) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error: "A findingSummary is required before an Investigation can be closed."
    }, 400);
  }

  /*
   * Investigation Processing v1 supports only the road-tested outcome:
   * the Investigation was completed and no Work Item is required.
   *
   * Do not expand this route to create Work Items until that path has
   * been tested against a real production Investigation.
   */
  if (outcome !== "no_work_required") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error:
        'Investigation Processing v1 supports only outcome "no_work_required".'
    }, 400);
  }

  try {
    const investigation = await db.prepare(`
      SELECT
        i.id,
        i.client_id,
        i.communication_id,
        i.title,
        i.status,
        i.finding_summary,
        c.client_code,
        c.name AS client_name
      FROM investigations i
      JOIN clients c ON c.id = i.client_id
      WHERE i.id = ?
        AND c.client_code = ? COLLATE NOCASE
      LIMIT 1
    `).bind(
      investigationId,
      clientCode
    ).first();

    if (!investigation) {
      return jsonResponse({
        ok: false,
        requestId,
        action: ACTIONS.PROCESS_INVESTIGATION,
        error:
          `Investigation #${investigationId} was not found for client "${clientCode}".`
      }, 404);
    }

    if (isClosedStatus(investigation.status)) {
      return jsonResponse({
        ok: true,
        requestId,
        action: ACTIONS.PROCESS_INVESTIGATION,
        version: VERSION,
        source: "D1",
        updated: false,
        alreadyClosed: true,
        investigation: {
          id: investigation.id,
          clientCode: investigation.client_code,
          clientName: investigation.client_name,
          communicationId: investigation.communication_id,
          title: investigation.title,
          status: investigation.status,
          findingSummary: investigation.finding_summary
        },
        message: "This Investigation is already closed. No duplicate update was made."
      });
    }

    await db.prepare(`
      UPDATE investigations
      SET
        finding_summary = ?,
        status = 'closed',
        closed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND client_id = ?
    `).bind(
      findingSummary,
      investigation.id,
      investigation.client_id
    ).run();

    const updated = await db.prepare(`
      SELECT
        i.id,
        i.client_id,
        i.communication_id,
        i.title,
        i.description,
        i.priority,
        i.status,
        i.assigned_to,
        i.finding_summary,
        i.recommendation,
        i.opened_at,
        i.resolved_at,
        i.closed_at,
        i.created_at,
        i.updated_at,
        c.client_code,
        c.name AS client_name
      FROM investigations i
      JOIN clients c ON c.id = i.client_id
      WHERE i.id = ?
      LIMIT 1
    `).bind(
      investigation.id
    ).first();

    if (!updated) {
      throw new Error(
        `D1 completed the update but Investigation #${investigation.id} could not be reloaded.`
      );
    }

    return jsonResponse({
      ok: true,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      version: VERSION,
      source: "D1",
      updated: true,
      outcome: "no_work_required",
      workItemCreated: false,
      investigation: {
        id: updated.id,
        clientCode: updated.client_code,
        clientName: updated.client_name,
        communicationId: updated.communication_id,
        title: updated.title,
        description: updated.description,
        priority: updated.priority,
        status: updated.status,
        assignedTo: updated.assigned_to,
        findingSummary: updated.finding_summary,
        recommendation: updated.recommendation,
        openedAt: updated.opened_at,
        resolvedAt: updated.resolved_at,
        closedAt: updated.closed_at,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at
      }
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.PROCESS_INVESTIGATION,
      stage: "d1_investigation_processing",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error: safeErrorMessage(error)
    }, 500);
  }
}

/* =========================================================
   Route-Specific Helpers
   ========================================================= */

function isClosedStatus(value) {
  const status = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  return [
    "complete",
    "completed",
    "closed",
    "resolved",
    "cancelled",
    "canceled",
    "archived",
    "ignored",
    "no_action"
  ].includes(status);
}
