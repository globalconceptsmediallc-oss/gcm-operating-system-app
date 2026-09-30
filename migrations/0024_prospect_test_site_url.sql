-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0024_prospect_test_site_url.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Store one verified test/staging site URL on each formal Prospect.
-- Change Notes:
-- - Adds test_site_url to crm_prospects.
-- - Keeps the field nullable so existing Prospect records remain valid.
-- - Does not infer or manufacture a staging URL.
-- =========================================================

ALTER TABLE crm_prospects ADD COLUMN test_site_url TEXT;
