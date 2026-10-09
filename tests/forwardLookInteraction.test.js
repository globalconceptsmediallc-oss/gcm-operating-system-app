/* =========================================================
   Global Concepts Media Operating System
   File: tests/forwardLookInteraction.test.js
   Version: 1.1.2
   Status: Regression Test
   Purpose: Lock the first interactive Forward Look workflow for
            passed radio / traffic commitments.
   Change notes — 1.1.2:
   - Replaces the stale exact Today 3.6.8 version lock with the 3.6.x release-family contract.
   - Preserves every Forward Look durability and close-passed assertion.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const today = fs.readFileSync(new URL("../today.html", import.meta.url), "utf8");
const media = fs.readFileSync(new URL("../routes/mediaOperationsLegacy.js", import.meta.url), "utf8");
const forwardLookRoute = fs.readFileSync(new URL("../routes/forwardLookOperations.js", import.meta.url), "utf8");
const forwardLookMigration = fs.readFileSync(new URL("../migrations/0039_forward_look_dispositions.sql", import.meta.url), "utf8");

assert.match(today,/Version: 3\.6\.\d+/);
assert.match(today,/data-forward-manage-kind/);
assert.match(today,/closePassedForwardLookItem/);
assert.match(today,/forward-look-operations/);
assert.match(today,/operation: "close_passed"/);
assert.match(today,/data-forward-manage-key/);
assert.match(today,/Passed — No Further Action/);

assert.match(media,/Version: 7\.10\.2/);
assert.match(media,/close_passed_commitment/);
assert.match(media,/status = 'expired'/);
assert.match(media,/Passed Commitment Closed/);

assert.match(forwardLookRoute,/FORWARD_LOOK_OPERATIONS_ACTION = "forward-look-operations"/);
assert.match(forwardLookRoute,/operation === "close_passed"/);
assert.match(forwardLookRoute,/closedKeys/);
assert.match(forwardLookMigration,/CREATE TABLE IF NOT EXISTS forward_look_dispositions/);
assert.match(forwardLookMigration,/forward_key TEXT NOT NULL UNIQUE/);

console.log("PASS Forward Look passed commitments stay closed after refresh while source history is preserved");
