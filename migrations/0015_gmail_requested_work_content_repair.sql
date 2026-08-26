-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0015_gmail_requested_work_content_repair.sql
-- Version: 1.0.0
-- Status: Additive Production Migration
-- Purpose: Repair human-routed Gmail Requested Work records created with
--          generic routing metadata instead of the preserved source request.
-- =========================================================

UPDATE work_items
SET
  title = COALESCE(
    (
      SELECT NULLIF(TRIM(c.subject), '')
      FROM communications c
      WHERE c.id = work_items.communication_id
      LIMIT 1
    ),
    title
  ),
  description = COALESCE(
    (
      SELECT NULLIF(TRIM(c.raw_content), '')
      FROM communications c
      WHERE c.id = work_items.communication_id
      LIMIT 1
    ),
    description
  )
WHERE title = 'Execute the requested work from the preserved source email and record the result as Proof of Work.'
  AND description = 'Human operational decision. AI/classifier eligibility was not used to permit or block this route.'
  AND EXISTS (
    SELECT 1
    FROM communications c
    WHERE c.id = work_items.communication_id
      AND c.source = 'Gmail — Human Routing'
      AND c.category = 'Requested Work'
  );
