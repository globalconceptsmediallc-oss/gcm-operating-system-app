-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0011_media_production_sessions.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Sprint: Media → Calendar Natural Workflow
-- Purpose:
--   Create durable Media production-session records that can link one
--   scheduled session to one or more Media creatives and create one
--   connected Calendar appointment.
--
-- Change Notes:
-- - Adds media_production_sessions.
-- - Adds media_production_session_creatives.
-- - Supports recording, script review, production, and other Media sessions.
-- - Does not modify or delete existing Media, Calendar, Work, or Proof records.
-- =========================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS media_production_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'recording',
  title TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  time_zone TEXT NOT NULL DEFAULT 'America/New_York',
  location TEXT,
  contact_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS media_production_session_creatives (
  session_id INTEGER NOT NULL,
  creative_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, creative_id),
  FOREIGN KEY (session_id)
    REFERENCES media_production_sessions(id)
    ON DELETE CASCADE,
  FOREIGN KEY (creative_id)
    REFERENCES media_creatives(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_production_sessions_scheduled
  ON media_production_sessions(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_media_production_sessions_client
  ON media_production_sessions(client_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_media_production_session_creatives_creative
  ON media_production_session_creatives(creative_id, session_id);
