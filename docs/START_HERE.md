# GCM OS DEVELOPMENT START HERE

**Document Version:** 1.0

**Status:** Locked

**Purpose**

This document is the required starting point for every new development session of the Global Concepts Media Operating System (GCM OS).

Its purpose is to ensure every engineering session begins with the same understanding of the product, architecture, current sprint, and engineering standards.

If this document conflicts with previous conversations or AI memory, this document takes precedence.

---

# Project

**Global Concepts Media Operating System (GCM OS)**

---

# Product Mission

GCM OS is an AI-powered Consulting Operating System.

Its purpose is to transform publicly observable business information into consulting intelligence that helps Global Concepts Media:

- Understand businesses before making recommendations.
- Identify measurable opportunities.
- Support better consulting conversations.
- Produce Growth Reviews.
- Generate evidence-based proposals.
- Measure business improvement over time.

The objective is **not** to replace consulting.

The objective is to make consultants significantly more prepared before every client conversation.

---

# Development Startup Sequence

Before making recommendations or writing code, always read these documents in the following order:

1. `docs/START_HERE.md`
2. `docs/GCM_OS_PRODUCT_BLUEPRINT.md`
3. `docs/PROJECT_STATUS.md`
4. `docs/ARCHITECTURE.md` *(when available)*
5. `docs/DECISIONS.md` *(when available)*

These documents define the current state of the product.

If previous conversations conflict with these documents, the documents are the source of truth.

---

# Current Product Philosophy

The Business Record is the single source of truth.

Every worker contributes observable evidence.

Only the Business Record Builder may create or update the Business Record.

Workers contribute evidence.

The Business Record Builder standardizes and merges that evidence into a single Business Record.

Consulting Intelligence is generated from the Business Record.

The dashboard displays Consulting Intelligence.

Growth Reviews are generated from Consulting Intelligence.

Proposals are generated from Growth Reviews.

Everything supports the consulting lifecycle.

---

# The GCM Consulting Method

```
DISCOVER
      ↓
UNDERSTAND
      ↓
PRIORITIZE
      ↓
IMPLEMENT
      ↓
MEASURE
      ↓
IMPROVE
```

Every feature inside GCM OS must support one or more stages of this process.

---

# Engineering Rules

- One file at a time.
- Complete fresh-install file replacements only.
- Always read the current version of a file before modifying it.
- Preserve existing working functionality unless the current sprint explicitly requires a change.
- Deploy.
- Test.
- Verify.
- Lock.
- Move forward.
- Never break a working feature.
- Evidence before assumptions.
- Version 1 before Version 2.
- Do not introduce new features before the current sprint objective has been completed.

---

# Worker Philosophy

Workers have one responsibility.

Workers do not make architectural decisions.

Workers collect evidence.

Workers return structured information.

Workers never become the source of truth.

Current implementation uses a single Worker.

Future versions will consist of specialized workers coordinated by a Worker Orchestrator.

Planned workers include:

- Website Intelligence Worker
- Website SEO Worker
- Google Business Profile Worker
- Social Intelligence Worker
- Reviews & Reputation Worker
- AI Visibility Worker

Every worker must return standardized information that can be merged into the Business Record.

---

# Business Record Philosophy

The Business Record is the permanent consulting record.

Every future module depends on it.

The Business Record must remain standardized regardless of how many workers exist.

Every downstream feature—including Consulting Intelligence, Growth Reviews, Proposals, and Client Management—depends on the integrity of the Business Record.

---

# Consulting Philosophy

GCM OS does **not** replace professional consulting tools.

Instead, it identifies opportunities that should be investigated further.

Examples include:

- Semrush
- Ahrefs
- Google Search Console
- Google Analytics
- Google Business Profile
- Social platforms
- Client CMS platforms

**GCM OS answers:**

> What should we investigate next?

**Specialist tools answer:**

> How should we fix it?

Implementation occurs inside the client's platform.

---

# Current Development Workflow

1. Read project documents.
2. Understand the current sprint.
3. Recommend only the highest-value next file.
4. Complete one file.
5. Deploy.
6. Test.
7. Verify.
8. Lock.
9. Repeat.

---

# Expected AI Responsibilities

Act as the Lead Product Engineer for GCM OS.

Protect the architecture.

Protect completed work.

Preserve backwards compatibility whenever possible.

Recommend improvements only when supported by observable evidence.

Do not introduce unnecessary complexity.

Keep the product aligned with the Product Blueprint.

Do not skip steps simply because they appear obvious.

---

# Standard New Thread Prompt

Every future development thread should begin with:

> Read `docs/START_HERE.md` first.
>
> Then continue the current sprint.

Do not skip the startup sequence.

Follow all Engineering Rules.

Complete one file at a time.

---

# Long-Term Objective

Build the Consulting Operating System that powers every client relationship inside Global Concepts Media.

Every engineering decision should support that objective.

This document is considered foundational and should be updated only when the development process itself changes.
