/* =========================================================
   Global Concepts Media Operating System
   File: tests/forwardLookInteraction.test.js
   Version: 1.4.0
   Status: Regression Test
   Purpose: Lock durable Forward Look corrections, preserved revision history,
            and passed radio / traffic commitments.
   Change notes — 1.1.2:
   - Replaces the stale exact Today 3.6.8 version lock with the 3.6.x release-family contract.
   - Preserves every Forward Look durability and close-passed assertion.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
import { handleForwardLookOperations } from "../routes/forwardLookOperations.js";

const today = fs.readFileSync(new URL("../today.html", import.meta.url), "utf8");
const media = fs.readFileSync(new URL("../routes/mediaOperationsLegacy.js", import.meta.url), "utf8");
const forwardLookRoute = fs.readFileSync(new URL("../routes/forwardLookOperations.js", import.meta.url), "utf8");
const forwardLookMigration = fs.readFileSync(new URL("../migrations/0039_forward_look_dispositions.sql", import.meta.url), "utf8");

assert.match(today,/Version: 3\.6\.\d+/);
assert.match(today,/data-forward-manage-kind/);
assert.match(today,/closePassedForwardLookItem/);
assert.match(today,/forward-look-operations/);
assert.match(today,/operation: "close_passed"/);
assert.match(today,/data-forward-manage-key/);
assert.match(today,/Passed — No Further Action/);

assert.match(media,/Version: 7\.10\.2/);
assert.match(media,/close_passed_commitment/);
assert.match(media,/status = 'expired'/);
assert.match(media,/Passed Commitment Closed/);

assert.match(forwardLookRoute,/FORWARD_LOOK_OPERATIONS_ACTION = "forward-look-operations"/);
assert.match(forwardLookRoute,/operation === "close_passed"/);
assert.match(forwardLookRoute,/closedKeys/);
assert.match(forwardLookRoute,/record_social_post/);
assert.match(forwardLookRoute,/social_partial/);
assert.match(today,/social-post-resolution-dialog/);
assert.match(today,/openSocialPostResolution/);
assert.match(today,/saveSocialPostResolution/);
assert.match(today,/Review \/ Correct Published Outcomes/);
assert.match(today,/id="forward-look-review-panel" hidden/);
assert.match(today,/function renderClosedSocialOutcomes/);
assert.match(today,/data-forward-manage-correction/);
assert.match(today,/Correcting existing record/);
assert.match(forwardLookRoute,/correctionHistory/);
assert.match(forwardLookRoute,/FORWARD_LOOK_OPERATIONS_VERSION = "1.2.0"/);
const todayInline = today.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(todayInline, "Today inline script must exist");
new vm.Script(todayInline[1], {filename:"today-inline.js"});
assert.match(forwardLookMigration,/CREATE TABLE IF NOT EXISTS forward_look_dispositions/);
assert.match(forwardLookMigration,/forward_key TEXT NOT NULL UNIQUE/);

console.log("PASS Forward Look passed commitments stay closed after refresh while source history is preserved");

  
// Fixture contract: one schedule-generated event with three planned social channels.
const source = {
 id:31,source_key:"ses:promotion:october",item_type:"promotion",
 title:"October promotion",market:"Melbourne",start_date:"2026-09-28",
 status:"confirmed",metadata_json:JSON.stringify({
  channels:["Facebook","Google Business Profile","Instagram"],
  schedule:[{date:"2026-09-28",title:"Show week announcement"}]
 })
};
const key="schedule|ses:promotion:october:social_post:2026-09-28:Show week announcement|2026-09-28";
const platforms = (statuses) => ["Facebook","Google Business Profile","Instagram"].map((platform,i)=>({
 platform,status:statuses[i],
 publishedDate:statuses[i]==="published"?"2026-09-28":"",
 proofReference:statuses[i]==="published"?"https://example.org/published/"+i:""
}));
let row=null,writes=0;
const db={
 prepare(sql) {
  const statement={
   params:[],
   bind(...args){this.params=args;return this;},
   async first(){
    if (sql.includes("FROM schedule_items")) return source;
    if (sql.includes("FROM forward_look_dispositions")) return row;
    return null;
   },
   async all(){
    if(sql.includes("FROM forward_look_dispositions"))return {results:row?[row]:[]};
    return {results:[]};
   },
   async run(){
    writes++;
    const p=this.params;
    row={
     id:1,forward_key:p[0],kind:"Social Post",title:p[1],
     disposition:p[2],reason:p[3],reviewed_by:p[4],created_at:"2026-10-16"
    };
    return {meta:{changes:1}};
   }
  };
  return statement;
 }
};
async function invoke(operation,values={}) {
 const r=await handleForwardLookOperations({operation, ...values},{DB:db},"test-social");
 return r.json();
}
const request=(items)=>({
 forwardKey:key,scheduleItemId:31,plannedDate:"2026-09-28",
 platforms:items,reviewedBy:"Operator",note:"September schedule audit"
});
let result=await invoke("record_social_post",request(platforms(["published","pending","pending"])));
assert.equal(result.disposition,"social_partial");
assert.equal((await invoke("list")).closedKeys.includes(key),false,"Partial post must remain visible");
assert.equal(JSON.parse(row.reason).platforms[0].status,"published");
result=await invoke("record_social_post",request(platforms(["published","missed","missed"])));
assert.equal(result.disposition,"social_mixed");
assert.equal((await invoke("list")).closedKeys.includes(key),true,"All decided platforms should close the exact row");
result=await invoke("record_social_post",request(platforms(["missed","missed","missed"])));
assert.equal(result.disposition,"social_missed");
assert.equal(JSON.parse(row.reason).platforms.every(p=>p.status==="missed"),true,"Missed cannot become published proof");
const before=writes;
const noProof=platforms(["published","missed","missed"]);
noProof[0].proofReference="";
result=await invoke("record_social_post",request(noProof));
assert.equal(result.ok,false);
assert.equal(writes,before,"Missing proof must not write");
result=await invoke("record_social_post",{...request(platforms(["missed","missed","missed"])),forwardKey:key.replace("2026-09-28","2026-09-29")});
assert.equal(result.ok,false,"Tampered event must be rejected");
assert.equal(writes,before,"Invalid event must not write");
console.log("PASS social posting records distinguish published/missed/partial, preserve proof gates, and hide only resolved rows");

const originalSchedule = structuredClone(source);
const amended = platforms(["published", "published", "published"]).map((item,index)=>({
 ...item,
 publishedDate:index===0?"2026-09-28":"2026-09-29",
 proofReference:"https://example.org/final/"+index
}));
result=await invoke("record_social_post",{...request(amended),note:"Corrected prior all-missed entry with publication evidence"});
assert.equal(result.disposition,"social_published");
assert.equal((await invoke("list")).closedKeys.includes(key),true,"Amended outcome remains closed");
const correctedPayload=JSON.parse(row.reason);
assert.equal(correctedPayload.platforms.filter(p=>p.status==="published").length,3);
assert.equal(correctedPayload.platforms[1].publishedDate,"2026-09-29","Actual date must not be replaced by planned date");
assert.equal(correctedPayload.correctionHistory.length,1,"Original missed entry must survive evidence correction");
assert.equal(correctedPayload.correctionHistory[0].previousDisposition,"social_missed");
assert.equal(correctedPayload.correctionHistory[0].previous.platforms.every(p=>p.status==="missed"),true);
assert.deepEqual(source,originalSchedule,"Authoritative scheduled source must remain unchanged");
const stableHistory=JSON.stringify(correctedPayload.correctionHistory);
result=await invoke("record_social_post",{...request(amended),note:"Corrected prior all-missed entry with publication evidence"});
assert.equal(JSON.stringify(JSON.parse(row.reason).correctionHistory),stableHistory,"Repeating unchanged correction must not add duplicate revisions");
console.log("PASS closed All Missed can be corrected in place with proof, actual dates, and earlier decision snapshots");


// Historical confirmed gun shows leave Forward Look without losing Schedule Authority.
// This is a UI-only view classification, NOT proof of attendance, traffic, or publication.
const matches = today.match(/function shouldArchivePastConfirmedGunShow\(event\) \{[\s\S]*?\n      \}/);
assert.ok(matches, "Forward Look must have a dedicated past-show view rule");
const shouldArchive = new Function(
  "forwardDateOnly", "forwardDaysUntil",
  matches[0] + "\nreturn shouldArchivePastConfirmedGunShow;"
)(
  value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : "",
  value => Math.round((Date.parse(value + "T00:00:00Z") - Date.parse("2026-10-16T00:00:00Z")) / 86400000)
);
const show = {
 kind:"gun_show",status:"confirmed",startDate:"2026-10-03",endDate:"2026-10-04",
 metadata:{participationStatus:"confirmed"}
};
assert.equal(shouldArchive(show), true, "Oct 3 Melbourne confirmed show should leave Forward Look");
assert.equal(shouldArchive({...show,startDate:"2026-10-10",endDate:"2026-10-11"}), true,
  "Oct 10 Orlando confirmed show should leave Forward Look");
assert.equal(shouldArchive({...show,endDate:"2026-10-16"}), false,
  "A show is not archival until its scheduled end date passes");
assert.equal(shouldArchive({...show,status:"candidate"}), false,
  "Unconfirmed schedule records must remain actionable");
assert.equal(shouldArchive({...show,metadata:{participationStatus:"official_schedule_candidate"}}), false,
  "Promoter-only date does not confirm SES participation");
assert.equal(shouldArchive({...show,kind:"social_post"}), false,
  "A past show's social-post obligations must remain independent");
assert.equal(shouldArchive({...show,kind:"station_deadline"}), false,
  "A past show's station obligations must remain independent");
console.log("PASS confirmed ended gun-show events leave active Forward Look without rewriting or clearing campaign work");
