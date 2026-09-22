-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0017_universal_email_intake.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Sprint: Universal Email Intake — Durable Foundation
-- Purpose:
-- Create a provider-independent inbound email staging layer so Morning Command
-- can operate from durable D1 records instead of repeatedly scanning Gmail.
--
-- Design rules:
-- - No existing Gmail, Communication, Investigation, Work, or Proof records change.
-- - Email receipt is durable before classification or human routing.
-- - One intake record may later resolve to Information, Monitoring,
--   Investigation, Requested Work, or Ignore/Delete.
-- - Provider cleanup is optional and happens after OS processing.
-- - Original provider identifiers and source evidence are retained for auditability.
-- ========================================================= */

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS email_intake_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_key TEXT NOT NULL DEFAULT 'gcm',
  intake_token TEXT NOT NULL,
  intake_address TEXT NOT NULL,
  label TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
    CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (intake_token),
  UNIQUE (intake_address)
);

CREATE TABLE IF NOT EXISTS email_intake (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  workspace_key TEXT NOT NULL DEFAULT 'gcm',
  intake_address_id INTEGER,

  provider TEXT NOT NULL DEFAULT 'cloudflare_email_routing',
  provider_message_id TEXT,
  provider_thread_id TEXT,
  internet_message_id TEXT,

  dedupe_key TEXT NOT NULL,

  received_at TEXT NOT NULL,
  source_date TEXT,

  from_address TEXT,
  from_name TEXT,
  to_addresses_json TEXT NOT NULL DEFAULT '[]',
  cc_addresses_json TEXT NOT NULL DEFAULT '[]',
  reply_to_address TEXT,

  subject TEXT NOT NULL DEFAULT '(No subject)',
  body_text TEXT NOT NULL DEFAULT '',
  source_headers_json TEXT NOT NULL DEFAULT '{}',

  has_attachments INTEGER NOT NULL DEFAULT 0
    CHECK (has_attachments IN (0, 1)),
  attachment_metadata_json TEXT NOT NULL DEFAULT '[]',
  raw_storage_reference TEXT,

  client_id INTEGER,

  processing_status TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN (
      'received',
      'ready_for_review',
      'processing',
      'processed',
      'failed'
    )),

  disposition TEXT
    CHECK (
      disposition IS NULL OR disposition IN (
        'delete',
        'information',
        'monitoring',
        'investigation',
        'requested_work'
      )
    ),

  classification_source TEXT,
  classification_json TEXT,
  classification_confidence TEXT
    CHECK (
      classification_confidence IS NULL OR classification_confidence IN (
        'high',
        'medium',
        'low'
      )
    ),

  communication_id INTEGER,
  activity_record_id INTEGER,
  investigation_id INTEGER,
  work_item_id INTEGER,

  processed_at TEXT,
  failure_stage TEXT,
  failure_message TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (intake_address_id) REFERENCES email_intake_addresses(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (communication_id) REFERENCES communications(id),
  FOREIGN KEY (activity_record_id) REFERENCES activity_records(id),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id),
  FOREIGN KEY (work_item_id) REFERENCES work_items(id),

  UNIQUE (workspace_key, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_email_intake_status_received
  ON email_intake(processing_status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_intake_workspace_status
  ON email_intake(workspace_key, processing_status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_intake_client_status
  ON email_intake(client_id, processing_status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_intake_disposition
  ON email_intake(disposition, processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_intake_provider_message
  ON email_intake(provider, provider_message_id);

CREATE INDEX IF NOT EXISTS idx_email_intake_internet_message
  ON email_intake(internet_message_id);
