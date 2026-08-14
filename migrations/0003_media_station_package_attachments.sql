-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0003_media_station_package_attachments.sql
-- Version: 1.0.0
-- Status: Production Candidate
-- Sprint: Complete Station Email Package
-- Purpose: Preserve the operator-selected audio + script attachment metadata
--          for each Media traffic package without storing large media bytes in D1.
-- =========================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS media_traffic_package_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  traffic_package_id INTEGER NOT NULL,
  attachment_type TEXT NOT NULL
    CHECK (attachment_type IN ('audio','script')),
  source_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (traffic_package_id) REFERENCES media_traffic_packages(id),
  UNIQUE (traffic_package_id, attachment_type)
);

CREATE INDEX IF NOT EXISTS idx_media_traffic_package_attachments_package
  ON media_traffic_package_attachments(traffic_package_id, attachment_type);
