/* =========================================================
   Global Concepts Media Operating System
   File: shared/media-dashboard-creatives.js
   Version: 1.1.0
   Status: Production Candidate
   Sprint: Media Work State / Waiting + Scheduled
   Purpose: Add media_creatives to the Media dashboard while separating
            unfinished work from work that actually needs attention now.

   Production rules:
   - Legacy media_records remain untouched.
   - Work State is read from durable media_creative_history entries.
   - Waiting / Scheduled Creatives stay visible in the queue but do not count
     as Needs Action until an optional resume date arrives.
   - Station Confirmation is treated as waiting on an external response.
   - No D1 writes occur from this dashboard layer.
   ========================================================= */

(() => {
  "use strict";

  const VERSION = "1.1.0";
  const ENDPOINT = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const $ = id => document.getElementById(id);
  const lower = value => String(value || "").trim().toLowerCase();
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const creativeUrl = creativeId => `media-production.html?creativeId=${encodeURIComponent(creativeId)}`;

  let workflow = null;
  let lastCreativeActionCount = 0;
  let lastActionOutput = null;
  let applyTimer = null;

  function openCreativeRecord(creativeId) {
    const id = Number(creativeId || 0);
    if (!id) return;
    try { sessionStorage.setItem("gcmMediaCreativeId", String(id)); } catch {}
    window.location.assign(creativeUrl(id));
  }

  async function fetchWorkflow() {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get-media-operations", operation: "get_creative_workflow" })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || payload?.details || `Worker returned ${response.status}`);
    workflow = payload.creativeWorkflow || null;
    return workflow;
  }

  function assignmentsFor(creativeId) {
    return (workflow?.assignments || []).filter(item => Number(item.creativeId) === Number(creativeId) && lower(item.assignmentStatus) !== "removed");
  }

  function packagesFor(creativeId) {
    return (workflow?.trafficPackages || []).filter(item => Number(item.creativeId) === Number(creativeId));
  }

  function laneFor(creative) {
    const packageStatuses = packagesFor(creative.id).map(item => lower(item.packageStatus));
    const stage = lower(creative.currentStage);
    const status = lower(creative.status);
    if (packageStatuses.some(value => ["sent", "received_confirmed"].includes(value))) return "awaiting";
    if (status === "running" || stage === "running / rotation" || assignmentsFor(creative.id).some(item => lower(item.assignmentStatus) === "active")) return "running";
    if (status === "ready" || (stage === "station email package" && assignmentsFor(creative.id).length > 0)) return "ready";
    if (status === "retired" || stage === "retired") return "history";
    return "preparing";
  }

  function lineValue(content, label) {
    const line = String(content || "").split(/\r?\n/).find(item => lower(item).startsWith(lower(label)));
    return line ? line.slice(label.length).trim() : "";
  }

  function explicitWorkState(creativeId) {
    const entry = (workflow?.history || []).find(item => Number(item.creativeId) === Number(creativeId) && lower(item.entryType) === "work_state");
    if (!entry) return { state: "active", waitingFor: "", resumeDate: "" };
    return {
      state: lower(lineValue(entry.content, "Work State:")) || "active",
      waitingFor: lineValue(entry.content, "Waiting For:"),
      resumeDate: lineValue(entry.content, "Resume Date:")
    };
  }

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function workStateFor(creative) {
    const lane = laneFor(creative);
    const explicit = explicitWorkState(creative.id);
    const waiting = ["waiting", "scheduled"].includes(explicit.state);
    if (waiting) {
      const due = Boolean(explicit.resumeDate && explicit.resumeDate <= todayIso());
      return { state: due ? "active" : "waiting", due, waitingFor: explicit.waitingFor || "scheduled work", resumeDate: explicit.resumeDate, explicit: true };
    }
    if (lane === "awaiting") return { state: "waiting", due: false, waitingFor: "station confirmation", resumeDate: "", explicit: false };
    return { state: "active", due: false, waitingFor: "", resumeDate: "", explicit: false };
  }

  function needsActionNow(creative) {
    const lane = laneFor(creative);
    if (!["preparing", "ready"].includes(lane)) return false;
    return workStateFor(creative).state !== "waiting";
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function nextAction(creative) {
    const stage = lower(creative.currentStage);
    const voice = String(creative.voiceTalent || "").trim();
    if (stage === "idea / direction") return "Develop the working script and preserve the next approved copy.";
    if (stage === "working script") return "Review the working script and move it to explicit approval when you are ready.";
    if (stage === "approved script") return voice ? `Move the approved script into recording with ${voice}.` : "Move the approved script into recording and assign the voice talent.";
    if (stage === "recording") return "Track the recording receipt and review the read before advancing.";
    if (stage === "recording review") return "Record revisions, approve the read, and establish the final script.";
    if (stage === "final production") return "Complete final production and preserve the final audio filename.";
    if (stage === "co-op script") return "Finalize the co-op script that will travel with the station package.";
    if (stage === "market assignment") return "Assign this creative to the intended market rotations.";
    if (stage === "station email package") return "Build and review the complete station email package before drafting.";
    if (stage === "station confirmation") return "Attach the station confirmation email and approve received / trafficked status.";
    if (stage === "running / rotation") return "Monitor rotation, run dates, and creative age.";
    return "Continue the creative workflow from its current saved stage.";
  }

  function visibleCreatives() {
    if (!workflow) return [];
    const clientId = Number($("client")?.value || 0);
    const type = lower($("media-type-filter")?.value);
    const status = lower($("status-filter")?.value);
    const market = lower($("market-filter")?.value);
    const outlet = lower($("outlet-filter")?.value);
    const dateView = $("date-filter")?.value || "";
    const search = lower($("search-filter")?.value);
    const actionOnly = Boolean($("needs-action-filter")?.checked);

    return (workflow.creatives || []).filter(creative => {
      if (clientId && Number(creative.clientId) !== clientId) return false;
      if (type && lower(creative.mediaType) !== type) return false;
      if (status && lower(creative.status) !== status) return false;
      const assignments = assignmentsFor(creative.id);
      if (market && !assignments.some(item => lower(item.market) === market)) return false;
      if (outlet && !assignments.some(item => lower(item.outletName) === outlet)) return false;
      const lane = laneFor(creative);
      if (dateView === "running" && lane !== "running") return false;
      if (dateView === "upcoming" && !["preparing", "ready", "awaiting"].includes(lane)) return false;
      if (["history", "last-year", "same-period-last-year"].includes(dateView) && lane !== "history") return false;
      if (actionOnly && !needsActionNow(creative)) return false;
      if (search) {
        const work = workStateFor(creative);
        const haystack = [creative.clientName, creative.clientCode, creative.creativeName, creative.mediaType, creative.currentStage, creative.status, creative.voiceTalent, creative.finalAudioFileName, work.waitingFor, work.resumeDate, ...assignments.flatMap(item => [item.market, item.outletName])].map(lower).join(" ");
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  function creativeCard(creative, lane) {
    const assignments = assignmentsFor(creative.id);
    const assignmentText = assignments.length ? assignments.map(item => `${item.market || "Market"} / ${item.outletName || "Outlet"}`).join("; ") : "No market assignment yet";
    const stage = creative.currentStage || "Idea / Direction";
    const work = workStateFor(creative);
    const badge = work.state === "waiting" ? ["b-info", "Waiting / Scheduled"]
      : work.due ? ["b-warning", "Scheduled Due"]
      : lane === "ready" ? ["b-success", "Ready"]
      : lane === "running" ? ["b-info", "Running"]
      : lane === "awaiting" ? ["b-info", "Waiting"]
      : ["b-warning", "Producing"];
    const length = creative.lengthSeconds ? `:${creative.lengthSeconds}` : "Length not set";
    const voice = creative.voiceTalent ? ` · Voice: ${creative.voiceTalent}` : "";
    const action = work.state === "waiting"
      ? `Waiting for ${work.waitingFor || "the next dependency"}${work.resumeDate ? ` · resume ${formatDate(work.resumeDate)}` : ""}. No work needed now.`
      : work.due
        ? `Scheduled work is due. ${nextAction(creative)}`
        : nextAction(creative);

    return `
      <article class="card gcm-creative-card" data-creative-id="${esc(creative.id)}">
        <span class="badge ${badge[0]}">${badge[1]}</span>
        <span class="badge b-info">${esc(creative.mediaType || "Media")}</span>
        <strong>${esc(creative.clientName || creative.clientCode || "Client")} · ${esc(creative.creativeName || "Creative")}</strong>
        <div class="meta"><strong>Creative #${esc(creative.id)}</strong> · ${esc(stage)} · ${esc(length)}${esc(voice)}</div>
        <div class="meta">${esc(assignmentText)}</div>
        <div class="action">${esc(action)}</div>
        <a class="open-record" data-open-creative="${esc(creative.id)}" href="${creativeUrl(creative.id)}">Open production record →</a>
      </article>`;
  }

  function baseCardCount(laneId) {
    return document.querySelectorAll(`#${laneId} .card:not(.gcm-creative-card)`).length;
  }

  function setLaneCount(laneId, countId, creativeCount) {
    const base = baseCardCount(laneId);
    const count = $(countId);
    if (count) count.textContent = String(base + creativeCount);
    return base;
  }

  function renderCreativePriority(creative) {
    const assignments = assignmentsFor(creative.id);
    const where = assignments.length ? assignments.map(item => `${item.market || "Market"} / ${item.outletName || "Outlet"}`).join("; ") : "Market assignment not set yet";
    $("priority").dataset.gcmCreativePriority = "1";
    $("priority").innerHTML = `
      <div class="decision-grid">
        <div class="decision"><span>Who</span><strong>${esc(creative.clientName || creative.clientCode || "Client")}</strong></div>
        <div class="decision"><span>What</span><strong>${esc(creative.creativeName || "Creative")}</strong></div>
        <div class="decision"><span>Media Type</span><strong>${esc(creative.mediaType || "Media")}</strong></div>
        <div class="decision"><span>Stage</span><strong>${esc(creative.currentStage || "Idea / Direction")}</strong></div>
        <div class="decision"><span>Markets</span><strong>${esc(where)}</strong></div>
        <div class="decision next"><span>Next Action</span><strong>${esc(nextAction(creative))}</strong><a class="open-record" data-open-creative="${esc(creative.id)}" href="${creativeUrl(creative.id)}">Open production record →</a></div>
      </div>`;
  }

  function updatePriority(creatives, baseAction, waitingCount) {
    if (!$("priority") || baseAction > 0) return;
    const chosen = creatives.find(needsActionNow);
    if (chosen) {
      renderCreativePriority(chosen);
      return;
    }
    $("priority").dataset.gcmCreativePriority = "1";
    $("priority").innerHTML = `<div class="empty"><strong>No immediate media action required.</strong>${waitingCount ? `<div class="meta">${waitingCount} Creative${waitingCount === 1 ? " is" : "s are"} waiting or scheduled and remain visible below.</div>` : ""}</div>`;
  }

  function updateQueueDescription() {
    const queueHeading = [...document.querySelectorAll(".section-toggle .title-wrap h2")].find(node => node.textContent.trim() === "Campaign + Creative Queue");
    const paragraph = queueHeading?.parentElement?.querySelector("p");
    if (paragraph) paragraph.textContent = "Current placements and Creatives organized by operating stage, including work that is waiting or scheduled.";
  }

  function reconcile() {
    if (!workflow || !$("lane-preparing")) return;
    document.querySelectorAll(".gcm-creative-card").forEach(node => node.remove());
    const creatives = visibleCreatives();
    const lanes = {
      preparing: creatives.filter(item => laneFor(item) === "preparing"),
      ready: creatives.filter(item => laneFor(item) === "ready"),
      running: creatives.filter(item => laneFor(item) === "running"),
      awaiting: creatives.filter(item => laneFor(item) === "awaiting")
    };
    const laneMap = { preparing: "lane-preparing", ready: "lane-ready", running: "lane-running", awaiting: "lane-awaiting" };
    for (const [laneName, laneItems] of Object.entries(lanes)) {
      const laneNode = $(laneMap[laneName]);
      if (laneItems.length) laneNode?.querySelectorAll(".empty").forEach(node => node.remove());
      for (const creative of laneItems) laneNode?.insertAdjacentHTML("beforeend", creativeCard(creative, laneName));
    }

    const basePreparing = setLaneCount("lane-preparing", "lane-preparing-count", lanes.preparing.length);
    const baseReady = setLaneCount("lane-ready", "lane-ready-count", lanes.ready.length);
    const baseRunning = setLaneCount("lane-running", "lane-running-count", lanes.running.length);
    setLaneCount("lane-awaiting", "lane-awaiting-count", lanes.awaiting.length);
    if ($("count-preparing")) $("count-preparing").textContent = String(basePreparing + baseReady + lanes.preparing.length + lanes.ready.length);
    if ($("count-running")) $("count-running").textContent = String(baseRunning + lanes.running.length);

    const creativeActionCount = creatives.filter(needsActionNow).length;
    const waitingCount = creatives.filter(item => workStateFor(item).state === "waiting" && !["running", "history"].includes(laneFor(item))).length;
    const actionNode = $("count-action");
    let baseAction = 0;
    if (actionNode) {
      const current = Number(actionNode.textContent || 0);
      baseAction = lastActionOutput !== null && current === lastActionOutput ? Math.max(0, current - lastCreativeActionCount) : current;
      const output = baseAction + creativeActionCount;
      actionNode.textContent = String(output);
      lastCreativeActionCount = creativeActionCount;
      lastActionOutput = output;
      if ($("detail-action")) {
        $("detail-action").textContent = output
          ? `${output} record${output === 1 ? "" : "s"} require work now${waitingCount ? ` · ${waitingCount} waiting/scheduled` : ""}.`
          : `No immediate action${waitingCount ? ` · ${waitingCount} waiting/scheduled` : ""}.`;
      }
    }

    const firstUpcoming = [...lanes.preparing, ...lanes.ready][0];
    if (firstUpcoming && $("detail-preparing")) {
      const work = workStateFor(firstUpcoming);
      $("detail-preparing").textContent = work.state === "waiting"
        ? `${firstUpcoming.clientName || firstUpcoming.clientCode || "Client"} · ${firstUpcoming.creativeName || "Creative"} · waiting${work.resumeDate ? ` until ${formatDate(work.resumeDate)}` : ""}`
        : `${firstUpcoming.clientName || firstUpcoming.clientCode || "Client"} · ${firstUpcoming.creativeName || "Creative"} · ${firstUpcoming.currentStage || "Idea / Direction"}`;
    }

    updatePriority(creatives, baseAction, waitingCount);
    updateQueueDescription();
  }

  function scheduleReconcile(delay = 450) {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(reconcile, delay);
  }

  async function refreshAndReconcile() {
    try {
      await fetchWorkflow();
      scheduleReconcile(650);
    } catch (error) {
      console.error(`Media Dashboard Creative Queue ${VERSION}:`, error);
    }
  }

  function start() {
    refreshAndReconcile();
    document.addEventListener("change", event => {
      if (["client", "media-type-filter", "status-filter", "market-filter", "outlet-filter", "date-filter", "needs-action-filter"].includes(event.target?.id)) scheduleReconcile(event.target.id === "client" ? 900 : 80);
    }, true);
    document.addEventListener("input", event => {
      if (event.target?.id === "search-filter") scheduleReconcile(80);
    }, true);
    document.addEventListener("click", event => {
      const creativeLink = event.target.closest("[data-open-creative]");
      if (creativeLink) {
        event.preventDefault();
        event.stopPropagation();
        openCreativeRecord(creativeLink.dataset.openCreative);
        return;
      }
      if (event.target?.id === "refresh") setTimeout(refreshAndReconcile, 350);
      if (event.target?.id === "clear-filters") scheduleReconcile(100);
    }, true);
    window.addEventListener("gcm-media-work-state-changed", () => setTimeout(refreshAndReconcile, 250));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 0), { once: true });
  else setTimeout(start, 0);
})();
