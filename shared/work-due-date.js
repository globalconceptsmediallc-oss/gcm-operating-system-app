/* =========================================================
   Global Concepts Media Operating System
   File: shared/work-due-date.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Purpose: Add an optional durable Due Date control to Create Requested Work
            and pass that date into the existing create-requested-work action.

   Change Notes — 1.0.0:
   - Injects Due Date (Optional) into the existing requested-work form.
   - Does not require or invent a deadline.
   - Adds dueDate only to create-requested-work payloads.
   - Refreshes shared navigation urgency after a successful Work creation.
   - Does not alter Investigation, Work completion, or Proof behavior.
   ========================================================= */

(() => {
  "use strict";

  const FILE_VERSION = "1.0.0";
  const FIELD_ID = "requested-due-date";
  const INSTALL_ATTR = "data-gcm-work-due-date-installed";
  const originalFetch = window.fetch.bind(window);

  function installField() {
    if (!/\/work\.html$/i.test(location.pathname)) return false;

    const form = document.getElementById("requested-work-form");
    if (!form) return false;
    if (form.hasAttribute(INSTALL_ATTR)) return true;

    const priority = document.getElementById("requested-priority");
    const priorityContainer = priority?.closest("div");
    const grid = form.querySelector(".requested-work-grid");
    if (!grid || !priorityContainer) return false;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <label for="${FIELD_ID}">Due Date (Optional)</label>
      <input id="${FIELD_ID}" type="date" aria-describedby="${FIELD_ID}-help" />
      <div id="${FIELD_ID}-help" style="margin-top:5px;color:#66758a;font-size:.7rem;line-height:1.35">
        Use only for a real commitment or deadline. This date drives the Work navigation urgency signal.
      </div>
    `;

    grid.insertBefore(wrapper, priorityContainer);
    form.setAttribute(INSTALL_ATTR, FILE_VERSION);
    return true;
  }

  function dueDateValue() {
    return String(document.getElementById(FIELD_ID)?.value || "").trim();
  }

  function parseCreateRequestedWork(init) {
    if (!init || typeof init.body !== "string") return null;

    try {
      const payload = JSON.parse(init.body);
      if (payload?.action !== "create-requested-work") return null;
      return payload;
    } catch {
      return null;
    }
  }

  window.fetch = async function gcmWorkDueDateFetch(input, init) {
    const payload = parseCreateRequestedWork(init);
    let nextInit = init;

    if (payload) {
      payload.dueDate = dueDateValue() || null;
      nextInit = { ...init, body: JSON.stringify(payload) };
    }

    const response = await originalFetch(input, nextInit);

    if (payload && response.ok) {
      window.setTimeout(() => {
        try {
          window.GCMOShell?.refreshNavAttention?.();
        } catch {}
      }, 150);
    }

    return response;
  };

  function install() {
    if (installField()) return;

    const observer = new MutationObserver(() => {
      if (installField()) observer.disconnect();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    window.setTimeout(() => observer.disconnect(), 10000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
