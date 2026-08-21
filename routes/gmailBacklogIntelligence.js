/* =========================================================
   Global Concepts Media Operating System
   File: routes/gmailBacklogIntelligence.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Gmail — Evidence-Aware Operational Backlog
   Purpose:
   Classify unprocessed operational Gmail using source evidence and verified
   client context before choosing Monitoring, Investigation, Work, or Review.

   Production rules:
   - Metric labels such as Errors, Issues, Warnings, or Notices do not by
     themselves prove an Investigation.
   - A client-specific operational report with extractable measurable evidence
     defaults to Monitoring unless the source explicitly proves a live failure.
   - Generic newsletters without a verified client do not become Monitoring.
   - Direct human requests and approvals retain the existing Requested Work path.
   - Compact client-name forms such as Northfloridasafes are normalized for
     backlog display without adding report-specific routing rules.
   ========================================================= */

import {
  evaluateExplicitHumanWorkRequest,
  inferClientFromText
} from "./gmailWorkRequestIntelligence.js";
import {
  extractMonitoringEvidence,
  formatMonitoringEvidence,
  buildMonitoringBusinessMeaning
} from "../shared/gmailMonitoringEvidence.js";

export const GMAIL_BACKLOG_INTELLIGENCE_VERSION = "1.0.0";

const REPORT_SIGNAL = /\b(ahrefs|semrush|search console|google analytics|analytics|youtube|site audit|position tracking|backlink audit|performance report|page indexing|merchant center|crawl|health score)\b/i;

const PROVEN_FAILURE_SIGNAL = new RegExp([
  "\\b(?:site|website|store|checkout|tracking|tag|pixel|deployment|build|feed|connection)\\s+(?:is\\s+)?(?:down|broken|failed|failing|not working)\\b",
  "\\b(?:not firing|not registering|validation failed|deployment failed|build failed|connection failed)\\b",
  "\\b(?:outage|critical failure|production failure|zero traffic|traffic dropped to zero|drops? to zero)\\b",
  "\\b(?:cannot|can't|unable to)\\s+(?:checkout|purchase|submit|connect|load|open)\\b"
].join("|"), "i");

const COMPACT_CLIENTS = Object.freeze([
  { compact:"southeastsafes", name:"Southeast Safes", code:"SES" },
  { compact:"a1actionsafeandlock", name:"A1 Action Safe & Lock", code:"A1" },
  { compact:"harrybeckwithgunsrange", name:"HB Guns", code:"HBG" },
  { compact:"harrybeckwithguns", name:"HB Guns", code:"HBG" },
  { compact:"hbguns", name:"HB Guns", code:"HBG" },
  { compact:"pickettweaponry", name:"Pickett Weaponry", code:"PW" },
  { compact:"northfloridasafes", name:"North Florida Safes", code:"NFS" },
  { compact:"southfloridasafes", name:"South Florida Safes", code:"SFS" },
  { compact:"moveasafe", name:"Move A Safe", code:"MAS" },
  { compact:"globalconceptsmedia", name:"Global Concepts Media", code:"GCM" },
  { compact:"lumistudiohouse", name:"LUMI", code:"LUMI" }
]);

export function classifyOperationalBacklogMessage(message = {}) {
  const text = `${clean(message.subject)}\n${clean(message.bodyText || message.snippet)}`;
  const work = evaluateExplicitHumanWorkRequest(message);
  const client = work.client || inferOperationalClient(text);
  const reportSignal = REPORT_SIGNAL.test(text);
  const monitoringEvidence = reportSignal ? extractMonitoringEvidence(message) : null;
  const provenFailure = PROVEN_FAILURE_SIGNAL.test(text);

  const monitorCandidate = Boolean(
    work.candidate !== true &&
    client &&
    reportSignal &&
    monitoringEvidence &&
    !provenFailure
  );

  const investigationCandidate = Boolean(
    work.candidate !== true &&
    provenFailure
  );

  let proposedRoute = "Manual Review";
  if (work.candidate === true) proposedRoute = "Requested Work";
  else if (investigationCandidate) proposedRoute = "Investigation Review";
  else if (monitorCandidate) proposedRoute = "Monitoring Review";

  const evidenceSummary = monitorCandidate
    ? formatMonitoringEvidence(monitoringEvidence)
    : "";

  const communicationFamily = work.role
    ? "Human — Operational Email"
    : reportSignal
      ? "Operational Report / Monitoring"
      : "Operational Email";

  const businessMeaning = work.businessImpact ||
    (monitorCandidate
      ? buildMonitoringBusinessMeaning(monitoringEvidence, client.name)
      : client
        ? `This ${client.name} email remains in an operational Gmail source and no GCM OS source record proves that it has been processed.`
        : "This email remains in an operational Gmail source and no verified client record proves where it belongs. Human review is required before creating operational history.");

  const recommendedAction = work.action ||
    (investigationCandidate
      ? "Review the live source evidence and create an Investigation only because the message explicitly proves a current operational failure whose corrective action is not yet established."
      : monitorCandidate
        ? "Save these exact source-grounded measurements as Monitoring. Escalate later only when comparison proves a meaningful adverse condition requiring action."
        : reportSignal && !client
          ? "Identify the correct client or prospect before preserving this report. Do not create Monitoring or Investigation from an unassigned report."
          : "Choose the correct disposition: Delete if it has no durable value, Keep as Information if it matters historically, or use a stronger route only when the source proves action is required.");

  const priority = work.priority || (investigationCandidate ? "High" : "Normal");

  return {
    gmailMessageId:message.gmailMessageId,
    threadId:message.threadId,
    from:message.from,
    to:message.to,
    subject:message.subject,
    date:message.date,
    snippet:evidenceSummary || message.snippet,
    bodyText:message.bodyText,
    labels:Array.isArray(message.labels) ? message.labels : [],
    read:!(Array.isArray(message.labels) && message.labels.includes("UNREAD")),
    intelligence:{
      communicationFamily,
      notificationType:work.candidate === true
        ? "direct_work_request"
        : reportSignal
          ? "operational_report"
          : "manual_review",
      client:client?.name || "Unassigned — Human Review",
      businessMeaning,
      operationalPriority:priority,
      recommendedAction,
      shouldCreateCommunication:Boolean(client),
      shouldCreateInvestigation:investigationCandidate,
      investigationCandidate,
      shouldCreateWorkItem:work.candidate === true,
      monitoringOnly:monitorCandidate,
      monitoringMetrics:monitorCandidate ? monitoringEvidence : null,
      evidenceSummary:evidenceSummary || null,
      archive:false,
      proposedRoute,
      confidence:client ? "High" : "Medium",
      decisionReliability:monitorCandidate
        ? "Source-grounded measurable evidence extracted before route selection"
        : "Backlog intake signal — authoritative approval re-validates the live email",
      evidenceSufficiency:monitorCandidate
        ? "Exact measurable facts were extracted from the live report; metric labels alone were not treated as proof of corrective work."
        : "Sufficient to require operator disposition; write route is re-verified at approval time",
      evidenceComparedAgainst:monitorCandidate
        ? "Current Gmail source preserved as the future comparison reference; no adverse delta is assumed from labels such as Errors or Issues alone."
        : "Current Gmail message ID compared with production Communication, monitoring, and open Decision Hold source references",
      verificationRequired:monitorCandidate
        ? "Human approval may save these exact facts as Monitoring. Create Investigation only if later evidence proves a material problem requiring diagnosis."
        : "Choose one explicit disposition. Do not treat Gmail read state as proof that the email was processed.",
      humanReviewRequired:true,
      productionDecisionReady:false,
      backlogIntelligenceVersion:GMAIL_BACKLOG_INTELLIGENCE_VERSION
    }
  };
}

export function inferOperationalClient(value) {
  const text = clean(value);
  const direct = inferClientFromText(text);
  if (direct) return direct;

  const compact = text.toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (const client of COMPACT_CLIENTS) {
    if (compact.includes(client.compact)) {
      return { name:client.name, code:client.code };
    }
  }
  return null;
}

function clean(value) {
  return String(value ?? "").trim();
}
