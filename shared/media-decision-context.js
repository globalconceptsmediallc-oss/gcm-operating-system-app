/* =========================================================
   Global Concepts Media Operating System
   File: shared/media-decision-context.js
   Version: 1.0.0
   Status: Production Candidate
   Sprint: Media Commercial-Level Decision Context
   Purpose: Make Media operating decisions intuitive by showing the same
            commercial across markets, surfacing prior market decisions, and
            letting the operator review the current spot/copy before deciding.

   Production rules:
   - Reads authoritative media_records only.
   - A commercial is grouped by client + normalized campaign/creative name.
   - Other-market decisions are context, never automatic writes.
   - Applying the same decision requires an explicit operator click.
   - Market-specific overrides always remain available.
   - Current copy is shown exactly as stored; it is never rewritten here.
   - Audio is played only from the stored asset filename/URL when browser-accessible.
   ========================================================= */

(() => {
  "use strict";

  const VERSION = "1.0.0";
  const ENDPOINT = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const lower = value => String(value || "").trim().toLowerCase();
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  let records = [];
  let patchTimer = null;
  const marketOverrides = new Set();

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
      replacementCreativeName: noteValue(record?.notes, "Replacement Creative Name:")
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

  function decisionSignature(record) {
    if (retiresAtEnd(record)) return "retire_at_end_no_replacement";
    if (replacementInProgress(record)) {
      return `replacement_in_progress:${disposition(record).replacementCreativeId}`;
    }
    return "";
  }

  function decisionLabel(record) {
    if (retiresAtEnd(record)) return "Run Through End → Retire / No Replacement";
    if (replacementInProgress(record)) {
      const value = disposition(record);
      return `Replacement #${value.replacementCreativeId} — ${value.replacementCreativeName || "Creative"} In Progress`;
    }
    const status = lower(record?.status);
    if (["active", "running", "confirmed"].includes(status)) return "Running · Decision Needed";
    if (["pending", "planned", "preparing"].includes(status)) return "Upcoming / Preparing";
    return record?.status ? String(record.status) : "No decision recorded";
  }

  function creativeKey(value) {
    return lower(value)
      .replace(/\bv(?:ersion)?\s*\d+$/i, "")
      .replace(/\s+\d+$/i, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function recordKeys(record) {
    return [record?.campaignName, record?.creativeName].map(creativeKey).filter(Boolean);
  }

  function recordsMatchCommercial(a, b) {
    if (!a || !b || Number(a.clientId) !== Number(b.clientId)) return false;
    const aKeys = recordKeys(a);
    const bKeys = recordKeys(b);
    return aKeys.some(key => bKeys.includes(key));
  }

  function toDate(value) {
    if (!value) return null;
    const date = new Date(String(value).slice(0, 10) + "T12:00:00");
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isCurrentPlacement(record) {
    const end = toDate(record?.endDate);
    if (end) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (end < today) return false;
    }
    return !["expired", "completed", "archived", "deleted"].includes(lower(record?.status));
  }

  function commercialGroup(record) {
    return records
      .filter(item => recordsMatchCommercial(record, item))
      .filter(isCurrentPlacement)
      .sort((a, b) => {
        if (String(a.id) === String(record.id)) return -1;
        if (String(b.id) === String(record.id)) return 1;
        return `${a.market || ""}|${a.outletName || ""}`.localeCompare(`${b.market || ""}|${b.outletName || ""}`);
      });
  }

  function placementLabel(record) {
    return [record?.market || "Market not set", record?.outletName || "Outlet not set"].join(" / ");
  }

  function commercialName(record) {
    return String(record?.campaignName || record?.creativeName || "Commercial").trim();
  }

  function currentCopy(record, group) {
    const candidates = [record, ...group.filter(item => String(item.id) !== String(record.id))];
    for (const item of candidates) {
      const text = String(
        item?.scriptText ||
        item?.production?.workingScript ||
        noteValue(item?.notes, "Working Script:") ||
        ""
      ).trim();
      if (text) return { text, source: item };
    }
    return null;
  }

  function currentAudio(record, group) {
    const candidates = [record, ...group.filter(item => String(item.id) !== String(record.id))];
    for (const item of candidates) {
      const fileName = String(item?.fileName || "").trim();
      if (fileName) return { fileName, source: item };
    }
    return null;
  }

  function audioSource(fileName) {
    const value = String(fileName || "").trim();
    if (!value) return "";
    if (/^(https?:|data:|blob:)/i.test(value)) return value;
    return encodeURI(value.replace(/^\.\//, ""));
  }

  function handledSiblingDecision(current, group) {
    const siblings = group.filter(item => String(item.id) !== String(current.id));
    const handled = siblings.filter(item => decisionSignature(item));
    if (!handled.length) return null;
    const signatures = [...new Set(handled.map(decisionSignature))];
    if (signatures.length !== 1) return { conflict: true, records: handled };
    return { conflict: false, source: handled[0], signature: signatures[0], records: handled };
  }

  function sameDecisionButtonHtml(current, prior) {
    if (!prior || prior.conflict || decisionSignature(current) || marketOverrides.has(String(current.id))) return "";
    const source = prior.source;
    return `
      <div class="gcm-same-decision-callout">
        <strong>${esc(placementLabel(source))} already has this commercial decision:</strong>
        <span>${esc(decisionLabel(source))}</span>
        <div class="gcm-decision-context-actions">
          <button type="button" class="gcm-context-primary" data-apply-related-decision="${esc(current.id)}" data-source-record="${esc(source.id)}">Apply Same Decision to ${esc(recordShortMarket(current))}</button>
          <button type="button" class="gcm-context-secondary" data-market-override="${esc(current.id)}">Choose Different for ${esc(recordShortMarket(current))}</button>
        </div>
        <div class="gcm-context-message" data-context-message="${esc(current.id)}"></div>
      </div>`;
  }

  function recordShortMarket(record) {
    return String(record?.market || record?.outletName || "This Market").trim();
  }

  function groupRowsHtml(current, group) {
    return group.map(item => {
      const currentBadge = String(item.id) === String(current.id) ? '<span class="gcm-current-market">Current</span>' : "";
      const handledClass = decisionSignature(item) ? " is-handled" : "";
      return `<div class="gcm-market-row${handledClass}"><div><strong>${esc(placementLabel(item))}</strong>${currentBadge}</div><span>${esc(decisionLabel(item))}</span></div>`;
    }).join("");
  }

  function assetReviewHtml(current, group) {
    const copy = currentCopy(current, group);
    const audio = currentAudio(current, group);
    const copySource = copy && String(copy.source.id) !== String(current.id)
      ? `Stored from ${placementLabel(copy.source)}`
      : "Stored on this placement";
    const audioSourceLabel = audio && String(audio.source.id) !== String(current.id)
      ? `Stored from ${placementLabel(audio.source)}`
      : "Stored on this placement";

    return `
      <div class="gcm-current-creative-review">
        <div class="gcm-context-subtitle">Review Current Spot Before Deciding</div>
        <div class="gcm-decision-context-actions">
          ${audio ? `<button type="button" class="gcm-context-secondary" data-toggle-audio="${esc(current.id)}">▶ Play Current Spot</button>` : '<button type="button" class="gcm-context-secondary" disabled>Audio not stored in OS</button>'}
          ${copy ? `<button type="button" class="gcm-context-secondary" data-toggle-copy="${esc(current.id)}">View Current Copy</button>` : '<button type="button" class="gcm-context-secondary" disabled>Copy not stored in OS</button>'}
        </div>
        ${audio ? `<div class="gcm-asset-panel" data-audio-panel="${esc(current.id)}" hidden><div class="gcm-asset-meta">${esc(audioSourceLabel)} · ${esc(audio.fileName)}</div><audio controls preload="none" src="${esc(audioSource(audio.fileName))}" data-context-audio="${esc(current.id)}"></audio><div class="gcm-audio-error" data-audio-error="${esc(current.id)}"></div></div>` : ""}
        ${copy ? `<div class="gcm-asset-panel" data-copy-panel="${esc(current.id)}" hidden><div class="gcm-asset-meta">${esc(copySource)} · exact stored copy</div><div class="gcm-copy-text">${esc(copy.text)}</div></div>` : ""}
      </div>`;
  }

  function contextHtml(current, group) {
    const relatedCount = group.length;
    const prior = handledSiblingDecision(current, group);
    const conflictNote = prior?.conflict
      ? '<div class="gcm-context-note is-warning">Related markets already have different decisions. Review each market before choosing.</div>'
      : "";
    const overrideNote = marketOverrides.has(String(current.id))
      ? `<div class="gcm-context-note">Market-specific override selected for ${esc(recordShortMarket(current))}. Use the decision buttons below.</div>`
      : "";
    const marketIntro = relatedCount > 1
      ? `This named commercial is active in ${relatedCount} markets. The OS shows the other market decision first so you can apply the same treatment or explicitly choose a different one.`
      : "This commercial currently has one active market record.";

    return `
      <div class="gcm-commercial-context" data-gcm-commercial-context="${esc(current.id)}">
        <div class="gcm-context-title">Commercial Decision Context · ${esc(commercialName(current))}</div>
        <div class="gcm-context-intro">${esc(marketIntro)}</div>
        ${relatedCount > 1 ? `<div class="gcm-market-list">${groupRowsHtml(current, group)}</div>` : ""}
        ${conflictNote}
        ${overrideNote}
        ${sameDecisionButtonHtml(current, prior)}
        ${assetReviewHtml(current, group)}
      </div>`;
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

  async function fetchRecords() {
    const payload = await post({ action: "get-media-operations" });
    records = Array.isArray(payload?.mediaOperations?.records) ? payload.mediaOperations.records : [];
  }

  async function applyRelatedDecision(currentId, sourceId, button) {
    const current = records.find(item => String(item.id) === String(currentId));
    const source = records.find(item => String(item.id) === String(sourceId));
    if (!current || !source) return;
    const signature = decisionSignature(source);
    if (!signature) return;

    const message = document.querySelector(`[data-context-message="${CSS.escape(String(currentId))}"]`);
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Saving same decision…";
    if (message) message.textContent = "Saving this commercial decision to the current market…";

    try {
      const body = {
        action: "get-media-operations",
        operation: "set_placement_disposition",
        mediaRecordId: Number(current.id),
        author: "Andy",
        reason: `Applied the same named-commercial decision already recorded for ${placementLabel(source)}.`
      };

      if (signature === "retire_at_end_no_replacement") {
        body.disposition = "retire_at_end_no_replacement";
      } else if (signature.startsWith("replacement_in_progress:")) {
        body.disposition = "replacement_in_progress";
        body.creativeId = Number(disposition(source).replacementCreativeId);
      } else {
        throw new Error("The related market decision is not supported.");
      }

      await post(body);
      if (message) message.textContent = `Saved. ${recordShortMarket(current)} now matches ${recordShortMarket(source)}.`;
      await fetchRecords();
      document.getElementById("refresh")?.click();
      schedulePatch(650);
      schedulePatch(1400);
    } catch (error) {
      console.error(`Media Decision Context ${VERSION}:`, error);
      if (message) message.textContent = `Could not save: ${error.message}`;
      button.disabled = false;
      button.textContent = original;
    }
  }

  function patchPriority() {
    const priority = document.getElementById("priority");
    const grid = priority?.querySelector('.decision-grid[data-record-id]');
    if (!grid || !records.length) return;
    const currentId = String(grid.dataset.recordId || "");
    const current = records.find(item => String(item.id) === currentId);
    if (!current) return;

    const group = commercialGroup(current);
    const signature = [
      currentId,
      ...group.map(item => `${item.id}:${decisionSignature(item)}:${item.fileName || ""}:${item.scriptText ? "copy" : ""}`),
      marketOverrides.has(currentId) ? "override" : "same"
    ].join("|");

    const next = grid.querySelector(".decision.next");
    if (!next) return;
    let context = next.querySelector("[data-gcm-commercial-context]");
    if (context?.dataset.signature === signature) return;
    context?.remove();

    const wrapper = document.createElement("div");
    wrapper.innerHTML = contextHtml(current, group).trim();
    context = wrapper.firstElementChild;
    context.dataset.signature = signature;

    const nextAction = next.querySelector(":scope > strong");
    if (nextAction) nextAction.insertAdjacentElement("afterend", context);
    else next.prepend(context);

    context.querySelectorAll("audio[data-context-audio]").forEach(audio => {
      audio.addEventListener("error", () => {
        const error = context.querySelector(`[data-audio-error="${CSS.escape(String(currentId))}"]`);
        if (error) error.textContent = "The filename is recorded, but the audio file is not currently available to play from the OS.";
      }, { once: true });
    });
  }

  function injectStyles() {
    if (document.getElementById("gcm-media-decision-context-styles")) return;
    const style = document.createElement("style");
    style.id = "gcm-media-decision-context-styles";
    style.textContent = `
      .gcm-commercial-context{margin:14px 0 4px;padding:14px;border:1px solid rgba(143,184,255,.32);border-radius:12px;background:rgba(255,255,255,.055)}
      .gcm-context-title{color:#fff;font-size:.82rem;font-weight:900}.gcm-context-intro{margin-top:5px;color:#c9d7ec;font-size:.74rem;line-height:1.45}
      .gcm-market-list{display:grid;gap:7px;margin-top:11px}.gcm-market-row{display:grid;grid-template-columns:minmax(180px,1fr) minmax(220px,1.2fr);gap:12px;align-items:center;padding:9px 10px;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:rgba(7,20,38,.28)}
      .gcm-market-row strong{display:inline!important;color:#fff!important;font-size:.74rem!important}.gcm-market-row>span{color:#ffd989;font-size:.71rem;font-weight:850}.gcm-market-row.is-handled>span{color:#8ee0b4}
      .gcm-current-market{display:inline-flex!important;margin-left:7px!important;padding:2px 6px;border-radius:999px;background:#347ce8;color:#fff!important;font-size:.56rem!important;font-weight:900!important;letter-spacing:.04em;text-transform:uppercase}
      .gcm-same-decision-callout{margin-top:11px;padding:11px;border-radius:10px;background:#eefaf4;color:#123c2a}.gcm-same-decision-callout strong{display:block!important;color:#123c2a!important;font-size:.76rem!important}.gcm-same-decision-callout>span{display:block;margin-top:3px;color:#1f7a4f;font-size:.75rem;font-weight:900}
      .gcm-context-note{margin-top:10px;padding:9px 10px;border-radius:9px;background:rgba(143,184,255,.12);color:#dce8fa;font-size:.72rem;font-weight:800}.gcm-context-note.is-warning{background:rgba(214,169,74,.16);color:#ffe4a8}
      .gcm-context-subtitle{margin-top:12px;color:#8fb8ff;font-size:.64rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.gcm-decision-context-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
      .gcm-context-primary,.gcm-context-secondary{min-height:36px;padding:0 11px;border-radius:9px;font:inherit;font-size:.69rem;font-weight:900;cursor:pointer}.gcm-context-primary{border:1px solid #5fd397;background:#dff6e9;color:#145b3b}.gcm-context-secondary{border:1px solid rgba(255,255,255,.22);background:#fff;color:#17304f}.gcm-context-secondary:disabled{opacity:.5;cursor:default}
      .gcm-same-decision-callout .gcm-context-secondary{border-color:#b9cbbf}.gcm-context-message{margin-top:7px;color:#1f7a4f;font-size:.7rem;font-weight:850}
      .gcm-asset-panel{margin-top:9px;padding:11px;border:1px solid rgba(255,255,255,.13);border-radius:9px;background:rgba(7,20,38,.42)}.gcm-asset-meta{margin-bottom:7px;color:#9fb1ca;font-size:.66rem;font-weight:800}.gcm-copy-text{white-space:pre-wrap;color:#fff;font-size:.78rem;line-height:1.55}.gcm-asset-panel audio{width:100%;max-width:560px}.gcm-audio-error{margin-top:6px;color:#ffd989;font-size:.68rem;font-weight:800}
      @media(max-width:760px){.gcm-market-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function schedulePatch(delay = 150) {
    clearTimeout(patchTimer);
    patchTimer = setTimeout(patchPriority, delay);
  }

  function bindEvents() {
    document.addEventListener("click", event => {
      const apply = event.target.closest("[data-apply-related-decision]");
      if (apply) {
        event.preventDefault();
        event.stopPropagation();
        applyRelatedDecision(apply.dataset.applyRelatedDecision, apply.dataset.sourceRecord, apply);
        return;
      }

      const override = event.target.closest("[data-market-override]");
      if (override) {
        event.preventDefault();
        event.stopPropagation();
        marketOverrides.add(String(override.dataset.marketOverride));
        schedulePatch(0);
        return;
      }

      const copyToggle = event.target.closest("[data-toggle-copy]");
      if (copyToggle) {
        event.preventDefault();
        event.stopPropagation();
        const panel = document.querySelector(`[data-copy-panel="${CSS.escape(String(copyToggle.dataset.toggleCopy))}"]`);
        if (panel) panel.hidden = !panel.hidden;
        return;
      }

      const audioToggle = event.target.closest("[data-toggle-audio]");
      if (audioToggle) {
        event.preventDefault();
        event.stopPropagation();
        const id = String(audioToggle.dataset.toggleAudio);
        const panel = document.querySelector(`[data-audio-panel="${CSS.escape(id)}"]`);
        if (panel) panel.hidden = !panel.hidden;
        if (panel && !panel.hidden) panel.querySelector("audio")?.play().catch(() => {});
        return;
      }

      if (event.target?.id === "refresh") {
        setTimeout(async () => {
          try { await fetchRecords(); } catch {}
          schedulePatch(250);
        }, 500);
      }
    }, true);
  }

  async function start() {
    injectStyles();
    bindEvents();
    try {
      await fetchRecords();
      schedulePatch(150);
      setTimeout(patchPriority, 700);
      setTimeout(patchPriority, 1500);
    } catch (error) {
      console.error(`Media Decision Context ${VERSION}:`, error);
    }

    const priority = document.getElementById("priority");
    if (priority) {
      const observer = new MutationObserver(() => schedulePatch(80));
      observer.observe(priority, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(start, 0), { once: true });
  } else {
    setTimeout(start, 0);
  }
})();
