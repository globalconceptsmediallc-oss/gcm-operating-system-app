-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0007_work_item_due_date.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Add an optional durable due date to Work Items so real
--          commitments can drive Today/shared-navigation urgency.
-- Change Notes:
-- - Adds nullable work_items.due_date as YYYY-MM-DD text.
-- - Does not invent or backfill dates for existing Work Items.
-- - Adds an index for unresolved deadline scanning.
-- =========================================================

ALTER TABLE work_items ADD COLUMN due_date TEXT;

CREATE INDEX IF NOT EXISTS idx_work_items_status_due_date
ON work_items(status, due_date);
