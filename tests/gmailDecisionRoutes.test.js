/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailDecisionRoutes.test.js
   Version: 1.0.2
   Status: Production Regression Test
   Purpose: Verify Morning Command can distinguish delete, information,
            monitoring, direct requested work, and investigation paths without
            inventing Work from informational mail.
   Change notes — 1.0.2:
   - Stops pinning Gmail behavior to the overall Worker file version; unrelated
     additive routes now carry their own tests and deployment verification.
   - Preserves every Gmail operator-decision regression assertion unchanged.
   Change notes — 1.0.1:
   - Stops pinning Gmail decision behavior to an unrelated shared-shell version.
   - Requires the shell to load the decision asset with the version declared by
     shared/today-gmail-decisions.js.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluateExplicitHumanWorkRequest } from "../routes/gmailWorkRequestIntelligence.js";

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

const worker = read("worker.js");
const workRoute = read("routes/gmailWorkRequests.js");
const dispositions = read("routes/gmailDispositions.js");
const todayDecisions = read("shared/today-gmail-decisions.js");
const shell = read("shared/gcm-shell.js");

assert.match(worker, /GMAIL_WORK_REQUEST_ACTIONS/);
assert.match(worker, /GMAIL_DISPOSITION_ACTIONS/);

assert.match(workRoute, /approve-gmail-work-request/);
assert.match(workRoute, /Communication plus one direct Work Item/i);
assert.match(workRoute, /investigationId:null/);
assert.match(workRoute, /markMessageRead/);

assert.match(dispositions, /delete-gmail-no-action/);
assert.match(dispositions, /\/trash`/);
assert.match(dispositions, /writesPerformed:0/);
assert.match(dispositions, /save-gmail-information/);
assert.match(dispositions, /createInvestigation:false/);
assert.match(dispositions, /createWorkItem:false/);

assert.match(todayDecisions, /Delete — No Action/);
assert.match(todayDecisions, /Keep as Information/);
assert.match(todayDecisions, /Save as Monitoring/);
assert.match(todayDecisions, /Create Requested Work/);
assert.match(todayDecisions, /Create Investigation/);

const decisionVersion = todayDecisions.match(/const FILE_VERSION = "([^"]+)";/)?.[1];
assert.ok(decisionVersion, "Today Gmail decision asset must declare FILE_VERSION");
assert.match(
  shell,
  new RegExp(`shared/today-gmail-decisions\\.js\\?v=${decisionVersion.replaceAll(".", "\\.")}`)
);

console.log("PASS Gmail operator decision routes");
