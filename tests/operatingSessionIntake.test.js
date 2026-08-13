/* =========================================================
   Global Concepts Media Operating System
   File: tests/operatingSessionIntake.test.js
   Version: 1.0.0
   Status: OS 2.0 AI Intake Test
   ========================================================= */

import assert from "node:assert/strict";
import {prepareOperatingSessionIntake,buildOperatingIntakeRequest,parseOperatingIntakeResponse,formatOperatingBrief} from "../shared/operatingSessionIntakeTasks.js";

const intake=prepareOperatingSessionIntake({clientId:3,issue:"Six internal images are reported broken.",supportingEvidence:"Owner observation."});
assert.equal(intake.clientId,3);
assert.throws(()=>prepareOperatingSessionIntake({clientId:3,issue:""}),/Tell me what happened/);

const request=buildOperatingIntakeRequest({client:{id:3,client_code:"HBG",name:"HB Guns"},intake,history:[]});
assert.equal(request.store,false);
assert.equal(request.text.format.strict,true);
assert.ok(request.instructions.includes("Potential causes are hypotheses"));

const sample={title:"HB Guns: investigate six reported broken images",issueSummary:"The owner reports six internal images as broken; affected URLs and root cause are not yet verified.",businessReason:"Broken imagery may reduce trust and product comprehension.",priority:"high",operationalCategory:"Website quality",knownFacts:["The owner reports six internal images as broken."],assumptions:[],unknowns:["Affected URLs are not yet recorded."],potentialCauses:["A file-path or asset-reference problem is possible but unverified."],clientImpact:"Visitors may see incomplete pages.",recommendedFirstAction:"Identify the six affected URLs and inspect each failed asset request.",evidenceNeeded:["Affected page URLs"],verificationStandard:["All six images return successfully on the live site."],relevantHistory:[],proofValue:"Record the before condition, repair, and live verification.",followUpQuestions:["Which six pages are affected?"],confidence:"medium"};
const proposal=parseOperatingIntakeResponse({output_text:JSON.stringify(sample)});
assert.equal(proposal.knownFacts.length,1);
assert.ok(formatOperatingBrief(proposal).includes("hypotheses only"));
console.log("PASS AI intake validation, strict schema request, and rich brief formatting");
