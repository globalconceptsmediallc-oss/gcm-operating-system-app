/* =========================================================
 Global Concepts Media Operating System
 File: tests/mediaRunStatus.test.js
 Version: 1.0.0
 Purpose: Verify explicit per-market traffic-to-running lifecycle,
 historical as-of dates, station proof boundaries, and no data mutation.
 ========================================================= */
import assert from "node:assert/strict";
import {deriveMediaRunStatus,mediaDate,mediaTodayET,mediaRunProjector} from "../shared/media-run-status.js";
const sept="2026-09-30";
const placement=(id,clientId=11)=>({id,clientId,mediaType:"Radio",status:"planned",
  creativeName:"Safe Moving Services 2",market:"Melbourne",outletName:"WMMB",
  startDate:"2026-09-01",endDate:"2026-10-31",trafficStatus:null});
const workflow={
 creatives:[
  {id:6,clientId:11,creativeName:"Safe Moving Services 2"},
  {id:9,clientId:22,creativeName:"Safe Moving Services 2"}
 ],
 assignments:[
  {id:101,clientId:11,creativeId:6,mediaRecordId:50,market:"Melbourne",rotationStartDate:"2026-09-01",rotationEndDate:"2026-10-31",assignmentStatus:"planned"},
  {id:102,clientId:11,creativeId:6,mediaRecordId:51,market:"Orlando",rotationStartDate:"2026-09-01",rotationEndDate:"2026-10-31",assignmentStatus:"planned"},
  {id:103,clientId:22,creativeId:9,mediaRecordId:52,market:"Melbourne",rotationStartDate:"2026-09-01",rotationEndDate:"2026-10-31",assignmentStatus:"planned"},
  {id:104,clientId:11,creativeId:6,mediaRecordId:null,market:"Extra",rotationStartDate:"2026-09-15",rotationEndDate:"2026-09-25",assignmentStatus:"planned"}
 ],
 trafficPackages:[
  {id:30,creativeId:6,packageStatus:"confirmed",sentAt:"2026-08-27T15:16:32-04:00",confirmedAt:"2026-10-02T10:00:00-04:00"},
  {id:31,creativeId:6,packageStatus:"draft",sentAt:"2026-08-25T10:00:00-04:00"},
  {id:32,creativeId:9,packageStatus:"sent",sentAt:"2026-08-29T12:00:00-04:00"},
  {id:33,creativeId:6,packageStatus:"sent",sentAt:"2026-09-10T10:00:00-04:00"}
 ],
 trafficPackageAssignments:[
  {assignmentId:101,trafficPackageId:30},
  {assignmentId:102,trafficPackageId:31},
  {assignmentId:103,trafficPackageId:32},
  {assignmentId:104,trafficPackageId:33},
  // cross-creative package association must not confer proof:
  {assignmentId:102,trafficPackageId:32}
 ],
 confirmations:[
  {trafficPackageId:30,stationTraffickedConfirmed:true,receivedAt:"2026-10-02T10:00:00-04:00"}
 ]
};
function project(day){return mediaRunProjector(workflow,day);}
const onAug=project("2026-08-30").record(placement(50));
assert.equal(onAug.operatingStatus,"trafficked");
assert.equal(onAug.operatingLabel,"Trafficked / Scheduled");
assert.equal(onAug.status,"planned");
assert.equal(onAug.broadcastVerified,false);
assert.equal(onAug.stationTraffickedConfirmed,false);
const start=project("2026-09-01").record(placement(50));
assert.equal(start.operatingStatus,"running");
assert.equal(start.operatingBasis,"dated_linked_traffic");
assert.equal(start.trafficEvidenceDate,"2026-08-27");
assert.equal(start.stationTraffickedConfirmed,false);
const asOfSept=project(sept).record(placement(50));
assert.equal(asOfSept.operatingStatus,"running");
assert.equal(asOfSept.stationTraffickedConfirmed,false);
const october=project("2026-10-12").record(placement(50));
assert.equal(october.stationTraffickedConfirmed,true);
assert.equal(october.operatingStatus,"running");
const ended=project("2026-11-01").record(placement(50));
assert.equal(ended.operatingStatus,"flight_ended");
assert.equal(ended.broadcastVerified,false);
const otherMarket=project(sept).record(placement(51));
assert.equal(otherMarket.operatingStatus,"planned");
assert.equal(otherMarket.trafficEvidenceDate,null);
const differentClient=project(sept).record(placement(52,22));
assert.equal(differentClient.operatingStatus,"running");
assert.equal(project(sept).record(placement(52,11)).operatingStatus,"planned");
const direct=project("2026-09-20").assignment(workflow.assignments[3],workflow.creatives[0]);
assert.equal(direct.operatingStatus,"running");
assert.equal(direct.trafficEvidenceDate,"2026-09-10");
assert.equal(project("2026-09-05").assignment(workflow.assignments[3],workflow.creatives[0]).operatingStatus,"planned");
assert.equal(project("2026-10-01").assignment(workflow.assignments[3],workflow.creatives[0]).operatingStatus,"flight_ended");
assert.equal(project(sept).assignment(workflow.assignments[3],workflow.creatives[1]).operatingStatus,"planned");
const legacy=placement(75);legacy.trafficStatus="sent";legacy.confirmationStatus="confirmed";
const undated=project(sept).record(legacy);
assert.equal(undated.operatingStatus,"planned");
assert.equal(undated.trafficDateUnverified,true);
assert.equal(undated.stationTraffickedConfirmed,false);
assert.equal(project(sept).record({...placement(50),status:"completed"}).operatingStatus,"completed");
assert.equal(project(sept).record({...placement(50),status:"hold"}).operatingStatus,"hold");
assert.equal(deriveMediaRunStatus(placement(50),{sentDate:"2026-10-01"},sept).operatingStatus,"planned");
assert.equal(deriveMediaRunStatus(placement(50),{sentDate:"2026-08-27"},"2026-08-30").operatingStatus,"trafficked");
assert.equal(deriveMediaRunStatus(placement(50),{sentDate:"2026-08-27"},"2026-09-01").operatingStatus,"running");
assert.equal(mediaDate("2026-09-31"),"");
assert.match(mediaTodayET(new Date("2026-10-12T03:00:00Z")),/^2026-10-11$/);
assert.equal(workflow.assignments[0].assignmentStatus,"planned");
assert.equal(workflow.trafficPackages[0].packageStatus,"confirmed");
console.log("PASS Media Run Status 1.0: explicitly-linked sent packages, per-market identity, date boundaries, no mutation, historical confirmation isolation");
