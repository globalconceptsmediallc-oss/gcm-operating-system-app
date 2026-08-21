/* =========================================================
   Global Concepts Media Operating System
   File: shared/gmailDecisionHold.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Gmail — Decision Hold / Work Lite
   Purpose:
   Provide source-agnostic decision-hold reasoning for communications that
   matter enough to preserve but are not yet ready for a final operational
   disposition. This module deliberately reasons from generic communication
   signals rather than platform-specific email rules.
   ========================================================= */

const MONTHS = Object.freeze({
  january:0,february:1,march:2,april:3,may:4,june:5,
  july:6,august:7,september:8,october:9,november:10,december:11
});

export function inferClientFromMessageContext(message = {}, inferClientFromText) {
  if (typeof inferClientFromText !== "function") return null;
  const orderedEvidence = [
    message.subject,
    message.bodyText,
    message.snippet,
    message.threadContext,
    `${message.to || ""}`,
    `${message.from || ""}`
  ];

  for (const value of orderedEvidence) {
    const match = inferClientFromText(clean(value));
    if (match) return match;
  }
  return null;
}

export function evaluateDecisionHold(message = {}, intelligence = {}, options = {}) {
  const subject = clean(message.subject);
  const body = clean(message.bodyText || message.snippet);
  const text = `${subject}\n${body}`;
  const clientName = clean(options.clientName || intelligence.client);
  const verifiedClient = Boolean(clientName) && !/unassigned|human review/i.test(clientName);

  const alreadyRouted = Boolean(
    intelligence.archive ||
    intelligence.monitoringOnly ||
    intelligence.shouldCreateInvestigation ||
    intelligence.shouldCreateWorkItem
  );

  const followUp = extractFollowUp(text);
  const requirement = extractFutureRequirement(text, options.now || new Date());
  const unresolvedManualReview = verifiedClient &&
    !alreadyRouted &&
    /manual review|human review|calibration required/i.test(clean(intelligence.proposedRoute));

  if (!verifiedClient || alreadyRouted || (!followUp && !requirement && !unresolvedManualReview)) {
    return { candidate:false };
  }

  const senderName = humanSenderName(message.from);
  const leadershipContext = /leadership|owner|decision maker|decision-maker|executive/i.test(
    `${clean(intelligence.communicationFamily)} ${clean(intelligence.notificationType)}`
  );

  if (followUp) {
    return {
      candidate:true,
      holdType:"follow_up",
      priority:leadershipContext ? "High" : "Normal",
      question:`What evidence or results are now available, and what update should be sent back${senderName ? ` to ${senderName}` : ""}?`,
      whyItMatters:`The communication creates a future follow-up expectation without proving that immediate corrective Work or an Investigation is required.`,
      suggestedNextAction:`Park this as Work Lite, continue higher-priority processing, then review the relevant results and provide the requested update when meaningful evidence is available.`,
      dueDate:null,
      reviewOn:null,
      signal:followUp
    };
  }

  if (requirement) {
    const priority = priorityForFutureDate(requirement.date, options.now || new Date());
    return {
      candidate:true,
      holdType:"decision_question",
      priority,
      question:`Does the current ${clientName} implementation already satisfy this requirement before ${requirement.label}?`,
      whyItMatters:`A future requirement or deadline is real, but the communication alone does not prove whether any client change is actually required.`,
      suggestedNextAction:`Park this as Work Lite until there is time to compare the requirement against the current client implementation. If the requirement is already satisfied, no operational work should be created.`,
      dueDate:requirement.isoDate,
      reviewOn:null,
      signal:requirement.text
    };
  }

  return {
    candidate:true,
    holdType:"decision_question",
    priority:leadershipContext ? "High" : "Low",
    question:"What decision-critical fact is still missing before this communication can be given a final disposition?",
    whyItMatters:"The source matters, but the current evidence does not yet justify Work, Investigation, Monitoring, Information, or Delete with confidence.",
    suggestedNextAction:"Park this as Work Lite and continue processing. Return when the missing fact can be verified without interrupting higher-priority work.",
    dueDate:null,
    reviewOn:null,
    signal:"manual_review"
  };
}

export function buildDecisionHoldBusinessMeaning(plan, clientName) {
  if (!plan?.candidate) return "";
  const client = clean(clientName) || "Client";
  if (plan.holdType === "follow_up") {
    return `${client}: a future follow-up obligation was created, but no immediate corrective work is proven. Preserve the source and park the follow-up until meaningful evidence is available.`;
  }
  if (plan.dueDate) {
    return `${client}: a future requirement/deadline was identified, but impact on the current implementation is not yet proven. Preserve the source and answer the blocking question before creating work.`;
  }
  return `${client}: the communication has durable value, but one decision-critical fact is still missing. Preserve it as a Decision Hold rather than inventing work.`;
}

function extractFollowUp(value) {
  const text = clean(value);
  const patterns = [
    /\bkeep\s+(?:me|us)\s+posted\b/i,
    /\bkeep\s+(?:me|us)\s+informed\b/i,
    /\blet\s+(?:me|us)\s+know\s+how\b/i,
    /\b(?:send|give)\s+(?:me|us)\s+an?\s+update\b/i,
    /\b(?:please\s+)?(?:follow up|follow-up|circle back|check back)\b/i,
    /\bupdate\s+(?:me|us)\s+(?:when|once|after)\b/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return clean(match[0]);
  }
  return "";
}

function extractFutureRequirement(value, now) {
  const text = clean(value);
  if (!/\b(must|required|requirement|requirements|effective|starting|beginning|deadline|no later than|by)\b/i.test(text)) {
    return null;
  }

  const dateMatch = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})\b/i
  );
  if (!dateMatch) return null;

  const month = MONTHS[dateMatch[1].toLowerCase()];
  const day = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const date = new Date(Date.UTC(year, month, day));
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime()) || Number.isNaN(current.getTime()) || date <= current) return null;

  return {
    text:dateMatch[0],
    label:`${dateMatch[1]} ${day}, ${year}`,
    isoDate:`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    date
  };
}

function priorityForFutureDate(date, now) {
  const current = now instanceof Date ? now : new Date(now);
  const days = Math.ceil((date.getTime() - current.getTime()) / 86400000);
  if (days <= 30) return "High";
  if (days <= 90) return "Normal";
  return "Low";
}

function humanSenderName(value) {
  const sender = clean(value);
  if (!sender) return "";
  const angle = sender.match(/^\s*([^<]+?)\s*</);
  if (angle?.[1]) return titleCase(clean(angle[1]).replace(/^['"]|['"]$/g, ""));
  const email = sender.match(/([A-Z0-9._%+-]+)@/i)?.[1] || "";
  const local = email.split(/[._-]+/)[0] || "";
  return local ? titleCase(local) : "";
}

function titleCase(value) {
  return clean(value).replace(/\b\w/g, character => character.toUpperCase());
}

function clean(value) {
  return String(value ?? "").trim();
}
