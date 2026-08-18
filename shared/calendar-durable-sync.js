/* =========================================================
   Global Concepts Media Operating System
   File: shared/calendar-durable-sync.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Source: calendar.html v1.1.0 browser Calendar state
   Sprint: Calendar — Durable Appointment Records
   Purpose:
   Bridge the existing Calendar UI to the durable D1 calendar_appointments
   record system without changing the verified Calendar interface.

   Production rules:
   - D1 wins on page load once durable Calendar records exist.
   - The first production run imports the actual browser Calendar snapshot.
   - Later local Calendar changes are synchronized to D1 automatically.
   - localStorage remains a UI working cache, not the durable source of truth.
   - Successful sync refreshes shared-nav deadline urgency from Mission Control.
   ========================================================= */

(() => {
  "use strict";

  const VERSION = "1.0.0";
  const WORKER_ENDPOINT =
    "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const ACTION = "calendar-operations";
  const KEY = "gcm_calendar_v1_1";
  const PRIOR_KEY = "gcm_calendar_v1_0";
  const META_KEY = "gcm_calendar_d1_sync_v1";
  const POLL_MS = 1000;

  let lastAppointmentFingerprint = "";
  let syncInFlight = false;
  let syncQueued = false;
  let intervalId = null;

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function readLocalState() {
    const current = readJson(KEY);
    const prior = current || readJson(PRIOR_KEY);
    return prior && typeof prior === "object" ? prior : null;
  }

  function normalizedLocalAppointments(state) {
    return Array.isArray(state?.appointments)
      ? state.appointments.map(item => ({
          id: Number(item?.id),
          title: String(item?.title || "").trim(),
          typeId: Number(item?.typeId) || null,
          date: String(item?.date || "").trim(),
          time: String(item?.time || "").trim(),
          location: String(item?.location || "").trim(),
          client: String(item?.client || "").trim(),
          email: String(item?.email || "").trim(),
          notes: String(item?.notes || "").trim(),
          status: String(item?.status || "scheduled").trim(),
          address: String(item?.address || "").trim()
        }))
      : [];
  }

  function fingerprint(appointments) {
    return JSON.stringify(
      [...appointments]
        .sort((a, b) => Number(a.id) - Number(b.id))
        .map(item => [
          Number(item.id),
          item.title,
          item.typeId,
          item.date,
          item.time,
          item.location,
          item.client,
          item.email,
          item.notes,
          item.status,
          item.address
        ])
    );
  }

  async function calendarRequest(operation, extra = {}) {
    const response = await fetch(WORKER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: ACTION,
        operation,
        ...extra
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.ok !== true) {
      throw new Error(
        typeof payload?.error === "string"
          ? payload.error
          : `Calendar Worker returned HTTP ${response.status}.`
      );
    }

    return payload;
  }

  function mapDurableAppointments(appointments) {
    return (Array.isArray(appointments) ? appointments : []).map(item => ({
      id: Number(item?.id),
      title: String(item?.title || "").trim(),
      typeId: Number(item?.typeId) || 1,
      date: String(item?.date || "").trim(),
      time: String(item?.time || "").trim(),
      location: String(item?.location || "").trim(),
      client: String(item?.client || "").trim(),
      email: String(item?.email || "").trim(),
      notes: String(item?.notes || "").trim(),
      status: String(item?.status || "scheduled").trim(),
      address: String(item?.address || "").trim()
    }));
  }

  function setIntegrationState(kind, message) {
    const badge = document.getElementById("integrationStatus");
    if (!badge) return;

    badge.textContent = message;
    badge.dataset.gcmDurableCalendar = kind;

    if (kind === "connected") {
      badge.style.background = "var(--green-soft, #e8f7ef)";
      badge.style.color = "var(--green, #16714a)";
    } else if (kind === "error") {
      badge.style.background = "var(--red-soft, #fff0f0)";
      badge.style.color = "var(--red, #b33a3a)";
    }
  }

  async function refreshNavAttention() {
    try {
      if (window.GCMOShell?.refreshNavAttention) {
        await window.GCMOShell.refreshNavAttention();
      }
    } catch (error) {
      console.warn(
        `Calendar Durable Sync ${VERSION}: nav refresh failed.`,
        error
      );
    }
  }

  function writeDurableAppointmentsToLocal(state, durableAppointments) {
    if (!state) return false;

    const mapped = mapDurableAppointments(durableAppointments);
    const current = normalizedLocalAppointments(state);

    if (fingerprint(current) === fingerprint(mapped)) {
      return false;
    }

    const nextState = {
      ...state,
      appointments: mapped,
      nextAppointmentId:
        mapped.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1
    };

    writeJson(KEY, nextState);
    return true;
  }

  function writeMeta(appointments) {
    writeJson(META_KEY, {
      version: VERSION,
      syncedAt: new Date().toISOString(),
      fingerprint: fingerprint(appointments)
    });
  }

  async function syncSnapshot(appointments) {
    if (syncInFlight) {
      syncQueued = true;
      return;
    }

    syncInFlight = true;

    try {
      const payload = await calendarRequest("sync_snapshot", { appointments });
      const durable = mapDurableAppointments(payload?.calendarAppointments);
      lastAppointmentFingerprint = fingerprint(appointments);
      writeMeta(durable);
      setIntegrationState(
        "connected",
        "GCM OS Calendar connected · Google Calendar not connected"
      );
      await refreshNavAttention();
    } catch (error) {
      setIntegrationState(
        "error",
        "GCM OS Calendar sync unavailable"
      );
      console.error(
        `Calendar Durable Sync ${VERSION}: snapshot sync failed.`,
        error
      );
    } finally {
      syncInFlight = false;

      if (syncQueued) {
        syncQueued = false;
        const state = readLocalState();
        const current = normalizedLocalAppointments(state);
        const currentFingerprint = fingerprint(current);

        if (currentFingerprint !== lastAppointmentFingerprint) {
          syncSnapshot(current);
        }
      }
    }
  }

  async function initialize() {
    const state = readLocalState();

    if (!state) {
      setIntegrationState("error", "GCM OS Calendar local state unavailable");
      return;
    }

    const localAppointments = normalizedLocalAppointments(state);
    lastAppointmentFingerprint = fingerprint(localAppointments);

    try {
      const payload = await calendarRequest("list");
      const durableAppointments = mapDurableAppointments(
        payload?.calendarAppointments
      );

      if (!durableAppointments.length) {
        await syncSnapshot(localAppointments);
      } else {
        const changedLocal = writeDurableAppointmentsToLocal(
          state,
          durableAppointments
        );

        writeMeta(durableAppointments);
        lastAppointmentFingerprint = fingerprint(durableAppointments);
        setIntegrationState(
          "connected",
          "GCM OS Calendar connected · Google Calendar not connected"
        );
        await refreshNavAttention();

        if (changedLocal) {
          const reloadKey = `gcm-calendar-durable-reload-${VERSION}`;

          if (!sessionStorage.getItem(reloadKey)) {
            sessionStorage.setItem(reloadKey, "1");
            window.location.reload();
            return;
          }
        }
      }
    } catch (error) {
      setIntegrationState("error", "GCM OS Calendar sync unavailable");
      console.error(
        `Calendar Durable Sync ${VERSION}: initialization failed.`,
        error
      );
    }

    intervalId = window.setInterval(() => {
      const currentState = readLocalState();
      if (!currentState) return;

      const appointments = normalizedLocalAppointments(currentState);
      const currentFingerprint = fingerprint(appointments);

      if (currentFingerprint !== lastAppointmentFingerprint) {
        syncSnapshot(appointments);
      }
    }, POLL_MS);
  }

  window.addEventListener("beforeunload", () => {
    if (intervalId) window.clearInterval(intervalId);
  });

  initialize();
})();
