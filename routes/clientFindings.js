/* =========================================================
   Global Concepts Media Operating System
   File: routes/clientFindings.js
   Version: 1.1.0
   Status: Production Candidate
   Sprint: Proof — Reviewed Findings Read Path
   Purpose:
   Read durable human-reviewed client findings without expanding the operational
   Client Workspace query. D1 remains the source of truth. This route is read-only.

   Changes — 1.1.0:
   - Exposes the original human-selected intake disposition for each reviewed Finding.
   - Exposes linked Investigation / Work Item / Activity record IDs when present.
   - Keeps Monitoring and Information distinguishable from action-bearing findings
     without reclassifying or rewriting historical evidence.
   ========================================================= */

import { ACTIONS } from "../shared/config.js";
import { clean, jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";
import { getDatabase, rowsOf } from "../shared/database.js";

export const CLIENT_FINDINGS_VERSION = "1.1.0";

export async function handleClientFindings(body, env, requestId) {
  const db = getDatabase(env);
  const clientCode = clean(body?.clientCode || body?.client || "");

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_CLIENT_FINDINGS,
      error:"The production D1 binding is unavailable."
    },503);
  }

  if (!clientCode) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_CLIENT_FINDINGS,
      error:"A clientCode is required."
    },400);
  }

  try {
    const client = await db.prepare(`
      SELECT id, client_code, name
      FROM clients
      WHERE client_code = ? COLLATE NOCASE
      LIMIT 1
    `).bind(clientCode).first();

    if (!client) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GET_CLIENT_FINDINGS,
        error:`Client "${clientCode}" was not found.`
      },404);
    }

    const result = await db.prepare(`
      SELECT
        cf.id,
        cf.client_id,
        cf.category,
        cf.source_type,
        cf.source_reference,
        cf.source_title,
        cf.source_date,
        cf.reporting_period,
        cf.details,
        cf.analysis,
        cf.decision,
        cf.owner,
        cf.created_at,
        cf.updated_at,
        ei.disposition AS intake_disposition,
        ei.processing_status AS intake_processing_status,
        ei.investigation_id AS linked_investigation_id,
        ei.work_item_id AS linked_work_item_id,
        ei.activity_record_id AS linked_activity_record_id,
        ei.communication_id AS linked_communication_id
      FROM client_findings cf
      LEFT JOIN email_intake ei
        ON ei.finding_id = cf.id
      WHERE cf.client_id = ?
      ORDER BY datetime(cf.created_at) DESC, cf.id DESC
    `).bind(client.id).all();

    const findings = rowsOf(result).map(item => ({
      ...item,
      intake_disposition: clean(item.intake_disposition) || null,
      intake_processing_status: clean(item.intake_processing_status) || null,
      linked_investigation_id: Number(item.linked_investigation_id || 0) || null,
      linked_work_item_id: Number(item.linked_work_item_id || 0) || null,
      linked_activity_record_id: Number(item.linked_activity_record_id || 0) || null,
      linked_communication_id: Number(item.linked_communication_id || 0) || null
    }));

    return jsonResponse({
      ok:true,
      requestId,
      action:ACTIONS.GET_CLIENT_FINDINGS,
      clientFindingsVersion:CLIENT_FINDINGS_VERSION,
      client:{
        id:Number(client.id),
        clientCode:client.client_code,
        name:client.name
      },
      counts:{findings:findings.length},
      findings
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:ACTIONS.GET_CLIENT_FINDINGS,
      stage:"d1_client_findings_read",
      error
    });
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_CLIENT_FINDINGS,
      error:safeErrorMessage(error)
    },500);
  }
}
