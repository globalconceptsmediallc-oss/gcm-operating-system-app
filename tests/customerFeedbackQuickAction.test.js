/* =========================================================
   Global Concepts Media Operating System
   File: tests/customerFeedbackQuickAction.test.js
   Version: 1.0.0
   Status: Regression Test
   Purpose: Lock the compact customer-feedback quick-action UI and its no-downstream-write boundary.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const config = fs.readFileSync(new URL("../shared/config.js", import.meta.url),"utf8");
const worker = fs.readFileSync(new URL("../worker.js", import.meta.url),"utf8");
const route = fs.readFileSync(new URL("../routes/googleReviewQuickAction.js", import.meta.url),"utf8");
const ui = fs.readFileSync(new URL("../shared/today-email-intake.js", import.meta.url),"utf8");

assert.match(config,/GOOGLE_REVIEW_QUICK_ACTION:\s*"google-review-quick-action"/);
assert.match(worker,/handleGoogleReviewQuickAction/);
assert.match(route,/CLASSIFICATION_SOURCE = "google_review_quick_action"/);
assert.match(route,/findingCreated:false/);
assert.match(route,/communicationCreated:false/);
assert.match(route,/activityRecordCreated:false/);
assert.match(route,/investigationCreated:false/);
assert.match(route,/workItemCreated:false/);

assert.match(ui,/Version: 2\.3\.0/);
assert.match(ui,/data-gcm-review-response/);
assert.match(ui,/buildGoogleReviewSuggestedResponse/);
assert.match(ui,/Open Review/);
assert.match(ui,/Mark Responded &amp; Count Review/);
assert.match(ui,/Use Full Review/);

console.log("PASS customer feedback quick action UI and write boundary");
