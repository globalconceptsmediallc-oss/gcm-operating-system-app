/* =========================================================
   Global Concepts Media Operating System (GCM OS)
   File: tests/websiteIntelligence.test.js
   Engine Under Test: engines/websiteIntelligence.js
   Test Version: 1.0.0

   Purpose:
   Validate the Website Intelligence Engine independently
   before connecting it to the production Worker.

   This test does not modify or deploy worker.js.
   ========================================================= */

import {
  WebsiteIntelligenceEngine,
  buildWebsiteIntelligenceMessages,
  validateWebsiteIntelligenceResult,
  executeWebsiteIntelligence
} from "../engines/websiteIntelligence.js";

const results = [];

function test(name, fn) {
  results.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

const sampleInput = {
  websiteUrl: "https://example-roofing.com/",
  retrievedAt: "2026-07-13T12:00:00.000Z",
  pageTitle: "Example Roofing | Roof Repair and Replacement",
  metaDescription: "Example Roofing provides roof repair and replacement services in Brevard County, Florida.",
  headings: ["Roof Repair", "Roof Replacement", "Request a Free Estimate"],
  links: [{ url: "https://example-roofing.com/contact", label: "Contact Us" }],
  structuredData: null,
  sourcePages: ["https://example-roofing.com/"],
  websiteContent: "Example Roofing provides residential roof repair and roof replacement in Brevard County, Florida. Call 321-555-0100 or request a free estimate. Licensed and insured. John Example is the company president."
};

function minimalValidResult() {
  return {
    engine: { id: "website-intelligence", version: "1.0.0" },
    website: {
      url: sampleInput.websiteUrl,
      retrievedAt: sampleInput.retrievedAt,
      sourcePages: sampleInput.sourcePages
    },
    businessIdentity: {
      businessName: "Example Roofing",
      alternateNames: [],
      businessNameEvidence: []
    },
    industrySignals: [],
    productsAndServices: [],
    marketsAndServiceAreas: [],
    contactPaths: {
      phoneNumbers: [],
      emailAddresses: [],
      physicalAddresses: [],
      contactPages: [],
      contactForms: [],
      bookingPaths: []
    },
    callsToAction: [],
    trustEvidence: [],
    certificationsAndCredentials: [],
    ownershipAndDecisionMakerEvidence: [],
    brandPositioning: {
      taglines: [],
      positioningStatements: [],
      audienceSignals: [],
      valuePropositionSignals: []
    },
    publicClaims: [],
    publicLinks: { internal: [], social: [], external: [] },
    verificationRequired: [],
    evidenceSummary: {
      observableFactsCount: 0,
      publicClaimsCount: 0,
      verificationRequiredCount: 0,
      sourcePageCount: 1
    }
  };
}

test("Engine metadata is correct", () => {
  assertEqual(WebsiteIntelligenceEngine.id, "website-intelligence", "Engine id is incorrect.");
  assertEqual(WebsiteIntelligenceEngine.version, "1.0.0", "Engine version is incorrect.");
  assert(WebsiteIntelligenceEngine.responsibility.includes("evidence"), "Responsibility should be evidence-only.");
});

test("Prompt builder returns system and user messages", () => {
  const messages = buildWebsiteIntelligenceMessages(sampleInput);
  assert(Array.isArray(messages), "Messages must be an array.");
  assertEqual(messages.length, 2, "Exactly two messages are required.");
  assertEqual(messages[0].role, "system", "First message must be system.");
  assertEqual(messages[1].role, "user", "Second message must be user.");
  assert(messages[0].content.includes("Never diagnose"), "System message must prohibit diagnosis.");
  assert(messages[1].content.includes(sampleInput.websiteUrl), "User message must include the website URL.");
  assert(messages[1].content.includes("REQUIRED OUTPUT CONTRACT"), "User message must include the output contract.");
  assert(messages[1].content.includes("Do not include recommendations"), "User message must prohibit recommendations.");
});

test("Valid result passes validation", () => {
  const validation = validateWebsiteIntelligenceResult(minimalValidResult());
  assert(validation.valid, validation.errors.join("; "));
  assertEqual(validation.errors.length, 0, "Valid output should not contain errors.");
});

test("Missing fields fail validation", () => {
  const validation = validateWebsiteIntelligenceResult({
    engine: { id: "website-intelligence", version: "1.0.0" }
  });
  assert(!validation.valid, "Incomplete output must fail validation.");
  assert(validation.errors.some(error => error.includes("Missing top-level field")), "Missing fields should be reported.");
});

test("Wrong engine metadata fails validation", () => {
  const invalid = minimalValidResult();
  invalid.engine = { id: "wrong-engine", version: "9.9.9" };
  const validation = validateWebsiteIntelligenceResult(invalid);
  assert(!validation.valid, "Incorrect engine metadata must fail validation.");
  assert(validation.errors.some(error => error.includes("engine.id")), "Incorrect engine id should be reported.");
  assert(validation.errors.some(error => error.includes("engine.version")), "Incorrect engine version should be reported.");
});

test("AI execution normalizes valid model output", async () => {
  const mock = minimalValidResult();
  mock.publicClaims = [{
    claim: "Licensed and insured",
    claimType: "license",
    source: sampleInput.websiteUrl,
    evidenceText: "Licensed and insured.",
    verificationStatus: "unverified-public-claim"
  }];
  mock.evidenceSummary.publicClaimsCount = 99;

  const env = {
    AI: {
      async run() {
        return { output_text: JSON.stringify(mock) };
      }
    }
  };

  const result = await executeWebsiteIntelligence(env, sampleInput);
  assertEqual(result.businessIdentity.businessName, "Example Roofing", "Business name was not preserved.");
  assertEqual(result.publicClaims.length, 1, "Public claim count is incorrect.");
  assertEqual(result.evidenceSummary.publicClaimsCount, 1, "Public claim count was not normalized.");
  assertEqual(result.evidenceSummary.sourcePageCount, 1, "Source page count was not normalized.");
});

test("AI execution accepts JSON inside code fences", async () => {
  const env = {
    AI: {
      async run() {
        return { output_text: `\`\`\`json\n${JSON.stringify(minimalValidResult(), null, 2)}\n\`\`\`` };
      }
    }
  };

  const result = await executeWebsiteIntelligence(env, sampleInput);
  assertEqual(result.engine.id, "website-intelligence", "Code-fenced JSON was not parsed correctly.");
});

test("Execution fails when AI binding is missing", async () => {
  let message = "";
  try {
    await executeWebsiteIntelligence({}, sampleInput);
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert(message.includes("AI binding"), "Missing AI binding should produce a clear error.");
});

test("Execution fails when website content is missing", async () => {
  const env = { AI: { async run() { return {}; } } };
  let message = "";
  try {
    await executeWebsiteIntelligence(env, {
      websiteUrl: sampleInput.websiteUrl,
      websiteContent: ""
    });
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert(message.includes("websiteContent"), "Missing website content should produce a clear error.");
});

async function run() {
  let passed = 0;
  let failed = 0;

  console.log("");
  console.log("GCM OS Website Intelligence Engine Tests");
  console.log("========================================");

  for (const item of results) {
    try {
      await item.fn();
      passed += 1;
      console.log(`PASS: ${item.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL: ${item.name}`);
      console.error(error instanceof Error ? error.message : String(error));
    }
  }

  console.log("----------------------------------------");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log("");

  if (failed > 0) {
    throw new Error(`${failed} Website Intelligence test${failed === 1 ? "" : "s"} failed.`);
  }
}

run().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  if (typeof process !== "undefined" && process?.exit) process.exit(1);
});
