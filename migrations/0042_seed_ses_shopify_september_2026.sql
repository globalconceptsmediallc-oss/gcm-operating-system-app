-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0042_seed_ses_shopify_september_2026.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Store the exact September 2026 Southeast Safes Shopify commerce
--          snapshot for Monthly Growth Review use.
--
-- Source:
-- - Connected Shopify Analytics shop: southeast-safes.myshopify.com
-- - Review period: 2026-09-01 through 2026-09-30
-- - Comparison period verified separately: 2026-08-02 through 2026-08-31
-- - Pulled: 2026-10-11
--
-- Rules:
-- - Platform-reported facts only.
-- - No campaign attribution or causal conclusion.
-- - Session funnel rates are calculated from Shopify-reported session counts
--   when Shopify returned counts plus the aggregate conversion-rate field.
-- - Change percentages are deterministic calculations from the exact
--   current-period and comparison-period Shopify values preserved below.
-- - Existing Commerce Performance UNIQUE key keeps this migration idempotent.
-- =========================================================

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO client_commerce_performance (
  client_id,
  source_system,
  period_start,
  period_end,
  comparison_start,
  comparison_end,
  currency,
  gross_sales,
  discounts,
  sales_reversals,
  net_sales,
  shipping_charges,
  return_fees,
  taxes,
  total_sales,
  orders,
  orders_fulfilled,
  average_order_value,
  returning_customer_rate,
  sessions,
  conversion_rate,
  added_to_cart_count,
  added_to_cart_rate,
  reached_checkout_count,
  reached_checkout_rate,
  completed_checkout_count,
  completed_checkout_rate,
  gross_sales_change_pct,
  total_sales_change_pct,
  orders_change_pct,
  orders_fulfilled_change_pct,
  average_order_value_change_pct,
  sessions_change_pct,
  conversion_rate_change_pct,
  added_to_cart_change_pct,
  reached_checkout_change_pct,
  completed_checkout_change_pct,
  source_reference,
  data_caveat,
  notes,
  created_by
)
SELECT
  c.id,
  'Shopify Analytics',
  '2026-09-01',
  '2026-09-30',
  '2026-08-02',
  '2026-08-31',
  'USD',
  2399.00,
  0.00,
  0.00,
  2399.00,
  350.00,
  0.00,
  0.00,
  2749.00,
  1,
  2,
  2399.00,
  0.00,
  5518,
  0.018123,
  116,
  2.102211,
  87,
  1.576658,
  1,
  0.018123,
  -39.979985,
  -36.760985,
  -66.666667,
  -50.000000,
  80.060090,
  -15.858493,
  -60.384197,
  33.333333,
  29.850746,
  -66.666667,
  'Connected Shopify Analytics — Southeast Safes — exact Sep 1-Sep 30, 2026; comparison Aug 2-Aug 31, 2026; pulled Oct 11, 2026',
  'Shopify Analytics states that beginning Sep 21, 2026, sessions and related metrics may shift because of a definition change. Session and conversion-rate comparisons should therefore be interpreted with caution.',
  'Exact September Growth Review commerce snapshot. Current Shopify values: gross/net sales $2,399; total sales $2,749; orders 1; fulfilled 2; AOV $2,399; sessions 5,518; cart sessions 116; reached checkout 87; completed checkout 1; Shopify aggregate conversion rate 0.018122508%. Comparison Aug 2-Aug 31: gross/net sales $3,997; total sales $4,347; orders 3; fulfilled 4; AOV $1,332.333; sessions 6,558; cart sessions 87; reached checkout 67; completed checkout 3; conversion rate 0.045745654%. Platform-reported facts only; no campaign attribution or causal conclusion.',
  'Andy'
FROM clients c
WHERE lower(c.client_code) = 'ses'
LIMIT 1;
