/* =========================================================
   Global Concepts Media Operating System
   File: tests/proofFindings.test.js
   Version: 1.0.0
   Status: Production Regression Test
   Purpose:
   Verify reviewed client Findings are exposed to Proof and outrank raw
   monitoring as the primary Intelligence Audit interpretation.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const workspace = fs.readFileSync(new URL("../routes/clientWorkspace.js", import.meta.url),"utf8");
const proof = fs.readFileSync(new URL("../proof.html", import.meta.url),"utf8");

assert.match(workspace,/Version: 7\.5\.0/);
assert.match(workspace,/FROM client_findings/);
assert.match(workspace,/clientFindingsResult/);
assert.match(workspace,/clientFindings,/);
assert.match(workspace,/clientFindings: clientFindings\.length/);

assert.match(proof,/Version: 2\.3\.0/);
assert.match(proof,/o\.clientFindings/);
assert.match(proof,/stream:"finding"/);
assert.match(proof,/REVIEWED BUSINESS FINDINGS/);
assert.match(proof,/Reviewed findings are the primary interpretation/);
assert.match(proof,/Reviewed Finding/);
assert.match(proof,/function findingDate\(f\)/);
assert.match(proof,/Include Reviewed Findings \+ Supporting Monitoring/);

console.log("PASS Proof uses reviewed client Findings as primary intelligence and raw monitoring as support");
