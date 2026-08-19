/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailOperationalIntake.test.js
   Version: 1.0.1
   Status: Production Regression Test
   Purpose: Verify Morning Command uses GCM OS disposition state rather than
            Gmail read/unread state when surfacing operational email.
   Change notes — 1.0.1:
   - Validates the JavaScript dataset contract that creates the rendered
     data-gcm-backlog attribute instead of requiring rendered HTML in source.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const route = read("routes/gmailWorkRequests.js");
const ui = read("shared/today-gmail-decisions.js");

assert.match(route, /Version: 1\.1\.0/);
assert.match(route, /mode\)\.toLowerCase\(\) === "operational-backlog"/);
assert.match(route, /-in:spam -in:trash \{in:inbox label:Kristy label:\"Frank & Adrianne Stuff\" label:\"REPORTS-SEO\"\}/);
assert.doesNotMatch(
  route.match(/const OPERATIONAL_GMAIL_QUERY[\s\S]*?;/)?.[0] || "",
  /is:unread/i
);
assert.match(route, /SELECT external_id AS source_reference[\s\S]*FROM communications/);
assert.match(route, /FROM activity_records[\s\S]*source_reference IN/);
assert.match(route, /evidence_reference IN/);
assert.match(route, /writesPerformed:0/);
assert.match(route, /excludeIds/);
assert.match(route, /evaluateExplicitHumanWorkRequest/);

assert.match(ui, /Version: 1\.1\.0/);
assert.match(ui, /const BACKLOG_MODE = "operational-backlog"/);
assert.match(ui, /const MAX_VISIBLE_EMAILS = 10/);
assert.match(ui, /Read · Unprocessed/);
assert.match(ui, /article\.dataset\.gcmBacklog = "1"/);
assert.match(ui, /Gmail read state is not treated as processed/);
assert.match(ui, /Create Requested Work/);
assert.match(ui, /Save as Monitoring/);
assert.match(ui, /Create Investigation/);
assert.match(ui, /Delete — No Action/);
assert.match(ui, /Keep as Information/);

console.log("PASS Gmail operational intake uses OS disposition state, not unread state");
