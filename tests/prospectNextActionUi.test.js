/* =========================================================
   Global Concepts Media Operating System
   File: tests/prospectNextActionUi.test.js
   Version: 1.0.3
   Status: Regression Test
   Purpose: Lock the Prospect relationship workspace to the existing durable
            set_next_action CRM operation without creating unrelated records.

   Change Notes — 1.0.3
   - Verifies Prospects 3.8.0 summary navigation and unified attention queue.
   - Requires count/list parity and existing record-detail Open routes.

   Change Notes — 1.0.1
   - Uses an exact source-string assertion for the Prospects-only loader scope.
   - Preserves the v1.0.0 write-boundary and cache-version assertions.

   Change Notes — 1.0.0
   - Verifies the Prospects-only enhancement is cache-versioned by gcm-shell.js.
   - Verifies Set Next Action calls the existing set_next_action operation.
   - Verifies the enhancement does not call add_activity or update_prospect.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";

const shell = fs.readFileSync(
  new URL("../shared/gcm-shell.js", import.meta.url),
  "utf8"
);
const enhancement = fs.readFileSync(
  new URL("../shared/prospect-next-action.js", import.meta.url),
  "utf8"
);

const fileVersion = enhancement.match(/const FILE_VERSION = "([^"]+)";/)?.[1];
assert.ok(fileVersion, "prospect-next-action.js must declare FILE_VERSION");

assert.match(
  shell,
  new RegExp(`shared/prospect-next-action\\.js\\?v=${fileVersion.replaceAll(".", "\\.")}`),
  `gcm-shell.js must request prospect-next-action.js with cache key v=${fileVersion}`
);

assert.ok(
  shell.includes('if (/\\/prospects\\.html$/i.test(path)) {'),
  "Prospect Next Action enhancement must load only on prospects.html"
);

assert.match(
  enhancement,
  /textContent = "Set Next Action"/,
  "The formal Prospect workspace must expose Set Next Action"
);

assert.match(
  enhancement,
  /crm\("set_next_action"/,
  "The UI must use the existing durable set_next_action CRM operation"
);

assert.match(
  enhancement,
  /actionType: "follow_up"/,
  "Explicit Next Action edits must remain CRM follow-up actions"
);

assert.doesNotMatch(
  enhancement,
  /crm\("add_activity"/,
  "Setting a Next Action must not create a duplicate relationship activity"
);

assert.doesNotMatch(
  enhancement,
  /crm\("update_prospect"/,
  "Setting a Next Action must not change Prospect stage or general Prospect state"
);

const prospectsPage = fs.readFileSync(
  new URL("../prospects.html", import.meta.url),
  "utf8"
);
assert.match(prospectsPage,/Version: 3\\.8\\.0/);
assert.match(prospectsPage,/Nurture \/ Hold/);
assert.match(prospectsPage,/holdReason/);
assert.match(prospectsPage,/reactivationTrigger/);
assert.match(prospectsPage,/reviewDate/);
assert.match(prospectsPage,/place_prospect_on_hold/);
assert.match(prospectsPage,/place_radar_on_hold/);
assert.match(prospectsPage,/reactivate_prospect/);
assert.match(prospectsPage,/reactivate_radar/);


// Four summary cards must navigate to lists rather than remain inert articles.
for (const kind of ["active", "due", "unmanaged", "radar"]) {
  assert.match(prospectsPage, new RegExp('data-summary="' + kind + '"'),
    'Clickable summary button missing: ' + kind);
}
assert.match(prospectsPage, /id="view-attention"/);
assert.match(prospectsPage, /data-view="attention"/);
assert.match(prospectsPage, /function attentionItems\(mode\)/);
assert.match(prospectsPage, /"due-count"\)\.textContent=attentionItems\("due"\)\.length/);
assert.match(prospectsPage, /"unmanaged-count"\)\.textContent=attentionItems\("unmanaged"\)\.length/);
assert.match(prospectsPage, /"attention-count"\)\.textContent=items\.length/);
assert.match(prospectsPage, /data-action-kind=/);
assert.match(prospectsPage, /data-action-id=/);
assert.match(prospectsPage, /if\(b\.dataset\.actionKind==="prospect"\)openProspect\(id\)/);
assert.match(prospectsPage, /else openRadar\(id\)/);
assert.match(prospectsPage, /setRadarListCollapsed\(false,\{persist:false\}\)/);

console.log(`PASS Prospect Next Action UI ${fileVersion}: dated actions, summary navigation and Nurture / Hold controls`);
