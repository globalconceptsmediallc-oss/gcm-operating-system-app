/* =========================================================
   Global Concepts Media Operating System
   File: tests/mediaforgeNamingRecipe.test.js
   Version: 1.2.0
   Status: Production Regression Test
   Purpose: Lock MediaForge flexible naming recipes, aliases,
            sequence maps, job overrides, unresolved-map blocking,
            and rename-only ZIP export.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BUILTIN_PRESETS,
  inferFileRecord,
  parseAliases,
  parseSequence,
  applyAlias,
  buildProposedName,
  createStoredZip
} from "../mediaforge/naming.js";

const parsed = inferFileRecord(
  "LX-Sig-25-Black Cherry Gloss-Open-Full No Guns-ProFlex.copy-interior.webp"
);
assert.equal(parsed.manufacturer, "Liberty");
assert.equal(parsed.model, "Lincoln");
assert.equal(parsed.size, "25");
assert.equal(parsed.exteriorColor, "Black Cherry Gloss");
assert.equal(parsed.interiorState, "Full No Guns");

const aliases = parseAliases([
  "exteriorColor | Textured Bronze = Bronze Gloss",
  "hardware | Black Chrome = bc"
].join("\n"));
assert.equal(applyAlias("exteriorColor", "Textured Bronze", aliases), "Bronze Gloss");
assert.equal(applyAlias("hardware", "Black Chrome", aliases), "bc");

const sequence = parseSequence("Bronze Gloss = 9\nBlack Cherry Gloss = 13");
assert.equal(sequence.get("bronze gloss"), "9");
assert.equal(sequence.get("black cherry gloss"), "13");

const preset = structuredClone(
  BUILTIN_PRESETS.find(item => item.id === "liberty-lincoln-25-signature-interiors")
);
preset.aliasesText = "exteriorColor | Textured Bronze = Bronze Gloss";
preset.sequenceText = "Bronze Gloss = 9";

const bronze = inferFileRecord(
  "LX-Sig-25-Textured Bronze-Open-Loaded-ProFlex.copy-interior.webp"
);
const proposal = buildProposedName(preset, bronze);
assert.equal(proposal.ready, true);
assert.equal(
  proposal.filename,
  "liberty-lincoln-25-9-bronze-gloss-signature-interior-loaded.webp"
);

const reusable = structuredClone(
  BUILTIN_PRESETS.find(item => item.id === "liberty-lincoln-signature-interiors")
);

const lx40White = buildProposedName(
  reusable,
  inferFileRecord("LX-Sig-40-White Ivory Gloss-Open-Loaded-ProFlex-interior.webp")
);
assert.equal(lx40White.ready, true);
assert.equal(
  lx40White.filename,
  "liberty-lincoln-40-6-white-gloss-signature-interior-loaded.webp"
);

const lx40Black = buildProposedName(
  reusable,
  inferFileRecord("LX-Sig-40-Black Gloss(SV and BV)-Open-Empty-ProFlex-interior.webp")
);
assert.equal(lx40Black.ready, true);
assert.equal(
  lx40Black.filename,
  "liberty-lincoln-40-14-black-gloss-signature-interior-empty.webp"
);

const lx50Textured = buildProposedName(
  reusable,
  inferFileRecord("LX-Sig-50-Textured Bronze-Open-Full No Guns-ProFlex-interior.webp")
);
assert.equal(lx50Textured.ready, false);
assert.ok(lx50Textured.missing.includes("Color Order"));

const lx50DoubleHyphen = buildProposedName(
  reusable,
  inferFileRecord("LX-Sig-50-Champagne Marble--Open-Empty-ProFlex-interior.webp")
);
assert.equal(lx50DoubleHyphen.ready, true);
assert.equal(
  lx50DoubleHyphen.filename,
  "liberty-lincoln-50-2-champagne-marble-signature-interior-empty.webp"
);

const lx50Burgundy = buildProposedName(
  reusable,
  inferFileRecord("LX-Sig-50-Burgundy Gloss-Open-Loaded-ProFlex-interior.webp")
);
assert.equal(lx50Burgundy.ready, true);
assert.equal(
  lx50Burgundy.filename,
  "liberty-lincoln-50-12-burgundy-gloss-signature-interior-loaded.webp"
);

const flexible = structuredClone(preset);
flexible.caseMode = "upper";
flexible.separator = "_";
flexible.aliasesText += "\nhardware | Black Chrome = bc";
flexible.fields.find(field => field.key === "hardware").enabled = true;
const flexibleProposal = buildProposedName(
  flexible,
  { ...bronze, hardware: "Black Chrome" }
);
assert.equal(flexibleProposal.ready, true);
assert.equal(
  flexibleProposal.filename,
  "LIBERTY_LINCOLN_25_9_BRONZE_GLOSS_BC_SIGNATURE_INTERIOR_LOADED.webp"
);

const unresolved = structuredClone(preset);
unresolved.sequenceText = "";
const unresolvedProposal = buildProposedName(unresolved, bronze);
assert.equal(unresolvedProposal.ready, false);
assert.ok(unresolvedProposal.missing.includes("Color Order"));

const fakeFile = bytes => ({
  arrayBuffer: async () => Uint8Array.from(bytes).buffer
});
const zip = await createStoredZip([
  { name: "first.webp", file: fakeFile([1, 2, 3]), lastModified: Date.UTC(2026, 7, 27) },
  { name: "second.webp", file: fakeFile([4, 5, 6]), lastModified: Date.UTC(2026, 7, 27) }
]);
const zipBytes = new Uint8Array(await zip.arrayBuffer());
assert.equal(zipBytes[0], 0x50);
assert.equal(zipBytes[1], 0x4b);
const zipText = new TextDecoder().decode(zipBytes);
assert.ok(zipText.includes("first.webp"));
assert.ok(zipText.includes("second.webp"));

const html = fs.readFileSync(new URL("../mediaforge/index.html", import.meta.url), "utf8");
for (const marker of [
  "Version 3.0.0",
  'id="namingPreset"',
  'id="namingAliases"',
  'id="namingSequence"',
  'id="namingZip"',
  'src="./naming-ui.js?v=1.1.0"'
]) {
  assert.ok(html.includes(marker), `Missing MediaForge UI contract: ${marker}`);
}

console.log(
  "PASS MediaForge flexible naming recipes, aliases, sequence maps, overrides, unresolved-map blocking, and rename-only ZIP export"
);
