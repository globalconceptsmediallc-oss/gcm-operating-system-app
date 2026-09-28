/* =========================================================
   Global Concepts Media Operating System
   File: tests/prospectConceptTracking.test.js
   Version: 1.0.0
   Status: Regression Test
   Purpose: Lock privacy-minimized Agnor Aviation 90-day plan engagement tracking.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const route = fs.readFileSync(new URL("../routes/prospectConceptTracking.js", import.meta.url),"utf8");
const page = fs.readFileSync(new URL("../prospect-previews/agnor-aviation/index.html", import.meta.url),"utf8");

assert.match(route,/Version: 1\.0\.2/);
assert.match(route,/agnor-aviation-90-day-v1/);
assert.match(route,/businessName: "Agnor Aviation"/);
assert.match(route,/sourceReference: "\/prospect-previews\/agnor-aviation\/"/);
assert.match(route,/Agnor Aviation 90-day plan viewed/);

assert.match(page,/Version: 1\.0\.0/);
assert.match(page,/CONCEPT_KEY = "agnor-aviation-90-day-v1"/);
assert.match(page,/prospect-concept-view/);
assert.match(page,/gcm_preview/);
assert.match(page,/document\.visibilityState !== "visible"/);
assert.match(page,/sessionStorage\.getItem\(SESSION_KEY\)/);
assert.match(page,/agnor-aviation-test-site/);

assert.doesNotMatch(route,/user[_-]?agent/i);
assert.doesNotMatch(route,/visitor[_-]?ip/i);

console.log("PASS Agnor 90-day prospect page uses privacy-minimized tracked engagement");
