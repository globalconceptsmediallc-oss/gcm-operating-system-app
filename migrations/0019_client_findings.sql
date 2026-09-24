-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0019_client_findings.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Sprint: Signal Review — Human Findings Capture
-- Purpose:
-- Preserve the final business details learned during a human-led review without
-- turning the source email or every investigative step into Proof or Work.
-- =========================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS client_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'Marketing Intelligence',
  source_type TEXT NOT NULL DEFAULT 'email_intake_review',
  source_reference TEXT NOT NULL,
  source_title TEXT,
  source_date TEXT,
  reporting_period TEXT,
  details TEXT NOT NULL DEFAULT '',
  analysis TEXT NOT NULL DEFAULT '',
  decision TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT 'Andrew',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  UNIQUE (source_type, source_reference)
);

ALTER TABLE email_intake
  ADD COLUMN finding_id INTEGER REFERENCES client_findings(id);

CREATE INDEX IF NOT EXISTS idx_client_findings_client_date
  ON client_findings(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_findings_source
  ON client_findings(source_type, source_reference);

CREATE INDEX IF NOT EXISTS idx_email_intake_finding
  ON email_intake(finding_id);
