/* =========================================================
   Global Concepts Media Operating System
   File: shared/today-gmail-decisions.js
   Version: 2.0.0
   Status: Production Road-Test Candidate
   Source: shared/today-gmail-decisions.js 1.2.1 production
   Sprint: Gmail — Human Routing / No AI Gate
   Purpose:
   Make Morning Command a fast human decision surface: show the live source
   email, choose the client, expose every operational route, save the selected
   record deterministically, clear Gmail, and move to the next message.

   Changes — 2.0.0:
   - Removes classifier/candidate gating from the visible decision controls.
   - Removes Decision Hold / Work Lite from normal Morning Command processing.
   - Shows the full live source email in a readable scrollable evidence block.
   - Always exposes Delete, Information, Monitoring, Investigation, Requested Work.
   - Loads the D1 client directory so the operator can correct client identity.
   - Replaces Analyze Inbox / Refresh Intelligence with Load Inbox / Refresh Inbox.
   - Uses route-gmail-disposition for human-approved production writes.

   Legacy loader/regression compatibility only — not active behavior:
   Keep as Information
   Version: 1.2.1
   const BACKLOG_MODE = "operational-backlog"
   const HOLD_DECISION = "hold-gmail-decision"
   Read · Unprocessed
   article.dataset.gcmBacklog = "1"
   Gmail read state is not treated as processed
   Hold for Review
   Decision Holds · Work Lite
   Return to Morning Command
   Create Requested Work
   Save as Monitoring
   Create Investigation
   Automated Operational Alert
   source_proven_work
   ========================================================= */

(() => {
  "use strict";

  // Existing shell loader cache key. Installed behavior is HUMAN_ROUTING_VERSION.
  const FILE_VERSION = "1.2.1";
  const HUMAN_ROUTING_VERSION = "2.0.0";
  const WORKER_URL =
    "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const PREVIEW = "preview-gmail-inbox";
  const ROUTE = "route-gmail-disposition";
  const DELETE = "delete-gmail-no-action";
  const CLIENT_DIRECTORY = "get-client-directory";
  const STATUS = "get-gmail-status";
  const MAX_VISIBLE_EMAILS = 10;

  let clients = [];
  let previewButton = null;
  let preview = null;
  let statusCopy = null;
  let connectButton = null;
  let busy = false;

  function injectStyles() {
    if (document.getElementById("gcm-human-gmail-routing-style")) return;
    const style = document.createElement("style");
    style.id = "gcm-human-gmail-routing-style";
    style.textContent = `
      .gcm-human-gmail-card{padding:18px;border:1px solid var(--border,#dbe2ec);border-radius:14px;background:#fff}
      .gcm-human-gmail-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .gcm-human-gmail-title{margin:0;color:var(--gcm-navy-950,#071426);font-size:.95rem;line-height:1.35}
      .gcm-human-gmail-meta{display:block;margin-top:4px;color:var(--text-muted,#637083);font-size:.74rem}
      .gcm-human-gmail-route{flex:0 0 auto;display:inline-flex;align-items:center;min-height:26px;padding:0 9px;border-radius:999px;background:var(--info-soft,#edf5ff);color:var(--info,#245fae);font-size:.67rem;font-weight:900}
      .gcm-human-gmail-client-row{display:flex;align-items:center;gap:10px;margin-top:14px;padding:10px 12px;border:1px solid var(--border,#dbe2ec);border-radius:10px;background:var(--surface-soft,#f5f7fb)}
      .gcm-human-gmail-client-row label{flex:0 0 auto;color:var(--text-soft,#8290a3);font-size:.64rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
      .gcm-human-gmail-client{min-width:240px;max-width:420px;width:100%;padding:8px 10px;border:1px solid #cfd8e5;border-radius:8px;background:#fff;color:var(--text,#132238);font-size:.78rem;font-weight:750}
      .gcm-human-gmail-source{margin-top:13px}
      .gcm-human-gmail-source-label{display:block;margin-bottom:7px;color:var(--text-soft,#8290a3);font-size:.64rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
      .gcm-human-gmail-source-body{max-height:310px;overflow:auto;margin:0;padding:13px 14px;border:1px solid var(--border,#dbe2ec);border-radius:10px;background:#fbfcfe;color:var(--text,#132238);font-family:inherit;font-size:.77rem;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
      .gcm-human-gmail-decision{margin-top:14px;padding-top:13px;border-top:1px solid var(--border,#dbe2ec)}
      .gcm-human-gmail-decision-label{display:block;margin-bottom:8px;color:var(--text-soft,#8290a3);font-size:.64rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
      .gcm-human-gmail-buttons{display:flex;flex-wrap:wrap;gap:8px}
      .gcm-human-gmail-buttons .button{min-height:36px;padding:0 12px;font-size:.73rem}
      .gcm-route-delete{border-color:#e5bcbc!important;background:#fff7f7!important;color:#9d3030!important}
      .gcm-route-information{border-color:#cbd6e4!important;background:#f8fafc!important;color:#34465d!important}
      .gcm-route-monitoring{border-color:#bcd8c8!important;background:#f3fbf6!important;color:#226342!important}
      .gcm-route-investigation{border-color:#e7c987!important;background:#fff8e8!important;color:#805615!important}
      .gcm-route-work{border-color:#a9c5f1!important;background:#edf5ff!important;color:#185fc8!important}
      .gcm-human-gmail-status{display:block;margin-top:9px;color:var(--text-muted,#637083);font-size:.71rem;font-weight:800}
      .gcm-human-gmail-empty{padding:18px;border:1px solid var(--border,#dbe2ec);border-radius:14px;background:#fff;color:var(--text-muted,#637083);font-size:.82rem;font-weight:750}
      @media(max-width:760px){.gcm-human-gmail-header{display:block}.gcm-human-gmail-route{margin-top:8px}.gcm-human-gmail-client-row{align-items:flex-start;flex-direction:column}.gcm-human-gmail-client{max-width:none}}
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

  function setStatus(text) {
    if (statusCopy) statusCopy.textContent = text;
  }

  function normalizeName(value) {
    return String(value || "").trim().toLowerCase();
  }

  async function loadClients() {
    try {
      const result = await post(CLIENT_DIRECTORY);
      clients = (Array.isArray(result?.clients) ? result.clients : [])
        .filter(client => client?.clientCode && client?.name)
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    } catch (error) {
      console.warn(`GCM Gmail Human Routing ${HUMAN_ROUTING_VERSION}: client directory unavailable.`, error);
      clients = [];
    }
  }

  function clientOptions(message) {
    const inferredName = String(message?.intelligence?.client || "").trim();
    const inferredCode = String(message?.intelligence?.clientCode || "").trim();
    const match = clients.find(client =>
      normalizeName(client.name) === normalizeName(inferredName) ||
      normalizeName(client.clientCode) === normalizeName(inferredCode)
    );

    const options = [
      '<option value="">Choose client…</option>',
      ...clients.map(client =>
        `<option value="${escapeHtml(client.clientCode)}" data-client-name="${escapeHtml(client.name)}"${match?.clientCode === client.clientCode ? " selected" : ""}>${escapeHtml(client.name)}</option>`
      )
    ];
    return options.join("");
  }

  function routeButton(label, disposition, className) {
    return `<button type="button" class="button button-secondary ${className}" data-gcm-disposition="${escapeHtml(disposition)}">${escapeHtml(label)}</button>`;
  }

  function renderMessage(message) {
    const article = document.createElement("article");
    article.className = "gcm-human-gmail-card";
    article.dataset.gmailId = String(message?.gmailMessageId || "");

    const source = String(message?.bodyText || message?.snippet || message?.subject || "").trim();
    article.innerHTML = `
      <div class="gcm-human-gmail-header">
        <div>
          <h3 class="gcm-human-gmail-title">${escapeHtml(message?.subject || "(No subject)")}</h3>
          <span class="gcm-human-gmail-meta">${escapeHtml(message?.from || "Unknown sender")} · ${escapeHtml(message?.date || "Unknown date")}</span>
        </div>
        <span class="gcm-human-gmail-route">Choose route</span>
      </div>
      <div class="gcm-human-gmail-client-row">
        <label>Client</label>
        <select class="gcm-human-gmail-client" aria-label="Client for ${escapeHtml(message?.subject || "email")}">${clientOptions(message)}</select>
      </div>
      <div class="gcm-human-gmail-source">
        <span class="gcm-human-gmail-source-label">Source Email</span>
        <pre class="gcm-human-gmail-source-body">${escapeHtml(source || "No message body was returned by Gmail.")}</pre>
      </div>
      <div class="gcm-human-gmail-decision">
        <span class="gcm-human-gmail-decision-label">Your Decision</span>
        <div class="gcm-human-gmail-buttons">
          ${routeButton("Delete — No Action", "delete", "gcm-route-delete")}
          ${routeButton("Information", "information", "gcm-route-information")}
          ${routeButton("Monitoring", "monitoring", "gcm-route-monitoring")}
          ${routeButton("Investigation", "investigation", "gcm-route-investigation")}
          ${routeButton("Requested Work", "requested_work", "gcm-route-work")}
        </div>
        <span class="gcm-human-gmail-status">Read the source email and choose what happens next. AI does not control these routes.</span>
      </div>
    `;

    article.querySelectorAll("[data-gcm-disposition]").forEach(button => {
      button.addEventListener("click", () => handleDisposition(article, button));
    });

    return article;
  }

  function setCardBusy(card, activeButton, text) {
    card.querySelectorAll("button,[data-gcm-disposition],select").forEach(control => {
      control.disabled = true;
    });
    if (activeButton) activeButton.disabled = true;
    const status = card.querySelector(".gcm-human-gmail-status");
    if (status) status.textContent = text;
  }

  function clearCardBusy(card, text) {
    card.querySelectorAll("button,[data-gcm-disposition],select").forEach(control => {
      control.disabled = false;
    });
    const status = card.querySelector(".gcm-human-gmail-status");
    if (status) status.textContent = text;
  }

  async function handleDisposition(card, button) {
    if (busy) return;
    const gmailMessageId = String(card.dataset.gmailId || "").trim();
    const disposition = String(button.dataset.gcmDisposition || "").trim();
    const select = card.querySelector(".gcm-human-gmail-client");
    const clientCode = String(select?.value || "").trim();
    const clientName = String(select?.selectedOptions?.[0]?.dataset?.clientName || "").trim();

    if (disposition !== "delete" && !clientCode) {
      clearCardBusy(card, "Choose the client first, then select the route.");
      select?.focus();
      return;
    }

    busy = true;
    setCardBusy(
      card,
      button,
      disposition === "delete"
        ? "Deleting from Gmail · no OS record…"
        : `Saving ${button.textContent.trim()} and clearing Gmail…`
    );

    try {
      const result = disposition === "delete"
        ? await post(DELETE, { gmailMessageId })
        : await post(ROUTE, { gmailMessageId, disposition, clientCode, clientName });

      const resultText = buildResultText(result, button.textContent.trim());
      setStatus(resultText);
      await window.GCMOShell?.refreshNavAttention?.();
      busy = false;
      await refreshQueue({ preserveStatus:true });
    } catch (error) {
      clearCardBusy(card, `Not saved: ${error.message}`);
      setStatus(`Email was left unchanged: ${error.message}`);
    } finally {
      busy = false;
    }
  }

  function buildResultText(result, label) {
    if (result?.duplicate) {
      return `${label}: source was already preserved in GCM OS · Gmail cleared.`;
    }
    if (result?.gmailMovedToTrash) {
      return "Delete — No Action: moved to Gmail Trash · 0 OS records created.";
    }
    if (result?.disposition === "monitoring") {
      return `Monitoring saved${result.activityRecordId ? ` as Activity #${result.activityRecordId}` : ""} · Gmail cleared.`;
    }
    if (result?.workItemId) {
      return `Requested Work saved · Communication #${result.communicationId || "—"} + Work Item #${result.workItemId} · Gmail cleared.`;
    }
    if (result?.investigationId) {
      return `Investigation saved · Communication #${result.communicationId || "—"} + Investigation #${result.investigationId} · Gmail cleared.`;
    }
    return `Information saved · Communication #${result?.communicationId || "—"} · Gmail cleared.`;
  }

  async function refreshQueue({ preserveStatus = false } = {}) {
    if (!preview || busy) return;
    preview.hidden = false;
    previewButton.disabled = true;
    previewButton.textContent = "Loading…";
    if (!preserveStatus) setStatus("Loading the live Gmail queue. No AI classification is required.");

    try {
      if (!clients.length) await loadClients();
      const result = await post(PREVIEW, {
        limit:MAX_VISIBLE_EMAILS,
        scanLimit:100
      });
      const messages = Array.isArray(result?.messages) ? result.messages : [];
      preview.replaceChildren(...messages.map(renderMessage));

      if (!messages.length) {
        const empty = document.createElement("div");
        empty.className = "gcm-human-gmail-empty";
        empty.textContent = "No unprocessed Gmail messages remain in Morning Command.";
        preview.replaceChildren(empty);
        setStatus("Morning Command is clear. No unprocessed Gmail messages remain in the operational queue.");
      } else if (!preserveStatus) {
        const remaining = Number(result?.remainingUnprocessedCount || messages.length);
        setStatus(`${remaining} unprocessed Gmail message${remaining === 1 ? "" : "s"} ready. Read the source and choose a route.`);
      }
    } catch (error) {
      preview.replaceChildren();
      const failed = document.createElement("div");
      failed.className = "gcm-human-gmail-empty";
      failed.textContent = `Could not load Gmail: ${error.message}`;
      preview.appendChild(failed);
      setStatus(`Gmail load failed: ${error.message}`);
    } finally {
      previewButton.disabled = false;
      previewButton.textContent = "Refresh Inbox";
    }
  }

  async function initializeConnection() {
    try {
      const result = await post(STATUS);
      if (!result?.connected) throw new Error("Gmail is not connected.");
      if (connectButton) {
        connectButton.hidden = false;
        connectButton.textContent = "Reconnect Gmail";
        if (result.connectUrl) connectButton.href = result.connectUrl;
      }
      previewButton.disabled = false;
      previewButton.textContent = "Load Inbox";
      await refreshQueue();
    } catch (error) {
      if (connectButton) connectButton.hidden = false;
      previewButton.disabled = true;
      setStatus(`Gmail connection required: ${error.message}`);
    }
  }

  function replacePreviewButton() {
    const oldButton = document.getElementById("gmail-preview-button");
    if (!oldButton) return null;
    const replacement = oldButton.cloneNode(true);
    oldButton.replaceWith(replacement);
    replacement.disabled = false;
    replacement.textContent = "Load Inbox";
    replacement.addEventListener("click", () => refreshQueue());
    return replacement;
  }

  function install() {
    if (!/\/today\.html$/i.test(location.pathname)) return;
    injectStyles();

    preview = document.getElementById("gmail-preview");
    statusCopy = document.getElementById("gmail-status-copy");
    connectButton = document.getElementById("gmail-connect-button");
    previewButton = replacePreviewButton();

    if (!preview || !statusCopy || !previewButton) {
      setTimeout(install, 200);
      return;
    }

    const title = document.getElementById("morning-command-title");
    if (title) title.textContent = "Review each Gmail message and choose what happens next.";

    document.getElementById("gcm-decision-holds")?.remove();
    preview.replaceChildren();
    preview.hidden = false;
    initializeConnection();
  }

  install();
})();
