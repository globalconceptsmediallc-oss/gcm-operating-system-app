/* =========================================================
   Global Concepts Media Operating System
   File: shared/today-gmail-work-request.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Gmail — Direct Requested Work
   Purpose:
   Add the missing human-approved Requested Work control to Morning Command
   without rewriting the locked Today page.

   Change notes — v1.0.0:
   - Evaluates each Gmail preview card through the live Worker before showing a
     Work control.
   - Shows Create Requested Work only when the Worker proves a known human,
     verified client, and explicit concrete request.
   - Approval creates Communication + direct Work Item and no Investigation.
   - Removes the Gmail card only after D1 and Gmail read-state both succeed.
   - Refreshes Mission Control/nav attention after requested work is created.
   ========================================================= */

(() => {
  "use strict";

  const FILE_VERSION = "1.0.0";
  const WORKER_URL = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const EVALUATE_ACTION = "evaluate-gmail-work-request";
  const APPROVE_ACTION = "approve-gmail-work-request";
  const CARD_SELECTOR = ".gmail-message[data-gmail-id]";
  const CHECKED_ATTR = "data-gcm-work-request-checked";

  async function post(action, extra = {}) {
    const response = await fetch(WORKER_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/json", Accept:"application/json" },
      body:JSON.stringify({ action, ...extra })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
      throw new Error(
        typeof payload?.error === "string"
          ? payload.error
          : payload?.error?.message || `HTTP ${response.status}`
      );
    }
    return payload;
  }

  function setField(card, labelText, value) {
    if (!value) return;
    const label = [...card.querySelectorAll(".gmail-intelligence-label")]
      .find(node => String(node.textContent || "").trim().toLowerCase() === labelText.toLowerCase());
    const field = label?.closest(".gmail-intelligence-field");
    const target = field?.querySelector(".gmail-intelligence-value");
    if (target) target.textContent = value;
  }

  function addCandidatePill(card) {
    const row = card.querySelector(".gmail-decision-row");
    if (!row || row.querySelector(".gcm-work-candidate-pill")) return;
    const pill = document.createElement("span");
    pill.className = "gmail-decision yes gcm-work-candidate-pill";
    pill.textContent = "Work Candidate: Yes";
    row.appendChild(pill);
  }

  function setGlobalStatus(text) {
    const status = document.getElementById("gmail-status-copy");
    if (status) status.textContent = text;
  }

  function showEmptyIfNeeded(preview) {
    if (!preview || preview.querySelector(CARD_SELECTOR)) return;
    preview.innerHTML = '<article class="gmail-message"><h3 class="gmail-message-title">No unread operational emails remain in this preview</h3></article>';
  }

  async function approve(card, button, status, gmailMessageId) {
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = "Creating Communication + requested Work Item…";

    try {
      const result = await post(APPROVE_ACTION, { gmailMessageId });
      const communicationId = result.communicationId || "—";
      const workItemId = result.workItemId || "—";

      status.textContent = result.duplicate
        ? `Already saved · Work Item #${workItemId} · Gmail cleared`
        : `Communication #${communicationId} + Work Item #${workItemId} saved · Gmail cleared`;

      setGlobalStatus(
        result.duplicate
          ? `This requested work was already preserved as Communication #${communicationId} + Work Item #${workItemId}. Gmail was marked read.`
          : `Communication #${communicationId} + direct Work Item #${workItemId} created from Gmail. 0 Investigations created. Gmail was marked read.`
      );

      await window.GCMOShell?.refreshNavAttention?.();
      card.remove();
      showEmptyIfNeeded(document.getElementById("gmail-preview"));
    } catch (error) {
      button.disabled = false;
      status.textContent = `Review required: ${error.message}`;
      setGlobalStatus(`Requested Work approval failed: ${error.message}`);
    }
  }

  function installApproval(card, intelligence) {
    if (card.querySelector(".gcm-work-approval")) return;

    const route = card.querySelector(".gmail-route");
    if (route) route.textContent = "Requested Work";

    setField(card, "Recommended Route", "Requested Work");
    setField(card, "Recommended Action", intelligence.action || intelligence.explicitRequest);
    setField(card, "Priority", intelligence.priority || "Medium");
    if (intelligence.businessImpact) setField(card, "Business Meaning", intelligence.businessImpact);
    addCandidatePill(card);

    const approval = document.createElement("div");
    approval.className = "gmail-approval gcm-work-approval";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-primary gcm-create-requested-work";
    button.textContent = "Create Requested Work";

    const status = document.createElement("span");
    status.className = "gmail-approval-status";
    status.textContent = "Communication + Work Item · no Investigation";

    approval.append(button, status);
    card.appendChild(approval);

    const gmailMessageId = String(card.dataset.gmailId || "").trim();
    button.addEventListener("click", () => approve(card, button, status, gmailMessageId));
  }

  async function evaluateCard(card) {
    if (!(card instanceof HTMLElement)) return;
    if (card.hasAttribute(CHECKED_ATTR)) return;

    const gmailMessageId = String(card.dataset.gmailId || "").trim();
    if (!gmailMessageId) return;

    card.setAttribute(CHECKED_ATTR, "1");

    try {
      const result = await post(EVALUATE_ACTION, { gmailMessageId });
      if (result.candidate !== true) return;
      installApproval(card, result.intelligence || {});
    } catch (error) {
      console.warn(`GCM Gmail Requested Work ${FILE_VERSION}: candidate evaluation failed.`, error);
      card.removeAttribute(CHECKED_ATTR);
    }
  }

  function scan(preview) {
    if (!preview) return;
    preview.querySelectorAll(CARD_SELECTOR).forEach(card => evaluateCard(card));
  }

  function install() {
    if (!/\/today\.html$/i.test(location.pathname)) return;

    const preview = document.getElementById("gmail-preview");
    if (!preview) {
      setTimeout(install, 250);
      return;
    }

    scan(preview);

    const observer = new MutationObserver(() => scan(preview));
    observer.observe(preview, { childList:true, subtree:true });
  }

  install();
})();
