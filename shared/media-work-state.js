/* =========================================================
   Global Concepts Media Operating System
   File: shared/media-work-state.js
   Version: 1.0.0
   Status: Production Candidate
   Sprint: Media Work State / Waiting + Scheduled
   Purpose: Let an unfinished Creative be explicitly Active or Waiting /
            Scheduled without changing its production stage or status.

   Production rules:
   - Work State is preserved durably in media_creative_history.
   - Saving Work State never advances a production stage.
   - Waiting / Scheduled can preserve a reason and optional resume date.
   - Resume dates make scheduled work actionable when the date arrives.
   - Existing Creative fields and history remain untouched.
   ========================================================= */

(() => {
  "use strict";

  const VERSION = "1.0.0";
  const ENDPOINT = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const $ = id => document.getElementById(id);
  const lower = value => String(value || "").trim().toLowerCase();
  let workflow = null;
  let timer = null;

  async function api(operation, extra = {}) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get-media-operations", operation, ...extra })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || payload?.details || `Worker returned ${response.status}`);
    return payload;
  }

  function creativeId() {
    const selectId = Number($("creative")?.value || 0);
    if (selectId) return selectId;
    const queryId = Number(new URLSearchParams(location.search).get("creativeId") || 0);
    if (queryId) return queryId;
    try { return Number(sessionStorage.getItem("gcmMediaCreativeId") || 0); } catch { return 0; }
  }

  function lineValue(content, label) {
    const line = String(content || "").split(/\r?\n/).find(item => lower(item).startsWith(lower(label)));
    return line ? line.slice(label.length).trim() : "";
  }

  function latestState(id) {
    const entry = (workflow?.history || []).find(item => Number(item.creativeId) === Number(id) && lower(item.entryType) === "work_state");
    if (!entry) return { state: "active", waitingFor: "", resumeDate: "", entry: null };
    return {
      state: lower(lineValue(entry.content, "Work State:")) || "active",
      waitingFor: lineValue(entry.content, "Waiting For:"),
      resumeDate: lineValue(entry.content, "Resume Date:"),
      entry
    };
  }

  function injectStyles() {
    if ($("gcm-media-work-state-styles")) return;
    const style = document.createElement("style");
    style.id = "gcm-media-work-state-styles";
    style.textContent = `
      .gcm-work-state{margin-top:14px;padding:14px;border:1px solid #c9d9f3;border-radius:12px;background:#f8fbff}
      .gcm-work-state-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
      .gcm-work-state-head strong{color:#071426;font-size:.88rem}.gcm-work-state-head span{color:#637083;font-size:.72rem}
      .gcm-work-state-grid{display:grid;grid-template-columns:1fr 2fr 1fr auto;gap:10px;align-items:end}
      .gcm-work-state label{font-size:.72rem}.gcm-work-state select,.gcm-work-state input{margin-top:5px}
      .gcm-work-state button{min-height:40px;padding:0 13px;border:1px solid #1f68d8;border-radius:9px;background:#1f68d8;color:#fff;font:inherit;font-weight:850;cursor:pointer}
      .gcm-work-state button:disabled{opacity:.55;cursor:not-allowed}
      .gcm-work-state-status{margin-top:10px;color:#637083;font-size:.74rem;font-weight:750}
      .gcm-work-state-status.waiting{color:#8a5b12}.gcm-work-state-status.active{color:#1f7a4f}.gcm-work-state-status.err{color:#b33a3a}
      @media(max-width:900px){.gcm-work-state-grid{grid-template-columns:1fr 1fr}.gcm-work-state-grid button{justify-self:start}}
    `;
    document.head.appendChild(style);
  }

  function injectPanel() {
    if ($("gcm-work-state")) return true;
    const overview = document.querySelector(".overview");
    if (!overview) return false;
    overview.insertAdjacentHTML("afterend", `
      <div class="gcm-work-state" id="gcm-work-state">
        <div class="gcm-work-state-head"><div><strong>Work State</strong><br><span>Separate “unfinished” from “needs work now.” Saving here never advances the Creative.</span></div></div>
        <div class="gcm-work-state-grid">
          <label>State<select id="gcm-work-state-select"><option value="active">Active — work now</option><option value="waiting">Waiting / Scheduled</option></select></label>
          <label>Waiting For<input id="gcm-work-waiting-for" placeholder="Monica script session, station reply, client approval…"></label>
          <label>Resume Date<input id="gcm-work-resume-date" type="date"></label>
          <button type="button" id="gcm-work-state-save">Save Work State</button>
        </div>
        <div class="gcm-work-state-status" id="gcm-work-state-status">Select a Creative to manage its work state.</div>
      </div>`);
    $("gcm-work-state-select").addEventListener("change", syncEnabledState);
    $("gcm-work-state-save").addEventListener("click", saveState);
    return true;
  }

  function syncEnabledState() {
    const waiting = $("gcm-work-state-select")?.value === "waiting";
    if ($("gcm-work-waiting-for")) $("gcm-work-waiting-for").disabled = !waiting;
    if ($("gcm-work-resume-date")) $("gcm-work-resume-date").disabled = !waiting;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  function renderState() {
    const id = creativeId();
    const status = $("gcm-work-state-status");
    if (!id || !workflow) {
      if (status) status.textContent = "Select a Creative to manage its work state.";
      return;
    }
    const state = latestState(id);
    $("gcm-work-state-select").value = state.state === "waiting" || state.state === "scheduled" ? "waiting" : "active";
    $("gcm-work-waiting-for").value = state.waitingFor || "";
    $("gcm-work-resume-date").value = state.resumeDate || "";
    syncEnabledState();
    if (status) {
      if ($("gcm-work-state-select").value === "waiting") {
        status.className = "gcm-work-state-status waiting";
        status.textContent = `Waiting${state.waitingFor ? ` for ${state.waitingFor}` : ""}${state.resumeDate ? ` · resumes ${formatDate(state.resumeDate)}` : ""}.`;
      } else {
        status.className = "gcm-work-state-status active";
        status.textContent = "Active — this Creative can contribute to Needs Action when its current stage requires work.";
      }
    }
  }

  async function refresh() {
    workflow = (await api("get_creative_workflow")).creativeWorkflow || null;
    renderState();
  }

  async function saveState() {
    const button = $("gcm-work-state-save");
    const status = $("gcm-work-state-status");
    const id = creativeId();
    if (!id) {
      if (status) { status.className = "gcm-work-state-status err"; status.textContent = "Save or select the Creative first."; }
      return;
    }
    const state = $("gcm-work-state-select").value;
    const waitingFor = $("gcm-work-waiting-for").value.trim();
    const resumeDate = $("gcm-work-resume-date").value;
    if (state === "waiting" && !waitingFor) {
      if (status) { status.className = "gcm-work-state-status err"; status.textContent = "Enter what this Creative is waiting for."; }
      return;
    }
    button.disabled = true;
    try {
      const stage = $("stage")?.value || document.getElementById("stagePill")?.textContent || "";
      const content = [`Work State: ${state}`, `Waiting For: ${state === "waiting" ? waitingFor : ""}`, `Resume Date: ${state === "waiting" ? resumeDate : ""}`].join("\n");
      await api("append_creative_history", { creativeId: id, entryType: "work_state", stage, author: "Andy", content });
      await refresh();
      window.dispatchEvent(new CustomEvent("gcm-media-work-state-changed", { detail: { creativeId: id, state, waitingFor, resumeDate } }));
    } catch (error) {
      if (status) { status.className = "gcm-work-state-status err"; status.textContent = error.message || String(error); }
    } finally {
      button.disabled = false;
    }
  }

  function scheduleRefresh(delay = 250) {
    clearTimeout(timer);
    timer = setTimeout(() => refresh().catch(error => {
      const status = $("gcm-work-state-status");
      if (status) { status.className = "gcm-work-state-status err"; status.textContent = error.message || String(error); }
    }), delay);
  }

  function start() {
    injectStyles();
    if (!injectPanel()) return;
    scheduleRefresh(500);
    document.addEventListener("change", event => {
      if (event.target?.id === "creative") scheduleRefresh(250);
    }, true);
    document.addEventListener("click", event => {
      if (["newCreative", "saveOnly", "saveOverride"].includes(event.target?.id)) scheduleRefresh(900);
      if (event.target?.matches?.("[data-save],[data-complete]")) scheduleRefresh(1100);
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 0), { once: true });
  else setTimeout(start, 0);

  console.info(`Media Work State ${VERSION} loaded.`);
})();
