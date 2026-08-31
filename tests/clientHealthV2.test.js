/* =========================================================
   Global Concepts Media Operating System
   File: tests/clientHealthV2.test.js
   Version: 1.0.1
   Status: Production Regression Test
   Purpose: Lock Client Health v2 to evidence-based scoring where unknown
            dimensions reduce confidence rather than health.
   ========================================================= */

import assert from "node:assert/strict";
import {
  CLIENT_HEALTH_V2_VERSION,
  buildClientHealthV2
} from "../shared/clientHealthV2.js";

assert.equal(CLIENT_HEALTH_V2_VERSION, "2.0.1");

const health = buildClientHealthV2({
  now:"2026-08-31T12:00:00Z",
  client:{ id:1, client_code:"SES", name:"Southeast Safes" },
  intelligence:[
    {
      id:1,
      subject:"Search visibility improving",
      business_meaning:"Three local purchase-intent keywords entered the top 10.",
      trend:"improving",
      importance:"high",
      handling_state:"monitoring",
      last_observed_at:"2026-08-30T12:00:00Z",
      status:"active"
    },
    {
      id:2,
      subject:"GA4 and Google tag verified",
      business_meaning:"Analytics measurement is verified and sending data.",
      trend:"improving",
      importance:"normal",
      handling_state:"handled",
      last_observed_at:"2026-08-29T12:00:00Z",
      status:"active"
    }
  ],
  activityRecords:[
    {
      id:10,
      activity_date:"2026-08-30",
      category:"Monitoring Evidence",
      activity:"Site Audit monitoring",
      actual_impact:"Site health remained stable with no significant change.",
      source_type:"gmail_monitoring",
      priority:"low",
      status:"completed"
    }
  ],
  investigations:[],
  workItems:[
    {
      id:11,
      title:"Prepare approved 90-Day Orlando Growth Campaign for launch",
      description:"Campaign preparation is underway.",
      category:"Client Approval / Direct Work",
      priority:"high",
      status:"in_progress",
      created_at:"2026-08-21T12:00:00Z"
    }
  ],
  alerts:[]
});

assert.equal(health.version, "2.0.1");
assert.equal(health.client.clientCode, "SES");
assert.ok(Number.isInteger(health.score));
assert.ok(health.score >= 60);
assert.equal(health.trend, "Improving");
assert.ok(["Low","Medium","High"].includes(health.confidence));
assert.ok(health.evidenceCoverage.knownDimensions < health.evidenceCoverage.totalDimensions);
assert.ok(health.internal.unknownDimensions.length > 0);
assert.equal(health.clientSafeSummary.score, health.score);
assert.ok(health.clientSafeSummary.needsAttention.every(item => item.length <= 191));
assert.ok(health.clientSafeSummary.whatWeAreWatching.every(item => item.length <= 191));
assert.ok(health.clientSafeSummary.needsAttention.every(item => !/Message\\s+\\d+\\s+of\\s+\\d+/i.test(item)));
assert.match(health.clientSafeSummary.headline, /Client Health:/);
assert.ok(Array.isArray(health.whatIsWorking));
assert.equal(
  health.highestValueMove,
  "Prepare approved 90-Day Orlando Growth Campaign for launch"
);

const sparse = buildClientHealthV2({
  now:"2026-08-31T12:00:00Z",
  client:{ id:2, client_code:"TEST", name:"Sparse Client" },
  intelligence:[
    {
      id:1,
      subject:"Search rankings improved",
      business_meaning:"Keyword visibility improved.",
      trend:"improving",
      importance:"normal",
      last_observed_at:"2026-08-30T12:00:00Z"
    }
  ]
});

assert.ok(sparse.score >= 70, "Unknown dimensions must not drag the known score downward.");
assert.equal(sparse.confidence, "Low");
assert.ok(sparse.internal.unknownDimensions.length >= 8);

const empty = buildClientHealthV2({
  now:"2026-08-31T12:00:00Z",
  client:{ id:3, client_code:"EMPTY", name:"No Evidence Client" }
});

assert.equal(empty.score, null);
assert.equal(empty.status, "Insufficient Evidence");
assert.equal(empty.confidence, "Low");
assert.equal(empty.evidenceCoverage.knownDimensions, 0);

console.log("PASS Client Health v2 evidence-based score, confidence, trend, and client-safe summary contract");
