/* =========================================================
   Global Concepts Media Operating System
   File: routes/gmailWorkRequestIntelligence.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Gmail — Direct Requested Work
   Purpose:
   Determine when a known operational human email contains a concrete client
   request that is specific enough to become a direct Work Item without an
   artificial Investigation.

   Change notes — v1.0.0:
   - Requires a known operational sender, a verified client, and an explicit
     action request before declaring a Work candidate.
   - Preserves the source email as the Communication evidence source.
   - Does not convert FYI, completed work, monitoring, or vague discussion into
     requested work.
   - Recognizes analytics/tracking failures as high-priority measurement work.
   - Produces a reviewed operational-decision payload for Communication + direct
     Work Item creation with createInvestigation=false.
   ========================================================= */

const KNOWN_HUMAN_ROLES = Object.freeze([
  { pattern: /\bkristy\b|kkpayne1@gmail\.com/i, role: "Kristy — Website / Content Operations" },
  { pattern: /\badrianne\b/i, role: "Adrianne — Client / Operations" },
  { pattern: /\bfrank\b/i, role: "Frank — Leadership / Client Operations" },
  { pattern: /\bted\b/i, role: "Ted — Liberty Regional Sales" }
]);

const CLIENT_RULES = Object.freeze([
  { pattern: /\bses\b|sesafes\.com|southeast safes/i, name: "Southeast Safes", code: "SES" },
  { pattern: /a1actionsafeandlock\.com|a1 action safe(?: & lock)?|\ba1a?\b/i, name: "A1 Action Safe & Lock", code: "A1" },
  { pattern: /hbguns\.com|harry beckwith guns(?: & range)?|\bhb guns\b|\bhbg\b/i, name: "HB Guns", code: "HBG" },
  { pattern: /pickettweaponry\.com|pickett weaponry|\bpw\b/i, name: "Pickett Weaponry", code: "PW" },
  { pattern: /northfloridasafes\.com|north florida safes|\bnfs\b/i, name: "North Florida Safes", code: "NFS" },
  { pattern: /southfloridasafes\.com|south florida safes|\bsfs\b/i, name: "South Florida Safes", code: "SFS" },
  { pattern: /moveasafe\.com|move a safe/i, name: "Move A Safe", code: "MAS" },
  { pattern: /globalconceptsmedia\.com|global concepts media|\bgcm\b/i, name: "Global Concepts Media", code: "GCM" },
  { pattern: /lumistudiohouse\.com|lumi & friends|lumi and friends|\blumi\b/i, name: "LUMI", code: "LUMI" }
]);

const EXPLICIT_REQUEST_PATTERNS = Object.freeze([
  /\b(?:can|could|would)\s+you\s+([^?\n]{8,360}\??)/i,
  /\bplease\s+([^?\n]{8,360}\??)/i,
  /\bi\s+need\s+you\s+to\s+([^?\n]{8,360}\??)/i,
  /\bneed\s+andy\s+to\s+([^?\n]{8,360}\??)/i
]);

const ACTION_VERBS = /\b(check|verify|fix|repair|restore|test|review|audit|investigate|look into|look at|update|change|add|remove|build|create|publish|install|configure|correct|resolve|confirm|compare|research)\b/i;
const HIGH_IMPACT_SIGNAL = /\b(broken|not firing|stopped firing|drops? to zero|zero traffic|outage|down|failed|failure|missing data|not registering|urgent|critical)\b/i;
const ANALYTICS_SIGNAL = /\b(ga4|google analytics|gtm|google tag manager|tracking tag|analytics tag|realtime|measurement id|data layer)\b/i;

export function evaluateExplicitHumanWorkRequest(message = {}) {
  const sender = clean(message.from || message.from_);
  const subject = clean(message.subject);
  const body = clean(message.bodyText || message.body || message.snippet);
  const text = `${subject}\n${body}`;

  const role = knownHumanRole(sender);
  if (!role) return notCandidate("Sender is not a known GCM operational human.");

  const client = inferClient(text);
  if (!client) return notCandidate("The email does not prove which production client owns the request.", { role });

  const explicitRequest = extractExplicitRequest(body || text);
  if (!explicitRequest) {
    return notCandidate("No explicit human request for GCM action was found.", { role, client });
  }

  if (!ACTION_VERBS.test(explicitRequest)) {
    return notCandidate("The request is explicit but does not yet identify a concrete operational action.", { role, client, explicitRequest });
  }

  const highImpact = HIGH_IMPACT_SIGNAL.test(text);
  const analyticsTracking = ANALYTICS_SIGNAL.test(text);
  const priority = highImpact ? "High" : "Medium";
  const action = analyticsTracking
    ? buildAnalyticsAction(client, explicitRequest)
    : buildActionTitle(subject, explicitRequest);
  const businessImpact = analyticsTracking
    ? `Reliable analytics measurement for ${client.name} is currently in doubt. Reporting and consulting decisions should not rely on the affected GA4 data until the implementation is verified and live tracking is restored.`
    : `A known GCM operational partner explicitly requested client work for ${client.name}. The requested action is concrete enough to enter the committed Work queue without inventing an Investigation.`;
  const expectedImpact = analyticsTracking
    ? `Restore trustworthy ${client.name} analytics measurement and verify the live GA4/GTM implementation is firing correctly before future reporting or trend analysis relies on it.`
    : `Complete the requested client action and verify the resulting client-facing or operational outcome.`;

  const operationalSummary = `${role} explicitly requested GCM work for ${client.name}. Source request: ${explicitRequest}`;
  const reasoning = `The sender is a known operational human, the client identity is explicit, and the email contains a concrete action request. Requested work is therefore appropriate; an Investigation is not required merely to acknowledge and start the requested deliverable.`;

  return {
    candidate: true,
    role,
    client,
    explicitRequest,
    action,
    priority,
    businessImpact,
    expectedImpact,
    operationalSummary,
    decision: {
      source: "Gmail — Human Work Request",
      communicationType: "Direct Work Request",
      title: subject || action,
      operationalSummary,
      businessImpact: expectedImpact,
      importance: priority,
      operationalPriority: priority,
      recommendedAction: action,
      reasoning,
      recommendedRoutes: {
        saveCommunication: true,
        createInvestigation: false,
        createWorkItem: true,
        replyRequired: false
      }
    }
  };
}

export function extractExplicitRequest(value) {
  const text = clean(value).replace(/\s+/g, " ");
  if (!text) return "";

  for (const pattern of EXPLICIT_REQUEST_PATTERNS) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    return clean(match[1]).replace(/\s+/g, " ").replace(/[?]+$/, "").trim();
  }

  return "";
}

function knownHumanRole(sender) {
  for (const rule of KNOWN_HUMAN_ROLES) {
    if (rule.pattern.test(sender)) return rule.role;
  }
  return "";
}

function inferClient(text) {
  for (const rule of CLIENT_RULES) {
    if (rule.pattern.test(text)) return { name: rule.name, code: rule.code };
  }
  return null;
}

function buildAnalyticsAction(client, explicitRequest) {
  const restore = /broken|not firing|not registering|zero|stopped|failed/i.test(explicitRequest)
    ? "Diagnose and restore"
    : "Verify";
  return `${restore} ${client.code} GA4/GTM tracking`;
}

function buildActionTitle(subject, explicitRequest) {
  const cleanSubject = clean(subject).replace(/[?]+$/, "");
  if (cleanSubject && cleanSubject.length <= 110) {
    return `Requested work — ${cleanSubject}`;
  }
  const request = clean(explicitRequest);
  return request.length <= 110 ? request : `${request.slice(0, 107).trim()}...`;
}

function notCandidate(reason, extra = {}) {
  return {
    candidate: false,
    reason,
    role: extra.role || null,
    client: extra.client || null,
    explicitRequest: extra.explicitRequest || ""
  };
}

function clean(value) {
  return String(value ?? "").trim();
}
