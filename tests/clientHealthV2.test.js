/* =========================================================
   Global Concepts Media Operating System
   File: tests/clientHealthV2.test.js
   Version: 1.1.0
   Status: Production Regression Test
   Purpose: Lock Client Health v2 to evidence-based scoring where unknown
            dimensions reduce confidence rather than health.
   ========================================================= */

import assert from "node:assert/strict";
import {
  CLIENT_HEALTH_V2_VERSION,
  buildClientHealthV2
} from "../shared/clientHealthV2.js";

assert.equal(CLIENT_HEALTH_V2_VERSION, "2.1.0");

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

assert.equal(health.version, "2.1.0");
assert.equal(health.client.clientCode, "SES");
assert.ok(Number.isInteger(health.score));
assert.ok(health.score >= 60);
assert.equal(health.trend, "Stable");
assert.ok(["Low","Medium","High"].includes(health.confidence));
assert.ok(health.evidenceCoverage.knownDimensions < health.evidenceCoverage.totalDimensions);
assert.ok(health.internal.unknownDimensions.length > 0);
assert.ok(
  health.internal.evidenceAssignments.every(item => item.dimensions.length <= 2),
  "One source record may affect at most two health dimensions."
);
assert.ok(
  health.dimensions.every(item => typeof item.reason === "string" && item.reason.length > 0),
  "Every health dimension must explain its score."
);
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

const priorityOnly = buildClientHealthV2({
  now:"2026-08-31T12:00:00Z",
  client:{ id:4, client_code:"PRIORITY", name:"Priority Only" },
  workItems:[
    {
      id:1,
      title:"High priority campaign preparation",
      description:"Prepare a growth campaign and tracking plan.",
      expected_impact:"Increase qualified leads and sales.",
      actual_impact:null,
      category:"Campaign",
      priority:"high",
      status:"in_progress",
      created_at:"2026-08-30T12:00:00Z"
    }
  ]
});

assert.equal(
  priorityOnly.dimensions.find(item => item.key === "business_performance")?.score ?? null,
  null,
  "Business Performance requires actual outcome evidence, not a high-priority plan or expected impact."
);

const measuredBusiness = buildClientHealthV2({
  now:"2026-08-31T12:00:00Z",
  client:{ id:5, client_code:"MEASURED", name:"Measured Business" },
  activityRecords:[
    {
      id:2,
      activity_date:"2026-08-30",
      category:"Performance",
      activity:"Monthly sales review",
      actual_impact:"Qualified leads increased and sales improved during the month.",
      priority:"normal",
      status:"completed"
    }
  ]
});

assert.ok(
  Number.isFinite(
    measuredBusiness.dimensions.find(item => item.key === "business_performance")?.score
  ),
  "Actual business outcome evidence should create a Business Performance score."
);

const freshCompetitive = buildClientHealthV2({
  now:"2026-08-31T12:00:00Z",
  client:{ id:6, client_code:"FRESH", name:"Fresh Competitive" },
  intelligence:[
    {
      id:1,
      subject:"Competitive visibility benchmark",
      business_meaning:"Visibility increased among tracked competitors.",
      trend:"improving",
      importance:"normal",
      last_observed_at:"2026-08-30T12:00:00Z"
    }
  ]
});

const staleCompetitive = buildClientHealthV2({
  now:"2026-08-31T12:00:00Z",
  client:{ id:7, client_code:"STALE", name:"Stale Competitive" },
  intelligence:[
    {
      id:1,
      subject:"Competitive visibility benchmark",
      business_meaning:"Visibility increased among tracked competitors.",
      trend:"improving",
      importance:"normal",
      last_observed_at:"2025-08-30T12:00:00Z"
    }
  ]
});

assert.ok(
  freshCompetitive.dimensions.find(item => item.key === "competitive_position").score >
    staleCompetitive.dimensions.find(item => item.key === "competitive_position").score,
  "Fresh evidence must have more scoring influence than stale evidence."
);

assert.ok(
  freshCompetitive.dimensions.find(item => item.key === "competitive_position").confidenceScore >
    staleCompetitive.dimensions.find(item => item.key === "competitive_position").confidenceScore,
  "Fresh evidence must carry more confidence than stale evidence."
);

const empty = buildClientHealthV2({
  now:"2026-08-31T12:00:00Z",
  client:{ id:3, client_code:"EMPTY", name:"No Evidence Client" }
});

assert.equal(empty.score, null);
assert.equal(empty.status, "Insufficient Evidence");
assert.equal(empty.confidence, "Low");
assert.equal(empty.evidenceCoverage.knownDimensions, 0);

console.log("PASS Client Health v2.1 explainable scoring, recency discounting, evidence isolation, and client-safe summary contract");
