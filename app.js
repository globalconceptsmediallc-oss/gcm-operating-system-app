/* =========================================================
   Global Concepts Media Operating System
   Version 4.1.1
   File: app.js
   Purpose: Generate and render Client Pre-Research Report
   ========================================================= */

const workerEndpoint = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";

const form = document.getElementById("researchForm");
const websiteInput = document.getElementById("websiteUrl");
const generateBtn = document.getElementById("generateBtn");
const statusBar = document.getElementById("statusBar");
const reportOutput = document.getElementById("reportOutput");

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const website = websiteInput.value.trim();

  if (!website) {
    setStatus("Error", "Please enter a business website.");
    reportOutput.innerHTML = "";
    return;
  }

  setStatus("Working...", "Generating client pre-research report.");
  reportOutput.innerHTML = `<div class="report-loading">Researching website and building report...</div>`;
  generateBtn.disabled = true;

  try {
    const response = await fetch(workerEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ website })
    });

    const data = await response.json();

    if (!response.ok || data.status !== "success") {
      throw new Error(data.message || data.error || "Worker request failed.");
    }

    setStatus("Complete.", data.version || "4.1.1");
    reportOutput.innerHTML = renderMarkdown(data.report);

  } catch (error) {
    setStatus("Error", error.message);
    reportOutput.innerHTML = `
      <div class="report-error">
        <strong>Something went wrong:</strong><br><br>
        ${escapeHtml(error.message)}
      </div>
    `;
  } finally {
    generateBtn.disabled = false;
  }
});

function setStatus(title, message) {
  if (!statusBar) return;

  statusBar.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(message)}</span>
  `;
}

function renderMarkdown(markdown) {
  if (!markdown) return "";

  let html = escapeHtml(markdown);

  html = html
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>");

  const lines = html.split("\n");
  let output = "";
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (inList) {
        output += "</ul>";
        inList = false;
      }
      continue;
    }

    if (trimmed.startsWith("- ")) {
      if (!inList) {
        output += "<ul>";
        inList = true;
      }
      output += `<li>${trimmed.substring(2)}</li>`;
      continue;
    }

    if (inList) {
      output += "</ul>";
      inList = false;
    }

    if (
      trimmed.startsWith("<h1>") ||
      trimmed.startsWith("<h2>") ||
      trimmed.startsWith("<h3>")
    ) {
      output += trimmed;
    } else {
      output += `<p>${trimmed}</p>`;
    }
  }

  if (inList) {
    output += "</ul>";
  }

  return `<article class="rendered-report">${output}</article>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
