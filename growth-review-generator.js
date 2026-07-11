/* =========================================================
   Global Concepts Media Operating System
   File: growth-review-generator.js
   Version: 1.0.0
   Sprint: Growth Review Generator v1

   Purpose:
   Assemble the Business Record, Growth Intelligence, and
   Consulting Knowledge outputs into one structured
   90-Day Growth Review object.

   Inputs:
   - Business Record
   - Growth Intelligence
   - Consulting Knowledge

   Output:
   - Structured Growth Review Object

   This file does NOT:
   - Research websites
   - Fetch external information
   - Call AI
   - Generate HTML
   - Generate PDFs
   - Create new consulting conclusions
   - Modify any input object
   ========================================================= */

(function (globalScope) {
  "use strict";

  const GENERATOR_NAME = "GCM Growth Review Generator";
  const GENERATOR_VERSION = "1.0.0";
  const REVIEW_VERSION = "1.0.0";
  const REVIEW_TYPE = "90-Day Growth Review";

  function generateGrowthReview(
    businessRecord,
    growthIntelligence,
    consultingKnowledge
  ) {
    validateInputs(
      businessRecord,
      growthIntelligence,
      consultingKnowledge
    );

    const record = normalizeBusinessRecord(businessRecord);
    const intelligence = normalizeGrowthIntelligence(growthIntelligence);
    const consulting = normalizeConsultingKnowledge(consultingKnowledge);

    const businessOverview = buildBusinessOverview(
      record,
      intelligence,
      consulting
    );

    const executiveSummary = buildExecutiveSummary(
      record,
      intelligence,
      consulting
    );

    const businessHealth = buildBusinessHealth(intelligence);
    const topGrowthLeaks = buildTopGrowthLeaks(intelligence, consulting);
    const priorityMatrix = buildPriorityMatrix(intelligence, consulting);
    const actionPlan = buildActionPlan(intelligence, consulting);
    const expectedBusinessImpact = buildExpectedBusinessImpact(
      intelligence,
      consulting
    );
    const implementationOptions = buildImplementationOptions(
      intelligence,
      consulting
    );
    const consultantNotes = buildConsultantNotes(
      record,
      intelligence,
      consulting
    );
    const appendices = buildAppendices(record, intelligence, consulting);

    return {
      generator: {
        name: GENERATOR_NAME,
        version: GENERATOR_VERSION,
        generatedAt: new Date().toISOString(),
        sourceInputs: [
          "Business Record",
          "Growth Intelligence",
          "Consulting Knowledge"
        ],
        additionalResearchPerformed: false,
        aiUsed: false
      },

      review: {
        type: REVIEW_TYPE,
        version: REVIEW_VERSION,
        title: buildReviewTitle(record, intelligence, consulting),
        status: "Draft",
        reviewPeriod: "90 Days"
      },

      businessOverview,
      executiveSummary,
      businessHealth,
      topGrowthLeaks,
      priorityMatrix,
      actionPlan,
      expectedBusinessImpact,
      implementationOptions,
      consultantNotes,
      appendices,

      qualityControls: buildQualityControls(
        record,
        intelligence,
        consulting,
        topGrowthLeaks,
        actionPlan
      )
    };
  }

  function validateInputs(
    businessRecord,
    growthIntelligence,
    consultingKnowledge
  ) {
    if (!isObject(businessRecord)) {
      throw new TypeError(
        "Growth Review Generator requires a Business Record object."
      );
    }

    if (!isObject(growthIntelligence)) {
      throw new TypeError(
        "Growth Review Generator requires a Growth Intelligence object."
      );
    }

    if (!isObject(consultingKnowledge)) {
      throw new TypeError(
        "Growth Review Generator requires a Consulting Knowledge object."
      );
    }

    const hasBusinessIdentity =
      clean(businessRecord.businessName) ||
      clean(businessRecord.website) ||
      clean(businessRecord.business?.name) ||
      clean(businessRecord.business?.website) ||
      clean(growthIntelligence.business?.name) ||
      clean(growthIntelligence.business?.website) ||
      clean(consultingKnowledge.business?.name) ||
      clean(consultingKnowledge.business?.website);

    if (!hasBusinessIdentity) {
      throw new Error(
        "The supplied inputs do not contain a business name or website."
      );
    }

    if (
      !Array.isArray(growthIntelligence.topGrowthLeaks) ||
      growthIntelligence.topGrowthLeaks.length === 0
    ) {
      throw new Error(
        "Growth Intelligence does not contain topGrowthLeaks."
      );
    }

    if (
      !Array.isArray(consultingKnowledge.recommendations) ||
      consultingKnowledge.recommendations.length === 0
    ) {
      throw new Error(
        "Consulting Knowledge does not contain recommendations."
      );
    }

    return true;
  }

  function normalizeBusinessRecord(record) {
    const business = isObject(record.business) ? record.business : {};

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
        clean(business.summary),

      productsAndServices: firstNonEmptyArray(
        record.productsAndServices,
        record.websiteIntelligence?.productsAndServices
      ),

      targetCustomer:
        clean(record.targetCustomer) ||
        clean(record.websiteIntelligence?.targetCustomer),

      geographicMarket:
        clean(record.geographicMarket) ||
        clean(record.websiteIntelligence?.geographicMarket) ||
        clean(business.market),

      trustSignals: firstNonEmptyArray(
        record.trustSignals,
        record.websiteIntelligence?.trustSignals
      ),

      websiteObservations: firstNonEmptyArray(
        record.websiteObservations,
        record.websiteIntelligence?.websiteObservations
      ),

      growthOpportunities: firstNonEmptyArray(
        record.growthOpportunities,
        record.websiteIntelligence?.growthOpportunities
      ),

      missingInformation: firstNonEmptyArray(
        record.missingInformation,
        record.websiteIntelligence?.missingInformation
      ),

      successMetrics: firstNonEmptyArray(
        record.successMetrics,
        record.consultingIntelligence?.successMetrics
      ),

      contactEnrichment: isObject(record.contactEnrichment)
        ? clone(record.contactEnrichment)
        : {},

      publicPresence: isObject(record.publicPresence)
        ? clone(record.publicPresence)
        : {}
    };
  }

  function normalizeGrowthIntelligence(value) {
    return {
      business: isObject(value.business) ? clone(value.business) : {},
      executiveSummary: isObject(value.executiveSummary)
        ? clone(value.executiveSummary)
        : {},
      businessHealth: isObject(value.businessHealth)
        ? clone(value.businessHealth)
        : {},
      topGrowthLeaks: Array.isArray(value.topGrowthLeaks)
        ? clone(value.topGrowthLeaks)
        : [],
      priorityMatrix: Array.isArray(value.priorityMatrix)
        ? clone(value.priorityMatrix)
        : [],
      roadmap: isObject(value.roadmap) ? clone(value.roadmap) : {},
      expectedBusinessImpact: isObject(value.expectedBusinessImpact)
        ? clone(value.expectedBusinessImpact)
        : {},
      implementationOptions: Array.isArray(value.implementationOptions)
        ? clone(value.implementationOptions)
        : [],
      verificationRequired: Array.isArray(value.verificationRequired)
        ? clone(value.verificationRequired)
        : [],
      evidenceSummary: isObject(value.evidenceSummary)
        ? clone(value.evidenceSummary)
        : {}
    };
  }

  function normalizeConsultingKnowledge(value) {
    return {
      business: isObject(value.business) ? clone(value.business) : {},
      consultantSummary: isObject(value.consultantSummary)
        ? clone(value.consultantSummary)
        : {},
      strategicThemes: Array.isArray(value.strategicThemes)
        ? clone(value.strategicThemes)
        : [],
      recommendations: Array.isArray(value.recommendations)
        ? clone(value.recommendations)
        : [],
      implementationRoadmap: isObject(value.implementationRoadmap)
        ? clone(value.implementationRoadmap)
        : {},
      expectedBusinessValue: isObject(value.expectedBusinessValue)
        ? clone(value.expectedBusinessValue)
        : {},
      verificationRequired: Array.isArray(value.verificationRequired)
        ? clone(value.verificationRequired)
        : [],
      methodology: isObject(value.methodology)
        ? clone(value.methodology)
        : {}
    };
  }

  function buildReviewTitle(record, intelligence, consulting) {
    const businessName =
      clean(record.businessName) ||
      clean(intelligence.business.name) ||
      clean(consulting.business.name) ||
      "Business";

    return `${businessName} — ${REVIEW_TYPE}`;
  }

  function buildBusinessOverview(record, intelligence, consulting) {
    return {
      businessName:
        clean(record.businessName) ||
        clean(intelligence.business.name) ||
        clean(consulting.business.name),

      website:
        clean(record.website) ||
        clean(intelligence.business.website) ||
        clean(consulting.business.website),

      industry:
        clean(record.industry) ||
        clean(intelligence.business.industry) ||
        clean(consulting.business.industry),

      normalizedIndustry:
        clean(consulting.business.normalizedIndustry),

      industryLabel:
        clean(consulting.business.industryLabel),

      geographicMarket:
        clean(record.geographicMarket) ||
        clean(intelligence.business.geographicMarket) ||
        clean(consulting.business.geographicMarket),

      businessSummary:
        clean(record.businessSummary),

      productsAndServices:
        record.productsAndServices.slice(),

      targetCustomer:
        clean(record.targetCustomer),

      currentStrengths:
        buildCurrentStrengths(record, intelligence),

      currentConstraints:
        buildCurrentConstraints(record, intelligence)
    };
  }

  function buildCurrentStrengths(record, intelligence) {
    const strengths = [];

    record.trustSignals.slice(0, 5).forEach(function (item) {
      strengths.push(item);
    });

    if (clean(intelligence.businessHealth.strongestArea)) {
      strengths.push(
        `Strongest scored area: ${formatLabel(
          intelligence.businessHealth.strongestArea
        )}`
      );
    }

    if (record.productsAndServices.length > 0) {
      strengths.push(
        "The Business Record identifies clear products or services."
      );
    }

    if (clean(record.targetCustomer)) {
      strengths.push(
        "The Business Record identifies a target customer."
      );
    }

    return unique(strengths).slice(0, 6);
  }

  function buildCurrentConstraints(record, intelligence) {
    const constraints = [];

    record.missingInformation.slice(0, 5).forEach(function (item) {
      constraints.push(item);
    });

    if (clean(intelligence.businessHealth.weakestArea)) {
      constraints.push(
        `Weakest scored area: ${formatLabel(
          intelligence.businessHealth.weakestArea
        )}`
      );
    }

    return unique(constraints).slice(0, 6);
  }

  function buildExecutiveSummary(record, intelligence, consulting) {
    return {
      opening:
        clean(consulting.consultantSummary.opening) ||
        clean(intelligence.executiveSummary.currentPosition),

      industryContext:
        clean(consulting.consultantSummary.industryContext),

      primaryFinding:
        clean(intelligence.executiveSummary.primaryFinding),

      highestValuePriority:
        clean(consulting.consultantSummary.primaryIssue) ||
        clean(intelligence.executiveSummary.recommendedDirection),

      recommendedApproach:
        clean(consulting.consultantSummary.recommendedApproach),

      consultantNarrative:
        clean(consulting.consultantSummary.narrative) ||
        clean(intelligence.executiveSummary.consultantNarrative),

      reviewPurpose:
        "Provide a prioritized, evidence-based 90-day plan that improves visibility, trust, conversion, measurement, and measurable business growth.",

      limitation:
        "This review is based only on the Business Record and the structured intelligence generated from it. Findings requiring internal access or confirmation are identified for verification."
    };
  }

  function buildBusinessHealth(intelligence) {
    const health = intelligence.businessHealth;

    return {
      score: toNumber(health.score),
      rating: clean(health.rating),
      categoryScores: isObject(health.categoryScores)
        ? clone(health.categoryScores)
        : {},
      strongestArea: clean(health.strongestArea),
      weakestArea: clean(health.weakestArea),
      scoringMethod: clean(health.scoringMethod)
    };
  }

  function buildTopGrowthLeaks(intelligence, consulting) {
    return intelligence.topGrowthLeaks
      .slice(0, 5)
      .map(function (leak, index) {
        const recommendation =
          findRecommendationByGrowthLeakId(
            consulting.recommendations,
            leak.id
          );

        return {
          rank: index + 1,
          id: clean(leak.id),
          category: clean(leak.category),
          finding: clean(leak.finding),
          observableEvidence: clean(leak.observableEvidence),
          whyItMatters: clean(leak.whyItMatters),
          businessImpact: clean(leak.businessImpact),
          priority: clean(leak.priority),
          estimatedEffort: clean(leak.estimatedEffort),
          expectedOutcome: clean(leak.expectedOutcome),

          consultantInterpretation:
            clean(recommendation?.consultantInterpretation),

          primaryRecommendation:
            clean(recommendation?.primaryRecommendation) ||
            clean(leak.recommendedAction),

          recommendedActions:
            Array.isArray(recommendation?.recommendedActions)
              ? clone(recommendation.recommendedActions)
              : [],

          successMetrics:
            Array.isArray(recommendation?.successMetrics)
              ? clone(recommendation.successMetrics)
              : [],

          verificationRequired:
            Array.isArray(recommendation?.verificationRequired)
              ? clone(recommendation.verificationRequired)
              : [],

          confidence:
            isObject(recommendation?.confidence)
              ? clone(recommendation.confidence)
              : {}
        };
      });
  }

  function buildPriorityMatrix(intelligence, consulting) {
    return intelligence.priorityMatrix.map(function (item, index) {
      const recommendation =
        findRecommendationByGrowthLeakId(
          consulting.recommendations,
          item.leakId
        );

      return {
        rank: index + 1,
        growthLeakId: clean(item.leakId),
        category: clean(item.category),
        finding: clean(item.finding),
        priority: clean(item.priority),
        estimatedEffort: clean(item.estimatedEffort),
        opportunityScore: toNumber(item.opportunityScore),
        quadrant: clean(item.quadrant),
        recommendedSequence: clean(item.recommendedSequence),
        primaryRecommendation:
          clean(recommendation?.primaryRecommendation),
        expectedOutcome:
          clean(recommendation?.expectedOutcome)
      };
    });
  }

  function buildActionPlan(intelligence, consulting) {
    const roadmap = consulting.implementationRoadmap;

    return {
      days1To30: buildActionPhase(
        roadmap.days1To30,
        "Days 1–30",
        "Quick Wins"
      ),

      days31To60: buildActionPhase(
        roadmap.days31To60,
        "Days 31–60",
        "Core Improvements"
      ),

      days61To90: buildActionPhase(
        roadmap.days61To90,
        "Days 61–90",
        "Strategic Projects"
      ),

      fallbackSource:
        hasRoadmapItems(roadmap)
          ? "Consulting Knowledge"
          : "Growth Intelligence",

      growthIntelligenceRoadmap:
        hasRoadmapItems(roadmap)
          ? {}
          : clone(intelligence.roadmap)
    };
  }

  function buildActionPhase(items, timeframe, phaseName) {
    const sourceItems = Array.isArray(items) ? items : [];

    return {
      timeframe,
      phaseName,
      objective: getPhaseObjective(timeframe),
      actions: sourceItems.map(function (item, index) {
        return {
          sequence: toNumber(item.sequence) || index + 1,
          recommendationId: clean(item.recommendationId),
          growthLeakId: clean(item.growthLeakId),
          category: clean(item.category),
          action: clean(item.action),
          priority: clean(item.priority),
          estimatedEffort: clean(item.estimatedEffort),
          expectedOutcome: clean(item.expectedOutcome),
          successMetrics: Array.isArray(item.successMetrics)
            ? clone(item.successMetrics)
            : [],
          completionStandard: clean(item.completionStandard)
        };
      })
    };
  }

  function getPhaseObjective(timeframe) {
    if (timeframe === "Days 1–30") {
      return "Verify the evidence, establish measurement, and complete the highest-impact low-effort actions.";
    }

    if (timeframe === "Days 31–60") {
      return "Strengthen the systems that influence trust, conversion, visibility, and lead quality.";
    }

    return "Complete strategic improvements, confirm measurable results, and define the next growth cycle.";
  }

  function buildExpectedBusinessImpact(intelligence, consulting) {
    const growthImpact = intelligence.expectedBusinessImpact;
    const consultingValue = consulting.expectedBusinessValue;

    return {
      primaryImpactAreas: unique([
        ...safeArray(growthImpact.primaryImpactAreas),
        ...safeArray(consultingValue.primaryImpactAreas)
      ]),

      expectedNearTermImpact:
        clean(consultingValue.expectedNearTermImpact) ||
        clean(growthImpact.expectedNearTermImpact),

      expectedMidTermImpact:
        clean(consultingValue.expectedMidTermImpact) ||
        clean(growthImpact.expectedMidTermImpact),

      expectedLongTermImpact:
        clean(consultingValue.expectedLongTermImpact) ||
        clean(growthImpact.expectedLongTermImpact),

      healthScoreContext:
        clean(consultingValue.healthScoreContext),

      revenueStatement:
        clean(growthImpact.revenueStatement),

      revenueFormula:
        clean(consultingValue.revenueFormula),

      revenueCalculationRequirements:
        safeArray(consultingValue.revenueCalculationRequirements),

      proofRequirements:
        safeArray(growthImpact.proofRequirements),

      limitation:
        clean(consultingValue.limitation)
    };
  }

  function buildImplementationOptions(intelligence, consulting) {
    if (
      Array.isArray(intelligence.implementationOptions) &&
      intelligence.implementationOptions.length > 0
    ) {
      return clone(intelligence.implementationOptions);
    }

    return [
      {
        option: "Internal Implementation",
        description:
          "The business executes the verified 90-day plan using internal staff and resources.",
        bestFor:
          "Businesses with available staff, technical access, and clear accountability."
      },
      {
        option: "Global Concepts Media Implementation",
        description:
          "Global Concepts Media verifies priorities, executes approved work, and measures results.",
        bestFor:
          "Businesses that want one accountable growth partner."
      },
      {
        option: "Qualified Third-Party Implementation",
        description:
          "The business provides the structured review to another qualified provider.",
        bestFor:
          "Businesses with an existing implementation partner."
      },
      {
        option: "Phased Growth Partnership",
        description:
          "The roadmap is implemented in controlled phases with ongoing measurement and improvement.",
        bestFor:
          "Businesses that want continuous execution and optimization."
      }
    ];
  }

  function buildConsultantNotes(record, intelligence, consulting) {
    return {
      methodology:
        isObject(consulting.methodology)
          ? clone(consulting.methodology)
          : {},

      evidenceQuality:
        clean(intelligence.evidenceSummary.evidenceQuality),

      evidenceLimitation:
        clean(intelligence.evidenceSummary.limitation),

      verificationRequired: unique([
        ...record.missingInformation,
        ...safeArray(intelligence.verificationRequired),
        ...safeArray(consulting.verificationRequired)
      ]).slice(0, 20),

      consultantPrinciples: [
        "Evidence before assumptions.",
        "Every recommendation must connect to business impact.",
        "No revenue claim should be made without verified inputs.",
        "Measurement must be established before results are judged.",
        "The highest-value actions should be completed first."
      ]
    };
  }

  function buildAppendices(record, intelligence, consulting) {
    return {
      appendixA_businessRecordEvidence: {
        trustSignals: record.trustSignals.slice(),
        websiteObservations: record.websiteObservations.slice(),
        growthOpportunities: record.growthOpportunities.slice(),
        missingInformation: record.missingInformation.slice(),
        successMetrics: record.successMetrics.slice()
      },

      appendixB_strategicThemes:
        consulting.strategicThemes.slice(),

      appendixC_evidenceSummary:
        clone(intelligence.evidenceSummary),

      appendixD_contactAndPresence: {
        contactEnrichment:
          clone(record.contactEnrichment),
        publicPresence:
          clone(record.publicPresence)
      }
    };
  }

  function buildQualityControls(
    record,
    intelligence,
    consulting,
    topGrowthLeaks,
    actionPlan
  ) {
    const checks = {
      businessIdentityPresent:
        Boolean(
          clean(record.businessName) ||
          clean(record.website)
        ),

      businessHealthPresent:
        typeof intelligence.businessHealth.score === "number",

      growthLeaksPresent:
        topGrowthLeaks.length > 0,

      consultingRecommendationsPresent:
        consulting.recommendations.length > 0,

      actionPlanPresent:
        countActionPlanItems(actionPlan) > 0,

      verificationPresent:
        (
          safeArray(intelligence.verificationRequired).length +
          safeArray(consulting.verificationRequired).length +
          record.missingInformation.length
        ) > 0,

      usedApprovedInputsOnly: true,
      additionalResearchPerformed: false,
      aiUsed: false
    };

    const passed = Object.values(checks).every(function (value) {
      return value === true;
    });

    return {
      passed,
      checks,
      readyForPresentationLayer: passed,
      nextRequiredLayer:
        passed
          ? "Growth Review Presentation"
          : "Resolve failed quality-control checks"
    };
  }

  function findRecommendationByGrowthLeakId(
    recommendations,
    growthLeakId
  ) {
    return recommendations.find(function (item) {
      return clean(item.growthLeakId) === clean(growthLeakId);
    });
  }

  function hasRoadmapItems(roadmap) {
    if (!isObject(roadmap)) {
      return false;
    }

    return (
      safeArray(roadmap.days1To30).length > 0 ||
      safeArray(roadmap.days31To60).length > 0 ||
      safeArray(roadmap.days61To90).length > 0
    );
  }

  function countActionPlanItems(actionPlan) {
    return (
      safeArray(actionPlan.days1To30?.actions).length +
      safeArray(actionPlan.days31To60?.actions).length +
      safeArray(actionPlan.days61To90?.actions).length
    );
  }

  function formatLabel(value) {
    return clean(value)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, function (character) {
        return character.toUpperCase();
      });
  }

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
          if (typeof item === "string") {
            return clean(item);
          }

          if (isObject(item)) {
            return clean(
              item.name ||
              item.value ||
              item.description ||
              item.finding ||
              item.observation
            );
          }

          return clean(item);
        })
        .filter(Boolean)
    );
  }

  function firstNonEmptyArray() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = cleanArray(arguments[index]);

      if (value.length > 0) {
        return value;
      }
    }

    return [];
  }

  function safeArray(value) {
    return Array.isArray(value) ? clone(value) : [];
  }

  function unique(items) {
    const seen = new Set();

    return items
      .map(function (item) {
        return clean(item);
      })
      .filter(function (item) {
        if (!item) {
          return false;
        }

        const key = item.toLowerCase();

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

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function toNumber(value) {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
  }

  const api = {
    GENERATOR_NAME,
    GENERATOR_VERSION,
    REVIEW_VERSION,
    REVIEW_TYPE,
    generateGrowthReview,
    validateInputs,
    normalizeBusinessRecord,
    normalizeGrowthIntelligence,
    normalizeConsultingKnowledge,
    buildExecutiveSummary,
    buildBusinessOverview,
    buildBusinessHealth,
    buildTopGrowthLeaks,
    buildPriorityMatrix,
    buildActionPlan,
    buildExpectedBusinessImpact,
    buildImplementationOptions,
    buildConsultantNotes,
    buildAppendices
  };

  if (
    typeof module !== "undefined" &&
    module.exports
  ) {
    module.exports = api;
  }

  globalScope.GCMGrowthReviewGenerator = api;
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : window
);
