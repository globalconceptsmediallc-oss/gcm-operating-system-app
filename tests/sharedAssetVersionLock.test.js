/* =========================================================
   Global Concepts Media Operating System
   File: tests/sharedAssetVersionLock.test.js
   Version: 1.0.0
   Status: Regression Test
   Purpose: Prevent shared shell enhancement loaders from silently requesting
            an older cached asset than the version declared by that asset.
   Change notes:
   - Locks Today Gmail decision loader to the decision file's declared version.
   - Locks shared shell's visible version header to SHELL_VERSION.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const shell = fs.readFileSync(new URL("../shared/gcm-shell.js", import.meta.url), "utf8");
const decisions = fs.readFileSync(new URL("../shared/today-gmail-decisions.js", import.meta.url), "utf8");

const decisionVersion = decisions.match(/const FILE_VERSION = "([^"]+)";/)?.[1];
assert.ok(decisionVersion, "today-gmail-decisions.js must declare FILE_VERSION");
assert.match(
  shell,
  new RegExp(`shared/today-gmail-decisions\\.js\\?v=${decisionVersion.replaceAll(".", "\\.")}`),
  `gcm-shell.js must request today-gmail-decisions.js with cache key v=${decisionVersion}`
);

const shellHeaderVersion = shell.match(/File: shared\/gcm-shell\.js[\s\S]*?Version: ([0-9.]+)/)?.[1];
const shellRuntimeVersion = shell.match(/const SHELL_VERSION = "([^"]+)";/)?.[1];
assert.equal(shellHeaderVersion, shellRuntimeVersion, "gcm-shell.js header and SHELL_VERSION must match");

console.log(`PASS shared asset version lock: shell ${shellRuntimeVersion} -> today Gmail decisions ${decisionVersion}`);
