/* =========================================================
   Global Concepts Media Operating System
   File: routes/guidedInvestigation.js
   Version: 7.7.0
   Status: Production Road-Test Candidate
   Source: Production routes/guidedInvestigation.js 7.6.1
   Sprint: WWPOWD Consultant Loop — D1 Context First
   Purpose: Read one Investigation together with its existing D1
            evidence, related work, prior client investigations,
            proof/activity history, and baseline records before
            deciding whether another evidence step is necessary.

   PRODUCTION RULES
   - Read-only route.
   - Creates, changes, and closes no D1 records.
   - Preserves the existing guidance response contract used by work.html.
   - Requests only one additional evidence item when it can change the decision.
   - Does not request another screenshot when existing evidence is sufficient.
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

import {
  getDatabase,
  rowsOf
} from "../shared/database.js";

import { runAiJsonWithRetry } from "../shared/ai.js";

export const GUIDED_INVESTIGATION_VERSION = "7.7.0";

const CLOSED_STATUSES = new Set([
  "complete",
  "completed",
  "closed",
  "resolved",
  "cancelled",
  "canceled",
  "archived",
  "ignored",
  "no_action"
]);

export async function handleGuidedInvestigation(body, env, requestId) {
  const db = getDatabase(env);
  const clientCode = clean(body?.clientCode || body?.client);
  const investigationId = Number(
    body?.investigationId || body?.investigation_id
  );

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_GUIDED_INVESTIGATION,
      version: VERSION,
      guidedInvestigationVersion: GUIDED_INVESTIGATION_VERSION,
      error:
        "The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."
    }, 503);
  }

  if (!clientCode) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_GUIDED_INVESTIGATION,
      version: VERSION,
      guidedInvestigationVersion: GUIDED_INVESTIGATION_VERSION,
      error: "A clientCode is required."
    }, 400);
  }

  if (!Number.isInteger(investigationId) || investigationId <= 0) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_GUIDED_INVESTIGATION,
      version: VERSION,
      guidedInvestigationVersion: GUIDED_INVESTIGATION_VERSION,
      error: "A valid investigationId is required."
    }, 400);
  }

  try {
    const record = await loadInvestigationRecord({
      db,
      investigationId,
      clientCode
    });

    if (!record) {
      return jsonResponse({
        ok: false,
        requestId,
        action: ACTIONS.GET_GUIDED_INVESTIGATION,
        version: VERSION,
        guidedInvestigationVersion: GUIDED_INVESTIGATION_VERSION,
        error:
          `Investigation #${investigationId} was not found for client "${clientCode}".`
      }, 404);
    }

    const context = await loadInvestigationContext({
      db,
      record
    });

    const fallback = buildDeterministicGuidance({
      record,
      context
    });

    if (!env?.AI || typeof env.AI.run !== "function") {
      return successResponse({
        requestId,
        record,
        context,
        guidance: fallback,
        engine: "deterministic-context-first",
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
              "You are the GCM OS WWPOWD Guided Investigation consultant.",
              "Work like an experienced agency strategist beside a one-person agency owner.",
              "Use the supplied D1 operational history before asking for anything new.",
              "Your job is to move the Investigation toward a defensible decision, not to collect screenshots.",
              "Ask for exactly one additional evidence item only when it can materially change the decision.",
              "When existing evidence already proves the finding or justifies specific work, request no additional evidence.",
              "Never invent facts, URLs, counts, causes, business impact, completed work, or verification.",
              "Return one valid JSON object only."
            ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify({
              task:
                "Determine the current consultant decision state for this Investigation.",
              operatingQuestion:
                "Given everything already stored in D1, what is the single best next step, and would more evidence change the decision?",
              requiredOutput: {
                current_objective: "string",
                current_understanding: "string",
                current_unknowns: ["string"],
                current_next_step: "string",
                expected_evidence: "string; use 'No additional evidence required.' when sufficient",
                confidence: "integer from 0 to 100",
                ready_for_resolution: "boolean",
                resolution_reason: "string",
                evidence_sufficient: "boolean",
                root_cause_status:
                  "unproven | partially_proven | proven | not_required",
                decision_state:
                  "collect_evidence | lock_finding | create_work | monitor | close_no_action | verify_work",
                preferred_evidence_type:
                  "none | screenshot | pasted_text | url | export | live_verification",
                next_evidence_reason:
                  "string explaining how the one requested item would change the decision",
                finding_to_lock: "string or empty",
                work_recommendation: "string or empty",
                verification_plan: "string or empty",
                proof_trigger: "string or empty"
              },
              rules: [
                "Use only supplied D1 facts as known truth.",
                "Treat the originating Communication as one evidence source, not the whole Investigation.",
                "Review linked Evidence, Work Items, proof/activity history, prior Investigations, and baselines before requesting more evidence.",
                "Do not request evidence already present in the supplied context.",
                "Do not request another screenshot merely to increase confidence.",
                "If the remaining unknown would not change the recommendation, set evidence_sufficient true.",
                "If evidence is missing because image extraction was weak, prefer pasted_text, url, export, or live_verification when that is more reliable.",
                "Recommend Work only when the corrective action is specific and justified.",
                "If Work already exists for this Investigation, do not recommend creating duplicate Work.",
                "Keep current_next_step to one practical action.",
                "Keep current_unknowns limited to decision-blocking unknowns only."
              ],
              d1Context: mapSourceContext({
                record,
                context
              })
            })
          }
        ],
        max_tokens: 1600,
        temperature: 0
      },
      stageName: "guided_investigation_context_first",
      requestId,
      route: ACTIONS.GET_GUIDED_INVESTIGATION,
      timeoutMs: 30000,
      maxRetries: 1
    });

    if (!aiResult.ok) {
      return successResponse({
        requestId,
        record,
        context,
        guidance: fallback,
        engine: "deterministic-context-first",
        warning:
          aiResult?.error?.message ||
          "Guided Investigation AI did not return usable JSON."
      });
    }

    return successResponse({
      requestId,
      record,
      context,
      guidance: normalizeGuidance(aiResult.data, fallback),
      engine: COMMUNICATION_REASONING_MODEL,
      retryCount: aiResult.retryCount,
      retryStatus: aiResult.retryStatus
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.GET_GUIDED_INVESTIGATION,
      stage: "guided_investigation_context_first",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_GUIDED_INVESTIGATION,
      version: VERSION,
      guidedInvestigationVersion: GUIDED_INVESTIGATION_VERSION,
      error: safeErrorMessage(error)
    }, 500);
  }
}

async function loadInvestigationRecord({
  db,
  investigationId,
  clientCode
}) {
  return db.prepare(`
    SELECT
      i.*,
      i.id AS investigation_id,
      i.title AS investigation_title,
      i.description AS investigation_description,
      i.status AS investigation_status,
      c.client_code,
      c.name AS client_name,
      c.website AS client_website,
      c.industry AS client_industry,
      c.notes AS client_notes,
      cm.source AS communication_source,
      cm.category AS communication_category,
      cm.subject AS communication_subject,
      cm.raw_content AS communication_raw_content,
      cm.ai_summary AS communication_ai_summary,
      cm.ai_analysis_json AS communication_ai_analysis_json,
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
  `).bind(
    investigationId,
    clientCode
  ).first();
}

async function loadInvestigationContext({
  db,
  record
}) {
  const clientId = Number(record.client_id);
  const investigationId = Number(record.investigation_id);

  const [
    evidenceResult,
    workResult,
    activityResult,
    priorInvestigationsResult,
    recentCommunicationsResult,
    baselineResult
  ] = await Promise.all([
    safeAll(db, `
      SELECT *
      FROM evidence
      WHERE investigation_id = ?
         OR work_item_id IN (
           SELECT id
           FROM work_items
           WHERE investigation_id = ?
         )
      ORDER BY datetime(COALESCE(captured_at, created_at)) ASC, id ASC
      LIMIT 100
    `, [investigationId, investigationId]),

    safeAll(db, `
      SELECT *
      FROM work_items
      WHERE investigation_id = ?
      ORDER BY datetime(created_at) ASC, id ASC
      LIMIT 50
    `, [investigationId]),

    safeAll(db, `
      SELECT *
      FROM activity_records
      WHERE client_id = ?
      ORDER BY activity_date DESC, id DESC
      LIMIT 75
    `, [clientId]),

    safeAll(db, `
      SELECT *
      FROM investigations
      WHERE client_id = ?
        AND id <> ?
      ORDER BY datetime(COALESCE(updated_at, opened_at, created_at)) DESC, id DESC
      LIMIT 25
    `, [clientId, investigationId]),

    safeAll(db, `
      SELECT *
      FROM communications
      WHERE client_id = ?
        AND id <> COALESCE(?, -1)
      ORDER BY datetime(COALESCE(occurred_at, created_at)) DESC, id DESC
      LIMIT 25
    `, [clientId, record.communication_id]),

    safeAll(db, `
      SELECT *
      FROM client_baselines
      WHERE client_id = ?
      ORDER BY id DESC
      LIMIT 20
    `, [clientId])
  ]);

  const evidence = rowsOf(evidenceResult);
  const workItems = rowsOf(workResult);
  const activityRecords = rowsOf(activityResult);
  const priorInvestigations = rowsOf(priorInvestigationsResult);
  const recentCommunications = rowsOf(recentCommunicationsResult);
  const baselines = rowsOf(baselineResult);

  return {
    evidence,
    workItems,
    activityRecords,
    priorInvestigations,
    recentCommunications,
    baselines,
    summary: {
      evidenceCount: evidence.length,
      workItemCount: workItems.length,
      openWorkItemCount: workItems.filter(isOpenRecord).length,
      completedWorkItemCount: workItems.filter(isClosedRecord).length,
      activityRecordCount: activityRecords.length,
      priorInvestigationCount: priorInvestigations.length,
      recentCommunicationCount: recentCommunications.length,
      baselineCount: baselines.length
    }
  };
}

async function safeAll(db, sql, bindings = []) {
  try {
    let statement = db.prepare(sql);

    if (bindings.length) {
      statement = statement.bind(...bindings);
    }

    return await statement.all();
  } catch (error) {
    console.warn("[GCM OS] Optional investigation context query skipped", {
      error: safeErrorMessage(error),
      sql: clean(sql).slice(0, 180)
    });

    return { results: [] };
  }
}

function successResponse({
  requestId,
  record,
  context,
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
    guidedInvestigationVersion: GUIDED_INVESTIGATION_VERSION,
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
    contextSummary: context.summary,
    guidance
  });
}

function mapSourceContext({
  record,
  context
}) {
  return {
    investigation: {
      id: record.investigation_id,
      title: clean(record.investigation_title),
      description: clean(record.investigation_description),
      objective: clean(record.objective),
      priority: clean(record.priority),
      status: clean(record.investigation_status),
      assignedTo: clean(record.assigned_to),
      existingFinding: clean(record.finding_summary),
      existingRecommendation: clean(record.recommendation),
      existingNextStep: clean(
        record.current_next_step ||
        record.next_step ||
        record.next_question
      ),
      openedAt: record.opened_at || null,
      updatedAt: record.updated_at || null
    },
    client: {
      id: Number(record.client_id),
      code: clean(record.client_code),
      name: clean(record.client_name),
      website: clean(record.client_website),
      industry: clean(record.client_industry),
      notes: clean(record.client_notes)
    },
    originatingCommunication: {
      id: record.communication_id || null,
      source: clean(record.communication_source),
      category: clean(record.communication_category),
      subject: clean(record.communication_subject),
      rawContent: clean(record.communication_raw_content),
      aiSummary: clean(record.communication_ai_summary),
      aiAnalysis: parseJsonObject(record.communication_ai_analysis_json),
      operationalDecision: clean(record.operational_decision),
      notes: clean(record.communication_notes),
      occurredAt:
        record.communication_occurred_at ||
        record.communication_created_at ||
        null
    },
    linkedEvidence: context.evidence.map(mapEvidenceRecord),
    linkedWorkItems: context.workItems.map(mapWorkRecord),
    recentProofAndActivity: context.activityRecords.map(mapActivityRecord),
    priorClientInvestigations:
      context.priorInvestigations.map(mapPriorInvestigation),
    recentClientCommunications:
      context.recentCommunications.map(mapCommunicationRecord),
    clientBaselines: context.baselines.map(mapGenericRecord),
    contextSummary: context.summary
  };
}

function mapEvidenceRecord(row) {
  return {
    id: row.id,
    evidenceType: clean(row.evidence_type),
    source: clean(row.source),
    description: clean(row.description),
    url: clean(row.url) || null,
    rawData: parseJsonOrText(row.raw_data),
    capturedAt: row.captured_at || row.created_at || null,
    workItemId: row.work_item_id || null,
    communicationId: row.communication_id || null
  };
}

function mapWorkRecord(row) {
  return {
    id: row.id,
    title: clean(row.title),
    description: clean(row.description),
    category: clean(row.category),
    priority: clean(row.priority),
    status: clean(row.status),
    owner: clean(row.owner),
    expectedImpact: clean(row.expected_impact),
    actualImpact: clean(row.actual_impact),
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function mapActivityRecord(row) {
  return {
    id: row.id,
    date: row.activity_date || null,
    category: clean(row.category),
    activity: clean(row.activity),
    evidenceType: clean(row.evidence_type),
    evidenceReference: clean(row.evidence_reference),
    status: clean(row.status),
    owner: clean(row.owner),
    timeMinutes: normalizeNonNegativeInteger(row.time_minutes),
    expectedImpact: clean(row.expected_impact),
    actualImpact: clean(row.actual_impact),
    notes: clean(row.notes),
    priority: clean(row.priority),
    win: Boolean(Number(row.win))
  };
}

function mapPriorInvestigation(row) {
  return {
    id: row.id,
    title: clean(row.title),
    description: clean(row.description),
    priority: clean(row.priority),
    status: clean(row.status),
    findingSummary: clean(row.finding_summary),
    recommendation: clean(row.recommendation),
    openedAt: row.opened_at || null,
    resolvedAt: row.resolved_at || row.closed_at || null,
    updatedAt: row.updated_at || null
  };
}

function mapCommunicationRecord(row) {
  return {
    id: row.id,
    source: clean(row.source),
    category: clean(row.category),
    subject: clean(row.subject),
    aiSummary: clean(row.ai_summary),
    operationalDecision: clean(row.operational_decision),
    status: clean(row.status),
    occurredAt: row.occurred_at || row.created_at || null
  };
}

function mapGenericRecord(row) {
  if (!row || typeof row !== "object") return {};

  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === "string" ? clean(value) : value
    ])
  );
}

function normalizeGuidance(value, fallback) {
  const source = value && typeof value === "object" ? value : {};
  const unknowns = normalizeStringArray(source.current_unknowns);
  const evidenceSufficient = normalizeBoolean(
    source.evidence_sufficient,
    source.ready_for_resolution === true
  );
  const readyForResolution = normalizeBoolean(
    source.ready_for_resolution,
    evidenceSufficient
  );
  const decisionState = normalizeDecisionState(
    source.decision_state,
    readyForResolution
      ? clean(source.work_recommendation)
        ? "create_work"
        : "lock_finding"
      : "collect_evidence"
  );
  const preferredEvidenceType = normalizeEvidenceType(
    source.preferred_evidence_type,
    evidenceSufficient ? "none" : fallback.preferred_evidence_type
  );

  return {
    current_objective:
      clean(source.current_objective) || fallback.current_objective,
    current_understanding:
      clean(source.current_understanding) || fallback.current_understanding,
    current_unknowns:
      unknowns.length || evidenceSufficient
        ? unknowns
        : fallback.current_unknowns,
    current_next_step:
      clean(source.current_next_step) || fallback.current_next_step,
    expected_evidence:
      evidenceSufficient
        ? "No additional evidence required."
        : clean(source.expected_evidence) || fallback.expected_evidence,
    confidence: clampInteger(source.confidence, fallback.confidence),
    ready_for_resolution: readyForResolution,
    resolution_reason:
      clean(source.resolution_reason) || fallback.resolution_reason,

    evidence_sufficient: evidenceSufficient,
    root_cause_status: normalizeRootCauseStatus(
      source.root_cause_status,
      fallback.root_cause_status
    ),
    decision_state: decisionState,
    preferred_evidence_type: preferredEvidenceType,
    next_evidence_reason:
      evidenceSufficient
        ? "Additional evidence is not expected to change the current decision."
        : clean(source.next_evidence_reason) ||
          fallback.next_evidence_reason,
    finding_to_lock:
      clean(source.finding_to_lock) || fallback.finding_to_lock,
    work_recommendation:
      clean(source.work_recommendation) || fallback.work_recommendation,
    verification_plan:
      clean(source.verification_plan) || fallback.verification_plan,
    proof_trigger:
      clean(source.proof_trigger) || fallback.proof_trigger
  };
}

function buildDeterministicGuidance({
  record,
  context
}) {
  const title = clean(record.investigation_title);
  const description = clean(record.investigation_description);
  const existingFinding = clean(record.finding_summary);
  const existingRecommendation = clean(record.recommendation);
  const openWorkItems = context.workItems.filter(isOpenRecord);
  const completedWorkItems = context.workItems.filter(isClosedRecord);
  const linkedEvidence = context.evidence.filter(hasMeaningfulEvidence);

  const communicationSummary =
    clean(record.communication_ai_summary) ||
    clean(record.communication_raw_content) ||
    description ||
    "The originating communication reported a condition requiring review.";

  const objective =
    clean(record.objective) ||
    description ||
    `Determine whether ${title || "the reported condition"} requires corrective work.`;

  if (openWorkItems.length) {
    const work = openWorkItems[0];

    return {
      current_objective: objective,
      current_understanding:
        buildContextUnderstanding({
          communicationSummary,
          existingFinding,
          evidenceCount: linkedEvidence.length,
          activityCount: context.activityRecords.length
        }),
      current_unknowns: [],
      current_next_step:
        `Continue Work Item #${work.id}: ${clean(work.title) || "Complete the approved work"}.`,
      expected_evidence: "No additional investigation evidence required.",
      confidence: existingFinding ? 95 : 85,
      ready_for_resolution: true,
      resolution_reason:
        "Specific Work already exists for this Investigation. Do not restart evidence collection or create duplicate Work.",
      evidence_sufficient: true,
      root_cause_status: existingFinding ? "proven" : "partially_proven",
      decision_state: "verify_work",
      preferred_evidence_type: "none",
      next_evidence_reason:
        "The Investigation has already produced committed Work.",
      finding_to_lock: existingFinding,
      work_recommendation: clean(work.title),
      verification_plan:
        "Complete the existing Work Item, capture completion evidence, and verify the expected result.",
      proof_trigger:
        "The existing Work Item is completed with evidence and an actual impact/result."
    };
  }

  if (completedWorkItems.length) {
    const work = completedWorkItems[0];

    return {
      current_objective: objective,
      current_understanding:
        buildContextUnderstanding({
          communicationSummary,
          existingFinding,
          evidenceCount: linkedEvidence.length,
          activityCount: context.activityRecords.length
        }),
      current_unknowns: [],
      current_next_step:
        `Verify the recorded result for completed Work Item #${work.id}.`,
      expected_evidence:
        "Live verification or result evidence confirming the completed work produced the intended outcome.",
      confidence: 90,
      ready_for_resolution: true,
      resolution_reason:
        "Corrective Work is completed. The remaining step is result verification and Proof of Work, not additional diagnosis.",
      evidence_sufficient: true,
      root_cause_status: existingFinding ? "proven" : "partially_proven",
      decision_state: "verify_work",
      preferred_evidence_type: "live_verification",
      next_evidence_reason:
        "Verification confirms the result and makes the completed work defensible as Proof of Work.",
      finding_to_lock: existingFinding,
      work_recommendation: clean(work.title),
      verification_plan:
        "Compare the live condition or current report against the pre-work evidence.",
      proof_trigger:
        "Verification confirms the completed work and the actual impact is recorded."
    };
  }

  if (existingFinding && existingRecommendation) {
    return {
      current_objective: objective,
      current_understanding:
        buildContextUnderstanding({
          communicationSummary,
          existingFinding,
          evidenceCount: linkedEvidence.length,
          activityCount: context.activityRecords.length
        }),
      current_unknowns: [],
      current_next_step:
        `Review and authorize the specific work: ${existingRecommendation}`,
      expected_evidence: "No additional evidence required.",
      confidence: linkedEvidence.length ? 92 : 82,
      ready_for_resolution: true,
      resolution_reason:
        "The Investigation already contains a finding and a specific recommendation. Additional screenshots are unlikely to change the decision.",
      evidence_sufficient: true,
      root_cause_status: "proven",
      decision_state: "create_work",
      preferred_evidence_type: "none",
      next_evidence_reason:
        "The current finding and recommendation already support an operational decision.",
      finding_to_lock: existingFinding,
      work_recommendation: existingRecommendation,
      verification_plan:
        "After implementation, repeat the original test or report and compare the result to the locked evidence.",
      proof_trigger:
        "The corrective action is completed and the verification result is recorded."
    };
  }

  if (existingFinding) {
    return {
      current_objective: objective,
      current_understanding:
        buildContextUnderstanding({
          communicationSummary,
          existingFinding,
          evidenceCount: linkedEvidence.length,
          activityCount: context.activityRecords.length
        }),
      current_unknowns: [
        "The exact corrective action that follows from the verified finding."
      ],
      current_next_step:
        "Translate the locked finding into one specific corrective action and verification plan.",
      expected_evidence: "No additional evidence required unless it would change the locked finding.",
      confidence: linkedEvidence.length ? 88 : 78,
      ready_for_resolution: true,
      resolution_reason:
        "A finding is already recorded. The next step is a specific work decision, not another broad screenshot.",
      evidence_sufficient: true,
      root_cause_status: "proven",
      decision_state: "lock_finding",
      preferred_evidence_type: "none",
      next_evidence_reason:
        "Additional evidence should be requested only if the existing finding is contradicted.",
      finding_to_lock: existingFinding,
      work_recommendation: "",
      verification_plan:
        "Define the live test or report that will confirm the corrective action worked.",
      proof_trigger:
        "Specific work is completed and verification confirms the result."
    };
  }

  if (linkedEvidence.length >= 2) {
    const latestEvidence = linkedEvidence.at(-1);

    return {
      current_objective: objective,
      current_understanding:
        buildContextUnderstanding({
          communicationSummary,
          existingFinding: clean(latestEvidence.description),
          evidenceCount: linkedEvidence.length,
          activityCount: context.activityRecords.length
        }),
      current_unknowns: [
        "Whether the linked evidence establishes one defensible root cause or only repeated symptoms."
      ],
      current_next_step:
        "Review the linked evidence together and decide whether it proves one root cause. Do not collect another screenshot unless it resolves that exact uncertainty.",
      expected_evidence:
        "Only the single source, URL, pasted detail, or live result that distinguishes root cause from symptom.",
      confidence: 72,
      ready_for_resolution: false,
      resolution_reason:
        "Multiple evidence records already exist. The next decision must reconcile them before requesting more input.",
      evidence_sufficient: false,
      root_cause_status: "partially_proven",
      decision_state: "collect_evidence",
      preferred_evidence_type: "pasted_text",
      next_evidence_reason:
        "The requested item must identify the responsible source or prove that the evidence already shares one cause.",
      finding_to_lock: "",
      work_recommendation: "",
      verification_plan: "",
      proof_trigger: ""
    };
  }

  const combined = [
    title,
    description,
    record.communication_subject,
    record.communication_category,
    communicationSummary,
    existingRecommendation
  ].filter(Boolean).join(" ").toLowerCase();

  const evidenceRequest = determineSingleEvidenceRequest(combined);

  return {
    current_objective: objective,
    current_understanding: communicationSummary,
    current_unknowns: [
      evidenceRequest.unknown
    ],
    current_next_step: evidenceRequest.nextStep,
    expected_evidence: evidenceRequest.expectedEvidence,
    confidence: 50,
    ready_for_resolution: false,
    resolution_reason:
      "The originating Communication identifies a condition, but the current D1 record does not yet contain enough linked evidence to make a defensible work decision.",
    evidence_sufficient: false,
    root_cause_status: "unproven",
    decision_state: "collect_evidence",
    preferred_evidence_type: evidenceRequest.preferredType,
    next_evidence_reason: evidenceRequest.reason,
    finding_to_lock: "",
    work_recommendation: "",
    verification_plan: "",
    proof_trigger: ""
  };
}

function determineSingleEvidenceRequest(combined) {
  if (combined.includes("backlink")) {
    return {
      unknown:
        "Whether the exact referring domains represent a real risk, a legitimate mention, or routine monitoring.",
      nextStep:
        "Review the exact referring domains and target pages, then classify whether any domain requires action.",
      expectedEvidence:
        "A pasted domain list or export with target pages and available authority/toxicity details.",
      preferredType: "export",
      reason:
        "A domain-level list can change the decision; another overview screenshot cannot."
    };
  }

  if (
    combined.includes("position tracking") ||
    combined.includes("position_tracking") ||
    combined.includes("ranking")
  ) {
    return {
      unknown:
        "Whether the movement is meaningful when compared with the keyword, prior position, volume, landing page, and recent trend.",
      nextStep:
        "Compare the affected keyword movement with the existing client history and determine whether it is a win, routine volatility, or a decision-worthy loss.",
      expectedEvidence:
        "Pasted keyword rows or an export showing keyword, prior position, current position, date, landing page, and volume when available.",
      preferredType: "pasted_text",
      reason:
        "Exact keyword rows are more reliable and queryable than another report overview screenshot."
    };
  }

  if (combined.includes("site audit") || combined.includes("site_audit")) {
    return {
      unknown:
        "Which one issue category creates the highest-value decision and whether its representative examples share one cause.",
      nextStep:
        "Open the highest-priority Site Audit issue and review one representative example with its technical explanation.",
      expectedEvidence:
        "One representative issue detail: exact issue name, affected count, example URL or record, and technical explanation. Paste the text or URL when clearer than a screenshot.",
      preferredType: "pasted_text",
      reason:
        "One representative issue detail can establish the pattern; another full audit overview is redundant."
    };
  }

  if (
    combined.includes("merchant") ||
    combined.includes("structured data") ||
    combined.includes("structured_data")
  ) {
    return {
      unknown:
        "Whether the affected items share one validation error and one responsible implementation source.",
      nextStep:
        "Review one representative affected item and identify the exact validation error and responsible source.",
      expectedEvidence:
        "The exact error text plus one representative URL/item and, when visible, the plugin, template, feed, or configuration producing it.",
      preferredType: "pasted_text",
      reason:
        "Exact validation text and source identification determine the corrective action."
    };
  }

  return {
    unknown:
      "The one fact that separates monitoring from investigation or specific corrective work.",
    nextStep:
      "Provide the clearest representative evidence that would change the operational decision.",
    expectedEvidence:
      "Use pasted text, a URL, an export, live verification, or a screenshot—whichever most directly proves the decision-blocking fact.",
    preferredType: "pasted_text",
    reason:
      "The evidence format should follow the decision question rather than defaulting to screenshots."
  };
}

function buildContextUnderstanding({
  communicationSummary,
  existingFinding,
  evidenceCount,
  activityCount
}) {
  return [
    communicationSummary,
    existingFinding ? `Recorded finding: ${existingFinding}` : "",
    evidenceCount
      ? `${evidenceCount} linked evidence record${evidenceCount === 1 ? "" : "s"} already exist in D1.`
      : "",
    activityCount
      ? `${activityCount} recent proof/activity record${activityCount === 1 ? "" : "s"} are available for client context.`
      : ""
  ].filter(Boolean).join(" ");
}

function hasMeaningfulEvidence(row) {
  return Boolean(
    clean(row?.description) ||
    clean(row?.url) ||
    clean(row?.raw_data)
  );
}

function isOpenRecord(row) {
  const status = normalizeStatus(row?.status || "open");
  return !CLOSED_STATUSES.has(status);
}

function isClosedRecord(row) {
  return !isOpenRecord(row);
}

function normalizeStatus(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
}

function normalizeDecisionState(value, fallback) {
  const allowed = new Set([
    "collect_evidence",
    "lock_finding",
    "create_work",
    "monitor",
    "close_no_action",
    "verify_work"
  ]);
  const normalized = normalizeStatus(value);
  return allowed.has(normalized) ? normalized : fallback;
}

function normalizeEvidenceType(value, fallback) {
  const allowed = new Set([
    "none",
    "screenshot",
    "pasted_text",
    "url",
    "export",
    "live_verification"
  ]);
  const normalized = normalizeStatus(value);
  return allowed.has(normalized) ? normalized : fallback;
}

function normalizeRootCauseStatus(value, fallback) {
  const allowed = new Set([
    "unproven",
    "partially_proven",
    "proven",
    "not_required"
  ]);
  const normalized = normalizeStatus(value);
  return allowed.has(normalized) ? normalized : fallback;
}

function normalizeBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  const normalized = clean(value).toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return Boolean(fallback);
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(clean).filter(Boolean).slice(0, 5);
  }

  const text = clean(value);
  if (!text) return [];

  return text
    .split(/\n|;|\u2022/)
    .map(item => clean(item.replace(/^[-*\d.)\s]+/, "")))
    .filter(Boolean)
    .slice(0, 5);
}

function clampInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.round(number)
    : 0;
}

function parseJsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  const text = clean(value);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function parseJsonOrText(value) {
  if (value && typeof value === "object") return value;

  const text = clean(value);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
