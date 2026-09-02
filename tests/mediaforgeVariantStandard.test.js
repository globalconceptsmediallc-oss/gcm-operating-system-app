/* =========================================================
MediaForge
File: tests/mediaforgeVariantStandard.test.js
Version: 1.0.0
Status: Production Regression Test
Purpose: Lock Kristy's Liberty variant-order standard, interior-number
         inheritance, hardware/velour logic, and Canto-style Lincoln
         filename conversion without guessed positions.
========================================================= */

import assert from "node:assert/strict";
import {
  LIBERTY_VARIANT_STANDARD,
  getLincolnExteriorVariants,
  getInteriorVariantGroups,
  findExteriorVariant,
  findInteriorRepresentative,
  parseLincolnInteriorSourceName,
  buildLincolnInteriorOutput,
  buildExteriorManifestCsv,
  buildInteriorRuleManifestCsv
} from "../mediaforge/variant-standard.js";

assert.equal(LIBERTY_VARIANT_STANDARD.version, "1.0.0");

const exterior = getLincolnExteriorVariants();
assert.equal(exterior.length, 22);
assert.deepEqual(
  exterior.map(item => `${item.position}:${item.colorFinish}:${item.hardware}`),
  [
    "1:White Marble:Black Chrome",
    "2:White Gloss:Black Chrome",
    "3:White Gloss:Brass",
    "4:Champagne Marble:Black Chrome",
    "5:Champagne Gloss:Black Chrome",
    "6:Gray Marble:Black Chrome",
    "7:Gray Gloss:Black Chrome",
    "8:Bronze Gloss:Black Chrome",
    "9:Forest Mist Gloss:Black Chrome",
    "10:Green Marble:Black Chrome",
    "11:Green Marble:Brass",
    "12:Green Gloss:Black Chrome",
    "13:Green Gloss:Brass",
    "14:Blue Gloss:Chrome",
    "15:Burgundy Marble:Black Chrome",
    "16:Burgundy Marble:Brass",
    "17:Burgundy Gloss:Black Chrome",
    "18:Burgundy Gloss:Brass",
    "19:Black Cherry Gloss:Black Chrome",
    "20:Black Gloss:Black Chrome",
    "21:Black Gloss:Brass",
    "22:Black Gloss:Chrome"
  ]
);

const interiorGroups = getInteriorVariantGroups();
assert.equal(interiorGroups.length, 15);

const whiteGloss = findInteriorRepresentative("White Gloss");
assert.equal(whiteGloss.representativePosition, 2);
assert.deepEqual(whiteGloss.exteriorPositions, [2, 3]);

const whiteGlossBrass = findExteriorVariant("White Gloss", "Brass");
assert.equal(whiteGlossBrass.position, 3);

const blackGloss = findInteriorRepresentative("Black Gloss");
assert.equal(blackGloss.representativePosition, 20);
assert.deepEqual(blackGloss.exteriorPositions, [20, 21, 22]);

const beigeBlack = parseLincolnInteriorSourceName(
  "LX25-Black Gloss(BV)-Open-Empty-Pro Flex-2026.webp"
);
assert.equal(beigeBlack.ready, true);
assert.equal(beigeBlack.velour, "Beige Velour");
assert.equal(beigeBlack.sourceExteriorPosition, 21);
assert.equal(beigeBlack.representativePosition, 20);

const beigeBlackOutput = buildLincolnInteriorOutput(
  "LX25-Black Gloss(BV)-Open-Empty-Pro Flex-2026.webp"
);
assert.equal(
  beigeBlackOutput.outputName,
  "liberty-lincoln-25-20-black-gloss-bv-pro-flex-interior-empty.webp"
);

const standardBlackOutput = buildLincolnInteriorOutput(
  "LX25-Black Gloss-Open-ProFlex-Full No Guns-2026.webp"
);
assert.equal(standardBlackOutput.ready, true);
assert.equal(standardBlackOutput.sourceExteriorPosition, 20);
assert.equal(standardBlackOutput.representativePosition, 20);
assert.equal(
  standardBlackOutput.outputName,
  "liberty-lincoln-25-20-black-gloss-pro-flex-interior-full-no-guns.webp"
);

const whiteBeigeOutput = buildLincolnInteriorOutput(
  "LX25-White Gloss(BV)-Open-ProFlex-Loaded-2026.webp"
);
assert.equal(whiteBeigeOutput.ready, true);
assert.equal(whiteBeigeOutput.sourceExteriorPosition, 3);
assert.equal(whiteBeigeOutput.representativePosition, 2);
assert.match(whiteBeigeOutput.outputName, /lincoln-25-2-white-gloss-bv-/);
assert.doesNotMatch(whiteBeigeOutput.outputName, /lincoln-25-3-white-gloss/);

const blueOutput = buildLincolnInteriorOutput(
  "LX25-Blue Gloss-Open-Empty-Pro Flex-2026.webp"
);
assert.equal(blueOutput.ready, true);
assert.equal(blueOutput.sourceExteriorPosition, 14);
assert.equal(blueOutput.representativePosition, 14);
assert.equal(blueOutput.velour, "Silver Velour");

const invalidBeige = buildLincolnInteriorOutput(
  "LX25-Champagne Gloss(BV)-Open-Empty-Pro Flex-2026.webp"
);
assert.equal(invalidBeige.ready, false);
assert.match(invalidBeige.reason, /no approved Brass exterior position/i);

const unknown = buildLincolnInteriorOutput(
  "LX25-Purple Gloss-Open-Empty-Pro Flex-2026.webp"
);
assert.equal(unknown.ready, false);
assert.match(unknown.reason, /not in the approved Lincoln variant standard/i);

const exteriorCsv = buildExteriorManifestCsv();
assert.match(exteriorCsv, /22,Black,Gloss,Black Gloss,Chrome,Silver Velour/);

const interiorCsv = buildInteriorRuleManifestCsv();
assert.match(interiorCsv, /2,White Gloss,2 \| 3,Black Chrome \| Brass,Silver Velour \| Beige Velour/);
assert.match(interiorCsv, /20,Black Gloss,20 \| 21 \| 22/);

console.log(
  "PASS MediaForge Liberty 22-position variant standard, interior representative numbering, velour rules, and Canto filename conversion"
);
