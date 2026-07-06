# GCM OS ARCHITECTURE

**Document Version:** 1.2

**Status:** Active

**Last Updated:** 2026-07-06

------------------------------------------------------------------------

# Purpose

This document defines the production architecture of the Global Concepts
Media Operating System (GCM OS).

It describes how evidence is collected, organized into consulting
capabilities, merged into the Business Record, and transformed into
consulting intelligence.

The Business Record is the single source of truth for the platform.

------------------------------------------------------------------------

# Core Architecture

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
    Future Client Deliverables

Every layer has a single responsibility.

------------------------------------------------------------------------

# Architectural Principles

-   Single Responsibility
-   Business Record First
-   Capability-Based Architecture
-   Observable Evidence
-   Evidence Before Assumptions
-   Backwards Compatibility
-   Modular Growth
-   One Capability = One Consulting Question

------------------------------------------------------------------------

# Consulting Question Principle

Every capability exists to answer exactly one consulting question.

  -----------------------------------------------------------------------
  Capability                Consulting Question
  ------------------------- ---------------------------------------------
  Website Intelligence      What does this business communicate about
                            itself?

  Contact Enrichment        Who can we contact and how?

  Public Presence           Where does this business have an official
  Intelligence              public presence?
  -----------------------------------------------------------------------

Future capabilities should begin by defining the consulting question
before implementation.

------------------------------------------------------------------------

# Layer 1 --- Evidence Sources

Purpose:

Collect publicly observable information.

Current production source:

-   Business Website

Future evidence sources:

-   Florida Business Registry
-   Google Business Profile
-   Review Platforms
-   Public Search
-   Social Platforms
-   SEO Sources
-   AI Visibility Sources

Evidence sources never make consulting recommendations.

------------------------------------------------------------------------

# Layer 2 --- Capability Engines

Purpose:

Transform observable evidence into standardized consulting capabilities.

Current capabilities:

-   Website Intelligence (Complete)
-   Contact Enrichment (Complete)
-   Public Presence Intelligence (Current Sprint)

Planned capabilities:

-   Reputation Intelligence
-   SEO Intelligence
-   Advertising Intelligence
-   Competitive Intelligence
-   AI Visibility Intelligence

Capabilities are independent modules.

They:

-   receive evidence
-   normalize evidence
-   produce standardized output
-   contribute to the Business Record
-   never overwrite other capabilities

------------------------------------------------------------------------

# Layer 3 --- Business Record

The Business Record is the permanent consulting record.

It is the only source consumed by downstream systems.

Current sections include:

-   Business
-   Website Intelligence
-   Contact Enrichment
-   Consulting Intelligence

Planned additions include:

-   Public Presence
-   Reputation
-   SEO
-   Advertising
-   Competitive Intelligence

Only the Business Record Builder may modify the Business Record.

------------------------------------------------------------------------

# Layer 4 --- Consulting Intelligence

Consulting Intelligence converts evidence into consulting
recommendations.

Every recommendation must:

-   reference observable evidence
-   explain why it matters
-   recommend measurable improvement
-   support consulting conversations

------------------------------------------------------------------------

# Layer 5 --- Dashboard

The Dashboard presents standardized Business Record information.

It never owns data.

It never bypasses the Business Record.

Dashboard Version: 5.4.1

------------------------------------------------------------------------

# Current Evidence Flow

Business Website

↓

Website Intelligence

↓

Contact Enrichment

↓

Business Record

↓

Consulting Intelligence

↓

Dashboard

------------------------------------------------------------------------

# Current Sprint

Public Presence Intelligence extends the architecture by adding a new
capability that identifies official public profile links from the
business website.

Version 1 will:

-   detect official Facebook links
-   detect LinkedIn links
-   detect Instagram links
-   detect YouTube links
-   detect X (Twitter) links
-   record evidence
-   record confidence
-   preserve backwards compatibility

No external platform scraping occurs during Version 1.

------------------------------------------------------------------------

# Architecture Rules

-   Every capability answers one consulting question.
-   Every capability contributes evidence to the Business Record.
-   Evidence remains traceable.
-   Unknown information remains Unknown.
-   New evidence sources strengthen existing capabilities before
    creating new ones.
-   Client-facing outputs consume only the Business Record.

------------------------------------------------------------------------

# Relationship to Core Documents

-   START_HERE.md --- startup procedure
-   PRODUCT_BLUEPRINT.md --- product vision
-   PROJECT_STATUS.md --- production status
-   CAPABILITIES.md --- capability definitions
-   DECISIONS.md --- permanent engineering decisions

------------------------------------------------------------------------

# Long-Term Objective

Build a modular Consulting Operating System that continuously transforms
publicly observable evidence into actionable consulting intelligence
while preserving a single, standardized Business Record.
