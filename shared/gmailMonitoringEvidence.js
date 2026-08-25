/* =========================================================
   Global Concepts Media Operating System
   File: shared/gmailMonitoringEvidence.js
   Version: 1.1.7
   Status: Production Road-Test Candidate
   Sprint: Gmail — Universal Monitoring Evidence
   Purpose:
   Extract exact, source-grounded monitoring facts from Gmail notifications so
   operator summaries never replace the evidence required for future comparison.

   Change notes — v1.1.7:
   - Restricts value-before-label extraction to a simple unsigned metric value.
   - Prevents a preceding metric delta such as “Errors 463 +1 Warnings 140” from
     being misread as “Warnings 463 (+1)” in flattened Ahrefs report text.
   - Preserves the Google Search Console “30 clicks” achievement fix while
     restoring all existing Ahrefs metric values and deltas.

   Change notes — v1.1.6:
   - Extracts priority monitoring metrics when the source presents the numeric
     value before the metric label, such as “30 clicks”.
   - Fixes Google Search Console achievement emails that previously contained
     measurable client evidence but surfaced as Manual Review in Morning Command.
   - Keeps the rule source-neutral and preserves all existing Monitoring,
     Investigation, Work, client, and D1 decision boundaries.

   Change notes — v1.1.5:
   - Normalizes HTML markup before monitoring extraction even when a sender
     incorrectly labels HTML content as text/plain in Gmail MIME.
   - Preserves table/paragraph boundaries so Site Audit labels and values remain
     readable source evidence after malformed MIME normalization.
   - Locks the live HB Guns Semrush Site Audit shape without changing Monitoring,
     Work, Investigation, client, or D1 decision rules.

   Change notes — v1.1.4:
   - Preserves repeated flattened changed rows that use an explicit New marker.
   - Prevents later changed metrics from disappearing after the first delta row
     when Gmail collapses a multi-line report into one line.
   - Keeps the rule source-neutral and preserves all v1.1.3 delta behavior.

   Change notes — v1.1.3:
   - Preserves measurable deltas such as +1 and −96 alongside current values.
   - Recognizes health-score metrics in flattened report layouts.
   - Extracts changed metric rows from line-oriented and flattened source text.
   - Prioritizes health context and changed metrics in compact summaries so the
     operator can see what actually changed before choosing a disposition.
   - Keeps the parser source-neutral and preserves all prior Monitoring and
     Position Tracking evidence behavior.

   Change notes — v1.1.2:
   - Keeps compact monitoring summaries bounded while always surfacing ratio
     evidence when the source provides one.
   - Prevents a decision-critical ratio from being crowded out by lower-value
     metrics when a report exposes more than ten measurable facts.
   - Preserves all v1.1.1 linked/flattened parsing and Position Tracking behavior.

   Change notes — v1.1.1:
   - Normalizes Markdown-linked values and URL-heavy email text before extraction.
   - Extracts priority dashboard metrics even when Gmail HTML flattens several
     label/value pairs onto one line or adds explanatory copy after the value.
   - Keeps the parser source-neutral: no client, project, or report-specific rule.
   - Locks live Site Audit evidence shapes without weakening Position Tracking.

   Change notes — v1.1.0:
   - Adds a source-neutral monitoring evidence envelope for any monitoring email.
   - Extracts compact numeric label/value facts without deciding what they mean.
   - Preserves a stable/no-change source signal when explicitly stated.
   - Produces a compact evidence summary and factual business-meaning sentence.
   - Keeps the specialized Position Tracking table parser for keyword rows.
   - Contains no D1 or Gmail mutation logic; this module remains pure/testable.

   Change notes — v1.0.0:
   - Extracts Position Tracking project/domain, report date, trigger rule,
     affected keyword rows, current position, movement, and search volume.
   - Supports both line-oriented and flattened Gmail HTML-to-text layouts.
   ========================================================= */

export const GMAIL_MONITORING_EVIDENCE_VERSION = "1.1.7";

const METRIC_PRIORITY_TERMS = Object.freeze([
  "health score",
  "site health",
  "health",
  "errors",
  "warnings",
  "notices",
  "broken",
  "blocked",
  "crawled pages",
  "crawled",
  "have issues",
  "issues",
  "redirects",
  "traffic",
  "visibility",
  "clicks",
  "impressions",
  "conversions",
  "users",
  "views",
  "subscribers"
]);

const METRIC_VALUE_SOURCE =
  "[-+]?\\d[\\d,.]*(?:\\.\\d+)?%?(?:\\s*(?:\\(|\\[)?[+−-]\\d[\\d,.]*(?:\\)|\\])?)?(?:\\s+(?:no change|unchanged|stable))?";

const REVERSED_METRIC_VALUE_SOURCE = "\\d[\\d,]*(?:\\.\\d+)?%?";

const PRIORITY_METRIC_PATTERN = new RegExp(
  `\\b(${[...METRIC_PRIORITY_TERMS]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegex)
    .join("|")})\\b\\s*[:=-]?\\s*(${METRIC_VALUE_SOURCE})`,
  "ig"
);

const REVERSED_PRIORITY_METRIC_PATTERN = new RegExp(
  `\\b(${REVERSED_METRIC_VALUE_SOURCE})\\s+(${[...METRIC_PRIORITY_TERMS]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegex)
    .join("|")})\\b`,
  "ig"
);

const DELTA_METRIC_PATTERN = new RegExp(
  "(?:^|\\n|\\b(?:what['’]?s new|issues|view)\\s+)([A-Za-z][A-Za-z0-9 ./'&_-]{1,65}?)\\s+(?:New\\s+)?(\\d[\\d,.]*%?)\\s+([+−-]\\d[\\d,.]*)",
  "ig"
);

const NEW_DELTA_METRIC_PATTERN = new RegExp(
  "\\b([A-Za-z][A-Za-z0-9 ./'&_-]{1,65}?)\\s+New\\s+(\\d[\\d,.]*%?)\\s+([+−-]\\d[\\d,.]*)",
  "ig"
);

export function extractPositionTrackingEvidence(value) {
  const text = sanitize(value);
  if (!text || !/position tracking/i.test(text)) return null;

  const projectMatch = text.match(
    /Project:\s*([^•\n]+?)\s*•\s*([a-z0-9.-]+\.[a-z]{2,})/i
  );
  const domainMatch = text.match(/\bDomain:\s*([^\s\n]+)/i);
  const dateMatch = text.match(
    /\bDate:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i
  );
  const countMatch = text.match(/Alert triggered for\s*(\d+)\s*keywords?/i);
  const ruleMatch = text.match(
    /\bRule:\s*(.+?)(?=\n\s*Domain:|\s+Domain:|$)/is
  );

  const tableHeader = text.match(
    /Keyword\s+Pos\.\s+on\s+[A-Za-z]{3}\s+\d{1,2}\s+Diff\.\s+Volume/i
  );

  const keywords = [];
  if (tableHeader?.index !== undefined) {
    const tableStart = tableHeader.index + tableHeader[0].length;
    const tableText = text
      .slice(tableStart)
      .split(/\bGo to Campaign\b/i)[0]
      .trim();

    const lines = tableText
      .split(/\n+/)
      .map(line => clean(line))
      .filter(Boolean);

    const addRow = rowText => {
      const row = clean(rowText).match(
        /^(.+?)\s+(\d{1,3})\s+([+-]?\d{1,3})\s+([\d,.]+)$/
      );
      if (!row) return false;
      const keyword = clean(row[1]);
      const position = Number(row[2]);
      const change = Number(row[3]);
      const volume = Number(String(row[4]).replace(/,/g, ""));
      if (!keyword || !Number.isFinite(position) || !Number.isFinite(change)) {
        return false;
      }
      keywords.push({
        keyword,
        position,
        change,
        volume:Number.isFinite(volume) ? volume : null
      });
      return true;
    };

    if (lines.length <= 1) {
      addRow(tableText);
    } else {
      for (let index = 0; index < lines.length; index += 1) {
        if (addRow(lines[index])) continue;
        const numeric = lines[index]?.match(
          /^(\d{1,3})\s+([+-]?\d{1,3})\s+([\d,.]+)$/
        );
        const previous = clean(lines[index - 1]);
        if (!numeric || !previous) continue;
        addRow(`${previous} ${numeric[1]} ${numeric[2]} ${numeric[3]}`);
      }
    }
  }

  const project = clean(projectMatch?.[1]);
  const projectDomain = clean(projectMatch?.[2]);
  const domain = clean(domainMatch?.[1]) || projectDomain;
  const reportDate = clean(dateMatch?.[1]);
  const rule = clean(ruleMatch?.[1]);
  const keywordCount = countMatch ? Number(countMatch[1]) : keywords.length;

  if (!domain || (!keywords.length && !rule && !keywordCount)) return null;

  return {
    type:"position_tracking",
    project:project || null,
    domain:domain || null,
    reportDate:reportDate || null,
    rule:rule || null,
    keywordCount:Number.isFinite(keywordCount) ? keywordCount : keywords.length,
    keywords
  };
}

export function extractMonitoringEvidence(messageOrText = {}) {
  const message = messageOrText && typeof messageOrText === "object"
    ? messageOrText
    : { bodyText:String(messageOrText || "") };
  const subject = clean(message.subject);
  const bodyText = clean(message.bodyText || message.body || message.snippet);
  const text = sanitize(`${subject}\n${bodyText}`);
  if (!text) return null;

  const positionEvidence = extractPositionTrackingEvidence(text);
  if (positionEvidence) return positionEvidence;

  const lines = text
    .split(/\n+/)
    .map(line => clean(line).replace(/^[•·*-]\s*/, ""))
    .filter(Boolean);
  const metrics = [];
  const seen = new Map();

  const addMetric = (label, displayValue, scope = "") => {
    const safeLabel = clean(label)
      .replace(/^(?:what['’]?s new|issues|view)\s+/i, "")
      .replace(/[:=-]+$/, "")
      .trim();
    const safeValue = clean(displayValue);
    const parsed = parseMetricValue(safeValue);
    if (!isMetricLabel(safeLabel) || !parsed) return;

    const key = safeLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!key) return;

    const existingIndex = seen.get(key);
    if (Number.isInteger(existingIndex)) {
      const existing = metrics[existingIndex];
      if (parsed.delta !== null && existing.delta === null) {
        metrics[existingIndex] = {
          ...existing,
          displayValue:parsed.displayValue,
          delta:parsed.delta,
          deltaDisplay:parsed.deltaDisplay,
          scope:clean(scope) || existing.scope
        };
      }
      return;
    }

    seen.set(key, metrics.length);
    metrics.push({
      key,
      label:safeLabel,
      value:parsed.value,
      displayValue:parsed.displayValue,
      unit:parsed.unit,
      delta:parsed.delta,
      deltaDisplay:parsed.deltaDisplay,
      scope:clean(scope),
      sourceOrder:metrics.length
    });
  };

  PRIORITY_METRIC_PATTERN.lastIndex = 0;
  let priorityMatch;
  while ((priorityMatch = PRIORITY_METRIC_PATTERN.exec(text)) !== null && metrics.length < 30) {
    addMetric(
      canonicalMetricLabel(priorityMatch[1]),
      priorityMatch[2],
      priorityMatch[0]
    );
  }

  REVERSED_PRIORITY_METRIC_PATTERN.lastIndex = 0;
  let reversedPriorityMatch;
  while ((reversedPriorityMatch = REVERSED_PRIORITY_METRIC_PATTERN.exec(text)) !== null && metrics.length < 30) {
    addMetric(
      canonicalMetricLabel(reversedPriorityMatch[2]),
      reversedPriorityMatch[1],
      reversedPriorityMatch[0]
    );
  }

  DELTA_METRIC_PATTERN.lastIndex = 0;
  let deltaMatch;
  while ((deltaMatch = DELTA_METRIC_PATTERN.exec(text)) !== null && metrics.length < 30) {
    addMetric(
      deltaMatch[1],
      `${deltaMatch[2]} ${deltaMatch[3]}`,
      deltaMatch[0]
    );
  }

  NEW_DELTA_METRIC_PATTERN.lastIndex = 0;
  let newDeltaMatch;
  while ((newDeltaMatch = NEW_DELTA_METRIC_PATTERN.exec(text)) !== null && metrics.length < 30) {
    addMetric(
      newDeltaMatch[1],
      `${newDeltaMatch[2]} ${newDeltaMatch[3]}`,
      newDeltaMatch[0]
    );
  }

  for (let index = 0; index < lines.length && metrics.length < 30; index += 1) {
    const line = lines[index];
    const inline = line.match(
      new RegExp(`^([A-Za-z][A-Za-z0-9 ./'&_-]{1,65}?)\\s*[:=-]?\\s+(${METRIC_VALUE_SOURCE})$`, "i")
    );
    if (inline) addMetric(inline[1], inline[2], line);

    const next = lines[index + 1] || "";
    if (isMetricLabel(line) && new RegExp(`^${METRIC_VALUE_SOURCE}$`, "i").test(next)) {
      addMetric(line, next, `${line} ${next}`);
    }
  }

  const ratioMatch = subject.match(/\b(\d[\d,]*)\s+(?:out of|of)\s+(\d[\d,]*)\b/i);
  if (ratioMatch) {
    const numerator = Number(ratioMatch[1].replace(/,/g, ""));
    const denominator = Number(ratioMatch[2].replace(/,/g, ""));
    if (Number.isFinite(numerator) && Number.isFinite(denominator)) {
      metrics.push({
        key:"reported_ratio",
        label:"Reported Ratio",
        value:numerator,
        displayValue:`${ratioMatch[1]}/${ratioMatch[2]}`,
        unit:"ratio",
        delta:null,
        deltaDisplay:null,
        scope:subject,
        denominator,
        sourceOrder:metrics.length
      });
    }
  }

  const reportDate = clean(
    text.match(/\bDate:\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}(?:\s*\([^)]*\))?)/i)?.[1]
  );
  const stableSignal = /haven['’]?t detected any significant changes|no significant changes/i.test(text)
    ? "No significant change since the previous comparison"
    : /\b(?:no change|unchanged|stable)\b/i.test(text)
      ? "Source reports stable or unchanged results"
      : "";

  if (!metrics.length && !stableSignal) return null;

  return {
    type:"monitoring_evidence",
    subject:subject || null,
    reportDate:reportDate || clean(message.date) || null,
    stableSignal:stableSignal || null,
    metrics:metrics.map(({ sourceOrder, ...metric }) => metric)
  };
}

export function formatPositionTrackingEvidence(evidence) {
  if (!evidence || evidence.type !== "position_tracking") return "";
  const rows = Array.isArray(evidence.keywords) ? evidence.keywords : [];
  const rowText = rows.map(row => {
    const movement = formatMovement(row?.change);
    return `${clean(row?.keyword)} · #${row?.position ?? "?"}${movement ? ` · ${movement}` : ""}`;
  }).filter(Boolean);

  const parts = [];
  if (rowText.length) parts.push(rowText.join("; "));
  if (evidence.rule) parts.push(evidence.rule);
  if (evidence.domain) parts.push(evidence.domain);
  if (evidence.reportDate) parts.push(evidence.reportDate);
  return parts.join(" · ");
}

export function formatMonitoringEvidence(evidence) {
  if (!evidence) return "";
  if (evidence.type === "position_tracking") return formatPositionTrackingEvidence(evidence);
  if (evidence.type !== "monitoring_evidence") return "";

  const metrics = Array.isArray(evidence.metrics) ? evidence.metrics : [];
  const ordered = [...metrics].sort(compareMetricPriority);
  const selected = ordered.slice(0, 10);
  for (const metric of ordered) {
    if (metric?.unit !== "ratio" || selected.includes(metric)) continue;
    selected.push(metric);
  }
  const metricText = selected
    .map(metric => `${clean(metric?.label)} ${clean(metric?.displayValue)}`)
    .filter(Boolean);
  const parts = [...metricText];
  if (evidence.stableSignal) parts.push(evidence.stableSignal);
  if (evidence.reportDate) parts.push(evidence.reportDate);
  return parts.join(" · ");
}

export function buildPositionTrackingBusinessMeaning(evidence, clientName = "the client") {
  if (!evidence || evidence.type !== "position_tracking") return "";
  const rows = Array.isArray(evidence.keywords) ? evidence.keywords : [];
  if (rows.length === 1) {
    const row = rows[0];
    const movement = Number(row.change);
    const movementText = Number.isFinite(movement)
      ? movement > 0
        ? `up ${movement} position${movement === 1 ? "" : "s"}`
        : movement < 0
          ? `down ${Math.abs(movement)} position${Math.abs(movement) === 1 ? "" : "s"}`
          : "unchanged"
      : "with movement reported";
    const trigger = evidence.rule ? `, triggering “${evidence.rule}”` : "";
    return `${clientName}: “${clean(row.keyword)}” is now position ${row.position}, ${movementText}${trigger}. Preserve this exact ranking signal as monitoring evidence for future comparison.`;
  }

  if (rows.length > 1) {
    return `${clientName}: ${rows.length} Position Tracking keyword movements were reported${evidence.rule ? ` under “${evidence.rule}”` : ""}. Preserve every keyword, position, and movement as monitoring evidence for future comparison.`;
  }

  return `${clientName}: Position Tracking reported ${evidence.keywordCount || "a"} keyword signal${evidence.keywordCount === 1 ? "" : "s"}${evidence.rule ? ` under “${evidence.rule}”` : ""}. Preserve the source evidence for future comparison.`;
}

export function buildMonitoringBusinessMeaning(evidence, clientName = "the client") {
  if (!evidence) return "";
  if (evidence.type === "position_tracking") {
    return buildPositionTrackingBusinessMeaning(evidence, clientName);
  }
  if (evidence.type !== "monitoring_evidence") return "";
  const summary = formatMonitoringEvidence({ ...evidence, reportDate:null });
  if (!summary) return "";
  return `${clientName}: ${summary}. Preserve these exact source-grounded facts as monitoring evidence for future comparison; the evidence itself does not create corrective work.`;
}

function compareMetricPriority(left, right) {
  const leftHealth = /\b(?:health score|site health|health)\b/i.test(clean(left?.label)) ? 0 : 1;
  const rightHealth = /\b(?:health score|site health|health)\b/i.test(clean(right?.label)) ? 0 : 1;
  if (leftHealth !== rightHealth) return leftHealth - rightHealth;

  const leftChanged = Number.isFinite(Number(left?.delta)) && Number(left?.delta) !== 0 ? 0 : 1;
  const rightChanged = Number.isFinite(Number(right?.delta)) && Number(right?.delta) !== 0 ? 0 : 1;
  if (leftChanged !== rightChanged) return leftChanged - rightChanged;

  const leftPriority = metricPriority(left?.label);
  const rightPriority = metricPriority(right?.label);
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;

  return 0;
}

function metricPriority(label) {
  const value = clean(label).toLowerCase();
  const index = METRIC_PRIORITY_TERMS.findIndex(term => value.includes(term));
  return index >= 0 ? index : METRIC_PRIORITY_TERMS.length + 1;
}

function parseMetricValue(value) {
  const input = clean(value);
  const match = input.match(
    /^([-+]?\d[\d,.]*(?:\.\d+)?%?)(?:\s*(?:\(|\[)?([+−-]\d[\d,.]*)(?:\)|\])?)?(?:\s+(no change|unchanged|stable))?$/i
  );
  if (!match) return null;

  const numericText = clean(match[1]);
  const numericValue = Number(numericText.replace(/[,%]/g, ""));
  if (!numericText || !Number.isFinite(numericValue)) return null;

  const deltaToken = clean(match[2]);
  const delta = deltaToken
    ? Number(deltaToken.replace(/,/g, "").replace(/−/g, "-"))
    : null;
  const deltaValue = Number.isFinite(delta) ? delta : null;
  const deltaDisplay = deltaValue === null
    ? null
    : deltaValue > 0
      ? `+${deltaValue}`
      : deltaValue < 0
        ? `−${Math.abs(deltaValue)}`
        : "0";

  const status = clean(match[3]);
  const displayValue = [
    numericText,
    deltaDisplay ? `(${deltaDisplay})` : "",
    status
  ].filter(Boolean).join(" ");

  return {
    value:numericValue,
    displayValue,
    unit:numericText.includes("%") ? "percent" : "count",
    delta:deltaValue,
    deltaDisplay
  };
}

function canonicalMetricLabel(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\b\w/g, character => character.toUpperCase());
}

function isMetricLabel(value) {
  const label = clean(value);
  if (!label || label.length < 2 || label.length > 70) return false;
  if (!/[A-Za-z]/.test(label)) return false;
  if (/^(date|time|copyright|project|website url|domain|merchant center id)$/i.test(label)) return false;
  if (/[!?]$/.test(label)) return false;
  if (label.split(/\s+/).length > 10) return false;
  return true;
}

function formatMovement(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  if (number > 0) return `↑${number}`;
  if (number < 0) return `↓${Math.abs(number)}`;
  return "↔0";
}

function sanitize(value) {
  return clean(String(value ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|mailto:)[^)]+\)/gi, "$1")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n"));
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clean(value) {
  return String(value ?? "").trim();
}