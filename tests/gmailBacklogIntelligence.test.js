/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailBacklogIntelligence.test.js
   Version: 1.2.0
   Status: Production Regression Test
   Sprint: Gmail — Evidence-Aware Operational Backlog
   Purpose:
   Lock the rule that measurable report labels do not become Investigations
   unless the live source explicitly proves an operational failure, while
   source-proven corrective obligations may become direct Work.

   Change notes — 1.2.0:
   - Reproduces the live South Florida Safes Backlink Audit inside the actual
     operational-backlog classifier used by Morning Command.
   - Requires two named adverse referring domains with TS 61 to surface as an
     Investigation candidate, never Manual Review, Monitoring, or Work.
   - Preserves every prior Site Audit/Ahrefs, Merchant Center, and failure rule.

   Change notes — 1.1.1:
   - Synchronizes the Merchant Center Recommended Action assertion with the
     source-proven Work v1.1.1 operator wording already used in production.
   - Preserves the same client, Work routing, business meaning, impact, and
     no-Investigation requirements; this is a stale test-text correction only.

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

assert.equal(GMAIL_BACKLOG_INTELLIGENCE_VERSION, "1.1.0");

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
assert.match(merchantCenterWork.intelligence.recommendedAction, /Identify the 4 Southeast Safes products affected by “Missing product price”/i);
assert.match(merchantCenterWork.intelligence.recommendedAction, /verify the alert clears/i);

const southFloridaBacklink = classifyOperationalBacklogMessage({
  gmailMessageId:"1a0344d80dfc3634",
  threadId:"1a0344d80dfc3634",
  from:"Semrush Backlink Audit <backlink.audit@semrush.com>",
  to:"Andrew Belcher <globalconceptsmediallc@gmail.com>",
  subject:"Backlink Audit update of southfloridasafes.com. 2 New Toxic Domains; 3 New Trusted Domains",
  date:"Mon, 24 Aug 2026 15:04:48 +0000",
  snippet:"Backlink Audit updates Project: southfloridasafes.com. We have found 5 new referring domains. You have lost 0 domains. 4 domains are broken.",
  bodyText:`Backlink Audit updates
Project: southfloridasafes.com
Audit date: Aug 23, 2026
We have found 5 new referring domains. You have lost 0 domains. 4 domains are broken.
2 New Toxic Domains
Domain First Seen TS
[www.trendyhealthtimes.com](https://l.semrush.com/example-one) Aug 4, 2026 61
[www.qwenterprise.com](https://l.semrush.com/example-two) Aug 20, 2026 61
Review toxic domains
3 New Trusted Domains
Domain First Seen AS
[themoverlist.com](https://l.semrush.com/trusted-one) Aug 21, 2026 6
[gunmapusa.com](https://l.semrush.com/trusted-two) Jul 30, 2026 6
[spiritquestarchery.com](https://l.semrush.com/trusted-three) Aug 14, 2026 2`,
  labels:["IMPORTANT","CATEGORY_UPDATES","INBOX"]
});

assert.equal(southFloridaBacklink.intelligence.client, "South Florida Safes");
assert.equal(southFloridaBacklink.intelligence.notificationType, "backlink_audit");
assert.equal(southFloridaBacklink.intelligence.proposedRoute, "Investigation");
assert.equal(southFloridaBacklink.intelligence.shouldCreateCommunication, true);
assert.equal(southFloridaBacklink.intelligence.shouldCreateInvestigation, true);
assert.equal(southFloridaBacklink.intelligence.investigationCandidate, true);
assert.equal(southFloridaBacklink.intelligence.shouldCreateWorkItem, false);
assert.equal(southFloridaBacklink.intelligence.monitoringOnly, false);
assert.match(southFloridaBacklink.intelligence.businessMeaning, /www\.trendyhealthtimes\.com \(TS 61\)/i);
assert.match(southFloridaBacklink.intelligence.businessMeaning, /www\.qwenterprise\.com \(TS 61\)/i);
assert.match(southFloridaBacklink.intelligence.recommendedAction, /Create an Investigation/i);
assert.match(southFloridaBacklink.snippet, /www\.trendyhealthtimes\.com · TS 61/i);
assert.match(southFloridaBacklink.snippet, /www\.qwenterprise\.com · TS 61/i);

console.log("gmailBacklogIntelligence.test.js passed");
