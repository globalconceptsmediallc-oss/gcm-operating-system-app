/* =========================================================
   Global Concepts Media Operating System
   Version 5.4.1
   File: app.js
   Purpose: Display Business Record + Contact Enrichment + Consulting Intelligence
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

  setStatus("Working...", "Researching website and building consulting intelligence.");
  reportOutput.innerHTML = `<div class="report-loading">Generating consulting intelligence...</div>`;
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

    setStatus("Complete.", data.version || "Unknown");
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
  const consulting = record.consultingIntelligence || {};

  return `
    <article class="rendered-report">
      <h1>Overview</h1>

      ${renderContactBrief(record)}
      ${section("Executive Summary", consulting.executiveSummary)}
      ${section("Business Summary", business.summary)}
      ${section("Target Customer", website.targetCustomer)}
      ${section("Geographic Market", website.geographicMarket || business.market)}
      ${section("Outreach Readiness", sales.outreachReadiness)}
      ${section("Readiness Score", sales.readinessScore)}
      ${section("Consulting Confidence", consulting.confidence)}
    </article>
  `;
}

function renderServices(record) {
  const website = record.websiteIntelligence || {};
  const consulting = record.consultingIntelligence || {};

  return `
    <article class="rendered-report">
      <h1>Services</h1>

      ${listSection("Products and Services", website.productsAndServices)}
      ${section("Target Customer Fit", website.targetCustomer)}
      ${section("Geographic Service Area", website.geographicMarket)}
      ${listSection("Recommended GCM Services", consulting.recommendedServices)}
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
  const consulting = record.consultingIntelligence || {};

  return `
    <article class="rendered-report">
      <h1>Growth</h1>

      ${listSection("Top Consulting Opportunities", consulting.topOpportunities)}
      ${listSection("Growth Opportunities", website.growthOpportunities)}
      ${listSection("Success Metrics", consulting.successMetrics)}
      ${listSection("Website Observations", website.websiteObservations)}
      ${listSection("Missing Information", website.missingInformation)}
    </article>
  `;
}

function renderOutreach(record) {
  const sales = record.salesIntelligence || {};
  const consulting = record.consultingIntelligence || {};

  return `
    <article class="rendered-report">
      <h1>Outreach</h1>

      ${renderContactBrief(record)}
      ${section("Recommended Opening", sales.recommendedOpening)}
      ${listSection("First Contact Notes", sales.firstContactNotes)}
      ${listSection("Why They Might Hire GCM", sales.whyTheyMightHireGCM)}
      ${listSection("Recommended GCM Services", consulting.recommendedServices)}
    </article>
  `;
}

function renderContactBrief(record) {
  const contact = record.contactEnrichment || {};

  return `
    <section class="consultant-contact-brief">
      <h2>Contact Enrichment</h2>

      <p><strong>Primary Contact:</strong> ${escapeHtml(contact.primaryContactName || "Unknown")}</p>
      <p><strong>Role / Clue:</strong> ${escapeHtml(contact.primaryContactRole || "Unknown")}</p>
      <p><strong>Email:</strong> ${renderLinkOrText(contact.primaryEmail, "email")}</p>
      <p><strong>Phone:</strong> ${renderLinkOrText(contact.primaryPhone, "phone")}</p>
      <p><strong>Contact Page:</strong> ${renderLinkOrText(contact.contactPage, "url")}</p>
      <p><strong>About Page:</strong> ${renderLinkOrText(contact.aboutPage, "url")}</p>
      <p><strong>Team Page:</strong> ${renderLinkOrText(contact.teamPage, "url")}</p>
      <p><strong>Contact Confidence:</strong> ${escapeHtml(contact.confidence || "Unknown")}</p>

      ${listSection("Contact Evidence Sources", contact.sources)}
      ${listSection("Additional Contact Clues", formatAdditionalContacts(contact.additionalContacts))}
    </section>
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
  const consulting = businessRecord?.consultingIntelligence || {};

  if (snapshotCompany) snapshotCompany.textContent = business.name || "Unknown";
  if (snapshotIndustry) snapshotIndustry.textContent = business.industry || "Unknown";

  if (snapshotMarket) {
    snapshotMarket.textContent =
      business.market ||
      website.geographicMarket ||
      "Unknown";
  }

  if (snapshotReadiness) {
    snapshotReadiness.textContent =
      sales.readinessScore ||
      consulting.confidence ||
      "Pending";
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
      ${items.map(item => `<li>${escapeHtml(formatListItem(item))}</li>`).join("")}
    </ul>
  `;
}

function formatAdditionalContacts(items) {
  if (!Array.isArray(items) || items.length === 0) return [];

  return items.map(function (item) {
    if (!item || typeof item !== "object") return String(item);

    const name = item.name || "Unknown";
    const role = item.role || "Unknown";
    const email = item.email || "Unknown";
    const phone = item.phone || "Unknown";
    const source = item.source || "Unknown";

    return `${name} | ${role} | ${email} | ${phone} | Source: ${source}`;
  });
}

function formatListItem(item) {
  if (item === null || item === undefined) return "Unknown";

  if (typeof item === "object") {
    return JSON.stringify(item);
  }

  return String(item);
}

function renderLinkOrText(value, type) {
  if (!value || value === "Unknown") return "Unknown";

  const clean = String(value).trim();

  if (type === "email" && clean.includes("@")) {
    return `<a href="mailto:${escapeHtml(clean)}">${escapeHtml(clean)}</a>`;
  }

  if (type === "phone") {
    const phoneDigits = clean.replace(/\D/g, "");
    if (phoneDigits.length >= 10) {
      return `<a href="tel:${escapeHtml(phoneDigits)}">${escapeHtml(clean)}</a>`;
    }
  }

  if (type === "url" && clean.startsWith("http")) {
    return `<a href="${escapeHtml(clean)}" target="_blank" rel="noopener noreferrer">${escapeHtml(clean)}</a>`;
  }

  return escapeHtml(clean);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
