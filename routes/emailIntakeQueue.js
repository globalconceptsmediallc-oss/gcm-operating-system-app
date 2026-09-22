/* =========================================================
   Global Concepts Media Operating System
   File: routes/emailIntakeQueue.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Universal Email Intake — D1 Review Queue
   Purpose:
   Read durable provider-independent email intake records from D1 so the OS
   can review incoming operational email without scanning Gmail.
   ========================================================= */

import { ACTIONS, VERSION } from "../shared/config.js";
import { getDatabase, rowsOf } from "../shared/database.js";
import { jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";

export const EMAIL_INTAKE_QUEUE_VERSION = "1.0.0";
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_BODY_CHARS = 12000;

export async function handleEmailIntakeQueue(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_EMAIL_INTAKE_QUEUE,
      error:"The production D1 binding is unavailable."
    },503);
  }

  const workspaceKey = clean(body?.workspaceKey) || "gcm";
  const requestedLimit = Number(body?.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(requestedLimit)))
    : DEFAULT_LIMIT;

  try {
    const result = await db.prepare(`
      SELECT
        ei.id,
        ei.received_at,
        ei.source_date,
        ei.from_address,
        ei.from_name,
        ei.subject,
        ei.body_text,
        ei.has_attachments,
        ei.attachment_metadata_json,
        ei.processing_status,
        ei.disposition,
        ei.classification_source,
        ei.classification_confidence,
        ei.client_id,
        c.client_code,
        c.name AS client_name,
        eia.intake_address,
        eia.label AS intake_label
      FROM email_intake ei
      LEFT JOIN clients c
        ON c.id = ei.client_id
      LEFT JOIN email_intake_addresses eia
        ON eia.id = ei.intake_address_id
      WHERE ei.workspace_key = ?
        AND ei.processing_status = 'ready_for_review'
      ORDER BY
        ei.received_at ASC,
        ei.id ASC
      LIMIT ?
    `).bind(workspaceKey, limit).all();

    const queue = rowsOf(result).map(mapRecord);

    const countResult = await db.prepare(`
      SELECT COUNT(*) AS count
      FROM email_intake
      WHERE workspace_key = ?
        AND processing_status = 'ready_for_review'
    `).bind(workspaceKey).first();

    return jsonResponse({
      ok:true,
      requestId,
      action:ACTIONS.GET_EMAIL_INTAKE_QUEUE,
      version:VERSION,
      emailIntakeQueueVersion:EMAIL_INTAKE_QUEUE_VERSION,
      source:"D1",
      workspaceKey,
      generatedAt:new Date().toISOString(),
      counts:{
        readyForReview:Number(countResult?.count || 0),
        returned:queue.length
      },
      queue
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:ACTIONS.GET_EMAIL_INTAKE_QUEUE,
      stage:"d1_email_intake_queue",
      error
    });

    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_EMAIL_INTAKE_QUEUE,
      error:safeErrorMessage(error)
    },500);
  }
}

function mapRecord(row) {
  return {
    id:Number(row.id),
    receivedAt:row.received_at || null,
    sourceDate:row.source_date || null,
    sender:{
      address:row.from_address || null,
      name:row.from_name || null
    },
    subject:row.subject || "(No subject)",
    bodyText:String(row.body_text || "").slice(0,MAX_BODY_CHARS),
    hasAttachments:Number(row.has_attachments || 0) === 1,
    attachments:parseJsonArray(row.attachment_metadata_json),
    processingStatus:row.processing_status || null,
    disposition:row.disposition || null,
    classification:{
      source:row.classification_source || null,
      confidence:row.classification_confidence || null
    },
    client:row.client_id
      ? {
          id:Number(row.client_id),
          code:row.client_code || null,
          name:row.client_name || null
        }
      : null,
    intake:{
      address:row.intake_address || null,
      label:row.intake_label || null
    }
  };
}

function parseJsonArray(value) {
  try {
    const parsed=JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clean(value) {
  return String(value ?? "").trim();
}
