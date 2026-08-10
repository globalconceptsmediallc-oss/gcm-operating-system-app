/* =========================================================
   Global Concepts Media Operating System
   File: routes/intelligenceRefresh.js
   Version: 1.2.0
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

   Changes in 1.2.0:
   - Adds durable evaluation persistence through intelligence_evaluations.
   - Preview mode remains read-only and writes nothing.
   - Commit mode records every reviewed candidate as promoted or skipped.
   - Promoted candidates preserve the resulting intelligence_id in the ledger.
   - Future discovery excludes records already represented in Intelligence
     or intelligence_evaluations so evaluated monitoring/history does not recycle.
   - Preserves v1.1.1 eligibility rules and bounded batch behavior.
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

export const INTELLIGENCE_REFRESH_VERSION = "1.2.0";
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
  const commit = body?.commit === true;

  try {
    const candidates = await discoverCandidates(db, limit);
    const reviewed = candidates.map(classifyEligibility);
    const eligible = reviewed.filter(item => item.eligible);
    const skipped = reviewed.filter(item => !item.eligible);
    const processed = [];
    const failed = [];
    const evaluations = [];

    if (commit) {
      for (const candidate of eligible) {
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
          eligibilityReason: candidate.eligibilityReason,
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

        if (result.ok) {
          processed.push(result);

          const evaluation = await upsertEvaluation(db, {
            recordType: candidate.recordType,
            recordId: candidate.recordId,
            clientId: candidate.clientId,
            decision: "promoted",
            decisionReason: candidate.eligibilityReason,
            intelligenceId: result.intelligenceId,
            evaluatorVersion: INTELLIGENCE_REFRESH_VERSION
          });

          evaluations.push(evaluation);
        } else {
          failed.push(result);
        }
      }

      for (const candidate of skipped) {
        const evaluation = await upsertEvaluation(db, {
          recordType: candidate.recordType,
          recordId: candidate.recordId,
          clientId: candidate.clientId,
          decision: "skipped",
          decisionReason: candidate.eligibilityReason,
          intelligenceId: null,
          evaluatorVersion: INTELLIGENCE_REFRESH_VERSION
        });

        evaluations.push(evaluation);
      }
    }

    const remaining = await countRemainingCandidates(db);

    return jsonResponse({
      ok: failed.length === 0,
      requestId,
      action: INTELLIGENCE_REFRESH_ACTION,
      intelligenceRefreshVersion: INTELLIGENCE_REFRESH_VERSION,
      source: "D1",
      previewOnly: !commit,
      commitRequested: commit,
      requestedLimit: limit,
      discovered: candidates.length,
      eligibility: {
        eligibleCount: eligible.length,
        skippedCount: skipped.length,
        eligible,
        skipped
      },
      processed,
      failed,
      evaluations,
      remaining,
      writes: {
        intelligence: processed.length,
        intelligenceEvaluations: evaluations.length,
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
        COALESCE(comm.occurred_at, comm.created_at) AS observed_at,
        COALESCE(comm.status, '') AS record_status,
        COALESCE(comm.category, '') AS category,
        COALESCE(comm.source, '') AS source_type,
        COALESCE(comm.subject, '') AS subject,
        '' AS source_reference,
        NULL AS work_item_id,
        '' AS evidence_type,
        '' AS expected_impact,
        '' AS actual_impact,
        '' AS notes
      FROM communications comm
      WHERE NOT EXISTS (
        SELECT 1
        FROM intelligence i
        WHERE i.communication_id = comm.id
           OR i.source_reference = ('communication:' || comm.id)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM intelligence_evaluations ie
        WHERE ie.record_type = 'communication'
          AND ie.record_id = comm.id
      )

      UNION ALL

      SELECT
        'activity_record' AS record_type,
        ar.id AS record_id,
        ar.client_id AS client_id,
        COALESCE(ar.activity_date, ar.created_at) AS observed_at,
        COALESCE(ar.status, '') AS record_status,
        COALESCE(ar.category, '') AS category,
        COALESCE(ar.source_type, '') AS source_type,
        COALESCE(ar.activity, '') AS subject,
        COALESCE(ar.source_reference, '') AS source_reference,
        ar.work_item_id AS work_item_id,
        COALESCE(ar.evidence_type, '') AS evidence_type,
        COALESCE(ar.expected_impact, '') AS expected_impact,
        COALESCE(ar.actual_impact, '') AS actual_impact,
        COALESCE(ar.notes, '') AS notes
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
        OR (
          i.work_item_id = ar.work_item_id
          AND ar.work_item_id IS NOT NULL
          AND i.source_type = COALESCE(ar.source_type, 'activity_record')
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM intelligence_evaluations ie
        WHERE ie.record_type = 'activity_record'
          AND ie.record_id = ar.id
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
    observedAt: row.observed_at || null,
    recordStatus: clean(row.record_status),
    category: clean(row.category),
    sourceType: clean(row.source_type),
    subject: clean(row.subject),
    sourceReference: clean(row.source_reference),
    workItemId: positiveInt(row.work_item_id),
    evidenceType: clean(row.evidence_type),
    expectedImpact: clean(row.expected_impact),
    actualImpact: clean(row.actual_impact),
    notes: clean(row.notes)
  })).filter(row => row.recordId && row.clientId);
}

function classifyEligibility(candidate) {
  const sourceType = key(candidate.sourceType);
  const category = key(candidate.category);
  const evidenceType = key(candidate.evidenceType);
  const status = key(candidate.recordStatus);
  const expectedImpact = key(candidate.expectedImpact);
  const text = [
    candidate.category,
    candidate.subject,
    candidate.sourceType,
    candidate.evidenceType,
    candidate.expectedImpact,
    candidate.actualImpact,
    candidate.notes
  ].filter(Boolean).join(" ").toLowerCase();

  if (candidate.recordType === "communication") {
    if (isHistoricalOnly(sourceType, category, evidenceType, status, text)) {
      return {
        ...candidate,
        eligible: false,
        eligibilityReason:
          "Communication is explicitly historical/import-only and remains durable history."
      };
    }

    return {
      ...candidate,
      eligible: true,
      eligibilityReason:
        "Communication is a durable operating input not yet normalized into Intelligence."
    };
  }

  if (isHistoricalOnly(sourceType, category, evidenceType, status, text)) {
    return {
      ...candidate,
      eligible: false,
      eligibilityReason:
        "Activity Record is historical/import-only agency history and does not require a new Intelligence record."
    };
  }

  if (isProofOnly(sourceType, category, evidenceType, text)) {
    return {
      ...candidate,
      eligible: false,
      eligibilityReason:
        "Activity Record is proof/result history; preserve it as proof unless a separate operational signal requires Intelligence."
    };
  }

  if (candidate.workItemId) {
    return {
      ...candidate,
      eligible: true,
      eligibilityReason:
        "Activity Record is linked to Work and may carry outcome or progress Intelligence for existing handling."
    };
  }

  if (isRoutineMonitoring(expectedImpact, category, sourceType, text)) {
    return {
      ...candidate,
      eligible: false,
      eligibilityReason:
        "Activity Record is routine monitoring/trend evidence. Preserve the durable Activity and source provenance; create Intelligence only when comparison proves a meaningful change, problem, result, or required action."
    };
  }

  if (isOperationalSignal(sourceType, category, text)) {
    return {
      ...candidate,
      eligible: true,
      eligibilityReason:
        "Activity Record contains a non-routine operational change/problem/result signal that should be correlated with durable history."
    };
  }

  return {
    ...candidate,
    eligible: false,
    eligibilityReason:
      "Activity Record is durable history, but no Work link or proven operational change/problem/result establishes a separate Intelligence need."
  };
}

function isRoutineMonitoring(expectedImpact, category, sourceType, text) {
  if (expectedImpact === "monitoring_trend_evidence") return true;

  if ([
    "youtube_performance",
    "monthly_performance",
    "monthly_report",
    "baseline",
    "monitoring"
  ].includes(category)) return true;

  if (/\bpreserve (these|the) metrics as monitoring evidence\b/.test(text)) return true;
  if (/\bsave the monthly .* metrics as monitoring evidence\b/.test(text)) return true;
  if (/\bremain(s)? monitoring evidence unless\b/.test(text)) return true;
  if (/\bmonitoring evidence until\b/.test(text)) return true;
  if (/\bretain it as monitoring unless\b/.test(text)) return true;

  return false;
}

function isHistoricalOnly(sourceType, category, evidenceType, status, text) {
  const values = [sourceType, category, evidenceType, status];

  if (values.some(value =>
    [
      "historical_import",
      "legacy_import",
      "migration_import",
      "historical",
      "archive",
      "archived"
    ].includes(value)
  )) return true;

  return /\b(historical import|legacy import|migration import|imported historical)\b/.test(text);
}

function isProofOnly(sourceType, category, evidenceType, text) {
  const values = [sourceType, category, evidenceType];

  if (values.some(value =>
    [
      "proof",
      "proof_of_work",
      "proof_result",
      "completed_work_import",
      "result_import"
    ].includes(value)
  )) return true;

  return /\b(proof of work|proof result|completed work import)\b/.test(text);
}

function isOperationalSignal(sourceType, category, text) {
  if ([
    "gmail_monitoring",
    "gmail_investigation",
    "communication",
    "monitoring",
    "measurement",
    "investigation",
    "work_update"
  ].includes(sourceType)) return true;

  if (/\b(alert|audit|monitor|ranking|index|canonical|error|warning|declin|improv|increase|decrease|resolved|issue|health score|position tracking|search console)\b/.test(text)) {
    return true;
  }

  return [
    "seo_ranking_alert",
    "technical_seo_audit_alert",
    "backlink_audit",
    "search_console",
    "monitoring"
  ].includes(category);
}

function key(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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
        AND NOT EXISTS (
          SELECT 1
          FROM intelligence_evaluations ie
          WHERE ie.record_type = 'communication'
            AND ie.record_id = comm.id
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
        AND NOT EXISTS (
          SELECT 1
          FROM intelligence_evaluations ie
          WHERE ie.record_type = 'activity_record'
            AND ie.record_id = ar.id
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

async function upsertEvaluation(db, {
  recordType,
  recordId,
  clientId,
  decision,
  decisionReason,
  intelligenceId,
  evaluatorVersion
}) {
  await db.prepare(`
    INSERT INTO intelligence_evaluations (
      record_type,
      record_id,
      client_id,
      decision,
      decision_reason,
      intelligence_id,
      evaluator,
      evaluator_version,
      evaluated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'intelligence_refresh', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(record_type, record_id) DO UPDATE SET
      client_id = excluded.client_id,
      decision = excluded.decision,
      decision_reason = excluded.decision_reason,
      intelligence_id = excluded.intelligence_id,
      evaluator = excluded.evaluator,
      evaluator_version = excluded.evaluator_version,
      evaluated_at = CURRENT_TIMESTAMP
  `).bind(
    recordType,
    recordId,
    clientId,
    decision,
    decisionReason || null,
    intelligenceId || null,
    evaluatorVersion
  ).run();

  return {
    recordType,
    recordId,
    clientId,
    decision,
    decisionReason: decisionReason || null,
    intelligenceId: intelligenceId || null,
    evaluator: "intelligence_refresh",
    evaluatorVersion
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
