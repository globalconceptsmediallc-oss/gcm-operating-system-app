/* =========================================================
   Global Concepts Media Operating System
   File: growth-review-presentation.js
   Version: 1.0.0
   Sprint: Growth Review Presentation Layer v1

   Purpose:
   Transform a completed Growth Review Object into a
   presentation-ready model for future HTML and PDF outputs.

   Input:
   - Growth Review Object

   Output:
   - Growth Review Presentation Model

   This file does NOT:
   - Research websites
   - Fetch external information
   - Call AI
   - Generate HTML
   - Generate PDFs
   - Create new consulting conclusions
   - Modify the Growth Review Object
   ========================================================= */

(function (globalScope) {
  "use strict";

  const ENGINE_NAME = "GCM Growth Review Presentation";
  const ENGINE_VERSION = "1.0.0";

  function generatePresentationModel(growthReview) {
    validateGrowthReview(growthReview);

    const review = clone(growthReview);

    const cover = buildCover(review);
    const executiveBrief = buildExecutiveBrief(review);
    const businessSnapshot = buildBusinessSnapshot(review);
    const healthScorecard = buildHealthScorecard(review);
    const keyFindings = buildKeyFindings(review);
    const priorityMatrix = buildPriorityMatrix(review);
    const roadmap = buildRoadmap(review);
    const expectedImpact = buildExpectedImpact(review);
    const implementationOptions = buildImplementationOptions(review);
    const consultantNotes = buildConsultantNotes(review);
    const appendices = buildAppendices(review);

    return {
      engine: {
        name: ENGINE_NAME,
        version: ENGINE_VERSION,
        generatedAt: new Date().toISOString(),
        source: "Growth Review Object",
        additionalResearchPerformed: false,
        aiUsed: false
      },

      document: {
        title: clean(review.review?.title),
        type: clean(review.review?.type),
        version: clean(review.review?.version),
        status: clean(review.review?.status),
        reviewPeriod: clean(review.review?.reviewPeriod)
      },

      cover,
      executiveBrief,
      businessSnapshot,
      healthScorecard,
      keyFindings,
      priorityMatrix,
      roadmap,
      expectedImpact,
      implementationOptions,
      consultantNotes,
      appendices,

      navigation: buildNavigation(),

      qualityControls: buildQualityControls({
        cover,
        executiveBrief,
        businessSnapshot,
        healthScorecard,
        keyFindings,
        priorityMatrix,
        roadmap,
        expectedImpact,
        implementationOptions
      })
    };
  }

  function validateGrowthReview(value) {
    if (!isObject(value)) {
      throw new TypeError(
        "Growth Review Presentation requires a Growth Review object."
      );
    }

    if (!isObject(value.review)) {
      throw new Error(
        "Growth Review object is missing review metadata."
      );
    }

    if (!isObject(value.businessOverview)) {
      throw new Error(
        "Growth Review object is missing businessOverview."
      );
    }

    if (!isObject(value.executiveSummary)) {
      throw new Error(
        "Growth Review object is missing executiveSummary."
      );
    }

    if (!Array.isArray(value.topGrowthLeaks)) {
      throw new Error(
        "Growth Review object is missing topGrowthLeaks."
      );
    }

    if (!isObject(value.actionPlan)) {
      throw new Error(
        "Growth Review object is missing actionPlan."
      );
    }

    return true;
  }

  function buildCover(review) {
    return {
      eyebrow: "Global Concepts Media",
      title: clean(review.review.title),
      subtitle:
        "Evidence-based priorities, business impact, and a practical 90-day action plan.",
      businessName:
        clean(review.businessOverview.businessName),
      website:
        clean(review.businessOverview.website),
      industry:
        clean(
          review.businessOverview.industryLabel ||
          review.businessOverview.industry
        ),
      geographicMarket:
        clean(review.businessOverview.geographicMarket),
      reviewPeriod:
        clean(review.review.reviewPeriod),
      documentStatus:
        clean(review.review.status),
      generatedAt:
        clean(review.generator?.generatedAt)
    };
  }

  function buildExecutiveBrief(review) {
    const topLeak = review.topGrowthLeaks[0] || {};
    const firstAction =
      review.actionPlan?.days1To30?.actions?.[0] || {};

    return {
      sectionTitle: "Executive Brief",
      headline:
        clean(review.executiveSummary.opening),
      businessContext:
        clean(review.executiveSummary.industryContext),
      mostImportantFinding:
        clean(review.executiveSummary.primaryFinding) ||
        clean(topLeak.finding),
      firstPriority:
        clean(review.executiveSummary.highestValuePriority) ||
        clean(firstAction.action),
      recommendedApproach:
        clean(review.executiveSummary.recommendedApproach),
      summary:
        clean(review.executiveSummary.consultantNarrative),
      decisionSummary: [
        {
          label: "Business Health",
          value: buildHealthLabel(review.businessHealth)
        },
        {
          label: "Highest Priority",
          value:
            clean(topLeak.category) || "Requires verification"
        },
        {
          label: "First 30-Day Action",
          value:
            clean(firstAction.action) || "Requires verification"
        }
      ]
    };
  }

  function buildBusinessSnapshot(review) {
    return {
      sectionTitle: "Business Overview",
      businessName:
        clean(review.businessOverview.businessName),
      website:
        clean(review.businessOverview.website),
      industry:
        clean(
          review.businessOverview.industryLabel ||
          review.businessOverview.industry
        ),
      geographicMarket:
        clean(review.businessOverview.geographicMarket),
      businessSummary:
        clean(review.businessOverview.businessSummary),
      targetCustomer:
        clean(review.businessOverview.targetCustomer),
      productsAndServices:
        safeArray(review.businessOverview.productsAndServices),
      strengths:
        safeArray(review.businessOverview.currentStrengths),
      constraints:
        safeArray(review.businessOverview.currentConstraints)
    };
  }

  function buildHealthScorecard(review) {
    const scores = isObject(review.businessHealth.categoryScores)
      ? review.businessHealth.categoryScores
      : {};

    return {
      sectionTitle: "Business Health Score",
      score: toNumber(review.businessHealth.score),
      rating: clean(review.businessHealth.rating),
      strongestArea:
        formatLabel(review.businessHealth.strongestArea),
      weakestArea:
        formatLabel(review.businessHealth.weakestArea),
      scoringMethod:
        clean(review.businessHealth.scoringMethod),
      categories: Object.keys(scores).map(function (key) {
        return {
          id: key,
          label: formatLabel(key),
          score: toNumber(scores[key]),
          rating: getScoreRating(toNumber(scores[key]))
        };
      })
    };
  }

  function buildKeyFindings(review) {
    return {
      sectionTitle: "Top Growth Leaks",
      introduction:
        "These findings represent the highest-value constraints identified from the available evidence.",
      items: safeArray(review.topGrowthLeaks).map(function (
        finding
      ) {
        return {
          rank: toNumber(finding.rank),
          id: clean(finding.id),
          category: clean(finding.category),
          finding: clean(finding.finding),
          evidence: clean(finding.observableEvidence),
          whyItMatters: clean(finding.whyItMatters),
          businessImpact: clean(finding.businessImpact),
          priority: clean(finding.priority),
          effort: clean(finding.estimatedEffort),
          recommendation:
            clean(finding.primaryRecommendation),
          expectedOutcome:
            clean(finding.expectedOutcome),
          successMetrics:
            safeArray(finding.successMetrics),
          verificationRequired:
            safeArray(finding.verificationRequired),
          confidence:
            isObject(finding.confidence)
              ? clone(finding.confidence)
              : {}
        };
      })
    };
  }

  function buildPriorityMatrix(review) {
    return {
      sectionTitle: "Priority Matrix",
      introduction:
        "Priorities are ordered by business impact, implementation effort, and the strength of the available evidence.",
      items: safeArray(review.priorityMatrix).map(function (
        item
      ) {
        return {
          rank: toNumber(item.rank),
          category: clean(item.category),
          finding: clean(item.finding),
          priority: clean(item.priority),
          effort: clean(item.estimatedEffort),
          opportunityScore:
            toNumber(item.opportunityScore),
          quadrant: clean(item.quadrant),
          sequence:
            clean(item.recommendedSequence),
          recommendation:
            clean(item.primaryRecommendation),
          expectedOutcome:
            clean(item.expectedOutcome)
        };
      })
    };
  }

  function buildRoadmap(review) {
    return {
      sectionTitle: "90-Day Growth Roadmap",
      introduction:
        "The roadmap is sequenced to establish measurement first, complete practical quick wins, and then advance into broader strategic improvements.",
      phases: [
        buildRoadmapPhase(
          review.actionPlan.days1To30,
          "30-Day Quick Wins"
        ),
        buildRoadmapPhase(
          review.actionPlan.days31To60,
          "60-Day Improvements"
        ),
        buildRoadmapPhase(
          review.actionPlan.days61To90,
          "90-Day Strategic Projects"
        )
      ]
    };
  }

  function buildRoadmapPhase(phase, displayTitle) {
    const source = isObject(phase) ? phase : {};

    return {
      displayTitle,
      timeframe: clean(source.timeframe),
      phaseName: clean(source.phaseName),
      objective: clean(source.objective),
      actions: safeArray(source.actions).map(function (
        item
      ) {
        return {
          sequence: toNumber(item.sequence),
          category: clean(item.category),
          action: clean(item.action),
          priority: clean(item.priority),
          effort: clean(item.estimatedEffort),
          expectedOutcome:
            clean(item.expectedOutcome),
          successMetrics:
            safeArray(item.successMetrics),
          completionStandard:
            clean(item.completionStandard)
        };
      })
    };
  }

  function buildExpectedImpact(review) {
    const impact = isObject(review.expectedBusinessImpact)
      ? review.expectedBusinessImpact
      : {};

    return {
      sectionTitle: "Expected Business Impact",
      impactAreas:
        safeArray(impact.primaryImpactAreas),
      nearTerm:
        clean(impact.expectedNearTermImpact),
      midTerm:
        clean(impact.expectedMidTermImpact),
      longTerm:
        clean(impact.expectedLongTermImpact),
      healthScoreContext:
        clean(impact.healthScoreContext),
      revenueStatement:
        clean(impact.revenueStatement),
      revenueFormula:
        clean(impact.revenueFormula),
      revenueInputsRequired:
        safeArray(
          impact.revenueCalculationRequirements
        ),
      proofRequirements:
        safeArray(impact.proofRequirements),
      limitation:
        clean(impact.limitation)
    };
  }

  function buildImplementationOptions(review) {
    return {
      sectionTitle: "Implementation Options",
      introduction:
        "The review can be implemented internally, through Global Concepts Media, or with another qualified provider.",
      items: safeArray(review.implementationOptions).map(
        function (option, index) {
          return {
            order: index + 1,
            option: clean(option.option),
            description:
              clean(option.description),
            bestFor:
              clean(option.bestFor),
            requiredControls:
              safeArray(option.requiredControls),
            recommended:
              clean(option.option) ===
              "Global Concepts Media Implementation"
          };
        }
      )
    };
  }

  function buildConsultantNotes(review) {
    const notes = isObject(review.consultantNotes)
      ? review.consultantNotes
      : {};

    return {
      sectionTitle: "Consultant Notes",
      methodology:
        isObject(notes.methodology)
          ? clone(notes.methodology)
          : {},
      evidenceQuality:
        clean(notes.evidenceQuality),
      evidenceLimitation:
        clean(notes.evidenceLimitation),
      verificationRequired:
        safeArray(notes.verificationRequired),
      consultantPrinciples:
        safeArray(notes.consultantPrinciples)
    };
  }

  function buildAppendices(review) {
    return {
      sectionTitle: "Appendices",
      data:
        isObject(review.appendices)
          ? clone(review.appendices)
          : {}
    };
  }

  function buildNavigation() {
    return [
      {
        id: "executive-brief",
        label: "Executive Brief"
      },
      {
        id: "business-overview",
        label: "Business Overview"
      },
      {
        id: "business-health",
        label: "Business Health"
      },
      {
        id: "growth-leaks",
        label: "Top Growth Leaks"
      },
      {
        id: "priority-matrix",
        label: "Priority Matrix"
      },
      {
        id: "roadmap",
        label: "90-Day Roadmap"
      },
      {
        id: "business-impact",
        label: "Business Impact"
      },
      {
        id: "implementation-options",
        label: "Implementation Options"
      },
      {
        id: "consultant-notes",
        label: "Consultant Notes"
      }
    ];
  }

  function buildQualityControls(sections) {
    const checks = {
      coverCreated:
        Boolean(clean(sections.cover.title)),
      executiveBriefCreated:
        Boolean(clean(sections.executiveBrief.summary)),
      businessSnapshotCreated:
        Boolean(
          clean(
            sections.businessSnapshot.businessName
          )
        ),
      healthScorecardCreated:
        typeof sections.healthScorecard.score ===
        "number",
      keyFindingsCreated:
        sections.keyFindings.items.length > 0,
      priorityMatrixCreated:
        sections.priorityMatrix.items.length > 0,
      roadmapCreated:
        sections.roadmap.phases.some(function (
          phase
        ) {
          return phase.actions.length > 0;
        }),
      expectedImpactCreated:
        Boolean(
          clean(
            sections.expectedImpact.nearTerm
          )
        ),
      implementationOptionsCreated:
        sections.implementationOptions.items
          .length > 0,
      additionalResearchPerformed: false,
      aiUsed: false
    };

    const passed =
      checks.coverCreated === true &&
      checks.executiveBriefCreated === true &&
      checks.businessSnapshotCreated === true &&
      checks.healthScorecardCreated === true &&
      checks.keyFindingsCreated === true &&
      checks.priorityMatrixCreated === true &&
      checks.roadmapCreated === true &&
      checks.expectedImpactCreated === true &&
      checks.implementationOptionsCreated === true &&
      checks.additionalResearchPerformed === false &&
      checks.aiUsed === false;

    return {
      passed,
      checks,
      readyForHtmlRenderer: passed,
      readyForPdfRenderer: passed
    };
  }

  function buildHealthLabel(health) {
    const score = toNumber(health?.score);
    const rating = clean(health?.rating);

    if (!rating) {
      return `${score}/100`;
    }

    return `${score}/100 — ${rating}`;
  }

  function getScoreRating(score) {
    if (score >= 85) {
      return "Strong";
    }

    if (score >= 70) {
      return "Healthy";
    }

    if (score >= 55) {
      return "Constrained";
    }

    if (score >= 40) {
      return "Weak";
    }

    return "Requires Attention";
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

  function safeArray(value) {
    return Array.isArray(value)
      ? clone(value)
      : [];
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

    return Number.isFinite(number)
      ? number
      : 0;
  }

  const api = {
    ENGINE_NAME,
    ENGINE_VERSION,
    generatePresentationModel,
    validateGrowthReview,
    buildCover,
    buildExecutiveBrief,
    buildBusinessSnapshot,
    buildHealthScorecard,
    buildKeyFindings,
    buildPriorityMatrix,
    buildRoadmap,
    buildExpectedImpact,
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

  globalScope.GCMGrowthReviewPresentation = api;
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : window
);
