/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailMonitoringEvidenceParity.test.js
   Version: 1.0.0
   Status: Production Regression Test
   Purpose: Reproduce the live A1 Position Tracking Monitoring failure where
            Gmail text/plain is thin while text/html contains the exact ranking
            evidence required by the authoritative Save as Monitoring path.
   ========================================================= */

import assert from "node:assert/strict";
import { selectEvidenceRichMessageText } from "../routes/gmailDispositions.js";
import { extractPositionTrackingEvidence } from "../shared/gmailMonitoringEvidence.js";

const thinPlainText = `
Semrush notification
View alerts online
Millions of marketers have already used Semrush to get measurable results.
`;

const richHtmlText = `
Position Tracking
Project: A1 Action • a1actionsafeandlock.com
Device & Location: Melbourne,Florida,United States (google) • English
Date: August 24, 2026
Alert triggered for 1 keywords
Rule: Enters the top 10
Domain: a1actionsafeandlock.com
Keyword Pos. on Aug 24 Diff. Volume
locksmith for commercial doors 9 2 0
Go to Campaign
`;

assert.equal(
  extractPositionTrackingEvidence(thinPlainText),
  null,
  "Thin Gmail plain text should not independently invent Position Tracking evidence"
);

const selected = selectEvidenceRichMessageText(thinPlainText, richHtmlText);
assert.match(selected, /locksmith for commercial doors/i);
assert.match(selected, /Enters the top 10/i);

const evidence = extractPositionTrackingEvidence(selected);
assert.ok(evidence, "Evidence-rich source selection must preserve the Position Tracking report");
assert.equal(evidence.type, "position_tracking");
assert.equal(evidence.domain, "a1actionsafeandlock.com");
assert.equal(evidence.reportDate, "August 24, 2026");
assert.equal(evidence.rule, "Enters the top 10");
assert.equal(evidence.keywordCount, 1);
assert.equal(evidence.keywords.length, 1);
assert.equal(evidence.keywords[0].keyword, "locksmith for commercial doors");
assert.equal(evidence.keywords[0].position, 9);
assert.equal(evidence.keywords[0].change, 2);
assert.equal(evidence.keywords[0].volume, 0);

console.log("PASS Gmail Monitoring write selects the evidence-rich source and preserves A1 #9 / +2 Position Tracking evidence");
