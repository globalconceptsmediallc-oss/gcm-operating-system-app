/* =========================================================
   Global Concepts Media Operating System
   File: tests/calendarDurability.test.js
   Version: 1.0.0
   Status: Production Test
   Purpose: Verify the durable Calendar appointment contract required by
            Calendar, Mission Control, and shared-nav deadline urgency.
   Change: Adds regression coverage for Calendar snapshot normalization,
           migration structure, and shared-shell D1 synchronization wiring.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizeCalendarSnapshotAppointment
} from "../routes/calendarOperations.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function testNormalization() {
  const result = normalizeCalendarSnapshotAppointment({
    id: 3,
    title: "Pickett Weaponry Site Audit Follow-up",
    typeId: 3,
    date: "2026-08-20",
    time: "11:00",
    location: "Google Meet",
    client: "Pickett Weaponry",
    status: "scheduled",
    notes: "Review investigation and follow-up audit."
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.scheduledAt, "2026-08-20T11:00:00");
  assert.equal(result.value.status, "scheduled");
  assert.equal(result.value.clientLabel, "Pickett Weaponry");
}

function testClosedStatusNormalization() {
  const result = normalizeCalendarSnapshotAppointment({
    id: 10,
    title: "Completed Client Meeting",
    date: "2026-08-18",
    time: "09:30",
    status: "completed"
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, "completed");
}

function testInvalidDateRejected() {
  const result = normalizeCalendarSnapshotAppointment({
    id: 11,
    title: "Invalid Calendar Record",
    date: "2026-02-31",
    time: "10:00",
    status: "scheduled"
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /valid YYYY-MM-DD date/i);
}

function testMigrationContract() {
  const migration = read("migrations/0006_calendar_appointments.sql");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS calendar_appointments/i);
  assert.match(migration, /scheduled_at TEXT NOT NULL/i);
  assert.match(migration, /deleted_at TEXT/i);
  assert.match(migration, /FOREIGN KEY \(client_id\) REFERENCES clients\(id\)/i);
}

function testShellContract() {
  const shell = read("shared/gcm-shell.js");
  const bridge = read("shared/calendar-durable-sync.js");

  assert.match(shell, /calendar-durable-sync\.js\?v=1\.0\.0/);
  assert.match(shell, /refreshNavAttention/);
  assert.match(bridge, /action:\s*ACTION/);
  assert.match(bridge, /sync_snapshot/);
  assert.match(bridge, /GCM OS Calendar connected/);
}

function testNavAttentionCalendarContract() {
  const navAttention = read("routes/navAttention.js");

  assert.match(navAttention, /"calendar_appointments"/);
  assert.match(navAttention, /"scheduled_at"/);
  assert.match(navAttention, /if \(daysUntil <= 2\) return "red"/);
  assert.match(navAttention, /if \(daysUntil <= 6\) return "yellow"/);
  assert.match(navAttention, /return "green"/);
}

const tests = [
  testNormalization,
  testClosedStatusNormalization,
  testInvalidDateRejected,
  testMigrationContract,
  testShellContract,
  testNavAttentionCalendarContract
];

for (const test of tests) {
  test();
  console.log(`PASS ${test.name}`);
}

console.log("PASS Calendar durability regression suite");
