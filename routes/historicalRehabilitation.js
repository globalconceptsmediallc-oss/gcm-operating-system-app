/* =========================================================
   Global Concepts Media Operating System
   File: routes/historicalRehabilitation.js
   Version: 1.1.0
   Status: Production Road-Test Candidate
   Sprint: Historical Record Rehabilitation
   Purpose:
   Generate controlled historical rehabilitation proposals and safely apply
   one human-approved proposal while preserving the durable audit trail.

   Production rules:
   - D1 is production truth.
   - Reads an existing record_rehabilitations proposal by ID.
   - Requires an explicit human reviewer name before applying.
   - Version 1.0.0 supports only:
       record_type = activity_record
       field_name  = time_minutes
   - Refuses unsupported record/field combinations.
   - Refuses stale proposals when the current production value no longer
     matches the rehabilitation proposal's recorded original value.
   - Applies the corrected Activity Record value and marks the
     rehabilitation record applied in one D1 batch.
   - Does not create Communications, Intelligence, Investigations,
     Work Items, Evidence, Measurements, Media, Calendar, Prospect,
     Finance, Proof, or Case Study records.
   - Does not invoke AI.
   ========================================================= */

import { getDatabase } from "../shared/database.js";
import {
  clean,
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "../shared/http.js";

export const HISTORICAL_REHABILITATION_VERSION = "1.1.0";
export const HISTORICAL_REHABILITATION_PROPOSAL_ACTION =
  "generate-historical-rehabilitation-proposals";
export const HISTORICAL_REHABILITATION_ACTION =
  "apply-historical-rehabilitation";


export async function handleHistoricalRehabilitationProposals(body, env, requestId) {
  const startedAt = Date.now();
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false, requestId,
      action: HISTORICAL_REHABILITATION_PROPOSAL_ACTION,
      historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
      error: "The production D1 database binding is unavailable."
    }, 503);
  }

  const previewOnly = body?.commit !== true;

  try {
    const result = await db.prepare(`
      SELECT ar.id, ar.client_id, ar.activity_date, ar.category, ar.activity,
             ar.time_minutes, ar.source_type, ar.source_reference
      FROM activity_records ar
      WHERE ar.source_type = 'gmail_monitoring'
        AND (ar.time_minutes IS NULL OR ar.time_minutes = 0)
        AND NOT EXISTS (
          SELECT 1 FROM record_rehabilitations rr
          WHERE rr.record_type = 'activity_record'
            AND rr.record_id = ar.id
            AND rr.field_name = 'time_minutes'
            AND rr.status IN ('proposed','approved','applied')
        )
      ORDER BY ar.activity_date ASC, ar.id ASC
    `).all();

    const rows = Array.isArray(result?.results) ? result.results : [];
    const proposals = rows.map(row => ({
      recordId: Number(row.id),
      clientId: Number(row.client_id),
      activityDate: row.activity_date || null,
      category: clean(row.category) || null,
      activity: clean(row.activity) || null,
      originalValue: row.time_minutes === null ? null : String(row.time_minutes),
      proposedValue: "5"
    }));

    if (previewOnly) {
      return jsonResponse({
        ok: true, requestId,
        action: HISTORICAL_REHABILITATION_PROPOSAL_ACTION,
        historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
        previewOnly: true, commitRequested: false,
        policy: {
          sourceType: "gmail_monitoring",
          proposedMinutes: 5,
          activityRecordsChanged: false,
          humanApprovalRequiredBeforeApply: true
        },
        discovered: proposals.length,
        proposals,
        writes: { recordRehabilitations: 0, activityRecords: 0 },
        executionTimeMs: Date.now() - startedAt
      });
    }

    if (!proposals.length) {
      return jsonResponse({
        ok: true, requestId,
        action: HISTORICAL_REHABILITATION_PROPOSAL_ACTION,
        historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
        previewOnly: false, commitRequested: true,
        discovered: 0, created: 0, proposals: [],
        writes: { recordRehabilitations: 0, activityRecords: 0 },
        executionTimeMs: Date.now() - startedAt
      });
    }

    if (typeof db.batch !== "function") {
      return jsonResponse({
        ok: false, requestId,
        action: HISTORICAL_REHABILITATION_PROPOSAL_ACTION,
        historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
        error: "The production D1 binding does not support batch writes required for proposal generation."
      }, 503);
    }

    const evidenceDetail =
      "Routine Gmail monitoring workflow: read the monitoring email, interpret it through GCM OS/ChatGPT, and preserve the operating record. Production evidence and road testing establish 5 minutes as the conservative minimum for this monitoring-input class. Substantive follow-up work remains separate Proof of Work.";

    const statements = proposals.map(p => db.prepare(`
      INSERT INTO record_rehabilitations (
        record_type, record_id, client_id, field_name,
        original_value, proposed_value, rehabilitation_type,
        evidence_source, evidence_reference, evidence_detail,
        confidence, status
      )
      SELECT 'activity_record', ?, ?, 'time_minutes', ?, '5',
             'historical_estimate_pow_comparable',
             'GCM historical workflow and comparable POW records',
             'gmail_monitoring_verified_minimum',
             ?, 'high', 'proposed'
      WHERE NOT EXISTS (
        SELECT 1 FROM record_rehabilitations
        WHERE record_type = 'activity_record'
          AND record_id = ?
          AND field_name = 'time_minutes'
          AND status IN ('proposed','approved','applied')
      )
    `).bind(p.recordId, p.clientId, p.originalValue, evidenceDetail, p.recordId));

    const batchResult = await db.batch(statements);
    const created = batchResult.reduce(
      (sum, item) => sum + Number(item?.meta?.changes || 0), 0
    );

    return jsonResponse({
      ok: true, requestId,
      action: HISTORICAL_REHABILITATION_PROPOSAL_ACTION,
      historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
      previewOnly: false, commitRequested: true,
      policy: {
        sourceType: "gmail_monitoring",
        proposedMinutes: 5,
        activityRecordsChanged: false,
        humanApprovalRequiredBeforeApply: true
      },
      discovered: proposals.length, created, proposals,
      writes: { recordRehabilitations: created, activityRecords: 0 },
      executionTimeMs: Date.now() - startedAt
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: HISTORICAL_REHABILITATION_PROPOSAL_ACTION,
      stage: "historical_rehabilitation_proposals",
      error
    });
    return jsonResponse({
      ok: false, requestId,
      action: HISTORICAL_REHABILITATION_PROPOSAL_ACTION,
      historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
      error: safeErrorMessage(error),
      executionTimeMs: Date.now() - startedAt
    }, 500);
  }
}

export async function handleHistoricalRehabilitation(body, env, requestId) {
  const startedAt = Date.now();
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: HISTORICAL_REHABILITATION_ACTION,
      historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
      error: "The production D1 database binding is unavailable."
    }, 503);
  }

  const rehabilitationId = positiveInt(
    body?.rehabilitationId ??
    body?.rehabilitation_id ??
    body?.recordRehabilitationId ??
    body?.id
  );

  const reviewedBy = clean(
    body?.reviewedBy ??
    body?.reviewed_by ??
    body?.reviewer
  );

  const confirmApply = body?.confirm === true || body?.apply === true;

  if (!rehabilitationId) {
    return jsonResponse({
      ok: false,
      requestId,
      action: HISTORICAL_REHABILITATION_ACTION,
      historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
      error: "A valid rehabilitationId is required."
    }, 400);
  }

  if (!reviewedBy) {
    return jsonResponse({
      ok: false,
      requestId,
      action: HISTORICAL_REHABILITATION_ACTION,
      historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
      rehabilitationId,
      error: "A human reviewedBy value is required before rehabilitation can be applied."
    }, 400);
  }

  if (!confirmApply) {
    return jsonResponse({
      ok: false,
      requestId,
      action: HISTORICAL_REHABILITATION_ACTION,
      historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
      rehabilitationId,
      error: "Explicit confirm:true is required before production data can be changed."
    }, 400);
  }

  try {
    const rehabilitation = await db.prepare(`
      SELECT
        id,
        record_type,
        record_id,
        client_id,
        field_name,
        original_value,
        proposed_value,
        rehabilitation_type,
        evidence_source,
        evidence_reference,
        evidence_detail,
        confidence,
        status,
        reviewed_by,
        reviewed_at,
        applied_at,
        created_at,
        updated_at
      FROM record_rehabilitations
      WHERE id = ?
      LIMIT 1
    `).bind(rehabilitationId).first();

    if (!rehabilitation) {
      return jsonResponse({
        ok: false,
        requestId,
        action: HISTORICAL_REHABILITATION_ACTION,
        historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
        rehabilitationId,
        error: `Rehabilitation #${rehabilitationId} was not found.`
      }, 404);
    }

    const recordType = clean(rehabilitation.record_type);
    const fieldName = clean(rehabilitation.field_name);
    const status = clean(rehabilitation.status).toLowerCase();

    if (
      recordType !== "activity_record" ||
      fieldName !== "time_minutes"
    ) {
      return jsonResponse({
        ok: false,
        requestId,
        action: HISTORICAL_REHABILITATION_ACTION,
        historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
        rehabilitationId,
        error:
          "Version 1.1.0 only supports activity_record.time_minutes rehabilitation."
      }, 400);
    }

    if (status === "applied") {
      const current = await loadActivityRecord(db, rehabilitation.record_id);

      return jsonResponse({
        ok: true,
        requestId,
        action: HISTORICAL_REHABILITATION_ACTION,
        historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
        rehabilitationId,
        idempotent: true,
        message: "This rehabilitation was already applied.",
        rehabilitation: summarizeRehabilitation(rehabilitation),
        currentRecord: summarizeActivityRecord(current),
        writes: {
          recordRehabilitations: 0,
          activityRecords: 0
        },
        executionTimeMs: Date.now() - startedAt
      });
    }

    if (status !== "proposed" && status !== "approved") {
      return jsonResponse({
        ok: false,
        requestId,
        action: HISTORICAL_REHABILITATION_ACTION,
        historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
        rehabilitationId,
        error:
          `Rehabilitation #${rehabilitationId} has status "${status || "unknown"}" and cannot be applied.`
      }, 409);
    }

    const activityRecordId = positiveInt(rehabilitation.record_id);

    if (!activityRecordId) {
      return jsonResponse({
        ok: false,
        requestId,
        action: HISTORICAL_REHABILITATION_ACTION,
        historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
        rehabilitationId,
        error: "The rehabilitation does not reference a valid Activity Record."
      }, 400);
    }

    const activity = await loadActivityRecord(db, activityRecordId);

    if (!activity) {
      return jsonResponse({
        ok: false,
        requestId,
        action: HISTORICAL_REHABILITATION_ACTION,
        historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
        rehabilitationId,
        error: `Activity Record #${activityRecordId} was not found.`
      }, 404);
    }

    if (Number(activity.client_id) !== Number(rehabilitation.client_id)) {
      return jsonResponse({
        ok: false,
        requestId,
        action: HISTORICAL_REHABILITATION_ACTION,
        historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
        rehabilitationId,
        error:
          "The rehabilitation client_id does not match the current Activity Record."
      }, 409);
    }

    const proposedMinutes = positiveInt(rehabilitation.proposed_value);

    if (!proposedMinutes) {
      return jsonResponse({
        ok: false,
        requestId,
        action: HISTORICAL_REHABILITATION_ACTION,
        historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
        rehabilitationId,
        error: "The proposed time_minutes value must be a positive integer."
      }, 400);
    }

    const currentMinutes = nullableInteger(activity.time_minutes);
    const expectedOriginal = normalizeOriginalInteger(
      rehabilitation.original_value
    );

    if (!originalMatchesCurrent(expectedOriginal, currentMinutes)) {
      return jsonResponse({
        ok: false,
        requestId,
        action: HISTORICAL_REHABILITATION_ACTION,
        historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
        rehabilitationId,
        processingStatus: "stale_proposal",
        error:
          "The production Activity Record no longer matches the rehabilitation proposal's original value.",
        expectedOriginalValue: expectedOriginal,
        currentProductionValue: currentMinutes,
        proposedValue: proposedMinutes,
        writes: {
          recordRehabilitations: 0,
          activityRecords: 0
        }
      }, 409);
    }

    const reviewedAt = new Date().toISOString();

    const statements = [
      db.prepare(`
        UPDATE activity_records
        SET
          time_minutes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        proposedMinutes,
        activityRecordId
      ),

      db.prepare(`
        UPDATE record_rehabilitations
        SET
          status = 'applied',
          reviewed_by = ?,
          reviewed_at = ?,
          applied_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status IN ('proposed', 'approved')
      `).bind(
        reviewedBy,
        reviewedAt,
        reviewedAt,
        rehabilitationId
      )
    ];

    if (typeof db.batch !== "function") {
      return jsonResponse({
        ok: false,
        requestId,
        action: HISTORICAL_REHABILITATION_ACTION,
        historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
        rehabilitationId,
        error:
          "The production D1 binding does not support batch writes required for safe rehabilitation."
      }, 503);
    }

    const batchResult = await db.batch(statements);
    const activityWrite = batchMeta(batchResult?.[0]);
    const rehabilitationWrite = batchMeta(batchResult?.[1]);

    const [afterActivity, afterRehabilitation] = await Promise.all([
      loadActivityRecord(db, activityRecordId),
      db.prepare(`
        SELECT
          id,
          record_type,
          record_id,
          client_id,
          field_name,
          original_value,
          proposed_value,
          rehabilitation_type,
          evidence_source,
          evidence_reference,
          evidence_detail,
          confidence,
          status,
          reviewed_by,
          reviewed_at,
          applied_at,
          created_at,
          updated_at
        FROM record_rehabilitations
        WHERE id = ?
        LIMIT 1
      `).bind(rehabilitationId).first()
    ]);

    const verifiedApplied =
      Number(afterActivity?.time_minutes) === proposedMinutes &&
      clean(afterRehabilitation?.status).toLowerCase() === "applied" &&
      clean(afterRehabilitation?.reviewed_by) === reviewedBy &&
      Boolean(clean(afterRehabilitation?.applied_at));

    if (!verifiedApplied) {
      return jsonResponse({
        ok: false,
        requestId,
        action: HISTORICAL_REHABILITATION_ACTION,
        historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
        rehabilitationId,
        processingStatus: "verification_failed",
        error:
          "The rehabilitation write completed but post-write verification did not prove the expected production state.",
        before: {
          activityRecord: summarizeActivityRecord(activity),
          rehabilitation: summarizeRehabilitation(rehabilitation)
        },
        after: {
          activityRecord: summarizeActivityRecord(afterActivity),
          rehabilitation: summarizeRehabilitation(afterRehabilitation)
        },
        writes: {
          activityRecords: activityWrite.changes,
          recordRehabilitations: rehabilitationWrite.changes
        },
        executionTimeMs: Date.now() - startedAt
      }, 500);
    }

    return jsonResponse({
      ok: true,
      requestId,
      action: HISTORICAL_REHABILITATION_ACTION,
      historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
      rehabilitationId,
      processingStatus: "applied_and_verified",
      recordPolicy: {
        humanApprovalRequired: true,
        reviewedBy,
        sourceRecordPreserved: true,
        evidenceTrailPreserved: true
      },
      before: {
        activityRecord: summarizeActivityRecord(activity),
        rehabilitation: summarizeRehabilitation(rehabilitation)
      },
      after: {
        activityRecord: summarizeActivityRecord(afterActivity),
        rehabilitation: summarizeRehabilitation(afterRehabilitation)
      },
      writes: {
        activityRecords: activityWrite.changes,
        recordRehabilitations: rehabilitationWrite.changes,
        communications: 0,
        intelligence: 0,
        investigations: 0,
        workItems: 0,
        evidence: 0,
        measurements: 0
      },
      executionTimeMs: Date.now() - startedAt
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: HISTORICAL_REHABILITATION_ACTION,
      stage: "historical_rehabilitation",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: HISTORICAL_REHABILITATION_ACTION,
      historicalRehabilitationVersion: HISTORICAL_REHABILITATION_VERSION,
      error: safeErrorMessage(error),
      executionTimeMs: Date.now() - startedAt
    }, 500);
  }
}

async function loadActivityRecord(db, activityRecordId) {
  return db.prepare(`
    SELECT
      id,
      client_id,
      activity_date,
      category,
      activity,
      time_minutes,
      source_type,
      source_reference,
      status,
      owner,
      created_at,
      updated_at
    FROM activity_records
    WHERE id = ?
    LIMIT 1
  `).bind(activityRecordId).first();
}

function summarizeActivityRecord(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    clientId: Number(row.client_id),
    activityDate: row.activity_date || null,
    category: clean(row.category) || null,
    activity: clean(row.activity) || null,
    timeMinutes: nullableInteger(row.time_minutes),
    sourceType: clean(row.source_type) || null,
    sourceReference: clean(row.source_reference) || null,
    status: clean(row.status) || null,
    owner: clean(row.owner) || null,
    updatedAt: row.updated_at || null
  };
}

function summarizeRehabilitation(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    recordType: clean(row.record_type),
    recordId: Number(row.record_id),
    clientId: Number(row.client_id),
    fieldName: clean(row.field_name),
    originalValue:
      row.original_value === null ? null : clean(row.original_value),
    proposedValue:
      row.proposed_value === null ? null : clean(row.proposed_value),
    rehabilitationType: clean(row.rehabilitation_type),
    evidenceSource: clean(row.evidence_source),
    evidenceReference: clean(row.evidence_reference) || null,
    evidenceDetail: clean(row.evidence_detail) || null,
    confidence: clean(row.confidence),
    status: clean(row.status),
    reviewedBy: clean(row.reviewed_by) || null,
    reviewedAt: row.reviewed_at || null,
    appliedAt: row.applied_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function normalizeOriginalInteger(value) {
  if (value === null || value === undefined) return null;

  const text = clean(value).toLowerCase();

  if (!text || text === "null") return null;

  const number = Number(text);

  if (!Number.isInteger(number)) return NaN;

  return number;
}

function nullableInteger(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  return Number.isInteger(number) ? number : null;
}

function originalMatchesCurrent(expectedOriginal, currentValue) {
  if (Number.isNaN(expectedOriginal)) return false;

  if (expectedOriginal === null) {
    return currentValue === null || currentValue === 0;
  }

  return currentValue === expectedOriginal;
}

function positiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0
    ? number
    : null;
}

function batchMeta(result) {
  const meta = result?.meta || {};

  return {
    changes: Number(meta.changes || 0),
    duration: Number(meta.duration || 0)
  };
}
