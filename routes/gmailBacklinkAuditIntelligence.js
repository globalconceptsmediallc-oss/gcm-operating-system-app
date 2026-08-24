/* =========================================================
   Global Concepts Media Operating System
   File: routes/gmailBacklinkAuditIntelligence.js
   Version: 1.0.0
   Status: Production Test Candidate
   Sprint: Gmail — Backlink Audit Investigation Boundary
   Purpose:
   Distinguish routine SEMrush Backlink Audit monitoring from source-proven
   toxic-domain evidence that is specific enough to open an Investigation.

   Change Notes — 1.0.0
   - Extracts named toxic referring domains and their Semrush TS values.
   - Routes specific unresolved toxic-domain evidence to Communication +
     Investigation, never directly to corrective Work.
   - Leaves generic backlink notices to the existing Gmail calibration path.
   ========================================================= */

const FILE_VERSION = "1.0.0";

function clean(value) {
  return String(value ?? "").trim();
}

function sourceText(message) {
  return `${clean(message?.subject)}\n${clean(message?.bodyText)}`;
}

function inferBacklinkClient(message) {
  const text = sourceText(message).toLowerCase();
  const rules = [
    [/southfloridasafes\.com|south florida safes/, "South Florida Safes"],
    [/northfloridasafes\.com|north florida safes/, "North Florida Safes"],
    [/sesafes\.com|southeast safes/, "Southeast Safes"],
    [/a1actionsafeandlock\.com|a1 action safe(?: & lock)?/, "A1 Action Safe & Lock"],
    [/hbguns\.com|hb guns|harry beckwith guns/, "HB Guns"],
    [/pickettweaponry\.com|pickett weaponry/, "Pickett Weaponry"],
    [/moveasafe\.com|move a safe/, "Move A Safe"],
    [/globalconceptsmedia\.com|global concepts media/, "Global Concepts Media"]
  ];
  for (const [pattern, name] of rules) {
    if (pattern.test(text)) return name;
  }
  return "";
}

function firstCount(text, pattern) {
  const match = String(text || "").match(pattern);
  return match ? Number(match[1]) : null;
}

export function extractBacklinkAuditEvidence(message) {
  const text = sourceText(message);
  const lines = text
    .split(/\r?\n/)
    .map(line => clean(line))
    .filter(Boolean);

  const start = lines.findIndex(line => /new toxic domains?/i.test(line));
  const end = start >= 0
    ? lines.findIndex((line, index) => index > start && /new trusted domains?/i.test(line))
    : -1;
  const section = start >= 0
    ? lines.slice(start + 1, end > start ? end : lines.length)
    : [];

  const toxicDomains = [];
  const seen = new Set();
  const domainPattern = /\b((?:www\.)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,})\b/i;

  for (const line of section) {
    const domainMatch = line.match(domainPattern);
    if (!domainMatch) continue;
    const domain = domainMatch[1].toLowerCase();
    if (seen.has(domain)) continue;

    const scoreMatch = line.match(/\b(\d{1,3})\s*$/);
    const score = scoreMatch ? Number(scoreMatch[1]) : null;
    if (score === null) continue;

    seen.add(domain);
    toxicDomains.push({ domain, toxicScore: score });
  }

  return {
    toxicDomainCount: firstCount(text, /\b(\d+)\s+New Toxic Domains?\b/i),
    trustedDomainCount: firstCount(text, /\b(\d+)\s+New Trusted Domains?\b/i),
    newReferringDomains: firstCount(text, /\bfound\s+(\d+)\s+new referring domains?\b/i),
    lostDomains: firstCount(text, /\blost\s+(\d+)\s+domains?\b/i),
    brokenDomains: firstCount(text, /\b(\d+)\s+domains? are broken\b/i),
    toxicDomains
  };
}

export function buildBacklinkAuditRecommendation({ message, analysis, decision, classification }) {
  const evidence = extractBacklinkAuditEvidence(message);
  if (!evidence.toxicDomains.length) return null;

  const client = inferBacklinkClient(message) || clean(analysis?.client?.name) || "Unassigned — Human Review";
  if (!client || /unassigned|human review/i.test(client)) return null;

  const toxicSummary = evidence.toxicDomains
    .map(item => `${item.domain} (TS ${item.toxicScore})`)
    .join(", ");
  const count = evidence.toxicDomainCount || evidence.toxicDomains.length;

  const businessMeaning = `${client}: SEMrush identified ${count} new toxic referring domain${count === 1 ? "" : "s"}: ${toxicSummary}. The source now contains specific adverse backlink evidence, so the condition requires diagnosis rather than routine Monitoring.`;
  const recommendedAction = `Create an Investigation to verify why ${toxicSummary} are classified as toxic, inspect the actual link context, and determine whether the links are legitimate, spam, or harmful. Do not create corrective Work until the investigation establishes whether removal, outreach, disavow, or no action is justified.`;

  return {
    communicationFamily: clean(classification?.notificationFamily) || "SEMrush Backlink Audit",
    notificationType: "backlink_audit",
    client,
    businessMeaning,
    operationalPriority: "Medium",
    recommendedAction,
    shouldCreateCommunication: true,
    shouldCreateInvestigation: true,
    investigationCandidate: true,
    shouldCreateWorkItem: false,
    monitoringOnly: false,
    monitoringMetrics: evidence,
    archive: false,
    proposedRoute: "Investigation",
    confidence: "High",
    decisionReliability: "Reliable — specific toxic domains and TS values are present in the Gmail source",
    evidenceSufficiency: "Sufficient to open an Investigation; insufficient to prescribe corrective Work",
    evidenceComparedAgainst: "Current SEMrush Backlink Audit email; no prior backlink investigation or remediation is assumed",
    verificationRequired: "Verify the listed referring domains, backlink context, and Semrush toxicity reasons before choosing removal, outreach, disavow, or no action.",
    humanReviewRequired: true,
    productionDecisionReady: true,
    sourceAnalysis: {
      ...(decision && typeof decision === "object" ? decision : {}),
      source: "SEMrush Backlink Audit",
      communicationType: "Backlink Audit",
      title: `${client} — Toxic backlink investigation`,
      operationalSummary: businessMeaning,
      businessImpact: "Potential backlink-quality and organic-search risk; actual impact and corrective action are not yet proven.",
      importance: "Medium",
      operationalPriority: "Medium",
      recommendedAction,
      reasoning: "The Gmail source names specific toxic referring domains and TS values. Preserve the source as evidence and investigate before creating corrective Work.",
      recommendedRoutes: {
        saveCommunication: true,
        createInvestigation: true,
        createWorkItem: false,
        replyRequired: false
      }
    }
  };
}

export const GMAIL_BACKLINK_AUDIT_INTELLIGENCE_VERSION = FILE_VERSION;
