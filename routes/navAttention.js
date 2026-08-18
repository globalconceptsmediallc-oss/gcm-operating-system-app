/* =========================================================
   Global Concepts Media Operating System
   File: routes/navAttention.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Source: GCM OS Sidebar Attention Indicator Requirement — 2026-08-18
   Sprint: Shared Navigation — Durable Deadline Urgency
   Purpose:
   Read durable D1 scheduling / deadline state and return one authoritative
   urgency summary for each operational navigation section.

   Change notes — v1.0.0:
   - Adds read-only get-nav-attention contract for the shared shell.
   - Uses the nearest unresolved durable deadline for each supported section.
   - Applies the locked color contract:
       red    = overdue or due in 0–2 days
       yellow = due in 3–6 days
       green  = due in 7+ days
       neutral = no durable dated obligation is currently provable
   - Uses schema inspection so missing / not-yet-migrated Calendar, Prospect,
     Proof, or Work due-date columns remain neutral instead of inventing state.
   - Mirrors existing Media traffic deadline logic from Media Operations.
   - Performs no D1 writes and does not create operational records.
   ========================================================= */

import { getDatabase, rowsOf } from "../shared/database.js";
import { jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";

export const NAV_ATTENTION_VERSION = "1.0.0";
export const NAV_ATTENTION_ACTION = "get-nav-attention";

const BUSINESS_TIME_ZONE = "America/New_York";
const CLOSED_STATUSES = new Set([
  "complete",
  "completed",
  "closed",
  "resolved",
  "cancelled",
  "canceled",
  "archived",
  "ignored",
  "no_action",
  "published",
  "expired",
  "deleted",
  "inactive"
]);

const SECTION_DEFINITIONS = Object.freeze({
  work: [
    source("work_items", ["due_at", "due_date", "deadline", "scheduled_for", "review_due_at"], ["title", "description"]),
    source("investigations", ["due_at", "due_date", "deadline", "review_due_at"], ["title", "description"]),
    source("operating_sessions", ["due_at", "due_date", "scheduled_for", "scheduled_at"], ["title", "issue_summary"])
  ],
  prospects: [
    source("prospects", ["next_follow_up_at", "follow_up_at", "follow_up_date", "next_action_date", "next_contact_at", "due_at"], ["name", "business_name", "title"]),
    source("prospect_records", ["next_follow_up_at", "follow_up_at", "follow_up_date", "next_action_date", "next_contact_at", "due_at"], ["name", "business_name", "title"])
  ],
  calendar: [
    source("calendar_appointments", ["scheduled_at", "appointment_at", "starts_at", "start_at", "date", "appointment_date"], ["title", "summary", "name"]),
    source("calendar_reminders", ["due_at", "remind_at", "scheduled_for", "scheduled_at", "date", "reminder_date"], ["title", "summary", "name"]),
    source("calendar_events", ["scheduled_at", "starts_at", "start_at", "date", "event_date"], ["title", "summary", "name"])
  ],
  proof: [
    source("client_reports", ["due_at", "due_date", "scheduled_for", "report_date", "next_report_date"], ["title", "subject", "report_type"]),
    source("proof_reports", ["due_at", "due_date", "scheduled_for", "report_date", "next_report_date"], ["title", "subject", "report_type"]),
    source("reporting_tasks", ["due_at", "due_date", "scheduled_for", "report_date"], ["title", "subject", "report_type"])
  ],
  clients: [
    source("alerts", ["due_at", "due_date", "deadline", "review_due_at"], ["title", "description"])
  ]
});

function source(table, dateCandidates, labelCandidates) {
  return Object.freeze({ table, dateCandidates, labelCandidates });
}

export async function handleNavAttention(body, env, requestId) {
  const startedAt = Date.now();
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: NAV_ATTENTION_ACTION,
      navAttentionVersion: NAV_ATTENTION_VERSION,
      error: "The production D1 database binding is unavailable."
    }, 503);
  }

  try {
    const today = businessDateOnly(new Date());
    const schema = await loadSchema(db);

    const [work, prospects, calendar, proof, clients, media] = await Promise.all([
      summarizeGenericSection(db, schema, "work", SECTION_DEFINITIONS.work, today),
      summarizeGenericSection(db, schema, "prospects", SECTION_DEFINITIONS.prospects, today),
      summarizeGenericSection(db, schema, "calendar", SECTION_DEFINITIONS.calendar, today),
      summarizeGenericSection(db, schema, "proof", SECTION_DEFINITIONS.proof, today),
      summarizeGenericSection(db, schema, "clients", SECTION_DEFINITIONS.clients, today),
      summarizeMediaSection(db, schema, today)
    ]);

    return jsonResponse({
      ok: true,
      requestId,
      action: NAV_ATTENTION_ACTION,
      navAttentionVersion: NAV_ATTENTION_VERSION,
      generatedAt: new Date().toISOString(),
      businessDate: today,
      businessTimeZone: BUSINESS_TIME_ZONE,
      colorContract: {
        red: "overdue or due in 0–2 days",
        yellow: "due in 3–6 days",
        green: "due in 7+ days",
        neutral: "no durable dated obligation is currently provable"
      },
      sections: { clients, work, media, prospects, calendar, proof },
      writesPerformed: 0,
      executionTimeMs: Date.now() - startedAt
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: NAV_ATTENTION_ACTION,
      stage: "nav_attention_read",
      error
    });
    return jsonResponse({
      ok: false,
      requestId,
      action: NAV_ATTENTION_ACTION,
      navAttentionVersion: NAV_ATTENTION_VERSION,
      error: safeErrorMessage(error),
      executionTimeMs: Date.now() - startedAt
    }, 500);
  }
}

async function loadSchema(db) {
  const tablesResult = await db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
  `).all();

  const tableNames = rowsOf(tablesResult)
    .map(row => String(row.name || "").trim())
    .filter(Boolean);

  const schema = new Map();
  await Promise.all(tableNames.map(async table => {
    if (!safeIdentifier(table)) return;
    const result = await db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all();
    schema.set(table, new Set(rowsOf(result).map(row => String(row.name || "").trim()).filter(Boolean)));
  }));
  return schema;
}

async function summarizeGenericSection(db, schema, key, definitions, today) {
  const candidates = [];
  const supportedSources = [];
  let undatedOpenCount = 0;

  for (const definition of definitions) {
    const columns = schema.get(definition.table);
    if (!columns) continue;

    const dateColumn = firstExistingColumn(columns, definition.dateCandidates);
    const statusColumn = columns.has("status") ? "status" : null;
    const labelColumn = firstExistingColumn(columns, definition.labelCandidates);
    const idColumn = columns.has("id") ? "id" : null;

    supportedSources.push({
      table: definition.table,
      dateColumn,
      statusColumn
    });

    if (!dateColumn) {
      if (statusColumn) {
        undatedOpenCount += await countOpenRows(db, definition.table, statusColumn);
      }
      continue;
    }

    const selectParts = [
      idColumn ? `${quoteIdentifier(idColumn)} AS record_id` : "NULL AS record_id",
      `${quoteIdentifier(dateColumn)} AS due_value`,
      statusColumn ? `${quoteIdentifier(statusColumn)} AS status_value` : "NULL AS status_value",
      labelColumn ? `${quoteIdentifier(labelColumn)} AS label_value` : "NULL AS label_value"
    ];

    const result = await db.prepare(`
      SELECT ${selectParts.join(", ")}
      FROM ${quoteIdentifier(definition.table)}
      WHERE ${quoteIdentifier(dateColumn)} IS NOT NULL
        AND TRIM(CAST(${quoteIdentifier(dateColumn)} AS TEXT)) <> ''
    `).all();

    for (const row of rowsOf(result)) {
      if (isClosedStatus(row.status_value)) continue;
      const dueDate = dateOnlyFromValue(row.due_value);
      if (!dueDate) continue;
      candidates.push({
        dueDate,
        daysUntil: daysBetween(today, dueDate),
        source: `${definition.table}.${dateColumn}`,
        recordId: positiveInteger(row.record_id),
        label: cleanText(row.label_value)
      });
    }
  }

  return buildSectionSummary(key, candidates, supportedSources, undatedOpenCount);
}

async function countOpenRows(db, table, statusColumn) {
  const result = await db.prepare(`
    SELECT ${quoteIdentifier(statusColumn)} AS status_value
    FROM ${quoteIdentifier(table)}
  `).all();
  return rowsOf(result).filter(row => !isClosedStatus(row.status_value)).length;
}

async function summarizeMediaSection(db, schema, today) {
  const columns = schema.get("media_records");
  if (!columns) {
    return buildSectionSummary("media", [], [], 0);
  }

  const required = ["status", "start_date", "end_date"];
  if (!required.every(column => columns.has(column))) {
    return buildSectionSummary("media", [], [{ table: "media_records", dateColumn: null, statusColumn: columns.has("status") ? "status" : null }], 0);
  }

  const optional = name => columns.has(name) ? quoteIdentifier(name) : "NULL";
  const result = await db.prepare(`
    SELECT
      ${columns.has("id") ? quoteIdentifier("id") : "NULL"} AS record_id,
      ${optional("campaign_name")} AS label_value,
      ${quoteIdentifier("status")} AS status_value,
      ${quoteIdentifier("start_date")} AS start_date,
      ${quoteIdentifier("end_date")} AS end_date,
      ${optional("traffic_status")} AS traffic_status,
      ${optional("confirmation_status")} AS confirmation_status,
      ${optional("attention_status")} AS attention_status
    FROM ${quoteIdentifier("media_records")}
  `).all();

  const candidates = [];
  let undatedOpenCount = 0;

  for (const row of rowsOf(result)) {
    const status = normalizeStatus(row.status_value);
    if (!["active", "pending", "planned", "preparing", "ready_to_send"].includes(status)) continue;

    const fullyConfirmed =
      normalizeStatus(row.traffic_status) === "sent" &&
      normalizeStatus(row.confirmation_status) === "confirmed" &&
      normalizeStatus(row.attention_status) !== "attention";
    if (fullyConfirmed) continue;

    const anchor = status === "active"
      ? dateOnlyFromValue(row.end_date)
      : dateOnlyFromValue(row.start_date);

    if (!anchor) {
      undatedOpenCount += 1;
      continue;
    }

    const dueDate = subtractWorkingDaysDateOnly(anchor, 3);
    candidates.push({
      dueDate,
      daysUntil: daysBetween(today, dueDate),
      source: status === "active" ? "media_records.end_date→3 business days" : "media_records.start_date→3 business days",
      recordId: positiveInteger(row.record_id),
      label: cleanText(row.label_value)
    });
  }

  return buildSectionSummary(
    "media",
    candidates,
    [{ table: "media_records", dateColumn: "start_date/end_date", statusColumn: "status" }],
    undatedOpenCount
  );
}

function buildSectionSummary(key, candidates, supportedSources, undatedOpenCount) {
  const sorted = [...candidates].sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    return String(a.dueDate).localeCompare(String(b.dueDate));
  });
  const nearest = sorted[0] || null;

  return {
    key,
    supported: supportedSources.length > 0,
    state: nearest ? urgencyState(nearest.daysUntil) : "neutral",
    nearestDueDate: nearest?.dueDate || null,
    daysUntil: nearest?.daysUntil ?? null,
    overdue: nearest ? nearest.daysUntil < 0 : false,
    recordId: nearest?.recordId || null,
    label: nearest?.label || null,
    source: nearest?.source || null,
    datedOpenCount: sorted.length,
    undatedOpenCount,
    supportedSources
  };
}

function urgencyState(daysUntil) {
  if (!Number.isFinite(daysUntil)) return "neutral";
  if (daysUntil <= 2) return "red";
  if (daysUntil <= 6) return "yellow";
  return "green";
}

function subtractWorkingDaysDateOnly(dateOnly, count) {
  const parts = parseDateOnly(dateOnly);
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  let remaining = count;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() - 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return formatUtcDateOnly(date);
}

function businessDateOnly(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateOnlyFromValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const direct = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (direct) {
    const candidate = `${direct[1]}-${direct[2]}-${direct[3]}`;
    return parseDateOnly(candidate) ? candidate : null;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return businessDateOnly(parsed);
}

function daysBetween(fromDateOnly, toDateOnly) {
  const from = parseDateOnly(fromDateOnly);
  const to = parseDateOnly(toDateOnly);
  if (!from || !to) return null;
  const fromMs = Date.UTC(from.year, from.month - 1, from.day);
  const toMs = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toMs - fromMs) / 86400000);
}

function parseDateOnly(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

function formatUtcDateOnly(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function firstExistingColumn(columns, candidates) {
  return candidates.find(column => columns.has(column)) || null;
}

function isClosedStatus(value) {
  const status = normalizeStatus(value);
  return status ? CLOSED_STATUSES.has(status) : false;
}

function normalizeStatus(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function safeIdentifier(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(value || ""));
}

function quoteIdentifier(value) {
  if (!safeIdentifier(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${String(value).replaceAll('"', '""')}"`;
}
