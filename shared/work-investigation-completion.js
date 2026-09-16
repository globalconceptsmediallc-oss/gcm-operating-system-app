/* =========================================================
   Global Concepts Media Operating System
   File: shared/work-investigation-completion.js
   Version: 1.4.0
   Status: Production Candidate
   Purpose: Add human-approved Investigation controls for
            (1) direct evidence-based Investigation intake from Work,
            (2) corrective work already performed and verified during the
            Investigation, (3) unresolved Investigations waiting on external
            validation, (4) linked Work Items whose responsibility has been
            reassigned outside GCM without claiming completion proof, and
            (5) Work Items whose awaited external validation has now returned.

   Changes in 1.4.0:
   - Adds Start Investigation directly to the Work page before Requested Work.
   - Uses the proven commit-operational-decision route to create one internal
     audit Communication plus one open Investigation; no Work Item is created.
   - Requires client, Investigation title, question/issue, current evidence,
     business meaning, and next evidence/step before creation.
   - Loads the production client directory and honors client deep links.
   - Deep-links immediately into the newly created Guided Investigation.
   - Updates the visible Work page classification/status to v1.9.19.
   - Does not add a Worker route, D1 schema, automatic finding, or Work Item.

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

  const FILE_VERSION = "1.4.0";
  const WORK_PAGE_VERSION = "1.9.19";
  const WORKER_URL = "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const COMPLETE_BUTTON_ID = "gcm-complete-verified-investigation";
  const MONITOR_BUTTON_ID = "gcm-monitor-investigation";
  const REASSIGN_BUTTON_ATTR = "data-close-reassigned-work";
  const EXTERNAL_COMPLETE_BUTTON_ATTR = "data-complete-external-validation";
  const EXTERNAL_CONTROLS_ATTR = "data-external-validation-controls";
  const INVESTIGATION_INTAKE_PANEL_ID = "gcm-investigation-intake-panel";
  const INVESTIGATION_INTAKE_STYLE_ID = "gcm-investigation-intake-styles";
  let processing = false;
  let intakeProcessing = false;

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

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function updateVisibleWorkVersion() {
    const classification = document.querySelector(".classification");
    if (classification) {
      classification.textContent = `Requested Work + Direct Investigation + WWPOWD · v${WORK_PAGE_VERSION}`;
    }

    const shellStatus = document.querySelector(".gcm-shell-status span:last-child");
    if (shellStatus && /work v\d|wwpowd investigation/i.test(shellStatus.textContent || "")) {
      shellStatus.textContent = `Requested work + direct Investigation + WWPOWD · Work v${WORK_PAGE_VERSION}`;
    }

    const subtitle = document.querySelector(".page-header .subtitle");
    if (subtitle) {
      subtitle.textContent = "Start an Investigation when evidence is still needed to decide the correct action. Create Requested Work only when the exact deliverable is already clear.";
    }
  }

  function injectInvestigationIntakeStyles() {
    if (document.getElementById(INVESTIGATION_INTAKE_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = INVESTIGATION_INTAKE_STYLE_ID;
    style.textContent = `
      #${INVESTIGATION_INTAKE_PANEL_ID}{border-top:4px solid var(--blue)}
      #${INVESTIGATION_INTAKE_PANEL_ID} .intake-help{margin:0 0 13px;color:var(--muted);font-size:.78rem;line-height:1.5}
      #${INVESTIGATION_INTAKE_PANEL_ID} .intake-contract{margin:0 0 14px;padding:11px 12px;border:1px solid #cbdcf4;border-radius:9px;background:var(--blue-soft);color:#205c9f;font-size:.76rem;font-weight:760;line-height:1.45}
      #${INVESTIGATION_INTAKE_PANEL_ID} .intake-version{display:inline-flex;margin-left:8px;padding:3px 7px;border-radius:999px;background:#eef2f7;color:var(--muted);font-size:.62rem;font-weight:900;vertical-align:middle}
    `;
    document.head.appendChild(style);
  }

  async function loadInvestigationIntakeClients(select, message) {
    try {
      const payload = await post({ action: "get-client-directory" });
      const clients = Array.isArray(payload?.clients) ? payload.clients : [];

      select.innerHTML = '<option value="">Select client</option>' + clients.map(client => {
        const code = String(client.client_code || client.clientCode || client.code || "").trim();
        const name = String(client.name || client.client_name || client.clientName || code).trim();
        const status = String(client.status || "").trim();
        const suffix = status ? ` · ${status}` : "";
        return `<option value="${escapeHtml(code)}">${escapeHtml(name)}${escapeHtml(suffix)}</option>`;
      }).join("");

      const params = new URLSearchParams(location.search);
      const requestedClient = String(params.get("client") || "").trim().toUpperCase();
      const selectedFilter = String(document.getElementById("client-filter")?.value || "").trim().toUpperCase();
      const requestedWorkClient = String(document.getElementById("requested-client")?.value || "").trim().toUpperCase();
      const preferred = requestedClient || selectedFilter || requestedWorkClient;

      if (preferred) {
        const option = [...select.options].find(entry => String(entry.value || "").trim().toUpperCase() === preferred);
        if (option) select.value = option.value;
      }
    } catch (error) {
      message.className = "status error";
      message.textContent = error.message || "The client directory could not be loaded.";
    }
  }

  function importanceFromPriority(priority) {
    const normalized = String(priority || "Normal").trim().toLowerCase();
    if (normalized === "urgent") return "Critical";
    if (normalized === "high") return "High";
    if (normalized === "low") return "Low";
    return "Medium";
  }

  async function createInvestigationFromWorkQueue(form, button, message) {
    if (intakeProcessing) return;

    const clientCode = String(document.getElementById("investigation-intake-client")?.value || "").trim();
    const title = String(document.getElementById("investigation-intake-title")?.value || "").trim();
    const question = String(document.getElementById("investigation-intake-question")?.value || "").trim();
    const evidence = String(document.getElementById("investigation-intake-evidence")?.value || "").trim();
    const impact = String(document.getElementById("investigation-intake-impact")?.value || "").trim();
    const nextEvidence = String(document.getElementById("investigation-intake-next")?.value || "").trim();
    const sourceReference = String(document.getElementById("investigation-intake-source")?.value || "").trim();
    const priority = String(document.getElementById("investigation-intake-priority")?.value || "Normal").trim();
    const owner = String(document.getElementById("investigation-intake-owner")?.value || "Andy").trim() || "Andy";

    if (!clientCode || !title || !question || !evidence || !impact || !nextEvidence) {
      message.className = "status error";
      message.textContent = "Client, Investigation, Question / Issue, Current Evidence, Why It Matters, and Next Evidence / Step are required.";
      return;
    }

    const importance = importanceFromPriority(priority);
    const operationalSummary = [
      `Question / Issue:\n${question}`,
      `What We Know / Current Evidence:\n${evidence}`
    ].join("\n\n");
    const rawContent = [
      "Internal Investigation Intake — Work Queue",
      `Investigation: ${title}`,
      `Question / Issue: ${question}`,
      `Current Evidence / Finding: ${evidence}`,
      `Business Meaning / Why It Matters: ${impact}`,
      `Next Evidence / Step: ${nextEvidence}`,
      sourceReference ? `Source / Reference: ${sourceReference}` : "Source / Reference: Direct operator intake"
    ].join("\n\n");

    intakeProcessing = true;
    button.disabled = true;
    message.className = "status loading";
    message.textContent = "Creating the internal audit record and opening the Investigation in production D1…";

    try {
      const payload = await post({
        action: "commit-operational-decision",
        clientCode,
        occurredAt: new Date().toISOString(),
        direction: "internal",
        owner,
        rawContent,
        decision: {
          source: "GCM Work Queue",
          communicationType: "Internal Investigation Intake",
          title,
          operationalSummary,
          businessImpact: impact,
          importance,
          operationalPriority: importance,
          operationalLabel: "Investigation Required",
          recordPurpose: "Evidence-based internal Investigation intake before corrective work is selected.",
          recommendedAction: nextEvidence,
          reasoning: sourceReference
            ? `Current evidence was entered by the operator. Source/reference: ${sourceReference}`
            : "Current evidence was entered directly by the operator from the Work Queue.",
          recommendedRoutes: {
            saveCommunication: true,
            createInvestigation: true,
            createWorkItem: false,
            replyRequired: false
          }
        }
      });

      const investigationId = Number(payload?.investigationId || 0);
      if (!Number.isInteger(investigationId) || investigationId <= 0) {
        throw new Error("The Worker saved the intake but did not return the new Investigation ID.");
      }

      message.className = "status ready";
      message.textContent = `Investigation #${investigationId} created. Opening Guided Investigation…`;
      button.textContent = "Investigation Created ✓";

      const nextUrl = new URL(location.href);
      nextUrl.search = "";
      nextUrl.searchParams.set("investigation", String(investigationId));
      nextUrl.searchParams.set("client", clientCode);
      setTimeout(() => { location.href = nextUrl.toString(); }, 450);
    } catch (error) {
      button.disabled = false;
      message.className = "status error";
      message.textContent = error.message || "The Investigation could not be created.";
    } finally {
      intakeProcessing = false;
    }
  }

  function installInvestigationIntake() {
    if (!/\/work\.html$/i.test(location.pathname)) return;
    updateVisibleWorkVersion();
    if (document.getElementById(INVESTIGATION_INTAKE_PANEL_ID)) return;

    const requestedWorkPanel = document.getElementById("requested-work-panel");
    if (!requestedWorkPanel) return;

    injectInvestigationIntakeStyles();

    const panel = document.createElement("section");
    panel.id = INVESTIGATION_INTAKE_PANEL_ID;
    panel.className = "panel";
    panel.innerHTML = `
      <div class="panel-header">
        <h2>Start Investigation <span class="intake-version">v${FILE_VERSION}</span></h2>
        <p>Use this when the problem or opportunity is known, but evidence is still needed before choosing corrective work.</p>
      </div>
      <div class="panel-body">
        <p class="intake-help">This is the missing entrance to the WWPOWD workflow. The Investigation will appear in the Investigation Queue below and can be worked through evidence before any Work Item is created.</p>
        <p class="intake-contract">Creates one internal audit Communication + one open Investigation. Creates no Work Item and makes no completion claim.</p>
        <form id="investigation-intake-form">
          <div class="requested-work-grid">
            <div>
              <label for="investigation-intake-client">Client</label>
              <select id="investigation-intake-client" required><option value="">Loading clients…</option></select>
            </div>
            <div>
              <label for="investigation-intake-priority">Priority</label>
              <select id="investigation-intake-priority">
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div class="full">
              <label for="investigation-intake-title">Investigation</label>
              <input id="investigation-intake-title" type="text" required placeholder="Example: A1 Locksmith Competitive Visibility Gap" />
            </div>
            <div class="full">
              <label for="investigation-intake-question">Question / Issue</label>
              <textarea id="investigation-intake-question" required placeholder="What must we determine before deciding what work should be done?"></textarea>
            </div>
            <div class="full">
              <label for="investigation-intake-evidence">What We Know / Current Evidence</label>
              <textarea id="investigation-intake-evidence" required placeholder="Record the evidence already observed. Do not turn an assumption into a finding."></textarea>
            </div>
            <div class="full">
              <label for="investigation-intake-impact">Business Meaning / Why It Matters</label>
              <textarea id="investigation-intake-impact" required placeholder="Explain the client or business consequence that makes this worth investigating."></textarea>
            </div>
            <div class="full">
              <label for="investigation-intake-next">Next Evidence / Step</label>
              <textarea id="investigation-intake-next" required placeholder="What evidence should be reviewed next to prove the cause and select the correct action?"></textarea>
            </div>
            <div>
              <label for="investigation-intake-owner">Owner</label>
              <input id="investigation-intake-owner" type="text" value="Andy" />
            </div>
            <div>
              <label for="investigation-intake-source">Source / Reference (optional)</label>
              <input id="investigation-intake-source" type="text" placeholder="Example: SEMrush Position Tracking · Sep. 16, 2026" />
            </div>
          </div>
          <div class="requested-work-actions">
            <button id="investigation-intake-submit" class="button primary" type="submit">Start Investigation</button>
            <div id="investigation-intake-message"></div>
          </div>
        </form>
      </div>
    `;

    requestedWorkPanel.insertAdjacentElement("beforebegin", panel);

    const form = document.getElementById("investigation-intake-form");
    const button = document.getElementById("investigation-intake-submit");
    const message = document.getElementById("investigation-intake-message");
    const select = document.getElementById("investigation-intake-client");

    form?.addEventListener("submit", event => {
      event.preventDefault();
      createInvestigationFromWorkQueue(form, button, message);
    });

    if (select && message) loadInvestigationIntakeClients(select, message);
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

    installInvestigationIntake();
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