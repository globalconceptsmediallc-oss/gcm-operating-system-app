/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailBacklinkAuditInvestigation.test.js
   Version: 1.0.0
   Status: Regression Test
   Purpose: Lock the source-proven Backlink Audit boundary so named toxic
            domains create an Investigation candidate, not routine Monitoring.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";
import {
  extractBacklinkAuditEvidence,
  buildBacklinkAuditRecommendation
} from "../routes/gmailBacklinkAuditIntelligence.js";

const message = {
  subject:"Backlink Audit update of southfloridasafes.com. 2 New Toxic Domains; 3 New Trusted Domains",
  bodyText:[
    "Backlink Audit updates",
    "Project: southfloridasafes.com",
    "Audit date: Aug 23, 2026",
    "Hello! We have found 5 new referring domains. You have lost 0 domains. 4 domains are broken.",
    "2 New Toxic Domains",
    "Domain First Seen TS",
    "www.trendyhealthtimes.com Aug 4, 2026 61",
    "www.qwenterprise.com Aug 20, 2026 61",
    "3 New Trusted Domains",
    "themoverlist.com Aug 20, 2026 6",
    "gunmapusa.com Aug 21, 2026 6",
    "spiritquestarchery.com Aug 22, 2026 2"
  ].join("\n")
};

const evidence = extractBacklinkAuditEvidence(message);
assert.equal(evidence.toxicDomainCount, 2);
assert.equal(evidence.trustedDomainCount, 3);
assert.equal(evidence.newReferringDomains, 5);
assert.equal(evidence.lostDomains, 0);
assert.equal(evidence.brokenDomains, 4);
assert.deepEqual(evidence.toxicDomains, [
  { domain:"www.trendyhealthtimes.com", toxicScore:61 },
  { domain:"www.qwenterprise.com", toxicScore:61 }
]);

const recommendation = buildBacklinkAuditRecommendation({
  message,
  analysis:{ client:{ name:"South Florida Safes" } },
  decision:{
    recommendedRoutes:{
      saveCommunication:true,
      createInvestigation:true,
      createWorkItem:false,
      replyRequired:false
    }
  },
  classification:{
    notificationFamily:"SEMrush Backlink Audit",
    notificationType:"backlink_audit"
  }
});

assert.ok(recommendation);
assert.equal(recommendation.client, "South Florida Safes");
assert.equal(recommendation.shouldCreateCommunication, true);
assert.equal(recommendation.shouldCreateInvestigation, true);
assert.equal(recommendation.investigationCandidate, true);
assert.equal(recommendation.shouldCreateWorkItem, false);
assert.equal(recommendation.monitoringOnly, false);
assert.equal(recommendation.proposedRoute, "Investigation");
assert.match(recommendation.businessMeaning, /www\.trendyhealthtimes\.com \(TS 61\)/);
assert.match(recommendation.businessMeaning, /www\.qwenterprise\.com \(TS 61\)/);
assert.match(recommendation.recommendedAction, /Do not create corrective Work until the investigation/i);
assert.deepEqual(recommendation.sourceAnalysis.recommendedRoutes, {
  saveCommunication:true,
  createInvestigation:true,
  createWorkItem:false,
  replyRequired:false
});

const routine = buildBacklinkAuditRecommendation({
  message:{
    subject:"Backlink Audit update of southfloridasafes.com",
    bodyText:"Project: southfloridasafes.com\nWe have found 3 new referring domains. You have lost 0 domains."
  },
  analysis:{ client:{ name:"South Florida Safes" } },
  decision:{},
  classification:{ notificationFamily:"SEMrush Backlink Audit", notificationType:"backlink_audit" }
});
assert.equal(routine, null, "A backlink update without named toxic-domain evidence must remain on the existing calibration path.");

const wrapper = fs.readFileSync(new URL("../routes/gmailIntegration.js", import.meta.url), "utf8");
const legacy = fs.readFileSync(new URL("../routes/gmailIntegrationLegacy.js", import.meta.url), "utf8");
assert.match(wrapper, /Version: 1\.7\.1/);
assert.match(wrapper, /buildBacklinkAuditRecommendation/);
assert.match(wrapper, /handleCommitOperationalDecision/);
assert.match(wrapper, /workItemId:null/);
assert.match(legacy, /Version: 1\.7\.0/);
assert.match(legacy, /export const GMAIL_INTEGRATION_VERSION = "1\.7\.0"/);

console.log("PASS Gmail Backlink Audit: named South Florida toxic domains -> Investigation, no Work");
