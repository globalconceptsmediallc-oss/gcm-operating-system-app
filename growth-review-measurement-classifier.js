/* =========================================================
   Global Concepts Media Operating System
   File: growth-review-measurement-classifier.js
   Version: 1.0.0
   Status: SES September Growth Review — Read-Only Date Audit
   Purpose: Distinguish a source Finding's date from the period covered
            by an external performance report without manufacturing metrics.
   Rules:
   - Only explicit complete source dates establish a source-dated Finding.
   - Only unambiguous machine-readable coverage dates establish report timing.
   - A report title's month hints are displayed, never treated as proof
     of exact-period measurement or numeric data.
   - No D1 writes, no AI interpretation, no report generation.
   ========================================================= */
const clean = value => String(value == null ? "" : value).trim();
const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const SHORT_MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const REPORT_PATTERN = /\b(google analytics|ga4|search console|youtube|creator month|performance report|position tracking update|semrush|google ads|facebook insights|meta ads|marketing performance|traffic report)\b/i;

export function strictIso(value) {
  const text=clean(value);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return "";
  const y=+text.slice(0,4),m=+text.slice(5,7),d=+text.slice(8,10);
  const date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?text:"";
}

export function getSourceDate(finding) {
  return strictIso(clean(finding?.source_date).slice(0,10));
}

function monthNames(text) {
  const found=[];
  for(let i=0;i<MONTHS.length;i++){
    const full=MONTHS[i],abbrev=SHORT_MONTHS[i];
    if(new RegExp("\\b(?:"+full+"|"+abbrev+")\\b","i").test(clean(text)))found.push(full[0].toUpperCase()+full.slice(1));
  }
  return found;
}

function monthRange(year,month) {
  const first=year+"-"+String(month).padStart(2,"0")+"-01";
  const last=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
  return {start:first,end:last,precision:"month"};
}

export function parseExplicitCoverage(value) {
  const raw=clean(value);
  if(!raw)return null;
  // Only recognize exact dates when the raw report-period field contains
  // exactly two valid ISO dates or one isolated ISO date.
  const matches=raw.match(/\d{4}-\d{2}-\d{2}/g)||[];
  if(matches.length===2){
    const start=strictIso(matches[0]),end=strictIso(matches[1]);
    return start&&end&&start<=end?{start,end,precision:"date_range"}:null;
  }
  if(matches.length===1 && /^\s*\d{4}-\d{2}-\d{2}\s*$/.test(raw)){
    const date=strictIso(matches[0]);
    return date?{start:date,end:date,precision:"single_date"}:null;
  }
  if(matches.length)return null;
  const numeric=raw.match(/^(\d{4})-(\d{2})$/);
  if(numeric && +numeric[2]>=1 && +numeric[2]<=12){
    return monthRange(+numeric[1],+numeric[2]);
  }
  const long=raw.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if(long){
    const m=MONTHS.indexOf(long[1].toLowerCase());
    if(m>=0)return monthRange(+long[2],m+1);
  }
  return null;
}

function classifyTiming(coverage,start,end){
  if(!coverage)return "unverified";
  if(coverage.start===start&&coverage.end===end)return "exact";
  if(coverage.end<start)return "prior";
  if(coverage.start>end)return "later";
  return "overlapping";
}

export function classifyPerformanceFinding(finding,sourceDate,periodStart,periodEnd) {
  const title=clean(finding?.source_title);
  const sourceType=clean(finding?.source_type);
  const sourceReference=clean(finding?.source_reference);
  if(!REPORT_PATTERN.test(title+" "+sourceType+" "+sourceReference))return null;
  const rawPeriod=clean(finding?.reporting_period);
  const parsed=parseExplicitCoverage(rawPeriod);
  const titleHints=monthNames(title);
  let timing=classifyTiming(parsed,periodStart,periodEnd);
  // When source metadata disagrees with the title, report a discrepancy
  // instead of silently promoting the value to an exact-period metric.
  const targetMonth=MONTHS[Number(periodStart.slice(5,7))-1]||"";
  if(timing==="exact"&&titleHints.some(m=>m.toLowerCase()!==targetMonth)){
    timing="conflict";
  }
  const label={
    exact:"Exact review-period coverage (metadata only)",
    overlapping:"Mixed/overlapping measurement period",
    prior:"Earlier measurement period",
    later:"Later measurement period",
    unverified:"Measurement period not verified",
    conflict:"Conflicting period indicators — review source"
  }[timing];
  return {
    findingId:Number(finding?.id)||null,
    title:title||"Source performance report",
    sourceDate,
    reportingPeriodText:rawPeriod,
    explicitCoverage:parsed,
    titleMonthHints:titleHints,
    timing,
    timingLabel:label,
    septemberMetricEligible:timing==="exact",
    // Intentional: source reports can support a review but are never
    // imported as quantitative Measurement Observations by this adapter.
    metricImported:false
  };
}

export function classifyReviewFindings(findings,periodStart,periodEnd) {
  const sourceDated=[],performanceReports=[];
  for(const finding of Array.isArray(findings)?findings:[]){
    const date=getSourceDate(finding);
    if(!date||date<periodStart||date>periodEnd)continue;
    const result={item:finding,date};
    sourceDated.push(result);
    const report=classifyPerformanceFinding(finding,date,periodStart,periodEnd);
    if(report)performanceReports.push(report);
  }
  const counts={
    sourceDated:sourceDated.length,
    reports:performanceReports.length,
    exact:performanceReports.filter(x=>x.timing==="exact").length,
    overlapping:performanceReports.filter(x=>x.timing==="overlapping").length,
    prior:performanceReports.filter(x=>x.timing==="prior").length,
    later:performanceReports.filter(x=>x.timing==="later").length,
    conflict:performanceReports.filter(x=>x.timing==="conflict").length,
    unverified:performanceReports.filter(x=>x.timing==="unverified").length
  };
  return {sourceDated,performanceReports,counts};
}
