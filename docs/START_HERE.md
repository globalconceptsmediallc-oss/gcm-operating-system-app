# GCM OS DEVELOPMENT START HERE

**Document Version:** 1.0

**Status:** Locked

**Purpose:**
This document is the required starting point for every new development session of the Global Concepts Media Operating System (GCM OS).

Its purpose is to ensure every engineering session begins with the same understanding of the product, architecture, current sprint, and engineering standards.

If this document conflicts with previous conversations or AI memory, this document takes precedence.

---

# Project

Global Concepts Media Operating System (GCM OS)

---

# Product Mission

GCM OS is an AI-powered Consulting Operating System.

Its purpose is to transform publicly observable business information into consulting intelligence that helps Global Concepts Media:

• Understand businesses before making recommendations.

• Identify measurable opportunities.

• Support better consulting conversations.

• Produce Growth Reviews.

• Generate evidence-based proposals.

• Measure business improvement over time.

The objective is NOT to replace consulting.

The objective is to make consultants significantly more prepared before every client conversation.

---

# Development Startup Sequence

Before making recommendations or writing code, always read these documents in the following order:

1. docs/START_HERE.md

2. docs/GCM_OS_PRODUCT_BLUEPRINT.md

3. docs/PROJECT_STATUS.md

4. docs/ARCHITECTURE.md (when available)

5. docs/DECISIONS.md (when available)

These documents define the current state of the product.

If previous conversations conflict with these documents, the documents are the source of truth.

---

# Current Product Philosophy

The Business Record is the single source of truth.

Every worker contributes observable evidence.

Only the Business Record Builder may create or update the Business Record.

Consulting Intelligence is generated from the Business Record.

The dashboard displays Consulting Intelligence.

Growth Reviews are generated from Consulting Intelligence.

Proposals are generated from Growth Reviews.

Everything supports the consulting lifecycle.

---

# The GCM Consulting Method

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

Every feature inside GCM OS must support one or more stages of this process.

---

# Engineering Rules

One file at a time.

Complete fresh-install file replacements only.

Deploy.

Test.

Verify.

Lock.

Move forward.

Never break a working feature.

Evidence before assumptions.

Version 1 before Version 2.

Do not introduce new features before the current sprint objective has been completed.

---

# Worker Philosophy

Workers have one responsibility.

Workers do not make architectural decisions.

Workers collect evidence.

Workers return structured information.

Workers never become the source of truth.

---

# Business Record Philosophy

The Business Record is the permanent consulting record.

Every future module depends on it.

The Business Record must remain standardized regardless of how many workers exist.

---

# Consulting Philosophy

GCM OS does not replace professional consulting tools.

Instead it identifies opportunities that should be investigated further.

Examples include:

• Semrush

• Ahrefs

• Google Search Console

• Google Analytics

• Google Business Profile

• Social platforms

• Client CMS platforms

GCM OS answers:

"What should we investigate next?"

Specialist tools answer:

"How should we fix it?"

Implementation occurs inside the client's platform.

---

# Current Development Workflow

Read project documents.

Understand the current sprint.

Recommend only the highest-value next file.

Complete one file.

Deploy.

Test.

Verify.

Lock.

Repeat.

---

# Expected AI Responsibilities

Act as the Lead Product Engineer for GCM OS.

Protect the architecture.

Protect completed work.

Preserve backwards compatibility whenever possible.

Recommend improvements only when supported by evidence.

Do not introduce unnecessary complexity.

Keep the product aligned with the Product Blueprint.

---

# Standard New Thread Prompt

Every future development thread should begin with:

Read docs/START_HERE.md first.

Then continue the current sprint.

Do not skip the startup sequence.

Follow all Engineering Rules.

Complete one file at a time.

---

# Long-Term Objective

Build the Consulting Operating System that powers every client relationship inside Global Concepts Media.

Every engineering decision should support that objective.

This document is considered foundational and should be updated only when the development process itself changes.
