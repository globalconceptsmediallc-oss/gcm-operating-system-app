# GCM OS DECISIONS

**Document Version:** 1.0

**Status:** Active

**Purpose**

This document records the major architectural and product decisions that define how the Global Concepts Media Operating System (GCM OS) is built.

Its purpose is to preserve engineering intent.

When future development raises questions that have already been answered, this document explains what was decided and why.

This document is intentionally small.

Only decisions that materially affect the architecture, product direction, or engineering standards belong here.

---

# Decision 001

## Title

The Business Record is the Single Source of Truth.

## Status

LOCKED

## Decision

All business intelligence produced by GCM OS must ultimately become part of the Business Record.

No downstream component may maintain its own independent version of business information.

## Reason

A single source of truth prevents conflicting information between workers, dashboards, reports, and future modules.

---

# Decision 002

## Title

Workers Have a Single Responsibility.

## Status

LOCKED

## Decision

Every worker performs one clearly defined responsibility.

Workers collect evidence.

Workers do not perform unrelated responsibilities.

## Reason

Single-responsibility workers are easier to maintain, replace, expand, and test.

---

# Decision 003

## Title

Workers Never Become the Source of Truth.

## Status

LOCKED

## Decision

Workers return standardized evidence.

Only the Business Record Builder creates or updates the Business Record.

## Reason

Separating evidence collection from data ownership prevents inconsistencies as additional workers are introduced.

---

# Decision 004

## Title

Evidence Before Assumptions.

## Status

LOCKED

## Decision

Consulting recommendations must be supported by publicly observable evidence whenever possible.

Unknown information should remain Unknown.

## Reason

The purpose of GCM OS is to improve consulting decisions, not invent information.

---

# Decision 005

## Title

Consulting Intelligence is Generated from the Business Record.

## Status

LOCKED

## Decision

Consulting Intelligence is always derived from the Business Record.

It never bypasses the Business Record to consume worker output directly.

## Reason

This preserves a consistent consulting workflow regardless of future architecture changes.

---

# Decision 006

## Title

GCM OS Complements Specialist Tools.

## Status

LOCKED

## Decision

GCM OS identifies consulting opportunities.

Specialist platforms validate findings and support implementation.

Examples include:

- Semrush
- Ahrefs
- Google Search Console
- Google Analytics
- Google Business Profile
- Website CMS platforms

## Reason

The objective is to improve consulting efficiency rather than replace specialized software.

---

# Decision 007

## Title

One File at a Time.

## Status

LOCKED

## Decision

Development proceeds one file at a time.

Every change should include:

- Complete fresh-install replacement
- Deployment
- Testing
- Verification
- Lock before continuing

## Reason

This minimizes regressions and keeps development predictable.

---

# Decision 008

## Title

Documentation Guides Development.

## Status

LOCKED

## Decision

Development begins by reading:

1. docs/START_HERE.md
2. docs/GCM_OS_PRODUCT_BLUEPRINT.md
3. docs/PROJECT_STATUS.md
4. docs/ARCHITECTURE.md
5. docs/DECISIONS.md

Documentation takes precedence over previous conversations or AI memory.

## Reason

Documentation provides a stable engineering foundation across development sessions.

---

# Decision 009

## Title

The Dashboard is a Presentation Layer.

## Status

LOCKED

## Decision

The dashboard displays Business Record and Consulting Intelligence information.

The dashboard is never the source of truth.

## Reason

Separating presentation from business logic improves maintainability and future scalability.

---

# Decision 010

## Title

The Product is a Consulting Operating System.

## Status

LOCKED

## Decision

GCM OS is an AI-powered Consulting Operating System.

Its purpose is to prepare consultants for better business conversations through structured consulting intelligence.

## Reason

This defines the long-term direction of the platform and differentiates it from reporting tools, CRMs, and standalone SEO software.

---

# Decision Review

Before changing any LOCKED decision:

- Identify why the change is necessary.
- Evaluate architectural impact.
- Update ARCHITECTURE.md if required.
- Update PRODUCT_BLUEPRINT.md if product philosophy changes.
- Record the revised decision in this document.

Architectural decisions should change infrequently and intentionally.

---

# Guiding Principle

A good architectural decision should make future engineering simpler, not more complicated.

If a proposed change makes the system harder to understand, reconsider the design before implementing it.
