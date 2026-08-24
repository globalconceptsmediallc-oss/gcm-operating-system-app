/* =========================================================
   Global Concepts Media Operating System
   File: shared/prospect-next-action.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Purpose: Expose the existing Prospect CRM set_next_action operation from
            the formal Prospect relationship workspace.

   Change Notes — 1.0.0
   - Adds Set Next Action beside the existing Prospect relationship controls.
   - Prefills the current action and due date before replacement.
   - Updates only the durable dated Next Action; it does not create a contact,
     change Prospect stage, record a proposal, or create Work.
   - Refreshes the pipeline and highest-value prospect card after save.
   ========================================================= */

(() => {
  "use strict";

  const FILE_VERSION = "1.0.0";
  const WORKER =
    "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";

  let currentProspectId = 0;
  let observer = null;

  const clean = value => String(value ?? "").trim();

  async function crm(operation, payload = {}) {
    const response = await fetch(WORKER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "prospect-crm", operation, ...payload })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.ok !== true) {
      throw new Error(data?.error || `CRM HTTP ${response.status}`);
    }

    return data;
  }

  function setSystemState(message) {
    const state = document.getElementById("system-state");
    if (state) state.textContent = message;
  }

  function rememberProspectFromClick(event) {
    const open = event.target.closest?.("[data-open-prospect]");
    if (open) {
      currentProspectId = Number(open.dataset.openProspect) || 0;
      return;
    }

    const priority = event.target.closest?.("#priority-open");
    if (priority?.dataset?.kind === "prospect") {
      currentProspectId = Number(priority.dataset.id) || 0;
    }
  }

  async function resolveCurrentProspectId() {
    if (currentProspectId > 0) return currentProspectId;

    const businessName = clean(document.getElementById("prospect-title")?.textContent);
    if (!businessName || businessName === "Prospect" || businessName === "Loading…") {
      throw new Error("Open the Prospect record again, then set its Next Action.");
    }

    const data = await crm("list_prospects");
    const matches = (data.prospects || []).filter(
      prospect => clean(prospect.businessName).toLowerCase() === businessName.toLowerCase()
    );

    if (matches.length !== 1) {
      throw new Error("The open Prospect could not be uniquely matched. Close and reopen the record.");
    }

    currentProspectId = Number(matches[0].id) || 0;
    return currentProspectId;
  }

  function ensureDialog() {
    let dialog = document.getElementById("gcm-prospect-next-action-dialog");
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "gcm-prospect-next-action-dialog";
    dialog.innerHTML = `
      <form id="gcm-prospect-next-action-form">
        <div class="modal-head">
          <div>
            <h2>Set Next Action</h2>
            <p>Replace the current dated action without creating a new contact or changing the Prospect stage.</p>
          </div>
          <button class="modal-close" type="button" data-gcm-next-close aria-label="Close">×</button>
        </div>
        <div class="modal-body">
          <div class="error" id="gcm-prospect-next-action-error" hidden></div>
          <input type="hidden" name="prospectId" />
          <div class="form-grid">
            <div class="field span-2">
              <label>Next Action *</label>
              <input class="input" name="title" required />
            </div>
            <div class="field">
              <label>Due Date *</label>
              <input class="input" type="date" name="dueDate" required />
            </div>
          </div>
          <div class="note">This replaces only the current CRM Next Action. Relationship history, stage, proposal status, and services remain unchanged.</div>
          <div class="form-actions">
            <button class="btn btn-secondary" type="button" data-gcm-next-close>Cancel</button>
            <button class="btn btn-primary" type="submit">Save Next Action</button>
          </div>
        </div>
      </form>`;

    document.body.appendChild(dialog);
    dialog.querySelectorAll("[data-gcm-next-close]").forEach(button => {
      button.addEventListener("click", () => dialog.close?.());
    });

    dialog.querySelector("form").addEventListener("submit", saveNextAction);
    return dialog;
  }

  function formattedDue(dueDate) {
    const label = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(`${dueDate}T12:00:00`));

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());

    if (dueDate < today) return `Overdue · ${label}`;
    if (dueDate === today) return `Due today · ${label}`;
    return `Due ${label}`;
  }

  function updateOpenDetail(title, dueDate) {
    const cards = [...document.querySelectorAll("#prospect-body .detail-card")];

    for (const card of cards) {
      const key = clean(card.querySelector("span")?.textContent);
      const value = card.querySelector("strong");
      if (!value) continue;
      if (key === "Next Action") value.textContent = title;
      if (key === "Due") value.textContent = formattedDue(dueDate);
    }
  }

  async function saveNextAction(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const error = document.getElementById("gcm-prospect-next-action-error");
    const values = Object.fromEntries(new FormData(form).entries());

    error.hidden = true;
    setSystemState("Saving Next Action…");

    try {
      const data = await crm("set_next_action", {
        prospectId: Number(values.prospectId),
        actionType: "follow_up",
        title: values.title,
        dueDate: values.dueDate
      });

      currentProspectId = Number(data.prospect?.id || values.prospectId) || currentProspectId;
      updateOpenDetail(clean(values.title), clean(values.dueDate));
      document.getElementById("gcm-prospect-next-action-dialog")?.close?.();
      document.getElementById("refresh")?.click();
      setSystemState("Next Action saved");
    } catch (saveError) {
      error.textContent = saveError.message;
      error.hidden = false;
      setSystemState("Next Action save failed");
    }
  }

  async function openNextActionEditor() {
    const dialog = ensureDialog();
    const form = dialog.querySelector("form");
    const error = document.getElementById("gcm-prospect-next-action-error");

    error.hidden = true;
    setSystemState("Loading Next Action…");

    try {
      const prospectId = await resolveCurrentProspectId();
      const data = await crm("get_prospect", { prospectId });
      const prospect = data.prospect || {};

      form.elements.prospectId.value = prospectId;
      form.elements.title.value = prospect.nextAction?.title || "";
      form.elements.dueDate.value = prospect.nextAction?.dueDate || "";
      dialog.showModal?.();
      setSystemState(`D1 connected · CRM ${data.prospectCrmVersion || "1.2.0"}`);
      form.elements.title.focus();
    } catch (loadError) {
      setSystemState("Next Action unavailable");
      alert(loadError.message);
    }
  }

  function ensureButton() {
    const detail = document.getElementById("prospect-detail");
    const body = document.getElementById("prospect-body");
    if (!detail || detail.hidden || !body) return;

    const actions = body.querySelector(".quick-actions");
    if (!actions || actions.querySelector("[data-gcm-prospect-next-action]")) return;

    const button = document.createElement("button");
    button.className = "btn btn-secondary btn-small";
    button.type = "button";
    button.dataset.gcmProspectNextAction = "1";
    button.textContent = "Set Next Action";
    button.addEventListener("click", openNextActionEditor);

    const recordContact = actions.querySelector('[data-prospect-action="activity"]');
    if (recordContact?.nextSibling) actions.insertBefore(button, recordContact.nextSibling);
    else actions.appendChild(button);
  }

  function start() {
    if (!document.getElementById("prospect-body")) return;

    document.addEventListener("click", rememberProspectFromClick, true);
    ensureDialog();
    ensureButton();

    observer = new MutationObserver(ensureButton);
    observer.observe(document.getElementById("prospect-detail"), {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden"]
    });

    console.info(`GCM Prospect Next Action ${FILE_VERSION} loaded.`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
