/* =========================================================
   Global Concepts Media Operating System
   File: tests/workCoreWebVitalsDecision.test.js
   Version: 1.0.0
   Status: Production Regression Test
   Purpose: Lock the Work Queue Core Web Vitals decision contract so
            page-specific Lighthouse evidence can unlock corrective work
            only when the LCP image loading defect is explicitly proven.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

const work = fs.readFileSync(
  new URL("../work.html", import.meta.url),
  "utf8"
);

assert.match(work,/Version: 1\.9\.31/);
assert.match(work,/core_web_vitals_lcp_diagnostic/);
assert.match(work,/lazy\[ -\]\?loaded\\s\+lcp\\s\+image/i);
assert.match(work,/hasImageLcpElement/);
assert.match(work,/rootCauseProven:true/);
assert.match(work,/Correct vault-doors LCP hero image loading/);
assert.match(work,/not lazy loaded; load it eagerly\/high priority/i);
assert.match(work,/Treat remaining TBT\/main-thread findings as a separate follow-up/i);

console.log("PASS Work Core Web Vitals LCP root-cause decision contract");
