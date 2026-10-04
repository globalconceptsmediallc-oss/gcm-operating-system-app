-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0031_seed_ses_q4_social_engagement_time_baseline.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Seed the third factual baseline measurement for the
--          SES Q4 2026 Social Impact Test from the same verified
--          Google Analytics performance email used for migrations
--          0029 and 0030.
--
-- Source evidence:
-- Gmail message ID: 1a04470a7c8391dc
-- Subject: Your Google Analytics performance report is in for July 31st - August 27th
-- Reported metric: Avg engagement time = 1m 16s
-- Normalized metric value: 76 seconds
--
-- Rule: observation only; no causal conclusion is stored.
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
  'ses:q4-social-2026:ga4:avg_engagement_time:2026-07-31:2026-08-27',
  '2026-07-31',
  '2026-08-27',
  'baseline',
  'Google Analytics',
  'Website',
  'avg_engagement_time',
  76,
  'seconds',
  'platform_reported',
  'Gmail 1a04470a7c8391dc — Google Analytics performance report for July 31st - August 27th',
  'Pre-campaign baseline. Google Analytics reported average engagement time of 1 minute 16 seconds (76 seconds) for Southeast Safes during July 31-August 27, 2026. No causal interpretation is attached.',
  'Andy'
FROM clients c
JOIN schedule_items si
  ON si.client_id = c.id
WHERE lower(c.client_code) = 'ses'
  AND si.title = 'SES Q4 2026 Social Impact Test'
  AND si.archived_at IS NULL
LIMIT 1;
