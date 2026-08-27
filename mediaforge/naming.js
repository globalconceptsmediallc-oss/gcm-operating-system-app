/* =========================================================
MediaForge
File: naming.js
Version: 1.0.0
Status: Production Candidate
Purpose: Generic, human-controlled batch naming engine for MediaForge.
         Recipes define included fields, field order, fixed/parsed/sequence
         values, aliases, case, separator, and extension policy.
========================================================= */

export const NAMING_ENGINE_VERSION = "1.0.0";

export const BUILTIN_PRESETS = [
  {
    id: "custom",
    name: "Custom Job",
    builtIn: true,
    jobName: "Custom Naming Job",
    instructions: "",
    caseMode: "lower",
    separator: "-",
    extensionMode: "preserve",
    sequenceSource: "exteriorColor",
    aliasesText: "",
    sequenceText: "",
    fields: [
      { key: "manufacturer", label: "Manufacturer", enabled: true, source: "fixed", value: "" },
      { key: "model", label: "Model", enabled: true, source: "fixed", value: "" },
      { key: "size", label: "Size", enabled: true, source: "fixed", value: "" }
    ]
  },
  {
    id: "liberty-lincoln-25-signature-interiors",
    name: "Liberty — Lincoln 25 — Signature Interiors",
    builtIn: true,
    jobName: "Lincoln 25 Signature Interiors",
    instructions: "Use the request-specific sequence map and aliases. Hardware is available as an optional field but is disabled by default for interior-only files.",
    caseMode: "lower",
    separator: "-",
    extensionMode: "preserve",
    sequenceSource: "exteriorColor",
    aliasesText: "",
    sequenceText: "",
    fields: [
      { key: "manufacturer", label: "Manufacturer", enabled: true, source: "fixed", value: "Liberty" },
      { key: "model", label: "Model", enabled: true, source: "fixed", value: "Lincoln" },
      { key: "size", label: "Size", enabled: true, source: "fixed", value: "25" },
      { key: "colorOrder", label: "Color Order", enabled: true, source: "sequence", value: "" },
      { key: "exteriorColor", label: "Exterior Color", enabled: true, source: "parsed", value: "" },
      { key: "hardware", label: "Hardware", enabled: false, source: "parsed", value: "" },
      { key: "interiorFamily", label: "Interior Family", enabled: true, source: "fixed", value: "Signature Interior" },
      { key: "interiorState", label: "Interior State", enabled: true, source: "parsed", value: "" },
      { key: "suffix", label: "Suffix", enabled: true, source: "fixed", value: "Interior" }
    ]
  }
];

export function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeLookup(value) {
  return cleanText(value).toLowerCase();
}

export function parseAliases(text) {
  const map = new Map();
  String(text || "").split(/\r?\n/).forEach(line => {
    const sourceLine = line.trim();
    if (!sourceLine || sourceLine.startsWith("#")) return;
    const eq = sourceLine.indexOf("=");
    if (eq < 1) return;
    let left = cleanText(sourceLine.slice(0, eq));
    const output = cleanText(sourceLine.slice(eq + 1));
    if (!output) return;
    let field = "exteriorColor";
    const pipe = left.indexOf("|");
    if (pipe >= 0) {
      field = cleanText(left.slice(0, pipe)) || field;
      left = cleanText(left.slice(pipe + 1));
    }
    if (!left) return;
    map.set(`${normalizeLookup(field)}|${normalizeLookup(left)}`, output);
  });
  return map;
}

export function parseSequence(text) {
  const map = new Map();
  String(text || "").split(/\r?\n/).forEach(line => {
    const sourceLine = line.trim();
    if (!sourceLine || sourceLine.startsWith("#")) return;
    const eq = sourceLine.indexOf("=");
    if (eq < 1) return;
    const key = cleanText(sourceLine.slice(0, eq));
    const value = cleanText(sourceLine.slice(eq + 1));
    if (key && value) map.set(normalizeLookup(key), value);
  });
  return map;
}

export function applyAlias(field, value, aliases) {
  const raw = cleanText(value);
  if (!raw) return "";
  return aliases.get(`${normalizeLookup(field)}|${normalizeLookup(raw)}`) || raw;
}

function splitExtension(fileName) {
  const name = String(fileName || "");
  const m = name.match(/^(.*?)(\.[a-z0-9]{2,8})$/i);
  return m ? { base: m[1], extension: m[2].slice(1).toLowerCase() } : { base: name, extension: "" };
}

export function inferFileRecord(fileName) {
  const { base, extension } = splitExtension(fileName);
  const record = {
    originalName: String(fileName || ""),
    extension,
    manufacturer: "",
    model: "",
    size: "",
    colorOrder: "",
    exteriorColor: "",
    hardware: "",
    interiorFamily: "",
    interiorState: "",
    suffix: ""
  };

  const source = base
    .replace(/\.copy(?=-|$)/gi, "")
    .replace(/\.\d+\.copy(?=-|$)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/^LX-Sig-/i.test(source)) {
    record.manufacturer = "Liberty";
    record.model = "Lincoln";
    record.interiorFamily = "Signature Interior";
    const m = source.match(/^LX-Sig-([^\-]+)-(.+?)-Open-(.+?)(?:-interior)?$/i);
    if (m) {
      record.size = cleanText(m[1]);
      record.exteriorColor = cleanText(m[2]);
      const tail = cleanText(m[3]);
      if (/full\s*no\s*guns/i.test(tail)) record.interiorState = "Full No Guns";
      else if (/loaded/i.test(tail)) record.interiorState = "Loaded";
      else if (/empty/i.test(tail)) record.interiorState = "Empty";
    }
  }

  const renamed = source.match(/^liberty-lincoln-([^-]+)-([0-9]+)-(.+?)-signature-interior-(full-no-guns|loaded|empty)(?:-interior)?$/i);
  if (renamed) {
    record.manufacturer = "Liberty";
    record.model = "Lincoln";
    record.size = cleanText(renamed[1]);
    record.colorOrder = cleanText(renamed[2]);
    record.exteriorColor = cleanText(renamed[3]).replace(/-/g, " ");
    record.interiorFamily = "Signature Interior";
    record.interiorState = renamed[4].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    record.suffix = /-interior$/i.test(source) ? "Interior" : "";
  }

  if (!record.size) {
    const size = source.match(/(?:^|[-_ ])(08|12|17|25)(?:[-_ ]|$)/i);
    if (size) record.size = size[1];
  }

  if (!record.hardware) {
    if (/black[ -]?chrome|(?:^|[-_ ])bc(?:[-_ ]|$)/i.test(source)) record.hardware = "Black Chrome";
    else if (/brass|(?:^|[-_ ])br(?:[-_ ]|$)/i.test(source)) record.hardware = "Brass";
    else if (/chrome|(?:^|[-_ ])ch(?:[-_ ]|$)/i.test(source)) record.hardware = "Chrome";
  }

  if (!record.interiorState) {
    if (/full[ -]?no[ -]?guns/i.test(source)) record.interiorState = "Full No Guns";
    else if (/loaded/i.test(source)) record.interiorState = "Loaded";
    else if (/empty/i.test(source)) record.interiorState = "Empty";
  }

  return record;
}

export function normalizeSegment(value, caseMode = "lower", separator = "-") {
  let text = cleanText(value)
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();

  if (caseMode === "lower") text = text.toLowerCase();
  else if (caseMode === "upper") text = text.toUpperCase();

  if (!text) return "";
  return text.split(/\s+/).join(separator);
}

export function buildProposedName(recipe, record) {
  const aliases = parseAliases(recipe.aliasesText);
  const sequence = parseSequence(recipe.sequenceText);
  const separator = recipe.separator ?? "-";
  const caseMode = recipe.caseMode ?? "lower";
  const missing = [];
  const values = [];

  const aliasedRecord = { ...record };
  Object.keys(aliasedRecord).forEach(key => {
    if (key === "originalName" || key === "extension") return;
    aliasedRecord[key] = applyAlias(key, aliasedRecord[key], aliases);
  });

  for (const field of recipe.fields || []) {
    if (!field.enabled) continue;
    let value = "";
    if (field.source === "fixed") {
      value = cleanText(field.value);
    } else if (field.source === "parsed") {
      value = cleanText(aliasedRecord[field.key]);
    } else if (field.source === "sequence") {
      const sourceKey = recipe.sequenceSource || "exteriorColor";
      const sourceValue = cleanText(aliasedRecord[sourceKey]);
      value = sourceValue ? (sequence.get(normalizeLookup(sourceValue)) || "") : "";
    }

    if (!value) {
      missing.push(field.label || field.key || "field");
      continue;
    }
    values.push(normalizeSegment(value, caseMode, separator));
  }

  const ext = recipe.extensionMode === "webp"
    ? "webp"
    : (record.extension || "webp");
  const baseName = values.filter(Boolean).join(separator);

  return {
    filename: baseName ? `${baseName}.${ext}` : "",
    missing,
    ready: Boolean(baseName) && missing.length === 0,
    values: aliasedRecord
  };
}

export function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

let crcTable = null;
function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

export function crc32(bytes) {
  const table = getCrcTable();
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeU16(view, offset, value) { view.setUint16(offset, value, true); }
function writeU32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }
function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((Math.floor(date.getSeconds() / 2)) & 31),
    date: (((year - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31)
  };
}

function concatArrays(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

export async function createStoredZip(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const fileName = String(entry.name || "file");
    const nameBytes = encoder.encode(fileName);
    const data = new Uint8Array(await entry.file.arrayBuffer());
    const crc = crc32(data);
    const dt = dosDateTime(entry.lastModified ? new Date(entry.lastModified) : new Date());

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    writeU32(lv, 0, 0x04034b50);
    writeU16(lv, 4, 20);
    writeU16(lv, 6, 0x0800);
    writeU16(lv, 8, 0);
    writeU16(lv, 10, dt.time);
    writeU16(lv, 12, dt.date);
    writeU32(lv, 14, crc);
    writeU32(lv, 18, data.length);
    writeU32(lv, 22, data.length);
    writeU16(lv, 26, nameBytes.length);
    writeU16(lv, 28, 0);
    local.set(nameBytes, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    writeU32(cv, 0, 0x02014b50);
    writeU16(cv, 4, 20);
    writeU16(cv, 6, 20);
    writeU16(cv, 8, 0x0800);
    writeU16(cv, 10, 0);
    writeU16(cv, 12, dt.time);
    writeU16(cv, 14, dt.date);
    writeU32(cv, 16, crc);
    writeU32(cv, 20, data.length);
    writeU32(cv, 24, data.length);
    writeU16(cv, 28, nameBytes.length);
    writeU16(cv, 30, 0);
    writeU16(cv, 32, 0);
    writeU16(cv, 34, 0);
    writeU16(cv, 36, 0);
    writeU32(cv, 38, 0);
    writeU32(cv, 42, localOffset);
    central.set(nameBytes, 46);
    centralParts.push(central);

    localOffset += local.length + data.length;
  }

  const centralData = concatArrays(centralParts);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  writeU32(ev, 0, 0x06054b50);
  writeU16(ev, 4, 0);
  writeU16(ev, 6, 0);
  writeU16(ev, 8, entries.length);
  writeU16(ev, 10, entries.length);
  writeU32(ev, 12, centralData.length);
  writeU32(ev, 16, localOffset);
  writeU16(ev, 20, 0);

  return new Blob([...localParts, centralData, end], { type: "application/zip" });
}
