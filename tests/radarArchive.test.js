/* =========================================================
   Global Concepts Media Operating System
   File: tests/radarArchive.test.js
   Version: 1.0.4
   Status: Production Regression
   Purpose: Verify non-destructive Radar closure, archive retrieval and restore.
   Change: Align archive regression UI version lock with deployed prospects.html 3.9.2.
   No production database writes are performed.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";
import { handleProspectCrm } from "../routes/prospectCrm.js";

const ui=fs.readFileSync("prospects.html","utf8");
assert.match(ui,/data-view="archived"/);
assert.match(ui,/id="radar-archive"/);
assert.match(ui,/id="archive-dialog"/);
assert.match(ui,/id="archive-form"/);
assert.match(ui,/name="closureReason" required/);
assert.match(ui,/api\("list_archived_radar"\)/);
assert.match(ui,/api\("archive_radar"/);
assert.match(ui,/api\("restore_archived_radar"/);
assert.match(ui,/id="archived-search"/);
assert.match(ui,/function renderArchived\(/);
assert.match(ui,/Version: 3\.9\.2/);
assert.match(ui,/This page requires Prospect CRM 1\.7\.0/);

const row={
  id:42,entry_type:"business",business_name:"Sample Business",
  source_type:"referral",source_description:"Preserved prospect research",
  contact_name:"Dr. Sample",contact_email:"sample@example.com",
  contact_phone:"555-0100",market:"Melbourne",
  status:"outreach",last_outreach_at:"2026-10-12T10:00:00Z",
  next_action_title:"Check for response",next_action_due_date:"2026-10-20",
  archived_at:null,promoted_prospect_id:null
};
const activities=[
 {id:1,radar_id:42,activity_type:"outreach_email",occurred_at:"2026-10-12T10:00:00Z",
  direction:"outbound",subject:"First outreach",summary:"Original relationship email",
  outcome:"sent",meaningful_contact:1,source_type:"gmail"}
];
const intelligence=[
 {id:7,radar_id:42,intelligence_type:"prospect_research",title:"Research",
  summary:"Original evidence",captured_at:"2026-09-14T13:00:00Z"}
];

class Statement{
  constructor(sql){this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async all(){
    const q=this.sql.toLowerCase();
    if(q.includes("from crm_prospect_radar r")&&q.includes("r.archived_at is not null")){
      return {results:row.archived_at?[{...row,archive_reason:activities.filter(a=>a.activity_type==="radar_archived").at(-1)?.summary||null}]:[]};
    }
    if(q.includes("from crm_prospect_radar_activities"))return {results:activities};
    if(q.includes("from crm_prospect_radar_intelligence"))return {results:intelligence};
    if(q.includes("from crm_prospect_radar")&&q.includes("where id = ?"))return {results:this.args[0]===42?[{...row}]:[]};
    if(q.includes("from crm_prospect_radar")&&q.includes("where archived_at is null"))return {results:row.archived_at?[]:[{...row}]};
    throw new Error("Unexpected test SQL: "+this.sql.slice(0,160));
  }
  async run(){
    const q=this.sql.toLowerCase();
    if(q.includes("update crm_prospect_radar")&&q.includes("archived_at = current_timestamp")){
      row.archived_at="2026-10-13 11:00:00";
      row.next_action_title=null;row.next_action_due_date=null;return {success:true};
    }
    if(q.includes("update crm_prospect_radar")&&q.includes("archived_at = null")){
      row.archived_at=null;row.status="radar";row.next_action_title=null;
      row.next_action_due_date=null;return {success:true};
    }
    if(q.includes("insert into crm_prospect_radar_activities")){
      const archived=q.includes("'radar_archived'");
      activities.push({id:activities.length+1,radar_id:42,
        activity_type:archived?"radar_archived":"radar_restored",
        occurred_at:"2026-10-13T11:00:00Z",
        summary:archived?this.args[1]:"Restored to Radar without adding a follow-up.",
        subject:archived?"Radar closed / archived":"Radar restored from archive",
        meaningful_contact:0,source_type:"crm"});
      return {success:true};
    }
    throw new Error("Unexpected test write: "+this.sql.slice(0,160));
  }
}
const env={DB:{
  prepare(sql){return new Statement(sql);},
  async batch(statements){for(const s of statements)await s.run();return statements.map(()=>({success:true}));}
}};
async function action(operation,payload={}){
  const response=await handleProspectCrm({operation,...payload},env,"regression-archive");
  return {status:response.status,data:await response.json()};
}

const invalid=await action("archive_radar",{radarId:42,closureReason:" "});
assert.equal(invalid.status,400);
assert.equal(row.archived_at,null);
const missing=await action("archive_radar",{radarId:404,closureReason:"Not a fit"});
assert.equal(missing.status,404);

const before=await action("list_radar");
assert.equal(before.data.count,1);
assert.equal(before.data.radar[0].nextAction.title,"Check for response");

const closed=await action("archive_radar",{radarId:42,closureReason:"No Current Opportunity — Prospect Declined"});
assert.equal(closed.status,200);
assert.equal(closed.data.writesPerformed,2);
assert.ok(closed.data.radar.archivedAt);
assert.equal(closed.data.radar.managementState,"closed");
assert.equal(closed.data.radar.isUnmanaged,false);
assert.equal(closed.data.radar.nextAction,null);

const repeat=await action("archive_radar",{radarId:42,closureReason:"Repeat"});
assert.equal(repeat.data.writesPerformed,0);
assert.equal(repeat.data.alreadyArchived,true);

const activeAfter=await action("list_radar");
assert.equal(activeAfter.data.count,0);
const archive=await action("list_archived_radar");
assert.equal(archive.data.count,1);
assert.match(archive.data.radar[0].archiveReason,/Prospect Declined/);
assert.equal(archive.data.writesPerformed,0);

const archivedDetail=await action("get_radar",{radarId:42});
assert.equal(archivedDetail.data.radar.contactEmail,"sample@example.com");
assert.ok(archivedDetail.data.radar.activities.some(a=>a.subject==="First outreach"));
assert.ok(archivedDetail.data.radar.intelligence.some(i=>i.title==="Research"));
assert.equal((await action("update_radar",{radarId:42,contactName:"Changed"})).status,409);
assert.equal((await action("promote_radar",{radarId:42,appointmentAt:"2026-10-14T10:00:00"})).status,409);
assert.equal((await action("add_radar_activity",{radarId:42,activityType:"phone_call",occurredAt:"2026-10-13T11:00:00",summary:"Should not happen"})).status,409);

const restored=await action("restore_archived_radar",{radarId:42});
assert.equal(restored.data.writesPerformed,2);
assert.equal(restored.data.radar.status,"radar");
assert.equal(restored.data.radar.archivedAt,null);
assert.equal(restored.data.radar.nextAction,null);
assert.equal((await action("list_radar")).data.count,1);
assert.equal((await action("list_archived_radar")).data.count,0);
assert.ok(restored.data.radar.activities.some(a=>a.activityType==="radar_archived"));
assert.ok(restored.data.radar.activities.some(a=>a.activityType==="radar_restored"));
assert.equal((await action("restore_archived_radar",{radarId:42})).data.writesPerformed,0);

console.log("PASS Radar Closed / Archived workflow: required reason, preserved history, no active follow-up, read-only archive, restore, no duplicate writes.");
