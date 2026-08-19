-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0008_prospect_crm.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Add the durable Prospecting Radar + CRM relationship record that
--          connects prospecting intelligence, real appointments, discovery,
--          proposals, follow-up, agreements, payments, and client handoff.
-- Change Notes:
-- - Adds CRM-prefixed tables only; no existing production table is modified.
-- - Keeps pre-appointment businesses in Radar instead of manufacturing Prospects.
-- - Formal CRM Prospects require a real appointment timestamp.
-- - Preserves contacts, activities, intelligence, proposals, dated next actions,
--   agreements, and payment history as separate durable records.
-- - Leaves final Client conversion to a later verified handoff change.
-- =========================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crm_prospect_radar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_type TEXT NOT NULL DEFAULT 'business',
  business_name TEXT,
  website TEXT,
  vertical TEXT,
  market TEXT,
  source_type TEXT NOT NULL,
  source_description TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  evidence_reference TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'radar',
  promoted_prospect_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  promoted_at TEXT,
  archived_at TEXT,
  FOREIGN KEY (promoted_prospect_id) REFERENCES crm_prospects(id)
);

CREATE INDEX IF NOT EXISTS idx_crm_prospect_radar_status
  ON crm_prospect_radar(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_crm_prospect_radar_business
  ON crm_prospect_radar(business_name);

CREATE TABLE IF NOT EXISTS crm_prospects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  radar_id INTEGER,
  business_name TEXT NOT NULL,
  legal_name TEXT,
  website TEXT,
  industry TEXT,
  market TEXT,
  source_type TEXT,
  source_description TEXT,
  appointment_at TEXT NOT NULL,
  calendar_appointment_id INTEGER,
  appointment_status TEXT NOT NULL DEFAULT 'scheduled',
  stage TEXT NOT NULL DEFAULT 'appointment_scheduled',
  status TEXT NOT NULL DEFAULT 'active',
  opportunity_summary TEXT,
  estimated_value_low_cents INTEGER,
  estimated_value_high_cents INTEGER,
  recurring_value_cents INTEGER,
  recurring_period TEXT,
  last_meaningful_contact_at TEXT,
  next_action_due_date TEXT,
  converted_client_id INTEGER,
  converted_at TEXT,
  lost_reason TEXT,
  nurture_reason TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (radar_id) REFERENCES crm_prospect_radar(id),
  FOREIGN KEY (calendar_appointment_id) REFERENCES calendar_appointments(id),
  FOREIGN KEY (converted_client_id) REFERENCES clients(id)
);

CREATE INDEX IF NOT EXISTS idx_crm_prospects_status_stage
  ON crm_prospects(status, stage, updated_at);

CREATE INDEX IF NOT EXISTS idx_crm_prospects_next_action_due
  ON crm_prospects(next_action_due_date, status);

CREATE INDEX IF NOT EXISTS idx_crm_prospects_business
  ON crm_prospects(business_name);

CREATE TABLE IF NOT EXISTS crm_prospect_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES crm_prospects(id)
);

CREATE INDEX IF NOT EXISTS idx_crm_prospect_contacts_prospect
  ON crm_prospect_contacts(prospect_id, is_primary DESC, id ASC);

CREATE TABLE IF NOT EXISTS crm_prospect_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  direction TEXT,
  subject TEXT,
  summary TEXT NOT NULL,
  outcome TEXT,
  meaningful_contact INTEGER NOT NULL DEFAULT 0,
  source_type TEXT,
  source_reference TEXT,
  external_key TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES crm_prospects(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_prospect_activities_external_key
  ON crm_prospect_activities(external_key)
  WHERE external_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_prospect_activities_timeline
  ON crm_prospect_activities(prospect_id, occurred_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS crm_prospect_intelligence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id INTEGER NOT NULL,
  intelligence_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  intelligence_json TEXT,
  source_type TEXT,
  source_reference TEXT,
  external_key TEXT,
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES crm_prospects(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_prospect_intelligence_external_key
  ON crm_prospect_intelligence(external_key)
  WHERE external_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_prospect_intelligence_prospect
  ON crm_prospect_intelligence(prospect_id, captured_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS crm_prospect_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id INTEGER NOT NULL,
  proposal_type TEXT NOT NULL DEFAULT 'proposal',
  title TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  scope_summary TEXT,
  value_low_cents INTEGER,
  value_high_cents INTEGER,
  recurring_value_cents INTEGER,
  recurring_period TEXT,
  terms_json TEXT,
  source_type TEXT,
  source_reference TEXT,
  external_key TEXT,
  decision_at TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES crm_prospects(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_prospect_proposals_external_key
  ON crm_prospect_proposals(external_key)
  WHERE external_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_prospect_proposals_prospect
  ON crm_prospect_proposals(prospect_id, sent_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS crm_prospect_next_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  due_date TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Normal',
  status TEXT NOT NULL DEFAULT 'open',
  reason TEXT,
  source_type TEXT,
  source_reference TEXT,
  completed_at TEXT,
  completion_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES crm_prospects(id)
);

CREATE INDEX IF NOT EXISTS idx_crm_prospect_next_actions_open_due
  ON crm_prospect_next_actions(status, due_date, prospect_id);

CREATE INDEX IF NOT EXISTS idx_crm_prospect_next_actions_prospect
  ON crm_prospect_next_actions(prospect_id, status, due_date);

CREATE TABLE IF NOT EXISTS crm_prospect_agreements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id INTEGER NOT NULL,
  agreement_type TEXT NOT NULL DEFAULT 'signed_scope',
  status TEXT NOT NULL DEFAULT 'signed',
  signed_at TEXT NOT NULL,
  scope_summary TEXT NOT NULL,
  contract_value_cents INTEGER NOT NULL,
  initial_payment_required_cents INTEGER NOT NULL,
  initial_payment_received_cents INTEGER NOT NULL DEFAULT 0,
  initial_payment_received_at TEXT,
  work_authorized_at TEXT,
  source_type TEXT,
  source_reference TEXT,
  external_key TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES crm_prospects(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_prospect_agreements_external_key
  ON crm_prospect_agreements(external_key)
  WHERE external_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_prospect_agreements_prospect
  ON crm_prospect_agreements(prospect_id, signed_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS crm_prospect_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id INTEGER NOT NULL,
  agreement_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  received_at TEXT NOT NULL,
  payment_method TEXT,
  source_type TEXT,
  source_reference TEXT,
  external_key TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES crm_prospects(id),
  FOREIGN KEY (agreement_id) REFERENCES crm_prospect_agreements(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_prospect_payments_external_key
  ON crm_prospect_payments(external_key)
  WHERE external_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_prospect_payments_agreement
  ON crm_prospect_payments(agreement_id, received_at ASC, id ASC);
