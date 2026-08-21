/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailBacklogIntelligence.test.js
   Version: 1.1.0
   Status: Production Regression Test
   Sprint: Gmail — Evidence-Aware Operational Backlog
   Purpose:
   Lock the rule that measurable report labels do not become Investigations
   unless the live source explicitly proves an operational failure, while
   source-proven corrective obligations may become direct Work.

   Change notes — 1.1.0:
   - Reproduces the live Merchant Center missing-price alert.
   - Requires Merchant Center ID 5325664516 to resolve to Southeast Safes.
   - Requires a quantified, explicitly named corrective issue to route to Work,
     not vague Decision Hold or Investigation Review.
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

const merchantCenterWork = classifyOperationalBacklogMessage({
  gmailMessageId:"merchant-price-1",
  threadId:"merchant-price-1",
  from:"Google Merchant Center <googlebase-noreply@google.com>",
  to:"GlobalConceptsMediaLLC@gmail.com",
  subject:"Action required: Fix your product issues",
  date:"Fri, 21 Aug 2026 12:15:21 -0700",
  snippet:"Make these updates to get all of your products on Google.",
  bodyText:`Merchant Center ID: 5325664516
Action needed to show products
Some of your products aren’t showing on Google
Make these updates to get all of your products on Google.
Fixes to make now
4 products have the issue: Missing product price
+2 potential clicks per week`,
  labels:["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]
});

assert.equal(merchantCenterWork.intelligence.client, "Southeast Safes");
assert.equal(merchantCenterWork.intelligence.proposedRoute, "Requested Work");
assert.equal(merchantCenterWork.intelligence.shouldCreateWorkItem, true);
assert.equal(merchantCenterWork.intelligence.investigationCandidate, false);
assert.equal(merchantCenterWork.intelligence.monitoringOnly, false);
assert.equal(merchantCenterWork.intelligence.operationalPriority, "Medium");
assert.match(merchantCenterWork.intelligence.businessMeaning, /4 products affected by “Missing product price”/i);
assert.match(merchantCenterWork.intelligence.businessMeaning, /2 potential additional clicks per week/i);
assert.match(merchantCenterWork.intelligence.recommendedAction, /Correct SES Missing product price on 4 products/i);

console.log("gmailBacklogIntelligence.test.js passed");
