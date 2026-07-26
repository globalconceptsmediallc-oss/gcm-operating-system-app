/* =========================================================
   Global Concepts Media Operating System
   File: routes/workItemProcessing.js
   Version: 7.3.2
   Status: Production Candidate
   Source: Production Worker 7.3.0
   Sprint: Work Item Completion — Road Test #21
   Purpose: Complete an existing linked Work Item by recording
            work performed, result, completion evidence, and
            completion timestamps, then close the linked
            Investigation. Removes unsupported scheduling fields
            from the production Work Item query. Completed Work
            Items flow into the
            existing proof_of_work D1 view automatically.
   ========================================================= */

import {
  VERSION,
  ACTIONS
} from "../shared/config.js";

import {
  clean,
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "../shared/http.js";

import {
  getDatabase
} from "../shared/database.js";

/* =========================================================
   Work Item Processing — Complete Existing Work
   ========================================================= */

export async function handleProcessWorkItem(body, env, requestId) {
  const db = getDatabase(env);

  const clientCode = clean(body?.clientCode || body?.client);
  const workItemId = Number(body?.workItemId || body?.work_item_id);
  const workPerformed = clean(body?.workPerformed || body?.work_performed);
  const actualImpact = clean(
    body?.actualImpact ||
    body?.actual_impact ||
    body?.result
  );
  const evidenceDescription = clean(
    body?.evidenceDescription ||
    body?.evidence_description ||
    body?.evidence
  );
  const evidenceSource = clean(
    body?.evidenceSource ||
    body?.evidence_source ||
    "Completion Evidence"
  );
  const evidenceType = clean(
    body?.evidenceType ||
    body?.evidence_type ||
    "completion"
  );
  const evidenceUrl = clean(
    body?.evidenceUrl ||
    body?.evidence_url
  );
  const minutesSpent = normalizeMinutes(
    body?.minutesSpent ??
    body?.minutes_spent ??
    0
  );

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_WORK_ITEM,
      error:
        "The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."
    }, 503);
  }

  if (!clientCode) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_WORK_ITEM,
      error: "A clientCode is required."
    }, 400);
  }

  if (!Number.isInteger(workItemId) || workItemId <= 0) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_WORK_ITEM,
      error: "A valid workItemId is required."
    }, 400);
  }

  if (!workPerformed) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_WORK_ITEM,
      error: "A workPerformed value is required before a Work Item can be completed."
    }, 400);
  }

  if (!actualImpact) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_WORK_ITEM,
      error: "An actualImpact/result value is required before a Work Item can be completed."
    }, 400);
  }

  if (!evidenceDescription) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_WORK_ITEM,
      error: "Completion evidence is required before a Work Item can be completed."
    }, 400);
  }

  try {
    const workItem = await db.prepare(`
      SELECT
        wi.id,
        wi.client_id,
        wi.investigation_id,
        wi.communication_id,
        wi.title,
        wi.description,
        wi.category,
        wi.priority,
        wi.status,
        wi.owner,
        wi.expected_impact,
        wi.actual_impact,
        wi.started_at,
        wi.verified_at,
        wi.completed_at,
        wi.minutes_spent,
        wi.created_at,
        wi.updated_at,
        c.client_code,
        c.name AS client_name
      FROM work_items wi
      JOIN clients c ON c.id = wi.client_id
      WHERE wi.id = ?
        AND c.client_code = ? COLLATE NOCASE
      LIMIT 1
    `).bind(
      workItemId,
      clientCode
    ).first();

    if (!workItem) {
      return jsonResponse({
        ok: false,
        requestId,
        action: ACTIONS.PROCESS_WORK_ITEM,
        error:
          `Work Item #${workItemId} was not found for client "${clientCode}".`
      }, 404);
    }

    if (isCompletedStatus(workItem.status) && workItem.completed_at) {
      const existingEvidence = await loadWorkItemEvidence(db, workItem.id);

      return jsonResponse({
        ok: true,
        requestId,
        action: ACTIONS.PROCESS_WORK_ITEM,
        version: VERSION,
        source: "D1",
        updated: false,
        alreadyCompleted: true,
        workItem: mapWorkItem(workItem),
        evidence: existingEvidence.map(mapEvidence),
        message:
          `Work Item #${workItem.id} is already completed. No duplicate completion was recorded.`
      });
    }

    const completedDescription = appendWorkPerformed(
      workItem.description,
      workPerformed
    );

    const statements = [
      db.prepare(`
        UPDATE work_items
        SET
          description = ?,
          status = 'completed',
          actual_impact = ?,
          started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
          verified_at = CURRENT_TIMESTAMP,
          completed_at = CURRENT_TIMESTAMP,
          minutes_spent = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND client_id = ?
      `).bind(
        completedDescription,
        actualImpact,
        minutesSpent,
        workItem.id,
        workItem.client_id
      ),

      db.prepare(`
        INSERT INTO evidence (
          client_id,
          investigation_id,
          work_item_id,
          communication_id,
          evidence_type,
          source,
          description,
          url,
          captured_at
        )
        SELECT
          ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
          SELECT 1
          FROM evidence
          WHERE work_item_id = ?
            AND source = ?
            AND description = ?
        )
      `).bind(
        workItem.client_id,
        workItem.investigation_id,
        workItem.id,
        workItem.communication_id,
        evidenceType,
        evidenceSource,
        evidenceDescription,
        evidenceUrl || null,
        workItem.id,
        evidenceSource,
        evidenceDescription
      )
    ];

    if (workItem.investigation_id) {
      statements.push(
        db.prepare(`
          UPDATE investigations
          SET
            status = 'closed',
            resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP),
            closed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND client_id = ?
        `).bind(
          workItem.investigation_id,
          workItem.client_id
        )
      );
    }

    await db.batch(statements);

    const [updatedWorkItem, updatedInvestigation, evidence] = await Promise.all([
      loadWorkItem(db, workItem.id),
      workItem.investigation_id
        ? loadInvestigation(db, workItem.investigation_id)
        : Promise.resolve(null),
      loadWorkItemEvidence(db, workItem.id)
    ]);

    if (!updatedWorkItem) {
      throw new Error(
        `D1 completed the Work Item update but Work Item #${workItem.id} could not be reloaded.`
      );
    }

    return jsonResponse({
      ok: true,
      requestId,
      action: ACTIONS.PROCESS_WORK_ITEM,
      version: VERSION,
      source: "D1",
      updated: true,
      outcome: "completed",
      proofOfWorkEligible:
        updatedWorkItem.status === "completed" &&
        Boolean(updatedWorkItem.completed_at),
      workItem: mapWorkItem(updatedWorkItem),
      investigation: updatedInvestigation
        ? mapInvestigation(updatedInvestigation)
        : null,
      evidence: evidence.map(mapEvidence)
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.PROCESS_WORK_ITEM,
      stage: "d1_work_item_processing",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_WORK_ITEM,
      error: safeErrorMessage(error)
    }, 500);
  }
}

/* =========================================================
   Route-Specific Loaders
   ========================================================= */

async function loadWorkItem(db, workItemId) {
  return await db.prepare(`
    SELECT
      wi.id,
      wi.client_id,
      wi.investigation_id,
      wi.communication_id,
      wi.title,
      wi.description,
      wi.category,
      wi.priority,
      wi.status,
      wi.owner,
      wi.expected_impact,
      wi.actual_impact,
      wi.started_at,
      wi.verified_at,
      wi.completed_at,
      wi.minutes_spent,
      wi.created_at,
      wi.updated_at,
      c.client_code,
      c.name AS client_name
    FROM work_items wi
    JOIN clients c ON c.id = wi.client_id
    WHERE wi.id = ?
    LIMIT 1
  `).bind(
    workItemId
  ).first();
}

async function loadInvestigation(db, investigationId) {
  return await db.prepare(`
    SELECT
      i.id,
      i.client_id,
      i.communication_id,
      i.title,
      i.description,
      i.priority,
      i.status,
      i.assigned_to,
      i.finding_summary,
      i.recommendation,
      i.opened_at,
      i.resolved_at,
      i.closed_at,
      i.created_at,
      i.updated_at,
      c.client_code,
      c.name AS client_name
    FROM investigations i
    JOIN clients c ON c.id = i.client_id
    WHERE i.id = ?
    LIMIT 1
  `).bind(
    investigationId
  ).first();
}

async function loadWorkItemEvidence(db, workItemId) {
  const result = await db.prepare(`
    SELECT
      id,
      client_id,
      investigation_id,
      work_item_id,
      communication_id,
      evidence_type,
      source,
      description,
      url,
      raw_data,
      captured_at,
      created_at
    FROM evidence
    WHERE work_item_id = ?
    ORDER BY captured_at DESC, id DESC
  `).bind(
    workItemId
  ).all();

  return Array.isArray(result?.results) ? result.results : [];
}

/* =========================================================
   Route-Specific Mappers
   ========================================================= */

function mapWorkItem(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    clientId: row.client_id,
    clientCode: row.client_code,
    clientName: row.client_name,
    investigationId: row.investigation_id,
    communicationId: row.communication_id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    owner: row.owner,
    expectedImpact: row.expected_impact,
    actualImpact: row.actual_impact,
    startedAt: row.started_at,
    verifiedAt: row.verified_at,
    completedAt: row.completed_at,
    minutesSpent: row.minutes_spent,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInvestigation(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    clientId: row.client_id,
    clientCode: row.client_code,
    clientName: row.client_name,
    communicationId: row.communication_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assigned_to,
    findingSummary: row.finding_summary,
    recommendation: row.recommendation,
    openedAt: row.opened_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEvidence(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    clientId: row.client_id,
    investigationId: row.investigation_id,
    workItemId: row.work_item_id,
    communicationId: row.communication_id,
    evidenceType: row.evidence_type,
    source: row.source,
    description: row.description,
    url: row.url,
    capturedAt: row.captured_at,
    createdAt: row.created_at
  };
}

/* =========================================================
   Route-Specific Helpers
   ========================================================= */

function appendWorkPerformed(existingDescription, workPerformed) {
  const existing = clean(existingDescription);

  if (!existing) {
    return `Work Performed: ${workPerformed}`;
  }

  if (existing.includes(`Work Performed: ${workPerformed}`)) {
    return existing;
  }

  return `${existing}\n\nWork Performed: ${workPerformed}`;
}

function normalizeMinutes(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed);
}

function isCompletedStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_") === "completed";
}
