-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0004_existing_media_recovery_status.sql
-- Version: 1.0.0
-- Status: Production Migration
-- Sprint: Existing / Already-Trafficked Media Recovery
-- Purpose: Correct recovered scheduled placements so station-confirmed future
--          media is treated as ready/scheduled rather than preparation work,
--          and repair the verified SESLM2601 confirmation timestamp.
-- =========================================================

UPDATE media_records
SET status = 'ready',
    updated_at = CURRENT_TIMESTAMP
WHERE action_type = 'existing_media_recovery'
  AND LOWER(COALESCE(status, '')) = 'planned'
  AND LOWER(COALESCE(traffic_status, '')) = 'sent'
  AND LOWER(COALESCE(confirmation_status, '')) = 'confirmed';

UPDATE media_records
SET notes = REPLACE(
      notes,
      'Received at: 2026-08-11T01:16',
      'Received at: 2026-08-11T13:16'
    ) || CHAR(10) ||
    'Evidence Correction | 2026-08-15 | Gmail verified Stephanie Stein confirmation at 2026-08-11T13:16; the recovery form originally recorded 01:16.',
    updated_at = CURRENT_TIMESTAMP
WHERE action_type = 'existing_media_recovery'
  AND UPPER(COALESCE(creative_version, '')) = 'SESLM2601'
  AND notes LIKE '%Received at: 2026-08-11T01:16%';
