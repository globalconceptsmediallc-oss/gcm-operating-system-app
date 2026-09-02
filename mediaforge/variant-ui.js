/* =========================================================
MediaForge
File: variant-ui.js
Version: 1.0.0
Status: Production Road-Test Candidate
Purpose: Apply the saved Liberty merchandising standard to Canto-style
         Lincoln interior batches, explain exterior-vs-interior numbering,
         block unsupported combinations, and build rename-only outputs.
========================================================= */

import {
  LIBERTY_VARIANT_STANDARD,
  VARIANT_STANDARD_ENGINE_VERSION,
  getLincolnExteriorVariants,
  getInteriorVariantGroups,
  velourForHardware,
  buildLincolnInteriorOutput,
  buildExteriorManifestCsv,
  buildInteriorRuleManifestCsv
} from "./variant-standard.js?v=1.0.0";
import { createStoredZip } from "./naming.js?v=1.2.0";

const $ = id => document.getElementById(id);
const els = {
  standardVersion: $("variantStandardVersion"),
  standardEffective: $("variantStandardEffective"),
  standardPositions: $("variantStandardPositions"),
  standardGroups: $("variantStandardGroups"),
  exteriorBody: $("variantExteriorBody"),
  interiorBody: $("variantInteriorBody"),
  exteriorManifest: $("variantExteriorManifest"),
  interiorManifest: $("variantInteriorManifest"),
  status: $("variantStatus"),
  detected: $("variantDetected"),
  outcome: $("variantOutcome"),
  foundCount: $("variantFoundCount"),
  readyCount: $("variantReadyCount"),
  reviewCount: $("variantReviewCount"),
  changeCount: $("variantChangeCount"),
  explanation: $("variantOutcomeExplanation"),
  promise: $("variantOutcomePromise"),
  previewBody: $("variantBatchPreviewBody"),
  batchDetails: $("variantBatchDetails"),
  batchManifest: $("variantBatchManifest"),
  zip: $("variantZip"),
  exampleInput: $("variantExampleInput"),
  exampleRun: $("variantExampleRun"),
  exampleResult: $("variantExampleResult")
};

let files = [];
let rows = [];

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

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function setStatus(message, tone = "") {
  if (!els.status) return;
  els.status.className = `status ${tone}`.trim();
  els.status.textContent = message;
}

function renderStandard() {
  const exterior = getLincolnExteriorVariants();
  const interiors = getInteriorVariantGroups();

  if (els.standardVersion) {
    els.standardVersion.textContent =
      `v${LIBERTY_VARIANT_STANDARD.version} · Engine ${VARIANT_STANDARD_ENGINE_VERSION}`;
  }
  if (els.standardEffective) {
    els.standardEffective.textContent = LIBERTY_VARIANT_STANDARD.effectiveDate;
  }
  if (els.standardPositions) {
    els.standardPositions.textContent = String(exterior.length);
  }
  if (els.standardGroups) {
    els.standardGroups.textContent = String(interiors.length);
  }

  if (els.exteriorBody) {
    els.exteriorBody.innerHTML = exterior.map(item => `
      <tr>
        <td><strong>#${item.position}</strong></td>
        <td>${escapeHtml(item.colorFamily)}</td>
        <td>${escapeHtml(item.finish)}</td>
        <td>${escapeHtml(item.hardware)}</td>
        <td>${escapeHtml(velourForHardware(item.hardware) || "—")}</td>
      </tr>
    `).join("");
  }

  if (els.interiorBody) {
    els.interiorBody.innerHTML = interiors.map(group => `
      <tr>
        <td><strong>#${group.representativePosition}</strong></td>
        <td>${escapeHtml(group.colorFinish)}</td>
        <td>${escapeHtml(group.exteriorPositions.map(value => `#${value}`).join(", "))}</td>
        <td>${escapeHtml(group.hardware.join(", "))}</td>
        <td>${escapeHtml(group.velour.join(" / "))}</td>
      </tr>
    `).join("");
  }
}

function analyzeBatch(incoming) {
  files = Array.isArray(incoming) ? incoming : [];
  const initial = files.map(file => ({
    file,
    ...buildLincolnInteriorOutput(file.name)
  }));

  const nameCounts = new Map();
  initial
    .filter(row => row.ready && row.outputName)
    .forEach(row =>
      nameCounts.set(row.outputName, (nameCounts.get(row.outputName) || 0) + 1)
    );

  rows = initial.map(row => {
    const duplicate = Boolean(
      row.ready &&
      row.outputName &&
      (nameCounts.get(row.outputName) || 0) > 1
    );

    return duplicate
      ? {
          ...row,
          ready: false,
          duplicate: true,
          reason: "More than one source file resolves to this same production filename. Review before export."
        }
      : { ...row, duplicate: false };
  });

  renderBatch();
}

function renderBatch() {
  if (!rows.length) {
    if (els.outcome) els.outcome.hidden = true;
    if (els.batchDetails) els.batchDetails.hidden = true;
    if (els.previewBody) {
      els.previewBody.innerHTML =
        '<tr><td colspan="7" class="empty-cell">Add a Lincoln Canto batch to preview the standard.</td></tr>';
    }
    if (els.batchManifest) els.batchManifest.disabled = true;
    if (els.zip) els.zip.disabled = true;
    return;
  }

  const ready = rows.filter(row => row.ready);
  const review = rows.filter(row => !row.ready);
  const changed = ready.filter(row => row.changed);

  if (els.outcome) els.outcome.hidden = false;
  if (els.batchDetails) els.batchDetails.hidden = false;
  if (els.foundCount) els.foundCount.textContent = String(rows.length);
  if (els.readyCount) els.readyCount.textContent = String(ready.length);
  if (els.reviewCount) els.reviewCount.textContent = String(review.length);
  if (els.changeCount) els.changeCount.textContent = String(changed.length);

  if (els.explanation) {
    els.explanation.textContent = review.length
      ? `${ready.length} of ${rows.length} files match the saved Liberty standard. ${review.length} need review before MediaForge will build a ZIP.`
      : `All ${rows.length} files match the saved Liberty standard. Interior image numbers use the first exterior position for each color/finish, even when the source image represents a later Brass exterior variant.`;
  }

  if (els.promise) {
    els.promise.className = review.length ? "warning-copy" : "promise";
    els.promise.textContent = review.length
      ? "MediaForge will not guess unsupported combinations or create a partial production ZIP."
      : "Image contents will stay unchanged. Only approved filenames will change.";
  }

  if (els.previewBody) {
    els.previewBody.innerHTML = rows.map(row => {
      const status = row.ready ? "Ready" : `Review: ${row.reason || "Unresolved"}`;
      return `
        <tr class="${row.ready ? "" : "mf-exception-row"}">
          <td><strong>${escapeHtml(row.file?.name || row.originalName)}</strong></td>
          <td>${escapeHtml(row.colorFinish || "—")}</td>
          <td>${escapeHtml(row.velour || "—")}</td>
          <td>${row.sourceExteriorPosition ? `#${row.sourceExteriorPosition}` : "—"}</td>
          <td>${row.representativePosition ? `#${row.representativePosition}` : "—"}</td>
          <td>${escapeHtml(row.outputName || "—")}</td>
          <td><span class="recipe-status ${row.ready ? "ready" : "needs"}">${escapeHtml(status)}</span></td>
        </tr>
      `;
    }).join("");
  }

  if (els.batchManifest) els.batchManifest.disabled = false;
  if (els.zip) {
    els.zip.disabled = review.length > 0 || ready.length === 0;
    els.zip.textContent = review.length
      ? "ZIP Blocked — Review Files"
      : `Build ${ready.length}-Image Renamed ZIP`;
  }

  if (els.detected) {
    els.detected.textContent =
      `Lincoln interior batch · ${rows.length} image${rows.length === 1 ? "" : "s"} · Liberty standard v${LIBERTY_VARIANT_STANDARD.version}`;
  }

  setStatus(
    review.length
      ? `${review.length} file${review.length === 1 ? "" : "s"} need review. MediaForge did not guess.`
      : "Variant standard applied successfully. Review the preview or build the renamed ZIP.",
    review.length ? "warning" : "success"
  );
}

function batchManifestCsv() {
  const header = [
    "original_filename",
    "status",
    "color_finish",
    "velour",
    "source_exterior_position",
    "interior_representative_position",
    "source_hardware",
    "output_filename",
    "reason"
  ];

  const data = rows.map(row => [
    row.file?.name || row.originalName,
    row.ready ? "Ready" : "Review",
    row.colorFinish || "",
    row.velour || "",
    row.sourceExteriorPosition || "",
    row.representativePosition || "",
    row.sourceHardware || "",
    row.outputName || "",
    row.reason || ""
  ]);

  return [header, ...data]
    .map(row => row.map(csvCell).join(","))
    .join("\n");
}

function runExample() {
  const source = els.exampleInput?.value?.trim();
  if (!source || !els.exampleResult) return;

  const result = buildLincolnInteriorOutput(source);
  els.exampleResult.hidden = false;

  if (!result.ready) {
    els.exampleResult.className = "status warning";
    els.exampleResult.innerHTML =
      `<strong>Needs review.</strong> ${escapeHtml(result.reason || "MediaForge could not apply the standard.")}`;
    return;
  }

  const sourcePositionText = result.sourceExteriorPosition
    ? `The source corresponds to exterior #${result.sourceExteriorPosition}, but `
    : "";

  els.exampleResult.className = "status success";
  els.exampleResult.innerHTML = [
    `<strong>${escapeHtml(result.colorFinish)} · ${escapeHtml(result.velour)}</strong>`,
    `${escapeHtml(sourcePositionText)}the interior inherits #${result.representativePosition}.`,
    `<code>${escapeHtml(result.outputName)}</code>`
  ].join("<br>");
}

window.addEventListener("mediaforge:variant-files", event => {
  analyzeBatch(
    Array.isArray(event.detail?.files)
      ? event.detail.files
      : []
  );
});

els.exteriorManifest?.addEventListener("click", () => {
  safeDownload(
    new Blob([buildExteriorManifestCsv()], { type: "text/csv;charset=utf-8" }),
    "liberty-lincoln-exterior-variant-standard-v1.csv"
  );
});

els.interiorManifest?.addEventListener("click", () => {
  safeDownload(
    new Blob([buildInteriorRuleManifestCsv()], { type: "text/csv;charset=utf-8" }),
    "liberty-lincoln-interior-numbering-standard-v1.csv"
  );
});

els.batchManifest?.addEventListener("click", () => {
  if (!rows.length) return;
  safeDownload(
    new Blob([batchManifestCsv()], { type: "text/csv;charset=utf-8" }),
    "mediaforge-liberty-variant-batch-manifest.csv"
  );
});

els.zip?.addEventListener("click", async () => {
  const ready = rows.filter(row => row.ready);
  if (!ready.length || ready.length !== rows.length) return;

  els.zip.disabled = true;
  els.zip.textContent = `Building ${ready.length}-Image ZIP…`;

  try {
    const zip = await createStoredZip(
      ready.map(row => ({
        file: row.file,
        name: row.outputName,
        lastModified: row.file?.lastModified
      }))
    );

    safeDownload(zip, "mediaforge-liberty-variant-renamed.zip");
    if (els.promise) {
      els.promise.className = "promise";
      els.promise.textContent =
        `Finished ZIP created with ${ready.length} images. Image contents were preserved; only standard-approved filenames changed.`;
    }
  } catch (error) {
    if (els.promise) {
      els.promise.className = "warning-copy";
      els.promise.textContent =
        error?.message || "Variant ZIP export failed.";
    }
  } finally {
    renderBatch();
  }
});

els.exampleRun?.addEventListener("click", runExample);
els.exampleInput?.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    runExample();
  }
});

renderStandard();
renderBatch();
