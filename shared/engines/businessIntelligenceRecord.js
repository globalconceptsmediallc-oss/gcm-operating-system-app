/* =========================================================
   Global Concepts Media Operating System
   File: shared/engines/businessIntelligenceRecord.js
   Version: 1.1.0
   Status: Production Road-Test Candidate
   Source: shared/engines/businessIntelligenceRecord.js 1.0.0
   Sprint: Business Identification and Consultant Context
   Purpose: Normalize advertisement and website evidence into one
            reusable, evidence-first Business Intelligence Record.

   PRODUCTION RULES
   - Read-only.
   - Creates no D1 records.
   - Uses observable evidence only.
   - Preserves uncertainty instead of inventing facts.
   - Supplies one canonical record to Business Snapshot and
     Prospect Intelligence.
   ========================================================= */

import { clean } from "../http.js";

export const BUSINESS_INTELLIGENCE_RECORD_VERSION = "1.1.0";

const SERVICE_RULES = Object.freeze([
  ["Lawn Care", /\b(?:lawn care|lawn service|fertili[sz]ation|weed control|turf)\b/i],
  ["Pest Control", /\b(?:pest control|pest management|insect control|bug control)\b/i],
  ["Termite Protection", /\b(?:termite|termite protection|termite treatment)\b/i],
  ["Irrigation", /\b(?:irrigation|sprinkler|watering system)\b/i],
  ["Wildlife Management", /\b(?:wildlife|animal removal|rodent control)\b/i],
  ["Insulation", /\b(?:insulation|attic insulation)\b/i],
  ["HVAC", /\b(?:air conditioning|heating|hvac)\b/i],
  ["Roofing", /\b(?:roofing|roof repair|roof replacement)\b/i],
  ["Plumbing", /\b(?:plumbing|plumber|drain cleaning)\b/i],
  ["Electrical", /\b(?:electrical|electrician)\b/i],
  ["Locksmith", /\b(?:locksmith|lock repair|rekey)\b/i],
  ["Safes", /\b(?:gun safe|home safe|commercial safe|safe delivery)\b/i],
  ["Firearms", /\b(?:firearms|guns|ammunition|shooting range)\b/i],
  ["Legal Services", /\b(?:attorney|law firm|legal services)\b/i],
  ["Medical Services", /\b(?:medical|clinic|physician|healthcare)\b/i],
  ["Dental Services", /\b(?:dental|dentist|orthodont)\b/i],
  ["Real Estate", /\b(?:real estate|realtor|property management)\b/i],
  ["Restaurant", /\b(?:restaurant|menu|dining|catering)\b/i],
  ["Automotive Sales", /\b(?:new vehicles?|used vehicles?|certified pre-owned|vehicle inventory|dealership|auto dealer|bmw|mercedes|lexus|audi)\b/i],
  ["Automotive Service", /\b(?:service center|schedule service|vehicle service|auto repair|parts center|collision center)\b/i],
  ["Automotive Financing", /\b(?:auto financing|vehicle financing|finance application|lease offers?|payment calculator|trade[- ]?in)\b/i]
]);

const MARKET_PATTERNS = [
  /\bCentral Florida\b/gi,
  /\bBrevard County\b/gi,
  /\bMelbourne(?:,\s*Florida|\s+FL)?\b/gi,
  /\bOrlando(?:,\s*Florida|\s+FL)?\b/gi,
  /\bPalm Bay(?:,\s*Florida|\s+FL)?\b/gi,
  /\bTitusville(?:,\s*Florida|\s+FL)?\b/gi,
  /\bViera(?:,\s*Florida|\s+FL)?\b/gi,
  /\bJacksonville(?:,\s*Florida|\s+FL)?\b/gi,
  /\bMelbourne(?:,\s*Florida|\s+FL)?\b/gi,
  /\bFlorida\b/gi
];

export function buildBusinessIntelligenceRecord({
  websiteUrl,
  suppliedBusinessName = "",
  prospectContext = {},
  websiteEvidence = {},
  advertisementEvidence = {}
}) {
  const evidenceText = [
    websiteEvidence.title,
    websiteEvidence.metaDescription,
    websiteEvidence.visibleText,
    ...(Array.isArray(websiteEvidence.headings) ? websiteEvidence.headings : []),
    advertisementEvidence.headline,
    advertisementEvidence.supportingMessage,
    advertisementEvidence.offer,
    ...(Array.isArray(advertisementEvidence.visibleServices)
      ? advertisementEvidence.visibleServices
      : []),
    ...(Array.isArray(advertisementEvidence.geographicSignals)
      ? advertisementEvidence.geographicSignals
      : [])
  ].map(clean).filter(Boolean).join(" ");

  const businessName = firstStrongValue([
    suppliedBusinessName,
    websiteEvidence.identifiedBusinessName,
    websiteEvidence.structuredBusinessName,
    websiteEvidence.openGraphSiteName,
    advertisementEvidence.visibleBusinessName,
    extractBusinessNameFromTitle(websiteEvidence.title),
    hostnameLabel(websiteUrl)
  ]);

  const services = unique([
    ...(Array.isArray(advertisementEvidence.visibleServices)
      ? advertisementEvidence.visibleServices
      : []),
    ...extractServices(evidenceText),
    ...extractUsefulHeadings(websiteEvidence.headings)
  ]).slice(0, 12);

  const industry = firstStrongValue([
    websiteEvidence.identifiedIndustry,
    inferIndustry(services, evidenceText)
  ]) || "Requires consultant verification";
  const markets = unique([
    clean(prospectContext.location),
    ...(Array.isArray(advertisementEvidence.geographicSignals)
      ? advertisementEvidence.geographicSignals
      : []),
    clean(websiteEvidence.identifiedMarket),
    ...extractMarkets(evidenceText)
  ]).slice(0, 8);

  const primaryOffer = firstStrongValue([
    advertisementEvidence.offer,
    extractOffer(evidenceText)
  ]) || "No verified public offer was established.";

  const callsToAction = unique([
    ...(Array.isArray(advertisementEvidence.callsToAction)
      ? advertisementEvidence.callsToAction
      : []),
    ...(Array.isArray(websiteEvidence.callsToAction)
      ? websiteEvidence.callsToAction
      : [])
  ]).slice(0, 10);

  const trustSignals = extractTrustSignals(evidenceText);
  const targetCustomer = inferTargetCustomer(
    advertisementEvidence.audienceSignals,
    services,
    evidenceText
  );

  const strongestAsset = determineStrongestAsset({
    services,
    trustSignals,
    advertisementEvidence,
    callsToAction
  });

  const largestOpportunity = determineLargestOpportunity({
    advertisementEvidence,
    websiteEvidence,
    callsToAction
  });

  const confidence = calculateConfidence({
    businessName,
    industry,
    services,
    markets,
    websiteEvidence,
    advertisementEvidence
  });

  return {
    recordVersion: BUSINESS_INTELLIGENCE_RECORD_VERSION,
    generatedAt: new Date().toISOString(),
    identity: {
      businessName: businessName || "Unknown",
      website: clean(websiteEvidence.websiteUrl || websiteUrl) || "Unknown",
      industry,
      targetCustomer,
      geographicMarket: markets[0] || "Requires consultant verification",
      markets
    },
    offer: {
      primaryOffer,
      primaryCallsToAction: callsToAction
    },
    services: {
      primaryServices: services
    },
    trust: {
      observableTrustSignals: trustSignals
    },
    marketing: {
      advertisementFormat: clean(advertisementEvidence.format) || "Unknown",
      advertisementHeadline: clean(advertisementEvidence.headline) || "Unknown",
      advertisementOffer: clean(advertisementEvidence.offer) || "Unknown",
      advertisementConfidence: clean(advertisementEvidence.confidence) || "Low"
    },
    consultantFoundation: {
      strongestObservableAsset: strongestAsset,
      largestObservableOpportunity: largestOpportunity,
      highestPriorityRecommendation:
        "Verify the largest observable opportunity with one measurable customer-journey and tracking review before recommending implementation."
    },
    evidence: {
      websiteStatus: clean(websiteEvidence.status) || "unknown",
      advertisementStatus: clean(advertisementEvidence.status) || "unknown",
      sourceCount:
        (websiteEvidence.status && websiteEvidence.status !== "failed" ? 1 : 0) +
        (Number(advertisementEvidence.imageCount) || 0),
      references: unique([
        clean(websiteEvidence.websiteUrl || websiteUrl),
        clean(prospectContext.source),
        clean(prospectContext.evidenceDescription)
      ]).filter(Boolean)
    },
    confidence,
    uncertainties: unique([
      ...(Array.isArray(advertisementEvidence.uncertainties)
        ? advertisementEvidence.uncertainties
        : []),
      clean(websiteEvidence.uncertainty),
      !markets.length ? "Primary geographic market requires verification." : "",
      !trustSignals.length ? "Public trust signals require verification." : ""
    ]).filter(Boolean)
  };
}

export function applyBusinessIntelligenceRecordToBrief(brief, record) {
  const source = brief && typeof brief === "object" ? brief : {};
  const businessName = record?.identity?.businessName || "Unknown";
  const industry = record?.identity?.industry || "Requires consultant verification";
  const geographicMarket =
    record?.identity?.geographicMarket || "Requires consultant verification";
  const primaryServices = record?.services?.primaryServices || [];
  const trustSignals = record?.trust?.observableTrustSignals || [];
  const primaryOffer = record?.offer?.primaryOffer || "";
  const primaryCallsToAction = record?.offer?.primaryCallsToAction || [];

  return {
    ...source,
    businessName: preferVerified(
      source.businessName,
      businessName
    ),
    industry: preferVerified(
      source.industry,
      industry
    ),
    geographicMarket: preferVerified(
      source.geographicMarket,
      geographicMarket
    ),
    productsAndServices:
      Array.isArray(source.productsAndServices) &&
      source.productsAndServices.length
        ? source.productsAndServices
        : primaryServices,
    targetCustomer: preferVerified(
      source.targetCustomer,
      record?.identity?.targetCustomer
    ),
    trustSignals:
      Array.isArray(source.trustSignals) && source.trustSignals.length
        ? source.trustSignals
        : trustSignals,
    businessSummary: preferVerified(
      source.businessSummary,
      buildSummary(record)
    ),
    websiteObservations: unique([
      ...(Array.isArray(source.websiteObservations)
        ? source.websiteObservations
        : []),
      primaryOffer &&
      !/not verified|not established/i.test(primaryOffer)
        ? `Primary visible offer: ${primaryOffer}`
        : "",
      primaryCallsToAction.length
        ? `Primary visible calls to action: ${primaryCallsToAction.join(", ")}`
        : ""
    ]).filter(Boolean),
    growthOpportunities: unique([
      record?.consultantFoundation?.largestObservableOpportunity,
      ...(Array.isArray(source.growthOpportunities)
        ? source.growthOpportunities
        : [])
    ]).filter(Boolean),
    strongestArea: preferVerified(
      source.strongestArea,
      record?.consultantFoundation?.strongestObservableAsset
    ),
    largestOpportunity: preferVerified(
      source.largestOpportunity,
      record?.consultantFoundation?.largestObservableOpportunity
    ),
    highestPriorityRecommendation: preferVerified(
      source.highestPriorityRecommendation,
      record?.consultantFoundation?.highestPriorityRecommendation
    ),
    businessIntelligenceRecord: record
  };
}

function buildSummary(record) {
  const name = record?.identity?.businessName || "The business";
  const industry = record?.identity?.industry || "business";
  const market = record?.identity?.geographicMarket;
  const services = record?.services?.primaryServices || [];

  const serviceText = services.length
    ? ` Observable services include ${services.slice(0, 5).join(", ")}.`
    : "";

  const marketText =
    market && !/requires|unknown/i.test(market)
      ? ` It serves ${market}.`
      : "";

  return `${name} is an observable ${industry.toLowerCase()} business.${marketText}${serviceText}`;
}

function extractBusinessNameFromTitle(value) {
  const title = clean(value);
  if (!title || /^unknown$/i.test(title)) return "";

  return clean(
    title
      .split(/\s+[|\-–—]\s+/)[0]
      .replace(/\b(Home Page|Homepage|Official Site|Welcome)\b/gi, "")
  );
}

function hostnameLabel(value) {
  try {
    const host = new URL(value).hostname
      .replace(/^www\./i, "")
      .split(".")[0]
      .replace(/^my/i, "");
    return host
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, char => char.toUpperCase());
  } catch {
    return "";
  }
}

function extractServices(text) {
  return SERVICE_RULES
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);
}

function extractUsefulHeadings(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(clean)
    .filter(item =>
      item &&
      item.length <= 70 &&
      !/^(home|about|contact|learn more|get started|request a quote)$/i.test(item)
    )
    .filter(item =>
      SERVICE_RULES.some(([, pattern]) => pattern.test(item))
    );
}

function inferIndustry(services, text) {
  const joined = services.join(" ");

  if (/\b(lawn care|pest control|termite|irrigation|wildlife management|insulation)\b/i.test(joined)) {
    return "Residential Home Services";
  }

  if (/\b(locksmith|safes)\b/i.test(joined)) {
    return "Security and Safe Services";
  }

  if (/\bfirearms\b/i.test(joined)) {
    return "Firearms Retail";
  }

  if (/\b(automotive sales|automotive service|automotive financing)\b/i.test(joined) ||
      /\b(?:bmw|mercedes|lexus|audi|dealership|vehicle inventory|certified pre-owned)\b/i.test(text)) {
    return "Automotive Dealership";
  }

  if (/\breal estate\b/i.test(joined)) {
    return "Real Estate";
  }

  if (/\brestaurant\b/i.test(joined)) {
    return "Restaurant and Hospitality";
  }

  if (/\battorney|law firm\b/i.test(text)) {
    return "Legal Services";
  }

  return services[0] || "Requires consultant verification";
}

function extractMarkets(text) {
  const results = [];

  for (const pattern of MARKET_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      results.push(clean(match[0]));
    }
  }

  return unique(results);
}

function extractOffer(text) {
  const matches = [
    text.match(/\$\s?\d+(?:\.\d{2})?\s*(?:off|credit|discount)/i),
    text.match(/\bfree\s+(?:quote|estimate|consultation|inspection|evaluation)\b/i),
    text.match(/\b\d+%\s*off\b/i)
  ].filter(Boolean);

  return matches.length ? clean(matches[0][0]) : "";
}

function extractTrustSignals(text) {
  const signals = [];

  if (/\bfamily[- ]owned\b/i.test(text)) {
    signals.push("Family-owned business");
  }

  const yearMatch = text.match(/\b(?:serving|trusted|established|since)\D{0,18}((?:19|20)\d{2})\b/i);
  if (yearMatch) {
    signals.push(`Established history visible since ${yearMatch[1]}`);
  }

  if (/\blicensed\b/i.test(text)) signals.push("Licensing claim visible");
  if (/\binsured\b/i.test(text)) signals.push("Insurance claim visible");
  if (/\bguarantee(?:d)?\b/i.test(text)) signals.push("Guarantee language visible");
  if (/\baward[- ]winning\b/i.test(text)) signals.push("Award claim visible");
  if (/\b\d(?:\.\d)?\s*(?:star|stars)\b/i.test(text)) signals.push("Review rating visible");
  if (/\btestimonial|reviews?\b/i.test(text)) signals.push("Customer review or testimonial content visible");

  return unique(signals).slice(0, 10);
}

function inferTargetCustomer(audienceSignals, services, text) {
  const supplied = Array.isArray(audienceSignals)
    ? audienceSignals.map(clean).filter(Boolean)
    : [];

  if (supplied.length) return supplied.join("; ");

  if (/\b(lawn care|pest control|termite|irrigation|wildlife management|insulation)\b/i.test(services.join(" "))) {
    return "Homeowners seeking recurring property care, protection, and curb-appeal services.";
  }

  if (/\bcommercial\b/i.test(text) && /\bresidential\b/i.test(text)) {
    return "Residential and commercial customers.";
  }

  return "Target customer requires verification.";
}

function determineStrongestAsset({
  services,
  trustSignals,
  advertisementEvidence,
  callsToAction
}) {
  if (services.length >= 4) {
    return `Broad observable service offering: ${services.slice(0, 5).join(", ")}.`;
  }

  if (trustSignals.length) {
    return trustSignals[0];
  }

  if (
    clean(advertisementEvidence.status) === "complete" &&
    clean(advertisementEvidence.offer) &&
    !/^unknown$/i.test(clean(advertisementEvidence.offer))
  ) {
    return `Clear direct-response advertising offer: ${clean(advertisementEvidence.offer)}.`;
  }

  if (callsToAction.length) {
    return `Visible customer response paths: ${callsToAction.slice(0, 3).join(", ")}.`;
  }

  return "Strongest observable business asset requires verification.";
}

function determineLargestOpportunity({
  advertisementEvidence,
  websiteEvidence,
  callsToAction
}) {
  const hasAdvertisement =
    Number(advertisementEvidence.imageCount) > 0 ||
    clean(advertisementEvidence.status) === "complete";

  if (hasAdvertisement) {
    return "Verify that the advertisement promise, offer, and calls to action continue consistently through the landing-page and lead-tracking experience.";
  }

  if (!callsToAction.length) {
    return "Clarify the website's primary next step and make the conversion path measurable.";
  }

  if (clean(websiteEvidence.status) !== "complete") {
    return "Verify website accessibility, readable content, and the primary customer journey.";
  }

  return "Verify which public visibility and conversion opportunity is most likely to produce measurable business growth first.";
}

function calculateConfidence({
  businessName,
  industry,
  services,
  markets,
  websiteEvidence,
  advertisementEvidence
}) {
  let score = 0;

  if (businessName && !/^unknown$/i.test(businessName)) score += 0.2;
  if (industry && !/requires|unknown/i.test(industry)) score += 0.2;
  if (services.length) score += 0.2;
  if (markets.length) score += 0.15;
  if (clean(websiteEvidence.status) === "complete") score += 0.15;
  if (clean(advertisementEvidence.status) === "complete") score += 0.1;

  return {
    overall: Math.round(Math.min(1, score) * 100) / 100,
    label: score >= 0.8 ? "High" : score >= 0.55 ? "Medium" : "Low"
  };
}

function preferVerified(primary, fallback) {
  const first = clean(primary);
  if (first && !/^(unknown|requires consultant verification|not clearly stated)/i.test(first)) {
    return first;
  }

  return clean(fallback) || first || "Unknown";
}

function firstStrongValue(values) {
  return values
    .map(clean)
    .find(value =>
      value &&
      !/^unknown$/i.test(value) &&
      !/requires consultant verification/i.test(value)
    ) || "";
}

function unique(values) {
  const seen = new Set();
  const result = [];

  for (const value of Array.isArray(values) ? values : []) {
    const text = clean(value);
    const key = text.toLowerCase();

    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }

  return result;
}
