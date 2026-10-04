-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0028_measurement_observations.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Durable factual measurement observations tied to an approved
--          Schedule Authority item so campaign outcomes can flow into
--          Evidence, Reviewed Findings, and Proof without duplicating
--          campaign records or storing unsupported conclusions.
--
-- Rules:
-- - Store observations, not causal conclusions.
-- - One row = one metric for one exact measurement period.
-- - Every observation belongs to one client and one schedule item.
-- - observation_key prevents duplicate imports for the same campaign.
-- - Do not store customer PII or full platform reports in this table.
-- =========================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS measurement_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  schedule_item_id INTEGER NOT NULL,
  observation_key TEXT NOT NULL,

  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  measurement_phase TEXT NOT NULL,

  source_system TEXT NOT NULL,
  channel TEXT,
  metric_key TEXT NOT NULL,
  metric_value REAL NOT NULL,
  metric_unit TEXT NOT NULL DEFAULT 'count',

  attribution_method TEXT NOT NULL DEFAULT 'unknown',
  source_reference TEXT,
  notes TEXT,

  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL DEFAULT 'Andy',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (schedule_item_id) REFERENCES schedule_items(id),

  UNIQUE (client_id, schedule_item_id, observation_key),

  CHECK (measurement_phase IN ('baseline','campaign','post_campaign')),
  CHECK (attribution_method IN ('direct_utm','platform_reported','manual_sales','date_correlation','unknown')),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_measurement_observations_schedule_period
  ON measurement_observations(schedule_item_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_measurement_observations_client_metric
  ON measurement_observations(client_id, metric_key, period_start);

CREATE INDEX IF NOT EXISTS idx_measurement_observations_phase_source
  ON measurement_observations(measurement_phase, source_system, period_start);
