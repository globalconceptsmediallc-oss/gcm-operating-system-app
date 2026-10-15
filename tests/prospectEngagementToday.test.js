/* =========================================================
   Global Concepts Media Operating System
   File: tests/prospectEngagementToday.test.js
   Version: 1.4.0
   Status: Regression Test
   Purpose: Lock Today visibility for privacy-minimized tracked prospect opens.
   Change notes — 1.4.0:
   - Closed / Archived Radar engagement omitted from live Today count.
   - Promoted Radar excluded while active formal Prospect remains visible.
   - Disposable SQLite regression confirms source activity history survives.

   Change notes — 1.3.0:
   - Held Radar and formal Prospect relationships must not create current Today engagement attention.
   - Engagement evidence remains durable in CRM history.

   Change notes — 1.2.2:
   - Removes the stale 3.5.x Today minor-version dependency.
   - Keeps this regression test focused on Prospect Engagement behavior across current Today 3.x releases.

   Change notes — 1.2.1:
   - Replaces the stale exact Today page lock with the 3.5.x release-family contract.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

const route = fs.readFileSync(new URL("../routes/missionControl.js", import.meta.url),"utf8");
const today = fs.readFileSync(new URL("../today.html", import.meta.url),"utf8");

assert.match(route,/Version: 7\.8\.5/);
assert.match(route,/loadRecentProspectEngagements/);
assert.match(route,/activity_type = 'concept_page_view'/);
assert.match(route,/datetime\('now', '-7 days'\)/);
assert.match(route,/LOWER\(COALESCE\(r\.status, 'radar'\)\) <> 'nurture'/);
assert.match(route,/LOWER\(COALESCE\(p\.status, 'active'\)\) <> 'nurture'/);
assert.match(route,/AND r\.archived_at IS NULL/);
assert.match(route,/AND r\.promoted_prospect_id IS NULL/);
assert.match(route,/recentProspectEngagements/);
assert.match(route,/businessName/);
assert.match(route,/viewedAt/);
assert.match(route,/contactName/);
assert.match(route,/contactEmail/);

assert.match(today,/Version: 3\.\d+\.\d+/);
assert.match(today,/id="prospect-open-panel"/);
assert.match(today,/id="prospect-open-list"/);
assert.match(today,/id="prospect-open-title"/);
assert.match(today,/renderProspectEngagements/);
assert.match(today,/America\/New_York/);
assert.match(today,/const grouped = new Map\(\)/);
assert.match(today,/tracked opens/);
assert.match(today,/refreshProspectEngagements/);
assert.match(today,/setInterval\(refreshProspectEngagements, 60000\)/);
assert.match(today,/href="prospects\.html"/);


// Run the Mission Control query against a disposable SQLite fixture.
const queryMatch=route.match(/async function loadRecentProspectEngagements\(db\)\s*\{\s*return db\.prepare\(\x60([\s\S]+?)\x60\)\.all\(\);/);
assert.ok(queryMatch,"Source query must remain discoverable");
const sql=queryMatch[1],db=new DatabaseSync(":memory:");
try{
  db.exec([
    "CREATE TABLE crm_prospect_radar (id INTEGER PRIMARY KEY,business_name TEXT,contact_name TEXT,contact_email TEXT,status TEXT,archived_at TEXT,promoted_prospect_id INTEGER)",
    "CREATE TABLE crm_prospect_radar_activities (id INTEGER PRIMARY KEY,radar_id INTEGER,activity_type TEXT,promoted_prospect_activity_id INTEGER,occurred_at TEXT,subject TEXT,source_reference TEXT)",
    "CREATE TABLE crm_prospects (id INTEGER PRIMARY KEY,radar_id INTEGER,business_name TEXT,status TEXT)",
    "CREATE TABLE crm_prospect_contacts (id INTEGER PRIMARY KEY,prospect_id INTEGER,name TEXT,email TEXT,is_primary INTEGER)",
    "CREATE TABLE crm_prospect_activities (id INTEGER PRIMARY KEY,prospect_id INTEGER,activity_type TEXT,occurred_at TEXT,subject TEXT,source_reference TEXT)"
  ].join(";\n")+";");
  const add=db.prepare("INSERT INTO crm_prospect_radar(id,business_name,status,archived_at,promoted_prospect_id) VALUES(?,?,?,?,?)");
  add.run(1,"Active Local Lead","outreach",null,null);
  add.run(2,"EverHealth Institute","outreach","2026-10-15 09:00:00",null);
  add.run(3,"Held Lead","nurture",null,null);
  add.run(4,"Converted Radar","promoted",null,10);
  const view=db.prepare("INSERT INTO crm_prospect_radar_activities(id,radar_id,activity_type,occurred_at,subject) VALUES(?,?,'concept_page_view',datetime('now'),'Opened link')");
  for(let n=1;n<=4;n++)view.run(n,n);
  db.prepare("INSERT INTO crm_prospects(id,business_name,status) VALUES(10,'Converted Formal Prospect','active')").run();
  db.prepare("INSERT INTO crm_prospect_activities(id,prospect_id,activity_type,occurred_at,subject) VALUES(10,10,'concept_page_view',datetime('now'),'Opened formal link')").run();
  const active=db.prepare(sql).all();
  assert.deepEqual(active.map(v=>v.business_name).sort(),["Active Local Lead","Converted Formal Prospect"]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM crm_prospect_radar_activities").get().n,4);
  assert.equal(db.prepare("SELECT archived_at FROM crm_prospect_radar WHERE id=2").get().archived_at,"2026-10-15 09:00:00");
  db.prepare("UPDATE crm_prospect_radar SET archived_at=NULL WHERE id=2").run();
  assert.ok(db.prepare(sql).all().some(v=>v.business_name==="EverHealth Institute"),"Reopened Radar appears again");
}finally{db.close();}
console.log("PASS archived EverHealth excluded from live Today engagement count; history preserved");

console.log("PASS Today surfaces recent tracked prospect concept opens with business and timestamp");
