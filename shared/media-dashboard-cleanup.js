/* =========================================================
   Global Concepts Media Operating System
   File: shared/media-dashboard-cleanup.js
   Version: 1.0.0
   Status: Production Candidate
   Sprint: Media Dashboard Simplification
   Purpose: Keep the Media Operator Workspace focused on current operating
            decisions by removing the explanatory Creative + Production
            Workflow strip from the dashboard. The full stage workflow remains
            on media-production.html where the work is actually performed.

   Production rules:
   - UI-only enhancement; no D1 writes occur here.
   - Does not remove Creative Production functionality.
   - Does not alter Campaign + Creative Queue, priority decisions, filters,
     summary cards, running placements, or Planning Intelligence.
   ========================================================= */

(() => {
  "use strict";

  const VERSION = "1.0.0";

  function removeWorkflowStrip() {
    const heading = [...document.querySelectorAll("h2")].find(node =>
      String(node.textContent || "").trim().toLowerCase() === "creative + production workflow"
    );
    if (!heading) return false;

    const section = heading.closest(".panel") || heading.closest("section");
    if (!section) return false;

    section.remove();
    return true;
  }

  function start() {
    removeWorkflowStrip();
    setTimeout(removeWorkflowStrip, 400);
    setTimeout(removeWorkflowStrip, 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(start, 0), { once: true });
  } else {
    setTimeout(start, 0);
  }

  console.info(`Media Dashboard Cleanup ${VERSION} loaded.`);
})();
