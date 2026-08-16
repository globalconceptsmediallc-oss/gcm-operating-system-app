/* =========================================================
   Global Concepts Media Operating System
   File: routes/mediaAssignmentTrafficIds.js
   Version: 1.0.0
   Status: Production Candidate
   Sprint: Market-Level Traffic ID / ISCI
   Purpose: Read and save station traffic identifiers on Creative market
            assignments without changing Creative production history or
            legacy Media placement records.
   ========================================================= */

import { VERSION, ACTIONS } from "../shared/config.js";
import { safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase, rowsOf } from "../shared/database.js";

export const MEDIA_ASSIGNMENT_TRAFFIC_ID_OPERATIONS = Object.freeze([
  "get_assignment_traffic_ids",
  "save_assignment_traffic_ids"
]);

export async function handleMediaAssignmentTrafficIds(operation, body, env, requestId) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") {
    return reply(requestId, { ok: false, error: "D1 is unavailable." }, 503);
  }

  try {
    if (operation === "get_assignment_traffic_ids") {
      const result = await db.prepare(`
        SELECT id, creative_id, market, outlet_name, traffic_id
        FROM media_creative_assignments
        ORDER BY creative_id, id
      `).all();

      return reply(requestId, {
        ok: true,
        operation,
        assignments: rowsOf(result).map(row => ({
          assignmentId: Number(row.id),
          creativeId: Number(row.creative_id),
          market: text(row.market),
          outletName: text(row.outlet_name),
          trafficId: text(row.traffic_id)
        }))
      });
    }

    if (operation === "save_assignment_traffic_ids") {
      const creativeId = positiveInteger(body?.creativeId);
      const assignments = Array.isArray(body?.assignments) ? body.assignments : [];

      if (!creativeId) {
        return reply(requestId, { ok: false, error: "creativeId is required." }, 400);
      }

      const creative = await db.prepare(
        `SELECT id FROM media_creatives WHERE id=? LIMIT 1`
      ).bind(creativeId).first();

      if (!creative) {
        return reply(requestId, { ok: false, error: `Creative ${creativeId} was not found.` }, 404);
      }

      let savedCount = 0;

      for (const item of assignments) {
        const market = requiredText(item?.market);
        const outletName = requiredText(item?.outletName);
        const trafficId = requiredText(item?.trafficId);

        if (!market || !outletName || !trafficId) continue;

        const result = await db.prepare(`
          UPDATE media_creative_assignments
          SET traffic_id=?, updated_at=CURRENT_TIMESTAMP
          WHERE creative_id=?
            AND LOWER(TRIM(market))=LOWER(TRIM(?))
            AND LOWER(TRIM(outlet_name))=LOWER(TRIM(?))
        `).bind(trafficId, creativeId, market, outletName).run();

        if (!result?.meta?.changes) {
          return reply(requestId, {
            ok: false,
            error: `${market} / ${outletName} must be saved as a market assignment before its Traffic ID / ISCI can be stored.`
          }, 409);
        }

        savedCount += Number(result.meta.changes || 0);
      }

      return reply(requestId, {
        ok: true,
        operation,
        creativeId,
        savedCount
      });
    }

    return reply(requestId, {
      ok: false,
      error: `Unsupported Media assignment Traffic ID operation: ${operation}`
    }, 400);
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.GET_MEDIA_OPERATIONS,
      stage: `media_assignment_traffic_id_${operation}`,
      error
    });

    return reply(requestId, {
      ok: false,
      error: "The Media assignment Traffic ID operation could not be completed.",
      details: safeErrorMessage(error)
    }, 500);
  }
}

function reply(requestId, payload, status = 200) {
  return jsonResponse({
    requestId,
    action: ACTIONS.GET_MEDIA_OPERATIONS,
    version: VERSION,
    ...payload
  }, status);
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function requiredText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function text(value) {
  return value == null ? "" : String(value);
}
