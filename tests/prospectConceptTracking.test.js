/* =========================================================
   Global Concepts Media Operating System
   File: tests/prospectConceptTracking.test.js
   Version: 1.5.0
   Status: Regression Test
   Purpose: Lock privacy-minimized Agnor Aviation 90-day plan engagement tracking.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const route = fs.readFileSync(new URL("../routes/prospectConceptTracking.js", import.meta.url),"utf8");
const agnorPage = fs.readFileSync(new URL("../prospect-previews/agnor-aviation/index.html", import.meta.url),"utf8");
const honorPage = fs.readFileSync(new URL("../prospect-previews/honor-financial-group/index.html", import.meta.url),"utf8");
const kitchenSaverPage = fs.readFileSync(new URL("../prospect-previews/kitchen-saver/index.html", import.meta.url),"utf8");
const mcphersonPage = fs.readFileSync(new URL("../prospect-previews/mcpherson-financial-group/index.html", import.meta.url),"utf8");
const wadadliPage = fs.readFileSync(new URL("../prospect-previews/wadadli-financial-group/index.html", import.meta.url),"utf8");
const corvexPage = fs.readFileSync(new URL("../prospect-previews/corvex-roofing/index.html", import.meta.url),"utf8");

assert.match(route,/Version: 1\.0\.7/);
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

assert.match(route,/kitchen-saver-melbourne-mailer-v1/);
assert.match(route,/businessName: "Kitchen Saver"/);
assert.match(route,/Kitchen Saver Melbourne campaign concept viewed/);
assert.match(kitchenSaverPage,/Version: 1\.0\.0/);
assert.match(kitchenSaverPage,/CONCEPT_KEY = "kitchen-saver-melbourne-mailer-v1"/);
assert.match(kitchenSaverPage,/prospect-concept-view/);
assert.match(kitchenSaverPage,/gcm_preview/);
assert.match(kitchenSaverPage,/Melbourne \/ Brevard campaign destination/);
assert.match(kitchenSaverPage,/\$3,000 OFF/);

assert.match(route,/mcpherson-financial-group-lunch-v1/);
assert.match(route,/businessName: "McPherson Financial Group"/);
assert.match(route,/McPherson Financial Group campaign concept viewed/);
assert.match(mcphersonPage,/Version: 1\.0\.0/);
assert.match(mcphersonPage,/CONCEPT_KEY = "mcpherson-financial-group-lunch-v1"/);
assert.match(mcphersonPage,/prospect-concept-view/);
assert.match(mcphersonPage,/gcm_preview/);
assert.match(mcphersonPage,/4129359/);
assert.match(mcphersonPage,/Financial-services compliance stays in control/);

assert.match(route,/wadadli-financial-group-dinner-v1/);
assert.match(route,/businessName: "Wadadli Financial Group"/);
assert.match(route,/Wadadli Financial Group campaign concept viewed/);
assert.match(wadadliPage,/Version: 1\.0\.0/);
assert.match(wadadliPage,/CONCEPT_KEY = "wadadli-financial-group-dinner-v1"/);
assert.match(wadadliPage,/prospect-concept-view/);
assert.match(wadadliPage,/gcm_preview/);
assert.match(wadadliPage,/513052/);
assert.match(wadadliPage,/Financial-services compliance stays in control/);

assert.match(route,/corvex-roofing-321-living-v1/);
assert.match(route,/businessName: "Corvex Roofing"/);
assert.match(route,/Corvex Roofing 321 Living campaign concept viewed/);
assert.match(corvexPage,/Version: 1\.0\.0/);
assert.match(corvexPage,/CONCEPT_KEY = "corvex-roofing-321-living-v1"/);
assert.match(corvexPage,/prospect-concept-view/);
assert.match(corvexPage,/gcm_preview/);
assert.match(corvexPage,/321 Living/);
assert.match(corvexPage,/Free roof readiness assessment/);

assert.doesNotMatch(route,/user[_-]?agent/i);
assert.doesNotMatch(route,/visitor[_-]?ip/i);

console.log("PASS tracked prospect concepts preserve privacy-minimized engagement for Agnor, Honor Financial Group, Kitchen Saver, McPherson Financial Group, Wadadli Financial Group, and Corvex Roofing");
