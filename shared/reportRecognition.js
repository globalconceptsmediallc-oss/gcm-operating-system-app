/* =========================================================
   Global Concepts Media Operating System
   File: shared/reportRecognition.js
   Version: 1.0.0
   Status: Production Candidate
   Source: routes/communicationAnalysis.js v7.7.0
   Sprint: WWPOWD Architecture — Route Modularization
   Purpose:
   Identify recurring business-report families from deterministic evidence
   and Workers AI visual signatures without interpreting business meaning,
   selecting operational priority, or creating operational records.

   IMPORTANT:
   - Recognition identifies report family only.
   - Recognition does not transcribe report metrics.
   - Recognition does not recommend work.
   - Recognition does not create Communications, Investigations, Work Items,
     Verification records, or Proof records.
   ========================================================= */

import {
  COMMUNICATION_VISION_MODEL,
  ACTIONS
} from "./config.js";

import { clean } from "./http.js";
import { runAiJsonWithRetry } from "./ai.js";

export const REPORT_RECOGNITION_VERSION = "1.0.0";

/**
 * Run deterministic and visual report-family recognition, then retain the
 * strongest source-grounded result.
 */
export async function executeReportSignatureRecognition({
  imageDataUrl,
  sourceText = "",
  client,
  clientId,
  fileName,
  env,
  requestId,
  deterministicEvidence = null
}) {
  const deterministic = recognizeReportSignatureFromEvidence(
    deterministicEvidence || { visibleText: clean(sourceText) }
  );

  if (!env?.AI || typeof env.AI.run !== "function") {
    return {
      data: deterministic,
      retryCount: 0,
      retryStatus: "deterministic_only"
    };
  }

  const prompt = buildReportSignaturePrompt({
    sourceText,
    client,
    clientId,
    fileName
  });

  const result = await runAiJsonWithRetry({
    env,
    model: COMMUNICATION_VISION_MODEL,
    input: {
      messages: [
        {
          role: "system",
          content: "Identify only the visible business-report family and its matched visual/text signals. Return one valid JSON object only."
        },
        { role: "user", content: prompt }
      ],
      image: imageDataUrl,
      max_tokens: 900,
      temperature: 0
    },
    stageName: "report_signature_recognition",
    requestId,
    route: ACTIONS.ANALYZE_COMMUNICATION,
    timeoutMs: 30000,
    maxRetries: 1
  });

  if (!result.ok) {
    return {
      data: deterministic,
      retryCount: result.retryCount || 0,
      retryStatus: "ai_failed_deterministic_retained"
    };
  }

  const aiRecognition = normalizeReportRecognition(result.data, {
    recognitionMethod: "visual-signature-ai",
    model: COMMUNICATION_VISION_MODEL
  });

  return {
    data: chooseReportRecognition(deterministic, aiRecognition),
    retryCount: result.retryCount || 0,
    retryStatus: result.retryStatus || "succeeded"
  };
}

export function buildReportSignaturePrompt({
  sourceText = "",
  client,
  clientId,
  fileName
}) {
  return [
    "You are the Report Signature Recognition Engine for the Global Concepts Media Operating System.",
    "Identify the report family from visible branding, report headings, section labels, and characteristic metric groups.",
    "Do not interpret results. Do not recommend work. Do not transcribe metric values.",
    "Prefer Unknown over guessing, but a coherent combination of characteristic labels may establish the family even when some text is small.",
    "Gmail or a browser is only the container and must never be returned as the business platform.",
    "",
    "KNOWN SIGNATURES",
    "SEMrush Site Audit: Site Audit heading and/or a coherent group including Site Health, Crawled Pages, Errors, Warnings, Notices, Healthy, Broken, Has Issues, Redirects, Blocked, or Top Issues.",
    "SEMrush Position Tracking: Position Tracking heading and/or Visibility, Traffic, Top Keywords, keyword Position/Change/Volume, or landing-page ranking sections.",
    "SEMrush Backlink Audit: Backlink Audit heading and/or referring domains, backlinks, toxic score, lost/new domains, or anchor text.",
    "Google Search Console: Search Console branding and/or page indexing, search performance, clicks, impressions, average position, validation, or coverage language.",
    "Google Analytics: Google Analytics/GA4 branding and/or Active Users, New Users, Engagement Time, Events, Views, Page/Screen, or Bounce Rate.",
    "Google Business Profile: Business Profile branding and/or profile views, calls, directions, searches, messages, or reviews.",
    "",
    "STRICT RULES",
    "1. Return only one report family.",
    "2. matchedSignals must contain only labels or branding actually visible or explicitly present in supplied text.",
    "3. Set confidence High only when the heading/branding is readable or at least three mutually consistent characteristic signals are visible.",
    "4. Do not use the selected client as evidence of report family.",
    "5. Return valid JSON only. No markdown.",
    "",
    `Selected client context: ${client || clientId || "Unknown"}`,
    `Temporary filename: ${fileName}`,
    `Optional pasted-text anchor: ${clean(sourceText) || "None"}`,
    "",
    "Return only this JSON contract:",
    JSON.stringify({
      platform: "semrush | google_search_console | google_analytics | google_business_profile | unknown",
      reportType: "site_audit | position_tracking | backlink_audit | search_console | analytics | business_profile | unknown",
      reportFamily: "Human-readable family name or Unknown",
      matchedSignals: ["Visible heading, branding, or characteristic label"],
      confidence: "High | Medium | Low",
      uncertainty: "What prevented stronger identification; otherwise None"
    }, null, 2)
  ].join("\n");
}

export function normalizeReportRecognition(value, defaults = {}) {
  const allowedPlatforms = new Set([
    "semrush",
    "google_search_console",
    "google_analytics",
    "google_business_profile",
    "unknown"
  ]);

  const allowedTypes = new Set([
    "site_audit",
    "position_tracking",
    "backlink_audit",
    "search_console",
    "analytics",
    "business_profile",
    "unknown"
  ]);

  const platform = clean(value?.platform).toLowerCase().replace(/[\s-]+/g, "_");
  const reportType = clean(value?.reportType).toLowerCase().replace(/[\s-]+/g, "_");
  const confidence = normalizeConfidence(value?.confidence);

  return {
    platform: allowedPlatforms.has(platform) ? platform : "unknown",
    reportType: allowedTypes.has(reportType) ? reportType : "unknown",
    reportFamily: clean(value?.reportFamily) || reportFamilyForType(reportType),
    matchedSignals: uniqueTextValues(
      Array.isArray(value?.matchedSignals) ? value.matchedSignals : []
    ),
    confidence,
    uncertainty: clean(value?.uncertainty) || "None",
    recognitionMethod:
      defaults.recognitionMethod ||
      value?.recognitionMethod ||
      "report-signature-rules",
    model: defaults.model || value?.model || "deterministic"
  };
}

export function recognizeReportSignatureFromEvidence(evidence) {
  const searchable = [
    evidence?.visibleSource,
    evidence?.visibleSubject,
    evidence?.visibleText,
    ...(evidence?.visibleFacts || []),
    ...(evidence?.visibleMetrics || [])
  ].filter(Boolean).join(" ");

  const signatures = [
    {
      platform: "semrush",
      reportType: "site_audit",
      reportFamily: "SEMrush Site Audit",
      signals: [
        ["SEMrush", /\bsemrush\b/i],
        ["Site Audit", /\bsite\s*audit\b/i],
        ["Site Health", /\bsite\s*health\b/i],
        ["Crawled Pages", /\bcrawled\s*pages?\b/i],
        ["Errors", /\berrors?\b/i],
        ["Warnings", /\bwarnings?\b/i],
        ["Notices", /\bnotices?\b/i],
        ["Top Issues", /\btop\s*issues\b/i]
      ]
    },
    {
      platform: "semrush",
      reportType: "position_tracking",
      reportFamily: "SEMrush Position Tracking",
      signals: [
        ["SEMrush", /\bsemrush\b/i],
        ["Position Tracking", /\bposition\s*tracking\b/i],
        ["Visibility", /\bvisibility\b/i],
        ["Top Keywords", /\btop\s*keywords\b/i],
        ["Position/Change/Volume", /\bposition\b.*\bchange\b.*\bvolume\b/i]
      ]
    },
    {
      platform: "semrush",
      reportType: "backlink_audit",
      reportFamily: "SEMrush Backlink Audit",
      signals: [
        ["SEMrush", /\bsemrush\b/i],
        ["Backlink Audit", /\bbacklink\s*audit\b/i],
        ["Referring Domains", /\breferring\s*domains?\b/i],
        ["Toxic Score", /\btoxic(?:ity)?\s*score\b/i],
        ["Backlinks", /\bbacklinks?\b/i]
      ]
    },
    {
      platform: "google_search_console",
      reportType: "search_console",
      reportFamily: "Google Search Console",
      signals: [
        ["Search Console", /\bsearch\s*console\b/i],
        ["Page Indexing", /\bpage\s*indexing\b/i],
        ["Clicks", /\bclicks?\b/i],
        ["Impressions", /\bimpressions?\b/i],
        ["Average Position", /\baverage\s*position\b/i]
      ]
    },
    {
      platform: "google_analytics",
      reportType: "analytics",
      reportFamily: "Google Analytics",
      signals: [
        ["Google Analytics/GA4", /google\s*analytics|\bga4\b/i],
        ["Active Users", /\bactive\s*users?\b/i],
        ["New Users", /\bnew\s*users?\b/i],
        ["Engagement Time", /\bengagement\s*time\b/i],
        ["Bounce Rate", /\bbounce\s*rate\b/i]
      ]
    },
    {
      platform: "google_business_profile",
      reportType: "business_profile",
      reportFamily: "Google Business Profile",
      signals: [
        ["Business Profile", /\bbusiness\s*profile\b/i],
        ["Profile Views", /\bprofile\s*views?\b/i],
        ["Calls", /\bcalls?\b/i],
        ["Directions", /\bdirections?\b/i],
        ["Reviews", /\breviews?\b/i]
      ]
    }
  ];

  let best = null;

  for (const signature of signatures) {
    const matchedSignals = signature.signals
      .filter(([, pattern]) => pattern.test(searchable))
      .map(([label]) => label);

    const headingMatched = matchedSignals.some(value =>
      /site audit|position tracking|backlink audit|search console|google analytics|ga4|business profile/i.test(value)
    );

    const score = matchedSignals.length + (headingMatched ? 2 : 0);

    if (!best || score > best.score) {
      best = {
        ...signature,
        matchedSignals,
        score,
        headingMatched
      };
    }
  }

  if (!best || best.score < 2) {
    return normalizeReportRecognition({
      platform: "unknown",
      reportType: "unknown",
      reportFamily: "Unknown",
      matchedSignals: [],
      confidence: "Low",
      uncertainty: "No dependable report signature was established."
    });
  }

  return normalizeReportRecognition({
    platform: best.platform,
    reportType: best.reportType,
    reportFamily: best.reportFamily,
    matchedSignals: best.matchedSignals,
    confidence:
      best.headingMatched || best.matchedSignals.length >= 4
        ? "High"
        : "Medium",
    uncertainty: "None"
  });
}

export function hasStrongReportRecognition(recognition) {
  return Boolean(
    recognition &&
    recognition.reportType &&
    recognition.reportType !== "unknown" &&
    (
      recognition.confidence === "High" ||
      (
        recognition.confidence === "Medium" &&
        (recognition.matchedSignals || []).length >= 3
      )
    )
  );
}

function chooseReportRecognition(first, second) {
  const a = normalizeReportRecognition(first || {});
  const b = normalizeReportRecognition(second || {});

  const score = item =>
    confidenceToNumber(item.confidence) +
    Math.min(item.matchedSignals.length * 0.05, 0.2) +
    (item.reportType !== "unknown" ? 0.2 : 0);

  return score(b) > score(a) ? b : a;
}

function reportFamilyForType(reportType) {
  const families = {
    site_audit: "SEMrush Site Audit",
    position_tracking: "SEMrush Position Tracking",
    backlink_audit: "SEMrush Backlink Audit",
    search_console: "Google Search Console",
    analytics: "Google Analytics",
    business_profile: "Google Business Profile"
  };

  return families[reportType] || "Unknown";
}

function normalizeConfidence(value) {
  if (typeof value === "number") {
    if (value >= 0.8) return "High";
    if (value >= 0.5) return "Medium";
    return "Low";
  }

  const normalized = clean(value).toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  return "Low";
}

function confidenceToNumber(value) {
  if (typeof value === "number") {
    return Math.max(0, Math.min(1, value));
  }

  const normalized = normalizeConfidence(value);
  if (normalized === "High") return 0.9;
  if (normalized === "Medium") return 0.65;
  return 0.35;
}

function uniqueTextValues(values) {
  const seen = new Set();
  const result = [];

  for (const value of Array.isArray(values) ? values : []) {
    const normalized = clean(
      typeof value === "string"
        ? value
        : value?.text || value?.value || value?.label || ""
    );

    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}
