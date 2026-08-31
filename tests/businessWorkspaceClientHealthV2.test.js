/* =========================================================
   Global Concepts Media Operating System
   File: tests/businessWorkspaceClientHealthV2.test.js
   Version: 1.0.0
   Status: Production Regression Test
   Purpose: Prevent Business Workspace from rejecting the live Client Health v2
            Business Record schema or hiding its score from the client workspace.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync(
  new URL("../businessWorkspace.js", import.meta.url),
  "utf8"
);

const page = fs.readFileSync(
  new URL("../business-workspace.html", import.meta.url),
  "utf8"
);

assert.doesNotThrow(() => new Function(runtime));
assert.match(runtime, /Version: 1\.0\.2/);
assert.match(runtime, /SUPPORTED_SCHEMA_VERSIONS = new Set\(\["1\.1\.0", "1\.2\.0"\]\)/);
assert.match(runtime, /getClientHealthV2/);
assert.match(runtime, /clientHealthV2\.status/);
assert.match(runtime, /clientHealthV2\.trend/);
assert.match(runtime, /clientHealthV2\.confidence/);

assert.match(page, /Version: 1\.3\.1/);
assert.match(page, /businessWorkspace\.js\?v=1\.0\.2/);
assert.match(page, /workspace\.record\.clientHealthV2 \|\| null/);
assert.match(page, /\$\{Math\.round\(Number\(clientHealthV2\.score\)\)\} \/ 100 —/);
assert.match(page, /\$\{clientHealthV2\.trend \|\| "Unknown"\} · \$\{clientHealthV2\.confidence \|\| "Unknown"\} Confidence/);

console.log("PASS Business Workspace accepts schema 1.2.0 and renders Client Health v2 score, trend, and confidence");
