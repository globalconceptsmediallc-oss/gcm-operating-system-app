/* =========================================================
   Global Concepts Media Operating System
   File: routes/mediaPlacementDisposition.js
   Version: 1.1.0
   Status: Production Candidate
   Source: routes/mediaPlacementDisposition.js 1.0.0
   Sprint: Media Replacement-in-Progress Linkage
   Purpose: Preserve explicit operator decisions for live placements that will
            either retire at end without replacement or remain live while a
            specific replacement Creative is developed.

   Production rules:
   - The existing media_records row remains authoritative for the live placement.
   - Current placement status and scheduled dates are never changed here.
   - Replacement-in-progress requires a real media_creatives row for the same client.
   - The placement decision is stored in notes and appended to permanent history.
   - A replacement link is also appended to the Creative history for traceability.
   - The action clears only obsolete Media attention flags; it does not send,
     traffic, confirm, replace, retire, or advance a Creative.
   ========================================================= */

import { VERSION, ACTIONS } from "../shared/config.js";
import { safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase, rowsOf } from "../shared/database.js";

export const MEDIA_PLACEMENT_DISPOSITION_OPERATIONS = Object.freeze([
  "set_placement_disposition"
]);

const MANAGED_PREFIXES = Object.freeze([
  "Placement Disposition:",
  "Replacement Required:",
  "Replacement Creative ID:",
  "Replacement Creative Name:",
  "Disposition End Date:",
  "Disposition Reason:",
  "Disposition Recorded By:",
  "Disposition Recorded At:"
]);

export async function handleMediaPlacementDisposition(operation, body, env, requestId) {
  if (operation !== "set_placement_disposition") {
    return reply({
      ok: false,
      error: `Unsupported Media placement disposition operation: ${operation}`
    }, 400);
  }

  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") {
    return reply({ ok: false, error: "The D1 binding is unavailable." }, 503);
  }

  const mediaRecordId = positiveInteger(body?.mediaRecordId ?? body?.recordId ?? body?.id);
  const requestedDisposition = clean(body?.disposition || "retire_at_end_no_replacement").toLowerCase();
  const author = clean(body?.author) || "Andy";

  if (!mediaRecordId) {
    return reply({ ok: false, error: "mediaRecordId must be a positive integer." }, 400);
  }

  if (!["retire_at_end_no_replacement", "replacement_in_progress"].includes(requestedDisposition)) {
    return reply({
      ok: false,
      error: "Supported placement dispositions are retire_at_end_no_replacement and replacement_in_progress."
    }, 400);
  }

  try {
    const recordResult = await db.prepare(`
      SELECT id, client_id, campaign_name, creative_name, market, outlet_name,
             status, end_date, notes
      FROM media_records
      WHERE id = ?
      LIMIT 1
    `).bind(mediaRecordId).all();

    const record = rowsOf(recordResult)[0];
    if (!record) {
      return reply({ ok: false, error: `Media record ${mediaRecordId} was not found.` }, 404);
    }

    const endDate = normalizeDateOnly(record.end_date);
    if (!endDate) {
      return reply({
        ok: false,
        error: "A scheduled end date is required before a placement disposition can be saved."
      }, 400);
    }

    if (requestedDisposition === "retire_at_end_no_replacement") {
      return saveRetireAtEnd({ db, record, mediaRecordId, endDate, author, body });
    }

    return saveReplacementInProgress({ db, record, mediaRecordId, endDate, author, body });
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.GET_MEDIA_OPERATIONS,
      stage: "media_placement_disposition",
      error
    });

    return reply({
      ok: false,
      error: "The Media placement disposition could not be saved.",
      details: safeErrorMessage(error)
    }, 500);
  }

  function reply(payload, status = 200) {
    return jsonResponse({
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      operation,
      ...payload
    }, status);
  }
}

async function saveRetireAtEnd({ db, record, mediaRecordId, endDate, author, body }) {
  const reason = clean(body?.reason) || "Other approved creative remains in rotation; no replacement is required.";
  const existing = parseDisposition(record.notes);

  if (
    existing.disposition === "retire_at_end" &&
    existing.replacementRequired === "no" &&
    existing.endDate === endDate
  ) {
    return response({
      ok: true,
      mediaRecordId,
      alreadySaved: true,
      disposition: existing
    });
  }

  const recordedAt = new Date().toISOString();
  const managedLines = [
    "Placement Disposition: retire_at_end",
    "Replacement Required: no",
    `Disposition End Date: ${endDate}`,
    `Disposition Reason: ${reason}`,
    `Disposition Recorded By: ${author}`,
    `Disposition Recorded At: ${recordedAt}`,
    `Placement Decision History | ${recordedAt} | ${author} | Run through scheduled end date ${endDate}, then retire. No replacement creative required. ${reason}`
  ];

  await updateRecordNotes(db, record, mediaRecordId, managedLines);

  return response({
    ok: true,
    mediaRecordId,
    disposition: {
      disposition: "retire_at_end",
      replacementRequired: "no",
      endDate,
      reason,
      recordedBy: author,
      recordedAt
    }
  });
}

async function saveReplacementInProgress({ db, record, mediaRecordId, endDate, author, body }) {
  const creativeId = positiveInteger(body?.creativeId ?? body?.replacementCreativeId);
  if (!creativeId) {
    return response({
      ok: false,
      error: "creativeId is required for replacement_in_progress."
    }, 400);
  }

  const creativeResult = await db.prepare(`
    SELECT id, client_id, creative_name, current_stage, status
    FROM media_creatives
    WHERE id = ?
    LIMIT 1
  `).bind(creativeId).all();
  const creative = rowsOf(creativeResult)[0];

  if (!creative) {
    return response({ ok: false, error: `Creative ${creativeId} was not found.` }, 404);
  }
  if (Number(creative.client_id) !== Number(record.client_id)) {
    return response({
      ok: false,
      error: `Creative ${creativeId} does not belong to the same client as Media record ${mediaRecordId}.`
    }, 409);
  }

  const creativeName = clean(creative.creative_name) || `Creative #${creativeId}`;
  const reason = clean(body?.reason) || `Replacement Creative #${creativeId} — ${creativeName} is in production.`;
  const existing = parseDisposition(record.notes);

  if (
    existing.disposition === "replacement_in_progress" &&
    existing.replacementRequired === "yes" &&
    Number(existing.replacementCreativeId) === creativeId
  ) {
    return response({
      ok: true,
      mediaRecordId,
      alreadySaved: true,
      disposition: existing
    });
  }

  const recordedAt = new Date().toISOString();
  const placementLabel = clean(record.campaign_name || record.creative_name) || `Media record #${mediaRecordId}`;
  const locationLabel = [clean(record.market), clean(record.outlet_name)].filter(Boolean).join(" / ");
  const managedLines = [
    "Placement Disposition: replacement_in_progress",
    "Replacement Required: yes",
    `Replacement Creative ID: ${creativeId}`,
    `Replacement Creative Name: ${creativeName}`,
    `Disposition End Date: ${endDate}`,
    `Disposition Reason: ${reason}`,
    `Disposition Recorded By: ${author}`,
    `Disposition Recorded At: ${recordedAt}`,
    `Placement Decision History | ${recordedAt} | ${author} | Replacement Creative #${creativeId} — ${creativeName} linked to ${placementLabel}${locationLabel ? ` · ${locationLabel}` : ""}. Current placement remains live while replacement work is in progress.`
  ];

  await updateRecordNotes(db, record, mediaRecordId, managedLines);

  await db.prepare(`
    INSERT INTO media_creative_history(
      creative_id, entry_type, stage, author, content, created_at
    ) VALUES(?, 'placement_link', ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    creativeId,
    clean(creative.current_stage),
    author,
    `Linked as the replacement Creative for Media record #${mediaRecordId} — ${placementLabel}${locationLabel ? ` · ${locationLabel}` : ""}. The existing placement remains live while this Creative is developed.`
  ).run();

  return response({
    ok: true,
    mediaRecordId,
    disposition: {
      disposition: "replacement_in_progress",
      replacementRequired: "yes",
      replacementCreativeId: creativeId,
      replacementCreativeName: creativeName,
      endDate,
      reason,
      recordedBy: author,
      recordedAt
    }
  });
}

async function updateRecordNotes(db, record, mediaRecordId, managedLines) {
  const preservedLines = String(record.notes || "")
    .split(/\r?\n/)
    .filter(line => !MANAGED_PREFIXES.some(prefix => line.toLowerCase().startsWith(prefix.toLowerCase())))
    .filter(Boolean);

  const notes = [...preservedLines, ...managedLines].join("\n");

  await db.prepare(`
    UPDATE media_records
    SET notes = ?,
        attention_status = 'clear',
        attention_reason = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(notes, mediaRecordId).run();
}

function parseDisposition(notes) {
  const text = String(notes || "");
  return {
    disposition: noteValue(text, "Placement Disposition:"),
    replacementRequired: noteValue(text, "Replacement Required:"),
    replacementCreativeId: noteValue(text, "Replacement Creative ID:"),
    replacementCreativeName: noteValue(text, "Replacement Creative Name:"),
    endDate: noteValue(text, "Disposition End Date:"),
    reason: noteValue(text, "Disposition Reason:"),
    recordedBy: noteValue(text, "Disposition Recorded By:"),
    recordedAt: noteValue(text, "Disposition Recorded At:")
  };
}

function noteValue(notes, label) {
  const line = String(notes || "")
    .split(/\r?\n/)
    .find(item => item.toLowerCase().startsWith(label.toLowerCase()));
  return line ? line.slice(label.length).trim() : "";
}

function positiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeDateOnly(value) {
  const match = String(value || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function clean(value) {
  return String(value ?? "").trim();
}

function response(payload, status = 200) {
  return jsonResponse({
    action: ACTIONS.GET_MEDIA_OPERATIONS,
    version: VERSION,
    operation: "set_placement_disposition",
    ...payload
  }, status);
}
