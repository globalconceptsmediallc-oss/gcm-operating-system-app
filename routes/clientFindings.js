/* =========================================================
   Global Concepts Media Operating System
   File: routes/clientFindings.js
   Version: 1.0.0
   Status: Production Candidate
   Sprint: Proof — Reviewed Findings Read Path
   Purpose:
   Read durable human-reviewed client findings without expanding the operational
   Client Workspace query. D1 remains the source of truth. This route is read-only.
   ========================================================= */

import { ACTIONS } from "../shared/config.js";
import { clean, jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";
import { getDatabase, rowsOf } from "../shared/database.js";

export const CLIENT_FINDINGS_VERSION = "1.0.0";

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
        id,
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
      FROM client_findings
      WHERE client_id = ?
      ORDER BY datetime(created_at) DESC, id DESC
    `).bind(client.id).all();

    const findings = rowsOf(result);

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
