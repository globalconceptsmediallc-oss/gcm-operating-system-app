-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0032_seed_ses_q4_social_events_baseline.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Add the fourth factual GA4 baseline observation for
--          the SES Q4 2026 Social Impact Test.
-- Source: Google Analytics performance report, Jul 31-Aug 27, 2026.
-- Reported Events: 8.0K. Stored numeric value: 8000.
-- =========================================================

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO measurement_observations (
  client_id, schedule_item_id, observation_key,
  period_start, period_end, measurement_phase,
  source_system, channel, metric_key, metric_value, metric_unit,
  attribution_method, source_reference, notes, created_by
)
SELECT
  c.id,
  si.id,
  'ses:q4-social-2026:ga4:events:2026-07-31:2026-08-27',
  '2026-07-31',
  '2026-08-27',
  'baseline',
  'Google Analytics',
  'Website',
  'events',
  8000,
  'count',
  'platform_reported',
  'Google Analytics performance report for July 31-August 27, 2026',
  'Pre-campaign baseline. Google Analytics reported 8.0K events, normalized to 8000. No causal interpretation is attached.',
  'Andy'
FROM clients c
JOIN schedule_items si ON si.client_id = c.id
WHERE lower(c.client_code) = 'ses'
  AND si.title = 'SES Q4 2026 Social Impact Test'
  AND si.archived_at IS NULL
LIMIT 1;
