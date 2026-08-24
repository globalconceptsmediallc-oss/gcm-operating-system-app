/* =========================================================
   Global Concepts Media Operating System
   File: tests/prospectNextActionUi.test.js
   Version: 1.0.0
   Status: Regression Test
   Purpose: Lock the Prospect relationship workspace to the existing durable
            set_next_action CRM operation without creating unrelated records.

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

assert.match(
  shell,
  /if \(\/\\\/prospects\\\.html\$\/i\.test\(path\)\)/,
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

console.log(`PASS Prospect Next Action UI ${fileVersion}: explicit dated action without duplicate activity or stage write`);
