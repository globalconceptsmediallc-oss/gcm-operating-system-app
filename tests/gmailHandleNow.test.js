/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailHandleNow.test.js
   Version: 1.2.1
   Status: Production Regression Test
   Purpose: Lock the Morning Command Handle Now boundary so immediate human
            actions keep GCM OS as the home base, open external tasks beside it,
            do not create OS records, and do not clear Gmail until the operator
            explicitly confirms the action is complete.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../shared/today-gmail-decisions.js", import.meta.url),
  "utf8"
);

assert.doesNotThrow(() => new Function(source));
assert.match(source, /Version: 2\.3\.1/);
assert.match(source, /const HUMAN_ROUTING_VERSION = "2\.3\.1"/);

assert.match(source, />Handle Now<\/button>/);
assert.match(source, /Open Email in Gmail ↗/);
assert.match(source, /Completed — Clear Gmail/);
assert.match(source, /data-gcm-cancel-now>Back<\/button>/);
assert.match(source, /article\.dataset\.gmailThreadId/);
assert.match(source, /mail\.google\.com\/mail\/u\/0\/#all\//);

assert.match(source, /function extractActionLinks\(value\)/);
assert.match(source, /function actionLinkButtons\(rawSource\)/);
assert.match(source, /data-gcm-open-action/);
assert.match(source, /target="_blank" rel="noopener noreferrer"/);
assert.match(source, /GCM OS stays open while you complete the action/);
assert.match(source, /Open Task Link/);

for (const label of [
  "Delete — No Action",
  "Information",
  "Monitoring",
  "Investigation",
  "Requested Work"
]) {
  assert.match(source, new RegExp(label));
}

const handleNow = source.match(/function handleNow\(card\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(handleNow, "Handle Now function must exist");
assert.doesNotMatch(handleNow, /post\(/);
assert.doesNotMatch(handleNow, /DELETE/);
assert.doesNotMatch(handleNow, /ROUTE/);
assert.match(handleNow, /GCM OS stays open/);

const completeHandleNow = source.match(/async function completeHandleNow\(card, button\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(completeHandleNow, "Handle Now completion function must exist");
assert.match(completeHandleNow, /post\(DELETE, \{ gmailMessageId, gmailThreadId \}\)/);
assert.match(completeHandleNow, /gmailMovedToTrash/);
assert.match(completeHandleNow, /0 OS records created/);
assert.match(completeHandleNow, /refreshQueue\(\{ preserveStatus:true \}\)/);

console.log("PASS Gmail Handle Now keeps GCM OS as home base, opens task links beside it, and clears Gmail only after explicit completion");
