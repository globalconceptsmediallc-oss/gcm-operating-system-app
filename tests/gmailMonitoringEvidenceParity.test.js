/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailMonitoringEvidenceParity.test.js
   Version: 1.2.0
   Status: Production Regression Test
   Purpose: Lock authoritative Gmail Monitoring evidence parity across the live
            A1 Position Tracking thin-plain/rich-HTML case and the HB Guns
            Semrush Site Audit case where HTML is mislabeled as text/plain.

   Change notes — v1.2.0:
   - Reproduces the real HB Guns failure boundary with more than 12,000 characters
     of Semrush-style markup before the Site Audit metrics.
   - Requires mislabeled text/plain HTML to be normalized before the write-time
     source cap so Site Health and exact metric deltas remain available to Save.
   - Preserves the existing A1 Position Tracking and HBG metric regressions.

   Change notes — v1.1.0:
   - Reproduces the live HB Guns Semrush MIME defect where text/plain contains
     HTML markup and previously won write-time evidence-richness selection.
   - Requires Site Health and the exact Site Audit metrics/deltas to survive
     malformed MIME normalization and remain preservable Monitoring evidence.
   - Preserves the existing A1 #9 / +2 Position Tracking regression.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeDecodedGmailPart,
  selectEvidenceRichMessageText
} from "../routes/gmailDispositions.js";
import {
  extractPositionTrackingEvidence,
  extractMonitoringEvidence
} from "../shared/gmailMonitoringEvidence.js";

const dispositionsSource = fs.readFileSync(
  new URL("../routes/gmailDispositions.js", import.meta.url),
  "utf8"
);

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

const oversizedSemrushMarkup = "data-tracking=\"" + "x".repeat(16000) + "\"";
const hbgMislabeledPlainHtml = `
<div ${oversizedSemrushMarkup} style="font-size:14px;line-height:20px;color:#171a22">
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
</div>
`;

assert.ok(
  hbgMislabeledPlainHtml.indexOf("Site Health") > 12000,
  "The HBG regression must place the useful Site Audit metrics beyond the live Save cap in raw markup"
);

const hbgNormalizedPlain = normalizeDecodedGmailPart(
  "text/plain",
  hbgMislabeledPlainHtml
);
assert.doesNotMatch(hbgNormalizedPlain, /data-tracking/i);
assert.match(hbgNormalizedPlain, /Site Health/i);
assert.ok(
  hbgNormalizedPlain.indexOf("Site Health") < 12000,
  "Mislabeled HTML must be normalized before truncation so Site Audit evidence survives"
);

assert.match(
  dispositionsSource,
  /text\/plain"\) plain\.push\(normalizeDecodedGmailPart\(mime, decoded\)\)/,
  "Authoritative Save-time extraction must normalize text/plain before source selection"
);

const hbgWriteWindow = hbgNormalizedPlain.slice(0, 12000);
const hbgEvidence = extractMonitoringEvidence({
  subject:"hbguns.com: Great Job! You've Got Better Results",
  date:"Sun, 23 Aug 2026 02:05:16 +0000",
  bodyText:hbgWriteWindow
});

assert.ok(hbgEvidence, "Large mislabeled Semrush HTML must remain preservable Monitoring evidence after the live Save cap");
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

console.log("PASS Gmail Monitoring preserves A1 Position Tracking and large HB Guns pre-truncation Site Audit evidence");
