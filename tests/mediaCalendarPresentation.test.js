/* =========================================================
 Global Concepts Media Operating System
 File: tests/mediaCalendarPresentation.test.js
 Version: 1.0.0
 Purpose: Verify radio Schedule Authority placeholders remain distinct from
 named commercials and that traffic-derived status is visible alongside age.
 Read-only page regression; no database, browser or email writes.
 ========================================================= */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../media-calendar.html",import.meta.url),"utf8");
assert.match(html,/Version: 1\.8\.1/);
const block=(from,to)=>{
 const a=html.indexOf("  function "+from+"("),b=html.indexOf("  function "+to+"(",a+1);
 assert.ok(a>0&&b>a,"Calendar must contain "+from+" before "+to);
 return html.slice(a,b);
};
const source=block("productionKey","hashText")+"\n"+
 block("radioLanesFor","channelItems")+"\n"+
 block("uniqueProductions","renderCreativeAge")+"\n"+
 block("renderCampaignStatus","withinMonth");
const statusBox={innerHTML:""};
const $=id=>{assert.equal(id,"campaign-status-list");return statusBox;};
const typeGroup=t=>String(t).toLowerCase()==="radio"?"Radio":t;
const lower=v=>String(v||"").toLowerCase();
const state={scheduleAuthorityLoaded:true};
const esc=v=>String(v);
const bundle=new Function("typeGroup","lower","$","state","eventItems","esc",
 source+"\nreturn {isRecordedRadio,radioScheduleNotes,radioLanes,radioNoteLanes,uniqueProductions,radioOperatingText,radioEvidenceText,renderCampaignStatus};")(typeGroup,lower,$,state,()=>[],esc);
const creatives=["Before Disaster Strikes","Safe Moving Services 2","Safe Repair Services 2"];
const rows=[];
for(const market of ["Melbourne","Orlando"]){
 for(const creative of creatives)rows.push({
  source:"workflow",type:"Radio",clientId:11,creative,market,
  outlet:market==="Melbourne"?"WMMB":"WFLA",
  status:"running",statusLabel:"Running (scheduled; broadcast unverified)",
  operatingBasis:"dated_linked_traffic",trafficEvidenceDate:"2026-08-27",
  startDate:"2026-09-01",endDate:"2026-10-31"
 });
}
rows.push({source:"schedule-radio",type:"Radio",clientId:11,
 market:"Melbourne",outlet:"WMMB",creative:"WMMB Radio Flight · Wed–Sat",
 status:"planned",startDate:"2026-09-23",endDate:"2026-09-23"});
assert.equal(rows.length,7);
assert.equal(bundle.radioLanes(rows).length,2);
assert.deepEqual(bundle.radioLanes(rows).map(x=>x.items.length),[3,3],
 "Schedule note must not become a fourth Melbourne commercial");
assert.equal(bundle.radioNoteLanes(rows).length,1);
assert.equal(bundle.radioNoteLanes(rows)[0].items.length,1);
assert.equal(bundle.radioNoteLanes(rows)[0].items[0].source,"schedule-radio");
assert.equal(bundle.uniqueProductions(rows).length,3,
 "Creative age must not count a schedule-only placeholder as a creative");
bundle.renderCampaignStatus(rows);
assert.match(statusBox.innerHTML,/2 markets · 3 creatives/);
assert.match(statusBox.innerHTML,/Schedule-only radio notes/);
assert.match(statusBox.innerHTML,/1 unlinked schedule item/);
assert.match(statusBox.innerHTML,/Schedule Authority/);
assert.match(statusBox.innerHTML,/Connected/);
assert.equal(bundle.radioOperatingText(rows[0]),"Running");
assert.equal(bundle.radioOperatingText({...rows[0],status:"trafficked"}),"Trafficked / Scheduled");
assert.equal(bundle.radioOperatingText({...rows[0],status:"planned"}),"Planned");
assert.match(bundle.radioEvidenceText(rows[0]),/Broadcast airplay unverified/);
assert.match(bundle.radioEvidenceText({...rows[0],operatingBasis:"stored_status"}),/not verified/);
assert.match(html,/radioStatus\+" · "\+endFresh\.label/,"Bar label should show traffic state AND creative-age state");
assert.match(html,/scheduleNote\?"Schedule only"/,"Schedule notes must carry their own visible label");
assert.match(html,/if\(scheduleNote\)shell\.classList\.add\("schedule-note"\)/);
assert.match(html,/grid\.appendChild\(sectionTitle\("Radio schedule-only notes — not commercials"\)\)/);
assert.match(html,/var radioNotes=radioNoteLanes\(rows\)/);
assert.match(html,/if\(r\.source==="schedule-radio"\)\{if\(withinMonth\(s\)\)items\.push\(\{date:s,label:"Schedule only"/,
 "Schedule notes should be documented once as notes, not commercial start/end events");
assert.match(html,/projection\.assignment\(original,c\)/);
assert.match(html,/mediaRunProjector\(state\.workflow,dayForView\(\)\)/,
 "Month-specific status must remain derived from month-end view dates");
assert.match(html,/not verified broadcasts/,"Disclaim airplay validation");
assert.equal(rows.at(-1).status,"planned","Source data must not be rewritten");
console.log("PASS Media Calendar 1.8.1: 2 radio markets x 3 commercials, separate schedule note, dated traffic status, no fabricated airplay");
