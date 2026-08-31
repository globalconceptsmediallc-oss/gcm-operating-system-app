/* =========================================================
MediaForge
File: naming-ui.js
Version: 1.1.1
Status: Production Candidate
Purpose: Human-controlled Naming Recipe UI, preset persistence,
         batch preview, manifest export, and rename-only ZIP export.
========================================================= */

import {
  BUILTIN_PRESETS,
  inferFileRecord,
  buildProposedName,
  csvEscape,
  createStoredZip
} from "./naming.js?v=1.1.1";

const STORAGE_KEY = "mediaforge-naming-presets-v1";
const $ = id => document.getElementById(id);
const els = {
  preset: $("namingPreset"),
  jobName: $("namingJobName"),
  instructions: $("namingInstructions"),
  caseMode: $("namingCase"),
  separator: $("namingSeparator"),
  extensionMode: $("namingExtension"),
  sequenceSource: $("namingSequenceSource"),
  aliases: $("namingAliases"),
  sequence: $("namingSequence"),
  fields: $("namingFields"),
  addField: $("namingAddField"),
  newJob: $("namingNewJob"),
  savePreset: $("namingSavePreset"),
  chooseFiles: $("namingChooseFiles"),
  fileInput: $("namingFileInput"),
  status: $("namingStatus"),
  preview: $("namingPreviewBody"),
  manifest: $("namingManifest"),
  zip: $("namingZip")
};

if (!els.preset) throw new Error("MediaForge naming UI markup is missing.");

let recipe = structuredClone(BUILTIN_PRESETS[2]);
let files = [];
let overrides = new Map();
let savedPresets = loadSavedPresets();

function loadSavedPresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistSavedPresets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPresets));
}

function populatePresetSelect(selectedId = recipe.id) {
  els.preset.innerHTML = "";
  [...BUILTIN_PRESETS, ...savedPresets].forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.builtIn ? "Built-in" : "Saved"} · ${item.name}`;
    els.preset.append(option);
  });
  els.preset.value = selectedId;
}

function currentRecipeFromUi() {
  return {
    ...recipe,
    jobName: els.jobName.value.trim() || "Naming Job",
    instructions: els.instructions.value,
    caseMode: els.caseMode.value,
    separator: els.separator.value,
    extensionMode: els.extensionMode.value,
    sequenceSource: els.sequenceSource.value.trim() || "exteriorColor",
    aliasesText: els.aliases.value,
    sequenceText: els.sequence.value,
    fields: [...els.fields.querySelectorAll(".naming-field-row")].map(row => ({
      key: row.querySelector("[data-role=key]").value.trim(),
      label: row.querySelector("[data-role=label]").value.trim(),
      enabled: row.querySelector("[data-role=enabled]").checked,
      source: row.querySelector("[data-role=source]").value,
      value: row.querySelector("[data-role=value]").value
    }))
  };
}

function setRecipe(next) {
  recipe = structuredClone(next);
  els.jobName.value = recipe.jobName || "";
  els.instructions.value = recipe.instructions || "";
  els.caseMode.value = recipe.caseMode || "lower";
  els.separator.value = recipe.separator ?? "-";
  els.extensionMode.value = recipe.extensionMode || "preserve";
  els.sequenceSource.value = recipe.sequenceSource || "exteriorColor";
  els.aliases.value = recipe.aliasesText || "";
  els.sequence.value = recipe.sequenceText || "";
  renderFields();
  renderPreview();
}

function fieldRow(field, index) {
  const row = document.createElement("div");
  row.className = "naming-field-row";
  row.innerHTML = `
    <label class="naming-check"><input data-role="enabled" type="checkbox" ${field.enabled ? "checked" : ""}><span>Use</span></label>
    <input data-role="label" aria-label="Field label" value="${escapeHtml(field.label || field.key || "Field")}">
    <input data-role="key" aria-label="Field key" value="${escapeHtml(field.key || "custom")}">
    <select data-role="source" aria-label="Field source">
      <option value="fixed" ${field.source === "fixed" ? "selected" : ""}>Fixed value</option>
      <option value="parsed" ${field.source === "parsed" ? "selected" : ""}>Parsed from filename</option>
      <option value="sequence" ${field.source === "sequence" ? "selected" : ""}>Sequence map</option>
    </select>
    <input data-role="value" aria-label="Fixed field value" placeholder="Fixed value" value="${escapeHtml(field.value || "")}" ${field.source === "fixed" ? "" : "disabled"}>
    <div class="naming-row-actions">
      <button type="button" class="mini-btn" data-action="up" title="Move up">↑</button>
      <button type="button" class="mini-btn" data-action="down" title="Move down">↓</button>
      <button type="button" class="mini-btn danger-text" data-action="delete" title="Delete field">×</button>
    </div>`;

  row.querySelector("[data-role=source]").addEventListener("change", e => {
    row.querySelector("[data-role=value]").disabled = e.target.value !== "fixed";
    updateRecipeAndPreview();
  });
  row.querySelectorAll("input,select").forEach(control => {
    if (control.dataset.role === "source") return;
    control.addEventListener(control.type === "checkbox" ? "change" : "input", updateRecipeAndPreview);
  });
  row.querySelector("[data-action=up]").onclick = () => moveField(index, -1);
  row.querySelector("[data-action=down]").onclick = () => moveField(index, 1);
  row.querySelector("[data-action=delete]").onclick = () => {
    recipe = currentRecipeFromUi();
    recipe.fields.splice(index, 1);
    renderFields();
    renderPreview();
  };
  return row;
}

function renderFields() {
  els.fields.innerHTML = "";
  (recipe.fields || []).forEach((field, index) => els.fields.append(fieldRow(field, index)));
}

function moveField(index, delta) {
  recipe = currentRecipeFromUi();
  const target = index + delta;
  if (target < 0 || target >= recipe.fields.length) return;
  [recipe.fields[index], recipe.fields[target]] = [recipe.fields[target], recipe.fields[index]];
  renderFields();
  renderPreview();
}

function updateRecipeAndPreview() {
  recipe = currentRecipeFromUi();
  renderPreview();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
}

function safeDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function previewRows() {
  const activeRecipe = currentRecipeFromUi();
  return files.map((file, index) => {
    const parsed = inferFileRecord(file.name);
    const result = buildProposedName(activeRecipe, parsed);
    const override = overrides.get(index) || "";
    const outputName = override || result.filename;
    const ready = Boolean(override) || result.ready;
    return { index, file, parsed, result, outputName, ready, missing: override ? [] : result.missing };
  });
}

function renderPreview() {
  if (!files.length) {
    els.preview.innerHTML = '<tr><td colspan="5" class="empty-cell">Choose a batch of JPG, PNG, or WebP files to preview the recipe.</td></tr>';
    els.status.className = "status";
    els.status.textContent = "No batch loaded. Recipe changes are safe until files are selected.";
    els.manifest.disabled = true;
    els.zip.disabled = true;
    return;
  }

  const rows = previewRows();
  els.preview.innerHTML = "";
  rows.forEach(row => {
    const tr = document.createElement("tr");
    const status = row.ready ? "Ready" : `Needs: ${row.missing.join(", ")}`;
    tr.innerHTML = `
      <td><strong>${escapeHtml(row.file.name)}</strong></td>
      <td>${escapeHtml(row.parsed.exteriorColor || "—")}</td>
      <td>${escapeHtml(row.parsed.interiorState || "—")}</td>
      <td><input class="rename-override" data-index="${row.index}" value="${escapeHtml(row.outputName)}" aria-label="Proposed output filename"></td>
      <td><span class="recipe-status ${row.ready ? "ready" : "needs"}">${escapeHtml(status)}</span></td>`;
    els.preview.append(tr);
  });
  els.preview.querySelectorAll(".rename-override").forEach(input => {
    input.addEventListener("input", () => {
      const index = Number(input.dataset.index);
      const proposed = buildProposedName(currentRecipeFromUi(), inferFileRecord(files[index].name)).filename;
      const value = input.value.trim();
      if (value && value !== proposed) overrides.set(index, value);
      else overrides.delete(index);
      renderPreview();
    });
  });

  const ready = rows.filter(row => row.ready).length;
  const needs = rows.length - ready;
  els.status.className = `status ${needs ? "warning" : "success"}`;
  els.status.textContent = needs
    ? `${ready} of ${rows.length} files are ready. ${needs} need mapping or a manual filename override before ZIP export.`
    : `${rows.length} of ${rows.length} files are ready. Review the preview, then export the rename-only ZIP.`;
  els.manifest.disabled = false;
  els.zip.disabled = needs > 0;
}

els.preset.addEventListener("change", () => {
  const found = [...BUILTIN_PRESETS, ...savedPresets].find(item => item.id === els.preset.value);
  if (found) setRecipe(found);
});

els.newJob.onclick = () => {
  const custom = structuredClone(BUILTIN_PRESETS[0]);
  custom.id = "custom";
  setRecipe(custom);
  populatePresetSelect("custom");
};

els.savePreset.onclick = () => {
  const current = currentRecipeFromUi();
  const name = current.jobName.trim() || "Saved Naming Recipe";
  const saved = {
    ...current,
    id: `saved-${Date.now()}`,
    name,
    builtIn: false
  };
  savedPresets.push(saved);
  persistSavedPresets();
  recipe = saved;
  populatePresetSelect(saved.id);
  els.status.className = "status success";
  els.status.textContent = `Saved preset: ${name}. Future jobs can load it and override any field without changing the saved recipe.`;
};

els.addField.onclick = () => {
  recipe = currentRecipeFromUi();
  recipe.fields.push({ key: `custom${recipe.fields.length + 1}`, label: "Custom Field", enabled: true, source: "fixed", value: "" });
  renderFields();
  renderPreview();
};

[els.jobName, els.instructions, els.caseMode, els.separator, els.extensionMode, els.sequenceSource, els.aliases, els.sequence]
  .forEach(control => control.addEventListener(control.tagName === "SELECT" ? "change" : "input", updateRecipeAndPreview));

els.chooseFiles.onclick = () => { els.fileInput.value = ""; els.fileInput.click(); };
els.fileInput.onchange = event => {
  files = [...(event.target.files || [])].filter(file => /\.(jpe?g|png|webp)$/i.test(file.name));
  overrides = new Map();
  renderPreview();
};

window.addEventListener("mediaforge:naming-files", event => {
  const incoming = Array.isArray(event.detail?.files)
    ? event.detail.files
    : [];
  files = incoming.filter(file => /\.(jpe?g|png|webp)$/i.test(file.name));
  overrides = new Map();
  renderPreview();
});

els.manifest.onclick = () => {
  const rows = previewRows();
  const csv = [
    ["original_filename","proposed_filename","status","parsed_exterior_color","parsed_interior_state"].join(","),
    ...rows.map(row => [
      row.file.name,
      row.outputName,
      row.ready ? "Ready" : `Needs: ${row.missing.join(" | ")}`,
      row.parsed.exteriorColor,
      row.parsed.interiorState
    ].map(csvEscape).join(","))
  ].join("\n");
  safeDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${(els.jobName.value || "mediaforge-job").trim().replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()}-rename-manifest.csv`);
};

els.zip.onclick = async () => {
  const rows = previewRows();
  if (!rows.length || rows.some(row => !row.ready)) return;
  els.zip.disabled = true;
  els.status.className = "status running";
  els.status.textContent = `Packaging ${rows.length} original image files with approved output names…`;
  try {
    const zip = await createStoredZip(rows.map(row => ({ file: row.file, name: row.outputName, lastModified: row.file.lastModified })));
    const jobSlug = (els.jobName.value || "mediaforge-job").trim().replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase();
    safeDownload(zip, `${jobSlug || "mediaforge-job"}-renamed.zip`);
    els.status.className = "status success";
    els.status.textContent = `Rename-only ZIP ready: ${rows.length} files. Image bytes were preserved; only filenames changed.`;
  } catch (error) {
    console.error(error);
    els.status.className = "status error";
    els.status.textContent = error?.message || "ZIP export failed.";
  } finally {
    els.zip.disabled = false;
  }
};

populatePresetSelect(recipe.id);
setRecipe(recipe);
