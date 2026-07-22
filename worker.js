/* =========================================================
   Global Concepts Media Operating System
   File: worker.js
   Version: 6.3.7
   Sprint: Operational Pilot — Stability Sprint
   Purpose: Production operational communications, client
            workspace retrieval, and reviewed record commits.

   This fresh-install Worker intentionally removes the dormant
   Business Snapshot, Client Pre-Research, Website Intelligence,
   HTML Intelligence, evidence classification, and prospecting
   pipelines from the production operational Worker.
   ========================================================= */

const VERSION = "6.3.7";
const API_CONTRACT_VERSION = "communications-operational-decision-v3";
const COMMUNICATION_ANALYSIS_ENGINE_VERSION = "3.4.0";
const COMMUNICATION_VISION_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";
const COMMUNICATION_REASONING_MODEL = "@cf/openai/gpt-oss-20b";

const ACTIONS = Object.freeze({
  ANALYZE_COMMUNICATION: "analyze-client-communication",
  GET_CLIENT_WORKSPACE: "get-client-workspace",
  COMMIT_OPERATIONAL_DECISION: "commit-operational-decision"
});

const STAGE_STATUS = Object.freeze({
  SUCCESS: "success",
  PARTIAL: "partial",
  FALLBACK: "fallback",
  FAILED: "failed",
  SKIPPED: "skipped"
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-GCM-Contract-Version",
  "Content-Type": "application/json; charset=utf-8"
};

export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    const requestStartedAt = Date.now();

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "GET") {
      return jsonResponse({
        ok: true,
        status: "online",
        system: "GCM OS Operational Worker",
        version: VERSION,
        contractVersion: API_CONTRACT_VERSION,
        sprint: "Operational Pilot — Stability Sprint",
        architecture: "Operational-only routes with isolated stages, diagnostics, deterministic classification, guarded AI, and D1 persistence",
        actions: Object.values(ACTIONS),
        engines: [
          "notification-detection",
          "evidence-extraction",
          "business-meaning",
          "operational-routing",
          "consultant-summary",
          "client-workspace",
          "operational-decision-commit"
        ],
        removedLegacyPipelines: [
          "business-snapshot",
          "client-pre-research",
          "website-intelligence",
          "html-intelligence",
          "prospect-qualification"
        ],
        requestId
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({
        ok: false,
        requestId,
        error: "Method not allowed."
      }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      logWorkerError({ requestId, route: "request-parser", stage: "request_validation", error });
      return jsonResponse({
        ok: false,
        requestId,
        error: "The request body must contain valid JSON.",
        details: safeErrorMessage(error)
      }, 400);
    }

    const action = clean(body?.action);

    try {
      switch (action) {
        case ACTIONS.ANALYZE_COMMUNICATION:
          return await handleCommunicationAnalysis(body, env, requestId);

        case ACTIONS.GET_CLIENT_WORKSPACE:
          return await handleClientWorkspace(body, env, requestId);

        case ACTIONS.COMMIT_OPERATIONAL_DECISION:
          return await handleCommitOperationalDecision(body, env, requestId);

        default:
          return jsonResponse({
            ok: false,
            requestId,
            version: VERSION,
            error: action
              ? `Unsupported action: ${action}`
              : "An action is required.",
            supportedActions: Object.values(ACTIONS)
          }, 400);
      }
    } catch (error) {
      logWorkerError({ requestId, route: action || "unknown", stage: "request_handler", error });
      return jsonResponse({
        ok: false,
        requestId,
        version: VERSION,
        processingStatus: "failed",
        error: safeErrorMessage(error),
        executionTimeMs: Date.now() - requestStartedAt
      }, 500);
    }
  }
};

/* =========================================================
   Communication Analysis — Isolated Stability Pipeline
   ========================================================= */

async function handleCommunicationAnalysis(body, env, requestId) {
  const startedAt = Date.now();
  const client = clean(body?.client || body?.clientName);
  const clientId = clean(body?.clientId);
  const imageDataUrl = String(body?.image || body?.screenshot || "");
  const sourceText = clean(body?.sourceText || body?.text);
  const fileName = clean(body?.fileName || "communication-screenshot");
  const requestedContractVersion = clean(
    body?.contractVersion || body?.apiContractVersion || API_CONTRACT_VERSION
  );
  const stages = [];
  const errors = [];

  if (requestedContractVersion !== API_CONTRACT_VERSION) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.ANALYZE_COMMUNICATION,
      version: VERSION,
      contractVersion: API_CONTRACT_VERSION,
      error: `Unsupported contract version: ${requestedContractVersion}`,
      supportedContractVersion: API_CONTRACT_VERSION
    }, 400);
  }

  if (!client && !clientId) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.ANALYZE_COMMUNICATION,
      contractVersion: API_CONTRACT_VERSION,
      error: "A client or clientId is required."
    }, 400);
  }

  if (!imageDataUrl && !sourceText) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.ANALYZE_COMMUNICATION,
      contractVersion: API_CONTRACT_VERSION,
      error: "A screenshot or sourceText is required."
    }, 400);
  }

  let visibleEvidence = null;
  let classification = null;
  let businessMeaning = null;
  let operationalDecision = null;
  let consultantSummary = null;

  /* Stage 1 + 2: extract visible evidence without operational reasoning. */
  if (sourceText) {
    const stageStartedAt = Date.now();
    visibleEvidence = normalizeVisibleEvidence({
      visibleSource: "Unknown",
      visibleSubject: "Unknown",
      visibleText: sourceText,
      visibleFacts: [sourceText],
      visibleMetrics: [],
      responseExpected: false,
      explicitActionRequested: false,
      confidence: "High",
      uncertainty: "None"
    });

    stages.push(createStageResult({
      stageName: "evidence_extraction",
      status: STAGE_STATUS.SUCCESS,
      engine: "supplied-text",
      model: "deterministic",
      startedAt: stageStartedAt,
      confidence: 1,
      data: visibleEvidence
    }));
  } else {
    const extractionResult = await executeVisionExtractionStage({
      imageDataUrl,
      client,
      clientId,
      fileName,
      env,
      requestId
    });
    stages.push(extractionResult.stage);

    if (extractionResult.error) errors.push(extractionResult.error);
    visibleEvidence = extractionResult.data;
  }

  /* Stage 1: deterministic platform and notification classification. */
  {
    const stageStartedAt = Date.now();
    classification = deterministicNotificationClassification(visibleEvidence);

    stages.push(createStageResult({
      stageName: "notification_detection",
      status: classification.notificationType === "unknown"
        ? STAGE_STATUS.PARTIAL
        : STAGE_STATUS.SUCCESS,
      engine: "notification-rules",
      model: "deterministic",
      startedAt: stageStartedAt,
      confidence: classification.confidence,
      fallbackUsed: false,
      data: classification
    }));
  }

  /* Stage 3: AI business interpretation; failure retains evidence/classification. */
  {
    const meaningResult = await executeBusinessMeaningStage({
      client,
      clientId,
      fileName,
      visibleEvidence,
      classification,
      env,
      requestId
    });
    stages.push(meaningResult.stage);
    if (meaningResult.error) errors.push(meaningResult.error);
    businessMeaning = meaningResult.data;
  }

  /* Stage 4: deterministic routing with guarded AI meaning. */
  {
    const stageStartedAt = Date.now();
    operationalDecision = buildOperationalDecision({
      visibleEvidence,
      classification,
      businessMeaning
    });

    stages.push(createStageResult({
      stageName: "operational_routing",
      status: businessMeaning?.fallbackUsed
        ? STAGE_STATUS.FALLBACK
        : STAGE_STATUS.SUCCESS,
      engine: "operational-routing-rules",
      model: "deterministic",
      startedAt: stageStartedAt,
      confidence: operationalDecision.classificationConfidence,
      fallbackUsed: Boolean(businessMeaning?.fallbackUsed),
      data: operationalDecision.recommendedRoutes
    }));
  }

  /* Stage 5: consultant summary is deterministic and always available. */
  {
    const stageStartedAt = Date.now();
    consultantSummary = buildConsultantSummary({
      classification,
      visibleEvidence,
      businessMeaning,
      operationalDecision
    });

    stages.push(createStageResult({
      stageName: "consultant_summary",
      status: STAGE_STATUS.SUCCESS,
      engine: "consultant-summary-builder",
      model: "deterministic",
      startedAt: stageStartedAt,
      confidence: operationalDecision.classificationConfidence,
      fallbackUsed: Boolean(businessMeaning?.fallbackUsed),
      data: consultantSummary
    }));
  }

  const failedStages = stages.filter(stage => stage.status === STAGE_STATUS.FAILED);
  const fallbackStages = stages.filter(stage => stage.status === STAGE_STATUS.FALLBACK);
  const partialStages = stages.filter(stage => stage.status === STAGE_STATUS.PARTIAL);
  const processingStatus = failedStages.length
    ? "partial"
    : fallbackStages.length || partialStages.length
      ? "partial"
      : "complete";

  const diagnosticSummary = stages.map(stage => ({
    stageName: stage.stageName,
    status: stage.status,
    engine: stage.engine,
    model: stage.model,
    executionTimeMs: stage.executionTimeMs,
    confidence: stage.confidence,
    retryCount: stage.retryCount,
    retryStatus: stage.retryStatus,
    rawAiError: stage.rawAiError,
    fallbackUsed: stage.fallbackUsed
  }));

  operationalDecision.diagnostics = diagnosticSummary;

  return jsonResponse({
    ok: true,
    action: ACTIONS.ANALYZE_COMMUNICATION,
    version: VERSION,
    contractVersion: API_CONTRACT_VERSION,
    requestId,
    generatedAt: new Date().toISOString(),
    processingStatus,
    client: {
      id: clientId || null,
      name: client || null
    },
    input: {
      type: sourceText ? "text" : "screenshot",
      fileName
    },
    classification,
    evidence: visibleEvidence,
    businessMeaning,
    operationalDecision,
    consultantSummary,
    analysis: operationalDecision,
    stages,
    stageDiagnostics: diagnosticSummary,
    errors,
    diagnostics: {
      engine: "communication-analysis",
      engineVersion: COMMUNICATION_ANALYSIS_ENGINE_VERSION,
      executionTimeMs: Date.now() - startedAt,
      stageCount: stages.length,
      failedStageCount: failedStages.length,
      fallbackStageCount: fallbackStages.length,
      partialStageCount: partialStages.length
    }
  }, 200);
}

async function executeVisionExtractionStage({
  imageDataUrl,
  client,
  clientId,
  fileName,
  env,
  requestId
}) {
  const stageStartedAt = Date.now();
  const stageName = "evidence_extraction";

  if (!env?.AI || typeof env.AI.run !== "function") {
    const error = buildOperationalError({
      stage: stageName,
      code: "AI_BINDING_UNAVAILABLE",
      message: "Workers AI is unavailable for screenshot evidence extraction.",
      retryable: false
    });
    logWorkerError({ requestId, route: ACTIONS.ANALYZE_COMMUNICATION, stage: stageName, error });

    return {
      data: fallbackVisibleEvidence("Workers AI is unavailable."),
      error,
      stage: createStageResult({
        stageName,
        status: STAGE_STATUS.FAILED,
        engine: "communication-evidence-extraction",
        model: COMMUNICATION_VISION_MODEL,
        startedAt: stageStartedAt,
        confidence: 0,
        rawAiError: error.message,
        fallbackUsed: true,
        data: null
      })
    };
  }

  let imageBytes;
  try {
    imageBytes = dataUrlToByteArray(imageDataUrl);
  } catch (error) {
    const operationalError = buildOperationalError({
      stage: stageName,
      code: "INVALID_SCREENSHOT",
      message: safeErrorMessage(error),
      retryable: false
    });
    logWorkerError({ requestId, route: ACTIONS.ANALYZE_COMMUNICATION, stage: stageName, error });

    return {
      data: fallbackVisibleEvidence(operationalError.message),
      error: operationalError,
      stage: createStageResult({
        stageName,
        status: STAGE_STATUS.FAILED,
        engine: "communication-evidence-extraction",
        model: COMMUNICATION_VISION_MODEL,
        startedAt: stageStartedAt,
        confidence: 0,
        rawAiError: operationalError.message,
        fallbackUsed: true,
        data: null
      })
    };
  }

  const primaryPrompt = buildVisionEvidencePrompt({
    client,
    clientId,
    fileName,
    focusedRecovery: false
  });

  const primaryResult = await runAiJsonWithRetry({
    env,
    model: COMMUNICATION_VISION_MODEL,
    input: {
      image: imageBytes,
      prompt: primaryPrompt,
      max_tokens: 1800
    },
    stageName,
    requestId,
    route: ACTIONS.ANALYZE_COMMUNICATION,
    timeoutMs: 30000,
    maxRetries: 1
  });

  let primaryEvidence = null;
  if (primaryResult.ok) {
    primaryEvidence = normalizeVisibleEvidence(primaryResult.data);
  }

  const needsFocusedRecovery = !primaryResult.ok || isWeakVisibleEvidence(primaryEvidence);
  let recoveryResult = null;
  let recoveryEvidence = null;

  if (needsFocusedRecovery) {
    const recoveryPrompt = buildVisionEvidencePrompt({
      client,
      clientId,
      fileName,
      focusedRecovery: true
    });

    recoveryResult = await runAiJsonWithRetry({
      env,
      model: COMMUNICATION_VISION_MODEL,
      input: {
        image: imageBytes,
        prompt: recoveryPrompt,
        max_tokens: 1800
      },
      stageName: `${stageName}_focused_recovery`,
      requestId,
      route: ACTIONS.ANALYZE_COMMUNICATION,
      timeoutMs: 30000,
      maxRetries: 1
    });

    if (recoveryResult.ok) {
      recoveryEvidence = normalizeVisibleEvidence(recoveryResult.data);
    }
  }

  const evidence = mergeVisibleEvidence(primaryEvidence, recoveryEvidence);

  if (!evidence || isWeakVisibleEvidence(evidence)) {
    const primaryMessage = primaryResult.ok ? "Primary vision extraction returned insufficient readable evidence." : primaryResult.error.message;
    const recoveryMessage = recoveryResult
      ? (recoveryResult.ok ? "Focused recovery returned insufficient readable evidence." : recoveryResult.error.message)
      : "Focused recovery was not available.";
    const message = `${primaryMessage} ${recoveryMessage}`.trim();
    const operationalError = buildOperationalError({
      stage: stageName,
      code: primaryResult.ok ? "AI_INSUFFICIENT_EVIDENCE" : primaryResult.error.code,
      message,
      retryable: false
    });

    return {
      data: fallbackVisibleEvidence(message),
      error: operationalError,
      stage: createStageResult({
        stageName,
        status: STAGE_STATUS.FAILED,
        engine: "communication-evidence-extraction-two-pass",
        model: COMMUNICATION_VISION_MODEL,
        startedAt: stageStartedAt,
        confidence: 0,
        retryCount: (primaryResult.retryCount || 0) + (recoveryResult?.retryCount || 0),
        retryStatus: recoveryResult?.ok ? "recovery_insufficient" : "failed",
        rawAiError: message,
        fallbackUsed: true,
        data: null
      })
    };
  }

  const usedRecovery = Boolean(recoveryEvidence && !isWeakVisibleEvidence(recoveryEvidence));

  return {
    data: evidence,
    error: null,
    stage: createStageResult({
      stageName,
      status: STAGE_STATUS.SUCCESS,
      engine: usedRecovery
        ? "communication-evidence-extraction-two-pass"
        : "communication-evidence-extraction",
      model: COMMUNICATION_VISION_MODEL,
      startedAt: stageStartedAt,
      confidence: confidenceToNumber(evidence.confidence),
      retryCount: (primaryResult.retryCount || 0) + (recoveryResult?.retryCount || 0),
      retryStatus: usedRecovery ? "focused_recovery_succeeded" : primaryResult.retryStatus,
      fallbackUsed: false,
      data: evidence
    })
  };
}

function buildVisionEvidencePrompt({ client, clientId, fileName, focusedRecovery }) {
  const instructions = focusedRecovery
    ? [
        "This is a focused recovery pass because a prior pass could not read enough evidence.",
        "Inspect the entire screenshot carefully, including small text, logos, headings, colored metric cards, and notification body text.",
        "For an SEMrush screenshot, explicitly look for the words SEMrush, Backlink Audit, Position Tracking, Site Audit, domains lost, domains gained, trusted domains, high quality domains, backlinks, keywords, and site health.",
        "Do not return Unknown merely because the screenshot is an email. Read the visible email body and report cards.",
        "Copy visible numbers together with their labels, for example: 6 High Quality Domains Lost or 9 New Trusted Domains."
      ]
    : [
        "Inspect the complete screenshot, not only the sender line or email chrome.",
        "Read visible logos, headings, notification names, metric labels, numbers, and direction words such as lost, gained, new, declined, improved, failed, or warning.",
        "For platform notifications, preserve the exact platform and report family when visible."
      ];

  return [
    "You are the Communication Evidence Extractor for the Global Concepts Media Operating System.",
    "Read one business email or platform-notification screenshot and return only visible evidence.",
    "Do not decide what work should be done.",
    "Do not infer facts that are not visible.",
    "The selected client and filename are context only, not screenshot evidence.",
    ...instructions,
    "Identify visible platform names such as SEMrush, Google Search Console, Google Business Profile, Google Analytics, or GA4.",
    "Preserve readable notification labels such as Position Tracking, Backlink Audit, or Site Audit.",
    "Put every readable metric in visibleMetrics with its number, label, and direction.",
    "Put important non-metric statements in visibleFacts.",
    "When something truly cannot be read, use Unknown only for that field.",
    "Never wrap the JSON in markdown fences.",
    "",
    `Selected client: ${client || clientId || "Unknown"}`,
    `Temporary filename: ${fileName}`,
    "",
    "Return only valid JSON matching this contract:",
    JSON.stringify({
      visibleSource: "Visible sender, platform, or organization; otherwise Unknown",
      visibleSubject: "Visible email subject, report name, or primary headline; otherwise Unknown",
      visibleText: "Concise transcription of all materially readable screenshot text",
      visibleFacts: ["Short visible facts copied or closely transcribed from the screenshot"],
      visibleMetrics: ["Number + metric label + direction, preserving the visible wording"],
      responseExpected: false,
      explicitActionRequested: false,
      confidence: "High | Medium | Low",
      uncertainty: "Only the unreadable or unverified details; otherwise None"
    }, null, 2)
  ].join("\n");
}

function isWeakVisibleEvidence(evidence) {
  if (!evidence) return true;

  const source = clean(evidence.visibleSource).toLowerCase();
  const subject = clean(evidence.visibleSubject).toLowerCase();
  const text = [
    evidence.visibleText,
    ...(evidence.visibleFacts || []),
    ...(evidence.visibleMetrics || [])
  ].filter(Boolean).join(" ").toLowerCase();

  const readableSignalCount = [
    source && source !== "unknown",
    subject && subject !== "unknown",
    text.length >= 12,
    (evidence.visibleFacts || []).length > 0,
    (evidence.visibleMetrics || []).length > 0
  ].filter(Boolean).length;

  const platformSignal = /semrush|search console|business profile|google analytics|ga4|backlink audit|position tracking|site audit/.test(
    `${source} ${subject} ${text}`
  );

  return evidence.confidence === "Low" || readableSignalCount < 2 || (!platformSignal && text.length < 30);
}

function mergeVisibleEvidence(primary, recovery) {
  if (!primary && !recovery) return null;
  if (!primary) return recovery;
  if (!recovery) return primary;

  const chooseText = (first, second) => {
    const a = clean(first);
    const b = clean(second);
    if (!a || a === "Unknown") return b || "Unknown";
    if (!b || b === "Unknown") return a;
    return b.length > a.length ? b : a;
  };

  const combinedText = [primary.visibleText, recovery.visibleText]
    .map(clean)
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .join(" ");

  return normalizeVisibleEvidence({
    visibleSource: chooseText(primary.visibleSource, recovery.visibleSource),
    visibleSubject: chooseText(primary.visibleSubject, recovery.visibleSubject),
    visibleText: combinedText,
    visibleFacts: uniqueTextValues([
      ...(primary.visibleFacts || []),
      ...(recovery.visibleFacts || [])
    ]),
    visibleMetrics: uniqueTextValues([
      ...(primary.visibleMetrics || []),
      ...(recovery.visibleMetrics || [])
    ]),
    responseExpected: Boolean(primary.responseExpected || recovery.responseExpected),
    explicitActionRequested: Boolean(primary.explicitActionRequested || recovery.explicitActionRequested),
    confidence: higherConfidence(primary.confidence, recovery.confidence),
    uncertainty: mergeUncertainty(primary.uncertainty, recovery.uncertainty)
  });
}

function uniqueTextValues(values) {
  const seen = new Set();
  const output = [];

  for (const value of values || []) {
    const cleaned = clean(value);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }

  return output.slice(0, 30);
}

function higherConfidence(first, second) {
  const rank = { Low: 1, Medium: 2, High: 3 };
  const a = normalizeConfidence(first);
  const b = normalizeConfidence(second);
  return rank[b] > rank[a] ? b : a;
}

function mergeUncertainty(first, second) {
  const values = [first, second]
    .map(clean)
    .filter(value => value && value.toLowerCase() !== "none");
  return values.length ? uniqueTextValues(values).join("; ") : "None";
}

async function executeBusinessMeaningStage({
  client,
  clientId,
  fileName,
  visibleEvidence,
  classification,
  env,
  requestId
}) {
  const stageStartedAt = Date.now();
  const stageName = "business_meaning";

  const deterministicMeaning = buildDeterministicBusinessMeaning({
    visibleEvidence,
    classification
  });

  if (deterministicMeaning) {
    return {
      data: deterministicMeaning,
      error: null,
      stage: createStageResult({
        stageName,
        status: STAGE_STATUS.SUCCESS,
        engine: "communication-intelligence-rules",
        model: "deterministic",
        startedAt: stageStartedAt,
        confidence: confidenceToNumber(deterministicMeaning.confidence),
        fallbackUsed: false,
        data: deterministicMeaning
      })
    };
  }

  if (!visibleEvidence || visibleEvidence.confidence === "Low") {
    const fallback = fallbackBusinessMeaning({
      classification,
      reason: "Visible evidence confidence is too low for dependable automated interpretation."
    });

    return {
      data: fallback,
      error: null,
      stage: createStageResult({
        stageName,
        status: STAGE_STATUS.SKIPPED,
        engine: "business-meaning",
        model: COMMUNICATION_REASONING_MODEL,
        startedAt: stageStartedAt,
        confidence: classification.confidence,
        fallbackUsed: true,
        data: fallback
      })
    };
  }

  if (!env?.AI || typeof env.AI.run !== "function") {
    const error = buildOperationalError({
      stage: stageName,
      code: "AI_BINDING_UNAVAILABLE",
      message: "Workers AI is unavailable for business interpretation.",
      retryable: false
    });
    logWorkerError({ requestId, route: ACTIONS.ANALYZE_COMMUNICATION, stage: stageName, error });

    const fallback = fallbackBusinessMeaning({ classification, reason: error.message });
    return {
      data: fallback,
      error,
      stage: createStageResult({
        stageName,
        status: STAGE_STATUS.FALLBACK,
        engine: "business-meaning",
        model: COMMUNICATION_REASONING_MODEL,
        startedAt: stageStartedAt,
        confidence: classification.confidence,
        rawAiError: error.message,
        fallbackUsed: true,
        data: fallback
      })
    };
  }

  const prompt = [
    "You are the Business Meaning Engine for the Global Concepts Media Operating System.",
    "Interpret only the supplied evidence and deterministic classification.",
    "Do not inspect or imagine the original screenshot.",
    "Do not create Proof of Work. Reading a communication is evidence intake, not completed work.",
    "Do not invent causes, results, urgency, or required tasks.",
    "Positive or routine platform monitoring normally means retain and monitor.",
    "A negative condition may require investigation only when the visible evidence supports it.",
    "A work item is appropriate only when a specific action is already established.",
    "",
    "CLIENT CONTEXT",
    JSON.stringify({ client: client || null, clientId: clientId || null, fileName }, null, 2),
    "",
    "DETERMINISTIC CLASSIFICATION",
    JSON.stringify(classification, null, 2),
    "",
    "VISIBLE EVIDENCE",
    JSON.stringify(visibleEvidence, null, 2),
    "",
    "Return only valid JSON matching this contract:",
    JSON.stringify({
      eventDirection: "Positive | Negative | Mixed | Neutral | Unknown",
      operationalSummary: "Concise evidence-grounded event summary",
      businessImpact: "Why it may matter without inventing a result",
      importance: "Informational | Low | Medium | High | Critical",
      recommendedAction: "Smallest useful next step",
      investigationSuggested: false,
      workItemSuggested: false,
      replySuggested: false,
      reasoning: "Evidence-grounded reasoning",
      confidence: "High | Medium | Low"
    }, null, 2)
  ].join("\n");

  const runResult = await runAiJsonWithRetry({
    env,
    model: COMMUNICATION_REASONING_MODEL,
    input: {
      messages: [
        { role: "system", content: "Return one valid JSON object only." },
        { role: "user", content: prompt }
      ]
    },
    stageName,
    requestId,
    route: ACTIONS.ANALYZE_COMMUNICATION,
    timeoutMs: 30000,
    maxRetries: 1
  });

  if (!runResult.ok) {
    const fallback = fallbackBusinessMeaning({
      classification,
      reason: runResult.error.message
    });

    return {
      data: fallback,
      error: runResult.error,
      stage: createStageResult({
        stageName,
        status: STAGE_STATUS.FALLBACK,
        engine: "business-meaning",
        model: COMMUNICATION_REASONING_MODEL,
        startedAt: stageStartedAt,
        confidence: classification.confidence,
        retryCount: runResult.retryCount,
        retryStatus: runResult.retryStatus,
        rawAiError: runResult.error.message,
        fallbackUsed: true,
        data: fallback
      })
    };
  }

  const normalized = normalizeBusinessMeaning(runResult.data);

  return {
    data: normalized,
    error: null,
    stage: createStageResult({
      stageName,
      status: STAGE_STATUS.SUCCESS,
      engine: "business-meaning",
      model: COMMUNICATION_REASONING_MODEL,
      startedAt: stageStartedAt,
      confidence: confidenceToNumber(normalized.confidence),
      retryCount: runResult.retryCount,
      retryStatus: runResult.retryStatus,
      fallbackUsed: false,
      data: normalized
    })
  };
}

function deterministicNotificationClassification(evidence) {
  const searchable = [
    evidence?.visibleSource,
    evidence?.visibleSubject,
    evidence?.visibleText,
    ...(evidence?.visibleFacts || []),
    ...(evidence?.visibleMetrics || [])
  ].filter(Boolean).join(" ").toLowerCase();

  const platformRules = [
    { platform: "semrush", patterns: [/\bsemrush\b/i] },
    { platform: "google_search_console", patterns: [/google search console/i, /\bsearch console\b/i] },
    { platform: "google_business_profile", patterns: [/google business profile/i, /\bbusiness profile\b/i] },
    { platform: "google_analytics", patterns: [/google analytics/i, /\bga4\b/i] }
  ];

  const typeRules = [
    { type: "position_tracking", family: "SEMrush Position Tracking", patterns: [/position tracking/i, /keyword positions?/i, /rankings?/i, /keywords? improved/i, /keywords? declined/i, /top 3/i, /top 10/i] },
    { type: "backlink_audit", family: "SEMrush Backlink Audit", patterns: [/backlink audit/i, /backlinks?/i, /referring domains?/i, /lost domains?/i, /new domains?/i, /toxic(?:ity)?/i] },
    { type: "site_audit", family: "SEMrush Site Audit", patterns: [/site audit/i, /site health/i, /crawled pages?/i, /crawlability/i, /core web vitals/i, /technical issues?/i] },
    { type: "search_performance", family: "Google Search Console", patterns: [/google search console/i, /search performance/i, /search console/i] },
    { type: "business_profile", family: "Google Business Profile", patterns: [/google business profile/i, /business profile/i, /profile views?/i, /calls? from your profile/i] },
    { type: "analytics", family: "Google Analytics", patterns: [/google analytics/i, /\bga4\b/i, /analytics notification/i] },
    { type: "billing_notice", family: "Billing Notice", patterns: [/invoice/i, /billing/i, /payment failed/i, /past due/i, /receipt/i] },
    { type: "access_security", family: "Access or Security Notice", patterns: [/security alert/i, /new sign-in/i, /password/i, /access request/i, /verification code/i, /compromised/i] },
    { type: "client_request", family: "Human Email", patterns: [/can you/i, /could you/i, /please/i, /need you to/i, /let me know/i, /approve/i, /schedule/i] }
  ];

  let platform = "unknown";
  for (const rule of platformRules) {
    if (rule.patterns.some(pattern => pattern.test(searchable))) {
      platform = rule.platform;
      break;
    }
  }

  let notificationType = "unknown";
  let notificationFamily = "Unknown";
  let bestScore = 0;

  for (const rule of typeRules) {
    const score = rule.patterns.reduce((total, pattern) => total + (pattern.test(searchable) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      notificationType = rule.type;
      notificationFamily = rule.family;
    }
  }

  if (platform === "unknown" && notificationType === "client_request") {
    platform = "client_email";
  }

  if (platform === "unknown" && /vendor|provider|support team|service notice/i.test(searchable)) {
    platform = "vendor_email";
    if (notificationType === "unknown") {
      notificationType = "vendor_notice";
      notificationFamily = "Vendor Notice";
    }
  }

  const confidence = notificationType === "unknown"
    ? 0.35
    : bestScore >= 2
      ? 0.98
      : 0.82;

  return {
    platform,
    notificationType,
    notificationFamily,
    method: "deterministic",
    confidence,
    matchedSignalCount: bestScore
  };
}

function buildOperationalDecision({ visibleEvidence, classification, businessMeaning }) {
  const direction = normalizeEventDirection(businessMeaning?.eventDirection);
  const confidence = Math.min(
    classification?.confidence ?? 0.35,
    confidenceToNumber(businessMeaning?.confidence || visibleEvidence?.confidence)
  );

  let routes = {
    saveCommunication: true,
    createInvestigation: normalizeBoolean(businessMeaning?.investigationSuggested, false),
    createWorkItem: normalizeBoolean(businessMeaning?.workItemSuggested, false),
    replyRequired: normalizeBoolean(businessMeaning?.replySuggested, false)
  };

  let importance = normalizeCommunicationImportance(businessMeaning?.importance);

  const automatedPlatforms = new Set([
    "semrush",
    "google_search_console",
    "google_business_profile",
    "google_analytics"
  ]);

  if (automatedPlatforms.has(classification.platform)) {
    routes.replyRequired = false;
  }

  if (direction === "Positive" || direction === "Neutral") {

    // Never create work automatically for positive/neutral notifications.
    routes.createWorkItem = false;

    // Preserve investigation recommendations already made by Business Meaning.

    if (!["High", "Critical"].includes(importance)) {
        importance = "Low";
    }
}

  if (visibleEvidence?.confidence === "Low" || classification.notificationType === "unknown") {
    routes = {
      saveCommunication: true,
      createInvestigation: false,
      createWorkItem: false,
      replyRequired: false
    };
    importance = "Low";
  }

  if (routes.createInvestigation && routes.createWorkItem) {
    routes.createWorkItem = false;
  }

  if (routes.createWorkItem && !visibleEvidence?.explicitActionRequested) {
    routes.createWorkItem = false;
  }

  if (importance === "Critical" && !hasCriticalEvidence(visibleEvidence)) {
    importance = routes.createInvestigation ? "High" : "Medium";
  }

  const communicationType = communicationTypeForClassification(classification);
  const deterministicSources = {
    position_tracking: "SEMrush",
    backlink_audit: "SEMrush",
    site_audit: "SEMrush",
    search_performance: "Google Search Console",
    business_profile: "Google Business Profile",
    analytics: "Google Analytics"
  };
  const source = deterministicSources[classification?.notificationType]
    || normalizeSource(classification, visibleEvidence);
  const operationalLabel = clean(businessMeaning?.operationalLabel)
    || operationalLabelForNotificationType(classification?.notificationType, direction);
  const recordPurpose = clean(businessMeaning?.recordPurpose)
    || recordPurposeForNotificationType(classification?.notificationType);
  const title = buildCommunicationTitle({ source, classification, direction, operationalLabel });
  const operationalSummary = clean(businessMeaning?.operationalSummary) || buildEvidenceSummary(visibleEvidence, classification);
  const businessImpact = clean(businessMeaning?.businessImpact) || "The communication should be retained in the client history and reviewed according to the visible evidence.";
  const recommendedAction = clean(businessMeaning?.recommendedAction) || defaultOperationalAction({ routes, visibleEvidence });
  const reasoning = clean(businessMeaning?.reasoning) || `Routing is based on deterministic ${classification.notificationFamily} classification and the visible evidence confidence.`;

  return {
    source,
    communicationType,
    title,
    operationalSummary,
    businessImpact,
    importance,
    operationalPriority: importance,
    operationalLabel,
    recordPurpose,
    proposedRoute: routes.createWorkItem
      ? "Work Item"
      : routes.createInvestigation
        ? "Investigation"
        : routes.replyRequired
          ? "Response"
          : "Information",
    recommendedRoutes: routes,
    recommendedAction,
    reasoning,
    classificationConfidence: confidence,
    notificationFamily: classification.notificationFamily,
    classification: {
      ...classification,
      eventDirection: direction,
      evidenceConfidence: visibleEvidence?.confidence || "Low",
      uncertainty: visibleEvidence?.uncertainty || "Unknown",
      visibleFacts: visibleEvidence?.visibleFacts || [],
      visibleMetrics: visibleEvidence?.visibleMetrics || []
    }
  };
}

function buildConsultantSummary({ classification, visibleEvidence, businessMeaning, operationalDecision }) {
  const fallbackUsed = Boolean(businessMeaning?.fallbackUsed);
  const summary = fallbackUsed
    ? `${operationalDecision.operationalSummary} Automated business interpretation was unavailable, so deterministic classification and conservative routing were preserved.`
    : operationalDecision.operationalSummary;

  return {
    summary,
    notification: `${classification.notificationFamily} (${classification.notificationType})`,
    route: operationalDecision.proposedRoute,
    importance: operationalDecision.importance,
    nextAction: operationalDecision.recommendedAction,
    manualReviewRequired: fallbackUsed || visibleEvidence?.confidence === "Low" || classification.notificationType === "unknown",
    fallbackUsed
  };
}

function normalizeVisibleEvidence(value) {
  const evidence = isPlainObject(value) ? value : {};
  return {
    visibleSource: clean(evidence.visibleSource) || "Unknown",
    visibleSubject: clean(evidence.visibleSubject) || "Unknown",
    visibleText: clean(evidence.visibleText),
    visibleFacts: normalizeTextArray(evidence.visibleFacts),
    visibleMetrics: normalizeTextArray(evidence.visibleMetrics),
    responseExpected: normalizeBoolean(evidence.responseExpected, false),
    explicitActionRequested: normalizeBoolean(evidence.explicitActionRequested, false),
    confidence: normalizeConfidence(evidence.confidence),
    uncertainty: clean(evidence.uncertainty) || "None"
  };
}

function fallbackVisibleEvidence(reason) {
  return normalizeVisibleEvidence({
    visibleSource: "Unknown",
    visibleSubject: "Unknown",
    visibleText: "",
    visibleFacts: [],
    visibleMetrics: [],
    responseExpected: false,
    explicitActionRequested: false,
    confidence: "Low",
    uncertainty: reason || "The screenshot evidence could not be extracted."
  });
}

function buildDeterministicBusinessMeaning({ visibleEvidence, classification }) {
  const platform = classification?.platform || "unknown";
  const type = classification?.notificationType || "unknown";

  // Supported notification types are resolved by notificationType first.
  // The platform value is retained for diagnostics, but a visually misread or
  // missing platform must never force a known notification into the AI path.
  const supportedTypes = new Set([
    "position_tracking",
    "backlink_audit",
    "site_audit",
    "search_performance",
    "business_profile",
    "analytics"
  ]);

  if (!supportedTypes.has(type)) return null;

  const text = [
    visibleEvidence?.visibleSubject,
    visibleEvidence?.visibleText,
    ...(visibleEvidence?.visibleFacts || []),
    ...(visibleEvidence?.visibleMetrics || [])
  ].filter(Boolean).join(" ").toLowerCase();

  const negative = /declin|decreas|drop|lost|loss|error|warning|critical|failed|down|toxic|issue|problem|negative/.test(text);
  const positive = /improv|increas|gain|grew|growth|up\b|new high|milestone|positive/.test(text);
  const eventDirection = negative && positive
    ? "Mixed"
    : negative
      ? "Negative"
      : positive
        ? "Positive"
        : "Neutral";

  const facts = [
    ...(visibleEvidence?.visibleFacts || []),
    ...(visibleEvidence?.visibleMetrics || [])
  ].filter(Boolean).slice(0, 3);
  const evidenceDetail = facts.length ? ` Visible evidence: ${facts.join("; ")}.` : "";

  const templates = {
    position_tracking: {
      summary: negative
        ? `SEMrush Position Tracking detected a decline or adverse movement among monitored keyword rankings.${evidenceDetail} The change should be evaluated against the tracked keyword set and supporting search-performance data.`
        : `SEMrush Position Tracking detected keyword ranking changes for the monitored campaign.${evidenceDetail} This communication records current search visibility and should be retained as historical monitoring evidence. Individual keyword movement should be evaluated as part of a longer-term trend rather than as an isolated event.`,
      impact: negative
        ? "Ranking declines may affect organic search visibility. The condition should be compared with future Position Tracking reports, Google Search Console data, and traffic performance before corrective work is created."
        : "Keyword rankings have changed within the monitored campaign. This establishes historical performance evidence but does not, by itself, indicate a business issue requiring corrective action. Continued declines across multiple reporting periods or supporting evidence from Search Console or Analytics should trigger investigation.",
      action: negative
        ? "Save this communication as historical SEO monitoring evidence and review the affected tracked keywords. Open an Investigation if the decline is sustained or confirmed by Search Console or traffic data."
        : "Save this communication as historical SEO monitoring evidence and continue routine monitoring. Open an Investigation only if ranking declines continue across future reports or are confirmed by additional performance metrics.",
      reasoning: negative
        ? "A potentially adverse ranking movement was reported. Verification is appropriate before corrective work is assigned."
        : "Routine monitoring communication. No operational action is currently required beyond maintaining the historical record.",
      recordPurpose: "Historical SEO Monitoring Evidence",
      operationalLabel: negative ? "Ranking Change Review" : "Monitoring Update"
    },
    backlink_audit: {
      summary: `A SEMrush Backlink Audit notification was received.${evidenceDetail}`,
      impact: negative
        ? "Visible backlink loss or toxicity may affect authority, but the condition should be verified before corrective work is assigned."
        : "The notification documents backlink-profile activity and should be retained for trend monitoring.",
      action: negative
        ? "Save the communication and verify the reported backlink condition in SEMrush."
        : "Save the communication to the client history and continue monitoring backlink changes."
    },
    site_audit: {
      summary: `A SEMrush Site Audit notification was received.${evidenceDetail}`,
      impact: negative
        ? "Visible technical issues may affect crawlability or site performance and should be verified in the Site Audit project."
        : "The notification documents the current technical-audit condition and should be retained for monitoring.",
      action: negative
        ? "Save the communication and verify the reported Site Audit condition before creating corrective work."
        : "Save the communication to the client history and continue monitoring Site Audit changes."
    },
    search_performance: {
      summary: `A Google Search Console notification was received.${evidenceDetail}`,
      impact: negative
        ? "The visible search-performance condition may affect organic traffic and should be checked in Search Console."
        : "The notification documents search-performance activity and should be retained as monitoring evidence.",
      action: negative
        ? "Save the communication and verify the reported condition in Google Search Console."
        : "Save the communication to the client history and continue monitoring search performance."
    },
    business_profile: {
      summary: `A Google Business Profile notification was received.${evidenceDetail}`,
      impact: negative
        ? "The visible profile condition may affect local discovery or customer actions and should be verified in the profile."
        : "The notification documents Business Profile activity and should be retained for local-presence monitoring.",
      action: negative
        ? "Save the communication and verify the reported condition in Google Business Profile."
        : "Save the communication to the client history and continue monitoring the Business Profile."
    },
    analytics: {
      summary: `A Google Analytics notification was received.${evidenceDetail}`,
      impact: negative
        ? "The visible analytics condition may indicate a measurement or traffic change that should be verified before action is assigned."
        : "The notification documents analytics activity and should be retained for performance monitoring.",
      action: negative
        ? "Save the communication and verify the reported condition in GA4."
        : "Save the communication to the client history and continue monitoring analytics."
    }
  };

  const template = templates[type];
  if (!template) return null;

  const investigationSuggested =
    type === "backlink_audit"
      ? true
      : negative && [
          "position_tracking",
          "site_audit",
          "search_performance",
          "business_profile",
          "analytics"
        ].includes(type);

  return {
    eventDirection,
    operationalSummary: template.summary,
    businessImpact: template.impact,
    importance: negative ? "Medium" : "Low",
    recommendedAction: template.action,
    investigationSuggested,
    workItemSuggested: false,
    replySuggested: false,
    reasoning: template.reasoning || `Routine ${classification.notificationFamily} communication. No operational action is currently required beyond maintaining the historical record.`,
    recordPurpose: template.recordPurpose || recordPurposeForNotificationType(type),
    operationalLabel: template.operationalLabel || operationalLabelForNotificationType(type, eventDirection),
    confidence: Number(classification.confidence || 0) >= 0.9 ? "High" : "Medium",
    fallbackUsed: false,
    interpretationMethod: "deterministic",
    intelligenceTrace: {
      engine: "communication-intelligence-v1",
      path: "deterministic",
      definition: type,
      platform,
      notificationType: type,
      aiUsed: false,
      fallbackUsed: false
    }
  };
}

function recordPurposeForNotificationType(type) {
  const purposes = {
    position_tracking: "Historical SEO Monitoring Evidence",
    backlink_audit: "Backlink Health Monitoring Evidence",
    site_audit: "Technical SEO Monitoring Evidence",
    search_performance: "Organic Search Performance Evidence",
    business_profile: "Local Presence Monitoring Evidence",
    analytics: "Website Performance Monitoring Evidence"
  };
  return purposes[type] || "Operational Communication Record";
}

function operationalLabelForNotificationType(type, direction) {
  if (direction === "Negative") return "Review Required";
  const labels = {
    position_tracking: "Monitoring Update",
    backlink_audit: "Backlink Monitoring Update",
    site_audit: "Technical Monitoring Update",
    search_performance: "Search Performance Update",
    business_profile: "Local Presence Update",
    analytics: "Analytics Update"
  };
  return labels[type] || "Information";
}

function normalizeBusinessMeaning(value) {
  const meaning = isPlainObject(value) ? value : {};
  return {
    eventDirection: normalizeEventDirection(meaning.eventDirection),
    operationalSummary: clean(meaning.operationalSummary),
    businessImpact: clean(meaning.businessImpact),
    importance: normalizeCommunicationImportance(meaning.importance),
    recommendedAction: clean(meaning.recommendedAction),
    investigationSuggested: normalizeBoolean(meaning.investigationSuggested, false),
    workItemSuggested: normalizeBoolean(meaning.workItemSuggested, false),
    replySuggested: normalizeBoolean(meaning.replySuggested, false),
    reasoning: clean(meaning.reasoning),
    recordPurpose: clean(meaning.recordPurpose),
    operationalLabel: clean(meaning.operationalLabel),
    confidence: normalizeConfidence(meaning.confidence),
    fallbackUsed: false,
    intelligenceTrace: {
      engine: "communication-intelligence-v1",
      path: "ai",
      definition: null,
      platform: null,
      notificationType: null,
      aiUsed: true,
      fallbackUsed: false
    }
  };
}

function fallbackBusinessMeaning({ classification, reason }) {
  return {
    eventDirection: "Unknown",
    operationalSummary: `A ${classification?.notificationFamily || "communication"} was received, but automated business interpretation was unavailable.`,
    businessImpact: "The communication should be retained and reviewed manually before additional operational work is created.",
    importance: "Low",
    recommendedAction: "Save the communication and complete a manual consultant review.",
    investigationSuggested: false,
    workItemSuggested: false,
    replySuggested: false,
    reasoning: reason || "A conservative fallback was used.",
    confidence: "Low",
    fallbackUsed: true,
    intelligenceTrace: {
      engine: "communication-intelligence-v1",
      path: "fallback",
      definition: null,
      platform: classification?.platform || "unknown",
      notificationType: classification?.notificationType || "unknown",
      aiUsed: true,
      fallbackUsed: true
    }
  };
}

/* =========================================================
   Controlled AI Execution and Diagnostics
   ========================================================= */

async function runAiJsonWithRetry({
  env,
  model,
  input,
  stageName,
  requestId,
  route,
  timeoutMs = 30000,
  maxRetries = 1
}) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await withTimeout(
        env.AI.run(model, input),
        timeoutMs,
        `${stageName} timed out after ${timeoutMs} ms.`
      );
      const parsed = parseAiJsonResponse(response, stageName);
      return {
        ok: true,
        data: parsed,
        retryCount: attempt,
        retryStatus: attempt === 0 ? "not_required" : "succeeded"
      };
    } catch (error) {
      lastError = error;
      const retryable = isRetryableAiError(error);
      logWorkerError({
        requestId,
        route,
        stage: stageName,
        error,
        extra: { attempt, retryable, model }
      });

      if (!retryable || attempt >= maxRetries) break;
    }
  }

  const operationalError = buildOperationalError({
    stage: stageName,
    code: errorCodeForAiFailure(lastError),
    message: safeErrorMessage(lastError),
    retryable: isRetryableAiError(lastError)
  });

  return {
    ok: false,
    error: operationalError,
    retryCount: maxRetries,
    retryStatus: maxRetries > 0 ? "failed" : "not_attempted"
  };
}

function parseAiJsonResponse(response, label = "AI") {
  const candidate = typeof response === "string"
    ? response
    : response?.response ?? response?.description ?? response?.result ?? response?.output ?? "";

  if (isPlainObject(candidate)) return candidate;

  const text = String(candidate || "").trim();
  if (!text) throw new Error(`${label} returned an empty response.`);

  const withoutFences = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(withoutFences);
    if (!isPlainObject(parsed)) throw new Error(`${label} JSON must be an object.`);
    return parsed;
  } catch (firstError) {
    const start = withoutFences.indexOf("{");
    const end = withoutFences.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(withoutFences.slice(start, end + 1));
        if (!isPlainObject(parsed)) throw new Error(`${label} JSON must be an object.`);
        return parsed;
      } catch {
        // Use the explicit malformed JSON error below.
      }
    }
    throw new Error(`${label} did not return valid JSON.`);
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function isRetryableAiError(error) {
  const message = safeErrorMessage(error).toLowerCase();
  return /timeout|timed out|429|rate limit|temporar|unavailable|overloaded|502|503|504|empty response/.test(message);
}

function errorCodeForAiFailure(error) {
  const message = safeErrorMessage(error).toLowerCase();
  if (/timeout|timed out/.test(message)) return "AI_TIMEOUT";
  if (/empty response/.test(message)) return "AI_EMPTY_RESPONSE";
  if (/valid json|json/.test(message)) return "AI_MALFORMED_JSON";
  if (/429|rate limit/.test(message)) return "AI_RATE_LIMIT";
  return "AI_MODEL_FAILURE";
}

function createStageResult({
  stageName,
  status,
  engine,
  model,
  startedAt,
  confidence = null,
  retryCount = 0,
  retryStatus = "not_required",
  rawAiError = null,
  fallbackUsed = false,
  data = null
}) {
  return {
    stageName,
    status,
    engine,
    model,
    executionTimeMs: Date.now() - startedAt,
    confidence,
    retryCount,
    retryStatus,
    rawAiError,
    fallbackUsed,
    data
  };
}

function buildOperationalError({ stage, code, message, retryable }) {
  return { stage, code, message, retryable: Boolean(retryable) };
}

function logWorkerError({ requestId, route, stage, error, extra = null }) {
  console.error("[GCM OS]", {
    requestId,
    route,
    stage,
    error: safeErrorMessage(error),
    stack: error instanceof Error ? error.stack : null,
    extra
  });
}

/* =========================================================
   Operational Decision Commit — D1 Production Write
   ========================================================= */

async function handleCommitOperationalDecision(body, env, requestId) {
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
   Client Workspace — D1 Operational Record
   ========================================================= */

async function handleClientWorkspace(body, env, requestId) {
  const db = getDatabase(env);
  const clientCode = clean(body?.clientCode || body?.client || "SES");

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_CLIENT_WORKSPACE,
      error: "The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."
    }, 503);
  }

  if (!clientCode) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_CLIENT_WORKSPACE,
      error: "A clientCode is required."
    }, 400);
  }

  try {
    const client = await db.prepare(`
      SELECT id, client_code, name, legal_name, status, website, industry,
             primary_contact_name, primary_contact_email, notes,
             created_at, updated_at
      FROM clients
      WHERE client_code = ? COLLATE NOCASE
      LIMIT 1
    `).bind(clientCode).first();

    if (!client) {
      return jsonResponse({
        ok: false,
        requestId,
        action: ACTIONS.GET_CLIENT_WORKSPACE,
        error: `Client "${clientCode}" was not found.`
      }, 404);
    }

    const [communicationsResult, investigationsResult, workItemsResult,
      evidenceResult, alertsResult, proofResult] = await Promise.all([
      db.prepare(`SELECT * FROM communications WHERE client_id = ? ORDER BY occurred_at DESC, id DESC`).bind(client.id).all(),
      db.prepare(`SELECT * FROM investigations WHERE client_id = ? ORDER BY opened_at DESC, id DESC`).bind(client.id).all(),
      db.prepare(`
        SELECT * FROM work_items
        WHERE client_id = ?
        ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                 created_at DESC, id DESC
      `).bind(client.id).all(),
      db.prepare(`SELECT * FROM evidence WHERE client_id = ? ORDER BY captured_at DESC, id DESC`).bind(client.id).all(),
      db.prepare(`
        SELECT * FROM alerts
        WHERE client_id = ?
        ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
                 created_at DESC, id DESC
      `).bind(client.id).all(),
      db.prepare(`SELECT * FROM activity_records WHERE client_id = ? ORDER BY activity_date DESC, id DESC`).bind(client.id).all()
    ]);

    const communications = rowsOf(communicationsResult);
    const investigations = rowsOf(investigationsResult);
    const workItems = rowsOf(workItemsResult);
    const evidence = rowsOf(evidenceResult);
    const alerts = rowsOf(alertsResult);
    const proofOfWork = rowsOf(proofResult);

    const record = buildClientWorkspaceRecord({
      client,
      communications,
      investigations,
      workItems,
      evidence,
      alerts,
      proofOfWork
    });

    return jsonResponse({
      ok: true,
      requestId,
      action: ACTIONS.GET_CLIENT_WORKSPACE,
      version: VERSION,
      source: "D1",
      generatedAt: new Date().toISOString(),
      record,
      operational: { client, communications, investigations, workItems, evidence, alerts, proofOfWork },
      counts: {
        communications: communications.length,
        openCommunications: communications.filter(item => !["closed", "ignored"].includes(normalizeStatus(item.status))).length,
        investigations: investigations.length,
        openInvestigations: investigations.filter(item => !["resolved", "closed"].includes(normalizeStatus(item.status))).length,
        workItems: workItems.length,
        openWorkItems: workItems.filter(item => !["completed", "complete", "cancelled", "closed"].includes(normalizeStatus(item.status))).length,
        proofOfWork: proofOfWork.length,
        activeAlerts: alerts.filter(item => ["open", "acknowledged"].includes(normalizeStatus(item.status))).length,
        evidence: evidence.length
      }
    });
  } catch (error) {
    logWorkerError({ requestId, route: ACTIONS.GET_CLIENT_WORKSPACE, stage: "d1_workspace", error });
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_CLIENT_WORKSPACE,
      error: safeErrorMessage(error)
    }, 500);
  }
}

function buildClientWorkspaceRecord({ client, communications, investigations, workItems, evidence, alerts, proofOfWork }) {
  const openWork = workItems.filter(item => !["completed", "complete", "cancelled", "closed"].includes(normalizeStatus(item.status)));
  const activeAlerts = alerts.filter(item => ["open", "acknowledged"].includes(normalizeStatus(item.status)));
  const latestActivity = latestDate([
    ...communications.map(item => item.occurred_at),
    ...investigations.map(item => item.opened_at),
    ...workItems.map(item => item.updated_at || item.created_at),
    ...proofOfWork.map(item => item.activity_date)
  ]);
  const firstWork = openWork[0] || null;
  const firstAlert = activeAlerts[0] || null;

  return {
    schemaVersion: "1.0.0",
    businessId: slugify(client.name || client.client_code),
    business: {
      name: client.name,
      legalName: client.legal_name || null,
      industry: client.industry || "Needs Verification",
      businessType: null,
      website: client.website || null,
      primaryMarket: null,
      serviceAreas: [],
      address: { street: null, city: null, state: null, postalCode: null, country: null },
      phone: null,
      email: client.primary_contact_email || null,
      primaryContact: {
        name: client.primary_contact_name || null,
        role: null,
        phone: null,
        email: client.primary_contact_email || null
      },
      summary: client.notes || `${client.name} is a ${client.status} Global Concepts Media client.`,
      tags: ["Client", titleCase(client.status)]
    },
    relationship: {
      recordType: "Client",
      status: titleCase(client.status),
      entryMethod: "Existing Client",
      stage: openWork.length ? "Implementation" : "Management",
      clientSince: dateOnly(client.created_at),
      clientEnded: null,
      monthlyAgreement: null,
      billingStatus: null,
      accountHealth: activeAlerts.length ? "Needs Attention" : "Healthy",
      accountHealthReason: firstAlert?.description || firstAlert?.title || null
    },
    workspace: {
      currentPriority: firstAlert?.title || firstWork?.title || "No open priority is recorded.",
      nextAction: firstWork?.title || firstAlert?.title || "Review the client record.",
      nextActionReason: firstWork?.description || firstAlert?.description || "No open operational record currently requires action.",
      nextReviewDate: firstAlert?.due_at ? dateOnly(firstAlert.due_at) : null,
      lastClientContact: dateOnly(communications[0]?.occurred_at),
      lastWorkDate: dateOnly(latestActivity),
      owner: firstWork?.owner || firstAlert?.owner || "Global Concepts Media",
      workingNotes: "Loaded from the live GCM OS D1 operational database."
    },
    currentPriorities: activeAlerts.map(mapAlertToPriority),
    workQueue: openWork.map(mapWorkItem),
    advertising: { currentStatus: "Unknown", monthlyBudget: null, campaigns: [] },
    seo: { status: "Unknown", primaryProject: null, visibility: null, topThreeKeywords: null, topTenKeywords: null, keywordsImproved: null, keywordsDeclined: null, technicalIssuesOpen: null, lastReviewed: null, nextAction: null, records: [] },
    website: { platform: null, repository: null, productionUrl: client.website || null, status: client.website ? "Active" : "Unknown", lastDeployment: null, nextAction: null, changes: [] },
    socialMedia: { status: "Unknown", lastReviewed: null, nextAction: null, channels: [], content: [] },
    proofOfWork: proofOfWork.map(item => mapProofOfWork(item, evidence)),
    metrics: [],
    results: [],
    growthReviews: [],
    caseStudy: { status: "Not Ready", title: null, summary: null, challenge: null, strategy: null, workCompleted: [], results: [], proofOfWorkIds: [], resultIds: [], notes: null },
    documents: [],
    history: buildOperationalHistory({ communications, investigations, workItems, proofOfWork }),
    metadata: {
      source: "D1",
      clientCode: client.client_code,
      clientId: client.id,
      generatedAt: new Date().toISOString(),
      updatedAt: client.updated_at,
      operationalCounts: {
        communications: communications.length,
        investigations: investigations.length,
        workItems: workItems.length,
        proofOfWork: proofOfWork.length,
        alerts: activeAlerts.length,
        evidence: evidence.length
      },
      dataQuality: "Live operational records"
    }
  };
}

function mapWorkItem(item) {
  return {
    id: `work-${item.id}`,
    title: item.title,
    description: item.description || "",
    category: item.category || "General",
    status: workspaceStatus(item.status),
    priority: workspacePriority(item.priority),
    owner: item.owner || "Global Concepts Media",
    estimatedMinutes: null,
    actualMinutes: 0,
    createdDate: dateOnly(item.created_at),
    dueDate: null,
    completedDate: dateOnly(item.completed_at),
    businessValue: item.expected_impact || item.actual_impact || "",
    nextAction: item.description || item.title,
    proofOfWorkId: null
  };
}

function mapAlertToPriority(item) {
  const severity = normalizeStatus(item.severity);
  const status = normalizeStatus(item.status);
  return {
    id: `alert-${item.id}`,
    title: item.title,
    category: titleCase(item.related_type || "Alert"),
    status: ["resolved", "closed"].includes(status) ? "Complete" : "In Progress",
    priority: severity === "critical" ? "Critical" : severity === "warning" || severity === "high" ? "High" : "Medium",
    owner: item.owner || "Global Concepts Media",
    businessValue: item.description || "This condition requires review.",
    dueDate: dateOnly(item.due_at),
    nextAction: item.description || item.title
  };
}

function mapProofOfWork(item, evidence) {
  const linkedEvidence = evidence
    .filter(entry => item.work_item_id && Number(entry.work_item_id) === Number(item.work_item_id))
    .map(entry => ({
      type: titleCase(entry.evidence_type || "Evidence"),
      label: entry.source || "Evidence",
      url: entry.url || null,
      value: entry.description || ""
    }));

  if (item.evidence_reference) {
    linkedEvidence.unshift({
      type: titleCase(item.evidence_type || "Evidence"),
      label: item.source_type || "Proof of Work",
      url: /^https?:\/\//i.test(item.evidence_reference) ? item.evidence_reference : null,
      value: item.evidence_reference
    });
  }

  const impact = item.actual_impact || item.expected_impact || "";
  return {
    id: `pow-${item.id}`,
    date: dateOnly(item.activity_date),
    phase: "Client Operations",
    category: item.category || "General",
    task: item.activity,
    universeImpact: impact,
    canonLocked: true,
    assetCreated: null,
    status: workspaceStatus(item.status || "completed"),
    priority: workspacePriority(item.priority),
    version: null,
    timeMinutes: item.time_minutes || 0,
    nextAction: null,
    revenuePath: false,
    notes: item.notes || "",
    milestoneTag: item.win ? "Win" : null,
    businessValue: impact,
    evidence: linkedEvidence,
    result: item.actual_impact || "",
    resultStatus: item.actual_impact ? "Recorded" : "Not Measured",
    caseStudyEligible: Boolean(item.win),
    sourceWorkItemId: item.work_item_id ? `work-${item.work_item_id}` : null
  };
}

function buildOperationalHistory({ communications, investigations, workItems, proofOfWork }) {
  return [
    ...communications.map(item => ({
      id: `communication-${item.id}`,
      date: dateOnly(item.occurred_at),
      time: timeOnly(item.occurred_at),
      type: "Communication",
      category: item.category || "Communication",
      title: item.subject || `${item.source} communication`,
      description: item.ai_summary || item.raw_content || "",
      sourceId: `communication-${item.id}`,
      createdBy: item.owner || "Global Concepts Media"
    })),
    ...investigations.map(item => ({
      id: `investigation-${item.id}`,
      date: dateOnly(item.opened_at),
      time: timeOnly(item.opened_at),
      type: "Investigation",
      category: item.category || "Investigation",
      title: item.title,
      description: item.finding_summary || item.description || "",
      sourceId: `investigation-${item.id}`,
      createdBy: item.owner || item.assigned_to || "Global Concepts Media"
    })),
    ...workItems.map(item => ({
      id: `work-${item.id}`,
      date: dateOnly(item.updated_at || item.created_at),
      time: timeOnly(item.updated_at || item.created_at),
      type: "Work",
      category: item.category || "General",
      title: item.title,
      description: item.description || "",
      sourceId: `work-${item.id}`,
      createdBy: item.owner || "Global Concepts Media"
    })),
    ...proofOfWork.map(item => ({
      id: `proof-${item.id}`,
      date: dateOnly(item.activity_date),
      time: "00:00:00",
      type: "Proof of Work",
      category: item.category || "General",
      title: item.activity,
      description: item.actual_impact || item.expected_impact || item.notes || "",
      sourceId: `pow-${item.id}`,
      createdBy: item.owner || "Global Concepts Media"
    }))
  ];
}

/* =========================================================
   Shared Operational Helpers
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

function communicationTypeForClassification(classification) {
  const types = {
    position_tracking: "SEO Ranking Alert",
    backlink_audit: "SEO Backlink Alert",
    site_audit: "Technical SEO Audit Alert",
    search_performance: "Search Performance Notification",
    business_profile: "Local Presence Notification",
    analytics: "Analytics Notification",
    client_request: "Client or Human Communication",
    vendor_notice: "Vendor Notice",
    billing_notice: "Billing Notice",
    access_security: "Access Alert"
  };
  return types[classification?.notificationType] || "General Communication";
}

function normalizeSource(classification, evidence) {
  const sources = {
    semrush: "SEMrush",
    google_search_console: "Google Search Console",
    google_business_profile: "Google Business Profile",
    google_analytics: "Google Analytics",
    client_email: "Client Email",
    vendor_email: "Vendor Email"
  };

  // A high-confidence deterministic platform classification outranks a
  // generic or visually misread sender label from the screenshot model.
  const classifiedSource = sources[classification?.platform];
  if (classifiedSource && Number(classification?.confidence || 0) >= 0.8) {
    return classifiedSource;
  }

  const visibleSource = clean(evidence?.visibleSource);
  if (visibleSource && visibleSource !== "Unknown") return visibleSource;

  return classifiedSource || "Unknown";
}

function buildCommunicationTitle({ source, classification, direction, operationalLabel }) {
  const label = classification?.notificationFamily && classification.notificationFamily !== "Unknown"
    ? classification.notificationFamily
    : source;
  const suffix = clean(operationalLabel)
    || (direction && direction !== "Unknown" ? direction : "");
  return suffix ? `${label} — ${suffix}` : label;
}

function buildEvidenceSummary(evidence, classification) {
  const facts = [...(evidence?.visibleFacts || []), ...(evidence?.visibleMetrics || [])].slice(0, 3);
  return facts.length
    ? `${classification.notificationFamily} communication: ${facts.join("; ")}.`
    : `A ${classification.notificationFamily} communication was received.`;
}

function defaultOperationalAction({ routes, visibleEvidence }) {
  if (routes.replyRequired) return "Review the request and prepare the required response.";
  if (routes.createWorkItem) return "Complete the established operational action.";
  if (routes.createInvestigation) return "Verify the condition and determine whether corrective work is required.";
  if (visibleEvidence?.confidence === "Low") return "Save the communication and manually verify the unreadable details.";
  return "Save the communication to the client history and continue monitoring.";
}

function hasCriticalEvidence(evidence) {
  const text = [
    evidence?.visibleSubject,
    evidence?.visibleText,
    ...(evidence?.visibleFacts || []),
    ...(evidence?.visibleMetrics || [])
  ].filter(Boolean).join(" ").toLowerCase();
  return /security breach|compromised|service suspended|account suspended|payment failed|expires? today|expired|website down|outage|malware|hacked|data loss/.test(text);
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

function normalizeEventDirection(value) {
  const allowed = {
    positive: "Positive",
    negative: "Negative",
    mixed: "Mixed",
    neutral: "Neutral",
    unknown: "Unknown"
  };
  return allowed[clean(value).toLowerCase()] || "Unknown";
}

function normalizeConfidence(value) {
  const normalized = clean(value).toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "low") return "Low";
  return "Medium";
}

function confidenceToNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  const normalized = normalizeConfidence(value);
  return normalized === "High" ? 0.9 : normalized === "Low" ? 0.35 : 0.65;
}

function normalizeTextArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(clean).filter(Boolean).slice(0, 30);
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

async function createOperationalDecisionExternalId({ clientId, occurredAt, decision }) {
  const fingerprint = JSON.stringify({
    clientId,
    occurredDate: String(occurredAt || "").slice(0, 10),
    source: decision.source.toLowerCase(),
    communicationType: decision.communicationType.toLowerCase(),
    title: decision.title.toLowerCase(),
    operationalSummary: decision.operationalSummary.toLowerCase()
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint));
  const hash = [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
  return `gcm-${clientId}-${hash}`;
}

function dataUrlToByteArray(dataUrl) {
  const match = String(dataUrl || "").match(/^data:image\/(?:png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new Error("The screenshot must be a PNG, JPG, JPEG, or WEBP data URL.");
  const binary = atob(match[1].replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return [...bytes];
}

function firstResultId(result) {
  const rows = Array.isArray(result?.results) ? result.results : [];
  const id = rows[0]?.id;
  return id === undefined || id === null ? null : Number(id);
}

function getDatabase(env) {
  return env?.DB || env?.GCM_OS_DB || env?.DATABASE || null;
}

function rowsOf(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function workspaceStatus(value) {
  const statuses = {
    open: "Not Started",
    planned: "Planned",
    in_progress: "In Progress",
    blocked: "Blocked",
    implemented: "In Progress",
    verifying: "Waiting",
    completed: "Complete",
    complete: "Complete",
    closed: "Complete",
    cancelled: "Deferred"
  };
  return statuses[String(value || "").toLowerCase()] || titleCase(value || "Not Started");
}

function workspacePriority(value) {
  const priorities = { urgent: "Critical", high: "High", normal: "Medium", low: "Low" };
  return priorities[String(value || "").toLowerCase()] || "Medium";
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function slugify(value) {
  return String(value || "client")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "client";
}

function dateOnly(value) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

function timeOnly(value) {
  const match = String(value || "").match(/T(\d{2}:\d{2}:\d{2})/);
  return match ? match[1] : "00:00:00";
}

function latestDate(values) {
  return values.filter(Boolean).sort().reverse()[0] || null;
}

function safeErrorMessage(error) {
  if (error instanceof Error) return error.message || "Unknown error.";
  if (isPlainObject(error) && clean(error.message)) return clean(error.message);
  return clean(error) || "Unknown error.";
}

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders
  });
}
