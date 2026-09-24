-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0023_backfill_operational_email_backlog.sql
-- Version: 1.0.0
-- Status: One-Time Production Data Backfill
-- Purpose:
-- Stage the remaining operational Gmail backlog received after Sept. 8, 2026
-- into Universal Email Intake so Today is the single review queue.
-- INSERT OR IGNORE protects messages already staged by earlier migrations.
-- No Finding, Communication, Investigation, Work Item, or Proof record is
-- created here. Human review remains required.
-- The known NFS CWV source already represented by Investigation #44 / Work #27
-- is intentionally excluded to avoid duplicate work.
-- =========================================================

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a082647bb5c6909','1a082647bb5c6909',
  NULL,'gmail-message:1a082647bb5c6909','2026-09-08T19:00:17+00:00','2026-09-08T19:00:17+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update (a1actionsafeandlock.com)','Position Tracking Project: A1 Action • a1actionsafeandlock.com Device & Location: Melbourne,Florida,United States (Google) • English Date: Sep, 1-8, 2026 Hello, Here is the weekly update for your

Historical source: Gmail message 1a082647bb5c6909.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a082647bb5c6909","gmail_thread_id":"1a082647bb5c6909","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a082647bb5c6909',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a082647b8075515','1a082647b8075515',
  NULL,'gmail-message:1a082647b8075515','2026-09-08T19:00:17+00:00','2026-09-08T19:00:17+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update (pickettweaponry.com)','Position Tracking Project: pickettweaponry.com • pickettweaponry.com Device & Location: Newberry,Florida,United States (Google) • English Date: Sep, 1-8, 2026 Hello, Here is the weekly update for

Historical source: Gmail message 1a082647b8075515.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a082647b8075515","gmail_thread_id":"1a082647b8075515","labels":["UNREAD","IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a082647b8075515',
  (SELECT id FROM clients WHERE client_code='PW' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a082647a959b2ef','1a082647a959b2ef',
  NULL,'gmail-message:1a082647a959b2ef','2026-09-08T19:00:17+00:00','2026-09-08T19:00:17+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings increased (northfloridasafes.com)','Position Tracking Project: northfloridasafes.com • northfloridasafes.com Device & Location: Alachua County,Florida,United States (Google) • English Date: Sep, 1-8, 2026 Hello, Here is the weekly

Historical source: Gmail message 1a082647a959b2ef.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a082647a959b2ef","gmail_thread_id":"1a082647a959b2ef","labels":["UNREAD","IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a082647a959b2ef',
  (SELECT id FROM clients WHERE client_code='NFS' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a082647bfb6643f','1a082647bfb6643f',
  NULL,'gmail-message:1a082647bfb6643f','2026-09-08T19:00:17+00:00','2026-09-08T19:00:17+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings increased (sesafes.com)','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (Google) • English Date: Sep, 1-8, 2026 Hello, Here is the weekly update for your Position

Historical source: Gmail message 1a082647bfb6643f.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a082647bfb6643f","gmail_thread_id":"1a082647bfb6643f","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a082647bfb6643f',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a082647de13e49c','1a082647de13e49c',
  NULL,'gmail-message:1a082647de13e49c','2026-09-08T19:00:18+00:00','2026-09-08T19:00:18+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update (southfloridasafes.com)','Position Tracking Project: southfloridasafes.com • southfloridasafes.com Device & Location: Fort Lauderdale,Florida,United States (Google) • English Date: Sep, 1-8, 2026 Hello, Here is the weekly

Historical source: Gmail message 1a082647de13e49c.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a082647de13e49c","gmail_thread_id":"1a082647de13e49c","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a082647de13e49c',
  (SELECT id FROM clients WHERE client_code='SFS' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a089181eb8f7652','1a089181eb8f7652',
  NULL,'gmail-message:1a089181eb8f7652','2026-09-10T02:14:12+00:00','2026-09-10T02:14:12+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 10, 2026 Alert triggered for 4 keywords Rule: Leaves the

Historical source: Gmail message 1a089181eb8f7652.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a089181eb8f7652","gmail_thread_id":"1a089181eb8f7652","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a089181eb8f7652',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a089181ea6bb598','1a089181eb8f7652',
  NULL,'gmail-message:1a089181ea6bb598','2026-09-10T02:14:13+00:00','2026-09-10T02:14:13+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 10, 2026 Alert triggered for 3 keywords Rule: Enters the

Historical source: Gmail message 1a089181ea6bb598.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a089181ea6bb598","gmail_thread_id":"1a089181eb8f7652","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a089181ea6bb598',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0898ee10cda65e','1a0898ee10cda65e',
  NULL,'gmail-message:1a0898ee10cda65e','2026-09-10T04:23:56+00:00','2026-09-10T04:23:56+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: A1 Action','Position Tracking Project: A1 Action • a1actionsafeandlock.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 10, 2026 Alert triggered for 4 keywords Rule:

Historical source: Gmail message 1a0898ee10cda65e.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0898ee10cda65e","gmail_thread_id":"1a0898ee10cda65e","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0898ee10cda65e',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a08b2d0ddb239d1','1a08b2d0ddb239d1',
  NULL,'gmail-message:1a08b2d0ddb239d1','2026-09-10T04:56:18-07:00','2026-09-10T04:56:18-07:00',
  'shopping-noreply@google.com','Google Merchant Center','["GlobalConceptsMediaLLC@gmail.com"]','[]',NULL,
  'Google Merchant Center Alert: Drop in Number of Active Items for Southeast Safes (Account ID: 5541071807) as of September 9, 2026, 7:30:00 PM PDT','Between September 9, 2026, 1:30:00 PM PDT and September 9, 2026, 7:30:00 PM PDT we detected a drop in the number of active items in your Merchant Center account (Southeast Safes, Account ID: 5541071807

Historical source: Gmail message 1a08b2d0ddb239d1.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a08b2d0ddb239d1","gmail_thread_id":"1a08b2d0ddb239d1","labels":["UNREAD","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a08b2d0ddb239d1',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a08d9adba7f2257','1a08d9adba7f2257',
  NULL,'gmail-message:1a08d9adba7f2257','2026-09-10T23:15:29+00:00','2026-09-10T23:15:29+00:00',
  'sa@ahrefs.com','Ahrefs Site Audit','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  '(Southfloridasafes) Page in multiple sitemaps [New]: 52 URLs','59 internal URLs were analyzed. Health Score 74 · Errors 53 · Warnings 13 (−2) · Notices 54 (+2)

Historical source: Gmail message 1a08d9adba7f2257.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a08d9adba7f2257","gmail_thread_id":"1a08d9adba7f2257","labels":["Label_136499437826870853","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a08d9adba7f2257',
  (SELECT id FROM clients WHERE client_code='SFS' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a08e555ef2b7822','1a08e555ef2b7822',
  NULL,'gmail-message:1a08e555ef2b7822','2026-09-11T02:39:13+00:00','2026-09-11T02:39:13+00:00',
  'sa@ahrefs.com','Ahrefs Site Audit','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  '(Northfloridasafes) Slow page [New]: 2 URLs','168 internal URLs were analyzed. Health Score 93 (+1) · Errors 428 (−36) · Warnings 141 (+1) · Notices 70 (−13)

Historical source: Gmail message 1a08e555ef2b7822.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a08e555ef2b7822","gmail_thread_id":"1a08e555ef2b7822","labels":["Label_136499437826870853","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a08e555ef2b7822',
  (SELECT id FROM clients WHERE client_code='NFS' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a09218cae3608f9','1a09218cae3608f9',
  NULL,'gmail-message:1a09218cae3608f9','2026-09-11T20:11:33+00:00','2026-09-11T20:11:33+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 12, 2026 Alert triggered for 1 keywords Rule: Leaves the

Historical source: Gmail message 1a09218cae3608f9.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a09218cae3608f9","gmail_thread_id":"1a09218cae3608f9","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a09218cae3608f9',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a092a2b7130eefd','1a092a2b7130eefd',
  NULL,'gmail-message:1a092a2b7130eefd','2026-09-11T22:42:12+00:00','2026-09-11T22:42:12+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: A1 Action','Position Tracking Project: A1 Action • a1actionsafeandlock.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 12, 2026 Alert triggered for 1 keywords Rule:

Historical source: Gmail message 1a092a2b7130eefd.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a092a2b7130eefd","gmail_thread_id":"1a092a2b7130eefd","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a092a2b7130eefd',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a09302119910490','1a09302119910490',
  NULL,'gmail-message:1a09302119910490','2026-09-12T00:26:20+00:00','2026-09-12T00:26:20+00:00',
  'site-audit@semrush.com','Semrush Site Audit','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'globalconceptsmedia.com: Your Audit Report Is Ready','Site Audit Site Audit Project: globalconceptsmedia.com Website URL: globalconceptsmedia.com Date: Sep 12, 2026 (00:26:19) Hello, Here is the update for your Site Audit campaign. We haven''t detected

Historical source: Gmail message 1a09302119910490.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a09302119910490","gmail_thread_id":"1a09302119910490","labels":["UNREAD","IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a09302119910490',
  (SELECT id FROM clients WHERE client_code='GCM' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0932effd37ddf0','1a0932effd37ddf0',
  NULL,'gmail-message:1a0932effd37ddf0','2026-09-12T01:15:25+00:00','2026-09-12T01:15:25+00:00',
  'site-audit@semrush.com','Semrush Site Audit','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'moveasafe.com: 100% of your pages have no canonical links','Site Audit Site Audit Project: moveasafe.com Website URL: moveasafe.com Date: Sep 12, 2026 (01:15:23) Hello, Here is the update for your Site Audit campaign. We haven''t detected any significant

Historical source: Gmail message 1a0932effd37ddf0.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0932effd37ddf0","gmail_thread_id":"1a0932effd37ddf0","labels":["UNREAD","IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0932effd37ddf0',
  (SELECT id FROM clients WHERE client_code='MAS' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a09734be8209d53','1a09734be8209d53',
  NULL,'gmail-message:1a09734be8209d53','2026-09-12T20:00:11+00:00','2026-09-12T20:00:11+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 13, 2026 Alert triggered for 1 keywords Rule: Enters the

Historical source: Gmail message 1a09734be8209d53.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a09734be8209d53","gmail_thread_id":"1a09734be8209d53","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a09734be8209d53',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a09734c27731ea1','1a09734be8209d53',
  NULL,'gmail-message:1a09734c27731ea1','2026-09-12T20:00:12+00:00','2026-09-12T20:00:12+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 13, 2026 Alert triggered for 1 keywords Rule: Leaves the

Historical source: Gmail message 1a09734c27731ea1.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a09734c27731ea1","gmail_thread_id":"1a09734be8209d53","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a09734c27731ea1',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a097a6ecccde4bd','1a097a6ecccde4bd',
  NULL,'gmail-message:1a097a6ecccde4bd','2026-09-12T22:04:53+00:00','2026-09-12T22:04:53+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: A1 Action','Position Tracking Project: A1 Action • a1actionsafeandlock.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 13, 2026 Alert triggered for 2 keywords Rule:

Historical source: Gmail message 1a097a6ecccde4bd.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a097a6ecccde4bd","gmail_thread_id":"1a097a6ecccde4bd","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a097a6ecccde4bd',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a098914c2080d8d','1a098914c2080d8d',
  NULL,'gmail-message:1a098914c2080d8d','2026-09-13T02:20:54+00:00','2026-09-13T02:20:54+00:00',
  'site-audit@semrush.com','Semrush Site Audit','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'southfloridasafes.com: 7% of your pages have no canonical links','Site Audit Site Audit Project: southfloridasafes.com Website URL: southfloridasafes.com Date: Sep 13, 2026 (02:20:51) Hello, Here is the update for your Site Audit campaign. We haven''t detected any

Historical source: Gmail message 1a098914c2080d8d.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a098914c2080d8d","gmail_thread_id":"1a098914c2080d8d","labels":["UNREAD","IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a098914c2080d8d',
  (SELECT id FROM clients WHERE client_code='SFS' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a098994fd28cd28','1a098994fd28cd28',
  NULL,'gmail-message:1a098994fd28cd28','2026-09-13T02:29:38+00:00','2026-09-13T02:29:38+00:00',
  'site-audit@semrush.com','Semrush Site Audit','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'hbguns.com: 7% of your pages have no canonical links','Site Audit Site Audit Project: hbguns.com Website URL: hbguns.com Date: Sep 13, 2026 (02:29:34) Hello, Here is the update for your Site Audit campaign. We haven''t detected any significant changes

Historical source: Gmail message 1a098994fd28cd28.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a098994fd28cd28","gmail_thread_id":"1a098994fd28cd28","labels":["UNREAD","IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a098994fd28cd28',
  (SELECT id FROM clients WHERE client_code='HBG' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a09c52e8c1102d1','1a09c52e8c1102d1',
  NULL,'gmail-message:1a09c52e8c1102d1','2026-09-13T19:51:14+00:00','2026-09-13T19:51:14+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 14, 2026 Alert triggered for 1 keywords Rule: Enters the

Historical source: Gmail message 1a09c52e8c1102d1.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a09c52e8c1102d1","gmail_thread_id":"1a09c52e8c1102d1","labels":["IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a09c52e8c1102d1',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0a00bb3ba7dc01','1a0a00bb3ba7dc01',
  NULL,'gmail-message:1a0a00bb3ba7dc01','2026-09-14T13:11:54+00:00','2026-09-14T13:11:54+00:00',
  'sa@ahrefs.com','Ahrefs Site Audit','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  '(A1actionsafeandlock) Pages dropped from Top 10 [New]: 1 URL','44 internal URLs were analyzed. Health Score 96 · Errors 2 · Warnings 40 · Notices 33

Historical source: Gmail message 1a0a00bb3ba7dc01.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0a00bb3ba7dc01","gmail_thread_id":"1a0a00bb3ba7dc01","labels":["UNREAD","Label_136499437826870853","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0a00bb3ba7dc01',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0a01655991402c','1a0a01655991402c',
  NULL,'gmail-message:1a0a01655991402c','2026-09-14T13:23:32+00:00','2026-09-14T13:23:32+00:00',
  'sa@ahrefs.com','Ahrefs Site Audit','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  '(Hbguns) Site Audit crawl failed','Your crawl failed to start because of an error. Please check the report to learn more about how to fix this and contact support if this error keeps happening.

Historical source: Gmail message 1a0a01655991402c.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0a01655991402c","gmail_thread_id":"1a0a01655991402c","labels":["UNREAD","Label_136499437826870853","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0a01655991402c',
  (SELECT id FROM clients WHERE client_code='HBG' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0a0179b253ad38','1a0a0179b253ad38',
  NULL,'gmail-message:1a0a0179b253ad38','2026-09-14T13:24:55+00:00','2026-09-14T13:24:55+00:00',
  'sa@ahrefs.com','Ahrefs Site Audit','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  '(Pickettweaponry) Orphan page (has no incoming internal links): 18 URLs','81 internal URLs were analyzed. Health Score 92 · Errors 19 · Warnings 81 · Notices 14

Historical source: Gmail message 1a0a0179b253ad38.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0a0179b253ad38","gmail_thread_id":"1a0a0179b253ad38","labels":["UNREAD","Label_136499437826870853","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0a0179b253ad38',
  (SELECT id FROM clients WHERE client_code='PW' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0a018946a7b74e','1a0a018946a7b74e',
  NULL,'gmail-message:1a0a018946a7b74e','2026-09-14T13:25:58+00:00','2026-09-14T13:25:58+00:00',
  'sa@ahrefs.com','Ahrefs Site Audit','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  '(Sesafes) 3XX redirect: 3 URLs','3 internal URLs were analyzed. Health Score 100 · Errors 0 · Warnings 3 · Notices 1

Historical source: Gmail message 1a0a018946a7b74e.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0a018946a7b74e","gmail_thread_id":"1a0a018946a7b74e","labels":["UNREAD","Label_136499437826870853","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0a018946a7b74e',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0a2c475f8f9083','1a0a2c475f8f9083',
  NULL,'gmail-message:1a0a2c475f8f9083','2026-09-15T01:52:58+00:00','2026-09-15T01:52:58+00:00',
  'site-audit@semrush.com','Semrush Site Audit','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'globalconceptsmedia.com: Your Audit Report Is Ready','Site Audit Site Audit Project: globalconceptsmedia.com Website URL: globalconceptsmedia.com Date: Sep 15, 2026 (01:52:57) Hello, Here is the update for your Site Audit campaign. We haven''t detected

Historical source: Gmail message 1a0a2c475f8f9083.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0a2c475f8f9083","gmail_thread_id":"1a0a2c475f8f9083","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0a2c475f8f9083',
  (SELECT id FROM clients WHERE client_code='GCM' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0abc822cf39f4e','1a0abc822cf39f4e',
  NULL,'gmail-message:1a0abc822cf39f4e','2026-09-16T12:53:35-07:00','2026-09-16T12:53:35-07:00',
  'sc-noreply@google.com','Google Search Console Team','["GlobalConceptsMediaLLC@gmail.com"]','[]',NULL,
  'New reasons prevent pages from being indexed on site https://sesafes.com/','New reason preventing your pages from being indexed Search Console has identified that some pages on your site are not being indexed due to the following new reason: Duplicate, Google chose different

Historical source: Gmail message 1a0abc822cf39f4e.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0abc822cf39f4e","gmail_thread_id":"1a0abc822cf39f4e","labels":["IMPORTANT","CATEGORY_SOCIAL","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0abc822cf39f4e',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0aabb33979c9e8','1a0aabb33979c9e8',
  NULL,'gmail-message:1a0aabb33979c9e8','2026-09-16T14:59:49+00:00','2026-09-16T14:59:49+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update (pickettweaponry.com)','Position Tracking Project: pickettweaponry.com • pickettweaponry.com Device & Location: Newberry,Florida,United States (Google) • English Date: Sep, 9-16, 2026 Hello, Here is the weekly update for

Historical source: Gmail message 1a0aabb33979c9e8.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0aabb33979c9e8","gmail_thread_id":"1a0aabb33979c9e8","labels":["UNREAD","IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0aabb33979c9e8',
  (SELECT id FROM clients WHERE client_code='PW' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0aabb33516a7b2','1a0aabb33516a7b2',
  NULL,'gmail-message:1a0aabb33516a7b2','2026-09-16T14:59:49+00:00','2026-09-16T14:59:49+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings declined (sesafes.com)','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (Google) • English Date: Sep, 9-16, 2026 Hello, Here is the weekly update for your Position

Historical source: Gmail message 1a0aabb33516a7b2.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0aabb33516a7b2","gmail_thread_id":"1a0aabb33516a7b2","labels":["UNREAD","IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0aabb33516a7b2',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0aabb3223b96bf','1a0aabb3223b96bf',
  NULL,'gmail-message:1a0aabb3223b96bf','2026-09-16T14:59:49+00:00','2026-09-16T14:59:49+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings increased (northfloridasafes.com)','Position Tracking Project: northfloridasafes.com • northfloridasafes.com Device & Location: Alachua County,Florida,United States (Google) • English Date: Sep, 9-16, 2026 Hello, Here is the weekly

Historical source: Gmail message 1a0aabb3223b96bf.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0aabb3223b96bf","gmail_thread_id":"1a0aabb3223b96bf","labels":["UNREAD","IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0aabb3223b96bf',
  (SELECT id FROM clients WHERE client_code='NFS' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0aabb3043e29a6','1a0aabb3043e29a6',
  NULL,'gmail-message:1a0aabb3043e29a6','2026-09-16T14:59:49+00:00','2026-09-16T14:59:49+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings declined (southfloridasafes.com)','Position Tracking Project: southfloridasafes.com • southfloridasafes.com Device & Location: Fort Lauderdale,Florida,United States (Google) • English Date: Sep, 9-16, 2026 Hello, Here is the weekly

Historical source: Gmail message 1a0aabb3043e29a6.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0aabb3043e29a6","gmail_thread_id":"1a0aabb3043e29a6","labels":["UNREAD","IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0aabb3043e29a6',
  (SELECT id FROM clients WHERE client_code='SFS' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0aabb3004581f0','1a0aabb3004581f0',
  NULL,'gmail-message:1a0aabb3004581f0','2026-09-16T14:59:49+00:00','2026-09-16T14:59:49+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings declined (globalconceptsmedia.com)','Position Tracking Project: globalconceptsmedia.com • globalconceptsmedia.com Device & Location: 32940,Florida,United States (Google) • English Date: Sep, 9-16, 2026 Hello, Here is the weekly update

Historical source: Gmail message 1a0aabb3004581f0.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0aabb3004581f0","gmail_thread_id":"1a0aabb3004581f0","labels":["UNREAD","IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0aabb3004581f0',
  (SELECT id FROM clients WHERE client_code='GCM' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0aabb37bbf5c56','1a0aabb37bbf5c56',
  NULL,'gmail-message:1a0aabb37bbf5c56','2026-09-16T14:59:50+00:00','2026-09-16T14:59:50+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings declined (a1actionsafeandlock.com)','Position Tracking Project: A1 Action • a1actionsafeandlock.com Device & Location: Melbourne,Florida,United States (Google) • English Date: Sep, 9-16, 2026 Hello, Here is the weekly update for your

Historical source: Gmail message 1a0aabb37bbf5c56.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0aabb37bbf5c56","gmail_thread_id":"1a0aabb37bbf5c56","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0aabb37bbf5c56',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0aabb34a8da5eb','1a0aabb34a8da5eb',
  NULL,'gmail-message:1a0aabb34a8da5eb','2026-09-16T14:59:50+00:00','2026-09-16T14:59:50+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings declined (hbguns.com)','Position Tracking Project: hbguns.com • hbguns.com Device & Location: Gainesville,Florida,United States (Google) • English Date: Sep, 9-16, 2026 Hello, Here is the weekly update for your Position

Historical source: Gmail message 1a0aabb34a8da5eb.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0aabb34a8da5eb","gmail_thread_id":"1a0aabb34a8da5eb","labels":["UNREAD","IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0aabb34a8da5eb',
  (SELECT id FROM clients WHERE client_code='HBG' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0aabb396f60465','1a0aabb396f60465',
  NULL,'gmail-message:1a0aabb396f60465','2026-09-16T14:59:51+00:00','2026-09-16T14:59:51+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update (a1actionsafeandlock.com)','Position Tracking Project: A1 Action • a1actionsafeandlock.com Device & Location: Melbourne,Florida,United States (Google) • English Date: Sep, 9-16, 2026 Hello, Here is the weekly update for your

Historical source: Gmail message 1a0aabb396f60465.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0aabb396f60465","gmail_thread_id":"1a0aabb396f60465","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0aabb396f60465',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0abba1d050e15a','1a0abba1d050e15a',
  NULL,'gmail-message:1a0abba1d050e15a','2026-09-16T19:38:15+00:00','2026-09-16T19:38:15+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 17, 2026 Alert triggered for 2 keywords Rule: Enters the

Historical source: Gmail message 1a0abba1d050e15a.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0abba1d050e15a","gmail_thread_id":"1a0abba1d050e15a","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0abba1d050e15a',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0abba1cf80cfdf','1a0abba1d050e15a',
  NULL,'gmail-message:1a0abba1cf80cfdf','2026-09-16T19:38:16+00:00','2026-09-16T19:38:16+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 17, 2026 Alert triggered for 3 keywords Rule: Leaves the

Historical source: Gmail message 1a0abba1cf80cfdf.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0abba1cf80cfdf","gmail_thread_id":"1a0abba1d050e15a","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0abba1cf80cfdf',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0af57223d48162','1a0af57223d48162',
  NULL,'gmail-message:1a0af57223d48162','2026-09-17T05:08:30-07:00','2026-09-17T05:08:30-07:00',
  'no-reply@youtube.com','YouTube Creators','["southeast-safes-2782@pages.plusgoogle.com"]','[]',NULL,
  'Southeast Safes, your August Creator Month in Review is here','Your latest YouTube updates and insights.

Historical source: Gmail message 1a0af57223d48162.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0af57223d48162","gmail_thread_id":"1a0af57223d48162","labels":["UNREAD","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0af57223d48162',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0af56f3e8b485c','1a0af56f3e8b485c',
  NULL,'gmail-message:1a0af56f3e8b485c','2026-09-17T05:28:25-07:00','2026-09-17T05:28:25-07:00',
  'no-reply@youtube.com','YouTube Creators','["a1-action-safe-7040@pages.plusgoogle.com"]','[]',NULL,
  'A1-Action Safe & Lock, your August Creator Month in Review is here','Your latest YouTube updates and insights.

Historical source: Gmail message 1a0af56f3e8b485c.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0af56f3e8b485c","gmail_thread_id":"1a0af56f3e8b485c","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0af56f3e8b485c',
  NULL,'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0b08c69d72e84a','1a0b08c69d72e84a',
  NULL,'gmail-message:1a0b08c69d72e84a','2026-09-17T11:06:27-07:00','2026-09-17T11:06:27-07:00',
  'analytics-noreply@google.com','Google Analytics','["GlobalConceptsMediaLLC@gmail.com"]','[]',NULL,
  'Your Google Analytics performance report is in for August 21st - September 17th','Discover your latest metrics and gain key business insights.

Historical source: Gmail message 1a0b08c69d72e84a.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0b08c69d72e84a","gmail_thread_id":"1a0b08c69d72e84a","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0b08c69d72e84a',
  NULL,'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0b1103d3b506fc','1a0b1103d3b506fc',
  NULL,'gmail-message:1a0b1103d3b506fc','2026-09-17T20:30:25+00:00','2026-09-17T20:30:25+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 18, 2026 Alert triggered for 1 keywords Rule: Enters the

Historical source: Gmail message 1a0b1103d3b506fc.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0b1103d3b506fc","gmail_thread_id":"1a0b1103d3b506fc","labels":["UNREAD","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0b1103d3b506fc',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0b180f0039f0db','1a0b180f0039f0db',
  NULL,'gmail-message:1a0b180f0039f0db','2026-09-17T22:33:26+00:00','2026-09-17T22:33:26+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: A1 Action','Position Tracking Project: A1 Action • a1actionsafeandlock.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 18, 2026 Alert triggered for 1 keywords Rule:

Historical source: Gmail message 1a0b180f0039f0db.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0b180f0039f0db","gmail_thread_id":"1a0b180f0039f0db","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0b180f0039f0db',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0b1b2111ab1bba','1a0b1b2111ab1bba',
  NULL,'gmail-message:1a0b1b2111ab1bba','2026-09-17T23:27:10+00:00','2026-09-17T23:27:10+00:00',
  'sa@ahrefs.com','Ahrefs Site Audit','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  '(Southfloridasafes) Pages dropped from Top 10: 2 URLs','59 internal URLs were analyzed. Health Score 74 · Errors 53 · Warnings 13 · Notices 52 (−2)

Historical source: Gmail message 1a0b1b2111ab1bba.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0b1b2111ab1bba","gmail_thread_id":"1a0b1b2111ab1bba","labels":["UNREAD","Label_136499437826870853","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0b1b2111ab1bba',
  (SELECT id FROM clients WHERE client_code='SFS' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0b1ceea4987924','1a0b1ceea4987924',
  NULL,'gmail-message:1a0b1ceea4987924','2026-09-17T23:58:42+00:00','2026-09-17T23:58:42+00:00',
  'backlink.audit@semrush.com','Semrush Backlink Audit','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Backlink Audit update of sesafes.com. 14 New Toxic Domains; 3 New Trusted Domains','Backlink Audit updates Project: sesafes.com sesafes.com Audit date: Sep 17, 2026 Schedule rerun Hello! The project''s Toxicity Score has changed to Medium. We have found 17 new referring domains.

Historical source: Gmail message 1a0b1ceea4987924.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0b1ceea4987924","gmail_thread_id":"1a0b1ceea4987924","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0b1ceea4987924',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0b2528b2b2c2f4','1a0b2528b2b2c2f4',
  NULL,'gmail-message:1a0b2528b2b2c2f4','2026-09-18T02:22:27+00:00','2026-09-18T02:22:27+00:00',
  'sa@ahrefs.com','Ahrefs Site Audit','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  '(Northfloridasafes) Word count changed [New]: 1 URL','168 internal URLs were analyzed. Health Score 93 · Errors 428 · Warnings 141 · Notices 71 (+1)

Historical source: Gmail message 1a0b2528b2b2c2f4.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0b2528b2b2c2f4","gmail_thread_id":"1a0b2528b2b2c2f4","labels":["UNREAD","Label_136499437826870853","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0b2528b2b2c2f4',
  (SELECT id FROM clients WHERE client_code='NFS' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0b27b815195867','1a0b27b815195867',
  NULL,'gmail-message:1a0b27b815195867','2026-09-18T03:07:13+00:00','2026-09-18T03:07:13+00:00',
  'site-audit@semrush.com','Semrush Site Audit','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'pickettweaponry.com: Your Audit Report Is Ready','Site Audit Site Audit Project: pickettweaponry.com Website URL: pickettweaponry.com Date: Sep 18, 2026 (03:07:11) Hello, Here is the update for your Site Audit campaign. We haven''t detected any

Historical source: Gmail message 1a0b27b815195867.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0b27b815195867","gmail_thread_id":"1a0b27b815195867","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0b27b815195867',
  (SELECT id FROM clients WHERE client_code='PW' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0b70c6f1f894b9','1a0b70c6f1f894b9',
  NULL,'gmail-message:1a0b70c6f1f894b9','2026-09-19T00:24:00+00:00','2026-09-19T00:24:00+00:00',
  'site-audit@semrush.com','Semrush Site Audit','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'globalconceptsmedia.com: 1/7 page had its Core Web Vitals declined','Site Audit Site Audit Project: globalconceptsmedia.com Website URL: globalconceptsmedia.com Date: Sep 19, 2026 (00:23:58) Hello, Here is the update for your Site Audit campaign. We have detected that

Historical source: Gmail message 1a0b70c6f1f894b9.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0b70c6f1f894b9","gmail_thread_id":"1a0b70c6f1f894b9","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0b70c6f1f894b9',
  (SELECT id FROM clients WHERE client_code='GCM' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0b70e3e2eca97f','1a0b70e3e2eca97f',
  NULL,'gmail-message:1a0b70e3e2eca97f','2026-09-19T00:25:58+00:00','2026-09-19T00:25:58+00:00',
  'site-audit@semrush.com','Semrush Site Audit','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'moveasafe.com: Your Audit Report Is Ready','Site Audit Site Audit Project: moveasafe.com Website URL: moveasafe.com Date: Sep 19, 2026 (00:25:57) Hello, Here is the update for your Site Audit campaign. We haven''t detected any significant

Historical source: Gmail message 1a0b70e3e2eca97f.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0b70e3e2eca97f","gmail_thread_id":"1a0b70e3e2eca97f","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0b70e3e2eca97f',
  (SELECT id FROM clients WHERE client_code='MAS' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0bb4cf325de94a','1a0bb4cf325de94a',
  NULL,'gmail-message:1a0bb4cf325de94a','2026-09-19T20:12:56+00:00','2026-09-19T20:12:56+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 20, 2026 Alert triggered for 1 keywords Rule: Leaves the

Historical source: Gmail message 1a0bb4cf325de94a.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0bb4cf325de94a","gmail_thread_id":"1a0bb4cf325de94a","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0bb4cf325de94a',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0bbb51f33441bf','1a0bbb51f33441bf',
  NULL,'gmail-message:1a0bbb51f33441bf','2026-09-19T22:06:43+00:00','2026-09-19T22:06:43+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: A1 Action','Position Tracking Project: A1 Action • a1actionsafeandlock.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 20, 2026 Alert triggered for 1 keywords Rule:

Historical source: Gmail message 1a0bbb51f33441bf.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0bbb51f33441bf","gmail_thread_id":"1a0bbb51f33441bf","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0bbb51f33441bf',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0bc93eaee67b3b','1a0bc93eaee67b3b',
  NULL,'gmail-message:1a0bc93eaee67b3b','2026-09-20T02:10:04+00:00','2026-09-20T02:10:04+00:00',
  'site-audit@semrush.com','Semrush Site Audit','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'hbguns.com: robots.txt updated. Review changes','Site Audit Site Audit Project: hbguns.com Website URL: hbguns.com Date: Sep 20, 2026 (02:09:59) Hello, Here is the update for your Site Audit campaign. We have detected that your robots.txt file has

Historical source: Gmail message 1a0bc93eaee67b3b.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0bc93eaee67b3b","gmail_thread_id":"1a0bc93eaee67b3b","labels":["UNREAD","IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0bc93eaee67b3b',
  (SELECT id FROM clients WHERE client_code='HBG' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0bc9e874176358','1a0bc9e874176358',
  NULL,'gmail-message:1a0bc9e874176358','2026-09-20T02:21:40+00:00','2026-09-20T02:21:40+00:00',
  'site-audit@semrush.com','Semrush Site Audit','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'southfloridasafes.com: Your Audit Report Is Ready','Site Audit Site Audit Project: southfloridasafes.com Website URL: southfloridasafes.com Date: Sep 20, 2026 (02:21:38) Hello, Here is the update for your Site Audit campaign. We haven''t detected any

Historical source: Gmail message 1a0bc9e874176358.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0bc9e874176358","gmail_thread_id":"1a0bc9e874176358","labels":["UNREAD","IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0bc9e874176358',
  (SELECT id FROM clients WHERE client_code='SFS' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0bea0f2b22e693','1a0bea0f2b22e693',
  NULL,'gmail-message:1a0bea0f2b22e693','2026-09-20T04:43:33-07:00','2026-09-20T04:43:33-07:00',
  'businessprofile-noreply@google.com','Google Business Profile','["GlobalConceptsMediaLLC@gmail.com"]','[]',NULL,
  'Matthew left a review for Harry Beckwith Guns & Range','Go to reviews and respond to customers today.

Historical source: Gmail message 1a0bea0f2b22e693.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0bea0f2b22e693","gmail_thread_id":"1a0bea0f2b22e693","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0bea0f2b22e693',
  (SELECT id FROM clients WHERE client_code='HBG' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0c0a3333be1962','1a0c0a334c08932e',
  NULL,'gmail-message:1a0c0a3333be1962','2026-09-20T21:05:15+00:00','2026-09-20T21:05:15+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 21, 2026 Alert triggered for 1 keywords Rule: Leaves the

Historical source: Gmail message 1a0c0a3333be1962.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0c0a3333be1962","gmail_thread_id":"1a0c0a334c08932e","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0c0a3333be1962',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0c0a334c08932e','1a0c0a334c08932e',
  NULL,'gmail-message:1a0c0a334c08932e','2026-09-20T21:05:16+00:00','2026-09-20T21:05:16+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 21, 2026 Alert triggered for 1 keywords Rule: Enters the

Historical source: Gmail message 1a0c0a334c08932e.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0c0a334c08932e","gmail_thread_id":"1a0c0a334c08932e","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0c0a334c08932e',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0c10b1c9eb2bd2','1a0c10b1c9eb2bd2',
  NULL,'gmail-message:1a0c10b1c9eb2bd2','2026-09-20T22:58:45+00:00','2026-09-20T22:58:45+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: A1 Action','Position Tracking Project: A1 Action • a1actionsafeandlock.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 21, 2026 Alert triggered for 1 keywords Rule:

Historical source: Gmail message 1a0c10b1c9eb2bd2.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0c10b1c9eb2bd2","gmail_thread_id":"1a0c10b1c9eb2bd2","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0c10b1c9eb2bd2',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0c5256440c019b','1a0c5256440c019b',
  NULL,'gmail-message:1a0c5256440c019b','2026-09-21T11:05:57-07:00','2026-09-21T11:05:57-07:00',
  'analytics-noreply@google.com','Google Analytics','["GlobalConceptsMediaLLC@gmail.com"]','[]',NULL,
  'Your Google Analytics performance report is in for August 25th - September 21st','Discover your latest metrics and gain key business insights.

Historical source: Gmail message 1a0c5256440c019b.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0c5256440c019b","gmail_thread_id":"1a0c5256440c019b","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0c5256440c019b',
  NULL,'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0c41168f03f422','1a0c41168f03f422',
  NULL,'gmail-message:1a0c41168f03f422','2026-09-21T13:04:29+00:00','2026-09-21T13:04:29+00:00',
  'sa@ahrefs.com','Ahrefs Site Audit','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  '(Sesafes) 3XX redirect: 3 URLs','3 internal URLs were analyzed. Health Score 100 · Errors 0 · Warnings 3 · Notices 1

Historical source: Gmail message 1a0c41168f03f422.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0c41168f03f422","gmail_thread_id":"1a0c41168f03f422","labels":["Label_136499437826870853","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0c41168f03f422',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0c426965cc7d62','1a0c426965cc7d62',
  NULL,'gmail-message:1a0c426965cc7d62','2026-09-21T13:27:37+00:00','2026-09-21T13:27:37+00:00',
  'sa@ahrefs.com','Ahrefs Site Audit','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  '(A1actionsafeandlock) Orphan page (has no incoming internal links): 2 URLs','44 internal URLs were analyzed. Health Score 96 · Errors 2 · Warnings 40 · Notices 33

Historical source: Gmail message 1a0c426965cc7d62.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0c426965cc7d62","gmail_thread_id":"1a0c426965cc7d62","labels":["Label_136499437826870853","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0c426965cc7d62',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0c434e28bd2cb3','1a0c434e28bd2cb3',
  NULL,'gmail-message:1a0c434e28bd2cb3','2026-09-21T13:43:13+00:00','2026-09-21T13:43:13+00:00',
  'sa@ahrefs.com','Ahrefs Site Audit','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  '(Pickettweaponry) Slow server response for AI crawlers [New]: 1 URL','81 internal URLs were analyzed. Health Score 92 · Errors 19 · Warnings 81 · Notices 15 (+1)

Historical source: Gmail message 1a0c434e28bd2cb3.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0c434e28bd2cb3","gmail_thread_id":"1a0c434e28bd2cb3","labels":["Label_136499437826870853","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0c434e28bd2cb3',
  (SELECT id FROM clients WHERE client_code='PW' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0c5fdb34432b06','1a0c5fdb34432b06',
  NULL,'gmail-message:1a0c5fdb34432b06','2026-09-21T15:02:12-07:00','2026-09-21T15:02:12-07:00',
  'googlebase-noreply@google.com','Google Merchant Center','["GlobalConceptsMediaLLC@gmail.com"]','[]',NULL,
  'Your products are now eligible for native checkout on Google','Your Shopify store was matched to your Merchant Center.

Historical source: Gmail message 1a0c5fdb34432b06.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0c5fdb34432b06","gmail_thread_id":"1a0c5fdb34432b06","labels":["IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0c5fdb34432b06',
  NULL,'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0c5e4f44c7bda3','1a0c5e4f44c7bda3',
  NULL,'gmail-message:1a0c5e4f44c7bda3','2026-09-21T21:35:09+00:00','2026-09-21T21:35:09+00:00',
  'sa@ahrefs.com','Ahrefs Site Audit','["globalconceptsmediallc@gmail.com"]','[]',NULL,
  '(Hbguns) Site Audit crawl error','The website wasn''t fully crawled, but your crawl contains partial data that might be useful. Please check the report to learn more about how to fix this and contact support if this error keeps

Historical source: Gmail message 1a0c5e4f44c7bda3.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0c5e4f44c7bda3","gmail_thread_id":"1a0c5e4f44c7bda3","labels":["UNREAD","Label_136499437826870853","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0c5e4f44c7bda3',
  (SELECT id FROM clients WHERE client_code='HBG' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0cc3d7d3556879','1a0cc3d7d3556879',
  NULL,'gmail-message:1a0cc3d7d3556879','2026-09-22T20:09:36-07:00','2026-09-22T20:09:36-07:00',
  'businessprofile-noreply@google.com','Google Business Profile','["GlobalConceptsMediaLLC@gmail.com"]','[]',NULL,
  'Shannon left a review for A-1 Action Safe & Lock','Go to reviews and respond to customers today.

Historical source: Gmail message 1a0cc3d7d3556879.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0cc3d7d3556879","gmail_thread_id":"1a0cc3d7d3556879","labels":["IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0cc3d7d3556879',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0cac47750a68c2','1a0cac4720e911ce',
  NULL,'gmail-message:1a0cac47750a68c2','2026-09-22T20:17:47+00:00','2026-09-22T20:17:47+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 23, 2026 Alert triggered for 1 keywords Rule: Leaves the

Historical source: Gmail message 1a0cac47750a68c2.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0cac47750a68c2","gmail_thread_id":"1a0cac4720e911ce","labels":["IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0cac47750a68c2',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0cac4720e911ce','1a0cac4720e911ce',
  NULL,'gmail-message:1a0cac4720e911ce','2026-09-22T20:17:47+00:00','2026-09-22T20:17:47+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 23, 2026 Alert triggered for 3 keywords Rule: Enters the

Historical source: Gmail message 1a0cac4720e911ce.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0cac4720e911ce","gmail_thread_id":"1a0cac4720e911ce","labels":["IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0cac4720e911ce',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0cf4cd9ee44c66','1a0cf4cd9ee44c66',
  NULL,'gmail-message:1a0cf4cd9ee44c66','2026-09-23T17:25:14+00:00','2026-09-23T17:25:14+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings declined (northfloridasafes.com)','Position Tracking Project: northfloridasafes.com • northfloridasafes.com Device & Location: Alachua County,Florida,United States (Google) • English Date: Sep, 16-23, 2026 Hello, Here is the weekly

Historical source: Gmail message 1a0cf4cd9ee44c66.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0cf4cd9ee44c66","gmail_thread_id":"1a0cf4cd9ee44c66","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0cf4cd9ee44c66',
  (SELECT id FROM clients WHERE client_code='NFS' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0cf4cd97dda01f','1a0cf4cd766e5ef0',
  NULL,'gmail-message:1a0cf4cd97dda01f','2026-09-23T17:25:14+00:00','2026-09-23T17:25:14+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings increased (a1actionsafeandlock.com)','Position Tracking Project: A1 Action • a1actionsafeandlock.com Device & Location: Melbourne,Florida,United States (Google) • English Date: Sep, 16-23, 2026 Hello, Here is the weekly update for your

Historical source: Gmail message 1a0cf4cd97dda01f.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0cf4cd97dda01f","gmail_thread_id":"1a0cf4cd766e5ef0","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0cf4cd97dda01f',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0cf4cd7f26105e','1a0cf4cd7f26105e',
  NULL,'gmail-message:1a0cf4cd7f26105e','2026-09-23T17:25:14+00:00','2026-09-23T17:25:14+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings increased (globalconceptsmedia.com)','Position Tracking Project: globalconceptsmedia.com • globalconceptsmedia.com Device & Location: 32940,Florida,United States (Google) • English Date: Sep, 16-23, 2026 Hello, Here is the weekly

Historical source: Gmail message 1a0cf4cd7f26105e.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0cf4cd7f26105e","gmail_thread_id":"1a0cf4cd7f26105e","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0cf4cd7f26105e',
  (SELECT id FROM clients WHERE client_code='GCM' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0cf4cd766e5ef0','1a0cf4cd766e5ef0',
  NULL,'gmail-message:1a0cf4cd766e5ef0','2026-09-23T17:25:14+00:00','2026-09-23T17:25:14+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings increased (a1actionsafeandlock.com)','Position Tracking Project: A1 Action • a1actionsafeandlock.com Device & Location: Melbourne,Florida,United States (Google) • English Date: Sep, 16-23, 2026 Hello, Here is the weekly update for your

Historical source: Gmail message 1a0cf4cd766e5ef0.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0cf4cd766e5ef0","gmail_thread_id":"1a0cf4cd766e5ef0","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0cf4cd766e5ef0',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0cf4cd712d3f03','1a0cf4cd712d3f03',
  NULL,'gmail-message:1a0cf4cd712d3f03','2026-09-23T17:25:14+00:00','2026-09-23T17:25:14+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update (pickettweaponry.com)','Position Tracking Project: pickettweaponry.com • pickettweaponry.com Device & Location: Newberry,Florida,United States (Google) • English Date: Sep, 16-23, 2026 Hello, Here is the weekly update for

Historical source: Gmail message 1a0cf4cd712d3f03.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0cf4cd712d3f03","gmail_thread_id":"1a0cf4cd712d3f03","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0cf4cd712d3f03',
  (SELECT id FROM clients WHERE client_code='PW' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0cf4cd6c304c9f','1a0cf4cd6c304c9f',
  NULL,'gmail-message:1a0cf4cd6c304c9f','2026-09-23T17:25:14+00:00','2026-09-23T17:25:14+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings increased (sesafes.com)','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (Google) • English Date: Sep, 16-23, 2026 Hello, Here is the weekly update for your Position

Historical source: Gmail message 1a0cf4cd6c304c9f.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0cf4cd6c304c9f","gmail_thread_id":"1a0cf4cd6c304c9f","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0cf4cd6c304c9f',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0cf4cdb02b9956','1a0cf4cdb02b9956',
  NULL,'gmail-message:1a0cf4cdb02b9956','2026-09-23T17:25:15+00:00','2026-09-23T17:25:15+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings increased (hbguns.com)','Position Tracking Project: hbguns.com • hbguns.com Device & Location: Gainesville,Florida,United States (Google) • English Date: Sep, 16-23, 2026 Hello, Here is the weekly update for your Position

Historical source: Gmail message 1a0cf4cdb02b9956.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0cf4cdb02b9956","gmail_thread_id":"1a0cf4cdb02b9956","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0cf4cdb02b9956',
  (SELECT id FROM clients WHERE client_code='HBG' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0cf4cd90f4a860','1a0cf4cd90f4a860',
  NULL,'gmail-message:1a0cf4cd90f4a860','2026-09-23T17:25:15+00:00','2026-09-23T17:25:15+00:00',
  'position-tracking@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Position Tracking Update - Your rankings increased (southfloridasafes.com)','Position Tracking Project: southfloridasafes.com • southfloridasafes.com Device & Location: Fort Lauderdale,Florida,United States (Google) • English Date: Sep, 16-23, 2026 Hello, Here is the weekly

Historical source: Gmail message 1a0cf4cd90f4a860.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0cf4cd90f4a860","gmail_thread_id":"1a0cf4cd90f4a860","labels":["IMPORTANT","STARRED","Label_6019581603025083854","CATEGORY_UPDATES"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0cf4cd90f4a860',
  (SELECT id FROM clients WHERE client_code='SFS' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0cfec4c7bee9a0','1a0cfec4c7bee9a0',
  NULL,'gmail-message:1a0cfec4c7bee9a0','2026-09-23T20:19:24+00:00','2026-09-23T20:19:24+00:00',
  'position-tracking-alerts@semrush.com','Semrush Position Tracking','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Notification of rank change. Project: sesafes.com','Position Tracking Project: sesafes.com • sesafes.com Device & Location: Melbourne,Florida,United States (google) • English Date: September 24, 2026 Alert triggered for 1 keywords Rule: Enters the

Historical source: Gmail message 1a0cfec4c7bee9a0.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0cfec4c7bee9a0","gmail_thread_id":"1a0cfec4c7bee9a0","labels":["IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0cfec4c7bee9a0',
  (SELECT id FROM clients WHERE client_code='SES' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_intake (
  workspace_key,intake_address_id,provider,provider_message_id,provider_thread_id,
  internet_message_id,dedupe_key,received_at,source_date,from_address,from_name,
  to_addresses_json,cc_addresses_json,reply_to_address,subject,body_text,
  source_headers_json,has_attachments,attachment_metadata_json,raw_storage_reference,
  client_id,processing_status,created_at,updated_at
) VALUES (
  'gcm',NULL,'gmail_historical_backfill','1a0d3f1b9ed0701d','1a0d3f1b9ed0701d',
  NULL,'gmail-message:1a0d3f1b9ed0701d','2026-09-24T15:03:49+00:00','2026-09-24T15:03:49+00:00',
  'backlink.audit@semrush.com','Semrush Backlink Audit','["Andrew Belcher globalconceptsmediallc@gmail.com"]','[]',NULL,
  'Backlink Audit update of A1 Action. 77 New Toxic Domains; 14 New Trusted Domains','Backlink Audit updates Project: A1 Action www.a1actionsafeandlock.com Audit date: Sep 24, 2026 Schedule rerun Hello! We have found 85 new referring domains. You have lost 2 domains. 1 domains are

Historical source: Gmail message 1a0d3f1b9ed0701d.
Open the Gmail source if more detail is needed during human review.','{"gmail_message_id":"1a0d3f1b9ed0701d","gmail_thread_id":"1a0d3f1b9ed0701d","labels":["UNREAD","IMPORTANT","CATEGORY_UPDATES","INBOX"]}',
  0,'[]','https://mail.google.com/mail/u/?authuser=globalconceptsmediallc%40gmail.com#all/1a0d3f1b9ed0701d',
  (SELECT id FROM clients WHERE client_code='A1' COLLATE NOCASE LIMIT 1),'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

