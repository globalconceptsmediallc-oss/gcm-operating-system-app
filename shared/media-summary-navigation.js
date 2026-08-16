/* =========================================================
   Global Concepts Media Operating System
   File: shared/media-summary-navigation.js
   Version: 1.0.0
   Status: Production Candidate
   Sprint: Media Natural Workflow Navigation
   Purpose: Keep the Media summary focused on current work, make the top
            operating cards navigate directly to the work they summarize,
            and preserve historical placements as Planning Intelligence.

   Production rules:
   - Read-only UI enhancement; no D1 writes occur here.
   - Needs Action remains owned by media-needs-action.js.
   - In Production / Upcoming navigates to the production queue.
   - Running navigates to the running lane.
   - History is removed from the top operating KPI row, not deleted.
   - Historical records remain available as next-year / seasonal planning intelligence.
   ========================================================= */

(() => {
  "use strict";

  const VERSION = "1.0.0";
  const $ = id => document.getElementById(id);

  function summaryCards() {
    return [...document.querySelectorAll(".summary > article")];
  }

  function cardByLabel(label) {
    return summaryCards().find(card =>
      String(card.querySelector("span")?.textContent || "").trim().toLowerCase() === label.toLowerCase()
    ) || null;
  }

  function headingByText(words) {
    const wanted = words.map(word => word.toLowerCase());
    return [...document.querySelectorAll("h2")].find(node => {
      const text = String(node.textContent || "").trim().toLowerCase();
      return wanted.every(word => text.includes(word));
    }) || null;
  }

  function expandSectionFor(node) {
    if (!node) return;
    const panel = node.closest(".panel") || node.closest("section") || node.parentElement;
    const toggle = panel?.querySelector?.(".section-toggle");
    if (!toggle) return;
    const targetId = toggle.getAttribute("data-target");
    const target = targetId ? $(targetId) : null;
    if (toggle.getAttribute("aria-expanded") === "false") {
      toggle.setAttribute("aria-expanded", "true");
      if (target) target.hidden = false;
    }
  }

  function expandLane(laneId) {
    const lane = $(laneId);
    if (!lane) return;
    const toggle = lane.closest(".lane")?.querySelector(".lane-toggle") || lane.parentElement?.querySelector?.(".lane-toggle");
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", "true");
    lane.hidden = false;
  }

  function scrollToNode(node) {
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function queueTarget() {
    const heading = headingByText(["campaign", "creative", "queue"]);
    return heading?.closest(".panel") || heading || $("lane-preparing")?.closest(".panel") || $("lane-preparing");
  }

  function planningTarget() {
    const heading = headingByText(["historical", "planning"])
      || headingByText(["planning", "intelligence"])
      || [...document.querySelectorAll("h2")].find(node => /history|historical/i.test(node.textContent || ""));
    return heading?.closest(".panel") || heading || null;
  }

  function makeNavigable(card, actionLabel, handler) {
    if (!card || card.classList.contains("gcm-summary-nav-ready")) return;
    card.classList.add("gcm-summary-nav-ready");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.dataset.summaryActionLabel = actionLabel;
    card.title = actionLabel;
    card.addEventListener("click", event => {
      if (event.target.closest("button,a,input,select,textarea")) return;
      handler();
    });
    card.addEventListener("keydown", event => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      handler();
    });
  }

  function configureProductionCard() {
    const card = cardByLabel("In Production / Upcoming");
    makeNavigable(card, "Open production and upcoming work", () => {
      const target = queueTarget();
      expandSectionFor(target);
      expandLane("lane-preparing");
      expandLane("lane-ready");
      setTimeout(() => scrollToNode(target || $("lane-preparing")), 80);
    });
  }

  function configureRunningCard() {
    const card = cardByLabel("Running");
    makeNavigable(card, "Open running placements", () => {
      const lane = $("lane-running");
      const target = lane?.closest(".panel") || queueTarget();
      expandSectionFor(target);
      expandLane("lane-running");
      setTimeout(() => scrollToNode(lane || target), 80);
    });
  }

  function configureHistoryAsPlanning() {
    const historyCard = cardByLabel("History");
    if (historyCard) historyCard.hidden = true;

    const summary = document.querySelector(".summary");
    if (summary) summary.classList.add("gcm-summary-three");

    const planning = planningTarget();
    if (!planning) return;
    const heading = planning.querySelector?.("h2") || (planning.matches?.("h2") ? planning : null);
    if (heading && /historical|history/i.test(heading.textContent || "")) heading.textContent = "Planning Intelligence";
    const paragraph = heading?.parentElement?.querySelector?.("p") || planning.querySelector?.(".title-wrap p");
    if (paragraph) paragraph.textContent = "Past placements preserved for next-year, seasonal, market, and campaign planning.";
  }

  function injectStyles() {
    if ($("gcm-media-summary-navigation-styles")) return;
    const style = document.createElement("style");
    style.id = "gcm-media-summary-navigation-styles";
    style.textContent = `
      .summary.gcm-summary-three{grid-template-columns:repeat(3,minmax(0,1fr))}
      .gcm-summary-nav-ready{cursor:pointer;position:relative;transition:border-color .15s ease,transform .15s ease,box-shadow .15s ease}
      .gcm-summary-nav-ready:hover{border-color:#aac4eb;transform:translateY(-1px);box-shadow:0 10px 22px rgba(31,104,216,.1)}
      .gcm-summary-nav-ready:focus-visible{outline:3px solid rgba(31,104,216,.24);outline-offset:2px}
      .gcm-summary-nav-ready:after{content:attr(data-summary-action-label) " ↓";display:block;margin-top:10px;color:#1f68d8;font-size:.68rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em}
      @media(max-width:800px){.summary.gcm-summary-three{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function reconcile() {
    injectStyles();
    configureProductionCard();
    configureRunningCard();
    configureHistoryAsPlanning();
  }

  function start() {
    reconcile();
    setTimeout(reconcile, 500);
    setTimeout(reconcile, 1400);
    document.addEventListener("click", event => {
      if (event.target?.id === "refresh") setTimeout(reconcile, 700);
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(start, 0), { once: true });
  } else {
    setTimeout(start, 0);
  }

  console.info(`Media Summary Navigation ${VERSION} loaded.`);
})();
