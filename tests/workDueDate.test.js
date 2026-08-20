/* =========================================================
   Global Concepts Media Operating System
   File: tests/workDueDate.test.js
   Version: 1.0.2
   Status: Production Regression Test
   Source: tests/workDueDate.test.js 1.0.1
   Purpose: Verify the durable Work due-date contract stays wired from
            migration through route, UI enhancement, and nav urgency.
   Change notes — 1.0.2:
   - Replaces a formatting-sensitive navAttention assertion with a semantic
     Work source-definition check that allows multiline formatting.
   - Preserves every existing Work due-date contract assertion.
   - Does not change production Work or navAttention behavior.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(
    new URL(`../${path}`, import.meta.url),
    "utf8"
  );
}

const migration =
  read("migrations/0007_work_item_due_date.sql");

const route =
  read("routes/workItemProcessing.js");

const enhancement =
  read("shared/work-due-date.js");

const shell =
  read("shared/gcm-shell.js");

const navAttention =
  read("routes/navAttention.js");

assert.match(
  migration,
  /ALTER TABLE work_items ADD COLUMN due_date TEXT/i
);

assert.match(
  route,
  /Version: 7\.6\.0/
);

assert.match(
  route,
  /body\?\.dueDate \|\| body\?\.due_date/
);

assert.match(
  route,
  /expected_impact, due_date,/
);

assert.match(
  route,
  /dueDate:r\.due_date/
);

assert.match(
  route,
  /dueDate must be a valid calendar date in YYYY-MM-DD format/
);

assert.match(
  enhancement,
  /const FIELD_ID = "requested-due-date"/
);

assert.match(
  enhancement,
  /<input id="\$\{FIELD_ID\}" type="date"/
);

assert.match(
  enhancement,
  /payload\.dueDate = dueDateValue\(\) \|\| null/
);

assert.match(
  enhancement,
  /refreshNavAttention/
);

assert.match(
  shell,
  /shared\/work-due-date\.js\?v=1\.0\.0/
);

assert.match(
  navAttention,
  /source\(\s*"work_items",\s*\[\s*"due_at",\s*"due_date",\s*"deadline",\s*"scheduled_for",\s*"review_due_at"\s*\]/
);

console.log(
  "PASS Work durable due-date contract"
);
