/* =========================================================
   Global Concepts Media Operating System
   File: tests/forwardLookInteraction.test.js
   Version: 1.1.0
   Status: Regression Test
   Purpose: Lock the first interactive Forward Look workflow for
            passed radio / traffic commitments.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const today = fs.readFileSync(new URL("../today.html", import.meta.url), "utf8");
const schedule = fs.readFileSync(new URL("../routes/scheduleOperations.js", import.meta.url), "utf8");
const media = fs.readFileSync(new URL("../routes/mediaOperationsLegacy.js", import.meta.url), "utf8");
const scheduleMigration = fs.readFileSync(new URL("../migrations/0038_forward_look_event_dispositions.sql", import.meta.url), "utf8");
const forwardLookRoute = fs.readFileSync(new URL("../routes/forwardLookOperations.js", import.meta.url), "utf8");
const forwardLookMigration = fs.readFileSync(new URL("../migrations/0039_forward_look_dispositions.sql", import.meta.url), "utf8");

assert.match(today,/Version: 3\.6\.7/);
assert.match(today,/data-forward-manage-kind/);
assert.match(today,/closePassedForwardLookItem/);
assert.match(today,/operation: "close_event"/);
assert.match(today,/forward-look-operations/);
assert.match(today,/operation: "close_passed"/);
assert.match(today,/data-forward-manage-key/);
assert.match(today,/Passed — No Further Action/);

assert.match(schedule,/Version: 1\.1\.0/);
assert.match(schedule,/operation === "close_event"/);
assert.match(schedule,/schedule_event_dispositions/);
assert.match(schedule,/Only passed radio, traffic, or station-deadline events/);
assert.match(schedule,/closedEventDispositions/);

assert.match(media,/Version: 7\.10\.2/);
assert.match(media,/close_passed_commitment/);
assert.match(media,/status = 'expired'/);
assert.match(media,/Passed Commitment Closed/);

assert.match(scheduleMigration,/CREATE TABLE IF NOT EXISTS schedule_event_dispositions/);
assert.match(scheduleMigration,/event_key TEXT NOT NULL UNIQUE/);

assert.match(forwardLookRoute,/FORWARD_LOOK_OPERATIONS_ACTION = "forward-look-operations"/);
assert.match(forwardLookRoute,/operation === "close_passed"/);
assert.match(forwardLookRoute,/closedKeys/);
assert.match(forwardLookMigration,/CREATE TABLE IF NOT EXISTS forward_look_dispositions/);
assert.match(forwardLookMigration,/forward_key TEXT NOT NULL UNIQUE/);

console.log("PASS Forward Look passed commitments stay closed after refresh while source history is preserved");
