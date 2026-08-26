/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailHandleNow.test.js
   Version: 1.0.0
   Status: Production Regression Test
   Purpose: Lock the Morning Command Handle Now boundary so immediate human
            actions do not create OS records or clear Gmail until the operator
            explicitly confirms the action is complete.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../shared/today-gmail-decisions.js", import.meta.url),
  "utf8"
);

assert.doesNotThrow(() => new Function(source));
assert.match(source, /Version: 2\.1\.0/);
assert.match(source, /const HUMAN_ROUTING_VERSION = "2\.1\.0"/);

assert.match(source, />Handle Now<\/button>/);
assert.match(source, /Open Email in Gmail/);
assert.match(source, /Completed — Clear Gmail/);
assert.match(source, /data-gcm-cancel-now>Back<\/button>/);
assert.match(source, /article\.dataset\.gmailThreadId/);
assert.match(source, /mail\.google\.com\/mail\/u\/0\/#all\//);

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
assert.match(handleNow, /Gmail and GCM OS are unchanged/);

const completeHandleNow = source.match(/async function completeHandleNow\(card, button\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(completeHandleNow, "Handle Now completion function must exist");
assert.match(completeHandleNow, /post\(DELETE, \{ gmailMessageId \}\)/);
assert.match(completeHandleNow, /gmailMovedToTrash/);
assert.match(completeHandleNow, /0 OS records created/);
assert.match(completeHandleNow, /refreshQueue\(\{ preserveStatus:true \}\)/);

console.log("PASS Gmail Handle Now keeps the message untouched until explicit completion, then clears Gmail with zero OS records");
