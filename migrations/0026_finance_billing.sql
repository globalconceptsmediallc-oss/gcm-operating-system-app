-- =========================================================
-- Global Concepts Media Operating System
-- File: migrations/0026_finance_billing.sql
-- Version: 1.0.0
-- Status: Production Migration Candidate
-- Purpose: Create authoritative D1 Finance records for billing accounts,
--          invoices, invoice lines, and payments so Billing is no longer
--          dependent on browser localStorage.
-- Change Notes:
-- - Additive only. No existing production table or record is modified.
-- - Uses integer cents for monetary values.
-- - Preserves invoice numbers/revisions and payment references.
-- - Supports covered clients/locations and account snapshots through JSON.
-- - Adds external keys for duplicate-safe historical recovery/import.
-- =========================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS finance_billing_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact_name TEXT,
  billing_email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  logo_url TEXT,
  terms_days INTEGER NOT NULL DEFAULT 0,
  invoice_note TEXT,
  monthly_amount_cents INTEGER NOT NULL DEFAULT 0,
  covered_clients_json TEXT,
  default_services_json TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_finance_billing_accounts_status
  ON finance_billing_accounts(status, name);

CREATE TABLE IF NOT EXISTS finance_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  billing_account_id INTEGER NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_type TEXT NOT NULL DEFAULT 'monthly',
  invoice_date TEXT NOT NULL,
  due_date TEXT,
  billing_period TEXT,
  description TEXT,
  amount_cents INTEGER NOT NULL,
  paid_amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  email_to TEXT,
  original_invoice_number TEXT,
  revision_number INTEGER NOT NULL DEFAULT 0,
  correction_statement TEXT,
  replaces_invoice_id INTEGER,
  replaced_by_invoice_id INTEGER,
  account_snapshot_json TEXT,
  source_type TEXT NOT NULL DEFAULT 'gcm_os_finance',
  source_reference TEXT,
  external_key TEXT,
  gmail_draft_url TEXT,
  gmail_draft_created_at TEXT,
  sent_at TEXT,
  closed_at TEXT,
  superseded_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (billing_account_id) REFERENCES finance_billing_accounts(id),
  FOREIGN KEY (replaces_invoice_id) REFERENCES finance_invoices(id),
  FOREIGN KEY (replaced_by_invoice_id) REFERENCES finance_invoices(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_invoices_external_key
  ON finance_invoices(external_key)
  WHERE external_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_invoices_account_date
  ON finance_invoices(billing_account_id, invoice_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_finance_invoices_status
  ON finance_invoices(status, invoice_date DESC);

CREATE TABLE IF NOT EXISTS finance_invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  line_type TEXT NOT NULL DEFAULT 'service',
  description TEXT NOT NULL,
  location_label TEXT,
  amount_cents INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL DEFAULT 'gcm_os_finance',
  source_reference TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES finance_invoices(id)
);

CREATE INDEX IF NOT EXISTS idx_finance_invoice_lines_invoice
  ON finance_invoice_lines(invoice_id, sort_order, id);

CREATE TABLE IF NOT EXISTS finance_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  billing_account_id INTEGER NOT NULL,
  invoice_id INTEGER,
  payment_date TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  reference TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'closed',
  source_type TEXT NOT NULL DEFAULT 'gcm_os_finance',
  source_reference TEXT,
  external_key TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (billing_account_id) REFERENCES finance_billing_accounts(id),
  FOREIGN KEY (invoice_id) REFERENCES finance_invoices(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_payments_external_key
  ON finance_payments(external_key)
  WHERE external_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_payments_account_reference
  ON finance_payments(billing_account_id, reference, payment_date);

CREATE INDEX IF NOT EXISTS idx_finance_payments_account_date
  ON finance_payments(billing_account_id, payment_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_finance_payments_invoice
  ON finance_payments(invoice_id, payment_date, id);
