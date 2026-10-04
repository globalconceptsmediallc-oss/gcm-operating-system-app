-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0029_seed_ses_q4_social_baseline.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Seed the first factual baseline measurement for the
--          SES Q4 2026 Social Impact Test from a verified Google
--          Analytics performance email already held in GCM Gmail.
--
-- Source evidence:
-- Gmail message ID: 1a04470a7c8391dc
-- Subject: Your Google Analytics performance report is in for July 31st - August 27th
-- Reported metric: Active Users = 840
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
  'ses:q4-social-2026:ga4:active_users:2026-07-31:2026-08-27',
  '2026-07-31',
  '2026-08-27',
  'baseline',
  'Google Analytics',
  'Website',
  'active_users',
  840,
  'count',
  'platform_reported',
  'Gmail 1a04470a7c8391dc — Google Analytics performance report for July 31st - August 27th',
  'Pre-campaign baseline. Google Analytics reported 840 Active Users for Southeast Safes during July 31-August 27, 2026. No causal interpretation is attached.',
  'Andy'
FROM clients c
JOIN schedule_items si
  ON si.client_id = c.id
WHERE lower(c.client_code) = 'ses'
  AND si.title = 'SES Q4 2026 Social Impact Test'
  AND si.archived_at IS NULL
LIMIT 1;
