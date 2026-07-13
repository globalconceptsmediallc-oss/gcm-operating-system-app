# GCM OS ARCHITECTURE

**Document Version:** 2.0

**Status:** LOCKED

**Last Updated:** 2026-07-12

------------------------------------------------------------------------

# Purpose

This document defines the production architecture of the Global Concepts Media Operating System (GCM OS).

It describes how evidence is collected, verified, organized into consulting capabilities, transformed into a Verified Business Record, converted into consulting intelligence, and ultimately delivered through the client-facing **90-Day Growth Review™**.

The **Verified Business Record** is the single source of truth for all consulting intelligence.

Detailed evidence collection and verification rules are defined in:

**docs/VERIFIED_EVIDENCE_ARCHITECTURE.md**

------------------------------------------------------------------------

# Core Architecture

```
Public Evidence
Client Evidence
Connected Evidence
        ↓
Evidence Collection Engines
        ↓
Evidence Packages
        ↓
Verified Business Record
        ↓
Evidence Classification
        ↓
Growth Intelligence
        ↓
Consulting Knowledge
        ↓
90-Day Growth Review
        ↓
Implementation Options
        ↓
Measurement
        ↓
Continuous Improvement
```

Every layer has one clearly defined responsibility.

------------------------------------------------------------------------

# Architectural Principles

- Evidence Before Assumptions
- Verified Business Record First
- Single Responsibility
- Capability-Based Architecture
- Observable Evidence
- Traceable Recommendations
- Modular Growth
- One Capability = One Consulting Question
- Every Recommendation Requires Evidence
- Unknown Information Never Equals Failure

------------------------------------------------------------------------

# Consulting Question Principle

Every capability exists to answer exactly one consulting question.

| Capability | Consulting Question |
|------------|---------------------|
| Website Intelligence | What does the business communicate publicly? |
| SEMrush Intelligence | How visible is the business in search? |
| Google Business Profile Intelligence | How does the business appear in Google Maps and local search? |
| PageSpeed Intelligence | How well does the website perform technically? |
| Contact Enrichment | Who should be contacted and how? |
| Public Presence Intelligence | Where does the business maintain an official presence? |
| Business Value Intelligence | What measurable business impact could improvements create? |

Future capabilities begin by defining the consulting question before implementation.

------------------------------------------------------------------------

# Layer 1 — Evidence Collection

Purpose

Collect verified evidence.

Evidence may originate from:

## Public Evidence

- Business Website
- SEMrush
- Ahrefs
- Google Business Profile
- Google PageSpeed
- Public Social Platforms
- Reviews
- Local Listings
- Public Business Records

## Client Evidence

- Business Questionnaire
- Business Metrics
- Goals
- Capacity
- Revenue Inputs

## Connected Evidence

- Google Analytics
- Search Console
- Google Ads
- Meta Ads
- CRM
- Call Tracking

Evidence Collection never creates consulting recommendations.

------------------------------------------------------------------------

# Layer 2 — Evidence Collection Engines

Purpose

Transform evidence into standardized Evidence Packages.

Each engine

- collects evidence
- validates evidence
- normalizes evidence
- records confidence
- records source
- never creates recommendations

------------------------------------------------------------------------

# Layer 3 — Verified Business Record

The Verified Business Record is the permanent consulting record.

It combines every verified Evidence Package into one standardized structure.

Every downstream engine consumes only the Verified Business Record.

------------------------------------------------------------------------

# Layer 4 — Evidence Classification

Purpose

Determine whether each observation represents

- Confirmed Strength
- Confirmed Growth Leak
- Verification Required
- Insufficient Evidence

Only Confirmed Growth Leaks become consulting priorities.

------------------------------------------------------------------------

# Layer 5 — Growth Intelligence

Growth Intelligence prioritizes verified business constraints.

It never treats

- missing information
- assumptions
- unknown values

as Growth Leaks.

------------------------------------------------------------------------

# Layer 6 — Consulting Knowledge

Consulting Knowledge transforms verified Growth Intelligence into

- recommendations
- implementation priorities
- business impact
- measurable success metrics

------------------------------------------------------------------------

# Layer 7 — 90-Day Growth Review™

The Growth Review is the primary client deliverable.

Every recommendation must include

- Evidence Source
- Evidence Classification
- Business Impact
- Success Metric
- Verification Status

------------------------------------------------------------------------

# Architecture Rules

- Evidence is collected before intelligence.
- Intelligence is created before recommendations.
- Recommendations require evidence.
- Unknown information remains unknown.
- Evidence remains traceable.
- Every capability answers one consulting question.
- Every capability strengthens the Verified Business Record.
- Client-facing outputs consume only the Verified Business Record.

------------------------------------------------------------------------

# Relationship to Core Documents

- START_HERE.md
- GCM_OS_PRODUCT_BLUEPRINT.md
- PROJECT_STATUS.md
- CAPABILITIES.md
- DECISIONS.md
- VERIFIED_EVIDENCE_ARCHITECTURE.md

------------------------------------------------------------------------

# Long-Term Objective

Build a modular Consulting Operating System that transforms verified evidence into trusted consulting intelligence, produces an evidence-based 90-Day Growth Review™, and supports every stage of the Global Concepts Media consulting lifecycle.
