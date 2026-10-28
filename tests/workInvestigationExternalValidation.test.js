/* =========================================================
   Global Concepts Media Operating System
   File: tests/workInvestigationExternalValidation.test.js
   Version: 1.0.0
   Status: Production Regression Test
   Purpose: Verify monitored Investigations remain visible, distinct from
            external-validation Work Items and original active queue;
            action requires evidence and resume requires a new result.
   No production D1 writes.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

const work=fs.readFileSync(new URL("../work.html",import.meta.url),"utf8");
const processing=fs.readFileSync(new URL("../routes/investigationProcessing.js",import.meta.url),"utf8");
const workspace=fs.readFileSync(new URL("../routes/clientWorkspace.js",import.meta.url),"utf8");

assert.match(work,/Version: 1\.9\.47/);
assert.match(work,/sourceMonitoringInvestigations=Array\.isArray\(op\.monitoringInvestigations\)/);
assert.match(work,/monitoringInvestigations\.push\(\.\.\.monitorById\.values\(\)\)/);
assert.match(work,/data-validation-investigation-id/);
assert.match(work,/Monitoring Investigation — Awaiting External Validation/);
assert.match(work,/data-resume-investigation/);
assert.match(work,/monitoring_external_validation/);
assert.match(work,/outcome:"continue_investigation"/);
assert.match(work,/New operator-reported external result requiring verification/);
assert.match(work,/response\.workItemCreated===true/);
assert.match(work,/!\["continue_investigation","monitoring_external_validation"\]\.includes\(outcome\)/);
assert.match(work,/monitorButton\.disabled=!pending\|\|Boolean\(decision\?\.rootCauseProven\)/);
assert.match(work,/if\(outcome==="monitoring_external_validation"&&byId\("monitor-button"\)\?\.disabled\)/);

assert.match(workspace,/monitoringInvestigations,\s*workItems,/);
assert.match(workspace,/investigations: openInvestigations/);
assert.match(processing,/outcome === "monitoring_external_validation"/);
assert.match(processing,/progressStatus: "awaiting_external_validation"/);
assert.match(processing,/status = 'monitoring'/);
assert.match(processing,/investigationKeptOpen: true/);
assert.match(processing,/workItemCreated: false/);

function extract(a,b){
  const start=work.indexOf(a),stop=work.indexOf(b,start+a.length);
  assert.ok(start>=0&&stop>start,"Missing Work function boundary: "+a);
  return work.slice(start,stop);
}

// Test actual Work rendering with representative NFS Investigation #101.
const renderSource=extract("  function renderExternalValidationItems(){","  async function resumeMonitoredInvestigation(");
const htmlElement={
  innerHTML:"",
  querySelectorAll(){return [];}
};
const el={externalValidation:htmlElement,filter:{value:"NFS"}};
const monitored=[{
  id:101,clientCode:"NFS",clientName:"North Florida Safes",
  status:"monitoring",title:"New reasons prevent pages in a sitemap from being indexed",
  assigned_to:"Andrew",updated_at:"2026-10-28 18:27:12",
  finding_summary:"Google Search Console Redirect error: Fatboy page; live URL eligible, awaiting Google's validation",
  progressUpdates:[{
    id:79,captured_at:"2026-10-28 18:27:12",
    raw_data:JSON.stringify({
      findingSummary:"Google Search Console Redirect error — Fatboy page",
      nextQuestion:"Has Google Search Console completed validation?",
      nextEvidence:"Check Redirect error > See details for Passed or Failed result."
    })
  }]
}];
const workItems=[{
  id:27,clientCode:"NFS",clientName:"North Florida Safes",
  title:"Separate existing Work Item",status:"awaiting_external_validation",
  actual_impact:"A verified change was recorded",
  expected_impact:"Await final external check",
  created_at:"2026-10-27"
}];
function esc(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;")}
const parseProgress=entry=>{
  const raw=JSON.parse(entry.raw_data||"{}");
  return {...raw,capturedAt:entry.captured_at};
};
const render=new Function(
  "el","validationWorkItems","monitoringInvestigations","normalizedClientCode",
  "sortInvestigations","investigationProgressEntries","esc","resumeMonitoredInvestigation","reconcileSupersededWorkItem",
  renderSource+"\nreturn renderExternalValidationItems;"
)(
  el,workItems,monitored,
  v=>String(v??"").toUpperCase(),
  (a,b)=>a.id-b.id,
  i=>(i.progressUpdates||[]).map(parseProgress),
  esc,()=>{},()=>{}
);
render();
assert.match(htmlElement.innerHTML,/Investigation #101/);
assert.match(htmlElement.innerHTML,/Google Search Console Redirect error — Fatboy page/);
assert.match(htmlElement.innerHTML,/Has Google Search Console completed validation\?/);
assert.match(htmlElement.innerHTML,/Check Redirect error/);
assert.match(htmlElement.innerHTML,/Resume Investigation for Review/);
assert.match(htmlElement.innerHTML,/Work Item #27/);
assert.match(htmlElement.innerHTML,/Close as Superseded \/ Duplicate/);

// The same monitoring record must still render if no Work Item awaits validation.
workItems.splice(0);
render();
assert.match(htmlElement.innerHTML,/Investigation #101/);
assert.doesNotMatch(htmlElement.innerHTML,/Work Item #27/);
// A client filter must not show another client's monitored case.
el.filter.value="SES";
render();
assert.match(htmlElement.innerHTML,/No Investigations or Work Items are awaiting external validation/);

// Validate the real monitor gate against pending and unproven statuses.
const decisionSource=extract("  function updateDecisionControls(decision){","  async function createRequestedWork(");
const controls={
  "monitor-button":{disabled:true,title:"",textContent:""},
  "create-button":{disabled:true,title:"",textContent:""}
};
const update=new Function("byId",decisionSource+"\nreturn updateDecisionControls;")(id=>controls[id]);
update({evidenceType:"redirect_external_validation_pending",rootCauseProven:false});
assert.equal(controls["monitor-button"].disabled,false);
assert.equal(controls["create-button"].disabled,true);
update({evidenceType:"redirect_live_eligible",rootCauseProven:false});
assert.equal(controls["monitor-button"].disabled,true);
update({evidenceType:"redirect_external_validation_pending",rootCauseProven:true});
assert.equal(controls["monitor-button"].disabled,true);

console.log("PASS Investigation monitoring action, D1 source mapping, evidence-gated decisions, follow-up cards, client filter, resume and Work Item preservation");
