/* =========================================================
   Global Concepts Media Operating System
   File: tests/sharedAssetVersionLock.test.js
   Version: 1.1.0
   Status: Regression Test
   Purpose: Prevent shared shell enhancement loaders from silently requesting
            an older cached asset than the version declared by that asset and
            protect canonical shared navigation entries.
   Change notes:
   - Locks Today Gmail decision loader to the decision file's declared version.
   - Locks shared shell's visible version header to SHELL_VERSION.
   - Locks MediaForge into the canonical Workspace navigation between Media and Prospects.
   - Locks the MediaForge navigation destination to the existing production Pages application.
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

assert.match(
  shell,
  /mediaforge:\s*\{\s*label:\s*"MediaForge",\s*href:\s*"https:\/\/mediaforge-36x\.pages\.dev\/"/,
  "gcm-shell.js must expose the existing production MediaForge application"
);

const mediaIndex = shell.indexOf('media: { label: "Media"');
const mediaForgeIndex = shell.indexOf('mediaforge: { label: "MediaForge"');
const prospectsIndex = shell.indexOf('prospects: { label: "Prospects"');
assert.ok(mediaIndex >= 0, "Media must exist in PAGE_MAP");
assert.ok(mediaForgeIndex > mediaIndex, "MediaForge must appear after Media");
assert.ok(prospectsIndex > mediaForgeIndex, "MediaForge must appear before Prospects");

console.log(`PASS shared asset/navigation lock: shell ${shellRuntimeVersion} -> Today Gmail decisions ${decisionVersion} + MediaForge`);
