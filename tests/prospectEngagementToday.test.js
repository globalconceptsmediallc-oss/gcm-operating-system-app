/* =========================================================
   Global Concepts Media Operating System
   File: tests/prospectEngagementToday.test.js
   Version: 1.2.1
   Status: Regression Test
   Purpose: Lock Today visibility for privacy-minimized tracked prospect opens.
   Change notes — 1.2.1:
   - Replaces the stale exact Today page lock with the 3.5.x release-family contract.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const route = fs.readFileSync(new URL("../routes/missionControl.js", import.meta.url),"utf8");
const today = fs.readFileSync(new URL("../today.html", import.meta.url),"utf8");

assert.match(route,/Version: 7\.8\.3/);
assert.match(route,/loadRecentProspectEngagements/);
assert.match(route,/activity_type = 'concept_page_view'/);
assert.match(route,/datetime\('now', '-7 days'\)/);
assert.match(route,/recentProspectEngagements/);
assert.match(route,/businessName/);
assert.match(route,/viewedAt/);
assert.match(route,/contactName/);
assert.match(route,/contactEmail/);

assert.match(today,/Version: 3\.5\.\d+/);
assert.match(today,/id="prospect-open-panel"/);
assert.match(today,/id="prospect-open-list"/);
assert.match(today,/id="prospect-open-title"/);
assert.match(today,/renderProspectEngagements/);
assert.match(today,/America\/New_York/);
assert.match(today,/Recipient on record:/);
assert.match(today,/Tracked link for/);
assert.match(today,/refreshProspectEngagements/);
assert.match(today,/setInterval\(refreshProspectEngagements, 60000\)/);
assert.match(today,/href="prospects\.html"/);

console.log("PASS Today surfaces recent tracked prospect concept opens with business and timestamp");
