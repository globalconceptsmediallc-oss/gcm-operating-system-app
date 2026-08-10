/* =========================================================
   Global Concepts Media Operating System
   File: routes/intelligenceBacklog.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Today / Agency Command Center — Intelligence Backlog Controller
   Purpose:
   Safely advance the historical Intelligence backlog by repeatedly
   invoking the locked Intelligence Refresh engine in bounded batches,
   while aggregating promoted/skipped/failed/remaining results.

   Production rules:
   - Reuses routes/intelligenceRefresh.js; does not duplicate eligibility logic.
   - Intelligence Refresh v1.2.0 remains the source of truth for evaluation.
   - Commit mode is explicit.
   - Stops on any failed refresh batch.
   - Stops when no candidates remain.
   - Stops when the configured batch limit is reached.
   - Stops after the execution-time safety threshold.
   - Creates no records directly; all writes remain owned by Intelligence Refresh
     and its verified downstream processors.
   ========================================================= */

import {
  clean,
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "../shared/http.js";

import {
  handleIntelligenceRefresh,
  INTELLIGENCE_REFRESH_VERSION
} from "./intelligenceRefresh.js";

export const INTELLIGENCE_BACKLOG_VERSION = "1.0.0";
export const INTELLIGENCE_BACKLOG_ACTION = "process-intelligence-backlog";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 10;
const DEFAULT_MAX_BATCHES = 2;
const MAX_BATCHES = 5;
const SAFETY_TIME_MS = 25000;

export async function handleIntelligenceBacklog(body, env, requestId) {
  const startedAt = Date.now();

  const commit = body?.commit === true;
  const batchSize = clampPositiveInt(
    body?.batchSize ?? body?.batch_size,
    DEFAULT_BATCH_SIZE,
    MAX_BATCH_SIZE
  );
  const maxBatches = clampPositiveInt(
    body?.maxBatches ?? body?.max_batches,
    DEFAULT_MAX_BATCHES,
    MAX_BATCHES
  );

  if (!commit) {
    return jsonResponse({
      ok: false,
      requestId,
      action: INTELLIGENCE_BACKLOG_ACTION,
      intelligenceBacklogVersion: INTELLIGENCE_BACKLOG_VERSION,
      intelligenceRefreshVersion: INTELLIGENCE_REFRESH_VERSION,
      error: "Backlog processing requires explicit commit=true.",
      safety: {
        commitRequired: true,
        maxBatchSize: MAX_BATCH_SIZE,
        maxBatches: MAX_BATCHES,
        timeLimitMs: SAFETY_TIME_MS
      }
    }, 400);
  }

  const batches = [];
  const promoted = [];
  const skipped = [];
  const failed = [];

  let remaining = null;
  let stopReason = "max_batches_reached";

  try {
    for (let batchNumber = 1; batchNumber <= maxBatches; batchNumber += 1) {
      const elapsedBeforeBatch = Date.now() - startedAt;

      if (elapsedBeforeBatch >= SAFETY_TIME_MS) {
        stopReason = "time_safety_limit";
        break;
      }

      const childRequestId = `${requestId}-batch-${batchNumber}`;

      const response = await handleIntelligenceRefresh({
        action: "refresh-intelligence",
        limit: batchSize,
        commit: true
      }, env, childRequestId);

      let payload = null;

      try {
        payload = await response.clone().json();
      } catch {
        payload = null;
      }

      const batchSummary = {
        batchNumber,
        ok: Boolean(response.ok && payload?.ok),
        status: response.status,
        discovered: Number(payload?.discovered || 0),
        eligibleCount: Number(payload?.eligibility?.eligibleCount || 0),
        skippedCount: Number(payload?.eligibility?.skippedCount || 0),
        promotedCount: Array.isArray(payload?.processed)
          ? payload.processed.length
          : 0,
        failedCount: Array.isArray(payload?.failed)
          ? payload.failed.length
          : 0,
        intelligenceWrites: Number(payload?.writes?.intelligence || 0),
        evaluationWrites: Number(
          payload?.writes?.intelligenceEvaluations || 0
        ),
        remaining: payload?.remaining || null,
        executionTimeMs: Number(payload?.executionTimeMs || 0),
        error: payload?.error || null
      };

      batches.push(batchSummary);

      if (Array.isArray(payload?.processed)) {
        promoted.push(...payload.processed.map(item => ({
          batchNumber,
          ...item
        })));
      }

      if (Array.isArray(payload?.eligibility?.skipped)) {
        skipped.push(...payload.eligibility.skipped.map(item => ({
          batchNumber,
          recordType: item.recordType,
          recordId: item.recordId,
          clientId: item.clientId,
          observedAt: item.observedAt,
          category: item.category,
          subject: item.subject,
          eligibilityReason: item.eligibilityReason
        })));
      }

      if (Array.isArray(payload?.failed)) {
        failed.push(...payload.failed.map(item => ({
          batchNumber,
          ...item
        })));
      }

      remaining = payload?.remaining || remaining;

      if (!response.ok || payload?.ok !== true || failed.length > 0) {
        stopReason = "batch_failure";
        break;
      }

      if (batchSummary.discovered === 0) {
        stopReason = "no_candidates";
        break;
      }

      if (Number(remaining?.total || 0) === 0) {
        stopReason = "backlog_complete";
        break;
      }

      if (Date.now() - startedAt >= SAFETY_TIME_MS) {
        stopReason = "time_safety_limit";
        break;
      }

      if (batchNumber === maxBatches) {
        stopReason = "max_batches_reached";
      }
    }

    const totals = batches.reduce((accumulator, batch) => {
      accumulator.discovered += batch.discovered;
      accumulator.promoted += batch.promotedCount;
      accumulator.skipped += batch.skippedCount;
      accumulator.failed += batch.failedCount;
      accumulator.intelligenceWrites += batch.intelligenceWrites;
      accumulator.evaluationWrites += batch.evaluationWrites;
      return accumulator;
    }, {
      discovered: 0,
      promoted: 0,
      skipped: 0,
      failed: 0,
      intelligenceWrites: 0,
      evaluationWrites: 0
    });

    return jsonResponse({
      ok: failed.length === 0,
      requestId,
      action: INTELLIGENCE_BACKLOG_ACTION,
      intelligenceBacklogVersion: INTELLIGENCE_BACKLOG_VERSION,
      intelligenceRefreshVersion: INTELLIGENCE_REFRESH_VERSION,
      commitRequested: true,
      controls: {
        batchSize,
        maxBatches,
        timeLimitMs: SAFETY_TIME_MS
      },
      stopReason,
      batches,
      totals,
      promoted,
      skipped,
      failed,
      remaining,
      writes: {
        intelligence: totals.intelligenceWrites,
        intelligenceEvaluations: totals.evaluationWrites,
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
      route: INTELLIGENCE_BACKLOG_ACTION,
      stage: "intelligence_backlog",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: INTELLIGENCE_BACKLOG_ACTION,
      intelligenceBacklogVersion: INTELLIGENCE_BACKLOG_VERSION,
      intelligenceRefreshVersion: INTELLIGENCE_REFRESH_VERSION,
      stopReason: "controller_error",
      batches,
      promoted,
      skipped,
      failed,
      remaining,
      error: safeErrorMessage(error),
      executionTimeMs: Date.now() - startedAt
    }, 500);
  }
}

function clampPositiveInt(value, fallback, maximum) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return fallback;
  }

  return Math.min(number, maximum);
}
