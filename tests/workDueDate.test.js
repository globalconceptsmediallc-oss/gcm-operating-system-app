/* =========================================================
   Global Concepts Media Operating System
   File: tests/workDueDate.test.js
   Version: 1.0.0
   Status: Production Regression Test
   Purpose: Verify the durable Work due-date contract stays wired from
            migration through route, UI enhancement, and nav urgency.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const migration = read("migrations/0007_work_item_due_date.sql");
const route = read("routes/workItemProcessing.js");
const enhancement = read("shared/work-due-date.js");
const shell = read("shared/gcm-shell.js");
const navAttention = read("routes/navAttention.js");

assert.match(migration, /ALTER TABLE work_items ADD COLUMN due_date TEXT/i);
assert.match(route, /Version: 7\.6\.0/);
assert.match(route, /body\?\.dueDate \|\| body\?\.due_date/);
assert.match(route, /expected_impact, due_date,/);
assert.match(route, /dueDate:r\.due_date/);
assert.match(route, /dueDate must be a valid calendar date in YYYY-MM-DD format/);

assert.match(enhancement, /id=\"requested-due-date\"/);
assert.match(enhancement, /payload\.dueDate = dueDateValue\(\) \|\| null/);
assert.match(enhancement, /refreshNavAttention/);

assert.match(shell, /Version: 2\.0\.22/);
assert.match(shell, /shared\/work-due-date\.js\?v=1\.0\.0/);
assert.match(navAttention, /\["due_at", "due_date", "deadline", "scheduled_for", "review_due_at"\]/);

console.log("PASS Work durable due-date contract");
