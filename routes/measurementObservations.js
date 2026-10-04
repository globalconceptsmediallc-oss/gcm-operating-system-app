/* =========================================================
   Global Concepts Media Operating System
   File: routes/measurementObservations.js
   Version: 1.0.0
   Status: Production Candidate — Measurement Evidence Layer
   Sprint: SES Q4 2026 Social Impact Measurement
   Purpose:
   Read and create factual campaign measurement observations tied directly
   to one D1 Schedule Authority item. This route stores observations only;
   interpretation and causal conclusions remain in Reviewed Findings / Proof.
   ========================================================= */

import { getDatabase, rowsOf } from "../shared/database.js";
import {
  clean,
  jsonResponse,
  logWorkerError,
  safeErrorMessage
} from "../shared/http.js";

export const MEASUREMENT_OBSERVATIONS_ACTION = "measurement-observations";
export const MEASUREMENT_OBSERVATIONS_VERSION = "1.0.0";

const PHASES = new Set(["baseline","campaign","post_campaign"]);
const ATTRIBUTION_METHODS = new Set([
  "direct_utm",
  "platform_reported",
  "manual_sales",
  "date_correlation",
  "unknown"
]);

export async function handleMeasurementObservations(body, env, requestId) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok:false,
      requestId,
      action:MEASUREMENT_OBSERVATIONS_ACTION,
      measurementObservationsVersion:MEASUREMENT_OBSERVATIONS_VERSION,
      error:"The production D1 database binding is unavailable."
    },503);
  }

  const operation = clean(body?.operation || "list").toLowerCase();

  try {
    if (operation === "list") {
      return await listObservations(body, db, requestId);
    }
    if (operation === "create") {
      return await createObservation(body, db, requestId);
    }

    return bad(
      requestId,
      `Unsupported Measurement operation: ${operation || "unknown"}.`
    );
  } catch (error) {
    logWorkerError({
      requestId,
      route:MEASUREMENT_OBSERVATIONS_ACTION,
      stage:`measurement_${operation || "unknown"}`,
      error
    });

    return jsonResponse({
      ok:false,
      requestId,
      action:MEASUREMENT_OBSERVATIONS_ACTION,
      measurementObservationsVersion:MEASUREMENT_OBSERVATIONS_VERSION,
      error:"Measurement Observations could not complete the request.",
      details:safeErrorMessage(error)
    },500);
  }
}

async function listObservations(body, db, requestId) {
  const clientId = optionalPositive(body?.clientId);
  const scheduleItemId = optionalPositive(body?.scheduleItemId);
  const phase = clean(body?.measurementPhase).toLowerCase() || null;
  const sourceSystem = clean(body?.sourceSystem).toLowerCase() || null;
  const metricKey = clean(body?.metricKey).toLowerCase() || null;
  const limit = normalizeLimit(body?.limit);

  if (body?.clientId !== undefined && body?.clientId !== null && !clientId) {
    return bad(requestId,"clientId must be a positive integer when provided.");
  }
  if (body?.scheduleItemId !== undefined && body?.scheduleItemId !== null && !scheduleItemId) {
    return bad(requestId,"scheduleItemId must be a positive integer when provided.");
  }
  if (phase && !PHASES.has(phase)) {
    return bad(requestId,"measurementPhase must be baseline, campaign, or post_campaign.");
  }

  const rows = rowsOf(await db.prepare(`
    SELECT
      mo.*,
      c.client_code,
      c.name AS client_name,
      si.source_key AS schedule_source_key,
      si.title AS schedule_title,
      si.start_date AS schedule_start_date,
      si.end_date AS schedule_end_date
    FROM measurement_observations mo
    JOIN clients c ON c.id = mo.client_id
    JOIN schedule_items si ON si.id = mo.schedule_item_id
    WHERE (? IS NULL OR mo.client_id = ?)
      AND (? IS NULL OR mo.schedule_item_id = ?)
      AND (? IS NULL OR lower(mo.measurement_phase) = ?)
      AND (? IS NULL OR lower(mo.source_system) = ?)
      AND (? IS NULL OR lower(mo.metric_key) = ?)
    ORDER BY mo.period_start DESC, mo.period_end DESC, mo.id DESC
    LIMIT ?
  `).bind(
    clientId,clientId,
    scheduleItemId,scheduleItemId,
    phase,phase,
    sourceSystem,sourceSystem,
    metricKey,metricKey,
    limit
  ).all()).map(normalizeObservationRow);

  return jsonResponse({
    ok:true,
    requestId,
    action:MEASUREMENT_OBSERVATIONS_ACTION,
    operation:"list",
    measurementObservationsVersion:MEASUREMENT_OBSERVATIONS_VERSION,
    observations:rows,
    writesPerformed:0
  });
}

async function createObservation(body, db, requestId) {
  const input = body?.observation && typeof body.observation === "object"
    ? body.observation
    : body;

  const clientId = positive(input?.clientId);
  const scheduleItemId = positive(input?.scheduleItemId);
  const observationKey = clean(input?.observationKey);
  const periodStart = dateOnly(input?.periodStart);
  const periodEnd = dateOnly(input?.periodEnd);
  const measurementPhase = clean(input?.measurementPhase).toLowerCase();
  const sourceSystem = clean(input?.sourceSystem);
  const channel = nullable(input?.channel);
  const metricKey = clean(input?.metricKey);
  const metricValue = finiteNumber(input?.metricValue);
  const metricUnit = clean(input?.metricUnit || "count");
  const attributionMethod = clean(input?.attributionMethod || "unknown").toLowerCase();
  const sourceReference = nullable(input?.sourceReference);
  const notes = nullable(input?.notes);
  const createdBy = clean(input?.createdBy || "Andy") || "Andy";

  if (!clientId) return bad(requestId,"clientId must be a positive integer.");
  if (!scheduleItemId) return bad(requestId,"scheduleItemId must be a positive integer.");
  if (!observationKey) return bad(requestId,"observationKey is required.");
  if (!periodStart || !periodEnd) return bad(requestId,"Valid periodStart and periodEnd dates are required.");
  if (periodEnd < periodStart) return bad(requestId,"periodEnd cannot be earlier than periodStart.");
  if (!PHASES.has(measurementPhase)) return bad(requestId,"measurementPhase must be baseline, campaign, or post_campaign.");
  if (!sourceSystem) return bad(requestId,"sourceSystem is required.");
  if (!metricKey) return bad(requestId,"metricKey is required.");
  if (metricValue === null) return bad(requestId,"metricValue must be a finite number.");
  if (!metricUnit) return bad(requestId,"metricUnit is required.");
  if (!ATTRIBUTION_METHODS.has(attributionMethod)) {
    return bad(requestId,"attributionMethod is not supported.");
  }

  const schedule = rowsOf(await db.prepare(`
    SELECT id, client_id, source_key, title, start_date, end_date, archived_at
    FROM schedule_items
    WHERE id = ?
    LIMIT 1
  `).bind(scheduleItemId).all())[0] || null;

  if (!schedule) {
    return jsonResponse({
      ok:false,
      requestId,
      action:MEASUREMENT_OBSERVATIONS_ACTION,
      measurementObservationsVersion:MEASUREMENT_OBSERVATIONS_VERSION,
      error:`Schedule item ${scheduleItemId} was not found.`
    },404);
  }

  if (Number(schedule.client_id) !== clientId) {
    return bad(
      requestId,
      `Schedule item ${scheduleItemId} does not belong to client ${clientId}.`
    );
  }

  const duplicate = rowsOf(await db.prepare(`
    SELECT id
    FROM measurement_observations
    WHERE client_id = ?
      AND schedule_item_id = ?
      AND observation_key = ?
    LIMIT 1
  `).bind(clientId,scheduleItemId,observationKey).all())[0] || null;

  if (duplicate) {
    return jsonResponse({
      ok:false,
      requestId,
      action:MEASUREMENT_OBSERVATIONS_ACTION,
      operation:"create",
      measurementObservationsVersion:MEASUREMENT_OBSERVATIONS_VERSION,
      duplicate:true,
      existingObservationId:Number(duplicate.id),
      error:`Observation key "${observationKey}" already exists for this campaign.`,
      writesPerformed:0
    },409);
  }

  const result = await db.prepare(`
    INSERT INTO measurement_observations (
      client_id,
      schedule_item_id,
      observation_key,
      period_start,
      period_end,
      measurement_phase,
      source_system,
      channel,
      metric_key,
      metric_value,
      metric_unit,
      attribution_method,
      source_reference,
      notes,
      captured_at,
      created_by,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    clientId,
    scheduleItemId,
    observationKey,
    periodStart,
    periodEnd,
    measurementPhase,
    sourceSystem,
    channel,
    metricKey,
    metricValue,
    metricUnit,
    attributionMethod,
    sourceReference,
    notes,
    createdBy
  ).run();

  const observationId = Number(
    result?.meta?.last_row_id || result?.meta?.lastRowId || 0
  ) || null;

  if (!observationId) {
    throw new Error("The measurement observation was written but no D1 row ID was returned.");
  }

  const saved = rowsOf(await db.prepare(`
    SELECT
      mo.*,
      c.client_code,
      c.name AS client_name,
      si.source_key AS schedule_source_key,
      si.title AS schedule_title,
      si.start_date AS schedule_start_date,
      si.end_date AS schedule_end_date
    FROM measurement_observations mo
    JOIN clients c ON c.id = mo.client_id
    JOIN schedule_items si ON si.id = mo.schedule_item_id
    WHERE mo.id = ?
    LIMIT 1
  `).bind(observationId).all())[0] || null;

  if (!saved) {
    throw new Error("The saved measurement observation could not be read back.");
  }

  return jsonResponse({
    ok:true,
    requestId,
    action:MEASUREMENT_OBSERVATIONS_ACTION,
    operation:"create",
    measurementObservationsVersion:MEASUREMENT_OBSERVATIONS_VERSION,
    observation:normalizeObservationRow(saved),
    scheduleItem:{
      id:Number(schedule.id),
      sourceKey:clean(schedule.source_key),
      title:clean(schedule.title),
      startDate:clean(schedule.start_date),
      endDate:clean(schedule.end_date)
    },
    writesPerformed:1
  },201);
}

function normalizeObservationRow(row) {
  return {
    id:Number(row.id),
    clientId:Number(row.client_id),
    clientCode:clean(row.client_code),
    clientName:clean(row.client_name),
    scheduleItemId:Number(row.schedule_item_id),
    scheduleSourceKey:clean(row.schedule_source_key),
    scheduleTitle:clean(row.schedule_title),
    scheduleStartDate:clean(row.schedule_start_date),
    scheduleEndDate:clean(row.schedule_end_date),
    observationKey:clean(row.observation_key),
    periodStart:clean(row.period_start),
    periodEnd:clean(row.period_end),
    measurementPhase:clean(row.measurement_phase),
    sourceSystem:clean(row.source_system),
    channel:nullable(row.channel),
    metricKey:clean(row.metric_key),
    metricValue:Number(row.metric_value),
    metricUnit:clean(row.metric_unit),
    attributionMethod:clean(row.attribution_method),
    sourceReference:nullable(row.source_reference),
    notes:nullable(row.notes),
    capturedAt:clean(row.captured_at),
    createdBy:clean(row.created_by),
    createdAt:clean(row.created_at),
    updatedAt:clean(row.updated_at)
  };
}

function bad(requestId, error) {
  return jsonResponse({
    ok:false,
    requestId,
    action:MEASUREMENT_OBSERVATIONS_ACTION,
    measurementObservationsVersion:MEASUREMENT_OBSERVATIONS_VERSION,
    error,
    writesPerformed:0
  },400);
}

function positive(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function optionalPositive(value) {
  if (value === undefined || value === null || value === "") return null;
  return positive(value);
}

function finiteNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeLimit(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return 250;
  return Math.min(number,1000);
}

function nullable(value) {
  const valueText = clean(value);
  return valueText || null;
}

function dateOnly(value) {
  const valueText = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueText)) return null;

  const [year,month,day] = valueText.split("-").map(Number);
  const date = new Date(Date.UTC(year,month-1,day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month-1 ||
    date.getUTCDate() !== day
  ) return null;

  return valueText;
}
