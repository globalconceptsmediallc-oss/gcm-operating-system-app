/* =========================================================
   Global Concepts Media Operating System
   File: tests/forwardLookInteraction.test.js
   Version: 1.2.0
   Status: Regression Test
   Purpose: Lock the first interactive Forward Look workflow for
            passed radio / traffic commitments.
   Change notes — 1.1.2:
   - Replaces the stale exact Today 3.6.8 version lock with the 3.6.x release-family contract.
   - Preserves every Forward Look durability and close-passed assertion.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";
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
   async first(){return sql.includes("FROM schedule_items")?source:null;},
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
