/* =========================================================
   Global Concepts Media Operating System
   File: tests/prospectTestSiteUrl.test.js
   Version: 1.0.4
   Change Notes — 1.0.4: Repair preview URL assertions with direct source-string checks.
   Change Notes — 1.0.3: Operator preview bypass regression aligned with Prospects 3.9.4.
   Status: Production Regression Lock
   Purpose: Lock durable Prospect test-site URL storage and direct UI access.
   Change notes — 1.0.1:
   - Aligns the Prospect CRM lock to current production 1.7.0.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

const crm = fs.readFileSync("routes/prospectCrm.js", "utf8");
const ui = fs.readFileSync("prospects.html", "utf8");
const migration = fs.readFileSync("migrations/0024_prospect_test_site_url.sql", "utf8");

assert.match(migration, /ALTER TABLE crm_prospects ADD COLUMN test_site_url TEXT;/);
assert.match(crm, /PROSPECT_CRM_VERSION = "1\.7\.0"/);
assert.match(crm, /testSiteUrl: row\.test_site_url \|\| null/);
assert.match(crm, /test_site_url = \?/);
assert.match(crm, /testSiteUrl: normalizeOptionalHttpUrl/);
assert.match(ui, /Test Site<\/a>/);
assert.match(ui, /data-prospect-action="test-site"/);
assert.equal(ui.split("internalTestSiteUrl(p.testSiteUrl)").length-1,2);
assert.ok(ui.includes('url.searchParams.set("gcm_preview","1")'));

assert.match(ui, /update_prospect",\{prospectId:p\.id,testSiteUrl:/);

console.log("PASS Prospect test-site URL is durable and directly accessible.");
