-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0044_growth_review_interpretations.sql
-- Version: 1.0.0
-- Status: Additive Production Migration Candidate
-- Purpose: Human-reviewed interpretation of explicitly included issues.
-- No operational record is mutated; no generator is activated.
-- =========================================================
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS growth_review_interpretations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  selection_id INTEGER NOT NULL UNIQUE,
  verified_facts TEXT NOT NULL DEFAULT '',
  evidence_references TEXT NOT NULL DEFAULT '',
  growth_implications TEXT NOT NULL DEFAULT '',
  recommended_action TEXT NOT NULL DEFAULT '',
  client_narrative TEXT NOT NULL DEFAULT '',
  caveats TEXT NOT NULL DEFAULT '',
  draft_source_snapshot TEXT NOT NULL DEFAULT '',
  approval_source_snapshot TEXT,
  review_status TEXT NOT NULL DEFAULT 'draft',
  saved_by TEXT NOT NULL DEFAULT 'Andy',
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (selection_id) REFERENCES growth_review_issue_selections(id),
  CHECK (review_status IN ('draft','approved','needs_review'))
);

CREATE INDEX IF NOT EXISTS idx_growth_review_interpretations_status
  ON growth_review_interpretations(review_status);

-- Every explicit reselection invalidates approval, even if two decisions
-- share a timestamp. The original operational record is untouched.
CREATE TRIGGER IF NOT EXISTS trg_growth_review_selection_requires_reinterpretation
AFTER UPDATE ON growth_review_issue_selections
BEGIN
  UPDATE growth_review_interpretations
  SET review_status='needs_review',
      draft_source_snapshot='',
      approval_source_snapshot=NULL,
      approved_by=NULL,
      approved_at=NULL,
      updated_at=CURRENT_TIMESTAMP
  WHERE selection_id=NEW.id;
END;
