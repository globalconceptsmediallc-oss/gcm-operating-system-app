/* =========================================================
   Global Concepts Media Operating System
   File: shared/today-gmail-decisions.js
   Version: 1.2.0
   Status: Production Road-Test Candidate
   Source: shared/today-gmail-decisions.js 1.1.0 production
   Sprint: Gmail — Decision Hold / Work Lite
   Purpose:
   Give Morning Command one explicit disposition set, preserve the durable
   operational backlog, and provide a lightweight client-linked holding state
   when a decision-critical question or future follow-up remains unresolved.

   Change notes — v1.2.0:
   - Adds Hold for Review only when a verified client exists and no stronger
     Monitoring, Investigation, or direct Work route has been proven.
   - A successful hold creates 0 Work Items and 0 Investigations and removes the
     email from active Morning Command processing.
   - Adds Decision Holds · Work Lite below the Gmail queue with client, priority,
     blocking question/follow-up, due date, source Gmail link, and next action.
   - Return to Morning Command releases the hold without deleting its history.
   - Preserves all v1.1.0 explicit disposition and operational-backlog behavior.

   Change notes — v1.1.0:
   - Preserves Delete / Information / Monitoring / Work / Investigation decisions.
   - Merges read-but-unprocessed operational Gmail into Morning Command.
   - Treats GCM OS source history, not Gmail read state, as the processing test.
   - Keeps the visible queue at 10 items and pulls the next unprocessed item.
   ========================================================= */

(() => {
  "use strict";

  const FILE_VERSION = "1.2.0";
  const WORKER_URL =
    "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const CARD_SELECTOR = ".gmail-message[data-gmail-id]";
  const CHECKED_ATTR = "data-gcm-decision-ready";
  const EVALUATE_WORK = "evaluate-gmail-work-request";
  const BACKLOG_MODE = "operational-backlog";
  const APPROVE_WORK = "approve-gmail-work-request";
  const DELETE_NO_ACTION = "delete-gmail-no-action";
  const KEEP_INFORMATION = "save-gmail-information";
  const APPROVE_MONITORING = "approve-gmail-monitoring";
  const APPROVE_INVESTIGATION = "approve-gmail-investigation";
  const HOLD_DECISION = "hold-gmail-decision";
  const MAX_VISIBLE_EMAILS = 10;

  let lastBacklogFingerprint = null;
  let backlogTimer = null;

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
      .gcm-email-hold{border-color:#d3c4ec!important;background:#faf7ff!important;color:#68479a!important}
      .gcm-email-monitor{border-color:#bcd8c8!important;background:#f3fbf6!important;color:#226342!important}
      .gcm-email-work{border-color:#a9c5f1!important;background:#edf5ff!important;color:#185fc8!important}
      .gcm-email-investigate{border-color:#e7c987!important;background:#fff8e8!important;color:#805615!important}
      .gcm-email-decision-status{display:block;margin-top:8px;color:var(--text-muted,#637083);font-size:.72rem;font-weight:800}
      .gcm-email-backlog-note{display:inline-flex;align-items:center;min-height:24px;margin-left:6px;padding:0 8px;border-radius:999px;background:#f1f4f8;color:#56677d;font-size:.62rem;font-weight:850}
      .gcm-decision-holds{margin-top:18px;padding:16px;border:1px solid var(--border,#dbe2ec);border-radius:16px;background:rgba(255,255,255,.62)}
      .gcm-decision-holds[hidden]{display:none!important}
      .gcm-decision-holds-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
      .gcm-decision-holds-title{margin:0;color:var(--text,#14233a);font-size:.95rem;font-weight:900}
      .gcm-decision-holds-copy{margin:4px 0 0;color:var(--text-muted,#637083);font-size:.76rem;line-height:1.45}
      .gcm-decision-holds-count{display:inline-flex;min-width:28px;height:28px;align-items:center;justify-content:center;border-radius:999px;background:#f1ebfb;color:#68479a;font-size:.72rem;font-weight:900}
      .gcm-decision-hold-list{display:grid;gap:10px}
      .gcm-decision-hold-card{padding:13px 14px;border:1px solid #dfe5ee;border-radius:13px;background:#fff}
      .gcm-decision-hold-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .gcm-decision-hold-card h4{margin:0;color:var(--text,#14233a);font-size:.82rem;font-weight:900}
      .gcm-decision-hold-meta{margin-top:3px;color:var(--text-muted,#637083);font-size:.68rem;font-weight:750}
      .gcm-decision-hold-priority{flex:0 0 auto;padding:4px 8px;border-radius:999px;background:#f5f1fb;color:#68479a;font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.04em}
      .gcm-decision-hold-question{margin:10px 0 0;color:var(--text,#14233a);font-size:.78rem;font-weight:850;line-height:1.45}
      .gcm-decision-hold-why,.gcm-decision-hold-next{margin:6px 0 0;color:var(--text-muted,#637083);font-size:.72rem;line-height:1.45}
      .gcm-decision-hold-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
      .gcm-decision-hold-actions .button{min-height:34px;padding:0 11px;font-size:.7rem}
      .gcm-decision-hold-source{display:inline-flex;align-items:center;text-decoration:none}
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
      .find(node =>
        String(node.textContent || "").trim().toLowerCase() ===
        labelText.toLowerCase()
      );
    return String(
      label
        ?.closest(".gmail-intelligence-field")
        ?.querySelector(".gmail-intelligence-value")
        ?.textContent || ""
    ).trim();
  }

  function setFieldValue(card, labelText, value) {
    if (!value) return;
    const label = [...card.querySelectorAll(".gmail-intelligence-label")]
      .find(node =>
        String(node.textContent || "").trim().toLowerCase() ===
        labelText.toLowerCase()
      );
    const target = label
      ?.closest(".gmail-intelligence-field")
      ?.querySelector(".gmail-intelligence-value");
    if (target) target.textContent = value;
  }

  function setGlobalStatus(text) {
    const target = document.getElementById("gmail-status-copy");
    if (target) target.textContent = text;
  }

  function showEmptyIfNeeded() {
    const preview = document.getElementById("gmail-preview");
    if (!preview || preview.querySelector(CARD_SELECTOR)) return;
    preview.innerHTML =
      '<article class="gmail-message"><h3 class="gmail-message-title">No unprocessed operational emails remain in this preview</h3></article>';
  }

  function removeCard(card) {
    const preview = card?.closest("#gmail-preview") ||
      document.getElementById("gmail-preview");
    card?.remove();
    showEmptyIfNeeded();
    lastBacklogFingerprint = null;
    queueBacklogLoad(preview);
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
    panel.querySelectorAll("button").forEach(button => {
      button.disabled = true;
    });
    activeButton.disabled = true;
    const status = panel.querySelector(".gcm-email-decision-status");
    if (status) status.textContent = message;
  }

  function clearBusy(panel, errorMessage) {
    panel.querySelectorAll("button").forEach(button => {
      button.disabled = false;
    });
    const status = panel.querySelector(".gcm-email-decision-status");
    if (status) status.textContent = errorMessage || "Choose one disposition.";
  }

  async function runDecision({
    card,
    panel,
    button,
    action,
    payload,
    pending,
    success
  }) {
    setBusy(panel, button, pending);
    try {
      const result = await post(action, payload);
      const message = success(result);
      const status = panel.querySelector(".gcm-email-decision-status");
      if (status) status.textContent = message;
      setGlobalStatus(message);
      await window.GCMOShell?.refreshNavAttention?.();
      removeCard(card);
      if (action === HOLD_DECISION) await loadDecisionHolds();
    } catch (error) {
      clearBusy(panel, `Review required: ${error.message}`);
      setGlobalStatus(`Email decision failed: ${error.message}`);
    }
  }

  function hideLegacyApproval(card) {
    card.querySelectorAll(":scope > .gmail-approval").forEach(control => {
      if (!control.classList.contains("gcm-email-decision-panel")) {
        control.remove();
      }
    });
  }

  async function buildPanel(card) {
    if (!(card instanceof HTMLElement)) return;
    if (card.hasAttribute(CHECKED_ATTR)) return;

    const gmailMessageId = String(card.dataset.gmailId || "").trim();
    if (!gmailMessageId) return;
    card.setAttribute(CHECKED_ATTR, "1");

    const hadMonitor =
      Boolean(card.querySelector(".gmail-monitor-check")) ||
      card.dataset.monitorCandidate === "1";
    const hadInvestigation =
      Boolean(card.querySelector(".gmail-investigation-check")) ||
      card.dataset.investigationCandidate === "1";
    const clientName = findFieldValue(card, "Client");
    const hasVerifiedClient =
      Boolean(clientName) && !/unassigned|human review/i.test(clientName);

    let workCandidate = null;
    try {
      const work = await post(EVALUATE_WORK, { gmailMessageId });
      if (work.candidate === true) {
        workCandidate = work.intelligence || {};
      }
    } catch (error) {
      console.warn(
        `GCM Gmail Decisions ${FILE_VERSION}: Work evaluation unavailable.`,
        error
      );
    }

    hideLegacyApproval(card);

    const panel = document.createElement("div");
    panel.className = "gmail-approval gcm-email-decision-panel";
    panel.innerHTML =
      '<span class="gcm-email-decision-label">Email Decision</span><div class="gcm-email-decision-buttons"></div><span class="gcm-email-decision-status">Choose one disposition.</span>';
    const buttons = panel.querySelector(".gcm-email-decision-buttons");

    const deleteButton = actionButton(
      "Delete — No Action",
      "gcm-email-delete",
      () => runDecision({
        card,
        panel,
        button:deleteButton,
        action:DELETE_NO_ACTION,
        payload:{ gmailMessageId },
        pending:"Moving email to Gmail Trash · 0 OS records…",
        success:() =>
          "Deleted to Gmail Trash · No action required · 0 OS records created."
      })
    );
    buttons.appendChild(deleteButton);

    if (hasVerifiedClient) {
      const infoButton = actionButton(
        "Keep as Information",
        "gcm-email-information",
        () => runDecision({
          card,
          panel,
          button:infoButton,
          action:KEEP_INFORMATION,
          payload:{ gmailMessageId, clientName },
          pending:"Saving durable information…",
          success:result =>
            `Information preserved as Communication #${result.communicationId || "—"} · 0 Investigations · 0 Work Items.`
        })
      );
      buttons.appendChild(infoButton);
    }

    if (hasVerifiedClient && !hadMonitor && !hadInvestigation && !workCandidate) {
      const holdButton = actionButton(
        "Hold for Review",
        "gcm-email-hold",
        () => runDecision({
          card,
          panel,
          button:holdButton,
          action:HOLD_DECISION,
          payload:{ gmailMessageId, clientName },
          pending:"Parking as Decision Hold · 0 Work · 0 Investigations…",
          success:result =>
            `Decision Hold #${result.hold?.id || "—"} saved for ${result.hold?.clientName || clientName} · 0 Work Items · 0 Investigations.`
        })
      );
      buttons.appendChild(holdButton);
    }

    if (hadMonitor) {
      const monitorButton = actionButton(
        "Save as Monitoring",
        "gcm-email-monitor",
        () => runDecision({
          card,
          panel,
          button:monitorButton,
          action:APPROVE_MONITORING,
          payload:{ gmailMessageId },
          pending:"Saving monitoring evidence…",
          success:result => result.duplicate
            ? "Monitoring evidence was already preserved · Gmail cleared."
            : "Monitoring evidence saved to D1 · Gmail cleared."
        })
      );
      buttons.appendChild(monitorButton);
    }

    if (workCandidate) {
      setFieldValue(card, "Recommended Route", "Requested Work");
      setFieldValue(
        card,
        "Recommended Action",
        workCandidate.action || workCandidate.explicitRequest
      );
      setFieldValue(card, "Priority", workCandidate.priority || "Medium");
      if (workCandidate.businessImpact) {
        setFieldValue(card, "Business Meaning", workCandidate.businessImpact);
      }
      const route = card.querySelector(".gmail-route");
      if (route) route.textContent = "Requested Work";

      const workButton = actionButton(
        "Create Requested Work",
        "gcm-email-work",
        () => runDecision({
          card,
          panel,
          button:workButton,
          action:APPROVE_WORK,
          payload:{ gmailMessageId },
          pending:"Creating Communication + direct Work Item…",
          success:result =>
            `Communication #${result.communicationId || "—"} + Work Item #${result.workItemId || "—"} created · 0 Investigations.`
        })
      );
      buttons.appendChild(workButton);
    }

    if (hadInvestigation) {
      const investigationButton = actionButton(
        "Create Investigation",
        "gcm-email-investigate",
        () => runDecision({
          card,
          panel,
          button:investigationButton,
          action:APPROVE_INVESTIGATION,
          payload:{ gmailMessageId },
          pending:"Creating Communication + Investigation…",
          success:result =>
            `Communication #${result.communicationId || "—"} + Investigation #${result.investigationId || "—"} created · 0 Work Items.`
        })
      );
      buttons.appendChild(investigationButton);
    }

    card.appendChild(panel);
  }

  function intelligenceField(label, value, wide = false) {
    return `<div class="gmail-intelligence-field${wide ? " wide" : ""}"><span class="gmail-intelligence-label">${escapeHtml(label)}</span><span class="gmail-intelligence-value">${escapeHtml(value || "—")}</span></div>`;
  }

  function renderBacklogCard(message) {
    const i = message?.intelligence || {};
    const article = document.createElement("article");
    article.className = "gmail-message";
    article.dataset.gmailId = String(message?.gmailMessageId || "");
    article.dataset.monitorCandidate = i.monitoringOnly ? "1" : "0";
    article.dataset.investigationCandidate =
      (i.investigationCandidate || i.shouldCreateInvestigation) ? "1" : "0";
    article.dataset.gcmBacklog = "1";

    const readLabel = message?.read ? "Read · Unprocessed" : "Unread · Unprocessed";

    article.innerHTML = `
      <div class="gmail-message-header">
        <div>
          <h3 class="gmail-message-title">${escapeHtml(message?.subject || "(No subject)")}</h3>
          <span class="gmail-message-meta">${escapeHtml(message?.from || "Unknown sender")} · ${escapeHtml(message?.date || "Unknown date")}</span>
        </div>
        <span class="gmail-route">${escapeHtml(i.proposedRoute || "Manual Review")}</span>
      </div>
      <div class="gmail-intelligence-grid">
        ${intelligenceField("Communication Family", i.communicationFamily || "Operational Email")}
        ${intelligenceField("Notification Type", i.notificationType || "manual_review")}
        ${intelligenceField("Client", i.client || "Unassigned — Human Review")}
        ${intelligenceField("Priority", i.operationalPriority || "Normal")}
        ${intelligenceField("Confidence", i.confidence || "Medium")}
        ${intelligenceField("Recommended Route", i.proposedRoute || "Manual Review")}
        ${intelligenceField("Business Meaning", i.businessMeaning || "Operator disposition required.", true)}
        ${intelligenceField("Recommended Action", i.recommendedAction || "Choose the correct disposition.", true)}
      </div>
      <div class="gmail-decision-row">
        <span class="gmail-decision">Communication Approved: No</span>
        <span class="gmail-decision">Investigation Approved: No</span>
        <span class="gmail-decision">Work Item Approved: No</span>
        ${i.monitoringOnly ? '<span class="gmail-decision yes">Monitoring Candidate: Yes</span>' : ""}
        ${(i.investigationCandidate || i.shouldCreateInvestigation) ? '<span class="gmail-decision yes">Investigation Candidate: Yes</span>' : ""}
        <span class="gcm-email-backlog-note">${escapeHtml(readLabel)}</span>
      </div>
      <p class="gmail-source-preview">${escapeHtml(message?.snippet || message?.bodyText || "")}</p>
    `;

    return article;
  }

  function existingGmailIds(preview) {
    return [...preview.querySelectorAll(CARD_SELECTOR)]
      .map(card => String(card.dataset.gmailId || "").trim())
      .filter(Boolean);
  }

  function clearEmptyPlaceholder(preview) {
    if (preview.querySelector(CARD_SELECTOR)) return;
    const placeholder = preview.querySelector(".gmail-message:not([data-gmail-id])");
    if (placeholder) placeholder.remove();
  }

  function appendBacklogMessages(preview, messages) {
    if (!Array.isArray(messages) || !messages.length) return 0;
    clearEmptyPlaceholder(preview);

    const existing = new Set(existingGmailIds(preview));
    let added = 0;

    for (const message of messages) {
      const id = String(message?.gmailMessageId || "").trim();
      if (!id || existing.has(id)) continue;
      if (preview.querySelectorAll(CARD_SELECTOR).length >= MAX_VISIBLE_EMAILS) break;
      preview.appendChild(renderBacklogCard(message));
      existing.add(id);
      added += 1;
    }

    return added;
  }

  async function loadOperationalBacklog(preview) {
    if (!preview || preview.hidden) return;
    if (preview.dataset.gcmBacklogLoading === "1") return;

    const ids = existingGmailIds(preview);
    if (ids.length >= MAX_VISIBLE_EMAILS) return;

    const fingerprint = ids.slice().sort().join("|");
    if (fingerprint === lastBacklogFingerprint) return;
    lastBacklogFingerprint = fingerprint;
    preview.dataset.gcmBacklogLoading = "1";

    try {
      const result = await post(EVALUATE_WORK, {
        mode:BACKLOG_MODE,
        limit:MAX_VISIBLE_EMAILS - ids.length,
        scanLimit:100,
        excludeIds:ids
      });

      const added = appendBacklogMessages(preview, result.messages || []);
      const total = existingGmailIds(preview).length;

      if (added > 0) {
        setGlobalStatus(
          `${total} operational email${total === 1 ? "" : "s"} ready for disposition. Gmail read state is not treated as processed.`
        );
      } else if (total === 0) {
        showEmptyIfNeeded();
        setGlobalStatus(
          "No unprocessed operational emails were found in Inbox, Kristy, Frank & Adrianne Stuff, or REPORTS-SEO."
        );
      }
    } catch (error) {
      console.warn(
        `GCM Gmail Decisions ${FILE_VERSION}: operational backlog unavailable.`,
        error
      );
    } finally {
      preview.dataset.gcmBacklogLoading = "0";
    }
  }

  function ensureDecisionHoldSection(preview) {
    let section = document.getElementById("gcm-decision-holds");
    if (section) return section;

    section = document.createElement("section");
    section.id = "gcm-decision-holds";
    section.className = "gcm-decision-holds";
    section.hidden = true;
    section.innerHTML = `
      <div class="gcm-decision-holds-header">
        <div>
          <h3 class="gcm-decision-holds-title">Decision Holds · Work Lite</h3>
          <p class="gcm-decision-holds-copy">Important questions and follow-ups parked without creating committed Work or Investigations.</p>
        </div>
        <span class="gcm-decision-holds-count" data-gcm-hold-count>0</span>
      </div>
      <div class="gcm-decision-hold-list" data-gcm-hold-list></div>
    `;
    preview.insertAdjacentElement("afterend", section);
    return section;
  }

  function formatHoldDate(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    const date = new Date(`${text}T12:00:00`);
    if (Number.isNaN(date.getTime())) return text;
    return date.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
  }

  function renderDecisionHold(hold) {
    const article = document.createElement("article");
    article.className = "gcm-decision-hold-card";
    article.dataset.holdId = String(hold?.id || "");
    const due = formatHoldDate(hold?.dueDate);
    const meta = [hold?.clientName || hold?.clientCode, hold?.holdType === "follow_up" ? "Follow-Up" : "Question", due ? `Due ${due}` : "No immediate deadline"].filter(Boolean).join(" · ");

    article.innerHTML = `
      <div class="gcm-decision-hold-top">
        <div>
          <h4>${escapeHtml(hold?.sourceSubject || hold?.title || "Decision Hold")}</h4>
          <div class="gcm-decision-hold-meta">${escapeHtml(meta)}</div>
        </div>
        <span class="gcm-decision-hold-priority">${escapeHtml(hold?.priority || "Low")}</span>
      </div>
      <p class="gcm-decision-hold-question">${escapeHtml(hold?.question || "Decision question not recorded.")}</p>
      ${hold?.whyItMatters ? `<p class="gcm-decision-hold-why"><strong>Why it matters:</strong> ${escapeHtml(hold.whyItMatters)}</p>` : ""}
      ${hold?.suggestedNextAction ? `<p class="gcm-decision-hold-next"><strong>Come back to:</strong> ${escapeHtml(hold.suggestedNextAction)}</p>` : ""}
      <div class="gcm-decision-hold-actions">
        ${hold?.gmailUrl ? `<a class="button button-secondary gcm-decision-hold-source" href="${escapeHtml(hold.gmailUrl)}" target="_blank" rel="noopener">Open Source Email</a>` : ""}
        <button type="button" class="button button-secondary" data-gcm-release-hold>Return to Morning Command</button>
      </div>
    `;

    const release = article.querySelector("[data-gcm-release-hold]");
    release?.addEventListener("click", async () => {
      release.disabled = true;
      release.textContent = "Returning…";
      try {
        await post(HOLD_DECISION, { mode:"release", holdId:hold.id });
        lastBacklogFingerprint = null;
        await loadDecisionHolds();
        const preview = document.getElementById("gmail-preview");
        queueBacklogLoad(preview);
        setGlobalStatus("Decision Hold returned to Morning Command for final disposition.");
      } catch (error) {
        release.disabled = false;
        release.textContent = "Return to Morning Command";
        setGlobalStatus(`Decision Hold release failed: ${error.message}`);
      }
    });

    return article;
  }

  async function loadDecisionHolds() {
    const preview = document.getElementById("gmail-preview");
    if (!preview) return;
    const section = ensureDecisionHoldSection(preview);
    const list = section.querySelector("[data-gcm-hold-list]");
    const count = section.querySelector("[data-gcm-hold-count]");

    try {
      const result = await post(HOLD_DECISION, { mode:"list" });
      const holds = Array.isArray(result?.holds) ? result.holds : [];
      if (count) count.textContent = String(holds.length);
      if (list) {
        list.replaceChildren(...holds.map(renderDecisionHold));
      }
      section.hidden = holds.length === 0;
    } catch (error) {
      section.hidden = true;
      console.warn(`GCM Gmail Decisions ${FILE_VERSION}: Decision Holds unavailable.`, error);
    }
  }

  function queueBacklogLoad(preview) {
    if (!preview || preview.hidden) return;
    if (backlogTimer) clearTimeout(backlogTimer);
    backlogTimer = setTimeout(() => {
      backlogTimer = null;
      loadOperationalBacklog(preview);
    }, 120);
  }

  function scan(preview) {
    preview?.querySelectorAll(CARD_SELECTOR).forEach(card => buildPanel(card));
    queueBacklogLoad(preview);
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
    loadDecisionHolds();

    const observer = new MutationObserver(() => scan(preview));
    observer.observe(preview, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:["hidden"]
    });
  }

  install();
})();
