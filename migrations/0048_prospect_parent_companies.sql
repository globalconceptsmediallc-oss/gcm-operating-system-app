-- =========================================================
-- GCM OS | Parent Company / Multi-Brand Prospect Relationships
-- File: migrations/0048_prospect_parent_companies.sql
-- Version: 1.0.0 | 2026-10-19
-- Additive. No existing Radar/Prospect/Client table altered.
-- No group seeding, contact merging, or marketing-list changes.
-- =========================================================
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crm_parent_companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  website TEXT,
  relationship_notes TEXT,
  contact_name TEXT,
  contact_role TEXT,
  contact_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS crm_parent_company_radar_links (
  radar_id INTEGER PRIMARY KEY,
  parent_company_id INTEGER NOT NULL,
  linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (radar_id) REFERENCES crm_prospect_radar(id),
  FOREIGN KEY (parent_company_id) REFERENCES crm_parent_companies(id)
);

CREATE INDEX IF NOT EXISTS idx_crm_parent_company_radar_links_company
  ON crm_parent_company_radar_links(parent_company_id, radar_id);
