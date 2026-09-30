/* =========================================================
   Global Concepts Media Operating System
   File: tests/radarTestSiteUrl.test.js
   Version: 1.0.0
   Status: Production Regression Lock
   Purpose: Lock fast test-site access into the Radar / pre-appointment workflow.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

const crm=fs.readFileSync("routes/prospectCrm.js","utf8");
const page=fs.readFileSync("prospects.html","utf8");
const migration=fs.readFileSync("migrations/0025_radar_test_site_url.sql","utf8");

assert.match(migration,/ALTER TABLE crm_prospect_radar ADD COLUMN test_site_url TEXT;/);
assert.match(crm,/PROSPECT_CRM_VERSION = "1\.5\.0"/);
assert.match(crm,/testSiteUrl: row\.test_site_url \|\| null/);
assert.match(crm,/radar\.testSiteUrl/);
assert.match(page,/id="radar-test-site-top"/);
assert.match(page,/Open Test Site/);
assert.match(page,/function editRadarTestSite\(r\)/);
assert.match(page,/update_radar",\{radarId:r\.id,testSiteUrl:/);

console.log("PASS Radar test-site URL is durable, top-level, and carries into formal Prospect.");
