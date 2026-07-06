/* =========================================================
   Global Concepts Media Operating System
   Version 5.3.0
   File: app.js
   Purpose: Dashboard controller with functional Business Record tabs
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

  setStatus("Working...", "Researching website and building intelligence record.");
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

    setStatus("Complete.", data.version || "5.3.0");
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

  if (activeTab === "overview") {
    reportOutput.innerHTML = renderOverview(currentBusinessRecord);
    return;
  }

  if (activeTab === "services") {
    reportOutput.innerHTML = renderServices(currentBusinessRecord);
    return;
  }

  if (activeTab === "trust") {
    reportOutput.innerHTML = renderTrust(currentBusinessRecord);
    return;
  }

  if (activeTab === "growth") {
    reportOutput.innerHTML = renderGrowth(currentBusinessRecord);
    return;
  }

  if (activeTab === "outreach") {
    reportOutput.innerHTML = renderOutreach(currentBusinessRecord);
    return;
  }

  reportOutput.innerHTML = renderMarkdown(currentReport);
}

function renderOverview(record) {
  const business = record.business || {};
  const website = record.websiteIntelligence || {};
  const sales = record.salesIntelligence || {};

  return `
    <article class="rendered-report">
      <h1>Overview</h1>

      <h2>Business Summary</h2>
      <p>${escapeHtml(business.summary || "Unknown")}</p>

      <h2>Target Customer</h2>
      <p>${escapeHtml(website.targetCustomer || "Unknown")}</p>

      <h2>Geographic Market</h2>
      <p>${escapeHtml(website.geographicMarket || business.market || "Unknown")}</p>

      <h2>Outreach Readiness</h2>
      <p>${escapeHtml(sales.outreachReadiness || "Unknown")}</p>

      <h2>Readiness Score</h2>
      <p><strong>${escapeHtml(sales.readinessScore || "Pending")}</strong></p>
    </article>
  `;
}

function renderServices(record) {
  const website = record.websiteIntelligence || {};

  return `
    <article class="rendered-report">
      <h1>Services</h1>

      <h2>Products and Services</h2>
      ${renderList(website.productsAndServices)}

      <h2>Observable Capabilities</h2>
      <p>${escapeHtml(website.targetCustomer || "Unknown")}</p>
    </article>
  `;
}

function renderTrust(record) {
  const website = record.websiteIntelligence || {};

  return `
    <article class="rendered-report">
      <h1>Trust</h1>

      <h2>Trust Signals</h2>
      ${renderList(website.trustSignals)}

      <h2>Missing Trust Information</h2>
      ${renderList(website.missingInformation)}
    </article>
  `;
}

function renderGrowth(record) {
  const website = record.websiteIntelligence || {};

  return `
    <article class="rendered-report">
      <h1>Growth</h1>

      <h2>Growth Opportunities</h2>
      ${renderList(website.growthOpportunities)}

      <h2>Website Observations</h2>
      ${renderList(website.websiteObservations)}

      <h2>Missing Information</h2>
      ${renderList(website.missingInformation)}
    </article>
  `;
}

function renderOutreach(record) {
  const sales = record.salesIntelligence || {};

  return `
    <article class="rendered-report">
      <h1>Outreach</h1>

      <h2>Recommended Opening</h2>
      <p>${escapeHtml(sales.recommendedOpening || "Unknown")}</p>

      <h2>First Contact Notes</h2>
      ${renderList(sales.firstContactNotes)}

      <h2>Why They Might Hire GCM</h2>
      ${renderList(sales.whyTheyMightHireGCM)}
    </article>
  `;
}

function populateSnapshot(businessRecord) {
  const business = businessRecord?.business || {};
  const website = businessRecord?.websiteIntelligence || {};
  const sales = businessRecord?.salesIntelligence || {};

  if (snapshotCompany) {
    snapshotCompany.textContent = business.name || "Unknown";
  }

  if (snapshotIndustry) {
    snapshotIndustry.textContent = business.industry || "Unknown";
  }

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

    if (buttonTab === tabName) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
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
      ${items.map(function (item) {
        return `<li>${escapeHtml(item)}</li>`;
      }).join("")}
    </ul>
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
