-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0043_growth_review_issue_selections.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose:
-- Persist explicit human Include / Exclude decisions for Growth Review
-- candidate operational records by client and exact reporting period.
--
-- Rules:
-- - One decision per client + exact period + operational record.
-- - Decisions are period-specific; September does not imply Quarter/Year.
-- - No Investigation, Work Item, Finding, Proof, or source evidence is changed.
-- - Human selection only; no AI or generator decision is stored here.
-- =========================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS growth_review_issue_selections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  review_period_type TEXT NOT NULL DEFAULT 'custom',
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  selection TEXT NOT NULL,
  decision_note TEXT,
  decided_by TEXT NOT NULL DEFAULT 'Andy',
  decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (client_id) REFERENCES clients(id),

  UNIQUE (client_id, period_start, period_end, record_type, record_id),

  CHECK (review_period_type IN ('monthly','quarterly','yearly','custom')),
  CHECK (record_type IN ('investigation','work_item')),
  CHECK (selection IN ('include','exclude')),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_growth_review_issue_selections_period
  ON growth_review_issue_selections(client_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_growth_review_issue_selections_record
  ON growth_review_issue_selections(record_type, record_id);
