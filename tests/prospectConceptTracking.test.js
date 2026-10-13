/* =========================================================
   Global Concepts Media Operating System
   File: tests/prospectConceptTracking.test.js
   Version: 1.11.0
   Status: Regression Test
   Purpose: Lock privacy-minimized prospect engagement tracking, including Barkingham Palace.
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
const leonardPage = fs.readFileSync(new URL("../prospect-previews/leonard-financial-group/index.html", import.meta.url),"utf8");
const rollingSudsPage = fs.readFileSync(new URL("../prospect-previews/rolling-suds-melbourne-palm-bay/index.html", import.meta.url),"utf8");
const windowWorldPage = fs.readFileSync(new URL("../prospect-previews/window-world-space-coast/index.html", import.meta.url),"utf8");
const geoNestPage = fs.readFileSync(new URL("../prospect-previews/geonest-windows-refresh/index.html", import.meta.url),"utf8");
const indianRiverPage = fs.readFileSync(new URL("../prospect-previews/indian-river-furniture/index.html", import.meta.url),"utf8");
const barkinghamPage = fs.readFileSync(new URL("../prospect-previews/barkingham-palace/index.html", import.meta.url),"utf8");

assert.match(route,/Version: 1\.1\.5/);
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

assert.match(route,/leonard-financial-group-321-living-v1/);
assert.match(route,/businessName: "Leonard Financial Group"/);
assert.match(route,/Leonard Financial Group 321 Living campaign concept viewed/);
assert.match(leonardPage,/Version: 1\.0\.0/);
assert.match(leonardPage,/CONCEPT_KEY = "leonard-financial-group-321-living-v1"/);
assert.match(leonardPage,/prospect-concept-view/);
assert.match(leonardPage,/gcm_preview/);
assert.match(leonardPage,/321 Living/);
assert.match(leonardPage,/Financial-services compliance stays in control/);

assert.match(route,/rolling-suds-melbourne-palm-bay-commercial-v1/);
assert.match(route,/businessNamePrefix: "Rolling Suds of Melbourne"/);
assert.match(route,/Rolling Suds commercial growth concept viewed/);
assert.match(rollingSudsPage,/Version: 1\.0\.0/);
assert.match(rollingSudsPage,/rolling-suds-melbourne-palm-bay-commercial-v1/);
assert.match(rollingSudsPage,/prospect-concept-view/);
assert.match(rollingSudsPage,/gcm_preview/);
assert.match(rollingSudsPage,/property managers/);
assert.match(rollingSudsPage,/90-day test/);

assert.match(route,/window-world-space-coast-direct-mail-v1/);
assert.match(route,/businessNamePrefix: "Window World"/);
assert.match(route,/Window World Space Coast direct-mail growth concept viewed/);
assert.match(windowWorldPage,/Version: 1\.0\.0/);
assert.match(windowWorldPage,/window-world-space-coast-direct-mail-v1/);
assert.match(windowWorldPage,/prospect-concept-view/);
assert.match(windowWorldPage,/gcm_preview/);
assert.match(windowWorldPage,/\$947/);
assert.match(windowWorldPage,/15 months/);
assert.match(windowWorldPage,/My Safe Florida Home/);

assert.match(route,/geonest-windows-refresh-lead-to-install-v1/);
assert.match(route,/businessName: "GeoNest, Inc. \/ Windows Refresh"/);
assert.match(route,/sourceReference: "\/prospect-previews\/geonest-windows-refresh\/"/);
assert.match(route,/GeoNest Windows Refresh concept viewed/);
assert.match(geoNestPage,/Version: 1\.0\.1/);
assert.match(geoNestPage,/CONCEPT_KEY = "geonest-windows-refresh-lead-to-install-v1"/);
assert.match(geoNestPage,/prospect-concept-view/);
assert.match(geoNestPage,/gcm_preview/);
assert.match(geoNestPage,/document\.visibilityState !== "visible"/);
assert.match(geoNestPage,/sessionStorage\.getItem\(SESSION_KEY\)/);
assert.match(geoNestPage,/windowrefresh\.com/);
assert.match(geoNestPage,/90-day measurement pilot/);
assert.doesNotMatch(geoNestPage,/431 Vizcaya|geonest1\.com|q9wioy|626-3807/);

assert.match(route,/indian-river-furniture-mailer-to-showroom-v1/);
assert.match(route,/businessName: "Indian River Furniture"/);
assert.match(route,/sourceReference: "\/prospect-previews\/indian-river-furniture\/"/);
assert.match(route,/Indian River Furniture direct-mail growth concept viewed/);
assert.match(indianRiverPage,/Version: 1\.0\.0/);
assert.match(indianRiverPage,/CONCEPT_KEY = "indian-river-furniture-mailer-to-showroom-v1"/);
assert.match(indianRiverPage,/prospect-concept-view/);
assert.match(indianRiverPage,/gcm_preview/);
assert.match(indianRiverPage,/document\.visibilityState !== "visible"/);
assert.match(indianRiverPage,/sessionStorage\.getItem\(SESSION_KEY\)/);
assert.match(indianRiverPage,/Bassett/);
assert.match(indianRiverPage,/Stressless/);
assert.match(indianRiverPage,/August 31, 2026/);
assert.match(indianRiverPage,/90 days to make the next mailer more accountable/);
assert.doesNotMatch(indianRiverPage,/431 Vizcaya|32940-1833|Teresa S Belcher/);

assert.match(route,/barkingham-palace-free-day-loyal-customer-v1/);
assert.match(route,/businessName: "Barkingham Palace"/);
assert.match(route,/sourceReference: "\/prospect-previews\/barkingham-palace\/"/);
assert.match(route,/Barkingham Palace free-day growth concept viewed/);
assert.match(barkinghamPage,/Version: 1\.0\.0/);
assert.match(barkinghamPage,/CONCEPT_KEY = "barkingham-palace-free-day-loyal-customer-v1"/);
assert.match(barkinghamPage,/prospect-concept-view/);
assert.match(barkinghamPage,/gcm_preview/);
assert.match(barkinghamPage,/document\.visibilityState !== "visible"/);
assert.match(barkinghamPage,/sessionStorage\.getItem\(SESSION_KEY\)/);
assert.match(barkinghamPage,/FREE DAY/);
assert.match(barkinghamPage,/Barkingham Palace/);
assert.match(barkinghamPage,/90-day new-customer measurement pilot/);
assert.doesNotMatch(barkinghamPage,/431 Vizcaya|32940-1833|Teresa S Belcher/);

assert.doesNotMatch(route,/user[_-]?agent/i);
assert.doesNotMatch(route,/visitor[_-]?ip/i);

console.log("PASS tracked prospect concepts preserve privacy-minimized engagement for Agnor, Honor Financial Group, Kitchen Saver, McPherson Financial Group, Wadadli Financial Group, Corvex Roofing, Leonard Financial Group, Rolling Suds, Window World Space Coast, GeoNest Windows Refresh, Indian River Furniture, and Barkingham Palace");
