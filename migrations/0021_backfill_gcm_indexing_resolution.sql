-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0021_backfill_gcm_indexing_resolution.sql
-- Version: 1.0.0
-- Status: One-Time Production Data Backfill
-- Purpose:
-- Restore the Sept. 16, 2026 Google Search Console validation email for
-- globalconceptsmedia.com into the durable D1 review queue so the Sept. 6
-- noindex alert can be closed with its verified resolution evidence.
-- No Communication, Finding, Investigation, Work Item, or Proof record is
-- created by this migration. Human review in Today remains required.
-- =========================================================

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO email_intake (
  workspace_key,
  intake_address_id,
  provider,
  provider_message_id,
  provider_thread_id,
  internet_message_id,
  dedupe_key,
  received_at,
  source_date,
  from_address,
  from_name,
  to_addresses_json,
  cc_addresses_json,
  reply_to_address,
  subject,
  body_text,
  source_headers_json,
  has_attachments,
  attachment_metadata_json,
  raw_storage_reference,
  client_id,
  processing_status,
  created_at,
  updated_at
) VALUES (
  'gcm',
  NULL,
  'gmail_historical_backfill',
  '1a0abac479721ff5',
  '1a0abac479721ff5',
  NULL,
  'gmail-message:1a0abac479721ff5',
  '2026-09-16T19:23:09Z',
  '2026-09-16T19:23:09Z',
  'sc-noreply@google.com',
  'Google Search Console Team',
  '["GlobalConceptsMediaLLC@gmail.com"]',
  '[]',
  NULL,
  'Page indexing issues successfully fixed for site globalconceptsmedia.com',
  'Page indexing issues successfully fixed for site globalconceptsmedia.com

To the owner of globalconceptsmedia.com,

Google has validated your fix for Page indexing issues on globalconceptsmedia.com.

The specific issue validated was:
Excluded by ''noindex'' tag.

1 page on your site was validated as fixed.

Monitor validation progress and any related Page indexing issues that need fixing.

Historical source: Gmail message 1a0abac479721ff5',
  '{"gmail_message_id":"1a0abac479721ff5","gmail_thread_id":"1a0abac479721ff5"}',
  0,
  '[]',
  'https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0abac479721ff5',
  (SELECT id FROM clients WHERE client_code='GCM' COLLATE NOCASE LIMIT 1),
  'ready_for_review',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
