/* =========================================================
   Global Concepts Media Operating System
   File: shared/today-email-intake.js
   Version: 1.6.1
   Status: Production Road-Test Candidate
   Sprint: Morning Command — Universal Email Intake No-Action Routing
   Purpose:
   Replace Gmail inbox scanning on Today with the durable D1 Universal Email
   Intake queue. This phase is intentionally read-only: it proves Morning
   Command can load provider-independent email evidence without Google API use.

   Changes — 1.6.1:
   - Sends the D1-approved disposition key requested_work for Create Work Item.
   - Preserves the visible Create Work Item label and all route safety checks.

   Changes — 1.6.0:
   - Adds Create Work Item for direct, already-defined requested work.
   - Work Item requires client selection and creates one Communication plus one Work Item.
   - Work Item creates no Proof/history Activity Record and no Investigation.
   - Preserves Information, Monitoring, Investigation, and Delete routes unchanged.

   Changes — 1.5.0:
   - Adds Start Investigation.
   - Investigation requires client selection and creates one Communication plus one Investigation.
   - Investigation creates no Proof/history Activity Record and no Work Item.
   - Preserves Information, Monitoring, and Delete routes unchanged.

   Changes — 1.4.0:
   - Adds Save as Monitoring.
   - Monitoring requires client selection and creates one Proof/history activity record.
   - Monitoring creates no Communication, Investigation, or Work Item.
   - Preserves Information and Delete routes unchanged.

   Changes — 1.3.0:
   - Adds Information as the second Universal Email Intake decision.
   - Loads the D1 client directory and requires an explicit client selection.
   - Information creates one Communication/history record and no Investigation or Work Item.
   - Keeps Delete — No Action Required two-step confirmation unchanged.

   Changes — 1.2.0:
   - Requires two deliberate operator clicks before no-action processing.
   - First click only arms the control; it performs no network request.
   - Second click within 10 seconds sends an explicit backend confirmation token.
   - The Worker independently rejects any unconfirmed no-action request.

   Changes — 1.1.0:
   - Adds Delete — No Action Required for a durable intake record.
   - The action preserves the email_intake evidence row, marks it processed,
     creates zero downstream records, and refreshes the D1 queue.
   - Still performs no Gmail API calls.

   Changes — 1.0.0:
   - Loads ready_for_review records through get-email-intake-queue.
   - Removes Gmail connection/status requirements from Morning Command display.
   - Replaces Refresh Inbox with Refresh Intake.
   - Shows sender, subject, received time, intake address, and preserved body.
   - Performs no decision writes and no Gmail API calls.
   ========================================================= */

(() => {
  "use strict";

  const FILE_VERSION = "1.6.1";
  const WORKER_URL =
    "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const QUEUE_ACTION = "get-email-intake-queue";
  const DISPOSITION_ACTION = "route-email-intake-disposition";
  const CLIENT_DIRECTORY_ACTION = "get-client-directory";
  const MAX_VISIBLE_EMAILS = 10;

  let previewButton = null;
  let preview = null;
  let statusCopy = null;
  let connectButton = null;
  let busy = false;
  let clientDirectory = [];

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
      .gcm-intake-client-row{display:grid;grid-template-columns:auto minmax(220px,420px);align-items:center;gap:10px;margin-top:13px;padding-top:13px;border-top:1px solid var(--border,#dbe2ec)}
      .gcm-intake-client-label{color:var(--text-soft,#8290a3);font-size:.64rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
      .gcm-intake-client-select{min-height:36px;border:1px solid var(--border,#dbe2ec);border-radius:9px;background:#fff;padding:0 10px;color:var(--text,#132238);font:inherit;font-size:.75rem}
      .gcm-intake-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}
      .gcm-intake-information{min-height:36px;padding:0 12px;border:1px solid #b9d3f5;border-radius:9px;background:#f3f8ff;color:#1f5fae;font-weight:850;cursor:pointer}
      .gcm-intake-monitoring{min-height:36px;padding:0 12px;border:1px solid #c9d6b7;border-radius:9px;background:#f7faF2;color:#4d6b2f;font-weight:850;cursor:pointer}
      .gcm-intake-monitoring:hover,.gcm-intake-monitoring:focus-visible{background:#f0f7e8;outline:none}
      .gcm-intake-monitoring:disabled{opacity:.55;cursor:not-allowed}
      .gcm-intake-investigation{min-height:36px;padding:0 12px;border:1px solid #d7c49c;border-radius:9px;background:#fffaf0;color:#7b5a1d;font-weight:850;cursor:pointer}
      .gcm-intake-investigation:hover,.gcm-intake-investigation:focus-visible{background:#fff5df;outline:none}
      .gcm-intake-investigation:disabled{opacity:.55;cursor:not-allowed}
      .gcm-intake-work{min-height:36px;padding:0 12px;border:1px solid #cabdf1;border-radius:9px;background:#f8f5ff;color:#5d42a5;font-weight:850;cursor:pointer}
      .gcm-intake-work:hover,.gcm-intake-work:focus-visible{background:#f1ecff;outline:none}
      .gcm-intake-work:disabled{opacity:.55;cursor:not-allowed}
      .gcm-intake-information:hover,.gcm-intake-information:focus-visible{background:#eaf3ff;outline:none}
      .gcm-intake-information:disabled{opacity:.55;cursor:not-allowed}
      .gcm-intake-delete{min-height:36px;padding:0 12px;border:1px solid #e5bcbc;border-radius:9px;background:#fff7f7;color:#9d3030;font-weight:850;cursor:pointer}
      .gcm-intake-delete:hover,.gcm-intake-delete:focus-visible{background:#fff0f0;outline:none}
      .gcm-intake-delete[data-confirm-armed="true"]{background:#ffe8e8;border-color:#d78484;color:#7f2020}
      .gcm-intake-delete:disabled{opacity:.6;cursor:wait}
      .gcm-intake-action-status{color:var(--text-muted,#637083);font-size:.72rem;font-weight:750}
      .gcm-intake-empty{padding:18px;border:1px dashed var(--border,#dbe2ec);border-radius:12px;background:#fbfcfe;color:var(--text-muted,#637083);font-size:.8rem;text-align:center}
      @media(max-width:760px){.gcm-intake-header{display:block}.gcm-intake-route{margin-top:9px}.gcm-intake-client-row{grid-template-columns:1fr}}
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
    const clientOptions = buildClientOptions(record?.client?.id);

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
      <div class="gcm-intake-client-row">
        <span class="gcm-intake-client-label">Client</span>
        <select class="gcm-intake-client-select" data-gcm-intake-client aria-label="Choose client for ${escapeHtml(record?.subject || "email intake")}">
          ${clientOptions}
        </select>
      </div>
      <div class="gcm-intake-actions">
        <button class="gcm-intake-information" type="button" data-gcm-intake-information data-intake-id="${escapeHtml(record?.id || "")}">
          Save as Information
        </button>
        <button class="gcm-intake-monitoring" type="button" data-gcm-intake-monitoring data-intake-id="${escapeHtml(record?.id || "")}">
          Save as Monitoring
        </button>
        <button class="gcm-intake-investigation" type="button" data-gcm-intake-investigation data-intake-id="${escapeHtml(record?.id || "")}">
          Start Investigation
        </button>
        <button class="gcm-intake-work" type="button" data-gcm-intake-work data-intake-id="${escapeHtml(record?.id || "")}">
          Create Work Item
        </button>
        <button class="gcm-intake-delete" type="button" data-gcm-intake-delete data-intake-id="${escapeHtml(record?.id || "")}">
          Delete — No Action Required
        </button>
        <span class="gcm-intake-action-status" data-gcm-intake-action-status>
          Evidence remains in D1 · choose one route
        </span>
      </div>
    `;

    const informationButton = article.querySelector("[data-gcm-intake-information]");
    informationButton?.addEventListener("click", () => handleInformation(article, informationButton));

    const monitoringButton = article.querySelector("[data-gcm-intake-monitoring]");
    monitoringButton?.addEventListener("click", () => handleMonitoring(article, monitoringButton));

    const investigationButton = article.querySelector("[data-gcm-intake-investigation]");
    investigationButton?.addEventListener("click", () => handleInvestigation(article, investigationButton));

    const workButton = article.querySelector("[data-gcm-intake-work]");
    workButton?.addEventListener("click", () => handleWork(article, workButton));

    const deleteButton = article.querySelector("[data-gcm-intake-delete]");
    deleteButton?.addEventListener("click", () => handleNoAction(article, deleteButton));

    return article;
  }

  function buildClientOptions(selectedId) {
    const selected = Number(selectedId);
    const options = [
      '<option value="">Choose client…</option>',
      ...clientDirectory.map(client => {
        const value = Number(client?.id);
        const label = client?.name || client?.clientCode || `Client #${value}`;
        return `<option value="${escapeHtml(value)}"${selected === value ? " selected" : ""}>${escapeHtml(label)}</option>`;
      })
    ];
    return options.join("");
  }

  async function handleInformation(card, button) {
    if (busy || !card || !button) return;

    const intakeId = Number(button.dataset.intakeId || card.dataset.intakeId);
    const select = card.querySelector("[data-gcm-intake-client]");
    const clientId = Number(select?.value);
    const actionStatus = card.querySelector("[data-gcm-intake-action-status]");

    if (!Number.isInteger(clientId) || clientId <= 0) {
      if (actionStatus) actionStatus.textContent = "Choose the client before saving this email as Information.";
      select?.focus();
      return;
    }

    busy = true;
    button.disabled = true;
    button.textContent = "Saving Information…";
    if (select) select.disabled = true;
    if (actionStatus) actionStatus.textContent = "Saving one Communication record and preserving the source email in D1…";

    try {
      const result = await post(DISPOSITION_ACTION, {
        workspaceKey:"gcm",
        intakeId,
        disposition:"information",
        clientId
      });

      if (
        Number(result?.communicationsCreated || 0) > 1 ||
        Number(result?.activityRecordsCreated || 0) !== 0 ||
        Number(result?.investigationsCreated || 0) !== 0 ||
        Number(result?.workItemsCreated || 0) !== 0 ||
        !Number(result?.communicationId) ||
        result?.evidenceRetained !== true
      ) {
        throw new Error("Information routing safety check failed.");
      }

      busy = false;
      setStatus(
        `Intake #${intakeId} saved as Information. Communication #${result.communicationId} created/linked; source evidence retained; no Investigation or Work Item created.`
      );
      await refreshQueue();
    } catch (error) {
      busy = false;
      button.disabled = false;
      button.textContent = "Save as Information";
      if (select) select.disabled = false;
      if (actionStatus) actionStatus.textContent = `Information save failed: ${error.message}`;
      setStatus(`Information disposition failed: ${error.message}`);
    }
  }

  async function handleMonitoring(card, button) {
    if (busy || !card || !button) return;

    const intakeId = Number(button.dataset.intakeId || card.dataset.intakeId);
    const select = card.querySelector("[data-gcm-intake-client]");
    const clientId = Number(select?.value);
    const actionStatus = card.querySelector("[data-gcm-intake-action-status]");

    if (!Number.isInteger(clientId) || clientId <= 0) {
      if (actionStatus) actionStatus.textContent = "Choose the client before saving this email as Monitoring.";
      select?.focus();
      return;
    }

    busy = true;
    button.disabled = true;
    button.textContent = "Saving Monitoring…";
    if (select) select.disabled = true;
    if (actionStatus) actionStatus.textContent = "Saving one Proof/history record and preserving the source email in D1…";

    try {
      const result = await post(DISPOSITION_ACTION, {
        workspaceKey:"gcm",
        intakeId,
        disposition:"monitoring",
        clientId
      });

      if (
        Number(result?.communicationsCreated || 0) !== 0 ||
        Number(result?.activityRecordsCreated || 0) > 1 ||
        Number(result?.investigationsCreated || 0) !== 0 ||
        Number(result?.workItemsCreated || 0) !== 0 ||
        !Number(result?.activityRecordId) ||
        result?.evidenceRetained !== true
      ) {
        throw new Error("Monitoring routing safety check failed.");
      }

      busy = false;
      setStatus(
        `Intake #${intakeId} saved as Monitoring. Proof/history #${result.activityRecordId} created/linked; source evidence retained; no Communication, Investigation, or Work Item created.`
      );
      await refreshQueue();
    } catch (error) {
      busy = false;
      button.disabled = false;
      button.textContent = "Save as Monitoring";
      if (select) select.disabled = false;
      if (actionStatus) actionStatus.textContent = `Monitoring save failed: ${error.message}`;
      setStatus(`Monitoring disposition failed: ${error.message}`);
    }
  }

  async function handleInvestigation(card, button) {
    if (busy || !card || !button) return;

    const intakeId = Number(button.dataset.intakeId || card.dataset.intakeId);
    const select = card.querySelector("[data-gcm-intake-client]");
    const clientId = Number(select?.value);
    const actionStatus = card.querySelector("[data-gcm-intake-action-status]");

    if (!Number.isInteger(clientId) || clientId <= 0) {
      if (actionStatus) actionStatus.textContent = "Choose the client before starting an Investigation.";
      select?.focus();
      return;
    }

    busy = true;
    button.disabled = true;
    button.textContent = "Starting Investigation…";
    if (select) select.disabled = true;
    if (actionStatus) actionStatus.textContent = "Creating one Communication and one Investigation while preserving the source email in D1…";

    try {
      const result = await post(DISPOSITION_ACTION, {
        workspaceKey:"gcm",
        intakeId,
        disposition:"investigation",
        clientId
      });

      if (
        Number(result?.communicationsCreated || 0) > 1 ||
        Number(result?.activityRecordsCreated || 0) !== 0 ||
        Number(result?.investigationsCreated || 0) > 1 ||
        Number(result?.workItemsCreated || 0) !== 0 ||
        !Number(result?.communicationId) ||
        !Number(result?.investigationId) ||
        result?.evidenceRetained !== true
      ) {
        throw new Error("Investigation routing safety check failed.");
      }

      busy = false;
      setStatus(
        `Intake #${intakeId} routed to Investigation #${result.investigationId}. Communication #${result.communicationId} linked; source evidence retained; no Work Item created.`
      );
      await refreshQueue();
    } catch (error) {
      busy = false;
      button.disabled = false;
      button.textContent = "Start Investigation";
      if (select) select.disabled = false;
      if (actionStatus) actionStatus.textContent = `Investigation save failed: ${error.message}`;
      setStatus(`Investigation disposition failed: ${error.message}`);
    }
  }

  async function handleWork(card, button) {
    if (busy || !card || !button) return;

    const intakeId = Number(button.dataset.intakeId || card.dataset.intakeId);
    const select = card.querySelector("[data-gcm-intake-client]");
    const clientId = Number(select?.value);
    const actionStatus = card.querySelector("[data-gcm-intake-action-status]");

    if (!Number.isInteger(clientId) || clientId <= 0) {
      if (actionStatus) actionStatus.textContent = "Choose the client before creating a Work Item.";
      select?.focus();
      return;
    }

    busy = true;
    button.disabled = true;
    button.textContent = "Creating Work Item…";
    if (select) select.disabled = true;
    if (actionStatus) actionStatus.textContent = "Creating one Communication and one Work Item while preserving the source email in D1…";

    try {
      const result = await post(DISPOSITION_ACTION, {
        workspaceKey:"gcm",
        intakeId,
        disposition:"requested_work",
        clientId
      });

      if (
        Number(result?.communicationsCreated || 0) > 1 ||
        Number(result?.activityRecordsCreated || 0) !== 0 ||
        Number(result?.investigationsCreated || 0) !== 0 ||
        Number(result?.workItemsCreated || 0) > 1 ||
        !Number(result?.communicationId) ||
        !Number(result?.workItemId) ||
        result?.evidenceRetained !== true
      ) {
        throw new Error("Work Item routing safety check failed.");
      }

      busy = false;
      setStatus(
        `Intake #${intakeId} routed to Work Item #${result.workItemId}. Communication #${result.communicationId} linked; source evidence retained; no Investigation created.`
      );
      await refreshQueue();
    } catch (error) {
      busy = false;
      button.disabled = false;
      button.textContent = "Create Work Item";
      if (select) select.disabled = false;
      if (actionStatus) actionStatus.textContent = `Work Item save failed: ${error.message}`;
      setStatus(`Work Item disposition failed: ${error.message}`);
    }
  }

  async function handleNoAction(card, button) {
    if (busy || !card || !button) return;

    const intakeId = Number(button.dataset.intakeId || card.dataset.intakeId);
    const actionStatus = card.querySelector("[data-gcm-intake-action-status]");

    if (!Number.isInteger(intakeId) || intakeId <= 0) {
      if (actionStatus) actionStatus.textContent = "Invalid intake record. Refresh Intake and try again.";
      return;
    }

    if (button.dataset.confirmArmed !== "true") {
      button.dataset.confirmArmed = "true";
      button.textContent = "Confirm No Action";
      if (actionStatus) {
        actionStatus.textContent = "Nothing has been changed. Click Confirm No Action again within 10 seconds to process this intake.";
      }

      window.setTimeout(() => {
        if (!button.isConnected || button.disabled) return;
        if (button.dataset.confirmArmed !== "true") return;
        button.dataset.confirmArmed = "false";
        button.textContent = "Delete — No Action Required";
        if (actionStatus) {
          actionStatus.textContent = "Evidence remains in D1 · choose one route";
        }
      }, 10000);
      return;
    }

    button.dataset.confirmArmed = "false";
    busy = true;
    button.disabled = true;
    button.textContent = "Saving…";
    if (actionStatus) actionStatus.textContent = "Confirmed. Marking no action while retaining the source evidence…";

    try {
      const result = await post(DISPOSITION_ACTION, {
        workspaceKey:"gcm",
        intakeId,
        disposition:"delete",
        confirmed:true,
        confirmation:"delete-no-action-required"
      });

      if (
        Number(result?.writesPerformed || 0) !== 0 ||
        Number(result?.communicationsCreated || 0) !== 0 ||
        Number(result?.activityRecordsCreated || 0) !== 0 ||
        Number(result?.investigationsCreated || 0) !== 0 ||
        Number(result?.workItemsCreated || 0) !== 0 ||
        result?.evidenceRetained !== true
      ) {
        throw new Error("No-action safety check failed.");
      }

      setStatus(
        `Intake #${intakeId} marked Delete — No Action Required. Source evidence was retained in D1 and 0 downstream records were created.`
      );

      busy = false;
      await refreshQueue();
    } catch (error) {
      busy = false;
      button.disabled = false;
      button.textContent = "Delete — No Action Required";
      if (actionStatus) actionStatus.textContent = `No-action save failed: ${error.message}`;
      setStatus(`No-action disposition failed: ${error.message}`);
    }
  }

  function setStatus(text) {
    if (statusCopy) statusCopy.textContent = text;
  }

  async function loadClientDirectory() {
    const result = await post(CLIENT_DIRECTORY_ACTION);
    clientDirectory = (Array.isArray(result?.clients) ? result.clients : [])
      .filter(client => ["active","prospect"].includes(String(client?.status || "").toLowerCase()));
  }

  async function refreshQueue() {
    if (busy || !preview || !previewButton) return;

    busy = true;
    preview.hidden = false;
    previewButton.disabled = true;
    previewButton.textContent = "Loading…";
    setStatus("Loading the Universal Email Intake queue from D1. No Gmail scan is running.");

    try {
      if (!clientDirectory.length) {
        await loadClientDirectory();
      }

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
