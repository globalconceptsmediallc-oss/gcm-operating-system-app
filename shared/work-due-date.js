/* =========================================================
   Global Concepts Media Operating System
   File: shared/work-due-date.js
   Version: 1.0.1
   Status: Temporary Isolation Candidate
   Source: Production work-due-date.js 1.0.0
   Sprint: Work Navigation Safari Isolation
   Purpose: Temporarily disable the Work-only Due Date enhancement while
            isolating the Safari lock/navigation failure on work.html.

   Isolation changes — 1.0.1:
   - Does not wrap window.fetch.
   - Does not create a MutationObserver, inject fields, refresh nav attention,
     or alter Work page navigation behavior.
   - Preserves the production 1.0.0 implementation in Git history for restoration
     after the lock source is identified.
   - Does not modify D1, Worker routes, Investigations, Work Items, or Proof data.
   ========================================================= */

(() => {
  "use strict";
  console.info("GCM OS Work Due Date v1.0.1: temporarily disabled for Safari navigation isolation.");
})();
