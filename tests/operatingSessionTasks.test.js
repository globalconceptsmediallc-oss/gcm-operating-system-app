/* =========================================================
   Global Concepts Media Operating System
   File: tests/operatingSessionTasks.test.js
   Version: 1.0.0
   Status: OS 2.0 Foundation Test
   Purpose: Verify task-sized Operating Session safety rules.
   ========================================================= */

import assert from "node:assert/strict";
import {
  prepareCreateSessionTask,
  prepareAddEvidenceTask,
  prepareAddSessionEntryTask
} from "../shared/operatingSessionTasks.js";

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

test("creates a session only with proven client identity", () => {
  const task = prepareCreateSessionTask({
    clientId: 8,
    title: "South Florida Safes sitemap verification",
    issueSummary: "Confirm the corrected homepage sitemap entry.",
    priority: "high"
  });

  assert.equal(task.clientId, 8);
  assert.equal(task.status, "detected");
  assert.throws(
    () => prepareCreateSessionTask({ title: "Missing client", issueSummary: "No client." }),
    /proven clientId/
  );
});

test("accepts native email evidence without a screenshot", () => {
  const task = prepareAddEvidenceTask({
    operatingSessionId: 12,
    clientId: 8,
    evidenceType: "email",
    sourceLabel: "SEMrush Site Audit email",
    sourceLocator: "gmail:message:preserved-reference",
    rawContent: "The audit reported the current sitemap condition.",
    sourceFacts: ["Site Health: 87%", "Site Health: 87%"],
    aiInterpretation: "The result may require verification.",
    verificationStatus: "unverified"
  }, {
    id: 12,
    clientId: 8
  });

  assert.equal(task.evidenceType, "email");
  assert.equal(task.rawContent, "The audit reported the current sitemap condition.");
  assert.deepEqual(task.sourceFacts, ["Site Health: 87%"]);
  assert.equal(task.aiInterpretation, "The result may require verification.");
});

test("accepts written and link evidence as first-class sources", () => {
  const session = { id: 7, clientId: 10 };
  const written = prepareAddEvidenceTask({
    operatingSessionId: 7,
    clientId: 10,
    evidenceType: "written",
    sourceLabel: "Live verification note",
    rawContent: "The canonical tag matched the final redirected URL.",
    verificationStatus: "verified"
  }, session);
  const link = prepareAddEvidenceTask({
    operatingSessionId: 7,
    clientId: 10,
    evidenceType: "link",
    sourceLabel: "Verified page",
    sourceLocator: "https://globalconceptsmedia.com/growth-review"
  }, session);

  assert.equal(written.verificationStatus, "verified");
  assert.equal(link.sourceLocator, "https://globalconceptsmedia.com/growth-review");
});

test("rejects cross-client evidence attribution", () => {
  assert.throws(
    () => prepareAddEvidenceTask({
      operatingSessionId: 12,
      clientId: 10,
      evidenceType: "written",
      sourceLabel: "Wrong client",
      rawContent: "South Florida Safes evidence"
    }, {
      id: 12,
      clientId: 8
    }),
    /does not match/
  );
});

test("keeps AI interpretation in a distinct working entry", () => {
  const task = prepareAddSessionEntryTask({
    operatingSessionId: 12,
    clientId: 8,
    entryType: "ai_interpretation",
    authorType: "ai",
    authorName: "GCM Operating Partner",
    content: "The evidence supports verification before additional work."
  }, {
    id: 12,
    clientId: 8
  });

  assert.equal(task.entryType, "ai_interpretation");
  assert.equal(task.authorType, "ai");
});

let failures = 0;

for (const item of tests) {
  try {
    await item.run();
    console.log(`PASS ${item.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${item.name}`);
    console.error(error);
  }
}

if (failures) {
  process.exitCode = 1;
} else {
  console.log(`PASS ${tests.length} Operating Session task tests`);
}
