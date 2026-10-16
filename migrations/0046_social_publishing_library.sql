-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0046_social_publishing_library.sql
-- Version: 1.0.0
-- Status: Additive Production Migration
-- Purpose: A durable, client-scoped publishing catalog for scheduled and
--          additional social placements, with optional creative references.
--
-- PHASE 1 BOUNDARY:
-- - Creates EMPTY tables only. No source schedule, dispositions, proof, or
--   clients are copied, rewritten, deleted, or backfilled.
-- - Existing scheduled outcomes remain authoritative in
--   forward_look_dispositions until an explicit migration is approved.
-- - Future supplemental placements can be linked without fabricating a
--   scheduled commitment; no upload endpoint is enabled here.
-- - Dedicated creative storage remains undecided; object references only.
-- =========================================================
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS social_publishing_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  schedule_item_id INTEGER,
  schedule_forward_key TEXT UNIQUE,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('scheduled','additional')),
  campaign_title TEXT NOT NULL,
  post_title TEXT NOT NULL,
  planned_date TEXT,
  caption_text TEXT,
  created_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (source_kind='scheduled' AND schedule_item_id IS NOT NULL AND schedule_forward_key IS NOT NULL AND planned_date IS NOT NULL)
    OR (source_kind='additional' AND schedule_item_id IS NULL AND schedule_forward_key IS NULL)
  ),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (schedule_item_id) REFERENCES schedule_items(id)
);
CREATE INDEX IF NOT EXISTS idx_social_publishing_posts_client_date
  ON social_publishing_posts(client_id,planned_date DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_social_publishing_posts_schedule
  ON social_publishing_posts(schedule_item_id);

CREATE TABLE IF NOT EXISTS social_publishing_placements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('Facebook','Instagram','Google Business Profile','YouTube','Other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','missed')),
  actual_published_date TEXT,
  proof_reference TEXT,
  published_by TEXT,
  recorded_by TEXT,
  evidence_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (post_id,platform),
  CHECK (status!='published' OR (actual_published_date IS NOT NULL AND proof_reference IS NOT NULL)),
  FOREIGN KEY (post_id) REFERENCES social_publishing_posts(id)
);
CREATE INDEX IF NOT EXISTS idx_social_publishing_placements_platform_date
  ON social_publishing_placements(platform,actual_published_date);

CREATE TABLE IF NOT EXISTS social_publishing_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image','video','caption','document','other')),
  asset_label TEXT NOT NULL,
  storage_provider TEXT NOT NULL CHECK (storage_provider IN ('r2','google_drive','external_url')),
  storage_reference TEXT NOT NULL,
  mime_type TEXT,
  content_sha256 TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (post_id,storage_provider,storage_reference),
  FOREIGN KEY (post_id) REFERENCES social_publishing_posts(id)
);
CREATE INDEX IF NOT EXISTS idx_social_publishing_assets_post
  ON social_publishing_assets(post_id,created_at DESC);
