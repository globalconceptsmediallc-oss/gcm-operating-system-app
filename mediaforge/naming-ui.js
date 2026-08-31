/* =========================================================
MediaForge
File: naming-ui.js
Version: 1.2.0
Status: Production Candidate
Purpose: Plain-English rename road test, preset persistence,
         exception-aware preview, manifest export, and safe ZIP export.
========================================================= */

import {
  BUILTIN_PRESETS,
  inferFileRecord,
  buildProposedName,
  knownRenameException,
  csvEscape,
  createStoredZip
} from "./naming.js?v=1.2.0";

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
  zip: $("namingZip"),
  outcome: $("namingOutcome"),
  outcomeTitle: $("namingOutcomeTitle"),
  outcomeSubtitle: $("namingOutcomeSubtitle"),
  foundCount: $("namingFoundCount"),
  readyCount: $("namingReadyCount"),
  readyLabel: $("namingReadyLabel"),
  reviewCount: $("namingReviewCount"),
  changeCount: $("namingChangeCount"),
  explanation: $("namingOutcomeExplanation"),
  promise: $("namingOutcomePromise"),
  reviewExceptions: $("namingReviewExceptions"),
  showAll: $("namingShowAll"),
  fileDetails: $("namingFileDetails"),
  fileDetailsSummary: $("namingFileDetailsSummary"),
  quickStatus: $("renameQuickStatus")
};

if (!els.preset) throw new Error("MediaForge naming UI markup is missing.");

let recipe = structuredClone(BUILTIN_PRESETS[2]);
let files = [];
let overrides = new Map();
let savedPresets = loadSavedPresets();
let detectedJob = null;
let detailFilter = "all";

function loadSavedPresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

  row.querySelector("[data-role=source]").addEventListener("change", event => {
    row.querySelector("[data-role=value]").disabled = event.target.value !== "fixed";
    updateRecipeAndPreview();
  });
  row.querySelectorAll("input,select").forEach(control => {
    if (control.dataset.role === "source") return;
    control.addEventListener(
      control.type === "checkbox" ? "change" : "input",
      updateRecipeAndPreview
    );
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
  (recipe.fields || []).forEach((field, index) =>
    els.fields.append(fieldRow(field, index))
  );
}

function moveField(index, delta) {
  recipe = currentRecipeFromUi();
  const target = index + delta;
  if (target < 0 || target >= recipe.fields.length) return;
  [recipe.fields[index], recipe.fields[target]] =
    [recipe.fields[target], recipe.fields[index]];
  renderFields();
  renderPreview();
}

function updateRecipeAndPreview() {
  recipe = currentRecipeFromUi();
  renderPreview();
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char])
  );
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
    const exception = override
      ? null
      : knownRenameException(activeRecipe, parsed, result);
    const blocked = !ready && !exception;
    const changed = ready && outputName !== file.name;

    return {
      index,
      file,
      parsed,
      result,
      outputName,
      ready,
      exception,
      blocked,
      changed,
      missing: override ? [] : result.missing
    };
  });
}

function batchTitle(rows) {
  if (detectedJob?.title) return detectedJob.title;

  const sizes = [...new Set(
    rows.map(row => row.parsed.size).filter(Boolean)
  )];

  if (
    rows.length &&
    rows.every(row => row.parsed.model === "Lincoln") &&
    sizes.length
  ) {
    return sizes.length === 1
      ? `Lincoln ${sizes[0]} Signature Interiors`
      : `Lincoln ${sizes.join(" / ")} Signature Interiors`;
  }

  return recipe.jobName || "Image batch";
}

function renderOutcome(rows) {
  const readyRows = rows.filter(row => row.ready);
  const exceptions = rows.filter(row => row.exception);
  const blocked = rows.filter(row => row.blocked);
  const changed = readyRows.filter(row => row.changed);
  const unchanged = readyRows.filter(row => !row.changed);
  const reviewTotal = exceptions.length + blocked.length;
  const title = batchTitle(rows);
  const verifiedOnly =
    rows.length > 0 &&
    reviewTotal === 0 &&
    changed.length === 0 &&
    unchanged.length === rows.length;

  els.outcome.hidden = false;
  els.fileDetails.hidden = false;
  els.status.hidden = true;
  if (els.quickStatus) els.quickStatus.hidden = true;

  els.outcomeTitle.textContent = `${title} recognized`;
  els.outcomeSubtitle.textContent = verifiedOnly
    ? "MediaForge checked the batch against the approved naming rule."
    : "MediaForge checked every file before deciding what can safely be included.";

  els.foundCount.textContent = String(rows.length);
  els.readyCount.textContent = String(readyRows.length);
  els.reviewCount.textContent = String(reviewTotal);
  els.changeCount.textContent = String(changed.length);
  els.readyLabel.textContent = verifiedOnly
    ? "Already approved"
    : "Ready for output";

  if (verifiedOnly) {
    els.explanation.textContent =
      `${rows.length} filenames already match our approved naming convention. 0 files need changes and 0 files need review.`;
    els.promise.className = "promise";
    els.promise.textContent =
      "MediaForge will keep the image files and filenames exactly as they are.";
    els.zip.textContent = "Download Verified ZIP";
  } else if (exceptions.length && !blocked.length) {
    const exceptionLabels = [...new Set(
      exceptions.map(row => row.exception.label).filter(Boolean)
    )];
    const labelText = exceptionLabels.join(", ") || "known source issue";

    els.explanation.textContent =
      `${readyRows.length} of ${rows.length} images are ready. ${exceptions.length} need review — ${labelText}. The reviewed exception files will not be renamed or included because MediaForge has a saved reason not to guess their production names.`;
    els.promise.className = "promise";
    els.promise.textContent =
      `The finished ZIP will contain ${readyRows.length} images. Image contents will not be changed; ${changed.length ? "only approved filenames will change." : "approved filenames will be preserved."}`;
    els.zip.textContent =
      `Build ${readyRows.length}-Image ${changed.length ? "Renamed" : "Verified"} ZIP`;
  } else if (blocked.length) {
    els.explanation.textContent =
      `${readyRows.length} of ${rows.length} images are safe to process, but ${blocked.length} cannot be named with enough confidence yet.`;
    els.promise.className = "warning-copy";
    els.promise.textContent =
      "MediaForge will not build a ZIP while unresolved files could be guessed incorrectly. Review those files or change the recipe in Advanced settings.";
    els.zip.textContent = "ZIP Blocked — Review Files";
  } else {
    els.explanation.textContent =
      `${readyRows.length} of ${rows.length} images are ready. ${changed.length} filenames will change and 0 files need review.`;
    els.promise.className = "promise";
    els.promise.textContent =
      `The finished ZIP will contain ${readyRows.length} images. Image contents will not be changed; only approved filenames will change.`;
    els.zip.textContent =
      `Build ${readyRows.length}-Image Renamed ZIP`;
  }

  els.reviewExceptions.hidden = reviewTotal === 0;
  els.reviewExceptions.textContent =
    reviewTotal === 1
      ? "Review 1 Exception"
      : `Review ${reviewTotal} Exceptions`;
  els.showAll.textContent =
    rows.length === 1
      ? "See Filename"
      : `See All ${rows.length} Filenames`;

  els.fileDetailsSummary.textContent =
    rows.length === 1
      ? "Filename details"
      : `Filename details — ${rows.length} files`;

  els.manifest.disabled = false;
  els.zip.disabled = readyRows.length === 0 || blocked.length > 0;
}

function applyDetailFilter() {
  const rows = [...els.preview.querySelectorAll("tr[data-row-state]")];

  rows.forEach(row => {
    const state = row.dataset.rowState;
    row.hidden =
      detailFilter === "exceptions" &&
      state !== "exception" &&
      state !== "blocked";
  });
}

function renderPreview() {
  if (!files.length) {
    els.preview.innerHTML =
      '<tr><td colspan="5" class="empty-cell">Drop a ZIP or choose files to preview the rename job.</td></tr>';
    els.status.hidden = true;
    els.outcome.hidden = true;
    els.fileDetails.hidden = true;
    els.manifest.disabled = true;
    els.zip.disabled = true;
    return;
  }

  const rows = previewRows();
  els.preview.innerHTML = "";

  rows.forEach(row => {
    const tr = document.createElement("tr");
    tr.dataset.rowState = row.exception
      ? "exception"
      : row.blocked
        ? "blocked"
        : "ready";

    if (row.exception) tr.classList.add("mf-exception-row");

    const rowStatus = row.ready
      ? (row.changed ? "Ready to rename" : "Already approved")
      : row.exception
        ? `Review: ${row.exception.label}`
        : `Needs: ${row.missing.join(", ")}`;

    tr.innerHTML = `
      <td><strong>${escapeHtml(row.file.name)}</strong></td>
      <td>${escapeHtml(row.parsed.exteriorColor || "—")}</td>
      <td>${escapeHtml(row.parsed.interiorState || "—")}</td>
      <td><input class="rename-override" data-index="${row.index}" value="${escapeHtml(row.outputName)}" aria-label="Proposed output filename"></td>
      <td><span class="recipe-status ${row.ready ? "ready" : "needs"}">${escapeHtml(rowStatus)}</span></td>`;
    els.preview.append(tr);
  });

  els.preview.querySelectorAll(".rename-override").forEach(input => {
    input.addEventListener("input", () => {
      const index = Number(input.dataset.index);
      const proposed = buildProposedName(
        currentRecipeFromUi(),
        inferFileRecord(files[index].name)
      ).filename;
      const value = input.value.trim();

      if (value && value !== proposed) overrides.set(index, value);
      else overrides.delete(index);

      renderPreview();
    });
  });

  renderOutcome(rows);
  applyDetailFilter();
}

els.preset.addEventListener("change", () => {
  const found = [...BUILTIN_PRESETS, ...savedPresets]
    .find(item => item.id === els.preset.value);
  if (found) setRecipe(found);
});

els.newJob.onclick = () => {
  const custom = structuredClone(BUILTIN_PRESETS[0]);
  custom.id = "custom";
  detectedJob = null;
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
};

els.addField.onclick = () => {
  recipe = currentRecipeFromUi();
  recipe.fields.push({
    key: `custom${recipe.fields.length + 1}`,
    label: "Custom Field",
    enabled: true,
    source: "fixed",
    value: ""
  });
  renderFields();
  renderPreview();
};

[
  els.jobName,
  els.instructions,
  els.caseMode,
  els.separator,
  els.extensionMode,
  els.sequenceSource,
  els.aliases,
  els.sequence
].forEach(control =>
  control.addEventListener(
    control.tagName === "SELECT" ? "change" : "input",
    updateRecipeAndPreview
  )
);

els.chooseFiles.onclick = () => {
  els.fileInput.value = "";
  els.fileInput.click();
};

els.fileInput.onchange = event => {
  files = [...(event.target.files || [])]
    .filter(file => /\.(jpe?g|png|webp)$/i.test(file.name));
  overrides = new Map();
  detectedJob = null;
  detailFilter = "all";
  renderPreview();
};

window.addEventListener("mediaforge:naming-files", event => {
  const incoming = Array.isArray(event.detail?.files)
    ? event.detail.files
    : [];

  files = incoming.filter(file => /\.(jpe?g|png|webp)$/i.test(file.name));
  overrides = new Map();
  detectedJob = event.detail?.detectedJob || null;
  detailFilter = "all";
  renderPreview();
});

els.reviewExceptions.onclick = () => {
  detailFilter = "exceptions";
  els.fileDetails.open = true;
  applyDetailFilter();
  els.fileDetails.scrollIntoView({ behavior:"smooth", block:"start" });
};

els.showAll.onclick = () => {
  detailFilter = "all";
  els.fileDetails.open = true;
  applyDetailFilter();
  els.fileDetails.scrollIntoView({ behavior:"smooth", block:"start" });
};

els.fileDetails.addEventListener("toggle", () => {
  if (!els.fileDetails.open) {
    detailFilter = "all";
    applyDetailFilter();
  }
});

els.manifest.onclick = () => {
  const rows = previewRows();
  const csv = [
    [
      "original_filename",
      "proposed_filename",
      "status",
      "reason",
      "parsed_exterior_color",
      "parsed_interior_state"
    ].join(","),
    ...rows.map(row => [
      row.file.name,
      row.outputName,
      row.ready
        ? (row.changed ? "Ready to rename" : "Already approved")
        : row.exception
          ? "Excluded known exception"
          : `Needs: ${row.missing.join(" | ")}`,
      row.exception?.reason || "",
      row.parsed.exteriorColor,
      row.parsed.interiorState
    ].map(csvEscape).join(","))
  ].join("\n");

  safeDownload(
    new Blob([csv], { type:"text/csv;charset=utf-8" }),
    `${(els.jobName.value || "mediaforge-job")
      .trim()
      .replace(/[^a-z0-9]+/gi,"-")
      .replace(/^-|-$/g,"")
      .toLowerCase()}-audit-manifest.csv`
  );
};

els.zip.onclick = async () => {
  const rows = previewRows();
  const blocked = rows.filter(row => row.blocked);
  const exportRows = rows.filter(row => row.ready);

  if (!rows.length || blocked.length || !exportRows.length) return;

  els.zip.disabled = true;
  els.zip.textContent = `Building ${exportRows.length}-Image ZIP…`;

  try {
    const zip = await createStoredZip(
      exportRows.map(row => ({
        file: row.file,
        name: row.outputName,
        lastModified: row.file.lastModified
      }))
    );

    const changed = exportRows.filter(row => row.changed).length;
    const jobSlug = (els.jobName.value || "mediaforge-job")
      .trim()
      .replace(/[^a-z0-9]+/gi,"-")
      .replace(/^-|-$/g,"")
      .toLowerCase();

    safeDownload(
      zip,
      `${jobSlug || "mediaforge-job"}-${changed ? "renamed" : "verified"}.zip`
    );

    els.promise.className = "promise";
    els.promise.textContent = changed
      ? `Finished ZIP created with ${exportRows.length} images. Image contents were preserved; only approved filenames changed.`
      : `Verified ZIP created with ${exportRows.length} images. Image contents and approved filenames were preserved.`;
  } catch (error) {
    console.error(error);
    els.promise.className = "warning-copy";
    els.promise.textContent =
      error?.message || "ZIP export failed.";
  } finally {
    renderPreview();
  }
};

populatePresetSelect(recipe.id);
setRecipe(recipe);
