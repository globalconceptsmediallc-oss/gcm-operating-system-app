/* =========================================================
   Global Concepts Media Operating System
   File: tests/prospectCallTalkingPoints.test.js
   Version: 1.0.0
   Status: Production Regression Lock
   Purpose: Lock proposal-based, evidence-grounded Prospect call prep.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

const page=fs.readFileSync("prospects.html","utf8");
assert.match(page,/Version: 3\.4\.0/);
assert.match(page,/Call Talking Points/);
assert.match(page,/data-prospect-action="call-points"/);
assert.match(page,/function openCallTalkingPoints\(p\)/);
assert.match(page,/activityType==="concept_page_view"/);
assert.match(page,/does not prove who physically viewed the page/);
assert.match(page,/function prospectCallQuestions\(p,proposal\)/);
assert.match(page,/function prospectCallGoal\(p\)/);
assert.match(page,/Copy Talking Points/);
console.log("PASS Prospect Call Talking Points is proposal-based and evidence-grounded.");
