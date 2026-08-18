# GCM OS — Sidebar Attention Indicators

**Record Date:** 2026-08-18  
**Area:** Shared Navigation / Mission Control  
**Status:** Required Redesign Behavior

## Requirement

The original GCM OS used the sidebar navigation as a secondary reminder system. That behavior must be restored in the redesigned shared shell.

Each operational navigation item must be able to display an attention indicator whose color reflects urgency of the most urgent current item associated with that section.

### Color Contract

- **Green** — nothing currently requiring attention; no near-term deadline or scheduled action.
- **Yellow** — something is coming due within the next few days / approaching attention window.
- **Red** — something requires attention today, is due today, or is overdue and still unresolved.

## Purpose

The sidebar indicator is not the primary work queue. Today / Mission Control remains the authoritative place to see and act on current work. The sidebar color is a secondary visual reminder so the user can see emerging or current obligations from any page in the OS without opening each section.

## Expected Coverage

Indicators should be available for operational sections where dated or attention-bearing records exist, including at minimum:

- Work
- Media
- Prospects
- Calendar
- Proof / Progress Reports
- Client-related attention when applicable

Calendar-driven appointments and working sessions must contribute to these indicators. Example: a Monica script session scheduled for today should make the relevant Calendar/Today attention state red until completed or otherwise dispositioned.

## Current Production Gap

The current shared shell (`shared/gcm-shell.js` v2.0.19) renders static navigation links and does not contain the prior green/yellow/red operational indicator behavior. This is therefore a restoration requirement for the redesign, not a cosmetic enhancement.

## Design Rule

The indicator must derive from durable OS data / authoritative scheduling and work state, not from per-browser localStorage alone. It must remain consistent across pages and devices.

## Relationship to Today

- Today/Mission Control = primary authoritative action queue.
- Sidebar indicator = secondary persistent urgency signal.
- Green = clear.
- Yellow = approaching.
- Red = today/overdue.

The two systems must agree. A red sidebar indicator with nothing visible on Today is a defect; likewise, a due-today item on Today with a green sidebar indicator is a defect.
