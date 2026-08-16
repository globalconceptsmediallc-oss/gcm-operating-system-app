/* =========================================================
   Global Concepts Media Operating System
   File: shared/media-needs-action.js
   Version: 1.0.0
   Status: Production Candidate
   Sprint: Media Needs-Action Transparency
   Purpose: Make the Needs Action summary card explain exactly which Media
            records make up the count, grouped by the kind of action required.

   Production rules:
   - Read-only dashboard enhancement; no D1 writes occur here.
   - Uses the same placement urgency and Creative lane rules as the Media page.
   - Respects the current Media filters.
   - Placement decisions reopen in the Media decision workspace rather than
     forcing the operator into the legacy insertion editor.
   - Creative actions open the authoritative Creative Production record.
   ========================================================= */

(() => {
  "use strict";

  const VERSION = "1.0.0";
  const ENDPOINT = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const $ = id => document.getElementById(id);
  const lower = value => String(value || "").trim().toLowerCase();
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  let records = [];
  let workflow = null;
  let reconcileTimer = null;
  let expanded = false;

  function noteValue(notes, label) {
    const line = String(notes || "")
      .split(/\r?\n/)
      .find(item => lower(item).startsWith(lower(label)));
    return line ? line.slice(label.length).trim() : "";
  }

  function disposition(record) {
    return {
      disposition: noteValue(record?.notes, "Placement Disposition:"),
      replacementRequired: noteValue(record?.notes, "Replacement Required:"),
      replacementCreativeId: noteValue(record?.notes, "Replacement Creative ID:")
    };
  }

  function placementDecisionHandled(record) {
    const value = disposition(record);
    const name = lower(value.disposition);
    return (
      (name === "retire_at_end" && lower(value.replacementRequired) === "no") ||
      (name === "replacement_in_progress" && lower(value.replacementRequired) === "yes" && /^\d+$/.test(String(value.replacementCreativeId || "")))
    );
  }

  function toDate(value) {
    if (!value) return null;
    const date = new Date(String(value).slice(0, 10) + "T12:00:00");
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateRelation(record) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = toDate(record?.startDate);
    const end = toDate(record?.endDate);
    if (end && end < today) return "history";
    if (start && start > today) return "upcoming";
    if ((!start || start <= today) && (!end || end >= today)) return "running";
    return "";
  }

  const isExpired = record => lower(record?.status) === "expired" || dateRelation(record) === "history";
  const isAwaiting = record => ["awaiting", "awaiting_confirmation", "pending_confirmation"].includes(lower(record?.confirmationStatus)) || lower(record?.trafficStatus).includes("awaiting");
  const needsAttention = record => record?.needsAttention === true || ["attention", "needs_attention"].includes(lower(record?.attentionStatus)) || Boolean(record?.attentionReason);
  const isExplicitlyReady = record => ["ready", "ready_to_launch", "ready-to-launch"].includes(lower(record?.status)) || ["ready", "ready_to_launch", "ready-to-launch"].includes(lower(record?.trafficStatus));
  const isPending = record => !isExpired(record) && (isAwaiting(record) || ["pending", "planned", "preparing"].includes(lower(record?.status)) || isExplicitlyReady(record));
  const isActive = record => !isExpired(record) && !isPending(record) && (["active", "running", "confirmed"].includes(lower(record?.status)) || ["confirmed", "active", "running"].includes(lower(record?.confirmationStatus)));

  function daysSince(value) {
    const date = toDate(value);
    if (!date) return null;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  }

  function freshness(record) {
    if (!isActive(record)) return null;
    const age = daysSince(record?.creativeStartDate || record?.creative_start_date || record?.lastCreativeDate || record?.last_creative_date || record?.startDate);
    if (age === null) return { level: "unknown", days: null };
    if (age <= 30) return { level: "fresh", days: age };
    if (age <= 45) return { level: "watch", days: age };
    if (age <= 60) return { level: "refresh", days: age };
    return { level: "stale", days: age };
  }

  function placementUrgency(record) {
    if (isExpired(record)) return 0;
    if (isAwaiting(record)) return 120;
    if (needsAttention(record)) return 110;
    if (placementDecisionHandled(record)) return 0;
    const currentFreshness = freshness(record);
    if (currentFreshness?.level === "stale") return 95;
    if (currentFreshness?.level === "refresh") return 85;
    if (["pending", "planned", "preparing"].includes(lower(record?.status))) return 70;
    if (currentFreshness?.level === "watch") return 40;
    return 0;
  }

  function assignmentsFor(creativeId) {
    return (workflow?.assignments || []).filter(item =>
      Number(item.creativeId) === Number(creativeId) &&
      lower(item.assignmentStatus) !== "removed"
    );
  }

  function packagesFor(creativeId) {
    return (workflow?.trafficPackages || []).filter(item => Number(item.creativeId) === Number(creativeId));
  }

  function creativeLane(creative) {
    const packageStatuses = packagesFor(creative.id).map(item => lower(item.packageStatus));
    const stage = lower(creative.currentStage);
    const status = lower(creative.status);
    if (packageStatuses.some(value => ["sent", "received_confirmed"].includes(value))) return "awaiting";
    if (status === "running" || stage === "running / rotation" || assignmentsFor(creative.id).some(item => lower(item.assignmentStatus) === "active")) return "running";
    if (status === "ready" || (stage === "station email package" && assignmentsFor(creative.id).length > 0)) return "ready";
    if (status === "retired" || stage === "retired") return "history";
    return "preparing";
  }

  function dateText(value) {
    const date = toDate(value);
    return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  }

  function matchesPlacementFilters(record) {
    const clientId = Number($("client")?.value || 0);
    const type = lower($("media-type-filter")?.value);
    const status = lower($("status-filter")?.value);
    const market = lower($("market-filter")?.value);
    const outlet = lower($("outlet-filter")?.value);
    const dateView = $("date-filter")?.value || "";
    const search = lower($("search-filter")?.value);

    if (clientId && Number(record.clientId) !== clientId) return false;
    if (type && lower(record.mediaType) !== type) return false;
    if (status && lower(record.status) !== status) return false;
    if (market && lower(record.market) !== market) return false;
    if (outlet && lower(record.outletName) !== outlet) return false;
    if (dateView === "upcoming" && dateRelation(record) !== "upcoming") return false;
    if (dateView === "running" && dateRelation(record) !== "running") return false;
    if (["history", "last-year", "same-period-last-year"].includes(dateView) && dateRelation(record) !== "history") return false;
    if (search) {
      const value = disposition(record);
      const haystack = [
        record.clientName, record.clientCode, record.campaignName, record.creativeName,
        record.fileName, record.market, record.outletName, record.status,
        record.trafficStatus, record.confirmationStatus, record.attentionReason,
        value.replacementCreativeId, record.mediaType
      ].map(lower).join(" ");
      if (!haystack.includes(search)) return false;
    }
    return true;
  }

  function matchesCreativeFilters(creative) {
    const clientId = Number($("client")?.value || 0);
    const type = lower($("media-type-filter")?.value);
    const status = lower($("status-filter")?.value);
    const market = lower($("market-filter")?.value);
    const outlet = lower($("outlet-filter")?.value);
    const dateView = $("date-filter")?.value || "";
    const search = lower($("search-filter")?.value);
    const assignments = assignmentsFor(creative.id);
    const lane = creativeLane(creative);

    if (clientId && Number(creative.clientId) !== clientId) return false;
    if (type && lower(creative.mediaType) !== type) return false;
    if (status && lower(creative.status) !== status) return false;
    if (market && !assignments.some(item => lower(item.market) === market)) return false;
    if (outlet && !assignments.some(item => lower(item.outletName) === outlet)) return false;
    if (dateView === "running" && lane !== "running") return false;
    if (dateView === "upcoming" && !["preparing", "ready", "awaiting"].includes(lane)) return false;
    if (["history", "last-year", "same-period-last-year"].includes(dateView) && lane !== "history") return false;
    if (search) {
      const haystack = [
        creative.clientName, creative.clientCode, creative.creativeName,
        creative.mediaType, creative.currentStage, creative.status,
        creative.voiceTalent, creative.finalAudioFileName,
        ...assignments.flatMap(item => [item.market, item.outletName])
      ].map(lower).join(" ");
      if (!haystack.includes(search)) return false;
    }
    return true;
  }

  function placementGroup(record) {
    if (isAwaiting(record)) return "Awaiting Confirmation";
    if (needsAttention(record)) return "Traffic / Placement Attention";
    const currentFreshness = freshness(record);
    if (currentFreshness && ["refresh", "stale"].includes(currentFreshness.level)) return "Decision Needed";
    return "Production / Preparation";
  }

  function placementReason(record) {
    if (isAwaiting(record)) return "Station/outlet confirmation is still pending.";
    if (needsAttention(record)) return record.attentionReason || record.effectiveAttentionReason || "Placement requires operating attention.";
    const currentFreshness = freshness(record);
    if (currentFreshness?.level === "stale") return `${currentFreshness.days} days in the current creative rotation — replacement, continue, or retire decision needed.`;
    if (currentFreshness?.level === "refresh") return `${currentFreshness.days} days in the current creative rotation — creative refresh decision needed.`;
    if (["pending", "planned", "preparing"].includes(lower(record.status))) return "Placement preparation is not complete.";
    return "Media action required.";
  }

  function creativeGroup(creative) {
    const lane = creativeLane(creative);
    return lane === "awaiting" ? "Awaiting Confirmation" : "Production / Preparation";
  }

  function creativeReason(creative) {
    const stage = creative.currentStage || "Idea / Direction";
    const lane = creativeLane(creative);
    if (lane === "awaiting") return `Creative #${creative.id} is at ${stage} and is waiting on station confirmation.`;
    if (lower(stage) === "working script") return `Creative #${creative.id} is saved at Working Script and has not been approved forward.`;
    return `Creative #${creative.id} is at ${stage}.`;
  }

  function actionItems() {
    const placementItems = records
      .filter(matchesPlacementFilters)
      .filter(record => placementUrgency(record) >= 70)
      .map(record => ({
        source: "placement",
        id: record.id,
        group: placementGroup(record),
        client: record.clientName || record.clientCode || "Client",
        title: record.campaignName || record.creativeName || "Media placement",
        market: [record.market, record.outletName].filter(Boolean).join(" / "),
        stage: "",
        reason: placementReason(record),
        deadline: record.stationDeadline ? `Traffic deadline ${dateText(record.stationDeadline)}` : ""
      }));

    const creativeItems = (workflow?.creatives || [])
      .filter(matchesCreativeFilters)
      .filter(creative => ["preparing", "ready", "awaiting"].includes(creativeLane(creative)))
      .map(creative => ({
        source: "creative",
        id: creative.id,
        group: creativeGroup(creative),
        client: creative.clientName || creative.clientCode || "Client",
        title: creative.creativeName || "Creative",
        market: assignmentsFor(creative.id).map(item => `${item.market || "Market"} / ${item.outletName || "Outlet"}`).join("; "),
        stage: creative.currentStage || "Idea / Direction",
        reason: creativeReason(creative),
        deadline: ""
      }));

    return [...placementItems, ...creativeItems];
  }

  function itemHtml(item) {
    const location = item.market ? `<span class="gcm-na-meta">${esc(item.market)}</span>` : "";
    const stage = item.stage ? `<span class="gcm-na-chip">${esc(item.stage)}</span>` : "";
    const deadline = item.deadline ? `<span class="gcm-na-meta">${esc(item.deadline)}</span>` : "";
    const action = item.source === "creative"
      ? `<button type="button" class="gcm-na-open" data-open-creative="${esc(item.id)}">Open Production</button>`
      : `<button type="button" class="gcm-na-open" data-review-placement="${esc(item.id)}">Review Decision</button>`;
    return `<article class="gcm-na-item"><div class="gcm-na-copy"><div class="gcm-na-heading"><strong>${esc(item.client)} · ${esc(item.title)}</strong>${stage}</div><div class="gcm-na-sub">${location}${deadline}</div><p>${esc(item.reason)}</p></div>${action}</article>`;
  }

  function groupHtml(name, items) {
    if (!items.length) return "";
    return `<section class="gcm-na-group"><div class="gcm-na-group-title"><strong>${esc(name)}</strong><span>${items.length}</span></div>${items.map(itemHtml).join("")}</section>`;
  }

  function render() {
    const panel = $("gcm-needs-action-panel");
    if (!panel) return;
    const items = actionItems();
    const order = ["Decision Needed", "Production / Preparation", "Awaiting Confirmation", "Traffic / Placement Attention"];
    const groups = new Map(order.map(name => [name, []]));
    for (const item of items) {
      if (!groups.has(item.group)) groups.set(item.group, []);
      groups.get(item.group).push(item);
    }

    const dashboardCount = Number($("count-action")?.textContent || 0);
    panel.innerHTML = `
      <div class="gcm-na-head">
        <div><strong>Needs Action Detail</strong><p>Every record currently contributing to the Media action count.</p></div>
        <span class="gcm-na-total">${items.length} item${items.length === 1 ? "" : "s"}</span>
      </div>
      ${dashboardCount !== items.length ? `<div class="gcm-na-sync">The summary is still reconciling (${dashboardCount}); this detail currently finds ${items.length}. Refresh if the counts do not settle together.</div>` : ""}
      <div class="gcm-na-groups">${order.map(name => groupHtml(name, groups.get(name) || [])).join("")}</div>
      ${items.length ? "" : '<div class="gcm-na-empty">No Media actions are required in the current filtered view.</div>'}`;
    panel.hidden = !expanded;
  }

  function mountPanel() {
    const countNode = $("count-action");
    const card = countNode?.closest("article");
    const summary = card?.parentElement;
    if (!card || !summary) return false;

    if (!$("gcm-needs-action-panel")) {
      summary.insertAdjacentHTML("afterend", '<section id="gcm-needs-action-panel" class="gcm-na-panel" hidden aria-label="Needs Action Detail"></section>');
    }
    card.classList.add("gcm-na-summary-card");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-expanded", String(expanded));
    card.setAttribute("aria-controls", "gcm-needs-action-panel");
    card.title = "Show the records behind Needs Action";
    return true;
  }

  function injectStyles() {
    if ($("gcm-media-needs-action-styles")) return;
    const style = document.createElement("style");
    style.id = "gcm-media-needs-action-styles";
    style.textContent = `
      .gcm-na-summary-card{cursor:pointer;transition:border-color .15s ease,transform .15s ease,box-shadow .15s ease}.gcm-na-summary-card:hover{border-color:#aac4eb;transform:translateY(-1px);box-shadow:0 10px 22px rgba(31,104,216,.1)}.gcm-na-summary-card:focus-visible{outline:3px solid rgba(31,104,216,.24);outline-offset:2px}.gcm-na-summary-card:after{content:"View details ↓";display:block;margin-top:10px;color:#1f68d8;font-size:.68rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em}.gcm-na-summary-card[aria-expanded="true"]:after{content:"Hide details ↑"}
      .gcm-na-panel{margin:-4px 0 18px;padding:18px;border:1px solid #b9cfee;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(7,20,38,.07)}.gcm-na-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid #dbe2ec}.gcm-na-head strong{color:#071426;font-size:1rem}.gcm-na-head p{margin:4px 0 0;color:#637083;font-size:.78rem}.gcm-na-total{display:inline-flex;align-items:center;min-height:30px;padding:0 10px;border-radius:999px;background:#eaf2ff;color:#1f68d8;font-size:.72rem;font-weight:900}.gcm-na-sync{margin-top:12px;padding:10px 12px;border-radius:10px;background:#fff4dd;color:#7d5315;font-size:.75rem;font-weight:800}.gcm-na-groups{display:grid;gap:14px;margin-top:14px}.gcm-na-group{border:1px solid #dbe2ec;border-radius:13px;overflow:hidden}.gcm-na-group-title{display:flex;justify-content:space-between;align-items:center;padding:11px 13px;background:#f5f7fb;color:#071426}.gcm-na-group-title strong{font-size:.82rem}.gcm-na-group-title span{display:grid;place-items:center;min-width:24px;height:24px;padding:0 7px;border-radius:999px;background:#eaf2ff;color:#1f68d8;font-size:.68rem;font-weight:900}.gcm-na-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:13px;border-top:1px solid #dbe2ec}.gcm-na-item:first-of-type{border-top:0}.gcm-na-heading{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.gcm-na-heading strong{color:#071426;font-size:.82rem}.gcm-na-chip{display:inline-flex;align-items:center;min-height:23px;padding:0 8px;border-radius:999px;background:#fff4dd;color:#8a5b12;font-size:.62rem;font-weight:900;text-transform:uppercase}.gcm-na-sub{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px}.gcm-na-meta{color:#637083;font-size:.7rem;font-weight:750}.gcm-na-item p{margin:6px 0 0;color:#34445b;font-size:.76rem}.gcm-na-open{min-height:36px;padding:0 11px;border:1px solid #c5d2e4;border-radius:9px;background:#fff;color:#0b1d33;font:inherit;font-size:.72rem;font-weight:900;cursor:pointer}.gcm-na-open:hover{border-color:#8fb4eb;background:#edf5ff}.gcm-na-empty{padding:18px 0 2px;color:#637083;font-size:.8rem}@media(max-width:760px){.gcm-na-item{grid-template-columns:1fr}.gcm-na-open{justify-self:start}}
    `;
    document.head.appendChild(style);
  }

  async function post(body) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || payload?.details || `Worker returned ${response.status}`);
    return payload;
  }

  async function fetchData() {
    const [placementPayload, creativePayload] = await Promise.all([
      post({ action: "get-media-operations" }),
      post({ action: "get-media-operations", operation: "get_creative_workflow" })
    ]);
    records = Array.isArray(placementPayload?.mediaOperations?.records) ? placementPayload.mediaOperations.records : [];
    workflow = creativePayload?.creativeWorkflow || null;
  }

  function scheduleRender(delay = 300) {
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(render, delay);
  }

  async function refreshData() {
    try {
      await fetchData();
      scheduleRender(650);
      setTimeout(render, 1500);
    } catch (error) {
      console.error(`Media Needs Action ${VERSION}:`, error);
    }
  }

  function togglePanel(force) {
    expanded = typeof force === "boolean" ? force : !expanded;
    const card = $("count-action")?.closest("article");
    const panel = $("gcm-needs-action-panel");
    if (card) card.setAttribute("aria-expanded", String(expanded));
    if (panel) panel.hidden = !expanded;
    if (expanded) {
      render();
      panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function reviewPlacement(recordId) {
    const record = records.find(item => String(item.id) === String(recordId));
    if (!record) return;
    const search = $("search-filter");
    if (search) {
      search.value = record.campaignName || record.creativeName || record.outletName || "";
      search.dispatchEvent(new Event("input", { bubbles: true }));
    }
    togglePanel(false);
    setTimeout(() => document.querySelector(".priority")?.scrollIntoView({ behavior: "smooth", block: "start" }), 450);
  }

  function openCreative(creativeId) {
    const id = Number(creativeId || 0);
    if (!id) return;
    try { sessionStorage.setItem("gcmMediaCreativeId", String(id)); } catch {}
    window.location.assign(`media-production.html?creativeId=${encodeURIComponent(id)}`);
  }

  function start() {
    injectStyles();
    if (!mountPanel()) return;
    refreshData();

    document.addEventListener("click", event => {
      const summaryCard = event.target.closest(".gcm-na-summary-card");
      if (summaryCard) {
        event.preventDefault();
        togglePanel();
        return;
      }
      const placementButton = event.target.closest("[data-review-placement]");
      if (placementButton) {
        event.preventDefault();
        reviewPlacement(placementButton.dataset.reviewPlacement);
        return;
      }
      const creativeButton = event.target.closest("[data-open-creative]");
      if (creativeButton?.closest("#gcm-needs-action-panel")) {
        event.preventDefault();
        openCreative(creativeButton.dataset.openCreative);
        return;
      }
      if (event.target?.id === "refresh") setTimeout(refreshData, 500);
      if (event.target?.id === "clear-filters") scheduleRender(600);
    }, true);

    document.addEventListener("keydown", event => {
      if (event.target?.classList?.contains("gcm-na-summary-card") && ["Enter", " "].includes(event.key)) {
        event.preventDefault();
        togglePanel();
      }
    });

    document.addEventListener("change", event => {
      if (["client", "media-type-filter", "status-filter", "market-filter", "outlet-filter", "date-filter", "needs-action-filter"].includes(event.target?.id)) scheduleRender(450);
    }, true);

    document.addEventListener("input", event => {
      if (event.target?.id === "search-filter") scheduleRender(300);
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 0), { once: true });
  else setTimeout(start, 0);
})();
