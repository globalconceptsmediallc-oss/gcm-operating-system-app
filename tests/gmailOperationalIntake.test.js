/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailOperationalIntake.test.js
   Version: 1.3.0
   Status: Production Regression Test
   Purpose: Verify Morning Command uses GCM OS disposition state rather than
            Gmail read/unread state and preserves exact source evidence before
            any approved Monitoring disposition clears Gmail.

   Change notes — 1.3.0:
   - Locks the universal Monitoring source-evidence vault and runtime schema guard.
   - Road-tests the real North Florida Safes Site Audit evidence shape.
   - Requires Site Health, crawled pages, errors, warnings, notices, broken,
     blocked, sitemap ratio, and explicit stability signal to survive extraction.
   - Preserves Position Tracking and Decision Hold regressions.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  extractPositionTrackingEvidence,
  extractMonitoringEvidence,
  formatPositionTrackingEvidence,
  formatMonitoringEvidence,
  buildPositionTrackingBusinessMeaning,
  buildMonitoringBusinessMeaning
} from "../shared/gmailMonitoringEvidence.js";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function metricByLabel(evidence, label) {
  return (evidence?.metrics || []).find(
    metric => String(metric?.label || "").toLowerCase() === label.toLowerCase()
  );
}

const route = read("routes/gmailWorkRequests.js");
const dispositions = read("routes/gmailDispositions.js");
const ui = read("shared/today-gmail-decisions.js");
const monitoringMigration = read("migrations/0014_gmail_monitoring_source_evidence.sql");
const monitoringSchemaGuard = read("shared/gmailMonitoringEvidenceSchema.js");

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

assert.match(dispositions, /Version: 1\.3\.0/);
assert.match(dispositions, /PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION = "preview-gmail-inbox"/);
assert.match(dispositions, /APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION = "approve-gmail-monitoring"/);
assert.match(dispositions, /HOLD_GMAIL_DECISION_ACTION = "hold-gmail-decision"/);
assert.match(dispositions, /ensureGmailMonitoringEvidenceSchema/);
assert.match(dispositions, /captureMonitoringSourceEvidence/);
assert.match(dispositions, /gmail_monitoring_evidence/);
assert.match(dispositions, /Universal Gmail source evidence:/);
assert.match(dispositions, /Structured source evidence:/);
assert.match(dispositions, /deletePendingMonitoringEvidence/);
assert.match(dispositions, /INSERT INTO decision_holds/);
assert.match(dispositions, /source_content/);
assert.match(dispositions, /workItemsCreated:0/);
assert.match(dispositions, /investigationsCreated:0/);
assert.match(dispositions, /ensureDecisionHoldSchema/);

assert.match(monitoringMigration, /CREATE TABLE IF NOT EXISTS gmail_monitoring_evidence/);
assert.match(monitoringMigration, /source_content TEXT NOT NULL/);
assert.match(monitoringMigration, /structured_evidence_json TEXT/);
assert.match(monitoringMigration, /activity_record_id INTEGER/);
assert.match(monitoringSchemaGuard, /ensureGmailMonitoringEvidenceSchema/);
assert.match(monitoringSchemaGuard, /CREATE TABLE IF NOT EXISTS gmail_monitoring_evidence/);

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

const positionSample = `Position Tracking

Project: A1 Action • a1actionsafeandlock.com

Device & Location: Melbourne,Florida,United States (google) • English

Date: August 21, 2026

Alert triggered for 1 keywords

Rule: Enters the top 10

Domain: a1actionsafeandlock.com

Keyword Pos. on Aug 21 Diff. Volume

locksmith for business doors 9 4 0

Go to Campaign`;

const positionEvidence = extractPositionTrackingEvidence(positionSample);
assert.deepEqual(positionEvidence, {
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
  formatPositionTrackingEvidence(positionEvidence),
  "locksmith for business doors · #9 · ↑4 · Enters the top 10 · a1actionsafeandlock.com · August 21, 2026"
);
assert.match(
  buildPositionTrackingBusinessMeaning(positionEvidence, "A1 Action Safe & Lock"),
  /“locksmith for business doors” is now position 9, up 4 positions, triggering “Enters the top 10”/
);

const flattened = positionSample.replace(/\n+/g, " ");
const flattenedEvidence = extractPositionTrackingEvidence(flattened);
assert.equal(flattenedEvidence?.keywords?.[0]?.keyword, "locksmith for business doors");
assert.equal(flattenedEvidence?.keywords?.[0]?.position, 9);
assert.equal(flattenedEvidence?.keywords?.[0]?.change, 4);

const siteAuditMessage = {
  subject:"northfloridasafes.com: We crawled only 97 out of 119 pages submitted in your sitemap.xml",
  date:"Fri, 21 Aug 2026 02:32:46 +0000",
  bodyText:`Site Audit
Project: northfloridasafes.com
Website URL: northfloridasafes.com
Date: Aug 21, 2026 (02:32:43)
Hello,
We haven't detected any significant changes in your site's health since the previous audit.
We crawled only 97 out of 119 pages submitted in your sitemap.xml.
Site Health
89%
Crawled Pages
145
Healthy
4
Broken
0
Have Issues
136
Redirects
5
Blocked
0
Errors
0 no change
Warnings
687 no change
Notices
484 no change
New 2xx pages
Not found
Types of issues
No new or fixed types
Robots.txt updates
No changes
Top Issues
131 pages have a low text/HTML ratio
18 pages don't have meta descriptions
396 internal resources are blocked from crawling`
};

const siteAuditEvidence = extractMonitoringEvidence(siteAuditMessage);
assert.equal(siteAuditEvidence?.type, "monitoring_evidence");
assert.equal(metricByLabel(siteAuditEvidence, "Site Health")?.displayValue, "89%");
assert.equal(metricByLabel(siteAuditEvidence, "Crawled Pages")?.value, 145);
assert.equal(metricByLabel(siteAuditEvidence, "Errors")?.value, 0);
assert.equal(metricByLabel(siteAuditEvidence, "Warnings")?.value, 687);
assert.equal(metricByLabel(siteAuditEvidence, "Notices")?.value, 484);
assert.equal(metricByLabel(siteAuditEvidence, "Broken")?.value, 0);
assert.equal(metricByLabel(siteAuditEvidence, "Blocked")?.value, 0);
assert.equal(metricByLabel(siteAuditEvidence, "Reported Ratio")?.displayValue, "97/119");
assert.match(siteAuditEvidence?.stableSignal || "", /No significant change/i);

const siteAuditSummary = formatMonitoringEvidence(siteAuditEvidence);
assert.match(siteAuditSummary, /Site Health 89%/);
assert.match(siteAuditSummary, /Errors 0/);
assert.match(siteAuditSummary, /Warnings 687/);
assert.match(siteAuditSummary, /Notices 484/);
assert.match(siteAuditSummary, /Broken 0/);
assert.match(siteAuditSummary, /Blocked 0/);
assert.match(siteAuditSummary, /Crawled Pages 145/);
assert.match(siteAuditSummary, /Reported Ratio 97\/119/);
assert.match(siteAuditSummary, /No significant change/i);

const siteAuditMeaning = buildMonitoringBusinessMeaning(
  siteAuditEvidence,
  "North Florida Safes"
);
assert.match(siteAuditMeaning, /^North Florida Safes:/);
assert.match(siteAuditMeaning, /Site Health 89%/);
assert.match(siteAuditMeaning, /Warnings 687/);
assert.match(siteAuditMeaning, /source-grounded facts/i);
assert.match(siteAuditMeaning, /does not create corrective work/i);

console.log("PASS Gmail operational intake preserves universal monitoring evidence and Decision Hold state");
