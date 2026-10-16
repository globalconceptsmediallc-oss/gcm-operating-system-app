/* =========================================================
   Global Concepts Media Operating System
   File: routes/forwardLookOperations.js
   Version: 1.1.0
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
export const FORWARD_LOOK_OPERATIONS_VERSION = "1.1.0";

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
    if (operation === "record_social_post") return await recordSocialPost(body, db, requestId);
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
    .filter(item => ["closed_passed","social_published","social_missed","social_mixed"].includes(item.disposition))
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


const SOCIAL_CHANNELS = ["Facebook", "Google Business Profile", "Instagram"];
const SOCIAL_STATUSES = new Set(["pending","published","missed"]);

async function recordSocialPost(body, db, requestId) {
  const forwardKey = clean(body?.forwardKey);
  const scheduleItemId = Number(body?.scheduleItemId);
  const plannedDate = clean(body?.plannedDate);
  const reviewedBy = clean(body?.reviewedBy || "Operator").slice(0,120);
  const note = clean(body?.note).slice(0,1500);
  if (!forwardKey || !Number.isSafeInteger(scheduleItemId) || scheduleItemId <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
    return bad(requestId, "A valid schedule item and dated social-post key are required.");
  }

  const source = await db.prepare(
    "SELECT id, source_key, item_type, title, market, start_date, status, metadata_json FROM schedule_items WHERE id=? AND archived_at IS NULL"
  ).bind(scheduleItemId).first();
  if (!source || ["cancelled","canceled"].includes(clean(source.status).toLowerCase())) {
    return bad(requestId, "The authoritative schedule item is not available.");
  }
  const metadata = parseJson(source.metadata_json) || {};
  let expected = [];
  let channels = [];
  if (source.item_type === "promotion") {
    expected = (Array.isArray(metadata.schedule) ? metadata.schedule : [])
      .filter(post => clean(post?.date) === plannedDate)
      .map(post => clean(post?.title || "SOCIAL POST — " + source.title));
    channels = Array.isArray(metadata.channels) ? metadata.channels : [];
  } else if (source.item_type === "gun_show") {
    expected = (Array.isArray(metadata.socialSequence) ? metadata.socialSequence : [])
      .filter(post => addDays(source.start_date, Number(post?.offset || 0)) === plannedDate)
      .map((post) => clean(post?.title || "SOCIAL") + (source.market ? " · " + source.market : ""));
    channels = Array.isArray(metadata.socialChannels) ? metadata.socialChannels : [];
  } else if (source.item_type === "social_post" && clean(source.start_date) === plannedDate) {
    expected = [clean(source.title)];
    channels = Array.isArray(metadata.channels) ? metadata.channels : [];
  } else {
    return bad(requestId, "This source does not contain a scheduled social post on that date.");
  }
  if (!expected.some(title => forwardKey ===
    "schedule|" + source.source_key + ":social_post:" + plannedDate + ":" + title + "|" + plannedDate)) {
    return bad(requestId, "The social-post key does not match the authoritative schedule.");
  }

  const expectedChannels = [...new Set((channels.length ? channels : SOCIAL_CHANNELS)
    .map(clean).filter(Boolean))];
  if (!expectedChannels.length || expectedChannels.length > 10) return bad(requestId, "Invalid scheduled platforms.");
  const supplied = Array.isArray(body?.platforms) ? body.platforms : [];
  if (supplied.length !== expectedChannels.length) return bad(requestId, "Every scheduled platform requires a disposition.");
  const seen = new Set(), normalized = [];
  for (const item of supplied) {
    const platform = clean(item?.platform);
    const status = clean(item?.status).toLowerCase();
    const proofReference = clean(item?.proofReference).slice(0,1000);
    const publishedDate = clean(item?.publishedDate);
    if (!expectedChannels.includes(platform) || seen.has(platform) || !SOCIAL_STATUSES.has(status)) {
      return bad(requestId, "Unknown, duplicate, or invalid scheduled platform status.");
    }
    if (status === "published" &&
        (!proofReference || !/^\d{4}-\d{2}-\d{2}$/.test(publishedDate))) {
      return bad(requestId, "Published platforms require their actual publication date and a durable proof reference.");
    }
    seen.add(platform);
    normalized.push({
      platform, status,
      proofReference: status === "published" ? proofReference : "",
      publishedDate: status === "published" ? publishedDate : ""
    });
  }
  const counts = {
    published: normalized.filter(p => p.status === "published").length,
    missed: normalized.filter(p => p.status === "missed").length,
    pending: normalized.filter(p => p.status === "pending").length
  };
  const disposition = counts.pending ? "social_partial" :
    !counts.missed ? "social_published" :
    !counts.published ? "social_missed" : "social_mixed";
  const reason = JSON.stringify({
    schema:"gcm-social-execution-v1", scheduleItemId, plannedDate, platforms:normalized, note
  });

  await db.prepare(`
    INSERT INTO forward_look_dispositions
      (forward_key, kind, title, disposition, reason, reviewed_by, closed_at, reopened_at, created_at, updated_at)
    VALUES (?, 'Social Post', ?, ?, ?, ?, CASE WHEN ?='social_partial' THEN NULL ELSE CURRENT_TIMESTAMP END,
      NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(forward_key) DO UPDATE SET
      kind=excluded.kind, title=excluded.title, disposition=excluded.disposition,
      reason=excluded.reason, reviewed_by=excluded.reviewed_by,
      closed_at=excluded.closed_at, reopened_at=NULL, updated_at=CURRENT_TIMESTAMP
  `).bind(forwardKey, expected[0], disposition, reason, reviewedBy, disposition).run();

  return jsonResponse({
    ok:true,requestId,action:FORWARD_LOOK_OPERATIONS_ACTION,operation:"record_social_post",
    forwardKey,disposition,counts,writesPerformed:1
  });
}

function parseJson(raw) {
  try { return JSON.parse(raw || "{}"); } catch { return null; }
}
function addDays(date, offset) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(date)) || !Number.isInteger(offset) || Math.abs(offset)>365) return "";
  const dt = new Date(date + "T12:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0,10);
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
      AND disposition IN ('closed_passed','social_partial','social_published','social_missed','social_mixed')
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
