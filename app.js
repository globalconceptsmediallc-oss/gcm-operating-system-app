/* =========================================================
   GCM OS Version 4
   File: app.js
   Purpose: Display report or debug response
   Build: V4.0.0 Debug 002
   ========================================================= */

const WORKER_URL =
  "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";

const form = document.getElementById("researchForm");
const websiteInput = document.getElementById("websiteUrl");
const generateBtn = document.getElementById("generateBtn");
const statusBar = document.getElementById("statusBar");
const reportOutput = document.getElementById("reportOutput");
const workerVersion = document.getElementById("workerVersion");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const website = websiteInput.value.trim();

  if (!website) {
    setStatus("Please enter a website.");
    return;
  }

  generateBtn.disabled = true;
  setStatus("Generating report...");
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

    workerVersion.textContent =
      data.version || "Worker version not supplied";

    /* ---------- DEBUG MODE ---------- */

    if (data.status === "debug") {
      setStatus("Debug response received.");

      reportOutput.textContent = JSON.stringify(data, null, 2);

      generateBtn.disabled = false;
      return;
    }

    /* ---------- NORMAL MODE ---------- */

    if (!response.ok) {
      throw new Error(data.message || "Worker request failed.");
    }

    if (!data.report) {
      throw new Error("Worker did not return a report.");
    }

    reportOutput.textContent = data.report;

    setStatus("Complete.");
  } catch (error) {
    setStatus("Error");

    reportOutput.textContent =
`Something went wrong:

${error.message}`;
  }

  generateBtn.disabled = false;
});

function setStatus(message) {
  statusBar.textContent = message;
}
