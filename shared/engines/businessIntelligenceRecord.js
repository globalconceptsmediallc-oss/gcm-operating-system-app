/* =========================================================
   Global Concepts Media Operating System
   File: shared/engines/businessIntelligenceRecord.js
   Version: 1.1.4
   Status: Production Road-Test Candidate
   Source: shared/engines/businessIntelligenceRecord.js 1.1.3
   Sprint: Prospect Intelligence Industry Classification Guardrail
   Purpose: Normalize advertisement and website evidence into one
            reusable, evidence-first Business Intelligence Record.

   PRODUCTION RULES
   - Read-only.
   - Creates no D1 records.
   - Uses observable evidence only.
   - Preserves uncertainty instead of inventing facts.
   - Supplies one canonical record to Business Snapshot and
     Prospect Intelligence.
   - Commodity/product phrases must not create false professional
     service classifications.
   ========================================================= */

import { clean } from "../http.js";

export const BUSINESS_INTELLIGENCE_RECORD_VERSION = "1.1.4";

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

  // Precious-metals / roadshow buyer rules.
  // These intentionally precede professional-service rules so
  // product phrases such as "Dental Gold" retain their real meaning.
  [
    "Precious Metals Buying",
    /\b(?:precious metals?|gold buyers?|gold buying|buy gold|sell gold|gold and silver|gold & silver|scrap gold|scrap silver|scrap gold and silver|scrap gold & silver|bullion|\.999 gold|sterling silver|dental gold)\b/i
  ],
  [
    "Coins & Currency",
    /\b(?:coin buyers?|coin buying|gold coins?|silver coins?|graded gold|graded silver|graded coins?|rare coins?|numismatic|paper currency|u\.?s\.? paper currency|foreign silver|foreign gold|barber dime|mercury dime|roosevelt dime|peace dollar|morgan dollar|seated liberty|walking liberty|franklin half|kennedy half|washington quarter)\b/i
  ],
  [
    "Jewelry & Watches",
    /\b(?:scrap jewelry|estate jewelry|custom jewelry|jewelry buyers?|jewelry buying|class rings?|wrist watches?|pocket watches?|time pieces|timepieces)\b/i
  ],
  [
    "Collectibles Buying",
    /\b(?:collectibles?|comic books?|sports cards?|memorabilia|zippo lighters?|militaria|wwii german memorabilia)\b/i
  ],
  [
    "Roadshow Buying Events",
    /\b(?:road show|roadshow|buying event|free evaluation|evaluation experts? on site)\b/i
  ],

  // Medical detail rules intentionally precede the broad Medical Services rule.
  // This lets the record preserve the actual public service mix instead of
  // collapsing a medical practice to one generic category.
  ["Longevity Medicine", /\b(?:longevity medicine|longevity practice|healthspan)\b/i],
  ["Regenerative Medicine", /\bregenerative medicine\b/i],
  ["Stem Cell Therapy", /\b(?:stem cell therapy|stem cell protocols?|umbilical-derived stem cell)\b/i],
  ["Peptide Therapy", /\b(?:peptide therapy|precision peptide therapy|peptide protocols?)\b/i],
  ["Hormone Optimization", /\b(?:hormone optimization|bioidentical hormone therapy|hormone therapy|hormone & vitality care)\b/i],
  ["Advanced Diagnostics", /\b(?:advanced diagnostics|advanced testing|biomarker panels?|genetic testing|epigenetic testing|diagnostic imaging)\b/i],
  ["Hyperbaric Oxygen Therapy", /\b(?:hyperbaric oxygen therapy|HBOT)\b/i],
  ["Metabolic Health & Weight Management", /\b(?:metabolic health|weight management|GLP-1|body composition)\b/i],
  ["Hair Restoration", /\bhair restoration\b/i],
  ["Sexual Health", /\bsexual health\b/i],
  ["Cancer Screening & Prevention", /\b(?:cancer screening|early cancer detection|cancer prevention)\b/i],
  ["Clinical Care & Second Opinions", /\b(?:clinical care|second opinions?|case review|specialist referrals?)\b/i],
  ["Medical Services", /\b(?:medical|medicine|clinic|physician|healthcare|health care|patient|regenerative|longevity|hormone therapy|stem cell|peptide therapy|hyperbaric)\b/i],

  // Do not classify the standalone word "dental" as a dental practice.
  // This prevents commodity phrases such as "Dental Gold" from firing.
  [
    "Dental Services",
    /\b(?:dentist|dentistry|orthodont(?:ic|ics|ist)?|dental (?:care|clinic|office|practice|services?|implants?|cleaning|fillings?|crowns?|veneers?|exams?))\b/i
  ],

  ["Real Estate", /\b(?:real estate|realtor|property management)\b/i],
  ["Restaurant", /\b(?:restaurant|menu|dining|catering)\b/i],
  ["Automotive Sales", /\b(?:new vehicles?|used vehicles?|certified pre-owned|vehicle inventory|dealership|auto dealer|bmw|mercedes|lexus|audi)\b/i],
  ["Automotive Service", /\b(?:service center|schedule service|vehicle service|auto repair|parts center|collision center)\b/i],
  ["Automotive Financing", /\b(?:auto financing|vehicle financing|finance application|lease offers?|payment calculator|trade[- ]?in)\b/i]
]);

const MARKET_PATTERNS = [
  /\bCentral Florida\b/gi,
  /\bGreater Orlando\b/gi,
  /\bOcoee(?:,\s*Florida|\s+FL)?\b/gi,
  /\bBrevard County\b/gi,
  /\bMelbourne(?:,\s*Florida|\s+FL)?\b/gi,
  /\bOrlando(?:,\s*Florida|\s+FL)?\b/gi,
  /\bPalm Bay(?:,\s*Florida|\s+FL)?\b/gi,
  /\bTitusville(?:,\s*Florida|\s+FL)?\b/gi,
  /\bViera(?:,\s*Florida|\s+FL)?\b/gi,
  /\bJacksonville(?:,\s*Florida|\s+FL)?\b/gi,
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

  const rawServices = unique([
    ...(Array.isArray(advertisementEvidence.visibleServices)
      ? advertisementEvidence.visibleServices
      : []),
    ...extractServices(evidenceText),
    ...extractUsefulHeadings(websiteEvidence.headings)
  ]);

  const inferredIndustry = inferIndustry(rawServices, evidenceText);

  const industry = resolveIndustry({
    websiteIndustry: websiteEvidence.identifiedIndustry,
    inferredIndustry,
    evidenceText,
    services: rawServices
  });

  const services = normalizeServicesForIndustry(rawServices, industry).slice(0, 12);

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
    sanitizeAudienceSignals(advertisementEvidence.audienceSignals),
    services,
    evidenceText,
    industry
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
    productsAndServices: unique([
      ...(Array.isArray(source.productsAndServices)
        ? source.productsAndServices
        : []),
      ...primaryServices
    ]).slice(0, 12),
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

  const serviceHeadingPattern =
    /\b(?:lawn care|pest control|termite|irrigation|wildlife|insulation|hvac|roof|plumb|electric|locksmith|safe|firearm|legal|real estate|gold|silver|coin|bullion|jewelry|watch|currency|collectible|memorabilia|road show|roadshow|longevity|stem cell|regenerative medicine|hormone|peptide|hyperbaric|diagnostic|hair restoration|facial rejuvenation|body composition|metabolic health|weight management|sexual health|cancer screening|infusion|clinical care|second opinion|dental care|dentist|orthodont|vehicle service|vehicle sales|financing)\b/i;

  return value
    .map(clean)
    .filter(item =>
      item &&
      item.length <= 70 &&
      !/^(home|about|contact|learn more|get started|request a quote)$/i.test(item)
    )
    .filter(item => serviceHeadingPattern.test(item));
}

function normalizeServicesForIndustry(services, industry) {
  const items = unique(services);
  const normalizedIndustry = clean(industry).toLowerCase();

  if (/precious metals|coins and collectibles|coin and collectible/.test(normalizedIndustry)) {
    const filtered = items.filter(item =>
      !/^dental services$/i.test(item)
    );

    return filtered.length
      ? filtered
      : ["Precious Metals Buying"];
  }

  if (/medical|healthcare|health care|clinic|physician/.test(normalizedIndustry)) {
    const filtered = items.filter(item => {
      if (/^(restaurant|medical services)$/i.test(item)) return false;
      if (/\b(?:restaurant|dining|catering)\b/i.test(item)) return false;

      if (
        /\bpractice\b/i.test(item) &&
        !/\b(?:longevity|regenerative|hormone|diagnostic|stem cell|peptide|hyperbaric)\b/i.test(item)
      ) {
        return false;
      }

      return true;
    });

    return filtered.length
      ? filtered
      : ["Medical Services"];
  }

  return items;
}

function resolveIndustry({
  websiteIndustry,
  inferredIndustry,
  evidenceText,
  services
}) {
  const websiteValue = clean(websiteIndustry);
  const inferredValue = clean(inferredIndustry);
  const joinedServices = unique(services).join(" ");

  const preciousMetalsEvidence =
    /\b(?:precious metals?|gold buyers?|gold buying|gold and silver|gold & silver|scrap gold|scrap silver|bullion|gold coins?|silver coins?|graded coins?|numismatic|paper currency|estate jewelry|scrap jewelry|road show|roadshow|buying event|dental gold)\b/i.test(
      `${evidenceText} ${joinedServices}`
    );

  if (preciousMetalsEvidence) {
    return "Precious Metals, Coins and Collectibles Buying";
  }

  return firstStrongValue([
    websiteValue,
    inferredValue
  ]) || "Requires consultant verification";
}

function inferIndustry(services, text) {
  const joined = services.join(" ");

  if (
    /\b(?:precious metals buying|coins & currency|jewelry & watches|collectibles buying|roadshow buying events)\b/i.test(joined) ||
    /\b(?:precious metals?|gold buyers?|gold buying|gold and silver|gold & silver|scrap gold|scrap silver|bullion|gold coins?|silver coins?|graded coins?|numismatic|paper currency|road show|roadshow|buying event|dental gold)\b/i.test(text)
  ) {
    return "Precious Metals, Coins and Collectibles Buying";
  }

  if (/\b(lawn care|pest control|termite|irrigation|wildlife management|insulation)\b/i.test(joined)) {
    return "Residential Home Services";
  }

  if (/\b(locksmith|safes)\b/i.test(joined)) {
    return "Security and Safe Services";
  }

  if (/\bfirearms\b/i.test(joined)) {
    return "Firearms Retail";
  }

  if (
    /\b(automotive sales|automotive service|automotive financing)\b/i.test(joined) ||
    /\b(?:bmw|mercedes|lexus|audi|dealership|vehicle inventory|certified pre-owned)\b/i.test(text)
  ) {
    return "Automotive Dealership";
  }

  if (/\breal estate\b/i.test(joined)) {
    return "Real Estate";
  }

  if (/\bdental services\b/i.test(joined)) {
    return "Dental Services";
  }

  if (
    /\b(?:medical services|longevity medicine|regenerative medicine|stem cell therapy|peptide therapy|hormone optimization|advanced diagnostics|hyperbaric oxygen therapy)\b/i.test(joined) ||
    /\b(?:medical institute|medical practice|physician|clinic|healthcare|health care|longevity medicine|regenerative medicine|patient care)\b/i.test(text)
  ) {
    return "Medical Services";
  }

  if (/\battorney|law firm\b/i.test(text)) {
    return "Legal Services";
  }

  if (/\brestaurant\b/i.test(joined)) {
    return "Restaurant and Hospitality";
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
    text.match(/\bfree\s+(?:quote|estimate|consultation|inspection|evaluation|discovery call|assessment)\b/i),
    text.match(/\bcomplimentary\s+(?:dinner|consultation|assessment|event)\b/i),
    text.match(/\b\d+%\s*off\b/i)
  ].filter(Boolean);

  return matches.length ? clean(matches[0][0]) : "";
}

function extractTrustSignals(text) {
  const signals = [];

  if (/\bfamily[- ]owned\b/i.test(text)) {
    signals.push("Family-owned business");
  }

  const yearMatch = text.match(
    /\b(?:serving|trusted|established|since)\D{0,18}((?:19|20)\d{2})\b/i
  );

  if (yearMatch) {
    signals.push(`Established history visible since ${yearMatch[1]}`);
  }

  if (/\blicensed\b/i.test(text)) {
    signals.push("Licensing claim visible");
  }

  if (/\binsured\b/i.test(text)) {
    signals.push("Insurance claim visible");
  }

  if (/\bguarantee(?:d)?\b/i.test(text)) {
    signals.push("Guarantee language visible");
  }

  if (/\baward[- ]winning\b/i.test(text)) {
    signals.push("Award claim visible");
  }

  if (/\bboard[- ]certified\b/i.test(text)) {
    signals.push("Board-certified physician credentials visible");
  }

  if (/\bphysician[- ](?:owned|led|founded)\b/i.test(text)) {
    signals.push("Physician-owned or physician-led practice visible");
  }

  if (/\b\d(?:\.\d)?\s*(?:star|stars)\b/i.test(text)) {
    signals.push("Review rating visible");
  }

  if (/\btestimonial|reviews?\b/i.test(text)) {
    signals.push("Customer review or testimonial content visible");
  }

  return unique(signals).slice(0, 10);
}

function sanitizeAudienceSignals(value) {
  const sourceLabels =
    /^(?:direct mail(?: postcard)?|postcard|mailer|magazine(?: advertisement| ad)?|flyer|billboard|vehicle graphic|social(?: advertisement| ad)?|print(?: advertisement| ad)?|advertisement|ad)$/i;

  return unique(
    (Array.isArray(value) ? value : [])
      .map(clean)
      .filter(item => item && !sourceLabels.test(item))
  );
}

function inferTargetCustomer(audienceSignals, services, text, industry) {
  const supplied = Array.isArray(audienceSignals)
    ? audienceSignals.map(clean).filter(Boolean)
    : [];

  if (supplied.length) {
    return supplied.join("; ");
  }

  const serviceText = services.join(" ");
  const industryText = clean(industry);

  if (
    /precious metals|coins and collectibles|coin and collectible/i.test(industryText) ||
    /\b(?:precious metals buying|coins & currency|jewelry & watches|collectibles buying|roadshow buying events)\b/i.test(serviceText)
  ) {
    return "People seeking to sell or have evaluated gold, silver, coins, jewelry, watches, currency, precious metals, and collectible items.";
  }

  if (
    /\bmedical services\b/i.test(industryText) ||
    /\b(?:longevity medicine|stem cell|regenerative medicine|hormone|peptide|hyperbaric|diagnostic|clinical care)\b/i.test(serviceText)
  ) {
    return "Patients seeking physician-led longevity, regenerative, diagnostic, preventive, hormone, or other direct-pay medical care.";
  }

  if (
    /\bdental services\b/i.test(industryText) ||
    /\bdental services\b/i.test(serviceText)
  ) {
    return "Patients seeking dental or orthodontic care.";
  }

  if (
    /\b(lawn care|pest control|termite|irrigation|wildlife management|insulation)\b/i.test(serviceText)
  ) {
    return "Homeowners seeking recurring property care, protection, and curb-appeal services.";
  }

  if (
    /\bcommercial\b/i.test(text) &&
    /\bresidential\b/i.test(text)
  ) {
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
  if (trustSignals.length) {
    return trustSignals[0];
  }

  if (services.length >= 4) {
    return `Broad observable service offering: ${services.slice(0, 5).join(", ")}.`;
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

  if (
    businessName &&
    !/^unknown$/i.test(businessName)
  ) {
    score += 0.2;
  }

  if (
    industry &&
    !/requires|unknown/i.test(industry)
  ) {
    score += 0.2;
  }

  if (services.length) {
    score += 0.2;
  }

  if (markets.length) {
    score += 0.15;
  }

  if (clean(websiteEvidence.status) === "complete") {
    score += 0.15;
  }

  if (clean(advertisementEvidence.status) === "complete") {
    score += 0.1;
  }

  return {
    overall: Math.round(Math.min(1, score) * 100) / 100,
    label:
      score >= 0.8
        ? "High"
        : score >= 0.55
          ? "Medium"
          : "Low"
  };
}

function preferVerified(primary, fallback) {
  const first = clean(primary);

  if (
    first &&
    !/^(unknown|requires consultant verification|not clearly stated|target customer requires verification\.?)$/i.test(first)
  ) {
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

    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(text);
  }

  return result;
}
