-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0022_backfill_sep8_semrush_position_tracking.sql
-- Version: 1.0.0
-- Status: One-Time Production Data Backfill
-- Purpose:
-- Restore the Sept. 8, 2026 Semrush Position Tracking reports for NFS,
-- Pickett Weaponry, and A1 Action into the durable D1 review queue.
-- No downstream operational records are created automatically.
-- =========================================================

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a082647a959b2ef','1a082647a959b2ef',NULL,
  'gmail-message:1a082647a959b2ef','2026-09-08T19:00:17Z','2026-09-08T19:00:17Z',
  'position-tracking@semrush.com','Semrush Position Tracking','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings increased (northfloridasafes.com)','Position Tracking

Project: northfloridasafes.com
Device & Location: Alachua County, Florida, United States (Google) • English
Date: Sep, 1-8, 2026

Visibility
northfloridasafes.com — 6.94% — +3.04%

Traffic
northfloridasafes.com — 0.01 — -0.00

Top keywords
handgun vaults florida — Position 1 — Change +25 — Volume n/a
vault doors florida — Position 9 — Change +6 — Volume n/a
home safes florida — Position 16 — Change +9 — Volume n/a
best gun safes for home use in florida — Position 22 — Change +42 — Volume n/a

Top landing pages
https://northfloridasafes.com/pages/catalogs — Traffic 0.00 — Change 0.00
https://northfloridasafes.com/pages/small-home-safes — Traffic 0.00 — Change 0.00
https://northfloridasafes.com/pages/pickett-weaponry-safe-sales — Traffic 0.00 — Change 0.00
https://northfloridasafes.com/pages/large-gun-safes — Traffic 0.00 — Change 0.00
https://northfloridasafes.com/products/liberty-safe-magnum-series — Traffic 0.00 — Change 0.00
https://northfloridasafes.com/pages/retail-store-buy-sell-trade — Traffic 0.00 — Change 0.00
https://northfloridasafes.com/pages/handgun-vaults — Traffic 0.00 — Change 0.00
https://northfloridasafes.com/pages/vault-doors — Traffic 0.00 — Change 0.00
https://northfloridasafes.com/products/liberty-safe-collector-series — Traffic 0.00 — Change 0.00
https://northfloridasafes.com/collections/all — Traffic 0.00 — Change 0.00

Historical source: Gmail message 1a082647a959b2ef',
  '{"gmail_message_id":"1a082647a959b2ef","gmail_thread_id":"1a082647a959b2ef"}',
  0,'[]',
  'https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a082647a959b2ef',
  (SELECT id FROM clients WHERE client_code='NFS' COLLATE NOCASE LIMIT 1),
  'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a082647b8075515','1a082647b8075515',NULL,
  'gmail-message:1a082647b8075515','2026-09-08T19:00:17Z','2026-09-08T19:00:17Z',
  'position-tracking@semrush.com','Semrush Position Tracking','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update (pickettweaponry.com)','Position Tracking

Project: pickettweaponry.com
Device & Location: Newberry, Florida, United States (Google) • English
Date: Sep, 1-8, 2026

Visibility
pickettweaponry.com — 0.91% — +0.18%

Traffic
pickettweaponry.com — 0.01 — 0.00

Top keywords
gun safes dealers near me — Position 4 — Change 0 — Volume n/a
gun safes — Position 7 — Change +93 — Volume 10
used safes for sale — Position 10 — Change +90 — Volume n/a
used safes for sale florida — Position 23 — Change -1 — Volume n/a
rhino safes — not ranked — Volume 10
used gun safes for sale — not ranked
fire rated gun safes — not ranked
fire rated safes — not ranked
fire proof gun safes — not ranked
gun safes that hold up to 12 guns — not ranked

Top landing pages
http://www.pickettweaponry.com/ — Traffic 0.01 — Change 0.00
https://pickettweaponry.com/ — Traffic 0.00 — Change 0.00
https://pickettweaponry.com/safes-2/ — Traffic 0.00 — Change 0.00
https://pickettweaponry.com/dt_gallery/gun-safes/ — Traffic 0.00 — Change 0.00
https://pickettweaponry.com/shop/ — Traffic 0.00 — Change 0.00

Historical source: Gmail message 1a082647b8075515',
  '{"gmail_message_id":"1a082647b8075515","gmail_thread_id":"1a082647b8075515"}',
  0,'[]',
  'https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a082647b8075515',
  (SELECT id FROM clients WHERE client_code='PW' COLLATE NOCASE LIMIT 1),
  'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a082647bb5c6909','1a082647bb5c6909',NULL,
  'gmail-message:1a082647bb5c6909','2026-09-08T19:00:17Z','2026-09-08T19:00:17Z',
  'position-tracking@semrush.com','Semrush Position Tracking','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update (a1actionsafeandlock.com)','Position Tracking

Project: A1 Action — a1actionsafeandlock.com
Device & Location: Melbourne, Florida, United States (Google) • English
Date: Sep, 1-8, 2026

Visibility
popalock.com — 48.87% — -1.59%
keyenlock.com — 25.42% — -3.91%
locksmithmelbourneflorida.com — 11.53% — +1.41%
locksmithmelbourne-fl.com — 8.56% — +0.87%
locksmithofbrevard.com — 8.47% — -0.05%
minutekey.com — 7.99% — -0.19%
kwikkeyofbrevard.com — 3.47% — -1.60%
a1actionsafeandlock.com — 3.26% — -0.49%
brevardlock.com — 1.98% — -0.10%

Traffic
a1actionsafeandlock.com — 0.00 — 0.00

Top keywords
safe opening melbourne fl — Position 1 — Change 0
safe repair melbourne fl — Position 1 — Change 0
locksmith melbourne — Position 3 — Change +18
mobile locksmith melbourne fl — Position 5 — Change 0
commercial lock services — Position 5 — Change 0
emergency locksmith melbourne fl — Position 6 — Change 0
commercial door locksmith — Position 6 — Change 0
locksmith melbourne florida — Position 6 — Change -1
locksmith for business doors — Position 7 — Change -1
automotive lockout service — Position 8 — Change +2

Top landing pages
https://www.a1actionsafeandlock.com/automotive-locksmith-services
https://www.a1actionsafeandlock.com/emergency-locksmith-services
https://www.a1actionsafeandlock.com/commercial-locksmith-services
https://www.a1actionsafeandlock.com/marine-locksmith-services
https://www.a1actionsafeandlock.com/safe-services
https://www.a1actionsafeandlock.com/melbourne-locksmith
https://www.a1actionsafeandlock.com/service-area
https://www.a1actionsafeandlock.com/residential-locksmith-services
https://www.a1actionsafeandlock.com/melbourne-beach-locksmith
https://www.a1actionsafeandlock.com/

Historical source: Gmail message 1a082647bb5c6909',
  '{"gmail_message_id":"1a082647bb5c6909","gmail_thread_id":"1a082647bb5c6909"}',
  0,'[]',
  'https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a082647bb5c6909',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),
  'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

