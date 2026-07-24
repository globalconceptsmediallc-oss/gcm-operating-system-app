/* =========================================================
   Global Concepts Media Operating System
   File: routes/communicationAnalysis.js
   Version: 7.3.5
   Source: Production Worker 6.3.7
   Purpose: Complete production communication analysis route,
            including pasted-text and screenshot evidence extraction,
            notification classification, business meaning,
            operational routing, and consultant summary.
   ========================================================= */

import {
  VERSION,
  API_CONTRACT_VERSION,
  COMMUNICATION_ANALYSIS_ENGINE_VERSION,
  COMMUNICATION_VISION_MODEL,
  COMMUNICATION_REASONING_MODEL,
  ACTIONS,
  STAGE_STATUS
} from "../shared/config.js";

import {
  clean,
  isPlainObject,
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "../shared/http.js";

import {
  runAiJsonWithRetry,
  createStageResult,
  buildOperationalError
} from "../shared/ai.js";

export async function handleCommunicationAnalysis(body, env, requestId) {
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

  /* Stage 1 + 2: extract evidence without operational reasoning.
     When both pasted text and a screenshot are supplied, use BOTH sources.
     Pasted text preserves dependable readable text while vision contributes
     screenshot-only evidence such as tables, metric cards, rankings, and
     movement values. Neither source is allowed to silently replace the other. */
  if (sourceText && imageDataUrl) {
    const [textExtractionResult, visionExtractionResult] = await Promise.all([
      executeTextExtractionStage({
        sourceText,
        client,
        clientId,
        fileName,
        env,
        requestId
      }),
      executeVisionExtractionStage({
        imageDataUrl,
        sourceText,
        client,
        clientId,
        fileName,
        env,
        requestId
      })
    ]);

    stages.push(textExtractionResult.stage, visionExtractionResult.stage);

    if (textExtractionResult.error) errors.push(textExtractionResult.error);
    if (visionExtractionResult.error) errors.push(visionExtractionResult.error);

    /*
     * Hybrid evidence rule:
     * pasted email text anchors the report identity while vision contributes
     * screenshot-only evidence such as tables, rankings, metrics, and changes.
     * For a recognized Position Tracking email, remove obvious backlink-only
     * hallucinations before merging.
     */
    const textClassification = deterministicNotificationClassification(
      textExtractionResult.data
    );

    const visionEvidenceForMerge =
      textClassification.notificationType === "position_tracking"
        ? sanitizePositionTrackingVisionEvidence(visionExtractionResult.data)
        : visionExtractionResult.data;

    visibleEvidence = mergeVisibleEvidence(
      textExtractionResult.data,
      visionEvidenceForMerge
    );

    const anchoredSubject = clean(textExtractionResult.data?.visibleSubject);
    const anchoredSource = clean(textExtractionResult.data?.visibleSource);

    if (anchoredSubject && anchoredSubject !== "Unknown") {
      visibleEvidence.visibleSubject = anchoredSubject;
    }

    if (anchoredSource && anchoredSource !== "Unknown") {
      visibleEvidence.visibleSource = anchoredSource;
    }
  } else if (sourceText) {
    const extractionResult = await executeTextExtractionStage({
      sourceText,
      client,
      clientId,
      fileName,
      env,
      requestId
    });
    stages.push(extractionResult.stage);

    if (extractionResult.error) errors.push(extractionResult.error);
    visibleEvidence = extractionResult.data;
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

  const detectedClient = detectClientFromEvidence(visibleEvidence);

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
      id: clientId || detectedClient?.id || null,
      name: client || detectedClient?.name || null,
      detectedFromEvidence: Boolean(!client && !clientId && detectedClient)
    },
    input: {
      type: sourceText && imageDataUrl ? "hybrid" : sourceText ? "text" : "screenshot",
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

async function executeTextExtractionStage({
  sourceText,
  client,
  clientId,
  fileName,
  env,
  requestId
}) {
  const stageStartedAt = Date.now();
  const stageName = "evidence_extraction";

  /*
   * Pasted text must remain useful even when Workers AI is unavailable.
   * First perform deterministic line/metric extraction from the supplied text.
   * If the AI binding exists, use AI to enrich that extraction and merge both
   * results so deterministic evidence is never discarded.
   */
  const deterministicEvidence = deterministicTextEvidenceExtraction(sourceText);

  if (!env?.AI || typeof env.AI.run !== "function") {
    return {
      data: deterministicEvidence,
      error: null,
      stage: createStageResult({
        stageName,
        status: STAGE_STATUS.SUCCESS,
        engine: "communication-text-evidence-deterministic",
        model: "deterministic",
        startedAt: stageStartedAt,
        confidence: confidenceToNumber(deterministicEvidence.confidence),
        rawAiError: null,
        fallbackUsed: false,
        data: deterministicEvidence
      })
    };
  }

  const prompt = buildTextEvidencePrompt({
    sourceText,
    client,
    clientId,
    fileName
  });

  const runResult = await runAiJsonWithRetry({
    env,
    model: COMMUNICATION_REASONING_MODEL,
    input: {
      messages: [
        { role: "system", content: "Return one valid JSON object only. Extract evidence; do not interpret it." },
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
    return {
      data: deterministicEvidence,
      error: null,
      stage: createStageResult({
        stageName,
        status: STAGE_STATUS.SUCCESS,
        engine: "communication-text-evidence-deterministic",
        model: "deterministic",
        startedAt: stageStartedAt,
        confidence: confidenceToNumber(deterministicEvidence.confidence),
        retryCount: runResult.retryCount,
        retryStatus: runResult.retryStatus,
        rawAiError: runResult.error?.message || null,
        fallbackUsed: false,
        data: deterministicEvidence
      })
    };
  }

  const aiEvidence = normalizeVisibleEvidence({
    ...runResult.data,
    visibleText: sourceText
  });

  const evidence = mergeVisibleEvidence(deterministicEvidence, aiEvidence);
  evidence.visibleText = sourceText;

  return {
    data: evidence,
    error: null,
    stage: createStageResult({
      stageName,
      status: STAGE_STATUS.SUCCESS,
      engine: "communication-text-evidence-hybrid",
      model: COMMUNICATION_REASONING_MODEL,
      startedAt: stageStartedAt,
      confidence: confidenceToNumber(evidence.confidence),
      retryCount: runResult.retryCount,
      retryStatus: runResult.retryStatus,
      fallbackUsed: false,
      data: evidence
    })
  };
}

function buildTextEvidencePrompt({ sourceText, client, clientId, fileName }) {
  return [
    "You are the Communication Evidence Extractor for the Global Concepts Media Operating System.",
    "Read the supplied business email text and extract only facts explicitly supported by that text.",
    "Do not decide what work should be done.",
    "Do not infer causes, results, previous values, dates, locations, devices, or business outcomes that are not explicitly stated.",
    "The selected client and filename are context only and must not be treated as source evidence.",
    "",
    "PRESERVATION RULES",
    "1. Identify the sender/platform/source when explicitly present.",
    "2. Identify the email subject, report name, or primary notification headline when explicitly present.",
    "3. Put important non-metric statements in visibleFacts as short standalone facts.",
    "4. Put EVERY explicitly stated measurable observation in visibleMetrics.",
    "5. For keyword ranking notifications, preserve the keyword phrase, movement amount/direction, and current/final position whenever stated.",
    "6. Preserve explicitly stated percentages, counts, traffic, clicks, impressions, conversions, cost, revenue, orders, rankings, site-health values, backlink counts, and similar measurements.",
    "7. When a metric includes context such as location, device, search engine, reporting date, or comparison period, keep that context in the metric wording.",
    "8. Do not calculate a prior ranking from a movement amount unless the prior ranking itself is explicitly stated.",
    "9. Do not collapse several keyword movements into a generic phrase such as 'rankings changed'. Each readable movement must be its own visibleMetrics item.",
    "10. Do not omit negative measurements because positive measurements also exist, or vice versa.",
    "11. responseExpected is true only when the source explicitly expects a response.",
    "12. explicitActionRequested is true only when the source explicitly asks for an action.",
    "13. Use Unknown only when a requested identity field truly is not stated.",
    "14. Never wrap the JSON in markdown fences.",
    "",
    `Selected client: ${client || clientId || "Unknown"}`,
    `Temporary filename: ${fileName}`,
    "",
    "PASTED EMAIL TEXT",
    sourceText,
    "",
    "Return only valid JSON matching this contract:",
    JSON.stringify({
      visibleSource: "Explicit sender, platform, or organization; otherwise Unknown",
      visibleSubject: "Explicit email subject, report name, or primary headline; otherwise Unknown",
      visibleText: "The materially readable source text",
      visibleFacts: [
        "Short source-grounded fact",
        "Another short source-grounded fact"
      ],
      visibleMetrics: [
        "Exact measurable observation with its label/value/direction/context",
        "One item per distinct metric or keyword movement"
      ],
      responseExpected: false,
      explicitActionRequested: false,
      confidence: "High | Medium | Low",
      uncertainty: "Only details that could not be verified from the pasted text; otherwise None"
    }, null, 2)
  ].join("\n");
}

function deterministicTextEvidenceExtraction(sourceText) {
  const text = clean(sourceText);
  const rawLines = String(sourceText || "")
    .split(/\r?\n/)
    .map(line => line.replace(/\u00a0/g, " ").trim())
    .filter(Boolean);

  const lines = rawLines.map(clean).filter(Boolean);

  const sourceLine = lines.find(line =>
    /semrush|google search console|search console|google business profile|google analytics|\bga4\b/i.test(line)
  ) || "Unknown";

  const subjectLine = lines.find(line =>
    /position tracking|backlink audit|site audit|search performance|business profile|analytics|ranking|keyword/i.test(line)
  ) || "Unknown";

  const visibleFacts = uniqueTextValues(lines);

  const metricSignals = [
    /\b(?:up|down|improved?|increased?|decreased?|declined?|dropped?|gained?|lost|moved?|rose|fell)\b/i,
    /(?:^|\s)[+-]\s*\d+(?:\.\d+)?(?:%|\b)/i,
    /(?:#\s*\d+|\bposition\s*:?\s*\d+|\brank(?:ing)?\s*:?\s*\d+|\btop\s+\d+\b)/i,
    /\b\d+(?:\.\d+)?\s*%/i,
    /\b(?:clicks?|impressions?|conversions?|orders?|revenue|traffic|backlinks?|domains?|keywords?|site health|sessions?|users?)\b.*\b\d+(?:\.\d+)?\b/i,
    /\b\d+(?:\.\d+)?\b.*\b(?:clicks?|impressions?|conversions?|orders?|revenue|traffic|backlinks?|domains?|keywords?|site health|sessions?|users?)\b/i
  ];

  const metricLines = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!metricSignals.some(pattern => pattern.test(line))) continue;

    // Preserve a nearby label/keyword line when email formatting splits a
    // keyword and its movement/position across adjacent lines.
    const previous = i > 0 ? lines[i - 1] : "";
    const next = i + 1 < lines.length ? lines[i + 1] : "";
    const currentLooksMostlyNumeric = /^[+\-#\d\s.%→>-]+$/.test(line);
    const nextLooksMetric = metricSignals.some(pattern => pattern.test(next));

    if (currentLooksMostlyNumeric && previous && !metricSignals.some(pattern => pattern.test(previous))) {
      metricLines.push(`${previous} — ${line}`);
    } else {
      metricLines.push(line);
    }

    if (!currentLooksMostlyNumeric && nextLooksMetric && next !== line) {
      const nextMostlyNumeric = /^[+\-#\d\s.%→>-]+$/.test(next);
      if (nextMostlyNumeric) metricLines.push(`${line} — ${next}`);
    }
  }

  return normalizeVisibleEvidence({
    visibleSource: sourceLine,
    visibleSubject: subjectLine,
    visibleText: text,
    visibleFacts,
    visibleMetrics: uniqueTextValues(metricLines),
    responseExpected: /\b(?:please reply|reply to|respond|let me know|confirm|approval required|action required)\b/i.test(text),
    explicitActionRequested: /\b(?:please|need you to|can you|could you|action required|review and|fix|update|approve|confirm)\b/i.test(text),
    confidence: text ? "High" : "Low",
    uncertainty: "None"
  });
}


async function executeVisionExtractionStage({
  imageDataUrl,
  sourceText = "",
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
    sourceText,
    client,
    clientId,
    fileName,
    focusedRecovery: false
  });

  const primaryResult = await runAiJsonWithRetry({
    env,
    model: COMMUNICATION_VISION_MODEL,
    input: {
      messages: [
        {
          role: "system",
          content: "You extract only visible evidence from business communication screenshots. Return one valid JSON object only."
        },
        {
          role: "user",
          content: primaryPrompt
        }
      ],
      image: imageDataUrl,
      max_tokens: 1800,
      temperature: 0
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
      sourceText,
      client,
      clientId,
      fileName,
      focusedRecovery: true
    });

    recoveryResult = await runAiJsonWithRetry({
      env,
      model: COMMUNICATION_VISION_MODEL,
      input: {
        messages: [
          {
            role: "system",
            content: "You extract only visible evidence from business communication screenshots. Return one valid JSON object only."
          },
          {
            role: "user",
            content: recoveryPrompt
          }
        ],
        image: imageDataUrl,
        max_tokens: 1800,
        temperature: 0
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

  let evidence = mergeVisibleEvidence(primaryEvidence, recoveryEvidence);

  /*
   * Position Tracking screenshots often contain small metric and keyword tables
   * that are easy for a broad screenshot pass to miss. When the pasted text
   * anchors the report as Position Tracking, run one additional narrow pass
   * devoted only to the visible summary metrics and keyword rows.
   *
   * This pass is enrichment only. It cannot change the report family and is
   * sanitized before being merged with the broader evidence.
   */
  const positionTrackingAnchored = /\bposition tracking\b/i.test(clean(sourceText));
  let tableResult = null;
  let tableEvidence = null;

  if (positionTrackingAnchored) {
    const tablePrompt = buildPositionTrackingTablePrompt({
      sourceText,
      client,
      clientId,
      fileName
    });

    tableResult = await runAiJsonWithRetry({
      env,
      model: COMMUNICATION_VISION_MODEL,
      input: {
        messages: [
          {
            role: "system",
            content: "Extract only clearly readable Position Tracking table evidence. Return one valid JSON object only."
          },
          {
            role: "user",
            content: tablePrompt
          }
        ],
        image: imageDataUrl,
        max_tokens: 1600,
        temperature: 0
      },
      stageName: `${stageName}_position_tracking_table`,
      requestId,
      route: ACTIONS.ANALYZE_COMMUNICATION,
      timeoutMs: 30000,
      maxRetries: 1
    });

    if (tableResult.ok) {
      tableEvidence = sanitizePositionTrackingVisionEvidence(
        normalizeVisibleEvidence(tableResult.data)
      );

      evidence = mergeVisibleEvidence(evidence, tableEvidence);
    }
  }

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
      retryCount:
        (primaryResult.retryCount || 0)
        + (recoveryResult?.retryCount || 0)
        + (tableResult?.retryCount || 0),
      retryStatus: tableEvidence
        ? "position_tracking_table_enrichment_succeeded"
        : usedRecovery
          ? "focused_recovery_succeeded"
          : primaryResult.retryStatus,
      fallbackUsed: false,
      data: evidence
    })
  };
}

function buildVisionEvidencePrompt({ sourceText = "", client, clientId, fileName, focusedRecovery }) {
  const pastedText = clean(sourceText);
  const pastedTextIsPositionTracking = /\bposition tracking\b/i.test(pastedText);

  const instructions = focusedRecovery
    ? [
        "This is a focused recovery pass because a prior pass could not read enough evidence.",
        "Inspect the entire screenshot carefully, including small text, headings, summary cards, keyword tables, and notification body text.",
        "Copy only values you can actually read. If a value is unclear, omit it instead of guessing.",
        "Do not create totals, percentages, counts, keyword names, positions, or movement values that are not visibly readable."
      ]
    : [
        "Inspect the complete screenshot, not only the sender line or email chrome.",
        "Read visible headings, report names, metric labels, numbers, tables, keyword phrases, positions, and direction/change values.",
        "Copy only values that are visibly readable. If a value is unclear, omit it instead of guessing."
      ];

  const reportSpecificInstructions = pastedTextIsPositionTracking
    ? [
        "",
        "REPORT FAMILY ANCHOR",
        "The supplied pasted email text explicitly identifies this communication as Position Tracking.",
        "Use that only to anchor the report family. Do not invent evidence from the pasted text.",
        "Treat the screenshot as a Position Tracking report unless the screenshot visibly proves otherwise.",
        "Do NOT reinterpret this as Backlink Audit, Site Audit, Google Search Console, or another report family.",
        "",
        "POSITION TRACKING TABLE RULES",
        "1. Focus on the visible Position Tracking summary and keyword table.",
        "2. Extract every clearly readable keyword row separately.",
        "3. For each readable row, preserve the keyword phrase and any clearly readable current position, movement/change, search volume, URL/landing page, or other labeled value.",
        "4. Preserve visible summary metrics such as Visibility, estimated Traffic, average position, or keyword counts only when the screenshot visibly labels them.",
        "5. Never invent a metric merely because it is common in SEMrush.",
        "6. Do not output backlink-only metrics such as backlinks, referring domains, anchor text distribution, trusted domains, high-quality domains, toxic score, domains lost, or domains gained unless those exact labels are visibly present in this screenshot.",
        "7. Do not convert unreadable table cells into plausible-looking numbers.",
        "8. One visibleMetrics item should represent one distinct visible summary metric or one distinct keyword-row observation."
      ]
    : [
        "",
        "GENERAL PLATFORM RULES",
        "Identify visible platform/report names only when actually readable.",
        "For SEMrush screenshots, distinguish Position Tracking, Backlink Audit, and Site Audit by the visible report heading and table labels.",
        "Never substitute metrics from a different SEMrush report family."
      ];

  return [
    "You are the Communication Evidence Extractor for the Global Concepts Media Operating System.",
    "Read one business email or platform-notification screenshot and return only visible evidence.",
    "Do not decide what work should be done.",
    "Do not infer facts that are not visible.",
    "The selected client and filename are context only, not screenshot evidence.",
    ...instructions,
    ...reportSpecificInstructions,
    "",
    "EVIDENCE PRESERVATION RULES",
    "Identify any visible client/business name, project domain, website domain, or account name exactly as shown.",
    "Identify visible platform names such as SEMrush only when they are actually visible.",
    "Preserve readable report labels such as Position Tracking, Backlink Audit, or Site Audit.",
    "Put important non-metric statements in visibleFacts.",
    "Put every clearly readable measurable observation in visibleMetrics.",
    "For keyword ranking rows, preserve the keyword phrase together with its readable position/change values in the same visibleMetrics item when possible.",
    "When something truly cannot be read, omit the uncertain metric instead of guessing.",
    "Use Unknown only for requested identity fields that truly cannot be verified.",
    "Never wrap the JSON in markdown fences.",
    "",
    `Selected client: ${client || clientId || "Unknown"}`,
    `Temporary filename: ${fileName}`,
    pastedText
      ? `Pasted-text report anchor: ${pastedTextIsPositionTracking ? "Position Tracking" : "Other/Unconfirmed"}`
      : "Pasted-text report anchor: None",
    "",
    "Return only valid JSON matching this contract:",
    JSON.stringify({
      visibleSource: "Visible sender, platform, or organization; otherwise Unknown",
      visibleSubject: "Visible email subject, report name, or primary headline; otherwise Unknown",
      visibleText: "Concise transcription of materially readable screenshot text",
      visibleFacts: ["Short visible facts copied or closely transcribed from the screenshot"],
      visibleMetrics: [
        "One exact readable summary metric OR one keyword row with its readable position/change context"
      ],
      responseExpected: false,
      explicitActionRequested: false,
      confidence: "High | Medium | Low",
      uncertainty: "Only unreadable or unverified details; otherwise None"
    }, null, 2)
  ].join("\\n");
}

function buildPositionTrackingTablePrompt({ sourceText = "", client, clientId, fileName }) {
  return [
    "You are reading a SEMrush Position Tracking weekly-update screenshot.",
    "The pasted email text confirms the report family is Position Tracking.",
    "Your only job in this pass is to transcribe clearly readable performance evidence from the report body.",
    "",
    "STRICT RULES",
    "1. Ignore browser chrome, Gmail navigation, sender controls, labels, tabs, and unrelated page text.",
    "2. Focus on the central SEMrush report body.",
    "3. Look specifically for the Visibility section, Traffic section, Top keywords table, and Top landing pages section.",
    "4. For Visibility and Traffic, copy only the displayed value and displayed change when both are readable.",
    "5. For each readable Top keywords row, preserve the exact keyword phrase plus any readable Position, Change, and Volume values.",
    "6. For each readable landing-page row, preserve the exact URL/path plus any readable Traffic and Change values.",
    "7. Do not infer missing digits, signs, positions, volumes, or percentages.",
    "8. Do not calculate a previous position from a displayed change.",
    "9. Do not invent SEMrush metrics that are not visibly present.",
    "10. Do NOT output backlinks, referring domains, anchor text, trusted domains, high-quality domains, toxic score, domains lost, domains gained, Site Audit health, or Google Search Console metrics.",
    "11. If a row is too small or blurry to read confidently, omit that row.",
    "12. Prefer fewer verified rows over plausible-looking guesses.",
    "13. Keep one distinct measurable observation per visibleMetrics item.",
    "14. Never wrap the JSON in markdown fences.",
    "",
    `Selected client context: ${client || clientId || "Unknown"}`,
    `Temporary filename: ${fileName}`,
    "Report anchor from pasted text: Position Tracking",
    "",
    "Return only valid JSON matching this contract:",
    JSON.stringify({
      visibleSource: "SEMrush if visibly confirmed; otherwise Unknown",
      visibleSubject: "Position Tracking if visibly confirmed; otherwise Unknown",
      visibleText: "Only clearly readable report-body text relevant to the measurable evidence",
      visibleFacts: [
        "Clearly readable project/domain/date/location fact when visible"
      ],
      visibleMetrics: [
        "Visibility: <value>; Change: <value>",
        "Traffic: <value>; Change: <value>",
        "Keyword: <exact phrase>; Position: <value>; Change: <value>; Volume: <value>",
        "Landing page: <exact URL/path>; Traffic: <value>; Change: <value>"
      ],
      responseExpected: false,
      explicitActionRequested: false,
      confidence: "High | Medium | Low",
      uncertainty: "Name only the sections or values that could not be read; otherwise None"
    }, null, 2)
  ].join("\\n");
}

function sanitizePositionTrackingVisionEvidence(evidence) {
  if (!evidence) return evidence;

  const backlinkOnlyMetric = /(?:^|\b)(?:backlinks?|referring domains?|anchor text|trusted domains?|high quality domains?|domains? lost|domains? gained|toxic(?:ity)? score)(?:\b|:)/i;

  const safeMetrics = (evidence.visibleMetrics || []).filter(
    item => !backlinkOnlyMetric.test(clean(item))
  );

  const safeFacts = (evidence.visibleFacts || []).filter(item => {
    const value = clean(item);
    if (!value) return false;
    if (/https?:\/\/|[a-z0-9-]+\.[a-z]{2,}/i.test(value)) return true;
    return !backlinkOnlyMetric.test(value);
  });

  const safeTextParts = String(evidence.visibleText || "")
    .split(/(?<=[.!?;])\s+|\n+/)
    .map(clean)
    .filter(Boolean)
    .filter(part => !backlinkOnlyMetric.test(part));

  return normalizeVisibleEvidence({
    ...evidence,
    visibleSubject: /backlink audit/i.test(clean(evidence.visibleSubject))
      ? "Unknown"
      : evidence.visibleSubject,
    visibleText: safeTextParts.join(" "),
    visibleFacts: safeFacts,
    visibleMetrics: safeMetrics,
    uncertainty: clean(evidence.uncertainty) || "None"
  });
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

function detectClientFromEvidence(evidence) {
  const searchable = [
    evidence?.visibleSource,
    evidence?.visibleSubject,
    evidence?.visibleText,
    ...(evidence?.visibleFacts || []),
    ...(evidence?.visibleMetrics || [])
  ].filter(Boolean).join(" ").toLowerCase();

  const clients = [
    { id: "SES", name: "Southeast Safes", patterns: [/\bsoutheast safes?\b/i, /\bsesafes\.com\b/i] },
    { id: "4A", name: "1-800 4A Gun Safe", patterns: [/\b1-?800 4a gun safe\b/i, /\b18004agunsafe\.com\b/i, /\bazlibertysafe\.com\b/i] },
    { id: "A1", name: "A1 Action Safe & Lock", patterns: [/\ba1 action safe(?:\s*&|\s+and)\s*lock\b/i, /\ba1actionsafeandlock\.com\b/i] },
    { id: "NFS", name: "North Florida Safes", patterns: [/\bnorth florida safes?\b/i, /\bnorthfloridasafes\.com\b/i] },
    { id: "HBG", name: "HB Guns", patterns: [/\bhb guns\b/i, /\bhbguns\.com\b/i] },
    { id: "PW", name: "Pickett Weaponry", patterns: [/\bpickett weaponry\b/i, /\bpickettweaponry\.com\b/i] },
    { id: "SFS", name: "South Florida Safes", patterns: [/\bsouth florida safes?\b/i, /\bsouthfloridasafes\.com\b/i] },
    { id: "MAS", name: "Move A Safe", patterns: [/\bmove a safe\b/i, /\bmoveasafe\.com\b/i] },
    { id: "GCM", name: "Global Concepts Media", patterns: [/\bglobal concepts media\b/i, /\bglobalconceptsmedia\.com\b/i] },
    { id: "LUMI", name: "Lumi Studio", patterns: [/\blumi studio\b/i, /\blumistudiohouse\.com\b/i] }
  ];

  for (const candidate of clients) {
    if (candidate.patterns.some(pattern => pattern.test(searchable))) return candidate;
  }
  return null;
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

  const facts = uniqueTextValues([
    ...(visibleEvidence?.visibleMetrics || []),
    ...(visibleEvidence?.visibleFacts || [])
  ]);
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
   Communication Route Helpers — Production 6.3.7
   ========================================================= */

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
  const facts = uniqueTextValues([...(evidence?.visibleMetrics || []), ...(evidence?.visibleFacts || [])]);
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
