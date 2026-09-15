-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0016_everhealth_radar_repair.sql
-- Version: 1.0.0
-- Purpose: Repair the verified EverHealth Radar contact and remove the
--          accidental duplicate prospect-research record created during
--          the contact-edit workaround.
-- =========================================================

UPDATE crm_prospect_radar
SET contact_name = 'Dr. Sanjay Pattani',
    contact_email = 'drpattani@everhealthinstitute.com',
    updated_at = CURRENT_TIMESTAMP
WHERE archived_at IS NULL
  AND LOWER(TRIM(COALESCE(business_name, ''))) = 'everhealth institute'
  AND LOWER(COALESCE(status, 'radar')) != 'promoted';

DELETE FROM crm_prospect_radar_intelligence
WHERE intelligence_type = 'prospect_research'
  AND radar_id IN (
    SELECT id
    FROM crm_prospect_radar
    WHERE archived_at IS NULL
      AND LOWER(TRIM(COALESCE(business_name, ''))) = 'everhealth institute'
  )
  AND id NOT IN (
    SELECT MAX(i2.id)
    FROM crm_prospect_radar_intelligence i2
    WHERE i2.intelligence_type = 'prospect_research'
      AND i2.radar_id IN (
        SELECT id
        FROM crm_prospect_radar
        WHERE archived_at IS NULL
          AND LOWER(TRIM(COALESCE(business_name, ''))) = 'everhealth institute'
      )
    GROUP BY i2.radar_id
  );
