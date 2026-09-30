-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0025_radar_test_site_url.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Store the verified test/staging site URL on Radar pre-appointment records.
-- Change Notes:
-- - Adds nullable test_site_url to crm_prospect_radar.
-- - Existing Radar records remain valid.
-- - Promotion to crm_prospects carries the same URL forward.
-- =========================================================

ALTER TABLE crm_prospect_radar ADD COLUMN test_site_url TEXT;
