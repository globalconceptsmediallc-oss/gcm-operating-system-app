/* =========================================================
   Global Concepts Media Operating System
   File: routes/operationalDecision.js
   Version: 7.0.0
   Source: Production Worker 6.3.7
   Purpose: Commit one reviewed operational decision to D1
            as a Communication and, when selected, an
            Investigation or Work Item.
   ========================================================= */

import {
  VERSION,
  ACTIONS
} from "../shared/config.js";

import {
  clean,
  isPlainObject,
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "../shared/http.js";

import {
  getDatabase,
  firstResultId,
  createOperationalDecisionExternalId
} from "../shared/database.js";

/* =========================================================
   Operational Decision Commit — D1 Production Write
   ========================================================= */

export async function handleCommitOperationalDecision(body, env, requestId) {
  const db = getDatabase(env);
  const clientCode = clean(body?.clientCode || body?.client);
  const decision = normalizeOperationalDecisionPayload(
    body?.decision || body?.analysis || body?.operationalDecision
  );

  if (!db || typeof db.prepare !== "function" || typeof db.batch !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.COMMIT_OPERATIONAL_DECISION,
      error: "The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."
    }, 503);
  }

  if (!clientCode) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.COMMIT_OPERATIONAL_DECISION,
      error: "A clientCode is required."
    }, 400);
  }

  if (!decision.title || !decision.operationalSummary) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.COMMIT_OPERATIONAL_DECISION,
      error: "The reviewed decision must include a title and operationalSummary."
    }, 400);
  }

  if (!decision.recommendedRoutes.saveCommunication) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.COMMIT_OPERATIONAL_DECISION,
      error: "Save Communication must be selected before operational records can be committed."
    }, 400);
  }

  try {
    const client = await db.prepare(`
      SELECT id, client_code, name
      FROM clients
      WHERE client_code = ? COLLATE NOCASE
      LIMIT 1
    `).bind(clientCode).first();

    if (!client) {
      return jsonResponse({
        ok: false,
        requestId,
        action: ACTIONS.COMMIT_OPERATIONAL_DECISION,
        error: `Client "${clientCode}" was not found.`
      }, 404);
    }

    const occurredAt = normalizeIsoDate(body?.occurredAt || body?.occurred_at);
    const owner = clean(body?.owner || "Andrew");
    const direction = normalizeCommunicationDirection(body?.direction);
    const externalId = clean(body?.externalId) || await createOperationalDecisionExternalId({
      clientId: client.id,
      occurredAt,
      decision
    });

    const existing = await db.prepare(`
      SELECT id, status
      FROM communications
      WHERE source = ? AND external_id = ?
      LIMIT 1
    `).bind(decision.source, externalId).first();

    if (existing) {
      return jsonResponse({
        ok: true,
        requestId,
        action: ACTIONS.COMMIT_OPERATIONAL_DECISION,
        version: VERSION,
        duplicate: true,
        committed: false,
        communicationId: existing.id,
        investigationId: null,
        workItemId: null,
        message: "This operational decision was already saved. No duplicate records were created."
      });
    }

    const routes = decision.recommendedRoutes;
    const communicationStatus = routes.createWorkItem
      ? "work_item_open"
      : routes.createInvestigation
        ? "investigation_open"
        : "analyzed";
    const operationalDecision = routes.createWorkItem
      ? "work_required"
      : routes.createInvestigation
        ? "investigation"
        : "information";
    const priority = importanceToPriority(decision.importance);
    const rawContent = clean(body?.rawContent || body?.raw_content) || decision.operationalSummary;
    const analysisJson = JSON.stringify(decision);
    const statements = [];

    statements.push(db.prepare(`
      INSERT INTO communications (
        client_id, external_id, occurred_at, direction, source, category,
        subject, raw_content, ai_summary, ai_analysis_json,
        operational_decision, status, requires_investigation,
        owner, minutes_spent, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).bind(
      client.id,
      externalId,
      occurredAt,
      direction,
      decision.source,
      decision.communicationType,
      decision.title,
      rawContent,
      decision.operationalSummary,
      analysisJson,
      operationalDecision,
      communicationStatus,
      routes.createInvestigation ? 1 : 0,
      owner,
      buildCommunicationNotes(decision)
    ));

    statements.push(db.prepare(`
      SELECT id
      FROM communications
      WHERE source = ? AND external_id = ?
      LIMIT 1
    `).bind(decision.source, externalId));

    let investigationSelectIndex = null;
    let workItemSelectIndex = null;

    if (routes.createInvestigation) {
      statements.push(db.prepare(`
        INSERT INTO investigations (
          client_id, communication_id, title, description,
          priority, status, assigned_to, recommendation
        )
        SELECT client_id, id, ?, ?, ?, 'open', ?, ?
        FROM communications
        WHERE source = ? AND external_id = ?
      `).bind(
        decision.title,
        decision.operationalSummary,
        priority,
        owner,
        decision.recommendedAction,
        decision.source,
        externalId
      ));

      investigationSelectIndex = statements.length;
      statements.push(db.prepare(`
        SELECT i.id
        FROM investigations i
        JOIN communications c ON c.id = i.communication_id
        WHERE c.source = ? AND c.external_id = ?
        ORDER BY i.id DESC
        LIMIT 1
      `).bind(decision.source, externalId));
    }

    if (routes.createWorkItem) {
      statements.push(db.prepare(`
        INSERT INTO work_items (
          client_id, investigation_id, communication_id,
          title, description, category, priority, status,
          owner, expected_impact
        )
        SELECT
          c.client_id,
          (
            SELECT i.id
            FROM investigations i
            WHERE i.communication_id = c.id
            ORDER BY i.id DESC
            LIMIT 1
          ),
          c.id, ?, ?, ?, ?, 'open', ?, ?
        FROM communications c
        WHERE c.source = ? AND c.external_id = ?
      `).bind(
        decision.recommendedAction || decision.title,
        decision.reasoning || decision.operationalSummary,
        decision.communicationType,
        priority,
        owner,
        decision.businessImpact,
        decision.source,
        externalId
      ));

      workItemSelectIndex = statements.length;
      statements.push(db.prepare(`
        SELECT wi.id
        FROM work_items wi
        JOIN communications c ON c.id = wi.communication_id
        WHERE c.source = ? AND c.external_id = ?
        ORDER BY wi.id DESC
        LIMIT 1
      `).bind(decision.source, externalId));
    }

    const results = await db.batch(statements);
    const communicationId = firstResultId(results[1]);
    const investigationId = investigationSelectIndex === null
      ? null
      : firstResultId(results[investigationSelectIndex]);
    const workItemId = workItemSelectIndex === null
      ? null
      : firstResultId(results[workItemSelectIndex]);

    if (!communicationId) throw new Error("D1 completed the batch but did not return the new Communication ID.");
    if (routes.createInvestigation && !investigationId) throw new Error("D1 did not return the requested Investigation ID.");
    if (routes.createWorkItem && !workItemId) throw new Error("D1 did not return the requested Work Item ID.");

    return jsonResponse({
      ok: true,
      requestId,
      action: ACTIONS.COMMIT_OPERATIONAL_DECISION,
      version: VERSION,
      source: "D1",
      duplicate: false,
      committed: true,
      client: {
        id: client.id,
        clientCode: client.client_code,
        name: client.name
      },
      communicationId,
      investigationId,
      workItemId,
      created: {
        communication: true,
        investigation: Boolean(investigationId),
        workItem: Boolean(workItemId)
      }
    });
  } catch (error) {
    logWorkerError({ requestId, route: ACTIONS.COMMIT_OPERATIONAL_DECISION, stage: "d1_commit", error });
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.COMMIT_OPERATIONAL_DECISION,
      error: safeErrorMessage(error)
    }, 500);
  }
}

/* =========================================================
   Route-Specific Production Helpers
   ========================================================= */

function normalizeOperationalDecisionPayload(value) {
  const decision = isPlainObject(value) ? value : {};
  return {
    source: clean(decision.source) || "Unknown",
    communicationType: clean(decision.communicationType || decision.category) || "General Communication",
    title: clean(decision.title || decision.subject),
    operationalSummary: clean(decision.operationalSummary || decision.summary),
    businessImpact: clean(decision.businessImpact),
    importance: normalizeCommunicationImportance(decision.importance || decision.operationalPriority),
    operationalPriority: normalizeCommunicationImportance(decision.operationalPriority || decision.importance),
    operationalLabel: clean(decision.operationalLabel),
    recordPurpose: clean(decision.recordPurpose),
    recommendedRoutes: normalizeRecommendedRoutes(decision.recommendedRoutes || decision.routes),
    recommendedAction: clean(decision.recommendedAction),
    reasoning: clean(decision.reasoning),
    proposedRoute: clean(decision.proposedRoute),
    classification: isPlainObject(decision.classification) ? decision.classification : null
  };
}

function buildCommunicationNotes(decision) {
  return [
    decision.recordPurpose ? `Record purpose: ${decision.recordPurpose}` : "",
    decision.operationalLabel ? `Operational label: ${decision.operationalLabel}` : "",
    decision.businessImpact ? `Business impact: ${decision.businessImpact}` : "",
    decision.recommendedAction ? `Recommended action: ${decision.recommendedAction}` : "",
    decision.reasoning ? `Decision reasoning: ${decision.reasoning}` : "",
    decision.recommendedRoutes.replyRequired ? "Reply required: Yes" : "Reply required: No"
  ].filter(Boolean).join("\n");
}

function normalizeRecommendedRoutes(value) {
  const routes = isPlainObject(value) ? value : {};
  return {
    saveCommunication: normalizeBoolean(routes.saveCommunication, true),
    createInvestigation: normalizeBoolean(routes.createInvestigation, false),
    createWorkItem: normalizeBoolean(routes.createWorkItem, false),
    replyRequired: normalizeBoolean(routes.replyRequired, false)
  };
}

function normalizeBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return fallback;
}

function normalizeCommunicationImportance(value) {
  const allowed = {
    informational: "Informational",
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical"
  };
  return allowed[clean(value).toLowerCase()] || "Medium";
}

function importanceToPriority(value) {
  const priorities = {
    informational: "low",
    low: "low",
    medium: "normal",
    high: "high",
    critical: "urgent"
  };
  return priorities[String(value || "").trim().toLowerCase()] || "normal";
}

function normalizeCommunicationDirection(value) {
  const normalized = String(value || "incoming").trim().toLowerCase();
  return ["incoming", "outgoing", "internal"].includes(normalized) ? normalized : "incoming";
}

function normalizeIsoDate(value) {
  const raw = clean(value);
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}
