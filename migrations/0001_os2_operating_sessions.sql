/* =========================================================
   Global Concepts Media Operating System
   File: migrations/0001_os2_operating_sessions.sql
   Version: 1.0.0
   Status: OS 2.0 Migration Candidate — Not Applied
   Purpose:
   Add the durable Operating Session foundation without deleting,
   rewriting, or reclassifying any OS 1.0 production record.
   ========================================================= */

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS operating_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  issue_summary TEXT NOT NULL,
  business_reason TEXT,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  status TEXT NOT NULL DEFAULT 'detected'
    CHECK (status IN (
      'detected',
      'needs_decision',
      'working_with_ai',
      'awaiting_verification',
      'verified',
      'proof_recorded',
      'closed'
    )),
  source_communication_id INTEGER,
  openai_conversation_id TEXT,
  opened_by TEXT NOT NULL DEFAULT 'Andy',
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TEXT,
  proof_recorded_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (source_communication_id) REFERENCES communications(id),
  UNIQUE (id, client_id)
);

CREATE TABLE IF NOT EXISTS operating_session_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operating_session_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  evidence_type TEXT NOT NULL
    CHECK (evidence_type IN (
      'email',
      'link',
      'written',
      'file',
      'screenshot',
      'test_result',
      'verification'
    )),
  source_label TEXT NOT NULL,
  source_locator TEXT,
  raw_content TEXT,
  source_facts_json TEXT NOT NULL DEFAULT '[]',
  ai_interpretation TEXT,
  human_verification_note TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN (
      'unverified',
      'verified',
      'limited',
      'rejected'
    )),
  content_sha256 TEXT,
  captured_by TEXT NOT NULL DEFAULT 'Andy',
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (operating_session_id, client_id)
    REFERENCES operating_sessions(id, client_id),
  UNIQUE (id, operating_session_id, client_id)
);

CREATE TABLE IF NOT EXISTS operating_session_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operating_session_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  entry_type TEXT NOT NULL
    CHECK (entry_type IN (
      'human_note',
      'ai_interpretation',
      'decision',
      'action',
      'result',
      'verification',
      'system'
    )),
  author_type TEXT NOT NULL
    CHECK (author_type IN ('human', 'ai', 'system')),
  author_name TEXT,
  content TEXT NOT NULL,
  source_evidence_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (operating_session_id, client_id)
    REFERENCES operating_sessions(id, client_id),
  FOREIGN KEY (source_evidence_id, operating_session_id, client_id)
    REFERENCES operating_session_evidence(id, operating_session_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_operating_sessions_client_status
  ON operating_sessions(client_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_operating_session_evidence_session
  ON operating_session_evidence(operating_session_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_operating_session_entries_session
  ON operating_session_entries(operating_session_id, created_at ASC);
