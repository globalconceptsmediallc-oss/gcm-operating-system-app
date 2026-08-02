/* =========================================================
   Global Concepts Media Operating System
   File: shared/operationalEvidence.js
   Version: 1.1.0
   Status: Production Candidate — Fast Single-Pass Extraction
   Source: WWPOWD Architecture Sprint
   Sprint: Operational Evidence Engine — Stage 1
   Purpose:
   Extract and normalize objective operational facts from screenshots
   or pasted text before any WWPOWD priority decision is made.

   IMPORTANT:
   - This module extracts evidence only.
   - It does not recommend work.
   - It does not create Communications, Investigations, Work Items,
     Verification records, or Proof records.
   - Human and downstream reasoning remain authoritative.
   ========================================================= */

export const OPERATIONAL_EVIDENCE_VERSION = "1.1.0";

const DEFAULT_VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const DEFAULT_REASONING_MODEL = "@cf/openai/gpt-oss-20b";
const DEFAULT_TIMEOUT_MS = 45000;

const EMPTY_EVIDENCE = Object.freeze({
  schemaVersion: "1.0",
  dashboardType: "unknown",
  sourcePlatform: "unknown",
  sourceTitle: "",
  observedAt: null,
  client: {
    id: null,
    name: null
  },
  metrics: [],
  trends: [],
  conditions: [],
  candidateIssues: [],
  positiveSignals: [],
  limitations: [],
  confidence: 0
});

/**
 * Extract objective operational evidence from a screenshot, pasted text,
 * or both. The result is normalized into one stable schema.
 *
 * @param {Object} options
 * @param {Object} options.env Cloudflare Worker environment containing AI.
 * @param {string|null} [options.imageDataUrl]
 * @param {string|null} [options.sourceText]
 * @param {string|null} [options.client]
 * @param {number|string|null} [options.clientId]
 * @param {string|null} [options.fileName]
 * @param {string|null} [options.context]
 * @param {string} [options.visionModel]
 * @param {string} [options.reasoningModel]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<Object>}
 */
export async function extractOperationalEvidence({
  env,
  imageDataUrl = null,
  sourceText = null,
  client = null,
  clientId = null,
  fileName = null,
  context = null,
  visionModel = DEFAULT_VISION_MODEL,
  reasoningModel = DEFAULT_REASONING_MODEL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  allowRecovery = false
} = {}) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const diagnostics = {
    requestId,
    version: OPERATIONAL_EVIDENCE_VERSION,
    inputType: imageDataUrl && sourceText ? "hybrid" : imageDataUrl ? "screenshot" : sourceText ? "text" : "none",
    attempts: [],
    executionTimeMs: 0
  };

  if (!imageDataUrl && !cleanString(sourceText)) {
    return buildResult({
      ok: false,
      evidence: normalizeOperationalEvidence({
        ...EMPTY_EVIDENCE,
        client: { id: normalizeId(clientId), name: cleanString(client) || null },
        limitations: ["No screenshot or source text was supplied."]
      }),
      diagnostics,
      startedAt,
      error: {
        code: "NO_EVIDENCE_INPUT",
        message: "A screenshot or source text is required."
      }
    });
  }

  if (!env?.AI || typeof env.AI.run !== "function") {
    const deterministic = sourceText
      ? extractDeterministicTextEvidence(sourceText, { client, clientId })
      : normalizeOperationalEvidence({
          ...EMPTY_EVIDENCE,
          client: { id: normalizeId(clientId), name: cleanString(client) || null },
          limitations: ["Workers AI binding is unavailable; screenshot extraction could not run."]
        });

    return buildResult({
      ok: Boolean(sourceText),
      evidence: deterministic,
      diagnostics,
      startedAt,
      error: sourceText
        ? null
        : {
            code: "AI_BINDING_UNAVAILABLE",
            message: "Workers AI is unavailable for screenshot evidence extraction."
          }
    });
  }

  const prompt = buildOperationalEvidencePrompt({
    client,
    clientId,
    fileName,
    sourceText,
    context,
    recovery: false
  });

  const primaryInput = imageDataUrl
    ? {
        image: dataUrlToByteArray(imageDataUrl),
        prompt,
        max_tokens: 2600
      }
    : {
        messages: [
          {
            role: "system",
            content: "Return one valid JSON object only. Extract facts; never recommend actions."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 2600
      };

  const primaryModel = imageDataUrl ? visionModel : reasoningModel;
  const primary = await runAiAttempt({
    env,
    model: primaryModel,
    input: primaryInput,
    timeoutMs,
    attemptName: "primary"
  });
  diagnostics.attempts.push(primary.diagnostic);

  if (primary.ok) {
    const evidence = normalizeOperationalEvidence({
      ...primary.data,
      client: mergeClient(primary.data?.client, clientId, client)
    });

    if (isOperationalEvidenceUsable(evidence)) {
      return buildResult({
        ok: true,
        evidence,
        diagnostics,
        startedAt,
        error: null
      });
    }
  }

  if (!allowRecovery) {
    const deterministic = sourceText
      ? extractDeterministicTextEvidence(sourceText, { client, clientId })
      : normalizeOperationalEvidence({
          ...EMPTY_EVIDENCE,
          client: { id: normalizeId(clientId), name: cleanString(client) || null },
          limitations: [
            "The single-pass screenshot extraction did not return enough structured facts for a complete assessment."
          ],
          confidence: 0
        });

    return buildResult({
      ok: Boolean(sourceText && isOperationalEvidenceUsable(deterministic)),
      evidence: deterministic,
      diagnostics,
      startedAt,
      error: {
        code: "OPERATIONAL_EVIDENCE_SINGLE_PASS_INCOMPLETE",
        message: "The fast single-pass evidence extraction did not return a usable structured result."
      }
    });
  }

  const recoveryPrompt = buildOperationalEvidencePrompt({
    client,
    clientId,
    fileName,
    sourceText,
    context,
    recovery: true
  });

  const recoveryInput = imageDataUrl
    ? {
        image: dataUrlToByteArray(imageDataUrl),
        prompt: recoveryPrompt,
        max_tokens: 1800
      }
    : {
        messages: [
          {
            role: "system",
            content: "Return one compact valid JSON object only. No markdown and no commentary."
          },
          {
            role: "user",
            content: recoveryPrompt
          }
        ],
        max_tokens: 1800
      };

  const recovery = await runAiAttempt({
    env,
    model: primaryModel,
    input: recoveryInput,
    timeoutMs,
    attemptName: "focused_recovery"
  });
  diagnostics.attempts.push(recovery.diagnostic);

  if (recovery.ok) {
    const evidence = normalizeOperationalEvidence({
      ...recovery.data,
      client: mergeClient(recovery.data?.client, clientId, client)
    });

    if (isOperationalEvidenceUsable(evidence)) {
      return buildResult({
        ok: true,
        evidence,
        diagnostics,
        startedAt,
        error: null
      });
    }
  }

  const deterministic = sourceText
    ? extractDeterministicTextEvidence(sourceText, { client, clientId })
    : normalizeOperationalEvidence({
        ...EMPTY_EVIDENCE,
        client: { id: normalizeId(clientId), name: cleanString(client) || null },
        limitations: uniqueStrings([
          "The screenshot was received, but structured evidence extraction did not return usable facts.",
          primary.error?.message,
          recovery.error?.message
        ]),
        confidence: 0
      });

  return buildResult({
    ok: Boolean(sourceText && isOperationalEvidenceUsable(deterministic)),
    evidence: deterministic,
    diagnostics,
    startedAt,
    error: {
      code: "OPERATIONAL_EVIDENCE_EXTRACTION_FAILED",
      message: "Operational evidence extraction did not return a usable structured result."
    }
  });
}

/**
 * Normalize any model or deterministic result into the stable evidence schema.
 *
 * @param {Object} input
 * @returns {Object}
 */
export function normalizeOperationalEvidence(input = {}) {
  const metrics = normalizeMetrics(input.metrics);
  const trends = normalizeTrends(input.trends);
  const conditions = normalizeConditions(input.conditions);
  const candidateIssues = normalizeCandidateIssues(
    input.candidateIssues || input.candidate_issues || input.issues
  );

  const normalized = {
    schemaVersion: "1.0",
    dashboardType: cleanSlug(input.dashboardType || input.dashboard_type || "unknown"),
    sourcePlatform: cleanSlug(input.sourcePlatform || input.source_platform || input.platform || "unknown"),
    sourceTitle: cleanString(input.sourceTitle || input.source_title || input.title),
    observedAt: normalizeDate(input.observedAt || input.observed_at || input.updatedAt || input.updated_at),
    client: mergeClient(input.client, input.clientId || input.client_id, input.clientName || input.client_name),
    metrics,
    trends,
    conditions,
    candidateIssues,
    positiveSignals: uniqueStrings(input.positiveSignals || input.positive_signals),
    limitations: uniqueStrings(input.limitations || input.uncertainty || input.warnings),
    confidence: normalizeConfidence(input.confidence)
  };

  if (!normalized.confidence) {
    const evidenceUnits =
      normalized.metrics.length +
      normalized.trends.length +
      normalized.conditions.length +
      normalized.candidateIssues.length +
      normalized.positiveSignals.length;
    normalized.confidence = evidenceUnits >= 8 ? 0.9 : evidenceUnits >= 4 ? 0.75 : evidenceUnits >= 1 ? 0.55 : 0;
  }

  return normalized;
}

/**
 * Parse a Workers AI response into a JSON object.
 * Handles direct objects, response/result wrappers, fenced JSON,
 * extra prose, trailing commas, and smart quotes.
 *
 * @param {*} raw
 * @returns {Object}
 */
export function parseOperationalEvidenceResponse(raw) {
  const unwrapped = unwrapAiResponse(raw);

  if (unwrapped && typeof unwrapped === "object" && !Array.isArray(unwrapped)) {
    return unwrapped;
  }

  if (typeof unwrapped !== "string") {
    throw new Error("Workers AI did not return text or an object.");
  }

  const cleaned = cleanModelText(unwrapped);
  const candidates = [
    cleaned,
    extractBalancedJsonObject(cleaned),
    repairCommonJson(cleaned),
    repairCommonJson(extractBalancedJsonObject(cleaned))
  ].filter(Boolean);

  let lastError = null;

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Workers AI did not return valid JSON${lastError ? `: ${lastError.message}` : "."}`);
}

/**
 * Build the evidence-only prompt used for primary and recovery extraction.
 *
 * @param {Object} options
 * @returns {string}
 */
export function buildOperationalEvidencePrompt({
  client = null,
  clientId = null,
  fileName = null,
  sourceText = null,
  context = null,
  recovery = false
} = {}) {
  const identity = [
    cleanString(client) ? `Client: ${cleanString(client)}` : null,
    normalizeId(clientId) !== null ? `Client ID: ${normalizeId(clientId)}` : null,
    cleanString(fileName) ? `File: ${cleanString(fileName)}` : null
  ].filter(Boolean).join("\n");

  const sourceBlock = cleanString(sourceText)
    ? `\nVISIBLE SOURCE TEXT:\n${truncate(cleanString(sourceText), 12000)}`
    : "";

  const contextBlock = cleanString(context)
    ? `\nOPERATIONAL CONTEXT (context only; do not convert assumptions into facts):\n${truncate(cleanString(context), 3000)}`
    : "";

  const compactInstruction = recovery
    ? `
FOCUSED RECOVERY:
Return only the most legible high-level facts. Do not attempt tiny labels.
Prioritize: dashboard type, platform, site health, errors, warnings, traffic,
visibility, rankings, backlinks, dates, directional changes, and explicit limitations.
Keep arrays short and use null only where needed.`
    : `
PRIMARY EXTRACTION:
Inspect the complete operational picture, not one isolated issue.
Capture all clearly visible high-level metrics, trends, conditions, positive signals,
and candidate issue groups. Preserve exact numbers and percentages when legible.`;

  return `
You are the GCM Operational Evidence Engine.

Your only job is to extract objective facts from the supplied screenshot or text.
Do not recommend work.
Do not choose a priority.
Do not create an Investigation.
Do not infer a cause.
Do not treat issue count or tool severity as operational priority.
When text is unreadable, record a limitation instead of guessing.

${identity || "Client identity was not supplied."}
${compactInstruction}

Return exactly one JSON object with this shape:
{
  "schemaVersion": "1.0",
  "dashboardType": "seo_dashboard|site_audit|position_tracking|search_console|analytics|backlink_audit|merchant_center|media|calendar|email|other|unknown",
  "sourcePlatform": "semrush|google_search_console|google_analytics|google_business_profile|google_merchant_center|other|unknown",
  "sourceTitle": "short visible dashboard or report title",
  "observedAt": "ISO date if visible, otherwise null",
  "client": {
    "id": null,
    "name": null
  },
  "metrics": [
    {
      "key": "snake_case_metric_name",
      "label": "visible label",
      "value": 0,
      "displayValue": "exact visible value",
      "unit": "percent|count|position|score|currency|time|unknown",
      "scope": "what this metric describes"
    }
  ],
  "trends": [
    {
      "key": "snake_case_trend_name",
      "direction": "up|down|flat|mixed|unknown",
      "change": 0,
      "displayChange": "exact visible change",
      "period": "visible comparison period",
      "confidence": 0.0
    }
  ],
  "conditions": [
    {
      "category": "technical|visibility|traffic|ranking|backlink|content|conversion|media|administrative|other",
      "statement": "objective visible condition",
      "severityLabel": "visible tool label only, otherwise unknown",
      "evidence": "metric or visible text supporting the statement"
    }
  ],
  "candidateIssues": [
    {
      "key": "snake_case_issue_group",
      "label": "visible issue group",
      "count": null,
      "toolSeverity": "error|warning|notice|high|medium|low|unknown",
      "evidence": "visible support only"
    }
  ],
  "positiveSignals": [
    "objective positive or stable signal"
  ],
  "limitations": [
    "specific unreadable, missing, ambiguous, or unverified item"
  ],
  "confidence": 0.0
}

Rules:
1. Return JSON only. No markdown fences.
2. Use valid double-quoted JSON.
3. Never invent a number.
4. Never recommend Investigate, Monitor, Defer, No Action, or work.
5. A candidate issue is evidence, not a selected priority.
6. Keep confidence between 0 and 1.
7. Preserve contradictory signals instead of resolving them yourself.
8. If the dashboard contains several panels, represent each useful panel.
${sourceBlock}
${contextBlock}
`.trim();
}

function isOperationalEvidenceUsable(evidence) {
  if (!evidence || typeof evidence !== "object") return false;
  const evidenceUnits =
    evidence.metrics?.length +
    evidence.trends?.length +
    evidence.conditions?.length +
    evidence.candidateIssues?.length +
    evidence.positiveSignals?.length;
  return evidenceUnits >= 2;
}

async function runAiAttempt({ env, model, input, timeoutMs, attemptName }) {
  const startedAt = Date.now();

  try {
    const raw = await withTimeout(env.AI.run(model, input), timeoutMs);
    const data = parseOperationalEvidenceResponse(raw);

    return {
      ok: true,
      data,
      error: null,
      diagnostic: {
        attempt: attemptName,
        model,
        status: "success",
        executionTimeMs: Date.now() - startedAt,
        error: null
      }
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: {
        code: "AI_EXTRACTION_ATTEMPT_FAILED",
        message: safeErrorMessage(error)
      },
      diagnostic: {
        attempt: attemptName,
        model,
        status: "failed",
        executionTimeMs: Date.now() - startedAt,
        error: safeErrorMessage(error)
      }
    };
  }
}

function unwrapAiResponse(raw) {
  if (raw === null || raw === undefined) return raw;
  if (typeof raw === "string") return raw;
  if (typeof raw !== "object") return String(raw);

  const objectCandidates = [
    raw.response,
    raw.result,
    raw.output,
    raw.text,
    raw.generated_text,
    raw.answer,
    raw.data
  ];

  for (const candidate of objectCandidates) {
    if (candidate === null || candidate === undefined) continue;
    if (typeof candidate === "string") return candidate;
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      if (typeof candidate.response === "string") return candidate.response;
      if (typeof candidate.text === "string") return candidate.text;
      return candidate;
    }
  }

  return raw;
}

function cleanModelText(value) {
  return String(value)
    .replace(/^\uFEFF/, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
}

function extractBalancedJsonObject(value) {
  const text = String(value || "");
  const start = text.indexOf("{");
  if (start < 0) return "";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return "";
}

function repairCommonJson(value) {
  return String(value || "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .trim();
}

function normalizeMetrics(value) {
  const items = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value).map(([key, metricValue]) => ({ key, value: metricValue }))
      : [];

  return items
    .map((item) => {
      if (item === null || item === undefined) return null;
      if (typeof item !== "object") {
        return {
          key: "metric",
          label: "Metric",
          value: normalizeNumber(item),
          displayValue: cleanString(item),
          unit: "unknown",
          scope: ""
        };
      }

      const rawValue = item.value ?? item.metricValue ?? item.metric_value ?? null;
      return {
        key: cleanSlug(item.key || item.name || item.label || "metric"),
        label: cleanString(item.label || item.name || item.key || "Metric"),
        value: normalizeNumber(rawValue),
        displayValue: cleanString(item.displayValue || item.display_value || rawValue),
        unit: cleanSlug(item.unit || "unknown"),
        scope: cleanString(item.scope || item.context)
      };
    })
    .filter((item) => item && (item.displayValue || item.value !== null))
    .slice(0, 40);
}

function normalizeTrends(value) {
  const items = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value).map(([key, direction]) => ({ key, direction }))
      : [];

  return items
    .map((item) => {
      if (!item) return null;
      if (typeof item !== "object") {
        return {
          key: "trend",
          direction: normalizeDirection(item),
          change: null,
          displayChange: cleanString(item),
          period: "",
          confidence: 0.5
        };
      }

      return {
        key: cleanSlug(item.key || item.name || item.label || "trend"),
        direction: normalizeDirection(item.direction || item.trend),
        change: normalizeNumber(item.change),
        displayChange: cleanString(item.displayChange || item.display_change || item.change),
        period: cleanString(item.period || item.comparisonPeriod || item.comparison_period),
        confidence: normalizeConfidence(item.confidence)
      };
    })
    .filter(Boolean)
    .slice(0, 30);
}

function normalizeConditions(value) {
  const items = Array.isArray(value) ? value : [];

  return items
    .map((item) => {
      if (typeof item === "string") {
        return {
          category: "other",
          statement: cleanString(item),
          severityLabel: "unknown",
          evidence: cleanString(item)
        };
      }
      if (!item || typeof item !== "object") return null;
      return {
        category: cleanSlug(item.category || "other"),
        statement: cleanString(item.statement || item.condition || item.summary),
        severityLabel: cleanSlug(item.severityLabel || item.severity_label || item.severity || "unknown"),
        evidence: cleanString(item.evidence || item.support)
      };
    })
    .filter((item) => item && item.statement)
    .slice(0, 40);
}

function normalizeCandidateIssues(value) {
  const items = Array.isArray(value) ? value : [];

  return items
    .map((item) => {
      if (typeof item === "string") {
        return {
          key: cleanSlug(item),
          label: cleanString(item),
          count: null,
          toolSeverity: "unknown",
          evidence: cleanString(item)
        };
      }
      if (!item || typeof item !== "object") return null;
      const label = cleanString(item.label || item.name || item.key || item.issue);
      return {
        key: cleanSlug(item.key || label || "issue"),
        label,
        count: normalizeInteger(item.count),
        toolSeverity: cleanSlug(item.toolSeverity || item.tool_severity || item.severity || "unknown"),
        evidence: cleanString(item.evidence || item.support)
      };
    })
    .filter((item) => item && item.label)
    .slice(0, 30);
}

function extractDeterministicTextEvidence(sourceText, { client, clientId } = {}) {
  const text = cleanString(sourceText);
  const metrics = [];
  const trends = [];
  const conditions = [];

  const metricPattern = /([A-Za-z][A-Za-z0-9 /_-]{2,50})\s*[:=-]?\s*(-?\d[\d,.]*\s*%?)/g;
  let match;

  while ((match = metricPattern.exec(text)) !== null && metrics.length < 40) {
    const displayValue = match[2].trim();
    metrics.push({
      key: cleanSlug(match[1]),
      label: cleanString(match[1]),
      value: normalizeNumber(displayValue),
      displayValue,
      unit: displayValue.includes("%") ? "percent" : "count",
      scope: ""
    });
  }

  const directionPatterns = [
    { pattern: /\b(increased?|improved?|grew|up)\b/gi, direction: "up" },
    { pattern: /\b(decreased?|declined?|dropped?|lost|down)\b/gi, direction: "down" },
    { pattern: /\b(unchanged|stable|flat|no change)\b/gi, direction: "flat" }
  ];

  for (const entry of directionPatterns) {
    if (entry.pattern.test(text)) {
      trends.push({
        key: "text_direction",
        direction: entry.direction,
        change: null,
        displayChange: "",
        period: "",
        confidence: 0.55
      });
    }
  }

  const lines = text.split(/\r?\n/).map(cleanString).filter(Boolean);
  for (const line of lines.slice(0, 40)) {
    if (/\b(error|warning|issue|toxic|broken|declin|lost|failed)\b/i.test(line)) {
      conditions.push({
        category: "other",
        statement: line,
        severityLabel: "unknown",
        evidence: line
      });
    }
  }

  return normalizeOperationalEvidence({
    dashboardType: "unknown",
    sourcePlatform: "unknown",
    client: { id: normalizeId(clientId), name: cleanString(client) || null },
    metrics,
    trends,
    conditions,
    candidateIssues: [],
    positiveSignals: lines.filter((line) => /\b(improved|increase|gain|healthy|stable|resolved)\b/i.test(line)).slice(0, 10),
    limitations: ["Evidence was extracted deterministically from text because AI extraction was unavailable or unsuccessful."],
    confidence: metrics.length >= 4 ? 0.65 : metrics.length ? 0.5 : 0.25
  });
}

function buildResult({ ok, evidence, diagnostics, startedAt, error }) {
  diagnostics.executionTimeMs = Date.now() - startedAt;
  return {
    ok,
    engine: "operational-evidence",
    version: OPERATIONAL_EVIDENCE_VERSION,
    evidence,
    error,
    diagnostics
  };
}

function mergeClient(existing, clientId, clientName) {
  const existingObject = existing && typeof existing === "object" ? existing : {};
  return {
    id: normalizeId(existingObject.id ?? clientId),
    name: cleanString(existingObject.name || clientName) || null
  };
}

function dataUrlToByteArray(dataUrl) {
  const value = cleanString(dataUrl);
  const match = value.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i);

  if (!match) {
    throw new Error("Screenshot must be a valid base64 data URL.");
  }

  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return [...bytes];
}

function withTimeout(promise, timeoutMs) {
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Workers AI timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function normalizeDirection(value) {
  const direction = cleanSlug(value);
  if (["up", "increase", "increased", "improving", "improved", "gain", "gained"].includes(direction)) return "up";
  if (["down", "decrease", "decreased", "declining", "declined", "loss", "lost"].includes(direction)) return "down";
  if (["flat", "stable", "unchanged", "no_change"].includes(direction)) return "flat";
  if (["mixed", "variable"].includes(direction)) return "mixed";
  return "unknown";
}

function normalizeConfidence(value) {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "high") return 0.9;
    if (normalized === "medium") return 0.65;
    if (normalized === "low") return 0.35;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  if (number > 1 && number <= 100) return Math.max(0, Math.min(1, number / 100));
  return Math.max(0, Math.min(1, number));
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value)
    .replace(/[$,%\s]/g, "")
    .replace(/,/g, "")
    .trim();

  const suffixMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)([kmb])$/i);
  if (suffixMatch) {
    const multipliers = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };
    return Number(suffixMatch[1]) * multipliers[suffixMatch[2].toLowerCase()];
  }

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function normalizeInteger(value) {
  const number = normalizeNumber(value);
  return number === null ? null : Math.round(number);
}

function normalizeId(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : cleanString(value) || null;
}

function normalizeDate(value) {
  const text = cleanString(value);
  if (!text) return null;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
}

function cleanSlug(value) {
  const text = cleanString(value).toLowerCase();
  return text
    ? text.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown"
    : "unknown";
}

function cleanString(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function uniqueStrings(value) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const text = cleanString(item);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }

  return result.slice(0, 30);
}

function truncate(value, maxLength) {
  const text = cleanString(value);
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

function safeErrorMessage(error) {
  return cleanString(error?.message || error || "Unknown operational evidence error.");
}
