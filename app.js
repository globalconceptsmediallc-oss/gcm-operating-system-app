/* =========================================================
   GCM OS Version 4
   File: app.js
   Purpose: Send website to Worker and display Markdown report
   ========================================================= */

const WORKER_URL = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";

const form = document.getElementById("researchForm");
const websiteInput = document.getElementById("websiteUrl");
const generateBtn = document.getElementById("generateBtn");
const statusBar = document.getElementById("statusBar");
const reportOutput = document.getElementById("reportOutput");
const workerVersion = document.getElementById("workerVersion");

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const website = websiteInput.value.trim();

  if (!website) {
    setStatus("Please enter a website URL.");
    return;
  }

  setStatus("Generating report...");
  generateBtn.disabled = true;
  reportOutput.textContent = "";
  workerVersion.textContent = "";

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        website: website
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "Worker request failed.");
    }

    if (!data.report) {
      throw new Error("Worker did not return a report.");
    }

    reportOutput.textContent = data.report;

    workerVersion.textContent = data.version
      ? `Worker Version: ${data.version}`
      : "Worker Version: Not returned";

    setStatus("Complete.");

  } catch (error) {
    setStatus("Error.");
    reportOutput.textContent = `Something went wrong:\n\n${error.message}`;
  }

  generateBtn.disabled = false;
});

function setStatus(message) {
  statusBar.textContent = message;
}
