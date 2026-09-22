-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0018_gcm_operations_intake_address.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Sprint: Universal Email Intake — First Live Address
-- Purpose: Register the first GCM OS intake address without changing any
--          existing Gmail, Google Workspace, Communication, Work, or Proof data.
-- =========================================================

INSERT OR IGNORE INTO email_intake_addresses (
  workspace_key,
  intake_token,
  intake_address,
  label,
  is_active
) VALUES (
  'gcm',
  'operations',
  'operations@gcmosmail.com',
  'GCM Operations Intake',
  1
);
