/* =========================================================
   Global Concepts Media Operating System (GCM OS)
   File: engines/websiteIntelligence.js
   Engine: Website Intelligence
   Version: 1.0.0
   Status: Production Foundation

   Responsibility:
   Convert supplied public website content into structured,
   source-traceable website evidence.

   This engine does not fetch websites and must never:
   - diagnose business performance,
   - classify Growth Leaks,
   - prioritize findings,
   - recommend actions,
   - score prospects,
   - write outreach,
   - or generate client deliverables.

   Core Principle:
   Evidence Before Assumptions.
   ========================================================= */

const WEBSITE_INTELLIGENCE_MODEL = "@cf/openai/gpt-oss-20b";

export const WebsiteIntelligenceEngine = Object.freeze({
  id: "website-intelligence",
  name: "Website Intelligence Engine",
  version: "1.0.0",
  responsibility: "Public website evidence extraction only",
  model: WEBSITE_INTELLIGENCE_MODEL,

  systemRole: [
    "You are the Website Intelligence Engine for the Global Concepts Media Operating System.",
    "Your only responsibility is to extract publicly observable evidence from the supplied website material.",
    "Never diagnose the business.",
    "Never classify a Growth Leak.",
    "Never prioritize findings.",
    "Never recommend actions.",
    "Never write outreach or client deliverables.",
    "Never turn missing information into a negative finding.",
    "Return only valid JSON matching the required output contract."
  ].join(" "),

  evidenceRules: Object.freeze([
    "Use only information contained in the supplied website material.",
    "Never use outside knowledge.",
    "Never invent or infer unsupported facts.",
    "Use Unknown when a scalar value cannot be established.",
    "Use an empty array when no evidence exists for a collection.",
    "Treat business promotional statements as public claims unless direct supporting evidence is supplied.",
    "Record conflicting, ambiguous, or incomplete material under verificationRequired.",
    "Do not create verificationRequired items merely because optional information is absent.",
    "Every material evidence item must include a source and evidenceText.",
    "Return no prose outside the JSON object."
  ]),

  requiredOutputFields: Object.freeze([
    "engine",
    "website",
    "businessIdentity",
    "industrySignals",
    "productsAndServices",
    "marketsAndServiceAreas",
    "contactPaths",
    "callsToAction",
    "trustEvidence",
    "certificationsAndCredentials",
    "ownershipAndDecisionMakerEvidence",
    "brandPositioning",
    "publicClaims",
    "publicLinks",
    "verificationRequired",
    "evidenceSummary"
  ])
});

/* =========================================================
   Public API
   ========================================================= */

/**
 * Execute Website Intelligence against already-collected website content.
 *
 * @param {object} env Cloudflare Worker environment containing the AI binding.
 * @param {object} input Website evidence input.
 * @returns {Promise<object>} Normalized website-intelligence-v1 result.
 */
export async function executeWebsiteIntelligence(env, input) {
  validateExecutionInput(env, input);

  const messages = buildWebsiteIntelligenceMessages(input);

  const response = await env.AI.run(
    WEBSITE_INTELLIGENCE_MODEL,
    { messages }
  );

  const rawText = extractModelText(response);
  const parsed = parseJsonResponse(rawText);
  const normalized = normalizeWebsiteIntelligenceResult(parsed, input);

  const validation = validateWebsiteIntelligenceResult(normalized);

  if (!validation.valid) {
    throw new Error(
      `Website Intelligence output failed validation: ${validation.errors.join("; ")}`
    );
  }

  return normalized;
}

/**
 * Build the messages sent to the AI model.
 *
 * @param {object} input Website evidence input.
 * @returns {Array<object>} Chat messages.
 */
export function buildWebsiteIntelligenceMessages(input) {
  const normalizedInput = normalizeInput(input);

  return [
    {
      role: "system",
      content: WebsiteIntelligenceEngine.systemRole
    },
    {
      role: "user",
      content: buildUserPrompt(normalizedInput)
    }
  ];
}

/**
 * Validate a normalized Website Intelligence result.
 *
 * @param {object} result Candidate result.
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateWebsiteIntelligenceResult(result) {
  const errors = [];

  if (!isPlainObject(result)) {
    return {
      valid: false,
      errors: ["Result must be a JSON object."]
    };
  }

  for (const field of WebsiteIntelligenceEngine.requiredOutputFields) {
    if (!(field in result)) {
      errors.push(`Missing top-level field: ${field}`);
    }
  }

  if (result.engine?.id !== WebsiteIntelligenceEngine.id) {
    errors.push("engine.id must equal website-intelligence.");
  }

  if (result.engine?.version !== WebsiteIntelligenceEngine.version) {
    errors.push("engine.version must equal 1.0.0.");
  }

  const arrayFields = [
    "industrySignals",
    "productsAndServices",
    "marketsAndServiceAreas",
    "callsToAction",
    "trustEvidence",
    "certificationsAndCredentials",
    "ownershipAndDecisionMakerEvidence",
    "publicClaims",
    "verificationRequired"
  ];

  for (const field of arrayFields) {
    if (!Array.isArray(result[field])) {
      errors.push(`${field} must be an array.`);
    }
  }

  if (!isPlainObject(result.contactPaths)) {
    errors.push("contactPaths must be an object.");
  }

  if (!isPlainObject(result.brandPositioning)) {
    errors.push("brandPositioning must be an object.");
  }

  if (!isPlainObject(result.publicLinks)) {
    errors.push("publicLinks must be an object.");
  }

  if (!isPlainObject(result.evidenceSummary)) {
    errors.push("evidenceSummary must be an object.");
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
      id: "website-intelligence",
      version: "1.0.0"
    },
    website: {
      url: "string",
      retrievedAt: "string or Unknown",
      sourcePages: ["string"]
    },
    businessIdentity: {
      businessName: "string or Unknown",
      alternateNames: ["string"],
      businessNameEvidence: [
        {
          value: "string",
          source: "string",
          evidenceText: "string"
        }
      ]
    },
    industrySignals: [
      {
        signal: "string",
        source: "string",
        evidenceText: "string"
      }
    ],
    productsAndServices: [
      {
        name: "string",
        description: "string or Unknown",
        source: "string",
        evidenceText: "string"
      }
    ],
    marketsAndServiceAreas: [
      {
        market: "string",
        marketType:
          "city, county, region, state, national, international, physical-location, or Unknown",
        source: "string",
        evidenceText: "string"
      }
    ],
    contactPaths: {
      phoneNumbers: [
        {
          value: "string",
          label: "string or Unknown",
          source: "string"
        }
      ],
      emailAddresses: [
        {
          value: "string",
          label: "string or Unknown",
          source: "string"
        }
      ],
      physicalAddresses: [
        {
          value: "string",
          label: "string or Unknown",
          source: "string"
        }
      ],
      contactPages: [
        {
          url: "string",
          label: "string or Unknown"
        }
      ],
      contactForms: [
        {
          type:
            "contact, quote, estimate, consultation, booking, application, newsletter, or Unknown",
          source: "string",
          evidenceText: "string"
        }
      ],
      bookingPaths: [
        {
          url: "string or Unknown",
          label: "string",
          source: "string"
        }
      ]
    },
    callsToAction: [
      {
        text: "string",
        actionType:
          "call, contact, quote, estimate, schedule, book, buy, apply, subscribe, download, learn-more, or Unknown",
        destination: "string or Unknown",
        source: "string"
      }
    ],
    trustEvidence: [
      {
        evidenceType:
          "testimonial, review-reference, case-study, project-example, client-logo, warranty, guarantee, association, license, insurance, certification, award, years-in-business, team-credential, media-mention, statistic, or other",
        description: "string",
        source: "string",
        evidenceText: "string",
        treatment: "observable-fact or public-claim"
      }
    ],
    certificationsAndCredentials: [
      {
        name: "string",
        credentialType:
          "license, certification, association, insurance, accreditation, award, or other",
        identifier: "string or Unknown",
        issuingOrganization: "string or Unknown",
        source: "string",
        evidenceText: "string",
        treatment: "observable-fact or public-claim"
      }
    ],
    ownershipAndDecisionMakerEvidence: [
      {
        name: "string",
        publishedRole: "string",
        relationshipToBusiness:
          "owner, founder, president, executive, manager, team-member, spokesperson, or Unknown",
        source: "string",
        evidenceText: "string"
      }
    ],
    brandPositioning: {
      taglines: [
        {
          text: "string",
          source: "string"
        }
      ],
      positioningStatements: [
        {
          text: "string",
          source: "string",
          evidenceText: "string"
        }
      ],
      audienceSignals: [
        {
          audience: "string",
          source: "string",
          evidenceText: "string"
        }
      ],
      valuePropositionSignals: [
        {
          signal: "string",
          source: "string",
          evidenceText: "string"
        }
      ]
    },
    publicClaims: [
      {
        claim: "string",
        claimType:
          "quality, ranking, experience, performance, customer-count, guarantee, license, insurance, certification, award, service-area, relationship, statistic, or other",
        source: "string",
        evidenceText: "string",
        verificationStatus: "unverified-public-claim"
      }
    ],
    publicLinks: {
      internal: [
        {
          url: "string",
          label: "string or Unknown"
        }
      ],
      social: [
        {
          platform: "string",
          url: "string",
          source: "string"
        }
      ],
      external: [
        {
          url: "string",
          label: "string or Unknown",
          relationship: "string or Unknown"
        }
      ]
    },
    verificationRequired: [
      {
        field: "string",
        finding: "string",
        reason:
          "conflicting-evidence, ambiguous-language, incomplete-evidence, unsupported-claim, unclear-identity, unclear-relationship, or other",
        source: "string",
        evidenceText: "string"
      }
    ],
    evidenceSummary: {
      observableFactsCount: "integer",
      publicClaimsCount: "integer",
      verificationRequiredCount: "integer",
      sourcePageCount: "integer"
    }
  };

  return [
    "TASK",
    "Extract publicly observable website evidence from the supplied material.",
    "",
    "EVIDENCE RULES",
    ...WebsiteIntelligenceEngine.evidenceRules.map(rule => `- ${rule}`),
    "",
    "INPUT",
    JSON.stringify(input, null, 2),
    "",
    "REQUIRED OUTPUT CONTRACT",
    JSON.stringify(outputContract, null, 2),
    "",
    "Return only the completed JSON object.",
    "Do not use Markdown or code fences.",
    "Do not include recommendations, diagnoses, priorities, scores, outreach, or deliverable copy."
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
    throw new Error("Website Intelligence returned no readable AI response.");
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

  throw new Error("Website Intelligence could not extract text from the AI response.");
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
      throw new Error("Website Intelligence did not return a JSON object.");
    }

    const candidate = cleaned.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(candidate);
    } catch {
      throw new Error("Website Intelligence returned invalid JSON.");
    }
  }
}

/* =========================================================
   Normalization
   ========================================================= */

function normalizeInput(input) {
  const sourcePages = Array.isArray(input?.sourcePages)
    ? uniqueStrings(input.sourcePages)
    : [];

  return {
    websiteUrl: cleanString(input?.websiteUrl) || "Unknown",
    retrievedAt: cleanString(input?.retrievedAt) || "Unknown",
    pageTitle: cleanString(input?.pageTitle),
    metaDescription: cleanString(input?.metaDescription),
    headings: Array.isArray(input?.headings)
      ? uniqueStrings(input.headings)
      : [],
    links: Array.isArray(input?.links)
      ? input.links
      : [],
    structuredData: input?.structuredData ?? null,
    sourcePages,
    websiteContent: cleanString(input?.websiteContent).slice(0, 16000)
  };
}

function normalizeWebsiteIntelligenceResult(result, input) {
  const normalizedInput = normalizeInput(input);
  const candidate = isPlainObject(result) ? result : {};

  const normalized = {
    engine: {
      id: WebsiteIntelligenceEngine.id,
      version: WebsiteIntelligenceEngine.version
    },

    website: {
      url:
        cleanString(candidate.website?.url) ||
        normalizedInput.websiteUrl,
      retrievedAt:
        cleanString(candidate.website?.retrievedAt) ||
        normalizedInput.retrievedAt,
      sourcePages: normalizeStringArray(
        candidate.website?.sourcePages?.length
          ? candidate.website.sourcePages
          : normalizedInput.sourcePages
      )
    },

    businessIdentity: {
      businessName:
        cleanString(candidate.businessIdentity?.businessName) ||
        "Unknown",
      alternateNames: normalizeStringArray(
        candidate.businessIdentity?.alternateNames
      ),
      businessNameEvidence: normalizeObjectArray(
        candidate.businessIdentity?.businessNameEvidence
      )
    },

    industrySignals: normalizeObjectArray(candidate.industrySignals),
    productsAndServices: normalizeObjectArray(candidate.productsAndServices),
    marketsAndServiceAreas: normalizeObjectArray(
      candidate.marketsAndServiceAreas
    ),

    contactPaths: {
      phoneNumbers: normalizeObjectArray(
        candidate.contactPaths?.phoneNumbers
      ),
      emailAddresses: normalizeObjectArray(
        candidate.contactPaths?.emailAddresses
      ),
      physicalAddresses: normalizeObjectArray(
        candidate.contactPaths?.physicalAddresses
      ),
      contactPages: normalizeObjectArray(
        candidate.contactPaths?.contactPages
      ),
      contactForms: normalizeObjectArray(
        candidate.contactPaths?.contactForms
      ),
      bookingPaths: normalizeObjectArray(
        candidate.contactPaths?.bookingPaths
      )
    },

    callsToAction: normalizeObjectArray(candidate.callsToAction),
    trustEvidence: normalizeObjectArray(candidate.trustEvidence),
    certificationsAndCredentials: normalizeObjectArray(
      candidate.certificationsAndCredentials
    ),
    ownershipAndDecisionMakerEvidence: normalizeObjectArray(
      candidate.ownershipAndDecisionMakerEvidence
    ),

    brandPositioning: {
      taglines: normalizeObjectArray(
        candidate.brandPositioning?.taglines
      ),
      positioningStatements: normalizeObjectArray(
        candidate.brandPositioning?.positioningStatements
      ),
      audienceSignals: normalizeObjectArray(
        candidate.brandPositioning?.audienceSignals
      ),
      valuePropositionSignals: normalizeObjectArray(
        candidate.brandPositioning?.valuePropositionSignals
      )
    },

    publicClaims: normalizeObjectArray(candidate.publicClaims),

    publicLinks: {
      internal: normalizeObjectArray(candidate.publicLinks?.internal),
      social: normalizeObjectArray(candidate.publicLinks?.social),
      external: normalizeObjectArray(candidate.publicLinks?.external)
    },

    verificationRequired: normalizeObjectArray(
      candidate.verificationRequired
    ),

    evidenceSummary: {
      observableFactsCount: nonNegativeInteger(
        candidate.evidenceSummary?.observableFactsCount
      ),
      publicClaimsCount: nonNegativeInteger(
        candidate.evidenceSummary?.publicClaimsCount
      ),
      verificationRequiredCount: nonNegativeInteger(
        candidate.evidenceSummary?.verificationRequiredCount
      ),
      sourcePageCount: nonNegativeInteger(
        candidate.evidenceSummary?.sourcePageCount ||
        normalizedInput.sourcePages.length
      )
    }
  };

  normalized.evidenceSummary.publicClaimsCount =
    normalized.publicClaims.length;

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
    throw new Error("Website Intelligence input must be an object.");
  }

  if (!cleanString(input.websiteUrl)) {
    throw new Error("websiteUrl is required.");
  }

  if (!cleanString(input.websiteContent)) {
    throw new Error("websiteContent is required.");
  }
}

function normalizeObjectArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPlainObject);
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? uniqueStrings(value)
    : [];
}

function uniqueStrings(value) {
  return [
    ...new Set(
      value
        .map(cleanString)
        .filter(Boolean)
    )
  ];
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
