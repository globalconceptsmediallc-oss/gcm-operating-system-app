/* =========================================================
 Global Concepts Media Operating System
 File: tests/mediaCalendarPresentation.test.js
 Version: 1.2.1
 Purpose: Verify radio Schedule Authority placeholders remain distinct from
 named commercials and that traffic-derived status is visible alongside age.
 Read-only page regression; no database, browser or email writes.
 ========================================================= */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../media-calendar.html",import.meta.url),"utf8");
assert.match(html,/Version: 1\.8\.4/);
const block=(from,to)=>{
 const a=html.indexOf("  function "+from+"("),b=html.indexOf("  function "+to+"(",a+1);
 assert.ok(a>0&&b>a,"Calendar must contain "+from+" before "+to);
 return html.slice(a,b);
};
const source=block("socialPublishingStatus","hasRecordedSocial")+"\n"+
 block("productionKey","hashText")+"\n"+
 block("radioLanesFor","channelItems")+"\n"+
 block("eventItems","uniqueProductions")+"\n"+
 block("uniqueProductions","renderCreativeAge")+"\n"+
 block("renderCampaignStatus","withinMonth");
const statusBox={innerHTML:""};
const $=id=>{assert.equal(id,"campaign-status-list");return statusBox;};
const typeGroup=t=>String(t).toLowerCase()==="radio"?"Radio":t;
const lower=v=>String(v||"").toLowerCase();
const state={scheduleAuthorityLoaded:true,socialDispositions:new Map()};
const esc=v=>String(v);
const bundle=new Function("typeGroup","lower","$","state","esc",
 source+"\nreturn {socialPublishingStatus,socialSupportStatus,socialSupportCounts,socialSupportDescription,isRecordedRadio,radioScheduleNotes,radioLanes,eventItems,uniqueProductions,radioOperatingText,radioEvidenceText,renderCampaignStatus};")(typeGroup,lower,$,state,esc);
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
rows.push({source:"schedule-radio",type:"Radio",clientId:11,
 market:"Orlando",outlet:"WFLA",creative:"WFLA Radio Flight · Wed–Sat",
 status:"planned",startDate:"2026-10-07",endDate:"2026-10-10"});
assert.equal(rows.length,8);
assert.equal(bundle.radioLanes(rows).length,2);
assert.deepEqual(bundle.radioLanes(rows).map(x=>x.items.length),[4,4],
 "Each station lane must contain three commercials and its own gray flight note");
assert.deepEqual(bundle.radioLanes(rows).map(x=>x.items.filter(bundle.isRecordedRadio).length),[3,3],
 "Unlinked flight notes never inflate named-commercial counts");
assert.equal(bundle.radioScheduleNotes(rows).length,2,"Two distinct stations retain separate flight evidence");
assert.doesNotMatch(html,/grid\.appendChild\(sectionTitle\("Radio schedule-only notes — not commercials"\)\)/,
 "Unlinked notes must not create a second Radio section");
assert.match(html,/var named=l\.items\.filter\(isRecordedRadio\)\.length,notes=l\.items\.length-named/,
 "Station summary must label named commercials and unmatched flight notes separately");
assert.equal(bundle.uniqueProductions(rows).length,3,
 "Creative age must not count a schedule-only placeholder as a creative");
bundle.renderCampaignStatus(rows);
assert.match(statusBox.innerHTML,/2 markets · 3 creatives/);
assert.match(statusBox.innerHTML,/Radio schedule-only notes/);
assert.match(statusBox.innerHTML,/2 unlinked schedule items/);
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
assert.match(html,/if\(r\.source==="schedule-radio"\)\{if\(withinMonth\(s\)\)items\.push\(\{date:s,label:"Schedule only"/,
 "Schedule notes should be documented once as notes, not commercial start/end events");
assert.match(html,/projection\.assignment\(original,c\)/);
assert.match(html,/mediaRunProjector\(state\.workflow,dayForView\(\)\)/,
 "Month-specific status must remain derived from month-end view dates");
assert.match(html,/not verified broadcasts/,"Disclaim airplay validation");
assert.equal(rows.at(-1).status,"planned","Source data must not be rewritten");
const calendarCandidates=[
 {source:"workflow",type:"Radio",campaign:"Halloween One",creative:"Halloween One",
  market:"Melbourne",outlet:"WMMB",startDate:"2026-10-05",endDate:"2026-10-31"},
 {source:"record",type:"Radio",campaign:"Halloween Two",creative:"Halloween Two",
  market:"Orlando",outlet:"WFLA",startDate:"2026-10-05",endDate:"2026-10-31"},
 {source:"schedule-event",type:"Promotion",campaign:"SES Social Impact Test",
  creative:"SES Social Impact Test",market:"All SES",startDate:"2026-10-01"},
 {source:"gun-show-source",type:"Promotion",campaign:"SES Orlando Gun Show",
  creative:"GUN SHOW — Orlando",market:"Orlando",startDate:"2026-10-10"},
 {source:"promotion-run",type:"Promotion",campaign:"Liberty Fall Savings",
  creative:"SALE RUN — Liberty Fall Savings",startDate:"2026-10-15"}
];
assert.deepEqual(bundle.eventItems(calendarCandidates).map(x=>x.source),
 ["schedule-event","gun-show-source","promotion-run"],
 "Radio spots named Halloween must not appear again as Events");
assert.equal(calendarCandidates[0].type,"Radio","Filtering may not rewrite media records");
console.log("PASS Media Calendar 1.8.4: notes inside station radio lanes, no radio/event duplication, evidence semantics preserved");

const socialEvent={key:"ses:gun-show:orlando:2026-10-10:social_post:2026-10-05:SOCIAL #1 — SHOW WEEK ANNOUNCEMENT · Orlando",startDate:"2026-10-05",scheduleItemId:99};
const exactKey="schedule|"+socialEvent.key+"|2026-10-05";
state.socialDispositions.set(exactKey.toLowerCase(),{
 disposition:"social_mixed",
 reason:JSON.stringify({
  schema:"gcm-social-execution-v1",scheduleItemId:99,plannedDate:"2026-10-05",
  platforms:[
   {platform:"Facebook",status:"missed"},
   {platform:"Google Business Profile",status:"published",publishedDate:"2026-10-05",proofReference:"archive:post-123"},
   {platform:"Instagram",status:"missed"}
  ]
 })
});
assert.equal(bundle.socialPublishingStatus(socialEvent,"Facebook").status,"missed");
const gbOutcome=bundle.socialPublishingStatus(socialEvent,"Google Business Profile");
assert.equal(gbOutcome.status,"published");
assert.equal(gbOutcome.proofReference,"archive:post-123");
assert.equal(bundle.socialPublishingStatus(socialEvent,"Instagram").status,"missed");
assert.equal(bundle.socialPublishingStatus({...socialEvent,scheduleItemId:100},"Facebook").status,"unverified",
 "Do not import another schedule item's publishing decision");
assert.equal(bundle.socialPublishingStatus({...socialEvent,startDate:"2026-10-06"},"Facebook").status,"unverified",
 "Do not import another scheduled date's publishing decision");
assert.equal(bundle.socialPublishingStatus({...socialEvent,startDate:"2027-01-01"},"Facebook").status,"planned",
 "Future scheduled posts should remain planned without outcome evidence");
assert.equal(bundle.socialSupportDescription([
 {source:"promotion-post",executionStatus:"missed"},
 {source:"promotion-post",executionStatus:"published"},
 {source:"promotion-post",executionStatus:"unverified"},
 {source:"record",status:"planned"}
]),"1 published (proof referenced) · 1 missed · 1 unverified · 1 other media records");
assert.match(html,/action:"forward-look-operations",operation:"list"/,
 "Media Calendar must load the same D1 decisions as Today");
assert.match(html,/Scheduled · outcome unverified/,
 "Scheduled campaign should never be labeled Recorded as proof of launch");
assert.match(html,/id="publishing-status-state"/,
 "Missing source must produce a visible evidence-quality warning");
console.log("PASS Media Calendar social publishing statuses map exact D1 evidence per platform; incomplete facts remain unverified");
