/* =========================================================
MediaForge
File: home.js
Version: 1.1.0
Status: Production Candidate
Purpose: User-friendly task launcher and simple workflows for rename,
         website preparation, unknown-image routing, and job analysis.
========================================================= */

import { createStoredZip } from "./naming.js?v=1.2.0";

const $ = id => document.getElementById(id);
const taskCards = [...document.querySelectorAll("[data-mf-task]")];
const taskSections = [...document.querySelectorAll("[data-mf-task-section]")];
const home = $("mfHome");
const taskBar = $("mfTaskBar");
const taskTitle = $("mfTaskTitle");
const homeBtn = $("mfHomeBtn");

const TITLES = {
  variants: "Build Product Variants",
  rename: "Rename Product Images",
  prepare: "Prepare Images for the Website",
  identify: "Identify Unknown Images",
  analyze: "Analyze My Files",
  catalog: "Catalog & Settings"
};

function selectTask(task) {
  document.body.dataset.mfTask = task;
  home.hidden = true;
  taskBar.hidden = false;
  taskTitle.textContent = TITLES[task] || "MediaForge";
  taskSections.forEach(section => {
    const modes = String(section.dataset.mfTaskSection || "")
      .split(/\s+/)
      .filter(Boolean);
    section.hidden = !modes.includes(task);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showHome() {
  delete document.body.dataset.mfTask;
  home.hidden = false;
  taskBar.hidden = true;
  taskSections.forEach(section => { section.hidden = true; });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

taskCards.forEach(card => {
  card.addEventListener("click", event => {
    const task = event.currentTarget.dataset.mfTask;
    if (task) selectTask(task);
  });
});
homeBtn?.addEventListener("click", showHome);

function supportedImage(name) {
  return /\.(jpe?g|png|webp)$/i.test(String(name || ""));
}

function imageMime(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/webp";
}

function status(el, message, tone = "") {
  if (!el) return;
  el.className = `status ${tone}`.trim();
  el.textContent = message;
}

function classifyJob(files) {
  const names = files.map(file => file.name);

  const libertyVariantInteriors = names
    .map(name => name.match(/^LX(25|40|50)-.+-Open-.+(?:Pro\s*Flex|ProFlex|Standard)/i)?.[1])
    .filter(Boolean);

  if (libertyVariantInteriors.length && libertyVariantInteriors.length === files.length) {
    const sizes = [...new Set(libertyVariantInteriors)];
    return {
      task: "variants",
      recipeId: "liberty-merchandising-v1",
      alreadyNamed: false,
      title: sizes.length === 1
        ? `Lincoln ${sizes[0]} Interior Variant Batch`
        : `Lincoln ${sizes.join(" / ")} Interior Variant Batch`,
      detail: "These Canto-style Lincoln interior files match the saved Liberty merchandising standard. MediaForge will separate exterior variant position from interior image numbering."
    };
  }

  const alreadyRenamed = names
    .map(name => name.match(/^liberty-lincoln-(25|40|50)-\d+-.+?-signature-interior-(?:empty|loaded|full-no-guns)\.webp$/i))
    .filter(Boolean);

  if (alreadyRenamed.length && alreadyRenamed.length === files.length) {
    const sizes = [...new Set(alreadyRenamed.map(match => match[1]))];
    return {
      task: "rename",
      recipeId: "liberty-lincoln-signature-interiors",
      alreadyNamed: true,
      title: sizes.length === 1
        ? `Lincoln ${sizes[0]} Signature Interiors`
        : `Lincoln ${sizes.join(" / ")} Signature Interiors`,
      detail: "These files already match the approved Lincoln naming pattern. MediaForge will verify the batch and keep correct names unchanged."
    };
  }

  const lincoln = names
    .map(name => name.match(/LX-Sig-(25|40|50)-/i)?.[1])
    .filter(Boolean);

  if (lincoln.length && lincoln.length === files.length) {
    const sizes = [...new Set(lincoln)];
    return {
      task: "rename",
      recipeId: "liberty-lincoln-signature-interiors",
      alreadyNamed: false,
      title: sizes.length === 1
        ? `Lincoln ${sizes[0]} Signature Interiors`
        : `Lincoln ${sizes.join(" / ")} Signature Interiors`,
      detail: "MediaForge recognizes the Lincoln Signature naming recipe."
    };
  }

  const generic = names.filter(name =>
    /^(?:img|image|dsc|photo|untitled|screenshot)[-_ ]?\d*/i.test(name)
  ).length;

  if (generic >= Math.max(1, Math.ceil(files.length * 0.5))) {
    return {
      task: "identify",
      recipeId: "",
      alreadyNamed: false,
      title: "Unknown / generic product images",
      detail: "The filenames are not reliable enough to identify the variants."
    };
  }

  return {
    task: "prepare",
    recipeId: "",
    alreadyNamed: false,
    title: "Website image preparation",
    detail: "The filenames are usable; MediaForge can center, size, convert, and optimize the images."
  };
}

async function extractZipImages(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let eocd = -1;
  const min = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("MediaForge could not read this ZIP file.");

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const files = [];

  for (let index = 0; index < entryCount; index++) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("The ZIP directory is not in a supported format.");
    }

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameBytes = bytes.slice(offset + 46, offset + 46 + nameLength);
    const name = new TextDecoder().decode(nameBytes);

    offset += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith("/") || !supportedImage(name)) continue;

    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`ZIP entry could not be read: ${name}`);
    }

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);

    let raw;
    if (method === 0) {
      raw = compressed;
    } else if (method === 8 && "DecompressionStream" in window) {
      const stream = new Blob([compressed])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"));
      raw = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error(
        "This ZIP uses compression the browser cannot unpack. Unzip it on your computer and choose the image files instead."
      );
    }

    if (uncompressedSize && raw.byteLength !== uncompressedSize) {
      throw new Error(`ZIP entry size check failed: ${name}`);
    }

    files.push(new File(
      [raw],
      name.split("/").pop(),
      { type: imageMime(name), lastModified: file.lastModified }
    ));
  }

  if (!files.length) {
    throw new Error("No JPG, PNG, or WebP images were found in the ZIP.");
  }
  return files;
}

async function filesFromSelection(fileList) {
  const selected = [...(fileList || [])];
  if (!selected.length) return [];

  if (selected.length === 1 && /\.zip$/i.test(selected[0].name)) {
    return extractZipImages(selected[0]);
  }

  return selected.filter(file => supportedImage(file.name));
}

/* Rename workflow */
const renameDrop = $("renameQuickDrop");
const renameInput = $("renameQuickInput");
const renameStatus = $("renameQuickStatus");
const renameDetected = $("renameDetected");

async function loadRenameFiles(fileList) {
  status(renameStatus, "Reading the files…", "running");
  const files = await filesFromSelection(fileList);
  const job = classifyJob(files);

  const preset = $("namingPreset");
  if (job.task === "rename" && job.recipeId && preset) {
    preset.value = job.recipeId;
    preset.dispatchEvent(new Event("change", { bubbles: true }));
  }

  renameDetected.textContent =
    `${job.title} · ${files.length} image${files.length === 1 ? "" : "s"}`;
  status(
    renameStatus,
    job.task === "rename"
      ? (
          job.alreadyNamed
            ? "These files are already in the approved naming format. MediaForge is verifying them below and will keep correct names unchanged."
            : "Recipe detected. MediaForge has sent the files to the rename preview below."
        )
      : "Files loaded. MediaForge could not prove a naming recipe, so review Advanced settings before building the ZIP.",
    job.task === "rename" ? "success" : "warning"
  );

  window.dispatchEvent(new CustomEvent("mediaforge:naming-files", {
    detail: { files, detectedJob: job }
  }));
}

if (renameDrop && renameInput) {
  renameDrop.addEventListener("click", () => {
    renameInput.value = "";
    renameInput.click();
  });
  renameInput.addEventListener("change", event => {
    loadRenameFiles(event.target.files).catch(error =>
      status(renameStatus, error.message, "error")
    );
  });
  ["dragenter","dragover"].forEach(name => renameDrop.addEventListener(name, event => {
    event.preventDefault();
    renameDrop.classList.add("drag");
  }));
  ["dragleave","drop"].forEach(name => renameDrop.addEventListener(name, event => {
    event.preventDefault();
    renameDrop.classList.remove("drag");
  }));
  renameDrop.addEventListener("drop", event => {
    loadRenameFiles(event.dataTransfer.files).catch(error =>
      status(renameStatus, error.message, "error")
    );
  });
}

/* Variant-standard workflow */
const variantDrop = $("variantDrop");
const variantInput = $("variantInput");
const variantStatus = $("variantStatus");
const variantDetected = $("variantDetected");

async function loadVariantFiles(fileList) {
  status(variantStatus, "Reading the Liberty variant batch…", "running");
  const files = await filesFromSelection(fileList);
  if (!files.length) throw new Error("No supported images were selected.");

  const job = classifyJob(files);
  variantDetected.textContent =
    `${job.title} · ${files.length} image${files.length === 1 ? "" : "s"}`;

  window.dispatchEvent(new CustomEvent("mediaforge:variant-files", {
    detail: { files, detectedJob: job }
  }));
}

if (variantDrop && variantInput) {
  variantDrop.addEventListener("click", () => {
    variantInput.value = "";
    variantInput.click();
  });
  variantInput.addEventListener("change", event => {
    loadVariantFiles(event.target.files).catch(error =>
      status(variantStatus, error.message, "error")
    );
  });
  ["dragenter","dragover"].forEach(name => variantDrop.addEventListener(name, event => {
    event.preventDefault();
    variantDrop.classList.add("drag");
  }));
  ["dragleave","drop"].forEach(name => variantDrop.addEventListener(name, event => {
    event.preventDefault();
    variantDrop.classList.remove("drag");
  }));
  variantDrop.addEventListener("drop", event => {
    loadVariantFiles(event.dataTransfer.files).catch(error =>
      status(variantStatus, error.message, "error")
    );
  });
}

/* Website preparation workflow */
const prepareDrop = $("prepareDrop");
const prepareInput = $("prepareInput");
const prepareStatus = $("prepareStatus");
const prepareSummary = $("prepareSummary");
const prepareBuild = $("prepareBuild");
let prepareFiles = [];

async function encodeWebp(canvas, maxBytes) {
  let quality = 0.88;
  let blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      value => value ? resolve(value) : reject(new Error("WebP conversion failed.")),
      "image/webp",
      quality
    )
  );

  while (blob.size > maxBytes && quality > 0.56) {
    quality = Math.max(0.56, quality - 0.05);
    blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        value => value ? resolve(value) : reject(new Error("WebP conversion failed.")),
        "image/webp",
        quality
      )
    );
  }

  return { blob, quality };
}

async function prepareOne(file, width, height, maxBytes) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  const scale = Math.min(width / bitmap.width, height / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  ctx.drawImage(
    bitmap,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
  bitmap.close?.();

  const result = await encodeWebp(canvas, maxBytes);
  const stem = file.name.replace(/\.[^.]+$/, "");
  return {
    file: result.blob,
    name: `${stem}.webp`,
    lastModified: file.lastModified,
    quality: result.quality,
    size: result.blob.size
  };
}

async function loadPrepareFiles(fileList) {
  status(prepareStatus, "Reading the files…", "running");
  prepareFiles = await filesFromSelection(fileList);
  if (!prepareFiles.length) throw new Error("No supported images were selected.");
  prepareSummary.textContent =
    `${prepareFiles.length} image${prepareFiles.length === 1 ? "" : "s"} ready · 1200 × 1200 · centered · WebP · target ≤250 KB`;
  prepareBuild.disabled = false;
  status(prepareStatus, "Ready. Click Process & Build ZIP.", "success");
}

if (prepareDrop && prepareInput) {
  prepareDrop.addEventListener("click", () => {
    prepareInput.value = "";
    prepareInput.click();
  });
  prepareInput.addEventListener("change", event => {
    loadPrepareFiles(event.target.files).catch(error =>
      status(prepareStatus, error.message, "error")
    );
  });
  ["dragenter","dragover"].forEach(name => prepareDrop.addEventListener(name, event => {
    event.preventDefault();
    prepareDrop.classList.add("drag");
  }));
  ["dragleave","drop"].forEach(name => prepareDrop.addEventListener(name, event => {
    event.preventDefault();
    prepareDrop.classList.remove("drag");
  }));
  prepareDrop.addEventListener("drop", event => {
    loadPrepareFiles(event.dataTransfer.files).catch(error =>
      status(prepareStatus, error.message, "error")
    );
  });
}

prepareBuild?.addEventListener("click", async () => {
  if (!prepareFiles.length) return;

  const width = Math.max(200, Math.min(3000, Number($("prepareWidth")?.value) || 1200));
  const height = Math.max(200, Math.min(3000, Number($("prepareHeight")?.value) || 1200));
  const maxKb = Math.max(80, Math.min(1000, Number($("prepareMaxKb")?.value) || 250));
  const maxBytes = maxKb * 1024;

  prepareBuild.disabled = true;
  const outputs = [];

  try {
    for (let i = 0; i < prepareFiles.length; i++) {
      status(
        prepareStatus,
        `Processing ${i + 1} of ${prepareFiles.length}: ${prepareFiles[i].name}`,
        "running"
      );
      outputs.push(await prepareOne(prepareFiles[i], width, height, maxBytes));
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const zip = await createStoredZip(outputs);
    const overTarget = outputs.filter(item => item.size > maxBytes).length;
    const a = document.createElement("a");
    const url = URL.createObjectURL(zip);
    a.href = url;
    a.download = "mediaforge-website-images.zip";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    status(
      prepareStatus,
      overTarget
        ? `ZIP built. ${outputs.length - overTarget} met the ${maxKb} KB target; ${overTarget} need review because quality reached the safe minimum.`
        : `ZIP built. All ${outputs.length} images are ${width} × ${height} centered WebP files at or under the ${maxKb} KB target.`,
      overTarget ? "warning" : "success"
    );
  } catch (error) {
    console.error(error);
    status(prepareStatus, error.message || "Image processing failed.", "error");
  } finally {
    prepareBuild.disabled = false;
  }
});

/* Identify workflow */
$("identifyLoadCatalog")?.addEventListener("click", () => {
  const importButton = $("importBtn");
  if (importButton) {
    importButton.click();
    status($("identifyStatus"), "Loading the reference catalog…", "running");
    setTimeout(() => {
      const saved = localStorage.getItem("mediaforge-liberty-premium-catalog");
      status(
        $("identifyStatus"),
        saved
          ? "Reference catalog is available. Drop an unknown image below."
          : "Catalog import started. When it finishes, drop an unknown image below.",
        saved ? "success" : "running"
      );
    }, 600);
  }
});

/* Analyze-my-files workflow */
const analyzeDrop = $("analyzeDrop");
const analyzeInput = $("analyzeInput");
const analyzeStatus = $("analyzeStatus");
const analyzeResult = $("analyzeResult");
const analyzeGo = $("analyzeGo");
let analyzedTask = null;
let analyzedFiles = [];

async function analyzeSelection(fileList) {
  status(analyzeStatus, "Inspecting the files…", "running");
  analyzedFiles = await filesFromSelection(fileList);
  if (!analyzedFiles.length) throw new Error("No supported images were found.");

  const result = classifyJob(analyzedFiles);
  analyzedTask = result.task;
  analyzeResult.hidden = false;
  analyzeResult.innerHTML = `
    <strong>${escapeHtml(result.title)}</strong>
    <span>${escapeHtml(result.detail)}</span>
    <span>Recommended workflow: <b>${escapeHtml(TITLES[result.task])}</b></span>
  `;
  analyzeGo.disabled = false;
  status(analyzeStatus, `${analyzedFiles.length} file${analyzedFiles.length === 1 ? "" : "s"} analyzed.`, "success");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => (
    {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]
  ));
}

if (analyzeDrop && analyzeInput) {
  analyzeDrop.addEventListener("click", () => {
    analyzeInput.value = "";
    analyzeInput.click();
  });
  analyzeInput.addEventListener("change", event => {
    analyzeSelection(event.target.files).catch(error =>
      status(analyzeStatus, error.message, "error")
    );
  });
  ["dragenter","dragover"].forEach(name => analyzeDrop.addEventListener(name, event => {
    event.preventDefault();
    analyzeDrop.classList.add("drag");
  }));
  ["dragleave","drop"].forEach(name => analyzeDrop.addEventListener(name, event => {
    event.preventDefault();
    analyzeDrop.classList.remove("drag");
  }));
  analyzeDrop.addEventListener("drop", event => {
    analyzeSelection(event.dataTransfer.files).catch(error =>
      status(analyzeStatus, error.message, "error")
    );
  });
}

analyzeGo?.addEventListener("click", () => {
  if (!analyzedTask) return;
  const files = analyzedFiles;
  selectTask(analyzedTask);

  if (analyzedTask === "variants" && files.length) {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("mediaforge:variant-files", {
        detail: { files, detectedJob: classifyJob(files) }
      }));
      const job = classifyJob(files);
      if (variantDetected) variantDetected.textContent = `${job.title} · ${files.length} images`;
      status(variantStatus, "Liberty variant standard applied. Review the batch below.", "success");
    }, 0);
  } else if (analyzedTask === "rename" && files.length) {
    setTimeout(() => {
      const preset = $("namingPreset");
      if (preset) {
        const job = classifyJob(files);
        preset.value = job.recipeId || "liberty-lincoln-signature-interiors";
        preset.dispatchEvent(new Event("change", { bubbles: true }));
      }
      window.dispatchEvent(new CustomEvent("mediaforge:naming-files", {
        detail: { files, detectedJob: classifyJob(files) }
      }));
      if (renameDetected) {
        const job = classifyJob(files);
        renameDetected.textContent = `${job.title} · ${files.length} images`;
      }
      status(renameStatus, "Recipe detected. Review the rename preview below.", "success");
    }, 0);
  } else if (analyzedTask === "prepare" && files.length) {
    prepareFiles = files;
    prepareSummary.textContent =
      `${files.length} images ready · 1200 × 1200 · centered · WebP · target ≤250 KB`;
    prepareBuild.disabled = false;
    status(prepareStatus, "Ready. Click Process & Build ZIP.", "success");
  }
});

showHome();
