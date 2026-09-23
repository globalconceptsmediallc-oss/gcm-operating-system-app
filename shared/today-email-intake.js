/* =========================================================
   Global Concepts Media Operating System
   File: shared/today-email-intake.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Morning Command — Universal Email Intake Read Path
   Purpose:
   Replace Gmail inbox scanning on Today with the durable D1 Universal Email
   Intake queue. This phase is intentionally read-only: it proves Morning
   Command can load provider-independent email evidence without Google API use.

   Changes — 1.0.0:
   - Loads ready_for_review records through get-email-intake-queue.
   - Removes Gmail connection/status requirements from Morning Command display.
   - Replaces Refresh Inbox with Refresh Intake.
   - Shows sender, subject, received time, intake address, and preserved body.
   - Performs no decision writes and no Gmail API calls.
   ========================================================= */

(() => {
  "use strict";

  const FILE_VERSION = "1.0.0";
  const WORKER_URL =
    "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const QUEUE_ACTION = "get-email-intake-queue";
  const MAX_VISIBLE_EMAILS = 10;

  let previewButton = null;
  let preview = null;
  let statusCopy = null;
  let connectButton = null;
  let busy = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function injectStyles() {
    if (document.getElementById("gcm-universal-email-intake-style")) return;

    const style = document.createElement("style");
    style.id = "gcm-universal-email-intake-style";
    style.textContent = `
      .gcm-intake-card{padding:18px;border:1px solid var(--border,#dbe2ec);border-radius:14px;background:#fff}
      .gcm-intake-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .gcm-intake-title{margin:0;color:var(--gcm-navy-950,#071426);font-size:.95rem;line-height:1.35}
      .gcm-intake-meta{display:block;margin-top:4px;color:var(--text-muted,#637083);font-size:.74rem;line-height:1.45}
      .gcm-intake-route{flex:0 0 auto;display:inline-flex;align-items:center;min-height:26px;padding:0 9px;border-radius:999px;background:var(--info-soft,#edf5ff);color:var(--info,#245fae);font-size:.67rem;font-weight:900}
      .gcm-intake-source{margin-top:13px}
      .gcm-intake-label{display:block;margin-bottom:7px;color:var(--text-soft,#8290a3);font-size:.64rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
      .gcm-intake-body{max-height:390px;overflow:auto;margin:0;padding:13px 14px;border:1px solid var(--border,#dbe2ec);border-radius:10px;background:#fbfcfe;color:var(--text,#132238);font-family:inherit;font-size:.77rem;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
      .gcm-intake-readonly{margin-top:13px;padding:11px 12px;border:1px solid #d7e2ef;border-radius:10px;background:#f7faff;color:#52647a;font-size:.72rem;font-weight:750;line-height:1.45}
      .gcm-intake-empty{padding:18px;border:1px dashed var(--border,#dbe2ec);border-radius:12px;background:#fbfcfe;color:var(--text-muted,#637083);font-size:.8rem;text-align:center}
      @media(max-width:760px){.gcm-intake-header{display:block}.gcm-intake-route{margin-top:9px}}
    `;

    document.head.appendChild(style);
  }

  async function post(action, extra = {}) {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ action, ...extra })
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

  function formatReceivedAt(value) {
    if (!value) return "Received time unavailable";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString();
  }

  function renderRecord(record) {
    const senderName = String(record?.sender?.name || "").trim();
    const senderAddress = String(record?.sender?.address || "").trim();
    const sender = senderName && senderAddress
      ? `${senderName} <${senderAddress}>`
      : senderAddress || senderName || "Unknown sender";

    const intakeAddress = String(record?.intake?.address || "").trim();
    const body = String(record?.bodyText || "").trim() || "[No readable message body was preserved.]";

    const article = document.createElement("article");
    article.className = "gcm-intake-card";
    article.dataset.intakeId = String(record?.id || "");

    article.innerHTML = `
      <div class="gcm-intake-header">
        <div>
          <h3 class="gcm-intake-title">${escapeHtml(record?.subject || "(No subject)")}</h3>
          <span class="gcm-intake-meta">${escapeHtml(sender)} · ${escapeHtml(formatReceivedAt(record?.receivedAt))}</span>
          ${intakeAddress ? `<span class="gcm-intake-meta">Intake: ${escapeHtml(intakeAddress)}</span>` : ""}
        </div>
        <span class="gcm-intake-route">Ready for review</span>
      </div>
      <div class="gcm-intake-source">
        <span class="gcm-intake-label">Source Email</span>
        <pre class="gcm-intake-body">${escapeHtml(body)}</pre>
      </div>
      <div class="gcm-intake-readonly">
        Read-only verification phase. This message is being loaded from D1, not Gmail.
        Decision routing will be connected after this read path is verified.
      </div>
    `;

    return article;
  }

  function setStatus(text) {
    if (statusCopy) statusCopy.textContent = text;
  }

  async function refreshQueue() {
    if (busy || !preview || !previewButton) return;

    busy = true;
    preview.hidden = false;
    previewButton.disabled = true;
    previewButton.textContent = "Loading…";
    setStatus("Loading the Universal Email Intake queue from D1. No Gmail scan is running.");

    try {
      const result = await post(QUEUE_ACTION, {
        workspaceKey: "gcm",
        limit: MAX_VISIBLE_EMAILS
      });

      const records = Array.isArray(result?.queue) ? result.queue : [];
      preview.replaceChildren(...records.map(renderRecord));

      if (!records.length) {
        const empty = document.createElement("div");
        empty.className = "gcm-intake-empty";
        empty.textContent = "No email intake records are waiting for review.";
        preview.replaceChildren(empty);
        setStatus("Morning Command is clear. No Universal Email Intake records are waiting for review.");
      } else {
        const total = Number(result?.counts?.readyForReview || records.length);
        setStatus(
          `${total} intake email${total === 1 ? "" : "s"} ready for review. Loaded directly from D1 with no Gmail API call.`
        );
      }
    } catch (error) {
      preview.replaceChildren();

      const failed = document.createElement("div");
      failed.className = "gcm-intake-empty";
      failed.textContent = `Could not load Universal Email Intake: ${error.message}`;
      preview.appendChild(failed);

      setStatus(`Universal Email Intake load failed: ${error.message}`);
    } finally {
      busy = false;
      previewButton.disabled = false;
      previewButton.textContent = "Refresh Intake";
    }
  }

  function replacePreviewButton() {
    const oldButton = document.getElementById("gmail-preview-button");
    if (!oldButton) return null;

    const replacement = oldButton.cloneNode(true);
    oldButton.replaceWith(replacement);

    replacement.disabled = false;
    replacement.textContent = "Refresh Intake";
    replacement.addEventListener("click", refreshQueue);

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

    if (connectButton) {
      connectButton.hidden = true;
      connectButton.removeAttribute("href");
    }

    const title = document.getElementById("morning-command-title");
    if (title) {
      title.textContent = "Review incoming operational email from the Universal Intake queue.";
    }

    preview.replaceChildren();
    preview.hidden = false;
    refreshQueue();
  }

  install();

  console.info(`GCM Universal Email Intake Today loader ${FILE_VERSION} active.`);
})();
