/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailOperationalIntake.test.js
   Version: 1.2.0
   Status: Production Regression Test
   Purpose: Verify Morning Command uses GCM OS disposition state rather than
            Gmail read/unread state, preserves exact Position Tracking evidence,
            and excludes open Decision Holds from active inbox processing.

   Change notes — 1.2.0:
   - Locks Gmail backlog filtering to open Decision Hold source references.
   - Locks Today to the Hold for Review / Work Lite controls.
   - Preserves every Position Tracking evidence assertion from 1.1.0.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  extractPositionTrackingEvidence,
  formatPositionTrackingEvidence,
  buildPositionTrackingBusinessMeaning
} from "../shared/gmailMonitoringEvidence.js";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const route = read("routes/gmailWorkRequests.js");
const dispositions = read("routes/gmailDispositions.js");
const ui = read("shared/today-gmail-decisions.js");

assert.match(route, /Version: 1\.1\.1/);
assert.match(route, /mode\)\.toLowerCase\(\) === "operational-backlog"/);
assert.match(route, /-in:spam -in:trash \{in:inbox label:Kristy label:\"Frank & Adrianne Stuff\" label:\"REPORTS-SEO\"\}/);
assert.doesNotMatch(
  route.match(/const OPERATIONAL_GMAIL_QUERY[\s\S]*?;/)?.[0] || "",
  /is:unread/i
);
assert.match(route, /SELECT external_id AS source_reference[\s\S]*FROM communications/);
assert.match(route, /FROM activity_records[\s\S]*source_reference IN/);
assert.match(route, /evidence_reference IN/);
assert.match(route, /FROM decision_holds/);
assert.match(route, /LOWER\(COALESCE\(status, 'open'\)\) IN \('open','held','waiting'\)/);
assert.match(route, /writesPerformed:0/);
assert.match(route, /excludeIds/);
assert.match(route, /evaluateExplicitHumanWorkRequest/);

assert.match(dispositions, /Version: 1\.2\.0/);
assert.match(dispositions, /PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION = "preview-gmail-inbox"/);
assert.match(dispositions, /APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION = "approve-gmail-monitoring"/);
assert.match(dispositions, /HOLD_GMAIL_DECISION_ACTION = "hold-gmail-decision"/);
assert.match(dispositions, /Structured evidence:/);
assert.match(dispositions, /Gmail source evidence:/);
assert.match(dispositions, /INSERT INTO decision_holds/);
assert.match(dispositions, /source_content/);
assert.match(dispositions, /workItemsCreated:0/);
assert.match(dispositions, /investigationsCreated:0/);
assert.match(dispositions, /await markMessageRead\(gmailMessageId, accessToken\)/);
assert.match(dispositions, /if \(!recordId\)[\s\S]*Gmail was left unread/);

assert.match(ui, /Version: 1\.2\.0/);
assert.match(ui, /const BACKLOG_MODE = "operational-backlog"/);
assert.match(ui, /const HOLD_DECISION = "hold-gmail-decision"/);
assert.match(ui, /const MAX_VISIBLE_EMAILS = 10/);
assert.match(ui, /Read · Unprocessed/);
assert.match(ui, /article\.dataset\.gcmBacklog = "1"/);
assert.match(ui, /Gmail read state is not treated as processed/);
assert.match(ui, /Hold for Review/);
assert.match(ui, /Decision Holds · Work Lite/);
assert.match(ui, /Return to Morning Command/);
assert.match(ui, /Create Requested Work/);
assert.match(ui, /Save as Monitoring/);
assert.match(ui, /Create Investigation/);
assert.match(ui, /Delete — No Action/);
assert.match(ui, /Keep as Information/);

const sample = `Position Tracking

Project: A1 Action • a1actionsafeandlock.com

Device & Location: Melbourne,Florida,United States (google) • English

Date: August 21, 2026

Alert triggered for 1 keywords

Rule: Enters the top 10

Domain: a1actionsafeandlock.com

Keyword Pos. on Aug 21 Diff. Volume

locksmith for business doors 9 4 0

Go to Campaign`;

const evidence = extractPositionTrackingEvidence(sample);
assert.deepEqual(evidence, {
  type:"position_tracking",
  project:"A1 Action",
  domain:"a1actionsafeandlock.com",
  reportDate:"August 21, 2026",
  rule:"Enters the top 10",
  keywordCount:1,
  keywords:[{
    keyword:"locksmith for business doors",
    position:9,
    change:4,
    volume:0
  }]
});
assert.equal(
  formatPositionTrackingEvidence(evidence),
  "locksmith for business doors · #9 · ↑4 · Enters the top 10 · a1actionsafeandlock.com · August 21, 2026"
);
assert.match(
  buildPositionTrackingBusinessMeaning(evidence, "A1 Action Safe & Lock"),
  /“locksmith for business doors” is now position 9, up 4 positions, triggering “Enters the top 10”/
);

const flattened = sample.replace(/\n+/g, " ");
const flattenedEvidence = extractPositionTrackingEvidence(flattened);
assert.equal(flattenedEvidence?.keywords?.[0]?.keyword, "locksmith for business doors");
assert.equal(flattenedEvidence?.keywords?.[0]?.position, 9);
assert.equal(flattenedEvidence?.keywords?.[0]?.change, 4);

console.log("PASS Gmail operational intake preserves evidence and open Decision Hold state");
