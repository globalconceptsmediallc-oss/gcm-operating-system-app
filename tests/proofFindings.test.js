/* =========================================================
   Global Concepts Media Operating System
   File: tests/proofFindings.test.js
   Version: 1.2.1
   Status: Production Regression Test
   Purpose:
   Verify reviewed client Findings are exposed to Proof and outrank raw
   monitoring as the primary Intelligence Audit interpretation.
   Change notes — 1.2.1:
   - Aligns the Client Workspace version lock to 7.5.2 while preserving every Proof Findings assertion.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const workspace = fs.readFileSync(new URL("../routes/clientWorkspace.js", import.meta.url),"utf8");
const findingsRoute = fs.readFileSync(new URL("../routes/clientFindings.js", import.meta.url),"utf8");
const proof = fs.readFileSync(new URL("../proof.html", import.meta.url),"utf8");

assert.match(workspace,/Version: 7\.5\.2/);
assert.doesNotMatch(workspace,/FROM client_findings/);
assert.match(findingsRoute,/Version: 1\.0\.0/);
assert.match(findingsRoute,/FROM client_findings/);
assert.match(findingsRoute,/GET_CLIENT_FINDINGS/);

assert.match(proof,/Version: 2\.3\.2/);
assert.match(proof,/o\.clientFindings/);
assert.match(proof,/stream:"finding"/);
assert.match(proof,/REVIEWED BUSINESS FINDINGS/);
assert.match(proof,/Reviewed findings are the primary interpretation/);
assert.match(proof,/Reviewed Finding/);
assert.match(proof,/function findingDate\(f\)/);
assert.match(proof,/Include Reviewed Findings \+ Supporting Monitoring/);
assert.match(proof,/get-client-directory/);
assert.match(proof,/get-client-findings/);
assert.match(proof,/Promise\.allSettled/);
assert.match(proof,/async function workspace\(c\)/);
assert.match(proof,/D1 client directory could not load/);

console.log("PASS Proof uses reviewed client Findings as primary intelligence and raw monitoring as support");
