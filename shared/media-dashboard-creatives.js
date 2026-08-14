/* =========================================================
   Global Concepts Media Operating System
   File: shared/media-dashboard-creatives.js
   Version: 1.0.2
   Status: Production Candidate
   Sprint: Media Dashboard Creative Queue Connection
   Purpose: Add new media_creatives workflow records to the existing Media
            dashboard queue without changing or replacing legacy placement data.

   Production rules:
   - Legacy media_records remain untouched and continue to render normally.
   - New media_creatives are read through get_creative_workflow only.
   - Creative cards are additive; no D1 writes occur from this dashboard layer.
   - A creative can appear before it has a market/placement assignment.
   - Creative links carry creativeId and preserve a session handoff fallback.
   ========================================================= */

(() => {
  "use strict";

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
      body: JSON.stringify({
        action: "get-media-operations",
        operation: "get_creative_workflow"
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
      throw new Error(payload?.error || payload?.details || `Worker returned ${response.status}`);
    }
    workflow = payload.creativeWorkflow || null;
    return workflow;
  }

  function assignmentsFor(creativeId) {
    return (workflow?.assignments || []).filter(item =>
      Number(item.creativeId) === Number(creativeId) &&
      !["removed"].includes(lower(item.assignmentStatus))
    );
  }

  function packagesFor(creativeId) {
    return (workflow?.trafficPackages || []).filter(item =>
      Number(item.creativeId) === Number(creativeId)
    );
  }

  function laneFor(creative) {
    const packages = packagesFor(creative.id);
    const packageStatuses = packages.map(item => lower(item.packageStatus));
    const stage = lower(creative.currentStage);
    const status = lower(creative.status);

    if (packageStatuses.some(value => ["sent", "received_confirmed"].includes(value))) return "awaiting";
    if (
      status === "running" ||
      stage === "running / rotation" ||
      assignmentsFor(creative.id).some(item => lower(item.assignmentStatus) === "active")
    ) return "running";
    if (
      status === "ready" ||
      (stage === "station email package" && assignmentsFor(creative.id).length > 0)
    ) return "ready";
    if (status === "retired" || stage === "retired") return "history";
    return "preparing";
  }

  function nextAction(creative) {
    const stage = lower(creative.currentStage);
    const voice = String(creative.voiceTalent || "").trim();
    if (stage === "idea / direction") return "Develop the working script and preserve the next approved copy.";
    if (stage === "working script") return "Review the working script and move it to explicit approval when you are ready.";
    if (stage === "approved script") return voice
      ? `Move the approved script into recording with ${voice}.`
      : "Move the approved script into recording and assign the voice talent.";
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
      if (actionOnly && !["preparing", "ready", "awaiting"].includes(lane)) return false;
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
    });
  }

  function creativeCard(creative, lane) {
    const assignments = assignmentsFor(creative.id);
    const assignmentText = assignments.length
      ? assignments.map(item => `${item.market || "Market"} / ${item.outletName || "Outlet"}`).join("; ")
      : "No market assignment yet";
    const stage = creative.currentStage || "Idea / Direction";
    const badge = lane === "ready" ? ["b-success", "Ready"]
      : lane === "running" ? ["b-info", "Running"]
      : lane === "awaiting" ? ["b-critical", "Awaiting"]
      : ["b-warning", "Producing"];
    const length = creative.lengthSeconds ? `:${creative.lengthSeconds}` : "Length not set";
    const voice = creative.voiceTalent ? ` · Voice: ${creative.voiceTalent}` : "";

    return `
      <article class="card gcm-creative-card" data-creative-id="${esc(creative.id)}">
        <span class="badge ${badge[0]}">${badge[1]}</span>
        <span class="badge b-info">${esc(creative.mediaType || "Media")}</span>
        <strong>${esc(creative.clientName || creative.clientCode || "Client")} · ${esc(creative.creativeName || "Creative")}</strong>
        <div class="meta"><strong>Creative #${esc(creative.id)}</strong> · ${esc(stage)} · ${esc(length)}${esc(voice)}</div>
        <div class="meta">${esc(assignmentText)}</div>
        <div class="action">${esc(nextAction(creative))}</div>
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

  function updatePriority(creatives, baseVisibleCards) {
    if (!creatives.length || baseVisibleCards > 0) return;
    const chosen = creatives.find(item => ["awaiting", "ready", "preparing"].includes(laneFor(item))) || creatives[0];
    if (!chosen || !$("priority")) return;
    const assignments = assignmentsFor(chosen.id);
    const where = assignments.length
      ? assignments.map(item => `${item.market || "Market"} / ${item.outletName || "Outlet"}`).join("; ")
      : "Market assignment not set yet";

    $("priority").innerHTML = `
      <div class="decision-grid">
        <div class="decision"><span>Who</span><strong>${esc(chosen.clientName || chosen.clientCode || "Client")}</strong></div>
        <div class="decision"><span>What</span><strong>${esc(chosen.creativeName || "Creative")}</strong></div>
        <div class="decision"><span>Media Type</span><strong>${esc(chosen.mediaType || "Media")}</strong></div>
        <div class="decision"><span>Stage</span><strong>${esc(chosen.currentStage || "Idea / Direction")}</strong></div>
        <div class="decision"><span>Markets</span><strong>${esc(where)}</strong></div>
        <div class="decision next"><span>Next Action</span><strong>${esc(nextAction(chosen))}</strong><a class="open-record" data-open-creative="${esc(chosen.id)}" href="${creativeUrl(chosen.id)}">Open production record →</a></div>
      </div>`;
  }

  function updateQueueDescription() {
    const queueHeading = [...document.querySelectorAll(".section-toggle .title-wrap h2")]
      .find(node => node.textContent.trim() === "Campaign + Creative Queue");
    const paragraph = queueHeading?.parentElement?.querySelector("p");
    if (paragraph) paragraph.textContent = "D1 placement records and Creative Production records organized together by operating stage.";
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
    const laneMap = {preparing:"lane-preparing",ready:"lane-ready",running:"lane-running",awaiting:"lane-awaiting"};
    for (const [laneName, laneItems] of Object.entries(lanes)) {
      const laneNode = $(laneMap[laneName]);
      if (laneItems.length) laneNode?.querySelectorAll(".empty").forEach(node => node.remove());
      for (const creative of laneItems) laneNode?.insertAdjacentHTML("beforeend", creativeCard(creative, laneName));
    }

    const basePreparing = setLaneCount("lane-preparing", "lane-preparing-count", lanes.preparing.length);
    const baseReady = setLaneCount("lane-ready", "lane-ready-count", lanes.ready.length);
    const baseRunning = setLaneCount("lane-running", "lane-running-count", lanes.running.length);
    const baseAwaiting = setLaneCount("lane-awaiting", "lane-awaiting-count", lanes.awaiting.length);
    if ($("count-preparing")) $("count-preparing").textContent = String(basePreparing + baseReady + lanes.preparing.length + lanes.ready.length);
    if ($("count-running")) $("count-running").textContent = String(baseRunning + lanes.running.length);

    const creativeActionCount = lanes.preparing.length + lanes.ready.length + lanes.awaiting.length;
    const actionNode = $("count-action");
    if (actionNode) {
      const current = Number(actionNode.textContent || 0);
      const baseAction = lastActionOutput !== null && current === lastActionOutput
        ? Math.max(0, current - lastCreativeActionCount)
        : current;
      const output = baseAction + creativeActionCount;
      actionNode.textContent = String(output);
      lastCreativeActionCount = creativeActionCount;
      lastActionOutput = output;
    }

    const firstUpcoming = [...lanes.preparing, ...lanes.ready][0];
    if (firstUpcoming && $("detail-preparing")) {
      $("detail-preparing").textContent = `${firstUpcoming.clientName || firstUpcoming.clientCode || "Client"} · ${firstUpcoming.creativeName || "Creative"} · ${firstUpcoming.currentStage || "Idea / Direction"}`;
    }
    if (creativeActionCount && $("detail-action")) {
      const total = Number($("count-action")?.textContent || creativeActionCount);
      $("detail-action").textContent = `${total} record${total === 1 ? "" : "s"} require production, preparation, confirmation, or creative refresh.`;
    }

    const baseVisibleCards = basePreparing + baseReady + baseRunning + baseAwaiting;
    updatePriority(creatives, baseVisibleCards);
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
      console.error("Media Dashboard Creative Queue 1.0.2:", error);
    }
  }

  function start() {
    refreshAndReconcile();
    document.addEventListener("change", event => {
      if (["client", "media-type-filter", "status-filter", "market-filter", "outlet-filter", "date-filter", "needs-action-filter"].includes(event.target?.id)) {
        scheduleReconcile(event.target.id === "client" ? 900 : 80);
      }
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(start, 0), { once: true });
  } else {
    setTimeout(start, 0);
  }
})();
