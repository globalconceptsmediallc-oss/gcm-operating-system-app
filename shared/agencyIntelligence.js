/* =========================================================
   Global Concepts Media Operating System
   File: shared/agencyIntelligence.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Source: Agency Intelligence Sprint
   Sprint: Deterministic Agency Understanding — Stage 1
   Purpose:
   Convert supplied agency operating state into continuity, priorities,
   monitoring, trends, hidden gaps, growth risks, and a short recommended
   sequence for Agency Command and future Morning Brief surfaces.

   SAFETY / SCOPE
   - Read-only.
   - Creates no Communication, Investigation, Work Item, Proof,
     Media, Prospect, Calendar, or D1 record.
   - Uses only context explicitly supplied by the caller.
   - Does not claim to read Gmail, Calendar, D1, the web, or external tools.
   - Separates facts, inferred patterns, and recommendations.
   ========================================================= */

export const AGENCY_INTELLIGENCE_VERSION = "1.0.0";

const DEFAULT_OPTIONS = Object.freeze({
  maxNeedsAttention: 10,
  maxMonitoring: 15,
  maxAlreadyHandled: 15,
  maxTrends: 10,
  maxGaps: 10,
  maxGrowthRisks: 8,
  maxOpportunities: 8,
  maxRecommendedSequence: 5,
  prospectingWarningDays: 3,
  prospectingCriticalDays: 7,
  staleProofDays: 14,
  staleClientTouchDays: 14,
  recurringIssueThreshold: 3,
  volatileKeywordThreshold: 4
});

/**
 * Analyze supplied operating context and return one stable intelligence object.
 *
 * @param {Object} context
 * @param {Object} [options]
 * @returns {Object}
 */
export function buildAgencyIntelligence(context = {}, options = {}) {
  const startedAt = Date.now();
  const settings = {
    ...DEFAULT_OPTIONS,
    ...(options && typeof options === "object" ? options : {})
  };

  const normalized = normalizeAgencyIntelligenceContext(context);

  const intelligence = {
    schemaVersion: "1.0",
    engine: "agency-intelligence",
    engineVersion: AGENCY_INTELLIGENCE_VERSION,
    generatedAt: new Date().toISOString(),

    continuity: [],
    needsAttention: [],
    alreadyHandled: [],
    monitoring: [],
    trends: [],
    hiddenGaps: [],
    growthRisks: [],
    opportunities: [],
    recommendedSequence: [],
    nextBestAction: null,

    confidence: 0,
    limitations: [],
    diagnostics: {
      executionTimeMs: 0,
      sourceCounts: summarizeSourceCounts(normalized),
      rulesApplied: [],
      factsReviewed: 0
    }
  };

  analyzeCommunications(normalized, intelligence, settings);
  analyzeWork(normalized, intelligence, settings);
  analyzeDeadlinesAndCalendar(normalized, intelligence, settings);
  analyzeMedia(normalized, intelligence, settings);
  analyzeProspecting(normalized, intelligence, settings);
  analyzeHistoricalSignals(normalized, intelligence, settings);
  analyzeClientState(normalized, intelligence, settings);
  analyzeProofState(normalized, intelligence, settings);
  analyzeAgencyNotes(normalized, intelligence);

  finalizeAgencyIntelligence(intelligence, normalized, settings);

  intelligence.diagnostics.executionTimeMs = Date.now() - startedAt;

  return intelligence;
}

/**
 * Normalize all supported caller context into one stable contract.
 *
 * @param {Object} value
 * @returns {Object}
 */
export function normalizeAgencyIntelligenceContext(value = {}) {
  const input = value && typeof value === "object" ? value : {};

  return {
    communications: normalizeObjectArray(input.communications),
    investigations: normalizeObjectArray(input.investigations),
    work: normalizeObjectArray(input.work),
    proof: normalizeObjectArray(input.proof || input.proofRecords),
    deadlines: normalizeObjectArray(input.deadlines),
    calendar: normalizeObjectArray(input.calendar),
    media: normalizeObjectArray(input.media),
    prospects: normalizeObjectArray(input.prospects),
    clients: normalizeObjectArray(input.clients),
    historicalSignals: normalizeObjectArray(
      input.historicalSignals || input.historical_signals
    ),
    keywordSignals: normalizeObjectArray(
      input.keywordSignals || input.keyword_signals
    ),
    siteAuditSignals: normalizeObjectArray(
      input.siteAuditSignals || input.site_audit_signals
    ),
    prospecting: normalizeProspecting(input.prospecting),
    notes: normalizeStringArray(input.notes),
    now: normalizeDate(input.now) || new Date().toISOString()
  };
}

function analyzeCommunications(context, intelligence, settings) {
  for (const communication of context.communications) {
    intelligence.diagnostics.factsReviewed += 1;

    const status = normalizeStatus(
      communication.status ||
      communication.processingStatus ||
      communication.processing_status
    );

    const subject = firstText(
      communication.subject,
      communication.title,
      communication.summary,
      "Communication"
    );

    const client = firstText(
      communication.clientName,
      communication.client_name,
      communication.client
    );

    const label = client ? `${client} — ${subject}` : subject;

    if (isHandledStatus(status) || communication.alreadyHandled === true) {
      intelligence.alreadyHandled.push({
        type: "communication",
        title: label,
        reason: firstText(
          communication.handledReason,
          communication.handled_reason,
          communication.reason,
          "Already reviewed or recorded."
        ),
        sourceId: normalizeId(communication.id),
        sourceStatus: status || "handled"
      });

      intelligence.continuity.push(
        `${label} is already handled and should not be processed again.`
      );

      intelligence.diagnostics.rulesApplied.push("communication_already_handled");
      continue;
    }

    if (
      status === "monitoring" ||
      status === "monitor" ||
      communication.monitoring === true
    ) {
      intelligence.monitoring.push({
        type: "communication",
        title: label,
        reason: firstText(
          communication.reason,
          communication.summary,
          "Monitoring evidence; no specific work is established."
        ),
        sourceId: normalizeId(communication.id)
      });

      intelligence.diagnostics.rulesApplied.push("communication_monitoring");
      continue;
    }

    if (
      communication.needsAttention === true ||
      communication.needs_attention === true ||
      ["needs_attention", "action_required", "reply_required"].includes(status)
    ) {
      intelligence.needsAttention.push({
        priority: normalizePriority(communication.priority || "medium"),
        type: "communication",
        title: label,
        reason: firstText(
          communication.reason,
          communication.attentionReason,
          communication.attention_reason,
          "The supplied context marks this communication as requiring attention."
        ),
        workspace: "communications",
        sourceId: normalizeId(communication.id)
      });

      intelligence.diagnostics.rulesApplied.push("communication_needs_attention");
    }
  }
}

function analyzeWork(context, intelligence, settings) {
  for (const item of context.work) {
    intelligence.diagnostics.factsReviewed += 1;

    const status = normalizeStatus(item.status);
    const title = firstText(item.title, item.summary, item.activity, "Work item");

    if (["completed", "verified", "cancelled", "canceled"].includes(status)) {
      if (["completed", "verified"].includes(status)) {
        intelligence.continuity.push(
          `${title} is ${status} and should not be recreated.`
        );
      }
      continue;
    }

    if (["blocked", "awaiting_access", "awaiting_client"].includes(status)) {
      intelligence.needsAttention.push({
        priority: "high",
        type: "work",
        title,
        reason: firstText(
          item.reason,
          item.blocker,
          `Work is ${status.replaceAll("_", " ")}.`
        ),
        workspace: "work",
        sourceId: normalizeId(item.id)
      });

      intelligence.hiddenGaps.push({
        type: "blocked_work",
        title,
        observation: `This work cannot progress because it is ${status.replaceAll("_", " ")}.`,
        recommendation: "Resolve or explicitly defer the blocker before adding duplicate work."
      });

      intelligence.diagnostics.rulesApplied.push("blocked_work");
      continue;
    }

    if (status === "awaiting_verification") {
      intelligence.needsAttention.push({
        priority: "high",
        type: "verification",
        title,
        reason: firstText(
          item.reason,
          "Implementation is complete but verification is still required."
        ),
        workspace: "work",
        sourceId: normalizeId(item.id)
      });

      intelligence.diagnostics.rulesApplied.push("work_awaiting_verification");
      continue;
    }

    if (status) {
      intelligence.needsAttention.push({
        priority: normalizePriority(item.priority || "medium"),
        type: "work",
        title,
        reason: firstText(item.reason, `Work status: ${status.replaceAll("_", " ")}.`),
        workspace: "work",
        sourceId: normalizeId(item.id)
      });

      intelligence.diagnostics.rulesApplied.push("open_work");
    }
  }
}

function analyzeDeadlinesAndCalendar(context, intelligence, settings) {
  const now = new Date(context.now);

  for (const deadline of context.deadlines) {
    intelligence.diagnostics.factsReviewed += 1;

    const title = firstText(deadline.title, deadline.summary, "Upcoming deadline");
    const due = normalizeDate(deadline.due || deadline.dueAt || deadline.due_at);
    const daysUntil = daysBetween(now, due);

    intelligence.needsAttention.push({
      priority: daysUntil !== null && daysUntil <= 1 ? "critical" : "high",
      type: "deadline",
      title,
      reason: due
        ? `Due ${formatDate(due)}${daysUntil !== null ? ` (${formatDaysUntil(daysUntil)})` : ""}.`
        : firstText(deadline.reason, "A supplied deadline requires scheduling."),
      workspace: "today",
      sourceId: normalizeId(deadline.id)
    });

    intelligence.diagnostics.rulesApplied.push("deadline_attention");
  }

  for (const event of context.calendar) {
    intelligence.diagnostics.factsReviewed += 1;

    const title = firstText(event.title, event.summary, "Calendar commitment");
    const start = normalizeDate(event.start || event.startAt || event.start_at);
    const daysUntil = daysBetween(now, start);

    if (daysUntil !== null && daysUntil <= 2) {
      intelligence.needsAttention.push({
        priority: daysUntil <= 0 ? "high" : "medium",
        type: "calendar",
        title,
        reason: start
          ? `Scheduled ${formatDate(start)}.`
          : "Upcoming calendar commitment.",
        workspace: "today",
        sourceId: normalizeId(event.id)
      });

      intelligence.diagnostics.rulesApplied.push("calendar_near_term");
    }
  }
}

function analyzeMedia(context, intelligence, settings) {
  for (const item of context.media) {
    intelligence.diagnostics.factsReviewed += 1;

    const status = normalizeStatus(item.status || item.attentionStatus || item.attention_status);
    const title = firstText(
      item.title,
      [item.station, item.spotName || item.spot_name].filter(Boolean).join(" — "),
      "Media item"
    );

    if (
      item.needsAttention === true ||
      item.needs_attention === true ||
      ["needs_attention", "awaiting_confirmation", "missing_production"].includes(status)
    ) {
      intelligence.needsAttention.push({
        priority: normalizePriority(item.priority || "high"),
        type: "media",
        title,
        reason: firstText(
          item.reason,
          item.attentionReason,
          item.attention_reason,
          status ? `Media status: ${status.replaceAll("_", " ")}.` : "Media follow-up is required."
        ),
        workspace: "media",
        sourceId: normalizeId(item.id)
      });

      intelligence.diagnostics.rulesApplied.push("media_needs_attention");
      continue;
    }

    if (["clear", "confirmed", "completed", "active"].includes(status)) {
      intelligence.continuity.push(
        `${title} is ${status} and does not require duplicate handling.`
      );
    }
  }
}

function analyzeProspecting(context, intelligence, settings) {
  const days = context.prospecting.daysSinceLastActivity;

  if (days >= settings.prospectingCriticalDays) {
    intelligence.growthRisks.push({
      severity: "critical",
      title: "Prospecting gap",
      observation: `No prospecting activity is supplied for ${days} days.`,
      businessRisk: "The future sales pipeline may weaken if outreach continues to be deferred.",
      recommendation: "Protect a prospecting block today before optional internal work."
    });

    intelligence.needsAttention.push({
      priority: "high",
      type: "growth",
      title: "Resume prospecting",
      reason: `Prospecting has not been recorded for ${days} days.`,
      workspace: "prospects",
      sourceId: null
    });

    intelligence.diagnostics.rulesApplied.push("prospecting_critical_gap");
  } else if (days >= settings.prospectingWarningDays) {
    intelligence.growthRisks.push({
      severity: "warning",
      title: "Prospecting is slipping",
      observation: `No prospecting activity is supplied for ${days} days.`,
      businessRisk: "Client delivery may consume all available time and leave future production underdeveloped.",
      recommendation: "Schedule a focused prospecting block today."
    });

    intelligence.needsAttention.push({
      priority: "medium",
      type: "growth",
      title: "Protect prospecting time",
      reason: `Prospecting has not been recorded for ${days} days.`,
      workspace: "prospects",
      sourceId: null
    });

    intelligence.diagnostics.rulesApplied.push("prospecting_warning_gap");
  }
}

function analyzeHistoricalSignals(context, intelligence, settings) {
  for (const signal of context.historicalSignals) {
    intelligence.diagnostics.factsReviewed += 1;

    const type = normalizeStatus(signal.type || signal.signalType || signal.signal_type);
    const title = firstText(signal.title, signal.label, signal.summary, "Historical signal");
    const observation = firstText(signal.observation, signal.pattern, signal.summary);
    const recommendation = firstText(signal.recommendation, signal.nextStep, signal.next_step);

    if (signal.needsAttention === true || signal.needs_attention === true) {
      intelligence.needsAttention.push({
        priority: normalizePriority(signal.priority || "medium"),
        type: type || "historical_signal",
        title,
        reason: observation || "Historical pattern requires review.",
        workspace: firstText(signal.workspace, "today"),
        sourceId: normalizeId(signal.id)
      });
    }

    if (observation) {
      intelligence.trends.push({
        type: type || "historical_signal",
        title,
        observation,
        evidenceCount: normalizeNonNegativeNumber(
          signal.evidenceCount || signal.evidence_count
        ),
        period: firstText(signal.period),
        recommendation
      });
    }

    if (signal.gap || signal.hiddenGap || signal.hidden_gap) {
      intelligence.hiddenGaps.push({
        type: type || "historical_gap",
        title,
        observation: firstText(
          signal.gap,
          signal.hiddenGap,
          signal.hidden_gap
        ),
        recommendation
      });
    }
  }

  for (const keyword of context.keywordSignals) {
    intelligence.diagnostics.factsReviewed += 1;

    const name = firstText(keyword.keyword, keyword.title, "Keyword");
    const movementCount = normalizeNonNegativeNumber(
      keyword.movementCount ||
      keyword.movement_count ||
      keyword.alertCount ||
      keyword.alert_count
    );
    const moneyKeyword = normalizeBoolean(
      keyword.moneyKeyword ?? keyword.money_keyword
    );
    const direction = normalizeStatus(keyword.direction || keyword.trend);

    if (movementCount >= settings.volatileKeywordThreshold) {
      intelligence.trends.push({
        type: "keyword_volatility",
        title: name,
        observation: `${name} has moved ${movementCount} times during the supplied monitoring period.`,
        evidenceCount: movementCount,
        period: firstText(keyword.period),
        recommendation: moneyKeyword === false
          ? "Review whether this low-value keyword should remain on the active monitoring list."
          : "Review the pattern, business value, competitive movement, and landing-page support before deciding on work."
      });

      intelligence.diagnostics.rulesApplied.push("keyword_volatility");
    }

    if (moneyKeyword === false && movementCount > 0) {
      intelligence.hiddenGaps.push({
        type: "keyword_monitoring_quality",
        title: name,
        observation: `${name} is identified as a non-money keyword but continues to generate monitoring activity.`,
        recommendation: "Consider removing or reducing monitoring and replace it with higher-intent industry terms."
      });

      intelligence.diagnostics.rulesApplied.push("non_money_keyword_monitoring");
    }

    if (
      moneyKeyword === true &&
      ["up", "improving", "rising"].includes(direction)
    ) {
      intelligence.opportunities.push({
        type: "keyword_opportunity",
        title: name,
        observation: `${name} is identified as a money keyword with an improving trend.`,
        recommendation: "Evaluate whether supporting content or on-page improvements could accelerate movement."
      });

      intelligence.diagnostics.rulesApplied.push("money_keyword_opportunity");
    }
  }

  for (const audit of context.siteAuditSignals) {
    intelligence.diagnostics.factsReviewed += 1;

    const title = firstText(audit.title, audit.issue, "Site Audit issue");
    const occurrenceCount = normalizeNonNegativeNumber(
      audit.occurrenceCount ||
      audit.occurrence_count ||
      audit.repeatCount ||
      audit.repeat_count
    );

    if (occurrenceCount >= settings.recurringIssueThreshold) {
      intelligence.trends.push({
        type: "recurring_site_issue",
        title,
        observation: `${title} has appeared ${occurrenceCount} times in the supplied audit history.`,
        evidenceCount: occurrenceCount,
        period: firstText(audit.period),
        recommendation: "Determine whether prior work was incomplete, verification failed, or the issue is being regenerated."
      });

      intelligence.needsAttention.push({
        priority: normalizePriority(audit.priority || "high"),
        type: "recurring_site_issue",
        title,
        reason: `The issue has recurred ${occurrenceCount} times.`,
        workspace: "investigations",
        sourceId: normalizeId(audit.id)
      });

      intelligence.diagnostics.rulesApplied.push("recurring_site_audit_issue");
    }
  }
}

function analyzeClientState(context, intelligence, settings) {
  const now = new Date(context.now);

  for (const client of context.clients) {
    intelligence.diagnostics.factsReviewed += 1;

    const name = firstText(client.name, client.clientName, client.client_name, "Client");
    const lastTouch = normalizeDate(
      client.lastTouchAt ||
      client.last_touch_at ||
      client.lastCommunicationAt ||
      client.last_communication_at
    );
    const daysSinceTouch = daysBetween(lastTouch, now);

    if (
      daysSinceTouch !== null &&
      daysSinceTouch >= settings.staleClientTouchDays
    ) {
      intelligence.hiddenGaps.push({
        type: "client_touch_gap",
        title: name,
        observation: `No client touchpoint is supplied for approximately ${Math.floor(daysSinceTouch)} days.`,
        recommendation: "Review whether the client needs an update, proof email, or strategic conversation."
      });

      intelligence.diagnostics.rulesApplied.push("stale_client_touch");
    }

    if (client.salesRisk === true || client.sales_risk === true) {
      intelligence.needsAttention.push({
        priority: "critical",
        type: "client_business_risk",
        title: name,
        reason: firstText(
          client.salesRiskReason,
          client.sales_risk_reason,
          "The supplied context identifies a client business risk."
        ),
        workspace: "clients",
        sourceId: normalizeId(client.id)
      });

      intelligence.diagnostics.rulesApplied.push("client_sales_risk");
    }
  }
}

function analyzeProofState(context, intelligence, settings) {
  const now = new Date(context.now);

  for (const item of context.proof) {
    intelligence.diagnostics.factsReviewed += 1;

    const client = firstText(item.clientName, item.client_name, item.client, "Client");
    const lastProofAt = normalizeDate(
      item.lastProofAt ||
      item.last_proof_at ||
      item.sentAt ||
      item.sent_at
    );
    const daysSinceProof = daysBetween(lastProofAt, now);

    if (
      daysSinceProof !== null &&
      daysSinceProof >= settings.staleProofDays
    ) {
      intelligence.hiddenGaps.push({
        type: "proof_gap",
        title: client,
        observation: `No recent Proof communication is supplied for approximately ${Math.floor(daysSinceProof)} days.`,
        recommendation: "Review completed and verified work and determine whether a client update is due."
      });

      intelligence.diagnostics.rulesApplied.push("stale_proof_gap");
    }
  }
}

function analyzeAgencyNotes(context, intelligence) {
  for (const note of context.notes) {
    intelligence.diagnostics.factsReviewed += 1;
    intelligence.continuity.push(note);
  }
}

function finalizeAgencyIntelligence(intelligence, context, settings) {
  intelligence.continuity = uniqueStrings(intelligence.continuity)
    .slice(0, 30);

  intelligence.alreadyHandled = dedupeObjectItems(
    intelligence.alreadyHandled,
    item => `${item.type}|${item.title}`
  ).slice(0, settings.maxAlreadyHandled);

  intelligence.monitoring = dedupeObjectItems(
    intelligence.monitoring,
    item => `${item.type}|${item.title}`
  ).slice(0, settings.maxMonitoring);

  intelligence.needsAttention = dedupeObjectItems(
    intelligence.needsAttention,
    item => `${item.type}|${item.title}`
  )
    .sort(comparePriority)
    .slice(0, settings.maxNeedsAttention);

  intelligence.trends = dedupeObjectItems(
    intelligence.trends,
    item => `${item.type}|${item.title}|${item.observation}`
  ).slice(0, settings.maxTrends);

  intelligence.hiddenGaps = dedupeObjectItems(
    intelligence.hiddenGaps,
    item => `${item.type}|${item.title}|${item.observation}`
  ).slice(0, settings.maxGaps);

  intelligence.growthRisks = dedupeObjectItems(
    intelligence.growthRisks,
    item => `${item.title}|${item.observation}`
  ).slice(0, settings.maxGrowthRisks);

  intelligence.opportunities = dedupeObjectItems(
    intelligence.opportunities,
    item => `${item.type}|${item.title}|${item.observation}`
  ).slice(0, settings.maxOpportunities);

  intelligence.recommendedSequence = buildRecommendedSequence(
    intelligence,
    settings
  );

  intelligence.nextBestAction =
    intelligence.recommendedSequence[0] ||
    "Review the supplied agency context and select one bounded next action.";

  const sourceCounts = intelligence.diagnostics.sourceCounts;
  const sourceTotal = Object.values(sourceCounts)
    .reduce((sum, value) => sum + value, 0);

  intelligence.limitations = [];

  if (!sourceTotal) {
    intelligence.limitations.push(
      "No agency operating context was supplied. Intelligence cannot truthfully identify what is handled, due, blocked, trending, or missing."
    );
  }

  if (!context.calendar.length) {
    intelligence.limitations.push(
      "No Calendar context was supplied."
    );
  }

  if (!context.communications.length) {
    intelligence.limitations.push(
      "No Communications context was supplied."
    );
  }

  if (!context.keywordSignals.length) {
    intelligence.limitations.push(
      "No multi-period keyword history was supplied, so keyword volatility and money-keyword gaps cannot be evaluated."
    );
  }

  intelligence.confidence = calculateConfidence({
    sourceTotal,
    factsReviewed: intelligence.diagnostics.factsReviewed,
    limitationCount: intelligence.limitations.length
  });

  intelligence.diagnostics.rulesApplied = uniqueStrings(
    intelligence.diagnostics.rulesApplied
  );
}

function buildRecommendedSequence(intelligence, settings) {
  const sequence = [];

  const critical = intelligence.needsAttention
    .filter(item => item.priority === "critical");

  const high = intelligence.needsAttention
    .filter(item => item.priority === "high");

  const growth = intelligence.needsAttention
    .filter(item => item.type === "growth");

  if (critical[0]) {
    sequence.push(`Address first: ${critical[0].title}.`);
  } else if (high[0]) {
    sequence.push(`Address first: ${high[0].title}.`);
  } else if (intelligence.needsAttention[0]) {
    sequence.push(`Review first: ${intelligence.needsAttention[0].title}.`);
  }

  if (high[1]) {
    sequence.push(`Then address: ${high[1].title}.`);
  }

  if (
    growth[0] &&
    !sequence.some(item => item.includes(growth[0].title))
  ) {
    sequence.push(`Protect growth time: ${growth[0].title}.`);
  }

  if (intelligence.hiddenGaps[0]) {
    sequence.push(
      `Review hidden gap: ${intelligence.hiddenGaps[0].title}.`
    );
  }

  if (intelligence.opportunities[0]) {
    sequence.push(
      `Consider opportunity: ${intelligence.opportunities[0].title}.`
    );
  }

  if (!sequence.length && intelligence.monitoring.length) {
    sequence.push(
      "No immediate action is established; maintain monitoring and protect time for growth."
    );
  }

  if (!sequence.length) {
    sequence.push(
      "Select one bounded client, growth, or operational objective for the next work block."
    );
  }

  return uniqueStrings(sequence)
    .slice(0, settings.maxRecommendedSequence);
}

function summarizeSourceCounts(context) {
  return {
    communications: context.communications.length,
    investigations: context.investigations.length,
    work: context.work.length,
    proof: context.proof.length,
    deadlines: context.deadlines.length,
    calendar: context.calendar.length,
    media: context.media.length,
    prospects: context.prospects.length,
    clients: context.clients.length,
    historicalSignals: context.historicalSignals.length,
    keywordSignals: context.keywordSignals.length,
    siteAuditSignals: context.siteAuditSignals.length,
    notes: context.notes.length
  };
}

function calculateConfidence({
  sourceTotal,
  factsReviewed,
  limitationCount
}) {
  if (!sourceTotal) return 0.2;

  const sourceScore = Math.min(0.45, sourceTotal * 0.025);
  const factScore = Math.min(0.35, factsReviewed * 0.015);
  const limitationPenalty = Math.min(0.25, limitationCount * 0.05);

  return clampNumber(
    0.35 + sourceScore + factScore - limitationPenalty,
    0.2,
    0.98
  );
}

function comparePriority(a, b) {
  const rank = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  };

  return (rank[a.priority] ?? 4) - (rank[b.priority] ?? 4);
}

function normalizePriority(value) {
  const status = normalizeStatus(value);

  if (["critical", "urgent"].includes(status)) return "critical";
  if (["high", "important"].includes(status)) return "high";
  if (["low", "minor"].includes(status)) return "low";

  return "medium";
}

function isHandledStatus(status) {
  return [
    "processed",
    "recorded",
    "saved",
    "completed",
    "closed",
    "historical",
    "historical_record",
    "no_action"
  ].includes(status);
}

function normalizeProspecting(value) {
  const input = value && typeof value === "object" ? value : {};

  return {
    daysSinceLastActivity: normalizeNonNegativeNumber(
      input.daysSinceLastActivity ??
      input.days_since_last_activity
    ),
    lastActivityAt: normalizeDate(
      input.lastActivityAt ||
      input.last_activity_at
    )
  };
}

function normalizeObjectArray(value) {
  return Array.isArray(value)
    ? value
      .filter(item => item && typeof item === "object")
      .slice(0, 500)
    : [];
}

function normalizeStringArray(value) {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return uniqueStrings(source).slice(0, 100);
}

function uniqueStrings(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const result = [];

  for (const item of source) {
    const text = cleanText(item);
    const key = text.toLowerCase();

    if (!text || seen.has(key)) continue;

    seen.add(key);
    result.push(text);
  }

  return result;
}

function dedupeObjectItems(items, keyBuilder) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;

    const key = cleanText(keyBuilder(item)).toLowerCase();

    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(item);
  }

  return result;
}

function normalizeStatus(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeId(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : cleanText(value) || null;
}

function normalizeDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function normalizeNonNegativeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? number
    : 0;
}

function normalizeBoolean(value) {
  if (value === true || value === false) return value;

  const text = cleanText(value).toLowerCase();

  if (["true", "yes", "1"].includes(text)) return true;
  if (["false", "no", "0"].includes(text)) return false;

  return null;
}

function firstText(...values) {
  for (const value of values) {
    const text = cleanText(value);

    if (text) return text;
  }

  return "";
}

function cleanText(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}

function daysBetween(first, second) {
  if (!first || !second) return null;

  const firstDate = new Date(first);
  const secondDate = new Date(second);

  if (
    Number.isNaN(firstDate.getTime()) ||
    Number.isNaN(secondDate.getTime())
  ) {
    return null;
  }

  return (
    secondDate.getTime() - firstDate.getTime()
  ) / 86400000;
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return cleanText(value);

  return date.toISOString().slice(0, 10);
}

function formatDaysUntil(days) {
  if (days < 0) return `${Math.abs(Math.floor(days))} days overdue`;
  if (days < 1) return "due today";
  if (days < 2) return "due tomorrow";

  return `due in ${Math.ceil(days)} days`;
}

function clampNumber(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
