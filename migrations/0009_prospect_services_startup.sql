-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0009_prospect_services_startup.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Add durable service-selection and startup-package records to the
--          Prospect CRM without modifying or deleting existing CRM history.
-- Change Notes:
-- - Preserves proposed services separately from contracted services.
-- - Connects contracted service selections to the signed agreement that proves scope.
-- - Adds one startup package per Prospect agreement.
-- - Adds deduplicated startup requirements with Needed / Requested / Received /
--   Verified status plus client, GCM, or mutual responsibility.
-- - Additive only; no existing production table or record is rewritten.
-- =========================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crm_prospect_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id INTEGER NOT NULL,
  agreement_id INTEGER,
  service_key TEXT NOT NULL,
  service_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  scope_notes TEXT,
  selected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  contracted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES crm_prospects(id),
  FOREIGN KEY (agreement_id) REFERENCES crm_prospect_agreements(id),
  UNIQUE (prospect_id, service_key)
);

CREATE INDEX IF NOT EXISTS idx_crm_prospect_services_prospect
  ON crm_prospect_services(prospect_id, status, service_key);

CREATE INDEX IF NOT EXISTS idx_crm_prospect_services_agreement
  ON crm_prospect_services(agreement_id, status);

CREATE TABLE IF NOT EXISTS crm_prospect_startup_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id INTEGER NOT NULL,
  agreement_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES crm_prospects(id),
  FOREIGN KEY (agreement_id) REFERENCES crm_prospect_agreements(id),
  UNIQUE (prospect_id, agreement_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_startup_packages_prospect
  ON crm_prospect_startup_packages(prospect_id, status, generated_at);

CREATE TABLE IF NOT EXISTS crm_prospect_startup_requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id INTEGER NOT NULL,
  prospect_id INTEGER NOT NULL,
  agreement_id INTEGER NOT NULL,
  requirement_key TEXT NOT NULL,
  title TEXT NOT NULL,
  client_request TEXT,
  category TEXT,
  responsible_party TEXT NOT NULL DEFAULT 'client',
  status TEXT NOT NULL DEFAULT 'needed',
  source_services_json TEXT,
  requested_at TEXT,
  received_at TEXT,
  verified_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES crm_prospect_startup_packages(id),
  FOREIGN KEY (prospect_id) REFERENCES crm_prospects(id),
  FOREIGN KEY (agreement_id) REFERENCES crm_prospect_agreements(id),
  UNIQUE (package_id, requirement_key)
);

CREATE INDEX IF NOT EXISTS idx_crm_startup_requirements_package
  ON crm_prospect_startup_requirements(package_id, status, responsible_party);

CREATE INDEX IF NOT EXISTS idx_crm_startup_requirements_prospect
  ON crm_prospect_startup_requirements(prospect_id, status);
