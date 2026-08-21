/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailDecisionRoutes.test.js
   Version: 1.1.0
   Status: Production Regression Test
   Purpose: Verify Morning Command can distinguish delete, information,
            monitoring, Decision Hold / Work Lite, direct requested work, and
            investigation paths without inventing committed Work.
   Change notes — 1.1.0:
   - Proves explicit subject/business context outranks sender domain for client identity.
   - Proves a leadership follow-up can become a high-priority Decision Hold.
   - Proves a future requirement can become a low-priority Decision Hold with
     its real deadline rather than forcing immediate Work or Investigation.
   - Locks Hold for Review to 0 Work Items and 0 Investigations.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  evaluateExplicitHumanWorkRequest,
  inferClientFromText
} from "../routes/gmailWorkRequestIntelligence.js";
import {
  inferClientFromMessageContext,
  evaluateDecisionHold
} from "../shared/gmailDecisionHold.js";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const kristyGa4 = evaluateExplicitHumanWorkRequest({
  from:"Kristy Schirmer <kkpayne1@gmail.com>",
  subject:"GA4 tracking on SES broken?",
  bodyText:"Andy — I think GA4 tracking on SES broke around June 30/July 1. GA4 drops to zero and Realtime is not registering. Can you check the GA4/GTM implementation and see what changed around June 30 and whether the tag is still firing correctly?"
});

assert.equal(kristyGa4.candidate, true);
assert.equal(kristyGa4.client?.code, "SES");
assert.equal(kristyGa4.priority, "High");
assert.match(kristyGa4.action, /SES GA4\/GTM tracking/);
assert.equal(kristyGa4.decision?.recommendedRoutes?.saveCommunication, true);
assert.equal(kristyGa4.decision?.recommendedRoutes?.createWorkItem, true);
assert.equal(kristyGa4.decision?.recommendedRoutes?.createInvestigation, false);

const kristyFyi = evaluateExplicitHumanWorkRequest({
  from:"Kristy Schirmer <kkpayne1@gmail.com>",
  subject:"SES FYI",
  bodyText:"Just an FYI that the new product images are live on Southeast Safes. No action needed."
});
assert.equal(kristyFyi.candidate, false);

const promotion = evaluateExplicitHumanWorkRequest({
  from:"Vendor Marketing <offers@example.com>",
  subject:"Last chance — 25% off",
  bodyText:"Register now for the promotional offer."
});
assert.equal(promotion.candidate, false);

const frankFollowUpMessage = {
  from:"frank@sesafes.com",
  to:"Andy Belcher <globalconceptsmediallc@gmail.com>; james@hbguns.com",
  subject:"RE: HB Guns TV Tracking Pixel",
  bodyText:"Great. Thanks. Keep me posted on how it is working . . ."
};
const frankClient = inferClientFromMessageContext(
  frankFollowUpMessage,
  inferClientFromText
);
assert.equal(frankClient?.code, "HBG");
assert.equal(frankClient?.name, "HB Guns");

const frankHold = evaluateDecisionHold(
  frankFollowUpMessage,
  {
    client:"HB Guns",
    proposedRoute:"Human Review",
    communicationFamily:"Human — Leadership / Client Operations",
    archive:false,
    monitoringOnly:false,
    shouldCreateInvestigation:false,
    shouldCreateWorkItem:false
  },
  { clientName:"HB Guns", now:new Date("2026-08-20T20:00:00-04:00") }
);
assert.equal(frankHold.candidate, true);
assert.equal(frankHold.holdType, "follow_up");
assert.equal(frankHold.priority, "High");
assert.match(frankHold.question, /Frank/i);
assert.match(frankHold.suggestedNextAction, /Work Lite/i);

const merchantMessage = {
  from:"Google Merchant Center <googlebase-noreply@google.com>",
  subject:"New product image requirements for Southeast Safes",
  bodyText:"Merchant Center ID: 5325664516. Product images now must be at least 500 x 500 pixels. Starting January 31, 2027, the minimum size for product images will be 500 x 500 pixels."
};
const merchantClient = inferClientFromMessageContext(merchantMessage, inferClientFromText);
assert.equal(merchantClient?.code, "SES");

const merchantHold = evaluateDecisionHold(
  merchantMessage,
  {
    client:"Southeast Safes",
    proposedRoute:"Manual Review",
    archive:false,
    monitoringOnly:false,
    shouldCreateInvestigation:false,
    shouldCreateWorkItem:false
  },
  { clientName:"Southeast Safes", now:new Date("2026-08-20T20:00:00-04:00") }
);
assert.equal(merchantHold.candidate, true);
assert.equal(merchantHold.holdType, "decision_question");
assert.equal(merchantHold.priority, "Low");
assert.equal(merchantHold.dueDate, "2027-01-31");
assert.match(merchantHold.question, /already satisfy this requirement/i);

const worker = read("worker.js");
const workRoute = read("routes/gmailWorkRequests.js");
const dispositions = read("routes/gmailDispositions.js");
const todayDecisions = read("shared/today-gmail-decisions.js");
const shell = read("shared/gcm-shell.js");
const migration = read("migrations/0012_decision_holds.sql");

assert.match(worker, /GMAIL_WORK_REQUEST_ACTIONS/);
assert.match(worker, /GMAIL_DISPOSITION_ACTIONS/);

assert.match(workRoute, /approve-gmail-work-request/);
assert.match(workRoute, /Communication plus one direct Work Item/i);
assert.match(workRoute, /investigationId:null/);
assert.match(workRoute, /markMessageRead/);
assert.match(workRoute, /FROM decision_holds/);
assert.match(workRoute, /released/i);

assert.match(dispositions, /delete-gmail-no-action/);
assert.match(dispositions, /\/trash`/);
assert.match(dispositions, /writesPerformed:0/);
assert.match(dispositions, /save-gmail-information/);
assert.match(dispositions, /hold-gmail-decision/);
assert.match(dispositions, /INSERT INTO decision_holds/);
assert.match(dispositions, /workItemsCreated:0/);
assert.match(dispositions, /investigationsCreated:0/);
assert.match(dispositions, /markMessageRead/);
assert.match(dispositions, /markMessageUnread/);

assert.match(migration, /CREATE TABLE IF NOT EXISTS decision_holds/);
assert.match(migration, /source_content TEXT/);
assert.match(migration, /question TEXT NOT NULL/);
assert.match(migration, /due_date TEXT/);

assert.match(todayDecisions, /Delete — No Action/);
assert.match(todayDecisions, /Keep as Information/);
assert.match(todayDecisions, /Hold for Review/);
assert.match(todayDecisions, /Decision Holds · Work Lite/);
assert.match(todayDecisions, /Return to Morning Command/);
assert.match(todayDecisions, /Save as Monitoring/);
assert.match(todayDecisions, /Create Requested Work/);
assert.match(todayDecisions, /Create Investigation/);

const decisionVersion = todayDecisions.match(/const FILE_VERSION = "([^"]+)";/)?.[1];
assert.ok(decisionVersion, "Today Gmail decision asset must declare FILE_VERSION");
assert.match(
  shell,
  new RegExp(`shared/today-gmail-decisions\\.js\\?v=${decisionVersion.replaceAll(".", "\\.")}`)
);

console.log("PASS Gmail operator decisions include generic Decision Hold / Work Lite");
