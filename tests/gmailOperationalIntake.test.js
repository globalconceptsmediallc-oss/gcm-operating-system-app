/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailOperationalIntake.test.js
   Version: 1.3.10
   Status: Production Regression Test
   Purpose: Verify Morning Command uses GCM OS disposition state rather than
            Gmail read/unread state and preserves exact source evidence before
            any approved Monitoring disposition clears Gmail.

   Change notes — 1.3.10:
   - Updates the authoritative Gmail disposition route lock from 1.3.2 to 1.3.3.
   - Preserves every prior intake/evidence assertion while the dedicated parity
     regression locks pre-truncation normalization of malformed Gmail HTML.

   Change notes — 1.3.9:
   - Updates the shared Monitoring evidence parser version lock from 1.1.4 to 1.1.5.
   - Preserves every prior intake/evidence assertion with no operational behavior change.

   Change notes — 1.3.8:
   - Updates the Gmail disposition route version lock from 1.3.1 to 1.3.2.
   - Preserves every prior intake/evidence assertion with no operational behavior change.

   Change notes — 1.3.7:
   - Updates the Today Gmail decision asset version lock from 1.2.0 to 1.2.1.
   - No operational behavior changes; preserves every prior intake/evidence lock.

   Change notes — 1.3.6:
   - Locks Gmail disposition route v1.3.1 as the authoritative Monitoring writer.
   - Requires live-source evidence + verified production client before D1 write.
   - Requires the evidence-aware route to insert Monitoring directly instead of
     handing an approved report back to the obsolete legacy Gmail decision path.
   - Preserves every prior universal, linked, Position Tracking, and Ahrefs lock.

   Change notes — 1.3.5:
   - Locks repeated flattened changed rows that use the explicit New marker.
   - Prevents later delta facts from disappearing after the first changed row.
   - Preserves every prior universal, linked, Position Tracking, and Ahrefs lock.

   Change notes — 1.3.4:
   - Locks measurable report deltas such as +1 and −96 into Monitoring evidence.
   - Road-tests the live Ahrefs North Florida Safes alert in line-oriented and
     flattened source shapes.
   - Requires health context and changed metrics to survive compact formatting.

   Change notes — 1.3.3:
   - Updates the durable Gmail Work-request route version lock to 1.1.2.
   - Requires the production route to wire evidence-aware backlog intelligence.
   - Preserves every universal evidence, Position Tracking, and Decision Hold lock.

   Change notes — 1.3.2:
   - Locks ratio evidence into the compact monitoring summary even when more
     than ten measurable facts are present.
   - Preserves the live linked/flattened Site Audit regression and every prior
     universal evidence, Position Tracking, and Decision Hold lock.

   Change notes — 1.3.1:
   - Reproduces the live Semrush Site Audit failure where values are hyperlinks.
   - Requires linked and flattened Gmail source shapes to retain the same metrics.
   - Preserves every universal evidence, Position Tracking, and Decision Hold lock.

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
  GMAIL_MONITORING_EVIDENCE_VERSION,
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

function assertSiteAuditMetrics(evidence) {
  assert.equal(evidence?.type, "monitoring_evidence");
  assert.equal(metricByLabel(evidence, "Site Health")?.displayValue, "89%");
  assert.equal(metricByLabel(evidence, "Crawled Pages")?.value, 145);
  assert.equal(metricByLabel(evidence, "Errors")?.value, 0);
  assert.equal(metricByLabel(evidence, "Warnings")?.value, 687);
  assert.equal(metricByLabel(evidence, "Notices")?.value, 484);
  assert.equal(metricByLabel(evidence, "Broken")?.value, 0);
  assert.equal(metricByLabel(evidence, "Blocked")?.value, 0);
  assert.equal(metricByLabel(evidence, "Reported Ratio")?.displayValue, "97/119");
  assert.match(evidence?.stableSignal || "", /No significant change/i);
}

function assertAhrefsMetrics(evidence) {
  assert.equal(evidence?.type, "monitoring_evidence");
  assert.equal(metricByLabel(evidence, "Health Score")?.displayValue, "92");
  assert.equal(metricByLabel(evidence, "Errors")?.displayValue, "463 (+1)");
  assert.equal(metricByLabel(evidence, "Errors")?.delta, 1);
  assert.equal(metricByLabel(evidence, "Warnings")?.displayValue, "140");
  assert.equal(metricByLabel(evidence, "Notices")?.displayValue, "64 (−96)");
  assert.equal(metricByLabel(evidence, "Notices")?.delta, -96);
  assert.equal(metricByLabel(evidence, "Image file size too large")?.displayValue, "441 (+1)");
  assert.equal(metricByLabel(evidence, "Slow page")?.displayValue, "1 (+1)");
  assert.equal(metricByLabel(evidence, "No. of referring domains dropped")?.displayValue, "1 (+1)");
}

const route = read("routes/gmailWorkRequests.js");
const dispositions = read("routes/gmailDispositions.js");
const ui = read("shared/today-gmail-decisions.js");
const monitoringMigration = read("migrations/0014_gmail_monitoring_source_evidence.sql");
const monitoringSchemaGuard = read("shared/gmailMonitoringEvidenceSchema.js");

assert.equal(GMAIL_MONITORING_EVIDENCE_VERSION, "1.1.5");
assert.match(route, /Version: 1\.1\.2/);
assert.match(route, /classifyOperationalBacklogMessage/);
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

assert.match(dispositions, /Version: 1\.3\.3/);
assert.match(dispositions, /GMAIL_DISPOSITION_VERSION = "1\.3\.3"/);
assert.match(dispositions, /PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION = "preview-gmail-inbox"/);
assert.match(dispositions, /APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION = "approve-gmail-monitoring"/);
assert.match(dispositions, /HOLD_GMAIL_DECISION_ACTION = "hold-gmail-decision"/);
assert.match(dispositions, /ensureGmailMonitoringEvidenceSchema/);
assert.match(dispositions, /captureMonitoringSourceEvidence/);
assert.match(dispositions, /gmail_monitoring_evidence/);
assert.match(dispositions, /Universal Gmail source evidence:/);
assert.match(dispositions, /Structured source evidence:/);
assert.match(dispositions, /deletePendingMonitoringEvidence/);
assert.match(dispositions, /INSERT INTO activity_records/);
assert.match(dispositions, /D1 did not confirm the Monitoring record/);
assert.match(dispositions, /Monitoring requires a verified production client/);
assert.match(dispositions, /monitoringActivityCategory/);
assert.match(dispositions, /INSERT INTO decision_holds/);
assert.match(dispositions, /source_content/);
assert.match(dispositions, /workItemsCreated:0/);
assert.match(dispositions, /investigationsCreated:0/);
assert.match(dispositions, /ensureDecisionHoldSchema/);

const approvalBlock = dispositions.match(
  /async function approveMonitoringWithEvidence[\s\S]*?function monitoringActivityCategory/
)?.[0] || "";
assert.ok(approvalBlock, "Authoritative Monitoring approval block must exist");
assert.doesNotMatch(
  approvalBlock,
  /handleGmailAction\(body, env, requestId\)/,
  "Approved Monitoring must not be handed back to the legacy Gmail approval classifier"
);

assert.match(monitoringMigration, /CREATE TABLE IF NOT EXISTS gmail_monitoring_evidence/);
assert.match(monitoringMigration, /source_content TEXT NOT NULL/);
assert.match(monitoringMigration, /structured_evidence_json TEXT/);
assert.match(monitoringMigration, /activity_record_id INTEGER/);
assert.match(monitoringSchemaGuard, /ensureGmailMonitoringEvidenceSchema/);
assert.match(monitoringSchemaGuard, /CREATE TABLE IF NOT EXISTS gmail_monitoring_evidence/);

assert.match(ui, /Version: 1\.2\.1/);
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
assertSiteAuditMetrics(siteAuditEvidence);

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

const linkedSiteAuditMessage = {
  subject:siteAuditMessage.subject,
  date:siteAuditMessage.date,
  bodyText:`Site Audit
Project: [northfloridasafes.com](https://example.test/project)
Website URL: northfloridasafes.com
Date: Aug 21, 2026 (02:32:43)
We haven't detected any significant changes in your site's health since the previous audit.
We crawled only 97 out of 119 pages submitted in your sitemap.xml.
Site Health
[89%](https://example.test/health)
The Site Health Score is based on the number of errors and warnings found on your site.
Crawled Pages
[145](https://example.test/crawled)
[Healthy](https://example.test/healthy) 4
[Broken](https://example.test/broken) 0
[Have Issues](https://example.test/issues) 136
[Redirects](https://example.test/redirects) 5
[Blocked](https://example.test/blocked) 0
Errors
[0](https://example.test/errors) no change
Warnings
[687](https://example.test/warnings) no change
Notices
[484](https://example.test/notices) no change
Top Issues
[131 pages have a low text/HTML ratio](https://example.test/issue-1)
[18 pages have no meta description tag](https://example.test/issue-2)
[396 disallowed internal resources](https://example.test/issue-3)`
};

const linkedSiteAuditEvidence = extractMonitoringEvidence(linkedSiteAuditMessage);
assertSiteAuditMetrics(linkedSiteAuditEvidence);
assert.match(formatMonitoringEvidence(linkedSiteAuditEvidence), /Site Health 89%/);
assert.match(formatMonitoringEvidence(linkedSiteAuditEvidence), /Warnings 687/);
assert.match(formatMonitoringEvidence(linkedSiteAuditEvidence), /Reported Ratio 97\/119/);

const flattenedLinkedSiteAuditEvidence = extractMonitoringEvidence({
  ...linkedSiteAuditMessage,
  bodyText:linkedSiteAuditMessage.bodyText.replace(/\n+/g, " ")
});
assertSiteAuditMetrics(flattenedLinkedSiteAuditEvidence);
assert.match(formatMonitoringEvidence(flattenedLinkedSiteAuditEvidence), /Site Health 89%/);
assert.match(formatMonitoringEvidence(flattenedLinkedSiteAuditEvidence), /Crawled Pages 145/);
assert.match(formatMonitoringEvidence(flattenedLinkedSiteAuditEvidence), /Errors 0/);
assert.match(formatMonitoringEvidence(flattenedLinkedSiteAuditEvidence), /Warnings 687/);
assert.match(formatMonitoringEvidence(flattenedLinkedSiteAuditEvidence), /Notices 484/);

const ahrefsAuditMessage = {
  subject:"(Northfloridasafes) Image file size too large: 441 URLs",
  date:"Fri, 21 Aug 2026 02:20:13 +0000",
  bodyText:`20 August
New crawl for Northfloridasafes
168 internal URLs were analyzed.
Health Score
92
Health Score reflects the proportion of internal URLs on your site that don't have errors.
Issues
Errors 463 +1
Warnings 140
Notices 64 −96
What's new
Image file size too large 441 +1
Slow page New 1 +1
No. of referring domains dropped New 1 +1
View all issues`
};

const ahrefsEvidence = extractMonitoringEvidence(ahrefsAuditMessage);
assertAhrefsMetrics(ahrefsEvidence);
const ahrefsSummary = formatMonitoringEvidence(ahrefsEvidence);
assert.match(ahrefsSummary, /Health Score 92/);
assert.match(ahrefsSummary, /Errors 463 \(\+1\)/);
assert.match(ahrefsSummary, /Notices 64 \(−96\)/);
assert.match(ahrefsSummary, /Image file size too large 441 \(\+1\)/);
assert.match(ahrefsSummary, /Slow page 1 \(\+1\)/);
assert.match(ahrefsSummary, /No\. of referring domains dropped 1 \(\+1\)/);

const flattenedAhrefsEvidence = extractMonitoringEvidence({
  ...ahrefsAuditMessage,
  bodyText:ahrefsAuditMessage.bodyText.replace(/\n+/g, " ")
});
assertAhrefsMetrics(flattenedAhrefsEvidence);
assert.match(formatMonitoringEvidence(flattenedAhrefsEvidence), /Health Score 92/);
assert.match(formatMonitoringEvidence(flattenedAhrefsEvidence), /Image file size too large 441 \(\+1\)/);
assert.match(formatMonitoringEvidence(flattenedAhrefsEvidence), /Notices 64 \(−96\)/);

console.log("PASS Gmail operational intake preserves evidence and uses the authoritative Monitoring write path");
