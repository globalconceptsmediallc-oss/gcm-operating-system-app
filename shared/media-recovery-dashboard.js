/* =========================================================
   Global Concepts Media Operating System
   File: shared/media-recovery-dashboard.js
   Version: 1.0.0
   Status: Production Candidate
   Sprint: Existing / Already-Trafficked Media Recovery
   Purpose: Present recovered station-confirmed future placements as scheduled
            and ready, with no duplicate traffic action implied.

   Production rules:
   - Read-only dashboard enhancement; never writes D1.
   - Applies only to action_type existing_media_recovery.
   - Requires traffic sent + station confirmed + a future first-air date.
   - Does not change legacy placement or Creative workflow records.
   ========================================================= */

(() => {
  "use strict";

  const ENDPOINT = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const lower = value => String(value || "").trim().toLowerCase();
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

  function apply() {
    readyLaneHeader();
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
      console.error("Media Recovery Dashboard 1.0.0:", error);
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
    document.addEventListener("change", event => {
      if (event.target?.id === "client") setTimeout(scheduleApply, 500);
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();
