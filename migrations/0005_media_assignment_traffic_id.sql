-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0005_media_assignment_traffic_id.sql
-- Version: 1.0.0
-- Status: Production Candidate
-- Sprint: Market-Level Traffic ID / ISCI
-- Purpose: Store the station traffic identifier on each Creative market
--          assignment so one reusable Creative can run in multiple markets
--          with distinct traffic IDs.
-- =========================================================

ALTER TABLE media_creative_assignments
ADD COLUMN traffic_id TEXT;

CREATE INDEX IF NOT EXISTS idx_media_creative_assignments_traffic_id
ON media_creative_assignments(traffic_id);
