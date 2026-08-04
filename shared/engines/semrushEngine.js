/* =========================================================
   Global Concepts Media Operating System
   File: shared/engines/semrushEngine.js
   Version: 2.1.0
   Status: Production Candidate
   Source: Production shared/engines/semrushEngine.js 2.0.0
   Sprint: SEMrush Site Audit V2 — Investigation Evidence States
   Purpose: Preserve the proven Position Tracking V2 handler and upgrade
            Site Audit to a dedicated Version 2 evidence-state handler that
            recognizes overview, issue-list, issue-detail, affected-URL, and
            representative-example screens without forcing redundant captures.
            Backlink Audit and Sensor behavior remain unchanged.
   ========================================================= */

import {
  COMMUNICATION_VISION_MODEL,
  ACTIONS
} from "../config.js";

import {
  clean,
  isPlainObject
} from "../http.js";

import {
  runAiJsonWithRetry
} from "../ai.js";

export const SEMRUSH_ENGINE_VERSION = "2.1.0";

export const SEMRUSH_REPORT_TYPES = Object.freeze({
  POSITION_TRACKING: "position_tracking",
  SITE_AUDIT: "site_audit",
  BACKLINK_AUDIT: "backlink_audit",
  SENSOR: "sensor",
  UNKNOWN: "unknown"
});

const POSITION_TRACKING_HANDLER_VERSION = "2.0.0";
const SITE_AUDIT_HANDLER_VERSION = "2.0.0";
const BACKLINK_AUDIT_HANDLER_VERSION = "1.0.0";
const SENSOR_HANDLER_VERSION = "1.0.0";

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
    return buildEngineResult({
      handled: false,
      reportType,
      evidence: normalizedEvidence,
      stages: [],
      errors: [],
      startedAt
    });
  }

  if (reportType === SEMRUSH_REPORT_TYPES.POSITION_TRACKING) {
    const result = await analyzePositionTrackingV2({
      evidence: normalizedEvidence,
      imageDataUrl,
      sourceText,
      client,
      clientId,
      fileName,
      env,
      requestId
    });

    return buildEngineResult({
      handled: true,
      reportType,
      evidence: result.evidence,
      structuredEvidence: result.structuredEvidence,
      reasoning: result.reasoning,
      decisionSupport: result.decisionSupport,
      stages: [result.stage],
      errors: result.error ? [result.error] : [],
      startedAt
    });
  }

  if (reportType === SEMRUSH_REPORT_TYPES.SITE_AUDIT) {
    const result = await analyzeSiteAuditV2({
      evidence: normalizedEvidence,
      imageDataUrl,
      sourceText,
      client,
      clientId,
      fileName,
      env,
      requestId
    });

    return buildEngineResult({
      handled: true,
      reportType,
      evidence: result.evidence,
      structuredEvidence: result.structuredEvidence,
      reasoning: result.reasoning,
      decisionSupport: result.decisionSupport,
      stages: [result.stage],
      errors: result.error ? [result.error] : [],
      startedAt
    });
  }

  if (reportType === SEMRUSH_REPORT_TYPES.BACKLINK_AUDIT) {
    normalizedEvidence = applySemrushIdentity(
      normalizeBacklinkAuditEvidence(normalizedEvidence),
      reportType
    );

    return buildEngineResult({
      handled: true,
      reportType,
      evidence: normalizedEvidence,
      structuredEvidence: buildLegacyStructuredEvidence(
        normalizedEvidence,
        reportType
      ),
      reasoning: null,
      decisionSupport: null,
      stages: [deterministicStage(
        "semrush_backlink_audit_normalization",
        BACKLINK_AUDIT_HANDLER_VERSION,
        startedAt
      )],
      errors: [],
      startedAt
    });
  }

  normalizedEvidence = applySemrushIdentity(normalizedEvidence, reportType);

  return buildEngineResult({
    handled: true,
    reportType,
    evidence: normalizedEvidence,
    structuredEvidence: buildLegacyStructuredEvidence(
      normalizedEvidence,
      reportType
    ),
    reasoning: null,
    decisionSupport: null,
    stages: [deterministicStage(
      "semrush_sensor_normalization",
      SENSOR_HANDLER_VERSION,
      startedAt
    )],
    errors: [],
    startedAt
  });
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
    /\b(?:current )?position\b.*\b(?:change|volume)\b/i.test(haystack) ||
    /\bentered the top\s*(?:3|10|20|100)\b/i.test(haystack) ||
    /\bleft the top\s*(?:3|10|20|100)\b/i.test(haystack)
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

  if (
    /\bsemrush sensor\b/i.test(haystack) ||
    /\bserp volatility\b/i.test(haystack) ||
    /\bgoogle volatility\b/i.test(haystack)
  ) {
    return SEMRUSH_REPORT_TYPES.SENSOR;
  }

  return SEMRUSH_REPORT_TYPES.UNKNOWN;
}


async function analyzeSiteAuditV2({
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
  const stageName = "semrush_site_audit_v2";
  const deterministic = extractSiteAuditDeterministically({
    evidence,
    sourceText
  });

  if (!imageDataUrl || !env?.AI || typeof env.AI.run !== "function") {
    const mapped = mapSiteAuditEvidence({
      baseEvidence: evidence,
      extracted: deterministic
    });

    return {
      evidence: mapped.evidence,
      structuredEvidence: mapped.structuredEvidence,
      reasoning: buildSiteAuditReasoning(mapped.structuredEvidence),
      decisionSupport: buildSiteAuditDecisionSupport(mapped.structuredEvidence),
      error: imageDataUrl && (!env?.AI || typeof env.AI.run !== "function")
        ? {
            stage: stageName,
            code: "AI_BINDING_UNAVAILABLE",
            message: "Workers AI is unavailable for Site Audit screenshot enrichment.",
            retryable: false
          }
        : null,
      stage: {
        stageName,
        status: imageDataUrl ? "partial" : "success",
        engine: `semrush-site-audit-v${SITE_AUDIT_HANDLER_VERSION}`,
        model: "deterministic",
        executionTimeMs: Date.now() - startedAt,
        confidence: mapped.structuredEvidence.confidence,
        retryCount: 0,
        retryStatus: imageDataUrl ? "not_attempted" : "not_required",
        rawAiError: imageDataUrl ? "Workers AI binding unavailable." : null,
        fallbackUsed: Boolean(imageDataUrl)
      }
    };
  }

  const runResult = await runAiJsonWithRetry({
    env,
    model: COMMUNICATION_VISION_MODEL,
    input: {
      messages: [
        {
          role: "system",
          content:
            "You are the SEMrush Site Audit evidence specialist for GCM OS. " +
            "First identify which Site Audit screen is visible, then extract only clearly readable facts. " +
            "Accept overview, issue-list, issue-detail, affected-URL-list, and representative-example screens as valid forward progress. " +
            "Do not reject a screenshot merely because it is deeper than the requested navigation level. " +
            "Do not recommend work or invent root cause. Return exactly one valid JSON object."
        },
        {
          role: "user",
          content: buildSiteAuditV2Prompt({
            sourceText,
            client,
            clientId,
            fileName
          })
        }
      ],
      image: imageDataUrl,
      max_tokens: 2400,
      temperature: 0
    },
    stageName,
    requestId,
    route: ACTIONS.ANALYZE_COMMUNICATION,
    timeoutMs: 30000,
    maxRetries: 0
  });

  if (!runResult.ok) {
    const mapped = mapSiteAuditEvidence({
      baseEvidence: evidence,
      extracted: deterministic
    });

    return {
      evidence: mapped.evidence,
      structuredEvidence: mapped.structuredEvidence,
      reasoning: buildSiteAuditReasoning(mapped.structuredEvidence),
      decisionSupport: buildSiteAuditDecisionSupport(mapped.structuredEvidence),
      error: runResult.error,
      stage: {
        stageName,
        status: "partial",
        engine: `semrush-site-audit-v${SITE_AUDIT_HANDLER_VERSION}`,
        model: COMMUNICATION_VISION_MODEL,
        executionTimeMs: Date.now() - startedAt,
        confidence: mapped.structuredEvidence.confidence,
        retryCount: runResult.retryCount,
        retryStatus: runResult.retryStatus,
        rawAiError: runResult.error?.message || null,
        fallbackUsed: true
      }
    };
  }

  const combined = mergeSiteAuditPayloads(
    deterministic,
    sanitizeSiteAuditPayload(runResult.data)
  );
  const mapped = mapSiteAuditEvidence({
    baseEvidence: evidence,
    extracted: combined
  });

  return {
    evidence: mapped.evidence,
    structuredEvidence: mapped.structuredEvidence,
    reasoning: buildSiteAuditReasoning(mapped.structuredEvidence),
    decisionSupport: buildSiteAuditDecisionSupport(mapped.structuredEvidence),
    error: null,
    stage: {
      stageName,
      status: "success",
      engine: `semrush-site-audit-v${SITE_AUDIT_HANDLER_VERSION}`,
      model: COMMUNICATION_VISION_MODEL,
      executionTimeMs: Date.now() - startedAt,
      confidence: mapped.structuredEvidence.confidence,
      retryCount: runResult.retryCount,
      retryStatus: runResult.retryStatus,
      rawAiError: null,
      fallbackUsed: false
    }
  };
}

function buildSiteAuditV2Prompt({
  sourceText,
  client,
  clientId,
  fileName
}) {
  return `
Analyze this SEMrush Site Audit screen as operational evidence.

CONTEXT
Client: ${clean(client) || "Unknown"}
Client ID: ${clean(clientId) || "Unknown"}
File: ${clean(fileName) || "communication-screenshot"}
Pasted text: ${clean(sourceText) || "None"}

SCREEN-STATE RULES
1. Classify the visible screen as exactly one of:
   overview, issue_list, issue_detail, affected_url_list,
   representative_example, or unknown.
2. A deeper screen is valid evidence even when the previous instruction asked for a broader screen.
3. Extract only facts clearly visible in the screenshot or pasted text.
4. Never invent issue names, counts, URLs, schema types, fields, dates, explanations, causes, plugins, templates, or fixes.
5. Preserve every readable issue row with its affected count.
6. For a selected issue, preserve the exact issue name and total affected count.
7. For an affected-URL list, preserve readable URLs and visible row details.
8. For structured-data issues, preserve visible schema types and affected fields.
9. Return Unknown, null, or an empty array when a field is unreadable.
10. Do not recommend work and do not infer root cause.

RETURN THIS JSON SHAPE
{
  "viewType": "overview, issue_list, issue_detail, affected_url_list, representative_example, or unknown",
  "projectDomain": "string or Unknown",
  "auditDate": "string or Unknown",
  "siteHealth": null,
  "crawledPages": null,
  "errors": null,
  "warnings": null,
  "notices": null,
  "selectedIssue": {
    "name": "string or Unknown",
    "severity": "error, warning, notice, or unknown",
    "affectedCount": null,
    "technicalExplanation": "string or Unknown"
  },
  "issueRows": [
    {
      "name": "string",
      "severity": "error, warning, notice, or unknown",
      "affectedCount": null
    }
  ],
  "affectedUrls": [
    {
      "url": "string",
      "schemaType": "string or Unknown",
      "affectedFields": ["string"],
      "lastCrawled": "string or Unknown",
      "visibleDetail": "string or Unknown"
    }
  ],
  "representativeExample": {
    "url": "string or Unknown",
    "visibleError": "string or Unknown",
    "responsibleSource": "string or Unknown"
  },
  "uncertainties": ["string"],
  "confidence": "High, Medium, or Low"
}
`.trim();
}

function extractSiteAuditDeterministically({ evidence, sourceText }) {
  const haystack = evidenceText(evidence, sourceText);
  const selectedIssueMatch = haystack.match(
    /\b(\d[\d,]*)\s+([^\n;]{3,160}?)\s+(?:items?|pages?|urls?)\s+(?:are|is)\s+(invalid|broken|incorrect|missing)\b/i
  );
  const selectedIssueAlt = haystack.match(
    /\b([^\n;]{3,160}?)\s*[:\-]\s*(\d[\d,]*)\s+(?:affected\s+)?(?:items?|pages?|urls?)\b/i
  );

  const issueName = clean(
    selectedIssueMatch?.[2] || selectedIssueAlt?.[1]
  );
  const affectedCount = numberOrNull(
    selectedIssueMatch?.[1] || selectedIssueAlt?.[2]
  );

  const urls = extractUrls(haystack).map(url => ({
    url,
    schemaType: detectSchemaTypeNearUrl(haystack, url),
    affectedFields: [],
    lastCrawled: "Unknown",
    visibleDetail: "Unknown"
  }));

  const issueRows = extractSiteAuditIssueRows(haystack);
  const viewType = inferSiteAuditViewType({
    haystack,
    issueName,
    affectedCount,
    issueRows,
    urls
  });

  return sanitizeSiteAuditPayload({
    viewType,
    projectDomain: firstDomain(haystack) || "Unknown",
    auditDate: firstDate(haystack) || "Unknown",
    siteHealth: firstNumber(haystack, /\bsite health\s*[:\-]?\s*(\d+)%?/i),
    crawledPages: firstNumber(haystack, /\b(?:crawled pages?|pages crawled)\s*[:\-]?\s*(\d[\d,]*)/i),
    errors: firstNumber(haystack, /\berrors?\s*[:\-]?\s*(\d[\d,]*)/i),
    warnings: firstNumber(haystack, /\bwarnings?\s*[:\-]?\s*(\d[\d,]*)/i),
    notices: firstNumber(haystack, /\bnotices?\s*[:\-]?\s*(\d[\d,]*)/i),
    selectedIssue: {
      name: issueName || "Unknown",
      severity: inferSeverity(haystack),
      affectedCount,
      technicalExplanation: "Unknown"
    },
    issueRows,
    affectedUrls: urls,
    representativeExample: {
      url: urls.length === 1 ? urls[0].url : "Unknown",
      visibleError: "Unknown",
      responsibleSource: "Unknown"
    },
    uncertainties: [],
    confidence:
      viewType !== "unknown" && (issueName || issueRows.length || urls.length)
        ? "Medium"
        : "Low"
  });
}

function sanitizeSiteAuditPayload(value) {
  const data = isPlainObject(value) ? value : {};
  const selected = isPlainObject(data.selectedIssue)
    ? data.selectedIssue
    : {};
  const example = isPlainObject(data.representativeExample)
    ? data.representativeExample
    : {};

  return {
    viewType: normalizeSiteAuditViewType(data.viewType),
    projectDomain: clean(data.projectDomain) || "Unknown",
    auditDate: clean(data.auditDate) || "Unknown",
    siteHealth: numberOrNull(data.siteHealth),
    crawledPages: numberOrNull(data.crawledPages),
    errors: numberOrNull(data.errors),
    warnings: numberOrNull(data.warnings),
    notices: numberOrNull(data.notices),
    selectedIssue: {
      name: clean(selected.name) || "Unknown",
      severity: normalizeSeverity(selected.severity),
      affectedCount: numberOrNull(selected.affectedCount),
      technicalExplanation:
        clean(selected.technicalExplanation) || "Unknown"
    },
    issueRows: normalizeSiteAuditIssueRows(data.issueRows),
    affectedUrls: normalizeAffectedUrls(data.affectedUrls),
    representativeExample: {
      url: clean(example.url) || "Unknown",
      visibleError: clean(example.visibleError) || "Unknown",
      responsibleSource: clean(example.responsibleSource) || "Unknown"
    },
    uncertainties: normalizeArray(data.uncertainties),
    confidence: normalizeConfidence(data.confidence)
  };
}

function mergeSiteAuditPayloads(left, right) {
  const a = sanitizeSiteAuditPayload(left);
  const b = sanitizeSiteAuditPayload(right);

  return sanitizeSiteAuditPayload({
    viewType: b.viewType !== "unknown" ? b.viewType : a.viewType,
    projectDomain: preferKnown(b.projectDomain, a.projectDomain),
    auditDate: preferKnown(b.auditDate, a.auditDate),
    siteHealth: b.siteHealth ?? a.siteHealth,
    crawledPages: b.crawledPages ?? a.crawledPages,
    errors: b.errors ?? a.errors,
    warnings: b.warnings ?? a.warnings,
    notices: b.notices ?? a.notices,
    selectedIssue: {
      name: preferKnown(b.selectedIssue.name, a.selectedIssue.name),
      severity:
        b.selectedIssue.severity !== "unknown"
          ? b.selectedIssue.severity
          : a.selectedIssue.severity,
      affectedCount:
        b.selectedIssue.affectedCount ?? a.selectedIssue.affectedCount,
      technicalExplanation: preferKnown(
        b.selectedIssue.technicalExplanation,
        a.selectedIssue.technicalExplanation
      )
    },
    issueRows: mergeSiteAuditIssueRows(a.issueRows, b.issueRows),
    affectedUrls: mergeAffectedUrls(a.affectedUrls, b.affectedUrls),
    representativeExample: {
      url: preferKnown(
        b.representativeExample.url,
        a.representativeExample.url
      ),
      visibleError: preferKnown(
        b.representativeExample.visibleError,
        a.representativeExample.visibleError
      ),
      responsibleSource: preferKnown(
        b.representativeExample.responsibleSource,
        a.representativeExample.responsibleSource
      )
    },
    uncertainties: unique([...a.uncertainties, ...b.uncertainties]),
    confidence: strongerConfidence(a.confidence, b.confidence)
  });
}

function mapSiteAuditEvidence({ baseEvidence, extracted }) {
  const data = sanitizeSiteAuditPayload(extracted);
  const facts = [`Site Audit screen state: ${data.viewType}`];
  const metrics = [];

  if (data.projectDomain !== "Unknown") {
    facts.push(`Project domain: ${data.projectDomain}`);
  }
  if (data.auditDate !== "Unknown") {
    facts.push(`Audit date: ${data.auditDate}`);
  }

  appendCount(metrics, "Site Health", data.siteHealth);
  appendCount(metrics, "Crawled Pages", data.crawledPages);
  appendCount(metrics, "Errors", data.errors);
  appendCount(metrics, "Warnings", data.warnings);
  appendCount(metrics, "Notices", data.notices);

  if (data.selectedIssue.name !== "Unknown") {
    facts.push([
      `Selected issue: ${data.selectedIssue.name}`,
      data.selectedIssue.severity !== "unknown"
        ? `Severity: ${data.selectedIssue.severity}`
        : "",
      data.selectedIssue.affectedCount !== null
        ? `Affected count: ${data.selectedIssue.affectedCount}`
        : "",
      data.selectedIssue.technicalExplanation !== "Unknown"
        ? `Explanation: ${data.selectedIssue.technicalExplanation}`
        : ""
    ].filter(Boolean).join("; "));
  }

  for (const row of data.issueRows) {
    facts.push([
      `Issue: ${row.name}`,
      row.severity !== "unknown" ? `Severity: ${row.severity}` : "",
      row.affectedCount !== null
        ? `Affected count: ${row.affectedCount}`
        : ""
    ].filter(Boolean).join("; "));
  }

  for (const item of data.affectedUrls) {
    facts.push([
      `Affected URL: ${item.url}`,
      item.schemaType !== "Unknown"
        ? `Schema type: ${item.schemaType}`
        : "",
      item.affectedFields.length
        ? `Affected fields: ${item.affectedFields.join(", ")}`
        : "",
      item.visibleDetail !== "Unknown"
        ? `Visible detail: ${item.visibleDetail}`
        : ""
    ].filter(Boolean).join("; "));
  }

  const evidence = applySemrushIdentity(
    mergeEvidence(baseEvidence, {
      visibleSource: "SEMrush",
      visibleSubject: "Site Audit",
      visibleText: unique([
        clean(baseEvidence?.visibleText),
        ...facts,
        ...metrics
      ]).join("; "),
      visibleFacts: facts,
      visibleMetrics: metrics,
      confidence: data.confidence,
      uncertainty:
        data.uncertainties.length
          ? data.uncertainties.join("; ")
          : clean(baseEvidence?.uncertainty) || "None"
    }),
    SEMRUSH_REPORT_TYPES.SITE_AUDIT
  );

  return {
    evidence,
    structuredEvidence: {
      platform: "semrush",
      reportType: SEMRUSH_REPORT_TYPES.SITE_AUDIT,
      handlerVersion: SITE_AUDIT_HANDLER_VERSION,
      viewType: data.viewType,
      projectDomain: data.projectDomain,
      auditDate: data.auditDate,
      overview: {
        siteHealth: data.siteHealth,
        crawledPages: data.crawledPages,
        errors: data.errors,
        warnings: data.warnings,
        notices: data.notices
      },
      selectedIssue: data.selectedIssue,
      issueRows: data.issueRows,
      affectedUrls: data.affectedUrls,
      representativeExample: data.representativeExample,
      uncertainties: data.uncertainties,
      confidence: confidenceToNumber(data.confidence)
    }
  };
}

function buildSiteAuditReasoning(structured) {
  const viewType = structured?.viewType || "unknown";
  const selected = structured?.selectedIssue || {};
  const issues = Array.isArray(structured?.issueRows)
    ? structured.issueRows
    : [];
  const urls = Array.isArray(structured?.affectedUrls)
    ? structured.affectedUrls
    : [];
  const example = structured?.representativeExample || {};

  if (viewType === "overview") {
    return {
      signal: "overview_complete",
      summary:
        "The Site Audit overview is valid evidence of overall technical condition and whether deeper review is justified. Do not request another overview screenshot.",
      currentEvidenceState: "overview_locked",
      nextDecision:
        "Review the visible issue categories or open the highest-priority issue.",
      rootCauseStatus: "unproven",
      evidenceSufficientForWork: false
    };
  }

  if (viewType === "issue_list") {
    return {
      signal: "issue_list_complete",
      summary:
        "The issue list is valid forward progress. Select one issue based on severity, affected scope, business relevance, and likelihood of one shared cause rather than raw count alone.",
      currentEvidenceState: "issue_list_locked",
      nextDecision:
        "Open one selected issue and review its affected records or technical explanation.",
      rootCauseStatus: "unproven",
      evidenceSufficientForWork: false,
      issueCount: issues.length
    };
  }

  if (viewType === "issue_detail" || viewType === "affected_url_list") {
    return {
      signal: "issue_scope_confirmed",
      summary:
        `The evidence confirms the selected Site Audit issue${selected.name && selected.name !== "Unknown" ? ` (${selected.name})` : ""}${selected.affectedCount !== null && selected.affectedCount !== undefined ? ` affects ${selected.affectedCount} records` : ""}. This is valid progress even when the screenshot bypassed the issue-list level.`,
      currentEvidenceState: "issue_scope_locked",
      nextDecision:
        "Review one representative affected URL or record to identify the responsible implementation source and confirm whether the pattern is shared.",
      rootCauseStatus: "partially_proven",
      evidenceSufficientForWork: false,
      affectedUrlCount: urls.length
    };
  }

  if (viewType === "representative_example") {
    const sourceKnown = clean(example.responsibleSource).toLowerCase() !== "unknown";
    const errorKnown = clean(example.visibleError).toLowerCase() !== "unknown";

    return {
      signal: sourceKnown && errorKnown
        ? "root_cause_candidate"
        : "representative_example_complete",
      summary: sourceKnown && errorKnown
        ? "A representative example includes the visible error and responsible source. The finding can support specific corrective work after consultant confirmation."
        : "A representative example is available, but the exact error or responsible implementation source still needs confirmation before specific work is justified.",
      currentEvidenceState: "representative_example_locked",
      nextDecision: sourceKnown && errorKnown
        ? "Confirm the shared pattern, define one corrective action, and set the verification test."
        : "Identify the exact visible error and the plugin, template, schema, feed, or code source producing it.",
      rootCauseStatus: sourceKnown && errorKnown
        ? "proven"
        : "partially_proven",
      evidenceSufficientForWork: sourceKnown && errorKnown
    };
  }

  return {
    signal: "unclassified_site_audit_evidence",
    summary:
      "The evidence is related to Site Audit, but its screen state is not yet reliable enough to determine the next operational decision.",
    currentEvidenceState: "unclassified",
    nextDecision:
      "Paste the visible issue name, affected count, and one representative URL or detail rather than repeating the same screenshot.",
    rootCauseStatus: "unproven",
    evidenceSufficientForWork: false
  };
}

function buildSiteAuditDecisionSupport(structured) {
  const reasoning = buildSiteAuditReasoning(structured);
  const selected = structured?.selectedIssue || {};
  const example = structured?.representativeExample || {};

  if (reasoning.evidenceSufficientForWork) {
    return {
      recommendedRecordType: "work_candidate",
      saveCommunication: true,
      investigationSuggested: true,
      workItemSuggested: true,
      replySuggested: false,
      importance: selected.severity === "error" ? "High" : "Medium",
      operationalLabel: "Site Audit Root Cause Proven",
      recommendedAction:
        `Correct ${selected.name && selected.name !== "Unknown" ? selected.name : "the verified Site Audit issue"} at the responsible source${example.responsibleSource && example.responsibleSource !== "Unknown" ? ` (${example.responsibleSource})` : ""}, then rerun the same Site Audit test to verify the affected count declines.`,
      decisionBasis:
        "A representative example identifies both the visible error and responsible implementation source."
    };
  }

  if (
    reasoning.signal === "issue_scope_confirmed" ||
    reasoning.signal === "representative_example_complete"
  ) {
    return {
      recommendedRecordType: "investigation_update",
      saveCommunication: true,
      investigationSuggested: true,
      workItemSuggested: false,
      replySuggested: false,
      importance: selected.severity === "error" ? "High" : "Medium",
      operationalLabel: "Site Audit Issue Scope Confirmed",
      recommendedAction: reasoning.nextDecision,
      decisionBasis:
        "The issue and its affected scope are proven, but the responsible source is not yet proven."
    };
  }

  if (reasoning.signal === "issue_list_complete") {
    return {
      recommendedRecordType: "investigation_update",
      saveCommunication: true,
      investigationSuggested: true,
      workItemSuggested: false,
      replySuggested: false,
      importance: "Medium",
      operationalLabel: "Site Audit Issue Selection",
      recommendedAction: reasoning.nextDecision,
      decisionBasis:
        "The issue categories are visible; one issue must be selected before root-cause review."
    };
  }

  if (reasoning.signal === "overview_complete") {
    return {
      recommendedRecordType: "investigation_candidate",
      saveCommunication: true,
      investigationSuggested: true,
      workItemSuggested: false,
      replySuggested: false,
      importance:
        Number(structured?.overview?.errors || 0) > 0 ? "High" : "Medium",
      operationalLabel: "Site Audit Review Required",
      recommendedAction: reasoning.nextDecision,
      decisionBasis:
        "The overview establishes the technical condition but does not identify the highest-value issue or root cause."
    };
  }

  return {
    recommendedRecordType: "investigation_update",
    saveCommunication: true,
    investigationSuggested: true,
    workItemSuggested: false,
    replySuggested: false,
    importance: "Medium",
    operationalLabel: "Site Audit Evidence Review",
    recommendedAction: reasoning.nextDecision,
    decisionBasis:
      "Site Audit evidence is present, but the current evidence state is not yet sufficiently classified."
  };
}

function normalizeSiteAuditViewType(value) {
  const normalized = clean(value).toLowerCase().replace(/[\s-]+/g, "_");
  const allowed = new Set([
    "overview",
    "issue_list",
    "issue_detail",
    "affected_url_list",
    "representative_example",
    "unknown"
  ]);
  return allowed.has(normalized) ? normalized : "unknown";
}

function normalizeSeverity(value) {
  const normalized = clean(value).toLowerCase();
  return ["error", "warning", "notice"].includes(normalized)
    ? normalized
    : "unknown";
}

function normalizeSiteAuditIssueRows(value) {
  if (!Array.isArray(value)) return [];
  const map = new Map();

  for (const raw of value) {
    const row = isPlainObject(raw) ? raw : {};
    const name = clean(row.name);
    if (!name) continue;
    const key = name.toLowerCase();
    const item = {
      name,
      severity: normalizeSeverity(row.severity),
      affectedCount: numberOrNull(row.affectedCount)
    };
    const existing = map.get(key);
    map.set(key, existing ? {
      name: existing.name,
      severity:
        item.severity !== "unknown" ? item.severity : existing.severity,
      affectedCount: item.affectedCount ?? existing.affectedCount
    } : item);
  }

  return [...map.values()].slice(0, 100);
}

function mergeSiteAuditIssueRows(left, right) {
  return normalizeSiteAuditIssueRows([...left, ...right]);
}

function normalizeAffectedUrls(value) {
  if (!Array.isArray(value)) return [];
  const map = new Map();

  for (const raw of value) {
    const item = isPlainObject(raw) ? raw : {};
    const url = clean(item.url);
    if (!url) continue;
    const key = url.toLowerCase();
    const normalized = {
      url,
      schemaType: clean(item.schemaType) || "Unknown",
      affectedFields: normalizeArray(item.affectedFields),
      lastCrawled: clean(item.lastCrawled) || "Unknown",
      visibleDetail: clean(item.visibleDetail) || "Unknown"
    };
    const existing = map.get(key);
    map.set(key, existing ? {
      url: existing.url,
      schemaType: preferKnown(normalized.schemaType, existing.schemaType),
      affectedFields: unique([
        ...existing.affectedFields,
        ...normalized.affectedFields
      ]),
      lastCrawled: preferKnown(normalized.lastCrawled, existing.lastCrawled),
      visibleDetail: preferKnown(
        normalized.visibleDetail,
        existing.visibleDetail
      )
    } : normalized);
  }

  return [...map.values()].slice(0, 100);
}

function mergeAffectedUrls(left, right) {
  return normalizeAffectedUrls([...left, ...right]);
}

function inferSiteAuditViewType({
  haystack,
  issueName,
  affectedCount,
  issueRows,
  urls
}) {
  if (
    /\bsite health\b/i.test(haystack) &&
    /\b(?:errors?|warnings?|notices?)\b/i.test(haystack) &&
    !issueName &&
    !urls.length
  ) {
    return "overview";
  }
  if (urls.length && issueName) return "affected_url_list";
  if (urls.length === 1 && /\b(?:error|invalid|missing|required|field|schema|source|template|plugin)\b/i.test(haystack)) {
    return "representative_example";
  }
  if (issueName || affectedCount !== null) return "issue_detail";
  if (issueRows.length > 1) return "issue_list";
  return "unknown";
}

function extractSiteAuditIssueRows(text) {
  const rows = [];
  const pattern = /(?:^|\n|;)\s*([^\n;]{3,150}?)\s+(\d[\d,]*)\s+(?:affected\s+)?(?:items?|pages?|urls?|issues?)\b/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const name = clean(match[1]);
    if (!name || /^(site health|crawled pages?|errors?|warnings?|notices?)$/i.test(name)) {
      continue;
    }
    rows.push({
      name,
      severity: inferSeverity(name),
      affectedCount: numberOrNull(match[2])
    });
  }
  return normalizeSiteAuditIssueRows(rows);
}

function extractUrls(text) {
  return unique(
    String(text || "").match(/https?:\/\/[^\s"'<>),;]+/gi) || []
  ).slice(0, 100);
}

function detectSchemaTypeNearUrl(text, url) {
  const index = String(text || "").indexOf(url);
  if (index < 0) return "Unknown";
  const nearby = String(text || "").slice(
    Math.max(0, index - 180),
    index + url.length + 180
  );
  const match = nearby.match(/\b(Event|Product|LocalBusiness|Organization|Article|BreadcrumbList|FAQPage|WebSite|WebPage)\b/i);
  return match?.[1] || "Unknown";
}

function firstNumber(text, regex) {
  return numberOrNull(String(text || "").match(regex)?.[1]);
}

function firstDomain(text) {
  return String(text || "").match(/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})(?:\/|\b)/i)?.[1] || "";
}

function firstDate(text) {
  return String(text || "").match(/\b(?:[A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/)?.[0] || "";
}

function inferSeverity(text) {
  const value = String(text || "").toLowerCase();
  if (/\berror\b/.test(value)) return "error";
  if (/\bwarning\b/.test(value)) return "warning";
  if (/\bnotice\b/.test(value)) return "notice";
  return "unknown";
}

async function analyzePositionTrackingV2({
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
  const stageName = "semrush_position_tracking_v2";
  const deterministic = extractPositionTrackingDeterministically({
    evidence,
    sourceText
  });

  if (!imageDataUrl) {
    const mapped = mapPositionTrackingEvidence({
      baseEvidence: evidence,
      extracted: deterministic
    });

    return {
      evidence: mapped.evidence,
      structuredEvidence: mapped.structuredEvidence,
      reasoning: buildPositionTrackingReasoning(mapped.structuredEvidence),
      decisionSupport: buildPositionTrackingDecisionSupport(
        mapped.structuredEvidence
      ),
      error: null,
      stage: {
        stageName,
        status: "success",
        engine: `semrush-position-tracking-v${POSITION_TRACKING_HANDLER_VERSION}`,
        model: "deterministic",
        executionTimeMs: Date.now() - startedAt,
        confidence: mapped.structuredEvidence.confidence,
        retryCount: 0,
        retryStatus: "not_required",
        rawAiError: null,
        fallbackUsed: false
      }
    };
  }

  if (!env?.AI || typeof env.AI.run !== "function") {
    const mapped = mapPositionTrackingEvidence({
      baseEvidence: evidence,
      extracted: deterministic
    });

    return {
      evidence: mapped.evidence,
      structuredEvidence: mapped.structuredEvidence,
      reasoning: buildPositionTrackingReasoning(mapped.structuredEvidence),
      decisionSupport: buildPositionTrackingDecisionSupport(
        mapped.structuredEvidence
      ),
      error: {
        stage: stageName,
        code: "AI_BINDING_UNAVAILABLE",
        message: "Workers AI is unavailable for Position Tracking screenshot enrichment.",
        retryable: false
      },
      stage: {
        stageName,
        status: "partial",
        engine: `semrush-position-tracking-v${POSITION_TRACKING_HANDLER_VERSION}`,
        model: "deterministic-fallback",
        executionTimeMs: Date.now() - startedAt,
        confidence: mapped.structuredEvidence.confidence,
        retryCount: 0,
        retryStatus: "not_attempted",
        rawAiError: "Workers AI binding unavailable.",
        fallbackUsed: true
      }
    };
  }

  const runResult = await runAiJsonWithRetry({
    env,
    model: COMMUNICATION_VISION_MODEL,
    input: {
      messages: [
        {
          role: "system",
          content:
            "You are the SEMrush Position Tracking specialist for GCM OS. " +
            "Extract only clearly readable evidence. Do not infer missing values. " +
            "Return exactly one valid JSON object."
        },
        {
          role: "user",
          content: buildPositionTrackingV2Prompt({
            sourceText,
            client,
            clientId,
            fileName
          })
        }
      ],
      image: imageDataUrl,
      max_tokens: 2200,
      temperature: 0
    },
    stageName,
    requestId,
    route: ACTIONS.ANALYZE_COMMUNICATION,
    timeoutMs: 30000,
    maxRetries: 0
  });

  if (!runResult.ok) {
    const mapped = mapPositionTrackingEvidence({
      baseEvidence: evidence,
      extracted: deterministic
    });

    return {
      evidence: mapped.evidence,
      structuredEvidence: mapped.structuredEvidence,
      reasoning: buildPositionTrackingReasoning(mapped.structuredEvidence),
      decisionSupport: buildPositionTrackingDecisionSupport(
        mapped.structuredEvidence
      ),
      error: runResult.error,
      stage: {
        stageName,
        status: "partial",
        engine: `semrush-position-tracking-v${POSITION_TRACKING_HANDLER_VERSION}`,
        model: COMMUNICATION_VISION_MODEL,
        executionTimeMs: Date.now() - startedAt,
        confidence: mapped.structuredEvidence.confidence,
        retryCount: runResult.retryCount,
        retryStatus: runResult.retryStatus,
        rawAiError: runResult.error?.message || null,
        fallbackUsed: true
      }
    };
  }

  const aiExtracted = sanitizePositionTrackingPayload(runResult.data);
  const combined = mergePositionTrackingPayloads(
    deterministic,
    aiExtracted
  );
  const mapped = mapPositionTrackingEvidence({
    baseEvidence: evidence,
    extracted: combined
  });

  return {
    evidence: mapped.evidence,
    structuredEvidence: mapped.structuredEvidence,
    reasoning: buildPositionTrackingReasoning(mapped.structuredEvidence),
    decisionSupport: buildPositionTrackingDecisionSupport(
      mapped.structuredEvidence
    ),
    error: null,
    stage: {
      stageName,
      status: "success",
      engine: `semrush-position-tracking-v${POSITION_TRACKING_HANDLER_VERSION}`,
      model: COMMUNICATION_VISION_MODEL,
      executionTimeMs: Date.now() - startedAt,
      confidence: mapped.structuredEvidence.confidence,
      retryCount: runResult.retryCount,
      retryStatus: runResult.retryStatus,
      rawAiError: null,
      fallbackUsed: false
    }
  };
}

function buildPositionTrackingV2Prompt({
  sourceText,
  client,
  clientId,
  fileName
}) {
  return `
Analyze this SEMrush Position Tracking communication.

CONTEXT
Client: ${clean(client) || "Unknown"}
Client ID: ${clean(clientId) || "Unknown"}
File: ${clean(fileName) || "communication-screenshot"}
Pasted text: ${clean(sourceText) || "None"}

EVIDENCE RULES
1. Read only values clearly visible in the screenshot or pasted text.
2. Never invent a keyword, ranking, change, search volume, URL, device, location, date, visibility score, estimated traffic value, or competitor.
3. Preserve signs on ranking changes. Example: +15 means improvement; -9 means decline.
4. A lower numerical ranking position is better.
5. Separate improvements, declines, new rankings, lost rankings, and unchanged rows.
6. Search volume is context, not proof of business impact.
7. Zero-volume keywords must be retained but marked low commercial evidence.
8. Do not decide that work is required merely because a ranking moved.
9. Return Unknown or null when a field is unreadable.

RETURN THIS JSON SHAPE
{
  "projectDomain": "string or Unknown",
  "reportDate": "string or Unknown",
  "device": "desktop, mobile, tablet, or Unknown",
  "location": "string or Unknown",
  "database": "string or Unknown",
  "alertKeywordCount": 0,
  "visibility": {
    "current": null,
    "change": null
  },
  "estimatedTraffic": {
    "current": null,
    "change": null
  },
  "averagePosition": {
    "current": null,
    "change": null
  },
  "keywords": [
    {
      "keyword": "string",
      "currentPosition": null,
      "previousPosition": null,
      "positionChange": null,
      "searchVolume": null,
      "url": "string or Unknown",
      "movement": "improved, declined, new, lost, unchanged, or unknown",
      "commercialEvidence": "high, medium, low, or unknown"
    }
  ],
  "top3Count": null,
  "top10Count": null,
  "top20Count": null,
  "top100Count": null,
  "competitors": [
    {
      "domain": "string",
      "visibility": null
    }
  ],
  "explicitAlertLanguage": ["string"],
  "uncertainties": ["string"],
  "confidence": "High, Medium, or Low"
}
`.trim();
}

function extractPositionTrackingDeterministically({
  evidence,
  sourceText
}) {
  const haystack = evidenceText(evidence, sourceText);
  const keywordCountMatch = haystack.match(
    /\balert triggered for\s+(\d+)\s+keywords?\b/i
  );
  const domainMatch = haystack.match(
    /\b(?:project|domain)\s*[:\-]\s*([a-z0-9.-]+\.[a-z]{2,})\b/i
  );
  const dateMatch = haystack.match(
    /\b(?:date|report date)\s*[:\-]\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/i
  );
  const deviceMatch = haystack.match(/\b(desktop|mobile|tablet)\b/i);
  const locationMatch = haystack.match(
    /\b(?:device\s*&\s*location|location)\s*[:\-]\s*([^\n;]+)/i
  );

  return sanitizePositionTrackingPayload({
    projectDomain: domainMatch?.[1] || "Unknown",
    reportDate: dateMatch?.[1] || "Unknown",
    device: deviceMatch?.[1] || "Unknown",
    location: locationMatch?.[1] || "Unknown",
    database: "Unknown",
    alertKeywordCount: numberOrNull(keywordCountMatch?.[1]),
    visibility: {},
    estimatedTraffic: {},
    averagePosition: {},
    keywords: extractKeywordRowsFromText(haystack),
    top3Count: null,
    top10Count: null,
    top20Count: null,
    top100Count: null,
    competitors: [],
    explicitAlertLanguage: keywordCountMatch ? [keywordCountMatch[0]] : [],
    uncertainties: [],
    confidence: keywordCountMatch || domainMatch ? "Medium" : "Low"
  });
}

function extractKeywordRowsFromText(text) {
  const rows = [];
  const patterns = [
    /["“]([^"”]{2,120})["”]\s*(?:improved|increased|moved up)?\s*([+-]\d+)\s*(?:positions?)?\s*(?:to|at)\s*#?(\d+)(?:[^\n]*?(?:volume|search volume)\s*[:\-]?\s*(\d+))?/gi,
    /["“]([^"”]{2,120})["”]\s*(?:declined|decreased|dropped|moved down)?\s*([+-]\d+)\s*(?:positions?)?\s*(?:to|at)\s*#?(\d+)(?:[^\n]*?(?:volume|search volume)\s*[:\-]?\s*(\d+))?/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const change = numberOrNull(match[2]);
      const current = numberOrNull(match[3]);
      rows.push({
        keyword: clean(match[1]),
        currentPosition: current,
        previousPosition:
          current !== null && change !== null ? current + change : null,
        positionChange: change,
        searchVolume: numberOrNull(match[4]),
        url: "Unknown",
        movement: movementFromChange(change),
        commercialEvidence: commercialEvidenceFromVolume(
          numberOrNull(match[4])
        )
      });
    }
  }

  return dedupeKeywords(rows);
}

function sanitizePositionTrackingPayload(value) {
  const data = isPlainObject(value) ? value : {};
  const keywords = Array.isArray(data.keywords)
    ? data.keywords
        .map(normalizeKeyword)
        .filter(item => item.keyword)
    : [];

  return {
    projectDomain: clean(data.projectDomain) || "Unknown",
    reportDate: clean(data.reportDate) || "Unknown",
    device: normalizeDevice(data.device),
    location: clean(data.location) || "Unknown",
    database: clean(data.database) || "Unknown",
    alertKeywordCount: numberOrNull(data.alertKeywordCount),
    visibility: normalizeMetricObject(data.visibility),
    estimatedTraffic: normalizeMetricObject(data.estimatedTraffic),
    averagePosition: normalizeMetricObject(data.averagePosition),
    keywords: dedupeKeywords(keywords),
    top3Count: numberOrNull(data.top3Count),
    top10Count: numberOrNull(data.top10Count),
    top20Count: numberOrNull(data.top20Count),
    top100Count: numberOrNull(data.top100Count),
    competitors: normalizeCompetitors(data.competitors),
    explicitAlertLanguage: normalizeArray(data.explicitAlertLanguage),
    uncertainties: normalizeArray(data.uncertainties),
    confidence: normalizeConfidence(data.confidence)
  };
}

function mergePositionTrackingPayloads(left, right) {
  const a = sanitizePositionTrackingPayload(left);
  const b = sanitizePositionTrackingPayload(right);

  return sanitizePositionTrackingPayload({
    projectDomain: preferKnown(b.projectDomain, a.projectDomain),
    reportDate: preferKnown(b.reportDate, a.reportDate),
    device: preferKnown(b.device, a.device),
    location: preferKnown(b.location, a.location),
    database: preferKnown(b.database, a.database),
    alertKeywordCount:
      b.alertKeywordCount !== null
        ? b.alertKeywordCount
        : a.alertKeywordCount,
    visibility: mergeMetricObject(a.visibility, b.visibility),
    estimatedTraffic: mergeMetricObject(
      a.estimatedTraffic,
      b.estimatedTraffic
    ),
    averagePosition: mergeMetricObject(
      a.averagePosition,
      b.averagePosition
    ),
    keywords: dedupeKeywords([...a.keywords, ...b.keywords]),
    top3Count: b.top3Count ?? a.top3Count,
    top10Count: b.top10Count ?? a.top10Count,
    top20Count: b.top20Count ?? a.top20Count,
    top100Count: b.top100Count ?? a.top100Count,
    competitors: mergeCompetitors(a.competitors, b.competitors),
    explicitAlertLanguage: unique([
      ...a.explicitAlertLanguage,
      ...b.explicitAlertLanguage
    ]),
    uncertainties: unique([...a.uncertainties, ...b.uncertainties]),
    confidence: strongerConfidence(a.confidence, b.confidence)
  });
}

function mapPositionTrackingEvidence({
  baseEvidence,
  extracted
}) {
  const data = sanitizePositionTrackingPayload(extracted);
  const facts = [];
  const metrics = [];

  if (data.projectDomain !== "Unknown") {
    facts.push(`Project domain: ${data.projectDomain}`);
  }
  if (data.reportDate !== "Unknown") {
    facts.push(`Report date: ${data.reportDate}`);
  }
  if (data.device !== "Unknown") {
    facts.push(`Device: ${data.device}`);
  }
  if (data.location !== "Unknown") {
    facts.push(`Location: ${data.location}`);
  }
  if (data.alertKeywordCount !== null) {
    metrics.push(`Alert keyword count: ${data.alertKeywordCount}`);
  }

  appendMetric(metrics, "Visibility", data.visibility);
  appendMetric(metrics, "Estimated traffic", data.estimatedTraffic);
  appendMetric(metrics, "Average position", data.averagePosition);
  appendCount(metrics, "Top 3 keywords", data.top3Count);
  appendCount(metrics, "Top 10 keywords", data.top10Count);
  appendCount(metrics, "Top 20 keywords", data.top20Count);
  appendCount(metrics, "Top 100 keywords", data.top100Count);

  for (const keyword of data.keywords) {
    const details = [
      `Keyword: "${keyword.keyword}"`,
      keyword.currentPosition !== null
        ? `Current position: ${keyword.currentPosition}`
        : "",
      keyword.previousPosition !== null
        ? `Previous position: ${keyword.previousPosition}`
        : "",
      keyword.positionChange !== null
        ? `Change: ${signed(keyword.positionChange)}`
        : "",
      keyword.searchVolume !== null
        ? `Search volume: ${keyword.searchVolume}`
        : "",
      `Movement: ${keyword.movement}`,
      `Commercial evidence: ${keyword.commercialEvidence}`
    ].filter(Boolean);

    facts.push(details.join("; "));
  }

  for (const competitor of data.competitors) {
    facts.push(
      `Competitor: ${competitor.domain}` +
      (
        competitor.visibility !== null
          ? `; Visibility: ${competitor.visibility}`
          : ""
      )
    );
  }

  const evidence = applySemrushIdentity(
    mergeEvidence(baseEvidence, {
      visibleSource: "SEMrush",
      visibleSubject: "Position Tracking",
      visibleText: unique([
        clean(baseEvidence?.visibleText),
        ...facts,
        ...metrics
      ]).join("; "),
      visibleFacts: facts,
      visibleMetrics: metrics,
      confidence: data.confidence,
      uncertainty:
        data.uncertainties.length
          ? data.uncertainties.join("; ")
          : clean(baseEvidence?.uncertainty) || "None"
    }),
    SEMRUSH_REPORT_TYPES.POSITION_TRACKING
  );

  return {
    evidence,
    structuredEvidence: {
      platform: "semrush",
      reportType: SEMRUSH_REPORT_TYPES.POSITION_TRACKING,
      handlerVersion: POSITION_TRACKING_HANDLER_VERSION,
      projectDomain: data.projectDomain,
      reportDate: data.reportDate,
      device: data.device,
      location: data.location,
      database: data.database,
      alertKeywordCount: data.alertKeywordCount,
      visibility: data.visibility,
      estimatedTraffic: data.estimatedTraffic,
      averagePosition: data.averagePosition,
      rankDistribution: {
        top3: data.top3Count,
        top10: data.top10Count,
        top20: data.top20Count,
        top100: data.top100Count
      },
      keywords: data.keywords,
      competitors: data.competitors,
      explicitAlertLanguage: data.explicitAlertLanguage,
      uncertainties: data.uncertainties,
      confidence: confidenceToNumber(data.confidence)
    }
  };
}

function buildPositionTrackingReasoning(structured) {
  const keywords = Array.isArray(structured?.keywords)
    ? structured.keywords
    : [];
  const improved = keywords.filter(item => item.movement === "improved");
  const declined = keywords.filter(item => item.movement === "declined");
  const newRankings = keywords.filter(item => item.movement === "new");
  const lostRankings = keywords.filter(item => item.movement === "lost");
  const meaningfulDeclines = declined.filter(
    item =>
      item.searchVolume === null ||
      item.searchVolume > 0 ||
      item.commercialEvidence === "high" ||
      item.commercialEvidence === "medium"
  );
  const zeroVolumeOnly =
    keywords.length > 0 &&
    keywords.every(
      item =>
        item.searchVolume === 0 ||
        item.commercialEvidence === "low"
    );

  let signal = "monitoring";
  let summary =
    "The report records keyword ranking movement and should be retained as current SEO monitoring evidence.";

  if (meaningfulDeclines.length > 0 || lostRankings.length > 0) {
    signal = "review";
    summary =
      "The report contains one or more potentially meaningful ranking declines or lost rankings that require trend and business-context review before deciding whether corrective work is needed.";
  } else if (improved.length > 0 || newRankings.length > 0) {
    signal = "positive_monitoring";
    summary =
      "The report contains positive ranking movement or new visibility. Preserve it as performance evidence and continue monitoring for persistence and business impact.";
  }

  if (zeroVolumeOnly) {
    signal = "low_value_monitoring";
    summary =
      "All extracted keyword movement is tied to zero-volume or low-commercial-evidence terms. Preserve the evidence, but do not treat it as proof of meaningful business impact by itself.";
  }

  return {
    signal,
    summary,
    improvedKeywordCount: improved.length,
    declinedKeywordCount: declined.length,
    newKeywordCount: newRankings.length,
    lostKeywordCount: lostRankings.length,
    meaningfulDeclineCount: meaningfulDeclines.length,
    zeroVolumeOnly,
    requiresCrossCheck:
      meaningfulDeclines.length > 0 || lostRankings.length > 0,
    recommendedCrossChecks:
      meaningfulDeclines.length > 0 || lostRankings.length > 0
        ? [
            "Google Search Console query and page performance",
            "Google Analytics organic traffic and conversions",
            "Google Business Profile performance when locally relevant",
            "Prior Position Tracking reports for persistence"
          ]
        : [],
    evidenceRule:
      "A single Position Tracking alert is evidence of ranking movement, not automatic proof of a business problem or completed work."
  };
}

function buildPositionTrackingDecisionSupport(structured) {
  const reasoning = buildPositionTrackingReasoning(structured);

  if (reasoning.signal === "review") {
    return {
      recommendedRecordType: "investigation_candidate",
      saveCommunication: true,
      investigationSuggested: true,
      workItemSuggested: false,
      replySuggested: false,
      importance: "Medium",
      operationalLabel: "Ranking Change Review",
      recommendedAction:
        "Save the communication and review whether the decline is persistent, commercially important, and confirmed by Search Console, Analytics, GBP, or prior Position Tracking evidence. Create specific work only after the cause and corrective action are established.",
      decisionBasis:
        "Potentially meaningful decline or lost ranking detected; additional evidence is required before action."
    };
  }

  if (reasoning.signal === "positive_monitoring") {
    return {
      recommendedRecordType: "monitoring_update",
      saveCommunication: true,
      investigationSuggested: false,
      workItemSuggested: false,
      replySuggested: false,
      importance: "Low",
      operationalLabel: "Positive Ranking Movement",
      recommendedAction:
        "Save as SEO monitoring evidence and continue tracking whether the improvement persists and contributes to qualified traffic or conversions.",
      decisionBasis:
        "Positive ranking movement is visible, but no unresolved condition or corrective work is established."
    };
  }

  if (reasoning.signal === "low_value_monitoring") {
    return {
      recommendedRecordType: "monitoring_update",
      saveCommunication: true,
      investigationSuggested: false,
      workItemSuggested: false,
      replySuggested: false,
      importance: "Low",
      operationalLabel: "Low-Value Ranking Movement",
      recommendedAction:
        "Save as historical monitoring evidence. Do not prioritize action based only on zero-volume or low-commercial-evidence keyword movement.",
      decisionBasis:
        "The observed movement does not yet demonstrate meaningful business impact."
    };
  }

  return {
    recommendedRecordType: "monitoring_update",
    saveCommunication: true,
    investigationSuggested: false,
    workItemSuggested: false,
    replySuggested: false,
    importance: "Low",
    operationalLabel: "Position Tracking Monitoring",
    recommendedAction:
      "Save as historical SEO monitoring evidence and continue routine trend monitoring.",
    decisionBasis:
      "No specific unresolved condition or confirmed corrective action is present."
  };
}

function normalizeSiteAuditEvidence(evidence) {
  const normalized = normalizeEvidence(evidence);
  const haystack = evidenceText(normalized);
  const metrics = [...normalized.visibleMetrics];

  addRegexMetric(metrics, haystack, /\bsite health\s*[:\-]?\s*(\d+%)/i, "Site Health");
  addRegexMetric(metrics, haystack, /\bcrawled pages?\s*[:\-]?\s*(\d+)/i, "Crawled Pages");
  addRegexMetric(metrics, haystack, /\berrors?\s*[:\-]?\s*(\d+)/i, "Errors");
  addRegexMetric(metrics, haystack, /\bwarnings?\s*[:\-]?\s*(\d+)/i, "Warnings");
  addRegexMetric(metrics, haystack, /\bnotices?\s*[:\-]?\s*(\d+)/i, "Notices");

  return normalizeEvidence({
    ...normalized,
    visibleMetrics: metrics
  });
}

function normalizeBacklinkAuditEvidence(evidence) {
  const normalized = normalizeEvidence(evidence);
  const haystack = evidenceText(normalized);
  const metrics = [...normalized.visibleMetrics];

  addRegexMetric(
    metrics,
    haystack,
    /\btoxic backlinks?\s*[:\-]?\s*(\d+)/i,
    "Toxic Backlinks"
  );
  addRegexMetric(
    metrics,
    haystack,
    /\breferring domains?\s*[:\-]?\s*(\d+)/i,
    "Referring Domains"
  );

  return normalizeEvidence({
    ...normalized,
    visibleMetrics: metrics
  });
}

function buildLegacyStructuredEvidence(evidence, reportType) {
  const normalized = normalizeEvidence(evidence);

  return {
    platform: "semrush",
    reportType,
    handlerVersion:
      reportType === SEMRUSH_REPORT_TYPES.SITE_AUDIT
        ? SITE_AUDIT_HANDLER_VERSION
        : reportType === SEMRUSH_REPORT_TYPES.BACKLINK_AUDIT
          ? BACKLINK_AUDIT_HANDLER_VERSION
          : SENSOR_HANDLER_VERSION,
    visibleFacts: normalized.visibleFacts,
    visibleMetrics: normalized.visibleMetrics,
    confidence: confidenceToNumber(normalized.confidence),
    pendingSpecialistUpgrade: true
  };
}

function buildEngineResult({
  handled,
  reportType,
  evidence,
  structuredEvidence = null,
  reasoning = null,
  decisionSupport = null,
  stages,
  errors,
  startedAt
}) {
  return {
    ok: errors.length === 0,
    handled,
    reportType,
    evidence: applySemrushIdentity(evidence, reportType),
    structuredEvidence,
    reasoning,
    decisionSupport,
    stages,
    errors,
    diagnostics: {
      engine: "semrush-engine",
      engineVersion: SEMRUSH_ENGINE_VERSION,
      reportType,
      executionTimeMs: Date.now() - startedAt
    }
  };
}

function deterministicStage(stageName, handlerVersion, startedAt) {
  return {
    stageName,
    status: "success",
    engine: `semrush-engine-v${SEMRUSH_ENGINE_VERSION}`,
    handlerVersion,
    model: "deterministic",
    executionTimeMs: Date.now() - startedAt,
    confidence: 0.75,
    retryCount: 0,
    retryStatus: "not_required",
    rawAiError: null,
    fallbackUsed: false
  };
}

function applySemrushIdentity(evidence, reportType) {
  const normalized = normalizeEvidence(evidence);
  const subjectMap = {
    [SEMRUSH_REPORT_TYPES.POSITION_TRACKING]: "Position Tracking",
    [SEMRUSH_REPORT_TYPES.SITE_AUDIT]: "Site Audit",
    [SEMRUSH_REPORT_TYPES.BACKLINK_AUDIT]: "Backlink Audit",
    [SEMRUSH_REPORT_TYPES.SENSOR]: "Sensor"
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

function normalizeKeyword(value) {
  const item = isPlainObject(value) ? value : {};
  const current = numberOrNull(item.currentPosition);
  const previous = numberOrNull(item.previousPosition);
  let change = numberOrNull(item.positionChange);

  if (change === null && current !== null && previous !== null) {
    change = previous - current;
  }

  return {
    keyword: clean(item.keyword),
    currentPosition: current,
    previousPosition: previous,
    positionChange: change,
    searchVolume: numberOrNull(item.searchVolume),
    url: clean(item.url) || "Unknown",
    movement: normalizeMovement(
      item.movement,
      change,
      current,
      previous
    ),
    commercialEvidence: normalizeCommercialEvidence(
      item.commercialEvidence,
      numberOrNull(item.searchVolume)
    )
  };
}

function normalizeMetricObject(value) {
  const item = isPlainObject(value) ? value : {};

  return {
    current: numberOrNull(item.current),
    change: numberOrNull(item.change)
  };
}

function mergeMetricObject(left, right) {
  return {
    current: right.current ?? left.current,
    change: right.change ?? left.change
  };
}

function normalizeCompetitors(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => ({
      domain: clean(item?.domain),
      visibility: numberOrNull(item?.visibility)
    }))
    .filter(item => item.domain);
}

function mergeCompetitors(left, right) {
  const map = new Map();

  for (const item of [...left, ...right]) {
    const key = item.domain.toLowerCase();
    const existing = map.get(key);

    if (!existing || item.visibility !== null) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

function dedupeKeywords(items) {
  const map = new Map();

  for (const raw of items) {
    const item = normalizeKeyword(raw);
    if (!item.keyword) continue;

    const key = item.keyword.toLowerCase();
    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
      continue;
    }

    map.set(key, {
      keyword: existing.keyword || item.keyword,
      currentPosition:
        item.currentPosition ?? existing.currentPosition,
      previousPosition:
        item.previousPosition ?? existing.previousPosition,
      positionChange:
        item.positionChange ?? existing.positionChange,
      searchVolume:
        item.searchVolume ?? existing.searchVolume,
      url: preferKnown(item.url, existing.url),
      movement:
        item.movement !== "unknown"
          ? item.movement
          : existing.movement,
      commercialEvidence:
        item.commercialEvidence !== "unknown"
          ? item.commercialEvidence
          : existing.commercialEvidence
    });
  }

  return [...map.values()];
}

function normalizeMovement(value, change, current, previous) {
  const normalized = clean(value).toLowerCase();

  if (
    ["improved", "declined", "new", "lost", "unchanged", "unknown"]
      .includes(normalized)
  ) {
    return normalized;
  }

  if (current !== null && previous === null) return "new";
  if (current === null && previous !== null) return "lost";
  return movementFromChange(change);
}

function movementFromChange(change) {
  if (change === null) return "unknown";
  if (change > 0) return "improved";
  if (change < 0) return "declined";
  return "unchanged";
}

function normalizeCommercialEvidence(value, volume) {
  const normalized = clean(value).toLowerCase();

  if (["high", "medium", "low", "unknown"].includes(normalized)) {
    return normalized;
  }

  return commercialEvidenceFromVolume(volume);
}

function commercialEvidenceFromVolume(volume) {
  if (volume === null) return "unknown";
  if (volume === 0) return "low";
  if (volume >= 100) return "high";
  if (volume >= 10) return "medium";
  return "low";
}

function normalizeDevice(value) {
  const normalized = clean(value).toLowerCase();

  return ["desktop", "mobile", "tablet"].includes(normalized)
    ? normalized
    : "Unknown";
}

function normalizeConfidence(value) {
  const normalized = clean(value).toLowerCase();

  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  return "Low";
}

function confidenceToNumber(value) {
  const normalized = normalizeConfidence(value);

  if (normalized === "High") return 0.9;
  if (normalized === "Medium") return 0.72;
  return 0.45;
}

function strongerConfidence(left, right) {
  const rank = {
    Low: 1,
    Medium: 2,
    High: 3
  };

  const a = normalizeConfidence(left);
  const b = normalizeConfidence(right);

  return rank[b] > rank[a] ? b : a;
}

function preferKnown(primary, fallback) {
  const first = clean(primary);
  const second = clean(fallback);

  if (first && first.toLowerCase() !== "unknown") return first;
  if (second) return second;
  return "Unknown";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value)
    .replace(/[%,$]/g, "")
    .replace(/,/g, "")
    .trim();

  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function signed(value) {
  if (value === null || value === undefined) return "";
  return value > 0 ? `+${value}` : String(value);
}

function appendMetric(target, label, metric) {
  if (!metric) return;

  if (metric.current !== null) {
    target.push(
      `${label}: ${metric.current}` +
      (
        metric.change !== null
          ? `; Change: ${signed(metric.change)}`
          : ""
      )
    );
  }
}

function appendCount(target, label, value) {
  if (value !== null && value !== undefined) {
    target.push(`${label}: ${value}`);
  }
}

function addRegexMetric(target, haystack, regex, label) {
  const match = haystack.match(regex);
  if (match?.[1]) {
    target.push(`${label}: ${match[1]}`);
  }
}

function unique(values) {
  return [...new Set(
    values
      .map(value => clean(value))
      .filter(Boolean)
  )];
}
