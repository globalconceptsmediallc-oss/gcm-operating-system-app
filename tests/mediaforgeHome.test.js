/* =========================================================
MediaForge
File: tests/mediaforgeHome.test.js
Version: 1.0.0
Status: Production Regression Test
Purpose: Lock the task-first MediaForge home, simple workflow routing,
         hidden advanced controls, and production website-image defaults.
========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync(new URL("../mediaforge/index.html", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../mediaforge/home.js", import.meta.url), "utf8");
const namingUi = fs.readFileSync(new URL("../mediaforge/naming-ui.js", import.meta.url), "utf8");

assert.match(html, /Version: 3\.0\.0/);
assert.match(html, /What do you want to do today\?/);
assert.match(html, /Rename Product Images/);
assert.match(html, /Prepare Images for the Website/);
assert.match(html, /Identify Unknown Images/);
assert.match(html, /I'm Not Sure — Analyze My Files/);
assert.match(html, /Catalog &amp; Settings/);

for (const task of ["rename","prepare","identify","analyze","catalog"]) {
  assert.match(
    html,
    new RegExp(`data-mf-task(?:-section)?="[^"]*\\b${task}\\b[^"]*"`),
    `MediaForge must expose the ${task} task path.`
  );
}

assert.match(html, /id="renameQuickInput"[^>]+accept="[^"]*\.zip/);
assert.match(html, /Drop Kristy's ZIP or image files here/);
assert.match(html, /Advanced recipe settings/);
assert.match(html, /id="prepareWidth"[^>]+value="1200"/);
assert.match(html, /id="prepareHeight"[^>]+value="1200"/);
assert.match(html, /id="prepareMaxKb"[^>]+value="250"/);
assert.match(html, /Process &amp; Build ZIP/);
assert.match(html, /Load Reference Catalog/);
assert.match(html, /Use Recommended Workflow/);
assert.match(html, /src="\.\/naming-ui\.js\?v=1\.1\.0"/);
assert.match(html, /src="\.\/home\.js\?v=1\.0\.0"/);

assert.match(home, /Version: 1\.0\.0/);
assert.match(home, /function classifyJob/);
assert.match(home, /function extractZipImages/);
assert.match(home, /DecompressionStream/);
assert.match(home, /mediaforge:naming-files/);
assert.match(home, /1200/);
assert.match(home, /250/);

assert.match(namingUi, /Version: 1\.1\.0/);
assert.match(namingUi, /mediaforge:naming-files/);

assert.doesNotMatch(
  html,
  /Authoritative Product Catalog First/,
  "The catalog must no longer be the MediaForge opening experience."
);

console.log("PASS MediaForge 3.0.0 task-first home, simple workflows, ZIP routing, hidden advanced settings, and production defaults");
