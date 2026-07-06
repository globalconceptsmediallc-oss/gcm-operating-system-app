/* =========================================================
   Global Concepts Media Operating System
   Version 5.3.1
   File: app.js
   Purpose: Functional Client Intelligence tabs from Business Record
   ========================================================= */

const workerEndpoint = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";

const form = document.getElementById("researchForm");
const websiteInput = document.getElementById("websiteUrl");
const generateBtn = document.getElementById("generateBtn");
const statusBar = document.getElementById("statusBar");
const reportOutput = document.getElementById("reportOutput");

const snapshotCompany = document.getElementById("snapshotCompany");
const snapshotIndustry = document.getElementById("snapshotIndustry");
const snapshotMarket = document.getElementById("snapshotMarket");
const snapshotReadiness = document.getElementById("snapshotReadiness");
const workerVersion = document.getElementById("workerVersion");

const tabButtons = document.querySelectorAll(".tab-button");

let currentBusinessRecord = null;
let currentReport = "";
let activeTab = "overview";

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const website = websiteInput.value.trim();

  if (!website) {
    setStatus("Error", "Please enter a business website.");
    reportOutput.innerHTML = "";
    return;
  }

  setStatus("Working...", "Researching website and building client intelligence.");
  reportOutput.innerHTML = `<div class="report-loading">Generating client intelligence...</div>`;
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

    currentBusinessRecord = data.businessRecord || null;
    currentReport = data.report || "";

    setStatus("Complete.", data.version || "5.3.1");
    populateSnapshot(currentBusinessRecord);
    updateDeveloperStatus(data);

    activeTab = "overview";
    setActiveTabButton(activeTab);
    renderActiveTab();

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

tabButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    activeTab = normalizeTabName(button.textContent);
    setActiveTabButton(activeTab);
    renderActiveTab();
  });
});

function renderActiveTab() {
  if (!currentBusinessRecord) {
    reportOutput.innerHTML = `
      <div class="empty-state">
        Generate a report to populate the dashboard.
      </div>
    `;
    return;
  }

  const renderers = {
    overview: renderOverview,
    services: renderServices,
    trust: renderTrust,
    growth: renderGrowth,
    outreach: renderOutreach
  };

  const renderer = renderers[activeTab] || renderOverview;
  reportOutput.innerHTML = renderer(currentBusinessRecord);
}

function renderOverview(record) {
  const business = record.business || {};
  const website = record.websiteIntelligence || {};
  const sales = record.salesIntelligence || {};

  return `
    <article class="rendered-report">
      <h1>Overview</h1>

      ${section("Business Summary", business.summary)}
      ${section("Target Customer", website.targetCustomer)}
      ${section("Geographic Market", website.geographicMarket || business.market)}
      ${section("Outreach Readiness", sales.outreachReadiness)}
      ${section("Readiness Score", sales.readinessScore)}
    </article>
  `;
}

function renderServices(record) {
  const website = record.websiteIntelligence || {};

  return `
    <article class="rendered-report">
      <h1>Services</h1>

      ${listSection("Products and Services", website.productsAndServices)}
      ${section("Target Customer Fit", website.targetCustomer)}
      ${section("Geographic Service Area", website.geographicMarket)}
    </article>
  `;
}

function renderTrust(record) {
  const website = record.websiteIntelligence || {};

  return `
    <article class="rendered-report">
      <h1>Trust</h1>

      ${listSection("Trust Signals", website.trustSignals)}
      ${listSection("Missing Trust Information", website.missingInformation)}
    </article>
  `;
}

function renderGrowth(record) {
  const website = record.websiteIntelligence || {};

  return `
    <article class="rendered-report">
      <h1>Growth</h1>

      ${listSection("Growth Opportunities", website.growthOpportunities)}
      ${listSection("Website Observations", website.websiteObservations)}
      ${listSection("Missing Information", website.missingInformation)}
    </article>
  `;
}

function renderOutreach(record) {
  const sales = record.salesIntelligence || {};

  return `
    <article class="rendered-report">
      <h1>Outreach</h1>

      ${section("Recommended Opening", sales.recommendedOpening)}
      ${listSection("First Contact Notes", sales.firstContactNotes)}
      ${listSection("Why They Might Hire GCM", sales.whyTheyMightHireGCM)}
    </article>
  `;
}

function section(title, value) {
  return `
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(value || "Unknown")}</p>
  `;
}

function listSection(title, items) {
  return `
    <h2>${escapeHtml(title)}</h2>
    ${renderList(items)}
  `;
}

function populateSnapshot(businessRecord) {
  const business = businessRecord?.business || {};
  const website = businessRecord?.websiteIntelligence || {};
  const sales = businessRecord?.salesIntelligence || {};

  if (snapshotCompany) snapshotCompany.textContent = business.name || "Unknown";
  if (snapshotIndustry) snapshotIndustry.textContent = business.industry || "Unknown";

  if (snapshotMarket) {
    snapshotMarket.textContent =
      business.market ||
      website.geographicMarket ||
      "Unknown";
  }

  if (snapshotReadiness) {
    snapshotReadiness.textContent = sales.readinessScore || "Pending";
  }
}

function updateDeveloperStatus(data) {
  if (workerVersion) {
    workerVersion.textContent = data.version || "Unknown";
  }
}

function setActiveTabButton(tabName) {
  tabButtons.forEach(function (button) {
    const buttonTab = normalizeTabName(button.textContent);
    button.classList.toggle("active", buttonTab === tabName);
  });
}

function normalizeTabName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function setStatus(title, message) {
  if (!statusBar) return;

  statusBar.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(message)}</span>
  `;
}

function renderList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "<ul><li>Unknown</li></ul>";
  }

  return `
    <ul>
      ${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
