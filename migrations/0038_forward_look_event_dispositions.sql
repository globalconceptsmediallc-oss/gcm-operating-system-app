-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0038_forward_look_event_dispositions.sql
-- Version: 1.0.0
-- Status: Production Migration
-- Purpose: Preserve closed historical schedule-event decisions so
--          Forward Look can clear passed radio/traffic obligations
--          without deleting the parent schedule record.
-- =========================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schedule_event_dispositions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key TEXT NOT NULL UNIQUE,
  schedule_item_id INTEGER,
  disposition TEXT NOT NULL DEFAULT 'closed_passed',
  reason TEXT,
  reviewed_by TEXT,
  closed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(schedule_item_id) REFERENCES schedule_items(id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_event_dispositions_item
  ON schedule_event_dispositions(schedule_item_id, disposition, closed_at);
