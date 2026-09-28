/* =========================================================
   Global Concepts Media Operating System
   File: tests/prospectConceptTracking.test.js
   Version: 1.1.0
   Status: Regression Test
   Purpose: Lock privacy-minimized Agnor Aviation 90-day plan engagement tracking.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const route = fs.readFileSync(new URL("../routes/prospectConceptTracking.js", import.meta.url),"utf8");
const agnorPage = fs.readFileSync(new URL("../prospect-previews/agnor-aviation/index.html", import.meta.url),"utf8");
const honorPage = fs.readFileSync(new URL("../prospect-previews/honor-financial-group/index.html", import.meta.url),"utf8");

assert.match(route,/Version: 1\.0\.3/);
assert.match(route,/agnor-aviation-90-day-v1/);
assert.match(route,/businessName: "Agnor Aviation"/);
assert.match(route,/sourceReference: "\/prospect-previews\/agnor-aviation\/"/);
assert.match(route,/Agnor Aviation 90-day plan viewed/);

assert.match(agnorPage,/Version: 1\.0\.0/);
assert.match(agnorPage,/CONCEPT_KEY = "agnor-aviation-90-day-v1"/);
assert.match(agnorPage,/prospect-concept-view/);
assert.match(agnorPage,/gcm_preview/);
assert.match(agnorPage,/document\.visibilityState !== "visible"/);
assert.match(agnorPage,/sessionStorage\.getItem\(SESSION_KEY\)/);
assert.match(agnorPage,/agnor-aviation-test-site/);

assert.match(route,/honor-financial-group-october-dinner-v1/);
assert.match(route,/businessName: "Honor Financial Group"/);
assert.match(route,/Honor Financial Group campaign concept viewed/);
assert.match(honorPage,/Version: 1\.0\.0/);
assert.match(honorPage,/CONCEPT_KEY = "honor-financial-group-october-dinner-v1"/);
assert.match(honorPage,/prospect-concept-view/);
assert.match(honorPage,/gcm_preview/);
assert.match(honorPage,/513818/);
assert.match(honorPage,/Built around compliance/);

assert.doesNotMatch(route,/user[_-]?agent/i);
assert.doesNotMatch(route,/visitor[_-]?ip/i);

console.log("PASS tracked prospect concepts preserve privacy-minimized engagement for Agnor and Honor Financial Group");
