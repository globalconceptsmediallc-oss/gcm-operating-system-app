/* =========================================================
   Global Concepts Media Operating System
   File: shared/media-recovery-dashboard.js
   Version: 1.1.0
   Status: Production Candidate
   Sprint: Existing / Already-Trafficked Media Recovery
   Purpose: Present recovered station-confirmed future placements as scheduled
            and ready, with no duplicate traffic action implied, and make
            Media identifier searches surface authoritative existing records.

   Production rules:
   - Read-only dashboard enhancement; never writes D1.
   - Scheduled-state enhancement applies only to action_type existing_media_recovery.
   - Requires traffic sent + station confirmed + a future first-air date.
   - Identifier search supports Media record ID and creativeVersion / ISCI.
   - Search enhancement never creates or modifies Media records.
   - Does not change legacy placement or Creative workflow records.
   ========================================================= */

(() => {
  "use strict";

  const ENDPOINT = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const lower = value => String(value || "").trim().toLowerCase();
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let records = [];
  let timer = null;

  function parseDateOnly(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateText(value) {
    const date = parseDateOnly(value);
    return date ? date.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" }) : "the scheduled first-air date";
  }

  function isScheduledConfirmedRecovery(record) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const start = parseDateOnly(record?.startDate);
    return lower(record?.actionType) === "existing_media_recovery" &&
      lower(record?.trafficStatus) === "sent" &&
      lower(record?.confirmationStatus) === "confirmed" &&
      ["ready","ready_to_launch","ready-to-launch"].includes(lower(record?.status)) &&
      start && start > today;
  }

  function readyLaneHeader() {
    const lane = document.getElementById("lane-ready")?.closest(".lane");
    const title = lane?.querySelector(".lane-toggle strong");
    const description = lane?.querySelector(".lane-toggle span span");
    if (title) title.textContent = "Ready / Scheduled";
    if (description) description.textContent = "Ready work and station-confirmed upcoming placements";
  }

  function identifierValues(record) {
    const notesMatch = String(record?.notes || "").match(/(?:GCM\s+)?ISCI:\s*([^\s]+)/i);
    return [
      record?.id,
      record?.creativeVersion,
      record?.creative_version,
      record?.isci,
      record?.isciId,
      record?.isci_id,
      record?.production?.isci,
      notesMatch?.[1]
    ].filter(value => value !== undefined && value !== null && String(value).trim() !== "");
  }

  function identifierMatch(query) {
    const q = lower(query);
    if (!q) return [];
    return records.filter(record => identifierValues(record).some(value => lower(value) === q));
  }

  function stageFor(record) {
    const status = lower(record?.status);
    const confirmation = lower(record?.confirmationStatus);
    const traffic = lower(record?.trafficStatus);
    if (["awaiting","awaiting_confirmation","pending_confirmation"].includes(confirmation) || traffic.includes("awaiting")) return "awaiting";
    if (["ready","ready_to_launch","ready-to-launch"].includes(status) || ["ready","ready_to_launch","ready-to-launch"].includes(traffic)) return "ready";
    if (["active","running","confirmed"].includes(status) || ["confirmed","active","running"].includes(confirmation)) return "running";
    if (["pending","planned","preparing"].includes(status)) return "preparing";
    return "history";
  }

  function identifierCard(record, key) {
    const identifier = record?.creativeVersion || identifierValues(record).find(value => String(value) !== String(record?.id)) || `Media #${record?.id}`;
    const start = dateText(record?.startDate);
    const end = dateText(record?.endDate);
    const campaign = record?.campaignName || record?.creativeName || record?.outletName || "Media placement";
    return `<article class="card clickable-record" role="link" tabindex="0" data-record-id="${esc(record?.id)}" data-gcm-identifier-match="1" data-gcm-identifier-key="${esc(key)}">
      <span class="badge b-info">ISCI / ID MATCH</span>
      <strong>${esc(record?.clientName || record?.clientCode || "Client")} · ${esc(campaign)}</strong>
      <div class="meta">${esc(record?.market || "Market not set")} · ${esc(record?.outletName || "Outlet not set")}</div>
      <div class="meta">${esc(start)} – ${esc(end)}</div>
      <div class="meta"><strong>ISCI / ID:</strong> ${esc(identifier)}</div>
      <div class="action">Existing authoritative Media record #${esc(record?.id)}.</div>
      <div class="open-record production-link" data-production-id="${esc(record?.id)}">Open production record →</div>
      <div class="open-record">Open campaign / traffic record →</div>
    </article>`;
  }

  function applyIdentifierSearch() {
    const input = document.getElementById("search-filter");
    if (!input) return;
    const query = input.value;
    const matches = identifierMatch(query);
    const current = document.querySelector("[data-gcm-identifier-match='1']");

    if (matches.length !== 1) {
      if (current) current.remove();
      return;
    }

    const record = matches[0];
    const key = `${lower(query)}:${record.id}`;
    const existingBaseCard = document.querySelector(`[data-record-id="${String(record.id).replace(/"/g, "")}"]:not([data-gcm-identifier-match])`);
    if (existingBaseCard) {
      if (current) current.remove();
      return;
    }
    if (current?.dataset?.gcmIdentifierKey === key) return;
    if (current) current.remove();

    const stage = stageFor(record);
    const laneMap = {
      preparing:"lane-preparing",
      ready:"lane-ready",
      running:"lane-running",
      awaiting:"lane-awaiting"
    };
    const laneId = laneMap[stage];
    const lane = laneId ? document.getElementById(laneId) : null;
    if (!lane) return;

    lane.innerHTML = identifierCard(record, key);
    const countMap = {
      preparing:"lane-preparing-count",
      ready:"lane-ready-count",
      running:"lane-running-count",
      awaiting:"lane-awaiting-count"
    };
    ["lane-preparing-count","lane-ready-count","lane-running-count","lane-awaiting-count"].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.textContent = id === countMap[stage] ? "1" : "0";
    });

    const summaryAction = document.getElementById("count-action");
    const summaryPreparing = document.getElementById("count-preparing");
    const summaryRunning = document.getElementById("count-running");
    const summaryHistory = document.getElementById("count-history");
    if (summaryAction) summaryAction.textContent = stage === "awaiting" || stage === "preparing" ? "1" : "0";
    if (summaryPreparing) summaryPreparing.textContent = stage === "preparing" || stage === "ready" ? "1" : "0";
    if (summaryRunning) summaryRunning.textContent = stage === "running" ? "1" : "0";
    if (summaryHistory) summaryHistory.textContent = stage === "history" ? "1" : "0";
  }

  function applyScheduledState() {
    const byId = new Map(records.filter(isScheduledConfirmedRecovery).map(record => [String(record.id), record]));
    if (!byId.size) return;

    document.querySelectorAll("[data-record-id]").forEach(card => {
      const record = byId.get(String(card.dataset.recordId || ""));
      if (!record) return;

      const badges = card.querySelectorAll(".badge");
      if (badges[0]) {
        badges[0].textContent = "Scheduled";
        badges[0].classList.remove("b-warning","b-critical","b-info");
        badges[0].classList.add("b-success");
      }

      const action = card.querySelector(".action");
      if (action) {
        action.textContent = `Station confirmed. Scheduled to begin ${dateText(record.startDate)}. No traffic action is required before first air; monitor launch.`;
      }
    });
  }

  function apply() {
    readyLaneHeader();
    applyScheduledState();
    applyIdentifierSearch();
  }

  function scheduleApply(delay = 80) {
    clearTimeout(timer);
    timer = setTimeout(apply, delay);
  }

  async function loadRecords() {
    try {
      const response = await fetch(ENDPOINT, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"get-media-operations"})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) return;
      records = Array.isArray(payload?.mediaOperations?.records) ? payload.mediaOperations.records : [];
      scheduleApply(250);
    } catch (error) {
      console.error("Media Recovery Dashboard 1.1.0:", error);
    }
  }

  function start() {
    loadRecords();
    const observer = new MutationObserver(() => scheduleApply(60));
    const queue = document.getElementById("queue-body");
    if (queue) observer.observe(queue, { childList:true, subtree:true });
    document.addEventListener("click", event => {
      if (event.target?.id === "refresh") setTimeout(loadRecords, 450);
    }, true);
    document.addEventListener("input", event => {
      if (event.target?.id === "search-filter") scheduleApply(30);
    }, true);
    document.addEventListener("change", event => {
      if (event.target?.id === "client") setTimeout(scheduleApply, 500);
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();
