# GCM OS ARCHITECTURE

**Document Version:** 1.1

**Status:** Active

**Purpose**

This document defines the technical architecture of the Global Concepts Media Operating System (GCM OS).

It describes how the system is organized, how information flows through the platform, and the responsibilities of each major component.

Unlike the Product Blueprint, this document focuses on implementation architecture rather than product vision.

If this document conflicts with implementation, the architecture should be intentionally reviewed before changing either.

---

# System Overview

GCM OS is an AI-powered Consulting Operating System.

The platform transforms publicly observable business information into structured consulting intelligence.

The architecture follows a layered design to ensure every component has a single responsibility.

```
Public Business Information
            │
            ▼
Evidence Sources
            │
            ▼
Capability Engines
            │
            ▼
Business Record
            │
            ▼
Consulting Intelligence
            │
            ▼
Client Delivery
```

The architecture intentionally separates **where evidence comes from** from **how intelligence is organized**.

Evidence may come from many different public sources, but it is organized into standardized consulting capabilities before becoming part of the Business Record.

---

# Architectural Principles

The architecture follows these principles:

- Single Responsibility
- Standardized Data
- Business Record First
- Observable Evidence
- Capability-Based Intelligence
- Modular Evidence Collection
- Backwards Compatibility
- Evidence Before Assumptions

Every component must have one clearly defined responsibility.

---

# Layer 1 — Evidence Sources

## Purpose

Collect publicly observable business information.

Evidence Sources never make consulting decisions.

Evidence Sources never become the system of record.

Their responsibility is only to collect observable evidence.

Current evidence source:

- Business Website

Future evidence sources include:

- Florida Business Registry
- Google Business Profile
- Review Platforms
- Social Platforms
- Public Search Results
- SEO Sources
- AI Visibility Sources

Evidence should always remain traceable to its source.

---

# Layer 2 — Capability Engines

## Purpose

Capability Engines organize evidence into consulting capabilities.

This layer separates **what the system knows** from **where the information was found**.

Multiple evidence sources may contribute to a single capability.

Example:

```
Business Website
Florida Registry
LinkedIn
Google Business Profile
        │
        ▼
Contact Enrichment
```

Capabilities remain stable even when evidence sources evolve.

This allows GCM OS to expand without redesigning the Business Record every time a new public information source is introduced.

Current capabilities are documented in:

**docs/CAPABILITIES.md**

Current capabilities include:

- Website Intelligence
- Contact Enrichment (planned)
- Reputation Intelligence (planned)
- SEO Intelligence (planned)
- Social Intelligence (planned)
- Advertising Intelligence (planned)
- Competitive Intelligence (planned)

Capability Engines normalize evidence before it reaches the Business Record.

---

# Layer 3 — Business Record

## Purpose

Normalize and standardize information from every capability.

The Business Record is the only permanent consulting record.

It is the single source of truth.

Every downstream module depends on the Business Record.

Capabilities never overwrite each other.

Instead, they contribute standardized evidence that is merged into the Business Record.

---

# Business Record Builder

The Business Record Builder is responsible for:

- validating capability output
- merging evidence
- resolving conflicts
- maintaining schema consistency
- preserving historical compatibility
- producing the final Business Record

Only the Business Record Builder may update the Business Record.

---

# Business Record Schema

Current major sections include:

- Business
- Website Intelligence
- Sales Intelligence
- Consulting Intelligence

Future schema additions include:

- Contact Enrichment
- Reputation Intelligence
- SEO Intelligence
- Social Intelligence
- Advertising Intelligence
- Competitive Intelligence
- Historical Measurements
- Client History

The schema should remain backwards compatible whenever possible.

---

# Layer 4 — Consulting Intelligence

## Purpose

Transform observable evidence into consulting recommendations.

Consulting Intelligence never invents information.

Every recommendation must be supported by observable evidence contained within the Business Record.

Current responsibilities include:

- Executive Summary
- Opportunity Identification
- Recommended GCM Services
- Success Metrics
- Outreach Recommendations
- Consulting Confidence

Future responsibilities include:

- Rule-Based Opportunity Prioritization
- Opportunity Scoring
- Discovery Question Generation
- Measurement Framework
- Opportunity Roadmaps
- Recommendation Engine

Consulting Intelligence should always answer five questions:

1. What did we observe?
2. Why does it matter?
3. What should GCM recommend?
4. Which GCM service addresses the opportunity?
5. How will success be measured?

---

# Layer 5 — Client Delivery

## Purpose

Transform Consulting Intelligence into client-facing deliverables.

Future modules include:

- Growth Review
- Proposal Engine
- Implementation Plans
- Monthly Reviews
- Client Dashboard
- Historical Progress Tracking

Client Delivery never bypasses the Business Record.

---

# Dashboard

The dashboard is a presentation layer.

Its responsibilities include:

- Accept a business website URL.
- Display Business Record information.
- Display Consulting Intelligence.
- Present consulting information in an organized workflow.
- Prepare consultants for productive client conversations.

The dashboard is never the source of truth.

The dashboard does not own business information.

It simply presents standardized intelligence produced by the Business Record.

---

# Evidence Orchestrator (Future)

Future versions of GCM OS will introduce an Evidence Orchestrator.

Responsibilities include:

- Execute evidence collectors.
- Coordinate evidence collection.
- Manage failures.
- Route evidence into Capability Engines.
- Submit standardized capability output to the Business Record Builder.
- Preserve evidence traceability.

Evidence collectors remain independent.

Capability Engines remain independent.

The Business Record remains the single source of truth.

---

# Evidence Flow

Future execution flow:

```

Business Website

Florida Business Registry

Google Business Profile

Review Platforms

Social Platforms

Public Search

SEO Sources

AI Visibility Sources

↓

Evidence Sources

↓

Capability Engines

↓

Business Record Builder

↓

Business Record

↓

Consulting Intelligence

↓

Dashboard

↓

Growth Review

↓

Proposal

```

Every new evidence source should enrich an existing capability before introducing a new capability.

---

# Data Flow

The platform always follows this sequence:

Evidence Sources

↓

Capability Engines

↓

Business Record

↓

Consulting Intelligence

↓

Client Delivery

Information should never skip layers.

Evidence should always remain traceable.

---

# Error Handling Philosophy

Evidence collectors may fail independently.

Failures should never corrupt the Business Record.

When evidence is unavailable:

- Record Unknown.
- Preserve existing evidence.
- Continue processing when appropriate.
- Report confidence appropriately.
- Preserve source traceability whenever possible.

Missing evidence should never become invented evidence.

---

# Backwards Compatibility

Whenever possible:

- Preserve existing Business Record schema.
- Preserve dashboard compatibility.
- Preserve capability interfaces.
- Preserve evidence traceability.

Breaking changes should be intentional, documented, and versioned.

---

# Future Expansion

The architecture has been intentionally designed for modular growth.

Future modules may include:

- CRM Integration
- Calendar Integration
- Email Automation
- Proposal Generation
- Client Portal
- Monthly Monitoring
- Historical Analytics
- AI Agent Collaboration

These modules should integrate through the Business Record rather than directly through evidence collectors.

The Business Record remains the permanent consulting record.

---

# Architecture Rules

The architecture of GCM OS follows these permanent rules:

## Responsibility

- Every component has one clearly defined responsibility.
- Every layer exists for a specific purpose.
- Responsibilities should not overlap.

---

## Evidence

- Evidence must always be publicly observable.
- Unknown information must remain Unknown.
- Evidence should always remain traceable to its source.
- Evidence collectors never make consulting recommendations.

---

## Capability Engines

- Capability Engines organize intelligence, not evidence sources.
- Multiple evidence sources may contribute to one capability.
- New evidence sources should strengthen existing capabilities before creating new ones.
- Capability definitions are maintained in **docs/CAPABILITIES.md**.

---

## Business Record

- The Business Record is the single source of truth.
- Only the Business Record Builder may modify the Business Record.
- Capabilities contribute standardized information.
- Capabilities never overwrite one another directly.
- The Business Record must remain backwards compatible whenever possible.

---

## Consulting Intelligence

- Consulting Intelligence interprets evidence.
- Recommendations must always be supported by observable evidence.
- Recommendations should produce measurable business value.
- Consulting Intelligence should assist consultants rather than replace consultant judgment.

---

## Client Delivery

- Client-facing reports originate from the Business Record.
- Client Delivery never bypasses the Business Record.
- Dashboard, Growth Reviews, Proposals, and future deliverables all consume standardized Business Record data.

---

## Evolution

The architecture is designed to evolve without redesign.

New functionality should generally follow this order:

1. New Evidence Source
2. Existing Capability Enhancement
3. Business Record Update
4. Consulting Intelligence Enhancement
5. Client Delivery Improvement

Architecture should evolve through intentional revisions rather than unnecessary redesigns.

---

# Relationship to Other Documents

The architecture works together with the other core project documents.

**START_HERE.md**

Defines the required startup procedure for every new development session.

**GCM_OS_PRODUCT_BLUEPRINT.md**

Defines the long-term product vision and consulting philosophy.

**CAPABILITIES.md**

Defines the consulting capabilities and the evidence each capability is responsible for organizing.

**PROJECT_STATUS.md**

Defines the current sprint, implementation status, locked milestones, and immediate development priorities.

**DECISIONS.md**

Maintains the permanent architectural and product decisions that guide future development.

Together these documents form the governance system for GCM OS.

---

# Long-Term Objective

Build a modular Consulting Operating System that continuously transforms publicly observable evidence into structured consulting intelligence.

Every capability should enrich the Business Record.

Every recommendation should be evidence-based.

Every report should help a consultant become significantly more prepared for a first client conversation.

The architecture is intentionally designed so that new evidence sources, new capabilities, and future AI technologies can be incorporated without redesigning the core operating system.

The Business Record remains the permanent consulting record and the foundation upon which every future feature of GCM OS will be built.
