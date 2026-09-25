/* =========================================================
   Global Concepts Media Operating System
   File: shared/today-email-intake.js
   Version: 2.2.1
   Status: Production Road-Test Candidate
   Sprint: Google Review Quick Action
   Purpose:
   Keep Today lightweight. Incoming email is a signal title only until Andy
   chooses Ready for Review. Client and reporting period are inferred from
   source metadata when the evidence supports them. The operator must explicitly
   choose the durable route before the reviewed finding can be saved to D1.

   Changes — 2.2.0:
   - Detects routine positive Google Business Profile review notifications.
   - Replaces the full analysis form with a compact Reply Now + Mark Responded & Count Review workflow.
   - Shows the client's recorded review count for the source month.
   - Routine review completion creates no Finding, Communication, Investigation,
     Work Item, or Proof row; the durable email_intake source remains evidence.
   - Keeps a Use Full Review escape hatch for reviews that need operational judgment.

   Changes — 2.1.2:
   - Moves Decision / Route below Decision / next action so routing is the final human choice.
   - Keeps Client and Reporting period first, then Details, What we learned, Decision,
     and only then the final route selection before source evidence and Save & Route.

   Changes — 2.1.1:
   - Preserves the route success confirmation after the queue refreshes.
   - Keeps the processed card removed while leaving the exact Finding / Communication /
     Investigation / Work Item confirmation visible in Morning Command.
   - Applies the same durable confirmation behavior to Delete — No Action Required.

   Changes — 2.1.0:
   - Restores an explicit Decision / Route control to Signal Review.
   - Requires Monitoring, Information, Investigation, or Work Item before save.
   - Saves the three reviewed finding fields with the selected route in one action.
   - Keeps Delete — No Action Required as a separate two-step safety action.

   Changes — 2.0.4:
   - Prefills weekly Semrush reporting periods from explicit Date lines such as
     "Date: Sep, 1-8, 2026".
   - Keeps reporting-period extraction limited to source metadata only.

   Changes — 2.0.3:
   - Signal Review client selection now includes the full D1 client directory,
     including inactive/historical clients, so older reports such as South
     Florida Safes can still be reviewed and recorded accurately.
   - Non-active client statuses are labeled in the dropdown instead of hidden.

   Changes — 2.0.2:
   - Infers month-only report subjects such as "Your August Search performance"
     using the source email year, so historical Search Console reports prefill
     August 2026 instead of forcing manual entry.
   - Preserves human-led analysis and the existing Finding workflow.

   Changes — 2.0.1:
   - Prefills Client from the durable client directory by matching the source
     subject/body to the client's website domain or exact client name.
   - Prefills Reporting period from explicit source text first, then from a
     month/year named in the subject.
   - These are metadata conveniences only; they do not make business decisions.
   ========================================================= */

(() => {
  "use strict";

  const FILE_VERSION = "2.2.1";
  const WORKER_URL =
    "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const QUEUE_ACTION = "get-email-intake-queue";
  const SAVE_FINDING_ACTION = "save-email-intake-finding";
  const DISPOSITION_ACTION = "route-email-intake-disposition";
  const CLIENT_DIRECTORY_ACTION = "get-client-directory";
  const GOOGLE_REVIEW_ACTION = "google-review-quick-action";
  const MAX_VISIBLE_EMAILS = 25;

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
    if (document.getElementById("gcm-signal-review-style")) return;

    const style = document.createElement("style");
    style.id = "gcm-signal-review-style";
    style.textContent = `
      .gcm-signal-card{border:1px solid var(--border,#dbe2ec);border-radius:14px;background:#fff;overflow:hidden}
      .gcm-signal-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 16px}
      .gcm-signal-title{margin:0;color:var(--gcm-navy-950,#071426);font-size:.9rem;line-height:1.35;font-weight:850}
      .gcm-signal-review-button{flex:0 0 auto;min-height:36px;padding:0 13px;border:1px solid #b9d3f5;border-radius:9px;background:#f3f8ff;color:#1f5fae;font-weight:850;cursor:pointer}
      .gcm-signal-review-button:hover,.gcm-signal-review-button:focus-visible{background:#eaf3ff;outline:none}
      .gcm-review-panel{padding:16px;border-top:1px solid var(--border,#dbe2ec);background:#fbfcfe}
      .gcm-review-context{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;color:var(--text-muted,#637083);font-size:.72rem}
      .gcm-review-grid{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(220px,.8fr);gap:12px}
      .gcm-review-field{display:grid;gap:6px}
      .gcm-review-field.gcm-review-wide{grid-column:1/-1}
      .gcm-review-label{color:var(--text-soft,#8290a3);font-size:.64rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
      .gcm-review-input,.gcm-review-select,.gcm-review-textarea{width:100%;border:1px solid var(--border,#dbe2ec);border-radius:9px;background:#fff;color:var(--text,#132238);font:inherit;font-size:.78rem}
      .gcm-review-input,.gcm-review-select{min-height:38px;padding:0 10px}
      .gcm-review-textarea{min-height:118px;padding:10px 11px;line-height:1.5;resize:vertical}
      .gcm-review-route-note{margin:0;color:var(--text-muted,#637083);font-size:.7rem;line-height:1.45}
      .gcm-review-source{margin:12px 0;border:1px solid var(--border,#dbe2ec);border-radius:10px;background:#fff}
      .gcm-review-source summary{padding:10px 12px;cursor:pointer;color:var(--gcm-navy-900,#0b1d33);font-size:.75rem;font-weight:850}
      .gcm-review-body{max-height:360px;overflow:auto;margin:0;padding:12px;border-top:1px solid var(--border,#dbe2ec);white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text,#132238);font-family:inherit;font-size:.75rem;line-height:1.5}
      .gcm-review-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px}
      .gcm-review-save{min-height:38px;padding:0 14px;border:0;border-radius:9px;background:var(--gcm-blue-600,#1f68d8);color:#fff;font-weight:900;cursor:pointer}
      .gcm-review-secondary{min-height:38px;padding:0 13px;border:1px solid var(--border,#dbe2ec);border-radius:9px;background:#fff;color:var(--gcm-navy-900,#0b1d33);font-weight:850;cursor:pointer}
      .gcm-review-no-action{min-height:38px;padding:0 13px;border:1px solid #e5bcbc;border-radius:9px;background:#fff7f7;color:#9d3030;font-weight:850;cursor:pointer}
      .gcm-review-no-action[data-confirm-armed="true"]{background:#ffe8e8;border-color:#d78484;color:#7f2020}
      .gcm-review-status{color:var(--text-muted,#637083);font-size:.72rem;font-weight:750}
      .gcm-review-quick{display:grid;gap:14px}
      .gcm-review-quick-summary{display:grid;grid-template-columns:minmax(220px,1fr) minmax(180px,.65fr);gap:12px}
      .gcm-review-quick-card{border:1px solid var(--border,#dbe2ec);border-radius:11px;background:#fff;padding:14px}
      .gcm-review-quick-kicker{margin:0 0 5px;color:var(--text-soft,#8290a3);font-size:.64rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
      .gcm-review-quick-value{margin:0;color:var(--gcm-navy-950,#071426);font-size:1rem;font-weight:900;line-height:1.35}
      .gcm-review-count{font-size:1.55rem}
      .gcm-review-quick-note{margin:5px 0 0;color:var(--text-muted,#637083);font-size:.72rem;line-height:1.45}
      .gcm-review-reply{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 14px;border-radius:9px;background:var(--gcm-blue-600,#1f68d8);color:#fff;text-decoration:none;font-weight:900}
      .gcm-review-count-button{min-height:38px;padding:0 14px;border:0;border-radius:9px;background:#0b7a46;color:#fff;font-weight:900;cursor:pointer}
      .gcm-review-full-button{min-height:38px;padding:0 13px;border:1px solid var(--border,#dbe2ec);border-radius:9px;background:#fff;color:var(--gcm-navy-900,#0b1d33);font-weight:850;cursor:pointer}
      .gcm-intake-empty{padding:18px;border:1px dashed var(--border,#dbe2ec);border-radius:12px;background:#fbfcfe;color:var(--text-muted,#637083);font-size:.8rem;text-align:center}
      @media(max-width:760px){.gcm-signal-row{align-items:flex-start}.gcm-review-grid{grid-template-columns:1fr}}
    `;

    document.head.appendChild(style);
  }

  async function post(action, extra = {}) {
    const response = await fetch(WORKER_URL, {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        Accept:"application/json"
      },
      body:JSON.stringify({action,...extra})
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

  function normalizeHost(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = /^https?:\/\//i.test(raw) ? new URL(raw) : new URL(`https://${raw}`);
      return String(url.hostname || "").toLowerCase().replace(/^www\./,"");
    } catch {
      return raw.toLowerCase()
        .replace(/^https?:\/\//,"")
        .replace(/^www\./,"")
        .split("/")[0]
        .trim();
    }
  }

  function inferClientId(record) {
    const existing = Number(record?.client?.id);
    if (Number.isInteger(existing) && existing > 0) return existing;

    const haystack = [
      record?.subject,
      record?.bodyText,
      record?.sender?.name,
      record?.sender?.address
    ].map(value => String(value || "").toLowerCase()).join("\n");

    for (const client of clientDirectory) {
      const host = normalizeHost(client?.website);
      if (host && haystack.includes(host)) return Number(client.id);
    }

    for (const client of clientDirectory) {
      const name = String(client?.name || "").trim().toLowerCase();
      if (name && name.length >= 4 && haystack.includes(name)) return Number(client.id);
    }

    return null;
  }

  function inferReportingPeriod(record) {
    const body = String(record?.bodyText || "");
    const subject = String(record?.subject || "");

    const explicit = body.match(/(?:reporting\s*period|performance\s*period)\s*:\s*([^\n\r]+)/i);
    if (explicit?.[1]) {
      const value = explicit[1].trim().replace(/[.;]+$/,"");
      if (value) return value;
    }

    const semrushDate = body.match(/^Date:\s*([A-Za-z]{3,9}),?\s*([^\n\r]+)/im);
    if (semrushDate?.[1] && semrushDate?.[2]) {
      const months = {jan:"January",january:"January",feb:"February",february:"February",mar:"March",march:"March",apr:"April",april:"April",may:"May",jun:"June",june:"June",jul:"July",july:"July",aug:"August",august:"August",sep:"September",sept:"September",september:"September",oct:"October",october:"October",nov:"November",november:"November",dec:"December",december:"December"};
      const month = months[String(semrushDate[1]).toLowerCase()];
      if (month) return `${month} ${semrushDate[2].trim()}`;
    }

    const monthPattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/i;
    const subjectMonth = subject.match(monthPattern);
    if (subjectMonth) {
      return `${subjectMonth[1][0].toUpperCase()}${subjectMonth[1].slice(1).toLowerCase()} ${subjectMonth[2]}`;
    }

    const bodyMonth = body.match(monthPattern);
    if (bodyMonth) {
      return `${bodyMonth[1][0].toUpperCase()}${bodyMonth[1].slice(1).toLowerCase()} ${bodyMonth[2]}`;
    }

    const monthOnlyPattern = /(January|February|March|April|May|June|July|August|September|October|November|December)/i;
    const monthOnly = subject.match(monthOnlyPattern) || body.match(monthOnlyPattern);
    const sourceDate = new Date(record?.sourceDate || record?.receivedAt || "");
    if (monthOnly && !Number.isNaN(sourceDate.getTime())) {
      const reportMonth = `${monthOnly[1][0].toUpperCase()}${monthOnly[1].slice(1).toLowerCase()}`;
      return `${reportMonth} ${sourceDate.getFullYear()}`;
    }

    return "";
  }

  function buildClientOptions(selectedId) {
    const selected = Number(selectedId);
    return [
      '<option value="">Choose client…</option>',
      ...clientDirectory.map(client => {
        const value = Number(client?.id);
        const baseLabel = client?.name || client?.clientCode || `Client #${value}`;
        const status = String(client?.status || "").toLowerCase();
        const label = status && status !== "active"
          ? `${baseLabel} (${client?.statusLabel || status})`
          : baseLabel;
        return `<option value="${escapeHtml(value)}"${selected === value ? " selected" : ""}>${escapeHtml(label)}</option>`;
      })
    ].join("");
  }

  function parseGoogleReview(record) {
    const subject = String(record?.subject || "");
    const body = String(record?.bodyText || "");
    const subjectMatch = subject.match(/^(.+?)\s+left a review for\s+(.+)$/i);

    if (!subjectMatch) return null;

    const ratingMatch = body.match(/new\s+([1-5])-star review/i);
    const rating = Number(ratingMatch?.[1] || 0);
    const replyMatch =
      body.match(/\[Reply to review\]\((https?:\/\/[^)\s]+)\)/i) ||
      body.match(/(https?:\/\/business\.google\.com\/[^\s)]+)/i);

    const dateValue = String(record?.sourceDate || record?.receivedAt || "");
    const directDateMatch = dateValue.match(/^(\d{4})-(\d{2})/);
    const parsedDate = new Date(dateValue);
    const reviewMonth = directDateMatch
      ? `${directDateMatch[1]}-${directDateMatch[2]}`
      : !Number.isNaN(parsedDate.getTime())
        ? `${parsedDate.getUTCFullYear()}-${String(parsedDate.getUTCMonth() + 1).padStart(2,"0")}`
        : "";
    const reviewMonthLabel = reviewMonth
      ? new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric",timeZone:"UTC"})
          .format(new Date(`${reviewMonth}-01T00:00:00Z`))
      : "Review month";

    return {
      reviewer:subjectMatch[1].trim(),
      business:subjectMatch[2].trim(),
      rating,
      replyUrl:replyMatch?.[1] || "",
      reviewMonth,
      reviewMonthLabel
    };
  }

  function renderGoogleReviewRecord(record, review) {
    const article = document.createElement("article");
    article.className = "gcm-signal-card";
    article.dataset.intakeId = String(record?.id || "");

    const inferredClientId = inferClientId(record);
    const stars = review.rating > 0 ? "★".repeat(review.rating) : "Google review";

    article.innerHTML = `
      <div class="gcm-signal-row">
        <h3 class="gcm-signal-title">${escapeHtml(record?.subject || "(No subject)")}</h3>
        <button class="gcm-signal-review-button" type="button" data-gcm-ready-review>
          Quick Action
        </button>
      </div>
      <div class="gcm-review-panel" data-gcm-review-panel hidden>
        <div class="gcm-review-context">
          <span>Google Business Profile review</span>
          <span>·</span>
          <span>${escapeHtml(formatReceivedAt(record?.receivedAt))}</span>
        </div>

        <div class="gcm-review-quick">
          <label class="gcm-review-field">
            <span class="gcm-review-label">Client</span>
            <select class="gcm-review-select" data-gcm-review-client>
              ${buildClientOptions(inferredClientId)}
            </select>
          </label>

          <div class="gcm-review-quick-summary">
            <div class="gcm-review-quick-card">
              <p class="gcm-review-quick-kicker">New review</p>
              <p class="gcm-review-quick-value">${escapeHtml(stars)} · ${escapeHtml(review.reviewer)}</p>
              <p class="gcm-review-quick-note">${escapeHtml(review.business)} · ${escapeHtml(review.reviewMonthLabel)}</p>
            </div>
            <div class="gcm-review-quick-card">
              <p class="gcm-review-quick-kicker">${escapeHtml(review.reviewMonthLabel)} reviews recorded</p>
              <p class="gcm-review-quick-value gcm-review-count" data-gcm-review-month-count>—</p>
              <p class="gcm-review-quick-note">Only the monthly count is preserved as the business metric.</p>
            </div>
          </div>

          <div class="gcm-review-actions">
            ${review.replyUrl
              ? `<a class="gcm-review-reply" href="${escapeHtml(review.replyUrl)}" target="_blank" rel="noopener">Reply Now</a>`
              : ""}
            <button class="gcm-review-count-button" type="button" data-gcm-count-review>
              Mark Responded &amp; Count Review
            </button>
            <button class="gcm-review-full-button" type="button" data-gcm-full-review>
              Use Full Review
            </button>
            <span class="gcm-review-status" data-gcm-review-status>
              Reply to the customer, then count the review. No Finding, Communication, Investigation, Work Item, or Proof record will be created.
            </span>
          </div>
        </div>
      </div>
    `;

    const ready = article.querySelector("[data-gcm-ready-review]");
    const panel = article.querySelector("[data-gcm-review-panel]");
    const countButton = article.querySelector("[data-gcm-count-review]");
    const fullReview = article.querySelector("[data-gcm-full-review]");

    ready?.addEventListener("click", async () => {
      panel.hidden = false;
      ready.hidden = true;
      setStatus("Routine Google review: reply now, then count it for the client month.");
      article.querySelector("[data-gcm-review-client]")?.focus();
      await loadGoogleReviewMonthCount(article, review);
    });

    article.querySelector("[data-gcm-review-client]")?.addEventListener("change", () => {
      loadGoogleReviewMonthCount(article, review);
    });

    countButton?.addEventListener("click", () => countGoogleReview(article, countButton, review));

    fullReview?.addEventListener("click", () => {
      const replacement = renderRecord(record,{forceStandard:true});
      article.replaceWith(replacement);
      replacement.querySelector("[data-gcm-ready-review]")?.click();
    });

    return article;
  }

  async function loadGoogleReviewMonthCount(card, review) {
    const clientId = Number(card.querySelector("[data-gcm-review-client]")?.value);
    const count = card.querySelector("[data-gcm-review-month-count]");
    const status = card.querySelector("[data-gcm-review-status]");

    if (!Number.isInteger(clientId) || clientId <= 0 || !review.reviewMonth) {
      if (count) count.textContent = "—";
      return;
    }

    try {
      const result = await post(GOOGLE_REVIEW_ACTION,{
        operation:"get_month_count",
        workspaceKey:"gcm",
        clientId,
        reviewMonth:review.reviewMonth
      });
      if (count) count.textContent = String(Number(result?.monthlyCount || 0));
    } catch (error) {
      if (count) count.textContent = "—";
      if (status) status.textContent = `Could not load the monthly review count: ${error.message}`;
    }
  }

  async function countGoogleReview(card, button, review) {
    if (busy || !card || !button) return;

    const intakeId = Number(card.dataset.intakeId);
    const clientId = Number(card.querySelector("[data-gcm-review-client]")?.value);
    const status = card.querySelector("[data-gcm-review-status]");

    if (!Number.isInteger(clientId) || clientId <= 0) {
      if (status) status.textContent = "Choose the client before counting the review.";
      card.querySelector("[data-gcm-review-client]")?.focus();
      return;
    }

    busy = true;
    button.disabled = true;
    button.textContent = "Counting…";
    if (status) status.textContent = "Closing the review intake and updating the monthly review count.";

    try {
      const result = await post(GOOGLE_REVIEW_ACTION,{
        operation:"count_and_close",
        workspaceKey:"gcm",
        intakeId,
        clientId,
        reviewMonth:review.reviewMonth
      });

      if (
        result?.evidenceRetained !== true ||
        result?.findingCreated !== false ||
        result?.communicationCreated !== false ||
        result?.activityRecordCreated !== false ||
        result?.investigationCreated !== false ||
        result?.workItemCreated !== false
      ) {
        throw new Error("Google review quick-action safety check failed.");
      }

      busy = false;
      const monthLabel = review.reviewMonthLabel || result?.reviewMonth || "this month";
      const successMessage =
        `${result?.clientName || "Client"} — ${monthLabel} reviews recorded: ${Number(result?.monthlyCount || 0)}. Review counted and intake closed.`;

      await refreshQueue({preserveStatus:true});
      setStatus(successMessage);
    } catch (error) {
      busy = false;
      button.disabled = false;
      button.textContent = "Mark Responded & Count Review";
      if (status) status.textContent = `Review quick action failed: ${error.message}`;
      setStatus(`Review quick action failed: ${error.message}`);
    }
  }

  function renderRecord(record, options = {}) {
    const googleReview = parseGoogleReview(record);
    if (googleReview && !options.forceStandard && googleReview.rating >= 4) {
      return renderGoogleReviewRecord(record, googleReview);
    }

    const article = document.createElement("article");
    article.className = "gcm-signal-card";
    article.dataset.intakeId = String(record?.id || "");

    const inferredClientId = inferClientId(record);
    const inferredReportingPeriod = inferReportingPeriod(record);

    article.innerHTML = `
      <div class="gcm-signal-row">
        <h3 class="gcm-signal-title">${escapeHtml(record?.subject || "(No subject)")}</h3>
        <button class="gcm-signal-review-button" type="button" data-gcm-ready-review>
          Ready for Review
        </button>
      </div>
      <div class="gcm-review-panel" data-gcm-review-panel hidden>
        <div class="gcm-review-context">
          <span>${escapeHtml(record?.sender?.name || record?.sender?.address || "Unknown sender")}</span>
          <span>·</span>
          <span>${escapeHtml(formatReceivedAt(record?.receivedAt))}</span>
        </div>

        <div class="gcm-review-grid">
          <label class="gcm-review-field">
            <span class="gcm-review-label">Client</span>
            <select class="gcm-review-select" data-gcm-review-client>
              ${buildClientOptions(inferredClientId)}
            </select>
          </label>

          <label class="gcm-review-field">
            <span class="gcm-review-label">Reporting period</span>
            <input class="gcm-review-input" data-gcm-review-period value="${escapeHtml(inferredReportingPeriod)}" placeholder="Example: August 2026" />
          </label>

          <label class="gcm-review-field gcm-review-wide">
            <span class="gcm-review-label">Details to preserve</span>
            <textarea class="gcm-review-textarea" data-gcm-review-details placeholder="The important facts, measurements, comparisons, gains, declines, pages, queries, products, or other details we learned during review."></textarea>
          </label>

          <label class="gcm-review-field gcm-review-wide">
            <span class="gcm-review-label">What we learned</span>
            <textarea class="gcm-review-textarea" data-gcm-review-analysis placeholder="The business meaning or pattern supported by the details."></textarea>
          </label>

          <label class="gcm-review-field gcm-review-wide">
            <span class="gcm-review-label">Decision / next action</span>
            <textarea class="gcm-review-textarea" data-gcm-review-decision placeholder="What we decided after the review. Leave blank if this is only a recorded finding."></textarea>
          </label>

          <label class="gcm-review-field gcm-review-wide">
            <span class="gcm-review-label">Final Decision / Route</span>
            <select class="gcm-review-select" data-gcm-review-route>
              <option value="">Choose route…</option>
              <option value="monitoring">Monitoring / Finding</option>
              <option value="investigation">Investigation</option>
              <option value="requested_work">Work Item</option>
              <option value="information">Information / Communication</option>
            </select>
            <p class="gcm-review-route-note">
              Choose this last, after reviewing the evidence and writing the decision. Monitoring saves the finding only. Investigation creates a Communication + Investigation. Work Item creates a Communication + Work Item. Information creates a Communication/history record.
            </p>
          </label>
        </div>

        <details class="gcm-review-source">
          <summary>Source email</summary>
          <pre class="gcm-review-body">${escapeHtml(String(record?.bodyText || "").trim() || "[No readable message body was preserved.]")}</pre>
        </details>

        <div class="gcm-review-actions">
          <button class="gcm-review-save" type="button" data-gcm-save-finding>Save &amp; Route</button>
          <button class="gcm-review-secondary" type="button" data-gcm-close-review>Close Review</button>
          <button class="gcm-review-no-action" type="button" data-gcm-no-action>Delete — No Action Required</button>
          <span class="gcm-review-status" data-gcm-review-status>Nothing is saved until a route is chosen and the review is complete.</span>
        </div>
      </div>
    `;

    const ready = article.querySelector("[data-gcm-ready-review]");
    const panel = article.querySelector("[data-gcm-review-panel]");
    const close = article.querySelector("[data-gcm-close-review]");
    const save = article.querySelector("[data-gcm-save-finding]");
    const noAction = article.querySelector("[data-gcm-no-action]");

    ready?.addEventListener("click", () => {
      panel.hidden = false;
      ready.hidden = true;
      setStatus("Review the signal, work the details with your intelligence process, then save only what matters.");
      article.querySelector("[data-gcm-review-client]")?.focus();
    });

    close?.addEventListener("click", () => {
      panel.hidden = true;
      ready.hidden = false;
    });

    save?.addEventListener("click", () => saveFinding(article, save));
    noAction?.addEventListener("click", () => handleNoAction(article, noAction));

    return article;
  }

  async function saveFinding(card, button) {
    if (busy || !card || !button) return;

    const intakeId = Number(card.dataset.intakeId);
    const clientId = Number(card.querySelector("[data-gcm-review-client]")?.value);
    const reportingPeriod = String(card.querySelector("[data-gcm-review-period]")?.value || "").trim();
    const disposition = String(card.querySelector("[data-gcm-review-route]")?.value || "").trim();
    const details = String(card.querySelector("[data-gcm-review-details]")?.value || "").trim();
    const analysis = String(card.querySelector("[data-gcm-review-analysis]")?.value || "").trim();
    const decision = String(card.querySelector("[data-gcm-review-decision]")?.value || "").trim();
    const status = card.querySelector("[data-gcm-review-status]");

    if (!Number.isInteger(clientId) || clientId <= 0) {
      if (status) status.textContent = "Choose the client before saving.";
      card.querySelector("[data-gcm-review-client]")?.focus();
      return;
    }

    if (!["monitoring","information","investigation","requested_work"].includes(disposition)) {
      if (status) status.textContent = "Choose the Decision / Route before saving.";
      card.querySelector("[data-gcm-review-route]")?.focus();
      return;
    }

    if (!details) {
      if (status) status.textContent = "Enter the important details we learned before saving.";
      card.querySelector("[data-gcm-review-details]")?.focus();
      return;
    }

    busy = true;
    button.disabled = true;
    button.textContent = "Saving & Routing…";
    if (status) status.textContent = "Saving the reviewed finding and applying the selected route. Source email remains evidence.";

    try {
      const result = await post(SAVE_FINDING_ACTION, {
        workspaceKey:"gcm",
        intakeId,
        clientId,
        reportingPeriod,
        details,
        analysis,
        decision,
        disposition
      });

      if (!Number(result?.findingId) || result?.evidenceRetained !== true) {
        throw new Error("Finding save safety check failed.");
      }

      if (
        disposition === "monitoring" &&
        (
          Number(result?.communicationsCreated || 0) !== 0 ||
          Number(result?.activityRecordsCreated || 0) !== 0 ||
          Number(result?.investigationsCreated || 0) !== 0 ||
          Number(result?.workItemsCreated || 0) !== 0
        )
      ) {
        throw new Error("Monitoring routing safety check failed.");
      }

      if (
        disposition === "information" &&
        (
          !Number(result?.communicationId) ||
          Number(result?.activityRecordsCreated || 0) !== 0 ||
          Number(result?.investigationId || 0) !== 0 ||
          Number(result?.workItemId || 0) !== 0
        )
      ) {
        throw new Error("Information routing safety check failed.");
      }

      if (
        disposition === "investigation" &&
        (
          !Number(result?.communicationId) ||
          !Number(result?.investigationId) ||
          Number(result?.activityRecordsCreated || 0) !== 0 ||
          Number(result?.workItemId || 0) !== 0
        )
      ) {
        throw new Error("Investigation routing safety check failed.");
      }

      if (
        disposition === "requested_work" &&
        (
          !Number(result?.communicationId) ||
          !Number(result?.workItemId) ||
          Number(result?.activityRecordsCreated || 0) !== 0 ||
          Number(result?.investigationId || 0) !== 0
        )
      ) {
        throw new Error("Work Item routing safety check failed.");
      }

      busy = false;
      const routeLabel = {
        monitoring:"Monitoring / Finding",
        information:"Information / Communication",
        investigation:"Investigation",
        requested_work:"Work Item"
      }[disposition] || disposition;

      const linked = [
        result?.communicationId ? `Communication #${result.communicationId}` : "",
        result?.investigationId ? `Investigation #${result.investigationId}` : "",
        result?.workItemId ? `Work Item #${result.workItemId}` : ""
      ].filter(Boolean).join(" + ");

      const successMessage =
        `Finding #${result.findingId} saved as ${routeLabel}.${linked ? ` ${linked} linked.` : ""} Source email remains evidence.`;

      await refreshQueue({preserveStatus:true});
      setStatus(successMessage);
    } catch (error) {
      busy = false;
      button.disabled = false;
      button.textContent = "Save & Route";
      if (status) status.textContent = `Finding save failed: ${error.message}`;
      setStatus(`Finding save failed: ${error.message}`);
    }
  }

  async function handleNoAction(card, button) {
    if (busy || !card || !button) return;

    const intakeId = Number(card.dataset.intakeId);
    const status = card.querySelector("[data-gcm-review-status]");

    if (button.dataset.confirmArmed !== "true") {
      button.dataset.confirmArmed = "true";
      button.textContent = "Confirm No Action";
      if (status) status.textContent = "Nothing changed yet. Click Confirm No Action again within 10 seconds.";
      window.setTimeout(() => {
        if (!button.isConnected || button.disabled) return;
        if (button.dataset.confirmArmed !== "true") return;
        button.dataset.confirmArmed = "false";
        button.textContent = "Delete — No Action Required";
        if (status) status.textContent = "Nothing is saved until a route is chosen and the review is complete.";
      },10000);
      return;
    }

    button.dataset.confirmArmed = "false";
    busy = true;
    button.disabled = true;
    button.textContent = "Saving…";

    try {
      const result = await post(DISPOSITION_ACTION, {
        workspaceKey:"gcm",
        intakeId,
        disposition:"delete",
        confirmed:true,
        confirmation:"delete-no-action-required"
      });

      if (result?.evidenceRetained !== true) {
        throw new Error("No-action evidence retention check failed.");
      }

      busy = false;
      const successMessage =
        `Intake #${intakeId} closed with no action. Source evidence remains in D1.`;
      await refreshQueue({preserveStatus:true});
      setStatus(successMessage);
    } catch (error) {
      busy = false;
      button.disabled = false;
      button.textContent = "Delete — No Action Required";
      if (status) status.textContent = `No-action save failed: ${error.message}`;
    }
  }

  function setStatus(text) {
    if (statusCopy) statusCopy.textContent = text;
  }

  async function loadClientDirectory() {
    const result = await post(CLIENT_DIRECTORY_ACTION);
    clientDirectory = (Array.isArray(result?.clients) ? result.clients : [])
      .filter(client => Number(client?.id) > 0 && (client?.name || client?.clientCode));
  }

  async function refreshQueue({preserveStatus=false} = {}) {
    if (busy || !preview || !previewButton) return;

    busy = true;
    preview.hidden = false;
    previewButton.disabled = true;
    previewButton.textContent = "Loading…";
    if (!preserveStatus) setStatus("Loading unprocessed signals from D1.");

    try {
      if (!clientDirectory.length) {
        await loadClientDirectory();
      }

      const result = await post(QUEUE_ACTION, {
        workspaceKey:"gcm",
        limit:MAX_VISIBLE_EMAILS
      });

      const records = Array.isArray(result?.queue) ? result.queue : [];
      preview.replaceChildren(...records.map(renderRecord));

      if (!records.length) {
        const empty = document.createElement("div");
        empty.className = "gcm-intake-empty";
        empty.textContent = "No email signals are waiting for review.";
        preview.replaceChildren(empty);
        if (!preserveStatus) setStatus("Morning Command is clear.");
      } else {
        const total = Number(result?.counts?.readyForReview || records.length);
        if (!preserveStatus) {
          setStatus(`${total} signal${total === 1 ? "" : "s"} waiting. Open one only when you are ready to understand it.`);
        }
      }
    } catch (error) {
      const failed = document.createElement("div");
      failed.className = "gcm-intake-empty";
      failed.textContent = `Could not load Signal Review: ${error.message}`;
      preview.replaceChildren(failed);
      setStatus(`Signal Review load failed: ${error.message}`);
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
      setTimeout(install,200);
      return;
    }

    if (connectButton) {
      connectButton.hidden = true;
      connectButton.removeAttribute("href");
    }

    const title = document.getElementById("morning-command-title");
    if (title) {
      title.textContent = "Incoming signals waiting for review.";
    }

    preview.replaceChildren();
    preview.hidden = false;
    refreshQueue();
  }

  install();

  console.info(`GCM Signal Review Today loader ${FILE_VERSION} active.`);
})();
