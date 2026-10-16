-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0047_social_publishing_operator_records.sql
-- Version: 1.0.0
-- Status: Additive Production Migration
-- Purpose: Attribute verified scheduled publishing separately from
--          authoritative Forward Look outcomes and dedupe extra placements.
-- Never rewrite previous publishing status, proof, or schedule history.
-- =========================================================
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS social_publishing_authorship (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  schedule_item_id INTEGER NOT NULL,
  forward_key TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('Facebook','Google Business Profile','Instagram','YouTube','Other')),
  published_by TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(forward_key,platform),
  FOREIGN KEY(client_id) REFERENCES clients(id),
  FOREIGN KEY(schedule_item_id) REFERENCES schedule_items(id)
);
CREATE INDEX IF NOT EXISTS idx_social_publishing_authorship_client
  ON social_publishing_authorship(client_id,schedule_item_id);
CREATE TABLE IF NOT EXISTS social_publishing_authorship_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  authorship_id INTEGER NOT NULL,
  prior_published_by TEXT,
  new_published_by TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(authorship_id) REFERENCES social_publishing_authorship(id)
);
ALTER TABLE social_publishing_posts ADD COLUMN external_dedupe_key TEXT;
ALTER TABLE social_publishing_posts ADD COLUMN related_forward_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_publishing_additional_dedupe
  ON social_publishing_posts(client_id,external_dedupe_key)
  WHERE source_kind='additional' AND external_dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_publishing_additional_related
  ON social_publishing_posts(related_forward_key)
  WHERE related_forward_key IS NOT NULL;
