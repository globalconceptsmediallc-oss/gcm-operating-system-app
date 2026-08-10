/* =========================================================
   Global Concepts Media Operating System
   File: routes/intelligenceRefresh.js
   Version: 1.0.1
   Status: Production Road-Test Candidate
   Sprint: Today / Agency Command Center — Automatic Intelligence Refresh
   Purpose:
   Discover durable Communications and Activity Records that do not yet
   have a durable Intelligence record, then route them through the
   already-verified source-specific Intelligence processors.

   Rules:
   - D1 is production truth.
   - Reuses Communication Intelligence and Activity Intelligence.
   - Does not create Communications, Investigations, Work Items, Evidence,
     Measurements, or Activity Records.
   - Intelligence persistence/correlation remains owned by
     intelligenceProcessing.js.
   - Bounded batch processing prevents an unbounded refresh request.

   Changes in 1.0.1:
   - Corrects Communications production timestamp field from the invalid
     comm.date assumption to verified comm.occurred_at.
   ========================================================= */

import { getDatabase } from "../shared/database.js";
import {
  clean,
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "../shared/http.js";
import {
  handleCommunicationIntelligence
} from "./communicationIntelligence.js";
import {
  handleActivityIntelligence
} from "./activityIntelligence.js";

export const INTELLIGENCE_REFRESH_VERSION = "1.0.1";
export const INTELLIGENCE_REFRESH_ACTION = "refresh-intelligence";

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 10;

export async function handleIntelligenceRefresh(body, env, requestId) {
  const startedAt = Date.now();
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: INTELLIGENCE_REFRESH_ACTION,
      intelligenceRefreshVersion: INTELLIGENCE_REFRESH_VERSION,
      error: "The production D1 database binding is unavailable."
    }, 503);
  }

  const limit = normalizeLimit(body?.limit);

  try {
    const candidates = await discoverCandidates(db, limit);
    const processed = [];
    const failed = [];

    for (const candidate of candidates) {
      const childRequestId =
        `${requestId}-${candidate.recordType}-${candidate.recordId}`;

      const response = candidate.recordType === "communication"
        ? await handleCommunicationIntelligence({
            action: "process-communication-intelligence",
            communicationId: candidate.recordId
          }, env, childRequestId)
        : await handleActivityIntelligence({
            action: "process-activity-intelligence",
            activityRecordId: candidate.recordId
          }, env, childRequestId);

      let payload = null;
      try {
        payload = await response.clone().json();
      } catch {
        payload = null;
      }

      const result = {
        recordType: candidate.recordType,
        recordId: candidate.recordId,
        clientId: candidate.clientId,
        observedAt: candidate.observedAt,
        ok: Boolean(response.ok && payload?.ok),
        status: response.status,
        intelligenceId:
          payload?.intelligence?.result?.intelligenceId ?? null,
        novelty:
          payload?.intelligence?.result?.novelty ?? null,
        handlingState:
          payload?.intelligence?.result?.handlingState ?? null,
        error:
          response.ok && payload?.ok
            ? null
            : payload?.error || "Intelligence processing failed."
      };

      if (result.ok) processed.push(result);
      else failed.push(result);
    }

    const remaining = await countRemainingCandidates(db);

    return jsonResponse({
      ok: failed.length === 0,
      requestId,
      action: INTELLIGENCE_REFRESH_ACTION,
      intelligenceRefreshVersion: INTELLIGENCE_REFRESH_VERSION,
      source: "D1",
      readOnlyDiscovery: true,
      requestedLimit: limit,
      discovered: candidates.length,
      processed,
      failed,
      remaining,
      writes: {
        intelligence: processed.length,
        communications: 0,
        investigations: 0,
        workItems: 0,
        evidence: 0,
        measurements: 0,
        activityRecords: 0
      },
      executionTimeMs: Date.now() - startedAt
    }, failed.length ? 207 : 200);
  } catch (error) {
    logWorkerError({
      requestId,
      route: INTELLIGENCE_REFRESH_ACTION,
      stage: "intelligence_refresh",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: INTELLIGENCE_REFRESH_ACTION,
      intelligenceRefreshVersion: INTELLIGENCE_REFRESH_VERSION,
      error: safeErrorMessage(error),
      executionTimeMs: Date.now() - startedAt
    }, 500);
  }
}

async function discoverCandidates(db, limit) {
  const result = await db.prepare(`
    SELECT *
    FROM (
      SELECT
        'communication' AS record_type,
        comm.id AS record_id,
        comm.client_id AS client_id,
        COALESCE(comm.occurred_at, comm.created_at) AS observed_at
      FROM communications comm
      WHERE NOT EXISTS (
        SELECT 1
        FROM intelligence i
        WHERE i.communication_id = comm.id
           OR i.source_reference = ('communication:' || comm.id)
      )

      UNION ALL

      SELECT
        'activity_record' AS record_type,
        ar.id AS record_id,
        ar.client_id AS client_id,
        COALESCE(ar.activity_date, ar.created_at) AS observed_at
      FROM activity_records ar
      WHERE NOT EXISTS (
        SELECT 1
        FROM intelligence i
        WHERE (
          ar.source_reference IS NOT NULL
          AND TRIM(ar.source_reference) <> ''
          AND i.source_reference = ar.source_reference
        )
        OR i.source_reference = ('activity:' || ar.id)
        OR i.work_item_id = ar.work_item_id
           AND ar.work_item_id IS NOT NULL
           AND i.source_type = COALESCE(ar.source_type, 'activity_record')
      )
    )
    ORDER BY datetime(observed_at) DESC, record_id DESC
    LIMIT ?
  `).bind(limit).all();

  const rows = Array.isArray(result?.results) ? result.results : [];

  return rows.map(row => ({
    recordType: clean(row.record_type),
    recordId: positiveInt(row.record_id),
    clientId: positiveInt(row.client_id),
    observedAt: row.observed_at || null
  })).filter(row => row.recordId && row.clientId);
}

async function countRemainingCandidates(db) {
  const row = await db.prepare(`
    SELECT
      (
        SELECT COUNT(*)
        FROM communications comm
        WHERE NOT EXISTS (
          SELECT 1
          FROM intelligence i
          WHERE i.communication_id = comm.id
             OR i.source_reference = ('communication:' || comm.id)
        )
      ) AS communications,
      (
        SELECT COUNT(*)
        FROM activity_records ar
        WHERE NOT EXISTS (
          SELECT 1
          FROM intelligence i
          WHERE (
            ar.source_reference IS NOT NULL
            AND TRIM(ar.source_reference) <> ''
            AND i.source_reference = ar.source_reference
          )
          OR i.source_reference = ('activity:' || ar.id)
          OR i.work_item_id = ar.work_item_id
             AND ar.work_item_id IS NOT NULL
             AND i.source_type = COALESCE(ar.source_type, 'activity_record')
        )
      ) AS activity_records
  `).first();

  const communications = Number(row?.communications || 0);
  const activityRecords = Number(row?.activity_records || 0);

  return {
    communications,
    activityRecords,
    total: communications + activityRecords
  };
}

function normalizeLimit(value) {
  const parsed = positiveInt(value);
  if (!parsed) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function positiveInt(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return null;
  return number;
}
