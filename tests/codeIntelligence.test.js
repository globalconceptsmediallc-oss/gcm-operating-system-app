/* =========================================================
   Global Concepts Media Operating System (GCM OS)
   File: tests/codeIntelligence.test.js
   Engine Under Test: engines/codeIntelligence.js
   Test Version: 1.0.0

   Purpose:
   Validate the Code Intelligence Engine independently
   before connecting it to the production Worker.
   ========================================================= */

import {
  CodeIntelligenceEngine,
  buildCodeIntelligenceMessages,
  validateCodeIntelligenceResult,
  executeCodeIntelligence
} from "../engines/codeIntelligence.js";

/* =========================================================
   Minimal Test Runner
   ========================================================= */

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`
    );
  }
}

function assertArray(value, message) {
  if (!Array.isArray(value)) {
    throw new Error(message);
  }
}

/* =========================================================
   Shared Test Input
   ========================================================= */

const sampleInput = {
  websiteUrl: "https://example-roofing.com/",
  finalUrl: "https://example-roofing.com/",
  statusCode: 200,
  retrievedAt: "2026-07-14T12:00:00.000Z",
  pageTitle: "Example Roofing",
  responseHeaders: {
    "content-type": "text/html; charset=UTF-8",
    "server": "cloudflare"
  },
  metaTags: [
    {
      name: "generator",
      content: "WordPress 6.5"
    }
  ],
  scripts: [
    "https://example-roofing.com/wp-content/plugins/elementor/assets/js/frontend.min.js",
    "https://www.googletagmanager.com/gtag/js?id=G-ABC123"
  ],
  stylesheets: [
    "https://example-roofing.com/wp-content/themes/hello-elementor/style.css"
  ],
  links: [
    {
      url: "https://example-roofing.com/contact/",
      label: "Contact"
    },
    {
      url: "https://staging.example-roofing.com/test-page/",
      label: "Old Page"
    },
    {
      url: "https://unrelated-casino.example/",
      label: "Casino"
    }
  ],
  forms: [
    {
      action: "/contact/",
      method: "post",
      fields: ["name", "email", "phone"]
    }
  ],
  structuredData: [
    {
      "@type": "RoofingContractor"
    }
  ],
  cookies: [],
  sourcePages: [
    "https://example-roofing.com/"
  ],
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="generator" content="WordPress 6.5">
        <link rel="canonical" href="https://example-roofing.com/">
        <link rel="stylesheet" href="/wp-content/themes/hello-elementor/style.css">
        <script src="/wp-content/plugins/elementor/assets/js/frontend.min.js"></script>
        <script src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"></script>
      </head>
      <body>
        <form action="/contact/" method="post">
          <label for="name">Name</label>
          <input id="name" name="name">
        </form>
        <a href="https://staging.example-roofing.com/test-page/">Old Page</a>
        <a href="https://unrelated-casino.example/">Casino</a>
      </body>
    </html>
  `
};

/* =========================================================
   Tests
   ========================================================= */

test("Engine metadata is correct", () => {
  assertEqual(
    CodeIntelligenceEngine.id,
    "code-intelligence",
    "Engine id is incorrect."
  );

  assertEqual(
    CodeIntelligenceEngine.version,
    "1.0.0",
    "Engine version is incorrect."
  );

  assert(
    CodeIntelligenceEngine.responsibility.includes("code evidence"),
    "Engine responsibility should be code-evidence only."
  );
});

test("Prompt builder returns system and user messages", () => {
  const messages = buildCodeIntelligenceMessages(sampleInput);

  assertArray(messages, "Messages must be an array.");
  assertEqual(messages.length, 2, "Exactly two messages are required.");
  assertEqual(messages[0].role, "system", "First message must be system.");
  assertEqual(messages[1].role, "user", "Second message must be user.");

  assert(
    messages[0].content.includes("Never declare that a website is hacked"),
    "System prompt must prohibit unsupported security diagnoses."
  );

  assert(
    messages[1].content.includes(sampleInput.websiteUrl),
    "User prompt must include the website URL."
  );

  assert(
    messages[1].content.includes("REQUIRED OUTPUT CONTRACT"),
    "User prompt must include the output contract."
  );

  assert(
    messages[1].content.includes("Do not include diagnoses"),
    "User prompt must prohibit diagnoses and recommendations."
  );
});

test("Valid result passes validation", () => {
  const result = createValidResult();

  const validation = validateCodeIntelligenceResult(result);

  assert(validation.valid, validation.errors.join("; "));
  assertEqual(
    validation.errors.length,
    0,
    "Valid result should have no validation errors."
  );
});

test("Missing fields fail validation", () => {
  const result = {
    engine: {
      id: "code-intelligence",
      version: "1.0.0"
    }
  };

  const validation = validateCodeIntelligenceResult(result);

  assert(!validation.valid, "Incomplete result must fail validation.");

  assert(
    validation.errors.some(error =>
      error.includes("Missing top-level field")
    ),
    "Validation should report missing top-level fields."
  );
});

test("Wrong engine metadata fails validation", () => {
  const result = createValidResult();

  result.engine.id = "wrong-engine";
  result.engine.version = "9.9.9";

  const validation = validateCodeIntelligenceResult(result);

  assert(!validation.valid, "Wrong engine metadata must fail validation.");

  assert(
    validation.errors.some(error => error.includes("engine.id")),
    "Validation should report the incorrect engine id."
  );

  assert(
    validation.errors.some(error => error.includes("engine.version")),
    "Validation should report the incorrect engine version."
  );
});

test("AI execution normalizes platform evidence", async () => {
  const mockResult = createValidResult();

  mockResult.platform.confirmedCms = [
    {
      name: "WordPress",
      version: "6.5",
      source: sampleInput.websiteUrl,
      evidenceText: 'meta name="generator" content="WordPress 6.5"'
    }
  ];

  mockResult.platform.confirmedThemesAndBuilders = [
    {
      name: "Elementor",
      technologyType: "page-builder",
      version: "Unknown",
      source: sampleInput.websiteUrl,
      evidenceText: "/wp-content/plugins/elementor/"
    }
  ];

  const env = createMockEnv(mockResult);

  const result = await executeCodeIntelligence(env, sampleInput);

  assertEqual(
    result.platform.confirmedCms[0].name,
    "WordPress",
    "Confirmed CMS was not preserved."
  );

  assertEqual(
    result.platform.confirmedThemesAndBuilders[0].name,
    "Elementor",
    "Confirmed builder was not preserved."
  );

  assertEqual(
    result.evidenceSummary.confirmedTechnologyCount,
    2,
    "Confirmed technology count was not normalized."
  );
});

test("AI execution normalizes staging-domain evidence", async () => {
  const mockResult = createValidResult();

  mockResult.linksAndDomains.stagingOrDevelopmentReferences = [
    {
      url: "https://staging.example-roofing.com/test-page/",
      source: sampleInput.websiteUrl,
      evidenceText:
        '<a href="https://staging.example-roofing.com/test-page/">Old Page</a>'
    }
  ];

  const env = createMockEnv(mockResult);

  const result = await executeCodeIntelligence(env, sampleInput);

  assertEqual(
    result.linksAndDomains.stagingOrDevelopmentReferences.length,
    1,
    "Staging-domain evidence was not preserved."
  );
});

test("AI execution normalizes suspicious-link evidence", async () => {
  const mockResult = createValidResult();

  mockResult.linksAndDomains.suspiciousOrUnrelatedLinks = [
    {
      url: "https://unrelated-casino.example/",
      anchorText: "Casino",
      source: sampleInput.websiteUrl,
      evidenceText:
        '<a href="https://unrelated-casino.example/">Casino</a>'
    }
  ];

  const env = createMockEnv(mockResult);

  const result = await executeCodeIntelligence(env, sampleInput);

  assertEqual(
    result.linksAndDomains.suspiciousOrUnrelatedLinks.length,
    1,
    "Suspicious-link evidence was not preserved."
  );

  assertEqual(
    result.linksAndDomains.suspiciousOrUnrelatedLinks[0].anchorText,
    "Casino",
    "Suspicious-link anchor text was not preserved."
  );
});

test("AI execution accepts JSON inside code fences", async () => {
  const mockResult = createValidResult();

  const env = {
    AI: {
      async run() {
        return {
          output_text:
            "```json\n" +
            JSON.stringify(mockResult, null, 2) +
            "\n```"
        };
      }
    }
  };

  const result = await executeCodeIntelligence(env, sampleInput);

  assertEqual(
    result.engine.id,
    "code-intelligence",
    "Code-fenced JSON was not parsed correctly."
  );
});

test("AI execution accepts choices message content", async () => {
  const mockResult = createValidResult();

  const env = {
    AI: {
      async run() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify(mockResult)
              }
            }
          ]
        };
      }
    }
  };

  const result = await executeCodeIntelligence(env, sampleInput);

  assertEqual(
    result.engine.version,
    "1.0.0",
    "choices message content was not parsed correctly."
  );
});

test("Execution fails when the AI binding is missing", async () => {
  let errorMessage = "";

  try {
    await executeCodeIntelligence({}, sampleInput);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : String(error);
  }

  assert(
    errorMessage.includes("AI binding"),
    "Missing AI binding should produce a clear error."
  );
});

test("Execution fails when websiteUrl is missing", async () => {
  const env = createMockEnv(createValidResult());
  let errorMessage = "";

  try {
    await executeCodeIntelligence(env, {
      ...sampleInput,
      websiteUrl: ""
    });
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : String(error);
  }

  assert(
    errorMessage.includes("websiteUrl"),
    "Missing websiteUrl should produce a clear error."
  );
});

test("Execution fails when HTML is missing", async () => {
  const env = createMockEnv(createValidResult());
  let errorMessage = "";

  try {
    await executeCodeIntelligence(env, {
      ...sampleInput,
      html: ""
    });
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : String(error);
  }

  assert(
    errorMessage.includes("html"),
    "Missing HTML should produce a clear error."
  );
});

/* =========================================================
   Test Fixtures
   ========================================================= */

function createValidResult() {
  return {
    engine: {
      id: "code-intelligence",
      version: "1.0.0"
    },

    website: {
      requestedUrl: sampleInput.websiteUrl,
      finalUrl: sampleInput.finalUrl,
      statusCode: sampleInput.statusCode,
      retrievedAt: sampleInput.retrievedAt,
      sourcePages: sampleInput.sourcePages
    },

    platform: {
      confirmedCms: [],
      confirmedHostingAndInfrastructure: [],
      confirmedFrameworks: [],
      confirmedThemesAndBuilders: [],
      confirmedPluginsAndServices: [],
      inferredTechnologies: []
    },

    metadata: {
      title: "Example Roofing",
      metaDescription: "Unknown",
      canonicalUrl: "https://example-roofing.com/",
      robotsDirectives: [],
      generatorTags: [],
      openGraph: [],
      twitterMetadata: [],
      language: "en",
      viewport: "width=device-width, initial-scale=1",
      favicons: []
    },

    structuredData: [],

    analyticsAndTracking: [],

    formsAndConversionCode: [],

    linksAndDomains: {
      internalDomains: ["example-roofing.com"],
      externalDomains: [],
      stagingOrDevelopmentReferences: [],
      mismatchedDomainReferences: [],
      suspiciousOrUnrelatedLinks: []
    },

    securityAndTransportSignals: {
      httpsObserved: true,
      securityHeaders: [],
      cookieAttributes: [],
      mixedContentReferences: []
    },

    accessibilityCodeSignals: {
      htmlLanguageDeclared: true,
      viewportDeclared: true,
      imageAltObservations: [],
      formLabelObservations: [],
      ariaObservations: []
    },

    performanceImplementationSignals: [],

    codeQualityObservations: [],

    verificationRequired: [],

    evidenceSummary: {
      confirmedTechnologyCount: 0,
      inferredTechnologyCount: 0,
      technicalObservationCount: 0,
      verificationRequiredCount: 0,
      sourcePageCount: 1
    }
  };
}

function createMockEnv(result) {
  return {
    AI: {
      async run() {
        return {
          output_text: JSON.stringify(result)
        };
      }
    }
  };
}

/* =========================================================
   Run Tests
   ========================================================= */

async function run() {
  let passed = 0;
  let failed = 0;

  console.log("");
  console.log("GCM OS Code Intelligence Engine Tests");
  console.log("=====================================");

  for (const item of tests) {
    try {
      await item.fn();
      passed += 1;
      console.log(`PASS: ${item.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL: ${item.name}`);
      console.error(
        error instanceof Error
          ? error.message
          : String(error)
      );
    }
  }

  console.log("-------------------------------------");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log("");

  if (failed > 0) {
    throw new Error(
      `${failed} Code Intelligence test${failed === 1 ? "" : "s"} failed.`
    );
  }
}

run().catch(error => {
  console.error(
    error instanceof Error
      ? error.message
      : String(error)
  );

  if (
    typeof process !== "undefined" &&
    process?.exit
  ) {
    process.exit(1);
  }
});
