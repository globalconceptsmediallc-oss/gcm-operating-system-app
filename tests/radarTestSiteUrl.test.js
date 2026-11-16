/* =========================================================
   Global Concepts Media Operating System
   File: tests/radarTestSiteUrl.test.js
   Version: 1.0.3
   Change Notes — 1.0.3: Repair preview URL assertions with direct source-string checks.
   Change Notes — 1.0.2: Operator preview bypass regression aligned with Prospects 3.9.4.
   Status: Production Regression Lock
   Purpose: Lock fast test-site access into the Radar / pre-appointment workflow.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

const crm=fs.readFileSync("routes/prospectCrm.js","utf8");
const page=fs.readFileSync("prospects.html","utf8");
const migration=fs.readFileSync("migrations/0025_radar_test_site_url.sql","utf8");

assert.match(migration,/ALTER TABLE crm_prospect_radar ADD COLUMN test_site_url TEXT;/);
assert.match(crm,/PROSPECT_CRM_VERSION = "1\.7\.0"/);
assert.match(crm,/testSiteUrl: row\.test_site_url \|\| null/);
assert.match(crm,/radar\.testSiteUrl/);
assert.match(page,/id="radar-test-site-top"/);
assert.match(page,/Open Test Site/);
assert.ok(page.includes("function internalTestSiteUrl(value)"));
assert.ok(page.includes('url.searchParams.set("gcm_preview","1")'));
assert.ok(page.includes('window.open(internalTestSiteUrl(r.testSiteUrl)'));
const start=page.indexOf("  function internalTestSiteUrl(value){");
const end=page.indexOf("  function hostname(v)",start);
assert.ok(start>0&&end>start,"Operator preview helper must be present");
const helper=page.slice(start,end);
const preview=new Function("normalizeUrl",helper+"return internalTestSiteUrl;")(v=>String(v||""));
const publicUrl="https://globalconceptsmediallc-oss.github.io/gcm-operating-system-app/prospect-previews/corvex-roofing/?utm_source=chatgpt.com#hero";
const result=new URL(preview(publicUrl));
assert.equal(result.searchParams.get("gcm_preview"),"1");
assert.equal(result.searchParams.get("utm_source"),"chatgpt.com");
assert.equal(result.hash,"#hero");
assert.equal(publicUrl.includes("gcm_preview"),false,"Public record URL unchanged");
assert.equal(new URL(preview(preview(publicUrl))).searchParams.getAll("gcm_preview").length,1);

assert.match(page,/function editRadarTestSite\(r\)/);
assert.match(page,/update_radar",\{radarId:r\.id,testSiteUrl:/);

console.log("PASS Radar test-site URL is durable, top-level, and carries into formal Prospect.");
