-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0036_seed_ses_q4_large_gun_safes_page_views_baseline.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Expand the SES Q4 2026 Social Impact Test baseline with
--          the next page-level Google Analytics observation from
--          the verified Jul 31-Aug 27, 2026 performance report.
--
-- Source page/screen name:
-- Large Gun Safes for Sale in Florida | Southeast Safes
-- Reported Views: 129
--
-- Rule: factual observation only; no causal conclusion is stored.
-- =========================================================

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO measurement_observations (
  client_id,
  schedule_item_id,
  observation_key,
  period_start,
  period_end,
  measurement_phase,
  source_system,
  channel,
  metric_key,
  metric_value,
  metric_unit,
  attribution_method,
  source_reference,
  notes,
  created_by
)
SELECT
  c.id,
  si.id,
  'ses:q4-social-2026:ga4:page_views:large-gun-safes-florida:2026-07-31:2026-08-27',
  '2026-07-31',
  '2026-08-27',
  'baseline',
  'Google Analytics',
  'Website',
  'page_views',
  129,
  'count',
  'platform_reported',
  'Google Analytics performance report for July 31-August 27, 2026',
  'Pre-campaign baseline. GA4 reported 129 views for page/screen "Large Gun Safes for Sale in Florida | Southeast Safes" during July 31-August 27, 2026. No causal interpretation is attached.',
  'Andy'
FROM clients c
JOIN schedule_items si ON si.client_id = c.id
WHERE lower(c.client_code) = 'ses'
  AND si.title = 'SES Q4 2026 Social Impact Test'
  AND si.archived_at IS NULL
LIMIT 1;
