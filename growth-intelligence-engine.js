/* =========================================================
   Global Concepts Media Operating System
   File: growth-intelligence-engine.js
   Version: 1.1.0
   Sprint: Business Classification Engine v1

   Purpose:
   Transform a completed Business Record into structured,
   evidence-based consulting intelligence.

   Input:
   Business Record only.

   Output:
   Structured Growth Intelligence only.

   This file does NOT:
   - Research websites
   - Fetch external data
   - Call AI
   - Generate HTML
   - Generate PDFs
   - Modify the Business Record
   ========================================================= */

(function (globalScope) {
  "use strict";

  const ENGINE_NAME = "GCM Growth Intelligence Engine";
  const ENGINE_VERSION = "1.1.0";

  const PRIORITY_WEIGHTS = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1
  };

  const EFFORT_WEIGHTS = {
    Low: 1,
    Medium: 2,
    High: 3
  };

  /* =========================================================
     Public Engine Function
     ========================================================= */

  function generateGrowthIntelligence(businessRecord) {
    validateBusinessRecord(businessRecord);

    const record = normalizeBusinessRecord(businessRecord);
    const businessClassification = classifyBusiness(record);
    const growthLeaks = identifyGrowthLeaks(record, businessClassification);
    const businessHealth = calculateBusinessHealth(record, growthLeaks);
    const priorityMatrix = buildPriorityMatrix(growthLeaks);

    const quickWins30 = build30DayQuickWins(priorityMatrix);
    const improvements60 = build60DayImprovements(priorityMatrix);
    const projects90 = build90DayStrategicProjects(priorityMatrix);

    const expectedBusinessImpact = buildExpectedBusinessImpact(
      growthLeaks,
      quickWins30,
      improvements60,
      projects90
    );

    const implementationOptions = buildImplementationOptions(
      quickWins30,
      improvements60,
      projects90
    );

    const executiveSummary = buildExecutiveSummary(
      record,
      businessHealth,
      growthLeaks,
      businessClassification
    );

    return {
      engine: {
        name: ENGINE_NAME,
        version: ENGINE_VERSION,
        generatedAt: new Date().toISOString(),
        source: "Business Record",
        classificationApplied: true,
        additionalResearchPerformed: false
      },

      business: {
        name: record.businessName,
        website: record.website,
        industry: record.industry,
        geographicMarket: record.geographicMarket
      },

      executiveSummary,

      businessClassification,

      businessHealth,

      topGrowthLeaks: growthLeaks.slice(0, 5),

      priorityMatrix,

      roadmap: {
        days1To30: quickWins30,
        days31To60: improvements60,
        days61To90: projects90
      },

      expectedBusinessImpact,

      implementationOptions,

      verificationRequired: buildVerificationRequirements(record, growthLeaks),

      evidenceSummary: buildEvidenceSummary(record, growthLeaks)
    };
  }

  /* =========================================================
     Business Record Validation
     ========================================================= */

  function validateBusinessRecord(record) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new TypeError(
        "Growth Intelligence Engine requires a Business Record object."
      );
    }

    const hasBusinessIdentity =
      clean(record.businessName) ||
      clean(record.website) ||
      clean(record.business?.name) ||
      clean(record.business?.website);

    if (!hasBusinessIdentity) {
      throw new Error(
        "Business Record is missing both the business name and website."
      );
    }

    return true;
  }

  /* =========================================================
     Business Record Normalization
     Supports current flat records and earlier nested records.
     ========================================================= */

  function normalizeBusinessRecord(record) {
    const business = isObject(record.business) ? record.business : {};
    const websiteIntelligence = isObject(record.websiteIntelligence)
      ? record.websiteIntelligence
      : {};
    const contactEnrichment = isObject(record.contactEnrichment)
      ? record.contactEnrichment
      : {};
    const publicPresence = isObject(record.publicPresence)
      ? record.publicPresence
      : {};
    const consultingIntelligence = isObject(record.consultingIntelligence)
      ? record.consultingIntelligence
      : {};

    return {
      businessName:
        clean(record.businessName) ||
        clean(business.name) ||
        "Business name requires verification",

      website:
        clean(record.website) ||
        clean(business.website) ||
        "Website requires verification",

      industry:
        clean(record.industry) ||
        clean(business.industry) ||
        "Industry requires verification",

      businessSummary:
        clean(record.businessSummary) ||
        clean(business.summary) ||
        clean(consultingIntelligence.executiveSummary),

      productsAndServices: firstNonEmptyArray(
        record.productsAndServices,
        websiteIntelligence.productsAndServices
      ),

      targetCustomer:
        clean(record.targetCustomer) ||
        clean(websiteIntelligence.targetCustomer),

      geographicMarket:
        clean(record.geographicMarket) ||
        clean(websiteIntelligence.geographicMarket) ||
        clean(business.market),

      trustSignals: firstNonEmptyArray(
        record.trustSignals,
        websiteIntelligence.trustSignals
      ),

      websiteObservations: firstNonEmptyArray(
        record.websiteObservations,
        websiteIntelligence.websiteObservations
      ),

      growthLeaks: normalizeExistingGrowthLeaks(record.growthLeaks),

      growthOpportunities: firstNonEmptyArray(
        record.growthOpportunities,
        websiteIntelligence.growthOpportunities,
        consultingIntelligence.topOpportunities
      ),

      missingInformation: firstNonEmptyArray(
        record.missingInformation,
        websiteIntelligence.missingInformation
      ),

      successMetrics: firstNonEmptyArray(
        record.successMetrics,
        consultingIntelligence.successMetrics
      ),

      contactEnrichment,

      publicPresence,

      qualificationScore:
        clean(record.qualificationScore) ||
        clean(record.salesIntelligence?.readinessScore),

      outreachReadiness:
        clean(record.outreachReadiness) ||
        clean(record.salesIntelligence?.outreachReadiness)
    };
  }

  /* =========================================================
     Business Classification Engine

     Deterministically classifies the observable business before
     Growth Leaks and recommendations are selected.
     ========================================================= */

  function classifyBusiness(record) {
    const signals = buildClassificationSignals(record);

    const businessProfile = classifyBusinessProfile(record, signals);
    const businessMaturity = classifyBusinessMaturity(record, signals);
    const digitalMaturity = classifyDigitalMaturity(record, signals);
    const trustMaturity = classifyTrustMaturity(record, signals);
    const customerJourneyMaturity = classifyCustomerJourney(record, signals);
    const marketingSophistication = classifyMarketingSophistication(
      record,
      signals
    );
    const growthStage = classifyGrowthStage({
      record,
      signals,
      businessProfile,
      businessMaturity,
      digitalMaturity,
      trustMaturity,
      customerJourneyMaturity,
      marketingSophistication
    });

    const consultingContext = buildConsultingContext({
      record,
      signals,
      businessProfile,
      businessMaturity,
      digitalMaturity,
      trustMaturity,
      customerJourneyMaturity,
      marketingSophistication,
      growthStage
    });

    return {
      businessProfile,
      businessMaturity,
      digitalMaturity,
      trustMaturity,
      customerJourneyMaturity,
      marketingSophistication,
      growthStage,
      consultingContext
    };
  }

  function buildClassificationSignals(record) {
    const evidenceText = [
      record.businessSummary,
      record.targetCustomer,
      record.geographicMarket,
      record.productsAndServices.join(" "),
      record.trustSignals.join(" "),
      record.websiteObservations.join(" "),
      record.growthOpportunities.join(" "),
      record.missingInformation.join(" "),
      safeStringify(record.contactEnrichment),
      safeStringify(record.publicPresence)
    ]
      .map(clean)
      .join(" ")
      .toLowerCase();

    const platformCount = countConfirmedPublicPlatforms(
      record.publicPresence
    );
    const contactChannelCount = countContactChannels(
      record.contactEnrichment
    );
    const locationCount = inferLocationCount(evidenceText);
    const reviewVolume = inferReviewVolume(evidenceText);

    return {
      evidenceText,
      evidenceItemCount:
        record.productsAndServices.length +
        record.trustSignals.length +
        record.websiteObservations.length +
        record.growthOpportunities.length,
      serviceCount: record.productsAndServices.length,
      trustCount: record.trustSignals.length,
      platformCount,
      contactChannelCount,
      locationCount,
      reviewVolume,
      hasLeadership: includesAny(evidenceText, [
        "leadership",
        "owner",
        "founder",
        "management team",
        "our team"
      ]),
      hasCaseStudies: includesAny(evidenceText, [
        "case study",
        "case studies",
        "project gallery",
        "portfolio",
        "before and after"
      ]),
      hasCredentials: includesAny(evidenceText, [
        "licensed",
        "certified",
        "accredited",
        "award",
        "warranty",
        "guarantee"
      ]),
      hasScheduling: includesAny(evidenceText, [
        "schedule",
        "book online",
        "appointment",
        "request an estimate",
        "get a quote"
      ]),
      hasFinancing: evidenceText.includes("financing"),
      hasLocationPages: includesAny(evidenceText, [
        "location pages",
        "locations page",
        "service area pages",
        "multiple locations"
      ]),
      hasAnalyticsLanguage: includesAny(evidenceText, [
        "analytics",
        "tracking",
        "attribution",
        "conversion tracking",
        "campaign landing page",
        "reporting dashboard"
      ]),
      hasNationalLanguage: includesAny(evidenceText, [
        "nationwide",
        "nationally",
        "across the united states",
        "all 50 states"
      ]),
      hasRegionalLanguage: includesAny(evidenceText, [
        "regional",
        "multi-state",
        "multiple markets",
        "across florida",
        "throughout the region"
      ]),
      hasEcommerceLanguage: includesAny(evidenceText, [
        "shopping cart",
        "add to cart",
        "shop online",
        "shipping",
        "product catalog",
        "checkout"
      ]),
      hasFranchiseLanguage: includesAny(evidenceText, [
        "franchise",
        "franchise opportunity",
        "independently owned and operated"
      ]),
      hasProfessionalServicesLanguage: includesAny(evidenceText, [
        "consultation",
        "advisor",
        "attorney",
        "accounting",
        "consulting",
        "professional services",
        "strategy firm"
      ])
    };
  }

  function classifyBusinessProfile(record, signals) {
    let classification = "Local Business";
    const evidence = [];
    const verificationRequired = [];

    if (signals.hasEcommerceLanguage) {
      classification = "Ecommerce Business";
      evidence.push("The Business Record contains observable ecommerce purchase or fulfillment language.");
    } else if (signals.hasFranchiseLanguage) {
      classification = "Franchise or Distributed Network";
      evidence.push("The Business Record contains franchise or distributed-operator language.");
    } else if (signals.hasNationalLanguage) {
      classification = "National Brand";
      evidence.push("The Business Record indicates nationwide service or national market coverage.");
    } else if (
      signals.locationCount >= 8 ||
      (signals.hasRegionalLanguage && signals.locationCount >= 3)
    ) {
      classification = "Regional Brand";
      evidence.push(
        `The Business Record indicates a regional footprint with approximately ${signals.locationCount} observable locations or markets.`
      );
    } else if (signals.locationCount >= 2 || signals.hasLocationPages) {
      classification = "Multi-Location Local Business";
      evidence.push("The Business Record indicates multiple locations, offices, or local market pages.");
    } else if (signals.hasProfessionalServicesLanguage) {
      classification = "Professional Services Firm";
      evidence.push("The observable offer is expertise-led and consultation-oriented.");
    } else {
      evidence.push(
        isMeaningful(record.geographicMarket)
          ? `The observable market is ${record.geographicMarket}.`
          : "The available evidence supports a local operating profile, but the exact footprint requires verification."
      );
    }

    if (!isMeaningful(record.geographicMarket)) {
      verificationRequired.push("Verify the primary service area and complete operating footprint.");
    }

    return classificationResult(
      classification,
      evidence,
      verificationRequired,
      evidence.length >= 2 || signals.locationCount >= 2 ? "High" : "Moderate"
    );
  }

  function classifyBusinessMaturity(record, signals) {
    let score = 0;
    const evidence = [];
    const verificationRequired = [
      "Verify business age, employee count, revenue, lead volume, and operational capacity."
    ];

    if (signals.serviceCount >= 5) score += 2;
    else if (signals.serviceCount >= 2) score += 1;

    if (signals.trustCount >= 5) score += 3;
    else if (signals.trustCount >= 3) score += 2;
    else if (signals.trustCount >= 1) score += 1;

    if (signals.reviewVolume >= 500) score += 3;
    else if (signals.reviewVolume >= 100) score += 2;
    else if (signals.reviewVolume >= 20) score += 1;

    if (signals.platformCount >= 4) score += 2;
    else if (signals.platformCount >= 2) score += 1;

    if (signals.locationCount >= 8) score += 3;
    else if (signals.locationCount >= 2) score += 2;

    if (signals.hasLeadership) score += 1;
    if (signals.hasCaseStudies) score += 1;
    if (signals.hasCredentials) score += 1;
    if (signals.evidenceItemCount >= 15) score += 2;
    else if (signals.evidenceItemCount >= 8) score += 1;

    let classification = "Startup";
    if (score >= 15) classification = "Market Leader";
    else if (score >= 12) classification = "Mature";
    else if (score >= 9) classification = "Established";
    else if (score >= 6) classification = "Growing";
    else if (score >= 3) classification = "Emerging";

    evidence.push(`${signals.serviceCount} service evidence item(s) were recorded.`);
    evidence.push(`${signals.trustCount} trust signal(s) were recorded.`);
    evidence.push(`${signals.platformCount} public platform(s) were confirmed.`);
    if (signals.locationCount > 1) {
      evidence.push(`${signals.locationCount} locations or markets were inferred from observable evidence.`);
    }
    if (signals.reviewVolume > 0) {
      evidence.push(`Observable review language indicates at least ${signals.reviewVolume} reviews.`);
    }

    return classificationResult(
      classification,
      evidence,
      verificationRequired,
      signals.evidenceItemCount >= 8 ? "High" : signals.evidenceItemCount >= 3 ? "Moderate" : "Low"
    );
  }

  function classifyDigitalMaturity(record, signals) {
    let score = 0;
    const evidence = [];
    const verificationRequired = [];

    if (isMeaningful(record.businessSummary)) score += 1;
    if (signals.serviceCount >= 3) score += 2;
    else if (signals.serviceCount >= 1) score += 1;
    if (signals.contactChannelCount >= 2) score += 2;
    else if (signals.contactChannelCount === 1) score += 1;
    if (signals.platformCount >= 3) score += 2;
    else if (signals.platformCount >= 1) score += 1;
    if (signals.hasLocationPages) score += 2;
    if (signals.hasScheduling) score += 1;
    if (signals.hasFinancing) score += 1;
    if (signals.hasCaseStudies) score += 1;

    let classification = "Basic";
    if (score >= 10) classification = "Advanced";
    else if (score >= 6) classification = "Strong";
    else if (score >= 3) classification = "Developing";

    evidence.push(`${signals.serviceCount} service item(s) support the visible content depth.`);
    evidence.push(`${signals.contactChannelCount} verified contact path(s) support the digital customer experience.`);
    evidence.push(`${signals.platformCount} public platform(s) support the wider digital presence.`);
    if (!signals.hasAnalyticsLanguage) {
      verificationRequired.push("Verify analytics, conversion tracking, technical SEO, and campaign infrastructure.");
    }

    return classificationResult(
      classification,
      evidence,
      verificationRequired,
      signals.evidenceItemCount >= 6 ? "Moderate" : "Low"
    );
  }

  function classifyTrustMaturity(record, signals) {
    let classification = "Weak";
    const evidence = [];
    const verificationRequired = [];

    const trustScore =
      signals.trustCount +
      (signals.hasCredentials ? 2 : 0) +
      (signals.hasCaseStudies ? 2 : 0) +
      (signals.hasLeadership ? 1 : 0) +
      (signals.reviewVolume >= 100 ? 3 : signals.reviewVolume >= 20 ? 1 : 0);

    if (trustScore >= 10) classification = "Exceptional";
    else if (trustScore >= 6) classification = "Strong";
    else if (trustScore >= 2) classification = "Developing";

    evidence.push(`${signals.trustCount} explicit trust signal(s) were captured in the Business Record.`);
    if (signals.hasCredentials) evidence.push("Credentials, certification, warranty, guarantee, or award language is visible.");
    if (signals.hasCaseStudies) evidence.push("Case studies, project evidence, or portfolio proof is visible.");
    if (signals.reviewVolume > 0) evidence.push(`Observable review evidence indicates at least ${signals.reviewVolume} reviews.`);

    if (signals.reviewVolume === 0) {
      verificationRequired.push("Verify review count, rating, testimonial quality, and third-party reputation evidence.");
    }

    return classificationResult(
      classification,
      evidence,
      verificationRequired,
      signals.trustCount >= 3 || signals.reviewVolume > 0 ? "High" : "Moderate"
    );
  }

  function classifyCustomerJourney(record, signals) {
    let score = 0;
    const evidence = [];
    const verificationRequired = [];

    score += signals.contactChannelCount;
    if (signals.hasScheduling) score += 2;
    if (signals.hasFinancing) score += 1;
    if (record.growthOpportunities.length > 0) score += 1;
    if (signals.hasCaseStudies || signals.trustCount >= 3) score += 1;

    let classification = "Fragmented";
    if (score >= 7) classification = "Optimized";
    else if (score >= 4) classification = "Strong";
    else if (score >= 2) classification = "Developing";

    evidence.push(`${signals.contactChannelCount} verified customer contact path(s) were found.`);
    if (signals.hasScheduling) evidence.push("Scheduling, quote, estimate, or appointment language supports a defined next step.");
    if (signals.hasFinancing) evidence.push("Financing support is observable in the customer journey.");

    verificationRequired.push("Verify mobile usability, form completion, lead routing, response time, and actual conversion performance.");

    return classificationResult(
      classification,
      evidence,
      verificationRequired,
      signals.contactChannelCount >= 1 ? "Moderate" : "Low"
    );
  }

  function classifyMarketingSophistication(record, signals) {
    let classification = "Basic";
    const evidence = [];
    const verificationRequired = [];

    let score = signals.platformCount;
    if (signals.hasLocationPages) score += 2;
    if (signals.hasCaseStudies) score += 1;
    if (signals.hasAnalyticsLanguage) score += 3;
    if (record.successMetrics.length > 0) score += 2;

    if (score >= 9) classification = "Data-Driven";
    else if (score >= 6) classification = "Integrated";
    else if (score >= 2) classification = "Active";

    evidence.push(`${signals.platformCount} public marketing platform(s) were confirmed.`);
    if (signals.hasLocationPages) evidence.push("Location or market segmentation is observable.");
    if (signals.hasAnalyticsLanguage) evidence.push("Analytics, attribution, tracking, or reporting language is observable.");

    if (classification !== "Data-Driven") {
      verificationRequired.push("Verify campaign activity, marketing budget, attribution, lead-source reporting, and optimization process.");
    } else {
      verificationRequired.push("Confirm that visible analytics language reflects active internal reporting and optimization.");
    }

    return classificationResult(
      classification,
      evidence,
      verificationRequired,
      signals.platformCount >= 2 ? "Moderate" : "Low"
    );
  }

  function classifyGrowthStage(context) {
    const clarityScore = scoreClarity(context.record);
    const visibilityScore = scoreVisibility(context.record);
    const conversionScore = scoreConversion(context.record);
    let classification = "Foundation";
    const evidence = [];
    const verificationRequired = [];

    if (
      context.businessMaturity.classification === "Mature" ||
      context.businessMaturity.classification === "Market Leader"
    ) {
      classification = context.signals.locationCount >= 2
        ? "Measurement and Optimization"
        : "Competitive Advantage";
    } else if (context.digitalMaturity.classification === "Basic") {
      classification = "Foundation";
    } else if (clarityScore < 60) {
      classification = "Offer Clarity";
    } else if (context.trustMaturity.classification === "Weak") {
      classification = "Trust Building";
    } else if (visibilityScore < 55) {
      classification = "Visibility";
    } else if (
      context.customerJourneyMaturity.classification === "Fragmented" ||
      conversionScore < 55
    ) {
      classification = "Conversion Optimization";
    } else if (
      context.businessProfile.classification === "Regional Brand" ||
      context.businessProfile.classification === "Multi-Location Local Business"
    ) {
      classification = "Market Expansion";
    } else {
      classification = "Lead Generation";
    }

    evidence.push(`Business maturity is classified as ${context.businessMaturity.classification}.`);
    evidence.push(`Digital maturity is classified as ${context.digitalMaturity.classification}.`);
    evidence.push(`Trust maturity is classified as ${context.trustMaturity.classification}.`);
    evidence.push(`Customer journey maturity is classified as ${context.customerJourneyMaturity.classification}.`);
    verificationRequired.push("Confirm current lead volume, conversion rate, close rate, average customer value, and capacity before finalizing the growth stage.");

    return classificationResult(
      classification,
      evidence,
      verificationRequired,
      "Moderate"
    );
  }

  function buildConsultingContext(context) {
    const maturity = context.businessMaturity.classification;
    const profile = context.businessProfile.classification;
    let appropriateRecommendationLevel = "Foundational";

    if (maturity === "Market Leader") {
      appropriateRecommendationLevel = "Market Leadership";
    } else if (
      maturity === "Mature" ||
      profile === "Regional Brand" ||
      profile === "National Brand" ||
      profile === "Enterprise Organization"
    ) {
      appropriateRecommendationLevel = "Optimization";
    } else if (
      maturity === "Growing" ||
      maturity === "Established"
    ) {
      appropriateRecommendationLevel = "Growth";
    } else if (!context.record.businessSummary) {
      appropriateRecommendationLevel = "Requires Verification";
    }

    const primaryConsultingFocus = getPrimaryConsultingFocus(context).slice(0, 5);
    const avoidGenericRecommendations = getAvoidGenericRecommendations(context);

    return {
      summary:
        `Based on publicly observable evidence, ${context.record.businessName} appears to be a ` +
        `${maturity.toLowerCase()} ${profile.toLowerCase()} with ` +
        `${context.digitalMaturity.classification.toLowerCase()} digital maturity, ` +
        `${context.trustMaturity.classification.toLowerCase()} trust maturity, and a ` +
        `${context.customerJourneyMaturity.classification.toLowerCase()} customer journey. ` +
        `The most relevant growth stage is ${context.growthStage.classification}.`,
      appropriateRecommendationLevel,
      primaryConsultingFocus,
      avoidGenericRecommendations
    };
  }

  function getPrimaryConsultingFocus(context) {
    const stage = context.growthStage.classification;
    const mapping = {
      Foundation: ["Business identity", "Offer clarity", "Contact experience", "Foundational trust", "Basic measurement"],
      Visibility: ["Local visibility", "Search presence", "Market relevance", "Public profile consistency", "Visibility measurement"],
      "Offer Clarity": ["Homepage messaging", "Service clarity", "Customer fit", "Differentiation", "Next-step clarity"],
      "Trust Building": ["Review strength", "Credentials", "Project proof", "Company transparency", "Proof near conversion points"],
      "Lead Generation": ["Qualified demand", "Search growth", "Campaign segmentation", "Lead-source expansion", "Lead quality measurement"],
      "Conversion Optimization": ["Conversion performance", "Contact friction", "Calls to action", "Lead follow-up", "Conversion measurement"],
      Scaling: ["Repeatable campaigns", "Lead routing", "Market segmentation", "Capacity alignment", "Performance reporting"],
      "Market Expansion": ["Location-level visibility", "Market-specific messaging", "Local proof", "Lead routing", "Market-level measurement"],
      "Competitive Advantage": ["Competitive differentiation", "Authority", "Customer experience", "Brand leadership", "Strategic measurement"],
      "Measurement and Optimization": ["Lead attribution", "Conversion performance", "Location-level performance", "Competitive differentiation", "Revenue measurement"]
    };

    return mapping[stage] || ["Evidence verification", "Growth prioritization", "Conversion", "Measurement"];
  }

  function getAvoidGenericRecommendations(context) {
    const avoid = [];
    const maturity = context.businessMaturity.classification;
    const trust = context.trustMaturity.classification;
    const digital = context.digitalMaturity.classification;

    if (trust === "Strong" || trust === "Exceptional") {
      avoid.push("Do not default to basic review-generation advice because the business already shows meaningful trust strength.");
    }
    if (digital === "Strong" || digital === "Advanced") {
      avoid.push("Do not default to foundational website-content advice without a specific observable deficiency.");
    }
    if (maturity === "Mature" || maturity === "Market Leader") {
      avoid.push("Do not recommend more marketing activity before evaluating conversion, attribution, and market-level performance.");
    }
    if (context.signals.locationCount >= 2) {
      avoid.push("Do not treat broad service-area clarification as the primary constraint without evaluating the existing location architecture.");
    }
    if (context.marketingSophistication.classification === "Basic") {
      avoid.push("Do not recommend advanced attribution before the business has a functioning acquisition and measurement foundation.");
    }

    return avoid;
  }

  function classificationResult(
    classification,
    evidence,
    verificationRequired,
    confidence
  ) {
    return {
      classification,
      confidence: confidence || inferConfidence(evidence),
      evidence: unique(evidence),
      verificationRequired: unique(verificationRequired)
    };
  }

  function inferConfidence(evidence) {
    if (evidence.length >= 3) return "High";
    if (evidence.length >= 1) return "Moderate";
    return "Low";
  }

  function applyClassificationRules(leaks, classification) {
    const context = classification.consultingContext;
    const maturity = classification.businessMaturity.classification;
    const trust = classification.trustMaturity.classification;
    const digital = classification.digitalMaturity.classification;
    const stage = classification.growthStage.classification;

    return leaks
      .filter(function (leak) {
        const text = `${leak.category} ${leak.finding} ${leak.recommendedAction}`.toLowerCase();

        if (
          (trust === "Strong" || trust === "Exceptional") &&
          leak.id === "trust-proof-gap"
        ) {
          return false;
        }

        if (
          (trust === "Strong" || trust === "Exceptional") &&
          includesAny(text, ["collect more reviews", "basic review collection", "build foundational reviews"])
        ) {
          return false;
        }

        if (
          (digital === "Strong" || digital === "Advanced") &&
          includesAny(text, ["build a basic website", "create foundational website content", "new website"])
        ) {
          return false;
        }

        if (
          classification.businessProfile.classification !== "Local Business" &&
          includesAny(text, ["clarify the primary service area", "single service area"])
        ) {
          return false;
        }

        return true;
      })
      .map(function (leak) {
        let adjustedPriority = leak.priority;
        let maturityFit = "Appropriate";

        if (
          (maturity === "Mature" || maturity === "Market Leader") &&
          includesAny(leak.category.toLowerCase(), ["measurement", "conversion", "visibility"])
        ) {
          adjustedPriority = raisePriority(adjustedPriority);
        }

        if (
          stage === "Foundation" &&
          includesAny(leak.category.toLowerCase(), ["clarity", "trust", "conversion", "information"])
        ) {
          adjustedPriority = raisePriority(adjustedPriority);
        }

        if (
          context.avoidGenericRecommendations.some(function (rule) {
            return normalizeForComparison(rule).includes(
              normalizeForComparison(leak.finding).slice(0, 40)
            );
          })
        ) {
          maturityFit = "Requires Verification";
        }

        return Object.assign({}, leak, {
          priority: adjustedPriority,
          maturityFit,
          recommendationLevel: context.appropriateRecommendationLevel,
          growthStage: stage
        });
      });
  }

  function raisePriority(priority) {
    if (priority === "Low") return "Medium";
    if (priority === "Medium") return "High";
    return priority;
  }

  function countContactChannels(contact) {
    if (!isObject(contact)) return 0;

    let count = 0;
    if (clean(contact.primaryPhone || contact.phone || contact.businessPhone)) count += 1;
    if (clean(contact.primaryEmail || contact.email || contact.businessEmail)) count += 1;
    if (clean(contact.contactPage)) count += 1;
    if (clean(contact.bookingUrl || contact.scheduleUrl)) count += 1;
    return count;
  }

  function inferLocationCount(text) {
    const explicitMatches = text.match(/\b(\d{1,3})\s+(?:locations|offices|branches|markets)\b/g) || [];
    const numbers = explicitMatches
      .map(function (match) {
        const numberMatch = match.match(/\d{1,3}/);
        return numberMatch ? Number(numberMatch[0]) : 0;
      })
      .filter(Boolean);

    if (numbers.length > 0) return Math.max.apply(null, numbers);
    if (includesAny(text, ["multiple locations", "several locations", "location network"])) return 2;
    return 1;
  }

  function inferReviewVolume(text) {
    const matches = text.match(/\b([\d,]{1,9})\+?\s+(?:google\s+)?reviews?\b/g) || [];
    const numbers = matches
      .map(function (match) {
        const numberMatch = match.match(/[\d,]+/);
        return numberMatch ? Number(numberMatch[0].replace(/,/g, "")) : 0;
      })
      .filter(Boolean);

    return numbers.length > 0 ? Math.max.apply(null, numbers) : 0;
  }

  function safeStringify(value) {
    try {
      return JSON.stringify(value || {});
    } catch (error) {
      return "";
    }
  }

  /* =========================================================
     Growth Leak Identification
     ========================================================= */

  function identifyGrowthLeaks(record, businessClassification) {
    const leaks = [];

    record.growthLeaks.forEach(function (leak, index) {
      leaks.push(
        createGrowthLeak({
          id: `existing-leak-${index + 1}`,
          category: leak.leakType || "Growth Opportunity",
          finding: leak.finding,
          observableEvidence: leak.observableEvidence,
          whyItMatters:
            leak.whyItMatters ||
            explainWhyFindingMatters(leak.finding, leak.leakType),
          businessImpact:
            leak.businessImpact ||
            inferBusinessImpact(leak.finding, leak.leakType),
          priority: normalizePriority(leak.priority),
          estimatedEffort: normalizeEffort(
            leak.estimatedEffort || leak.difficulty
          ),
          expectedOutcome:
            leak.expectedOutcome ||
            inferExpectedOutcome(leak.finding, leak.leakType),
          recommendedAction:
            leak.recommendedAction ||
            leak.recommendedNextAction ||
            "Verify the finding and define a measurable improvement."
        })
      );
    });

    addMissingInformationLeaks(record, leaks);
    addTrustLeaks(record, leaks);
    addContactLeaks(record, leaks);
    addPublicPresenceLeaks(record, leaks);
    addMeasurementLeaks(record, leaks);
    addWebsiteObservationLeaks(record, leaks);
    addOpportunityLeaks(record, leaks);

    const classificationAdjustedLeaks = businessClassification
      ? applyClassificationRules(leaks, businessClassification)
      : leaks;

    const uniqueLeaks = deduplicateGrowthLeaks(classificationAdjustedLeaks)
      .filter(hasUsableEvidence)
      .map(scoreGrowthLeak)
      .sort(sortByPriorityScore);

    return uniqueLeaks;
  }

  function addMissingInformationLeaks(record, leaks) {
    record.missingInformation.forEach(function (item, index) {
      const text = clean(item);

      if (!text) return;

      leaks.push(
        createGrowthLeak({
          id: `missing-information-${index + 1}`,
          category: categorizeText(text, "Information Gap"),
          finding: text,
          observableEvidence:
            `The Business Record identifies this information as missing or unclear: ${text}`,
          whyItMatters:
            "Missing decision-making information can reduce customer confidence and prevent prospects from taking the next step.",
          businessImpact:
            "Potential prospects may leave, delay contact, or choose a competitor that communicates the information more clearly.",
          priority: containsHighPriorityTerms(text) ? "High" : "Medium",
          estimatedEffort: "Low",
          expectedOutcome:
            "Prospects can make faster and more confident decisions.",
          recommendedAction:
            "Verify the missing information and add it to the most relevant customer decision point."
        })
      );
    });
  }

  function addTrustLeaks(record, leaks) {
    if (record.trustSignals.length >= 3) return;

    const evidence =
      record.trustSignals.length > 0
        ? `Only ${record.trustSignals.length} clear trust signal${
            record.trustSignals.length === 1 ? " was" : "s were"
          } recorded: ${record.trustSignals.join("; ")}`
        : "The Business Record did not identify clear trust signals.";

    leaks.push(
      createGrowthLeak({
        id: "trust-proof-gap",
        category: "Trust Leak",
        finding:
          "The public evidence contains limited visible proof that reduces perceived customer risk.",
        observableEvidence: evidence,
        whyItMatters:
          "Prospects use reviews, credentials, project examples, guarantees, and other proof to decide whether a business feels safe to contact.",
        businessImpact:
          "Weak trust proof can reduce calls, form submissions, booked estimates, and close rates.",
        priority: record.trustSignals.length === 0 ? "High" : "Medium",
        estimatedEffort: "Medium",
        expectedOutcome:
          "Stronger customer confidence and a higher percentage of visitors taking the next step.",
        recommendedAction:
          "Organize and strengthen the most credible trust signals near primary calls to action."
      })
    );
  }

  function addContactLeaks(record, leaks) {
    const contact = record.contactEnrichment;
    const email = clean(
      contact.primaryEmail || contact.email || contact.businessEmail
    );
    const phone = clean(
      contact.primaryPhone || contact.phone || contact.businessPhone
    );
    const contactPage = clean(contact.contactPage);

    if (email || phone || contactPage) return;

    leaks.push(
      createGrowthLeak({
        id: "contact-path-gap",
        category: "Conversion Leak",
        finding:
          "The Business Record does not contain a clearly verified public contact path.",
        observableEvidence:
          "No primary email, primary phone number, or contact page was confirmed in the Business Record.",
        whyItMatters:
          "A prospect who cannot immediately identify how to contact the business may abandon the buying process.",
        businessImpact:
          "Qualified traffic may fail to become calls, form submissions, estimates, or appointments.",
        priority: "High",
        estimatedEffort: "Low",
        expectedOutcome:
          "A clearer path from visitor interest to a measurable inquiry.",
        recommendedAction:
          "Verify the primary contact path and place one clear action consistently across high-intent pages."
      })
    );
  }

  function addPublicPresenceLeaks(record, leaks) {
    const presence = record.publicPresence;

    if (!isObject(presence) || Object.keys(presence).length === 0) {
      leaks.push(
        createGrowthLeak({
          id: "public-presence-unverified",
          category: "Visibility Leak",
          finding:
            "The Business Record does not contain enough evidence to evaluate the business's public platform presence.",
          observableEvidence:
            "Public Presence information is absent or incomplete in the Business Record.",
          whyItMatters:
            "Prospects often confirm legitimacy across search and social platforms before contacting a business.",
          businessImpact:
            "Unverified or inconsistent presence may reduce discovery, recognition, and trust.",
          priority: "Medium",
          estimatedEffort: "Medium",
          expectedOutcome:
            "A more consistent and verifiable public identity across customer research points.",
          recommendedAction:
            "Verify official public profiles and ensure the business identity and contact information are consistent."
        })
      );

      return;
    }

    const platformCount = countConfirmedPublicPlatforms(presence);

    if (platformCount >= 2) return;

    leaks.push(
      createGrowthLeak({
        id: "limited-public-presence",
        category: "Visibility Leak",
        finding:
          "The Business Record confirms a limited official public presence.",
        observableEvidence:
          `${platformCount} official public platform${
            platformCount === 1 ? " was" : "s were"
          } clearly confirmed.`,
        whyItMatters:
          "A limited presence gives customers fewer places to discover, verify, and engage with the business.",
        businessImpact:
          "The business may lose visibility and trust during the customer research process.",
        priority: "Medium",
        estimatedEffort: "Medium",
        expectedOutcome:
          "Improved visibility, brand consistency, and customer verification.",
        recommendedAction:
          "Verify the platforms most relevant to the target customer and establish complete, consistent profiles."
      })
    );
  }

  function addMeasurementLeaks(record, leaks) {
    if (record.successMetrics.length > 0) return;

    leaks.push(
      createGrowthLeak({
        id: "measurement-gap",
        category: "Measurement Leak",
        finding:
          "The Business Record does not contain confirmed success metrics for the current growth system.",
        observableEvidence:
          "No measurable success metrics were recorded in the Business Record.",
        whyItMatters:
          "Without defined metrics, the business cannot reliably prove which improvements create leads, conversions, or revenue.",
        businessImpact:
          "Marketing decisions may be based on activity or opinion instead of measurable business results.",
        priority: "High",
        estimatedEffort: "Low",
        expectedOutcome:
          "A measurable baseline for calls, forms, bookings, estimates, conversion rate, and revenue contribution.",
        recommendedAction:
          "Define the primary conversion event and establish a 90-day measurement baseline."
      })
    );
  }

  function addWebsiteObservationLeaks(record, leaks) {
    record.websiteObservations.forEach(function (observation, index) {
      const text = clean(observation);

      if (!text || isPositiveStatement(text)) return;
      if (!containsConcernTerms(text)) return;

      leaks.push(
        createGrowthLeak({
          id: `website-observation-${index + 1}`,
          category: categorizeText(text, "Website Leak"),
          finding: text,
          observableEvidence:
            `The Business Record contains this website observation: ${text}`,
          whyItMatters: explainWhyFindingMatters(text, "Website Leak"),
          businessImpact: inferBusinessImpact(text, "Website Leak"),
          priority: containsHighPriorityTerms(text) ? "High" : "Medium",
          estimatedEffort: inferEffort(text),
          expectedOutcome: inferExpectedOutcome(text, "Website Leak"),
          recommendedAction:
            "Verify the observation and improve the related customer decision point."
        })
      );
    });
  }

  function addOpportunityLeaks(record, leaks) {
    if (leaks.length >= 5) return;

    record.growthOpportunities.forEach(function (opportunity, index) {
      const text = clean(opportunity);

      if (!text) return;

      leaks.push(
        createGrowthLeak({
          id: `growth-opportunity-${index + 1}`,
          category: categorizeText(text, "Growth Opportunity"),
          finding: text,
          observableEvidence:
            `The Business Record identifies this growth opportunity: ${text}`,
          whyItMatters: explainWhyFindingMatters(text, "Growth Opportunity"),
          businessImpact: inferBusinessImpact(text, "Growth Opportunity"),
          priority: containsHighPriorityTerms(text) ? "High" : "Medium",
          estimatedEffort: inferEffort(text),
          expectedOutcome: inferExpectedOutcome(
            text,
            "Growth Opportunity"
          ),
          recommendedAction: text
        })
      );
    });
  }

  /* =========================================================
     Business Health Score
     ========================================================= */

  function calculateBusinessHealth(record, growthLeaks) {
    const categoryScores = {
      clarity: scoreClarity(record),
      trust: scoreTrust(record),
      conversion: scoreConversion(record),
      visibility: scoreVisibility(record),
      measurement: scoreMeasurement(record)
    };

    const rawScore = Math.round(
      categoryScores.clarity * 0.25 +
        categoryScores.trust * 0.2 +
        categoryScores.conversion * 0.25 +
        categoryScores.visibility * 0.15 +
        categoryScores.measurement * 0.15
    );

    const criticalPenalty =
      growthLeaks.filter(function (leak) {
        return leak.priority === "Critical";
      }).length * 5;

    const highPenalty =
      growthLeaks.filter(function (leak) {
        return leak.priority === "High";
      }).length * 2;

    const score = clamp(rawScore - criticalPenalty - highPenalty, 0, 100);

    return {
      score,
      rating: getHealthRating(score),
      categoryScores,
      scoringMethod:
        "Deterministic evidence-coverage score based only on Business Record completeness and identified growth leaks.",
      strongestArea: getStrongestCategory(categoryScores),
      weakestArea: getWeakestCategory(categoryScores)
    };
  }

  function scoreClarity(record) {
    let score = 0;

    if (isMeaningful(record.businessSummary)) score += 25;
    if (record.productsAndServices.length > 0) score += 25;
    if (isMeaningful(record.targetCustomer)) score += 25;
    if (isMeaningful(record.geographicMarket)) score += 25;

    return score;
  }

  function scoreTrust(record) {
    const count = record.trustSignals.length;

    if (count >= 5) return 100;
    if (count === 4) return 85;
    if (count === 3) return 70;
    if (count === 2) return 50;
    if (count === 1) return 30;

    return 10;
  }

  function scoreConversion(record) {
    const contact = record.contactEnrichment;
    let score = 20;

    if (clean(contact.primaryPhone || contact.phone)) score += 25;
    if (clean(contact.primaryEmail || contact.email)) score += 20;
    if (clean(contact.contactPage)) score += 20;
    if (record.growthOpportunities.length > 0) score += 15;

    return clamp(score, 0, 100);
  }

  function scoreVisibility(record) {
    const platformCount = countConfirmedPublicPlatforms(
      record.publicPresence
    );

    if (platformCount >= 5) return 100;
    if (platformCount === 4) return 85;
    if (platformCount === 3) return 70;
    if (platformCount === 2) return 55;
    if (platformCount === 1) return 35;

    return 15;
  }

  function scoreMeasurement(record) {
    const metricCount = record.successMetrics.length;

    if (metricCount >= 4) return 100;
    if (metricCount === 3) return 80;
    if (metricCount === 2) return 60;
    if (metricCount === 1) return 40;

    return 10;
  }

  /* =========================================================
     Priority Matrix
     ========================================================= */

  function buildPriorityMatrix(growthLeaks) {
    return growthLeaks.map(function (leak) {
      const impactScore = PRIORITY_WEIGHTS[leak.priority] || 1;
      const effortScore = EFFORT_WEIGHTS[leak.estimatedEffort] || 2;
      const opportunityScore = impactScore * 10 - effortScore * 3;

      return {
        leakId: leak.id,
        category: leak.category,
        finding: leak.finding,
        priority: leak.priority,
        estimatedEffort: leak.estimatedEffort,
        impactScore,
        effortScore,
        opportunityScore,
        quadrant: getPriorityQuadrant(impactScore, effortScore),
        recommendedSequence: getRecommendedSequence(
          impactScore,
          effortScore
        )
      };
    });
  }

  /* =========================================================
     30 / 60 / 90-Day Roadmap
     ========================================================= */

  function build30DayQuickWins(priorityMatrix) {
    return buildRoadmapItems(
      priorityMatrix.filter(function (item) {
        return (
          item.estimatedEffort === "Low" ||
          item.quadrant === "Quick Win"
        );
      }),
      "Days 1–30",
      3
    );
  }

  function build60DayImprovements(priorityMatrix) {
    return buildRoadmapItems(
      priorityMatrix.filter(function (item) {
        return (
          item.estimatedEffort === "Medium" &&
          item.quadrant !== "Quick Win"
        );
      }),
      "Days 31–60",
      3
    );
  }

  function build90DayStrategicProjects(priorityMatrix) {
    return buildRoadmapItems(
      priorityMatrix.filter(function (item) {
        return item.estimatedEffort === "High";
      }),
      "Days 61–90",
      3
    );
  }

  function buildRoadmapItems(items, timeframe, limit) {
    return items
      .slice()
      .sort(function (a, b) {
        return b.opportunityScore - a.opportunityScore;
      })
      .slice(0, limit)
      .map(function (item, index) {
        return {
          sequence: index + 1,
          timeframe,
          leakId: item.leakId,
          category: item.category,
          action: buildActionFromFinding(item.finding),
          reason:
            "This action addresses an evidence-based growth leak with a favorable balance of business impact and implementation effort.",
          priority: item.priority,
          estimatedEffort: item.estimatedEffort,
          successMeasure: getSuccessMeasure(item.category)
        };
      });
  }

  /* =========================================================
     Business Impact
     ========================================================= */

  function buildExpectedBusinessImpact(
    growthLeaks,
    quickWins30,
    improvements60,
    projects90
  ) {
    const impactAreas = unique(
      growthLeaks.map(function (leak) {
        return mapCategoryToImpactArea(leak.category);
      })
    );

    return {
      primaryImpactAreas: impactAreas,
      expectedNearTermImpact:
        quickWins30.length > 0
          ? "Reduce immediate friction and create clearer paths to measurable customer action."
          : "Verify the highest-priority leak before estimating near-term impact.",

      expectedMidTermImpact:
        improvements60.length > 0
          ? "Strengthen trust, conversion, visibility, or measurement systems that influence lead quality and decision confidence."
          : "Mid-term impact requires additional verified Business Record evidence.",

      expectedLongTermImpact:
        projects90.length > 0
          ? "Build repeatable growth infrastructure that can be measured, improved, and connected to business results."
          : "Long-term projects should be selected after the first 30 to 60 days establish a reliable baseline.",

      revenueStatement:
        "Revenue impact cannot be estimated responsibly until average customer value, lead volume, conversion rate, and close rate are verified.",

      proofRequirements: [
        "Baseline qualified inquiries before implementation.",
        "Primary conversion event and conversion rate.",
        "Lead quality and booked-opportunity rate.",
        "Average customer or project value.",
        "90-day change in calls, forms, bookings, estimates, or sales."
      ]
    };
  }

  /* =========================================================
     Implementation Options
     ========================================================= */

  function buildImplementationOptions(
    quickWins30,
    improvements60,
    projects90
  ) {
    const totalActions =
      quickWins30.length + improvements60.length + projects90.length;

    return [
      {
        option: "Internal Implementation",
        description:
          "The business uses the 90-day roadmap and assigns each verified action to its internal team.",
        bestFor:
          "Businesses with available staff, technical access, and clear accountability.",
        requiredControls: [
          "Assign one owner to every action.",
          "Establish baseline metrics before making changes.",
          "Review progress at least every 30 days."
        ]
      },
      {
        option: "Global Concepts Media Implementation",
        description:
          "Global Concepts Media verifies priorities, executes approved improvements, and measures results.",
        bestFor:
          "Businesses that want expert execution and a single accountable growth partner.",
        requiredControls: [
          "Confirm access and implementation scope.",
          "Approve the first 30-day priorities.",
          "Measure progress against agreed business outcomes."
        ]
      },
      {
        option: "Qualified Third-Party Implementation",
        description:
          "The business gives the evidence, priorities, and roadmap to another qualified provider.",
        bestFor:
          "Businesses with an existing specialist or preferred implementation partner.",
        requiredControls: [
          "Require the provider to address the documented evidence.",
          "Connect every task to a measurable outcome.",
          "Review results against the original Business Record."
        ]
      },
      {
        option: "Phased Growth Partnership",
        description:
          `Implement the roadmap in controlled phases across ${
            totalActions || "the verified"
          } priority actions, then measure and improve the system.`,
        bestFor:
          "Businesses that want ongoing execution, measurement, and continuous improvement.",
        requiredControls: [
          "Complete the highest-value phase first.",
          "Measure before expanding scope.",
          "Update priorities using verified results."
        ]
      }
    ];
  }

  /* =========================================================
     Executive Summary
     ========================================================= */

  function buildExecutiveSummary(record, businessHealth, growthLeaks, businessClassification) {
    const topLeak = growthLeaks[0];

    const classificationSummary = businessClassification
      ? businessClassification.consultingContext.summary
      : "The observable business classification requires verification.";

    const currentPosition =
      `${record.businessName} received a Business Health Score of ` +
      `${businessHealth.score}/100, rated ${businessHealth.rating}. ` +
      classificationSummary;

    const primaryFinding = topLeak
      ? `The highest-priority growth leak is a ${topLeak.category.toLowerCase()}: ${topLeak.finding}`
      : "The Business Record does not contain enough evidence to identify a verified growth leak.";

    const recommendedDirection = topLeak
      ? `The first priority is to ${lowercaseFirst(
          topLeak.recommendedAction
        )}`
      : "The first priority is to strengthen the Business Record before recommending implementation.";

    return {
      currentPosition,
      primaryFinding,
      recommendedDirection,
      consultantNarrative:
        `${currentPosition} ${primaryFinding} ${recommendedDirection} ` +
        "The recommended 90-day plan should begin with verification, establish measurable baselines, complete the highest-value quick wins, and then advance into larger strategic improvements."
    };
  }

  /* =========================================================
     Verification and Evidence
     ========================================================= */

  function buildVerificationRequirements(record, growthLeaks) {
    const requirements = record.missingInformation.slice();

    if (!record.successMetrics.length) {
      requirements.push(
        "Verify current lead volume, conversion rate, close rate, and average customer value."
      );
    }

    if (!record.trustSignals.length) {
      requirements.push(
        "Verify available reviews, testimonials, credentials, project examples, guarantees, and other customer proof."
      );
    }

    if (growthLeaks[0]) {
      requirements.push(
        `Confirm the highest-priority finding before implementation: ${growthLeaks[0].finding}`
      );
    }

    return unique(requirements).slice(0, 10);
  }

  function buildEvidenceSummary(record, growthLeaks) {
    const evidenceItems =
      record.websiteObservations.length +
      record.trustSignals.length +
      record.growthLeaks.length +
      record.growthOpportunities.length;

    return {
      totalEvidenceItems: evidenceItems,
      growthLeaksCreated: growthLeaks.length,
      trustSignalsRecorded: record.trustSignals.length,
      websiteObservationsRecorded: record.websiteObservations.length,
      missingInformationItems: record.missingInformation.length,
      evidenceQuality: getEvidenceQuality(evidenceItems),
      limitation:
        "This intelligence is limited to information already contained in the Business Record."
    };
  }

  /* =========================================================
     Growth Leak Helpers
     ========================================================= */

  function createGrowthLeak(values) {
    return {
      id: clean(values.id),
      category: clean(values.category) || "Growth Opportunity",
      finding: clean(values.finding),
      observableEvidence: clean(values.observableEvidence),
      whyItMatters: clean(values.whyItMatters),
      businessImpact: clean(values.businessImpact),
      priority: normalizePriority(values.priority),
      estimatedEffort: normalizeEffort(values.estimatedEffort),
      expectedOutcome: clean(values.expectedOutcome),
      recommendedAction: clean(values.recommendedAction),
      evidenceSource: "Business Record"
    };
  }

  function scoreGrowthLeak(leak) {
    const priorityScore = PRIORITY_WEIGHTS[leak.priority] || 1;
    const effortScore = EFFORT_WEIGHTS[leak.estimatedEffort] || 2;

    return Object.assign({}, leak, {
      score: priorityScore * 10 - effortScore * 2
    });
  }

  function sortByPriorityScore(a, b) {
    return b.score - a.score;
  }

  function hasUsableEvidence(leak) {
    return Boolean(
      clean(leak.finding) &&
        clean(leak.observableEvidence) &&
        clean(leak.businessImpact)
    );
  }

  function deduplicateGrowthLeaks(leaks) {
    const seen = new Set();

    return leaks.filter(function (leak) {
      const key = normalizeForComparison(
        `${leak.category} ${leak.finding}`
      );

      if (!key || seen.has(key)) return false;

      seen.add(key);
      return true;
    });
  }

  function normalizeExistingGrowthLeaks(value) {
    if (!Array.isArray(value)) return [];

    return value
      .filter(isObject)
      .map(function (leak) {
        return {
          leakType: clean(
            leak.leakType || leak.category || leak.type
          ),
          finding: clean(
            leak.finding || leak.observation || leak.issue
          ),
          observableEvidence: clean(
            leak.observableEvidence || leak.evidence
          ),
          whyItMatters: clean(leak.whyItMatters),
          businessImpact: clean(leak.businessImpact || leak.impact),
          priority: normalizePriority(leak.priority),
          estimatedEffort: normalizeEffort(
            leak.estimatedEffort || leak.difficulty || leak.effort
          ),
          expectedOutcome: clean(leak.expectedOutcome),
          recommendedAction: clean(
            leak.recommendedAction || leak.recommendedNextAction
          )
        };
      })
      .filter(function (leak) {
        return leak.finding || leak.observableEvidence;
      });
  }

  /* =========================================================
     Inference Helpers
     ========================================================= */

  function categorizeText(text, fallback) {
    const value = clean(text).toLowerCase();

    if (
      includesAny(value, [
        "call",
        "contact",
        "form",
        "booking",
        "estimate",
        "cta",
        "conversion"
      ])
    ) {
      return "Conversion Leak";
    }

    if (
      includesAny(value, [
        "review",
        "testimonial",
        "trust",
        "credential",
        "proof",
        "license",
        "guarantee"
      ])
    ) {
      return "Trust Leak";
    }

    if (
      includesAny(value, [
        "google",
        "search",
        "seo",
        "visibility",
        "ranking",
        "social",
        "facebook",
        "instagram",
        "linkedin"
      ])
    ) {
      return "Visibility Leak";
    }

    if (
      includesAny(value, [
        "analytics",
        "tracking",
        "metric",
        "measurement",
        "conversion rate",
        "baseline"
      ])
    ) {
      return "Measurement Leak";
    }

    if (
      includesAny(value, [
        "message",
        "headline",
        "service",
        "customer",
        "location",
        "market",
        "unclear"
      ])
    ) {
      return "Clarity Leak";
    }

    return fallback;
  }

  function explainWhyFindingMatters(text, category) {
    const impactArea = mapCategoryToImpactArea(
      categorizeText(text, category)
    );

    return (
      `This finding may weaken ${impactArea.toLowerCase()} during the ` +
      "customer decision process and should be verified before implementation."
    );
  }

  function inferBusinessImpact(text, category) {
    const resolvedCategory = categorizeText(text, category);

    const impacts = {
      "Conversion Leak":
        "Qualified visitors may fail to become calls, form submissions, bookings, or estimates.",
      "Trust Leak":
        "Prospects may hesitate, compare more competitors, or avoid contacting the business.",
      "Visibility Leak":
        "The business may be discovered less often or appear less established during customer research.",
      "Measurement Leak":
        "The business may be unable to prove which activities create qualified leads or revenue.",
      "Clarity Leak":
        "Prospects may struggle to understand the offer, relevance, service area, or next step.",
      "Information Gap":
        "Missing information may create uncertainty and delay the buying decision."
    };

    return (
      impacts[resolvedCategory] ||
      "The issue may reduce customer confidence, lead quality, conversion, or measurable growth."
    );
  }

  function inferExpectedOutcome(text, category) {
    const resolvedCategory = categorizeText(text, category);

    const outcomes = {
      "Conversion Leak":
        "More qualified visitors complete the intended conversion action.",
      "Trust Leak":
        "Prospects feel more confident contacting and choosing the business.",
      "Visibility Leak":
        "The business becomes easier to discover and verify.",
      "Measurement Leak":
        "Growth decisions can be evaluated using measurable business outcomes.",
      "Clarity Leak":
        "Prospects understand the offer and next step more quickly.",
      "Information Gap":
        "Customers can make better-informed decisions with less uncertainty."
    };

    return (
      outcomes[resolvedCategory] ||
      "A measurable improvement in visibility, trust, conversion, or lead quality."
    );
  }

  function inferEffort(text) {
    const value = clean(text).toLowerCase();

    if (
      includesAny(value, [
        "rebuild",
        "redesign",
        "new website",
        "migration",
        "strategy",
        "automation",
        "integration"
      ])
    ) {
      return "High";
    }

    if (
      includesAny(value, [
        "create",
        "develop",
        "campaign",
        "optimize",
        "improve",
        "expand",
        "system"
      ])
    ) {
      return "Medium";
    }

    return "Low";
  }

  function containsHighPriorityTerms(text) {
    return includesAny(clean(text).toLowerCase(), [
      "missing contact",
      "no contact",
      "broken",
      "not working",
      "cannot",
      "unable",
      "no call",
      "no form",
      "no tracking",
      "no reviews",
      "not clear",
      "unclear",
      "missing"
    ]);
  }

  function containsConcernTerms(text) {
    return includesAny(clean(text).toLowerCase(), [
      "missing",
      "unclear",
      "weak",
      "limited",
      "difficult",
      "inconsistent",
      "not",
      "no ",
      "lack",
      "could improve",
      "opportunity",
      "should",
      "needs",
      "problem",
      "issue"
    ]);
  }

  function isPositiveStatement(text) {
    const value = clean(text).toLowerCase();

    return (
      includesAny(value, [
        "strong",
        "clear",
        "prominent",
        "effective",
        "well organized",
        "easy to find"
      ]) && !containsConcernTerms(value)
    );
  }

  /* =========================================================
     Priority and Roadmap Helpers
     ========================================================= */

  function getPriorityQuadrant(impactScore, effortScore) {
    if (impactScore >= 3 && effortScore === 1) return "Quick Win";
    if (impactScore >= 3 && effortScore >= 2) {
      return "Strategic Priority";
    }
    if (impactScore <= 2 && effortScore === 1) {
      return "Supporting Improvement";
    }

    return "Later Consideration";
  }

  function getRecommendedSequence(impactScore, effortScore) {
    if (impactScore >= 3 && effortScore === 1) return "Days 1–30";
    if (impactScore >= 3 && effortScore === 2) return "Days 31–60";
    if (effortScore === 3) return "Days 61–90";

    return "After priority work";
  }

  function buildActionFromFinding(finding) {
    const value = clean(finding);

    if (!value) {
      return "Verify the finding and implement a measurable improvement.";
    }

    return `Verify and correct this finding: ${value}`;
  }

  function getSuccessMeasure(category) {
    const measures = {
      "Conversion Leak":
        "Increase calls, form submissions, bookings, estimates, or conversion rate.",
      "Trust Leak":
        "Increase engagement with proof elements and improve qualified conversion activity.",
      "Visibility Leak":
        "Increase verified search visibility, profile discovery, website visits, or branded engagement.",
      "Measurement Leak":
        "Establish reliable tracking for the primary conversion event and 90-day performance change.",
      "Clarity Leak":
        "Improve engagement and conversion on pages where the offer or next step was unclear.",
      "Information Gap":
        "Reduce unanswered customer questions and improve completion of the intended next step."
    };

    return (
      measures[category] ||
      "Measure the change in qualified inquiries, conversion rate, and business value."
    );
  }

  function mapCategoryToImpactArea(category) {
    const value = clean(category).toLowerCase();

    if (value.includes("conversion")) return "Lead Conversion";
    if (value.includes("trust")) return "Customer Trust";
    if (value.includes("visibility")) return "Market Visibility";
    if (value.includes("measurement")) return "Performance Measurement";
    if (value.includes("clarity")) return "Offer Clarity";
    if (value.includes("information")) return "Decision Confidence";

    return "Business Growth";
  }

  /* =========================================================
     Score Helpers
     ========================================================= */

  function getHealthRating(score) {
    if (score >= 85) return "Strong Foundation";
    if (score >= 70) return "Healthy With Opportunities";
    if (score >= 55) return "Growth Constrained";
    if (score >= 40) return "Significant Growth Leaks";

    return "Foundation Requires Attention";
  }

  function getStrongestCategory(scores) {
    return Object.keys(scores).reduce(function (best, key) {
      return scores[key] > scores[best] ? key : best;
    });
  }

  function getWeakestCategory(scores) {
    return Object.keys(scores).reduce(function (worst, key) {
      return scores[key] < scores[worst] ? key : worst;
    });
  }

  function getEvidenceQuality(count) {
    if (count >= 15) return "Strong";
    if (count >= 8) return "Moderate";
    if (count >= 3) return "Limited";

    return "Insufficient";
  }

  /* =========================================================
     Public Presence Helpers
     ========================================================= */

  function countConfirmedPublicPlatforms(publicPresence) {
    if (!isObject(publicPresence)) return 0;

    const ignoredKeys = new Set([
      "sources",
      "evidence",
      "confidence",
      "status",
      "summary"
    ]);

    return Object.keys(publicPresence).filter(function (key) {
      if (ignoredKeys.has(key)) return false;

      const value = publicPresence[key];

      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();

        return Boolean(
          normalized &&
            normalized !== "unknown" &&
            normalized !== "not found" &&
            normalized !== "none"
        );
      }

      if (isObject(value)) {
        return Boolean(
          clean(value.url) ||
            clean(value.link) ||
            value.found === true ||
            value.present === true
        );
      }

      return value === true;
    }).length;
  }

  /* =========================================================
     General Utilities
     ========================================================= */

  function clean(value) {
    if (value === null || value === undefined) return "";

    return String(value)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanArray(value) {
    if (!Array.isArray(value)) return [];

    return unique(
      value
        .map(function (item) {
          if (typeof item === "string") return clean(item);

          if (isObject(item)) {
            return clean(
              item.finding ||
                item.observation ||
                item.name ||
                item.value ||
                item.description
            );
          }

          return clean(item);
        })
        .filter(Boolean)
    );
  }

  function firstNonEmptyArray() {
    for (let index = 0; index < arguments.length; index += 1) {
      const cleaned = cleanArray(arguments[index]);

      if (cleaned.length > 0) return cleaned;
    }

    return [];
  }

  function unique(items) {
    return Array.from(
      new Set(
        items
          .map(function (item) {
            return clean(item);
          })
          .filter(Boolean)
      )
    );
  }

  function isObject(value) {
    return Boolean(
      value &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
  }

  function isMeaningful(value) {
    const text = clean(value).toLowerCase();

    if (!text || text.length < 10) return false;

    return !includesAny(text, [
      "unknown",
      "not clearly stated",
      "requires verification",
      "not available"
    ]);
  }

  function normalizePriority(value) {
    const text = clean(value).toLowerCase();

    if (text.includes("critical") || text.includes("urgent")) {
      return "Critical";
    }

    if (text.includes("high")) return "High";
    if (text.includes("low")) return "Low";

    return "Medium";
  }

  function normalizeEffort(value) {
    const text = clean(value).toLowerCase();

    if (
      text.includes("high") ||
      text.includes("hard") ||
      text.includes("complex")
    ) {
      return "High";
    }

    if (
      text.includes("low") ||
      text.includes("easy") ||
      text.includes("simple")
    ) {
      return "Low";
    }

    return "Medium";
  }

  function normalizeForComparison(value) {
    return clean(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function includesAny(value, terms) {
    return terms.some(function (term) {
      return value.includes(term);
    });
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function lowercaseFirst(value) {
    const text = clean(value);

    if (!text) return "";

    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  /* =========================================================
     Exports
     Works in browser, ES module-compatible environments,
     Node-style testing, and Cloudflare-compatible builds.
     ========================================================= */

  const api = {
    ENGINE_NAME,
    ENGINE_VERSION,
    generateGrowthIntelligence,
    validateBusinessRecord,
    normalizeBusinessRecord,
    classifyBusiness,
    identifyGrowthLeaks,
    calculateBusinessHealth,
    buildPriorityMatrix
  };

  if (
    typeof module !== "undefined" &&
    module.exports
  ) {
    module.exports = api;
  }

  globalScope.GCMGrowthIntelligence = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
