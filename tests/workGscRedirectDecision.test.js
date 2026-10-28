/* =========================================================
   Global Concepts Media Operating System
   File: tests/workGscRedirectDecision.test.js
   Version: 1.0.1
   Status: GCM OS Work Regression Test
   Purpose: Protect GSC Redirect error investigations from unrelated
            Merchant Listings / Product snippets evidence.
   v1.0.1 executes the exact production norm() instead of a simplified mock.
   No production D1 writes.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

const work=fs.readFileSync(new URL("../work.html",import.meta.url),"utf8");

function extract(start,end){
  const a=work.indexOf(start),b=work.indexOf(end,a+start.length);
  assert.ok(a>=0 && b>a,"Expected current Work source boundaries: "+start);
  return work.slice(a,b);
}

// Exercise the actual production Work decision logic, not a hand-written copy.
const scope=extract("  function isGoogleSearchConsole(item){","  function isGoogleAnalytics(item)");
const decisions=extract("  function buildGoogleSearchConsoleRedirectDecision(","  function buildNextStepDecision(");
const finding=extract("  function buildInvestigationFinding(","  function buildSpecificWorkTitle(");
const factory=new Function("norm","extractAuditTotals","evidenceSourceName",
  scope+"\n"+decisions+"\n"+finding+"\nreturn {isGoogleSearchConsoleRedirectError,buildGoogleSearchConsoleDecision,buildInvestigationFinding};"
);
const normSource=work.match(/function norm\(v\)\{[^\n]+\}/)?.[0];
assert.ok(normSource,"Production norm() function must be present");
const realNorm=new Function(normSource+";return norm;")();
assert.equal(realNorm("Redirect error"),"redirect_error","Regression must exercise real normalization");
const logic=factory(
  realNorm,
  ()=>({errors:0,warnings:0,notices:0,siteHealth:0}),
  ()=>"Google Search Console"
);

const investigation101={
  id:101,
  title:"New reasons prevent pages in a sitemap from being indexed on site northfloridasafes.com",
  description:"From: Google Search Console. New reason preventing pages from being indexed: Redirect error.",
  finding_summary:"Selected issue: Merchant Listings structured-data issue", // Previously misclassified.
  communication:{
    subject:"New reason preventing pages from being indexed",
    raw_content:"Google Search Console reported a Redirect error."
  }
};

const affectedUrl="https://northfloridasafes.com/products/liberty-safe-fatboy-series";
const evidence=[
  "Source: Google Search Console",
  "Affected URL: "+affectedUrl,
  "Historical issue: Redirect error first detected May 16, 2026",
  "Google Search Console Live URL Test: URL is available to Google; page can be indexed",
  "Product snippets: 1 valid item detected",
  "Merchant listings: 20 valid items detected",
  "Google Search Console validation started October 28, 2026"
];
function decide(item,facts){return logic.buildGoogleSearchConsoleDecision({facts,joined:facts.join(" ").toLowerCase(),history:[],item});}

assert.ok(logic.isGoogleSearchConsoleRedirectError(investigation101),"The original Redirect error must take precedence over previously misclassified Merchant Listings evidence");
const actual=decide(investigation101,evidence);
assert.equal(actual.issueName,"Google Search Console Redirect error");
assert.equal(actual.evidenceType,"redirect_external_validation_pending");
assert.equal(actual.sampleUrl,affectedUrl);
assert.equal(actual.rootCauseProven,false);
assert.match(actual.nextQuestion,/completed validation/i);
assert.match(actual.nextEvidence,/Do not create corrective Work/i);
assert.doesNotMatch(actual.nextEvidence,/Merchant Listing|SKU/i);
const narrative=logic.buildInvestigationFinding(investigation101,{facts:evidence},actual);
assert.match(narrative,/Original issue: Google Search Console Redirect error/);
assert.match(narrative,/Keep the Investigation open/);
assert.doesNotMatch(narrative,/Merchant Listings/);

const liveOnly=decide(investigation101,evidence.filter(value=>!value.includes("validation started")));
assert.equal(liveOnly.evidenceType,"redirect_live_eligible");
assert.equal(liveOnly.rootCauseProven,false);

const failure=decide(investigation101,[
  "Affected URL: "+affectedUrl,
  "Google Search Console validation failed October 28, 2026"
]);
assert.equal(failure.evidenceType,"redirect_validation_failed");
assert.equal(failure.rootCauseProven,false);
assert.match(failure.nextEvidence,/redirect chain/i);

const merchantItem={
  title:"Merchant Listings structured-data issue",
  description:"Google Search Console invalid Merchant Listings product SKU",
  communication:{subject:"Merchant Listings issue",raw_content:"Google Search Console Merchant Listings"}
};
assert.equal(logic.isGoogleSearchConsoleRedirectError(merchantItem),false);
assert.equal(decide(merchantItem,["Merchant listings: 1 affected item"]).issueName,"Merchant Listings structured-data issue");

const canonicalItem={
  title:"New reason preventing pages in a sitemap from being indexed",
  description:"Google Search Console canonical selection issue",
  communication:{subject:"Google canonical issue",raw_content:"Google Search Console canonical"}
};
const canonical=decide(canonicalItem,[
  "User-declared canonical | https://example.com/old",
  "Google-selected canonical | https://example.com/new"
]);
assert.equal(logic.isGoogleSearchConsoleRedirectError(canonicalItem),false);
assert.equal(canonical.evidenceType,"canonical_resolution");

assert.match(work,/DERIVED-DECISION REFRESH/);
assert.match(work,/Locked evidence re-evaluation/);
assert.match(work,/const refreshedDecision=buildNextStepDecision\(captured,item\)/);
assert.match(work,/saveEvidenceHistory\(item,fullHistory\)/);
assert.doesNotMatch(decisions,/resetEvidenceWorkflow\(/);

console.log("PASS GSC redirect_error normalization, original issue scope, external validation, Work gate, evidence preservation and Merchant Listings/canonical regressions");
