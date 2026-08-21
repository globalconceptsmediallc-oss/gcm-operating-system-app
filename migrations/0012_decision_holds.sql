-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0012_decision_holds.sql
-- Version: 1.0.0
-- Status: Production Migration
-- Purpose: Add a lightweight, durable Decision Hold / Work Lite state for
--          source evidence that matters but is not yet ready to become Work,
--          Investigation, Monitoring, Information, or Delete.
-- =========================================================

CREATE TABLE IF NOT EXISTS decision_holds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  source_type TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  source_thread_reference TEXT,
  source_subject TEXT,
  source_sender TEXT,
  source_date TEXT,
  source_content TEXT,
  title TEXT NOT NULL,
  hold_type TEXT NOT NULL DEFAULT 'decision_question',
  question TEXT NOT NULL,
  why_it_matters TEXT,
  suggested_next_action TEXT,
  priority TEXT NOT NULL DEFAULT 'Low',
  due_date TEXT,
  review_on TEXT,
  status TEXT NOT NULL DEFAULT 'Open',
  owner TEXT NOT NULL DEFAULT 'Andy',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at TEXT,
  resolved_at TEXT,
  resolution TEXT,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_decision_holds_source_active
ON decision_holds(source_reference)
WHERE LOWER(COALESCE(status, 'open')) IN ('open', 'held', 'waiting');

CREATE INDEX IF NOT EXISTS idx_decision_holds_client_status
ON decision_holds(client_id, status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_decision_holds_review
ON decision_holds(status, review_on, due_date);
