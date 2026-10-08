-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0040_seed_ses_shopify_outcomes_sep8_oct7.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Add verified Shopify outcome observations for the
--          Southeast Safes 90-Day Growth Review evidence gate.
--
-- Source evidence:
-- Shopify Analytics
-- Reporting period: Sep 8-Oct 7, 2026
-- Verified on: Oct 8, 2026
-- Reported outcomes:
-- - Orders = 1
-- - Total sales = $2,749
--
-- Rule:
-- Store factual platform-reported outcomes only.
-- No causal conclusion or campaign attribution is stored.
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
  'ses:q4-social-2026:shopify:orders:2026-09-08:2026-10-07',
  '2026-09-08',
  '2026-10-07',
  'campaign',
  'Shopify Analytics',
  'Online Store',
  'orders',
  1,
  'count',
  'platform_reported',
  'Shopify Analytics — Last 30 days, Sep 8-Oct 7, 2026; verified Oct 8, 2026',
  'Shopify Analytics reported 1 order for Southeast Safes during Sep 8-Oct 7, 2026. Factual outcome observation only; no causal interpretation is attached.',
  'Andy'
FROM clients c
JOIN schedule_items si
  ON si.client_id = c.id
WHERE lower(c.client_code) = 'ses'
  AND si.title = 'SES Q4 2026 Social Impact Test'
  AND si.archived_at IS NULL
LIMIT 1;

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
  'ses:q4-social-2026:shopify:total_sales:2026-09-08:2026-10-07',
  '2026-09-08',
  '2026-10-07',
  'campaign',
  'Shopify Analytics',
  'Online Store',
  'total_sales',
  2749,
  'USD',
  'platform_reported',
  'Shopify Analytics — Last 30 days, Sep 8-Oct 7, 2026; verified Oct 8, 2026',
  'Shopify Analytics reported $2,749 total sales for Southeast Safes during Sep 8-Oct 7, 2026. Factual outcome observation only; no causal interpretation is attached.',
  'Andy'
FROM clients c
JOIN schedule_items si
  ON si.client_id = c.id
WHERE lower(c.client_code) = 'ses'
  AND si.title = 'SES Q4 2026 Social Impact Test'
  AND si.archived_at IS NULL
LIMIT 1;
