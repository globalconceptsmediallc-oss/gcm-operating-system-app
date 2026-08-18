/* =========================================================
   Global Concepts Media Operating System
   File: routes/calendarOperations.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Source: Calendar localStorage production state + D1 durability requirement
   Sprint: Calendar — Durable Appointment Records
   Purpose:
   Preserve Calendar appointments in D1 while the existing Calendar UI remains
   operational. D1 becomes the durable cross-page/cross-device source used by
   Mission Control and shared navigation urgency.

   Production rules:
   - calendar_appointments is the durable appointment source of truth.
   - Existing browser Calendar state is accepted only through sync_snapshot.
   - Snapshot sync preserves deleted appointments as historical deleted rows.
   - Client labels are resolved to client_id when an exact client name/code exists.
   - No Work Item, Investigation, Communication, or Proof record is manufactured.
   ========================================================= */

import { getDatabase, rowsOf } from "../shared/database.js";
import {
  jsonResponse,
  logWorkerError,
  safeErrorMessage
} from "../shared/http.js";

export const CALENDAR_OPERATIONS_ACTION = "calendar-operations";
export const CALENDAR_OPERATIONS_VERSION = "1.0.0";

const SOURCE = "calendar_local_v1";
const TIME_ZONE = "America/New_York";
const MAX_SNAPSHOT_APPOINTMENTS = 500;
const ALLOWED_STATUSES = new Set([
  "scheduled",
  "confirmation_sent",
  "confirmed",
  "rescheduled",
  "completed",
  "cancelled",
  "canceled"
]);

export async function handleCalendarOperations(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: CALENDAR_OPERATIONS_ACTION,
      calendarOperationsVersion: CALENDAR_OPERATIONS_VERSION,
      error: "The production D1 database binding is unavailable."
    }, 503);
  }

  const operation = cleanText(body?.operation || "list").toLowerCase();

  try {
    if (operation === "list") {
      return await handleList(db, requestId);
    }

    if (operation === "sync_snapshot") {
      return await handleSyncSnapshot(body, db, requestId);
    }

    return jsonResponse({
      ok: false,
      requestId,
      action: CALENDAR_OPERATIONS_ACTION,
      calendarOperationsVersion: CALENDAR_OPERATIONS_VERSION,
      error: `Unsupported Calendar operation: ${operation || "unknown"}.`
    }, 400);
  } catch (error) {
    logWorkerError({
      requestId,
      route: CALENDAR_OPERATIONS_ACTION,
      stage: `calendar_${operation || "unknown"}`,
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: CALENDAR_OPERATIONS_ACTION,
      calendarOperationsVersion: CALENDAR_OPERATIONS_VERSION,
      error: "Calendar Operations could not complete the request.",
      details: safeErrorMessage(error)
    }, 500);
  }
}

async function handleList(db, requestId) {
  const appointments = await readAppointmentRows(db);

  return jsonResponse({
    ok: true,
    requestId,
    action: CALENDAR_OPERATIONS_ACTION,
    operation: "list",
    calendarOperationsVersion: CALENDAR_OPERATIONS_VERSION,
    calendarAppointments: appointments,
    count: appointments.length,
    writesPerformed: 0
  });
}

async function handleSyncSnapshot(body, db, requestId) {
  const rawAppointments = Array.isArray(body?.appointments)
    ? body.appointments
    : [];

  if (rawAppointments.length > MAX_SNAPSHOT_APPOINTMENTS) {
    return jsonResponse({
      ok: false,
      requestId,
      action: CALENDAR_OPERATIONS_ACTION,
      operation: "sync_snapshot",
      calendarOperationsVersion: CALENDAR_OPERATIONS_VERSION,
      error: `Calendar snapshot cannot exceed ${MAX_SNAPSHOT_APPOINTMENTS} appointments.`
    }, 400);
  }

  const normalized = [];
  const seenIds = new Set();

  for (const item of rawAppointments) {
    const appointment = normalizeCalendarSnapshotAppointment(item);

    if (!appointment.ok) {
      return jsonResponse({
        ok: false,
        requestId,
        action: CALENDAR_OPERATIONS_ACTION,
        operation: "sync_snapshot",
        calendarOperationsVersion: CALENDAR_OPERATIONS_VERSION,
        error: appointment.error
      }, 400);
    }

    if (seenIds.has(appointment.value.id)) {
      return jsonResponse({
        ok: false,
        requestId,
        action: CALENDAR_OPERATIONS_ACTION,
        operation: "sync_snapshot",
        calendarOperationsVersion: CALENDAR_OPERATIONS_VERSION,
        error: `Calendar snapshot contains duplicate appointment id ${appointment.value.id}.`
      }, 400);
    }

    seenIds.add(appointment.value.id);
    normalized.push(appointment.value);
  }

  let writesPerformed = 0;

  for (const appointment of normalized) {
    const clientId = await resolveClientId(db, appointment.clientLabel);
    const sourceKey = `${SOURCE}:${appointment.id}`;

    await db.prepare(`
      INSERT INTO calendar_appointments (
        id,
        client_id,
        title,
        appointment_type_id,
        scheduled_at,
        time_zone,
        location,
        address,
        contact_email,
        client_label,
        notes,
        status,
        source,
        source_key,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL
      )
      ON CONFLICT(id) DO UPDATE SET
        client_id = excluded.client_id,
        title = excluded.title,
        appointment_type_id = excluded.appointment_type_id,
        scheduled_at = excluded.scheduled_at,
        time_zone = excluded.time_zone,
        location = excluded.location,
        address = excluded.address,
        contact_email = excluded.contact_email,
        client_label = excluded.client_label,
        notes = excluded.notes,
        status = excluded.status,
        source = excluded.source,
        source_key = excluded.source_key,
        updated_at = CURRENT_TIMESTAMP,
        deleted_at = NULL
    `).bind(
      appointment.id,
      clientId,
      appointment.title,
      appointment.typeId,
      appointment.scheduledAt,
      TIME_ZONE,
      appointment.location,
      appointment.address,
      appointment.email,
      appointment.clientLabel,
      appointment.notes,
      appointment.status,
      SOURCE,
      sourceKey
    ).run();

    writesPerformed += 1;
  }

  const existingResult = await db.prepare(`
    SELECT id
    FROM calendar_appointments
    WHERE source = ?
      AND deleted_at IS NULL
  `).bind(SOURCE).all();

  const staleIds = rowsOf(existingResult)
    .map(row => positiveInteger(row.id))
    .filter(Boolean)
    .filter(id => !seenIds.has(id));

  for (const id of staleIds) {
    await db.prepare(`
      UPDATE calendar_appointments
      SET status = 'deleted',
          deleted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND source = ?
        AND deleted_at IS NULL
    `).bind(id, SOURCE).run();

    writesPerformed += 1;
  }

  const appointments = await readAppointmentRows(db);

  return jsonResponse({
    ok: true,
    requestId,
    action: CALENDAR_OPERATIONS_ACTION,
    operation: "sync_snapshot",
    calendarOperationsVersion: CALENDAR_OPERATIONS_VERSION,
    calendarAppointments: appointments,
    count: appointments.length,
    syncedCount: normalized.length,
    deletedCount: staleIds.length,
    writesPerformed
  });
}

async function readAppointmentRows(db) {
  const result = await db.prepare(`
    SELECT
      ca.id,
      ca.client_id,
      c.client_code,
      c.name AS client_name,
      ca.title,
      ca.appointment_type_id,
      ca.scheduled_at,
      ca.time_zone,
      ca.location,
      ca.address,
      ca.contact_email,
      ca.client_label,
      ca.notes,
      ca.status,
      ca.source,
      ca.source_key,
      ca.created_at,
      ca.updated_at
    FROM calendar_appointments ca
    LEFT JOIN clients c ON c.id = ca.client_id
    WHERE ca.deleted_at IS NULL
      AND LOWER(COALESCE(ca.status, 'scheduled')) <> 'deleted'
    ORDER BY datetime(ca.scheduled_at) ASC, ca.id ASC
  `).all();

  return rowsOf(result).map(mapCalendarAppointmentRow);
}

async function resolveClientId(db, clientLabel) {
  const label = cleanText(clientLabel);
  if (!label) return null;

  const result = await db.prepare(`
    SELECT id
    FROM clients
    WHERE LOWER(TRIM(COALESCE(name, ''))) = LOWER(?)
       OR LOWER(TRIM(COALESCE(client_code, ''))) = LOWER(?)
    ORDER BY
      CASE WHEN LOWER(TRIM(COALESCE(name, ''))) = LOWER(?) THEN 0 ELSE 1 END,
      id ASC
    LIMIT 1
  `).bind(label, label, label).all();

  return positiveInteger(rowsOf(result)[0]?.id);
}

export function normalizeCalendarSnapshotAppointment(item) {
  const id = positiveInteger(item?.id);
  const title = cleanText(item?.title);
  const typeId = positiveInteger(item?.typeId) || null;
  const date = normalizeDateOnly(item?.date);
  const time = normalizeTimeOnly(item?.time);
  const status = normalizeStatus(item?.status || "scheduled");

  if (!id) {
    return { ok: false, error: "Each Calendar appointment requires a positive integer id." };
  }

  if (!title) {
    return { ok: false, error: `Calendar appointment ${id} requires a title.` };
  }

  if (!date) {
    return { ok: false, error: `Calendar appointment ${id} requires a valid YYYY-MM-DD date.` };
  }

  if (!time) {
    return { ok: false, error: `Calendar appointment ${id} requires a valid HH:MM time.` };
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return { ok: false, error: `Calendar appointment ${id} has unsupported status: ${status}.` };
  }

  return {
    ok: true,
    value: {
      id,
      title,
      typeId,
      date,
      time,
      scheduledAt: `${date}T${time}:00`,
      location: nullableText(item?.location),
      address: nullableText(item?.address),
      email: nullableText(item?.email),
      clientLabel: nullableText(item?.client),
      notes: nullableText(item?.notes),
      status
    }
  };
}

export function mapCalendarAppointmentRow(row) {
  const scheduledAt = cleanText(row?.scheduled_at);
  const date = scheduledAt.slice(0, 10);
  const time = scheduledAt.length >= 16 ? scheduledAt.slice(11, 16) : "";

  return {
    id: positiveInteger(row?.id),
    clientId: positiveInteger(row?.client_id),
    clientCode: nullableText(row?.client_code),
    title: cleanText(row?.title),
    typeId: positiveInteger(row?.appointment_type_id),
    date,
    time,
    scheduledAt,
    timeZone: cleanText(row?.time_zone) || TIME_ZONE,
    location: nullableText(row?.location) || "",
    address: nullableText(row?.address) || "",
    email: nullableText(row?.contact_email) || "",
    client: nullableText(row?.client_label) || nullableText(row?.client_name) || "",
    notes: nullableText(row?.notes) || "",
    status: normalizeStatus(row?.status || "scheduled"),
    source: nullableText(row?.source),
    sourceKey: nullableText(row?.source_key),
    createdAt: nullableText(row?.created_at),
    updatedAt: nullableText(row?.updated_at)
  };
}

function normalizeDateOnly(value) {
  const text = cleanText(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return text;
}

function normalizeTimeOnly(value) {
  const text = cleanText(value);
  const match = text.match(/^(\d{2}):(\d{2})$/);
  if (!match) return "";

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return "";
  }

  return text;
}

function normalizeStatus(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function nullableText(value) {
  const text = cleanText(value);
  return text || null;
}
