/* =========================================================
   GCM OS — Advertising & Source Evidence UI Regression
   File: tests/sourceEvidenceUi.test.js
   Version: 1.0.0
   No production writes; verifies Radar v3.9.0 syntax and security wiring.
   ========================================================= */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
const html=readFileSync("prospects.html","utf8");
assert.match(html,/File: prospects\.html[\s\S]*?Version: 3\.9\.0/);
assert.match(html,/id="radar-evidence-add"/);
assert.match(html,/id="radar-evidence-list"/);
assert.match(html,/id="source-evidence-dialog"/);
assert.match(html,/id="source-evidence-form"/);
assert.match(html,/gcm_os_session/);
assert.match(html,/sessionStorage\.setItem\(EVIDENCE_SESSION_KEY,token\)/);
assert.match(html,/history\.replaceState/);
assert.match(html,/"Authorization":"Bearer "\+token/);
assert.match(html,/action:"source-evidence"/);
assert.match(html,/toBlob\(resolve,"image\/webp"/);
assert.match(html,/evidenceBusy=true/);
assert.match(html,/if\(evidenceBusy\)return/);
assert.match(html,/renderRadarDetail\(r\)/);
assert.match(html,/loadSourceEvidenceGallery\(r\.id\)/);
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(Boolean);
const main=scripts.find(s=>s.includes('const FILE_VERSION="3.9.0"'));
assert.ok(main,"Prospects main JavaScript is present");
new Script(main,{filename:"prospects.html:inline"});
console.log("PASS Prospects 3.9.0 private evidence dialog/gallery, login session, compression, single-save guard and JavaScript syntax");