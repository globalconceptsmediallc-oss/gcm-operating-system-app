-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0045_source_evidence_archive.sql
-- Version: 1.0.0
-- Status: Additive Production Migration
-- Purpose: Durable advertisement/source-evidence index across Radar, Prospect and Client.
-- Storage: private Cloudflare R2 optimized images and optional Google Drive originals.
-- No file upload or deletion, no automation, no mutation of existing business records.
-- Retention policy: 30 days after Closed / Archived, with cancellation upon reopening;
-- deletion eligibility is metadata only until a separately tested cleanup route exists.
-- =========================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crm_source_evidence_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  radar_id INTEGER,
  prospect_id INTEGER,
  client_id INTEGER,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  description TEXT,
  campaign_reference TEXT,
  campaign_notes TEXT,
  observed_at TEXT,
  collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retention_state TEXT NOT NULL DEFAULT 'active'
    CHECK (retention_state IN ('active','pending_deletion','hold','deleted')),
  archived_at TEXT,
  deletion_eligible_at TEXT,
  deletion_completed_at TEXT,
  retention_hold_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (radar_id IS NOT NULL OR prospect_id IS NOT NULL OR client_id IS NOT NULL),
  CHECK (deletion_eligible_at IS NULL OR archived_at IS NOT NULL),
  FOREIGN KEY (radar_id) REFERENCES crm_prospect_radar(id),
  FOREIGN KEY (prospect_id) REFERENCES crm_prospects(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX IF NOT EXISTS idx_crm_source_evidence_radar
  ON crm_source_evidence_items(radar_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_source_evidence_prospect
  ON crm_source_evidence_items(prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_source_evidence_client
  ON crm_source_evidence_items(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_source_evidence_cleanup
  ON crm_source_evidence_items(retention_state, deletion_eligible_at);

-- One storage object may be referenced by multiple campaigns or businesses.
-- Physical deletion MUST check that no active/held evidence item still links to it.
CREATE TABLE IF NOT EXISTS crm_source_evidence_objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  storage_provider TEXT NOT NULL CHECK (storage_provider IN ('r2','google_drive')),
  bucket_name TEXT,
  object_key TEXT,
  drive_file_id TEXT,
  sha256 TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  width_px INTEGER,
  height_px INTEGER,
  stored_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_verified_at TEXT,
  deleted_at TEXT,
  deletion_reason TEXT,
  CHECK ((storage_provider='r2' AND bucket_name IS NOT NULL AND object_key IS NOT NULL AND drive_file_id IS NULL)
      OR (storage_provider='google_drive' AND bucket_name IS NULL AND object_key IS NULL AND drive_file_id IS NOT NULL)),
  UNIQUE (storage_provider,bucket_name,object_key),
  UNIQUE (storage_provider,drive_file_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_source_evidence_sha256
  ON crm_source_evidence_objects(sha256, deleted_at);

CREATE TABLE IF NOT EXISTS crm_source_evidence_links (
  evidence_id INTEGER NOT NULL,
  object_id INTEGER NOT NULL,
  rendition TEXT NOT NULL CHECK (rendition IN ('original','optimized','thumbnail')),
  display_order INTEGER NOT NULL DEFAULT 0,
  linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (evidence_id,object_id),
  FOREIGN KEY (evidence_id) REFERENCES crm_source_evidence_items(id),
  FOREIGN KEY (object_id) REFERENCES crm_source_evidence_objects(id)
);

CREATE INDEX IF NOT EXISTS idx_crm_source_evidence_links_object
  ON crm_source_evidence_links(object_id,evidence_id);
