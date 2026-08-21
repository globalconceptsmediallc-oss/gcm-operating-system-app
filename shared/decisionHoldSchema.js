/* =========================================================
   Global Concepts Media Operating System
   File: shared/decisionHoldSchema.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Gmail — Decision Hold Schema Guard
   Purpose:
   Keep migrations authoritative while defensively ensuring the additive
   Decision Hold / Work Lite schema exists before production routes read or
   write it. This prevents a deployed route from failing when schema rollout
   lags application rollout.
   ========================================================= */

let schemaReady = null;

export async function ensureDecisionHoldSchema(db) {
  if (!db || typeof db.prepare !== "function" || typeof db.batch !== "function") {
    throw new Error("The production D1 binding cannot initialize Decision Hold schema.");
  }

  if (schemaReady) return schemaReady;

  schemaReady = db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS decision_holds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        source_type TEXT NOT NULL,
        source_reference TEXT NOT NULL,
        source_thread_reference TEXT,
        source_subject TEXT,
        source_sender TEXT,
        source_date TEXT,
        source_content TEXT,
        title TEXT NOT NULL,
        hold_type TEXT NOT NULL DEFAULT 'decision_question',
        question TEXT NOT NULL,
        why_it_matters TEXT,
        suggested_next_action TEXT,
        priority TEXT NOT NULL DEFAULT 'Low',
        due_date TEXT,
        review_on TEXT,
        status TEXT NOT NULL DEFAULT 'Open',
        owner TEXT NOT NULL DEFAULT 'Andy',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        released_at TEXT,
        resolved_at TEXT,
        resolution TEXT,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )
    `),
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_decision_holds_source_active
      ON decision_holds(source_reference)
      WHERE LOWER(COALESCE(status, 'open')) IN ('open', 'held', 'waiting')
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_decision_holds_client_status
      ON decision_holds(client_id, status, priority, created_at)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_decision_holds_review
      ON decision_holds(status, review_on, due_date)
    `)
  ]).then(result => ({ ok:true, result })).catch(error => {
    schemaReady = null;
    throw error;
  });

  return schemaReady;
}
