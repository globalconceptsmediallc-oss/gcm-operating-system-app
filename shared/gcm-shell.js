/* =========================================================
   Global Concepts Media Operating System
   File: shared/gcm-shell.js
   Version: 1.0.1
   Status: Production Candidate
   Purpose: Shared internal GCM OS application shell foundation.
   Source: gcm-shell.js 1.0.0 production navigation
   Sprint: Finance Navigation Integration
   Change: Adds Finance as an active shared-shell destination.
   ========================================================= */

(() => {
  "use strict";

  const SHELL_VERSION = "1.0.1";

  const PAGE_MAP = {
    today: {
      label: "Today",
      href: "today.html",
      icon: "⌂"
    },
    prospects: {
      label: "Prospects",
      href: "client-pre-research.html",
      icon: "◎"
    },
    clients: {
      label: "Clients",
      href: "clients.html",
      icon: "◫"
    },
    communications: {
      label: "Communications",
      href: "communications.html",
      icon: "✉"
    },
    work: {
      label: "Work",
      href: "work.html",
      icon: "✓"
    },
    proof: {
      label: "Proof",
      href: "proof.html",
      icon: "↗"
    },
    media: {
      label: "Media",
      href: "media.html",
      icon: "◉"
    },
    finance: {
      label: "Finance",
      href: "finance.html",
      icon: "$"
    }
  };

  const DEFERRED_NAV = [
    {
      label: "Case Studies",
      icon: "★",
      reason: "Workflow not yet active"
    },
    {
      label: "Settings",
      icon: "⚙",
      reason: "Workflow not yet active"
    }
  ];

  const STYLE_ID = "gcm-os-shared-shell-styles";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --gcm-shell-navy-950: #071426;
        --gcm-shell-navy-900: #0b1d33;
        --gcm-shell-blue-500: #347ce8;
        --gcm-shell-gold-500: #d6a94a;
      }

      .gcm-shell-sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
        padding: 24px 18px;
        background:
          radial-gradient(
            circle at top right,
            rgba(52, 124, 232, 0.19),
            transparent 34%
          ),
          linear-gradient(
            180deg,
            var(--gcm-shell-navy-900),
            var(--gcm-shell-navy-950)
          );
        color: #ffffff;
        overflow-y: auto;
      }

      .gcm-shell-brand {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 2px 8px 22px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        color: inherit;
        text-decoration: none;
      }

      .gcm-shell-brand-mark {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 13px;
        background: rgba(255, 255, 255, 0.08);
        color: var(--gcm-shell-gold-500);
        font-weight: 900;
        letter-spacing: -0.04em;
      }

      .gcm-shell-brand-copy strong,
      .gcm-shell-brand-copy span {
        display: block;
      }

      .gcm-shell-brand-copy strong {
        font-size: 0.95rem;
        letter-spacing: 0.01em;
      }

      .gcm-shell-brand-copy span {
        margin-top: 2px;
        color: rgba(255, 255, 255, 0.58);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .gcm-shell-nav-label {
        margin: 24px 10px 10px;
        color: rgba(255, 255, 255, 0.42);
        font-size: 0.68rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.14em;
      }

      .gcm-shell-nav {
        display: grid;
        gap: 6px;
      }

      .gcm-shell-nav-link,
      .gcm-shell-nav-disabled {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 46px;
        padding: 0 13px;
        border-radius: 12px;
        font-size: 0.92rem;
        font-weight: 700;
      }

      .gcm-shell-nav-link {
        color: rgba(255, 255, 255, 0.72);
        text-decoration: none;
        transition:
          background 160ms ease,
          color 160ms ease,
          transform 160ms ease;
      }

      .gcm-shell-nav-link:hover,
      .gcm-shell-nav-link:focus-visible {
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
        transform: translateX(2px);
        outline: none;
      }

      .gcm-shell-nav-link[aria-current="page"] {
        background: rgba(52, 124, 232, 0.2);
        color: #ffffff;
        box-shadow: inset 3px 0 0 var(--gcm-shell-gold-500);
      }

      .gcm-shell-nav-disabled {
        color: rgba(255, 255, 255, 0.34);
        cursor: default;
      }

      .gcm-shell-nav-icon {
        width: 22px;
        text-align: center;
        flex: 0 0 auto;
      }

      .gcm-shell-nav-status {
        margin-left: auto;
        padding: 3px 7px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        color: rgba(255, 255, 255, 0.42);
        font-size: 0.58rem;
        font-weight: 850;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .gcm-shell-footer {
        margin-top: auto;
        padding: 18px 8px 2px;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
      }

      .gcm-shell-status {
        display: flex;
        align-items: center;
        gap: 9px;
        color: rgba(255, 255, 255, 0.67);
        font-size: 0.78rem;
      }

      .gcm-shell-status-dot {
        width: 8px;
        height: 8px;
        flex: 0 0 auto;
        border-radius: 50%;
        background: #5fd397;
        box-shadow: 0 0 0 4px rgba(95, 211, 151, 0.12);
      }

      @media (max-width: 860px) {
        .gcm-shell-sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          z-index: 100;
          width: 250px;
          transform: translateX(-100%);
          transition: transform 180ms ease;
        }

        .gcm-shell-sidebar.is-open {
          transform: translateX(0);
        }
      }
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
    const isCurrent = key === currentPage;
    const currentAttribute = isCurrent ? ' aria-current="page"' : "";

    return `
      <a
        class="gcm-shell-nav-link"
        href="${escapeHtml(item.href)}"
        data-gcm-nav="${escapeHtml(key)}"
        ${currentAttribute}
      >
        <span class="gcm-shell-nav-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
        <span>${escapeHtml(item.label)}</span>
      </a>
    `;
  }

  function deferredItemHtml(item) {
    return `
      <div
        class="gcm-shell-nav-disabled"
        aria-disabled="true"
        title="${escapeHtml(item.reason)}"
      >
        <span class="gcm-shell-nav-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
        <span>${escapeHtml(item.label)}</span>
        <span class="gcm-shell-nav-status">Later</span>
      </div>
    `;
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

    return `
      <a class="gcm-shell-brand" href="today.html" aria-label="GCM OS Today">
        <span class="gcm-shell-brand-mark">G</span>
        <span class="gcm-shell-brand-copy">
          <strong>Global Concepts Media</strong>
          <span>Agency Operating System</span>
        </span>
      </a>

      <p class="gcm-shell-nav-label">Workspace</p>

      <nav class="gcm-shell-nav" aria-label="GCM OS workspace">
        ${primaryNavigation}
        ${deferredNavigation}
      </nav>

      <div class="gcm-shell-footer">
        <div class="gcm-shell-status">
          <span class="gcm-shell-status-dot" aria-hidden="true"></span>
          <span>${escapeHtml(statusText)}</span>
        </div>
      </div>
    `;
  }

  function configureMobileMenu(sidebar, menuButton) {
    if (!sidebar || !menuButton) return;

    menuButton.setAttribute("aria-controls", sidebar.id || "gcm-os-sidebar");
    menuButton.setAttribute(
      "aria-expanded",
      String(sidebar.classList.contains("is-open"))
    );

    menuButton.addEventListener("click", () => {
      const isOpen = sidebar.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("click", (event) => {
      if (window.innerWidth > 860) return;
      if (!sidebar.classList.contains("is-open")) return;
      if (sidebar.contains(event.target)) return;
      if (menuButton.contains(event.target)) return;

      sidebar.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    });

    sidebar.addEventListener("click", (event) => {
      const navLink = event.target.closest(".gcm-shell-nav-link");
      if (!navLink || window.innerWidth > 860) return;

      sidebar.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    });
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

    const menuButton = document.querySelector(mobileMenuSelector);
    configureMobileMenu(sidebar, menuButton);

    return true;
  }

  window.GCMOSShell = Object.freeze({
    version: SHELL_VERSION,
    mount
  });
})();
