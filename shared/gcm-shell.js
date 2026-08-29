/* =========================================================
   Global Concepts Media Operating System
   File: shared/gcm-shell.js
   Version: 2.0.34
   Status: Production Road-Test Candidate
   Purpose: Shared internal GCM OS application shell foundation.
   Source: gcm-shell.js 2.0.33 production navigation
   Sprint: Media Dashboard — Creative Run Dates
   Change:
   - Loads Media Dashboard Creative Queue v1.1.2 and defers to the native commercial-grouped Media queue to prevent duplicate Creative cards.
   - Preserves MediaForge navigation, Gmail Decision controls, Calendar Durable Sync,
     Media Production Sessions, Prospect Next Action, and existing Work enhancements.
   ========================================================= */

(() => {
  "use strict";

  const SHELL_VERSION = "2.0.34";
  const WORKER_ENDPOINT =
    "https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const MISSION_CONTROL_ACTION = "get-mission-control";

  const PAGE_MAP = {
    today: { label: "Today", href: "today.html", icon: "⌂" },
    clients: { label: "Clients", href: "clients.html", icon: "◫" },
    communications: { label: "Communications", href: "communications.html", icon: "✉" },
    work: { label: "Work", href: "work.html", icon: "✓" },
    media: { label: "Media", href: "media.html", icon: "◉" },
    mediaforge: { label: "MediaForge", href: "https://mediaforge-36x.pages.dev/", icon: "◆" },
    prospects: { label: "Prospects", href: "prospects.html", icon: "◎" },
    calendar: { label: "Calendar", href: "calendar.html", icon: "▦" },
    finance: { label: "Billing", href: "finance.html", icon: "$" },
    proof: { label: "Proof", href: "proof.html", icon: "↗" }
  };

  const DEFERRED_NAV = [
    { label: "Settings", icon: "⚙", reason: "Workflow not yet active" }
  ];

  const STYLE_ID = "gcm-os-shared-shell-styles";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root {--gcm-shell-navy-950:#071426;--gcm-shell-navy-900:#0b1d33;--gcm-shell-blue-500:#347ce8;--gcm-shell-gold-500:#d6a94a;}
      .gcm-shell-sidebar{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;padding:24px 18px;background:radial-gradient(circle at top right,rgba(52,124,232,.19),transparent 34%),linear-gradient(180deg,var(--gcm-shell-navy-900),var(--gcm-shell-navy-950));color:#fff;overflow-y:auto}
      .gcm-shell-brand{display:flex;align-items:center;gap:12px;padding:2px 8px 22px;border-bottom:1px solid rgba(255,255,255,.12);color:inherit;text-decoration:none}
      .gcm-shell-brand-mark{width:42px;height:42px;display:grid;place-items:center;flex:0 0 auto;border:1px solid rgba(255,255,255,.22);border-radius:13px;background:rgba(255,255,255,.08);color:var(--gcm-shell-gold-500);font-weight:900;letter-spacing:-.04em}
      .gcm-shell-brand-copy strong,.gcm-shell-brand-copy span{display:block}.gcm-shell-brand-copy strong{font-size:.95rem;letter-spacing:.01em}.gcm-shell-brand-copy span{margin-top:2px;color:rgba(255,255,255,.58);font-size:.75rem;text-transform:uppercase;letter-spacing:.12em}
      .gcm-shell-nav-label{margin:24px 10px 10px;color:rgba(255,255,255,.42);font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.14em}.gcm-shell-nav{display:grid;gap:6px}
      .gcm-shell-nav-link,.gcm-shell-nav-disabled{display:flex;align-items:center;gap:12px;min-height:46px;padding:0 13px;border-radius:12px;font-size:.92rem;font-weight:700}
      .gcm-shell-nav-link{color:rgba(255,255,255,.72);text-decoration:none;transition:background 160ms ease,color 160ms ease,transform 160ms ease}.gcm-shell-nav-link:hover,.gcm-shell-nav-link:focus-visible{background:rgba(255,255,255,.08);color:#fff;transform:translateX(2px);outline:none}.gcm-shell-nav-link[aria-current="page"]{background:rgba(52,124,232,.2);color:#fff;box-shadow:inset 3px 0 0 var(--gcm-shell-gold-500)}
      .gcm-shell-nav-disabled{color:rgba(255,255,255,.34);cursor:default}.gcm-shell-nav-icon{width:22px;text-align:center;flex:0 0 auto}.gcm-shell-nav-status{margin-left:auto;padding:3px 7px;border:1px solid rgba(255,255,255,.12);border-radius:999px;color:rgba(255,255,255,.42);font-size:.58rem;font-weight:850;letter-spacing:.04em;text-transform:uppercase}
      .gcm-shell-nav-indicator{display:none;width:10px;height:10px;margin-left:auto;flex:0 0 auto;border-radius:50%;border:1px solid rgba(255,255,255,.42)}
      .gcm-shell-nav-indicator[data-state="red"]{display:inline-block;background:#ef5a5a;box-shadow:0 0 0 4px rgba(239,90,90,.14)}
      .gcm-shell-nav-indicator[data-state="yellow"]{display:inline-block;background:#f0bd4f;box-shadow:0 0 0 4px rgba(240,189,79,.14)}
      .gcm-shell-nav-indicator[data-state="green"]{display:inline-block;background:#5fd397;box-shadow:0 0 0 4px rgba(95,211,151,.12)}
      .gcm-shell-footer{margin-top:auto;padding:18px 8px 2px;border-top:1px solid rgba(255,255,255,.12)}.gcm-shell-status{display:flex;align-items:center;gap:9px;color:rgba(255,255,255,.67);font-size:.78rem}.gcm-shell-status-dot{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:#5fd397;box-shadow:0 0 0 4px rgba(95,211,151,.12)}
      @media(max-width:860px){.gcm-shell-sidebar{position:fixed;inset:0 auto 0 0;z-index:100;width:250px;transform:translateX(-100%);transition:transform 180ms ease}.gcm-shell-sidebar.is-open{transform:translateX(0)}}
    `;

    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function navItemHtml(key, item, currentPage) {
    const currentAttribute =
      key === currentPage ? ' aria-current="page"' : "";

    return `<a class="gcm-shell-nav-link" href="${escapeHtml(item.href)}" data-gcm-nav="${escapeHtml(key)}"${currentAttribute}><span class="gcm-shell-nav-icon" aria-hidden="true">${escapeHtml(item.icon)}</span><span>${escapeHtml(item.label)}</span><span class="gcm-shell-nav-indicator" data-gcm-nav-indicator="${escapeHtml(key)}" data-state="neutral" aria-hidden="true"></span></a>`;
  }

  function deferredItemHtml(item) {
    return `<div class="gcm-shell-nav-disabled" aria-disabled="true" title="${escapeHtml(item.reason)}"><span class="gcm-shell-nav-icon" aria-hidden="true">${escapeHtml(item.icon)}</span><span>${escapeHtml(item.label)}</span><span class="gcm-shell-nav-status">Later</span></div>`;
  }

  function buildSidebarHtml(currentPage, statusText) {
    const activePage = Object.prototype.hasOwnProperty.call(PAGE_MAP, currentPage)
      ? currentPage
      : "";

    const primaryNavigation = Object.entries(PAGE_MAP)
      .map(([key, item]) => navItemHtml(key, item, activePage))
      .join("");

    const deferredNavigation = DEFERRED_NAV
      .map(deferredItemHtml)
      .join("");

    return `<a class="gcm-shell-brand" href="today.html" aria-label="GCM OS Today"><span class="gcm-shell-brand-mark">G</span><span class="gcm-shell-brand-copy"><strong>Global Concepts Media</strong><span>Agency Operating System</span></span></a><p class="gcm-shell-nav-label">Workspace</p><nav class="gcm-shell-nav" aria-label="GCM OS workspace">${primaryNavigation}${deferredNavigation}</nav><div class="gcm-shell-footer"><div class="gcm-shell-status"><span class="gcm-shell-status-dot" aria-hidden="true"></span><span>${escapeHtml(statusText)}</span></div></div>`;
  }

  function navAttentionText(section) {
    if (!section || !Number.isFinite(Number(section.daysUntil))) {
      return "";
    }

    const days = Number(section.daysUntil);
    const dueDate = String(section.nearestDueDate || "").trim();
    const label = String(section.label || "").trim();
    const subject = label ? `${label}: ` : "";
    const dateSuffix = dueDate ? ` · ${dueDate}` : "";

    if (days < 0) {
      const overdueDays = Math.abs(days);
      return `${subject}overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}${dateSuffix}`;
    }

    if (days === 0) {
      return `${subject}due today${dateSuffix}`;
    }

    if (days === 1) {
      return `${subject}due tomorrow${dateSuffix}`;
    }

    return `${subject}due in ${days} days${dateSuffix}`;
  }

  function applyNavAttention(sidebar, sections) {
    if (!sidebar || !sections || typeof sections !== "object") return;

    sidebar
      .querySelectorAll("[data-gcm-nav-indicator]")
      .forEach(indicator => {
        const key = String(indicator.dataset.gcmNavIndicator || "");
        const section = sections[key];
        const state = String(section?.state || "neutral").toLowerCase();
        const allowedState = ["red", "yellow", "green"].includes(state)
          ? state
          : "neutral";

        indicator.dataset.state = allowedState;

        const link = indicator.closest(".gcm-shell-nav-link");
        if (!link) return;

        if (allowedState === "neutral") {
          link.removeAttribute("data-attention-state");
          link.removeAttribute("title");
          return;
        }

        link.dataset.attentionState = allowedState;
        const detail = navAttentionText(section);

        link.title = detail
          ? `${PAGE_MAP[key]?.label || key}: ${detail}`
          : `${PAGE_MAP[key]?.label || key}: ${allowedState} deadline state`;
      });
  }

  async function loadNavAttention(sidebar) {
    try {
      const response = await fetch(WORKER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ action: MISSION_CONTROL_ACTION })
      });

      const payload = await response.json();

      if (!response.ok || payload?.ok !== true) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : `HTTP ${response.status}`
        );
      }

      const navAttention = payload?.missionControl?.navAttention;
      applyNavAttention(sidebar, navAttention?.sections);

      if (navAttention?.degraded === true) {
        console.warn(
          `GCM OS Shell ${SHELL_VERSION}: nav attention loaded in degraded mode.`,
          navAttention?.error || ""
        );
      }

      return navAttention || null;
    } catch (error) {
      console.warn(
        `GCM OS Shell ${SHELL_VERSION}: nav attention unavailable.`,
        error
      );
      return null;
    }
  }

  async function refreshNavAttention() {
    const sidebar = document.querySelector(".gcm-shell-sidebar");
    if (!sidebar) return null;
    return loadNavAttention(sidebar);
  }

  function configureMobileMenu(sidebar, menuButton) {
    if (!sidebar || !menuButton) return;

    menuButton.setAttribute(
      "aria-controls",
      sidebar.id || "gcm-os-sidebar"
    );

    menuButton.setAttribute(
      "aria-expanded",
      String(sidebar.classList.contains("is-open"))
    );

    menuButton.addEventListener("click", () => {
      const isOpen = sidebar.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("click", event => {
      if (
        window.innerWidth > 860 ||
        !sidebar.classList.contains("is-open") ||
        sidebar.contains(event.target) ||
        menuButton.contains(event.target)
      ) {
        return;
      }

      sidebar.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    });

    sidebar.addEventListener("click", event => {
      const navLink = event.target.closest(".gcm-shell-nav-link");

      if (!navLink || window.innerWidth > 860) return;

      sidebar.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  }

  function appendScript(src, marker) {
    if (document.querySelector(`script[${marker}]`)) return;

    const script = document.createElement("script");
    script.src = src;
    script.setAttribute(marker, "1");
    script.async = true;
    document.head.appendChild(script);
  }

  function restoreMediaCreativeHandoff() {
    const url = new URL(window.location.href);

    if (url.searchParams.get("creativeId")) return;

    let saved = "";

    try {
      saved = sessionStorage.getItem("gcmMediaCreativeId") || "";
    } catch {}

    if (!/^\d+$/.test(saved)) return;

    url.searchParams.set("creativeId", saved);
    history.replaceState(null, "", url);
  }

  function loadPageEnhancements() {
    const path = window.location.pathname;

    if (/\/today\.html$/i.test(path)) {
      appendScript(
        "shared/today-gmail-decisions.js?v=1.2.1",
        "data-gcm-today-gmail-decisions"
      );
    }

    if (/\/calendar\.html$/i.test(path)) {
      appendScript(
        "shared/calendar-durable-sync.js?v=1.0.1",
        "data-gcm-calendar-durable-sync"
      );
    }

    if (/\/work\.html$/i.test(path)) {
      appendScript(
        "shared/work-investigation-completion.js?v=1.1.0",
        "data-gcm-work-investigation-completion"
      );

      appendScript(
        "shared/work-due-date.js?v=1.0.0",
        "data-gcm-work-due-date"
      );
    }

    if (/\/prospects\.html$/i.test(path)) {
      appendScript(
        "shared/prospect-next-action.js?v=1.0.0",
        "data-gcm-prospect-next-action"
      );
    }

    if (/\/media-production\.html$/i.test(path)) {
      restoreMediaCreativeHandoff();

      appendScript(
        "shared/media-production-package.js?v=1.1.0",
        "data-gcm-media-production-package"
      );

      appendScript(
        "shared/media-market-traffic-ids.js?v=1.0.1",
        "data-gcm-media-market-traffic-ids"
      );

      appendScript(
        "shared/media-work-state.js?v=1.0.0",
        "data-gcm-media-work-state"
      );

      appendScript(
        "shared/media-production-sessions.js?v=1.0.0",
        "data-gcm-media-production-sessions"
      );
    }

    if (/\/media\.html$/i.test(path)) {
      appendScript(
        "shared/media-dashboard-creatives.js?v=1.1.2",
        "data-gcm-media-dashboard-creatives"
      );

      appendScript(
        "shared/media-existing-entry.js?v=1.0.0",
        "data-gcm-media-existing-entry"
      );

      appendScript(
        "shared/media-recovery-dashboard.js?v=1.0.0",
        "data-gcm-media-recovery-dashboard"
      );

      appendScript(
        "shared/media-placement-disposition.js?v=1.1.0",
        "data-gcm-media-placement-disposition"
      );

      appendScript(
        "shared/media-decision-context.js?v=1.0.0",
        "data-gcm-media-decision-context"
      );

      appendScript(
        "shared/media-needs-action.js?v=1.1.0",
        "data-gcm-media-needs-action"
      );

      appendScript(
        "shared/media-summary-navigation.js?v=1.0.0",
        "data-gcm-media-summary-navigation"
      );

      appendScript(
        "shared/media-dashboard-cleanup.js?v=1.0.0",
        "data-gcm-media-dashboard-cleanup"
      );
    }
  }

  function mount(options = {}) {
    injectStyles();

    const sidebarSelector =
      options.sidebarSelector || "[data-gcm-shell-sidebar]";
    const mobileMenuSelector =
      options.mobileMenuSelector || "[data-gcm-shell-menu-button]";
    const sidebar = document.querySelector(sidebarSelector);

    if (!sidebar) {
      console.error(
        `GCM OS Shell ${SHELL_VERSION}: sidebar mount point not found: ${sidebarSelector}`
      );
      return false;
    }

    const currentPage = String(options.currentPage || "")
      .trim()
      .toLowerCase();

    const statusText =
      String(options.statusText || "GCM OS operational").trim() ||
      "GCM OS operational";

    if (!sidebar.id) {
      sidebar.id = "gcm-os-sidebar";
    }

    sidebar.classList.add("gcm-shell-sidebar");
    sidebar.innerHTML = buildSidebarHtml(currentPage, statusText);

    configureMobileMenu(
      sidebar,
      document.querySelector(mobileMenuSelector)
    );

    loadPageEnhancements();
    loadNavAttention(sidebar);

    return true;
  }

  window.GCMOShell = Object.freeze({
    version: SHELL_VERSION,
    mount,
    refreshNavAttention
  });
})();