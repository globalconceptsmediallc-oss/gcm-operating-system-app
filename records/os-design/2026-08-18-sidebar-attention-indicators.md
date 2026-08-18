# GCM OS — Sidebar Attention Indicators

**Record Date:** 2026-08-18  
**Area:** Shared Navigation / Mission Control  
**Status:** Required Redesign Behavior — Production Implementation Candidate

## Requirement

The original GCM OS used the sidebar navigation as a secondary reminder system. That behavior must be restored in the redesigned shared shell.

Each operational navigation item must be able to display an attention indicator whose color reflects the nearest unresolved, durably recorded deadline associated with that section.

### Locked Color Contract

- **Red** — overdue, due today, or due within **0–2 calendar days**.
- **Yellow** — due within **3–6 calendar days**.
- **Green** — next proven dated obligation is **7 or more calendar days away**.
- **Neutral / no marker** — no durable dated obligation is currently provable for that section.

The indicator must not invent a deadline merely because a section contains open work. A record needs an authoritative date before it can drive red/yellow/green urgency.

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

Calendar-driven appointments and working sessions must contribute once they are available through the durable OS scheduling source. Example: a Monica script session scheduled for today should make the relevant Calendar/Today attention state red until the scheduled commitment is no longer current or is otherwise dispositioned.

## Production Implementation Rule

The shared shell must consume the same read-only Mission Control response used by Today rather than creating an independent browser-only urgency model.

Durable sources are evaluated conservatively:

- D1-backed records with a proven due/scheduled date may drive an indicator.
- Media uses the existing authoritative station traffic-deadline calculation.
- Sections whose production data is still static, browser-local, or lacks a durable due-date contract remain neutral until that architecture is completed.
- localStorage alone must never drive the cross-page/cross-device sidebar state.

## Current Production Gap Being Closed

The current shared shell (`shared/gcm-shell.js` v2.0.19) renders static navigation links and does not contain the prior green/yellow/red operational indicator behavior. The approved production change adds the visual markers and a Mission Control nav-attention contract without changing D1 records or the existing operational priority queue.

## Relationship to Today

- Today/Mission Control = primary authoritative action queue.
- Sidebar indicator = secondary persistent urgency signal.
- Red = overdue / 0–2 days.
- Yellow = 3–6 days.
- Green = 7+ days.
- Neutral = no authoritative dated obligation.

The two systems must use the same underlying durable state. A red sidebar indicator with no corresponding durable reason is a defect; likewise, a durable due-today item whose section remains green is a defect.
