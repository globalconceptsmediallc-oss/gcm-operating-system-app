/* =========================================================
   Global Concepts Media Operating System
   File: shared/media-placement-disposition.js
   Version: 1.1.0
   Status: Production Candidate
   Source: shared/media-placement-disposition.js 1.0.0
   Sprint: Media Replacement-in-Progress Linkage
   Purpose: Let the operator explicitly choose whether a live placement will
            retire without replacement or remain live while a specific new
            Creative is developed as its replacement.

   Production rules:
   - Reads authoritative placement records and Creative workflow records.
   - Writes only after an explicit operator click.
   - Retire-at-end and replacement-in-progress suppress stale-creative urgency.
   - Traffic, confirmation, dates, placement status, and Creative stage remain.
   - A linked replacement remains visible in Creative Production until finished.
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

  let records = [];
  let creatives = [];
  let reconcileTimer = null;

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
      replacementCreativeId: noteValue(record?.notes, "Replacement Creative ID:"),
      replacementCreativeName: noteValue(record?.notes, "Replacement Creative Name:"),
      endDate: noteValue(record?.notes, "Disposition End Date:"),
      reason: noteValue(record?.notes, "Disposition Reason:")
    };
  }

  function retiresAtEnd(record) {
    const value = disposition(record);
    return lower(value.disposition) === "retire_at_end" && lower(value.replacementRequired) === "no";
  }

  function replacementInProgress(record) {
    const value = disposition(record);
    return lower(value.disposition) === "replacement_in_progress" &&
      lower(value.replacementRequired) === "yes" &&
      /^\d+$/.test(String(value.replacementCreativeId || ""));
  }

  function placementDecisionHandled(record) {
    return retiresAtEnd(record) || replacementInProgress(record);
  }

  function toDate(value) {
    if (!value) return null;
    const date = new Date(String(value).slice(0, 10) + "T12:00:00");
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateText(value) {
    const date = toDate(value);
    return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not set";
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
    if (age === null) return { level: "unknown", label: "Creative age unknown", days: null };
    if (age <= 30) return { level: "fresh", label: "Fresh", days: age };
    if (age <= 45) return { level: "watch", label: "Watch", days: age };
    if (age <= 60) return { level: "refresh", label: "Refresh Due", days: age };
    return { level: "stale", label: "Stale", days: age };
  }

  function urgency(record) {
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

  function nextAction(record) {
    if (isAwaiting(record)) return "Review the expected station/outlet response and process confirmation evidence when it arrives.";
    if (needsAttention(record)) return record.attentionReason || "Open the Media production record and complete the required action.";
    if (retiresAtEnd(record)) {
      return `Continue the current rotation through ${dateText(record.endDate)}, then retire this placement. No replacement Creative is required.`;
    }
    if (replacementInProgress(record)) {
      const value = disposition(record);
      return `Replacement Creative #${value.replacementCreativeId} — ${value.replacementCreativeName || "Creative"} is in progress. Keep the current placement running while the replacement is developed.`;
    }
    if (["pending", "planned", "preparing"].includes(lower(record?.status))) return "Continue creative, production, co-op, schedule, or traffic preparation for this campaign.";
    if (isExplicitlyReady(record)) return "Launch package is explicitly ready. Send traffic or complete the next confirmed launch step.";
    const currentFreshness = freshness(record);
    const candidate = replacementCandidate(record);
    if (candidate && ["watch", "refresh", "stale"].includes(currentFreshness?.level)) {
      return `A matching replacement Creative already exists: #${candidate.id} — ${candidate.creativeName}. Link it to this live placement or choose a different end-of-run decision.`;
    }
    if (currentFreshness?.level === "watch") return "Creative is entering the review window. Decide whether it should refresh, continue, or retire at the end of its run.";
    if (currentFreshness?.level === "refresh") return "Decide whether to refresh the Creative or let this placement finish and retire without replacement.";
    if (currentFreshness?.level === "stale") return "Decide whether to replace the Creative or let this placement finish and retire without replacement.";
    if (isActive(record)) return "Placement is confirmed and running normally. Continue monitoring dates, rotation, and creative age.";
    return "Retain as historical planning intelligence for future campaigns.";
  }

  function creativeKey(value) {
    return lower(value)
      .replace(/\bv(?:ersion)?\s*\d+$/i, "")
      .replace(/\s+\d+$/i, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function replacementCandidate(record) {
    if (!record || placementDecisionHandled(record)) return null;
    const keys = [record.campaignName, record.creativeName]
      .map(creativeKey)
      .filter(Boolean);
    if (!keys.length) return null;

    const candidates = creatives
      .filter(creative => Number(creative.clientId) === Number(record.clientId))
      .filter(creative => !["retired", "archived", "deleted"].includes(lower(creative.status)))
      .map(creative => {
        const key = creativeKey(creative.creativeName);
        let score = 0;
        for (const target of keys) {
          if (key && key === target) score = Math.max(score, 100);
          else if (key && target && (key.startsWith(target + " ") || target.startsWith(key + " "))) score = Math.max(score, 80);
        }
        return { creative, score };
      })
      .filter(item => item.score >= 80)
      .sort((a, b) => b.score - a.score || Number(b.creative.id) - Number(a.creative.id));

    if (!candidates.length) return null;
    if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
      const firstKey = creativeKey(candidates[0].creative.creativeName);
      const secondKey = creativeKey(candidates[1].creative.creativeName);
      if (firstKey === secondKey) return candidates[0].creative;
    }
    return candidates[0].creative;
  }

  function matchesFilters(record) {
    const clientId = Number($("client")?.value || 0);
    const type = lower($("media-type-filter")?.value);
    const status = lower($("status-filter")?.value);
    const market = lower($("market-filter")?.value);
    const outlet = lower($("outlet-filter")?.value);
    const dateView = $("date-filter")?.value || "";
    const search = lower($("search-filter")?.value);
    const actionOnly = Boolean($("needs-action-filter")?.checked);

    if (clientId && Number(record.clientId) !== clientId) return false;
    if (type && lower(record.mediaType) !== type) return false;
    if (status && lower(record.status) !== status) return false;
    if (market && lower(record.market) !== market) return false;
    if (outlet && lower(record.outletName) !== outlet) return false;
    if (dateView === "upcoming" && dateRelation(record) !== "upcoming") return false;
    if (dateView === "running" && dateRelation(record) !== "running") return false;
    if (dateView === "history" && dateRelation(record) !== "history") return false;
    if (actionOnly && urgency(record) <= 0) return false;
    if (search) {
      const value = disposition(record);
      const haystack = [
        record.clientName, record.clientCode, record.campaignName, record.creativeName,
        record.fileName, record.market, record.outletName, record.status,
        record.trafficStatus, record.confirmationStatus, record.attentionReason,
        value.reason, value.replacementCreativeName, value.replacementCreativeId,
        record.mediaType
      ].map(lower).join(" ");
      if (!haystack.includes(search)) return false;
    }
    return true;
  }

  function visibleRecords() {
    return records.filter(matchesFilters);
  }

  async function post(body) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
      throw new Error(payload?.error || payload?.details || `Worker returned ${response.status}`);
    }
    return payload;
  }

  async function fetchData() {
    const [placementPayload, creativePayload] = await Promise.all([
      post({ action: "get-media-operations" }),
      post({ action: "get-media-operations", operation: "get_creative_workflow" })
    ]);
    records = Array.isArray(placementPayload?.mediaOperations?.records)
      ? placementPayload.mediaOperations.records
      : [];
    creatives = Array.isArray(creativePayload?.creativeWorkflow?.creatives)
      ? creativePayload.creativeWorkflow.creatives
      : [];
  }

  function setText(node, value) {
    if (node && node.textContent !== String(value)) node.textContent = String(value);
  }

  function patchPlacementCards() {
    const byId = new Map(records.map(record => [String(record.id), record]));
    document.querySelectorAll(".card[data-record-id]").forEach(card => {
      const record = byId.get(String(card.dataset.recordId));
      if (!record) return;
      const handled = retiresAtEnd(record) || replacementInProgress(record);
      if (!handled) return;

      const existingBadge = card.querySelector("[data-gcm-disposition-badge]");
      const label = retiresAtEnd(record)
        ? "Retire at End · No Replacement"
        : `Replacement #${disposition(record).replacementCreativeId} In Progress`;
      if (!existingBadge) {
        card.querySelector(".action")?.insertAdjacentHTML(
          "beforebegin",
          `<div class="meta"><span class="badge b-success" data-gcm-disposition-badge="1">${esc(label)}</span></div>`
        );
      } else {
        setText(existingBadge, label);
      }
      const action = card.querySelector(".action");
      if (action) setText(action, nextAction(record));
    });
  }

  function renderPriority() {
    const priority = $("priority");
    if (!priority) return;
    const chosen = visibleRecords()
      .filter(record => urgency(record) > 0)
      .sort((a, b) => urgency(b) - urgency(a))[0];

    if (!chosen) {
      const creativeCard = document.querySelector("#lane-awaiting .gcm-creative-card, #lane-ready .gcm-creative-card, #lane-preparing .gcm-creative-card");
      if (creativeCard) {
        const what = creativeCard.querySelector("strong")?.textContent?.trim() || "Creative workflow";
        const action = creativeCard.querySelector(".action")?.textContent?.trim() || "Continue the current Creative Production workflow.";
        const link = creativeCard.querySelector("[data-open-creative]")?.getAttribute("href") || "media-production.html";
        priority.innerHTML = `<div class="decision-grid"><div class="decision"><span>Status</span><strong>Creative workflow action pending</strong></div><div class="decision"><span>What</span><strong>${esc(what)}</strong></div><div class="decision next"><span>Next Action</span><strong>${esc(action)}</strong><a class="open-record" href="${esc(link)}">Open production record →</a></div></div>`;
      } else {
        priority.innerHTML = '<div class="decision-grid"><div class="decision"><span>Status</span><strong>No immediate media action required</strong></div><div class="decision"><span>Why</span><strong>Visible placements are running normally, intentionally finishing, linked to replacement work, or retained as history.</strong></div><div class="decision next"><span>Next Review</span><strong>Review the next production, traffic, confirmation, or scheduled end-of-run obligation.</strong></div></div>';
      }
      return;
    }

    const currentFreshness = freshness(chosen);
    const candidate = replacementCandidate(chosen);
    const when = chosen.stationDeadline
      ? `Traffic deadline ${dateText(chosen.stationDeadline)}`
      : chosen.startDate
        ? `Starts ${dateText(chosen.startDate)}`
        : chosen.endDate
          ? `Ends ${dateText(chosen.endDate)}`
          : "No date established";
    const why = isAwaiting(chosen)
      ? "Traffic was sent and authoritative placement data is waiting on confirmation."
      : needsAttention(chosen)
        ? (chosen.attentionReason || "The placement is inside an attention window.")
        : currentFreshness && ["watch", "refresh", "stale"].includes(currentFreshness.level)
          ? `${currentFreshness.label}: ${currentFreshness.days} days in current creative rotation.`
          : "The campaign is approaching launch and readiness must be confirmed.";

    const canDecide = isActive(chosen) && currentFreshness && ["watch", "refresh", "stale"].includes(currentFreshness.level) && !placementDecisionHandled(chosen);
    const replacementChoice = canDecide && candidate
      ? `<button class="gcm-replacement-choice" data-link-replacement="${esc(chosen.id)}" data-creative-id="${esc(candidate.id)}" type="button">Replacement In Progress → ${esc(candidate.creativeName)}</button>`
      : "";
    const retirementChoice = canDecide
      ? `<button class="gcm-retire-choice" data-retire-no-replacement="${esc(chosen.id)}" type="button">Run Through End → Retire / No Replacement</button>`
      : "";

    priority.innerHTML = `<div class="decision-grid clickable-record" role="link" tabindex="0" data-record-id="${esc(chosen.id)}"><div class="decision"><span>Who</span><strong>${esc(chosen.clientName || chosen.clientCode || "Client")}</strong></div><div class="decision"><span>What</span><strong>${esc(chosen.campaignName || chosen.creativeName || "Media placement")} · ${esc(chosen.outletName || "Outlet not set")}</strong></div><div class="decision"><span>Media Type</span><strong>${esc(chosen.mediaType || "Media")}</strong></div><div class="decision"><span>When</span><strong>${esc(when)}</strong></div><div class="decision"><span>Why</span><strong>${esc(why)}</strong></div><div class="decision next"><span>Next Action</span><strong>${esc(nextAction(chosen))}</strong>${replacementChoice}${retirementChoice}<div class="open-record production-link" data-production-id="${esc(chosen.id)}">Open production record →</div><div class="open-record">Open campaign / traffic record →</div><div class="gcm-disposition-message" data-disposition-message="${esc(chosen.id)}"></div></div></div>`;
  }

  function reconcileSummary() {
    const visible = visibleRecords();
    const legacyActionCount = visible.filter(record => urgency(record) >= 70).length;
    const creativeActionCount = document.querySelectorAll("#lane-preparing .gcm-creative-card, #lane-ready .gcm-creative-card, #lane-awaiting .gcm-creative-card").length;
    const totalAction = legacyActionCount + creativeActionCount;
    setText($("count-action"), totalAction);
    if ($("detail-action")) {
      setText($("detail-action"), totalAction
        ? `${totalAction} record${totalAction === 1 ? "" : "s"} require production, preparation, confirmation, or an operating decision.`
        : "No immediate operating action in the current view.");
    }

    const runningLegacy = visible.filter(record => isActive(record));
    const refreshDue = runningLegacy.filter(record => !placementDecisionHandled(record) && ["refresh", "stale"].includes(freshness(record)?.level)).length;
    const retiring = runningLegacy.filter(retiresAtEnd).length;
    const replacing = runningLegacy.filter(replacementInProgress).length;
    const displayedRunning = Number($("count-running")?.textContent || runningLegacy.length);
    if ($("detail-running") && displayedRunning) {
      const parts = [`${displayedRunning} active placement${displayedRunning === 1 ? "" : "s"}`];
      if (refreshDue) parts.push(`${refreshDue} creative refresh${refreshDue === 1 ? "" : "es"} due/stale`);
      if (replacing) parts.push(`${replacing} linked to replacement work in progress`);
      if (retiring) parts.push(`${retiring} scheduled to retire at end without replacement`);
      setText($("detail-running"), parts.join(" · ") + ".");
    }
  }

  function injectStyles() {
    if (document.getElementById("gcm-media-placement-disposition-styles")) return;
    const style = document.createElement("style");
    style.id = "gcm-media-placement-disposition-styles";
    style.textContent = `
      .gcm-retire-choice,.gcm-replacement-choice{display:inline-flex;align-items:center;justify-content:center;min-height:40px;margin:12px 12px 2px 0;padding:0 14px;border-radius:10px;font:inherit;font-size:.76rem;font-weight:900;cursor:pointer}
      .gcm-retire-choice{border:1px solid #d6a94a;background:#d6a94a;color:#071426}
      .gcm-replacement-choice{border:1px solid #5fd397;background:#e9f7f0;color:#145b3b}
      .gcm-retire-choice:hover,.gcm-replacement-choice:hover{filter:brightness(.97)}
      .gcm-retire-choice:disabled,.gcm-replacement-choice:disabled{opacity:.55;cursor:wait}
      .gcm-disposition-message{margin-top:8px;color:#cfe6d9;font-size:.72rem;font-weight:800}
    `;
    document.head.appendChild(style);
  }

  async function saveDecision({ recordId, button, dispositionName, creativeId = null }) {
    const record = records.find(item => String(item.id) === String(recordId));
    if (!record) return;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "Saving decision…";
    const message = document.querySelector(`[data-disposition-message="${String(recordId).replaceAll('"', '\\"')}"]`);
    if (message) message.textContent = "Saving the placement decision to the existing Media record…";

    try {
      const body = {
        action: "get-media-operations",
        operation: "set_placement_disposition",
        mediaRecordId: Number(recordId),
        disposition: dispositionName,
        author: "Andy"
      };
      if (dispositionName === "retire_at_end_no_replacement") {
        body.reason = "Other approved commercials remain in rotation; no replacement Creative is required.";
      } else {
        const creative = creatives.find(item => Number(item.id) === Number(creativeId));
        body.creativeId = Number(creativeId);
        body.reason = creative
          ? `Replacement Creative #${creative.id} — ${creative.creativeName} is already in production. Keep the current placement live while the replacement is developed.`
          : "A replacement Creative is already in production. Keep the current placement live while the replacement is developed.";
      }

      await post(body);
      if (message) {
        message.textContent = dispositionName === "retire_at_end_no_replacement"
          ? `Saved. Run through ${dateText(record.endDate)}, then retire. No replacement required.`
          : `Saved. The current placement remains live and is linked to replacement Creative #${creativeId}.`;
      }
      await fetchData();
      const refresh = $("refresh");
      if (refresh) refresh.click();
      scheduleReconcile(450);
      scheduleReconcile(1100);
    } catch (error) {
      console.error(`Media Placement Disposition ${VERSION}:`, error);
      if (message) message.textContent = `Could not save: ${error.message}`;
      button.disabled = false;
      button.textContent = original;
    }
  }

  function reconcile() {
    if (!records.length || !$("priority")) return;
    patchPlacementCards();
    reconcileSummary();
    renderPriority();
  }

  function scheduleReconcile(delay = 250) {
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(reconcile, delay);
  }

  async function refreshData() {
    try {
      await fetchData();
      scheduleReconcile(250);
      setTimeout(reconcile, 850);
      setTimeout(reconcile, 1700);
    } catch (error) {
      console.error(`Media Placement Disposition ${VERSION}:`, error);
    }
  }

  function start() {
    injectStyles();
    refreshData();

    document.addEventListener("click", event => {
      const replacementButton = event.target.closest("[data-link-replacement]");
      if (replacementButton) {
        event.preventDefault();
        event.stopPropagation();
        saveDecision({
          recordId: replacementButton.dataset.linkReplacement,
          creativeId: replacementButton.dataset.creativeId,
          dispositionName: "replacement_in_progress",
          button: replacementButton
        });
        return;
      }

      const retireButton = event.target.closest("[data-retire-no-replacement]");
      if (retireButton) {
        event.preventDefault();
        event.stopPropagation();
        saveDecision({
          recordId: retireButton.dataset.retireNoReplacement,
          dispositionName: "retire_at_end_no_replacement",
          button: retireButton
        });
        return;
      }

      if (event.target?.id === "refresh") setTimeout(refreshData, 450);
      if (event.target?.id === "clear-filters") scheduleReconcile(500);
    }, true);

    document.addEventListener("change", event => {
      if (["client", "media-type-filter", "status-filter", "market-filter", "outlet-filter", "date-filter", "needs-action-filter"].includes(event.target?.id)) {
        if (event.target.id === "client") setTimeout(refreshData, 500);
        else scheduleReconcile(350);
      }
    }, true);

    document.addEventListener("input", event => {
      if (event.target?.id === "search-filter") scheduleReconcile(250);
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(start, 0), { once: true });
  } else {
    setTimeout(start, 0);
  }
})();
