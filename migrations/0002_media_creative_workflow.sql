-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0002_media_creative_workflow.sql
-- Version: 1.0.0
-- Status: Production Candidate
-- Sprint: Media Creative Workflow + Traffic Confirmation
-- Purpose: Separate reusable creative production from annual media placements
--          while preserving full production history, market assignments,
--          station traffic packages, and confirmation evidence.
-- =========================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS media_creatives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  creative_name TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'Radio',
  length_seconds INTEGER,
  isci TEXT,
  current_stage TEXT NOT NULL DEFAULT 'Idea / Direction',
  status TEXT NOT NULL DEFAULT 'draft',
  idea_direction TEXT,
  working_script TEXT,
  approved_script TEXT,
  final_script TEXT,
  voice_talent TEXT,
  recording_status TEXT,
  recording_received_date TEXT,
  recording_review_notes TEXT,
  production_status TEXT,
  final_audio_file_name TEXT,
  coop_script TEXT,
  owner TEXT NOT NULL DEFAULT 'Andy',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS media_creative_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creative_id INTEGER NOT NULL,
  media_record_id INTEGER,
  media_type TEXT NOT NULL DEFAULT 'Radio',
  market TEXT NOT NULL,
  outlet_name TEXT NOT NULL,
  placement_reference TEXT,
  rotation_action TEXT NOT NULL DEFAULT 'add_to_rotation',
  assignment_status TEXT NOT NULL DEFAULT 'planned',
  rotation_start_date TEXT,
  rotation_end_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creative_id) REFERENCES media_creatives(id),
  FOREIGN KEY (media_record_id) REFERENCES media_records(id),
  UNIQUE (creative_id, market, outlet_name)
);

CREATE TABLE IF NOT EXISTS media_creative_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creative_id INTEGER NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'production_note',
  stage TEXT,
  author TEXT NOT NULL DEFAULT 'Andy',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creative_id) REFERENCES media_creatives(id)
);

CREATE TABLE IF NOT EXISTS media_traffic_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creative_id INTEGER NOT NULL,
  to_email TEXT,
  cc_email TEXT,
  subject TEXT,
  body_text TEXT,
  special_instructions TEXT,
  insertion_order_reference TEXT,
  schedule_reference TEXT,
  package_status TEXT NOT NULL DEFAULT 'draft',
  gmail_draft_id TEXT,
  gmail_thread_id TEXT,
  sent_gmail_message_id TEXT,
  sent_at TEXT,
  confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creative_id) REFERENCES media_creatives(id)
);

CREATE TABLE IF NOT EXISTS media_traffic_package_assignments (
  traffic_package_id INTEGER NOT NULL,
  assignment_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (traffic_package_id, assignment_id),
  FOREIGN KEY (traffic_package_id) REFERENCES media_traffic_packages(id),
  FOREIGN KEY (assignment_id) REFERENCES media_creative_assignments(id)
);

CREATE TABLE IF NOT EXISTS media_confirmation_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  from_email TEXT,
  to_email TEXT,
  subject TEXT,
  received_at TEXT,
  body_text TEXT NOT NULL,
  station_received_confirmed INTEGER NOT NULL DEFAULT 0,
  station_trafficked_confirmed INTEGER NOT NULL DEFAULT 0,
  approved_by TEXT NOT NULL DEFAULT 'Andy',
  approved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_confirmation_gmail_message
  ON media_confirmation_evidence(gmail_message_id)
  WHERE gmail_message_id IS NOT NULL AND gmail_message_id <> '';

CREATE TABLE IF NOT EXISTS media_confirmation_links (
  confirmation_id INTEGER NOT NULL,
  traffic_package_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (confirmation_id, traffic_package_id),
  FOREIGN KEY (confirmation_id) REFERENCES media_confirmation_evidence(id),
  FOREIGN KEY (traffic_package_id) REFERENCES media_traffic_packages(id)
);

CREATE INDEX IF NOT EXISTS idx_media_creatives_client_status
  ON media_creatives(client_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_creative_assignments_creative
  ON media_creative_assignments(creative_id, assignment_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_creative_history_creative
  ON media_creative_history(creative_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_traffic_packages_creative
  ON media_traffic_packages(creative_id, updated_at DESC);
