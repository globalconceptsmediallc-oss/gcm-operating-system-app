/* =========================================================
   Global Concepts Media Operating System
   File: shared/media-production-sessions.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Source: Media Production v3.1.1 + Media Creative Workflow v1.1.0
   Sprint: Media → Calendar Natural Workflow
   Purpose:
   Add durable Production Sessions to Media without rewriting the verified
   Media Production page. Scheduling one session automatically creates the
   connected Calendar appointment through the Media backend.

   Operator Flow:
   Media → Schedule Session → choose client → choose one or more creatives
   → date/time/location/contact → Save.
   The durable record then drives Media and Calendar urgency.
   ========================================================= */

(() => {
  "use strict";

  const FILE_VERSION = "1.0.0";
  const WORKER_URL =
    "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const ACTION = "get-media-operations";

  const state = {
    workflow: null,
    editingSessionId: null
  };

  const $ = id => document.getElementById(id);

  function clean(value) {
    return String(value ?? "").trim();
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function request(operation, extra = {}) {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: ACTION,
        operation,
        ...extra
      })
    });

    const payload =
      await response
        .json()
        .catch(() => ({}));

    if (
      !response.ok ||
      payload?.ok !== true
    ) {
      throw new Error(
        payload?.error ||
        payload?.details ||
        `Media session request failed with HTTP ${response.status}.`
      );
    }

    return payload;
  }

  function injectStyles() {
    if (
      document.getElementById(
        "gcm-media-production-session-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "gcm-media-production-session-styles";

    style.textContent = `
      .gcm-session-list{display:grid;gap:9px;margin-top:12px}
      .gcm-session-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:start;padding:13px;border:1px solid var(--bd,#dbe2ec);border-radius:11px;background:#fafbfd}
      .gcm-session-title{margin:0;color:var(--n,#071426);font-weight:900}
      .gcm-session-meta{margin:5px 0 0;color:var(--m,#637083);font-size:12px;line-height:1.45}
      .gcm-session-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
      .gcm-session-tag{display:inline-flex;padding:4px 8px;border-radius:999px;background:#edf4ff;color:#1659b9;font-size:10px;font-weight:900}
      .gcm-session-tag.done{background:#e9f7f0;color:#1f7a4f}
      .gcm-session-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
      .gcm-session-editor{margin-top:14px;padding:14px;border:1px solid #b8cdf4;border-radius:11px;background:#f7faff}
      .gcm-session-editor[hidden]{display:none!important}
      .gcm-session-creative-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:6px}
      .gcm-session-check{display:flex;gap:8px;align-items:flex-start;padding:9px;border:1px solid var(--bd,#dbe2ec);border-radius:8px;background:#fff;font-weight:700}
      .gcm-session-check input{width:17px;height:17px;margin:1px 0 0;flex:0 0 auto}
      .gcm-session-empty{padding:14px;border:1px dashed var(--bd,#dbe2ec);border-radius:9px;color:var(--m,#637083);text-align:center}
      @media(max-width:760px){.gcm-session-card{grid-template-columns:1fr}.gcm-session-actions{justify-content:flex-start}.gcm-session-creative-list{grid-template-columns:1fr}}
    `;

    document.head.appendChild(style);
  }

  function buildPanel() {
    if (
      document.getElementById(
        "gcmProductionSessions"
      )
    ) {
      return;
    }

    const page =
      document.querySelector(".page");

    const header =
      page?.querySelector("header");

    if (!page || !header) {
      console.error(
        `Media Production Sessions ${FILE_VERSION}: Media page mount point not found.`
      );
      return;
    }

    const panel =
      document.createElement("section");

    panel.className = "panel";
    panel.id = "gcmProductionSessions";

    panel.innerHTML = `
      <div class="ph">
        <h2>Production Sessions</h2>
        <div class="sub">
          Schedule recording, script-review, or production work once.
          GCM OS creates the connected Calendar commitment automatically.
        </div>
      </div>

      <div class="body">
        <div class="actions">
          <button
            class="btn primary"
            id="gcmAddProductionSession"
            type="button"
          >Schedule Session</button>

          <div
            class="status"
            id="gcmProductionSessionStatus"
            style="margin:0;flex:1"
          >Loading durable Media sessions…</div>
        </div>

        <div
          class="gcm-session-list"
          id="gcmProductionSessionList"
        ></div>

        <form
          class="gcm-session-editor"
          id="gcmProductionSessionForm"
          hidden
        >
          <div class="grid">
            <label>
              Client
              <select
                id="gcmSessionClient"
                required
              ></select>
            </label>

            <label>
              Session Type
              <select
                id="gcmSessionType"
                required
              >
                <option value="recording">Recording</option>
                <option value="script_review">Script Review</option>
                <option value="production">Production</option>
                <option value="other">Other Media Work</option>
              </select>
            </label>

            <label>
              Date
              <input
                id="gcmSessionDate"
                type="date"
                required
              >
            </label>

            <label>
              Time
              <input
                id="gcmSessionTime"
                type="time"
                required
              >
            </label>

            <label class="two">
              Title
              <input
                id="gcmSessionTitle"
                placeholder="Monica Recording Session"
                required
              >
            </label>

            <label>
              Contact / Participant
              <input
                id="gcmSessionContact"
                placeholder="Monica"
              >
            </label>

            <label>
              Location
              <input
                id="gcmSessionLocation"
                placeholder="A1A office"
              >
            </label>

            <label class="all">
              Notes
              <textarea
                id="gcmSessionNotes"
                placeholder="What needs to be accomplished in this session?"
              ></textarea>
            </label>

            <div class="all">
              <label>Creatives Included</label>
              <div
                class="gcm-session-creative-list"
                id="gcmSessionCreatives"
              ></div>
            </div>
          </div>

          <div
            class="actions"
            style="margin-top:14px"
          >
            <button
              class="btn primary"
              id="gcmSaveProductionSession"
              type="submit"
            >Save Session</button>

            <button
              class="btn"
              id="gcmCancelProductionSession"
              type="button"
            >Cancel</button>
          </div>
        </form>
      </div>
    `;

    header.insertAdjacentElement(
      "afterend",
      panel
    );

    bindPanel();
  }

  function bindPanel() {
    $("gcmAddProductionSession")
      ?.addEventListener(
        "click",
        () => openEditor()
      );

    $("gcmCancelProductionSession")
      ?.addEventListener(
        "click",
        closeEditor
      );

    $("gcmSessionClient")
      ?.addEventListener(
        "change",
        () => renderCreativeChoices()
      );

    $("gcmSessionContact")
      ?.addEventListener(
        "input",
        suggestTitle
      );

    $("gcmSessionType")
      ?.addEventListener(
        "change",
        suggestTitle
      );

    $("gcmProductionSessionForm")
      ?.addEventListener(
        "submit",
        saveSession
      );
  }

  async function load() {
    setStatus(
      "Loading durable Media sessions…"
    );

    try {
      const payload =
        await request(
          "get_creative_workflow"
        );

      state.workflow =
        payload?.creativeWorkflow || {};

      renderClientOptions();
      renderSessions();

      setStatus(
        "Media sessions connected to production D1.",
        "ok"
      );
    } catch (error) {
      console.error(
        `Media Production Sessions ${FILE_VERSION}: load failed`,
        error
      );

      setStatus(
        error.message ||
        "Media sessions could not load.",
        "err"
      );
    }
  }

  function setStatus(message, kind = "") {
    const node =
      $("gcmProductionSessionStatus");

    if (!node) return;

    node.textContent = message;
    node.classList.remove("ok", "err");

    if (kind) {
      node.classList.add(kind);
    }
  }

  function renderClientOptions() {
    const select =
      $("gcmSessionClient");

    if (!select) return;

    const clients =
      Array.isArray(
        state.workflow?.clients
      )
        ? state.workflow.clients
        : [];

    select.innerHTML =
      `<option value="">Select client…</option>` +
      clients.map(client => `
        <option value="${Number(client.clientId)}">
          ${esc(client.clientName)}
        </option>
      `).join("");
  }

  function sessionCreativeIds(sessionId) {
    return (
      Array.isArray(
        state.workflow
          ?.productionSessionCreatives
      )
        ? state.workflow
            .productionSessionCreatives
        : []
    )
      .filter(
        item =>
          Number(item.sessionId) ===
          Number(sessionId)
      )
      .map(
        item => Number(item.creativeId)
      )
      .filter(Boolean);
  }

  function sessionCreativeNames(sessionId) {
    return (
      Array.isArray(
        state.workflow
          ?.productionSessionCreatives
      )
        ? state.workflow
            .productionSessionCreatives
        : []
    )
      .filter(
        item =>
          Number(item.sessionId) ===
          Number(sessionId)
      )
      .map(
        item => clean(item.creativeName)
      )
      .filter(Boolean);
  }

  function renderSessions() {
    const list =
      $("gcmProductionSessionList");

    if (!list) return;

    const sessions =
      Array.isArray(
        state.workflow
          ?.productionSessions
      )
        ? [...state.workflow.productionSessions]
        : [];

    sessions.sort(
      (a, b) =>
        clean(a.scheduledAt)
          .localeCompare(
            clean(b.scheduledAt)
          )
    );

    if (!sessions.length) {
      list.innerHTML = `
        <div class="gcm-session-empty">
          No production sessions are scheduled yet.
        </div>
      `;
      return;
    }

    list.innerHTML =
      sessions.map(session => {
        const completed =
          ["completed","cancelled","canceled"]
            .includes(
              clean(session.status)
                .toLowerCase()
            );

        const creativeNames =
          sessionCreativeNames(
            session.id
          );

        return `
          <article class="gcm-session-card">
            <div>
              <h3 class="gcm-session-title">
                ${esc(session.title)}
              </h3>

              <p class="gcm-session-meta">
                ${esc(formatDateTime(session.scheduledAt))}
                ${session.location ? ` · ${esc(session.location)}` : ""}
                ${session.contactName ? ` · ${esc(session.contactName)}` : ""}
                · ${esc(session.clientName)}
              </p>

              <div class="gcm-session-tags">
                <span class="gcm-session-tag ${completed ? "done" : ""}">
                  ${esc(clean(session.status || "scheduled").replaceAll("_"," "))}
                </span>

                ${creativeNames.map(name => `
                  <span class="gcm-session-tag">
                    ${esc(name)}
                  </span>
                `).join("")}
              </div>
            </div>

            <div class="gcm-session-actions">
              ${
                completed
                  ? ""
                  : `
                    <button
                      class="btn small"
                      type="button"
                      data-gcm-edit-session="${Number(session.id)}"
                    >Edit</button>

                    <button
                      class="btn small primary"
                      type="button"
                      data-gcm-complete-session="${Number(session.id)}"
                    >Complete</button>
                  `
              }
            </div>
          </article>
        `;
      }).join("");

    list
      .querySelectorAll(
        "[data-gcm-edit-session]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            const id =
              Number(
                button.dataset
                  .gcmEditSession
              );

            openEditor(id);
          }
        );
      });

    list
      .querySelectorAll(
        "[data-gcm-complete-session]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            const id =
              Number(
                button.dataset
                  .gcmCompleteSession
              );

            completeSession(id);
          }
        );
      });
  }

  function renderCreativeChoices(
    selectedIds = []
  ) {
    const wrap =
      $("gcmSessionCreatives");

    const clientId =
      Number(
        $("gcmSessionClient")?.value
      );

    if (!wrap) return;

    const selected =
      new Set(
        selectedIds.map(Number)
      );

    const creatives =
      (
        Array.isArray(
          state.workflow?.creatives
        )
          ? state.workflow.creatives
          : []
      )
        .filter(
          creative =>
            Number(
              creative.clientId
            ) === clientId
        )
        .filter(
          creative =>
            ![
              "retired",
              "archived",
              "deleted"
            ].includes(
              clean(
                creative.status
              ).toLowerCase()
            )
        )
        .sort(
          (a, b) =>
            clean(a.creativeName)
              .localeCompare(
                clean(b.creativeName)
              )
        );

    if (!clientId) {
      wrap.innerHTML = `
        <div class="gcm-session-empty">
          Select the client first.
        </div>
      `;
      return;
    }

    if (!creatives.length) {
      wrap.innerHTML = `
        <div class="gcm-session-empty">
          No active Media creatives exist for this client.
        </div>
      `;
      return;
    }

    wrap.innerHTML =
      creatives.map(creative => `
        <label class="gcm-session-check">
          <input
            type="checkbox"
            value="${Number(creative.id)}"
            ${selected.has(Number(creative.id)) ? "checked" : ""}
          >
          <span>
            ${esc(creative.creativeName)}
            <small style="display:block;color:var(--m,#637083);margin-top:2px">
              ${esc(creative.currentStage || "Media creative")}
            </small>
          </span>
        </label>
      `).join("");
  }

  function openEditor(sessionId = null) {
    const form =
      $("gcmProductionSessionForm");

    if (!form) return;

    state.editingSessionId =
      sessionId || null;

    form.reset();

    if (sessionId) {
      const session =
        (
          state.workflow
            ?.productionSessions || []
        ).find(
          item =>
            Number(item.id) ===
            Number(sessionId)
        );

      if (!session) return;

      $("gcmSessionClient").value =
        String(session.clientId || "");

      $("gcmSessionType").value =
        clean(
          session.sessionType ||
          "recording"
        );

      $("gcmSessionTitle").value =
        clean(session.title);

      const parts =
        clean(session.scheduledAt)
          .split("T");

      $("gcmSessionDate").value =
        parts[0] || "";

      $("gcmSessionTime").value =
        (parts[1] || "")
          .slice(0, 5);

      $("gcmSessionContact").value =
        clean(session.contactName);

      $("gcmSessionLocation").value =
        clean(session.location);

      $("gcmSessionNotes").value =
        clean(session.notes);

      renderCreativeChoices(
        sessionCreativeIds(
          sessionId
        )
      );
    } else {
      $("gcmSessionType").value =
        "recording";

      renderCreativeChoices();
    }

    form.hidden = false;

    form.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  function closeEditor() {
    const form =
      $("gcmProductionSessionForm");

    if (!form) return;

    form.hidden = true;
    form.reset();
    state.editingSessionId = null;
  }

  function suggestTitle() {
    const title =
      $("gcmSessionTitle");

    if (
      !title ||
      clean(title.value)
    ) {
      return;
    }

    const contact =
      clean(
        $("gcmSessionContact")?.value
      );

    const type =
      clean(
        $("gcmSessionType")?.value
      );

    if (!contact) return;

    const labels = {
      recording: "Recording Session",
      script_review: "Script Review Session",
      production: "Production Session",
      other: "Media Session"
    };

    title.value =
      `${contact} ${labels[type] || "Media Session"}`;
  }

  function selectedCreativeIds() {
    return [
      ...document.querySelectorAll(
        "#gcmSessionCreatives input[type=checkbox]:checked"
      )
    ]
      .map(
        input =>
          Number(input.value)
      )
      .filter(Boolean);
  }

  async function saveSession(event) {
    event.preventDefault();

    const clientId =
      Number(
        $("gcmSessionClient")?.value
      );

    const date =
      clean(
        $("gcmSessionDate")?.value
      );

    const time =
      clean(
        $("gcmSessionTime")?.value
      );

    const creativeIds =
      selectedCreativeIds();

    if (
      !clientId ||
      !date ||
      !time ||
      !creativeIds.length
    ) {
      setStatus(
        "Choose a client, date, time, and at least one creative.",
        "err"
      );
      return;
    }

    const button =
      $("gcmSaveProductionSession");

    if (button) {
      button.disabled = true;
    }

    setStatus(
      "Saving session and connected Calendar commitment…"
    );

    try {
      await request(
        "save_production_session",
        {
          sessionId:
            state.editingSessionId,
          session: {
            clientId,
            sessionType:
              clean(
                $("gcmSessionType")?.value
              ) || "recording",
            title:
              clean(
                $("gcmSessionTitle")?.value
              ),
            scheduledAt:
              `${date}T${time}:00`,
            location:
              clean(
                $("gcmSessionLocation")?.value
              ) || null,
            contactName:
              clean(
                $("gcmSessionContact")?.value
              ) || null,
            notes:
              clean(
                $("gcmSessionNotes")?.value
              ) || null,
            status: "scheduled",
            creativeIds
          }
        }
      );

      closeEditor();
      await load();

      if (
        window.GCMOShell
          ?.refreshNavAttention
      ) {
        await window.GCMOShell
          .refreshNavAttention();
      }

      setStatus(
        "Session saved. Calendar and Media attention were refreshed.",
        "ok"
      );
    } catch (error) {
      setStatus(
        error.message ||
        "Production session could not be saved.",
        "err"
      );
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }

  async function completeSession(
    sessionId
  ) {
    if (!sessionId) return;

    setStatus(
      "Completing session and clearing its Calendar obligation…"
    );

    try {
      await request(
        "complete_production_session",
        { sessionId }
      );

      await load();

      if (
        window.GCMOShell
          ?.refreshNavAttention
      ) {
        await window.GCMOShell
          .refreshNavAttention();
      }

      setStatus(
        "Production session completed and Calendar obligation updated.",
        "ok"
      );
    } catch (error) {
      setStatus(
        error.message ||
        "Production session could not be completed.",
        "err"
      );
    }
  }

  function formatDateTime(value) {
    const text =
      clean(value);

    if (!text) return "Date not recorded";

    const normalized =
      text.length === 16
        ? `${text}:00`
        : text;

    const date =
      new Date(normalized);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return text;
    }

    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }
    ).format(date);
  }

  injectStyles();
  buildPanel();
  load();
})();
