/* =========================================================
   Global Concepts Media Operating System
   File: tests/mediaDeadlineAttention.test.js
   Version: 1.0.0
   Status: Production Regression Test
   Purpose: Verify Media surfaces agency-owned preparation before a station
            representative has to chase GCM for expiring or upcoming traffic.
   ========================================================= */
import assert from "node:assert/strict";
import { mediaDeadlineState } from "../routes/mediaOperationsLegacy.js";

const currentFlight={status:"active",endDate:"2026-09-30",trafficStatus:"sent",confirmationStatus:"confirmed",notes:"Agency traffic preparation: 17 calendar days before first air"};
const before=mediaDeadlineState(currentFlight,new Date(2026,8,12,12));
assert.equal(before.agencyPreparationDate,"2026-09-13");
assert.equal(before.stationDeadline,"2026-09-25");
assert.equal(before.needsAttention,false);

const due=mediaDeadlineState(currentFlight,new Date(2026,8,23,12));
assert.equal(due.needsAttention,true);
assert.match(due.reason,/EXTEND CURRENT CREATIVE OR PREPARE REPLACEMENT/);

const decided=mediaDeadlineState({...currentFlight,notes:currentFlight.notes+"\nPlacement Disposition: replacement_in_progress\nDisposition End Date: 2026-09-30"},new Date(2026,8,23,12));
assert.equal(decided.needsAttention,false);

const upcoming=mediaDeadlineState({status:"planned",startDate:"2026-10-01",trafficStatus:"not_sent",confirmationStatus:"not_requested",notes:"Agency traffic preparation: 17 calendar days before first air"},new Date(2026,8,23,12));
assert.equal(upcoming.agencyPreparationDate,"2026-09-14");
assert.equal(upcoming.stationDeadline,"2026-09-28");
assert.equal(upcoming.needsAttention,true);
assert.match(upcoming.reason,/MEDIA PREPARATION WINDOW OPEN/);

console.log("PASS Media proactive 17-day deadline attention contract");
