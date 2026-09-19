/* =========================================================
   Global Concepts Media Operating System
   File: tests/workDueDate.test.js
   Version: 1.1.3
   Status: Production Regression Test
   Source: tests/workDueDate.test.js 1.1.1
   Purpose: Verify the durable Work due-date contract and the Work Queue
            visibility contract stay wired in production.
   Change notes — 1.1.3:
   - Recognizes shared/work-due-date.js 1.0.1 as the intentional Safari isolation build.
   - Keeps durable D1 due-date, Work route, navigation attention, and queue-visibility
     assertions active while the Work-only browser enhancement remains disabled.

   Change notes — 1.1.2:
   - Replaces the stale exact Work page version lock with a 1.9.x release-family check.
   - Keeps this regression test focused on the durable due-date and queue visibility behavior it owns.

   Change notes — 1.1.1:
   - Updates the Work page production version lock from 1.9.17 to 1.9.18 after the external-validation monitoring UI release.
   - Preserves the complete durable due-date and queue visibility contract.

   Change notes — 1.1.0:
   - Preserves every existing Work due-date contract assertion.
   - Requires the main Open Work Items panel to show all open work for the
     current client filter instead of hiding unrelated work when an
     Investigation is selected.
   - Requires a selected Investigation to prioritize its linked Work Item
     without filtering direct requested work or other open Work Items away.
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

const workPage =
  read("work.html");

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
  /Version: 1\.0\.1/
);

assert.match(
  enhancement,
  /Status: Temporary Isolation Candidate/
);

assert.match(
  enhancement,
  /temporarily disabled for Safari navigation isolation/
);

assert.match(
  shell,
  /shared\/work-due-date\.js\?v=1\.0\.0/
);

assert.match(
  navAttention,
  /source\(\s*"work_items",\s*\[\s*"due_at",\s*"due_date",\s*"deadline",\s*"scheduled_for",\s*"review_due_at"\s*\]/
);

assert.match(
  workPage,
  /Version: 1\.9\.\d+/
);

assert.match(
  workPage,
  /const visibleWorkItems=workItems\.filter\(item=>/
);

assert.match(
  workPage,
  /const linkedToSelectedInvestigation=item=>/
);

assert.doesNotMatch(
  workPage,
  /const linkedWorkItems=selectedInvestigation\s*\?/
);

assert.match(
  workPage,
  /No open Work Items match this view\./
);

console.log(
  "PASS Work durable due-date and queue visibility contracts"
);
