# GCM OS ARCHITECTURE

**Document Version:** 1.3

**Status:** Active

**Last Updated:** 2026-07-07

------------------------------------------------------------------------

# Purpose

This document defines the production architecture of the Global Concepts Media Operating System (GCM OS).

It describes how observable evidence is collected, organized into consulting capabilities, merged into the Business Record, transformed into consulting intelligence, and ultimately delivered through the client-facing **90-Day Growth Review**.

The Business Record remains the single source of truth.

------------------------------------------------------------------------

# Core Architecture

```
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

- Single Responsibility
- Business Record First
- Capability-Based Architecture
- Observable Evidence
- Evidence Before Assumptions
- Backwards Compatibility
- Modular Growth
- One Capability = One Consulting Question
- Every Capability Improves the Growth Review

------------------------------------------------------------------------

# Consulting Question Principle

Every capability exists to answer exactly one consulting question.

| Capability | Consulting Question |
|------------|---------------------|
| Website Intelligence | What does this business communicate about itself? |
| Contact Enrichment | Who should the consultant contact and how? |
| Public Presence Intelligence | Where does this business have an official public presence? |
| Google Presence Intelligence | What does a prospective customer see when they search for this business on Google? |
| Social Activity Intelligence | How effectively is this business using its social media platforms? |
| Reputation Intelligence | What are customers saying publicly about this business? |
| Business Value Intelligence | How can consulting opportunities be translated into understandable business value? |

Future capabilities begin by defining the consulting question before implementation.

------------------------------------------------------------------------

# Layer 1 — Evidence Sources

## Purpose

Collect publicly observable information.

### Current Production Sources

- Business Website

### Planned Evidence Sources

- Google Business Profile
- Public Search Results
- Florida Business Registry
- Review Platforms
- Social Platforms
- SEO Data Sources
- AI Visibility Sources

Evidence sources collect facts.

They never make consulting recommendations.

------------------------------------------------------------------------

# Layer 2 — Capability Engines

## Purpose

Transform observable evidence into standardized consulting capabilities.

### Current Production Capabilities

- Website Intelligence ✅
- Contact Enrichment ✅
- Public Presence Intelligence ✅

### Planned Capabilities

- Google Presence Intelligence
- Social Activity Intelligence
- Reputation Intelligence
- SEO Intelligence
- AI Visibility Intelligence
- Business Value Intelligence

Capabilities are independent modules.

Each capability:

- receives evidence
- normalizes evidence
- produces standardized output
- contributes to the Business Record
- never overwrites another capability

------------------------------------------------------------------------

# Layer 3 — Business Record

The Business Record is the permanent consulting record.

It is the only source consumed by downstream systems.

### Current Sections

- Business
- Website Intelligence
- Contact Enrichment
- Public Presence
- Consulting Intelligence

### Planned Sections

- Google Presence
- Social Activity
- Reputation
- SEO
- AI Visibility
- Business Value

Only the Business Record Builder may modify the Business Record.

------------------------------------------------------------------------

# Layer 4 — Consulting Intelligence

Consulting Intelligence transforms standardized Business Record information into consulting recommendations.

Every recommendation should:

- reference observable evidence
- explain why it matters
- recommend measurable improvement
- estimate business value where practical
- support better consulting conversations

------------------------------------------------------------------------

# Layer 5 — Dashboard

The Dashboard presents Business Record information.

It never owns data.

It never bypasses the Business Record.

Current Production

Dashboard Version: **5.5.0**

------------------------------------------------------------------------

# Layer 6 — 90-Day Growth Review

The 90-Day Growth Review is the primary client-facing deliverable.

It converts consulting intelligence into an evidence-based growth plan.

Future sections include:

- Executive Summary
- Business Snapshot
- Digital Presence Scorecard
- Website Intelligence
- Contact Intelligence
- Google Presence
- Social Activity
- Reputation
- Growth Opportunities
- Business Value Analysis
- Investment Justification
- 90-Day Growth Blueprint
- Implementation Options

------------------------------------------------------------------------

# Current Production Flow

```
Business Website
        ↓
Website Intelligence
        ↓
Contact Enrichment
        ↓
Public Presence
        ↓
Business Record
        ↓
Consulting Intelligence
        ↓
Dashboard
```

------------------------------------------------------------------------

# Next Architectural Expansion

Google Presence Intelligence

Purpose:

Understand how the business appears to prospective customers in Google Search and Google Business Profile.

This capability will expand the Business Record while preserving backward compatibility.

------------------------------------------------------------------------

# Architecture Rules

- Every capability answers one consulting question.
- Every capability contributes observable evidence.
- Every capability improves the Growth Review.
- Evidence remains traceable.
- Unknown information remains Unknown.
- New evidence sources strengthen existing capabilities before creating new capabilities.
- Client-facing outputs consume only the Business Record.

------------------------------------------------------------------------

# Relationship to Core Documents

- START_HERE.md — Startup procedure
- GCM_OS_PRODUCT_BLUEPRINT.md — Product vision
- PROJECT_STATUS.md — Current production status
- CAPABILITIES.md — Capability definitions
- DECISIONS.md — Permanent engineering decisions

------------------------------------------------------------------------

# Long-Term Objective

Build a modular Consulting Operating System that transforms observable evidence into actionable consulting intelligence, produces an evidence-based 90-Day Growth Review, and supports every stage of the Global Concepts Media consulting lifecycle.
