/* =========================================================
   Global Concepts Media Operating System
   Version 2 Foundation
   File: app.js
   Purpose: Front-end dashboard logic
   ========================================================= */

const workerEndpoint = "./worker.js";

const form = document.getElementById("researchForm");
const websiteInput = document.getElementById("websiteUrl");
const submitButton = document.getElementById("generateBtn");

const statusBar = document.getElementById("statusBar");
const errorBox = document.getElementById("errorBox");

const dashboard = document.getElementById("dashboard");
const tabs = document.querySelectorAll(".tab-button");
const panels = document.querySelectorAll(".tab-panel");

const fields = {
  businessName: "businessName",
  website: "businessWebsite",
  summary: "businessSummary",
  services: "productsServices",
  customer: "targetCustomer",
  market: "geographicMarket",
  trust: "trustSignals",
  websiteObservations: "websiteObservations",
  opportunities: "growthOpportunities",
  missingInfo: "missingInformation",
  score: "qualificationScore",
  readiness: "outreachReadiness",
  insights: "personalizedInsights",
  email: "firstContactEmail",
  script: "discoveryCallScript",
  checklist: "verificationChecklist",
  record: "businessRecord"
};

function setStatus(message) {
  statusBar.textContent = message;
  statusBar.classList.add("active");
}

function clearStatus() {
  statusBar.textContent = "";
  statusBar.classList.remove("active");
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.add("active");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.remove("active");
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = value || "Unknown";
}

function formatList(value) {
  if (!value) return "Unknown";

  if (Array.isArray(value)) {
    if (!value.length) return "Unknown";
    return value.map(item => `• ${item}`).join("\n");
  }

  return value;
}

function normalizeResponse(data) {
  return {
    businessName: data.businessName || data.business_name || "Unknown",
    website: data.website || data.websiteUrl || websiteInput.value,
    summary: data.businessSummary || data.business_summary || data.summary || "Unknown",
    services: data.productsServices || data.products_and_services || data.services || "Unknown",
    customer: data.targetCustomer || data.target_customer || "Unknown",
    market: data.geographicMarket || data.geographic_market || "Unknown",
    trust: data.trustSignals || data.trust_signals || "Unknown",
    websiteObservations: data.websiteObservations || data.website_observations || "Unknown",
    opportunities: data.growthOpportunities || data.growth_opportunities || "Unknown",
    missingInfo: data.missingInformation || data.missing_information || "Unknown",
    score: data.qualificationScore || data.qualification_score || "Unknown",
    readiness: data.outreachReadiness || data.outreach_readiness || "Unknown",
    insights: data.personalizedOutreachInsights || data.personalized_insights || data.insights || "Unknown",
    email: data.firstContactEmail || data.first_contact_email || "Unknown",
    script: data.discoveryCallScript || data.discovery_call_script || "Unknown",
    checklist: data.humanVerificationChecklist || data.verification_checklist || "Unknown",
    record: data.businessRecord || data.business_record || "Unknown"
  };
}

function renderDashboard(rawData) {
  const data = normalizeResponse(rawData);

  setText(fields.businessName, data.businessName);
  setText(fields.website, data.website);
  setText(fields.summary, data.summary);
  setText(fields.services, formatList(data.services));
  setText(fields.customer, data.customer);
  setText(fields.market, data.market);
  setText(fields.trust, formatList(data.trust));
  setText(fields.websiteObservations, formatList(data.websiteObservations));
  setText(fields.opportunities, formatList(data.opportunities));
  setText(fields.missingInfo, formatList(data.missingInfo));
  setText(fields.score, data.score);
  setText(fields.readiness, data.readiness);
  setText(fields.insights, formatList(data.insights));
  setText(fields.email, data.email);
  setText(fields.script, data.script);
  setText(fields.checklist, formatList(data.checklist));
  setText(fields.record, data.record);

  dashboard.classList.remove("hidden");
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
    body: JSON.stringify({ websiteUrl })
  });

  if (!response.ok) {
    throw new Error("The Business Intelligence request failed.");
  }

  return response.json();
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const websiteUrl = websiteInput.value.trim();

  if (!websiteUrl) {
    showError("Enter a business website URL.");
    return;
  }

  clearError();
  setStatus("Researching the business and generating the first contact package...");
  submitButton.disabled = true;
  submitButton.textContent = "Generating...";

  try {
    const data = await generateBusinessIntelligence(websiteUrl);
    renderDashboard(data);
    activateTab("brief");
    setStatus("Business Intelligence package generated.");
  } catch (error) {
    console.error(error);
    showError("Something went wrong. Check the Worker connection and AI provider settings.");
    clearStatus();
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Generate Business Intelligence";
  }
});
