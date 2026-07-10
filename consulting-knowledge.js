/* =========================================================
   Global Concepts Media Operating System
   File: consulting-knowledge.js
   Version: 1.0.1
   Sprint: Consulting Knowledge Engine v1

   Purpose:
   Transform structured Growth Intelligence into deeper,
   industry-aware consulting recommendations.

   Input:
   Growth Intelligence Object only.

   Output:
   Structured Consulting Recommendations only.

   This file does NOT:
   - Research websites
   - Fetch external information
   - Call AI
   - Generate HTML
   - Generate PDFs
   - Modify the Business Record
   - Modify the original Growth Intelligence Object
   ========================================================= */

(function (globalScope) {
  "use strict";

  const ENGINE_NAME = "GCM Consulting Knowledge Engine";
  const ENGINE_VERSION = "1.0.1";

  const SUPPORTED_INDUSTRIES = [
    "roofing",
    "hvac",
    "plumbing",
    "electrical",
    "dentistry",
    "legal",
    "home services",
    "general"
  ];

  /* =========================================================
     Public Engine Function
     ========================================================= */

  function generateConsultingRecommendations(growthIntelligence) {
    validateGrowthIntelligence(growthIntelligence);

    const intelligence = normalizeGrowthIntelligence(growthIntelligence);
    const industryProfile = resolveIndustryProfile(
      intelligence.business.industry
    );

    const recommendations = intelligence.growthLeaks.map(function (leak) {
      return buildRecommendation(leak, industryProfile, intelligence);
    });

    const sortedRecommendations = recommendations
      .slice()
      .sort(sortRecommendations);

    const implementationRoadmap = buildImplementationRoadmap(
      sortedRecommendations
    );

    const strategicThemes = buildStrategicThemes(sortedRecommendations);

    const expectedBusinessValue = buildExpectedBusinessValue(
      sortedRecommendations,
      intelligence
    );

    const consultantSummary = buildConsultantSummary(
      intelligence,
      industryProfile,
      sortedRecommendations
    );

    return {
      engine: {
        name: ENGINE_NAME,
        version: ENGINE_VERSION,
        generatedAt: new Date().toISOString(),
        source: "Growth Intelligence",
        additionalResearchPerformed: false,
        aiUsed: false
      },

      business: {
        name: intelligence.business.name,
        website: intelligence.business.website,
        industry: intelligence.business.industry,
        normalizedIndustry: industryProfile.id,
        industryLabel: industryProfile.label,
        geographicMarket: intelligence.business.geographicMarket
      },

      consultantSummary,

      strategicThemes,

      recommendations: sortedRecommendations,

      implementationRoadmap,

      expectedBusinessValue,

      verificationRequired: buildVerificationRequirements(
        sortedRecommendations
      ),

      methodology: {
        principle: "Evidence before assumptions.",
        process: [
          "Identify the observable growth leak.",
          "Explain why the leak matters.",
          "Connect the leak to measurable business impact.",
          "Apply relevant industry knowledge.",
          "Recommend a prioritized corrective action.",
          "Define the evidence required to prove the result."
        ],
        limitation:
          "Recommendations are limited to the evidence already contained in the Growth Intelligence Object."
      }
    };
  }

  /* =========================================================
     Validation
     ========================================================= */

  function validateGrowthIntelligence(value) {
    if (!isObject(value)) {
      throw new TypeError(
        "Consulting Knowledge Engine requires a Growth Intelligence object."
      );
    }

    if (!isObject(value.business)) {
      throw new Error(
        "Growth Intelligence is missing the business object."
      );
    }

    const leaks = Array.isArray(value.topGrowthLeaks)
      ? value.topGrowthLeaks
      : Array.isArray(value.growthLeaks)
        ? value.growthLeaks
        : [];

    if (leaks.length === 0) {
      throw new Error(
        "Growth Intelligence does not contain any Growth Leaks."
      );
    }

    return true;
  }

  /* =========================================================
     Normalization
     ========================================================= */

  function normalizeGrowthIntelligence(value) {
    const business = isObject(value.business) ? value.business : {};

    const growthLeaks = Array.isArray(value.topGrowthLeaks)
      ? value.topGrowthLeaks
      : Array.isArray(value.growthLeaks)
        ? value.growthLeaks
        : [];

    return {
      business: {
        name: clean(business.name) || "Business name requires verification",
        website:
          clean(business.website) || "Website requires verification",
        industry:
          clean(business.industry) || "Industry requires verification",
        geographicMarket:
          clean(business.geographicMarket) ||
          "Geographic market requires verification"
      },

      businessHealth: isObject(value.businessHealth)
        ? value.businessHealth
        : {},

      executiveSummary: isObject(value.executiveSummary)
        ? value.executiveSummary
        : {},

      growthLeaks: growthLeaks
        .filter(isObject)
        .map(normalizeGrowthLeak)
        .filter(function (leak) {
          return leak.finding && leak.observableEvidence;
        }),

      priorityMatrix: Array.isArray(value.priorityMatrix)
        ? value.priorityMatrix
        : [],

      roadmap: isObject(value.roadmap) ? value.roadmap : {},

      expectedBusinessImpact: isObject(value.expectedBusinessImpact)
        ? value.expectedBusinessImpact
        : {}
    };
  }

  function normalizeGrowthLeak(leak, index) {
    return {
      id: clean(leak.id) || `growth-leak-${index + 1}`,
      category: clean(leak.category) || "Growth Opportunity",
      finding: clean(leak.finding),
      observableEvidence: clean(
        leak.observableEvidence || leak.evidence
      ),
      whyItMatters: clean(leak.whyItMatters),
      businessImpact: clean(leak.businessImpact || leak.impact),
      priority: normalizePriority(leak.priority),
      estimatedEffort: normalizeEffort(
        leak.estimatedEffort || leak.effort
      ),
      expectedOutcome: clean(leak.expectedOutcome),
      recommendedAction: clean(leak.recommendedAction),
      evidenceSource:
        clean(leak.evidenceSource) || "Business Record",
      score: toNumber(leak.score)
    };
  }

  /* =========================================================
     Industry Resolution
     ========================================================= */

  function resolveIndustryProfile(industry) {
    const value = clean(industry).toLowerCase();

    if (
      includesAny(value, [
        "roof",
        "roofing",
        "roofer"
      ])
    ) {
      return INDUSTRY_PROFILES.roofing;
    }

    if (
      includesAny(value, [
        "hvac",
        "heating",
        "air conditioning",
        "air-conditioning",
        "cooling"
      ])
    ) {
      return INDUSTRY_PROFILES.hvac;
    }

    if (
      includesAny(value, [
        "plumb",
        "plumber"
      ])
    ) {
      return INDUSTRY_PROFILES.plumbing;
    }

    if (
      includesAny(value, [
        "electric",
        "electrical",
        "electrician"
      ])
    ) {
      return INDUSTRY_PROFILES.electrical;
    }

    if (
      includesAny(value, [
        "dentist",
        "dental",
        "dentistry",
        "orthodont"
      ])
    ) {
      return INDUSTRY_PROFILES.dentistry;
    }

    if (
      includesAny(value, [
        "law",
        "legal",
        "attorney",
        "lawyer"
      ])
    ) {
      return INDUSTRY_PROFILES.legal;
    }

    if (
      includesAny(value, [
        "contractor",
        "construction",
        "remodel",
        "landscap",
        "pest control",
        "cleaning",
        "restoration",
        "garage door",
        "pool service",
        "home service"
      ])
    ) {
      return INDUSTRY_PROFILES.homeServices;
    }

    return INDUSTRY_PROFILES.general;
  }

  /* =========================================================
     Recommendation Builder
     ========================================================= */

  function buildRecommendation(leak, industryProfile, intelligence) {
    const categoryProfile = resolveCategoryProfile(leak.category);
    const industryGuidance = resolveIndustryGuidance(
      industryProfile,
      leak.category
    );

    const recommendedActions = unique([
      industryGuidance.primaryAction,
      leak.recommendedAction,
      categoryProfile.primaryAction,
      ...industryGuidance.supportingActions
    ]).filter(Boolean);

    const successMetrics = unique([
      ...categoryProfile.successMetrics,
      ...industryGuidance.successMetrics
    ]);

    const verificationItems = unique([
      ...categoryProfile.verificationItems,
      ...industryGuidance.verificationItems,
      buildLeakVerificationItem(leak)
    ]);

    const businessValue = buildRecommendationBusinessValue(
      leak,
      categoryProfile,
      industryGuidance
    );

    return {
      id: `recommendation-${leak.id}`,
      growthLeakId: leak.id,
      category: leak.category,
      industry: industryProfile.label,

      observableEvidence: leak.observableEvidence,

      finding: leak.finding,

      whyItMatters:
        leak.whyItMatters ||
        categoryProfile.whyItMatters,

      businessImpact:
        leak.businessImpact ||
        categoryProfile.businessImpact,

      consultantInterpretation: buildConsultantInterpretation(
        leak,
        industryProfile,
        categoryProfile
      ),

      recommendedActions,

      primaryRecommendation:
        recommendedActions[0] ||
        "Verify the finding and implement a measurable correction.",

      implementationDetails: buildImplementationDetails(
        leak,
        categoryProfile,
        industryGuidance
      ),

      priority: leak.priority,

      estimatedEffort: leak.estimatedEffort,

      recommendedTimeframe: getRecommendedTimeframe(
        leak.priority,
        leak.estimatedEffort
      ),

      expectedOutcome:
        leak.expectedOutcome ||
        industryGuidance.expectedOutcome ||
        categoryProfile.expectedOutcome,

      expectedBusinessValue: businessValue,

      successMetrics,

      verificationRequired: verificationItems,

      evidenceSource: leak.evidenceSource,

      confidence: calculateRecommendationConfidence(
        leak,
        intelligence
      )
    };
  }

  function buildConsultantInterpretation(
    leak,
    industryProfile,
    categoryProfile
  ) {
    const industryContext = industryProfile.customerDecisionContext;
    const categoryContext = categoryProfile.consultantContext;

    return (
      `${leak.finding} ${categoryContext} ` +
      `For a ${industryProfile.label.toLowerCase()}, ` +
      `${industryContext}`
    );
  }

  function buildImplementationDetails(
    leak,
    categoryProfile,
    industryGuidance
  ) {
    return {
      firstStep:
        industryGuidance.firstStep ||
        categoryProfile.firstStep,

      executionSequence: unique([
        categoryProfile.firstStep,
        ...industryGuidance.executionSequence,
        categoryProfile.measurementStep
      ]),

      requiredInputs: unique([
        ...categoryProfile.requiredInputs,
        ...industryGuidance.requiredInputs
      ]),

      completionStandard:
        industryGuidance.completionStandard ||
        categoryProfile.completionStandard,

      measurementStep:
        categoryProfile.measurementStep
    };
  }

  function buildRecommendationBusinessValue(
    leak,
    categoryProfile,
    industryGuidance
  ) {
    const impactAreas = unique([
      ...categoryProfile.impactAreas,
      ...industryGuidance.impactAreas
    ]);

    return {
      impactAreas,

      nearTermValue:
        industryGuidance.nearTermValue ||
        categoryProfile.nearTermValue,

      longerTermValue:
        industryGuidance.longerTermValue ||
        categoryProfile.longerTermValue,

      revenuePotential:
        "Revenue impact must be calculated after average customer value, qualified lead volume, conversion rate, and close rate are verified.",

      valueFormula:
        "Additional qualified opportunities × close rate × average customer value",

      proofStandard:
        "Compare verified baseline performance with the same metrics after implementation."
    };
  }

  /* =========================================================
     Recommendation Sorting
     ========================================================= */

  function sortRecommendations(a, b) {
    const priorityDifference =
      priorityWeight(b.priority) -
      priorityWeight(a.priority);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const effortDifference =
      effortWeight(a.estimatedEffort) -
      effortWeight(b.estimatedEffort);

    if (effortDifference !== 0) {
      return effortDifference;
    }

    return b.confidence.score - a.confidence.score;
  }

  /* =========================================================
     Implementation Roadmap
     ========================================================= */

  function buildImplementationRoadmap(recommendations) {
    const days1To30 = [];
    const days31To60 = [];
    const days61To90 = [];

    recommendations.forEach(function (recommendation) {
      const item = {
        recommendationId: recommendation.id,
        growthLeakId: recommendation.growthLeakId,
        category: recommendation.category,
        action: recommendation.primaryRecommendation,
        priority: recommendation.priority,
        estimatedEffort: recommendation.estimatedEffort,
        expectedOutcome: recommendation.expectedOutcome,
        successMetrics: recommendation.successMetrics,
        completionStandard:
          recommendation.implementationDetails.completionStandard
      };

      if (recommendation.recommendedTimeframe === "Days 1–30") {
        days1To30.push(item);
        return;
      }

      if (recommendation.recommendedTimeframe === "Days 31–60") {
        days31To60.push(item);
        return;
      }

      days61To90.push(item);
    });

    return {
      days1To30: limitAndSequence(days1To30, 4, "Days 1–30"),
      days31To60: limitAndSequence(days31To60, 4, "Days 31–60"),
      days61To90: limitAndSequence(days61To90, 4, "Days 61–90")
    };
  }

  function limitAndSequence(items, limit, timeframe) {
    return items.slice(0, limit).map(function (item, index) {
      return Object.assign({}, item, {
        sequence: index + 1,
        timeframe
      });
    });
  }

  function getRecommendedTimeframe(priority, effort) {
    const priorityScore = priorityWeight(priority);
    const effortScore = effortWeight(effort);

    if (priorityScore >= 3 && effortScore === 1) {
      return "Days 1–30";
    }

    if (priorityScore >= 3 && effortScore === 2) {
      return "Days 31–60";
    }

    if (effortScore === 3) {
      return "Days 61–90";
    }

    if (effortScore === 1) {
      return "Days 1–30";
    }

    return "Days 31–60";
  }

  /* =========================================================
     Strategic Themes
     ========================================================= */

  function buildStrategicThemes(recommendations) {
    const categoryCounts = {};

    recommendations.forEach(function (recommendation) {
      const category = recommendation.category;

      categoryCounts[category] =
        (categoryCounts[category] || 0) + 1;
    });

    return Object.keys(categoryCounts)
      .map(function (category) {
        return {
          category,
          recommendationCount: categoryCounts[category],
          strategicObjective: getStrategicObjective(category),
          businessOutcome: getStrategicBusinessOutcome(category)
        };
      })
      .sort(function (a, b) {
        return b.recommendationCount - a.recommendationCount;
      });
  }

  function getStrategicObjective(category) {
    const profile = resolveCategoryProfile(category);

    return profile.strategicObjective;
  }

  function getStrategicBusinessOutcome(category) {
    const profile = resolveCategoryProfile(category);

    return profile.expectedOutcome;
  }

  /* =========================================================
     Expected Business Value
     ========================================================= */

  function buildExpectedBusinessValue(
    recommendations,
    intelligence
  ) {
    const impactAreas = unique(
      recommendations.flatMap(function (recommendation) {
        return recommendation.expectedBusinessValue.impactAreas;
      })
    );

    const highPriorityCount = recommendations.filter(function (
      recommendation
    ) {
      return (
        recommendation.priority === "High" ||
        recommendation.priority === "Critical"
      );
    }).length;

    return {
      primaryImpactAreas: impactAreas,

      highPriorityRecommendations: highPriorityCount,

      expectedNearTermImpact:
        "Reduce immediate customer friction, strengthen decision confidence, and establish measurable conversion activity.",

      expectedMidTermImpact:
        "Improve the systems that influence qualified inquiries, customer trust, market visibility, and conversion performance.",

      expectedLongTermImpact:
        "Create a repeatable growth system that can be measured, improved, and connected to revenue.",

      healthScoreContext:
        typeof intelligence.businessHealth.score === "number"
          ? `Current Business Health Score: ${intelligence.businessHealth.score}/100.`
          : "Business Health Score requires verification.",

      revenueCalculationRequirements: [
        "Current qualified lead volume",
        "Website or campaign conversion rate",
        "Sales close rate",
        "Average customer or project value",
        "Gross profit or contribution margin",
        "Customer lifetime value when applicable"
      ],

      revenueFormula:
        "Qualified leads × conversion improvement × close rate × average customer value",

      limitation:
        "No revenue amount should be promised until the required financial and conversion inputs are verified."
    };
  }

  /* =========================================================
     Consultant Summary
     ========================================================= */

  function buildConsultantSummary(
    intelligence,
    industryProfile,
    recommendations
  ) {
    const topRecommendation = recommendations[0];

    const businessName = intelligence.business.name;
    const score =
      typeof intelligence.businessHealth.score === "number"
        ? intelligence.businessHealth.score
        : null;

    const opening = score !== null
      ? `${businessName} currently has a Business Health Score of ${score}/100.`
      : `${businessName} has evidence-based growth opportunities that require prioritization.`;

    const primaryIssue = topRecommendation
      ? `The highest-value current priority is to ${lowercaseFirst(
          topRecommendation.primaryRecommendation
        )}`
      : "The highest-value priority requires additional verification.";

    return {
      opening,

      industryContext:
        industryProfile.customerDecisionContext,

      primaryIssue,

      recommendedApproach:
        "Begin with the highest-impact, lowest-effort improvements, establish reliable measurement, and use verified results to guide the remaining 90-day plan.",

      narrative:
        `${opening} ${industryProfile.customerDecisionContext} ` +
        `${primaryIssue} The recommended approach is to verify the evidence, ` +
        "complete the most valuable corrective actions first, and measure whether those actions improve qualified customer response."
    };
  }

  /* =========================================================
     Verification
     ========================================================= */

  function buildVerificationRequirements(recommendations) {
    return unique(
      recommendations.flatMap(function (recommendation) {
        return recommendation.verificationRequired;
      })
    ).slice(0, 15);
  }

  function buildLeakVerificationItem(leak) {
    return `Verify this finding before implementation: ${leak.finding}`;
  }

  /* =========================================================
     Confidence
     ========================================================= */

  function calculateRecommendationConfidence(
    leak,
    intelligence
  ) {
    let score = 0;
    const reasons = [];

    if (leak.observableEvidence) {
      score += 35;
      reasons.push("Observable evidence is present.");
    }

    if (leak.businessImpact) {
      score += 20;
      reasons.push("Business impact is defined.");
    }

    if (leak.whyItMatters) {
      score += 15;
      reasons.push("Customer decision relevance is defined.");
    }

    if (leak.expectedOutcome) {
      score += 15;
      reasons.push("Expected outcome is defined.");
    }

    if (
      intelligence.business.industry &&
      !intelligence.business.industry
        .toLowerCase()
        .includes("requires verification")
    ) {
      score += 15;
      reasons.push("Industry context is available.");
    }

    return {
      score: clamp(score, 0, 100),
      rating: getConfidenceRating(score),
      reasons
    };
  }

  function getConfidenceRating(score) {
    if (score >= 85) return "Strong";
    if (score >= 65) return "Moderate";
    if (score >= 40) return "Limited";

    return "Requires Verification";
  }

  /* =========================================================
     Category Profiles
     ========================================================= */

  const CATEGORY_PROFILES = {
    conversion: {
      id: "conversion",
      strategicObjective:
        "Create a clear path from customer interest to measurable action.",

      consultantContext:
        "Conversion friction can cause qualified visitors to leave before calling, submitting a form, requesting an estimate, or booking an appointment.",

      whyItMatters:
        "Traffic does not create business growth unless qualified visitors complete a measurable next step.",

      businessImpact:
        "The business may lose qualified opportunities even when customer demand already exists.",

      primaryAction:
        "Create one clear primary conversion action and use it consistently across high-intent customer decision points.",

      firstStep:
        "Identify the single most valuable customer action.",

      measurementStep:
        "Track the number and rate of completed conversion actions.",

      requiredInputs: [
        "Primary business conversion goal",
        "Current call and form activity",
        "Current conversion path",
        "Analytics and call-tracking access"
      ],

      completionStandard:
        "A qualified prospect can immediately understand and complete the primary next step on desktop and mobile.",

      successMetrics: [
        "Qualified phone calls",
        "Form submissions",
        "Booked appointments or estimates",
        "Website conversion rate",
        "Cost per qualified opportunity"
      ],

      verificationItems: [
        "Verify the current primary call to action.",
        "Verify that forms, phone numbers, and booking paths work.",
        "Establish a baseline conversion rate."
      ],

      expectedOutcome:
        "More qualified visitors complete the intended customer action.",

      impactAreas: [
        "Lead Conversion",
        "Qualified Opportunities",
        "Revenue Opportunity"
      ],

      nearTermValue:
        "Capture more value from existing traffic.",

      longerTermValue:
        "Create a measurable conversion system that can be continuously improved."
    },

    trust: {
      id: "trust",
      strategicObjective:
        "Reduce perceived risk during the customer decision process.",

      consultantContext:
        "Customers often compare several providers and use visible proof to decide which business feels safest to contact.",

      whyItMatters:
        "Customer proof reduces uncertainty and supports the decision to contact or choose the business.",

      businessImpact:
        "Weak proof can reduce inquiry rates, estimate requests, appointments, and close rates.",

      primaryAction:
        "Place the strongest verified trust signals near the primary customer action.",

      firstStep:
        "Inventory available reviews, credentials, project examples, guarantees, and customer proof.",

      measurementStep:
        "Measure conversion activity before and after trust proof is improved.",

      requiredInputs: [
        "Verified customer reviews",
        "Licenses and certifications",
        "Project or service examples",
        "Guarantees or warranties",
        "Customer testimonials"
      ],

      completionStandard:
        "The strongest credible proof is visible before the customer is asked to contact or hire the business.",

      successMetrics: [
        "Estimate or appointment requests",
        "Engagement with reviews and proof",
        "Qualified conversion rate",
        "Sales close rate",
        "Review quantity and quality"
      ],

      verificationItems: [
        "Verify all reviews and testimonials.",
        "Verify licenses, certifications, and warranties.",
        "Confirm permission to use customer examples."
      ],

      expectedOutcome:
        "Prospects feel more confident contacting and choosing the business.",

      impactAreas: [
        "Customer Trust",
        "Decision Confidence",
        "Sales Conversion"
      ],

      nearTermValue:
        "Reduce hesitation at important customer decision points.",

      longerTermValue:
        "Build a stronger reputation system that supports lead generation and closing."
    },

    visibility: {
      id: "visibility",
      strategicObjective:
        "Improve how easily qualified customers can discover and verify the business.",

      consultantContext:
        "Customers frequently use search engines, maps, directories, and social platforms to discover and validate providers.",

      whyItMatters:
        "A business must be visible in the places customers use during the buying process.",

      businessImpact:
        "Limited visibility can reduce qualified website visits, calls, directions, profile engagement, and branded demand.",

      primaryAction:
        "Verify and strengthen the public platforms most relevant to customer discovery and validation.",

      firstStep:
        "Identify the platforms currently confirmed in the evidence.",

      measurementStep:
        "Track discovery, profile actions, website visits, calls, and qualified inquiries.",

      requiredInputs: [
        "Official business profiles",
        "Consistent business identity",
        "Service and location information",
        "Profile analytics when available"
      ],

      completionStandard:
        "The business is consistently represented and easy to verify across its most important customer discovery platforms.",

      successMetrics: [
        "Search impressions",
        "Profile views",
        "Website visits",
        "Calls and direction requests",
        "Qualified inquiries"
      ],

      verificationItems: [
        "Verify ownership of all official profiles.",
        "Confirm business name, phone, website, and location consistency.",
        "Verify that reported platforms belong to the business."
      ],

      expectedOutcome:
        "The business becomes easier for qualified customers to discover and verify.",

      impactAreas: [
        "Market Visibility",
        "Qualified Traffic",
        "Brand Recognition"
      ],

      nearTermValue:
        "Correct obvious discovery and consistency gaps.",

      longerTermValue:
        "Build durable visibility across the customer research journey."
    },

    measurement: {
      id: "measurement",
      strategicObjective:
        "Connect growth activity to measurable business results.",

      consultantContext:
        "Without reliable measurement, the business cannot determine which actions create qualified leads, customers, or revenue.",

      whyItMatters:
        "Measurement replaces opinion with evidence and allows resources to be directed toward what works.",

      businessImpact:
        "The business may continue spending time or money on activities that cannot be proven to create value.",

      primaryAction:
        "Define the primary conversion event and establish a reliable baseline before making major changes.",

      firstStep:
        "Define the customer actions that represent qualified business opportunities.",

      measurementStep:
        "Review performance at 30, 60, and 90 days using the same verified metrics.",

      requiredInputs: [
        "Qualified lead definition",
        "Current lead volume",
        "Current conversion rate",
        "Current close rate",
        "Average customer value",
        "Analytics and call-tracking access"
      ],

      completionStandard:
        "Every major growth action can be evaluated against a verified business outcome.",

      successMetrics: [
        "Qualified leads",
        "Conversion rate",
        "Booked opportunities",
        "Close rate",
        "Average customer value",
        "Revenue contribution"
      ],

      verificationItems: [
        "Verify analytics installation.",
        "Verify call and form tracking.",
        "Confirm which inquiries count as qualified.",
        "Establish current baseline performance."
      ],

      expectedOutcome:
        "Growth decisions can be made using measurable customer and revenue outcomes.",

      impactAreas: [
        "Performance Measurement",
        "Decision Quality",
        "Marketing Accountability"
      ],

      nearTermValue:
        "Create a reliable baseline and expose obvious tracking gaps.",

      longerTermValue:
        "Build an accountable growth system based on proven results."
    },

    clarity: {
      id: "clarity",
      strategicObjective:
        "Help qualified customers quickly understand the offer, relevance, and next step.",

      consultantContext:
        "Unclear messaging increases cognitive effort and makes it harder for customers to determine whether the business can solve their problem.",

      whyItMatters:
        "Customers are more likely to act when the service, value, location, and next step are immediately clear.",

      businessImpact:
        "Confusion can reduce engagement, qualified inquiries, and customer confidence.",

      primaryAction:
        "Clarify the primary service, target customer, service area, differentiator, and next step.",

      firstStep:
        "Identify the most important customer question that is not answered clearly.",

      measurementStep:
        "Measure engagement and conversion on the affected customer decision point.",

      requiredInputs: [
        "Primary services",
        "Target customer",
        "Service area",
        "Customer problem",
        "Primary next step"
      ],

      completionStandard:
        "A qualified customer can understand what the business does, who it serves, where it works, and what to do next within seconds.",

      successMetrics: [
        "Engagement rate",
        "Qualified website visits",
        "Calls and form submissions",
        "Conversion rate",
        "Reduction in unqualified inquiries"
      ],

      verificationItems: [
        "Verify the primary services.",
        "Verify the target customer.",
        "Verify the geographic market.",
        "Confirm that the primary next step matches the sales process."
      ],

      expectedOutcome:
        "Qualified customers understand the offer and take the next step more quickly.",

      impactAreas: [
        "Offer Clarity",
        "Customer Relevance",
        "Lead Quality"
      ],

      nearTermValue:
        "Reduce confusion and unnecessary customer friction.",

      longerTermValue:
        "Create more consistent marketing and sales communication."
    },

    information: {
      id: "information",
      strategicObjective:
        "Provide the information customers need to make a confident decision.",

      consultantContext:
        "Missing decision information can create uncertainty and delay or stop the customer journey.",

      whyItMatters:
        "Customers frequently abandon a provider when important questions remain unanswered.",

      businessImpact:
        "The business may lose qualified opportunities to competitors that communicate more completely.",

      primaryAction:
        "Verify the missing information and place it at the most relevant customer decision point.",

      firstStep:
        "Confirm whether the missing information exists internally.",

      measurementStep:
        "Measure changes in inquiries, engagement, and conversion after the information is added.",

      requiredInputs: [
        "Verified business information",
        "Customer frequently asked questions",
        "Sales objections",
        "Service requirements"
      ],

      completionStandard:
        "Important customer questions are answered clearly before they become barriers to conversion.",

      successMetrics: [
        "Qualified inquiries",
        "Reduced repetitive questions",
        "Conversion rate",
        "Sales cycle length",
        "Lead quality"
      ],

      verificationItems: [
        "Verify the missing information with the business.",
        "Confirm the information is accurate and approved for publication."
      ],

      expectedOutcome:
        "Customers can make faster and more confident decisions.",

      impactAreas: [
        "Decision Confidence",
        "Lead Quality",
        "Sales Efficiency"
      ],

      nearTermValue:
        "Remove an identifiable customer uncertainty.",

      longerTermValue:
        "Create a more complete and efficient customer decision journey."
    },

    general: {
      id: "general",
      strategicObjective:
        "Correct the highest-value growth constraint using verified evidence.",

      consultantContext:
        "An unresolved growth constraint can weaken customer response or prevent the business from proving results.",

      whyItMatters:
        "Evidence-based improvements help the business focus on actions most likely to create measurable growth.",

      businessImpact:
        "The business may lose visibility, trust, qualified opportunities, or measurable performance.",

      primaryAction:
        "Verify the finding and implement the most direct measurable correction.",

      firstStep:
        "Confirm the observable evidence and affected customer decision point.",

      measurementStep:
        "Establish a baseline and measure performance after implementation.",

      requiredInputs: [
        "Verified evidence",
        "Current performance baseline",
        "Implementation access",
        "Business objective"
      ],

      completionStandard:
        "The verified issue is corrected and connected to a measurable business outcome.",

      successMetrics: [
        "Qualified inquiries",
        "Conversion rate",
        "Customer engagement",
        "Lead quality",
        "Revenue opportunity"
      ],

      verificationItems: [
        "Verify the evidence.",
        "Confirm the business impact.",
        "Establish the current baseline."
      ],

      expectedOutcome:
        "A measurable improvement in the affected growth area.",

      impactAreas: [
        "Business Growth",
        "Customer Response",
        "Performance Improvement"
      ],

      nearTermValue:
        "Correct an observable growth constraint.",

      longerTermValue:
        "Strengthen the business growth system using verified results."
    }
  };

  function resolveCategoryProfile(category) {
    const value = clean(category).toLowerCase();

    if (value.includes("conversion")) {
      return CATEGORY_PROFILES.conversion;
    }

    if (value.includes("trust")) {
      return CATEGORY_PROFILES.trust;
    }

    if (value.includes("visibility")) {
      return CATEGORY_PROFILES.visibility;
    }

    if (value.includes("measurement")) {
      return CATEGORY_PROFILES.measurement;
    }

    if (value.includes("clarity")) {
      return CATEGORY_PROFILES.clarity;
    }

    if (value.includes("information")) {
      return CATEGORY_PROFILES.information;
    }

    return CATEGORY_PROFILES.general;
  }

  /* =========================================================
     Industry Profiles
     ========================================================= */

  const INDUSTRY_PROFILES = {
    roofing: {
      id: "roofing",
      label: "Roofing Contractor",

      customerDecisionContext:
        "Roofing is a high-value, high-trust purchase. Homeowners commonly compare contractors, verify reviews and credentials, evaluate financing or warranty information, and look for proof that the company can safely complete the work.",

      guidance: {
        trust: {
          primaryAction:
            "Place verified reviews, licensing, insurance, manufacturer certifications, warranties, and completed-project proof near estimate request actions.",

          supportingActions: [
            "Add project photographs with verified service and location context.",
            "Show manufacturer certifications and warranty options.",
            "Present verified review ratings and recent customer feedback.",
            "Explain insurance and storm-damage experience without making unsupported claims."
          ],

          firstStep:
            "Inventory verified reviews, licenses, insurance, certifications, warranties, and project examples.",

          executionSequence: [
            "Select the strongest verified trust signals.",
            "Place proof near estimate-request actions.",
            "Add project examples to relevant roofing service pages.",
            "Measure estimate requests and close rate."
          ],

          requiredInputs: [
            "Contractor license information",
            "Insurance verification",
            "Manufacturer certifications",
            "Warranty details",
            "Verified customer reviews",
            "Project photographs"
          ],

          completionStandard:
            "A homeowner can verify credibility, workmanship, and risk protection before requesting an estimate.",

          successMetrics: [
            "Roof estimate requests",
            "Review engagement",
            "Qualified lead rate",
            "Estimate-to-sale close rate"
          ],

          verificationItems: [
            "Verify contractor license and insurance.",
            "Verify manufacturer certifications.",
            "Verify warranties and customer reviews.",
            "Confirm permission to publish project photographs."
          ],

          expectedOutcome:
            "Homeowners feel more confident requesting and accepting roofing estimates.",

          impactAreas: [
            "Estimate Requests",
            "Homeowner Trust",
            "Sales Close Rate"
          ],

          nearTermValue:
            "Reduce homeowner hesitation before the estimate request.",

          longerTermValue:
            "Build a stronger reputation and project-proof system that supports higher-value roofing sales."
        },

        conversion: {
          primaryAction:
            "Create a clear request-an-estimate path supported by visible phone, form, and emergency or storm-response options when applicable.",

          supportingActions: [
            "Use one primary estimate-request action.",
            "Keep phone and estimate actions visible on mobile.",
            "Separate emergency repair, inspection, and replacement paths when appropriate.",
            "Confirm that every estimate form submits successfully."
          ],

          firstStep:
            "Identify the primary roofing estimate conversion action.",

          executionSequence: [
            "Verify phone and form functionality.",
            "Clarify the estimate-request language.",
            "Reduce unnecessary form fields.",
            "Track calls and completed estimate requests."
          ],

          requiredInputs: [
            "Estimate process",
            "Service types",
            "Service area",
            "Phone tracking",
            "Form access"
          ],

          completionStandard:
            "A qualified homeowner can request the correct roofing service or estimate in a few clear steps.",

          successMetrics: [
            "Qualified roofing calls",
            "Estimate forms",
            "Inspection bookings",
            "Website conversion rate"
          ],

          verificationItems: [
            "Verify the estimate process.",
            "Verify emergency and storm service availability.",
            "Verify service-area eligibility."
          ],

          expectedOutcome:
            "More qualified homeowners request roofing inspections or estimates.",

          impactAreas: [
            "Estimate Conversion",
            "Qualified Roofing Leads",
            "Booked Inspections"
          ],

          nearTermValue:
            "Capture more estimate requests from existing traffic.",

          longerTermValue:
            "Create a measurable roofing lead-generation system."
        },

        visibility: {
          primaryAction:
            "Strengthen local search and map visibility for verified roofing services and service areas.",

          supportingActions: [
            "Verify the Google Business Profile.",
            "Keep business identity and contact details consistent.",
            "Connect roofing service pages to verified service areas.",
            "Publish useful project and service evidence where appropriate."
          ],

          firstStep:
            "Verify the official roofing business profiles and primary service area.",

          executionSequence: [
            "Confirm profile ownership.",
            "Correct business information.",
            "Align services and service areas.",
            "Measure calls, profile actions, and qualified traffic."
          ],

          requiredInputs: [
            "Google Business Profile access",
            "Verified service areas",
            "Roofing service categories",
            "Business contact information"
          ],

          completionStandard:
            "The roofing company is consistently represented and discoverable for its verified services and market.",

          successMetrics: [
            "Local search impressions",
            "Map profile actions",
            "Calls",
            "Website visits",
            "Estimate requests"
          ],

          verificationItems: [
            "Verify Google Business Profile ownership.",
            "Verify all service areas.",
            "Confirm roofing service categories."
          ],

          expectedOutcome:
            "More qualified homeowners discover and verify the roofing company.",

          impactAreas: [
            "Local Search Visibility",
            "Qualified Traffic",
            "Estimate Opportunities"
          ],

          nearTermValue:
            "Correct local visibility and profile consistency gaps.",

          longerTermValue:
            "Create stronger local demand and brand recognition."
        }
      }
    },

    hvac: {
      id: "hvac",
      label: "HVAC Contractor",

      customerDecisionContext:
        "HVAC customers often have urgent comfort needs and compare providers based on availability, trust, financing, reviews, service coverage, and confidence that the technician can solve the problem quickly.",

      guidance: {
        trust: {
          primaryAction:
            "Place verified reviews, licenses, technician qualifications, guarantees, financing information, and service proof near booking actions.",

          supportingActions: [
            "Explain emergency and same-day availability accurately.",
            "Display verified manufacturer or technician certifications.",
            "Show maintenance-plan and warranty information.",
            "Use recent customer proof for repair and replacement services."
          ],

          firstStep:
            "Verify licenses, certifications, guarantees, reviews, and financing options.",

          executionSequence: [
            "Organize verified proof by service type.",
            "Place proof near booking and call actions.",
            "Clarify guarantees and financing.",
            "Measure calls, bookings, and close rates."
          ],

          requiredInputs: [
            "HVAC license information",
            "Technician certifications",
            "Warranty information",
            "Financing details",
            "Verified reviews"
          ],

          completionStandard:
            "Customers can verify competence, availability, and risk protection before booking service.",

          successMetrics: [
            "Service calls",
            "Booked appointments",
            "Replacement estimates",
            "Close rate"
          ],

          verificationItems: [
            "Verify licenses and certifications.",
            "Verify emergency availability.",
            "Verify guarantees, warranties, and financing."
          ],

          expectedOutcome:
            "Customers feel more confident booking repair, maintenance, or replacement service.",

          impactAreas: [
            "Service Bookings",
            "Customer Trust",
            "Replacement Sales"
          ],

          nearTermValue:
            "Reduce hesitation for urgent and high-value HVAC decisions.",

          longerTermValue:
            "Build stronger customer retention and replacement demand."
        },

        conversion: {
          primaryAction:
            "Create clear paths for emergency repair, routine service, maintenance, and replacement estimates.",

          supportingActions: [
            "Keep the service phone number visible on mobile.",
            "Separate emergency and non-emergency booking options.",
            "Reduce booking form friction.",
            "Track calls and appointment requests by service type."
          ],

          firstStep:
            "Define the primary action for each major HVAC customer need.",

          executionSequence: [
            "Verify phone and scheduling functionality.",
            "Clarify service paths.",
            "Reduce booking friction.",
            "Measure qualified service requests."
          ],

          requiredInputs: [
            "Service availability",
            "Scheduling process",
            "Emergency coverage",
            "Service area"
          ],

          completionStandard:
            "A customer can quickly select and request the appropriate HVAC service.",

          successMetrics: [
            "Qualified calls",
            "Booked service appointments",
            "Replacement estimates",
            "Conversion rate"
          ],

          verificationItems: [
            "Verify emergency availability.",
            "Verify scheduling capacity.",
            "Verify service areas."
          ],

          expectedOutcome:
            "More qualified customers book the correct HVAC service.",

          impactAreas: [
            "Service Conversion",
            "Booked Appointments",
            "Replacement Opportunities"
          ],

          nearTermValue:
            "Capture more existing repair and replacement demand.",

          longerTermValue:
            "Create a measurable service and replacement funnel."
        }
      }
    },

    plumbing: {
      id: "plumbing",
      label: "Plumbing Contractor",

      customerDecisionContext:
        "Plumbing customers often need rapid help and prioritize availability, trust, service clarity, reviews, transparent expectations, and an easy way to call or book service.",

      guidance: {
        trust: {
          primaryAction:
            "Place verified licenses, reviews, service guarantees, technician proof, and relevant project evidence near call and booking actions.",

          supportingActions: [
            "Clarify emergency availability.",
            "Explain service guarantees accurately.",
            "Show verified customer feedback.",
            "Provide proof for high-value repair or replacement services."
          ],

          firstStep:
            "Verify licenses, guarantees, reviews, and emergency service details.",

          executionSequence: [
            "Organize verified proof.",
            "Place proof near service actions.",
            "Clarify emergency and standard service expectations.",
            "Measure calls and booked jobs."
          ],

          requiredInputs: [
            "Plumbing license information",
            "Emergency availability",
            "Guarantee details",
            "Verified reviews"
          ],

          completionStandard:
            "Customers can verify credibility and service expectations before calling or booking.",

          successMetrics: [
            "Qualified service calls",
            "Booked jobs",
            "Conversion rate",
            "Close rate"
          ],

          verificationItems: [
            "Verify licensing.",
            "Verify emergency availability.",
            "Verify guarantees and reviews."
          ],

          expectedOutcome:
            "Customers feel more confident requesting plumbing service.",

          impactAreas: [
            "Service Calls",
            "Customer Trust",
            "Booked Jobs"
          ],

          nearTermValue:
            "Reduce hesitation during urgent plumbing decisions.",

          longerTermValue:
            "Build stronger customer trust and repeat service demand."
        },

        conversion: {
          primaryAction:
            "Create a fast, visible call and booking path for emergency and scheduled plumbing services.",

          supportingActions: [
            "Keep the phone number visible on mobile.",
            "Separate emergency and scheduled service paths.",
            "Clarify service area and availability.",
            "Track calls and completed bookings."
          ],

          firstStep:
            "Define the correct action for emergency and scheduled plumbing customers.",

          executionSequence: [
            "Verify call and booking functionality.",
            "Clarify service paths.",
            "Reduce booking friction.",
            "Measure qualified requests."
          ],

          requiredInputs: [
            "Scheduling process",
            "Emergency coverage",
            "Service areas",
            "Call tracking"
          ],

          completionStandard:
            "A qualified customer can immediately call or request the appropriate plumbing service.",

          successMetrics: [
            "Qualified calls",
            "Booked plumbing jobs",
            "Conversion rate"
          ],

          verificationItems: [
            "Verify emergency service availability.",
            "Verify scheduling capacity.",
            "Verify service areas."
          ],

          expectedOutcome:
            "More qualified customers request plumbing service.",

          impactAreas: [
            "Service Conversion",
            "Booked Jobs",
            "Qualified Calls"
          ],

          nearTermValue:
            "Capture more value from existing customer demand.",

          longerTermValue:
            "Create a measurable plumbing service funnel."
        }
      }
    },

    electrical: {
      id: "electrical",
      label: "Electrical Contractor",

      customerDecisionContext:
        "Electrical customers prioritize safety, licensing, competence, availability, clear service information, and confidence that work will be completed correctly.",

      guidance: {
        trust: {
          primaryAction:
            "Place verified licensing, insurance, certifications, safety proof, reviews, and completed-work examples near service request actions.",

          supportingActions: [
            "Clarify residential and commercial qualifications.",
            "Show relevant service and project examples.",
            "Explain guarantees and safety standards accurately.",
            "Use verified customer reviews."
          ],

          firstStep:
            "Verify licenses, insurance, certifications, reviews, and project evidence.",

          executionSequence: [
            "Organize safety and competence proof.",
            "Place proof near service actions.",
            "Match project evidence to service categories.",
            "Measure calls and estimate requests."
          ],

          requiredInputs: [
            "Electrical license information",
            "Insurance verification",
            "Certifications",
            "Verified reviews",
            "Project examples"
          ],

          completionStandard:
            "Customers can verify safety, competence, and credibility before requesting service.",

          successMetrics: [
            "Qualified service requests",
            "Estimate requests",
            "Conversion rate",
            "Close rate"
          ],

          verificationItems: [
            "Verify licenses and insurance.",
            "Verify certifications.",
            "Verify project evidence and reviews."
          ],

          expectedOutcome:
            "Customers feel more confident requesting electrical service.",

          impactAreas: [
            "Customer Trust",
            "Service Requests",
            "Estimate Conversion"
          ],

          nearTermValue:
            "Reduce safety and competence concerns.",

          longerTermValue:
            "Build stronger credibility for higher-value electrical work."
        }
      }
    },

    dentistry: {
      id: "dentistry",
      label: "Dental Practice",

      customerDecisionContext:
        "Dental patients evaluate trust, comfort, provider credentials, reviews, insurance or payment options, appointment availability, and confidence that the practice understands their needs.",

      guidance: {
        trust: {
          primaryAction:
            "Place verified patient reviews, provider credentials, treatment proof, comfort information, insurance details, and payment options near appointment actions.",

          supportingActions: [
            "Introduce dentists and clinical credentials.",
            "Explain patient comfort and anxiety support.",
            "Clarify insurance and financing accurately.",
            "Use approved before-and-after examples when appropriate."
          ],

          firstStep:
            "Verify provider credentials, reviews, insurance participation, financing, and approved patient proof.",

          executionSequence: [
            "Organize proof by patient concern.",
            "Place relevant proof near appointment actions.",
            "Clarify payment and insurance expectations.",
            "Measure appointment requests."
          ],

          requiredInputs: [
            "Provider credentials",
            "Verified patient reviews",
            "Insurance participation",
            "Payment and financing options",
            "Approved treatment examples"
          ],

          completionStandard:
            "Patients can verify competence, comfort, and payment expectations before requesting an appointment.",

          successMetrics: [
            "New patient calls",
            "Appointment requests",
            "Booked consultations",
            "Treatment acceptance"
          ],

          verificationItems: [
            "Verify provider credentials.",
            "Verify insurance and payment information.",
            "Confirm patient consent for testimonials and images."
          ],

          expectedOutcome:
            "Patients feel more confident requesting and attending appointments.",

          impactAreas: [
            "New Patient Acquisition",
            "Patient Trust",
            "Treatment Acceptance"
          ],

          nearTermValue:
            "Reduce patient uncertainty before appointment requests.",

          longerTermValue:
            "Build stronger patient acquisition and treatment acceptance."
        },

        conversion: {
          primaryAction:
            "Create clear appointment paths for new patients, emergencies, consultations, and major treatment categories.",

          supportingActions: [
            "Keep appointment and phone actions visible on mobile.",
            "Separate emergency and routine appointment paths.",
            "Clarify what new patients should expect.",
            "Track calls and appointment requests."
          ],

          firstStep:
            "Define the primary appointment action for each important patient need.",

          executionSequence: [
            "Verify appointment functionality.",
            "Clarify patient paths.",
            "Reduce scheduling friction.",
            "Measure completed appointments."
          ],

          requiredInputs: [
            "Scheduling process",
            "New patient availability",
            "Emergency availability",
            "Treatment categories"
          ],

          completionStandard:
            "A prospective patient can quickly request the correct appointment type.",

          successMetrics: [
            "New patient calls",
            "Appointment requests",
            "Booked consultations",
            "Show rate"
          ],

          verificationItems: [
            "Verify appointment availability.",
            "Verify emergency service information.",
            "Verify new patient procedures."
          ],

          expectedOutcome:
            "More qualified patients request and complete appointments.",

          impactAreas: [
            "Appointment Conversion",
            "New Patient Growth",
            "Treatment Opportunities"
          ],

          nearTermValue:
            "Capture more value from existing patient demand.",

          longerTermValue:
            "Create a measurable patient acquisition system."
        }
      }
    },

    legal: {
      id: "legal",
      label: "Law Firm",

      customerDecisionContext:
        "Legal clients evaluate credibility, experience, relevance to their problem, confidentiality, responsiveness, case proof, and clarity about the consultation process.",

      guidance: {
        trust: {
          primaryAction:
            "Place verified attorney credentials, relevant experience, approved case outcomes, client reviews, professional memberships, and consultation expectations near contact actions.",

          supportingActions: [
            "Introduce the attorneys and relevant practice experience.",
            "Use approved outcomes without promising future results.",
            "Clarify confidentiality and consultation expectations.",
            "Match proof to the relevant practice area."
          ],

          firstStep:
            "Verify attorney credentials, practice experience, reviews, professional memberships, and approved case evidence.",

          executionSequence: [
            "Organize proof by practice area.",
            "Place proof near consultation actions.",
            "Clarify consultation expectations.",
            "Measure qualified consultation requests."
          ],

          requiredInputs: [
            "Attorney credentials",
            "Practice-area experience",
            "Approved client reviews",
            "Approved case evidence",
            "Professional memberships"
          ],

          completionStandard:
            "A prospective client can verify relevance, credibility, and consultation expectations before making contact.",

          successMetrics: [
            "Qualified consultation requests",
            "Consultation bookings",
            "Lead quality",
            "Client conversion rate"
          ],

          verificationItems: [
            "Verify attorney credentials.",
            "Confirm approval for reviews and case information.",
            "Review all claims for applicable professional rules."
          ],

          expectedOutcome:
            "Prospective clients feel more confident requesting a consultation.",

          impactAreas: [
            "Consultation Requests",
            "Client Trust",
            "Lead Quality"
          ],

          nearTermValue:
            "Reduce uncertainty before the consultation request.",

          longerTermValue:
            "Build stronger practice-area authority and client acquisition."
        },

        conversion: {
          primaryAction:
            "Create a clear and confidential consultation-request path matched to the relevant legal problem.",

          supportingActions: [
            "Clarify the consultation process.",
            "Keep phone and consultation actions visible.",
            "Use practice-area-specific contact paths where appropriate.",
            "Track qualified consultation requests."
          ],

          firstStep:
            "Define the primary consultation action and qualification process.",

          executionSequence: [
            "Verify contact functionality.",
            "Clarify consultation expectations.",
            "Reduce unnecessary contact friction.",
            "Measure qualified consultations."
          ],

          requiredInputs: [
            "Consultation process",
            "Practice areas",
            "Lead qualification rules",
            "Response process"
          ],

          completionStandard:
            "A prospective client can understand and complete the consultation-request process confidently.",

          successMetrics: [
            "Qualified consultation requests",
            "Booked consultations",
            "Lead quality",
            "Client conversion rate"
          ],

          verificationItems: [
            "Verify consultation availability.",
            "Verify qualification requirements.",
            "Confirm confidentiality language."
          ],

          expectedOutcome:
            "More qualified prospects request consultations.",

          impactAreas: [
            "Consultation Conversion",
            "Qualified Legal Leads",
            "New Client Opportunities"
          ],

          nearTermValue:
            "Capture more qualified consultation demand.",

          longerTermValue:
            "Create a measurable legal client acquisition system."
        }
      }
    },

    homeServices: {
      id: "home-services",
      label: "Home Service Business",

      customerDecisionContext:
        "Home service customers often compare providers based on trust, reviews, availability, service area, proof of work, responsiveness, and confidence that the business can solve the problem safely.",

      guidance: {
        trust: {
          primaryAction:
            "Place verified reviews, licenses, insurance, guarantees, project proof, and service credentials near primary contact actions.",

          supportingActions: [
            "Use relevant project photographs.",
            "Clarify guarantees and warranties.",
            "Show verified reviews.",
            "Explain service qualifications."
          ],

          firstStep:
            "Verify reviews, licenses, insurance, guarantees, and project proof.",

          executionSequence: [
            "Organize the strongest verified proof.",
            "Place proof near primary actions.",
            "Match proof to service categories.",
            "Measure qualified inquiries."
          ],

          requiredInputs: [
            "Verified reviews",
            "Licenses and insurance",
            "Guarantees",
            "Project examples"
          ],

          completionStandard:
            "Customers can verify competence and credibility before requesting service.",

          successMetrics: [
            "Qualified calls",
            "Service requests",
            "Estimate requests",
            "Close rate"
          ],

          verificationItems: [
            "Verify licenses and insurance.",
            "Verify guarantees and reviews.",
            "Confirm permission to use project proof."
          ],

          expectedOutcome:
            "Customers feel more confident requesting service.",

          impactAreas: [
            "Customer Trust",
            "Service Requests",
            "Sales Conversion"
          ],

          nearTermValue:
            "Reduce hesitation before customers request service.",

          longerTermValue:
            "Build a stronger reputation and service-conversion system."
        },

        conversion: {
          primaryAction:
            "Create a clear phone, booking, or estimate-request path for the primary service.",

          supportingActions: [
            "Keep contact actions visible on mobile.",
            "Clarify service availability.",
            "Reduce form friction.",
            "Track calls and form submissions."
          ],

          firstStep:
            "Identify the highest-value customer conversion action.",

          executionSequence: [
            "Verify phone and form functionality.",
            "Clarify the primary action.",
            "Reduce friction.",
            "Measure qualified requests."
          ],

          requiredInputs: [
            "Service process",
            "Service area",
            "Scheduling capacity",
            "Conversion tracking"
          ],

          completionStandard:
            "A qualified customer can request the appropriate service in a few clear steps.",

          successMetrics: [
            "Qualified calls",
            "Service requests",
            "Estimate requests",
            "Conversion rate"
          ],

          verificationItems: [
            "Verify service availability.",
            "Verify service areas.",
            "Verify phone and form functionality."
          ],

          expectedOutcome:
            "More qualified customers request service.",

          impactAreas: [
            "Service Conversion",
            "Qualified Leads",
            "Booked Opportunities"
          ],

          nearTermValue:
            "Capture more value from existing demand.",

          longerTermValue:
            "Create a measurable customer acquisition system."
        }
      }
    },

    general: {
      id: "general",
      label: "Local Business",

      customerDecisionContext:
        "Customers compare businesses based on relevance, trust, visibility, ease of contact, and confidence that the provider can solve their problem.",

      guidance: {}
    }
  };

  /* =========================================================
     Industry Guidance Resolution
     ========================================================= */

  function resolveIndustryGuidance(industryProfile, category) {
    const categoryProfile = resolveCategoryProfile(category);
    const categoryId = categoryProfile.id;

    const industryGuidance =
      industryProfile.guidance &&
      industryProfile.guidance[categoryId];

    if (industryGuidance) {
      return normalizeIndustryGuidance(industryGuidance);
    }

    return buildGeneralIndustryGuidance(
      industryProfile,
      categoryProfile
    );
  }

  function normalizeIndustryGuidance(guidance) {
    return {
      primaryAction: clean(guidance.primaryAction),
      supportingActions: cleanArray(guidance.supportingActions),
      firstStep: clean(guidance.firstStep),
      executionSequence: cleanArray(guidance.executionSequence),
      requiredInputs: cleanArray(guidance.requiredInputs),
      completionStandard: clean(guidance.completionStandard),
      successMetrics: cleanArray(guidance.successMetrics),
      verificationItems: cleanArray(guidance.verificationItems),
      expectedOutcome: clean(guidance.expectedOutcome),
      impactAreas: cleanArray(guidance.impactAreas),
      nearTermValue: clean(guidance.nearTermValue),
      longerTermValue: clean(guidance.longerTermValue)
    };
  }

  function buildGeneralIndustryGuidance(
    industryProfile,
    categoryProfile
  ) {
    return {
      primaryAction: categoryProfile.primaryAction,

      supportingActions: [
        `Apply the recommendation to the most important customer decision point for the ${industryProfile.label.toLowerCase()}.`,
        "Use only verified business information.",
        "Measure performance before and after implementation."
      ],

      firstStep: categoryProfile.firstStep,

      executionSequence: [
        categoryProfile.firstStep,
        categoryProfile.primaryAction,
        categoryProfile.measurementStep
      ],

      requiredInputs: categoryProfile.requiredInputs,

      completionStandard: categoryProfile.completionStandard,

      successMetrics: categoryProfile.successMetrics,

      verificationItems: categoryProfile.verificationItems,

      expectedOutcome: categoryProfile.expectedOutcome,

      impactAreas: categoryProfile.impactAreas,

      nearTermValue: categoryProfile.nearTermValue,

      longerTermValue: categoryProfile.longerTermValue
    };
  }

  /* =========================================================
     Utilities
     ========================================================= */

  function clean(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return unique(
      value
        .map(function (item) {
          return clean(item);
        })
        .filter(Boolean)
    );
  }

  function unique(items) {
    const seen = new Set();

    return items.filter(function (item) {
      const value = clean(item);

      if (!value) {
        return false;
      }

      const key = value.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  function isObject(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function includesAny(value, terms) {
    return terms.some(function (term) {
      return value.includes(term);
    });
  }

  function normalizePriority(value) {
    const text = clean(value).toLowerCase();

    if (
      text.includes("critical") ||
      text.includes("urgent")
    ) {
      return "Critical";
    }

    if (text.includes("high")) {
      return "High";
    }

    if (text.includes("low")) {
      return "Low";
    }

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

  function priorityWeight(priority) {
    const weights = {
      Critical: 4,
      High: 3,
      Medium: 2,
      Low: 1
    };

    return weights[priority] || 2;
  }

  function effortWeight(effort) {
    const weights = {
      Low: 1,
      Medium: 2,
      High: 3
    };

    return weights[effort] || 2;
  }

  function toNumber(value) {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function lowercaseFirst(value) {
    const text = clean(value);

    if (!text) {
      return "";
    }

    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  /* =========================================================
     Exports
     ========================================================= */

  const api = {
    ENGINE_NAME,
    ENGINE_VERSION,
    SUPPORTED_INDUSTRIES,
    generateConsultingRecommendations,
    validateGrowthIntelligence,
    normalizeGrowthIntelligence,
    resolveIndustryProfile,
    resolveCategoryProfile,
    buildRecommendation
  };

  if (
    typeof module !== "undefined" &&
    module.exports
  ) {
    module.exports = api;
  }

  globalScope.GCMConsultingKnowledge = api;
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : window
);
