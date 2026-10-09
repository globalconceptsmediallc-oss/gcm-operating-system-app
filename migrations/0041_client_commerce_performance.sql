-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0041_client_commerce_performance.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Store client-level commerce performance snapshots independently
--          from campaign Schedule Authority so Growth Reviews can use actual
--          sales/order outcomes without implying campaign causality.
--
-- Rules:
-- - One row = one source + one exact reporting period.
-- - Store platform-reported facts only.
-- - Comparison deltas describe the source dashboard comparison period only.
-- - Session/conversion metrics may carry source-specific definition caveats.
-- - No causal conclusion is stored in this table.
-- =========================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS client_commerce_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  source_system TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  comparison_start TEXT,
  comparison_end TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',

  gross_sales REAL,
  discounts REAL,
  sales_reversals REAL,
  net_sales REAL,
  shipping_charges REAL,
  return_fees REAL,
  taxes REAL,
  total_sales REAL,

  orders INTEGER,
  orders_fulfilled INTEGER,
  average_order_value REAL,
  returning_customer_rate REAL,

  sessions INTEGER,
  conversion_rate REAL,
  added_to_cart_count INTEGER,
  added_to_cart_rate REAL,
  reached_checkout_count INTEGER,
  reached_checkout_rate REAL,
  completed_checkout_count INTEGER,
  completed_checkout_rate REAL,

  gross_sales_change_pct REAL,
  total_sales_change_pct REAL,
  orders_change_pct REAL,
  orders_fulfilled_change_pct REAL,
  average_order_value_change_pct REAL,
  sessions_change_pct REAL,
  conversion_rate_change_pct REAL,
  added_to_cart_change_pct REAL,
  reached_checkout_change_pct REAL,
  completed_checkout_change_pct REAL,

  source_reference TEXT,
  data_caveat TEXT,
  notes TEXT,
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL DEFAULT 'Andy',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (client_id) REFERENCES clients(id),

  UNIQUE (client_id, source_system, period_start, period_end),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_client_commerce_period
  ON client_commerce_performance(client_id, period_start, period_end);

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
  '2026-07-12',
  '2026-10-09',
  '2026-04-13',
  '2026-07-11',
  'USD',
  10535.00,
  0.00,
  0.00,
  10535.00,
  700.00,
  0.00,
  289.73,
  11524.73,
  5,
  7,
  2107.00,
  0.00,
  12799,
  0.03,
  254,
  1.98,
  178,
  1.39,
  5,
  0.03,
  58,
  43,
  -17,
  40,
  90,
  30,
  -23,
  9,
  24,
  0,
  'Shopify Analytics — custom Jul 12-Oct 9, 2026 dashboard compared with Apr 13-Jul 11, 2026; verified Oct 9, 2026',
  'Shopify Analytics states that beginning Sep 21, 2026, sessions and related metrics may shift because of a definition change. Session and conversion-rate comparisons should therefore be interpreted with caution.',
  'Verified client-level commerce snapshot for the Southeast Safes 90-Day Growth Review. Platform-reported facts only; no campaign attribution or causal conclusion is attached.',
  'Andy'
FROM clients c
WHERE lower(c.client_code) = 'ses'
LIMIT 1;
