/* =========================================================
   Global Concepts Media Operating System
   File: routes/mediaPlacementDisposition.js
   Version: 1.0.0
   Status: Production Candidate
   Sprint: Media Rotation End-of-Run Decision
   Purpose: Preserve an explicit operator decision that a live placement will
            run through its scheduled end date and then retire without a
            replacement creative being required.

   Production rules:
   - The existing media_records row remains authoritative.
   - The current placement status and scheduled dates are not changed.
   - The decision is stored in notes and appended to permanent decision history.
   - The action clears only obsolete Media attention flags; it does not send,
     traffic, confirm, create, replace, or retire anything early.
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
  "Disposition End Date:",
  "Disposition Reason:",
  "Disposition Recorded By:",
  "Disposition Recorded At:"
]);

export async function handleMediaPlacementDisposition(operation, body, env, requestId) {
  if (operation !== "set_placement_disposition") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      error: `Unsupported Media placement disposition operation: ${operation}`
    }, 400);
  }

  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      error: "The D1 binding is unavailable."
    }, 503);
  }

  const mediaRecordId = normalizePositiveInteger(body?.mediaRecordId ?? body?.recordId ?? body?.id);
  const requestedDisposition = clean(body?.disposition || "retire_at_end_no_replacement").toLowerCase();
  const author = clean(body?.author) || "Andy";
  const reason = clean(body?.reason) || "Other approved creative remains in rotation; no replacement is required.";

  if (!mediaRecordId) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      error: "mediaRecordId must be a positive integer."
    }, 400);
  }

  if (requestedDisposition !== "retire_at_end_no_replacement") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      error: "The supported placement disposition is retire_at_end_no_replacement."
    }, 400);
  }

  try {
    const result = await db.prepare(`
      SELECT id, status, end_date, notes
      FROM media_records
      WHERE id = ?
      LIMIT 1
    `).bind(mediaRecordId).all();

    const record = rowsOf(result)[0];
    if (!record) {
      return jsonResponse({
        ok: false,
        requestId,
        action: ACTIONS.GET_MEDIA_OPERATIONS,
        version: VERSION,
        error: `Media record ${mediaRecordId} was not found.`
      }, 404);
    }

    const endDate = normalizeDateOnly(record.end_date);
    if (!endDate) {
      return jsonResponse({
        ok: false,
        requestId,
        action: ACTIONS.GET_MEDIA_OPERATIONS,
        version: VERSION,
        error: "A scheduled end date is required before a placement can be set to retire at end."
      }, 400);
    }

    const existing = parseDisposition(record.notes);
    if (
      existing.disposition === "retire_at_end" &&
      existing.replacementRequired === "no" &&
      existing.endDate === endDate
    ) {
      return jsonResponse({
        ok: true,
        requestId,
        action: ACTIONS.GET_MEDIA_OPERATIONS,
        version: VERSION,
        operation,
        mediaRecordId,
        alreadySaved: true,
        disposition: existing
      });
    }

    const recordedAt = new Date().toISOString();
    const preservedLines = String(record.notes || "")
      .split(/\r?\n/)
      .filter(line => !MANAGED_PREFIXES.some(prefix => line.toLowerCase().startsWith(prefix.toLowerCase())))
      .filter(Boolean);

    const managedLines = [
      "Placement Disposition: retire_at_end",
      "Replacement Required: no",
      `Disposition End Date: ${endDate}`,
      `Disposition Reason: ${reason}`,
      `Disposition Recorded By: ${author}`,
      `Disposition Recorded At: ${recordedAt}`,
      `Placement Decision History | ${recordedAt} | ${author} | Run through scheduled end date ${endDate}, then retire. No replacement creative required. ${reason}`
    ];

    const notes = [...preservedLines, ...managedLines].join("\n");

    await db.prepare(`
      UPDATE media_records
      SET notes = ?,
          attention_status = 'clear',
          attention_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(notes, mediaRecordId).run();

    return jsonResponse({
      ok: true,
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      operation,
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
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.GET_MEDIA_OPERATIONS,
      stage: "media_placement_disposition",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      error: "The Media placement disposition could not be saved.",
      details: safeErrorMessage(error)
    }, 500);
  }
}

function parseDisposition(notes) {
  const text = String(notes || "");
  return {
    disposition: noteValue(text, "Placement Disposition:"),
    replacementRequired: noteValue(text, "Replacement Required:"),
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

function normalizePositiveInteger(value) {
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
