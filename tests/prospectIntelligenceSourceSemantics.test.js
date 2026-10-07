/* =========================================================
   Global Concepts Media Operating System
   File: tests/prospectIntelligenceSourceSemantics.test.js
   Version: 1.1.0
   Status: Regression Test
   Purpose: Lock source-aware Prospect Intelligence and prevent
            unrelated service-label contamination.
   ========================================================= */

import assert from "node:assert/strict";
import {
  classifyProspectSource,
  enforceProspectSourceSemantics
} from "../routes/prospectIntelligence.js";
import { buildBusinessIntelligenceRecord } from "../shared/engines/businessIntelligenceRecord.js";

assert.equal(classifyProspectSource({source:"Existing Relationship"},0),"relationship");
assert.equal(classifyProspectSource({source:"Referral / Relationship"},0),"relationship");
assert.equal(classifyProspectSource({source:"Magazine Advertisement"},0),"advertisement");
assert.equal(classifyProspectSource({source:"Google Search"},0),"research");

const record=buildBusinessIntelligenceRecord({
  websiteUrl:"https://example.com/",
  suppliedBusinessName:"Rolling Suds of Melbourne - Palm Bay",
  prospectContext:{source:"Existing Relationship",location:"Melbourne / Palm Bay / Brevard County"},
  websiteEvidence:{
    status:"complete",
    websiteUrl:"https://example.com/",
    title:"Rolling Suds of Melbourne - Palm Bay | Pressure Washing",
    metaDescription:"Residential and commercial pressure washing and exterior cleaning in Brevard County.",
    identifiedBusinessName:"Rolling Suds of Melbourne - Palm Bay",
    identifiedIndustry:"Exterior Cleaning / Pressure Washing",
    identifiedMarket:"Melbourne / Palm Bay / Brevard County",
    visibleText:"Residential house washing. Commercial pressure washing. Exterior cleaning for property managers, HOAs, apartment communities, builders and commercial properties. Irrigation Medical Services Real Estate Restaurant.",
    headings:["Commercial Pressure Washing","Residential House Washing","Irrigation","Medical Services","Real Estate","Restaurant"],
    callsToAction:["Get Quote"]
  },
  advertisementEvidence:{
    status:"not_provided",imageCount:0,visibleBusinessName:"Rolling Suds of Melbourne - Palm Bay",
    visibleServices:[],audienceSignals:[],geographicSignals:[],callsToAction:[],
    uncertainties:["No advertisement image was supplied."],confidence:"Low"
  }
});

assert.equal(record.identity.industry,"Exterior Cleaning / Pressure Washing");
assert.ok(record.services.primaryServices.some(x=>/pressure washing/i.test(x)));
assert.ok(record.services.primaryServices.some(x=>/house washing/i.test(x)));
assert.ok(!record.services.primaryServices.some(x=>/irrigation|medical|real estate|restaurant/i.test(x)));
assert.ok(!record.services.primaryServices.some(x=>/free.*quote|power washing company/i.test(x)));
assert.match(record.identity.targetCustomer,/property managers/i);
assert.match(record.identity.targetCustomer,/HOAs/i);

const enforced=enforceProspectSourceSemantics({
  brief:{
    productsAndServices:["Irrigation","Medical Services","Commercial Pressure Washing"],
    websiteObservations:["Advertisement offer: Unknown","Website status: complete."],
    growthOpportunities:["Compare the advertisement promise with the landing page.","Verify lead attribution."],
    humanVerificationChecklist:["Open the advertisement QR code.","Check calls and forms."],
    personalizedOutreachInsights:["Lead with the advertisement you received."],
    firstContactEmail:{subject:"Ad",body:"I received your advertisement."},
    discoveryCallScript:{opening:"I received your advertisement.",questions:[]},
    prospectIntelligence:{}
  },
  prospectSourceMode:"relationship",
  prospectContext:{source:"Existing Relationship",contactName:"Elizabeth Smith",evidenceDescription:"Elizabeth contacted GCM directly."},
  businessName:"Rolling Suds of Melbourne - Palm Bay",
  websiteUrl:"https://example.com/",
  advertisementEvidence:{status:"not_provided",imageCount:0},
  businessIntelligenceRecord:record
});

assert.deepEqual(enforced.productsAndServices,record.services.primaryServices);
assert.doesNotMatch(enforced.firstContactEmail.body,/advertisement/i);
assert.doesNotMatch(enforced.discoveryCallScript.opening,/advertisement/i);
assert.ok(enforced.discoveryCallScript.questions.every(x=>!/campaign|qr code|advertisement/i.test(x)));
assert.doesNotMatch(enforced.discoveryCallScript.nextStep,/campaign|landing page|qr code/i);
assert.doesNotMatch(enforced.discoveryCallScript.positioningStatement,/advertiser/i);
assert.ok(enforced.missingInformation.every(x=>!/campaign|advertisement|qr code/i.test(x)));
assert.ok(!enforced.websiteObservations.some(x=>/advertisement/i.test(x)));
assert.match(enforced.prospectIntelligence.advertisementAssessment,/No advertisement evidence was supplied/i);
assert.match(enforced.prospectIntelligence.recommendedFirstContact,/existing relationship/i);

console.log("PASS Prospect Intelligence respects relationship source and filters unrelated pressure-washing service labels.");
