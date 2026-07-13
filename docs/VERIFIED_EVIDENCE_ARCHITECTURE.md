# VERIFIED EVIDENCE ARCHITECTURE

**Document Version:** 1.0

**Status:** LOCKED

**Last Updated:** 2026-07-12

---

# Purpose

This document defines how evidence is collected, verified, classified, and used throughout the Global Concepts Media Operating System (GCM OS).

The purpose of this architecture is to ensure that every consulting recommendation is supported by observable evidence rather than assumptions.

This architecture extends the Business Record by introducing a Verified Business Record that becomes the single source of truth for all consulting intelligence.

---

# Core Principle

## Evidence Before Assumptions

GCM OS shall never present assumptions as verified facts.

Every recommendation must be traceable to one or more verified evidence sources or clearly identified as requiring verification.

Unknown information is never treated as evidence.

Missing information is never automatically classified as a Growth Leak.

---

# Evidence Hierarchy

## Tier 1 — Public Evidence

Collected without client permission.

Examples

- Business Website
- SEMrush
- Ahrefs
- Google Business Profile
- Google PageSpeed Insights
- Public Social Media
- Reviews
- Public Business Records
- Local Listings
- Public Trust Signals

Status

Verified

---

## Tier 2 — Client Evidence

Provided directly by the client.

Examples

- Average Project Value
- Monthly Leads
- Close Rate
- Staff Size
- Capacity
- Marketing Budget
- Business Goals
- Internal Processes
- Customer Lifetime Value

Status

Client Verified

---

## Tier 3 — Connected Evidence

Requires account access.

Examples

- Google Analytics
- Google Search Console
- Google Ads
- Meta Ads
- CRM
- Call Tracking
- Marketing Automation
- Internal Dashboards

Status

Connected Verified

---

# Evidence Packages

Every intelligence engine produces a standardized Evidence Package.

Example

Website Intelligence

↓

Evidence Package

{
    source
    status
    collectedAt
    findings
    metrics
    confidence
}

Every engine follows the same structure.

Examples

- Website Intelligence
- SEMrush Intelligence
- Google Business Profile Intelligence
- PageSpeed Intelligence
- Public Presence Intelligence
- Client Verification
- Connected Accounts

---

# Verified Business Record

The Verified Business Record becomes the single source of truth.

Architecture

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

Growth Review

No consulting engine should read directly from raw evidence.

Every consulting decision must originate from the Verified Business Record.

---

# Evidence Classification

Every observation must be classified before recommendations are created.

Allowed classifications

• Confirmed Strength

• Confirmed Growth Leak

• Verification Required

• Insufficient Evidence

No additional classifications are permitted.

---

# Growth Intelligence Rules

Growth Intelligence may only create Growth Leaks from:

✓ Confirmed Growth Leaks

Growth Intelligence may never create Growth Leaks from:

✗ Missing Information

✗ Unknown Values

✗ Incomplete Data

✗ Assumptions

---

# Verification Required

Verification Required identifies information that cannot be confirmed using public evidence.

Verification Required is not a consulting recommendation.

Verification Required identifies additional evidence needed before conclusions can be made.

Examples

- Search Console Performance
- Google Analytics
- Conversion Rate
- Cost Per Lead
- Monthly Revenue
- Close Rate

---

# Consulting Knowledge Rules

Consulting Knowledge creates recommendations only for:

Confirmed Growth Leaks

Verification Required items receive:

Verification Tasks

not implementation recommendations.

---

# Business Snapshot Rules

The free Business Snapshot may include

✓ Confirmed Strengths

✓ Observable Opportunities

✓ Verification Required

The Snapshot may not claim

- revenue loss
- conversion problems
- SEO problems
- trust problems
- growth limitations

unless supported by verified evidence.

---

# Verified Business Growth Assessment™

The paid consulting product begins with evidence verification.

Evidence sources may include

- Website Intelligence
- SEMrush
- Google Business Profile
- PageSpeed
- Public Presence
- Client Questionnaire

The completed Verified Business Record becomes the foundation for the final deliverable.

---

# 90-Day Growth Review™

The Growth Review is generated exclusively from the Verified Business Record.

Every recommendation must include

• Evidence Source

• Evidence Classification

• Business Impact

• Success Metric

• Verification Status

---

# Engine Architecture

Website Intelligence

↓

Business Classification

↓

SEMrush Intelligence

↓

Google Business Profile Intelligence

↓

PageSpeed Intelligence

↓

Public Presence Intelligence

↓

Client Verification

↓

Verified Business Record

↓

Evidence Classification

↓

Growth Intelligence

↓

Consulting Knowledge

↓

90-Day Growth Review Generator

↓

Presentation Engine

↓

Browser / PDF Output

---

# Architectural Principles

• Evidence Before Assumptions

• Single Source of Truth

• One Engine = One Responsibility

• Evidence is Collected Before Intelligence

• Intelligence is Created Before Recommendations

• Recommendations Require Evidence

• Unknown Information Is Never Treated As Failure

• Every Recommendation Must Be Traceable

• Every Recommendation Must Produce a Measurable Business Outcome

---

# Product Positioning

Product Purchased

Verified Business Growth Assessment™

Deliverable Produced

90-Day Growth Review™

The assessment gathers and verifies evidence.

The Growth Review transforms verified evidence into prioritized consulting recommendations and a measurable 90-day roadmap.

---

# Status

LOCKED

Future engines shall conform to this architecture.

Any modification requires an architecture decision.
