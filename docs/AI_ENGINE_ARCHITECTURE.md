# AI ENGINE ARCHITECTURE

**Document Version:** 1.0

**Status:** LOCKED

**Last Updated:** 2026-07-13

---

# Purpose

This document defines how Artificial Intelligence is integrated into the Global Concepts Media Operating System (GCM OS).

AI does not replace the consulting methodology.

AI executes specific consulting responsibilities defined by the operating system.

Every AI engine has one clearly defined purpose.

Every AI engine follows the Evidence Before Assumptions principle.

---

# Core Principle

> **Evidence Before Assumptions**

Artificial Intelligence never invents facts.

Artificial Intelligence never speculates.

Artificial Intelligence never fills missing information.

Unknown information is returned as:

* Verification Required

or

* Insufficient Evidence

depending upon the evidence available.

---

# AI Philosophy

GCM OS is not an AI report generator.

GCM OS is a Consulting Operating System.

Artificial Intelligence assists the consulting methodology.

Consulting remains the product.

---

# AI Architecture

```
Request

↓

Worker

↓

Request Router

↓

AI Engine

↓

Prompt Package

↓

Structured JSON

↓

Evidence Package

↓

Verified Business Record

↓

Evidence Classification

↓

Consulting Intelligence

↓

Requested Deliverable
```

Every AI engine produces structured output.

No AI engine generates final client deliverables directly.

---

# AI Engine Principles

Every AI engine has one responsibility.

Every AI engine has one prompt.

Every AI engine has one output schema.

Every AI engine can be tested independently.

AI engines never perform multiple consulting responsibilities.

---

# Prompt Packages

Each AI engine is controlled by an independent Prompt Package.

Prompt Packages are production assets.

Prompt Packages are version controlled independently from Worker code.

Prompt Packages define consulting behavior.

Worker code defines execution.

---

# Prompt Package Structure

Every Prompt Package contains:

Purpose

Inputs

Required Evidence

Rules

Forbidden Assumptions

Expected Output

Validation Rules

Failure Behavior

Version

Status

---

# AI Engine Structure

Every AI engine consists of:

Engine

↓

Prompt Package

↓

Output Schema

↓

Validation

↓

Evidence Package

No engine bypasses validation.

---

# Current AI Engines

## Website Intelligence Engine

Purpose

Collect publicly observable business evidence.

Prompt

website-intelligence.json

Output

Website Evidence Package

Produces:

* Observable facts
* Services
* Contact information
* Trust signals
* Website observations

Never produces:

* Recommendations
* Growth Leaks
* Consulting advice

---

## Evidence Classification Engine

Purpose

Convert evidence into standardized classifications.

Prompt

evidence-classification.json

Produces:

* Confirmed Strength
* Confirmed Growth Leak
* Verification Required
* Insufficient Evidence

This engine never creates consulting recommendations.

---

## Prospect Qualification Engine

Purpose

Determine whether the business deserves consulting attention.

Prompt

prospect-qualification.json

Produces:

* Prospect Decision
* Opportunity Summary
* Engagement Summary
* Business Value Summary
* Recommended Next Action

This engine never predicts sales probability.

---

## Consultant Brief Engine

Purpose

Prepare the consultant for the first business conversation.

Prompt

consultant-brief.json

Produces:

* Conversation Objective
* Why This Business
* Why Now
* Verification Questions
* Opening Talking Points
* Discovery Preparation

This engine never diagnoses the business.

---

## Business Snapshot Engine

Purpose

Produce the public-facing Business Snapshot.

Prompt

business-snapshot.json

Produces:

* Confirmed Strengths
* Observable Opportunities
* Verification Required

The Business Snapshot never contains unverified Growth Leaks.

---

## Verified Business Growth Assessment Engine

Purpose

Transform verified evidence into consulting intelligence.

Prompt

verified-growth-assessment.json

Produces:

Verified Business Growth Assessment™

Only verified evidence may generate consulting recommendations.

---

# Prompt Rules

Every Prompt Package must follow the same consulting rules.

AI must never:

* Invent facts
* Assume missing information
* Predict client intent
* Predict budgets
* Predict willingness to buy
* Create unsupported recommendations

AI must always:

* Reference observable evidence
* Return Unknown when appropriate
* Distinguish facts from assumptions
* Preserve traceability

---

# Validation Rules

Every AI response must pass validation before entering the Verified Business Record.

Validation confirms:

Required fields exist.

Evidence source exists.

Confidence exists.

Classification exists.

No prohibited assumptions exist.

Invalid responses are rejected.

---

# Failure Behavior

If sufficient evidence cannot be collected:

Return:

Verification Required

or

Insufficient Evidence

The operating system never attempts to "guess."

---

# Worker Responsibility

The Worker is not the consulting engine.

The Worker is the orchestration layer.

Its responsibilities are limited to:

Receive requests.

Select the appropriate AI engine.

Execute the Prompt Package.

Validate output.

Store evidence.

Build the Verified Business Record.

Route the requested deliverable.

Business logic does not belong inside the Worker.

Consulting methodology belongs inside Prompt Packages.

---

# Prompt Repository

Prompt Packages are stored independently.

```
prompts/

website-intelligence.json

evidence-classification.json

prospect-qualification.json

consultant-brief.json

business-snapshot.json

verified-growth-assessment.json
```

Each Prompt Package is version controlled.

Each Prompt Package can evolve independently.

---

# Relationship to the Verified Business Record

AI engines do not communicate directly with client deliverables.

Every AI engine contributes evidence.

Evidence is validated.

Evidence becomes part of the Verified Business Record.

The Verified Business Record becomes the single source of truth.

All consulting intelligence is derived from the Verified Business Record.

---

# Architectural Principles

The following principles are locked.

* Evidence Before Assumptions
* One AI Engine = One Responsibility
* One AI Engine = One Prompt Package
* One Prompt Package = One Output Schema
* Worker orchestrates
* Prompt Packages implement consulting methodology
* Evidence precedes classification
* Classification precedes consulting
* Consulting precedes presentation
* Verified Business Record is the single source of truth
* Every recommendation must be traceable to verified evidence

---

# Status

**LOCKED**

This document defines how Artificial Intelligence is implemented throughout the Global Concepts Media Operating System.

All future AI engines, Prompt Packages, and consulting workflows must conform to this architecture.
