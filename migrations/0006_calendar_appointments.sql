-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0006_calendar_appointments.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Create the durable Calendar appointment record required by
--          Mission Control, shared-nav urgency, and cross-device history.
-- Change: Additive only. No existing table or record is modified.
-- =========================================================

CREATE TABLE IF NOT EXISTS calendar_appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  title TEXT NOT NULL,
  appointment_type_id INTEGER,
  scheduled_at TEXT NOT NULL,
  time_zone TEXT NOT NULL DEFAULT 'America/New_York',
  location TEXT,
  address TEXT,
  contact_email TEXT,
  client_label TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  source TEXT NOT NULL DEFAULT 'gcm_os_calendar',
  source_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_appointments_source_key
  ON calendar_appointments(source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_appointments_scheduled_at
  ON calendar_appointments(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_calendar_appointments_status_scheduled
  ON calendar_appointments(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_calendar_appointments_client
  ON calendar_appointments(client_id, scheduled_at);
