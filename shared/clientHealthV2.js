/* =========================================================
   Global Concepts Media Operating System
   File: shared/clientHealthV2.js
   Version: 2.0.1
   Status: Production Candidate
   Sprint: Client Health v2 — Evidence-Based Client-Safe Health
   Purpose:
   Convert durable client operating history into one explainable health score
   with confidence, trend, category detail, and a client-safe summary layer.

   Production rules:
   - Unknown evidence does NOT reduce health; it reduces confidence.
   - No AI is required. Every score is deterministic and auditable.
   - Open Work is not automatically "bad"; active risk / failed conditions are.
   - Monitoring evidence may influence trend only when the source explicitly
     describes improvement or deterioration.
   - Client-safe output never exposes internal reasoning text beyond durable,
     source-grounded titles / summaries already stored in the OS.
   ========================================================= */

export const CLIENT_HEALTH_V2_VERSION = "2.0.1";

const DIMENSIONS = Object.freeze([
  {
    key:"business_performance",
    label:"Business Performance",
    weight:1.25,
    patterns:[
      /\brevenue\b/i, /\bsales?\b/i, /\bleads?\b/i, /\broi\b/i,
      /\bconversion(?:s| rate)?\b/i, /\bqualified (?:lead|traffic)/i,
      /\bshowroom traffic\b/i
    ]
  },
  {
    key:"search_visibility",
    label:"Search Visibility",
    weight:1.15,
    patterns:[
      /\bseo\b/i, /\bsemrush\b/i, /\bposition tracking\b/i,
      /\bkeyword/i, /\brank(?:ing|ings)?\b/i, /\bsearch visibility\b/i,
      /\bsearch console\b/i, /\borganic\b/i, /\bclicks?\b/i,
      /\bimpressions?\b/i
    ]
  },
  {
    key:"website_conversion",
    label:"Website / Conversion",
    weight:1.05,
    patterns:[
      /\bwebsite\b/i, /\bsite health\b/i, /\bcore web vitals?\b/i,
      /\bcrawl/i, /\bredirect/i, /\b4xx\b/i, /\b404\b/i,
      /\bduplicate content\b/i, /\bmeta description\b/i,
      /\bcheckout\b/i, /\badd to cart\b/i, /\bview item\b/i,
      /\bshopify\b/i
    ]
  },
  {
    key:"analytics_measurement",
    label:"Analytics / Measurement",
    weight:1.0,
    patterns:[
      /\bga4\b/i, /\bgoogle analytics\b/i, /\bgtm\b/i,
      /\bgoogle tag\b/i, /\btracking\b/i, /\battribution\b/i,
      /\bmeasurement\b/i, /\bconversion action/i, /\brealtime\b/i
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
      /\bcampaign\b/i, /\bgoogle ads\b/i, /\bmeta\b/i,
      /\bfacebook\b/i, /\binstagram\b/i, /\bconnected tv\b/i,
      /\bctv\b/i, /\bradio\b/i, /\bmedia\b/i, /\bpromotion\b/i,
      /\bsale\b/i, /\bgoogle business profile\b/i, /\bgoogle profile\b/i
    ]
  },
  {
    key:"competitive_position",
    label:"Competitive Position",
    weight:0.75,
    patterns:[
      /\bcompetitor/i, /\bcompetitive\b/i, /\bmarket share\b/i,
      /\bshare of voice\b/i, /\bvisibility vs\b/i, /\bversus competitor/i
    ]
  },
  {
    key:"advantage_coverage",
    label:"Advantage Coverage",
    weight:0.75,
    patterns:[
      /\bservice area\b/i, /\bmarket coverage\b/i, /\bgeographic/i,
      /\bgeo(?:graphy)?\b/i, /\blake nona\b/i, /\bnarcoossee\b/i,
      /\borlando\b/i, /\bmelbourne\b/i, /\blocal coverage\b/i,
      /\bproduct coverage\b/i, /\bcategory coverage\b/i
    ]
  },
  {
    key:"risk_attention",
    label:"Risk / Attention",
    weight:1.2,
    patterns:[
      /\brisk\b/i, /\bneeds attention\b/i, /\bhold\b/i,
      /\bblocked\b/i, /\bbroken\b/i, /\berrors?\b/i, /\bfailed\b/i,
      /\bdeclin/i, /\bproblem\b/i, /\bissue\b/i, /\bwarning/i
    ]
  },
  {
    key:"opportunity",
    label:"Opportunity",
    weight:0.8,
    patterns:[
      /\bopportunit/i, /\bgrowth\b/i, /\bexpansion\b/i,
      /\btop 10\b/i, /\bnew market\b/i, /\bnew keyword\b/i,
      /\bimprov/i, /\blaunch\b/i
    ]
  }
]);

const CLOSED_STATUSES = new Set([
  "complete","completed","closed","resolved","cancelled","canceled",
  "archived","ignored","no_action","published"
]);

const MONITORING_STATUSES = new Set([
  "monitoring","awaiting_external_validation","waiting_external",
  "waiting_on_external","historical"
]);

const NEGATIVE_RE = /\b(?:declin(?:e|ed|ing)|drop(?:ped|ping)?|down|failed|failure|broken|blocked|error|critical|risk|hold|warning|needs attention|4xx|404|duplicate content|not working|inactive|unverified|missing)\b/i;
const POSITIVE_RE = /\b(?:improv(?:e|ed|ing|ement)|increas(?:e|ed|ing)|up|gain(?:ed|ing)?|passed|healthy|excellent|success|successful|completed|published|launched|ready|verified|top 10|win|winning)\b/i;
const STABLE_RE = /\b(?:stable|no significant change|no change|monitoring|watching|unchanged)\b/i;

export function buildClientHealthV2(input = {}) {
  const now = validDate(input.now) || new Date();
  const client = input.client || {};
  const intelligence = array(input.intelligence);
  const activityRecords = array(input.activityRecords || input.proofOfWork);
  const investigations = array(input.investigations);
  const workItems = array(input.workItems);
  const alerts = array(input.alerts);

  const evidence = [
    ...intelligence.map(item => evidenceFromIntelligence(item, now)),
    ...activityRecords.map(item => evidenceFromActivity(item, now)),
    ...investigations.map(item => evidenceFromInvestigation(item, now)),
    ...workItems.map(item => evidenceFromWork(item, now)),
    ...alerts.map(item => evidenceFromAlert(item, now))
  ].filter(Boolean);

  const dimensions = DIMENSIONS.map(definition =>
    buildDimension(definition, evidence, now)
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

  const recentEvidence = evidence.filter(item => item.ageDays <= 45);
  const coverageRatio = known.length / DIMENSIONS.length;
  const recencyRatio = evidence.length
    ? recentEvidence.length / evidence.length
    : 0;
  const confidenceScore = Math.round(
    Math.min(100, (coverageRatio * 70) + (recencyRatio * 30))
  );
  const confidence = confidenceLabel(confidenceScore);

  const trend = overallTrend(evidence);
  const status = healthStatus(score, confidenceScore);

  const positives = uniqueEvidence(
    evidence
      .filter(item => item.direction > 0)
      .sort(compareEvidence)
  ).slice(0, 3);

  const negatives = uniqueEvidence(
    evidence
      .filter(item => item.direction < 0 || item.kind === "active_risk")
      .sort(compareEvidence)
  ).slice(0, 3);

  const watching = uniqueEvidence(
    evidence
      .filter(item =>
        item.kind === "monitoring" ||
        (item.direction === 0 && item.kind === "intelligence")
      )
      .sort(compareEvidence)
  ).slice(0, 3);

  const highestValueMove = chooseHighestValueMove({
    workItems,
    investigations,
    negatives
  });

  const whatIsWorking = positives.map(clientSafeEvidenceText);
  const needsAttention = negatives.map(clientSafeEvidenceText);
  const whatWeAreWatching = watching.map(clientSafeEvidenceText);

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
      totalEvidenceCount:evidence.length
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
      scoringRule:"Weighted average of known dimensions only; unknown dimensions reduce confidence, not health.",
      unknownDimensions:dimensions.filter(item => item.score === null).map(item => item.key),
      evidenceCount:evidence.length
    }
  };
}

function buildDimension(definition, evidence, now) {
  const matches = evidence.filter(item =>
    definition.patterns.some(pattern => pattern.test(item.searchText))
  );

  if (!matches.length) {
    return {
      key:definition.key,
      label:definition.label,
      weight:definition.weight,
      score:null,
      status:"Unknown",
      trend:"Unknown",
      confidence:"Low",
      evidenceCount:0,
      recentEvidenceCount:0,
      summary:"Not enough durable evidence is available yet."
    };
  }

  let score = 70;
  let directionTotal = 0;
  let riskPenalty = 0;
  let positiveLift = 0;

  for (const item of matches) {
    directionTotal += item.direction;
    if (item.direction > 0) positiveLift += Math.min(8, 4 + item.importance);
    if (item.direction < 0) riskPenalty += Math.min(12, 6 + item.importance);
    if (item.kind === "active_risk") riskPenalty += 8;
    if (item.kind === "completed_proof" && item.direction >= 0) positiveLift += 4;
  }

  score += Math.min(20, positiveLift);
  score -= Math.min(40, riskPenalty);
  score = clamp(Math.round(score), 20, 96);

  const recent = matches.filter(item => item.ageDays <= 45);
  const dimensionConfidenceScore = Math.round(
    Math.min(100, 35 + Math.min(matches.length, 5) * 9 + (recent.length ? 20 : 0))
  );

  const trend = directionTotal >= 2
    ? "Improving"
    : directionTotal <= -2
      ? "Declining"
      : "Stable";

  return {
    key:definition.key,
    label:definition.label,
    weight:definition.weight,
    score,
    status:dimensionStatus(score),
    trend,
    confidence:confidenceLabel(dimensionConfidenceScore),
    evidenceCount:matches.length,
    recentEvidenceCount:recent.length,
    summary:dimensionSummary(matches, trend)
  };
}

function evidenceFromIntelligence(item, now) {
  const body = joinText(
    item.subject,
    item.what_happened,
    item.whatHappened,
    item.business_meaning,
    item.businessMeaning,
    item.recommended_action,
    item.recommendedAction,
    item.trend,
    item.importance,
    item.handling_state,
    item.handlingState
  );
  if (!body) return null;

  const direction = directionFromText(body, item.trend);
  const status = normalize(item.status);
  const handling = normalize(item.handling_state || item.handlingState);

  return makeEvidence({
    id:`intelligence:${item.id || "unknown"}`,
    title:text(item.subject || item.what_happened || item.whatHappened || "Client intelligence"),
    summary:text(item.business_meaning || item.businessMeaning || item.what_happened || item.whatHappened),
    searchText:body,
    direction,
    importance:importanceValue(item.importance),
    kind:handling === "monitoring" || MONITORING_STATUSES.has(status) ? "monitoring" : "intelligence",
    observedAt:item.last_observed_at || item.lastObservedAt || item.first_observed_at || item.created_at,
    now
  });
}

function evidenceFromActivity(item, now) {
  const body = joinText(
    item.category,
    item.activity,
    item.expected_impact,
    item.actual_impact,
    item.notes,
    item.source_type,
    item.evidence_type,
    item.priority,
    item.status
  );
  if (!body) return null;

  const direction = directionFromText(body);
  const category = normalize(item.category);
  const sourceType = normalize(item.source_type);

  return makeEvidence({
    id:`activity:${item.id || "unknown"}`,
    title:text(item.activity || item.category || "Activity"),
    summary:text(item.actual_impact || item.expected_impact || item.activity),
    searchText:body,
    direction,
    importance:importanceValue(item.priority),
    kind:category.includes("monitor") || sourceType.includes("monitor") ? "monitoring" : item.win ? "completed_proof" : "activity",
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
    item.recommendation,
    item.priority,
    item.status
  );
  if (!body) return null;

  return makeEvidence({
    id:`investigation:${item.id || "unknown"}`,
    title:text(item.title || "Open investigation"),
    summary:text(item.finding_summary || item.description || item.recommendation || item.title),
    searchText:body,
    direction:-1,
    importance:importanceValue(item.priority) + 1,
    kind:"active_risk",
    observedAt:item.updated_at || item.opened_at || item.created_at,
    now
  });
}

function evidenceFromWork(item, now) {
  const status = normalize(item.status);
  const body = joinText(
    item.title,
    item.description,
    item.expected_impact,
    item.actual_impact,
    item.category,
    item.priority,
    item.status
  );
  if (!body) return null;

  if (CLOSED_STATUSES.has(status)) {
    return makeEvidence({
      id:`work:${item.id || "unknown"}`,
      title:text(item.title || "Completed work"),
      summary:text(item.actual_impact || item.expected_impact || item.description || item.title),
      searchText:body,
      direction:directionFromText(body) || (item.actual_impact ? 1 : 0),
      importance:importanceValue(item.priority),
      kind:"completed_proof",
      observedAt:item.completed_at || item.updated_at || item.created_at,
      now
    });
  }

  return makeEvidence({
    id:`work:${item.id || "unknown"}`,
    title:text(item.title || "Open work"),
    summary:text(item.description || item.expected_impact || item.title),
    searchText:body,
    direction:directionFromText(body),
    importance:importanceValue(item.priority),
    kind:"open_work",
    observedAt:item.updated_at || item.started_at || item.created_at,
    now
  });
}

function evidenceFromAlert(item, now) {
  const status = normalize(item.status);
  if (CLOSED_STATUSES.has(status)) return null;

  const body = joinText(item.title, item.description, item.severity, item.status);
  if (!body) return null;

  return makeEvidence({
    id:`alert:${item.id || "unknown"}`,
    title:text(item.title || "Active alert"),
    summary:text(item.description || item.title),
    searchText:body,
    direction:-1,
    importance:importanceValue(item.severity) + 1,
    kind:"active_risk",
    observedAt:item.updated_at || item.created_at,
    now
  });
}

function makeEvidence({
  id,
  title,
  summary,
  searchText,
  direction,
  importance,
  kind,
  observedAt,
  now
}) {
  const observed = validDate(observedAt);
  return {
    id,
    title,
    summary,
    searchText,
    direction:clamp(Number(direction) || 0, -1, 1),
    importance:clamp(Number(importance) || 1, 1, 4),
    kind,
    observedAt:observed ? observed.toISOString() : null,
    ageDays:observed ? Math.max(0, Math.floor((now - observed) / 86400000)) : 9999
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

function overallTrend(evidence) {
  const recent = evidence.filter(item => item.ageDays <= 45);
  if (!recent.length) return "Unknown";
  const total = recent.reduce(
    (sum, item) => sum + (item.direction * Math.max(1, item.importance)),
    0
  );
  if (total >= 4) return "Improving";
  if (total <= -4) return "Declining";
  return "Stable";
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
  return dateNumber(b.updated_at || b.created_at) - dateNumber(a.updated_at || a.created_at);
}

function compareEvidence(a, b) {
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
    /^Human operator routed/i.test(value);

  if (looksLikeRawSource || looksGeneric || value.length > 260) {
    value = title || value;
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

function dimensionSummary(matches, trend) {
  const top = uniqueEvidence(matches.slice().sort(compareEvidence))[0];
  if (!top) return "Evidence is available.";
  const core = clientSafeEvidenceText(top);
  return core ? `${trend}: ${core}` : trend;
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
  return values.filter(value => value !== null && value !== undefined && text(value)).map(text).join(" ");
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
