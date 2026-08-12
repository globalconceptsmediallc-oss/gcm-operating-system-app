/* =========================================================
   Global Concepts Media Operating System
   File: routes/investigationProcessing.js
   Version: 7.4.0
   Status: Production Candidate
   Source: Production routes/investigationProcessing.js 7.3.0
   Sprint: Durable Investigation Progress
   Purpose: Process an existing Investigation after review by
            either closing it when no Work Item is required or
            creating one linked Work Item when specific work is
            required, saving evidence-supported progress while the
            Investigation remains open, or creating one linked Work
            Item when specific work is required. Specific-work
            Investigations remain open until linked work is completed.

   Changes in 7.4.0:
   - Adds the continue_investigation outcome.
   - Updates the current finding without closing the Investigation.
   - Appends a dated investigation_progress Evidence record containing
     What We Know, Next Question, and Next Evidence.
   - Links every progress record to Client, Communication, and Investigation.
   - Prevents duplicate progress records from repeated identical saves.
   - Preserves both final outcomes and Work Item creation unchanged.
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
   Investigation Processing — Existing Investigation Update
   ========================================================= */

export async function handleProcessInvestigation(body, env, requestId) {
  const db = getDatabase(env);

  const clientCode = clean(body?.clientCode || body?.client);
  const investigationId = Number(body?.investigationId || body?.investigation_id);
  const findingSummary = cleanMultiline(
    body?.findingSummary || body?.finding_summary
  );
  const outcome = clean(body?.outcome).toLowerCase();

  const nextQuestion = cleanMultiline(
    body?.nextQuestion ||
    body?.next_question ||
    body?.workTitle ||
    body?.work_title
  );

  const nextEvidence = cleanMultiline(
    body?.nextEvidence ||
    body?.next_evidence ||
    body?.workDescription ||
    body?.work_description
  );

  const workTitle = clean(
    body?.workTitle ||
    body?.work_title ||
    body?.workRequired ||
    body?.work_required
  );

  const workDescription = clean(
    body?.workDescription ||
    body?.work_description ||
    body?.specificAction ||
    body?.specific_action
  );

  const workCategory = clean(
    body?.workCategory ||
    body?.work_category ||
    "Investigation"
  );

  const expectedImpact = clean(
    body?.expectedImpact ||
    body?.expected_impact
  );

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error:
        "The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."
    }, 503);
  }

  if (!clientCode) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error: "A clientCode is required."
    }, 400);
  }

  if (!Number.isInteger(investigationId) || investigationId <= 0) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error: "A valid investigationId is required."
    }, 400);
  }

  if (!findingSummary) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error: "A findingSummary is required before an Investigation can be processed."
    }, 400);
  }

  if (![
    "continue_investigation",
    "no_work_required",
    "specific_work_required"
  ].includes(outcome)) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error:
        'Investigation Processing supports outcomes "continue_investigation", "no_work_required", and "specific_work_required".'
    }, 400);
  }

  if (outcome === "continue_investigation" && !nextQuestion) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error: "A nextQuestion is required when an Investigation remains open."
    }, 400);
  }

  if (outcome === "continue_investigation" && !nextEvidence) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error: "A nextEvidence value is required when an Investigation remains open."
    }, 400);
  }

  if (outcome === "specific_work_required" && !workTitle) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error: "A workTitle is required when specific work is required."
    }, 400);
  }

  if (outcome === "specific_work_required" && !workDescription) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error: "A workDescription is required when specific work is required."
    }, 400);
  }

  try {
    const investigation = await db.prepare(`
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
        c.client_code,
        c.name AS client_name
      FROM investigations i
      JOIN clients c ON c.id = i.client_id
      WHERE i.id = ?
        AND c.client_code = ? COLLATE NOCASE
      LIMIT 1
    `).bind(
      investigationId,
      clientCode
    ).first();

    if (!investigation) {
      return jsonResponse({
        ok: false,
        requestId,
        action: ACTIONS.PROCESS_INVESTIGATION,
        error:
          `Investigation #${investigationId} was not found for client "${clientCode}".`
      }, 404);
    }

    if (isClosedStatus(investigation.status)) {
      return jsonResponse({
        ok: true,
        requestId,
        action: ACTIONS.PROCESS_INVESTIGATION,
        version: VERSION,
        source: "D1",
        updated: false,
        alreadyClosed: true,
        investigation: {
          id: investigation.id,
          clientCode: investigation.client_code,
          clientName: investigation.client_name,
          communicationId: investigation.communication_id,
          title: investigation.title,
          status: investigation.status,
          findingSummary: investigation.finding_summary
        },
        message: "This Investigation is already closed. No duplicate update was made."
      });
    }

    if (outcome === "continue_investigation") {
      return await saveInvestigationProgress({
        db,
        requestId,
        investigation,
        findingSummary,
        nextQuestion,
        nextEvidence
      });
    }

    if (outcome === "no_work_required") {
      return await closeInvestigationWithoutWork({
        db,
        requestId,
        investigation,
        findingSummary
      });
    }

    return await createSpecificWorkItem({
      db,
      requestId,
      investigation,
      findingSummary,
      workTitle,
      workDescription,
      workCategory,
      expectedImpact
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.PROCESS_INVESTIGATION,
      stage: "d1_investigation_processing",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      error: safeErrorMessage(error)
    }, 500);
  }
}

/* =========================================================
   Outcome: Continue Investigation
   ========================================================= */

async function saveInvestigationProgress({
  db,
  requestId,
  investigation,
  findingSummary,
  nextQuestion,
  nextEvidence
}) {
  const recordedBy =
    clean(investigation.assigned_to) ||
    "Global Concepts Media";

  const description = [
    `What We Know: ${findingSummary}`,
    `Next Question: ${nextQuestion}`,
    `Next Evidence: ${nextEvidence}`
  ].join("\n\n");

  const rawData = JSON.stringify({
    schemaVersion: "1.0.0",
    recordType: "investigation_progress",
    progressStatus: "investigation_open",
    findingSummary,
    nextQuestion,
    nextEvidence,
    recordedBy
  });

  await db.batch([
    db.prepare(`
      UPDATE investigations
      SET
        finding_summary = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND client_id = ?
    `).bind(
      findingSummary,
      investigation.id,
      investigation.client_id
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
        raw_data,
        captured_at
      )
      SELECT ?, ?, NULL, ?, 'investigation_progress',
             'Investigation Progress', ?, NULL, ?, CURRENT_TIMESTAMP
      WHERE NOT EXISTS (
        SELECT 1
        FROM evidence
        WHERE investigation_id = ?
          AND evidence_type = 'investigation_progress'
          AND description = ?
      )
    `).bind(
      investigation.client_id,
      investigation.id,
      investigation.communication_id,
      description,
      rawData,
      investigation.id,
      description
    )
  ]);

  const [updated, progress] = await Promise.all([
    loadInvestigation(db, investigation.id),
    loadLatestInvestigationProgress(db, investigation.id)
  ]);

  if (!updated) {
    throw new Error(
      `D1 saved the progress update but Investigation #${investigation.id} could not be reloaded.`
    );
  }

  return jsonResponse({
    ok: true,
    requestId,
    action: ACTIONS.PROCESS_INVESTIGATION,
    version: VERSION,
    source: "D1",
    updated: true,
    outcome: "continue_investigation",
    investigationKeptOpen: true,
    workItemCreated: false,
    investigation: mapInvestigation(updated),
    progress: mapInvestigationProgress(progress)
  });
}

/* =========================================================
   Outcome: No Work Required
   ========================================================= */

async function closeInvestigationWithoutWork({
  db,
  requestId,
  investigation,
  findingSummary
}) {
  await db.prepare(`
    UPDATE investigations
    SET
      finding_summary = ?,
      status = 'closed',
      closed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND client_id = ?
  `).bind(
    findingSummary,
    investigation.id,
    investigation.client_id
  ).run();

  const updated = await loadInvestigation(db, investigation.id);

  if (!updated) {
    throw new Error(
      `D1 completed the update but Investigation #${investigation.id} could not be reloaded.`
    );
  }

  return jsonResponse({
    ok: true,
    requestId,
    action: ACTIONS.PROCESS_INVESTIGATION,
    version: VERSION,
    source: "D1",
    updated: true,
    outcome: "no_work_required",
    workItemCreated: false,
    investigation: mapInvestigation(updated)
  });
}

/* =========================================================
   Outcome: Specific Work Required
   ========================================================= */

async function createSpecificWorkItem({
  db,
  requestId,
  investigation,
  findingSummary,
  workTitle,
  workDescription,
  workCategory,
  expectedImpact
}) {
  /*
   * Duplicate protection:
   * one Investigation should not create multiple Work Items from
   * repeated clicks or retries during this road-tested workflow.
   */
  const existingWorkItem = await db.prepare(`
    SELECT
      id,
      client_id,
      investigation_id,
      communication_id,
      title,
      description,
      category,
      priority,
      status,
      owner,
      expected_impact,
      actual_impact,
      created_at,
      updated_at,
      completed_at
    FROM work_items
    WHERE investigation_id = ?
    ORDER BY id ASC
    LIMIT 1
  `).bind(
    investigation.id
  ).first();

  if (existingWorkItem) {
    await db.prepare(`
      UPDATE investigations
      SET
        finding_summary = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND client_id = ?
    `).bind(
      findingSummary,
      investigation.id,
      investigation.client_id
    ).run();

    const updatedInvestigation = await loadInvestigation(db, investigation.id);

    return jsonResponse({
      ok: true,
      requestId,
      action: ACTIONS.PROCESS_INVESTIGATION,
      version: VERSION,
      source: "D1",
      updated: true,
      outcome: "specific_work_required",
      workItemCreated: false,
      duplicatePrevented: true,
      investigation: mapInvestigation(updatedInvestigation || investigation),
      workItem: mapWorkItem(existingWorkItem),
      message:
        `Investigation #${investigation.id} already has linked Work Item #${existingWorkItem.id}. No duplicate Work Item was created.`
    });
  }

  const workPriority = clean(investigation.priority) || "normal";
  const workOwner = clean(investigation.assigned_to) || "Andrew";
  const workExpectedImpact =
    expectedImpact ||
    clean(investigation.recommendation) ||
    findingSummary;

  const statements = [
    db.prepare(`
      UPDATE investigations
      SET
        finding_summary = ?,
        recommendation = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND client_id = ?
    `).bind(
      findingSummary,
      workDescription,
      investigation.id,
      investigation.client_id
    ),

    db.prepare(`
      INSERT INTO work_items (
        client_id,
        investigation_id,
        communication_id,
        title,
        description,
        category,
        priority,
        status,
        owner,
        expected_impact
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
    `).bind(
      investigation.client_id,
      investigation.id,
      investigation.communication_id,
      workTitle,
      workDescription,
      workCategory,
      workPriority,
      workOwner,
      workExpectedImpact
    )
  ];

  await db.batch(statements);

  const createdWorkItem = await db.prepare(`
    SELECT
      id,
      client_id,
      investigation_id,
      communication_id,
      title,
      description,
      category,
      priority,
      status,
      owner,
      expected_impact,
      actual_impact,
      created_at,
      updated_at,
      completed_at
    FROM work_items
    WHERE investigation_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).bind(
    investigation.id
  ).first();

  if (!createdWorkItem) {
    throw new Error(
      `D1 completed the insert but the Work Item for Investigation #${investigation.id} could not be reloaded.`
    );
  }

  const updatedInvestigation = await loadInvestigation(db, investigation.id);

  if (!updatedInvestigation) {
    throw new Error(
      `D1 created Work Item #${createdWorkItem.id} but Investigation #${investigation.id} could not be reloaded.`
    );
  }

  return jsonResponse({
    ok: true,
    requestId,
    action: ACTIONS.PROCESS_INVESTIGATION,
    version: VERSION,
    source: "D1",
    updated: true,
    outcome: "specific_work_required",
    workItemCreated: true,
    investigation: mapInvestigation(updatedInvestigation),
    workItem: mapWorkItem(createdWorkItem)
  });
}

/* =========================================================
   Route-Specific Loaders
   ========================================================= */

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

async function loadLatestInvestigationProgress(db, investigationId) {
  return await db.prepare(`
    SELECT
      id,
      client_id,
      investigation_id,
      communication_id,
      evidence_type,
      source,
      description,
      raw_data,
      captured_at,
      created_at
    FROM evidence
    WHERE investigation_id = ?
      AND evidence_type = 'investigation_progress'
    ORDER BY captured_at DESC, id DESC
    LIMIT 1
  `).bind(
    investigationId
  ).first();
}

/* =========================================================
   Route-Specific Mappers
   ========================================================= */

function mapInvestigation(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
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

function mapWorkItem(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    clientId: row.client_id,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  };
}

function mapInvestigationProgress(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    clientId: row.client_id,
    investigationId: row.investigation_id,
    communicationId: row.communication_id,
    evidenceType: row.evidence_type,
    source: row.source,
    description: row.description,
    rawData: row.raw_data,
    capturedAt: row.captured_at,
    createdAt: row.created_at
  };
}

/* =========================================================
   Route-Specific Helpers
   ========================================================= */

function isClosedStatus(value) {
  const status = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  return [
    "complete",
    "completed",
    "closed",
    "resolved",
    "cancelled",
    "canceled",
    "archived",
    "ignored",
    "no_action"
  ].includes(status);
}

function cleanMultiline(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
