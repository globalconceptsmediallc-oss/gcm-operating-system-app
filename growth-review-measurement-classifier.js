/* =========================================================
   Global Concepts Media Operating System
   File: growth-review-measurement-classifier.js
   Version: 1.1.0
   Status: SES September Growth Review — Read-Only Date Audit
   Purpose: Separate source date, administrative month label, explicit
            measurement-period metadata, and unverified title clues.
   Rules:
   - Only source_date establishes the date a Finding belongs to a review.
   - Only explicit valid ISO date bounds establish measured coverage.
   - A YYYY-MM or "August 2026" label is NOT evidence of actual coverage.
   - Months in the report title are clues, NEVER verified metric periods.
   - No D1 writes, source rewrites, AI interpretation or report generation.
   ========================================================= */
const clean = v => String(v==null?"":v).trim();
const MONTHS=["january","february","march","april","may","june","july","august","september","october","november","december"];
const SHORT_MONTHS=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const REPORT_PATTERN=/\b(google analytics|ga4|search console|youtube|creator month|performance report|position tracking update|semrush|google ads|facebook insights|meta ads|marketing performance|traffic report)\b/i;
const showMonth=i=>MONTHS[i]?MONTHS[i][0].toUpperCase()+MONTHS[i].slice(1):"";

export function strictIso(value){
  const t=clean(value);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(t))return "";
  const y=+t.slice(0,4),m=+t.slice(5,7),d=+t.slice(8,10);
  const date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?t:"";
}

export function getSourceDate(finding){
  return strictIso(clean(finding?.source_date).slice(0,10));
}
function monthNames(value){
  const text=clean(value),names=[];
  for(let i=0;i<MONTHS.length;i++){
    if(new RegExp("\\b(?:"+MONTHS[i]+"|"+SHORT_MONTHS[i]+")\\b","i").test(text))names.push(showMonth(i));
  }
  return names;
}
export function parsePeriodLabel(value){
  const raw=clean(value);
  let m=raw.match(/^(\d{4})-(\d{2})$/);
  if(m && Number(m[2])>=1 && Number(m[2])<=12)return showMonth(Number(m[2])-1)+" "+m[1];
  m=raw.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if(m){
    const n=MONTHS.indexOf(m[1].toLowerCase());
    if(n>=0)return showMonth(n)+" "+m[2];
  }
  return "";
}

export function parseExplicitCoverage(value){
  const raw=clean(value),dates=raw.match(/\d{4}-\d{2}-\d{2}/g)||[];
  if(dates.length===2){
    const start=strictIso(dates[0]),end=strictIso(dates[1]);
    return start&&end&&start<=end?{start,end,precision:"date_range"}:null;
  }
  if(dates.length===1&&/^\d{4}-\d{2}-\d{2}$/.test(raw)){
    const date=strictIso(raw);
    return date?{start:date,end:date,precision:"single_date"}:null;
  }
  // Critically, a generic 2026-09 or September 2026 label does not
  // establish that the measured period was September 1 through 30.
  return null;
}
function coverageTiming(coverage,start,end){
  if(!coverage)return null;
  if(coverage.start===start&&coverage.end===end)return "exact";
  if(coverage.end<start)return "prior";
  if(coverage.start>end)return "later";
  return "overlapping";
}

export function classifyPerformanceFinding(finding,sourceDate,periodStart,periodEnd){
  const title=clean(finding?.source_title),sourceType=clean(finding?.source_type),reference=clean(finding?.source_reference);
  if(!REPORT_PATTERN.test(title+" "+sourceType+" "+reference))return null;
  const rawPeriod=clean(finding?.reporting_period);
  const parsed=parseExplicitCoverage(rawPeriod),monthLabel=parsePeriodLabel(rawPeriod),titleHints=monthNames(title);
  const target=showMonth(Number(periodStart.slice(5,7))-1);
  let timing=coverageTiming(parsed,periodStart,periodEnd);
  // A genuine contradiction requires explicit full date bounds, not a
  // general month label. This is a source-review flag, not a data mutation.
  if(timing==="exact"&&titleHints.length===1&&titleHints[0]!==target){
    timing="explicit_conflict";
  }
  // Title months are distinct from verified period bounds. Even a literal
  // range in a subject can have an unknown year: never promote it to a metric.
  if(!timing){
    if(titleHints.length>1)timing="title_multiple_months";
    else if(titleHints.length===1&&titleHints[0]!==target)timing="title_other_month";
    else if(titleHints.length===1)timing="title_review_month";
    else if(monthLabel)timing="month_label_only";
    else timing="unverified";
  }
  const labels={
    exact:"Exact review-period coverage (explicit metadata)",
    overlapping:"Overlapping measurement period (explicit metadata)",
    prior:"Earlier measurement period (explicit metadata)",
    later:"Later measurement period (explicit metadata)",
    explicit_conflict:"Explicit date bounds disagree with title month — verify source",
    title_multiple_months:"Title refers to multiple months; measured dates unverified",
    title_other_month:"Title refers to a different month; measured dates unverified",
    title_review_month:"Title refers to review month; measured dates unverified",
    month_label_only:"Reporting-month label only; measured dates unverified",
    unverified:"Measurement period not verified"
  };
  return {
    findingId:Number(finding?.id)||null,title:title||"Source performance report",
    sourceDate,reportingPeriodText:rawPeriod,reportingMonthLabel:monthLabel,
    explicitCoverage:parsed,titleMonthHints:titleHints,
    timing,timingLabel:labels[timing],
    septemberMetricEligible:timing==="exact",
    metricImported:false
  };
}
export function classifyReviewFindings(findings,periodStart,periodEnd){
  const sourceDated=[],performanceReports=[];
  for(const finding of Array.isArray(findings)?findings:[]){
    const date=getSourceDate(finding);
    if(!date||date<periodStart||date>periodEnd)continue;
    sourceDated.push({item:finding,date});
    const report=classifyPerformanceFinding(finding,date,periodStart,periodEnd);
    if(report)performanceReports.push(report);
  }
  const count=key=>performanceReports.filter(x=>x.timing===key).length;
  return {sourceDated,performanceReports,counts:{
    sourceDated:sourceDated.length,reports:performanceReports.length,
    exact:count("exact"),overlapping:count("overlapping"),
    prior:count("prior"),later:count("later"),
    explicitConflict:count("explicit_conflict"),
    titleMultipleMonths:count("title_multiple_months"),
    titleOtherMonth:count("title_other_month"),
    titleReviewMonth:count("title_review_month"),
    monthLabelOnly:count("month_label_only"),
    unverified:count("unverified")
  }};
}
