/* =========================================================
MediaForge
File: variant-standard.js
Version: 1.0.0
Status: Production Road-Test Candidate
Purpose: Preserve Liberty merchandising order as a reusable product
         standard, separate exterior variant positions from interior
         image numbering, and convert Canto-style Lincoln interior
         filenames into safe production names without guessing.
========================================================= */

export const VARIANT_STANDARD_ENGINE_VERSION = "1.0.0";

const LINCOLN_VARIANTS = [
  [1,  "White",        "Marble", "Black Chrome"],
  [2,  "White",        "Gloss",  "Black Chrome"],
  [3,  "White",        "Gloss",  "Brass"],
  [4,  "Champagne",    "Marble", "Black Chrome"],
  [5,  "Champagne",    "Gloss",  "Black Chrome"],
  [6,  "Gray",         "Marble", "Black Chrome"],
  [7,  "Gray",         "Gloss",  "Black Chrome"],
  [8,  "Bronze",       "Gloss",  "Black Chrome"],
  [9,  "Forest Mist",  "Gloss",  "Black Chrome"],
  [10, "Green",        "Marble", "Black Chrome"],
  [11, "Green",        "Marble", "Brass"],
  [12, "Green",        "Gloss",  "Black Chrome"],
  [13, "Green",        "Gloss",  "Brass"],
  [14, "Blue",         "Gloss",  "Chrome"],
  [15, "Burgundy",     "Marble", "Black Chrome"],
  [16, "Burgundy",     "Marble", "Brass"],
  [17, "Burgundy",     "Gloss",  "Black Chrome"],
  [18, "Burgundy",     "Gloss",  "Brass"],
  [19, "Black Cherry", "Gloss",  "Black Chrome"],
  [20, "Black",        "Gloss",  "Black Chrome"],
  [21, "Black",        "Gloss",  "Brass"],
  [22, "Black",        "Gloss",  "Chrome"]
].map(([position, colorFamily, finish, hardware]) => ({
  position,
  colorFamily,
  finish,
  colorFinish: `${colorFamily} ${finish}`,
  hardware
}));

export const LIBERTY_VARIANT_STANDARD = Object.freeze({
  id: "liberty-merchandising-v1",
  version: "1.0.0",
  effectiveDate: "2026-09-02",
  owner: "GCM / Kristy",
  scope: "Liberty product rebuilds",
  productFamily: "Lincoln",
  colorFamilyOrder: [
    "White",
    "Champagne",
    "Gray",
    "Bronze",
    "Forest Mist",
    "Green",
    "Blue",
    "Burgundy",
    "Black Cherry",
    "Black"
  ],
  finishOrder: ["Textured", "Marble", "Gloss"],
  hardwareOrder: ["Black Chrome", "Brass", "Chrome"],
  interiorRule: {
    numbering: "Use the first approved exterior position for the same color and finish.",
    silverVelourHardware: ["Black Chrome", "Chrome"],
    beigeVelourHardware: ["Brass"],
    outputCode: {
      "Silver Velour": "",
      "Beige Velour": "bv"
    }
  },
  notes: [
    "Keep true color families together where practical.",
    "Lincoln currently has no approved Textured finishes in this standard.",
    "Interior images do not inherit every hardware-specific exterior number.",
    "Beige Velour remains distinguishable with the bv filename token while still inheriting the first color/finish position."
  ]
});

const COLOR_FINISH_ALIASES = new Map([
  ["white ivory gloss", "White Gloss"],
  ["white gloss", "White Gloss"],
  ["white marble", "White Marble"],
  ["champagne marble", "Champagne Marble"],
  ["champagne gloss", "Champagne Gloss"],
  ["gray marble", "Gray Marble"],
  ["grey marble", "Gray Marble"],
  ["gray gloss", "Gray Gloss"],
  ["grey gloss", "Gray Gloss"],
  ["bronze gloss", "Bronze Gloss"],
  ["forest mist gloss", "Forest Mist Gloss"],
  ["green marble", "Green Marble"],
  ["green gloss", "Green Gloss"],
  ["blue gloss", "Blue Gloss"],
  ["burgundy marble", "Burgundy Marble"],
  ["burgundy gloss", "Burgundy Gloss"],
  ["black cherry gloss", "Black Cherry Gloss"],
  ["black cherry (gloss)", "Black Cherry Gloss"],
  ["black mirror gloss", "Black Gloss"],
  ["black mirror (gloss)", "Black Gloss"],
  ["black gloss", "Black Gloss"]
]);

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function lookup(value) {
  return clean(value).toLowerCase();
}

function splitKnownImageExtension(fileName) {
  const name = String(fileName || "");
  const match = name.match(/^(.*)\.(jpe?g|png|webp)$/i);
  return match
    ? { base: match[1], extension: match[2].toLowerCase() }
    : { base: name, extension: "" };
}

function slug(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getLincolnExteriorVariants() {
  return LINCOLN_VARIANTS.map(item => ({ ...item }));
}

export function normalizeColorFinish(value) {
  let raw = clean(value)
    .replace(/\((?:BV|SV)\)/gi, "")
    .replace(/\((?:SV\s+and\s+BV|BV\s+and\s+SV)\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const direct = COLOR_FINISH_ALIASES.get(lookup(raw));
  if (direct) return direct;

  raw = raw
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return COLOR_FINISH_ALIASES.get(lookup(raw)) || raw;
}

export function velourForHardware(hardware) {
  const normalized = lookup(hardware);
  if (normalized === "brass") return "Beige Velour";
  if (normalized === "black chrome" || normalized === "chrome") return "Silver Velour";
  return "";
}

export function findExteriorVariant(colorFinish, hardware) {
  const normalizedColorFinish = lookup(normalizeColorFinish(colorFinish));
  const normalizedHardware = lookup(hardware);
  return getLincolnExteriorVariants().find(item =>
    lookup(item.colorFinish) === normalizedColorFinish &&
    lookup(item.hardware) === normalizedHardware
  ) || null;
}

export function getInteriorVariantGroups() {
  const groups = new Map();

  for (const variant of LINCOLN_VARIANTS) {
    const key = lookup(variant.colorFinish);
    if (!groups.has(key)) {
      groups.set(key, {
        colorFamily: variant.colorFamily,
        finish: variant.finish,
        colorFinish: variant.colorFinish,
        representativePosition: variant.position,
        representativeHardware: variant.hardware,
        exteriorPositions: [],
        hardware: [],
        velour: []
      });
    }

    const group = groups.get(key);
    group.exteriorPositions.push(variant.position);
    if (!group.hardware.includes(variant.hardware)) group.hardware.push(variant.hardware);
    const velour = velourForHardware(variant.hardware);
    if (velour && !group.velour.includes(velour)) group.velour.push(velour);
  }

  return [...groups.values()].map(group => ({
    ...group,
    exteriorPositions: [...group.exteriorPositions],
    hardware: [...group.hardware],
    velour: [...group.velour]
  }));
}

export function findInteriorRepresentative(colorFinish) {
  const normalized = lookup(normalizeColorFinish(colorFinish));
  return getInteriorVariantGroups().find(group =>
    lookup(group.colorFinish) === normalized
  ) || null;
}

export function parseLincolnInteriorSourceName(fileName) {
  const { base: withCopy, extension } = splitKnownImageExtension(fileName);
  const base = withCopy
    .replace(/\.\d*\.?copy$/i, "")
    .replace(/\.copy$/i, "")
    .replace(/-2026$/i, "")
    .trim();

  const match = base.match(/^LX(25|40|50)-(.+?)-Open-(.+)$/i);
  if (!match) {
    return {
      ready: false,
      originalName: String(fileName || ""),
      extension,
      reason: "Not a recognized Lincoln 25/40/50 Canto interior filename."
    };
  }

  const size = match[1];
  const rawColor = clean(match[2]);
  const tail = clean(match[3]);
  const explicitBeige = /\(BV\)/i.test(rawColor) || /beige\s+velour/i.test(base);
  const explicitSilver = /\(SV\)/i.test(rawColor) || /silver\s+velour/i.test(base);
  const colorFinish = normalizeColorFinish(rawColor);

  let interiorType = "";
  if (/pro\s*flex/i.test(tail)) interiorType = "Pro Flex";
  else if (/standard/i.test(tail)) interiorType = "Standard";
  else if (/signature/i.test(tail)) interiorType = "Signature";

  let interiorState = "";
  if (/full\s*no\s*guns/i.test(tail)) interiorState = "Full No Guns";
  else if (/loaded/i.test(tail)) interiorState = "Loaded";
  else if (/empty/i.test(tail)) interiorState = "Empty";

  const representative = findInteriorRepresentative(colorFinish);
  if (!representative) {
    return {
      ready: false,
      originalName: String(fileName || ""),
      extension,
      size,
      colorFinish,
      interiorType,
      interiorState,
      reason: `${colorFinish || "This color/finish"} is not in the approved Lincoln variant standard.`
    };
  }

  let velour = "";
  if (explicitBeige) velour = "Beige Velour";
  else if (explicitSilver) velour = "Silver Velour";
  else velour = velourForHardware(representative.representativeHardware);

  if (!interiorType) {
    return {
      ready: false,
      originalName: String(fileName || ""),
      extension,
      size,
      colorFinish,
      interiorState,
      velour,
      representativePosition: representative.representativePosition,
      reason: "Interior type could not be identified as Pro Flex, Standard, or Signature."
    };
  }

  if (!interiorState) {
    return {
      ready: false,
      originalName: String(fileName || ""),
      extension,
      size,
      colorFinish,
      interiorType,
      velour,
      representativePosition: representative.representativePosition,
      reason: "Interior state could not be identified as Empty, Loaded, or Full No Guns."
    };
  }

  const matchingHardware = velour === "Beige Velour"
    ? "Brass"
    : representative.hardware.find(hardware => velourForHardware(hardware) === "Silver Velour") || representative.representativeHardware;
  const sourceExterior = findExteriorVariant(colorFinish, matchingHardware);

  if (velour === "Beige Velour" && !sourceExterior) {
    return {
      ready: false,
      originalName: String(fileName || ""),
      extension,
      size,
      colorFinish,
      interiorType,
      interiorState,
      velour,
      representativePosition: representative.representativePosition,
      reason: "Beige Velour implies a Brass variant, but this color/finish has no approved Brass exterior position."
    };
  }

  return {
    ready: true,
    originalName: String(fileName || ""),
    extension,
    size,
    colorFinish,
    colorFamily: representative.colorFamily,
    finish: representative.finish,
    interiorType,
    interiorState,
    velour,
    velourCode: LIBERTY_VARIANT_STANDARD.interiorRule.outputCode[velour] || "",
    representativePosition: representative.representativePosition,
    representativeHardware: representative.representativeHardware,
    sourceExteriorPosition: sourceExterior?.position || representative.representativePosition,
    sourceHardware: sourceExterior?.hardware || representative.representativeHardware
  };
}

export function buildLincolnInteriorOutput(fileName) {
  const parsed = parseLincolnInteriorSourceName(fileName);
  if (!parsed.ready) {
    return {
      ...parsed,
      outputName: "",
      changed: false
    };
  }

  const segments = [
    "liberty",
    "lincoln",
    parsed.size,
    String(parsed.representativePosition),
    slug(parsed.colorFinish),
    parsed.velourCode,
    slug(parsed.interiorType),
    "interior",
    slug(parsed.interiorState)
  ].filter(Boolean);

  const stem = segments.join("-");
  const outputName = parsed.extension ? `${stem}.${parsed.extension}` : stem;

  return {
    ...parsed,
    outputName,
    changed: outputName !== parsed.originalName
  };
}

export function buildExteriorManifestCsv() {
  const header = [
    "position",
    "color_family",
    "finish",
    "color_finish",
    "hardware",
    "expected_velour"
  ];

  const rows = LINCOLN_VARIANTS.map(item => [
    item.position,
    item.colorFamily,
    item.finish,
    item.colorFinish,
    item.hardware,
    velourForHardware(item.hardware)
  ]);

  return [header, ...rows].map(row =>
    row.map(csvCell).join(",")
  ).join("\n");
}

export function buildInteriorRuleManifestCsv() {
  const header = [
    "representative_position",
    "color_finish",
    "exterior_positions",
    "hardware_variants",
    "velour_options",
    "numbering_rule"
  ];

  const rows = getInteriorVariantGroups().map(group => [
    group.representativePosition,
    group.colorFinish,
    group.exteriorPositions.join(" | "),
    group.hardware.join(" | "),
    group.velour.join(" | "),
    "First exterior position for same color/finish"
  ]);

  return [header, ...rows].map(row =>
    row.map(csvCell).join(",")
  ).join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}
