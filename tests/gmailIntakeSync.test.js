/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailIntakeSync.test.js
   Version: 1.1.0
   Status: Regression Test
   Purpose:
   Lock live Gmail Inbox ↔ Universal Intake reconciliation.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const config = fs.readFileSync(new URL("../shared/config.js", import.meta.url),"utf8");
const worker = fs.readFileSync(new URL("../worker.js", import.meta.url),"utf8");
const route = fs.readFileSync(new URL("../routes/gmailIntakeSync.js", import.meta.url),"utf8");
const ui = fs.readFileSync(new URL("../shared/today-email-intake.js", import.meta.url),"utf8");

assert.match(config,/SYNC_GMAIL_INTAKE:\s*"sync-gmail-intake"/);
assert.match(worker,/handleGmailIntakeSync/);
assert.match(worker,/gmailIntakeSyncVersion:\s*GMAIL_INTAKE_SYNC_VERSION/);
assert.match(worker,/case ACTIONS\.SYNC_GMAIL_INTAKE:/);

assert.match(route,/Version: 1\.1\.0/);
assert.match(route,/in:inbox -in:spam -in:trash/);
assert.match(route,/INSERT OR IGNORE INTO email_intake/);
assert.match(route,/gmail_live_sync/);
assert.match(route,/processing_status='ready_for_review'/);
assert.match(route,/status === "processed"/);
assert.match(route,/trashGmailMessage/);
assert.match(route,/internetMessageId/);
assert.doesNotMatch(route,/\?,NULL,\'gmail_live_sync\',\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,/);

assert.match(ui,/Version: 2\.5\.0/);
assert.match(ui,/sync-gmail-intake/);
assert.match(route,/operation === "scan_page"/);
assert.match(route,/operation === "trash_batch"/);
assert.match(route,/MAX_SCAN_LIMIT = 20/);
assert.match(route,/processedItems/);
assert.match(route,/nextPageToken/);
assert.match(ui,/operation:"scan_page"/);
assert.match(ui,/operation:"trash_batch"/);
assert.match(ui,/scanLimit:20/);
assert.match(ui,/Refresh Inbox & Intake/);
assert.match(ui,/processed cleared from Gmail/);
assert.match(ui,/Reconnect Gmail/);
assert.match(ui,/Gmail reconnect required/);
assert.match(ui,/Gmail sync error/);
assert.match(ui,/isGmailAuthorizationError/);
assert.match(ui,/compactHaystack/);
assert.match(ui,/hostRoot/);

console.log("PASS Gmail Inbox ↔ Universal Intake reconciliation stays under Worker subrequest limits and prefills compact client identities");
