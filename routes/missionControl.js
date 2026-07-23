/* =========================================================
   Global Concepts Media Operating System
   File: routes/missionControl.js
   Version: 7.1.0
   Sprint: Mission Control — Card 1
   Purpose: Return the live list of clients requiring attention
            from unresolved D1 investigations or work items.

   Card rule:
   - Show each client only once.
   - Return only client navigation data.
   - Do not return issue counts or issue descriptions.
   - Clicking the client opens that client's workspace.
   ========================================================= */

import {
  VERSION,
  ACTIONS
} from "../shared/config.js";

import {
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "../shared/http.js";

import {
  getDatabase,
  rowsOf
} from "../shared/database.js";

/* =========================================================
   Mission Control — Clients Requiring Attention
   ========================================================= */

export async function handleMissionControl(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_MISSION_CONTROL,
      version: VERSION,
      error: "The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."
    }, 503);
  }

  try {
    const result = await db.prepare(`
      SELECT
        c.id,
        c.client_code,
        c.name
      FROM clients c
      WHERE
        EXISTS (
          SELECT 1
          FROM investigations i
          WHERE i.client_id = c.id
            AND LOWER(
              REPLACE(
                REPLACE(
                  COALESCE(i.status, 'open'),
                  '-',
                  '_'
                ),
                ' ',
                '_'
              )
            ) NOT IN (
              'complete',
              'completed',
              'closed',
              'resolved',
              'cancelled',
              'canceled',
              'archived',
              'ignored',
              'no_action'
            )
        )
        OR EXISTS (
          SELECT 1
          FROM work_items w
          WHERE w.client_id = c.id
            AND LOWER(
              REPLACE(
                REPLACE(
                  COALESCE(w.status, 'open'),
                  '-',
                  '_'
                ),
                ' ',
                '_'
              )
            ) NOT IN (
              'complete',
              'completed',
              'closed',
              'resolved',
              'cancelled',
              'canceled',
              'archived',
              'ignored',
              'no_action',
              'published'
            )
        )
      ORDER BY
        LOWER(c.name) ASC,
        c.id ASC
    `).all();

    const clientsRequiringAttention = rowsOf(result).map((client) => ({
      clientId: Number(client.id),
      clientCode: String(client.client_code || ""),
      clientName: String(client.name || client.client_code || "Unknown Client"),
      href: buildClientWorkspaceHref(client.client_code)
    }));

    return jsonResponse({
      ok: true,
      requestId,
      action: ACTIONS.GET_MISSION_CONTROL,
      version: VERSION,
      missionControl: {
        clientsRequiringAttention
      }
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.GET_MISSION_CONTROL,
      stage: "clients_requiring_attention_query",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_MISSION_CONTROL,
      version: VERSION,
      error: "Mission Control could not load clients requiring attention.",
      details: safeErrorMessage(error)
    }, 500);
  }
}

/* =========================================================
   Navigation
   ========================================================= */

function buildClientWorkspaceHref(clientCode) {
  const code = String(clientCode || "").trim();

  return code
    ? `clients.html?client=${encodeURIComponent(code)}`
    : "clients.html";
}
