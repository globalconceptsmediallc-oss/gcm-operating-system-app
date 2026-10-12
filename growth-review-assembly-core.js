/* =========================================================
   Global Concepts Media Operating System
   File: growth-review-assembly-core.js
   Version: 1.3.0
   Status: SES September 2026 Read-Only Road-Test Candidate
   Purpose: Assemble only verified, date-scoped evidence and explicitly
            human-approved interpretations into a non-generated preview.
   NO writes, NO Growth Intelligence, NO Consulting Knowledge,
   NO report generator, NO client-facing export.
   ========================================================= */
import { classifyReviewFindings } from "./growth-review-measurement-classifier.js";
import {mediaRunProjector} from "./shared/media-run-status.js";
export const GROWTH_ASSEMBLY_VERSION = "1.3.0";
const OUTCOME = /(conversion|lead|call|revenue|sale|sales|purchase|order|form|contact|showroom|transaction|key[_ ]?event)/i;
const SHOPIFY_COMMERCE = /(sale|sales|revenue|order|purchase|checkout|conversion)/i;
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v==null?"":v).trim();
export function dateOnly(v) {
  const m=clean(v).match(/(\d{4})-(\d{2})-(\d{2})/);
  if(!m)return "";
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
  const dt=new Date(Date.UTC(y,mo-1,d));
  return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo-1&&dt.getUTCDate()===d?m[1]+"-"+m[2]+"-"+m[3]:"";
}
export function validPeriod(start,end) {
  return dateOnly(start)===start&&dateOnly(end)===end&&start<=end;
}
function within(v,start,end){return Boolean(v&&v>=start&&v<=end)}
function overlaps(s,e,start,end){if(!s&&!e)return false;return(s||e)<=end&&(e||s)>=start}
function proofDate(p){return dateOnly(p?.date||p?.activity_date||p?.created_at)}
function measurementDate(m){return dateOnly(m?.periodEnd||m?.period_end||m?.periodStart||m?.period_start)}
function metricKey(m){return clean(m?.metricKey||m?.metric_key).toLowerCase()}
function metricSource(m){return clean(m?.sourceSystem||m?.source_system)}
function complete(s){return ["completed","complete","closed","done"].includes(clean(s).toLowerCase())}
function substantiveActivity(p){
  if(clean(p?.source_type).toLowerCase()==="gmail_monitoring"||!complete(p?.status))return false;
  const name=clean(p?.activity||p?.task||p?.title);
  if(!name)return false;
  return !/\b(monitoring|ranking alert|position tracking|seo alert|evidence review)\b/i.test(name+" "+clean(p?.category));
}
function mediaStart(m){return dateOnly(m?.startDate||m?.start_date)}
function mediaEnd(m){return dateOnly(m?.endDate||m?.end_date)}
function mediaKey(m){return [
 clean(m?.creativeName||m?.campaignName).toLowerCase(),clean(m?.market).toLowerCase(),
 clean(m?.outletName).toLowerCase(),mediaStart(m),mediaEnd(m)
].join("|")}
function workflowMediaRows(workflow,clientId,projector){
  const creativeMap=new Map(arr(workflow?.creatives).map(c=>[Number(c.id),c]));
  return arr(workflow?.assignments).map(a=>{
    const creative=creativeMap.get(Number(a.creativeId))||{};
    const id=Number(a.clientId||creative.clientId||0);
    if(id!==clientId)return null;
    const projected=projector.assignment(a,creative);
    return {
      sourceType:"creative_workflow",id:"assignment:"+clean(a.id),clientId:id,
      operatingStatus:projected.operatingStatus,operatingLabel:projected.operatingLabel,
      operatingBasis:projected.operatingBasis,trafficEvidenceDate:projected.trafficEvidenceDate,
      stationTraffickedConfirmed:projected.stationTraffickedConfirmed,
      broadcastVerified:false,
      mediaType:clean(a.mediaType||creative.mediaType),
      market:clean(a.market),outletName:clean(a.outletName),
      creativeName:clean(creative.creativeName||a.campaignName)||"Media assignment",
      campaignName:clean(a.campaignName),
      startDate:dateOnly(a.rotationStartDate),endDate:dateOnly(a.rotationEndDate),
      status:clean(a.assignmentStatus||creative.status),trafficStatus:"",
      confirmationStatus:""
    };
  }).filter(Boolean);
}
export function assembleGrowthPreview(input) {
  const {period,workspace,findings,measurements,mediaRecords,creativeWorkflow,commerceSnapshots,interpretationItems}=input||{};
  const start=clean(period?.start),end=clean(period?.end);
  if(!validPeriod(start,end))throw Error("An exact valid reporting period is required.");
  const record=workspace?.record||{},operational=workspace?.operational||{};
  const clientId=Number(record?.metadata?.clientId||operational?.client?.id||0);
  const clientCode=clean(record?.metadata?.clientCode||operational?.client?.client_code);
  if(!Number.isSafeInteger(clientId)||clientId<=0||clientCode.toUpperCase()!=="SES"){
    throw Error("Southeast Safes identity could not be verified from Client Workspace.");
  }
  if(input?.interpretationClientCode!=="SES"||
     input?.interpretationPeriodStart!==start||input?.interpretationPeriodEnd!==end)
    throw Error("Interpretation response does not match this exact SES review period.");

  const problems=[],notes=[];
  const selected=arr(interpretationItems);
  const approved=[],held=[];
  for(const item of selected){
    if(item?.clientCode!=="SES"||item?.periodStart!==start||item?.periodEnd!==end){
      problems.push("One included interpretation has an inconsistent client or reporting period.");
      continue;
    }
    const ix=item?.interpretation||{};
    const acceptable=item.effectiveStatus==="approved"&&item.eligibleForReview===true&&
      item.sourceChanged===false&&ix.reviewStatus==="approved"&&
      clean(ix.approvedAt)&&clean(ix.approvedBy)&&
      ["verifiedFacts","evidenceReferences","growthImplications","recommendedAction","clientNarrative"].every(k=>clean(ix[k]));
    if(acceptable){
      approved.push({
        selectionId:Number(item.selectionId),recordType:clean(item.recordType),
        recordId:Number(item.recordId),title:clean(item.operationalRecord?.title),
        sourceStatus:clean(item.operationalRecord?.status),
        approvedAt:clean(ix.approvedAt),approvedBy:clean(ix.approvedBy),
        verifiedFacts:clean(ix.verifiedFacts),evidenceReferences:clean(ix.evidenceReferences),
        growthImplications:clean(ix.growthImplications),recommendedAction:clean(ix.recommendedAction),
        clientNarrative:clean(ix.clientNarrative),caveats:clean(ix.caveats)
      });
    }else{
      held.push({recordType:clean(item?.recordType),recordId:Number(item?.recordId),
        reason:item?.sourceChanged?"Source evidence has changed":
          item?.eligibleForReview!==true?"Operational source is no longer eligible":
          "Explicit interpretation approval or required fields missing"});
    }
  }
  if(!selected.length)problems.push("No issue is explicitly included for this exact period.");
  if(held.length)problems.push(held.length+" included issue(s) are not currently approved and valid. No conclusion can be assembled for them.");
  if(!approved.length)problems.push("No currently valid, human-approved interpretation is available.");

  const snapshots=arr(commerceSnapshots).filter(c=>clean(c?.clientCode).toUpperCase()==="SES"&&Number(c?.clientId)===clientId);
  const exact=snapshots.filter(c=>clean(c.periodStart)===start&&clean(c.periodEnd)===end);
  const commerce=exact.length===1?exact[0]:null;
  const overlapping=snapshots.filter(c=>overlaps(dateOnly(c?.periodStart),dateOnly(c?.periodEnd),start,end)&&!exact.includes(c));
  if(exact.length!==1)problems.push(exact.length>1?"Multiple exact-period commerce snapshots require reconciliation.":"No exact-period Shopify Commerce Performance snapshot is available; overlapping periods are excluded.");
  if(commerce){
    if(!clean(commerce.sourceReference))problems.push("Exact-period commerce source reference is missing.");
    if(clean(commerce.dataCaveat))notes.push(clean(commerce.dataCaveat));
  }
  if(overlapping.length)notes.push(overlapping.length+" overlapping commerce snapshot(s) excluded from exact-period results.");

  // A Finding's source date is NOT its report measurement period.
  // Never infer the source date from reporting_period when source_date is absent.
  const sourceAudit=classifyReviewFindings(findings,start,end);
  const datedFindings=sourceAudit.sourceDated;
  const allMeasurements=arr(measurements).map(m=>({item:m,date:measurementDate(m)})).filter(x=>within(x.date,start,end));
  const generalMeasurements=allMeasurements.filter(x=>!(commerce&&metricSource(x.item).toLowerCase()==="shopify analytics"&&SHOPIFY_COMMERCE.test(metricKey(x.item))));
  const excludedShopifyDuplicates=allMeasurements.length-generalMeasurements.length;
  const measurementCoverage={
    structuredSeptemberCount:generalMeasurements.length,
    sourceDatedPerformanceReports:sourceAudit.counts.reports,
    exactPeriodReports:sourceAudit.counts.exact,
    mixedPeriodReports:sourceAudit.counts.overlapping,
    earlierPeriodReports:sourceAudit.counts.prior,
    laterPeriodReports:sourceAudit.counts.later,
    titleMixedMonthClues:sourceAudit.counts.titleMultipleMonths,
    titleOtherMonthClues:sourceAudit.counts.titleOtherMonth,
    titleReviewMonthClues:sourceAudit.counts.titleReviewMonth,
    monthLabelsOnly:sourceAudit.counts.monthLabelOnly,
    explicitMetadataConflicts:sourceAudit.counts.explicitConflict,
    unverifiedPeriodReports:sourceAudit.counts.unverified
  };
  if(generalMeasurements.length===0) {
    problems.push("No source-dated structured general measurement observations qualify for this exact reporting period. Source-dated reports are not substitutes for September measurement values.");
  }
  if(sourceAudit.counts.explicitConflict) {
    problems.push(sourceAudit.counts.explicitConflict+" explicitly date-bounded performance report(s) disagree with title month and require source verification.");
  }
  // A generic reporting month is administrative context, not a contradictory
  // measured period. Title clues are visible for manual checking, never a
  // source-data inconsistency requiring mutation.
  if(sourceAudit.counts.titleMultipleMonths || sourceAudit.counts.titleOtherMonth) {
    notes.push((sourceAudit.counts.titleMultipleMonths+sourceAudit.counts.titleOtherMonth)+
      " source report(s) mention different or multiple months in their titles. Their measured windows remain unverified until the original reports are checked.");
  }
  if(sourceAudit.counts.reports) {
    notes.push(sourceAudit.counts.reports+" performance-related source report(s) are dated by their original Finding source dates. Explicit date ranges, month labels and title clues remain separate; no narrative metrics were converted to September observations.");
  }
  const outcomeMeasurements=generalMeasurements.filter(x=>OUTCOME.test(metricKey(x.item)));
  if(excludedShopifyDuplicates)notes.push(excludedShopifyDuplicates+" duplicate Shopify commerce measurement(s) removed from the general metrics layer.");

  const completedItems=arr(operational.workItems).map(w=>({
    item:w,date:dateOnly(w?.completed_at||w?.updated_at||w?.created_at),type:"Work Item"
  })).filter(x=>within(x.date,start,end)&&complete(x.item?.status));
  const completedIds=new Set(completedItems.map(x=>Number(x.item?.id)).filter(Boolean));
  const activities=arr(operational.proofOfWork).map(p=>({item:p,date:proofDate(p),type:"Activity"}))
    .filter(x=>within(x.date,start,end)&&substantiveActivity(x.item)&&(!Number(x.item?.work_item_id)||!completedIds.has(Number(x.item.work_item_id))));
  const completedWork=completedItems.concat(activities);
  // Legacy Media Operations records are already scoped by the clientId API request.
  // Enforce any explicit row owner while keeping legacy rows that omit an owner.
  const mediaProjector=mediaRunProjector(creativeWorkflow,end);
  const mediaInput=arr(mediaRecords).filter(m=>{
    const owner=m?.clientId??m?.client_id;
    return owner==null||owner===""||Number(owner)===clientId;
  }).map(m=>mediaProjector.record(m)).concat(workflowMediaRows(creativeWorkflow,clientId,mediaProjector));
  const mediaSeen=new Set();
  const media=mediaInput.filter(m=>{
    const k=mediaKey(m);if(mediaSeen.has(k))return false;mediaSeen.add(k);
    return overlaps(mediaStart(m),mediaEnd(m),start,end);
  });
  const business=record.business||{};
  return {
    version:GROWTH_ASSEMBLY_VERSION,reviewType:"Existing Client Growth Review — Assembly Preview",
    client:{id:clientId,code:"SES",name:clean(business.name)||"Southeast Safes",website:clean(business.website),
      industry:clean(business.industry),relationshipStatus:clean(record?.relationship?.status)},
    period:{start,end,type:clean(period?.type)||"custom"},
    interpretation:{included:selected.length,approved,held},
    commerce,overlappingCommerceCount:overlapping.length,
    context:{
      sourceDatedFindings:datedFindings,
      performanceReports:sourceAudit.performanceReports,
      measurementCoverage,
      measurements:generalMeasurements,
      outcomes:outcomeMeasurements,
      excludedShopifyDuplicates,
      completedWork,media,
      currentPriority:clean(record?.workspace?.currentPriority),
      nextAction:clean(record?.workspace?.nextAction),
      priorities:arr(record.currentPriorities),workQueue:arr(record.workQueue)
    },
    problems,notes,
    reviewReady:problems.length===0,
    previewOnly:true,generatorLocked:true,writesPerformed:0,
    excludedFromConclusions:[
      "Unapproved, excluded, stale or operationally ineligible issues",
      "Undated/out-of-window findings and measurements; never substitute reporting-period end as a Finding source date",
      "Performance-report narrative numbers that do not have verified exact-period structured measurement records",
      "Overlapping commerce periods and duplicate Shopify outcome observations",
      "Monitoring-only proof and non-completed work",
      "Unverified campaign-to-sales attribution or estimated revenue loss"
    ]
  };
}
