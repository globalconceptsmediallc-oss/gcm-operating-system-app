/* =========================================================
   Global Concepts Media Operating System
   File: tests/growthReviewInterpretation.test.js
   Version: 1.0.0
   Purpose: Lock human interpretation boundary and source-staleness behavior.
   ========================================================= */
import assert from "node:assert/strict";
import { handleGrowthReviewInterpretation as handle, GROWTH_REVIEW_INTERPRETATION_VERSION as VERSION } from "../routes/growthReviewInterpretation.js";
assert.equal(VERSION,"1.0.0");
const complete={
 verifiedFacts:"Merchant Center configuration remains unresolved for September.",
 evidenceReferences:"Investigation #46 and linked Finding.",
 growthImplications:"Product visibility may be constrained; sales impact unverified.",
 recommendedAction:"Verify account-structure correction and catalog completeness.",
 clientNarrative:"The product-feed issue requires additional investigation.",
 caveats:"No attribution or measured revenue loss has been established."
};
function fixture() {
 const state={
  row:{
   selection_id:51,client_id:11,client_code:"SES",client_name:"Southeast Safes",
   period_start:"2026-09-01",period_end:"2026-09-30",record_type:"investigation",record_id:46,
   selection:"include",decided_at:"2026-10-11 12:00:00"
  },
  record:{id:46,client_id:11,title:"Merchant Center catalog account issue",status:"in_progress",updated_at:"2026-09-29 09:00:00"},
  progress:{id:444,captured_at:"2026-09-30 09:00:00",raw_data:JSON.stringify({findingSummary:"Feed mismatch recorded."})},
  interp:null,writes:[],otherWrites:0
 };
 const DB={
  prepare(sql) {
   const q={
    args:[],bind(...args){this.args=args;return this;},
    async all(){
     if(sql.includes("FROM growth_review_issue_selections s")){
      if(q.args[0]!=="SES"||q.args[1]!=="2026-09-01"||q.args[2]!=="2026-09-30"||state.row.selection!=="include")return {results:[]};
      return {results:[{...state.row,...(state.interp||{})}]};
     }
     throw Error("Unexpected list SQL");
    },
    async first(){
     if(sql.includes("FROM investigations"))return state.record;
     if(sql.includes("FROM evidence"))return state.progress;
     if(sql.includes("FROM work_items"))return null;
     throw Error("Unexpected first SQL "+sql);
    },
    async run(){
     if(sql.startsWith("INSERT INTO growth_review_interpretations")){
      state.writes.push("draft");
      const v=q.args;
      state.interp={
       interp_id:72,verified_facts:v[1],evidence_references:v[2],growth_implications:v[3],
       recommended_action:v[4],client_narrative:v[5],caveats:v[6],draft_source_snapshot:v[7],
       review_status:"draft",saved_by:v[8],approved_by:null,approved_at:null,
       approval_source_snapshot:null,interp_updated_at:"2026-10-11 13:00:00"
      };
      return {meta:{changes:1}};
     }
     if(sql.startsWith("UPDATE growth_review_interpretations")){
      state.writes.push("approval");
      if(!state.interp)return {meta:{changes:0}};
      state.interp.review_status="approved";
      state.interp.approval_source_snapshot=q.args[0];
      state.interp.approved_by=q.args[1];
      state.interp.approved_at="2026-10-11 13:10:00";
      return {meta:{changes:1}};
     }
     state.otherWrites+=1;throw Error("Unexpected operational write");
    }
   };
   return q;
  }
 };
 return {DB,state};
}
async function call(x,extra={},operation="list"){
 const r=await handle({clientCode:"SES",periodStart:"2026-09-01",periodEnd:"2026-09-30",operation,...extra},{DB:x.DB},"test");
 return {status:r.status,payload:await r.json()};
}
{
 const x=fixture(),list=await call(x);
 assert.equal(list.status,200);
 assert.equal(list.payload.items.length,1);
 assert.equal(list.payload.items[0].recordId,46);
 assert.equal(list.payload.items[0].interpretation,null);
 assert.equal(list.payload.generatorLocked,true);
 assert.equal(list.payload.writesPerformed,0);
 assert.equal(x.state.writes.length,0);
}
{
 const x=fixture(),list=await call(x);
 const source=list.payload.items[0].sourceSnapshot;
 let result=await call(x,{selectionId:99,expectedSourceSnapshot:source,interpretation:complete},"save");
 assert.equal(result.status,404);assert.equal(x.state.writes.length,0);
 result=await call(x,{selectionId:51,expectedSourceSnapshot:"old",interpretation:complete},"save");
 assert.equal(result.status,409);assert.equal(x.state.writes.length,0);
 result=await call(x,{selectionId:51,expectedSourceSnapshot:source},"approve");
 assert.equal(result.status,409);assert.equal(x.state.writes.length,0);
 result=await call(x,{selectionId:51,expectedSourceSnapshot:source,interpretation:complete},"save");
 assert.equal(result.status,200);assert.equal(result.payload.reviewStatus,"draft");assert.equal(result.payload.generatorLocked,true);
 result=await call(x);
 assert.equal(result.payload.items[0].effectiveStatus,"draft");
 result=await call(x,{selectionId:51,expectedSourceSnapshot:source},"approve");
 assert.equal(result.status,200);assert.equal(result.payload.reviewStatus,"approved");
 result=await call(x);
 assert.equal(result.payload.items[0].effectiveStatus,"approved");
 assert.equal(x.state.writes.join(","),"draft,approval");
 assert.equal(x.state.otherWrites,0);
 x.state.progress={id:445,captured_at:"2026-10-11 13:20:00",raw_data:"{}"};
 result=await call(x);
 assert.equal(result.payload.items[0].effectiveStatus,"needs_review");
 assert.equal(result.payload.items[0].sourceChanged,true);
 result=await call(x,{selectionId:51,expectedSourceSnapshot:source},"approve");
 assert.equal(result.status,409);
 assert.equal(x.state.writes.length,2);
 x.state.row.selection="exclude";
 result=await call(x);
 assert.equal(result.payload.items.length,0);
 assert.equal(x.state.otherWrites,0);
}
{
 const x=fixture(),list=await call(x);
 const source=list.payload.items[0].sourceSnapshot;
 await call(x,{selectionId:51,expectedSourceSnapshot:source,interpretation:{verifiedFacts:"draft only"}},"save");
 const result=await call(x,{selectionId:51,expectedSourceSnapshot:source},"approve");
 assert.equal(result.status,409);
 assert.equal(x.state.writes.length,1);
 x.state.record.status="closed";
 const blocked=await call(x,{selectionId:51,expectedSourceSnapshot:source,interpretation:complete},"save");
 assert.equal(blocked.status,409);
 assert.equal(x.state.otherWrites,0);
}
console.log("PASS Growth Interpretation: scoped reads, human draft and approval, staleness, exclusion, zero operational writes");
