/* =========================================================
   Global Concepts Media Operating System
   File: shared/gmailMonitoringEvidence.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Gmail — Evidence Before Assumptions
   Purpose:
   Extract exact, source-grounded monitoring facts from Gmail notifications so
   operator summaries never replace the evidence required for future comparison.

   Change notes — v1.0.0:
   - Extracts Position Tracking project/domain, report date, trigger rule,
     affected keyword rows, current position, movement, and search volume.
   - Supports both line-oriented and flattened Gmail HTML-to-text layouts.
   - Produces a compact operator evidence summary and a business-meaning sentence.
   - Contains no D1 or Gmail mutation logic; this module is pure/testable evidence parsing.
   ========================================================= */

export const GMAIL_MONITORING_EVIDENCE_VERSION = "1.0.0";

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

function formatMovement(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  if (number > 0) return `↑${number}`;
  if (number < 0) return `↓${Math.abs(number)}`;
  return "↔0";
}

function sanitize(value) {
  return clean(String(value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n"));
}

function clean(value) {
  return String(value ?? "").trim();
}
