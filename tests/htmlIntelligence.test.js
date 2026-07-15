/* =========================================================
   Global Concepts Media Operating System (GCM OS)
   File: tests/htmlIntelligence.test.js
   Engine Under Test: engines/htmlIntelligence.js
   Test Version: 1.0.0

   Purpose:
   Validate the HTML Intelligence Engine independently
   before connecting it to the production Worker.
   ========================================================= */

import {
  HtmlIntelligenceEngine,
  buildHtmlIntelligenceMessages,
  validateHtmlIntelligenceResult,
  executeHtmlIntelligence
} from "../engines/htmlIntelligence.js";

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
  retrievedAt: "2026-07-14T20:30:00.000Z",
  pageTitle: "Example Roofing | Roof Repair",
  metaDescription:
    "Example Roofing provides residential roof repair and replacement services.",
  headings: [
    {
      level: "H1",
      text: "Roof Repair in Brevard County"
    },
    {
      level: "H2",
      text: "Our Roofing Services"
    },
    {
      level: "H2",
      text: "Why Homeowners Trust Us"
    }
  ],
  landmarks: [
    { landmark: "header" },
    { landmark: "nav" },
    { landmark: "main" },
    { landmark: "footer" }
  ],
  navigation: [
    {
      label: "Primary Navigation",
      items: [
        {
          text: "Home",
          url: "https://example-roofing.com/"
        },
        {
          text: "Roof Repair",
          url: "https://example-roofing.com/roof-repair/"
        }
      ]
    }
  ],
  links: [
    {
      text: "Roof Repair",
      url: "https://example-roofing.com/roof-repair/"
    },
    {
      text: "Melbourne Roofing",
      url: "https://example-roofing.com/melbourne/"
    },
    {
      text: "Call Now",
      url: "tel:3215550100"
    },
    {
      text: "Email Us",
      url: "mailto:info@example-roofing.com"
    }
  ],
  buttons: [
    {
      text: "Request a Free Estimate",
      destination: "#estimate-form"
    }
  ],
  forms: [
    {
      type: "estimate",
      action: "/request-estimate/",
      method: "post",
      fields: [
        {
          name: "name",
          type: "text",
          label: "Name",
          required: true
        },
        {
          name: "phone",
          type: "tel",
          label: "Phone",
          required: true
        }
      ]
    }
  ],
  images: [
    {
      src: "/images/roof-repair.webp",
      alt: "Roof repair project",
      loading: "lazy",
      linked: false
    }
  ],
  lists: [
    {
      listType: "service-list",
      items: [
        "Roof Repair",
        "Roof Replacement",
        "Storm Damage"
      ]
    }
  ],
  tables: [],
  structuredData: [
    {
      "@type": "RoofingContractor"
    }
  ],
  sourcePages: [
    "https://example-roofing.com/"
  ],
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Example Roofing | Roof Repair</title>
        <meta
          name="description"
          content="Example Roofing provides residential roof repair and replacement services."
        >
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        >
      </head>
      <body>
        <header>
          <nav aria-label="Primary Navigation">
            <a href="/">Home</a>
            <a href="/roof-repair/">Roof Repair</a>
          </nav>
        </header>

        <main>
          <section class="hero">
            <h1>Roof Repair in Brevard County</h1>
            <a href="#estimate-form">Request a Free Estimate</a>
          </section>

          <section>
            <h2>Our Roofing Services</h2>
            <ul>
              <li><a href="/roof-repair/">Roof Repair</a></li>
              <li><a href="/roof-replacement/">Roof Replacement</a></li>
              <li><a href="/storm-damage/">Storm Damage</a></li>
            </ul>
          </section>

          <section>
            <h2>Why Homeowners Trust Us</h2>
            <div class="certifications">
              <img src="/badges/certified.png" alt="Certified Roofing Contractor">
              <img src="/badges/bbb.png" alt="BBB Accredited Business">
            </div>
          </section>

          <section>
            <h2>Service Areas</h2>
            <a href="/melbourne/">Melbourne Roofing</a>
          </section>

          <form id="estimate-form" action="/request-estimate/" method="post">
            <label for="name">Name</label>
            <input id="name" name="name" type="text" required>

            <label for="phone">Phone</label>
            <input id="phone" name="phone" type="tel" required>
          </form>

          <a href="tel:3215550100">Call Now</a>
          <a href="mailto:info@example-roofing.com">Email Us</a>
        </main>

        <footer>
          <p>Example Roofing</p>
          <p>123 Main Street, Melbourne, FL</p>
          <p>321-555-0100</p>
        </footer>
      </body>
    </html>
  `
};

/* =========================================================
   Tests
   ========================================================= */

test("Engine metadata is correct", () => {
  assertEqual(
    HtmlIntelligenceEngine.id,
    "html-intelligence",
    "Engine id is incorrect."
  );

  assertEqual(
    HtmlIntelligenceEngine.version,
    "1.0.0",
    "Engine version is incorrect."
  );

  assert(
    HtmlIntelligenceEngine.responsibility.includes("HTML structure"),
    "Engine responsibility should be HTML-structure evidence only."
  );

  assertEqual(
    HtmlIntelligenceEngine.model,
    "@cf/openai/gpt-oss-20b",
    "Engine model is incorrect."
  );
});

test("Prompt builder returns system and user messages", () => {
  const messages = buildHtmlIntelligenceMessages(sampleInput);

  assertArray(messages, "Messages must be an array.");
  assertEqual(messages.length, 2, "Exactly two messages are required.");
  assertEqual(messages[0].role, "system", "First message must be system.");
  assertEqual(messages[1].role, "user", "Second message must be user.");

  assert(
    messages[0].content.includes("Never diagnose the business"),
    "System prompt must prohibit diagnosis."
  );

  assert(
    messages[0].content.includes("Never classify a Growth Leak"),
    "System prompt must prohibit Growth Leak classification."
  );

  assert(
    messages[1].content.includes(sampleInput.websiteUrl),
    "User prompt must include the website URL."
  );

  assert(
    messages[1].content.includes("Roof Repair in Brevard County"),
    "User prompt must include supplied heading evidence."
  );

  assert(
    messages[1].content.includes("Primary Navigation"),
    "User prompt must include supplied navigation evidence."
  );

  assert(
    messages[1].content.includes("request-estimate"),
    "User prompt must include supplied form evidence."
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
  const validation = validateHtmlIntelligenceResult(result);

  assert(validation.valid, validation.errors.join("; "));
  assertEqual(
    validation.errors.length,
    0,
    "Valid output should not contain validation errors."
  );
});

test("Missing fields fail validation", () => {
  const result = {
    engine: {
      id: "html-intelligence",
      version: "1.0.0"
    }
  };

  const validation = validateHtmlIntelligenceResult(result);

  assert(
    !validation.valid,
    "Incomplete output must fail validation."
  );

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

  const validation = validateHtmlIntelligenceResult(result);

  assert(
    !validation.valid,
    "Wrong engine metadata must fail validation."
  );

  assert(
    validation.errors.some(error =>
      error.includes("engine.id")
    ),
    "Validation should report the incorrect engine id."
  );

  assert(
    validation.errors.some(error =>
      error.includes("engine.version")
    ),
    "Validation should report the incorrect engine version."
  );
});

test("AI execution normalizes heading evidence", async () => {
  const mockResult = createValidResult();

  mockResult.headingStructure.headings = [
    {
      level: "H1",
      text: "Roof Repair in Brevard County",
      source: sampleInput.websiteUrl,
      evidenceText: "<h1>Roof Repair in Brevard County</h1>"
    },
    {
      level: "H2",
      text: "Our Roofing Services",
      source: sampleInput.websiteUrl,
      evidenceText: "<h2>Our Roofing Services</h2>"
    }
  ];

  mockResult.headingStructure.h1Count = 1;

  const result = await executeHtmlIntelligence(
    createMockEnv(mockResult),
    sampleInput
  );

  assertEqual(
    result.headingStructure.headings.length,
    2,
    "Heading evidence was not preserved."
  );

  assertEqual(
    result.headingStructure.h1Count,
    1,
    "H1 count was not preserved."
  );

  assertEqual(
    result.evidenceSummary.headingCount,
    2,
    "Heading count was not normalized."
  );
});

test("AI execution normalizes semantic landmarks", async () => {
  const mockResult = createValidResult();

  mockResult.semanticLandmarks = [
    {
      landmark: "header",
      count: 1,
      source: sampleInput.websiteUrl,
      evidenceText: "<header>"
    },
    {
      landmark: "main",
      count: 1,
      source: sampleInput.websiteUrl,
      evidenceText: "<main>"
    },
    {
      landmark: "footer",
      count: 1,
      source: sampleInput.websiteUrl,
      evidenceText: "<footer>"
    }
  ];

  const result = await executeHtmlIntelligence(
    createMockEnv(mockResult),
    sampleInput
  );

  assertEqual(
    result.semanticLandmarks.length,
    3,
    "Semantic landmarks were not preserved."
  );

  assertEqual(
    result.evidenceSummary.landmarkCount,
    3,
    "Landmark count was not normalized."
  );
});

test("AI execution normalizes navigation evidence", async () => {
  const mockResult = createValidResult();

  mockResult.navigationStructure.navigationGroups = [
    {
      label: "Primary Navigation",
      items: [
        {
          text: "Home",
          url: "https://example-roofing.com/"
        },
        {
          text: "Roof Repair",
          url: "https://example-roofing.com/roof-repair/"
        }
      ],
      source: sampleInput.websiteUrl
    }
  ];

  const result = await executeHtmlIntelligence(
    createMockEnv(mockResult),
    sampleInput
  );

  assertEqual(
    result.navigationStructure.navigationGroups.length,
    1,
    "Navigation group was not preserved."
  );

  assertEqual(
    result.navigationStructure.navigationGroups[0].items.length,
    2,
    "Navigation items were not preserved."
  );
});

test("AI execution normalizes CTA and form evidence", async () => {
  const mockResult = createValidResult();

  mockResult.conversionStructure.callsToAction = [
    {
      text: "Request a Free Estimate",
      elementType: "link",
      destination: "#estimate-form",
      source: sampleInput.websiteUrl,
      evidenceText:
        '<a href="#estimate-form">Request a Free Estimate</a>'
    }
  ];

  mockResult.conversionStructure.forms = [
    {
      formType: "estimate",
      action: "/request-estimate/",
      method: "post",
      fields: [
        {
          name: "name",
          type: "text",
          label: "Name",
          required: true
        }
      ],
      source: sampleInput.websiteUrl,
      evidenceText:
        '<form id="estimate-form" action="/request-estimate/" method="post">'
    }
  ];

  mockResult.conversionStructure.phoneLinks = [
    "tel:3215550100"
  ];

  mockResult.conversionStructure.emailLinks = [
    "mailto:info@example-roofing.com"
  ];

  const result = await executeHtmlIntelligence(
    createMockEnv(mockResult),
    sampleInput
  );

  assertEqual(
    result.conversionStructure.callsToAction.length,
    1,
    "CTA evidence was not preserved."
  );

  assertEqual(
    result.conversionStructure.forms.length,
    1,
    "Form evidence was not preserved."
  );

  assertEqual(
    result.conversionStructure.phoneLinks.length,
    1,
    "Phone-link evidence was not preserved."
  );

  assertEqual(
    result.conversionStructure.emailLinks.length,
    1,
    "Email-link evidence was not preserved."
  );

  assertEqual(
    result.evidenceSummary.ctaCount,
    1,
    "CTA count was not normalized."
  );

  assertEqual(
    result.evidenceSummary.formCount,
    1,
    "Form count was not normalized."
  );
});

test("AI execution normalizes trust structure", async () => {
  const mockResult = createValidResult();

  mockResult.trustStructure.certificationGroups = [
    {
      label: "Certifications",
      items: [
        "Certified Roofing Contractor",
        "BBB Accredited Business"
      ],
      source: sampleInput.websiteUrl,
      evidenceText:
        '<div class="certifications">...</div>'
    }
  ];

  mockResult.trustStructure.guaranteesAndWarranties = [
    {
      text: "Satisfaction Guarantee",
      source: sampleInput.websiteUrl,
      evidenceText: "Satisfaction Guarantee"
    }
  ];

  const result = await executeHtmlIntelligence(
    createMockEnv(mockResult),
    sampleInput
  );

  assertEqual(
    result.trustStructure.certificationGroups.length,
    1,
    "Certification group was not preserved."
  );

  assertEqual(
    result.trustStructure.guaranteesAndWarranties.length,
    1,
    "Guarantee evidence was not preserved."
  );

  assertEqual(
    result.evidenceSummary.trustElementCount,
    2,
    "Trust element count was not normalized."
  );
});

test("AI execution normalizes image evidence", async () => {
  const mockResult = createValidResult();

  mockResult.imageStructure.images = [
    {
      src: "/images/roof-repair.webp",
      alt: "Roof repair project",
      loading: "lazy",
      linked: false,
      source: sampleInput.websiteUrl
    }
  ];

  mockResult.imageStructure.imageAltObservations = [
    {
      finding: "The image includes an alt attribute.",
      source: sampleInput.websiteUrl,
      evidenceText: 'alt="Roof repair project"'
    }
  ];

  const result = await executeHtmlIntelligence(
    createMockEnv(mockResult),
    sampleInput
  );

  assertEqual(
    result.imageStructure.images.length,
    1,
    "Image evidence was not preserved."
  );

  assertEqual(
    result.imageStructure.images[0].alt,
    "Roof repair project",
    "Image alt evidence was not preserved."
  );
});

test("AI execution normalizes local structure", async () => {
  const mockResult = createValidResult();

  mockResult.localStructure.napBlocks = [
    {
      name: "Example Roofing",
      address: "123 Main Street, Melbourne, FL",
      phone: "321-555-0100",
      source: sampleInput.websiteUrl,
      evidenceText:
        "Example Roofing 123 Main Street, Melbourne, FL 321-555-0100"
    }
  ];

  mockResult.localStructure.serviceAreaEvidence = [
    {
      location: "Brevard County",
      source: sampleInput.websiteUrl,
      evidenceText: "Roof Repair in Brevard County"
    }
  ];

  mockResult.localStructure.locationLinks = [
    {
      text: "Melbourne Roofing",
      url: "https://example-roofing.com/melbourne/",
      source: sampleInput.websiteUrl
    }
  ];

  const result = await executeHtmlIntelligence(
    createMockEnv(mockResult),
    sampleInput
  );

  assertEqual(
    result.localStructure.napBlocks.length,
    1,
    "NAP evidence was not preserved."
  );

  assertEqual(
    result.localStructure.serviceAreaEvidence.length,
    1,
    "Service-area evidence was not preserved."
  );

  assertEqual(
    result.localStructure.locationLinks.length,
    1,
    "Location-link evidence was not preserved."
  );
});

test("AI execution normalizes internal links", async () => {
  const mockResult = createValidResult();

  mockResult.internalLinkStructure.internalLinks = [
    {
      text: "Roof Repair",
      url: "https://example-roofing.com/roof-repair/",
      source: sampleInput.websiteUrl
    },
    {
      text: "Melbourne Roofing",
      url: "https://example-roofing.com/melbourne/",
      source: sampleInput.websiteUrl
    }
  ];

  mockResult.internalLinkStructure.serviceLinks = [
    {
      text: "Roof Repair",
      url: "https://example-roofing.com/roof-repair/",
      source: sampleInput.websiteUrl
    }
  ];

  mockResult.internalLinkStructure.locationPageLinks = [
    {
      text: "Melbourne Roofing",
      url: "https://example-roofing.com/melbourne/",
      source: sampleInput.websiteUrl
    }
  ];

  const result = await executeHtmlIntelligence(
    createMockEnv(mockResult),
    sampleInput
  );

  assertEqual(
    result.internalLinkStructure.internalLinks.length,
    2,
    "Internal-link evidence was not preserved."
  );

  assertEqual(
    result.evidenceSummary.internalLinkCount,
    2,
    "Internal-link count was not normalized."
  );
});

test("AI execution normalizes verification requirements", async () => {
  const mockResult = createValidResult();

  mockResult.verificationRequired = [
    {
      field: "headingStructure",
      finding: "Two H1 elements appear in the supplied HTML.",
      reason: "ambiguous-hierarchy",
      source: sampleInput.websiteUrl,
      evidenceText: "<h1>...</h1><h1>...</h1>"
    }
  ];

  const result = await executeHtmlIntelligence(
    createMockEnv(mockResult),
    sampleInput
  );

  assertEqual(
    result.verificationRequired.length,
    1,
    "Verification requirement was not preserved."
  );

  assertEqual(
    result.evidenceSummary.verificationRequiredCount,
    1,
    "Verification requirement count was not normalized."
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

  const result = await executeHtmlIntelligence(
    env,
    sampleInput
  );

  assertEqual(
    result.engine.id,
    "html-intelligence",
    "Code-fenced JSON was not parsed correctly."
  );
});

test("AI execution accepts response text", async () => {
  const mockResult = createValidResult();

  const env = {
    AI: {
      async run() {
        return {
          response: JSON.stringify(mockResult)
        };
      }
    }
  };

  const result = await executeHtmlIntelligence(
    env,
    sampleInput
  );

  assertEqual(
    result.engine.version,
    "1.0.0",
    "response text was not parsed correctly."
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

  const result = await executeHtmlIntelligence(
    env,
    sampleInput
  );

  assertEqual(
    result.pageIdentity.title,
    "Example Roofing | Roof Repair",
    "choices message content was not parsed correctly."
  );
});

test("AI execution accepts output content text", async () => {
  const mockResult = createValidResult();

  const env = {
    AI: {
      async run() {
        return {
          output: [
            {
              content: [
                {
                  text: JSON.stringify(mockResult)
                }
              ]
            }
          ]
        };
      }
    }
  };

  const result = await executeHtmlIntelligence(
    env,
    sampleInput
  );

  assertEqual(
    result.website.requestedUrl,
    sampleInput.websiteUrl,
    "output content text was not parsed correctly."
  );
});

test("Missing optional collections normalize to empty arrays", async () => {
  const mockResult = createValidResult();

  mockResult.navigationStructure.navigationGroups = null;
  mockResult.trustStructure.certificationGroups = null;
  mockResult.imageStructure.images = null;
  mockResult.localStructure.locationLinks = null;

  const result = await executeHtmlIntelligence(
    createMockEnv(mockResult),
    sampleInput
  );

  assertArray(
    result.navigationStructure.navigationGroups,
    "Missing navigation groups must normalize to an empty array."
  );

  assertArray(
    result.trustStructure.certificationGroups,
    "Missing certification groups must normalize to an empty array."
  );

  assertArray(
    result.imageStructure.images,
    "Missing images must normalize to an empty array."
  );

  assertArray(
    result.localStructure.locationLinks,
    "Missing location links must normalize to an empty array."
  );
});

test("Missing optional scalar values normalize to Unknown", async () => {
  const mockResult = createValidResult();

  mockResult.pageIdentity.title = "";
  mockResult.pageIdentity.metaDescription = "";
  mockResult.pageIdentity.pageType = "";

  const inputWithoutMetadata = {
    ...sampleInput,
    pageTitle: "",
    metaDescription: ""
  };

  const result = await executeHtmlIntelligence(
    createMockEnv(mockResult),
    inputWithoutMetadata
  );

  assertEqual(
    result.pageIdentity.title,
    "Unknown",
    "Missing title must normalize to Unknown."
  );

  assertEqual(
    result.pageIdentity.metaDescription,
    "Unknown",
    "Missing meta description must normalize to Unknown."
  );

  assertEqual(
    result.pageIdentity.pageType,
    "Unknown",
    "Missing page type must normalize to Unknown."
  );
});

test("Execution fails when the AI binding is missing", async () => {
  let errorMessage = "";

  try {
    await executeHtmlIntelligence({}, sampleInput);
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
  let errorMessage = "";

  try {
    await executeHtmlIntelligence(
      createMockEnv(createValidResult()),
      {
        ...sampleInput,
        websiteUrl: ""
      }
    );
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
  let errorMessage = "";

  try {
    await executeHtmlIntelligence(
      createMockEnv(createValidResult()),
      {
        ...sampleInput,
        html: ""
      }
    );
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

test("Execution fails when AI returns invalid JSON", async () => {
  const env = {
    AI: {
      async run() {
        return {
          output_text: "This is not JSON."
        };
      }
    }
  };

  let errorMessage = "";

  try {
    await executeHtmlIntelligence(env, sampleInput);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : String(error);
  }

  assert(
    errorMessage.includes("JSON"),
    "Invalid JSON should produce a clear error."
  );
});

/* =========================================================
   Test Fixtures
   ========================================================= */

function createValidResult() {
  return {
    engine: {
      id: "html-intelligence",
      version: "1.0.0"
    },

    website: {
      requestedUrl: sampleInput.websiteUrl,
      finalUrl: sampleInput.finalUrl,
      retrievedAt: sampleInput.retrievedAt,
      sourcePages: sampleInput.sourcePages
    },

    pageIdentity: {
      title: sampleInput.pageTitle,
      metaDescription: sampleInput.metaDescription,
      pageType: "homepage",
      pagePurposeEvidence: []
    },

    headingStructure: {
      headings: [],
      h1Count: 0,
      emptyHeadings: [],
      repeatedHeadings: [],
      hierarchyObservations: []
    },

    semanticLandmarks: [],

    navigationStructure: {
      navigationGroups: [],
      breadcrumbEvidence: [],
      repeatedNavigationEvidence: []
    },

    conversionStructure: {
      callsToAction: [],
      forms: [],
      phoneLinks: [],
      emailLinks: [],
      bookingLinks: []
    },

    trustStructure: {
      testimonials: [],
      reviewWidgets: [],
      certificationGroups: [],
      guaranteesAndWarranties: [],
      caseStudiesAndProjectEvidence: [],
      clientOrPartnerLogos: []
    },

    contentStructure: {
      sections: [],
      lists: [],
      tables: []
    },

    imageStructure: {
      images: [],
      imageAltObservations: []
    },

    localStructure: {
      napBlocks: [],
      serviceAreaEvidence: [],
      locationLinks: [],
      mapEvidence: []
    },

    internalLinkStructure: {
      internalLinks: [],
      serviceLinks: [],
      locationPageLinks: []
    },

    verificationRequired: [],

    evidenceSummary: {
      headingCount: 0,
      landmarkCount: 0,
      ctaCount: 0,
      formCount: 0,
      trustElementCount: 0,
      internalLinkCount: 0,
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
  console.log("GCM OS HTML Intelligence Engine Tests");
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
      `${failed} HTML Intelligence test${failed === 1 ? "" : "s"} failed.`
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
