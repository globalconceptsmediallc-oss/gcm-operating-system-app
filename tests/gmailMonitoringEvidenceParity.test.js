/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailMonitoringEvidenceParity.test.js
   Version: 1.1.0
   Status: Production Regression Test
   Purpose: Lock authoritative Gmail Monitoring evidence parity across the live
            A1 Position Tracking thin-plain/rich-HTML case and the HB Guns
            Semrush Site Audit case where HTML is mislabeled as text/plain.

   Change notes — v1.1.0:
   - Reproduces the live HB Guns Semrush MIME defect where text/plain contains
     HTML markup and previously won write-time evidence-richness selection.
   - Requires Site Health and the exact Site Audit metrics/deltas to survive
     malformed MIME normalization and remain preservable Monitoring evidence.
   - Preserves the existing A1 #9 / +2 Position Tracking regression.
   ========================================================= */

import assert from "node:assert/strict";
import { selectEvidenceRichMessageText } from "../routes/gmailDispositions.js";
import {
  extractPositionTrackingEvidence,
  extractMonitoringEvidence
} from "../shared/gmailMonitoringEvidence.js";

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

const hbgMislabeledPlainHtml = `
<div style="font-size:14px;line-height:20px;color:#171a22">
  <h1>Site Audit</h1>
  <p>hbguns.com: Great Job! You've Got Better Results</p>
  <table>
    <tr><td>Site Health</td><td>70%</td></tr>
    <tr><td>Errors</td><td>222 (-25)</td></tr>
    <tr><td>Warnings</td><td>5035 (-603)</td></tr>
    <tr><td>Notices</td><td>2065 (-191)</td></tr>
    <tr><td>Broken</td><td>3 (+1)</td></tr>
    <tr><td>Blocked</td><td>104 (-4)</td></tr>
    <tr><td>Crawled Pages</td><td>446 (-42)</td></tr>
    <tr><td>Have Issues</td><td>306 (-37)</td></tr>
    <tr><td>Redirects</td><td>31 (-2)</td></tr>
  </table>
  <div>${"Semrush delivery markup ".repeat(120)}</div>
</div>
`;

const hbgNormalizedHtmlText = `
Site Audit
Site Health 70%
Errors 222 (-25)
Warnings 5035 (-603)
Notices 2065 (-191)
Broken 3 (+1)
Blocked 104 (-4)
Crawled Pages 446 (-42)
Have Issues 306 (-37)
Redirects 31 (-2)
`;

const hbgSelected = selectEvidenceRichMessageText(
  hbgMislabeledPlainHtml,
  hbgNormalizedHtmlText
);
assert.match(hbgSelected, /<table>/i, "The regression must exercise the malformed text/plain HTML source winning selection");

const hbgEvidence = extractMonitoringEvidence({
  subject:"hbguns.com: Great Job! You've Got Better Results",
  date:"Sun, 23 Aug 2026 02:05:16 +0000",
  bodyText:hbgSelected
});

assert.ok(hbgEvidence, "Mislabeled Semrush HTML must remain preservable Monitoring evidence");
assert.equal(hbgEvidence.type, "monitoring_evidence");

const metric = key => hbgEvidence.metrics.find(item => item.key === key);
assert.equal(metric("site_health")?.value, 70);
assert.equal(metric("site_health")?.unit, "percent");
assert.equal(metric("errors")?.value, 222);
assert.equal(metric("errors")?.delta, -25);
assert.equal(metric("warnings")?.value, 5035);
assert.equal(metric("warnings")?.delta, -603);
assert.equal(metric("notices")?.value, 2065);
assert.equal(metric("notices")?.delta, -191);
assert.equal(metric("broken")?.value, 3);
assert.equal(metric("broken")?.delta, 1);
assert.equal(metric("blocked")?.value, 104);
assert.equal(metric("blocked")?.delta, -4);
assert.equal(metric("crawled_pages")?.value, 446);
assert.equal(metric("crawled_pages")?.delta, -42);
assert.equal(metric("have_issues")?.value, 306);
assert.equal(metric("have_issues")?.delta, -37);
assert.equal(metric("redirects")?.value, 31);
assert.equal(metric("redirects")?.delta, -2);

console.log("PASS Gmail Monitoring preserves A1 Position Tracking and HB Guns mislabeled-HTML Site Audit evidence");
