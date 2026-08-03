/* =========================================================
   Global Concepts Media Operating System
   File: shared/engines/semrushEngine.js
   Version: 1.0.0
   Status: Production Candidate
   Source: Extracted from routes/communicationAnalysis.js 7.7.5
   Sprint: Specialized Communication Engines
   Purpose: SEMrush-specific report detection and evidence enrichment for
            Position Tracking, Site Audit, and Backlink Audit communications.
            Returns normalized evidence without making the final operational
            decision.
   ========================================================= */

import {
  COMMUNICATION_VISION_MODEL,
  ACTIONS
} from "../config.js";

import {
  clean,
  isPlainObject,
  safeErrorMessage,
  logWorkerError
} from "../http.js";

import {
  runAiJsonWithRetry
} from "../ai.js";

export const SEMRUSH_ENGINE_VERSION = "1.0.0";

export const SEMRUSH_REPORT_TYPES = Object.freeze({
  POSITION_TRACKING: "position_tracking",
  SITE_AUDIT: "site_audit",
  BACKLINK_AUDIT: "backlink_audit",
  UNKNOWN: "unknown"
});

/**
 * Enrich already-extracted communication evidence with report-specific
 * SEMrush evidence. The caller remains responsible for final classification,
 * WWPOWD interpretation, business meaning, and operational routing.
 */
export async function analyzeSemrushCommunication({
  evidence,
  reportRecognition = null,
  imageDataUrl = "",
  sourceText = "",
  client = "",
  clientId = "",
  fileName = "communication-screenshot",
  env,
  requestId
}) {
  const startedAt = Date.now();
  let normalizedEvidence = normalizeEvidence(evidence);
  const reportType = detectSemrushReportType({
    evidence: normalizedEvidence,
    reportRecognition,
    sourceText
  });

  if (reportType === SEMRUSH_REPORT_TYPES.UNKNOWN) {
    return {
      ok: true,
      handled: false,
      reportType,
      evidence: normalizedEvidence,
      stages: [],
      errors: [],
      diagnostics: {
        engine: "semrush-engine",
        engineVersion: SEMRUSH_ENGINE_VERSION,
        executionTimeMs: Date.now() - startedAt
      }
    };
  }

  if (!imageDataUrl) {
    normalizedEvidence = applySemrushIdentity(normalizedEvidence, reportType);

    return {
      ok: true,
      handled: true,
      reportType,
      evidence: normalizedEvidence,
      stages: [{
        stageName: "semrush_text_normalization",
        status: "success",
        engine: `semrush-engine-v${SEMRUSH_ENGINE_VERSION}`,
        model: "deterministic",
        executionTimeMs: Date.now() - startedAt,
        retryCount: 0,
        retryStatus: "not_required",
        fallbackUsed: false
      }],
      errors: [],
      diagnostics: {
        engine: "semrush-engine",
        engineVersion: SEMRUSH_ENGINE_VERSION,
        executionTimeMs: Date.now() - startedAt
      }
    };
  }

  if (!env?.AI || typeof env.AI.run !== "function") {
    return {
      ok: false,
      handled: true,
      reportType,
      evidence: applySemrushIdentity(normalizedEvidence, reportType),
      stages: [],
      errors: [{
        stage: "semrush_specialized_extraction",
        code: "AI_BINDING_UNAVAILABLE",
        message: "Workers AI is unavailable for SEMrush screenshot enrichment.",
        retryable: false
      }],
      diagnostics: {
        engine: "semrush-engine",
        engineVersion: SEMRUSH_ENGINE_VERSION,
        executionTimeMs: Date.now() - startedAt
      }
    };
  }

  const stages = [];
  const errors = [];

  if (reportType === SEMRUSH_REPORT_TYPES.POSITION_TRACKING) {
    const result = await analyzePositionTracking({
      evidence: normalizedEvidence,
      imageDataUrl,
      sourceText,
      client,
      clientId,
      fileName,
      env,
      requestId
    });

    normalizedEvidence = result.evidence;
    stages.push(result.stage);
    if (result.error) errors.push(result.error);
  }

  if (reportType === SEMRUSH_REPORT_TYPES.SITE_AUDIT) {
    const result = await analyzeSiteAudit({
      evidence: normalizedEvidence,
      imageDataUrl,
      client,
      clientId,
      fileName,
      env,
      requestId
    });

    normalizedEvidence = result.evidence;
    stages.push(...result.stages);
    errors.push(...result.errors);
  }

  if (reportType === SEMRUSH_REPORT_TYPES.BACKLINK_AUDIT) {
    normalizedEvidence = applySemrushIdentity(
      normalizeBacklinkAuditEvidence(normalizedEvidence),
      reportType
    );

    stages.push({
      stageName: "semrush_backlink_audit_normalization",
      status: "success",
      engine: `semrush-engine-v${SEMRUSH_ENGINE_VERSION}`,
      model: "deterministic",
      executionTimeMs: Date.now() - startedAt,
      retryCount: 0,
      retryStatus: "not_required",
      fallbackUsed: false
    });
  }

  return {
    ok: errors.length === 0,
    handled: true,
    reportType,
    evidence: applySemrushIdentity(normalizedEvidence, reportType),
    stages,
    errors,
    diagnostics: {
      engine: "semrush-engine",
      engineVersion: SEMRUSH_ENGINE_VERSION,
      executionTimeMs: Date.now() - startedAt,
      reportType
    }
  };
}

export function detectSemrushReportType({
  evidence,
  reportRecognition = null,
  sourceText = ""
}) {
  const recognized = clean(reportRecognition?.reportType).toLowerCase();
  if (Object.values(SEMRUSH_REPORT_TYPES).includes(recognized)) {
    return recognized;
  }

  const haystack = evidenceText(evidence, sourceText);

  if (
    /\bposition tracking\b/i.test(haystack) ||
    /\balert triggered for\s+\d+\s+keywords?\b/i.test(haystack) ||
    /\b(?:current )?position\b.*\b(?:change|volume)\b/i.test(haystack)
  ) {
    return SEMRUSH_REPORT_TYPES.POSITION_TRACKING;
  }

  if (
    /\bsite audit\b/i.test(haystack) ||
    (
      /\bsite health\b/i.test(haystack) &&
      /\b(?:errors?|warnings?|notices?|broken pages?)\b/i.test(haystack)
    )
  ) {
    return SEMRUSH_REPORT_TYPES.SITE_AUDIT;
  }

  if (
    /\bbacklink audit\b/i.test(haystack) ||
    /\btoxic backlinks?\b/i.test(haystack) ||
    /\breferring domains?\b/i.test(haystack) ||
    /\bhigh quality domains?\b/i.test(haystack)
  ) {
    return SEMRUSH_REPORT_TYPES.BACKLINK_AUDIT;
  }

  return SEMRUSH_REPORT_TYPES.UNKNOWN;
}

async function analyzePositionTracking({
  evidence,
  imageDataUrl,
  sourceText,
  client,
  clientId,
  fileName,
  env,
  requestId
}) {
  const startedAt = Date.now();
  const stageName = "semrush_position_tracking";
  const runResult = await runAiJsonWithRetry({
    env,
    model: COMMUNICATION_VISION_MODEL,
    input: {
      messages: [
        {
          role: "system",
          content: "Extract only clearly readable SEMrush Position Tracking evidence. Return one valid JSON object only."
        },
        {
          role: "user",
          content: buildPositionTrackingPrompt({
            sourceText,
            client,
            clientId,
            fileName
          })
        }
      ],
      image: imageDataUrl,
      max_tokens: 1600,
      temperature: 0
    },
    stageName,
    requestId,
    route: ACTIONS.ANALYZE_COMMUNICATION,
    timeoutMs: 30000,
    maxRetries: 0
  });

  if (!runResult.ok) {
    return {
      evidence: applySemrushIdentity(evidence, SEMRUSH_REPORT_TYPES.POSITION_TRACKING),
      error: runResult.error,
      stage: {
        stageName,
        status: "failed",
        engine: `semrush-engine-v${SEMRUSH_ENGINE_VERSION}`,
        model: COMMUNICATION_VISION_MODEL,
        executionTimeMs: Date.now() - startedAt,
        retryCount: runResult.retryCount,
        retryStatus: runResult.retryStatus,
        rawAiError: runResult.error?.message || null,
        fallbackUsed: true
      }
    };
  }

  const extracted = sanitizePositionTrackingEvidence(
    normalizeEvidence(runResult.data)
  );

  return {
    evidence: applySemrushIdentity(
      mergeEvidence(evidence, extracted),
      SEMRUSH_REPORT_TYPES.POSITION_TRACKING
    ),
    error: null,
    stage: {
      stageName,
      status: "success",
      engine: `semrush-engine-v${SEMRUSH_ENGINE_VERSION}`,
      model: COMMUNICATION_VISION_MODEL,
      executionTimeMs: Date.now() - startedAt,
      retryCount: runResult.retryCount,
      retryStatus: runResult.retryStatus,
      rawAiError: null,
      fallbackUsed: false
    }
  };
}

async function analyzeSiteAudit({
  evidence,
  imageDataUrl,
  client,
  clientId,
  fileName,
  env,
  requestId
}) {
  const stages = [];
  const errors = [];
  let currentEvidence = evidence;

  const metricsStartedAt = Date.now();
  const metricsResult = await runAiJsonWithRetry({
    env,
    model: COMMUNICATION_VISION_MODEL,
    input: {
      messages: [
        {
          role: "system",
          content: "Extract only clearly readable SEMrush Site Audit metrics with labels and displayed changes. Return one valid JSON object only."
        },
        {
          role: "user",
          content: buildSiteAuditMetricsPrompt({ client, clientId, fileName })
        }
      ],
      image: imageDataUrl,
      max_tokens: 1400,
      temperature: 0
    },
    stageName: "semrush_site_audit_metrics",
    requestId,
    route: ACTIONS.ANALYZE_COMMUNICATION,
    timeoutMs: 30000,
    maxRetries: 0
  });

  if (metricsResult.ok) {
    const focusedEvidence = normalizeEvidence(metricsResult.data);
    currentEvidence = makeSiteAuditEvidenceAuthoritative({
      broadEvidence: currentEvidence,
      focusedEvidence
    });
  } else {
    errors.push(metricsResult.error);
  }

  stages.push({
    stageName: "semrush_site_audit_metrics",
    status: metricsResult.ok ? "success" : "failed",
    engine: `semrush-engine-v${SEMRUSH_ENGINE_VERSION}`,
    model: COMMUNICATION_VISION_MODEL,
    executionTimeMs: Date.now() - metricsStartedAt,
    retryCount: metricsResult.retryCount,
    retryStatus: metricsResult.retryStatus,
    rawAiError: metricsResult.error?.message || null,
    fallbackUsed: !metricsResult.ok
  });

  if (hasPositiveAdverseDelta(currentEvidence)) {
    const verificationStartedAt = Date.now();
    const verificationResult = await runAiJsonWithRetry({
      env,
      model: COMMUNICATION_VISION_MODEL,
      input: {
        messages: [
          {
            role: "system",
            content: "Verify only the displayed change state for SEMrush Site Audit adverse metrics. Return one valid JSON object only."
          },
          {
            role: "user",
            content: buildSiteAuditChangePrompt({ client, clientId, fileName })
          }
        ],
        image: imageDataUrl,
        max_tokens: 900,
        temperature: 0
      },
      stageName: "semrush_site_audit_change_verification",
      requestId,
      route: ACTIONS.ANALYZE_COMMUNICATION,
      timeoutMs: 30000,
      maxRetries: 0
    });

    if (verificationResult.ok) {
      currentEvidence = applySiteAuditChangeVerification({
        evidence: currentEvidence,
        verification: normalizeSiteAuditChangeVerification(
          verificationResult.data
        )
      });
    } else {
      errors.push(verificationResult.error);
    }

    stages.push({
      stageName: "semrush_site_audit_change_verification",
      status: verificationResult.ok ? "success" : "failed",
      engine: `semrush-engine-v${SEMRUSH_ENGINE_VERSION}`,
      model: COMMUNICATION_VISION_MODEL,
      executionTimeMs: Date.now() - verificationStartedAt,
      retryCount: verificationResult.retryCount,
      retryStatus: verificationResult.retryStatus,
      rawAiError: verificationResult.error?.message || null,
      fallbackUsed: !verificationResult.ok
    });
  }

  currentEvidence = reconcileSiteAuditNoChangeEvidence(currentEvidence);

  return {
    evidence: applySemrushIdentity(
      currentEvidence,
      SEMRUSH_REPORT_TYPES.SITE_AUDIT
    ),
    stages,
    errors
  };
}

function buildPositionTrackingPrompt({
  sourceText,
  client,
  clientId,
  fileName
}) {
  return [
    "Read one SEMrush Position Tracking screenshot.",
    "Return only visible facts and metrics.",
    "Do not infer previous positions unless explicitly shown.",
    "",
    "RULES",
    "1. Extract every clearly readable keyword row separately.",
    "2. Preserve the keyword phrase.",
    "3. Preserve current position, signed movement/change, search volume, URL, device, location, and search engine only when readable.",
    "4. Keep one keyword row in one visibleMetrics item.",
    "5. Preserve signs exactly.",
    "6. Do not return Site Audit or Backlink Audit metrics.",
    "7. Do not guess unreadable values.",
    "8. Return valid JSON only.",
    "",
    `Selected client: ${client || clientId || "Unknown"}`,
    `Temporary filename: ${fileName}`,
    clean(sourceText)
      ? `Supplied report anchor: ${clean(sourceText)}`
      : "Supplied report anchor: Position Tracking",
    "",
    JSON.stringify({
      visibleSource: "SEMrush",
      visibleSubject: "Position Tracking",
      visibleText: "Concise readable text",
      visibleFacts: [
        "Alert triggered for a visible number of keywords"
      ],
      visibleMetrics: [
        "Keyword: <phrase>; Position: <value>; Change: <signed value>; Volume: <value>"
      ],
      responseExpected: false,
      explicitActionRequested: false,
      confidence: "High | Medium | Low",
      uncertainty: "None or unreadable fields"
    }, null, 2)
  ].join("\n");
}

function buildSiteAuditMetricsPrompt({ client, clientId, fileName }) {
  return [
    "Read one SEMrush Site Audit screenshot.",
    "Extract only clearly readable labeled metrics and their displayed changes.",
    "",
    "REQUIRED RULES",
    "1. Keep each label, current value, and displayed change together.",
    "2. Preserve plus and minus signs exactly.",
    "3. Use 'no change' when that exact state is shown.",
    "4. Do not return unlabeled numbers.",
    "5. Do not infer previous values.",
    "6. Return valid JSON only.",
    "",
    `Selected client: ${client || clientId || "Unknown"}`,
    `Temporary filename: ${fileName}`,
    "",
    JSON.stringify({
      visibleSource: "SEMrush",
      visibleSubject: "Site Audit",
      visibleText: "Concise Site Audit summary",
      visibleFacts: [
        "Readable Site Audit conditions"
      ],
      visibleMetrics: [
        "Site Health: <current value>; Change: <signed change or no change>",
        "Errors: <current value>; Change: <signed change or no change>",
        "Warnings: <current value>; Change: <signed change or no change>",
        "Notices: <current value>; Change: <signed change or no change>",
        "Broken Pages: <current value>; Change: <signed change or no change>"
      ],
      responseExpected: false,
      explicitActionRequested: false,
      confidence: "High | Medium | Low",
      uncertainty: "None or unreadable fields"
    }, null, 2)
  ].join("\n");
}

function buildSiteAuditChangePrompt({ client, clientId, fileName }) {
  return [
    "Verify one SEMrush Site Audit screenshot.",
    "Read only the displayed change state for each adverse metric.",
    "Do not read or return current counts.",
    "",
    "Allowed statuses: increase, decrease, no_change, not_readable.",
    "Prefer not_readable over guessing.",
    "",
    `Selected client: ${client || clientId || "Unknown"}`,
    `Temporary filename: ${fileName}`,
    "",
    JSON.stringify({
      errors: "increase | decrease | no_change | not_readable",
      warnings: "increase | decrease | no_change | not_readable",
      pagesWithIssues: "increase | decrease | no_change | not_readable",
      brokenPages: "increase | decrease | no_change | not_readable"
    }, null, 2)
  ].join("\n");
}

function sanitizePositionTrackingEvidence(evidence) {
  const normalized = normalizeEvidence(evidence);
  const allowedMetricPatterns = [
    /\bkeyword\b/i,
    /\bposition\b/i,
    /\brank(?:ing)?\b/i,
    /\bchange\b/i,
    /\bmovement\b/i,
    /\bvolume\b/i,
    /\bvisibility\b/i,
    /\bestimated traffic\b/i,
    /\baverage position\b/i,
    /\btop\s+\d+\b/i
  ];

  const forbiddenPatterns = [
    /\btoxic\b/i,
    /\bbacklinks?\b/i,
    /\breferring domains?\b/i,
    /\banchor text\b/i,
    /\bsite health\b/i,
    /\berrors?\b/i,
    /\bwarnings?\b/i,
    /\bnotices?\b/i
  ];

  return normalizeEvidence({
    ...normalized,
    visibleSource: "SEMrush",
    visibleSubject: "Position Tracking",
    visibleMetrics: normalized.visibleMetrics.filter(value =>
      allowedMetricPatterns.some(pattern => pattern.test(value)) &&
      !forbiddenPatterns.some(pattern => pattern.test(value))
    ),
    visibleFacts: normalized.visibleFacts.filter(value =>
      !forbiddenPatterns.some(pattern => pattern.test(value))
    )
  });
}

function normalizeBacklinkAuditEvidence(evidence) {
  const normalized = normalizeEvidence(evidence);

  return normalizeEvidence({
    ...normalized,
    visibleSource: "SEMrush",
    visibleSubject: "Backlink Audit",
    visibleMetrics: normalized.visibleMetrics.filter(value =>
      /\b(?:backlinks?|referring domains?|toxic|trusted domains?|high quality domains?|lost|gained)\b/i.test(value)
    )
  });
}

function makeSiteAuditEvidenceAuthoritative({
  broadEvidence,
  focusedEvidence
}) {
  const broad = normalizeEvidence(broadEvidence);
  const focused = normalizeEvidence(focusedEvidence);

  const isSiteAuditLine = value =>
    /\b(?:site health|crawled pages?|healthy pages?|broken pages?|pages? with issues?|redirects?|blocked pages?|errors?|warnings?|notices?)\b/i.test(
      clean(value)
    );

  return normalizeEvidence({
    ...broad,
    ...focused,
    visibleText:
      focused.visibleText ||
      [...focused.visibleFacts, ...focused.visibleMetrics].join("; "),
    visibleFacts: unique([
      ...broad.visibleFacts.filter(value => !isSiteAuditLine(value)),
      ...focused.visibleFacts
    ]),
    visibleMetrics: unique([
      ...broad.visibleMetrics.filter(value => !isSiteAuditLine(value)),
      ...focused.visibleMetrics
    ])
  });
}

function hasPositiveAdverseDelta(evidence) {
  return normalizeEvidence(evidence).visibleMetrics.some(value =>
    /\b(?:errors?|warnings?|issues?|pages with issues|broken pages?)\b/i.test(value) &&
    /\bchange\s*:\s*\+\s*\d+/i.test(value)
  );
}

function normalizeSiteAuditChangeVerification(value) {
  const allowed = new Set([
    "increase",
    "decrease",
    "no_change",
    "not_readable"
  ]);

  const normalizeStatus = input => {
    const status = clean(input).toLowerCase().replace(/\s+/g, "_");
    return allowed.has(status) ? status : "not_readable";
  };

  return {
    errors: normalizeStatus(value?.errors),
    warnings: normalizeStatus(value?.warnings),
    pagesWithIssues: normalizeStatus(value?.pagesWithIssues),
    brokenPages: normalizeStatus(value?.brokenPages)
  };
}

function applySiteAuditChangeVerification({ evidence, verification }) {
  const normalized = normalizeEvidence(evidence);
  const definitions = [
    { key: "errors", pattern: /\berrors?\b/i, label: "Errors" },
    { key: "warnings", pattern: /\bwarnings?\b/i, label: "Warnings" },
    { key: "pagesWithIssues", pattern: /\bpages?\s+with\s+issues?\b/i, label: "Pages With Issues" },
    { key: "brokenPages", pattern: /\bbroken\s+pages?\b/i, label: "Broken Pages" }
  ];

  const shouldRemove = value => {
    const line = clean(value);
    if (!/\bchange\s*:\s*\+\s*\d+/i.test(line)) return false;

    return definitions.some(definition =>
      definition.pattern.test(line) &&
      ["no_change", "decrease"].includes(verification[definition.key])
    );
  };

  const verificationFacts = definitions
    .filter(definition => verification[definition.key] === "no_change")
    .map(definition => `${definition.label}: no change`);

  return normalizeEvidence({
    ...normalized,
    visibleFacts: unique([
      ...normalized.visibleFacts.filter(value => !shouldRemove(value)),
      ...verificationFacts
    ]),
    visibleMetrics: normalized.visibleMetrics.filter(value => !shouldRemove(value)),
    visibleText: normalized.visibleText
      .split(/(?<=[.;])\s+|\n+/)
      .map(clean)
      .filter(Boolean)
      .filter(value => !shouldRemove(value))
      .join(" ")
  });
}

function reconcileSiteAuditNoChangeEvidence(evidence) {
  const normalized = normalizeEvidence(evidence);
  const definitions = [
    /\berrors?\b/i,
    /\bwarnings?\b/i,
    /\bpages?\s+with\s+issues?\b/i,
    /\bbroken\s+pages?\b/i
  ];

  const all = [
    normalized.visibleText,
    ...normalized.visibleFacts,
    ...normalized.visibleMetrics
  ];

  const stablePatterns = definitions.filter(pattern =>
    all.some(value =>
      pattern.test(clean(value)) &&
      /\b(?:no change|unchanged|stable)\b/i.test(clean(value))
    )
  );

  const conflictsWithStable = value => {
    const line = clean(value);
    return stablePatterns.some(pattern =>
      pattern.test(line) &&
      /\bchange\s*:\s*\+\s*\d+/i.test(line)
    );
  };

  return normalizeEvidence({
    ...normalized,
    visibleFacts: normalized.visibleFacts.filter(value => !conflictsWithStable(value)),
    visibleMetrics: normalized.visibleMetrics.filter(value => !conflictsWithStable(value))
  });
}

function applySemrushIdentity(evidence, reportType) {
  const normalized = normalizeEvidence(evidence);
  const subjectMap = {
    [SEMRUSH_REPORT_TYPES.POSITION_TRACKING]: "Position Tracking",
    [SEMRUSH_REPORT_TYPES.SITE_AUDIT]: "Site Audit",
    [SEMRUSH_REPORT_TYPES.BACKLINK_AUDIT]: "Backlink Audit"
  };

  return normalizeEvidence({
    ...normalized,
    visibleSource: "SEMrush",
    visibleSubject: subjectMap[reportType] || normalized.visibleSubject
  });
}

function mergeEvidence(base, addition) {
  const left = normalizeEvidence(base);
  const right = normalizeEvidence(addition);

  return normalizeEvidence({
    visibleSource:
      right.visibleSource !== "Unknown"
        ? right.visibleSource
        : left.visibleSource,
    visibleSubject:
      right.visibleSubject !== "Unknown"
        ? right.visibleSubject
        : left.visibleSubject,
    visibleText: unique([left.visibleText, right.visibleText]).join("; "),
    visibleFacts: unique([...left.visibleFacts, ...right.visibleFacts]),
    visibleMetrics: unique([...left.visibleMetrics, ...right.visibleMetrics]),
    responseExpected: left.responseExpected || right.responseExpected,
    explicitActionRequested:
      left.explicitActionRequested || right.explicitActionRequested,
    confidence: strongerConfidence(left.confidence, right.confidence),
    uncertainty: unique([
      left.uncertainty === "None" ? "" : left.uncertainty,
      right.uncertainty === "None" ? "" : right.uncertainty
    ]).join("; ") || "None"
  });
}

function normalizeEvidence(value) {
  const evidence = isPlainObject(value) ? value : {};

  return {
    visibleSource: clean(evidence.visibleSource) || "Unknown",
    visibleSubject: clean(evidence.visibleSubject) || "Unknown",
    visibleText: clean(evidence.visibleText),
    visibleFacts: normalizeArray(evidence.visibleFacts),
    visibleMetrics: normalizeArray(evidence.visibleMetrics),
    responseExpected: Boolean(evidence.responseExpected),
    explicitActionRequested: Boolean(evidence.explicitActionRequested),
    confidence: normalizeConfidence(evidence.confidence),
    uncertainty: clean(evidence.uncertainty) || "None"
  };
}

function normalizeArray(value) {
  const values = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ""
      ? []
      : [value];

  return unique(
    values
      .map(item => {
        if (typeof item === "string" || typeof item === "number") {
          return clean(item);
        }

        if (isPlainObject(item)) {
          const label = clean(
            item.label ||
            item.key ||
            item.name ||
            item.metric ||
            item.category
          );
          const displayValue = clean(
            item.displayValue ??
            item.display_value ??
            item.value ??
            item.statement ??
            item.evidence ??
            item.text
          );

          return label && displayValue
            ? `${label}: ${displayValue}`
            : displayValue || label;
        }

        return "";
      })
      .filter(Boolean)
  );
}

function evidenceText(evidence, sourceText = "") {
  const normalized = normalizeEvidence(evidence);

  return [
    sourceText,
    normalized.visibleSource,
    normalized.visibleSubject,
    normalized.visibleText,
    ...normalized.visibleFacts,
    ...normalized.visibleMetrics
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeConfidence(value) {
  const text = clean(value).toLowerCase();
  if (text === "high") return "High";
  if (text === "medium") return "Medium";
  if (text === "low") return "Low";

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0.8) return "High";
  if (Number.isFinite(numeric) && numeric >= 0.5) return "Medium";
  return "Low";
}

function strongerConfidence(left, right) {
  const rank = { Low: 1, Medium: 2, High: 3 };
  return rank[normalizeConfidence(right)] > rank[normalizeConfidence(left)]
    ? normalizeConfidence(right)
    : normalizeConfidence(left);
}

function unique(values) {
  const seen = new Set();
  const result = [];

  for (const value of values || []) {
    const text = clean(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }

  return result;
}
