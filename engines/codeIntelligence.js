/* =========================================================
   Global Concepts Media Operating System (GCM OS)
   File: engines/codeIntelligence.js
   Engine: Code Intelligence
   Version: 1.0.0
   Status: Production Foundation

   Responsibility:
   Convert supplied public website code and request metadata
   into structured technical evidence.

   Evidence Before Assumptions.
   ========================================================= */

const CODE_INTELLIGENCE_MODEL = "@cf/openai/gpt-oss-20b";

export const CodeIntelligenceEngine = Object.freeze({
  id: "code-intelligence",
  name: "Code Intelligence Engine",
  version: "1.0.0",
  responsibility: "Public website code evidence extraction only",
  model: CODE_INTELLIGENCE_MODEL,
  systemRole: [
    "You are the Code Intelligence Engine for the Global Concepts Media Operating System.",
    "Extract only publicly observable technical evidence from supplied website code and request metadata.",
    "Never diagnose the business or declare a website hacked, infected, compromised, unsafe, penalized, inaccessible, slow, or noncompliant unless the supplied evidence directly establishes it.",
    "Never classify a Growth Leak, prioritize findings, recommend actions, estimate business impact, write outreach, or generate a client deliverable.",
    "Return only valid JSON matching the required output contract."
  ].join(" "),
  evidenceRules: Object.freeze([
    "Use only supplied HTML, headers, scripts, stylesheets, links, forms, structured data, cookies, and response metadata.",
    "Never infer an exact platform from visual appearance alone.",
    "Mark a technology confirmed only when direct technical evidence supports it.",
    "Record suggestive but unproven platform signals under inferredTechnologies.",
    "Use Unknown when a scalar value cannot be established.",
    "Use an empty array when no evidence exists for a collection.",
    "Do not treat missing technical evidence as a Growth Leak.",
    "Record suspicious or conflicting technical evidence under verificationRequired without making a security diagnosis.",
    "Every material observation must include a source and evidenceText.",
    "Return no prose outside the JSON object."
  ]),
  requiredOutputFields: Object.freeze([
    "engine",
    "website",
    "platform",
    "metadata",
    "structuredData",
    "analyticsAndTracking",
    "formsAndConversionCode",
    "linksAndDomains",
    "securityAndTransportSignals",
    "accessibilityCodeSignals",
    "performanceImplementationSignals",
    "codeQualityObservations",
    "verificationRequired",
    "evidenceSummary"
  ])
});

export async function executeCodeIntelligence(env, input) {
  validateExecutionInput(env, input);

  const response = await env.AI.run(CODE_INTELLIGENCE_MODEL, {
    messages: buildCodeIntelligenceMessages(input)
  });

  const rawText = extractModelText(response);
  const parsed = parseJsonResponse(rawText);
  const normalized = normalizeCodeIntelligenceResult(parsed, input);
  const validation = validateCodeIntelligenceResult(normalized);

  if (!validation.valid) {
    throw new Error(
      `Code Intelligence output failed validation: ${validation.errors.join("; ")}`
    );
  }

  return normalized;
}

export function buildCodeIntelligenceMessages(input) {
  const normalizedInput = normalizeInput(input);

  return [
    {
      role: "system",
      content: CodeIntelligenceEngine.systemRole
    },
    {
      role: "user",
      content: buildUserPrompt(normalizedInput)
    }
  ];
}

export function validateCodeIntelligenceResult(result) {
  const errors = [];

  if (!isPlainObject(result)) {
    return { valid: false, errors: ["Result must be a JSON object."] };
  }

  for (const field of CodeIntelligenceEngine.requiredOutputFields) {
    if (!(field in result)) {
      errors.push(`Missing top-level field: ${field}`);
    }
  }

  if (result.engine?.id !== CodeIntelligenceEngine.id) {
    errors.push("engine.id must equal code-intelligence.");
  }

  if (result.engine?.version !== CodeIntelligenceEngine.version) {
    errors.push("engine.version must equal 1.0.0.");
  }

  for (const field of [
    "structuredData",
    "analyticsAndTracking",
    "formsAndConversionCode",
    "performanceImplementationSignals",
    "codeQualityObservations",
    "verificationRequired"
  ]) {
    if (!Array.isArray(result[field])) {
      errors.push(`${field} must be an array.`);
    }
  }

  for (const field of [
    "website",
    "platform",
    "metadata",
    "linksAndDomains",
    "securityAndTransportSignals",
    "accessibilityCodeSignals",
    "evidenceSummary"
  ]) {
    if (!isPlainObject(result[field])) {
      errors.push(`${field} must be an object.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function buildUserPrompt(input) {
  const outputContract = {
    engine: { id: "code-intelligence", version: "1.0.0" },
    website: {
      requestedUrl: "string",
      finalUrl: "string or Unknown",
      statusCode: "integer or Unknown",
      retrievedAt: "string or Unknown",
      sourcePages: ["string"]
    },
    platform: {
      confirmedCms: [evidenceTechnologyShape("cms")],
      confirmedHostingAndInfrastructure: [evidenceTechnologyShape("hosting")],
      confirmedFrameworks: [evidenceTechnologyShape("framework")],
      confirmedThemesAndBuilders: [evidenceTechnologyShape("theme or builder")],
      confirmedPluginsAndServices: [evidenceTechnologyShape("plugin or service")],
      inferredTechnologies: [
        {
          name: "string",
          technologyType: "cms, hosting, framework, theme, page-builder, plugin, service, or other",
          confidence: "Low, Medium, or High",
          source: "string",
          evidenceText: "string",
          reason: "string"
        }
      ]
    },
    metadata: {
      title: "string or Unknown",
      metaDescription: "string or Unknown",
      canonicalUrl: "string or Unknown",
      robotsDirectives: ["string"],
      generatorTags: [{ value: "string", source: "string" }],
      openGraph: [{ property: "string", value: "string" }],
      twitterMetadata: [{ name: "string", value: "string" }],
      language: "string or Unknown",
      viewport: "string or Unknown",
      favicons: ["string"]
    },
    structuredData: [technicalEvidenceShape("schemaType")],
    analyticsAndTracking: [
      {
        provider: "string",
        identifier: "string or Unknown",
        trackingType: "analytics, advertising, tag-manager, conversion, session-recording, call-tracking, or other",
        source: "string",
        evidenceText: "string"
      }
    ],
    formsAndConversionCode: [
      {
        formType: "contact, quote, estimate, booking, application, newsletter, payment, login, search, or Unknown",
        action: "string or Unknown",
        method: "string or Unknown",
        provider: "string or Unknown",
        fields: ["string"],
        source: "string",
        evidenceText: "string"
      }
    ],
    linksAndDomains: {
      internalDomains: ["string"],
      externalDomains: ["string"],
      stagingOrDevelopmentReferences: [urlEvidenceShape()],
      mismatchedDomainReferences: [urlEvidenceShape()],
      suspiciousOrUnrelatedLinks: [
        {
          url: "string",
          anchorText: "string or Unknown",
          source: "string",
          evidenceText: "string"
        }
      ]
    },
    securityAndTransportSignals: {
      httpsObserved: "true, false, or Unknown",
      securityHeaders: [{ name: "string", value: "string" }],
      cookieAttributes: [
        {
          name: "string",
          secure: "true, false, or Unknown",
          httpOnly: "true, false, or Unknown",
          sameSite: "string or Unknown"
        }
      ],
      mixedContentReferences: [urlEvidenceShape()]
    },
    accessibilityCodeSignals: {
      htmlLanguageDeclared: "true, false, or Unknown",
      viewportDeclared: "true, false, or Unknown",
      imageAltObservations: [findingEvidenceShape()],
      formLabelObservations: [findingEvidenceShape()],
      ariaObservations: [findingEvidenceShape()]
    },
    performanceImplementationSignals: [
      {
        signalType: "third-party-script, render-blocking-asset, inline-payload, image-format, lazy-loading, caching, preload, preconnect, or other",
        finding: "string",
        source: "string",
        evidenceText: "string"
      }
    ],
    codeQualityObservations: [
      {
        observationType: "duplicate-metadata, malformed-url, broken-looking-path, exposed-staging-reference, inline-error, repeated-script, missing-attribute, suspicious-injection, or other",
        finding: "string",
        source: "string",
        evidenceText: "string"
      }
    ],
    verificationRequired: [
      {
        field: "string",
        finding: "string",
        reason: "conflicting-evidence, ambiguous-technology, suspicious-code, unclear-domain, incomplete-evidence, unsupported-risk, or other",
        source: "string",
        evidenceText: "string"
      }
    ],
    evidenceSummary: {
      confirmedTechnologyCount: "integer",
      inferredTechnologyCount: "integer",
      technicalObservationCount: "integer",
      verificationRequiredCount: "integer",
      sourcePageCount: "integer"
    }
  };

  return [
    "TASK",
    "Extract publicly observable technical evidence from the supplied website code and request metadata.",
    "",
    "EVIDENCE RULES",
    ...CodeIntelligenceEngine.evidenceRules.map(rule => `- ${rule}`),
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

function evidenceTechnologyShape(type) {
  return {
    name: "string",
    technologyType: type,
    version: "string or Unknown",
    source: "string",
    evidenceText: "string"
  };
}

function technicalEvidenceShape(nameField) {
  return {
    [nameField]: "string",
    source: "string",
    evidenceText: "string"
  };
}

function urlEvidenceShape() {
  return {
    url: "string",
    source: "string",
    evidenceText: "string"
  };
}

function findingEvidenceShape() {
  return {
    finding: "string",
    source: "string",
    evidenceText: "string"
  };
}

function extractModelText(response) {
  if (typeof response === "string") return response;
  if (!response || typeof response !== "object") {
    throw new Error("Code Intelligence returned no readable AI response.");
  }
  if (typeof response.output_text === "string") return response.output_text;
  if (typeof response.response === "string") return response.response;
  if (typeof response.choices?.[0]?.message?.content === "string") {
    return response.choices[0].message.content;
  }

  if (Array.isArray(response.output)) {
    const textParts = [];
    for (const item of response.output) {
      for (const contentItem of item?.content || []) {
        if (typeof contentItem?.text === "string") textParts.push(contentItem.text);
      }
    }
    if (textParts.length) return textParts.join("\n");
  }

  throw new Error("Code Intelligence could not extract text from the AI response.");
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
      throw new Error("Code Intelligence did not return a JSON object.");
    }
    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch {
      throw new Error("Code Intelligence returned invalid JSON.");
    }
  }
}

function normalizeInput(input) {
  return {
    websiteUrl: cleanString(input?.websiteUrl) || "Unknown",
    finalUrl: cleanString(input?.finalUrl) || "Unknown",
    statusCode: normalizeStatusCode(input?.statusCode),
    retrievedAt: cleanString(input?.retrievedAt) || "Unknown",
    pageTitle: cleanString(input?.pageTitle),
    responseHeaders: isPlainObject(input?.responseHeaders) ? input.responseHeaders : {},
    metaTags: objectArray(input?.metaTags),
    scripts: stringArray(input?.scripts),
    stylesheets: stringArray(input?.stylesheets),
    links: objectArray(input?.links),
    forms: objectArray(input?.forms),
    structuredData: Array.isArray(input?.structuredData) ? input.structuredData : [],
    cookies: objectArray(input?.cookies),
    sourcePages: stringArray(input?.sourcePages),
    html: cleanString(input?.html).slice(0, 24000)
  };
}

function normalizeCodeIntelligenceResult(result, input) {
  const source = isPlainObject(result) ? result : {};
  const request = normalizeInput(input);

  const normalized = {
    engine: { id: CodeIntelligenceEngine.id, version: CodeIntelligenceEngine.version },
    website: {
      requestedUrl: cleanString(source.website?.requestedUrl) || request.websiteUrl,
      finalUrl: cleanString(source.website?.finalUrl) || request.finalUrl,
      statusCode: normalizeStatusCode(source.website?.statusCode),
      retrievedAt: cleanString(source.website?.retrievedAt) || request.retrievedAt,
      sourcePages: stringArray(source.website?.sourcePages).length
        ? stringArray(source.website?.sourcePages)
        : request.sourcePages
    },
    platform: {
      confirmedCms: objectArray(source.platform?.confirmedCms),
      confirmedHostingAndInfrastructure: objectArray(source.platform?.confirmedHostingAndInfrastructure),
      confirmedFrameworks: objectArray(source.platform?.confirmedFrameworks),
      confirmedThemesAndBuilders: objectArray(source.platform?.confirmedThemesAndBuilders),
      confirmedPluginsAndServices: objectArray(source.platform?.confirmedPluginsAndServices),
      inferredTechnologies: objectArray(source.platform?.inferredTechnologies)
    },
    metadata: {
      title: cleanString(source.metadata?.title) || "Unknown",
      metaDescription: cleanString(source.metadata?.metaDescription) || "Unknown",
      canonicalUrl: cleanString(source.metadata?.canonicalUrl) || "Unknown",
      robotsDirectives: stringArray(source.metadata?.robotsDirectives),
      generatorTags: objectArray(source.metadata?.generatorTags),
      openGraph: objectArray(source.metadata?.openGraph),
      twitterMetadata: objectArray(source.metadata?.twitterMetadata),
      language: cleanString(source.metadata?.language) || "Unknown",
      viewport: cleanString(source.metadata?.viewport) || "Unknown",
      favicons: stringArray(source.metadata?.favicons)
    },
    structuredData: objectArray(source.structuredData),
    analyticsAndTracking: objectArray(source.analyticsAndTracking),
    formsAndConversionCode: objectArray(source.formsAndConversionCode),
    linksAndDomains: {
      internalDomains: stringArray(source.linksAndDomains?.internalDomains),
      externalDomains: stringArray(source.linksAndDomains?.externalDomains),
      stagingOrDevelopmentReferences: objectArray(source.linksAndDomains?.stagingOrDevelopmentReferences),
      mismatchedDomainReferences: objectArray(source.linksAndDomains?.mismatchedDomainReferences),
      suspiciousOrUnrelatedLinks: objectArray(source.linksAndDomains?.suspiciousOrUnrelatedLinks)
    },
    securityAndTransportSignals: {
      httpsObserved: booleanOrUnknown(source.securityAndTransportSignals?.httpsObserved),
      securityHeaders: objectArray(source.securityAndTransportSignals?.securityHeaders),
      cookieAttributes: objectArray(source.securityAndTransportSignals?.cookieAttributes),
      mixedContentReferences: objectArray(source.securityAndTransportSignals?.mixedContentReferences)
    },
    accessibilityCodeSignals: {
      htmlLanguageDeclared: booleanOrUnknown(source.accessibilityCodeSignals?.htmlLanguageDeclared),
      viewportDeclared: booleanOrUnknown(source.accessibilityCodeSignals?.viewportDeclared),
      imageAltObservations: objectArray(source.accessibilityCodeSignals?.imageAltObservations),
      formLabelObservations: objectArray(source.accessibilityCodeSignals?.formLabelObservations),
      ariaObservations: objectArray(source.accessibilityCodeSignals?.ariaObservations)
    },
    performanceImplementationSignals: objectArray(source.performanceImplementationSignals),
    codeQualityObservations: objectArray(source.codeQualityObservations),
    verificationRequired: objectArray(source.verificationRequired),
    evidenceSummary: {
      confirmedTechnologyCount: 0,
      inferredTechnologyCount: 0,
      technicalObservationCount: 0,
      verificationRequiredCount: 0,
      sourcePageCount: 0
    }
  };

  normalized.evidenceSummary.confirmedTechnologyCount =
    normalized.platform.confirmedCms.length +
    normalized.platform.confirmedHostingAndInfrastructure.length +
    normalized.platform.confirmedFrameworks.length +
    normalized.platform.confirmedThemesAndBuilders.length +
    normalized.platform.confirmedPluginsAndServices.length;

  normalized.evidenceSummary.inferredTechnologyCount =
    normalized.platform.inferredTechnologies.length;

  normalized.evidenceSummary.technicalObservationCount =
    normalized.structuredData.length +
    normalized.analyticsAndTracking.length +
    normalized.formsAndConversionCode.length +
    normalized.performanceImplementationSignals.length +
    normalized.codeQualityObservations.length;

  normalized.evidenceSummary.verificationRequiredCount =
    normalized.verificationRequired.length;

  normalized.evidenceSummary.sourcePageCount =
    normalized.website.sourcePages.length;

  return normalized;
}

function validateExecutionInput(env, input) {
  if (!env?.AI || typeof env.AI.run !== "function") {
    throw new Error("The Cloudflare AI binding is unavailable.");
  }
  if (!isPlainObject(input)) {
    throw new Error("Code Intelligence input must be an object.");
  }
  if (!cleanString(input.websiteUrl)) {
    throw new Error("websiteUrl is required.");
  }
  if (!cleanString(input.html)) {
    throw new Error("html is required.");
  }
}

function objectArray(value) {
  return Array.isArray(value) ? value.filter(isPlainObject) : [];
}

function stringArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(cleanString).filter(Boolean))]
    : [];
}

function normalizeStatusCode(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 100 && number <= 599
    ? number
    : "Unknown";
}

function booleanOrUnknown(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return "Unknown";
}

function cleanString(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
