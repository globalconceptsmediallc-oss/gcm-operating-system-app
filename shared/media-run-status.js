/* =========================================================
 Global Concepts Media Operating System
 File: shared/media-run-status.js
 Version: 1.0.0
 Status: Read-Only Media Operating State Projection
 Purpose: Derive an explicitly linked, dated traffic-backed operating
          state without mutating legacy placement, traffic or D1 evidence.
 Invariants:
 - Sent package alone never proves a broadcast aired.
 - A package only affects a market assignment explicitly linked to it.
 - A linked assignment only affects its own legacy media record.
 - Use the requested as-of date, not today's date, for historical reviews.
 - No fuzzy creative/station matching and no source-data writes.
 ========================================================= */
const clean=v=>String(v==null?"":v).trim();
const lower=v=>clean(v).toLowerCase();
const positive=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:0;};
const arr=v=>Array.isArray(v)?v:[];
const terminal=new Set(["completed","expired","archived","deleted","inactive","cancelled","canceled","removed","hold","on_hold","retired"]);
const validPackage=new Set(["sent","received_confirmed","confirmed"]);
export function mediaDate(value){
 const t=clean(value).slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(t))return "";
 const y=+t.slice(0,4),m=+t.slice(5,7),d=+t.slice(8,10),x=new Date(Date.UTC(y,m-1,d));
 return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d?t:"";
}
export function mediaTodayET(date=new Date()){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 const field=key=>parts.find(x=>x.type===key)?.value||"";
 return field("year")+"-"+field("month")+"-"+field("day");
}
function determineAsOf(value){
 const d=mediaDate(value||mediaTodayET());
 if(!d)throw Error("Media operating status requires a valid as-of date.");
 return d;
}
function result(record,base,extra={}){
 const status=lower(base||record?.status||record?.assignmentStatus)||"planned";
 const label=status==="active"?"Active (recorded)":status.charAt(0).toUpperCase()+status.slice(1).replace(/_/g," ");
 return {...record,operatingStatus:status,operatingLabel:label,
  operatingBasis:"stored_status",trafficEvidenceDate:null,
  broadcastVerified:false,stationTraffickedConfirmed:false,...extra};
}
export function deriveMediaRunStatus(record,evidence,asOf){
 const day=determineAsOf(asOf),stored=lower(record?.status||record?.assignmentStatus)||"planned";
 if(terminal.has(stored))return result(record,stored);
 const start=mediaDate(record?.startDate||record?.rotationStartDate);
 const end=mediaDate(record?.endDate||record?.rotationEndDate);
 const sentDate=mediaDate(evidence?.sentDate);
 const stationConfirmed=evidence?.stationTraffickedConfirmed===true;
 if(!sentDate||sentDate>day){
  return result(record,stored,{trafficDateUnverified:Boolean(evidence?.undatedTraffic),
   stationTraffickedConfirmed:stationConfirmed});
 }
 const base={
  operatingBasis:"dated_linked_traffic",
  trafficEvidenceDate:sentDate,
  stationTraffickedConfirmed:stationConfirmed,
  broadcastVerified:false,
  trafficDateUnverified:false
 };
 if(end&&day>end)return result(record,"flight_ended",{...base,operatingStatus:"flight_ended",
    operatingLabel:"Flight ended (scheduled; broadcast unverified)"});
 if(start&&day>=start&&(!end||day<=end))
  return result(record,"running",{...base,operatingStatus:"running",
    operatingLabel:"Running (scheduled; broadcast unverified)"});
 return result(record,"trafficked",{...base,operatingStatus:"trafficked",
   operatingLabel:"Trafficked / Scheduled"});
}
function linkedProof(workflow){
 const as=arr(workflow?.assignments),ps=arr(workflow?.trafficPackages);
 const assignments=new Map(as.map(a=>[positive(a.id),a]).filter(([id])=>id));
 const packages=new Map(ps.map(p=>[positive(p.id),p]).filter(([id])=>id));
 const confByPackage=new Map();
 for(const c of arr(workflow?.confirmations)){
  const id=positive(c.trafficPackageId);
  if(id&&c.stationTraffickedConfirmed===true)confByPackage.set(id,true);
 }
 const byAssignment=new Map();
 for(const link of arr(workflow?.trafficPackageAssignments)){
  const id=positive(link.assignmentId),pid=positive(link.trafficPackageId);
  const a=assignments.get(id),p=packages.get(pid);
  if(!a||!p||positive(a.creativeId)!==positive(p.creativeId))continue;
  const state=lower(p.packageStatus);
  const sent=validPackage.has(state)?mediaDate(p.sentAt||p.confirmedAt):"";
  if(!byAssignment.has(id))byAssignment.set(id,[]);
  byAssignment.get(id).push({sentDate:sent,stationTraffickedConfirmed:confByPackage.get(pid)===true||state==="confirmed",
   packageId:pid,clientId:positive(a.clientId),creativeId:positive(a.creativeId)});
 }
 return {assignments,byAssignment};
}
function latestFor(proofs,clientId,asOf){
 const cutoff=determineAsOf(asOf);
 const eligible=arr(proofs).filter(p=>p.clientId===clientId&&p.sentDate&&p.sentDate<=cutoff)
  .sort((a,b)=>b.sentDate.localeCompare(a.sentDate)||b.packageId-a.packageId);
 if(eligible.length)return eligible[0];
 return {sentDate:"",stationTraffickedConfirmed:arr(proofs).some(p=>p.clientId===clientId&&p.stationTraffickedConfirmed)};
}
export function mediaRunProjector(workflow,asOf){
 const day=determineAsOf(asOf);
 const proof=linkedProof(workflow);
 const getAssignmentEvidence=(a,clientId)=>latestFor(proof.byAssignment.get(positive(a?.id)),clientId,day);
 return {
  record(r){
   const cid=positive(r?.clientId??r?.client_id),id=positive(r?.id);
   if(!cid||!id)return result(r,null);
   const proofRows=[];
   for(const a of proof.assignments.values()){
    if(positive(a.mediaRecordId)===id&&positive(a.clientId)===cid)
      proofRows.push(...arr(proof.byAssignment.get(positive(a.id))));
   }
   const evidence=latestFor(proofRows,cid,day);
   // Older legacy traffic records are useful evidence but lack an
   // authoritative sent date; do not silently turn them into running.
   if(!evidence.sentDate && lower(r?.trafficStatus)==="sent")evidence.undatedTraffic=true;
   if(lower(r?.confirmationStatus)==="confirmed")evidence.stationTraffickedConfirmed=true;
   return deriveMediaRunStatus(r,evidence,day);
  },
  assignment(a,creative){
   const cid=positive(a?.clientId||creative?.clientId);
   if(!cid||positive(creative?.clientId)!==cid||
     positive(a?.creativeId)!==positive(creative?.id))return result(a,a?.assignmentStatus);
   const evidence=getAssignmentEvidence(a,cid);
   return deriveMediaRunStatus({...a,startDate:a.rotationStartDate,endDate:a.rotationEndDate,status:a.assignmentStatus},evidence,day);
  }
 };
}
