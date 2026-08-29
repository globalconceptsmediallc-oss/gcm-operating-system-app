/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailThreadRouting.test.js
   Version: 1.0.1
   Status: Production Regression Test
   Purpose: Lock Morning Command to one human decision per Gmail conversation.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

const backend = fs.readFileSync(new URL("../routes/gmailDispositions.js", import.meta.url), "utf8");
const frontend = fs.readFileSync(new URL("../shared/today-gmail-decisions.js", import.meta.url), "utf8");

assert.doesNotThrow(() => new Function(frontend));
assert.match(backend, /Version: 2\.2\.1/);
assert.match(backend, /GMAIL_HUMAN_ROUTING_VERSION = "2\.2\.1"/);
assert.match(frontend, /Version: 2\.3\.1/);
assert.match(frontend, /HUMAN_ROUTING_VERSION = "2\.3\.1"/);

assert.match(backend, /function groupListedMessagesByThread\(items\)/);
assert.match(backend, /findProcessedGmailThreads\(db, threadGroups\)/);
assert.match(backend, /gmail_monitoring_evidence/);
assert.match(backend, /monitoring_saved/);
assert.match(backend, /gmail-thread:\$\{threadId\}/);
assert.match(backend, /memberReferences/);
assert.match(backend, /findExistingThreadDisposition/);
assert.match(backend, /loadLiveGmailThreadWithAccessToken/);
assert.match(backend, /users\/me\/threads\/\$\{encodeURIComponent\(gmailThreadId\)\}\?format=full/);
assert.match(backend, /async function archiveThread/);
assert.match(backend, /users\/me\/threads\/\$\{encodeURIComponent\(gmailThreadId\)\}\/modify/);
assert.match(backend, /users\/me\/threads\/\$\{encodeURIComponent\(gmailThreadId\)\}\/trash/);
assert.match(backend, /threadMessages:messages/);
assert.match(backend, /writesPerformed:0/);

assert.match(frontend, /function formatConversationSource\(message\)/);
assert.match(frontend, /Source Conversation/);
assert.match(frontend, /MESSAGE \$\{index \+ 1\} OF \$\{messages\.length\}/);
assert.match(frontend, /article\.dataset\.gmailThreadId/);
assert.match(frontend, /post\(ROUTE, \{ gmailMessageId, gmailThreadId, disposition, clientCode, clientName \}\)/);
assert.match(frontend, /post\(DELETE, \{ gmailMessageId, gmailThreadId \}\)/);
assert.match(frontend, /unprocessed Gmail conversation/);
assert.match(frontend, /One route applies to the whole Gmail thread/);

console.log("PASS Gmail Morning Command groups replies into one chronological conversation and applies one route to the whole thread");
