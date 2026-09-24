-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0020_backfill_sep8_search_console_reports.sql
-- Version: 1.0.0
-- Status: One-Time Production Data Backfill
-- Purpose:
-- Restore the four unprocessed Sept. 8, 2026 Google Search Console August
-- performance reports that predate Universal Email Intake into the durable D1
-- review queue. No Communications, Work, Investigations, Proof, or Findings are
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
  '1a081833c779f1c4',
  '1a081833c779f1c4',
  NULL,
  'gmail-message:1a081833c779f1c4',
  '2026-09-08T14:54:16Z',
  '2026-09-08T14:54:16Z',
  'sc-noreply@google.com',
  'Google Search Console Team',
  '["GlobalConceptsMediaLLC@gmail.com"]',
  '[]',
  NULL,
  'Your August Search performance for https://www.a1actionsafeandlock.com/',
  'Your August performance on Google Search

https://www.a1actionsafeandlock.com/

71 Clicks (web)
7.37K Impressions (web)
3 Pages with first impressions (estimated)

Top growing pages compared to previous month
https://www.a1actionsafeandlock.com/titusville-locksmith — +2 clicks
https://www.a1actionsafeandlock.com/port-st-john-locksmith — +2 clicks
https://www.a1actionsafeandlock.com/contact.html — +1 click

Top performing pages
https://www.a1actionsafeandlock.com/ — 63 clicks
https://www.a1actionsafeandlock.com/port-st-john-locksmith — 3 clicks
https://www.a1actionsafeandlock.com/titusville-locksmith — 2 clicks

Top growing queries compared to previous month
a1 action safe and lock — +3 clicks
safes — +2 clicks
vehicle locksmith near me — +1 click

Top performing queries
a1 action safe and lock — 9 clicks
safes — 2 clicks
locksmith near me — 2 clicks

Devices by clicks
Desktop 31
Mobile 40
Tablet 0

Top country
United States — 71 clicks

Google search type
Web 71
Image 0
Video 0

Historical source: Gmail message 1a081833c779f1c4',
  '{"gmail_message_id":"1a081833c779f1c4","gmail_thread_id":"1a081833c779f1c4"}',
  0,
  '[]',
  'https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a081833c779f1c4',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),
  'ready_for_review',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

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
  '1a0818419adeb7b8',
  '1a0818419adeb7b8',
  NULL,
  'gmail-message:1a0818419adeb7b8',
  '2026-09-08T14:55:12Z',
  '2026-09-08T14:55:12Z',
  'sc-noreply@google.com',
  'Google Search Console Team',
  '["GlobalConceptsMediaLLC@gmail.com"]',
  '[]',
  NULL,
  'Your August Search performance for pickettweaponry.com',
  'Your August performance on Google Search

pickettweaponry.com

565 Clicks (web)
11.4K Impressions (web)
4 Pages with first impressions (estimated)

Top growing pages compared to previous month
http://www.pickettweaponry.com/ — +42 clicks
https://pickettweaponry.com/ — +35 clicks
https://pickettweaponry.com/shop/ — +13 clicks

Top performing pages
http://www.pickettweaponry.com/ — 360 clicks
https://pickettweaponry.com/ — 141 clicks
https://pickettweaponry.com/shop/ — 31 clicks

Top growing queries compared to previous month
pickett weaponry — +34 clicks
pickett''s gun shop — +3 clicks
gun shop — +3 clicks

Top performing queries
pickett weaponry — 172 clicks
gun stores near me — 7 clicks
picket weaponry — 5 clicks

Devices by clicks
Desktop 119
Mobile 443
Tablet 3

Top countries
United States — 559 clicks
Hong Kong — 1 click
Canada — 1 click

Google search type
Web 565
Image 0
Video 0

Historical source: Gmail message 1a0818419adeb7b8',
  '{"gmail_message_id":"1a0818419adeb7b8","gmail_thread_id":"1a0818419adeb7b8"}',
  0,
  '[]',
  'https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0818419adeb7b8',
  (SELECT id FROM clients WHERE client_code='PW' COLLATE NOCASE LIMIT 1),
  'ready_for_review',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

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
  '1a081842d018fd10',
  '1a081842d018fd10',
  NULL,
  'gmail-message:1a081842d018fd10',
  '2026-09-08T14:55:18Z',
  '2026-09-08T14:55:18Z',
  'sc-noreply@google.com',
  'Google Search Console Team',
  '["GlobalConceptsMediaLLC@gmail.com"]',
  '[]',
  NULL,
  'Your August Search performance for https://www.southfloridasafes.com/',
  'Your August performance on Google Search

https://www.southfloridasafes.com/

254 Clicks (web)
16.3K Impressions (web)
0 Pages with first impressions (estimated)

Top growing pages compared to previous month
https://www.southfloridasafes.com/ — +27 clicks
https://www.southfloridasafes.com/uploads/2/3/8/2/23820942/2019-browning-catalog-safes.pdf — +6 clicks
https://www.southfloridasafes.com/stuart-location.html — +2 clicks

Top performing pages
https://www.southfloridasafes.com/ — 186 clicks
https://www.southfloridasafes.com/we-move-safes.html — 24 clicks
https://www.southfloridasafes.com/uploads/2/3/8/2/23820942/2019-browning-catalog-safes.pdf — 10 clicks

Top growing queries compared to previous month
south florida safes — +8 clicks
safes near me — +6 clicks
gun safes near me — +3 clicks

Top performing queries
south florida safes — 25 clicks
safes near me — 7 clicks
gun safes near me — 6 clicks

Devices by clicks
Desktop 101
Mobile 148
Tablet 5

Top countries
United States — 248 clicks
Lebanon — 1 click
Spain — 1 click

Google search type
Web 254
Image 0
Video 0

Historical source: Gmail message 1a081842d018fd10',
  '{"gmail_message_id":"1a081842d018fd10","gmail_thread_id":"1a081842d018fd10"}',
  0,
  '[]',
  'https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a081842d018fd10',
  (SELECT id FROM clients WHERE client_code='SFS' COLLATE NOCASE LIMIT 1),
  'ready_for_review',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

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
  '1a081878af21cf2c',
  '1a081878af21cf2c',
  NULL,
  'gmail-message:1a081878af21cf2c',
  '2026-09-08T14:58:58Z',
  '2026-09-08T14:58:58Z',
  'sc-noreply@google.com',
  'Google Search Console Team',
  '["GlobalConceptsMediaLLC@gmail.com"]',
  '[]',
  NULL,
  'Your August Search performance for hbguns.com',
  'Your August performance on Google Search

hbguns.com

1.3K Clicks (web)
32.3K Impressions (web)
72 Pages with first impressions (estimated)

Top growing pages compared to previous month
https://hbguns.com/ — +161 clicks
https://hbguns.com/pages/ — +17 clicks
https://hbguns.com/gun-range-rates-rules/ — +8 clicks

Top performing pages
https://hbguns.com/ — 1.1K clicks
https://hbguns.com/pages/ — 49 clicks
https://hbguns.com/gun-range-rates-rules/ — 37 clicks

Top growing queries compared to previous month
harry beckwith — +61 clicks
harry beckwith guns & range — +28 clicks
gun range micanopy fl — +12 clicks

Top performing queries
harry beckwith — 265 clicks
harry beckwith guns & range — 122 clicks
beckwith gun range — 25 clicks

Devices by clicks
Desktop 257
Mobile 1.02K
Tablet 25

Top countries
United States — 1.29K clicks
Germany — 2 clicks
Belgium — 1 click

Google search type
Web 1.3K
Image 0
Video 0

Historical source: Gmail message 1a081878af21cf2c',
  '{"gmail_message_id":"1a081878af21cf2c","gmail_thread_id":"1a081878af21cf2c"}',
  0,
  '[]',
  'https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a081878af21cf2c',
  (SELECT id FROM clients WHERE client_code='HBG' COLLATE NOCASE LIMIT 1),
  'ready_for_review',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

