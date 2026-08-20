/* =========================================================
   Global Concepts Media Operating System
   File: tests/calendarDurability.test.js
   Version: 1.1.0
   Status: Production Test
   Source: tests/calendarDurability.test.js 1.0.0
   Sprint: Media → Calendar Natural Workflow
   Purpose:
   Verify the durable Calendar contract plus the Media production-session
   connection that drives Calendar and Media urgency from one scheduled record.

   Change Notes — 1.1.0
   - Preserves Calendar normalization and migration regression coverage.
   - Verifies migration 0011 production-session structure.
   - Verifies Media workflow exposes save/complete production sessions.
   - Verifies Media sessions write connected calendar_appointments.
   - Verifies navAttention reads media_production_sessions.
   - Verifies shared shell loads media-production-sessions.js v1.0.0.
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
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8"
  );
}

function testNormalization() {
  const result =
    normalizeCalendarSnapshotAppointment({
      id: 3,
      title:
        "Pickett Weaponry Site Audit Follow-up",
      typeId: 3,
      date: "2026-08-20",
      time: "11:00",
      location: "Google Meet",
      client: "Pickett Weaponry",
      status: "scheduled",
      notes:
        "Review investigation and follow-up audit."
    });

  assert.equal(result.ok, true);
  assert.equal(
    result.value.scheduledAt,
    "2026-08-20T11:00:00"
  );
  assert.equal(
    result.value.status,
    "scheduled"
  );
  assert.equal(
    result.value.clientLabel,
    "Pickett Weaponry"
  );
}

function testClosedStatusNormalization() {
  const result =
    normalizeCalendarSnapshotAppointment({
      id: 10,
      title: "Completed Client Meeting",
      date: "2026-08-18",
      time: "09:30",
      status: "completed"
    });

  assert.equal(result.ok, true);
  assert.equal(
    result.value.status,
    "completed"
  );
}

function testInvalidDateRejected() {
  const result =
    normalizeCalendarSnapshotAppointment({
      id: 11,
      title: "Invalid Calendar Record",
      date: "2026-02-31",
      time: "10:00",
      status: "scheduled"
    });

  assert.equal(result.ok, false);

  assert.match(
    result.error,
    /valid YYYY-MM-DD date/i
  );
}

function testCalendarMigrationContract() {
  const migration =
    read(
      "migrations/0006_calendar_appointments.sql"
    );

  assert.match(
    migration,
    /CREATE TABLE IF NOT EXISTS calendar_appointments/i
  );

  assert.match(
    migration,
    /scheduled_at TEXT NOT NULL/i
  );

  assert.match(
    migration,
    /deleted_at TEXT/i
  );

  assert.match(
    migration,
    /FOREIGN KEY \(client_id\) REFERENCES clients\(id\)/i
  );
}

function testMediaSessionMigrationContract() {
  const migration =
    read(
      "migrations/0011_media_production_sessions.sql"
    );

  assert.match(
    migration,
    /CREATE TABLE IF NOT EXISTS media_production_sessions/i
  );

  assert.match(
    migration,
    /scheduled_at TEXT NOT NULL/i
  );

  assert.match(
    migration,
    /CREATE TABLE IF NOT EXISTS media_production_session_creatives/i
  );

  assert.match(
    migration,
    /FOREIGN KEY \(creative_id\)[\s\S]*REFERENCES media_creatives\(id\)/i
  );
}

function testShellContract() {
  const shell =
    read("shared/gcm-shell.js");

  const bridge =
    read(
      "shared/calendar-durable-sync.js"
    );

  assert.match(
    shell,
    /calendar-durable-sync\.js\?v=1\.0\.0/
  );

  assert.match(
    shell,
    /media-production-sessions\.js\?v=1\.0\.0/
  );

  assert.match(
    shell,
    /refreshNavAttention/
  );

  assert.match(
    bridge,
    /action:\s*ACTION/
  );

  assert.match(
    bridge,
    /sync_snapshot/
  );

  assert.match(
    bridge,
    /GCM OS Calendar connected/
  );
}

function testMediaSessionRouteContract() {
  const mediaRoute =
    read(
      "routes/mediaCreativeWorkflow.js"
    );

  assert.match(
    mediaRoute,
    /MEDIA_CREATIVE_WORKFLOW_VERSION = "1\.1\.0"/
  );

  assert.match(
    mediaRoute,
    /"save_production_session"/
  );

  assert.match(
    mediaRoute,
    /"complete_production_session"/
  );

  assert.match(
    mediaRoute,
    /INSERT INTO calendar_appointments/
  );

  assert.match(
    mediaRoute,
    /media_production_session:/
  );

  assert.match(
    mediaRoute,
    /media_production_session_creatives/
  );
}

function testNavAttentionCalendarContract() {
  const navAttention =
    read(
      "routes/navAttention.js"
    );

  assert.match(
    navAttention,
    /"calendar_appointments"/
  );

  assert.match(
    navAttention,
    /"scheduled_at"/
  );

  assert.match(
    navAttention,
    /if \(daysUntil <= 2\) return "red"/
  );

  assert.match(
    navAttention,
    /if \(daysUntil <= 6\) return "yellow"/
  );

  assert.match(
    navAttention,
    /return "green"/
  );
}

function testMediaNavAttentionContract() {
  const navAttention =
    read(
      "routes/navAttention.js"
    );

  assert.match(
    navAttention,
    /"media_production_sessions"/
  );

  assert.match(
    navAttention,
    /media_production_sessions\.scheduled_at/
  );
}

const tests = [
  testNormalization,
  testClosedStatusNormalization,
  testInvalidDateRejected,
  testCalendarMigrationContract,
  testMediaSessionMigrationContract,
  testShellContract,
  testMediaSessionRouteContract,
  testNavAttentionCalendarContract,
  testMediaNavAttentionContract
];

for (const test of tests) {
  test();
  console.log(
    `PASS ${test.name}`
  );
}

console.log(
  "PASS Calendar + Media production-session durability regression suite"
);
