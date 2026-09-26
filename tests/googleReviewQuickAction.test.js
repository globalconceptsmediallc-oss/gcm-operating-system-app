/* =========================================================
   Global Concepts Media Operating System
   File: tests/googleReviewQuickAction.test.js
   Version: 1.0.8
   Status: Regression Test
   Purpose:
   Lock routine Google Business Profile reviews to the compact reply/count flow.
   Routine reviews, including notifications with no parseable rating, must not create
   Findings, Communications, Investigations, Work Items, or Proof rows. Explicitly low-rated reviews retain the full-review path.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const config = fs.readFileSync(new URL("../shared/config.js", import.meta.url),"utf8");
const worker = fs.readFileSync(new URL("../worker.js", import.meta.url),"utf8");
const route = fs.readFileSync(new URL("../routes/googleReviewQuickAction.js", import.meta.url),"utf8");
const ui = fs.readFileSync(new URL("../shared/today-email-intake.js", import.meta.url),"utf8");

assert.match(config,/GOOGLE_REVIEW_QUICK_ACTION:\s*"google-review-quick-action"/);
assert.match(worker,/handleGoogleReviewQuickAction/);
assert.match(worker,/googleReviewQuickActionVersion:\s*GOOGLE_REVIEW_QUICK_ACTION_VERSION/);
assert.match(worker,/case ACTIONS\.GOOGLE_REVIEW_QUICK_ACTION:/);

assert.match(route,/Version: 1\.0\.2/);
assert.match(route,/CLASSIFICATION_SOURCE = "google_review_quick_action"/);
assert.match(route,/operation === "get_month_count"/);
assert.match(route,/operation !== "count_and_close"/);
assert.match(route,/metric:"monthly_review_count"/);
assert.match(route,/responded:true/);
assert.match(route,/disposition = 'monitoring'/);
assert.match(route,/findingCreated:false/);
assert.match(route,/communicationCreated:false/);
assert.match(route,/activityRecordCreated:false/);
assert.match(route,/investigationCreated:false/);
assert.match(route,/workItemCreated:false/);
assert.doesNotMatch(route,/INSERT INTO client_findings/i);
assert.doesNotMatch(route,/INSERT INTO communications/i);
assert.doesNotMatch(route,/INSERT INTO investigations/i);
assert.doesNotMatch(route,/INSERT INTO work_items/i);
assert.doesNotMatch(route,/INSERT INTO activity_records/i);

assert.match(ui,/Version: 2\.6\.0/);
assert.match(ui,/left a review for/);
assert.match(ui,/Quick Action/);
assert.match(ui,/Open Review/);
assert.match(ui,/Mark Responded &amp; Count Review/);
assert.match(ui,/get_month_count/);
assert.match(ui,/count_and_close/);
assert.match(ui,/cleanupProcessedIntake/);
assert.match(ui,/operation:"trash_intake"/);
assert.match(ui,/Only the monthly count is preserved as the business metric/);
assert.match(ui,/No Finding, Communication, Investigation, Work Item, or Proof record will be created/);
assert.match(ui,/function isRoutineGoogleReview\(review\)/);
assert.match(ui,/review\.rating === 0 \|\| review\.rating >= 4/);
assert.match(ui,/Use Full Review/);
assert.match(ui,/forceStandard:true/);

console.log("PASS Google review quick action: routine reviews use suggested response/open/count; explicit low ratings remain full review");
