/* =========================================================
   Global Concepts Media Operating System
   File: routes/forwardLookOperations.js
   Version: 1.0.0
   Status: Production Candidate
   Sprint: Today — Interactive Forward Look
   Purpose:
   Persist operator decisions made directly from Forward Look without deleting
   or rewriting the authoritative source records that generated the row.

   Production rules:
   - Forward Look dispositions are row-level decisions keyed by the durable
     Forward Look key already rendered on Today.
   - close_passed hides only that exact commitment from active Forward Look.
   - Source records remain intact for history, audit, Media, Calendar, Schedule,
     Prospect, Work, Proof, and client reporting.
   - A closed row can be reopened later without reconstructing source history.
   ========================================================= */

import { getDatabase, rowsOf } from "../shared/database.js";
import { jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";

export const FORWARD_LOOK_OPERATIONS_ACTION = "forward-look-operations";
export const FORWARD_LOOK_OPERATIONS_VERSION = "1.0.0";

export async function handleForwardLookOperations(body, env, requestId) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok:false,
      requestId,
      action:FORWARD_LOOK_OPERATIONS_ACTION,
      forwardLookOperationsVersion:FORWARD_LOOK_OPERATIONS_VERSION,
      error:"The production D1 database binding is unavailable."
    },503);
  }

  const operation = clean(body?.operation || "list").toLowerCase();

  try {
    if (operation === "list") return await listDispositions(db, requestId);
    if (operation === "close_passed") return await closePassed(body, db, requestId);
    if (operation === "reopen") return await reopen(body, db, requestId);

    return jsonResponse({
      ok:false,
      requestId,
      action:FORWARD_LOOK_OPERATIONS_ACTION,
      forwardLookOperationsVersion:FORWARD_LOOK_OPERATIONS_VERSION,
      error:`Unsupported Forward Look operation: ${operation || "unknown"}.`
    },400);
  } catch (error) {
    logWorkerError({
      requestId,
      route:FORWARD_LOOK_OPERATIONS_ACTION,
      stage:`forward_look_${operation || "unknown"}`,
      error
    });
    return jsonResponse({
      ok:false,
      requestId,
      action:FORWARD_LOOK_OPERATIONS_ACTION,
      forwardLookOperationsVersion:FORWARD_LOOK_OPERATIONS_VERSION,
      error:"Forward Look Operations could not complete the request.",
      details:safeErrorMessage(error)
    },500);
  }
}

async function listDispositions(db, requestId) {
  const result = await db.prepare(`
    SELECT id, forward_key, kind, title, disposition, reason, reviewed_by,
           closed_at, reopened_at, created_at, updated_at
    FROM forward_look_dispositions
    ORDER BY datetime(updated_at) DESC, id DESC
    LIMIT 1000
  `).all();

  const dispositions = rowsOf(result).map(mapRow);
  const closedKeys = dispositions
    .filter(item => item.disposition === "closed_passed")
    .map(item => item.forwardKey);

  return jsonResponse({
    ok:true,
    requestId,
    action:FORWARD_LOOK_OPERATIONS_ACTION,
    operation:"list",
    forwardLookOperationsVersion:FORWARD_LOOK_OPERATIONS_VERSION,
    dispositions,
    closedKeys,
    writesPerformed:0
  });
}

async function closePassed(body, db, requestId) {
  const forwardKey = clean(body?.forwardKey || body?.forward_key);
  const kind = nullable(body?.kind);
  const title = nullable(body?.title);
  const reason = nullable(body?.reason) || "Passed commitment closed from Today — no further action is possible.";
  const reviewedBy = clean(body?.reviewedBy || body?.reviewed_by || "Andy") || "Andy";

  if (!forwardKey) {
    return bad(requestId, "close_passed requires forwardKey.");
  }

  await db.prepare(`
    INSERT INTO forward_look_dispositions (
      forward_key, kind, title, disposition, reason, reviewed_by,
      closed_at, reopened_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'closed_passed', ?, ?, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(forward_key) DO UPDATE SET
      kind=excluded.kind,
      title=excluded.title,
      disposition='closed_passed',
      reason=excluded.reason,
      reviewed_by=excluded.reviewed_by,
      closed_at=CURRENT_TIMESTAMP,
      reopened_at=NULL,
      updated_at=CURRENT_TIMESTAMP
  `).bind(forwardKey, kind, title, reason, reviewedBy).run();

  return jsonResponse({
    ok:true,
    requestId,
    action:FORWARD_LOOK_OPERATIONS_ACTION,
    operation:"close_passed",
    forwardLookOperationsVersion:FORWARD_LOOK_OPERATIONS_VERSION,
    forwardKey,
    disposition:"closed_passed",
    writesPerformed:1
  });
}

async function reopen(body, db, requestId) {
  const forwardKey = clean(body?.forwardKey || body?.forward_key);
  const reviewedBy = clean(body?.reviewedBy || body?.reviewed_by || "Andy") || "Andy";

  if (!forwardKey) {
    return bad(requestId, "reopen requires forwardKey.");
  }

  const result = await db.prepare(`
    UPDATE forward_look_dispositions
    SET disposition='reopened',
        reviewed_by=?,
        reopened_at=CURRENT_TIMESTAMP,
        updated_at=CURRENT_TIMESTAMP
    WHERE forward_key=?
      AND disposition='closed_passed'
  `).bind(reviewedBy, forwardKey).run();

  const changes = Number(result?.meta?.changes || 0);
  if (!changes) {
    return jsonResponse({
      ok:false,
      requestId,
      action:FORWARD_LOOK_OPERATIONS_ACTION,
      operation:"reopen",
      forwardLookOperationsVersion:FORWARD_LOOK_OPERATIONS_VERSION,
      error:"The Forward Look commitment is not currently closed."
    },409);
  }

  return jsonResponse({
    ok:true,
    requestId,
    action:FORWARD_LOOK_OPERATIONS_ACTION,
    operation:"reopen",
    forwardLookOperationsVersion:FORWARD_LOOK_OPERATIONS_VERSION,
    forwardKey,
    disposition:"reopened",
    writesPerformed:1
  });
}

function mapRow(row) {
  return {
    id:Number(row?.id || 0) || null,
    forwardKey:clean(row?.forward_key),
    kind:nullable(row?.kind),
    title:nullable(row?.title),
    disposition:clean(row?.disposition),
    reason:nullable(row?.reason),
    reviewedBy:nullable(row?.reviewed_by),
    closedAt:nullable(row?.closed_at),
    reopenedAt:nullable(row?.reopened_at),
    createdAt:nullable(row?.created_at),
    updatedAt:nullable(row?.updated_at)
  };
}

function clean(value) {
  return String(value ?? "").trim();
}

function nullable(value) {
  const valueText = clean(value);
  return valueText || null;
}

function bad(requestId, error) {
  return jsonResponse({
    ok:false,
    requestId,
    action:FORWARD_LOOK_OPERATIONS_ACTION,
    forwardLookOperationsVersion:FORWARD_LOOK_OPERATIONS_VERSION,
    error
  },400);
}
