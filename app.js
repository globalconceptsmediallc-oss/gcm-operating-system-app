/* =========================================================
   Global Concepts Media Operating System
   Version 3A Foundation
   File: app.js
   Purpose: Display the Worker report-first response
   ========================================================= */

const workerEndpoint = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";

const form = document.getElementById("researchForm");
const websiteInput = document.getElementById("websiteUrl");
const submitButton = document.getElementById("generateBtn");

const statusBar = document.getElementById("statusBar");
const errorBox = document.getElementById("errorBox");
const dashboard = document.getElementById("dashboard");

const tabs = document.querySelectorAll(".tab-button");
const panels = document.querySelectorAll(".tab-panel");

function setStatus(message) {
  if (!statusBar) return;
  statusBar.textContent = message;
  statusBar.classList.add("active");
}

function clearStatus() {
  if (!statusBar) return;
  statusBar.textContent = "";
  statusBar.classList.remove("active");
}

function showError(message) {
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.add("active");
}

function clearError() {
  if (!errorBox) return;
  errorBox.textContent = "";
  errorBox.classList.remove("active");
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = value || "Unknown";
}

function activateTab(tabName) {
  tabs.forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });

  panels.forEach(panel => {
    panel.classList.toggle("active", panel.id === tabName);
  });
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    activateTab(tab.dataset.tab);
  });
});

async function generateBusinessIntelligence(websiteUrl) {
  const response = await fetch(workerEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      website: websiteUrl
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "The Business Intelligence request failed.");
  }

  return data;
}

function renderReport(data) {
  const website = data.website || websiteInput.value.trim();
  const report = data.report || "No report returned.";

  setText("businessName", "Client Pre-Research Report");
  setText("businessWebsite", website);

  setText("qualificationScore", "Report");
  setText("outreachReadiness", "Review Report");
  setText("targetCustomer", "See report");
  setText("geographicMarket", "See report");

  setText("businessSummary", report);
  setText("productsServices", report);
  setText("trustSignals", report);
  setText("websiteObservations", report);
  setText("growthOpportunities", report);
  setText("missingInformation", report);
  setText("personalizedInsights", report);
  setText("firstContactEmail", "Not included in Version 3A.");
  setText("discoveryCallScript", "Not included in Version 3A.");
  setText("verificationChecklist", report);
  setText("businessRecord", report);

  if (dashboard) {
    dashboard.classList.remove("hidden");
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const websiteUrl = websiteInput.value.trim();

  if (!websiteUrl) {
    showError("Enter a business website URL.");
    return;
  }

  clearError();
  setStatus("Generating client pre-research report...");
  submitButton.disabled = true;
  submitButton.textContent = "Generating...";

  try {
    const data = await generateBusinessIntelligence(websiteUrl);
    renderReport(data);
    activateTab("brief");
    setStatus("Client pre-research report generated.");
  } catch (error) {
    console.error(error);
    showError(error.message || "Something went wrong.");
    clearStatus();
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Generate Business Intelligence";
  }
});
