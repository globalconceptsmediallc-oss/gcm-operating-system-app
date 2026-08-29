/* =========================================================
   Global Concepts Media Operating System
   File: shared/today-gmail-decisions.js
   Version: 2.3.1
   Status: Production Road-Test Candidate
   Source: shared/today-gmail-decisions.js 2.1.0 production
   Sprint: Gmail — Processed Thread Re-entry Guard
   Purpose:
   Make Morning Command a fast human decision surface: show the live source
   email, choose the client, expose every operational route, support immediate
   human action without creating artificial Work, and keep GCM OS as the home
   base until the operator confirms the selected outcome.

   Changes — 2.3.1:
   - Adds a browser-side processed-thread safety ledger after a successful human route.
   - Suppresses an already-routed conversation if the Worker preview returns the same latest Gmail message again.
   - Automatically allows a thread back into Morning Command when Gmail supplies a newer latest-message ID.
   - Prevents stale Worker preview results from causing duplicate Monitoring, Information, Investigation, or Requested Work writes.
   - Keeps the Worker/D1 record authoritative; this is a duplicate-write safety guard, not a replacement for Worker processed-state repair.

   Changes — 2.3.0:
   - Treats one Gmail thread as one Morning Command decision card.
   - Shows every message in the conversation chronologically inside Source Conversation.
   - Sends gmailThreadId with every route so one decision applies to the whole thread.
   - Counts unprocessed Gmail conversations rather than individual replies.
   - Preserves Handle Now home-base behavior and opens the whole Gmail thread as fallback.

   Changes — 2.2.0:
   - Keeps GCM OS open while Handle Now tasks are completed in a separate tab.
   - Extracts usable http/https task links generically from the live Gmail source
     before presentation cleanup and exposes them as optional action buttons.
   - Keeps Open Email in Gmail as the fallback when the source task link is not
     useful or the operator needs the original Gmail context.
   - All Handle Now external links use a new browsing context with noopener and
     noreferrer so navigating the task cannot replace the Morning Command tab.
   - Adds no sender-specific, client-specific, or AI classification rules.

   Changes — 2.1.0:
   - Adds Handle Now for small real actions that should be completed immediately.
   - Handle Now performs zero OS writes and leaves Gmail unchanged when selected.
   - Provides Open Email in Gmail using the Gmail thread ID returned by preview.
   - Provides Completed — Clear Gmail only after the operator confirms the action.
   - Completion moves the message to Gmail Trash with zero OS records created.
   - Adds no sender-specific, client-specific, or AI classification rules.

   Changes — 2.0.2:
   - Removes flattened link-wrapper debris such as <https://...> and href=...
     from Source Email presentation while preserving visible human-readable text.
   - Keeps ordinary URLs that are part of the actual message evidence.
   - Applies no sender-specific, client-specific, or business-classification rules.

   Changes — 2.0.1:
   - Decodes HTML character references before Source Email display.
   - Handles named, decimal, hexadecimal, and double-encoded entities without
     sender-specific rules.
   - Converts non-breaking spaces to normal spaces and normalizes presentation
     whitespace so Gmail template markup does not leak into the decision card.

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
  const FILE_VERSION = "2.3.1";
  const HUMAN_ROUTING_VERSION = "2.3.1";
  const WORKER_URL =
    "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const PREVIEW = "preview-gmail-inbox";
  const ROUTE = "route-gmail-disposition";
  const DELETE = "delete-gmail-no-action";
  const CLIENT_DIRECTORY = "get-client-directory";
  const STATUS = "get-gmail-status";
  const MAX_VISIBLE_EMAILS = 10;
  const MAX_ACTION_LINKS = 3;
  const PROCESSED_LEDGER_KEY = "gcm_morning_command_processed_threads_v1";
  const PROCESSED_LEDGER_TTL_MS = 1000 * 60 * 60 * 24 * 90;

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
      .gcm-human-gmail-source-body{max-height:390px;overflow:auto;margin:0;padding:13px 14px;border:1px solid var(--border,#dbe2ec);border-radius:10px;background:#fbfcfe;color:var(--text,#132238);font-family:inherit;font-size:.77rem;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
      .gcm-human-gmail-decision{margin-top:14px;padding-top:13px;border-top:1px solid var(--border,#dbe2ec)}
      .gcm-human-gmail-decision-label{display:block;margin-bottom:8px;color:var(--text-soft,#8290a3);font-size:.64rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
      .gcm-human-gmail-buttons{display:flex;flex-wrap:wrap;gap:8px}
      .gcm-human-gmail-buttons .button{min-height:36px;padding:0 12px;font-size:.73rem}
      .gcm-route-now{border-color:#9dbcf0!important;background:#eef5ff!important;color:#165fbd!important}
      .gcm-route-delete{border-color:#e5bcbc!important;background:#fff7f7!important;color:#9d3030!important}
      .gcm-route-information{border-color:#cbd6e4!important;background:#f8fafc!important;color:#34465d!important}
      .gcm-route-monitoring{border-color:#bcd8c8!important;background:#f3fbf6!important;color:#226342!important}
      .gcm-route-investigation{border-color:#e7c987!important;background:#fff8e8!important;color:#805615!important}
      .gcm-route-work{border-color:#a9c5f1!important;background:#edf5ff!important;color:#185fc8!important}
      .gcm-human-gmail-now-panel{margin-top:12px;padding:13px 14px;border:1px solid #b9cdf0;border-radius:10px;background:#f5f9ff}
      .gcm-human-gmail-now-panel strong{display:block;color:#173f72;font-size:.78rem}
      .gcm-human-gmail-now-panel p{margin:5px 0 10px;color:var(--text-muted,#637083);font-size:.73rem;line-height:1.45}
      .gcm-human-gmail-now-actions{display:flex;flex-wrap:wrap;gap:8px}
      .gcm-human-gmail-now-actions .button{min-height:34px;padding:0 11px;font-size:.72rem;text-decoration:none}
      .gcm-human-gmail-now-action{border-color:#98b8e8!important;background:#fff!important;color:#165fbd!important}
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

  function decodeEmailText(value) {
    let text = String(value ?? "");
    const decoder = document.createElement("textarea");

    // Two passes intentionally handle nested encoding such as &amp;#160;.
    for (let pass = 0; pass < 2; pass += 1) {
      decoder.innerHTML = text;
      const decoded = decoder.value;
      if (decoded === text) break;
      text = decoded;
    }

    return text;
  }

  function cleanSourceEmail(value) {
    let text = decodeEmailText(value);

    // Gmail/plain-text conversions can leave URL wrappers and href attributes
    // behind after markup is flattened. Remove only those presentation artifacts;
    // ordinary URLs in the actual message remain visible as evidence.
    text = text
      .replace(/\bhref\s*=\s*(?:"[^"]*"|'[^']*'|<[^>\n]+>|[^\s>]+)/gi, " ")
      .replace(/<https?:\/\/[^>\n]+>/gi, " ");

    return text
      .replace(/\u00a0/g, " ")
      .replace(/\r/g, "")
      .replace(/[\t ]+\n/g, "\n")
      .replace(/[\t ]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function cleanActionLabel(value, fallback) {
    const label = String(value || "")
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/[<>"']/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(/(?:[.!?]\s+|\||•|›|»)/)
      .pop()
      .trim();

    if (!label || label.length < 2 || label.length > 52) return fallback;
    return label;
  }

  function extractActionLinks(value) {
    const text = decodeEmailText(value);
    const links = [];
    const seen = new Set();

    function addLink(url, label = "") {
      let href = String(url || "").trim();
      href = href.replace(/[),.;\]]+$/g, "");
      if (!/^https?:\/\//i.test(href) || seen.has(href)) return;

      seen.add(href);
      const fallback = links.length
        ? `Open Task Link ${links.length + 1}`
        : "Open Task Link";
      links.push({ href, label:cleanActionLabel(label, fallback) });
    }

    const hrefPattern = /(?:([^<\n]{2,80}?)\s+)?href\s*=\s*(?:"(https?:\/\/[^"\n]+)"|'(https?:\/\/[^'\n]+)'|<(https?:\/\/[^>\n]+)>|(https?:\/\/[^\s>\n]+))/gi;
    let match;
    while ((match = hrefPattern.exec(text)) && links.length < MAX_ACTION_LINKS) {
      addLink(match[2] || match[3] || match[4] || match[5], match[1] || "");
    }

    const wrappedPattern = /<(https?:\/\/[^>\n]+)>/gi;
    while ((match = wrappedPattern.exec(text)) && links.length < MAX_ACTION_LINKS) {
      addLink(match[1]);
    }

    return links.slice(0, MAX_ACTION_LINKS);
  }

  function actionLinkButtons(rawSource) {
    return extractActionLinks(rawSource)
      .map(link =>
        `<a class="button button-secondary gcm-human-gmail-now-action" data-gcm-open-action href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)} ↗</a>`
      )
      .join("");
  }

  function gmailThreadUrl(message) {
    const target = String(message?.threadId || message?.gmailMessageId || "").trim();
    return target
      ? `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(target)}`
      : "https://mail.google.com/mail/u/0/#inbox";
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

  function loadProcessedLedger() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROCESSED_LEDGER_KEY) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

      const now = Date.now();
      let changed = false;
      Object.keys(parsed).forEach(key => {
        const processedAt = Number(parsed[key]?.processedAt || 0);
        if (!processedAt || now - processedAt > PROCESSED_LEDGER_TTL_MS) {
          delete parsed[key];
          changed = true;
        }
      });

      if (changed) localStorage.setItem(PROCESSED_LEDGER_KEY, JSON.stringify(parsed));
      return parsed;
    } catch {
      return {};
    }
  }

  function saveProcessedLedger(ledger) {
    try {
      localStorage.setItem(PROCESSED_LEDGER_KEY, JSON.stringify(ledger || {}));
    } catch {}
  }

  function markThreadLocallyProcessed(gmailThreadId, gmailMessageId) {
    const threadId = String(gmailThreadId || "").trim();
    const messageId = String(gmailMessageId || "").trim();
    const key = threadId || messageId;
    if (!key) return;

    const ledger = loadProcessedLedger();
    ledger[key] = {
      gmailThreadId:threadId,
      gmailMessageId:messageId,
      processedAt:Date.now()
    };
    saveProcessedLedger(ledger);
  }

  function isLocallyProcessed(message) {
    const threadId = String(message?.threadId || "").trim();
    const messageId = String(message?.gmailMessageId || "").trim();
    const key = threadId || messageId;
    if (!key) return false;

    const entry = loadProcessedLedger()[key];
    if (!entry) return false;

    const recordedMessageId = String(entry.gmailMessageId || "").trim();

    // A new reply in the same Gmail thread must return to Morning Command.
    if (messageId && recordedMessageId) {
      return messageId === recordedMessageId;
    }

    // Fallback only when one side lacks a Gmail message ID. Keep this short so
    // an id-less thread cannot be hidden indefinitely.
    return Date.now() - Number(entry.processedAt || 0) < 5 * 60 * 1000;
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

  function threadMessages(message) {
    const messages = Array.isArray(message?.threadMessages) ? message.threadMessages : [];
    return messages.length ? messages : [message];
  }

  function rawConversationSource(message) {
    return threadMessages(message)
      .map(item => item?.bodyText || item?.snippet || item?.subject || "")
      .filter(Boolean)
      .join("\n\n");
  }

  function formatConversationSource(message) {
    const messages = threadMessages(message);
    if (messages.length <= 1) {
      return cleanSourceEmail(message?.bodyText || message?.snippet || message?.subject || "");
    }

    return messages.map((item, index) => {
      const header = [
        `MESSAGE ${index + 1} OF ${messages.length}`,
        `From: ${item?.from || "Unknown sender"}`,
        item?.to ? `To: ${item.to}` : "",
        `Date: ${item?.date || "Unknown date"}`
      ].filter(Boolean).join("\n");
      const body = cleanSourceEmail(item?.bodyText || item?.snippet || item?.subject || "");
      return `${header}\n\n${body}`.trim();
    }).join("\n\n────────────────────────────────────────\n\n");
  }

  function routeButton(label, disposition, className) {
    return `<button type="button" class="button button-secondary ${className}" data-gcm-disposition="${escapeHtml(disposition)}">${escapeHtml(label)}</button>`;
  }

  function renderMessage(message) {
    const article = document.createElement("article");
    article.className = "gcm-human-gmail-card";
    article.dataset.gmailId = String(message?.gmailMessageId || "");
    article.dataset.gmailThreadId = String(message?.threadId || "");

    const rawSource = rawConversationSource(message);
    const source = formatConversationSource(message);
    const taskLinks = actionLinkButtons(rawSource);
    const count = Number(message?.threadMessageCount || threadMessages(message).length || 1);
    const meta = count > 1
      ? `${count} messages · Latest: ${message?.from || "Unknown sender"} · ${message?.date || "Unknown date"}`
      : `${message?.from || "Unknown sender"} · ${message?.date || "Unknown date"}`;

    article.innerHTML = `
      <div class="gcm-human-gmail-header">
        <div>
          <h3 class="gcm-human-gmail-title">${escapeHtml(message?.subject || "(No subject)")}</h3>
          <span class="gcm-human-gmail-meta">${escapeHtml(meta)}</span>
        </div>
        <span class="gcm-human-gmail-route">Choose route</span>
      </div>
      <div class="gcm-human-gmail-client-row">
        <label>Client</label>
        <select class="gcm-human-gmail-client" aria-label="Client for ${escapeHtml(message?.subject || "email")}">${clientOptions(message)}</select>
      </div>
      <div class="gcm-human-gmail-source">
        <span class="gcm-human-gmail-source-label">${count > 1 ? "Source Conversation" : "Source Email"}</span>
        <pre class="gcm-human-gmail-source-body">${escapeHtml(source || "No message body was returned by Gmail.")}</pre>
      </div>
      <div class="gcm-human-gmail-decision">
        <span class="gcm-human-gmail-decision-label">Your Decision</span>
        <div class="gcm-human-gmail-buttons">
          <button type="button" class="button button-secondary gcm-route-now" data-gcm-handle-now>Handle Now</button>
          ${routeButton("Delete — No Action", "delete", "gcm-route-delete")}
          ${routeButton("Information", "information", "gcm-route-information")}
          ${routeButton("Monitoring", "monitoring", "gcm-route-monitoring")}
          ${routeButton("Investigation", "investigation", "gcm-route-investigation")}
          ${routeButton("Requested Work", "requested_work", "gcm-route-work")}
        </div>
        <div class="gcm-human-gmail-now-panel" data-gcm-handle-now-panel hidden>
          <strong>Handle Now — GCM OS stays open while you complete the action.</strong>
          <p>Open the task beside Morning Command, finish it, then return here and confirm completion. Gmail and GCM OS remain unchanged until you do.</p>
          <div class="gcm-human-gmail-now-actions">
            ${taskLinks}
            <a class="button button-secondary" data-gcm-open-gmail href="${escapeHtml(gmailThreadUrl(message))}" target="_blank" rel="noopener noreferrer">Open Email in Gmail ↗</a>
            <button type="button" class="button button-primary" data-gcm-complete-now>Completed — Clear Gmail</button>
            <button type="button" class="button button-secondary" data-gcm-cancel-now>Back</button>
          </div>
        </div>
        <span class="gcm-human-gmail-status">Read the source conversation and choose what happens next. One route applies to the whole Gmail thread. Handle Now keeps GCM OS as home base until you confirm completion. AI does not control these routes.</span>
      </div>
    `;

    article.querySelector("[data-gcm-handle-now]")?.addEventListener("click", () => {
      handleNow(article);
    });
    article.querySelector("[data-gcm-complete-now]")?.addEventListener("click", event => {
      completeHandleNow(article, event.currentTarget);
    });
    article.querySelector("[data-gcm-cancel-now]")?.addEventListener("click", () => {
      cancelHandleNow(article);
    });
    article.querySelectorAll("[data-gcm-disposition]").forEach(button => {
      button.addEventListener("click", () => handleDisposition(article, button));
    });

    return article;
  }

  function handleNow(card) {
    if (busy) return;
    const panel = card.querySelector("[data-gcm-handle-now-panel]");
    const route = card.querySelector(".gcm-human-gmail-route");
    const status = card.querySelector(".gcm-human-gmail-status");
    if (panel) panel.hidden = false;
    if (route) route.textContent = "Handle now";
    if (status) {
      status.textContent = "Handle Now selected. GCM OS stays open; Gmail and GCM OS are unchanged until you confirm completion.";
    }
    setStatus("Handle Now: open the task beside GCM OS, complete it, then return here to confirm. Nothing is cleared yet.");
  }

  function cancelHandleNow(card) {
    if (busy) return;
    const panel = card.querySelector("[data-gcm-handle-now-panel]");
    const route = card.querySelector(".gcm-human-gmail-route");
    const status = card.querySelector(".gcm-human-gmail-status");
    if (panel) panel.hidden = true;
    if (route) route.textContent = "Choose route";
    if (status) {
      status.textContent = "Read the source conversation and choose what happens next. One route applies to the whole Gmail thread. Handle Now keeps GCM OS as home base until you confirm completion. AI does not control these routes.";
    }
  }

  async function completeHandleNow(card, button) {
    if (busy) return;
    const gmailMessageId = String(card.dataset.gmailId || "").trim();
    const gmailThreadId = String(card.dataset.gmailThreadId || "").trim();
    if (!gmailMessageId && !gmailThreadId) {
      const status = card.querySelector(".gcm-human-gmail-status");
      if (status) status.textContent = "Could not clear Gmail because the conversation ID is missing.";
      return;
    }

    busy = true;
    setCardBusy(card, button, "Confirming Handle Now completion and clearing Gmail conversation…");

    try {
      const result = await post(DELETE, { gmailMessageId, gmailThreadId });
      if (!result?.gmailMovedToTrash) {
        throw new Error("Gmail did not confirm that the completed conversation moved to Trash.");
      }
      markThreadLocallyProcessed(gmailThreadId, gmailMessageId);
      setStatus("Handle Now complete: action confirmed · Gmail conversation moved to Trash · 0 OS records created.");
      await window.GCMOShell?.refreshNavAttention?.();
      busy = false;
      await refreshQueue({ preserveStatus:true });
    } catch (error) {
      clearCardBusy(card, `Completion was not cleared: ${error.message}`);
      setStatus(`Handle Now left Gmail unchanged: ${error.message}`);
    } finally {
      busy = false;
    }
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
    const gmailThreadId = String(card.dataset.gmailThreadId || "").trim();
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
        ? "Deleting Gmail conversation · no OS record…"
        : `Saving ${button.textContent.trim()} and clearing Gmail…`
    );

    try {
      const result = disposition === "delete"
        ? await post(DELETE, { gmailMessageId, gmailThreadId })
        : await post(ROUTE, { gmailMessageId, gmailThreadId, disposition, clientCode, clientName });

      markThreadLocallyProcessed(gmailThreadId, gmailMessageId);
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
      return `${label}: conversation was already preserved in GCM OS · Gmail thread cleared.`;
    }
    if (result?.gmailMovedToTrash) {
      return "Delete — No Action: Gmail conversation moved to Trash · 0 OS records created.";
    }
    if (result?.disposition === "monitoring") {
      return `Monitoring saved${result.activityRecordId ? ` as Activity #${result.activityRecordId}` : ""} · Gmail thread cleared.`;
    }
    if (result?.workItemId) {
      return `Requested Work saved · Communication #${result.communicationId || "—"} + Work Item #${result.workItemId} · Gmail thread cleared.`;
    }
    if (result?.investigationId) {
      return `Investigation saved · Communication #${result.communicationId || "—"} + Investigation #${result.investigationId} · Gmail thread cleared.`;
    }
    return `Information saved · Communication #${result?.communicationId || "—"} · Gmail thread cleared.`;
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
        limit:MAX_VISIBLE_EMAILS + 20,
        scanLimit:100
      });
      const returnedMessages = Array.isArray(result?.messages) ? result.messages : [];
      const messages = returnedMessages
        .filter(message => !isLocallyProcessed(message))
        .slice(0, MAX_VISIBLE_EMAILS);
      preview.replaceChildren(...messages.map(renderMessage));

      if (!messages.length) {
        const empty = document.createElement("div");
        empty.className = "gcm-human-gmail-empty";
        empty.textContent = "No unprocessed Gmail conversations remain in Morning Command.";
        preview.replaceChildren(empty);
        setStatus("Morning Command is clear. No unprocessed Gmail conversations remain in the operational queue.");
      } else if (!preserveStatus) {
        const remaining = messages.length;
        const suppressed = Math.max(0, returnedMessages.length - messages.length);
        setStatus(`${remaining} unprocessed Gmail conversation${remaining === 1 ? "" : "s"} ready. Read the full thread and choose one route.${suppressed ? ` ${suppressed} already-routed stale preview ${suppressed === 1 ? "conversation was" : "conversations were"} suppressed.` : ""}`);
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
    if (title) title.textContent = "Review each Gmail conversation and choose what happens next.";

    document.getElementById("gcm-decision-holds")?.remove();
    preview.replaceChildren();
    preview.hidden = false;
    initializeConnection();
  }

  install();
})();