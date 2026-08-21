-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0014_gmail_monitoring_source_evidence.sql
-- Version: 1.0.0
-- Status: Production Migration
-- Purpose: Preserve the complete Gmail source and normalized evidence snapshot
--          before an approved Monitoring disposition clears unread state.
-- =========================================================

CREATE TABLE IF NOT EXISTS gmail_monitoring_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  activity_record_id INTEGER,
  source_type TEXT NOT NULL DEFAULT 'gmail',
  source_reference TEXT NOT NULL,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT,
  source_subject TEXT,
  source_sender TEXT,
  source_date TEXT,
  source_content TEXT NOT NULL,
  structured_evidence_json TEXT,
  evidence_summary TEXT,
  status TEXT NOT NULL DEFAULT 'captured_pending_validation',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (activity_record_id) REFERENCES activity_records(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gmail_monitoring_evidence_source
ON gmail_monitoring_evidence(source_reference);

CREATE INDEX IF NOT EXISTS idx_gmail_monitoring_evidence_client
ON gmail_monitoring_evidence(client_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_gmail_monitoring_evidence_activity
ON gmail_monitoring_evidence(activity_record_id);
