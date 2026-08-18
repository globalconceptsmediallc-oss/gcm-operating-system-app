/* =========================================================
   Global Concepts Media Operating System
   File: shared/work-investigation-completion.js
   Version: 1.1.1
   Status: Production Candidate
   Purpose: Add human-approved Investigation resolution controls for
            (1) corrective work already performed and verified during the
            Investigation, and (2) unresolved Investigations that are now
            waiting on an external validation or monitoring result.

   Changes in 1.1.1:
   - Keeps the existing active Complete Investigation step as the primary gate.
   - Adds a safe fallback when the evidence checklist is stale but the operator
     has explicitly recorded that no further root-cause question or evidence
     remains and the Investigation is ready to close.
   - Removes the verified-completion button again if those explicit closing
     statements are edited away before completion.
   - Re-evaluates completion eligibility while the decision fields are edited.
   - Does not change D1 schemas, Worker routes, or processing payload fields.

   Changes in 1.1.0:
   - Preserves the hardened Work Performed & Verified completion path.
   - Adds Monitoring — Await External Validation as a distinct durable state.
   - Uses the currently rendered Investigation/client before URL fallbacks.
   - Preserves the finding plus next question/evidence when entering monitoring.
   - Does not create a Work Item or close a monitoring Investigation.
   ========================================================= */

(() => {
  "use strict";

  const FILE_VERSION = "1.1.1";
  const WORKER_URL = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const COMPLETE_BUTTON_ID = "gcm-complete-verified-investigation";
  const MONITOR_BUTTON_ID = "gcm-monitor-investigation";
  let processing = false;

  function workerErrorMessage(value, fallback = "Worker request failed.") {
    if (value == null || value === "") return fallback;
    if (typeof value === "string") return value.trim() || fallback;
    if (value instanceof Error) return String(value.message || fallback).trim() || fallback;
    if (typeof value === "object") {
      const direct = [value.message, value.error, value.details, value.reason, value.code]
        .find(candidate => typeof candidate === "string" && candidate.trim());
      if (direct) return direct.trim();
      try {
        const json = JSON.stringify(value);
        if (json && json !== "{}") return json;
      } catch {}
    }
    return String(value || fallback).trim() || fallback;
  }

  async function post(body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      const raw = await response.text();
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(`Worker returned non-JSON output (HTTP ${response.status}).`);
      }

      if (!response.ok || payload.ok !== true) {
        throw new Error(workerErrorMessage(
          payload.error ?? payload.details ?? payload.message,
          `Worker request failed (HTTP ${response.status}).`
        ));
      }

      return payload;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("The Worker request timed out after 60 seconds.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function activeStepIsCompletion() {
    return [...document.querySelectorAll(".evidence-step.active")]
      .some(step => /complete investigation/i.test(step.textContent || ""));
  }

  function currentInvestigationId() {
    const subtitle = document.querySelector("#detail-panel .detail-subtitle");
    const match = String(subtitle?.textContent || "").match(/Investigation\s+#(\d+)/i);
    const rendered = Number(match?.[1]);
    if (Number.isInteger(rendered) && rendered > 0) return rendered;

    const direct = Number(new URLSearchParams(location.search).get("investigation"));
    return Number.isInteger(direct) && direct > 0 ? direct : 0;
  }

  function currentClientCode() {
    const link = document.querySelector('#detail-panel .detail-subtitle a[href*="business-workspace.html?business="]');
    if (link) {
      try {
        const rendered = String(new URL(link.href, location.href).searchParams.get("business") || "").trim();
        if (rendered) return rendered;
      } catch {}
    }

    return String(new URLSearchParams(location.search).get("client") || "").trim();
  }

  function setMessage(type, text) {
    const message = document.getElementById("process-message");
    if (!message) return;
    message.className = `status ${type}`;
    message.textContent = text;
  }

  function currentDecisionFields() {
    return {
      findingSummary: String(document.getElementById("finding-summary")?.value || "").trim(),
      nextQuestion: String(document.getElementById("work-title")?.value || "").trim(),
      nextEvidence: String(document.getElementById("work-description")?.value || "").trim()
    };
  }

  function decisionExplicitlySupportsCompletion() {
    const fields = currentDecisionFields();
    if (!fields.findingSummary || !fields.nextQuestion || !fields.nextEvidence) return false;

    const question = fields.nextQuestion.toLowerCase();
    const evidence = fields.nextEvidence.toLowerCase();

    const questionClosed =
      /no further(?: root[- ]cause)? question/.test(question) ||
      /no .*question .*remain/.test(question) ||
      /root cause .* (?:confirmed|proven|verified)/.test(question);

    const evidenceClosed =
      /none required to close/.test(evidence) ||
      /no further evidence/.test(evidence) ||
      /verification evidence .* (?:final|verified|sufficient)/.test(evidence) ||
      /evidence .* sufficient .* close/.test(evidence);

    return questionClosed && evidenceClosed;
  }

  function completionIsEligible() {
    return activeStepIsCompletion() || decisionExplicitlySupportsCompletion();
  }

  async function completeVerifiedInvestigation(button) {
    if (processing) return;

    const investigationId = currentInvestigationId();
    const clientCode = currentClientCode();
    const { findingSummary } = currentDecisionFields();

    if (!investigationId || !clientCode) {
      setMessage("error", "The selected Investigation could not be identified. Refresh the page and select the Investigation again.");
      return;
    }

    if (!findingSummary) {
      setMessage("error", "Record the evidence-supported Investigation Finding before completion.");
      return;
    }

    if (!completionIsEligible()) {
      setMessage("error", "Completion is not available until the Investigation is at the completion step or the decision fields explicitly state that no further root-cause question or evidence remains.");
      return;
    }

    if (!window.confirm(
      `Complete Investigation #${investigationId} as Work Performed & Verified?\n\nThis closes the Investigation without creating a duplicate Work Item.`
    )) return;

    processing = true;
    button.disabled = true;
    setMessage("loading", `Completing Investigation #${investigationId} in production D1…`);

    try {
      await post({
        action: "process-investigation",
        clientCode,
        investigationId,
        findingSummary,
        outcome: "no_work_required"
      });

      setMessage("ready", `Investigation #${investigationId} completed. Work performed and verified; no duplicate Work Item was created.`);
      button.textContent = "Completed — Work Verified";
      setTimeout(() => location.reload(), 700);
    } catch (error) {
      button.disabled = false;
      setMessage("error", error.message || "The Investigation could not be completed.");
    } finally {
      processing = false;
    }
  }

  async function moveInvestigationToMonitoring(button) {
    if (processing) return;

    const investigationId = currentInvestigationId();
    const clientCode = currentClientCode();
    const fields = currentDecisionFields();

    if (!investigationId || !clientCode) {
      setMessage("error", "The selected Investigation could not be identified. Refresh the page and select the Investigation again.");
      return;
    }

    if (!fields.findingSummary) {
      setMessage("error", "Record what is currently known before moving the Investigation to monitoring.");
      return;
    }

    const nextQuestion = fields.nextQuestion || "Did the external validation or monitoring result pass or fail?";
    const nextEvidence = fields.nextEvidence || "Wait for the external validation or monitoring result before taking additional corrective action.";

    if (!window.confirm(
      `Move Investigation #${investigationId} to Monitoring — Await External Validation?\n\nIt remains preserved in D1 but is removed from active Work and Today until a new result requires action.`
    )) return;

    processing = true;
    button.disabled = true;
    setMessage("loading", `Moving Investigation #${investigationId} to monitoring in production D1…`);

    try {
      await post({
        action: "process-investigation",
        clientCode,
        investigationId,
        findingSummary: fields.findingSummary,
        outcome: "monitoring_external_validation",
        nextQuestion,
        nextEvidence
      });

      setMessage("ready", `Investigation #${investigationId} is now Monitoring — Awaiting External Validation. It is preserved but no longer active work.`);
      button.textContent = "Monitoring — Awaiting Result";
      setTimeout(() => location.reload(), 700);
    } catch (error) {
      button.disabled = false;
      setMessage("error", error.message || "The Investigation could not be moved to monitoring.");
    } finally {
      processing = false;
    }
  }

  function installButtons() {
    if (!/\/work\.html$/i.test(location.pathname)) return;

    const actions = document.querySelector("#detail-panel .processing-actions");
    const continueButton = document.getElementById("continue-button");
    if (!actions || !continueButton) return;

    let monitorButton = document.getElementById(MONITOR_BUTTON_ID);
    if (!monitorButton) {
      monitorButton = document.createElement("button");
      monitorButton.id = MONITOR_BUTTON_ID;
      monitorButton.type = "button";
      monitorButton.className = "button";
      monitorButton.textContent = "Monitoring — Await External Validation";
      monitorButton.title = `Preserve this Investigation in D1 while removing it from active attention. Resolution control v${FILE_VERSION}.`;
      monitorButton.addEventListener("click", () => moveInvestigationToMonitoring(monitorButton));
      continueButton.insertAdjacentElement("afterend", monitorButton);
    }

    let completeButton = document.getElementById(COMPLETE_BUTTON_ID);
    if (!completionIsEligible()) {
      if (completeButton) completeButton.remove();
      return;
    }

    if (completeButton) return;

    completeButton = document.createElement("button");
    completeButton.id = COMPLETE_BUTTON_ID;
    completeButton.type = "button";
    completeButton.className = "button primary";
    completeButton.textContent = "Complete — Work Performed & Verified";
    completeButton.title = `Close this Investigation after verified corrective work. Resolution control v${FILE_VERSION}.`;
    completeButton.addEventListener("click", () => completeVerifiedInvestigation(completeButton));

    monitorButton.insertAdjacentElement("afterend", completeButton);
  }

  const observer = new MutationObserver(installButtons);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("input", event => {
    if (["finding-summary", "work-title", "work-description"].includes(event.target?.id)) {
      installButtons();
    }
  });

  document.addEventListener("change", event => {
    if (["finding-summary", "work-title", "work-description"].includes(event.target?.id)) {
      installButtons();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installButtons, { once: true });
  } else {
    installButtons();
  }
})();
