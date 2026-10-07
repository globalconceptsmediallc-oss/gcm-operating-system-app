-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0039_forward_look_dispositions.sql
-- Version: 1.0.0
-- Status: Production Migration
-- Purpose: Persist exact Forward Look row dispositions independently from
--          the authoritative source record that produced the row.
-- =========================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS forward_look_dispositions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  forward_key TEXT NOT NULL UNIQUE,
  kind TEXT,
  title TEXT,
  disposition TEXT NOT NULL,
  reason TEXT,
  reviewed_by TEXT,
  closed_at TEXT,
  reopened_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forward_look_dispositions_state
  ON forward_look_dispositions(disposition, updated_at);
