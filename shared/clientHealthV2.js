/* =========================================================
   Global Concepts Media Operating System
   File: shared/clientHealthV2.js
   Version: 2.2.0
   Status: Production Candidate
   Sprint: Client Health v2 — Explainable Scoring Refinement
   Purpose:
   Convert durable client operating history into one explainable health score
   with confidence, trend, category detail, and a client-safe summary layer.

   Production rules:
   - Unknown evidence does NOT reduce health; it reduces confidence.
   - No AI is required. Every score is deterministic and auditable.
   - Open Work is not automatically positive or negative.
   - Priority labels never count as performance evidence.
   - Stale evidence has less scoring influence and less confidence.
   - One source record may affect at most two health dimensions.
   - Business Performance requires actual outcome evidence, not plans or goals.
   - Client-safe output never exposes raw email/thread text.
   ========================================================= */

export const CLIENT_HEALTH_V2_VERSION = "2.2.0";

const DIMENSIONS = Object.freeze([
  {
    key:"business_performance",
    label:"Business Performance",
    weight:1.25,
    patterns:[
      /\brevenue\b/i, /\bsales?\b/i, /\bleads?\b/i, /\broi\b/i,
      /\broas\b/i, /\bcpa\b/i, /\bcost per (?:lead|acquisition)\b/i,
      /\bconversion rate\b/i, /\bqualified leads?\b/i,
      /\bshowroom traffic\b/i, /\bpurchases?\b/i, /\borders?\b/i
    ]
  },
  {
    key:"search_visibility",
    label:"Search Visibility",
    weight:1.15,
    patterns:[
      /\bsemrush\b/i, /\bposition tracking\b/i, /\bkeyword/i,
      /\brank(?:ing|ings)?\b/i, /\bsearch visibility\b/i,
      /\borganic (?:traffic|visibility|clicks|impressions)\b/i,
      /\bsearch console\b/i, /\btop 10\b/i, /\btop 3\b/i
    ]
  },
  {
    key:"website_conversion",
    label:"Website / Conversion",
    weight:1.05,
    patterns:[
      /\bsite health\b/i, /\bcore web vitals?\b/i, /\bcrawl/i,
      /\bredirect/i, /\b4xx\b/i, /\b404\b/i, /\bduplicate content\b/i,
      /\bmeta description\b/i, /\bcanonical\b/i, /\bsitemap\b/i,
      /\bpage speed\b/i, /\bpage indexing\b/i, /\bindexing issue\b/i,
      /\blanding page\b/i, /\bcheckout\b/i, /\badd to cart\b/i,
      /\bview item\b/i, /\bshopify\b/i
    ]
  },
  {
    key:"analytics_measurement",
    label:"Analytics / Measurement",
    weight:1.0,
    patterns:[
      /\bga4\b/i, /\bgoogle analytics\b/i, /\bgtm\b/i,
      /\bgoogle tag\b/i, /\battribution\b/i, /\bmeasurement\b/i,
      /\bconversion action/i, /\brealtime\b/i, /\bdata collection\b/i
    ]
  },
  {
    key:"reputation",
    label:"Reputation",
    weight:0.8,
    patterns:[
      /\breviews?\b/i, /\brating\b/i, /\breputation\b/i,
      /\bgoogle business profile\b/i, /\bgoogle profile\b/i,
      /\bjudge\.me\b/i
    ]
  },
  {
    key:"marketing_activity",
    label:"Marketing Activity",
    weight:1.0,
    patterns:[
      /\bgoogle ads\b/i, /\bfacebook\b/i, /\binstagram\b/i,
      /\bconnected tv\b/i, /\bctv\b/i, /\bradio\b/i,
      /\bmedia buy\b/i, /\bpaid media\b/i, /\bpromotion\b/i,
      /\bcampaign\b/i, /\blabor day sale\b/i
    ]
  },
  {
    key:"competitive_position",
    label:"Competitive Position",
    weight:0.75,
    patterns:[
      /\bcompetitor/i, /\bcompetitive benchmark\b/i,
      /\bmarket share\b/i, /\bshare of voice\b/i,
      /\bvisibility (?:vs|versus|among)\b/i, /\btracked competitors\b/i
    ]
  },
  {
    key:"advantage_coverage",
    label:"Advantage Coverage",
    weight:0.75,
    patterns:[
      /\bservice area\b/i, /\bmarket coverage\b/i,
      /\bgeographic (?:coverage|targeting)\b/i, /\bgeo targeting\b/i,
      /\blake nona\b/i, /\bnarcoossee\b/i, /\borlando\b/i,
      /\bmelbourne\b/i, /\bproduct coverage\b/i, /\bcategory coverage\b/i
    ]
  },
  {
    key:"risk_attention",
    label:"Risk / Attention",
    weight:1.2,
    patterns:[
      /\brisk\b/i, /\bneeds attention\b/i, /\bhold\b/i,
      /\bblocked\b/i, /\bbroken\b/i, /\berrors?\b/i,
      /\bfailed\b/i, /\bdeclin/i, /\bwarning/i, /\b4xx\b/i,
      /\b404\b/i, /\bunverified\b/i
    ]
  },
  {
    key:"opportunity",
    label:"Opportunity",
    weight:0.8,
    patterns:[
      /\bopportunit/i, /\bgrowth opportunity\b/i,
      /\bexpansion opportunity\b/i, /\bnew market\b/i,
      /\bnew keyword\b/i, /\blaunch opportunity\b/i
    ]
  }
]);

const DIMENSION_BY_KEY = new Map(DIMENSIONS.map(item => [item.key, item]));

const CLOSED_STATUSES = new Set([
  "complete","completed","closed","resolved","cancelled","canceled",
  "archived","ignored","no_action","published"
]);

const MONITORING_STATUSES = new Set([
  "monitoring","awaiting_external_validation","waiting_external",
  "waiting_on_external","historical"
]);

const NEGATIVE_RE = /\b(?:declin(?:e|ed|ing)|drop(?:ped|ping)?|down|failed|failure|broken|blocked|error|risk|hold|warning|needs attention|4xx|404|duplicate content|not working|inactive|unverified|missing)\b/i;
const POSITIVE_RE = /\b(?:improv(?:e|ed|ing|ement)|increas(?:e|ed|ing)|gain(?:ed|ing)?|passed|healthy|excellent|success|successful|restored|verified|reached position|entered the top|in the top 10|win|winning)\b/i;
const STABLE_RE = /\b(?:stable|no significant change|no change|monitoring|watching|unchanged|flat)\b/i;
const BUSINESS_OUTCOME_ASSERTION_RE = /\b(?:increas(?:e|ed|ing)|decreas(?:e|ed|ing)|grew|fell|rose|declined|improved|dropped|generated|produced|recorded|converted|sold|sales were|revenue was|revenue reached|leads were|purchases were|orders were)\b/i;
const BUSINESS_HYPOTHETICAL_RE = /\b(?:could|may|might|potential(?:ly)?|expected to|risk of|opportunity to)\b/i;
const GENERIC_CLIENT_TEXT_RE = /^(?:high|medium|normal|low|urgent|critical|monitoring|information)$/i;
const GENERIC_MONITORING_TEXT_RE = /^(?:human-routed monitoring evidence preserved from the source email\.?|monitoring evidence preserved from the source email\.?)$/i;

export function buildClientHealthV2(input = {}) {
  const now = validDate(input.now) || new Date();
  const client = input.client || {};
  const intelligence = array(input.intelligence);
  const activityRecords = array(input.activityRecords || input.proofOfWork);
  const investigations = array(input.investigations);
  const workItems = array(input.workItems);
  const alerts = array(input.alerts);

  const evidence = dedupeEvidenceForScoring([
    ...intelligence.map(item => evidenceFromIntelligence(item, now)),
    ...activityRecords.map(item => evidenceFromActivity(item, now)),
    ...investigations.map(item => evidenceFromInvestigation(item, now)),
    ...workItems.map(item => evidenceFromWork(item, now)),
    ...alerts.map(item => evidenceFromAlert(item, now))
  ].filter(Boolean));

  const classifiedEvidence = evidence.map(item => ({
    ...item,
    dimensionKeys:classifyEvidenceDimensions(item)
  }));

  const dimensions = DIMENSIONS.map(definition =>
    buildDimension(
      definition,
      classifiedEvidence.filter(item =>
        item.dimensionKeys.includes(definition.key)
      )
    )
  );

  const known = dimensions.filter(item => Number.isFinite(item.score));
  const weightedTotal = known.reduce(
    (sum, item) => sum + (item.score * item.weight),
    0
  );
  const weightTotal = known.reduce((sum, item) => sum + item.weight, 0);
  const score = weightTotal > 0
    ? Math.round(weightedTotal / weightTotal)
    : null;

  const recentEvidence = classifiedEvidence.filter(item => item.ageDays <= 45);
  const coverageRatio = known.length / DIMENSIONS.length;
  const averageDimensionConfidence = known.length
    ? known.reduce((sum, item) => sum + item.confidenceScore, 0) / known.length
    : 0;

  const confidenceScore = Math.round(
    Math.min(100, (coverageRatio * 45) + (averageDimensionConfidence * 0.55))
  );
  const confidence = confidenceLabel(confidenceScore);

  const trend = overallTrend(classifiedEvidence);
  const status = healthStatus(score, confidenceScore);

  const positives = uniqueEvidence(
    classifiedEvidence
      .filter(item => item.direction > 0 && item.recencyWeight >= 0.5)
      .sort(compareEvidence)
  ).slice(0, 3);

  const negatives = uniqueEvidence(
    classifiedEvidence
      .filter(item =>
        (item.direction < 0 || item.kind === "active_risk") &&
        item.recencyWeight >= 0.25
      )
      .sort(compareEvidence)
  ).slice(0, 3);

  const watching = uniqueEvidence(
    classifiedEvidence
      .filter(item =>
        item.kind === "monitoring" &&
        item.recencyWeight >= 0.25
      )
      .sort(compareEvidence)
  ).slice(0, 3);

  const highestValueMove = chooseHighestValueMove({
    workItems,
    investigations,
    negatives
  });

  const whatIsWorking = positives.map(clientSafeEvidenceText).filter(Boolean);
  const needsAttention = negatives.map(clientSafeEvidenceText).filter(Boolean);
  const whatWeAreWatching = watching.map(clientSafeEvidenceText).filter(Boolean);

  return {
    version:CLIENT_HEALTH_V2_VERSION,
    client:{
      id:numberOrNull(client.id),
      clientCode:text(client.client_code || client.clientCode),
      name:text(client.name)
    },
    score,
    status,
    trend,
    confidence,
    confidenceScore,
    evidenceCoverage:{
      knownDimensions:known.length,
      totalDimensions:DIMENSIONS.length,
      ratio:Number(coverageRatio.toFixed(2)),
      recentEvidenceCount:recentEvidence.length,
      totalEvidenceCount:classifiedEvidence.length
    },
    generatedAt:now.toISOString(),
    lastStrategicReview:null,
    dimensions,
    whatIsWorking,
    needsAttention,
    highestValueMove,
    whatWeAreWatching,
    clientSafeSummary:{
      score,
      status,
      trend,
      confidence,
      headline:score === null
        ? "Client Health is waiting for enough durable evidence."
        : `Client Health: ${score} / 100 — ${status}`,
      whatIsWorking,
      needsAttention,
      highestValueMove,
      whatWeAreWatching
    },
    internal:{
      scoringRule:"Weighted average of known dimensions only. Evidence is assigned to at most two dimensions. Stale evidence is recency-discounted. Unknown dimensions reduce confidence, not health.",
      unknownDimensions:dimensions.filter(item => item.score === null).map(item => item.key),
      evidenceCount:classifiedEvidence.length,
      evidenceAssignments:classifiedEvidence.map(item => ({
        id:item.id,
        dimensions:item.dimensionKeys
      }))
    }
  };
}

function buildDimension(definition, matches) {
  if (!matches.length) {
    return {
      key:definition.key,
      label:definition.label,
      weight:definition.weight,
      score:null,
      status:"Unknown",
      trend:"Unknown",
      confidence:"Low",
      confidenceScore:0,
      evidenceCount:0,
      recentEvidenceCount:0,
      reason:"Not enough durable evidence is available yet.",
      summary:"Not enough durable evidence is available yet.",
      primaryEvidence:[]
    };
  }

  let weightedDirection = 0;
  let totalStrength = 0;
  let trendSignal = 0;
  let activeRiskPenalty = 0;

  for (const item of matches) {
    const reliability = evidenceReliability(item);
    const strength =
      Math.max(1, item.importance) *
      item.recencyWeight *
      reliability;

    const effectiveDirection =
      definition.key === "risk_attention" &&
      item.direction === 0 &&
      NEGATIVE_RE.test(item.searchText)
        ? -1
        : item.direction;

    totalStrength += strength;
    weightedDirection += effectiveDirection * strength;
    trendSignal += effectiveDirection * strength;

    if (item.kind === "active_risk") {
      activeRiskPenalty +=
        (3 + (item.importance * 1.5)) *
        item.recencyWeight;
    }
  }

  const averageDirection = totalStrength > 0
    ? weightedDirection / totalStrength
    : 0;

  let score;

  if (definition.key === "risk_attention") {
    score = 85 +
      (Math.min(0, averageDirection) * 20) -
      Math.min(30, activeRiskPenalty);
  } else {
    score = 70 +
      (averageDirection * 20) -
      Math.min(12, activeRiskPenalty);
  }

  score = clamp(Math.round(score), 25, 95);

  const recent = matches.filter(item => item.ageDays <= 45);
  const recentRatio = matches.length ? recent.length / matches.length : 0;
  const recencyStrength = matches.length
    ? matches.reduce((sum, item) => sum + item.recencyWeight, 0) / matches.length
    : 0;

  const dimensionConfidenceScore = Math.round(
    Math.min(
      100,
      20 +
      (Math.min(matches.length, 5) * 8) +
      (recentRatio * 25) +
      (recencyStrength * 15)
    )
  );

  const trend = trendSignal >= 2.5
    ? "Improving"
    : trendSignal <= -2.5
      ? "Declining"
      : "Stable";

  const primaryEvidence = uniqueEvidence(
    matches.slice().sort(compareEvidence)
  )
    .map(clientSafeEvidenceText)
    .filter(Boolean)
    .slice(0, 3);

  const reason = buildDimensionReason({
    definition,
    score,
    trend,
    matches,
    recent,
    primaryEvidence,
    evidenceStrength
  });

  return {
    key:definition.key,
    label:definition.label,
    weight:definition.weight,
    score,
    status:dimensionStatus(score),
    trend,
    confidence:confidenceLabel(dimensionConfidenceScore),
    confidenceScore:dimensionConfidenceScore,
    evidenceCount:matches.length,
    recentEvidenceCount:recent.length,
    reason,
    summary:reason,
    primaryEvidence
  };
}

function classifyEvidenceDimensions(item) {
  const candidates = [];

  for (const definition of DIMENSIONS) {
    const matchScore = dimensionMatchScore(definition, item);
    if (matchScore > 0) {
      candidates.push({ key:definition.key, matchScore });
    }
  }

  candidates.sort((a, b) =>
    b.matchScore - a.matchScore ||
    DIMENSION_BY_KEY.get(b.key).weight - DIMENSION_BY_KEY.get(a.key).weight
  );

  const selected = [];

  for (const candidate of candidates) {
    if (selected.length >= 2) break;

    if (
      candidate.key === "risk_attention" ||
      !selected.length ||
      candidate.matchScore >= Math.max(2, candidates[0].matchScore - 1)
    ) {
      selected.push(candidate.key);
    }
  }

  return selected;
}

function dimensionMatchScore(definition, item) {
  if (definition.key === "business_performance") {
    if (!item.outcomeText) return 0;

    const metricMatches =
      countPatternMatches(definition.patterns, item.outcomeText);

    if (!metricMatches) return 0;

    if (
      BUSINESS_HYPOTHETICAL_RE.test(item.outcomeText) &&
      !/\b\d+(?:\.\d+)?%?\b/.test(item.outcomeText)
    ) {
      return 0;
    }

    if (
      !BUSINESS_OUTCOME_ASSERTION_RE.test(item.outcomeText) &&
      !/\b\d+(?:\.\d+)?%?\b/.test(item.outcomeText)
    ) {
      return 0;
    }

    return metricMatches + 2;
  }

  if (definition.key === "risk_attention" && item.kind === "active_risk") {
    return 5 + countPatternMatches(definition.patterns, item.searchText);
  }

  const score = countPatternMatches(definition.patterns, item.searchText);

  if (definition.key === "opportunity") {
    return score > 0 && /\b(?:opportunit|growth opportunity|expansion opportunity|new market|new keyword|launch opportunity)/i.test(item.searchText)
      ? score
      : 0;
  }

  return score;
}

function countPatternMatches(patterns, value) {
  return patterns.reduce(
    (count, pattern) => count + (pattern.test(value) ? 1 : 0),
    0
  );
}

function evidenceFromIntelligence(item, now) {
  const subject = text(item.subject || item.what_happened || item.whatHappened || "Client intelligence");
  const whatHappened = text(item.what_happened || item.whatHappened);
  const businessMeaning = text(item.business_meaning || item.businessMeaning);
  const recommendedAction = text(item.recommended_action || item.recommendedAction);

  const body = joinText(
    subject,
    whatHappened,
    businessMeaning,
    recommendedAction
  );
  if (!body) return null;

  const direction = directionFromText(
    joinText(whatHappened, businessMeaning),
    item.trend
  );
  const status = normalize(item.status);
  const handling = normalize(item.handling_state || item.handlingState);

  return makeEvidence({
    id:`intelligence:${item.id || "unknown"}`,
    title:subject,
    summary:businessMeaning || whatHappened || subject,
    searchText:body,
    outcomeText:joinText(whatHappened, businessMeaning),
    direction,
    importance:importanceValue(item.importance),
    kind:handling === "monitoring" || MONITORING_STATUSES.has(status)
      ? "monitoring"
      : "intelligence",
    sourceReference:item.source_reference || item.sourceReference,
    observedAt:item.last_observed_at || item.lastObservedAt || item.first_observed_at || item.created_at,
    now
  });
}

function evidenceFromActivity(item, now) {
  const actualImpact = text(item.actual_impact);
  const body = joinText(
    item.category,
    item.activity,
    actualImpact,
    item.expected_impact,
    item.notes,
    item.source_type,
    item.evidence_type
  );
  if (!body) return null;

  const direction = directionFromText(actualImpact || item.notes);
  const category = normalize(item.category);
  const sourceType = normalize(item.source_type);

  return makeEvidence({
    id:`activity:${item.id || "unknown"}`,
    title:text(item.activity || item.category || "Activity"),
    summary:actualImpact || text(item.activity || item.category),
    searchText:body,
    outcomeText:actualImpact,
    direction,
    importance:importanceValue(item.priority),
    kind:category.includes("monitor") || sourceType.includes("monitor")
      ? "monitoring"
      : item.win
        ? "completed_proof"
        : "activity",
    sourceReference:item.source_reference || item.sourceReference,
    observedAt:item.activity_date || item.created_at,
    now
  });
}

function evidenceFromInvestigation(item, now) {
  const status = normalize(item.status);
  if (CLOSED_STATUSES.has(status) || MONITORING_STATUSES.has(status)) return null;

  const body = joinText(
    item.title,
    item.description,
    item.finding_summary,
    item.recommendation
  );
  if (!body) return null;

  return makeEvidence({
    id:`investigation:${item.id || "unknown"}`,
    title:text(item.title || "Open investigation"),
    summary:text(item.finding_summary || item.description || item.recommendation || item.title),
    searchText:body,
    outcomeText:text(item.finding_summary),
    direction:-1,
    importance:importanceValue(item.priority) + 1,
    kind:"active_risk",
    sourceReference:item.source_reference || item.sourceReference || `investigation:${item.id || "unknown"}`,
    observedAt:item.updated_at || item.opened_at || item.created_at,
    now
  });
}

function evidenceFromWork(item, now) {
  const status = normalize(item.status);
  const actualImpact = text(item.actual_impact);
  const body = joinText(
    item.title,
    item.description,
    item.expected_impact,
    actualImpact,
    item.category
  );
  if (!body) return null;

  if (CLOSED_STATUSES.has(status)) {
    return makeEvidence({
      id:`work:${item.id || "unknown"}`,
      title:text(item.title || "Completed work"),
      summary:actualImpact || text(item.title || item.description),
      searchText:body,
      outcomeText:actualImpact,
      direction:actualImpact ? directionFromText(actualImpact) : 0,
      importance:importanceValue(item.priority),
      kind:"completed_proof",
        sourceReference:item.source_reference || item.sourceReference,
      observedAt:item.completed_at || item.updated_at || item.created_at,
      now
    });
  }

  const waitingOrBlocked = ["waiting","blocked"].includes(status);

  return makeEvidence({
    id:`work:${item.id || "unknown"}`,
    title:text(item.title || "Open work"),
    summary:text(item.title || item.description),
    searchText:body,
    outcomeText:"",
    direction:waitingOrBlocked ? -1 : 0,
    importance:importanceValue(item.priority),
    kind:waitingOrBlocked ? "active_risk" : "open_work",
    sourceReference:item.source_reference || item.sourceReference,
    observedAt:item.updated_at || item.started_at || item.created_at,
    now
  });
}

function evidenceFromAlert(item, now) {
  const status = normalize(item.status);
  if (CLOSED_STATUSES.has(status)) return null;

  const body = joinText(item.title, item.description);
  if (!body) return null;

  return makeEvidence({
    id:`alert:${item.id || "unknown"}`,
    title:text(item.title || "Active alert"),
    summary:text(item.description || item.title),
    searchText:body,
    outcomeText:text(item.description),
    direction:-1,
    importance:importanceValue(item.severity) + 1,
    kind:"active_risk",
    sourceReference:item.source_reference || item.sourceReference || `alert:${item.id || "unknown"}`,
    observedAt:item.updated_at || item.created_at,
    now
  });
}

function makeEvidence({
  id,
  title,
  summary,
  searchText,
  outcomeText,
  direction,
  importance,
  kind,
  sourceReference,
  observedAt,
  now
}) {
  const observed = validDate(observedAt);
  const ageDays = observed
    ? Math.max(0, Math.floor((now - observed) / 86400000))
    : 9999;

  return {
    id,
    title,
    summary,
    searchText,
    outcomeText:text(outcomeText),
    direction:clamp(Number(direction) || 0, -1, 1),
    importance:clamp(Number(importance) || 1, 1, 4),
    kind,
    sourceReference:text(sourceReference),
    observedAt:observed ? observed.toISOString() : null,
    ageDays,
    recencyWeight:recencyWeight(ageDays)
  };
}

function directionFromText(value, explicitTrend) {
  const trend = normalize(explicitTrend);
  if (["improving","positive","up","growing","growth"].includes(trend)) return 1;
  if (["declining","deteriorating","negative","down","worsening"].includes(trend)) return -1;
  if (["stable","monitoring","unchanged","flat"].includes(trend)) return 0;

  const body = text(value);
  const negative = NEGATIVE_RE.test(body);
  const positive = POSITIVE_RE.test(body);

  if (negative && !positive) return -1;
  if (positive && !negative) return 1;
  if (STABLE_RE.test(body)) return 0;
  return 0;
}

function recencyWeight(ageDays) {
  if (ageDays <= 30) return 1;
  if (ageDays <= 60) return 0.75;
  if (ageDays <= 90) return 0.5;
  if (ageDays <= 180) return 0.25;
  if (ageDays <= 365) return 0.1;
  return 0.05;
}

function evidenceReliability(item) {
  if (item.kind === "active_risk") return 1;
  if (item.kind === "completed_proof") return 1;
  if (item.kind === "intelligence") return 0.9;
  if (item.kind === "monitoring") return 0.75;
  if (item.kind === "activity") return 0.75;
  if (item.kind === "open_work") return 0.35;
  return 0.6;
}

function dedupeEvidenceForScoring(items) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const sourceKey = normalize(item.sourceReference);
    const contentKey = normalize(
      `${cleanClientTitle(item.title)}|${clipClientText(item.summary, 140)}`
    );
    const key = sourceKey || contentKey || item.id;

    if (!key || seen.has(key)) continue;

    seen.add(key);
    output.push(item);
  }

  return output;
}

function overallTrend(evidence) {
  const relevant = evidence.filter(item => item.ageDays <= 60);
  if (!relevant.length) return "Unknown";

  const total = relevant.reduce(
    (sum, item) =>
      sum +
      (
        item.direction *
        Math.max(1, item.importance) *
        item.recencyWeight *
        evidenceReliability(item)
      ),
    0
  );

  if (total >= 5) return "Improving";
  if (total <= -5) return "Declining";
  return "Stable";
}

function buildDimensionReason({
  definition,
  score,
  trend,
  matches,
  recent,
  primaryEvidence
}) {
  const recentPhrase = recent.length
    ? `${recent.length} recent source${recent.length === 1 ? "" : "s"}`
    : "no recent evidence";

  const evidencePhrase = `${matches.length} supporting source${matches.length === 1 ? "" : "s"}`;

  const primary = primaryEvidence[0]
    ? ` Primary evidence: ${primaryEvidence[0]}`
    : "";

  return `${definition.label} is ${dimensionStatus(score).toLowerCase()} at ${score}/100 with a ${trend.toLowerCase()} trend, based on ${evidencePhrase} (${recentPhrase}).${primary}`;
}

function chooseHighestValueMove({ workItems, investigations, negatives }) {
  const openWork = array(workItems)
    .filter(item => !CLOSED_STATUSES.has(normalize(item.status)))
    .sort(comparePriorityRecency);

  if (openWork.length) {
    return text(
      openWork[0].title ||
      openWork[0].description ||
      "Continue the highest-priority committed Work Item."
    );
  }

  const openInvestigations = array(investigations)
    .filter(item => {
      const status = normalize(item.status);
      return !CLOSED_STATUSES.has(status) && !MONITORING_STATUSES.has(status);
    })
    .sort(comparePriorityRecency);

  if (openInvestigations.length) {
    return text(
      openInvestigations[0].current_next_step ||
      openInvestigations[0].next_step ||
      openInvestigations[0].title ||
      "Continue the highest-priority Investigation."
    );
  }

  if (negatives.length) {
    return text(negatives[0].summary || negatives[0].title);
  }

  return "Continue monitoring and pursue the highest-value growth opportunity supported by current evidence.";
}

function comparePriorityRecency(a, b) {
  const rank = value => {
    const n = normalize(value);
    if (["urgent","critical","highest"].includes(n)) return 0;
    if (n === "high") return 1;
    if (["normal","medium"].includes(n)) return 2;
    if (n === "low") return 3;
    return 4;
  };

  const priority = rank(a.priority) - rank(b.priority);
  if (priority) return priority;

  return dateNumber(b.updated_at || b.created_at) -
    dateNumber(a.updated_at || a.created_at);
}

function compareEvidence(a, b) {
  const recency = b.recencyWeight - a.recencyWeight;
  if (recency) return recency;

  const importance = b.importance - a.importance;
  if (importance) return importance;

  return a.ageDays - b.ageDays;
}

function uniqueEvidence(items) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = normalize(item.title || item.summary);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

function clientSafeEvidenceText(item) {
  const title = cleanClientTitle(item?.title);
  let value = text(item?.summary || title);

  const looksLikeRawSource =
    /\bMessage\s+\d+\s+of\s+\d+\b|\bFrom:\s|\bTo:\s|\bSubject:\s/i.test(value);

  const looksGeneric =
    /^The saved .+ evidence contains measurable client information/i.test(value) ||
    /^Human operator routed/i.test(value) ||
    GENERIC_MONITORING_TEXT_RE.test(value) ||
    GENERIC_CLIENT_TEXT_RE.test(value);

  if (looksLikeRawSource || looksGeneric || value.length > 260) {
    value = title || value;
  }

  if (
    !value ||
    GENERIC_MONITORING_TEXT_RE.test(value) ||
    GENERIC_CLIENT_TEXT_RE.test(value)
  ) {
    return "";
  }

  return clipClientText(value, 190);
}

function cleanClientTitle(value) {
  return text(value)
    .replace(/^\s*(?:re|fw|fwd):\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clipClientText(value, limit) {
  const compact = text(value).replace(/\s+/g, " ");
  if (compact.length <= limit) return compact;

  const sentence = compact.slice(0, limit + 1);
  const lastStop = Math.max(
    sentence.lastIndexOf(". "),
    sentence.lastIndexOf("; "),
    sentence.lastIndexOf(" — ")
  );

  const clipped = lastStop >= 70
    ? sentence.slice(0, lastStop + 1)
    : compact.slice(0, limit).replace(/[\s,;:.-]+$/g, "");

  return `${clipped}…`;
}

function healthStatus(score, confidenceScore) {
  if (!Number.isFinite(score)) return "Insufficient Evidence";
  if (confidenceScore < 25) return "Low-Confidence Estimate";
  if (score >= 80) return "Strong";
  if (score >= 60) return "Stable";
  if (score >= 40) return "Needs Attention";
  return "Critical";
}

function dimensionStatus(score) {
  if (!Number.isFinite(score)) return "Unknown";
  if (score >= 80) return "Strong";
  if (score >= 60) return "Stable";
  if (score >= 40) return "Needs Attention";
  return "Critical";
}

function confidenceLabel(score) {
  if (score >= 75) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

function importanceValue(value) {
  const normalized = normalize(value);
  if (["urgent","critical","highest"].includes(normalized)) return 4;
  if (normalized === "high") return 3;
  if (["normal","medium"].includes(normalized)) return 2;
  return 1;
}

function normalize(value) {
  return text(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function joinText(...values) {
  return values
    .filter(value => value !== null && value !== undefined && text(value))
    .map(text)
    .join(" ");
}

function text(value) {
  return String(value ?? "").trim();
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateNumber(value) {
  return validDate(value)?.getTime() || 0;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
