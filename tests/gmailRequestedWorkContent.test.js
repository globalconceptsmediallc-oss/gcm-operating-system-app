/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailRequestedWorkContent.test.js
   Version: 1.0.1
   Status: Production Regression Test
   Purpose: Lock human-routed Gmail Requested Work to executable source
            content instead of generic routing metadata.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const dispositions = read("routes/gmailDispositions.js");
const operationalDecision = read("routes/operationalDecision.js");
const migration = read("migrations/0015_gmail_requested_work_content_repair.sql");

assert.match(dispositions, /Version: 2\.2\.2/);
assert.match(dispositions, /GMAIL_HUMAN_ROUTING_VERSION = "2\.2\.1"/);
assert.match(dispositions, /workTitle:disposition === "requested_work"/);
assert.match(dispositions, /workDescription:requestedWorkSource/);
assert.match(dispositions, /sanitizeEmailText\(message\.bodyText \|\| message\.snippet \|\| message\.subject\)/);

assert.match(operationalDecision, /Version: 7\.1\.0/);
assert.match(operationalDecision, /workTitle: clean\(decision\.workTitle \|\| decision\.work_title\)/);
assert.match(operationalDecision, /workDescription: clean\(decision\.workDescription \|\| decision\.work_description\)/);
assert.match(operationalDecision, /decision\.workTitle \|\| decision\.recommendedAction \|\| decision\.title/);
assert.match(operationalDecision, /decision\.workDescription \|\| decision\.reasoning \|\| decision\.operationalSummary/);

assert.match(migration, /c\.source = 'Gmail — Human Routing'/);
assert.match(migration, /c\.category = 'Requested Work'/);
assert.match(migration, /SELECT NULLIF\(TRIM\(c\.subject\), ''\)/);
assert.match(migration, /SELECT NULLIF\(TRIM\(c\.raw_content\), ''\)/);
assert.match(migration, /Execute the requested work from the preserved source email and record the result as Proof of Work/);

console.log("PASS Gmail human Requested Work preserves executable source content and repairs generic placeholders");
