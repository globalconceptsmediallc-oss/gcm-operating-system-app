/* =========================================================
   Global Concepts Media Operating System
   File: shared/work-investigation-completion.js
   Version: 1.3.0
   Status: Production Candidate
   Purpose: Add human-approved Investigation resolution controls for
            (1) corrective work already performed and verified during the
            Investigation, (2) unresolved Investigations waiting on external
            validation, (3) linked Work Items whose responsibility has been
            reassigned outside GCM without claiming completion proof, and
            (4) Work Items whose awaited external validation has now returned.

   Changes in 1.3.0:
   - Adds External Validation Passed — Complete to Awaiting External Validation cards.
   - Requires the operator to record the returned external result and final proof.
   - Reuses the card's preserved Verified So Far record as Work Performed so
     completed implementation is not re-entered or falsely duplicated.
   - Uses the existing process-work-item completion route so linked Investigations
     close through the existing completion/Proof contract.
   - Resolves client code from the deep link, selected client filter, or rendered
     client directory option when the validation queue is showing all clients.
   - Does not add a Worker route, D1 schema, or automatic completion decision.

   Changes in 1.2.0:
   - Adds Close — Reassigned / No Longer GCM Responsibility to linked Work Items.
   - Shows reassignment only when the saved Investigation decision explicitly
     states that responsibility transferred/reassigned outside GCM.
   - Uses the existing process-work-item route with disposition=reassigned.
   - Closes the Work Item and linked Investigation without work completion proof.
   - Preserves the saved Investigation finding as the responsibility note.
   - Does not add a new Worker route or D1 schema.

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

  const FILE_VERSION = "1.3.0";
  const WORKER_URL = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const COMPLETE_BUTTON_ID = "gcm-complete-verified-investigation";
  const MONITOR_BUTTON_ID = "gcm-monitor-investigation";
  const REASSIGN_BUTTON_ATTR = "data-close-reassigned-work";
  const EXTERNAL_COMPLETE_BUTTON_ATTR = "data-complete-external-validation";
  const EXTERNAL_CONTROLS_ATTR = "data-external-validation-controls";
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

  function setWorkItemMessage(workItemId, type, text) {
    const message = document.getElementById(`work-message-${workItemId}`);
    if (!message) return;
    message.className = `status ${type}`;
    message.textContent = text;
  }

  function setExternalValidationMessage(workItemId, type, text) {
    const message = document.getElementById(`external-validation-message-${workItemId}`);
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

  function decisionExplicitlySupportsReassignment() {
    const fields = currentDecisionFields();
    if (!fields.findingSummary) return false;

    const text = [fields.findingSummary, fields.nextQuestion, fields.nextEvidence]
      .join(" ")
      .toLowerCase()
      .replace(/\s+/g, " ");

    return (
      /responsibility.{0,120}(?:transferred|reassigned)/.test(text) ||
      /(?:transferred|reassigned).{0,120}responsibility/.test(text) ||
      /no longer active implementation work for.{0,40}gcm/.test(text) ||
      /no longer.{0,80}gcm responsibility/.test(text) ||
      /removed from.{0,80}active work queue without falsely recording.{0,40}completed/.test(text)
    );
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

  async function closeReassignedWorkItem(button, workItemId) {
    if (processing) return;

    const investigationId = currentInvestigationId();
    const clientCode = currentClientCode();
    const fields = currentDecisionFields();

    if (!investigationId || !clientCode || !Number.isInteger(workItemId) || workItemId <= 0) {
      setWorkItemMessage(workItemId, "error", "The selected Work Item or Investigation could not be identified. Refresh the page and select the Investigation again.");
      return;
    }

    if (!decisionExplicitlySupportsReassignment()) {
      setWorkItemMessage(workItemId, "error", "Reassignment closure requires a saved Investigation decision explicitly stating that responsibility transferred or is no longer GCM work.");
      return;
    }

    if (!window.confirm(
      `Close Work Item #${workItemId} as Reassigned / No Longer GCM Responsibility?\n\nThis closes the Work Item and linked Investigation as transition history. It does NOT record work completion or create completion proof.`
    )) return;

    processing = true;
    button.disabled = true;
    setWorkItemMessage(workItemId, "loading", `Closing Work Item #${workItemId} as reassigned in production D1…`);

    try {
      const payload = await post({
        action: "process-work-item",
        clientCode,
        workItemId,
        disposition: "reassigned",
        dispositionNote: fields.findingSummary
      });

      if (payload.proofOfWorkEligible !== false) {
        throw new Error("The Worker did not confirm the non-proof reassignment disposition.");
      }

      setWorkItemMessage(workItemId, "ready", `Work Item #${workItemId} and Investigation #${investigationId} were closed as reassigned. No work-completion proof was created.`);
      button.textContent = "Closed — Reassigned";
      setTimeout(() => location.reload(), 700);
    } catch (error) {
      button.disabled = false;
      setWorkItemMessage(workItemId, "error", error.message || "The Work Item could not be closed as reassigned.");
    } finally {
      processing = false;
    }
  }

  function normalizedText(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function validationClientCode(card) {
    const params = new URLSearchParams(location.search);
    const deepLinkedClient = String(params.get("client") || "").trim();
    const filter = document.getElementById("client-filter");
    const selectedClient = String(filter?.value || "").trim();
    const subtitle = String(card?.querySelector(".detail-subtitle")?.textContent || "").trim();
    const clientName = subtitle.split("·")[0]?.trim() || "";
    const options = [...(filter?.options || [])];

    const nameMatches = code => {
      if (!code) return false;
      const option = options.find(entry => String(entry.value || "").trim().toUpperCase() === code.toUpperCase());
      return !clientName || normalizedText(option?.textContent) === normalizedText(clientName);
    };

    if (deepLinkedClient && nameMatches(deepLinkedClient)) return deepLinkedClient;
    if (selectedClient && nameMatches(selectedClient)) return selectedClient;

    const matchedOption = options.find(option =>
      option.value && normalizedText(option.textContent) === normalizedText(clientName)
    );

    return String(matchedOption?.value || deepLinkedClient || selectedClient || "").trim();
  }

  function validationWorkPerformed(card) {
    const verifiedSection = [...(card?.querySelectorAll(".detail-section") || [])]
      .find(section => /verified so far/i.test(section.querySelector("h3")?.textContent || ""));
    const verified = String(verifiedSection?.querySelector("p")?.textContent || "").trim();

    if (verified) {
      return `Implementation was previously completed and internally verified before external validation. Preserved verification: ${verified}`;
    }

    return "Implementation was previously completed and internally verified before external validation. Final external proof has now returned; no duplicate production work was performed to close this item.";
  }

  async function completeExternalValidation(button, card, workItemId) {
    if (processing) return;

    const clientCode = validationClientCode(card);
    const actualImpact = String(document.getElementById(`external-result-${workItemId}`)?.value || "").trim();
    const evidenceDescription = String(document.getElementById(`external-evidence-${workItemId}`)?.value || "").trim();
    const workPerformed = validationWorkPerformed(card);
    const subtitle = String(card?.querySelector(".detail-subtitle")?.textContent || "");
    const investigationId = Number(subtitle.match(/Investigation\s+#(\d+)/i)?.[1] || 0);

    if (!clientCode) {
      setExternalValidationMessage(workItemId, "error", "The client code could not be resolved for this validation item. Select the client in the Work filter and try again.");
      return;
    }

    if (!actualImpact || !evidenceDescription) {
      setExternalValidationMessage(workItemId, "error", "Final External Result and Final Proof / Evidence are both required before completion.");
      return;
    }

    const closeText = investigationId
      ? `This closes Work Item #${workItemId} and linked Investigation #${investigationId} and records the returned proof.`
      : `This closes Work Item #${workItemId} and records the returned proof.`;

    if (!window.confirm(
      `Complete Work Item #${workItemId} from returned external validation?\n\n${closeText}`
    )) return;

    processing = true;
    button.disabled = true;
    setExternalValidationMessage(workItemId, "loading", `Recording external validation and completing Work Item #${workItemId} in production D1…`);

    try {
      await post({
        action: "process-work-item",
        clientCode,
        workItemId,
        workPerformed,
        actualImpact,
        evidenceDescription,
        evidenceSource: "External Validation Completion Evidence",
        evidenceType: "completion"
      });

      setExternalValidationMessage(
        workItemId,
        "ready",
        investigationId
          ? `Work Item #${workItemId} completed from external validation proof and Investigation #${investigationId} closed.`
          : `Work Item #${workItemId} completed from external validation proof.`
      );
      button.textContent = "Completed — External Validation Passed";
      setTimeout(() => location.reload(), 700);
    } catch (error) {
      button.disabled = false;
      setExternalValidationMessage(workItemId, "error", error.message || "The external validation completion could not be recorded.");
    } finally {
      processing = false;
    }
  }

  function installExternalValidationControls() {
    document.querySelectorAll("#external-validation-list .work-card[data-validation-work-id]").forEach(card => {
      const workItemId = Number(card.getAttribute("data-validation-work-id"));
      if (!Number.isInteger(workItemId) || workItemId <= 0) return;
      if (card.querySelector(`[${EXTERNAL_CONTROLS_ATTR}="${workItemId}"]`)) return;

      const legacyStatus = [...card.querySelectorAll(".status.ready")]
        .find(node => /no completion action is available/i.test(node.textContent || ""));
      if (legacyStatus) {
        legacyStatus.textContent = "Final proof returned? Record the external result and proof below, then complete this Work Item.";
      }

      const section = document.createElement("section");
      section.className = "detail-section";
      section.setAttribute(EXTERNAL_CONTROLS_ATTR, String(workItemId));
      section.innerHTML = `
        <h3>Complete External Validation</h3>
        <label for="external-result-${workItemId}">Final External Result</label>
        <textarea id="external-result-${workItemId}" placeholder="Record what the external system now confirms."></textarea>
        <label for="external-evidence-${workItemId}">Final Proof / Evidence</label>
        <textarea id="external-evidence-${workItemId}" placeholder="Record the exact returned proof, date, source, and verification details."></textarea>
        <div class="processing-actions">
          <button class="button primary" type="button" ${EXTERNAL_COMPLETE_BUTTON_ATTR}="${workItemId}">
            External Validation Passed — Complete
          </button>
        </div>
        <div id="external-validation-message-${workItemId}"></div>
      `;

      card.appendChild(section);

      const button = section.querySelector(`[${EXTERNAL_COMPLETE_BUTTON_ATTR}="${workItemId}"]`);
      button?.addEventListener("click", () => completeExternalValidation(button, card, workItemId));
    });
  }

  function installWorkDispositionButtons() {
    const investigationId = currentInvestigationId();
    const eligible = decisionExplicitlySupportsReassignment();

    document.querySelectorAll(`[${REASSIGN_BUTTON_ATTR}]`).forEach(button => {
      const card = button.closest(".work-card");
      if (!eligible || !card || !new RegExp(`Investigation\\s+#${investigationId}\\b`, "i").test(card.textContent || "")) {
        button.remove();
      }
    });

    if (!eligible || !investigationId) return;

    document.querySelectorAll(".work-card").forEach(card => {
      if (!new RegExp(`Investigation\\s+#${investigationId}\\b`, "i").test(card.textContent || "")) return;

      const completeButton = card.querySelector("[data-complete-work]");
      if (!completeButton) return;

      const workItemId = Number(completeButton.getAttribute("data-complete-work"));
      if (!Number.isInteger(workItemId) || workItemId <= 0) return;
      if (card.querySelector(`[${REASSIGN_BUTTON_ATTR}="${workItemId}"]`)) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "button";
      button.setAttribute(REASSIGN_BUTTON_ATTR, String(workItemId));
      button.textContent = "Close — Reassigned / No Longer GCM Responsibility";
      button.title = `Close this Work Item as transferred responsibility without completion proof. Resolution control v${FILE_VERSION}.`;
      button.addEventListener("click", () => closeReassignedWorkItem(button, workItemId));
      completeButton.insertAdjacentElement("afterend", button);
    });
  }

  function installButtons() {
    if (!/\/work\.html$/i.test(location.pathname)) return;

    installExternalValidationControls();
    installWorkDispositionButtons();

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
