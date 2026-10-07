/* =========================================================
   Global Concepts Media Operating System
   File: tests/forwardLookInteraction.test.js
   Version: 1.0.0
   Status: Regression Test
   Purpose: Lock the first interactive Forward Look workflow for
            passed radio / traffic commitments.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const today = fs.readFileSync(new URL("../today.html", import.meta.url), "utf8");
const schedule = fs.readFileSync(new URL("../routes/scheduleOperations.js", import.meta.url), "utf8");
const media = fs.readFileSync(new URL("../routes/mediaOperationsLegacy.js", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../migrations/0038_forward_look_event_dispositions.sql", import.meta.url), "utf8");

assert.match(today,/Version: 3\.6\.6/);
assert.match(today,/data-forward-manage-kind/);
assert.match(today,/closePassedForwardLookItem/);
assert.match(today,/operation: "close_event"/);
assert.match(today,/operation: "close_passed_commitment"/);
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

assert.match(migration,/CREATE TABLE IF NOT EXISTS schedule_event_dispositions/);
assert.match(migration,/event_key TEXT NOT NULL UNIQUE/);

console.log("PASS Forward Look passed radio/traffic commitments are interactive and history-preserving");
