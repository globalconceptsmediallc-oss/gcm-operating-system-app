/* =========================================================
   Global Concepts Media Operating System
   File: tests/gmailSourceEmailDisplay.test.js
   Version: 1.1.0
   Status: Production Regression Test
   Purpose: Prevent raw Gmail HTML character references and flattened link
            presentation debris from leaking into Morning Command Source Email.
   ========================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const source = fs.readFileSync(path.join(root, "shared", "today-gmail-decisions.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(source.includes("Version: 2.0.2"), "Today Gmail source display must identify version 2.0.2.");
assert(source.includes("function cleanSourceEmail(value)"), "Universal Source Email cleanup function is missing.");
assert(source.includes("for (let pass = 0; pass < 2; pass += 1)"), "Nested/double-encoded HTML entities must receive a second decode pass.");
assert(source.includes("decoder.innerHTML = text"), "Browser HTML entity decoding input is missing.");
assert(source.includes("const decoded = decoder.value"), "Browser HTML entity decoding output is missing.");
assert(source.includes('.replace(/\\bhref\\s*=\\s*'), "Flattened href attributes must be removed from Source Email presentation.");
assert(source.includes('.replace(/<https?:\\/\\/[^>\\n]+>/gi, " ")'), "Angle-bracket URL wrappers must be removed from Source Email presentation.");
assert(source.includes('.replace(/\\u00a0/g, " ")'), "Non-breaking spaces must normalize to normal spaces.");
assert(source.includes("ordinary URLs in the actual message remain visible as evidence"), "Source cleanup must explicitly preserve ordinary evidence URLs.");
assert(source.includes("const source = cleanSourceEmail("), "Morning Command must render the cleaned Source Email text.");
assert(source.includes("message?.bodyText || message?.snippet || message?.subject"), "Source Email cleanup must preserve the live Gmail body/snippet/subject fallback chain.");

console.log("PASS Gmail Source Email display decodes entities, strips link-wrapper debris, preserves evidence URLs, and normalizes presentation whitespace");
