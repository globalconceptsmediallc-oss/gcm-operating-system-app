 -- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0010_prospect_radar_continuity.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Complete the pre-appointment Prospecting Radar cycle by preserving
--          research intelligence, outreach history, and dated follow-up state.
-- Change Notes:
-- - Adds last outreach and dated Next Action fields to Radar.
-- - Adds durable Radar activity/contact history.
-- - Adds durable Radar intelligence records.
-- - Supports automatic transfer of both histories when Radar becomes a Prospect.
-- - Additive only; no existing Radar, Prospect, CRM, or Client record is deleted.
-- =========================================================

PRAGMA foreign_keys = ON;

ALTER TABLE crm_prospect_radar ADD COLUMN last_outreach_at TEXT;
ALTER TABLE crm_prospect_radar ADD COLUMN next_action_title TEXT;
ALTER TABLE crm_prospect_radar ADD COLUMN next_action_due_date TEXT;

CREATE TABLE IF NOT EXISTS crm_prospect_radar_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  radar_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  direction TEXT,
  subject TEXT,
  summary TEXT NOT NULL,
  outcome TEXT,
  meaningful_contact INTEGER NOT NULL DEFAULT 0,
  source_type TEXT,
  source_reference TEXT,
  external_key TEXT UNIQUE,
  notes TEXT,
  promoted_prospect_activity_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (radar_id) REFERENCES crm_prospect_radar(id),
  FOREIGN KEY (promoted_prospect_activity_id) REFERENCES crm_prospect_activities(id)
);

CREATE INDEX IF NOT EXISTS idx_crm_radar_activities_radar
  ON crm_prospect_radar_activities(radar_id, occurred_at, id);

CREATE TABLE IF NOT EXISTS crm_prospect_radar_intelligence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  radar_id INTEGER NOT NULL,
  intelligence_type TEXT NOT NULL DEFAULT 'prospect_research',
  title TEXT NOT NULL,
  summary TEXT,
  intelligence_json TEXT,
  source_type TEXT,
  source_reference TEXT,
  external_key TEXT UNIQUE,
  captured_at TEXT NOT NULL,
  promoted_prospect_intelligence_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (radar_id) REFERENCES crm_prospect_radar(id),
  FOREIGN KEY (promoted_prospect_intelligence_id) REFERENCES crm_prospect_intelligence(id)
);

CREATE INDEX IF NOT EXISTS idx_crm_radar_intelligence_radar
  ON crm_prospect_radar_intelligence(radar_id, captured_at, id);

CREATE INDEX IF NOT EXISTS idx_crm_radar_next_action
  ON crm_prospect_radar(status, next_action_due_date);
