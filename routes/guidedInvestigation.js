/* =========================================================
   Global Concepts Media Operating System
   File: routes/guidedInvestigation.js
   Version: 7.6.1
   Status: Production Candidate
   Source: Production Worker 7.5.0
   Sprint: Guided Investigation Engine — Phase 1
   Purpose: Read one Investigation and originating Communication,
            then return one evidence-first Current Next Step.

   IMPORTANT:
   - Read-only route.
   - Does not alter D1.
   - Does not create or close records.
   ========================================================= */

import {
  VERSION,
  ACTIONS,
  COMMUNICATION_REASONING_MODEL
} from "../shared/config.js";

import {
  clean,
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "../shared/http.js";

import { getDatabase } from "../shared/database.js";
import { runAiJsonWithRetry } from "../shared/ai.js";

export async function handleGuidedInvestigation(body, env, requestId) {
  const db = getDatabase(env);
  const clientCode = clean(body?.clientCode || body?.client);
  const investigationId = Number(body?.investigationId || body?.investigation_id);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_GUIDED_INVESTIGATION,
      error: "The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."
    }, 503);
  }

  if (!clientCode) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_GUIDED_INVESTIGATION,
      error: "A clientCode is required."
    }, 400);
  }

  if (!Number.isInteger(investigationId) || investigationId <= 0) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_GUIDED_INVESTIGATION,
      error: "A valid investigationId is required."
    }, 400);
  }

  try {
    const record = await db.prepare(`
      SELECT
        i.id AS investigation_id,
        i.client_id,
        i.communication_id,
        i.title AS investigation_title,
        i.description AS investigation_description,
        i.priority,
        i.status AS investigation_status,
        i.assigned_to,
        i.finding_summary,
        i.recommendation,
        i.opened_at,
        c.client_code,
        c.name AS client_name,
        cm.source AS communication_source,
        cm.category AS communication_category,
        cm.subject AS communication_subject,
        cm.raw_content AS communication_raw_content,
        cm.ai_summary AS communication_ai_summary,
        cm.operational_decision,
        cm.notes AS communication_notes,
        cm.occurred_at AS communication_occurred_at,
        cm.created_at AS communication_created_at
      FROM investigations i
      JOIN clients c ON c.id = i.client_id
      LEFT JOIN communications cm ON cm.id = i.communication_id
      WHERE i.id = ?
        AND c.client_code = ? COLLATE NOCASE
      LIMIT 1
    `).bind(investigationId, clientCode).first();

    if (!record) {
      return jsonResponse({
        ok: false,
        requestId,
        action: ACTIONS.GET_GUIDED_INVESTIGATION,
        error: `Investigation #${investigationId} was not found for client "${clientCode}".`
      }, 404);
    }

    const fallback = buildDeterministicGuidance(record);

    if (!env?.AI || typeof env.AI.run !== "function") {
      return successResponse({
        requestId,
        record,
        guidance: fallback,
        engine: "deterministic-fallback",
        warning: "Workers AI binding was unavailable."
      });
    }

    const aiResult = await runAiJsonWithRetry({
      env,
      model: COMMUNICATION_REASONING_MODEL,
      input: {
        messages: [
          {
            role: "system",
            content: [
              "You are the Guided Investigation Engine for Global Concepts Media.",
              "Guide the operator through exactly one evidence-first investigation step.",
              "Never invent facts, URLs, counts, causes, impact, or completed work.",
              "Do not create a Work Item merely because a notification exists.",
              "Do not write a final finding without sufficient verified evidence.",
              "Return JSON only."
            ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Produce the current guided state for this Investigation.",
              requiredOutput: {
                current_objective: "string",
                current_understanding: "string",
                current_unknowns: ["string"],
                current_next_step: "string",
                expected_evidence: "string",
                confidence: "integer from 0 to 100",
                ready_for_resolution: "boolean",
                resolution_reason: "string"
              },
              rules: [
                "Use only the supplied D1 record.",
                "Separate known evidence from assumptions.",
                "Identify what still blocks a finding.",
                "Provide one practical action, not a multi-stage project.",
                "Set ready_for_resolution false unless evidence already supports a defensible finding."
              ],
              d1Record: mapSourceRecord(record)
            })
          }
        ],
        max_tokens: 900,
        temperature: 0.1
      },
      stageName: "guided_investigation",
      requestId,
      route: ACTIONS.GET_GUIDED_INVESTIGATION,
      timeoutMs: 30000,
      maxRetries: 1
    });

    if (!aiResult.ok) {
      return successResponse({
        requestId,
        record,
        guidance: fallback,
        engine: "deterministic-fallback",
        warning: aiResult?.error?.message || "Guided Investigation AI did not return usable JSON."
      });
    }

    return successResponse({
      requestId,
      record,
      guidance: normalizeGuidance(aiResult.data, fallback),
      engine: COMMUNICATION_REASONING_MODEL,
      retryCount: aiResult.retryCount,
      retryStatus: aiResult.retryStatus
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.GET_GUIDED_INVESTIGATION,
      stage: "guided_investigation",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_GUIDED_INVESTIGATION,
      error: safeErrorMessage(error)
    }, 500);
  }
}

function successResponse({
  requestId,
  record,
  guidance,
  engine,
  warning = null,
  retryCount = 0,
  retryStatus = "not_required"
}) {
  return jsonResponse({
    ok: true,
    requestId,
    action: ACTIONS.GET_GUIDED_INVESTIGATION,
    version: VERSION,
    source: "D1",
    readOnly: true,
    generatedAt: new Date().toISOString(),
    engine,
    warning,
    retryCount,
    retryStatus,
    investigation: {
      id: record.investigation_id,
      clientCode: record.client_code,
      clientName: record.client_name,
      communicationId: record.communication_id,
      title: record.investigation_title,
      status: record.investigation_status,
      priority: record.priority
    },
    guidance
  });
}

function mapSourceRecord(record) {
  return {
    investigation: {
      id: record.investigation_id,
      title: clean(record.investigation_title),
      description: clean(record.investigation_description),
      priority: clean(record.priority),
      status: clean(record.investigation_status),
      assignedTo: clean(record.assigned_to),
      existingFinding: clean(record.finding_summary),
      existingRecommendation: clean(record.recommendation),
      openedAt: record.opened_at || null
    },
    client: {
      code: clean(record.client_code),
      name: clean(record.client_name)
    },
    originatingCommunication: {
      id: record.communication_id || null,
      source: clean(record.communication_source),
      category: clean(record.communication_category),
      subject: clean(record.communication_subject),
      rawContent: clean(record.communication_raw_content),
      aiSummary: clean(record.communication_ai_summary),
      operationalDecision: clean(record.operational_decision),
      notes: clean(record.communication_notes),
      occurredAt: record.communication_occurred_at || record.communication_created_at || null
    }
  };
}

function normalizeGuidance(value, fallback) {
  const source = value && typeof value === "object" ? value : {};
  const unknowns = normalizeStringArray(source.current_unknowns);

  return {
    current_objective: clean(source.current_objective) || fallback.current_objective,
    current_understanding: clean(source.current_understanding) || fallback.current_understanding,
    current_unknowns: unknowns.length ? unknowns : fallback.current_unknowns,
    current_next_step: clean(source.current_next_step) || fallback.current_next_step,
    expected_evidence: clean(source.expected_evidence) || fallback.expected_evidence,
    confidence: clampInteger(source.confidence, fallback.confidence),
    ready_for_resolution: source.ready_for_resolution === true,
    resolution_reason: clean(source.resolution_reason) || fallback.resolution_reason
  };
}

function buildDeterministicGuidance(record) {
  const title = clean(record.investigation_title);
  const description = clean(record.investigation_description);
  const summary =
    clean(record.communication_ai_summary) ||
    clean(record.communication_raw_content) ||
    description ||
    "The originating communication reported a condition requiring review.";

  const recommendation = clean(record.recommendation);
  const combined = [
    title,
    description,
    record.communication_subject,
    record.communication_category,
    summary,
    recommendation
  ].filter(Boolean).join(" ").toLowerCase();

  let currentNextStep =
    recommendation ||
    "Open the source platform named in the originating communication and capture the report showing the exact condition and scope.";

  let expectedEvidence =
    "A screenshot or export showing the exact condition, affected items, scope, and source-platform details.";

  if (combined.includes("redirect")) {
    currentNextStep =
      "Open Google Search Console, open the Redirect error report, and capture the affected URL list and error details.";
    expectedEvidence =
      "A screenshot or exported list showing affected URLs, redirect details, and whether the redirects appear intentional.";
  } else if (combined.includes("backlink")) {
    currentNextStep =
      "Open the backlink report and capture the exact referring domains, affected target pages, and available toxicity or authority details.";
    expectedEvidence =
      "A screenshot or export showing the exact backlink domains, target URLs, and risk signals.";
  } else if (combined.includes("site audit") || combined.includes("site_audit")) {
    currentNextStep =
      "Open the site-audit issue and capture the affected URLs, issue count, and the platform's technical explanation.";
    expectedEvidence =
      "A screenshot showing the issue name, affected URL list, issue count, and technical details.";
  } else if (
    combined.includes("merchant") ||
    combined.includes("structured data") ||
    combined.includes("structured_data")
  ) {
    currentNextStep =
      "Open the Merchant Listings or structured-data report and capture the affected items, example URLs, and exact error details.";
    expectedEvidence =
      "A screenshot showing affected items, example URLs, and the precise validation error.";
  } else if (
    combined.includes("position tracking") ||
    combined.includes("position_tracking") ||
    combined.includes("ranking")
  ) {
    currentNextStep =
      "Open the ranking report and capture affected keywords, previous and current positions, landing pages, and reporting date range.";
    expectedEvidence =
      "A screenshot or export showing keyword, position change, landing page, search volume when available, and date range.";
  }

  return {
    current_objective:
      description || `Determine whether ${title || "the reported condition"} requires corrective work.`,
    current_understanding: summary,
    current_unknowns: [
      "The exact scope of the reported condition.",
      "The affected URLs, items, keywords, domains, or records.",
      "Whether the condition is expected or requires correction.",
      "The verified business impact."
    ],
    current_next_step: currentNextStep,
    expected_evidence: expectedEvidence,
    confidence: clean(record.finding_summary) ? 70 : 45,
    ready_for_resolution: false,
    resolution_reason: clean(record.finding_summary)
      ? "An existing finding is present, but the operator should verify that the evidence supports closure or specific work."
      : "The originating communication reports a condition, but the scope, cause, and required corrective work are not yet verified."
  };
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(clean).filter(Boolean).slice(0, 8);
  }

  const text = clean(value);
  if (!text) return [];

  return text
    .split(/\n|;|\u2022/)
    .map((item) => clean(item.replace(/^[-*\d.)\s]+/, "")))
    .filter(Boolean)
    .slice(0, 8);
}

function clampInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}
