/* =========================================================
   Global Concepts Media Operating System
   File: growth-review-renderer.js
   Version: 1.0.0
   Sprint: Growth Review HTML Renderer v1

   Purpose:
   Render a completed Growth Review Presentation Model as a
   polished, client-facing HTML report.

   Input:
   - Growth Review Presentation Model

   Output:
   - HTML inserted into a supplied DOM container

   This file does NOT:
   - Research websites
   - Fetch external information
   - Call AI
   - Calculate consulting intelligence
   - Generate PDFs
   - Modify the Presentation Model
   ========================================================= */

(function (globalScope) {
  "use strict";

  const RENDERER_NAME = "GCM Growth Review Renderer";
  const RENDERER_VERSION = "1.0.0";

  function renderGrowthReview(container, presentationModel) {
    const target = resolveContainer(container);
    validatePresentationModel(presentationModel);

    const model = clone(presentationModel);

    target.innerHTML = [
      renderStyles(),
      '<article class="gcm-review">',
      renderCover(model.cover),
      renderExecutiveBrief(model.executiveBrief),
      renderBusinessOverview(model.businessSnapshot),
      renderHealthScorecard(model.healthScorecard),
      renderKeyFindings(model.keyFindings),
      renderPriorityMatrix(model.priorityMatrix),
      renderRoadmap(model.roadmap),
      renderExpectedImpact(model.expectedImpact),
      renderImplementationOptions(model.implementationOptions),
      renderConsultantNotes(model.consultantNotes),
      renderAppendices(model.appendices),
      renderFooter(model),
      "</article>"
    ].join("");

    return {
      renderer: {
        name: RENDERER_NAME,
        version: RENDERER_VERSION
      },
      rendered: true,
      containerId: target.id || "",
      sectionCount: target.querySelectorAll("[data-gcm-section]").length
    };
  }

  function resolveContainer(container) {
    if (typeof container === "string") {
      const element = document.querySelector(container);

      if (!element) {
        throw new Error(
          `Growth Review Renderer could not find container: ${container}`
        );
      }

      return element;
    }

    if (container && container.nodeType === 1) {
      return container;
    }

    throw new TypeError(
      "Growth Review Renderer requires a DOM element or selector."
    );
  }

  function validatePresentationModel(model) {
    if (!isObject(model)) {
      throw new TypeError(
        "Growth Review Renderer requires a Presentation Model object."
      );
    }

    const requiredObjects = [
      "cover",
      "executiveBrief",
      "businessSnapshot",
      "healthScorecard",
      "keyFindings",
      "roadmap",
      "expectedImpact",
      "implementationOptions"
    ];

    requiredObjects.forEach(function (key) {
      if (!isObject(model[key])) {
        throw new Error(
          `Presentation Model is missing required section: ${key}`
        );
      }
    });

    return true;
  }

  function renderStyles() {
    return `
      <style>
        .gcm-review {
          --ink: #172033;
          --muted: #5f6b7a;
          --line: #dfe5ec;
          --panel: #ffffff;
          --soft: #f6f8fb;
          --accent: #0f5f4f;
          --accent-soft: #eaf6f2;
          --warning: #8a5a00;
          --danger: #8b2c2c;
          max-width: 1120px;
          margin: 0 auto;
          color: var(--ink);
          font-family: Inter, Arial, sans-serif;
          line-height: 1.6;
        }

        .gcm-review * {
          box-sizing: border-box;
        }

        .gcm-review h1,
        .gcm-review h2,
        .gcm-review h3,
        .gcm-review p {
          margin-top: 0;
        }

        .gcm-review__cover {
          padding: 64px 48px;
          border-radius: 24px;
          background: linear-gradient(135deg, #132338, #0f5f4f);
          color: #ffffff;
          box-shadow: 0 24px 60px rgba(23, 32, 51, 0.18);
        }

        .gcm-review__eyebrow {
          margin-bottom: 16px;
          font-size: 0.85rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          opacity: 0.82;
        }

        .gcm-review__cover h1 {
          max-width: 850px;
          margin-bottom: 18px;
          font-size: clamp(2.3rem, 6vw, 4.7rem);
          line-height: 1.02;
        }

        .gcm-review__cover-subtitle {
          max-width: 760px;
          margin-bottom: 36px;
          font-size: 1.15rem;
          opacity: 0.9;
        }

        .gcm-review__meta {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .gcm-review__meta-card {
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.08);
        }

        .gcm-review__meta-label,
        .gcm-review__label {
          display: block;
          margin-bottom: 5px;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.7;
        }

        .gcm-review__section {
          margin-top: 34px;
          padding: 34px;
          border: 1px solid var(--line);
          border-radius: 20px;
          background: var(--panel);
          box-shadow: 0 14px 40px rgba(23, 32, 51, 0.06);
        }

        .gcm-review__section-header {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .gcm-review__section h2 {
          margin-bottom: 0;
          font-size: 2rem;
          line-height: 1.15;
        }

        .gcm-review__lead {
          max-width: 780px;
          color: var(--muted);
        }

        .gcm-review__brief-grid,
        .gcm-review__two-column,
        .gcm-review__options,
        .gcm-review__findings {
          display: grid;
          gap: 18px;
        }

        .gcm-review__brief-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin: 24px 0;
        }

        .gcm-review__two-column {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .gcm-review__card {
          padding: 22px;
          border: 1px solid var(--line);
          border-radius: 16px;
          background: var(--soft);
        }

        .gcm-review__card h3 {
          margin-bottom: 10px;
          font-size: 1.05rem;
        }

        .gcm-review__score-wrap {
          display: flex;
          align-items: center;
          gap: 26px;
          flex-wrap: wrap;
        }

        .gcm-review__score {
          display: grid;
          place-items: center;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background: var(--accent-soft);
          border: 12px solid var(--accent);
          text-align: center;
        }

        .gcm-review__score strong {
          display: block;
          font-size: 2.5rem;
          line-height: 1;
        }

        .gcm-review__score span {
          display: block;
          font-size: 0.8rem;
          color: var(--muted);
        }

        .gcm-review__score-list {
          flex: 1;
          min-width: 280px;
        }

        .gcm-review__score-row {
          display: grid;
          grid-template-columns: 130px 1fr 50px;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }

        .gcm-review__bar {
          height: 10px;
          overflow: hidden;
          border-radius: 99px;
          background: #e3e8ee;
        }

        .gcm-review__bar span {
          display: block;
          height: 100%;
          background: var(--accent);
        }

        .gcm-review__findings {
          grid-template-columns: 1fr;
        }

        .gcm-review__finding {
          padding: 24px;
          border-left: 6px solid var(--accent);
          border-radius: 14px;
          background: var(--soft);
        }

        .gcm-review__finding-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 14px;
        }

        .gcm-review__badge-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .gcm-review__badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 10px;
          border-radius: 999px;
          background: #e8edf3;
          font-size: 0.78rem;
          font-weight: 800;
        }

        .gcm-review__badge--high {
          background: #fde8e8;
          color: var(--danger);
        }

        .gcm-review__badge--medium {
          background: #fff1d6;
          color: var(--warning);
        }

        .gcm-review__table-wrap {
          overflow-x: auto;
        }

        .gcm-review table {
          width: 100%;
          border-collapse: collapse;
        }

        .gcm-review th,
        .gcm-review td {
          padding: 14px 12px;
          border-bottom: 1px solid var(--line);
          text-align: left;
          vertical-align: top;
        }

        .gcm-review th {
          font-size: 0.76rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .gcm-review__phase {
          margin-top: 24px;
          padding: 24px;
          border: 1px solid var(--line);
          border-radius: 16px;
        }

        .gcm-review__phase h3 {
          margin-bottom: 6px;
        }

        .gcm-review__action {
          display: grid;
          grid-template-columns: 38px 1fr;
          gap: 14px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--line);
        }

        .gcm-review__action-number {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: var(--accent);
          color: #ffffff;
          font-weight: 800;
        }

        .gcm-review ul {
          margin: 10px 0 0;
          padding-left: 20px;
        }

        .gcm-review__options {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .gcm-review__option--recommended {
          border: 2px solid var(--accent);
          background: var(--accent-soft);
        }

        .gcm-review__footer {
          margin: 30px 0 0;
          padding: 26px 6px 50px;
          color: var(--muted);
          text-align: center;
          font-size: 0.9rem;
        }

        @media (max-width: 800px) {
          .gcm-review__cover,
          .gcm-review__section {
            padding: 26px 22px;
            border-radius: 16px;
          }

          .gcm-review__meta,
          .gcm-review__brief-grid,
          .gcm-review__two-column,
          .gcm-review__options {
            grid-template-columns: 1fr;
          }

          .gcm-review__score-row {
            grid-template-columns: 105px 1fr 42px;
          }

          .gcm-review__finding-head,
          .gcm-review__section-header {
            display: block;
          }
        }

        @media print {
          .gcm-review {
            max-width: none;
          }

          .gcm-review__cover,
          .gcm-review__section {
            break-inside: avoid;
            box-shadow: none;
          }

          .gcm-review__finding,
          .gcm-review__phase,
          .gcm-review__card {
            break-inside: avoid;
          }
        }
      </style>
    `;
  }

  function renderCover(cover) {
    return `
      <header class="gcm-review__cover" data-gcm-section="cover">
        <div class="gcm-review__eyebrow">${escapeHtml(cover.eyebrow)}</div>
        <h1>${escapeHtml(cover.title)}</h1>
        <p class="gcm-review__cover-subtitle">${escapeHtml(cover.subtitle)}</p>

        <div class="gcm-review__meta">
          ${renderMetaCard("Business", cover.businessName)}
          ${renderMetaCard("Industry", cover.industry)}
          ${renderMetaCard("Market", cover.geographicMarket)}
          ${renderMetaCard("Review Period", cover.reviewPeriod)}
        </div>
      </header>
    `;
  }

  function renderExecutiveBrief(section) {
    return `
      <section class="gcm-review__section" data-gcm-section="executive-brief">
        ${renderSectionHeader(section.sectionTitle)}
        <p class="gcm-review__lead">${escapeHtml(section.summary)}</p>

        <div class="gcm-review__brief-grid">
          ${safeArray(section.decisionSummary).map(function (item) {
            return `
              <div class="gcm-review__card">
                <span class="gcm-review__label">${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.value)}</strong>
              </div>
            `;
          }).join("")}
        </div>

        <div class="gcm-review__two-column">
          ${renderTextCard("Most Important Finding", section.mostImportantFinding)}
          ${renderTextCard("First Priority", section.firstPriority)}
        </div>
      </section>
    `;
  }

  function renderBusinessOverview(section) {
    return `
      <section class="gcm-review__section" data-gcm-section="business-overview">
        ${renderSectionHeader(section.sectionTitle)}

        <div class="gcm-review__two-column">
          <div>
            ${renderDefinition("Business", section.businessName)}
            ${renderDefinition("Website", section.website)}
            ${renderDefinition("Industry", section.industry)}
            ${renderDefinition("Market", section.geographicMarket)}
            ${renderDefinition("Target Customer", section.targetCustomer)}
          </div>

          <div>
            <p>${escapeHtml(section.businessSummary)}</p>
            ${renderListBlock("Products and Services", section.productsAndServices)}
          </div>
        </div>

        <div class="gcm-review__two-column" style="margin-top:18px;">
          ${renderListCard("Current Strengths", section.strengths)}
          ${renderListCard("Current Constraints", section.constraints)}
        </div>
      </section>
    `;
  }

  function renderHealthScorecard(section) {
    return `
      <section class="gcm-review__section" data-gcm-section="business-health">
        ${renderSectionHeader(section.sectionTitle)}

        <div class="gcm-review__score-wrap">
          <div class="gcm-review__score">
            <div>
              <strong>${escapeHtml(section.score)}</strong>
              <span>out of 100</span>
            </div>
          </div>

          <div class="gcm-review__score-list">
            <h3>${escapeHtml(section.rating)}</h3>
            <p class="gcm-review__lead">
              Strongest area: ${escapeHtml(section.strongestArea)} ·
              Weakest area: ${escapeHtml(section.weakestArea)}
            </p>

            ${safeArray(section.categories).map(function (item) {
              const width = Math.max(0, Math.min(100, Number(item.score) || 0));

              return `
                <div class="gcm-review__score-row">
                  <span>${escapeHtml(item.label)}</span>
                  <div class="gcm-review__bar"><span style="width:${width}%"></span></div>
                  <strong>${escapeHtml(item.score)}</strong>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderKeyFindings(section) {
    return `
      <section class="gcm-review__section" data-gcm-section="growth-leaks">
        ${renderSectionHeader(section.sectionTitle, section.introduction)}

        <div class="gcm-review__findings">
          ${safeArray(section.items).map(function (item) {
            return `
              <article class="gcm-review__finding">
                <div class="gcm-review__finding-head">
                  <div>
                    <span class="gcm-review__label">Finding ${escapeHtml(item.rank)}</span>
                    <h3>${escapeHtml(item.finding)}</h3>
                  </div>

                  <div class="gcm-review__badge-row">
                    ${renderBadge(item.category)}
                    ${renderBadge(item.priority, item.priority)}
                    ${renderBadge(`${item.effort} effort`)}
                  </div>
                </div>

                ${renderDefinition("Observable Evidence", item.evidence)}
                ${renderDefinition("Why It Matters", item.whyItMatters)}
                ${renderDefinition("Business Impact", item.businessImpact)}
                ${renderDefinition("Primary Recommendation", item.recommendation)}
                ${renderDefinition("Expected Outcome", item.expectedOutcome)}
                ${renderListBlock("Success Metrics", item.successMetrics)}
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderPriorityMatrix(section) {
    return `
      <section class="gcm-review__section" data-gcm-section="priority-matrix">
        ${renderSectionHeader(section.sectionTitle, section.introduction)}

        <div class="gcm-review__table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Finding</th>
                <th>Priority</th>
                <th>Effort</th>
                <th>Sequence</th>
              </tr>
            </thead>
            <tbody>
              ${safeArray(section.items).map(function (item) {
                return `
                  <tr>
                    <td>${escapeHtml(item.rank)}</td>
                    <td>
                      <strong>${escapeHtml(item.category)}</strong><br />
                      ${escapeHtml(item.finding)}
                    </td>
                    <td>${escapeHtml(item.priority)}</td>
                    <td>${escapeHtml(item.effort)}</td>
                    <td>${escapeHtml(item.sequence)}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderRoadmap(section) {
    return `
      <section class="gcm-review__section" data-gcm-section="roadmap">
        ${renderSectionHeader(section.sectionTitle, section.introduction)}

        ${safeArray(section.phases).map(function (phase) {
          return `
            <div class="gcm-review__phase">
              <h3>${escapeHtml(phase.displayTitle)}</h3>
              <p class="gcm-review__lead">${escapeHtml(phase.objective)}</p>

              ${
                safeArray(phase.actions).length > 0
                  ? safeArray(phase.actions).map(function (item) {
                      return `
                        <div class="gcm-review__action">
                          <div class="gcm-review__action-number">${escapeHtml(item.sequence)}</div>
                          <div>
                            <h3>${escapeHtml(item.action)}</h3>
                            <div class="gcm-review__badge-row">
                              ${renderBadge(item.category)}
                              ${renderBadge(item.priority, item.priority)}
                              ${renderBadge(`${item.effort} effort`)}
                            </div>
                            ${renderDefinition("Expected Outcome", item.expectedOutcome)}
                            ${renderDefinition("Completion Standard", item.completionStandard)}
                            ${renderListBlock("Success Metrics", item.successMetrics)}
                          </div>
                        </div>
                      `;
                    }).join("")
                  : '<p class="gcm-review__lead">No actions are currently assigned to this phase.</p>'
              }
            </div>
          `;
        }).join("")}
      </section>
    `;
  }

  function renderExpectedImpact(section) {
    return `
      <section class="gcm-review__section" data-gcm-section="business-impact">
        ${renderSectionHeader(section.sectionTitle)}

        <div class="gcm-review__two-column">
          ${renderTextCard("Near-Term Impact", section.nearTerm)}
          ${renderTextCard("Mid-Term Impact", section.midTerm)}
          ${renderTextCard("Long-Term Impact", section.longTerm)}
          ${renderTextCard("Revenue Formula", section.revenueFormula)}
        </div>

        <div style="margin-top:18px;">
          ${renderListBlock("Primary Impact Areas", section.impactAreas)}
          ${renderListBlock("Proof Requirements", section.proofRequirements)}
          ${renderDefinition("Revenue Statement", section.revenueStatement)}
          ${renderDefinition("Limitation", section.limitation)}
        </div>
      </section>
    `;
  }

  function renderImplementationOptions(section) {
    return `
      <section class="gcm-review__section" data-gcm-section="implementation-options">
        ${renderSectionHeader(section.sectionTitle, section.introduction)}

        <div class="gcm-review__options">
          ${safeArray(section.items).map(function (item) {
            return `
              <div class="gcm-review__card ${
                item.recommended ? "gcm-review__option--recommended" : ""
              }">
                ${
                  item.recommended
                    ? '<span class="gcm-review__badge">Recommended</span>'
                    : ""
                }
                <h3>${escapeHtml(item.option)}</h3>
                <p>${escapeHtml(item.description)}</p>
                ${renderDefinition("Best For", item.bestFor)}
                ${renderListBlock("Required Controls", item.requiredControls)}
              </div>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderConsultantNotes(section) {
    return `
      <section class="gcm-review__section" data-gcm-section="consultant-notes">
        ${renderSectionHeader(section.sectionTitle)}

        <div class="gcm-review__two-column">
          ${renderTextCard("Evidence Quality", section.evidenceQuality)}
          ${renderTextCard("Evidence Limitation", section.evidenceLimitation)}
        </div>

        <div style="margin-top:18px;">
          ${renderListBlock("Verification Required", section.verificationRequired)}
          ${renderListBlock("Consulting Principles", section.consultantPrinciples)}
        </div>
      </section>
    `;
  }

  function renderAppendices(section) {
    return `
      <section class="gcm-review__section" data-gcm-section="appendices">
        ${renderSectionHeader(section.sectionTitle)}
        <p class="gcm-review__lead">
          Supporting evidence, strategic themes, and verification details are retained in the structured Growth Review record.
        </p>
      </section>
    `;
  }

  function renderFooter(model) {
    return `
      <footer class="gcm-review__footer">
        ${escapeHtml(model.document.title)} ·
        Generated by Global Concepts Media
      </footer>
    `;
  }

  function renderSectionHeader(title, introduction) {
    return `
      <div class="gcm-review__section-header">
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${
            introduction
              ? `<p class="gcm-review__lead">${escapeHtml(introduction)}</p>`
              : ""
          }
        </div>
      </div>
    `;
  }

  function renderMetaCard(label, value) {
    return `
      <div class="gcm-review__meta-card">
        <span class="gcm-review__meta-label">${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function renderTextCard(title, value) {
    return `
      <div class="gcm-review__card">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(value)}</p>
      </div>
    `;
  }

  function renderListCard(title, items) {
    return `
      <div class="gcm-review__card">
        ${renderListBlock(title, items)}
      </div>
    `;
  }

  function renderListBlock(title, items) {
    const values = safeArray(items);

    if (values.length === 0) {
      return "";
    }

    return `
      <div>
        <h3>${escapeHtml(title)}</h3>
        <ul>
          ${values.map(function (item) {
            return `<li>${escapeHtml(item)}</li>`;
          }).join("")}
        </ul>
      </div>
    `;
  }

  function renderDefinition(label, value) {
    if (!value) {
      return "";
    }

    return `
      <p>
        <strong>${escapeHtml(label)}:</strong>
        ${escapeHtml(value)}
      </p>
    `;
  }

  function renderBadge(value, priority) {
    const normalized = String(priority || "").toLowerCase();
    let modifier = "";

    if (normalized === "high" || normalized === "critical") {
      modifier = " gcm-review__badge--high";
    } else if (normalized === "medium") {
      modifier = " gcm-review__badge--medium";
    }

    return `<span class="gcm-review__badge${modifier}">${escapeHtml(value)}</span>`;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const api = {
    RENDERER_NAME,
    RENDERER_VERSION,
    renderGrowthReview,
    validatePresentationModel
  };

  if (
    typeof module !== "undefined" &&
    module.exports
  ) {
    module.exports = api;
  }

  globalScope.GCMGrowthReviewRenderer = api;
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : window
);
