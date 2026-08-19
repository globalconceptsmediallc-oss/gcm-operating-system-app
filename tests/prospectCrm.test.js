/* =========================================================
   Global Concepts Media Operating System
   File: tests/prospectCrm.test.js
   Version: 1.0.0
   Status: Production Test Candidate
   Purpose: Verify the locked GCM CRM business rules that can be tested
            deterministically without production D1 writes.
   Change Notes:
   - Verifies 3-business-day proposal follow-up timing.
   - Verifies weekend handling.
   - Verifies minimum 25% initial-payment rule.
   - Verifies stage/status normalization helpers used by Prospect CRM.
   ========================================================= */

import assert from "node:assert/strict";
import {
  addBusinessDays,
  minimumInitialPaymentCents,
  normalizeProspectStage,
  normalizeProspectStatus
} from "../routes/prospectCrm.js";

assert.equal(
  addBusinessDays("2026-08-17", 3),
  "2026-08-20",
  "Agnor Aug 17 meaningful contact must create Aug 20 follow-up."
);

assert.equal(
  addBusinessDays("2026-08-21", 2),
  "2026-08-25",
  "Two business days from Friday must skip the weekend."
);

assert.equal(
  addBusinessDays("2026-08-22", 1),
  "2026-08-24",
  "A business-day calculation starting on Saturday must land on Monday."
);

assert.equal(
  minimumInitialPaymentCents(100000),
  25000,
  "A $1,000 contract must require at least $250 before work begins."
);

assert.equal(
  minimumInitialPaymentCents(99999),
  25000,
  "The 25% minimum must round up to the nearest cent."
);

assert.equal(normalizeProspectStage("Proposal Sent"), "proposal_sent");
assert.equal(normalizeProspectStage("Awaiting Decision"), "awaiting_decision");
assert.equal(normalizeProspectStatus("Active"), "active");
assert.equal(normalizeProspectStatus("NURTURE"), "nurture");

console.log("PASS Prospect CRM business rules");
