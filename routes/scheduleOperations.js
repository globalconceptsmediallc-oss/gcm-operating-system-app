/* =========================================================
   Global Concepts Media Operating System
   File: routes/scheduleOperations.js
   Version: 1.0.0
   Status: Production Candidate — Durable Schedule Authority
   Sprint: Calendar / Media Calendar — One Record, Multiple Views
   Purpose:
   Store campaign/event schedule records in D1, stage human-reviewed changes,
   preserve version history, and return one derived event feed for Agency
   Calendar, Media Calendar, and Today.
   ========================================================= */

import { getDatabase, rowsOf } from "../shared/database.js";
import { jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";

export const SCHEDULE_OPERATIONS_ACTION = "schedule-operations";
export const SCHEDULE_OPERATIONS_VERSION = "1.0.0";

const ITEM_TYPES = new Set(["gun_show","promotion","social_post","campaign","event","deadline","radio_flight","other"]);
const STATUSES = new Set(["planned","confirmed","candidate","ready","posted","placed","verified","complete","completed","cancelled","canceled"]);
const REQUEST_TYPES = new Set(["add","change","cancel"]);

export async function handleScheduleOperations(body, env, requestId) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({ok:false,requestId,action:SCHEDULE_OPERATIONS_ACTION,scheduleOperationsVersion:SCHEDULE_OPERATIONS_VERSION,error:"The production D1 database binding is unavailable."},503);
  }

  const operation = clean(body?.operation || "list").toLowerCase();

  try {
    if (operation === "list") return await listSchedule(db, requestId);
    if (operation === "create_candidate") return await createCandidate(body, db, requestId);
    if (operation === "approve_candidate") return await approveCandidate(body, db, requestId);
    if (operation === "hold_candidate") return await dispositionCandidate(body, db, requestId, "held");
    if (operation === "ignore_candidate") return await dispositionCandidate(body, db, requestId, "ignored");
    return jsonResponse({ok:false,requestId,action:SCHEDULE_OPERATIONS_ACTION,scheduleOperationsVersion:SCHEDULE_OPERATIONS_VERSION,error:`Unsupported Schedule operation: ${operation || "unknown"}.`},400);
  } catch (error) {
    logWorkerError({requestId,route:SCHEDULE_OPERATIONS_ACTION,stage:`schedule_${operation || "unknown"}`,error});
    return jsonResponse({ok:false,requestId,action:SCHEDULE_OPERATIONS_ACTION,scheduleOperationsVersion:SCHEDULE_OPERATIONS_VERSION,error:"Schedule Operations could not complete the request.",details:safeErrorMessage(error)},500);
  }
}

async function listSchedule(db, requestId) {
  const items = rowsOf(await db.prepare(`
    SELECT si.*, c.client_code, c.name AS client_name
    FROM schedule_items si
    LEFT JOIN clients c ON c.id = si.client_id
    WHERE si.archived_at IS NULL
    ORDER BY si.start_date, si.id
  `).all()).map(normalizeItemRow);

  const pendingChanges = rowsOf(await db.prepare(`
    SELECT scr.*, c.client_code, c.name AS client_name, si.title AS target_title
    FROM schedule_change_requests scr
    LEFT JOIN clients c ON c.id = scr.client_id
    LEFT JOIN schedule_items si ON si.id = scr.target_item_id
    WHERE scr.status IN ('pending','held')
    ORDER BY CASE scr.status WHEN 'pending' THEN 0 ELSE 1 END, scr.created_at, scr.id
  `).all()).map(normalizeChangeRow);

  const history = rowsOf(await db.prepare(`
    SELECT h.*, si.source_key, si.title
    FROM schedule_item_history h
    JOIN schedule_items si ON si.id = h.schedule_item_id
    ORDER BY h.changed_at DESC, h.id DESC
    LIMIT 250
  `).all()).map(row => ({
    id:Number(row.id),
    scheduleItemId:Number(row.schedule_item_id),
    changeRequestId:positive(row.change_request_id),
    sourceKey:text(row.source_key),
    title:text(row.title),
    versionNumber:Number(row.version_number || 1),
    snapshot:parseJson(row.snapshot_json, {}),
    changeType:text(row.change_type),
    changedBy:text(row.changed_by),
    changedAt:text(row.changed_at)
  }));

  return jsonResponse({
    ok:true,
    requestId,
    action:SCHEDULE_OPERATIONS_ACTION,
    operation:"list",
    scheduleOperationsVersion:SCHEDULE_OPERATIONS_VERSION,
    scheduleItems:items,
    scheduleEvents:deriveEvents(items),
    pendingChanges,
    history,
    writesPerformed:0
  });
}

async function createCandidate(body, db, requestId) {
  const requestType = clean(body?.requestType || body?.candidate?.requestType || "add").toLowerCase();
  if (!REQUEST_TYPES.has(requestType)) return bad(requestId, "requestType must be add, change, or cancel.");

  const targetItemId = positive(body?.targetItemId ?? body?.candidate?.targetItemId);
  if (requestType !== "add" && !targetItemId) return bad(requestId, "A target schedule item is required for change or cancel.");

  let existing = null;
  if (targetItemId) {
    existing = rowsOf(await db.prepare("SELECT * FROM schedule_items WHERE id=? AND archived_at IS NULL LIMIT 1").bind(targetItemId).all())[0] || null;
    if (!existing) return jsonResponse({ok:false,requestId,action:SCHEDULE_OPERATIONS_ACTION,scheduleOperationsVersion:SCHEDULE_OPERATIONS_VERSION,error:`Schedule item ${targetItemId} was not found.`},404);
  }

  const proposedRaw = body?.proposed || body?.candidate?.proposed || {};
  const proposed = requestType === "cancel"
    ? {status:"cancelled"}
    : normalizeProposed(proposedRaw, existing);

  if (proposed.error) return bad(requestId, proposed.error);

  const clientId = positive(body?.clientId ?? proposed.clientId ?? existing?.client_id);
  if (!clientId) return bad(requestId, "A client is required.");
  const title = clean(body?.title || proposed.title || existing?.title || "Schedule change");
  const reason = nullable(body?.reason ?? body?.candidate?.reason);
  const sourceReference = nullable(body?.sourceReference ?? proposed.sourceReference ?? existing?.source_reference);
  const requestedBy = clean(body?.requestedBy || "Andy") || "Andy";

  const result = await db.prepare(`
    INSERT INTO schedule_change_requests (
      client_id, request_type, target_item_id, title, proposed_json,
      reason, source_reference, status, requested_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    clientId,
    requestType,
    targetItemId,
    title,
    JSON.stringify(proposed),
    reason,
    sourceReference,
    requestedBy
  ).run();

  return jsonResponse({
    ok:true,
    requestId,
    action:SCHEDULE_OPERATIONS_ACTION,
    operation:"create_candidate",
    scheduleOperationsVersion:SCHEDULE_OPERATIONS_VERSION,
    changeRequestId:Number(result?.meta?.last_row_id || result?.meta?.lastRowId || 0) || null,
    status:"pending",
    writesPerformed:1
  },201);
}

async function approveCandidate(body, db, requestId) {
  const changeRequestId = positive(body?.changeRequestId ?? body?.id);
  if (!changeRequestId) return bad(requestId, "changeRequestId must be a positive integer.");

  const request = rowsOf(await db.prepare("SELECT * FROM schedule_change_requests WHERE id=? LIMIT 1").bind(changeRequestId).all())[0];
  if (!request) return jsonResponse({ok:false,requestId,action:SCHEDULE_OPERATIONS_ACTION,scheduleOperationsVersion:SCHEDULE_OPERATIONS_VERSION,error:`Schedule change ${changeRequestId} was not found.`},404);
  if (clean(request.status).toLowerCase() !== "pending" && clean(request.status).toLowerCase() !== "held") {
    return jsonResponse({ok:false,requestId,action:SCHEDULE_OPERATIONS_ACTION,scheduleOperationsVersion:SCHEDULE_OPERATIONS_VERSION,error:`Schedule change ${changeRequestId} is already ${request.status}.`},409);
  }

  const requestType = clean(request.request_type).toLowerCase();
  const proposed = parseJson(request.proposed_json, {});
  const reviewedBy = clean(body?.reviewedBy || "Andy") || "Andy";
  let itemId = positive(request.target_item_id);
  let versionNumber = 1;

  if (requestType === "add") {
    const normalized = normalizeProposed(proposed, null);
    if (normalized.error) return bad(requestId, normalized.error);
    const sourceKey = clean(normalized.sourceKey) || `manual:${Number(request.client_id)}:${changeRequestId}`;
    const insert = await db.prepare(`
      INSERT INTO schedule_items (
        client_id, source_key, item_type, title, market, channel,
        start_date, end_date, start_time, status, source_reference,
        notes, metadata_json, version_number, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      Number(request.client_id), sourceKey, normalized.itemType, normalized.title,
      normalized.market, normalized.channel, normalized.startDate, normalized.endDate,
      normalized.startTime, normalized.status, normalized.sourceReference,
      normalized.notes, JSON.stringify(normalized.metadata || {}), reviewedBy
    ).run();
    itemId = Number(insert?.meta?.last_row_id || insert?.meta?.lastRowId || 0) || null;
    versionNumber = 1;
  } else {
    const existing = rowsOf(await db.prepare("SELECT * FROM schedule_items WHERE id=? AND archived_at IS NULL LIMIT 1").bind(itemId).all())[0];
    if (!existing) return jsonResponse({ok:false,requestId,action:SCHEDULE_OPERATIONS_ACTION,scheduleOperationsVersion:SCHEDULE_OPERATIONS_VERSION,error:`Target schedule item ${itemId} was not found.`},404);

    const merged = requestType === "cancel"
      ? normalizeProposed({status:"cancelled"}, existing)
      : normalizeProposed(proposed, existing);
    if (merged.error) return bad(requestId, merged.error);

    versionNumber = Number(existing.version_number || 1) + 1;
    await db.prepare(`
      UPDATE schedule_items
      SET item_type=?, title=?, market=?, channel=?, start_date=?, end_date=?,
          start_time=?, status=?, source_reference=?, notes=?, metadata_json=?,
          version_number=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND archived_at IS NULL
    `).bind(
      merged.itemType, merged.title, merged.market, merged.channel,
      merged.startDate, merged.endDate, merged.startTime, merged.status,
      merged.sourceReference, merged.notes, JSON.stringify(merged.metadata || {}),
      versionNumber, itemId
    ).run();
  }

  const saved = rowsOf(await db.prepare("SELECT * FROM schedule_items WHERE id=? LIMIT 1").bind(itemId).all())[0];
  if (!saved) return jsonResponse({ok:false,requestId,action:SCHEDULE_OPERATIONS_ACTION,scheduleOperationsVersion:SCHEDULE_OPERATIONS_VERSION,error:"Approved schedule item could not be read back."},500);

  await db.prepare(`
    INSERT INTO schedule_item_history (
      schedule_item_id, change_request_id, version_number, snapshot_json,
      change_type, changed_by, changed_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    itemId,
    changeRequestId,
    versionNumber,
    JSON.stringify(snapshot(saved)),
    requestType,
    reviewedBy
  ).run();

  await db.prepare(`
    UPDATE schedule_change_requests
    SET status='approved', reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(reviewedBy, changeRequestId).run();

  const response = await listSchedule(db, requestId);
  const payload = await response.json();
  return jsonResponse({...payload,operation:"approve_candidate",approvedChangeRequestId:changeRequestId,approvedScheduleItemId:itemId,writesPerformed:3});
}

async function dispositionCandidate(body, db, requestId, disposition) {
  const changeRequestId = positive(body?.changeRequestId ?? body?.id);
  if (!changeRequestId) return bad(requestId, "changeRequestId must be a positive integer.");
  const reviewedBy = clean(body?.reviewedBy || "Andy") || "Andy";
  const result = await db.prepare(`
    UPDATE schedule_change_requests
    SET status=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND status IN ('pending','held')
  `).bind(disposition, reviewedBy, changeRequestId).run();
  const changes = Number(result?.meta?.changes || 0);
  if (!changes) return jsonResponse({ok:false,requestId,action:SCHEDULE_OPERATIONS_ACTION,scheduleOperationsVersion:SCHEDULE_OPERATIONS_VERSION,error:`Schedule change ${changeRequestId} was not available for review.`},409);
  return jsonResponse({ok:true,requestId,action:SCHEDULE_OPERATIONS_ACTION,operation:`${disposition}_candidate`,scheduleOperationsVersion:SCHEDULE_OPERATIONS_VERSION,changeRequestId,status:disposition,writesPerformed:1});
}

function normalizeProposed(raw, existing) {
  const base = existing ? {
    clientId:positive(existing.client_id),
    sourceKey:text(existing.source_key),
    itemType:clean(existing.item_type).toLowerCase(),
    title:text(existing.title),
    market:nullable(existing.market),
    channel:nullable(existing.channel),
    startDate:text(existing.start_date),
    endDate:text(existing.end_date),
    startTime:nullable(existing.start_time),
    status:clean(existing.status).toLowerCase(),
    sourceReference:nullable(existing.source_reference),
    notes:nullable(existing.notes),
    metadata:parseJson(existing.metadata_json,{})
  } : {};

  const merged = {
    ...base,
    clientId:positive(raw?.clientId) || base.clientId || null,
    sourceKey:raw?.sourceKey !== undefined ? clean(raw.sourceKey) : base.sourceKey,
    itemType:clean(raw?.itemType || base.itemType || "campaign").toLowerCase(),
    title:clean(raw?.title || base.title),
    market:raw?.market !== undefined ? nullable(raw.market) : base.market,
    channel:raw?.channel !== undefined ? nullable(raw.channel) : base.channel,
    startDate:dateOnly(raw?.startDate || base.startDate),
    endDate:dateOnly(raw?.endDate || raw?.startDate || base.endDate || base.startDate),
    startTime:raw?.startTime !== undefined ? normalizeTime(raw.startTime) : base.startTime,
    status:clean(raw?.status || base.status || "planned").toLowerCase(),
    sourceReference:raw?.sourceReference !== undefined ? nullable(raw.sourceReference) : base.sourceReference,
    notes:raw?.notes !== undefined ? nullable(raw.notes) : base.notes,
    metadata:raw?.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? {...(base.metadata || {}), ...raw.metadata}
      : (base.metadata || {})
  };

  if (!ITEM_TYPES.has(merged.itemType)) return {error:"itemType is not supported."};
  if (!merged.title) return {error:"A schedule title is required."};
  if (!merged.startDate || !merged.endDate) return {error:"Valid start and end dates are required."};
  if (merged.endDate < merged.startDate) return {error:"The end date cannot be earlier than the start date."};
  if (!STATUSES.has(merged.status)) return {error:"The schedule status is not supported."};
  return merged;
}

function normalizeItemRow(row) {
  return {
    id:Number(row.id),
    clientId:positive(row.client_id),
    clientCode:text(row.client_code),
    clientName:text(row.client_name),
    sourceKey:text(row.source_key),
    itemType:text(row.item_type),
    title:text(row.title),
    market:nullable(row.market),
    channel:nullable(row.channel),
    startDate:text(row.start_date),
    endDate:text(row.end_date),
    startTime:nullable(row.start_time),
    status:text(row.status),
    sourceReference:nullable(row.source_reference),
    notes:nullable(row.notes),
    metadata:parseJson(row.metadata_json,{}),
    versionNumber:Number(row.version_number || 1),
    createdBy:text(row.created_by),
    createdAt:text(row.created_at),
    updatedAt:text(row.updated_at)
  };
}

function normalizeChangeRow(row) {
  return {
    id:Number(row.id),
    clientId:positive(row.client_id),
    clientCode:text(row.client_code),
    clientName:text(row.client_name),
    requestType:text(row.request_type),
    targetItemId:positive(row.target_item_id),
    targetTitle:nullable(row.target_title),
    title:text(row.title),
    proposed:parseJson(row.proposed_json,{}),
    reason:nullable(row.reason),
    sourceReference:nullable(row.source_reference),
    status:text(row.status),
    requestedBy:text(row.requested_by),
    reviewedBy:nullable(row.reviewed_by),
    reviewedAt:nullable(row.reviewed_at),
    createdAt:text(row.created_at),
    updatedAt:text(row.updated_at)
  };
}

function deriveEvents(items) {
  const out = [];
  for (const item of items) {
    if (["cancelled","canceled"].includes(clean(item.status).toLowerCase())) continue;

    if (item.itemType === "gun_show") {
      const meta = item.metadata || {};
      const flightStart = addDate(item.startDate, Number(meta.flightStartOffsetDays ?? -3));
      const flightEnd = item.startDate;
      const warningDays = Number(meta.trafficWarningDaysBeforeFlightStart || 7);
      const stationDeadlineDays = Number(meta.stationDeadlineDaysBeforeFlightStart || 2);
      const station = clean(meta.station);
      out.push(event(item,"gun_show",item.startDate,item.endDate,item.title,{venue:meta.venue,participationStatus:meta.participationStatus}));
      if (flightStart && station) {
        out.push(event(item,"radio_flight",flightStart,flightEnd,`${station} Radio Flight · Wed–Sat`,{station}));
        out.push(event(item,"traffic_due",addDate(flightStart,-warningDays),addDate(flightStart,-warningDays),`TRAFFIC DUE · ${station} · ${item.market || ""}`,{station,warningDays}));
        out.push({...event(item,"station_deadline",addDate(flightStart,-stationDeadlineDays),addDate(flightStart,-stationDeadlineDays),`EMAIL STEPHANIE — FINAL STATION TRAFFIC · ${station} · ${item.market || ""}`,{station}),startTime:clean(meta.stationDeadlineTime || "10:00")});
      }
      const sequence = Array.isArray(meta.socialSequence) ? meta.socialSequence : [];
      const channels = Array.isArray(meta.socialChannels) ? meta.socialChannels : ["Facebook","Google Business Profile","Instagram"];
      sequence.forEach((post,index) => {
        const date = addDate(item.startDate, Number(post?.offset || 0));
        if (!date) return;
        out.push(event(item,"social_post",date,date,`${clean(post?.title || `SOCIAL #${index+1}`)} · ${item.market || ""}`,{
          theme:nullable(post?.theme),
          channels,
          sequenceIndex:index+1,
          parentType:"gun_show"
        }));
      });
      continue;
    }

    if (item.itemType === "promotion") {
      const meta = item.metadata || {};
      out.push(event(item,"promotion",item.startDate,item.endDate,item.title,{offer:meta.offer,embargoUntil:meta.embargoUntil}));
      out.push(event(item,"takedown_due",item.endDate,item.endDate,`TAKEDOWN DUE — ${item.title}`,{parentType:"promotion"}));
      const channels = Array.isArray(meta.channels) ? meta.channels : [];
      (Array.isArray(meta.schedule) ? meta.schedule : []).forEach((post,index) => {
        const date = dateOnly(post?.date);
        if (!date) return;
        out.push(event(item,"social_post",date,date,clean(post?.title || `SOCIAL POST — ${item.title}`),{
          theme:nullable(post?.theme),
          channels,
          sequenceIndex:index+1,
          parentType:"promotion"
        }));
      });
      continue;
    }

    out.push(event(item,item.itemType,item.startDate,item.endDate,item.title,{
      channel:item.channel,
      notes:item.notes
    }));
  }
  return out.sort((a,b) => String(a.startDate).localeCompare(String(b.startDate)) || String(a.title).localeCompare(String(b.title)));
}

function event(item, kind, startDate, endDate, title, metadata={}) {
  return {
    key:`${item.sourceKey}:${kind}:${startDate}:${title}`,
    scheduleItemId:item.id,
    sourceKey:item.sourceKey,
    clientId:item.clientId,
    clientCode:item.clientCode,
    clientName:item.clientName,
    kind,
    title,
    market:item.market,
    channel:item.channel,
    startDate,
    endDate:endDate || startDate,
    startTime:item.startTime,
    status:item.status,
    sourceReference:item.sourceReference,
    versionNumber:item.versionNumber,
    metadata
  };
}

function snapshot(row) {
  return {
    sourceKey:text(row.source_key),
    itemType:text(row.item_type),
    title:text(row.title),
    market:nullable(row.market),
    channel:nullable(row.channel),
    startDate:text(row.start_date),
    endDate:text(row.end_date),
    startTime:nullable(row.start_time),
    status:text(row.status),
    sourceReference:nullable(row.source_reference),
    notes:nullable(row.notes),
    metadata:parseJson(row.metadata_json,{})
  };
}

function addDate(value, days) {
  const d = parseDate(value);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0,10);
}

function parseDate(value) {
  const v = dateOnly(value);
  if (!v) return null;
  const [y,m,d] = v.split("-").map(Number);
  return new Date(Date.UTC(y,m-1,d,12));
}

function dateOnly(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),12));
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2])-1 || d.getUTCDate() !== Number(m[3])) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function normalizeTime(value) {
  if (value === null || value === undefined || value === "") return null;
  const m = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59 ? `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}` : null;
}

function parseJson(value, fallback) {
  try { return JSON.parse(String(value || "")); } catch { return fallback; }
}
function clean(value) { return String(value ?? "").trim(); }
function text(value) { return value == null ? "" : String(value); }
function nullable(value) { const v = clean(value); return v ? v : null; }
function positive(value) { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; }
function bad(requestId, error) {
  return jsonResponse({ok:false,requestId,action:SCHEDULE_OPERATIONS_ACTION,scheduleOperationsVersion:SCHEDULE_OPERATIONS_VERSION,error},400);
}
