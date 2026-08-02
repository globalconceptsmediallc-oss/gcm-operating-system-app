/* =========================================================
   Global Concepts Media Operating System
   File: routes/communicationAnalysis.js
   Version: 7.7.2
   Source: Production route 7.7.1
   Status: Production Candidate — Fast Two-Call Communication Analysis
   Purpose: Complete production communication analysis route,
            including pasted-text and screenshot evidence extraction,
            independent report-signature recognition, specialized extraction,
            evidence reconciliation, notification classification,
            WWPOWD interpretation, proof-readiness evaluation,
            business meaning, operational routing, consultant summary,
            shared WWPOWD operational evidence extraction,
            modular report-signature recognition, and a fast screenshot path
            limited to one vision extraction call plus one reasoning call.
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

import {
  extractOperationalEvidence,
  OPERATIONAL_EVIDENCE_VERSION
} from "../shared/operationalEvidence.js";

import {
  executeReportSignatureRecognition,
  normalizeReportRecognition,
  recognizeReportSignatureFromEvidence,
  hasStrongReportRecognition
} from "../shared/reportRecognition.js";

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
  let reportRecognition = null;
  let evidenceReconciliation = null;
  let wwPowdAnalysis = null;
  let businessMeaning = null;
  let proofReadiness = null;
  let operationalDecision = null;
  let consultantSummary = null;
  let operationalEvidence = null;

  /* Stage 0 + Stage 1: fast evidence path.
     Screenshot and hybrid inputs use one shared vision extraction call only.
     Text-only inputs use deterministic text extraction and make no evidence AI
     call. The former multi-pass vision/recovery/specialized pipeline remains in
     this file temporarily for rollback safety, but is not invoked by this path.
     One later reasoning call is retained for business meaning. */
  if (imageDataUrl) {
    const stageStartedAt = Date.now();
    const operationalEvidenceResult = await extractOperationalEvidence({
      env,
      imageDataUrl,
      sourceText: sourceText || null,
      client: client || null,
      clientId: clientId || null,
      fileName,
      context: clean(body?.operationalContext || body?.context) || null,
      visionModel: COMMUNICATION_VISION_MODEL,
      reasoningModel: COMMUNICATION_REASONING_MODEL,
      timeoutMs: 35000,
      allowRecovery: false
    });

    operationalEvidence = operationalEvidenceResult?.evidence || null;
    visibleEvidence = operationalEvidenceToVisibleEvidence(operationalEvidence);

    if (sourceText) {
      const deterministicTextEvidence = deterministicTextEvidenceExtraction(sourceText);
      visibleEvidence = mergeVisibleEvidence(deterministicTextEvidence, visibleEvidence);

      const anchoredSubject = clean(deterministicTextEvidence?.visibleSubject);
      const anchoredSource = clean(deterministicTextEvidence?.visibleSource);
      if (anchoredSubject && anchoredSubject !== "Unknown") {
        visibleEvidence.visibleSubject = anchoredSubject;
      }
      if (anchoredSource && anchoredSource !== "Unknown") {
        visibleEvidence.visibleSource = anchoredSource;
      }
    }

    if (operationalEvidenceResult?.error) {
      errors.push(buildOperationalError({
        stage: "operational_evidence_extraction",
        code: operationalEvidenceResult.error.code || "OPERATIONAL_EVIDENCE_PARTIAL",
        message: operationalEvidenceResult.error.message || "Operational evidence extraction was incomplete.",
        retryable: false
      }));
    }

    stages.push(createStageResult({
      stageName: "operational_evidence_extraction",
      status: operationalEvidenceResult?.ok
        ? STAGE_STATUS.SUCCESS
        : operationalEvidence
          ? STAGE_STATUS.PARTIAL
          : STAGE_STATUS.FAILED,
      engine: `operational-evidence-v${OPERATIONAL_EVIDENCE_VERSION}`,
      model: COMMUNICATION_VISION_MODEL,
      startedAt: stageStartedAt,
      confidence: Number(operationalEvidence?.confidence || 0),
      retryCount: 0,
      retryStatus: operationalEvidenceResult?.ok ? "single_pass_succeeded" : "single_pass_partial",
      rawAiError: operationalEvidenceResult?.error?.message || null,
      fallbackUsed: Boolean(!operationalEvidenceResult?.ok),
      data: operationalEvidence
    }));
  } else {
    const stageStartedAt = Date.now();
    visibleEvidence = deterministicTextEvidenceExtraction(sourceText);
    reportRecognition = recognizeReportSignatureFromEvidence(visibleEvidence);

    stages.push(createStageResult({
      stageName: "evidence_extraction",
      status: STAGE_STATUS.SUCCESS,
      engine: "communication-text-evidence-deterministic-fast",
      model: "deterministic",
      startedAt: stageStartedAt,
      confidence: confidenceToNumber(visibleEvidence.confidence),
      retryCount: 0,
      retryStatus: "deterministic_only",
      fallbackUsed: false,
      data: visibleEvidence
    }));
  }

  /* Stage 1A: authoritative report-family recognition.
     This stage is independent of broad OCR confidence. A strong visual/report
     signature may anchor specialized extraction and final classification even
     when the broad transcription is incomplete. */
  {
    const stageStartedAt = Date.now();
    reportRecognition = reportRecognition || recognizeReportSignatureFromEvidence(visibleEvidence);
    visibleEvidence = applyReportRecognitionToEvidence(visibleEvidence, reportRecognition);

    stages.push(createStageResult({
      stageName: "report_signature_recognition",
      status: reportRecognition?.reportType && reportRecognition.reportType !== "unknown"
        ? STAGE_STATUS.SUCCESS
        : STAGE_STATUS.PARTIAL,
      engine: reportRecognition?.recognitionMethod || "report-signature-rules",
      model: reportRecognition?.model || "deterministic",
      startedAt: stageStartedAt,
      confidence: confidenceToNumber(reportRecognition?.confidence || "Low"),
      fallbackUsed: false,
      data: reportRecognition
    }));
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

  /* Stage 2A: reconcile extracted evidence before interpretation. */
  {
    const stageStartedAt = Date.now();
    evidenceReconciliation = reconcileCommunicationEvidence({
      visibleEvidence,
      classification
    });
    visibleEvidence = evidenceReconciliation.evidence;

    const reconciledClassification = deterministicNotificationClassification(visibleEvidence);
    if (
      reconciledClassification.notificationType !== "unknown" &&
      (
        classification.notificationType === "unknown" ||
        reconciledClassification.confidence > classification.confidence
      )
    ) {
      classification = reconciledClassification;
    }

    stages.push(createStageResult({
      stageName: "evidence_reconciliation",
      status: evidenceReconciliation.conflictCount
        ? STAGE_STATUS.PARTIAL
        : STAGE_STATUS.SUCCESS,
      engine: "evidence-reconciliation-v1",
      model: "deterministic",
      startedAt: stageStartedAt,
      confidence: confidenceToNumber(visibleEvidence.confidence),
      fallbackUsed: false,
      data: evidenceReconciliation
    }));
  }

  /* Stage 2B: WWPOWD translates evidence into the legacy Proof-of-Work lens. */
  {
    const stageStartedAt = Date.now();
    wwPowdAnalysis = buildWwPowdAnalysis({
      visibleEvidence,
      classification
    });

    stages.push(createStageResult({
      stageName: "wwpowd_interpretation",
      status: wwPowdAnalysis.manualReviewRequired
        ? STAGE_STATUS.PARTIAL
        : STAGE_STATUS.SUCCESS,
      engine: "wwpowd-engine-v1",
      model: "deterministic",
      startedAt: stageStartedAt,
      confidence: confidenceToNumber(wwPowdAnalysis.confidence),
      fallbackUsed: false,
      data: wwPowdAnalysis
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
      wwPowdAnalysis,
      env,
      requestId
    });
    stages.push(meaningResult.stage);
    if (meaningResult.error) errors.push(meaningResult.error);
    businessMeaning = meaningResult.data;
  }

  /* Stage 3B: determine whether the evidence is ready to become Proof of Work. */
  {
    const stageStartedAt = Date.now();
    proofReadiness = buildProofReadiness({
      visibleEvidence,
      classification,
      wwPowdAnalysis,
      businessMeaning
    });

    stages.push(createStageResult({
      stageName: "proof_readiness",
      status: STAGE_STATUS.SUCCESS,
      engine: "proof-readiness-v1",
      model: "deterministic",
      startedAt: stageStartedAt,
      confidence: confidenceToNumber(proofReadiness.confidence),
      fallbackUsed: false,
      data: proofReadiness
    }));
  }

  /* Stage 4: deterministic routing with guarded AI meaning. */
  {
    const stageStartedAt = Date.now();
    operationalDecision = buildOperationalDecision({
      visibleEvidence,
      classification,
      businessMeaning,
      wwPowdAnalysis,
      proofReadiness
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
      wwPowdAnalysis,
      proofReadiness,
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
    reportRecognition,
    evidence: visibleEvidence,
    operationalEvidence,
    evidenceReconciliation,
    wwPowdAnalysis,
    businessMeaning,
    proofReadiness,
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
      partialStageCount: partialStages.length,
      performanceMode: imageDataUrl ? "fast_two_call" : "fast_text_deterministic_plus_reasoning",
      evidenceAiCallBudget: imageDataUrl ? 1 : 0,
      reasoningAiCallBudget: 1
    }
  }, 200);
}

function operationalEvidenceToVisibleEvidence(operationalEvidence) {
  const evidence = operationalEvidence && typeof operationalEvidence === "object"
    ? operationalEvidence
    : {};

  const metricLines = (Array.isArray(evidence.metrics) ? evidence.metrics : [])
    .map(metric => {
      const label = clean(metric?.label || metric?.key || "Metric");
      const displayValue = clean(
        metric?.displayValue ??
        metric?.display_value ??
        metric?.value
      );
      const scope = clean(metric?.scope);
      if (!label || !displayValue) return "";
      return `${label}: ${displayValue}${scope ? `; Scope: ${scope}` : ""}`;
    })
    .filter(Boolean);

  const trendLines = (Array.isArray(evidence.trends) ? evidence.trends : [])
    .map(trend => {
      const key = clean(trend?.key || "Trend").replace(/_/g, " ");
      const direction = clean(trend?.direction || "unknown");
      const displayChange = clean(
        trend?.displayChange ??
        trend?.display_change ??
        trend?.change
      );
      const period = clean(trend?.period);
      return `${key}: ${direction}${displayChange ? `; Change: ${displayChange}` : ""}${period ? `; Period: ${period}` : ""}`;
    })
    .filter(Boolean);

  const conditionFacts = (Array.isArray(evidence.conditions) ? evidence.conditions : [])
    .map(condition => {
      const statement = clean(condition?.statement || condition?.condition || condition?.summary);
      const support = clean(condition?.evidence || condition?.support);
      if (!statement) return "";
      return support && support.toLowerCase() !== statement.toLowerCase()
        ? `${statement} — Evidence: ${support}`
        : statement;
    })
    .filter(Boolean);

  const issueFacts = (Array.isArray(evidence.candidateIssues) ? evidence.candidateIssues : [])
    .map(issue => {
      const label = clean(issue?.label || issue?.key || "Candidate issue");
      const count = issue?.count === null || issue?.count === undefined
        ? ""
        : `; Count: ${issue.count}`;
      const severity = clean(issue?.toolSeverity || issue?.tool_severity || "unknown");
      const support = clean(issue?.evidence);
      return `${label}${count}; Tool severity: ${severity}${support ? `; Evidence: ${support}` : ""}`;
    })
    .filter(Boolean);

  const positiveSignals = (Array.isArray(evidence.positiveSignals)
    ? evidence.positiveSignals
    : [])
    .map(value => clean(value))
    .filter(Boolean);

  const limitations = (Array.isArray(evidence.limitations) ? evidence.limitations : [])
    .map(value => clean(value))
    .filter(Boolean)
    .filter(value => !/did not return valid json|focused recovery|ai extraction attempt failed/i.test(value));

  return normalizeVisibleEvidence({
    visibleSource: clean(evidence.sourcePlatform) || "Unknown",
    visibleSubject: clean(evidence.sourceTitle) || clean(evidence.dashboardType) || "Unknown",
    visibleText: [
      ...metricLines,
      ...trendLines,
      ...conditionFacts,
      ...issueFacts,
      ...positiveSignals
    ].join("; "),
    visibleFacts: uniqueTextValues([
      ...conditionFacts,
      ...issueFacts,
      ...positiveSignals
    ]),
    visibleMetrics: uniqueTextValues([
      ...metricLines,
      ...trendLines
    ]),
    responseExpected: false,
    explicitActionRequested: false,
    confidence: confidenceLabelFromNumber(evidence.confidence),
    uncertainty: limitations.length ? limitations.join("; ") : "None"
  });
}

function confidenceLabelFromNumber(value) {
  const confidence = Number(value);
  if (Number.isFinite(confidence) && confidence >= 0.8) return "High";
  if (Number.isFinite(confidence) && confidence >= 0.5) return "Medium";
  return "Low";
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
    "10A. SITE AUDIT METRIC ASSOCIATION: when a Site Audit metric has a label, current value, and displayed change/delta, keep them together in ONE visibleMetrics item.",
    "10B. Required Site Audit form: 'Site Health: <current value>; Change: <signed change or no change>', 'Errors: <current value>; Change: <signed change or no change>', 'Warnings: <current value>; Change: <signed change or no change>', 'Notices: <current value>; Change: <signed change or no change>', 'Broken Pages: <current value>; Change: <signed change or no change>'.",
    "10C. Never output a Site Audit count or signed delta as an unlabeled standalone metric when its label is readable. Preserve the label/value/change relationship exactly as shown.",
    "10D. A positive delta on Errors, Warnings, Issues, or Broken Pages is deterioration evidence; extraction must preserve the signed delta but must not make the operational decision.",
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
    /disavow file updated|merchant listings?|structured data|position tracking|backlink audit|site audit|search performance|business profile|analytics|ranking|keyword/i.test(line)
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

  const preparedImage = await prepareVisionImageForAnalysis({
    imageDataUrl,
    imageBytes,
    sourceText,
    env,
    requestId
  });

  const visionImageDataUrl = preparedImage.dataUrl;

  /*
   * v7.6.0 INDEPENDENT REPORT-SIGNATURE RECOGNITION
   *
   * This pass runs before broad evidence is trusted. It identifies recurring
   * report families from headings, branding, and characteristic metric groups.
   * Its narrow contract prevents a weak broad extraction from blocking the
   * specialized extractor that is capable of recovering the report.
   */
  const reportRecognitionResult = await executeReportSignatureRecognition({
    imageDataUrl: visionImageDataUrl,
    sourceText,
    client,
    clientId,
    fileName,
    env,
    requestId,
    deterministicEvidence: deterministicTextEvidenceExtraction(sourceText)
  });
  const reportRecognition = reportRecognitionResult.data;

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
      image: visionImageDataUrl,
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
        image: visionImageDataUrl,
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
  evidence = applyReportRecognitionToEvidence(evidence, reportRecognition);

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
  const siteAuditAnchored =
    reportRecognition?.reportType === "site_audit" ||
    deterministicNotificationClassification(evidence).notificationType === "site_audit" ||
    hasStrongSiteAuditSignature(evidence);

  let tableResult = null;
  let tableEvidence = null;
  let siteAuditResult = null;
  let siteAuditEvidence = null;
  let siteAuditPreparedImage = null;
  let siteAuditChangeVerificationResult = null;
  let siteAuditChangeVerification = null;

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
        image: visionImageDataUrl,
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

  /*
   * v7.4.13 SITE-AUDIT FOCUSED METRICS PASS
   *
   * Broad screenshot extraction can read the Site Audit numbers while dropping
   * the metric labels. That makes deterioration impossible to evaluate safely.
   * When the broad evidence classifies as Site Audit, run one narrow pass that
   * is allowed to return only labeled Site Audit metrics. Merge those labeled
   * observations back into the evidence before business meaning/routing.
   */
  if (siteAuditAnchored) {
    /*
     * v7.4.19 SITE-AUDIT IMAGE PREPROCESSING
     *
     * The SFS road test proved that the focused Site Audit pass was still
     * reading the full desktop screenshot, where the report metrics are too
     * small for dependable transcription. After the broad pass identifies the
     * report as Site Audit, crop and enlarge the central report body before the
     * focused metrics pass. This changes evidence extraction only.
     */
    siteAuditPreparedImage = await prepareSiteAuditImageForAnalysis({
      imageDataUrl,
      imageBytes,
      env,
      requestId
    });

    const siteAuditImageDataUrl =
      siteAuditPreparedImage?.dataUrl || visionImageDataUrl;

    const siteAuditPrompt = buildSiteAuditMetricsPrompt({
      client,
      clientId,
      fileName
    });

    siteAuditResult = await runAiJsonWithRetry({
      env,
      model: COMMUNICATION_VISION_MODEL,
      input: {
        messages: [
          {
            role: "system",
            content: "Extract only clearly readable SEMrush Site Audit metrics with their labels and signed changes. Return one valid JSON object only."
          },
          {
            role: "user",
            content: siteAuditPrompt
          }
        ],
        image: siteAuditImageDataUrl,
        max_tokens: 1400,
        temperature: 0
      },
      stageName: `${stageName}_site_audit_metrics`,
      requestId,
      route: ACTIONS.ANALYZE_COMMUNICATION,
      timeoutMs: 30000,
      maxRetries: 1
    });

    if (siteAuditResult.ok) {
      siteAuditEvidence = normalizeVisibleEvidence(siteAuditResult.data);

      /*
       * v7.4.16 SITE-AUDIT "NO CHANGE" EVIDENCE PROTECTION
       *
       * Road testing with South Florida Safes proved that a focused vision pass
       * can occasionally attach a positive signed delta to an adverse metric
       * even when the broader screenshot evidence explicitly says that metric
       * has "no change". Before merging focused Site Audit enrichment, protect
       * explicit stable metric observations already present in the broader
       * evidence. A contradictory focused delta is discarded for that metric.
       *
       * This does not suppress genuine deterioration. When the broader evidence
       * does not explicitly establish "no change", focused labeled deltas such
       * as "Errors: 136; Change: +27" remain eligible for routing.
       */
      siteAuditEvidence = protectExplicitSiteAuditNoChangeEvidence({
        baseEvidence: evidence,
        focusedEvidence: siteAuditEvidence
      });

      /*
       * v7.4.21 AUTHORITATIVE SITE-AUDIT EVIDENCE
       *
       * The broad vision pass remains useful for client/source/context
       * identification, but its Site Audit metric transcription is not allowed
       * to compete with the dedicated focused Site Audit extractor.
       *
       * Preserve broad non-metric context and replace Site Audit metric evidence
       * with the focused evidence object before any routing decision is made.
       */
      evidence = makeSiteAuditEvidenceAuthoritative({
        broadEvidence: evidence,
        focusedEvidence: siteAuditEvidence
      });
    }

    /*
     * v7.4.20 SITE-AUDIT CHANGE-STATUS VERIFICATION
     *
     * Road testing showed that even an enlarged focused pass can sometimes
     * invent a signed delta where the report visibly says "no change".
     * When the assembled Site Audit evidence contains a positive delta on an
     * adverse metric, run one final narrow verification pass whose ONLY job is
     * to classify the displayed change state for each adverse metric as:
     * increase, decrease, no_change, or not_readable.
     *
     * The verification pass does not read current counts and contains no
     * example numbers. A verified no_change/decrease removes contradictory
     * positive deltas for that metric. A verified increase preserves them.
     */
    if (hasSiteAuditPositiveAdverseDelta(evidence)) {
      const verificationPrompt = buildSiteAuditChangeVerificationPrompt({
        client,
        clientId,
        fileName
      });

      siteAuditChangeVerificationResult = await runAiJsonWithRetry({
        env,
        model: COMMUNICATION_VISION_MODEL,
        input: {
          messages: [
            {
              role: "system",
              content: "Verify only the visibly displayed change state for SEMrush Site Audit adverse metrics. Return one valid JSON object only."
            },
            {
              role: "user",
              content: verificationPrompt
            }
          ],
          image: siteAuditPreparedImage?.dataUrl || visionImageDataUrl,
          max_tokens: 900,
          temperature: 0
        },
        stageName: `${stageName}_site_audit_change_verification`,
        requestId,
        route: ACTIONS.ANALYZE_COMMUNICATION,
        timeoutMs: 30000,
        maxRetries: 1
      });

      if (siteAuditChangeVerificationResult.ok) {
        siteAuditChangeVerification = normalizeSiteAuditChangeVerification(
          siteAuditChangeVerificationResult.data
        );

        evidence = applySiteAuditChangeVerification({
          evidence,
          verification: siteAuditChangeVerification
        });
      }
    }

    /*
     * v7.4.17 FINAL SITE-AUDIT EVIDENCE RECONCILIATION
     *
     * v7.4.16 protected the focused Site Audit pass before merge, but a
     * contradictory positive delta could already exist in primary/recovery
     * vision evidence. Reconcile the final assembled evidence so an explicit
     * metric-local "no change" observation wins over a contradictory positive
     * delta for that same adverse metric, regardless of which vision pass
     * produced it. Genuine deterioration remains untouched when no explicit
     * stable observation exists for that metric.
     */
    evidence = reconcileFinalSiteAuditNoChangeEvidence(evidence);
    evidence = applyReportRecognitionToEvidence(evidence, reportRecognition);
  }

  const strongReportRecognition = hasStrongReportRecognition(reportRecognition);

  if ((!evidence || isWeakVisibleEvidence(evidence)) && !strongReportRecognition) {
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
      data: preservePartialVisibleEvidence(evidence, message),
      reportRecognition,
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

  if (strongReportRecognition && (!evidence || isWeakVisibleEvidence(evidence))) {
    evidence = applyReportRecognitionToEvidence(
      preservePartialVisibleEvidence(evidence, "Broad transcription was incomplete; strong report signature retained."),
      reportRecognition
    );
    evidence.confidence = reportRecognition.confidence || "Medium";
  }

  const usedRecovery = Boolean(recoveryEvidence && !isWeakVisibleEvidence(recoveryEvidence));

  return {
    data: evidence,
    reportRecognition,
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
        + (tableResult?.retryCount || 0)
        + (siteAuditResult?.retryCount || 0)
        + (siteAuditChangeVerificationResult?.retryCount || 0)
        + (reportRecognitionResult?.retryCount || 0),
      retryStatus: strongReportRecognition && isWeakVisibleEvidence(mergeVisibleEvidence(primaryEvidence, recoveryEvidence))
        ? "strong_report_signature_retained_partial_evidence"
        : siteAuditChangeVerification
        ? "site_audit_authoritative_evidence_change_verification_succeeded"
        : siteAuditEvidence
          ? "site_audit_authoritative_evidence_succeeded"
          : tableEvidence
            ? "position_tracking_table_enrichment_succeeded"
            : usedRecovery
              ? "focused_recovery_succeeded"
              : primaryResult.retryStatus,
      fallbackUsed: false,
      data: evidence,
      debug: {
        preprocessingApplied: preparedImage.transformed === true,
        preprocessingReason: preparedImage.reason || "",
        processedImageDataUrl: visionImageDataUrl,
        siteAuditPreprocessingApplied: siteAuditPreparedImage?.transformed === true,
        siteAuditPreprocessingReason: siteAuditPreparedImage?.reason || "",
        siteAuditProcessedImageDataUrl: siteAuditPreparedImage?.dataUrl || "",
        reportRecognition
      }
    })
  };
}

/*
 * v7.3.9 ROAD-TEST DIAGNOSTIC:
 * The stage now carries the exact processed image in stage.debug so we can
 * verify what Workers AI received. No D1/save/routing behavior is changed.
 */
/*
 * v7.4.19 SITE-AUDIT FOCUSED IMAGE PREPROCESSING
 *
 * Once the broad vision pass has identified a Site Audit, use Cloudflare Images
 * to crop away most browser/Gmail chrome and enlarge the central SEMrush report
 * before the focused metrics extractor runs. If IMAGES is unavailable or the
 * transform fails, safely fall back to the original screenshot.
 */
async function prepareSiteAuditImageForAnalysis({
  imageDataUrl,
  imageBytes,
  env,
  requestId
}) {
  if (!env?.IMAGES || typeof env.IMAGES.input !== "function") {
    return {
      dataUrl: imageDataUrl,
      transformed: false,
      reason: "IMAGES binding unavailable; original Site Audit screenshot preserved."
    };
  }

  try {
    const mimeType = imageMimeTypeFromDataUrl(imageDataUrl);
    const sourceBytes = new Uint8Array(imageBytes);

    const transformedResponse = (
      await env.IMAGES
        .input(sourceBytes)
        .transform({
          width: 1100,
          height: 1500,
          fit: "cover",
          gravity: { x: 0.57, y: 0.48 }
        })
        .output({
          format: mimeType === "image/png" ? "image/png" : "image/jpeg"
        })
    ).response();

    if (!transformedResponse.ok) {
      throw new Error(`Site Audit image preprocessing returned HTTP ${transformedResponse.status}.`);
    }

    const transformedBytes = new Uint8Array(await transformedResponse.arrayBuffer());
    if (!transformedBytes.length) {
      throw new Error("Site Audit image preprocessing returned an empty image.");
    }

    return {
      dataUrl: byteArrayToDataUrl(transformedBytes, mimeType),
      transformed: true,
      reason: "Site Audit screenshot cropped and enlarged for focused metric extraction."
    };
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.ANALYZE_COMMUNICATION,
      stage: "site_audit_image_preprocessing",
      error
    });

    return {
      dataUrl: imageDataUrl,
      transformed: false,
      reason: `Site Audit image preprocessing failed; original screenshot preserved. ${safeErrorMessage(error)}`
    };
  }
}

async function prepareVisionImageForAnalysis({
  imageDataUrl,
  imageBytes,
  sourceText = "",
  env,
  requestId
}) {
  const positionTrackingAnchored = /\bposition tracking\b/i.test(clean(sourceText));

  /*
   * Cloudflare Images binding is optional at deploy time.
   * When present, use it to crop/resize the desktop screenshot around the
   * central email/report body before Workers AI sees it. When absent or when
   * transformation fails, safely preserve the existing full-resolution input.
   */
  if (!positionTrackingAnchored || !env?.IMAGES || typeof env.IMAGES.input !== "function") {
    return {
      dataUrl: imageDataUrl,
      transformed: false,
      reason: positionTrackingAnchored
        ? "IMAGES binding unavailable; original screenshot preserved."
        : "Focused Position Tracking preprocessing not required."
    };
  }

  try {
    const mimeType = imageMimeTypeFromDataUrl(imageDataUrl);
    const sourceBytes = new Uint8Array(imageBytes);

    /*
     * The recurring GCM OS workflow captures a desktop/browser screenshot in
     * which the useful email/report body is centered and relatively narrow.
     * A portrait crop removes most browser/sidebar chrome and enlarges the
     * report area for small-table reading. Gravity is intentionally centered
     * slightly right of midpoint to favor the email body/report content.
     */
    const transformedResponse = (
      await env.IMAGES
        .input(sourceBytes)
        .transform({
          width: 1050,
          height: 1350,
          fit: "cover",
          gravity: { x: 0.58, y: 0.5 },
        })
        .output({
          format: mimeType === "image/png" ? "image/png" : "image/jpeg"
        })
    ).response();

    if (!transformedResponse.ok) {
      throw new Error(`Images preprocessing returned HTTP ${transformedResponse.status}.`);
    }

    const transformedBytes = new Uint8Array(await transformedResponse.arrayBuffer());
    if (!transformedBytes.length) {
      throw new Error("Images preprocessing returned an empty image.");
    }

    return {
      dataUrl: byteArrayToDataUrl(transformedBytes, mimeType),
      transformed: true,
      reason: "Position Tracking screenshot cropped and enlarged for vision analysis."
    };
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.ANALYZE_COMMUNICATION,
      stage: "vision_image_preprocessing",
      error
    });

    return {
      dataUrl: imageDataUrl,
      transformed: false,
      reason: `Image preprocessing failed; original screenshot preserved. ${safeErrorMessage(error)}`
    };
  }
}

function imageMimeTypeFromDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,/i);
  if (!match) return "image/png";
  const mimeType = match[1].toLowerCase();
  return mimeType === "image/jpg" ? "image/jpeg" : mimeType;
}

function byteArrayToDataUrl(bytes, mimeType = "image/png") {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, Math.min(index + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}

/*
 * v7.4.12 SITE-AUDIT EVIDENCE-ASSOCIATION FIX
 *
 * Vision and text extraction are required to preserve a Site Audit metric's
 * label, current value, and signed change/delta as one evidence observation.
 * This fixes the upstream evidence shape so deterministic routing can evaluate
 * deterioration without guessing which detached number belongs to which label.
 * No database, UI, save, or Work Item behavior is changed.
 */

/*
 * v7.6.0 REPORT-SIGNATURE RECOGNITION ENGINE
 *
 * The recognizer has a narrow identity-only contract. It does not interpret
 * business meaning and does not transcribe report metrics. It exists so known
 * report structures can select the correct specialized evidence extractor even
 * when general-purpose vision returns low-confidence prose.
 */
/*
 * v7.7.1 MODULAR REPORT-SIGNATURE RECOGNITION
 *
 * Report-family recognition, prompting, normalization, deterministic signature
 * rules, and AI/deterministic arbitration now live in
 * shared/reportRecognition.js. This route retains only the evidence adapter so
 * all downstream response fields and road-tested behavior remain unchanged.
 */
function applyReportRecognitionToEvidence(evidence, recognition) {
  const normalized = normalizeVisibleEvidence(evidence || {});
  const recognized = normalizeReportRecognition(recognition || {});
  if (recognized.reportType === "unknown") return normalized;

  const sourceMap = {
    semrush: "SEMrush",
    google_search_console: "Google Search Console",
    google_analytics: "Google Analytics",
    google_business_profile: "Google Business Profile"
  };

  return normalizeVisibleEvidence({
    ...normalized,
    visibleSource: clean(normalized.visibleSource) && normalized.visibleSource !== "Unknown"
      ? normalized.visibleSource
      : sourceMap[recognized.platform] || "Unknown",
    visibleSubject: clean(normalized.visibleSubject) && normalized.visibleSubject !== "Unknown"
      ? normalized.visibleSubject
      : recognized.reportFamily,
    visibleFacts: uniqueTextValues([
      ...(normalized.visibleFacts || []),
      `Recognized report family: ${recognized.reportFamily}`
    ]),
    confidence: confidenceToNumber(recognized.confidence) > confidenceToNumber(normalized.confidence)
      ? recognized.confidence
      : normalized.confidence
  });
}

function preservePartialVisibleEvidence(evidence, reason) {
  const normalized = normalizeVisibleEvidence(evidence || {});
  return normalizeVisibleEvidence({
    ...normalized,
    visibleText: clean(normalized.visibleText) || "Partial screenshot evidence was retained for review.",
    visibleFacts: uniqueTextValues([
      ...(normalized.visibleFacts || []),
      `Evidence limitation: ${clean(reason) || "Incomplete transcription"}`
    ]),
    uncertainty: clean(reason) || normalized.uncertainty || "Incomplete transcription",
    confidence: normalized.confidence === "High" ? "Medium" : normalized.confidence
  });
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
        "Identify visible platform/report names only when actually readable or when the report layout contains a distinctive, internally consistent metric signature.",
        "For SEMrush screenshots, distinguish Position Tracking, Backlink Audit, and Site Audit by the visible report heading and table labels.",
        "Never substitute metrics from a different SEMrush report family.",
        "",
        "GOOGLE ANALYTICS REPORT RULES",
        "1. A report showing combinations such as Active Users, New Users, Avg engagement time, Events, Views, Page/Screen Name, or Bounce Rate is Google Analytics / GA4 performance evidence even when the Google Analytics logo or sender name is outside the cropped screenshot.",
        "2. Preserve each clearly readable summary metric and its displayed percentage change separately.",
        "3. Preserve clearly readable page/screen performance rows when available, including Views, Active Users, and Bounce Rate.",
        "4. Do not label the source as Gmail merely because the screenshot was captured inside Gmail. Gmail is the container, not the business-information source.",
        "5. Do not invent Google Analytics metrics that are not visibly present."
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
    "GOOGLE SEARCH CONSOLE PAGE-INDEXING RULE: when visible, preserve the exact headline or statement that page indexing issues were successfully fixed, validation passed/completed, or pages were validated as fixed.",
    "When a Search Console page-indexing confirmation shows an affected website/domain or page count, preserve the domain and count as separate source-grounded facts or metrics.",
    "Do not reduce a successful page-indexing validation notice to a generic Search Console or search-performance notification.",
    "Put important non-metric statements in visibleFacts.",
    "HUMAN EMAIL RULE: when the screenshot is a person-to-person business email, prioritize the sender-written message body over signatures, legal footers, slogans, addresses, phone numbers, social links, and attachment thumbnails.",
    "For a human email, preserve operational statements such as confirmations, current status, quantities, dates/deadlines, markets/stations/locations, what is running now, what changes next, explicit requests, and expected follow-up.",
    "Do not put signature-block contact information or promotional taglines in visibleFacts unless the sender-written message body makes them operationally relevant.",
    "If the sender confirms a quantity or current status through a stated date, preserve that confirmation as a visibleFact exactly enough to retain the quantity and date.",
    "If the sender asks to be kept posted about a future date or change, preserve that request as a visibleFact and set responseExpected=true.",
    "HUMAN EMAIL FOLLOW-UP RULE: a request such as keep me posted, let me know, confirm, advise, send, update me, or similar future-facing language is an explicit operational follow-up request even when the email is otherwise informational or confirmational.",
    "When a human email contains both a confirmation/current-status statement and a future-facing follow-up request, retain both facts. Do not downgrade the message to passive historical information.",
    "Carry visible dates and deadlines from the sender-written message body into the operational interpretation when they define how long a current condition lasts or when follow-up begins.",
    "HUMAN EMAIL DATE PRESERVATION RULE: when the sender states that placements, spots, campaigns, work, service, or another current condition is in place, running, active, scheduled, or valid through/until a visible date, preserve that date in visibleFacts and repeat it explicitly in the operational summary.",
    "HUMAN EMAIL FOLLOW-UP DATE RULE: when the sender requests an update, confirmation, notice, or other follow-up beginning on/from a visible date, preserve both the requested follow-up and that date in visibleFacts and repeat them explicitly in the operational summary.",
    "Do not collapse a dated statement such as '3 spots are in place through 7/31' into only '3 spots are currently running'; the end date is operational evidence and must remain attached to the fact.",
    "Do not collapse a dated request such as 'keep me posted on what is running starting on 8/1' into only 'reply required'; preserve the requested action and its start date in the operational summary.",
    "HUMAN EMAIL REPLY PURPOSE RULE: when responseExpected=true, the operational summary must state what the sender expects the recipient to respond about, not merely that a reply is required.",
    "If the sender's requested follow-up contains a visible effective/start date, include that date with the reply purpose in the operational summary.",
    "For example, if the sender says 'Keep me posted on what is running starting on 8/1', preserve the meaning as 'Follow-up requested: keep sender posted on what is running starting 8/1' or equivalent. Do not omit the requested subject or the 8/1 date.",
    "A follow-up request does not by itself require an Investigation or Work Item. It should instead preserve the communication and indicate that a response or follow-up is required when appropriate.",
    "Do not invent markets, stations, placements, dates, or confirmations that are not visible in the screenshot.",
    "Put every clearly readable measurable observation in visibleMetrics.",
    "For keyword ranking rows, preserve the keyword phrase together with its readable position/change values in the same visibleMetrics item when possible.",
    "SITE AUDIT METRIC ASSOCIATION RULE: if the screenshot is a Site Audit, keep each readable metric label, current value, and displayed signed change/delta together in ONE visibleMetrics item.",
    "Required Site Audit form: 'Site Health: <current value>; Change: <signed change or no change>', 'Errors: <current value>; Change: <signed change or no change>', 'Warnings: <current value>; Change: <signed change or no change>', 'Notices: <current value>; Change: <signed change or no change>', 'Broken Pages: <current value>; Change: <signed change or no change>'.",
    "Do not return unlabeled Site Audit numbers or detached signed deltas when the screenshot visibly associates them with a metric label.",
    "Preserve + and - signs exactly. Do not reinterpret whether a change is good or bad during extraction.",
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

/*
 * v7.4.21 AUTHORITATIVE SITE-AUDIT EVIDENCE
 *
 * Keep broad-pass identity/context facts, but remove broad-pass Site Audit
 * metric lines before applying the focused Site Audit evidence. This prevents
 * contradictory metric transcriptions from different vision passes from being
 * merged into the final decision input.
 */
function makeSiteAuditEvidenceAuthoritative({
  broadEvidence,
  focusedEvidence
}) {
  const broad = normalizeVisibleEvidence(broadEvidence || {});
  const focused = normalizeVisibleEvidence(focusedEvidence || {});

  const isSiteAuditMetricLine = value => {
    const line = clean(normalizeEvidenceArrayItem(value));
    if (!line) return false;

    return (
      /\bsite\s*health\b/i.test(line) ||
      /\bcrawled\s*pages?\b/i.test(line) ||
      /\bhealthy\s*pages?\b/i.test(line) ||
      /\bbroken(?:\s+pages?)?\b/i.test(line) ||
      /\bpages?\s+with\s+issues?\b/i.test(line) ||
      /\bredirects?\b/i.test(line) ||
      /\bblocked(?:\s+pages?)?\b/i.test(line) ||
      /\berrors?\b/i.test(line) ||
      /\bwarnings?\b/i.test(line) ||
      /\bnotices?\b/i.test(line)
    );
  };

  const broadFacts = (broad.visibleFacts || [])
    .map(normalizeEvidenceArrayItem)
    .map(clean)
    .filter(Boolean)
    .filter(value => !isSiteAuditMetricLine(value));

  const broadMetrics = (broad.visibleMetrics || [])
    .map(normalizeEvidenceArrayItem)
    .map(clean)
    .filter(Boolean)
    .filter(value => !isSiteAuditMetricLine(value));

  const focusedFacts = (focused.visibleFacts || [])
    .map(normalizeEvidenceArrayItem)
    .map(clean)
    .filter(Boolean);

  const focusedMetrics = (focused.visibleMetrics || [])
    .map(normalizeEvidenceArrayItem)
    .map(clean)
    .filter(Boolean);

  /*
   * Do not carry broad visibleText into the final Site Audit evidence because
   * it may contain the same conflicting metric transcription in prose form.
   * The focused pass becomes the authoritative visibleText source when present.
   */
  const authoritativeText =
    clean(focused.visibleText) ||
    [
      ...focusedFacts,
      ...focusedMetrics
    ].join("; ");

  return normalizeVisibleEvidence({
    ...broad,
    ...focused,
    visibleText: authoritativeText,
    visibleFacts: uniqueTextValues([
      ...broadFacts,
      ...focusedFacts
    ]),
    visibleMetrics: uniqueTextValues([
      ...broadMetrics,
      ...focusedMetrics
    ])
  });
}

/*
 * v7.4.20 SITE-AUDIT CHANGE-STATUS VERIFICATION HELPERS
 */
function hasSiteAuditPositiveAdverseDelta(evidence) {
  return (evidence?.visibleMetrics || [])
    .map(clean)
    .filter(Boolean)
    .some(item =>
      /\b(?:errors?|warnings?|issues?|pages\s+with\s+issues|broken(?:\s+pages?)?)\b/i.test(item) &&
      (
        /\bchange\s*:\s*\+\s*\d+(?:\.\d+)?(?:%|\b)/i.test(item) ||
        /\b(?:errors?|warnings?|issues?|pages\s+with\s+issues|broken(?:\s+pages?)?)\b[^\n;|]{0,50}\+\s*\d+(?:\.\d+)?(?:%|\b)/i.test(item)
      )
    );
}

function buildSiteAuditChangeVerificationPrompt({ client, clientId, fileName }) {
  return [
    "You are verifying one SEMrush Site Audit screenshot.",
    "Do NOT transcribe current counts. Do NOT infer previous values.",
    "Your only job is to read the change indicator displayed beside each listed adverse metric.",
    "",
    "STRICT RULES",
    "1. Focus only on Errors, Warnings, Pages With Issues, and Broken Pages.",
    "2. For each metric, return exactly one status: increase, decrease, no_change, or not_readable.",
    "3. If the screenshot literally says 'no change' beside a metric, return no_change.",
    "4. If a clearly visible plus-signed change is beside that metric, return increase.",
    "5. If a clearly visible minus-signed change is beside that metric, return decrease.",
    "6. If the change indicator cannot be read confidently, return not_readable.",
    "7. Do not use the general sentence about whether site health changed to determine a metric's status.",
    "8. Do not guess. Prefer not_readable over a plausible answer.",
    "9. Return only valid JSON. No markdown.",
    "",
    `Selected client context: ${client || clientId || "Unknown"}`,
    `Temporary filename: ${fileName}`,
    "",
    "Return only this JSON contract:",
    JSON.stringify({
      errors: "increase | decrease | no_change | not_readable",
      warnings: "increase | decrease | no_change | not_readable",
      pagesWithIssues: "increase | decrease | no_change | not_readable",
      brokenPages: "increase | decrease | no_change | not_readable"
    }, null, 2)
  ].join("\n");
}

function normalizeSiteAuditChangeVerification(value) {
  const allowed = new Set(["increase", "decrease", "no_change", "not_readable"]);
  const normalizeStatus = status => {
    const cleaned = clean(status).toLowerCase().replace(/\s+/g, "_");
    return allowed.has(cleaned) ? cleaned : "not_readable";
  };

  return {
    errors: normalizeStatus(value?.errors),
    warnings: normalizeStatus(value?.warnings),
    pagesWithIssues: normalizeStatus(value?.pagesWithIssues),
    brokenPages: normalizeStatus(value?.brokenPages)
  };
}

function applySiteAuditChangeVerification({ evidence, verification }) {
  if (!evidence || !verification) return evidence;

  const definitions = [
    { key: "errors", pattern: /\berrors?\b/i },
    { key: "warnings", pattern: /\bwarnings?\b/i },
    { key: "pagesWithIssues", pattern: /\bpages?\s+with\s+issues?\b|\bissues?\b/i },
    { key: "brokenPages", pattern: /\bbroken(?:\s+pages?)?\b/i }
  ];

  const shouldRemovePositiveDelta = item => {
    const line = clean(item);
    if (!line) return false;

    const hasPositiveDelta =
      /\bchange\s*:\s*\+\s*\d+(?:\.\d+)?(?:%|\b)/i.test(line) ||
      /\b(?:errors?|warnings?|issues?|pages\s+with\s+issues|broken(?:\s+pages?)?)\b[^\n;|]{0,50}\+\s*\d+(?:\.\d+)?(?:%|\b)/i.test(line);

    if (!hasPositiveDelta) return false;

    return definitions.some(definition => {
      const status = verification[definition.key];
      return (
        definition.pattern.test(line) &&
        (status === "no_change" || status === "decrease")
      );
    });
  };

  const cleanArray = values => (values || [])
    .map(normalizeEvidenceArrayItem)
    .map(clean)
    .filter(Boolean)
    .filter(item => !shouldRemovePositiveDelta(item));

  let visibleText = clean(evidence.visibleText);
  if (visibleText && shouldRemovePositiveDelta(visibleText)) {
    visibleText = visibleText
      .split(/(?<=[.;])\s+|\n+/)
      .map(clean)
      .filter(Boolean)
      .filter(segment => !shouldRemovePositiveDelta(segment))
      .join(" ");
  }

  const verificationFacts = definitions
    .map(definition => {
      const status = verification[definition.key];
      if (status === "no_change") {
        const label = definition.key === "pagesWithIssues"
          ? "Pages With Issues"
          : definition.key === "brokenPages"
            ? "Broken Pages"
            : definition.key.charAt(0).toUpperCase() + definition.key.slice(1);
        return `${label}: no change`;
      }
      return "";
    })
    .filter(Boolean);

  return normalizeVisibleEvidence({
    ...evidence,
    visibleText,
    visibleFacts: uniqueTextValues([
      ...cleanArray(evidence.visibleFacts),
      ...verificationFacts
    ]),
    visibleMetrics: cleanArray(evidence.visibleMetrics)
  });
}

function protectExplicitSiteAuditNoChangeEvidence({
  baseEvidence,
  focusedEvidence
}) {
  if (!focusedEvidence || !isPlainObject(focusedEvidence)) return focusedEvidence;

  const baseItems = [
    baseEvidence?.visibleText,
    ...(baseEvidence?.visibleFacts || []),
    ...(baseEvidence?.visibleMetrics || [])
  ].map(clean).filter(Boolean);

  const metricDefinitions = [
    { key: "errors", pattern: /\berrors?\b/i },
    { key: "warnings", pattern: /\bwarnings?\b/i },
    { key: "notices", pattern: /\bnotices?\b/i },
    { key: "broken_pages", pattern: /\bbroken(?:\s+pages?)?\b/i },
    { key: "pages_with_issues", pattern: /\bpages?\s+with\s+issues?\b|\bissues?\b/i }
  ];

  const explicitlyStableMetrics = new Set();

  for (const item of baseItems) {
    if (!/\bno\s+change\b|\bunchanged\b/i.test(item)) continue;

    for (const definition of metricDefinitions) {
      if (definition.pattern.test(item)) {
        explicitlyStableMetrics.add(definition.key);
      }
    }
  }

  if (!explicitlyStableMetrics.size) return focusedEvidence;

  const protectedMetrics = (focusedEvidence.visibleMetrics || [])
    .map(normalizeEvidenceArrayItem)
    .map(clean)
    .filter(Boolean)
    .filter(item => {
      const hasContradictoryPositiveDelta =
        /\bchange\s*:\s*\+\s*\d+(?:\.\d+)?(?:%|\b)/i.test(item);

      if (!hasContradictoryPositiveDelta) return true;

      for (const definition of metricDefinitions) {
        if (
          explicitlyStableMetrics.has(definition.key) &&
          definition.pattern.test(item)
        ) {
          return false;
        }
      }

      return true;
    });

  return {
    ...focusedEvidence,
    visibleMetrics: protectedMetrics
  };
}


/*
 * v7.4.17 FINAL SITE-AUDIT EVIDENCE RECONCILIATION
 *
 * Inspect the complete assembled Site Audit evidence after all vision passes.
 * If a metric is explicitly reported as "no change" or "unchanged", remove
 * contradictory positive-delta observations for that SAME adverse metric from
 * visibleMetrics, visibleFacts, and visibleText. This prevents hallucinated
 * deltas from surviving an earlier primary/recovery pass while preserving real
 * deterioration when the screenshot does not establish stability.
 */
function reconcileFinalSiteAuditNoChangeEvidence(evidence) {
  if (!evidence || !isPlainObject(evidence)) return evidence;

  const metricDefinitions = [
    { key: "errors", pattern: /\berrors?\b/i },
    { key: "warnings", pattern: /\bwarnings?\b/i },
    { key: "notices", pattern: /\bnotices?\b/i },
    { key: "broken_pages", pattern: /\bbroken(?:\s+pages?)?\b/i },
    { key: "pages_with_issues", pattern: /\bpages?\s+with\s+issues?\b|\bissues?\b/i }
  ];

  const allItems = [
    evidence.visibleText,
    ...(evidence.visibleFacts || []),
    ...(evidence.visibleMetrics || [])
  ].map(clean).filter(Boolean);

  const stableMetrics = new Set();

  for (const item of allItems) {
    if (!/\bno\s+change\b|\bunchanged\b/i.test(item)) continue;

    for (const definition of metricDefinitions) {
      if (definition.pattern.test(item)) stableMetrics.add(definition.key);
    }
  }

  if (!stableMetrics.size) return evidence;

  const contradictsExplicitStability = value => {
    const item = clean(value);
    if (!item) return false;

    const hasPositiveDelta =
      /\bchange\s*:\s*\+\s*\d+(?:\.\d+)?(?:%|\b)/i.test(item) ||
      /\b(?:errors?|warnings?|notices?|issues?|broken(?:\s+pages?)?)\b[^\n.;]{0,40}\+\s*\d+(?:\.\d+)?\b/i.test(item);

    if (!hasPositiveDelta) return false;

    return metricDefinitions.some(definition =>
      stableMetrics.has(definition.key) && definition.pattern.test(item)
    );
  };

  const cleanArray = values => (values || [])
    .map(normalizeEvidenceArrayItem)
    .map(clean)
    .filter(Boolean)
    .filter(item => !contradictsExplicitStability(item));

  let visibleText = clean(evidence.visibleText);

  /*
   * visibleText can contain several metric statements in one transcription.
   * Remove only contradictory metric-local clauses/segments, not the complete
   * transcription, so project/domain/date and other valid evidence survive.
   */
  if (visibleText && contradictsExplicitStability(visibleText)) {
    const segments = visibleText
      .split(/(?<=[.;])\s+|\n+/)
      .map(clean)
      .filter(Boolean)
      .filter(segment => !contradictsExplicitStability(segment));

    visibleText = segments.join(" ");
  }

  return normalizeVisibleEvidence({
    ...evidence,
    visibleText,
    visibleFacts: cleanArray(evidence.visibleFacts),
    visibleMetrics: cleanArray(evidence.visibleMetrics)
  });
}

/*
 * v7.4.18 SITE-AUDIT PROMPT EXAMPLE HARDENING
 *
 * Site Audit AI prompts use neutral placeholders only. Real production-like
 * numbers are not embedded in prompt examples, preventing example values from
 * being echoed as screenshot evidence. No routing, database, save, UI, or
 * Work Item behavior is changed.
 */
function buildSiteAuditMetricsPrompt({ client, clientId, fileName }) {
  return [
    "You are reading a SEMrush Site Audit notification screenshot.",
    "Your only job is to transcribe clearly readable Site Audit summary metrics and their displayed changes.",
    "",
    "STRICT RULES",
    "1. Ignore browser chrome, Gmail navigation, sender controls, labels, tabs, and unrelated page text.",
    "2. Focus on the central SEMrush Site Audit report body.",
    "3. Read the Site Health, Crawled Pages, page-status counts, Errors, Warnings, Notices, and any visible signed change beside those values.",
    "4. Every metric MUST keep its readable label and value together.",
    "5. When a signed change is visible, keep it in the same visibleMetrics item using 'Change: +N' or 'Change: -N'.",
    "6. Preserve plus and minus signs exactly as shown.",
    "7. Never return an unlabeled number.",
    "8. Never infer a label from position alone if you cannot actually read the label.",
    "9. Never calculate a previous value.",
    "10. Do not decide whether a change is good or bad. Extract evidence only.",
    "11. If a label or number is too blurry to read confidently, omit that metric.",
    "12. Never wrap the JSON in markdown fences.",
    "",
    `Selected client context: ${client || clientId || "Unknown"}`,
    `Temporary filename: ${fileName}`,
    "",
    "Preferred visibleMetrics forms when readable:",
    "Site Health: <value>; Change: <signed change>",
    "Crawled Pages: <value>",
    "Healthy Pages: <value>; Change: <signed change>",
    "Broken Pages: <value>; Change: <signed change>",
    "Pages With Issues: <value>; Change: <signed change>",
    "Redirect Pages: <value>; Change: <signed change>",
    "Blocked Pages: <value>; Change: <signed change>",
    "Errors: <value>; Change: <signed change>",
    "Warnings: <value>; Change: <signed change>",
    "Notices: <value>; Change: <signed change>",
    "",
    "Return only valid JSON matching this contract:",
    JSON.stringify({
      visibleSource: "SEMrush if visibly confirmed; otherwise Unknown",
      visibleSubject: "Site Audit if visibly confirmed; otherwise Unknown",
      visibleText: "Only clearly readable Site Audit metric text",
      visibleFacts: [
        "Clearly readable project/domain/date fact when visible"
      ],
      visibleMetrics: [
        "Errors: <current value>; Change: <signed change or no change>",
        "Warnings: <current value>; Change: <signed change or no change>"
      ],
      responseExpected: false,
      explicitActionRequested: false,
      confidence: "High | Medium | Low",
      uncertainty: "Only unreadable or unverified metric labels/values; otherwise None"
    }, null, 2)
  ].join("\n");
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
    "12a. If you cannot read the exact keyword phrase confidently, omit the entire keyword row even if Position or Change is readable.",
    "12b. Never reconstruct a keyword from partial letters or surrounding context.",
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
  if (!evidence || !isPlainObject(evidence)) return evidence;

  const blockedPatterns = [
    /\bbacklink/i,
    /\breferring domains?\b/i,
    /\banchor text\b/i,
    /\btrusted domains?\b/i,
    /\bhigh[- ]quality domains?\b/i,
    /\btoxic(?:ity)? score\b/i,
    /\bdomains? (?:lost|gained)\b/i,
    /\bsite audit\b/i,
    /\bhealth score\b/i,
    /\bgoogle search console\b/i
  ];

  const safeLine = value => {
    const line = clean(value);
    if (!line) return "";
    if (blockedPatterns.some(pattern => pattern.test(line))) return "";
    if (/\[object Object\]/i.test(line)) return "";
    return line;
  };

  const sanitizeArray = values => {
    if (!Array.isArray(values)) return [];
    return values
      .map(normalizeEvidenceArrayItem)
      .map(safeLine)
      .filter(Boolean)
      .filter(isCrediblePositionTrackingEvidenceLine)
      .slice(0, 30);
  };

  return {
    ...evidence,
    visibleText: safeLine(evidence.visibleText),
    visibleFacts: sanitizeArray(evidence.visibleFacts),
    visibleMetrics: sanitizeArray(evidence.visibleMetrics)
  };
}

function isCrediblePositionTrackingEvidenceLine(value) {
  const line = clean(value);
  if (!line) return false;

  // Preserve non-keyword Position Tracking metrics when they contain a value.
  if (/^(visibility|traffic|landing page|url|date|location|device)\s*:/i.test(line)) {
    return /\d/.test(line);
  }

  if (!/^keyword\s*:/i.test(line)) {
    return true;
  }

  /*
   * Keyword rows are the highest-risk evidence in a small screenshot.
   * Keep only rows that look like plausible search queries and contain an
   * explicit numeric Position. This deliberately favors omission over storing
   * garbled OCR/vision output as business evidence.
   */
  const keywordMatch = line.match(/^keyword\s*:\s*([^;]+)(?:;|$)/i);
  const positionMatch = line.match(/;\s*position\s*:\s*(\d{1,3})(?:;|$)/i);

  if (!keywordMatch || !positionMatch) return false;

  const keyword = clean(keywordMatch[1]).toLowerCase();
  const position = Number(positionMatch[1]);

  if (!keyword || !Number.isFinite(position) || position < 1 || position > 100) {
    return false;
  }

  // Reject obvious UI/browser fragments and malformed extraction.
  const blockedKeywordFragments = [
    "gmail",
    "position tracking",
    "semrush",
    "globalconceptsmedia",
    "inbox",
    "view full report",
    "weekly update",
    "hello",
    "project",
    "device & location"
  ];

  if (blockedKeywordFragments.some(fragment => keyword.includes(fragment))) {
    return false;
  }

  // Require ordinary keyword-like characters and a reasonable token count.
  if (!/^[a-z0-9][a-z0-9 '&+./-]*$/i.test(keyword)) return false;

  const words = keyword.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 8) return false;

  // Reject highly suspicious function-word-heavy phrases produced by blurry OCR.
  const weakWords = new Set([
    "the", "a", "an", "to", "of", "and", "or", "for", "in", "on", "at",
    "is", "are", "was", "were", "be", "been", "you", "your", "that",
    "this", "these", "those", "may", "no", "page", "site", "sites"
  ]);

  const weakCount = words.filter(word => weakWords.has(word)).length;
  if (words.length >= 4 && weakCount / words.length >= 0.6) return false;

  return true;
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


/* =========================================================
   v7.5.0 Evidence Reconciliation, WWPOWD, and Proof Readiness
   ========================================================= */

function communicationEvidenceText(evidence) {
  return [
    evidence?.visibleSource,
    evidence?.visibleSubject,
    evidence?.visibleText,
    ...(evidence?.visibleFacts || []),
    ...(evidence?.visibleMetrics || [])
  ].filter(Boolean).join(" ");
}

function hasStrongSiteAuditSignature(evidence) {
  const text = communicationEvidenceText(evidence);
  const signals = [
    /\bsite audit\b/i,
    /\bsite health\b/i,
    /\bcrawled pages?\b/i,
    /\berrors?\b/i,
    /\bwarnings?\b/i,
    /\bnotices?\b/i,
    /\b(?:new|fixed|resolved|no longer detected)\b.{0,80}\b(?:issues?|errors?|warnings?)\b/i
  ];

  const score = signals.reduce(
    (total, pattern) => total + (pattern.test(text) ? 1 : 0),
    0
  );

  return /\bsite audit\b/i.test(text) || score >= 3;
}

function reconcileCommunicationEvidence({ visibleEvidence, classification }) {
  const evidence = normalizeVisibleEvidence(visibleEvidence || {});
  const originalItems = [
    ...(evidence.visibleFacts || []),
    ...(evidence.visibleMetrics || [])
  ];
  const reconciledItems = uniqueTextValues(originalItems);
  const conflicts = [];

  if (
    (classification?.notificationType === "site_audit" || hasStrongSiteAuditSignature(evidence)) &&
    hasSiteAuditPositiveAdverseDelta(evidence) &&
    /\b(?:no change|unchanged)\b/i.test(communicationEvidenceText(evidence))
  ) {
    conflicts.push("Site Audit contains both adverse positive deltas and stability wording; metric-local evidence controls the decision.");
  }

  const reconciledEvidence = normalizeVisibleEvidence({
    ...evidence,
    visibleFacts: reconciledItems.filter(item => !(evidence.visibleMetrics || []).includes(item)),
    visibleMetrics: uniqueTextValues(evidence.visibleMetrics || []),
    confidence: evidence.confidence
  });

  return {
    evidence: reconciledEvidence,
    conflictCount: conflicts.length,
    conflicts,
    rulesApplied: [
      "Deduplicated evidence",
      "Preserved metric-local labels and deltas",
      "Retained positive and adverse evidence together",
      "Prevented global stability wording from hiding metric-local deterioration"
    ]
  };
}

function parseLabeledMetric(items, labelPattern) {
  for (const rawItem of items || []) {
    const item = clean(rawItem);
    if (!labelPattern.test(item)) continue;

    const valueMatch = item.match(/:\s*([+-]?\d[\d,]*(?:\.\d+)?%?)/i);
    const changeMatch = item.match(/\bchange\s*:\s*([+-]?\d[\d,]*(?:\.\d+)?%?|no change|unchanged)/i);
    return {
      raw: item,
      value: valueMatch ? valueMatch[1] : null,
      change: changeMatch ? changeMatch[1] : null
    };
  }
  return null;
}

function extractCountFromEvidence(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].replace(/,/g, "");
  }
  return null;
}

function signedChangeDirection(change) {
  const value = clean(change).toLowerCase();
  if (!value || /no change|unchanged/.test(value)) return "stable";
  if (/^\+/.test(value)) return "increase";
  if (/^-/.test(value)) return "decrease";
  return "unknown";
}

function buildWwPowdAnalysis({ visibleEvidence, classification }) {
  const evidence = normalizeVisibleEvidence(visibleEvidence || {});
  const text = communicationEvidenceText(evidence);
  const type = classification?.notificationType || "unknown";
  const siteAudit = type === "site_audit" || hasStrongSiteAuditSignature(evidence);

  if (siteAudit) {
    const metrics = evidence.visibleMetrics || [];
    const siteHealth = parseLabeledMetric(metrics, /\bsite health\b/i);
    const errors = parseLabeledMetric(metrics, /\berrors?\b/i);
    const warnings = parseLabeledMetric(metrics, /\bwarnings?\b/i);
    const notices = parseLabeledMetric(metrics, /\bnotices?\b/i);
    const resolvedCount = extractCountFromEvidence(text, [
      /\b(\d[\d,]*)\s+(?:previous\s+)?(?:issues?|errors?\s+and\s+warnings?)\s+(?:were\s+)?(?:fixed|resolved|no longer detected)/i,
      /\b(?:fixed|resolved)\s+(\d[\d,]*)\s+(?:issues?|errors?|warnings?)/i
    ]);
    const newCount = extractCountFromEvidence(text, [
      /\b(\d[\d,]*)\s+new\s+(?:issues?|errors?\s+and\s+warnings?)/i,
      /\b(?:discovered|detected)\s+(\d[\d,]*)\s+new\s+(?:issues?|errors?|warnings?)/i
    ]);

    const adverseMetrics = [errors, warnings]
      .filter(Boolean)
      .filter(metric => signedChangeDirection(metric.change) === "increase");
    const improvingMetrics = [errors, warnings]
      .filter(Boolean)
      .filter(metric => signedChangeDirection(metric.change) === "decrease");
    const mixed = Boolean(
      (resolvedCount && newCount) ||
      (adverseMetrics.length && improvingMetrics.length)
    );
    const adverse = Boolean(newCount || adverseMetrics.length);
    const eventDirection = mixed ? "Mixed" : adverse ? "Negative" : "Neutral";
    const decisionState = adverse ? "investigation_required" : "monitoring_only";

    const resolvedEvidence = uniqueTextValues([
      resolvedCount ? `${resolvedCount} prior issues were fixed, resolved, or no longer detected` : "",
      ...improvingMetrics.map(metric => metric.raw)
    ]);
    const openEvidence = uniqueTextValues([
      newCount ? `${newCount} new issues were discovered` : "",
      ...adverseMetrics.map(metric => metric.raw)
    ]);
    const metricSummary = uniqueTextValues([
      siteHealth?.raw,
      errors?.raw,
      warnings?.raw,
      notices?.raw
    ]).filter(Boolean);

    const whatHappened = uniqueTextValues([
      ...resolvedEvidence,
      ...openEvidence,
      ...metricSummary
    ]).join("; ") || buildEvidenceSummary(evidence, classification);

    return {
      supportedByEvidence: true,
      framework: "WWPOWD",
      notificationType: "site_audit",
      whatHappened,
      eventDirection,
      resolvedEvidence,
      openEvidence,
      measuredEvidence: metricSummary,
      proofGap: adverse
        ? "The communication identifies unresolved or newly discovered technical issues, but does not prove that those issues were diagnosed, corrected, and verified."
        : "The communication is monitoring evidence and does not by itself prove completed corrective work.",
      decisionState,
      operationalSummary: whatHappened,
      businessImpact: adverse
        ? "The audit shows technical progress and/or current site-health status, but unresolved deterioration or newly discovered issues could affect crawlability, indexation, user experience, or organic performance until reviewed."
        : "The audit records current technical SEO condition and should be retained for comparison with future audits.",
      nextAction: adverse
        ? "Create an Investigation to review the new or increasing Site Audit issues, identify the priority causes, establish specific corrective work, and require a follow-up audit as proof."
        : "Save the communication as technical monitoring evidence and continue comparing future Site Audit results.",
      reasoning: adverse
        ? "WWPOWD treats resolved evidence as progress, but it does not treat a mixed audit as completed Proof of Work while new or increasing adverse issues remain unresolved."
        : "WWPOWD records the audit as monitoring evidence because no new adverse condition requiring investigation is established.",
      legacyTsvInterpretation: {
        category: "SEO",
        activity: adverse
          ? "SEMrush Site Audit reviewed; progress and unresolved technical issues identified"
          : "SEMrush Site Audit monitoring review",
        status: adverse ? "investigation_open" : "monitoring",
        evidenceType: "SEMrush Site Audit",
        expectedImpact: adverse
          ? "Resolve priority technical issues and verify improvement through a follow-up audit"
          : "Maintain technical SEO visibility through continued monitoring",
        actualImpact: adverse ? "Awaiting investigation and follow-up proof" : "Monitoring evidence retained"
      },
      confidence: evidence.confidence === "Low" ? "Medium" : evidence.confidence,
      manualReviewRequired: evidence.confidence === "Low"
    };
  }

  const hasAdverseWords = /\b(?:declined?|decreased?|dropped?|lost|failed|error|warning|issue|broken|invalid|toxic|down)\b/i.test(text);
  return {
    supportedByEvidence: type !== "unknown" && evidence.confidence !== "Low",
    framework: "WWPOWD",
    notificationType: type,
    whatHappened: buildEvidenceSummary(evidence, classification),
    eventDirection: hasAdverseWords ? "Negative" : "Neutral",
    resolvedEvidence: [],
    openEvidence: hasAdverseWords ? uniqueTextValues(evidence.visibleMetrics || []) : [],
    measuredEvidence: uniqueTextValues(evidence.visibleMetrics || []),
    proofGap: "The communication is evidence intake. Completed work and verified results require separate operational records.",
    decisionState: hasAdverseWords ? "investigation_required" : "monitoring_only",
    operationalSummary: buildEvidenceSummary(evidence, classification),
    businessImpact: "The communication should be retained and evaluated through the established GCM operating workflow.",
    nextAction: hasAdverseWords
      ? "Create an Investigation when the adverse evidence is specific and unresolved."
      : "Save the communication and continue monitoring.",
    reasoning: "WWPOWD separates evidence intake from completed work and chooses the smallest evidence-supported next step.",
    legacyTsvInterpretation: {
      category: "Communication",
      activity: classification?.notificationFamily || "Communication review",
      status: hasAdverseWords ? "investigation_open" : "monitoring",
      evidenceType: classification?.notificationFamily || "Communication",
      expectedImpact: "Preserve evidence and determine the correct next operational step",
      actualImpact: "Not yet established"
    },
    confidence: evidence.confidence,
    manualReviewRequired: type === "unknown" || evidence.confidence === "Low"
  };
}

function buildProofReadiness({
  visibleEvidence,
  classification,
  wwPowdAnalysis,
  businessMeaning
}) {
  const actionRequested = Boolean(visibleEvidence?.explicitActionRequested);
  const decisionState = wwPowdAnalysis?.decisionState || "manual_review";

  let proofState = "evidence_intake";
  if (decisionState === "investigation_required") proofState = "partial_progress";
  if (decisionState === "work_required" || actionRequested) proofState = "work_not_completed";
  if (decisionState === "monitoring_only") proofState = "monitoring_evidence";

  return {
    proofState,
    readyForClientProof: proofState === "completed_proof",
    communicationIsProofOfWork: false,
    resolvedEvidence: wwPowdAnalysis?.resolvedEvidence || [],
    unresolvedEvidence: wwPowdAnalysis?.openEvidence || [],
    requiredBeforeProof: proofState === "partial_progress"
      ? [
          "Investigation findings",
          "Specific work required",
          "Completed corrective work",
          "Immediate or follow-up verification",
          "Measured result or documented awaiting-proof state"
        ]
      : [
          "A completed activity or work record",
          "Evidence that the work occurred",
          "Verification or result appropriate to the work"
        ],
    recommendedRecord: decisionState === "investigation_required"
      ? "Communication + Investigation"
      : decisionState === "work_required"
        ? "Communication + Work Item"
        : "Communication",
    reasoning: businessMeaning?.reasoning || wwPowdAnalysis?.reasoning || "Proof readiness is based on the current operational state.",
    confidence: wwPowdAnalysis?.confidence || visibleEvidence?.confidence || "Low"
  };
}

async function executeBusinessMeaningStage({
  client,
  clientId,
  fileName,
  visibleEvidence,
  classification,
  wwPowdAnalysis,
  env,
  requestId
}) {
  const stageStartedAt = Date.now();
  const stageName = "business_meaning";

  const deterministicMeaning = buildDeterministicBusinessMeaning({
    visibleEvidence,
    classification,
    wwPowdAnalysis
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
    "WWPOWD INTERPRETATION",
    JSON.stringify(wwPowdAnalysis, null, 2),
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

  /*
   * v7.4.5 GOOGLE ANALYTICS SIGNATURE RECOGNITION
   *
   * Real GA4 report emails may be cropped below the sender/logo area. In those
   * screenshots, Gmail can be visible while Google Analytics is not named.
   * Recognize GA4 from a combination of its characteristic report metrics
   * rather than requiring the literal words "Google Analytics" or "GA4".
   */
  const analyticsSignatureSignals = [
    /\bactive users?\b/i,
    /\bnew users?\b/i,
    /\bavg(?:erage)? engagement time\b/i,
    /\bevents?\b/i,
    /\bpage\/?screen name\b/i,
    /\bbounce rate\b/i,
    /\bviews?\b/i
  ];

  const analyticsSignatureScore = analyticsSignatureSignals.reduce(
    (total, pattern) => total + (pattern.test(searchable) ? 1 : 0),
    0
  );

  const analyticsMetricSignature = analyticsSignatureScore >= 2;

  const platformRules = [
    { platform: "semrush", patterns: [/\bsemrush\b/i] },
    { platform: "google_search_console", patterns: [/google search console/i, /\bsearch console\b/i] },
    { platform: "google_business_profile", patterns: [/google business profile/i, /\bbusiness profile\b/i] },
    { platform: "google_analytics", patterns: [/google analytics/i, /\bga4\b/i] },
    { platform: "google_maps_platform", patterns: [/google maps platform/i, /google-maps-platform/i] }
  ];

  const typeRules = [
    { type: "disavow_file_update", family: "Google Search Console — Disavow File Update", patterns: [/disavow file updated/i, /update to the disavow file/i, /new disavow file contains/i, /disavow links?/i] },
    { type: "merchant_listing_structured_data", family: "Google Search Console — Merchant Listings Structured Data", patterns: [/merchant listings?/i, /merchant listings? structured data/i, /structured data issues?/i, /invalid string length in field ["']?sku["']?/i] },
    { type: "page_indexing_resolution", family: "Google Search Console — Page Indexing Resolution", patterns: [/page indexing issues? successfully fixed/i, /indexing issues? successfully fixed/i, /validation (?:passed|complete|completed|successful)/i, /pages? validated as fixed/i, /successfully validated/i] },
    { type: "position_tracking", family: "SEMrush Position Tracking", patterns: [/position tracking/i, /keyword positions?/i, /rankings?/i, /keywords? improved/i, /keywords? declined/i, /top 3/i, /top 10/i] },
    { type: "backlink_audit", family: "SEMrush Backlink Audit", patterns: [/backlink audit/i, /backlinks?/i, /referring domains?/i, /lost domains?/i, /new domains?/i, /toxic(?:ity)?/i] },
    { type: "site_audit", family: "SEMrush Site Audit", patterns: [/site audit/i, /site health/i, /crawled pages?/i, /crawlability/i, /core web vitals/i, /technical issues?/i] },
    { type: "search_performance", family: "Google Search Console", patterns: [/google search console/i, /search performance/i, /search console/i] },
    { type: "business_profile", family: "Google Business Profile", patterns: [/google business profile/i, /business profile/i, /profile views?/i, /calls? from your profile/i] },
    { type: "analytics", family: "Google Analytics", patterns: [/google analytics/i, /\bga4\b/i, /analytics notification/i] },
    { type: "billing_notice", family: "Billing Notice", patterns: [/invoice/i, /billing/i, /payment failed/i, /past due/i, /receipt/i] },
    { type: "access_security", family: "Access or Security Notice", patterns: [/security alert/i, /new sign-in/i, /password/i, /access request/i, /verification code/i, /compromised/i] },
    { type: "vendor_notice", family: "Platform / Vendor Notice", patterns: [/google maps platform/i, /google-maps-platform/i, /platform customer/i, /service notice/i, /action advised/i, /deprecat(?:e|ed|ion)/i, /development environments?/i] },
    { type: "client_request", family: "Human Email", patterns: [/can you/i, /could you/i, /please/i, /need you to/i, /let me know/i, /approve/i, /schedule/i] }
  ];

  let platform = "unknown";
  for (const rule of platformRules) {
    if (rule.patterns.some(pattern => pattern.test(searchable))) {
      platform = rule.platform;
      break;
    }
  }

  if (platform === "unknown" && analyticsMetricSignature) {
    platform = "google_analytics";
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

  if (analyticsMetricSignature && notificationType === "unknown") {
    notificationType = "analytics";
    notificationFamily = "Google Analytics";
    bestScore = Math.max(bestScore, analyticsSignatureScore);
  }

  /*
   * v7.4.8 SEARCH CONSOLE SUBTYPE GUARDRAIL
   * Search Console is a platform, not a notification type.
   */
  const merchantListingStructuredDataSignal =
    /merchant listings?|merchant listings? structured data|structured data issues?|invalid string length in field ["']?sku["']?/i.test(searchable);

  if (platform === "google_search_console" && merchantListingStructuredDataSignal) {
    notificationType = "merchant_listing_structured_data";
    notificationFamily = "Google Search Console — Merchant Listings Structured Data";
    bestScore = Math.max(bestScore, 3);
  }

  /*
   * v7.4.28 SEARCH CONSOLE PAGE-INDEXING RESOLUTION GUARDRAIL
   * A successful validation/fix confirmation is durable technical evidence,
   * not a generic Search Performance notification.
   */
  const pageIndexingResolutionSignal =
    /page indexing issues? successfully fixed|indexing issues? successfully fixed|validation (?:passed|complete|completed|successful)|pages? validated as fixed|successfully validated/i.test(searchable);

  if (platform === "google_search_console" && pageIndexingResolutionSignal) {
    notificationType = "page_indexing_resolution";
    notificationFamily = "Google Search Console — Page Indexing Resolution";
    bestScore = Math.max(bestScore, 3);
  }

  /*
   * v7.4.9 SEARCH CONSOLE DISAVOW SUBTYPE GUARDRAIL
   * A Disavow File Updated notice is a confirmation/history event, not a
   * generic Search Performance notification.
   */
  const disavowFileUpdateSignal =
    /disavow file updated|update to the disavow file|new disavow file contains|disavow links?/i.test(searchable);

  if (platform === "google_search_console" && disavowFileUpdateSignal) {
    notificationType = "disavow_file_update";
    notificationFamily = "Google Search Console — Disavow File Update";
    bestScore = Math.max(bestScore, 3);
  }

  /* v7.4.7: recognized automated platform identity outranks generic polite request wording. */
  if (platform === "google_maps_platform") {
    notificationType = "vendor_notice";
    notificationFamily = "Platform / Vendor Notice";
    bestScore = Math.max(bestScore, 2);
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

function buildOperationalDecision({
  visibleEvidence,
  classification,
  businessMeaning,
  wwPowdAnalysis,
  proofReadiness
}) {
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

  /* v7.5.0 WWPOWD / PROOF-READINESS ROUTING AUTHORITY */
  if (wwPowdAnalysis?.decisionState === "investigation_required") {
    routes.createInvestigation = true;
    routes.createWorkItem = false;
  }

  if (wwPowdAnalysis?.decisionState === "work_required") {
    routes.createWorkItem = Boolean(visibleEvidence?.explicitActionRequested);
    routes.createInvestigation = !routes.createWorkItem;
  }

  if (proofReadiness?.proofState === "completed_proof") {
    routes.createInvestigation = false;
    routes.createWorkItem = false;
  }

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

    /*
     * v7.4.2 ROUTINE-MONITORING ROUTING GUARDRAIL
     *
     * For automated monitoring platforms, positive/neutral evidence remains
     * historical monitoring evidence unless the visible evidence itself
     * establishes a reason to escalate. A Business Meaning recommendation
     * alone must not create an Investigation.
     */
    if (automatedPlatforms.has(classification.platform)) {
      routes.createInvestigation = false;
    }

    if (!["High", "Critical"].includes(importance)) {
        importance = "Low";
    }
}

  if (
    visibleEvidence?.confidence === "Low" ||
    (
      classification.notificationType === "unknown" &&
      !wwPowdAnalysis?.supportedByEvidence
    )
  ) {
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
    page_indexing_resolution: "Google Search Console",
    merchant_listing_structured_data: "Google Search Console",
    disavow_file_update: "Google Search Console",
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
  const operationalSummary = clean(wwPowdAnalysis?.operationalSummary)
    || clean(businessMeaning?.operationalSummary)
    || buildEvidenceSummary(visibleEvidence, classification);
  const businessImpact = clean(businessMeaning?.businessImpact) || "The communication should be retained in the client history and reviewed according to the visible evidence.";
  const recommendedAction = clean(wwPowdAnalysis?.nextAction)
    || clean(businessMeaning?.recommendedAction)
    || defaultOperationalAction({ routes, visibleEvidence });
  const reasoning = clean(businessMeaning?.reasoning) || `Routing is based on deterministic ${classification.notificationFamily} classification and the visible evidence confidence.`;

  /*
   * v7.4.3 FINAL ROUTE/REASONING CONSISTENCY GUARDRAIL
   *
   * The MoveASafe road test exposed a contradiction: Business Meaning said
   * "No operational action is currently required beyond maintaining the
   * historical record" while the final route still created an Investigation.
   *
   * For automated monitoring platforms, an explicit no-action / historical-
   * monitoring conclusion must control the final route unless the item has
   * already reached High or Critical importance from stronger evidence.
   */
  const reasoningText = reasoning.toLowerCase();
  const recommendedActionText = recommendedAction.toLowerCase();
  const noActionMonitoringConclusion =
    /no operational action is currently required|no operational action required|maintain(?:ing)? the historical record|historical monitoring evidence|routine monitoring communication/.test(
      `${reasoningText} ${recommendedActionText}`
    );

  /*
   * v7.4.27 ADVERSE-MONITORING CONSISTENCY PROTECTION
   *
   * The v7.4.3 no-action guardrail remains valuable for routine monitoring,
   * but it must not cancel an Investigation when the deterministic Business
   * Meaning engine has already identified a Negative/Mixed condition and
   * explicitly recommended investigation.
   *
   * This preserves the earlier MoveASafe protection while allowing specific
   * unresolved deterioration evidence — such as a tracked keyword leaving the
   * Top 10 with a negative position change — to proceed to Investigation.
   */
  const supportedAdverseInvestigation =
    normalizeBoolean(businessMeaning?.investigationSuggested, false) &&
    ["Negative", "Mixed"].includes(direction);

  if (
    automatedPlatforms.has(classification.platform) &&
    noActionMonitoringConclusion &&
    !supportedAdverseInvestigation &&
    !["High", "Critical"].includes(importance)
  ) {
    routes.createInvestigation = false;
    routes.createWorkItem = false;
    routes.replyRequired = false;
    importance = "Low";
  }

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
    wwPowdAnalysis,
    proofReadiness,
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

function buildConsultantSummary({
  classification,
  visibleEvidence,
  businessMeaning,
  wwPowdAnalysis,
  proofReadiness,
  operationalDecision
}) {
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
    proofState: proofReadiness?.proofState || "not_evaluated",
    wwPowdDecision: wwPowdAnalysis?.decisionState || "manual_review",
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

function buildDeterministicBusinessMeaning({ visibleEvidence, classification, wwPowdAnalysis }) {
  const platform = classification?.platform || "unknown";
  const type = classification?.notificationType || "unknown";

  // Supported notification types are resolved by notificationType first.
  // The platform value is retained for diagnostics, but a visually misread or
  // missing platform must never force a known notification into the AI path.
  const supportedTypes = new Set([
    "position_tracking",
    "backlink_audit",
    "site_audit",
    "merchant_listing_structured_data",
    "disavow_file_update",
    "page_indexing_resolution",
    "search_performance",
    "business_profile",
    "analytics",
    "client_request",
    "vendor_notice"
  ]);

  if (!supportedTypes.has(type)) return null;

  if (type === "site_audit" && wwPowdAnalysis?.supportedByEvidence) {
    const adverse = wwPowdAnalysis.decisionState === "investigation_required";
    return {
      eventDirection: wwPowdAnalysis.eventDirection,
      operationalSummary: wwPowdAnalysis.operationalSummary,
      businessImpact: wwPowdAnalysis.businessImpact,
      importance: adverse ? "High" : "Low",
      recommendedAction: wwPowdAnalysis.nextAction,
      investigationSuggested: adverse,
      workItemSuggested: false,
      replySuggested: false,
      reasoning: wwPowdAnalysis.reasoning,
      recordPurpose: "Technical SEO Monitoring Evidence",
      operationalLabel: adverse ? "Review Required" : "Technical Monitoring Update",
      confidence: wwPowdAnalysis.confidence,
      fallbackUsed: false,
      intelligenceTrace: {
        engine: "communication-intelligence-v2",
        path: "wwpowd-deterministic",
        definition: "site-audit-wwpowd",
        platform,
        notificationType: type,
        aiUsed: false,
        fallbackUsed: false
      }
    };
  }

  /*
   * v7.4.22 HUMAN COMMUNICATION DETERMINISTIC MEANING
   *
   * Human/client email must remain operationally useful when the reasoning
   * model is unavailable or returns an empty response. The evidence extractor
   * already records whether the source explicitly requests action or expects a
   * response. Use only those evidence-grounded signals here; do not infer work,
   * urgency, completion, or business results that the communication does not
   * establish.
   */
  if (type === "client_request") {
    const facts = uniqueTextValues([
      ...(visibleEvidence?.visibleFacts || []),
      ...(visibleEvidence?.visibleMetrics || [])
    ]);
    const evidenceDetail = facts.length
      ? ` Visible evidence: ${facts.join("; ")}.`
      : "";

    const actionRequested = Boolean(visibleEvidence?.explicitActionRequested);
    const responseExpected = Boolean(visibleEvidence?.responseExpected);

    if (actionRequested) {
      return {
        eventDirection: "Neutral",
        operationalSummary: `A human business communication was received with an explicit action request.${evidenceDetail}`,
        businessImpact: "The communication contains a source-grounded request that should be retained and handled through the normal operational workflow.",
        importance: "Normal",
        recommendedAction: "Save the communication and review the explicit request. Create a Work Item only when the required action is specific and established by the evidence.",
        investigationSuggested: false,
        workItemSuggested: true,
        replySuggested: responseExpected,
        reasoning: "The visible evidence explicitly requests action. This supports operational follow-up without requiring AI interpretation, but it does not by itself prove that the requested work has been completed.",
        recordPurpose: "Communication Record",
        operationalLabel: "Human Email — Action Requested",
        confidence: "High",
        fallbackUsed: false,
        intelligenceTrace: {
          engine: "communication-intelligence-v1",
          path: "deterministic",
          definition: "human-explicit-action-request",
          platform,
          notificationType: type,
          aiUsed: false,
          fallbackUsed: false
        }
      };
    }

    if (responseExpected) {
      return {
        eventDirection: "Neutral",
        operationalSummary: `A human business communication was received that explicitly expects a response or confirmation.${evidenceDetail}`,
        businessImpact: "The communication should be retained as client/vendor history and answered because the source explicitly expects a response.",
        importance: "Normal",
        recommendedAction: "Save the communication and prepare the required response. No Investigation is required unless separate evidence establishes an unresolved problem.",
        investigationSuggested: false,
        workItemSuggested: false,
        replySuggested: true,
        reasoning: "The visible evidence explicitly indicates that a response or confirmation is expected. No separate operational problem is established by that fact alone.",
        recordPurpose: "Communication Record",
        operationalLabel: "Human Email — Reply Required",
        confidence: "High",
        fallbackUsed: false,
        intelligenceTrace: {
          engine: "communication-intelligence-v1",
          path: "deterministic",
          definition: "human-response-expected",
          platform,
          notificationType: type,
          aiUsed: false,
          fallbackUsed: false
        }
      };
    }

    return {
      eventDirection: "Neutral",
      operationalSummary: `A human business communication was received as information or confirmation.${evidenceDetail}`,
      businessImpact: "The communication provides business history or confirmation and should be retained without automatically creating investigative or production work.",
      importance: "Low",
      recommendedAction: "Save the communication to the client history. No Investigation or Work Item is required from this communication alone.",
      investigationSuggested: false,
      workItemSuggested: false,
      replySuggested: false,
      reasoning: "The visible evidence contains no explicit action request and does not explicitly require a response. The communication can therefore be retained as information or confirmation without inventing additional work.",
      recordPurpose: "Communication Record",
      operationalLabel: "Human Email — Information / Confirmation",
      confidence: "High",
      fallbackUsed: false,
      intelligenceTrace: {
        engine: "communication-intelligence-v1",
        path: "deterministic",
        definition: "human-information-confirmation",
        platform,
        notificationType: type,
        aiUsed: false,
        fallbackUsed: false
      }
    };
  }

  /* v7.4.7: deterministic triage for automated platform/vendor notices. */
  if (type === "vendor_notice") {
    return {
      eventDirection: "Neutral",
      operationalSummary: "A platform/vendor service notice was received. No current client-specific impact is identified in the visible evidence.",
      businessImpact: "The notice describes a platform or development-environment change, but the visible evidence does not establish that a current GCM client requires action.",
      importance: "Low",
      recommendedAction: "No Operational Record Required. No current client impact or required operational action is identified.",
      investigationSuggested: false,
      workItemSuggested: false,
      replySuggested: false,
      reasoning: "This is an automated platform/vendor notice rather than a human client request. Without evidence tying the notice to a current client account or required GCM action, it should not create operational work.",
      recordPurpose: "No Operational Record Required",
      operationalLabel: "No Operational Record Required",
      confidence: "High",
      fallbackUsed: false,
      intelligenceTrace: {
        engine: "communication-intelligence-v1",
        path: "deterministic",
        definition: "platform-vendor-notice",
        platform,
        notificationType: type,
        aiUsed: false,
        fallbackUsed: false
      }
    };
  }

  /*
   * v7.4.9 DISAVOW FILE UPDATE CONFIRMATION
   * Search Console is confirming that a disavow file changed. Preserve the
   * visible counts as historical backlink-management evidence. The notice
   * itself does not establish a new problem requiring investigation or work.
   */
  if (type === "disavow_file_update") {
    const facts = uniqueTextValues([
      ...(visibleEvidence?.visibleMetrics || []),
      ...(visibleEvidence?.visibleFacts || [])
    ]);
    const evidenceDetail = facts.length ? ` Visible evidence: ${facts.join("; ")}.` : "";

    return {
      eventDirection: "Neutral",
      operationalSummary: `Google Search Console confirmed that the site's Disavow File was updated.${evidenceDetail}`,
      businessImpact: "This records a backlink-management change in Google Search Console and should be retained as historical evidence of the disavow-file state.",
      importance: "Low",
      recommendedAction: "Save the communication to the client history. No new Investigation or Work Item is required from this confirmation alone.",
      investigationSuggested: false,
      workItemSuggested: false,
      replySuggested: false,
      reasoning: "A Disavow File Updated notice confirms a completed change in Search Console. It is evidence/history rather than a new search-performance alert.",
      recordPurpose: "Historical Backlink Management Evidence",
      operationalLabel: "Disavow File Update — Confirmation",
      confidence: "High",
      fallbackUsed: false,
      intelligenceTrace: {
        engine: "communication-intelligence-v1",
        path: "deterministic",
        definition: "google-search-console-disavow-file-update",
        platform,
        notificationType: type,
        aiUsed: false,
        fallbackUsed: false
      }
    };
  }

  const text = [
    visibleEvidence?.visibleSubject,
    visibleEvidence?.visibleText,
    ...(visibleEvidence?.visibleFacts || []),
    ...(visibleEvidence?.visibleMetrics || [])
  ].filter(Boolean).join(" ").toLowerCase();

  /*
   * v7.4.2 ROUTINE-MONITORING STABILITY GUARDRAIL
   *
   * Automated reports often repeat standing errors, warnings, issues, or
   * crawlability notices even when the report explicitly states that there
   * has been no significant change. Standing conditions alone are not a new
   * adverse event.
   */
  const stabilitySignal =
    /haven['’]?t detected any significant changes|no significant changes|no significant change|no change|unchanged|remains? stable|stable since|without significant change/.test(text);

  /*
   * v7.4.15 SITE-AUDIT METRIC-LOCAL DETERIORATION GUARDRAIL
   *
   * Road testing proved that scanning visibleText/facts or an ordered merged
   * evidence stream can falsely associate an unrelated positive number with a
   * standing adverse metric. Example: a stable Site Audit can contain "Errors
   * 8 — no change" while another nearby metric contains a positive value.
   *
   * Numeric deterioration is therefore accepted ONLY when one structured
   * visibleMetrics item contains BOTH:
   *   1. an adverse Site Audit metric label, and
   *   2. that same metric's explicit positive signed Change/delta.
   *
   * Examples that escalate:
   *   "Errors: 136; Change: +27"
   *   "Warnings: 7600; Change: +27"
   *
   * Examples that do not escalate:
   *   "Errors: 8; no change"
   *   "Warnings: 547; no change"
   *   "Notices: 94; no change"
   *
   * Explicit adverse wording such as "errors increased", "new error", or
   * "worsened" remains handled separately by adverseChangeSignal below.
   */
  const siteAuditMetricItems = (visibleEvidence?.visibleMetrics || [])
    .map(clean)
    .filter(Boolean);

  const adverseIssueMetricLabelPattern =
    /\b(?:errors?|warnings?|issues?|pages\s+with\s+issues|broken(?:\s+pages?)?)\b/i;

  const explicitPositiveMetricChangePattern =
    /\bchange\s*:\s*\+\s*\d+(?:\.\d+)?(?:%|\b)/i;

  const compactPositiveMetricDeltaPattern =
    /\b(?:errors?|warnings?|issues?|pages\s+with\s+issues|broken(?:\s+pages?)?)\b[^\n;|]{0,50}\+\s*\d+(?:\.\d+)?(?:%|\b)/i;

  const adverseIssueCountIncreaseSignal =
    siteAuditMetricItems.some(item =>
      adverseIssueMetricLabelPattern.test(item) &&
      (
        explicitPositiveMetricChangePattern.test(item) ||
        compactPositiveMetricDeltaPattern.test(item)
      ) &&
      !/\bno\s+change\b|\bunchanged\b/i.test(item)
    );

  const adverseChangeSignal =
    /declin|decreas|drop|dropped|lost|loss|critical|failed|failure|down\b|toxic|worsen|worsened|worsening|new error|new warning|new issue|errors? increased|warnings? increased|issues? increased|significant negative change|adverse movement/.test(text)
    || adverseIssueCountIncreaseSignal;

  const standingIssueSignal =
    /error|warning|issue|problem|crawlability|not crawled|couldn['’]?t crawl|cannot crawl|blocked/.test(text);

  /*
   * v7.4.14 SITE-AUDIT ESCALATION RULE — ROAD-TEST LOCK
   *
   * A Site Audit is a recurring monitoring report. Existing errors, warnings,
   * notices, redirects, 4XX pages, crawl discrepancies, or other standing
   * technical issues do NOT create an Investigation merely because they are
   * present in the report.
   *
   * Escalate only when the current communication contains evidence of a NEW or
   * MATERIALLY WORSENING condition. The strongest deterministic signal is a
   * positive signed delta on an adverse issue metric such as Errors, Warnings,
   * Issues, Pages With Issues, or Broken Pages. Explicit wording such as
   * "worsened", "new error", or "errors increased" also qualifies.
   *
   * "No change", unchanged standing counts, and improving adverse counts remain
   * Technical Monitoring Updates. Corrective work is never created directly
   * from the Site Audit notification; an Investigation must establish it first.
   */
  /*
   * v7.4.27 POSITION-TRACKING DETERIORATION ROUTING FIX
   *
   * A real SES road test showed that Position Tracking evidence such as
   * "2 keywords left the Top 10" with keyword-row Change: -19 values could be
   * extracted correctly but still be treated as routine monitoring because the
   * generic adverse-change detector did not recognize a negative signed ranking
   * movement or the phrase "left the Top 10".
   *
   * For Position Tracking only, recognize explicit loss of a tracked ranking
   * tier and negative keyword-position changes as adverse evidence. This opens
   * an Investigation so the cause can be verified before corrective work is
   * created. It does NOT create a Work Item directly.
   */
  const positionTrackingAdverseMovementSignal =
    type === "position_tracking" &&
    (
      /\bleft\s+the\s+top\s+(?:3|10|20|100)\b/i.test(text) ||
      /\bdropped?\s+out\s+of\s+the\s+top\s+(?:3|10|20|100)\b/i.test(text) ||
      /\bkeyword\b[^\n;|]{0,120}\bchange\s*:\s*-\s*\d+(?:\.\d+)?\b/i.test(text) ||
      /\bposition\s*:\s*\d{1,3}\b[^\n;|]{0,80}\bchange\s*:\s*-\s*\d+(?:\.\d+)?\b/i.test(text)
    );

  const negative =
    type === "site_audit"
      ? adverseChangeSignal
      : type === "position_tracking"
        ? adverseChangeSignal || positionTrackingAdverseMovementSignal
        : adverseChangeSignal || (standingIssueSignal && !stabilitySignal);

  const positive = /improv|increas|gain|grew|growth|up\b|new high|milestone|positive/.test(text);
  const eventDirection = type === "page_indexing_resolution"
    ? "Positive"
    : negative && positive
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
        ? "A specific unresolved or worsening technical condition may affect crawlability or site performance and should be verified in the Site Audit project."
        : "The notification documents the current technical-audit condition and should be retained as historical monitoring evidence.",
      action: negative
        ? "Save the communication and investigate the specific unresolved or worsening Site Audit condition before creating corrective work."
        : "Save the communication to the client history and continue routine Site Audit monitoring.",
      reasoning: negative
        ? "The Site Audit contains evidence of a specific unresolved or worsening technical condition. Investigation is appropriate before corrective work is assigned."
        : "Routine SEMrush Site Audit monitoring communication. Standing errors, warnings, or crawlability notices do not by themselves require an Investigation without evidence of deterioration.",
      recordPurpose: "Technical SEO Monitoring Evidence",
      operationalLabel: negative ? "Review Required" : "Technical Monitoring Update"
    },
    page_indexing_resolution: {
      summary: `Google Search Console confirmed that a previously reported page-indexing condition was successfully validated as fixed.${evidenceDetail}`,
      impact: "This is positive technical verification that Google accepted the reported indexing correction for the affected pages. It should be retained as outcome evidence and compared with any related open Investigation or prior corrective work.",
      action: "Save the communication as page-indexing resolution evidence. Attach it to a related open Investigation when one exists; otherwise retain it as historical technical monitoring evidence. Do not create a new Investigation or Work Item from this confirmation alone.",
      reasoning: "The source explicitly confirms successful validation of a previously reported indexing issue. The communication verifies an outcome but does not, by itself, prove which agency action caused the resolution.",
      recordPurpose: "Page Indexing Resolution Evidence",
      operationalLabel: "Technical Resolution Confirmed"
    },
    merchant_listing_structured_data: {
      summary: `Google Search Console detected a Merchant listings structured-data issue.${evidenceDetail} The reported condition should be diagnosed before corrective work is assigned.`,
      impact: "The visible evidence identifies a Merchant listings structured-data problem. The notice describes it as non-critical, so it does not currently prevent the affected page or feature from appearing on Google, but the affected product/page and markup cause should be verified.",
      action: "Save the communication and open an Investigation to identify the affected product/page, verify the invalid SKU structured-data value, and determine the required correction. Do not create a Work Item until the required fix is known.",
      reasoning: "This is a specific Search Console structured-data condition, not a search-performance report. The evidence establishes an issue that requires diagnosis, but it does not yet establish the exact corrective work.",
      recordPurpose: "Structured Data Issue Evidence",
      operationalLabel: "Review Required"
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
    ["backlink_audit", "merchant_listing_structured_data"].includes(type)
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
    importance: type === "merchant_listing_structured_data" ? "Medium" : negative ? "Medium" : "Low",
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
    page_indexing_resolution: "Page Indexing Resolution Evidence",
    backlink_audit: "Backlink Health Monitoring Evidence",
    site_audit: "Technical SEO Monitoring Evidence",
    merchant_listing_structured_data: "Structured Data Issue Evidence",
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
    page_indexing_resolution: "Technical Resolution Confirmed",
    backlink_audit: "Backlink Monitoring Update",
    site_audit: "Technical Monitoring Update",
    merchant_listing_structured_data: "Review Required",
    search_performance: "Search Performance Update",
    business_profile: "Local Presence Update",
    analytics: "Analytics Update",
    vendor_notice: "Platform / Vendor Notice"
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
    page_indexing_resolution: "Page Indexing Resolution Confirmation",
    backlink_audit: "SEO Backlink Alert",
    site_audit: "Technical SEO Audit Alert",
    merchant_listing_structured_data: "Merchant Listings Structured Data Alert",
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
    google_maps_platform: "Google Maps Platform",
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

  return value
    .map(normalizeEvidenceArrayItem)
    .map(clean)
    .filter(Boolean)
    .slice(0, 30);
}

function normalizeEvidenceArrayItem(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map(normalizeEvidenceArrayItem)
      .map(clean)
      .filter(Boolean)
      .join("; ");
  }

  if (!isPlainObject(value)) {
    return clean(value);
  }

  /*
   * Workers AI may return evidence rows as structured JSON objects even when
   * the prompt asks for strings. Preserve those values instead of allowing
   * JavaScript string coercion to collapse them into "[object Object]".
   *
   * Common Position Tracking example:
   * { keyword: "ammo safes", position: 9, change: "+91", volume: 10 }
   * becomes:
   * "Keyword: ammo safes; Position: 9; Change: +91; Volume: 10"
   */
  const preferredOrder = [
    "keyword",
    "landingPage",
    "landing_page",
    "url",
    "path",
    "metric",
    "label",
    "name",
    "value",
    "position",
    "change",
    "direction",
    "volume",
    "traffic",
    "visibility",
    "date",
    "location",
    "device"
  ];

  const entries = [];
  const usedKeys = new Set();

  const appendEntry = (key, rawValue) => {
    if (rawValue === null || rawValue === undefined || rawValue === "") return;

    const normalizedValue = normalizeEvidenceArrayItem(rawValue);
    if (!normalizedValue) return;

    const label = humanizeEvidenceKey(key);
    entries.push(`${label}: ${normalizedValue}`);
    usedKeys.add(key);
  };

  for (const key of preferredOrder) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      appendEntry(key, value[key]);
    }
  }

  for (const [key, rawValue] of Object.entries(value)) {
    if (usedKeys.has(key)) continue;
    appendEntry(key, rawValue);
  }

  return entries.join("; ");
}

function humanizeEvidenceKey(key) {
  const aliases = {
    landingPage: "Landing page",
    landing_page: "Landing page",
    url: "URL",
    keyword: "Keyword",
    position: "Position",
    change: "Change",
    direction: "Direction",
    volume: "Volume",
    traffic: "Traffic",
    visibility: "Visibility",
    metric: "Metric",
    label: "Label",
    name: "Name",
    value: "Value",
    date: "Date",
    location: "Location",
    device: "Device",
    path: "Path"
  };

  if (aliases[key]) return aliases[key];

  return String(key || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, character => character.toUpperCase());
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
