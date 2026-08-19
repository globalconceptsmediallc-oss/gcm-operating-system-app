/* =========================================================
   Global Concepts Media Operating System
   File: shared/today-gmail-decisions.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Gmail — Operator Decision Routes
   Purpose:
   Give each Morning Command email a concise human decision set that separates
   disposable mail, durable information, monitoring, direct requested work,
   and evidence that still requires Investigation.

   Change notes — v1.0.0:
   - Delete — No Action Required moves Gmail to Trash and creates 0 OS records.
   - Keep as Information creates 1 durable Communication and 0 Investigation /
     0 Work Item when a production client is verified.
   - Save as Monitoring reuses the verified Gmail monitoring approval route.
   - Create Requested Work appears only after the live Worker proves a known
     human sender, verified client, and explicit concrete request.
   - Create Investigation reuses the existing verified Investigation route.
   - Replaces the older single-route approval control with one decision row.
   - Gmail cards leave Morning Command only after the selected action succeeds.
   ========================================================= */

(() => {
  "use strict";

  const FILE_VERSION = "1.0.0";
  const WORKER_URL = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const CARD_SELECTOR = ".gmail-message[data-gmail-id]";
  const CHECKED_ATTR = "data-gcm-decision-ready";
  const EVALUATE_WORK = "evaluate-gmail-work-request";
  const APPROVE_WORK = "approve-gmail-work-request";
  const DELETE_NO_ACTION = "delete-gmail-no-action";
  const KEEP_INFORMATION = "save-gmail-information";
  const APPROVE_MONITORING = "approve-gmail-monitoring";
  const APPROVE_INVESTIGATION = "approve-gmail-investigation";

  function injectStyles() {
    if (document.getElementById("gcm-today-gmail-decisions-style")) return;
    const style = document.createElement("style");
    style.id = "gcm-today-gmail-decisions-style";
    style.textContent = `
      .gcm-email-decision-panel{margin-top:12px;padding-top:12px;border-top:1px solid var(--border,#dbe2ec)}
      .gcm-email-decision-label{display:block;margin-bottom:8px;color:var(--text-soft,#8290a3);font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
      .gcm-email-decision-buttons{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .gcm-email-decision-buttons .button{min-height:36px;padding:0 12px;font-size:.74rem}
      .gcm-email-delete{border-color:#e5bcbc!important;background:#fff7f7!important;color:#9d3030!important}
      .gcm-email-information{border-color:#cbd6e4!important;background:#f8fafc!important;color:#34465d!important}
      .gcm-email-monitor{border-color:#bcd8c8!important;background:#f3fbf6!important;color:#226342!important}
      .gcm-email-work{border-color:#a9c5f1!important;background:#edf5ff!important;color:#185fc8!important}
      .gcm-email-investigate{border-color:#e7c987!important;background:#fff8e8!important;color:#805615!important}
      .gcm-email-decision-status{display:block;margin-top:8px;color:var(--text-muted,#637083);font-size:.72rem;font-weight:800}
    `;
    document.head.appendChild(style);
  }

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

  function findFieldValue(card, labelText) {
    const label = [...card.querySelectorAll(".gmail-intelligence-label")]
      .find(node => String(node.textContent || "").trim().toLowerCase() === labelText.toLowerCase());
    return String(label?.closest(".gmail-intelligence-field")?.querySelector(".gmail-intelligence-value")?.textContent || "").trim();
  }

  function setFieldValue(card, labelText, value) {
    if (!value) return;
    const label = [...card.querySelectorAll(".gmail-intelligence-label")]
      .find(node => String(node.textContent || "").trim().toLowerCase() === labelText.toLowerCase());
    const target = label?.closest(".gmail-intelligence-field")?.querySelector(".gmail-intelligence-value");
    if (target) target.textContent = value;
  }

  function setGlobalStatus(text) {
    const target = document.getElementById("gmail-status-copy");
    if (target) target.textContent = text;
  }

  function showEmptyIfNeeded() {
    const preview = document.getElementById("gmail-preview");
    if (!preview || preview.querySelector(CARD_SELECTOR)) return;
    preview.innerHTML = '<article class="gmail-message"><h3 class="gmail-message-title">No unread operational emails remain in this preview</h3></article>';
  }

  function removeCard(card) {
    card?.remove();
    showEmptyIfNeeded();
  }

  function actionButton(label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button button-secondary ${className}`;
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function setBusy(panel, activeButton, message) {
    panel.querySelectorAll("button").forEach(button => { button.disabled = true; });
    activeButton.disabled = true;
    const status = panel.querySelector(".gcm-email-decision-status");
    if (status) status.textContent = message;
  }

  function clearBusy(panel, errorMessage) {
    panel.querySelectorAll("button").forEach(button => { button.disabled = false; });
    const status = panel.querySelector(".gcm-email-decision-status");
    if (status) status.textContent = errorMessage || "Choose one disposition.";
  }

  async function runDecision({ card, panel, button, action, payload, pending, success }) {
    setBusy(panel, button, pending);
    try {
      const result = await post(action, payload);
      const message = success(result);
      const status = panel.querySelector(".gcm-email-decision-status");
      if (status) status.textContent = message;
      setGlobalStatus(message);
      await window.GCMOShell?.refreshNavAttention?.();
      removeCard(card);
    } catch (error) {
      clearBusy(panel, `Review required: ${error.message}`);
      setGlobalStatus(`Email decision failed: ${error.message}`);
    }
  }

  function hideLegacyApproval(card) {
    card.querySelectorAll(":scope > .gmail-approval").forEach(control => {
      if (!control.classList.contains("gcm-email-decision-panel")) control.remove();
    });
  }

  async function buildPanel(card) {
    if (!(card instanceof HTMLElement)) return;
    if (card.hasAttribute(CHECKED_ATTR)) return;
    const gmailMessageId = String(card.dataset.gmailId || "").trim();
    if (!gmailMessageId) return;
    card.setAttribute(CHECKED_ATTR, "1");

    const hadMonitor = Boolean(card.querySelector(".gmail-monitor-check"));
    const hadInvestigation = Boolean(card.querySelector(".gmail-investigation-check"));
    const clientName = findFieldValue(card, "Client");
    const hasVerifiedClient = Boolean(clientName) && !/unassigned|human review/i.test(clientName);

    let workCandidate = null;
    try {
      const work = await post(EVALUATE_WORK, { gmailMessageId });
      if (work.candidate === true) workCandidate = work.intelligence || {};
    } catch (error) {
      console.warn(`GCM Gmail Decisions ${FILE_VERSION}: Work evaluation unavailable.`, error);
    }

    hideLegacyApproval(card);

    const panel = document.createElement("div");
    panel.className = "gcm-email-decision-panel";
    panel.innerHTML = '<span class="gcm-email-decision-label">Email Decision</span><div class="gcm-email-decision-buttons"></div><span class="gcm-email-decision-status">Choose one disposition.</span>';
    const buttons = panel.querySelector(".gcm-email-decision-buttons");

    const deleteButton = actionButton("Delete — No Action", "gcm-email-delete", () => runDecision({
      card, panel, button:deleteButton, action:DELETE_NO_ACTION,
      payload:{ gmailMessageId },
      pending:"Moving email to Gmail Trash · 0 OS records…",
      success:()=>"Deleted to Gmail Trash · No action required · 0 OS records created."
    }));
    buttons.appendChild(deleteButton);

    if (hasVerifiedClient) {
      const infoButton = actionButton("Keep as Information", "gcm-email-information", () => runDecision({
        card, panel, button:infoButton, action:KEEP_INFORMATION,
        payload:{ gmailMessageId, clientName },
        pending:"Saving durable information…",
        success:result=>`Information preserved as Communication #${result.communicationId || "—"} · 0 Investigations · 0 Work Items.`
      }));
      buttons.appendChild(infoButton);
    }

    if (hadMonitor) {
      const monitorButton = actionButton("Save as Monitoring", "gcm-email-monitor", () => runDecision({
        card, panel, button:monitorButton, action:APPROVE_MONITORING,
        payload:{ gmailMessageId },
        pending:"Saving monitoring evidence…",
        success:result=>result.duplicate
          ? "Monitoring evidence was already preserved · Gmail cleared."
          : "Monitoring evidence saved to D1 · Gmail cleared."
      }));
      buttons.appendChild(monitorButton);
    }

    if (workCandidate) {
      setFieldValue(card, "Recommended Route", "Requested Work");
      setFieldValue(card, "Recommended Action", workCandidate.action || workCandidate.explicitRequest);
      setFieldValue(card, "Priority", workCandidate.priority || "Medium");
      if (workCandidate.businessImpact) setFieldValue(card, "Business Meaning", workCandidate.businessImpact);
      const route = card.querySelector(".gmail-route");
      if (route) route.textContent = "Requested Work";

      const workButton = actionButton("Create Requested Work", "gcm-email-work", () => runDecision({
        card, panel, button:workButton, action:APPROVE_WORK,
        payload:{ gmailMessageId },
        pending:"Creating Communication + direct Work Item…",
        success:result=>`Communication #${result.communicationId || "—"} + Work Item #${result.workItemId || "—"} created · 0 Investigations.`
      }));
      buttons.appendChild(workButton);
    }

    if (hadInvestigation) {
      const investigationButton = actionButton("Create Investigation", "gcm-email-investigate", () => runDecision({
        card, panel, button:investigationButton, action:APPROVE_INVESTIGATION,
        payload:{ gmailMessageId },
        pending:"Creating Communication + Investigation…",
        success:result=>`Communication #${result.communicationId || "—"} + Investigation #${result.investigationId || "—"} created · 0 Work Items.`
      }));
      buttons.appendChild(investigationButton);
    }

    card.appendChild(panel);
  }

  function scan(preview) {
    preview?.querySelectorAll(CARD_SELECTOR).forEach(card => buildPanel(card));
  }

  function install() {
    if (!/\/today\.html$/i.test(location.pathname)) return;
    injectStyles();
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
