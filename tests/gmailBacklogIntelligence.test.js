/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailBacklogIntelligence.test.js
   Version: 1.0.0
   Status: Production Regression Test
   Sprint: Gmail — Evidence-Aware Operational Backlog
   Purpose:
   Lock the rule that measurable report labels do not become Investigations
   unless the live source explicitly proves an operational failure.
   ========================================================= */

import assert from "node:assert/strict";
import {
  GMAIL_BACKLOG_INTELLIGENCE_VERSION,
  classifyOperationalBacklogMessage,
  inferOperationalClient
} from "../routes/gmailBacklogIntelligence.js";

assert.equal(GMAIL_BACKLOG_INTELLIGENCE_VERSION, "1.0.0");

const northFlorida = classifyOperationalBacklogMessage({
  gmailMessageId:"nfs-ahrefs-1",
  threadId:"nfs-ahrefs-1",
  from:"Ahrefs Site Audit <sa@ahrefs.com>",
  to:"globalconceptsmediallc@gmail.com",
  subject:"(Northfloridasafes) Image file size too large: 441 URLs",
  date:"Fri, 21 Aug 2026 02:20:13 +0000",
  snippet:"168 internal URLs were analyzed. Health Score 92 · Errors 463 (+1) · Warnings 140 · Notices 64 (−96)",
  bodyText:`New crawl for Northfloridasafes
168 internal URLs were analyzed.
Health Score
92
Issues
Errors 463 +1
Warnings 140
Notices 64 −96
What's new
Image file size too large 441 +1
Slow page New 1 +1
No. of referring domains dropped New 1 +1`,
  labels:["UNREAD","REPORTS-SEO"]
});

assert.equal(northFlorida.intelligence.client, "North Florida Safes");
assert.equal(northFlorida.intelligence.proposedRoute, "Monitoring Review");
assert.equal(northFlorida.intelligence.monitoringOnly, true);
assert.equal(northFlorida.intelligence.investigationCandidate, false);
assert.match(northFlorida.intelligence.businessMeaning, /Health Score 92/i);
assert.match(northFlorida.intelligence.businessMeaning, /Errors 463/i);
assert.match(northFlorida.intelligence.recommendedAction, /Save these exact source-grounded measurements as Monitoring/i);

assert.deepEqual(
  inferOperationalClient("Northfloridasafes new crawl"),
  { name:"North Florida Safes", code:"NFS" }
);

const newsletter = classifyOperationalBacklogMessage({
  gmailMessageId:"newsletter-1",
  from:"Semrush <news@team.semrush.com>",
  subject:"More citations aren’t always better",
  bodyText:"New data on traffic, citations, and authority",
  labels:["UNREAD"]
});

assert.equal(newsletter.intelligence.client, "Unassigned — Human Review");
assert.notEqual(newsletter.intelligence.proposedRoute, "Monitoring Review");
assert.equal(newsletter.intelligence.monitoringOnly, false);
assert.equal(newsletter.intelligence.investigationCandidate, false);

const provenFailure = classifyOperationalBacklogMessage({
  gmailMessageId:"hbg-failure-1",
  from:"alerts@example.com",
  subject:"HB Guns tracking failed",
  bodyText:"HB Guns tracking is not firing and production measurement has dropped to zero traffic.",
  labels:["UNREAD"]
});

assert.equal(provenFailure.intelligence.client, "HB Guns");
assert.equal(provenFailure.intelligence.proposedRoute, "Investigation Review");
assert.equal(provenFailure.intelligence.investigationCandidate, true);
assert.equal(provenFailure.intelligence.monitoringOnly, false);

console.log("gmailBacklogIntelligence.test.js passed");
