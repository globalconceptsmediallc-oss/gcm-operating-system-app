/* =========================================================
   Global Concepts Media Operating System (GCM OS)
   File: engines/htmlIntelligence.js
   Engine: HTML Intelligence
   Version: 1.0.0
   Status: Production Foundation

   Responsibility:
   Convert supplied public HTML and parsed page elements into
   structured page-structure evidence.

   This engine does not fetch websites and must never:
   - diagnose business performance,
   - classify Growth Leaks,
   - prioritize findings,
   - recommend actions,
   - score page quality,
   - estimate business impact,
   - write outreach,
   - or generate client deliverables.

   Core Principle:
   Evidence Before Assumptions.
   ========================================================= */

const HTML_INTELLIGENCE_MODEL = "@cf/openai/gpt-oss-20b";

export const HtmlIntelligenceEngine = Object.freeze({
  id: "html-intelligence",
  name: "HTML Intelligence Engine",
  version: "1.0.0",
  responsibility: "Public HTML structure evidence extraction only",
  model: HTML_INTELLIGENCE_MODEL,

  systemRole: [
    "You are the HTML Intelligence Engine for the Global Concepts Media Operating System.",
    "Your only responsibility is to extract publicly observable page-structure evidence from supplied HTML and parsed page elements.",
    "Never diagnose the business.",
    "Never declare poor user experience, accessibility noncompliance, SEO failure, weak design, or conversion failure unless the supplied evidence directly establishes that fact.",
    "Never classify a Growth Leak.",
    "Never prioritize findings.",
    "Never recommend actions.",
    "Never estimate business impact.",
    "Never write outreach or generate a client deliverable.",
    "Return only valid JSON matching the required output contract."
  ].join(" "),

  evidenceRules: Object.freeze([
    "Use only the supplied HTML, headings, landmarks, navigation, links, buttons, forms, images, lists, tables, structured data, and page metadata.",
    "Never infer business intent from visual appearance alone.",
    "Record directly observable structure separately from inferred page purpose.",
    "Use Unknown when a scalar value cannot be established.",
    "Use an empty array when no evidence exists for a collection.",
    "Do not treat missing headings, landmarks, labels, alt attributes, links, trust elements, or CTAs as Growth Leaks.",
    "Record ambiguous hierarchy, repeated primary headings, unclear CTA destinations, repeated navigation, conflicting page purpose, or malformed elements under verificationRequired.",
    "Every material structural observation must include a source and evidenceText.",
    "Return no prose outside the JSON object."
  ]),

  requiredOutputFields: Object.freeze([
    "engine",
    "website",
    "pageIdentity",
    "headingStructure",
    "semanticLandmarks",
    "navigationStructure",
    "conversionStructure",
    "trustStructure",
    "contentStructure",
    "imageStructure",
    "localStructure",
    "internalLinkStructure",
    "verificationRequired",
    "evidenceSummary"
  ])
});

/* =========================================================
   Public API
   ========================================================= */

export async function executeHtmlIntelligence(env, input) {
  validateExecutionInput(env, input);

  const messages = buildHtmlIntelligenceMessages(input);

  const response = await env.AI.run(
    HTML_INTELLIGENCE_MODEL,
    { messages }
  );

  const rawText = extractModelText(response);
  const parsed = parseJsonResponse(rawText);
  const normalized = normalizeHtmlIntelligenceResult(parsed, input);
  const validation = validateHtmlIntelligenceResult(normalized);

  if (!validation.valid) {
    throw new Error(
      `HTML Intelligence output failed validation: ${validation.errors.join("; ")}`
    );
  }

  return normalized;
}

export function buildHtmlIntelligenceMessages(input) {
  const normalizedInput = normalizeInput(input);

  return [
    {
      role: "system",
      content: HtmlIntelligenceEngine.systemRole
    },
    {
      role: "user",
      content: buildUserPrompt(normalizedInput)
    }
  ];
}

export function validateHtmlIntelligenceResult(result) {
  const errors = [];

  if (!isPlainObject(result)) {
    return {
      valid: false,
      errors: ["Result must be a JSON object."]
    };
  }

  for (const field of HtmlIntelligenceEngine.requiredOutputFields) {
    if (!(field in result)) {
      errors.push(`Missing top-level field: ${field}`);
    }
  }

  if (result.engine?.id !== HtmlIntelligenceEngine.id) {
    errors.push("engine.id must equal html-intelligence.");
  }

  if (result.engine?.version !== HtmlIntelligenceEngine.version) {
    errors.push("engine.version must equal 1.0.0.");
  }

  const arrayFields = [
    "semanticLandmarks",
    "verificationRequired"
  ];

  for (const field of arrayFields) {
    if (!Array.isArray(result[field])) {
      errors.push(`${field} must be an array.`);
    }
  }

  const objectFields = [
    "website",
    "pageIdentity",
    "headingStructure",
    "navigationStructure",
    "conversionStructure",
    "trustStructure",
    "contentStructure",
    "imageStructure",
    "localStructure",
    "internalLinkStructure",
    "evidenceSummary"
  ];

  for (const field of objectFields) {
    if (!isPlainObject(result[field])) {
      errors.push(`${field} must be an object.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/* =========================================================
   Prompt Construction
   ========================================================= */

function buildUserPrompt(input) {
  const outputContract = {
    engine: {
      id: "html-intelligence",
      version: "1.0.0"
    },

    website: {
      requestedUrl: "string",
      finalUrl: "string or Unknown",
      retrievedAt: "string or Unknown",
      sourcePages: ["string"]
    },

    pageIdentity: {
      title: "string or Unknown",
      metaDescription: "string or Unknown",
      pageType:
        "homepage, service-page, location-page, about-page, contact-page, article, landing-page, product-page, category-page, or Unknown",
      pagePurposeEvidence: [
        {
          finding: "string",
          source: "string",
          evidenceText: "string"
        }
      ]
    },

    headingStructure: {
      headings: [
        {
          level: "H1, H2, H3, H4, H5, or H6",
          text: "string",
          source: "string",
          evidenceText: "string"
        }
      ],
      h1Count: "integer",
      emptyHeadings: [
        {
          level: "string",
          source: "string",
          evidenceText: "string"
        }
      ],
      repeatedHeadings: [
        {
          text: "string",
          count: "integer",
          source: "string"
        }
      ],
      hierarchyObservations: [
        {
          finding: "string",
          source: "string",
          evidenceText: "string"
        }
      ]
    },

    semanticLandmarks: [
      {
        landmark: "header, nav, main, section, article, aside, footer, form, or other",
        count: "integer",
        source: "string",
        evidenceText: "string"
      }
    ],

    navigationStructure: {
      navigationGroups: [
        {
          label: "string or Unknown",
          items: [
            {
              text: "string or Unknown",
              url: "string or Unknown"
            }
          ],
          source: "string"
        }
      ],
      breadcrumbEvidence: [
        {
          text: "string",
          source: "string",
          evidenceText: "string"
        }
      ],
      repeatedNavigationEvidence: [
        {
          finding: "string",
          source: "string",
          evidenceText: "string"
        }
      ]
    },

    conversionStructure: {
      callsToAction: [
        {
          text: "string",
          elementType:
            "button, link, form-trigger, phone-link, email-link, booking-link, or other",
          destination: "string or Unknown",
          source: "string",
          evidenceText: "string"
        }
      ],
      forms: [
        {
          formType:
            "contact, quote, estimate, booking, application, newsletter, payment, search, login, or Unknown",
          action: "string or Unknown",
          method: "string or Unknown",
          fields: [
            {
              name: "string or Unknown",
              type: "string or Unknown",
              label: "string or Unknown",
              required: "true, false, or Unknown"
            }
          ],
          source: "string",
          evidenceText: "string"
        }
      ],
      phoneLinks: ["string"],
      emailLinks: ["string"],
      bookingLinks: ["string"]
    },

    trustStructure: {
      testimonials: [
        {
          finding: "string",
          source: "string",
          evidenceText: "string"
        }
      ],
      reviewWidgets: [
        {
          provider: "string or Unknown",
          source: "string",
          evidenceText: "string"
        }
      ],
      certificationGroups: [
        {
          label: "string or Unknown",
          items: ["string"],
          source: "string",
          evidenceText: "string"
        }
      ],
      guaranteesAndWarranties: [
        {
          text: "string",
          source: "string",
          evidenceText: "string"
        }
      ],
      caseStudiesAndProjectEvidence: [
        {
          finding: "string",
          source: "string",
          evidenceText: "string"
        }
      ],
      clientOrPartnerLogos: [
        {
          name: "string or Unknown",
          source: "string",
          evidenceText: "string"
        }
      ]
    },

    contentStructure: {
      sections: [
        {
          heading: "string or Unknown",
          sectionType:
            "hero, services, trust, about, process, faq, reviews, locations, contact, gallery, pricing, footer, or Unknown",
          source: "string",
          evidenceText: "string"
        }
      ],
      lists: [
        {
          listType:
            "ordered, unordered, menu, service-list, feature-list, or Unknown",
          items: ["string"],
          source: "string"
        }
      ],
      tables: [
        {
          purpose: "string or Unknown",
          headers: ["string"],
          source: "string",
          evidenceText: "string"
        }
      ]
    },

    imageStructure: {
      images: [
        {
          src: "string or Unknown",
          alt: "string or Unknown",
          loading: "lazy, eager, or Unknown",
          linked: "true, false, or Unknown",
          source: "string"
        }
      ],
      imageAltObservations: [
        {
          finding: "string",
          source: "string",
          evidenceText: "string"
        }
      ]
    },

    localStructure: {
      napBlocks: [
        {
          name: "string or Unknown",
          address: "string or Unknown",
          phone: "string or Unknown",
          source: "string",
          evidenceText: "string"
        }
      ],
      serviceAreaEvidence: [
        {
          location: "string",
          source: "string",
          evidenceText: "string"
        }
      ],
      locationLinks: [
        {
          text: "string",
          url: "string",
          source: "string"
        }
      ],
      mapEvidence: [
        {
          provider: "string or Unknown",
          source: "string",
          evidenceText: "string"
        }
      ]
    },

    internalLinkStructure: {
      internalLinks: [
        {
          text: "string or Unknown",
          url: "string",
          source: "string"
        }
      ],
      serviceLinks: [
        {
          text: "string",
          url: "string",
          source: "string"
        }
      ],
      locationPageLinks: [
        {
          text: "string",
          url: "string",
          source: "string"
        }
      ]
    },

    verificationRequired: [
      {
        field: "string",
        finding: "string",
        reason:
          "ambiguous-hierarchy, conflicting-page-purpose, unclear-cta, repeated-structure, malformed-element, incomplete-evidence, or other",
        source: "string",
        evidenceText: "string"
      }
    ],

    evidenceSummary: {
      headingCount: "integer",
      landmarkCount: "integer",
      ctaCount: "integer",
      formCount: "integer",
      trustElementCount: "integer",
      internalLinkCount: "integer",
      verificationRequiredCount: "integer",
      sourcePageCount: "integer"
    }
  };

  return [
    "TASK",
    "Extract publicly observable page-structure evidence from the supplied HTML and parsed page elements.",
    "",
    "EVIDENCE RULES",
    ...HtmlIntelligenceEngine.evidenceRules.map(rule => `- ${rule}`),
    "",
    "INPUT",
    JSON.stringify(input, null, 2),
    "",
    "REQUIRED OUTPUT CONTRACT",
    JSON.stringify(outputContract, null, 2),
    "",
    "Return only the completed JSON object.",
    "Do not use Markdown or code fences.",
    "Do not include diagnoses, Growth Leak classifications, priorities, recommendations, impact estimates, outreach, or deliverable copy."
  ].join("\n");
}

/* =========================================================
   Response Handling
   ========================================================= */

function extractModelText(response) {
  if (typeof response === "string") {
    return response;
  }

  if (!response || typeof response !== "object") {
    throw new Error("HTML Intelligence returned no readable AI response.");
  }

  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  if (typeof response.response === "string") {
    return response.response;
  }

  const choiceContent = response.choices?.[0]?.message?.content;

  if (typeof choiceContent === "string") {
    return choiceContent;
  }

  if (Array.isArray(response.output)) {
    const textParts = [];

    for (const outputItem of response.output) {
      if (!Array.isArray(outputItem?.content)) {
        continue;
      }

      for (const contentItem of outputItem.content) {
        if (typeof contentItem?.text === "string") {
          textParts.push(contentItem.text);
        }
      }
    }

    if (textParts.length) {
      return textParts.join("\n");
    }
  }

  throw new Error("HTML Intelligence could not extract text from the AI response.");
}

function parseJsonResponse(rawText) {
  const cleaned = String(rawText || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("HTML Intelligence did not return a JSON object.");
    }

    const candidate = cleaned.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(candidate);
    } catch {
      throw new Error("HTML Intelligence returned invalid JSON.");
    }
  }
}

/* =========================================================
   Normalization
   ========================================================= */

function normalizeInput(input) {
  return {
    websiteUrl: cleanString(input?.websiteUrl) || "Unknown",
    finalUrl: cleanString(input?.finalUrl) || "Unknown",
    pageTitle: cleanString(input?.pageTitle),
    metaDescription: cleanString(input?.metaDescription),
    retrievedAt: cleanString(input?.retrievedAt) || "Unknown",
    headings: objectArray(input?.headings),
    landmarks: objectArray(input?.landmarks),
    navigation: objectArray(input?.navigation),
    links: objectArray(input?.links),
    buttons: objectArray(input?.buttons),
    forms: objectArray(input?.forms),
    images: objectArray(input?.images),
    lists: objectArray(input?.lists),
    tables: objectArray(input?.tables),
    structuredData: Array.isArray(input?.structuredData)
      ? input.structuredData
      : [],
    sourcePages: stringArray(input?.sourcePages),
    html: cleanString(input?.html).slice(0, 24000)
  };
}

function normalizeHtmlIntelligenceResult(result, input) {
  const source = isPlainObject(result) ? result : {};
  const request = normalizeInput(input);

  const normalized = {
    engine: {
      id: HtmlIntelligenceEngine.id,
      version: HtmlIntelligenceEngine.version
    },

    website: {
      requestedUrl:
        cleanString(source.website?.requestedUrl) ||
        request.websiteUrl,
      finalUrl:
        cleanString(source.website?.finalUrl) ||
        request.finalUrl,
      retrievedAt:
        cleanString(source.website?.retrievedAt) ||
        request.retrievedAt,
      sourcePages:
        stringArray(source.website?.sourcePages).length
          ? stringArray(source.website?.sourcePages)
          : request.sourcePages
    },

    pageIdentity: {
      title:
        cleanString(source.pageIdentity?.title) ||
        request.pageTitle ||
        "Unknown",
      metaDescription:
        cleanString(source.pageIdentity?.metaDescription) ||
        request.metaDescription ||
        "Unknown",
      pageType:
        cleanString(source.pageIdentity?.pageType) ||
        "Unknown",
      pagePurposeEvidence: objectArray(
        source.pageIdentity?.pagePurposeEvidence
      )
    },

    headingStructure: {
      headings: objectArray(source.headingStructure?.headings),
      h1Count: nonNegativeInteger(
        source.headingStructure?.h1Count
      ),
      emptyHeadings: objectArray(
        source.headingStructure?.emptyHeadings
      ),
      repeatedHeadings: objectArray(
        source.headingStructure?.repeatedHeadings
      ),
      hierarchyObservations: objectArray(
        source.headingStructure?.hierarchyObservations
      )
    },

    semanticLandmarks: objectArray(source.semanticLandmarks),

    navigationStructure: {
      navigationGroups: objectArray(
        source.navigationStructure?.navigationGroups
      ),
      breadcrumbEvidence: objectArray(
        source.navigationStructure?.breadcrumbEvidence
      ),
      repeatedNavigationEvidence: objectArray(
        source.navigationStructure?.repeatedNavigationEvidence
      )
    },

    conversionStructure: {
      callsToAction: objectArray(
        source.conversionStructure?.callsToAction
      ),
      forms: objectArray(
        source.conversionStructure?.forms
      ),
      phoneLinks: stringArray(
        source.conversionStructure?.phoneLinks
      ),
      emailLinks: stringArray(
        source.conversionStructure?.emailLinks
      ),
      bookingLinks: stringArray(
        source.conversionStructure?.bookingLinks
      )
    },

    trustStructure: {
      testimonials: objectArray(
        source.trustStructure?.testimonials
      ),
      reviewWidgets: objectArray(
        source.trustStructure?.reviewWidgets
      ),
      certificationGroups: objectArray(
        source.trustStructure?.certificationGroups
      ),
      guaranteesAndWarranties: objectArray(
        source.trustStructure?.guaranteesAndWarranties
      ),
      caseStudiesAndProjectEvidence: objectArray(
        source.trustStructure?.caseStudiesAndProjectEvidence
      ),
      clientOrPartnerLogos: objectArray(
        source.trustStructure?.clientOrPartnerLogos
      )
    },

    contentStructure: {
      sections: objectArray(
        source.contentStructure?.sections
      ),
      lists: objectArray(
        source.contentStructure?.lists
      ),
      tables: objectArray(
        source.contentStructure?.tables
      )
    },

    imageStructure: {
      images: objectArray(
        source.imageStructure?.images
      ),
      imageAltObservations: objectArray(
        source.imageStructure?.imageAltObservations
      )
    },

    localStructure: {
      napBlocks: objectArray(
        source.localStructure?.napBlocks
      ),
      serviceAreaEvidence: objectArray(
        source.localStructure?.serviceAreaEvidence
      ),
      locationLinks: objectArray(
        source.localStructure?.locationLinks
      ),
      mapEvidence: objectArray(
        source.localStructure?.mapEvidence
      )
    },

    internalLinkStructure: {
      internalLinks: objectArray(
        source.internalLinkStructure?.internalLinks
      ),
      serviceLinks: objectArray(
        source.internalLinkStructure?.serviceLinks
      ),
      locationPageLinks: objectArray(
        source.internalLinkStructure?.locationPageLinks
      )
    },

    verificationRequired: objectArray(
      source.verificationRequired
    ),

    evidenceSummary: {
      headingCount: 0,
      landmarkCount: 0,
      ctaCount: 0,
      formCount: 0,
      trustElementCount: 0,
      internalLinkCount: 0,
      verificationRequiredCount: 0,
      sourcePageCount: 0
    }
  };

  normalized.evidenceSummary.headingCount =
    normalized.headingStructure.headings.length;

  normalized.evidenceSummary.landmarkCount =
    normalized.semanticLandmarks.reduce(
      (total, item) =>
        total + nonNegativeInteger(item?.count),
      0
    );

  normalized.evidenceSummary.ctaCount =
    normalized.conversionStructure.callsToAction.length;

  normalized.evidenceSummary.formCount =
    normalized.conversionStructure.forms.length;

  normalized.evidenceSummary.trustElementCount =
    normalized.trustStructure.testimonials.length +
    normalized.trustStructure.reviewWidgets.length +
    normalized.trustStructure.certificationGroups.length +
    normalized.trustStructure.guaranteesAndWarranties.length +
    normalized.trustStructure.caseStudiesAndProjectEvidence.length +
    normalized.trustStructure.clientOrPartnerLogos.length;

  normalized.evidenceSummary.internalLinkCount =
    normalized.internalLinkStructure.internalLinks.length;

  normalized.evidenceSummary.verificationRequiredCount =
    normalized.verificationRequired.length;

  normalized.evidenceSummary.sourcePageCount =
    normalized.website.sourcePages.length;

  return normalized;
}

/* =========================================================
   Internal Validation and Utilities
   ========================================================= */

function validateExecutionInput(env, input) {
  if (!env?.AI || typeof env.AI.run !== "function") {
    throw new Error("The Cloudflare AI binding is unavailable.");
  }

  if (!isPlainObject(input)) {
    throw new Error("HTML Intelligence input must be an object.");
  }

  if (!cleanString(input.websiteUrl)) {
    throw new Error("websiteUrl is required.");
  }

  if (!cleanString(input.html)) {
    throw new Error("html is required.");
  }
}

function objectArray(value) {
  return Array.isArray(value)
    ? value.filter(isPlainObject)
    : [];
}

function stringArray(value) {
  return Array.isArray(value)
    ? [
        ...new Set(
          value
            .map(cleanString)
            .filter(Boolean)
        )
      ]
    : [];
}

function nonNegativeInteger(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.floor(number);
}

function cleanString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}

function isPlainObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}
