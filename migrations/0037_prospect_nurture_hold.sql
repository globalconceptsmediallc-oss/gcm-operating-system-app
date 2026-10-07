-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0037_prospect_nurture_hold.sql
-- Version: 1.0.0
-- Status: Production Migration
-- Purpose: Add durable reactivation-trigger fields for the shared
--          Prospect / Radar Nurture-Hold workflow.
-- Change Notes:
-- - Formal Prospects already store nurture_reason; adds nurture_trigger.
-- - Radar gains nurture_reason and nurture_trigger so pre-appointment
--   opportunities can be intentionally parked without promotion.
-- - Review dates continue to use the existing durable Next Action fields.
-- =========================================================

PRAGMA foreign_keys = ON;

ALTER TABLE crm_prospects ADD COLUMN nurture_trigger TEXT;
ALTER TABLE crm_prospect_radar ADD COLUMN nurture_reason TEXT;
ALTER TABLE crm_prospect_radar ADD COLUMN nurture_trigger TEXT;

CREATE INDEX IF NOT EXISTS idx_crm_prospect_radar_nurture_review
  ON crm_prospect_radar(status, next_action_due_date);

CREATE INDEX IF NOT EXISTS idx_crm_prospects_nurture_review
  ON crm_prospects(status, next_action_due_date);
