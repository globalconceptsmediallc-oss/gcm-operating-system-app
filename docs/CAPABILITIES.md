# GCM OS CAPABILITIES

**Document Version:** 1.0  
**Status:** Active  
**Purpose:** Define the core intelligence capabilities of GCM OS.

---

# Purpose

GCM OS is organized around consulting capabilities, not individual data sources.

A capability represents a category of intelligence that helps Global Concepts Media understand a business before making recommendations.

Evidence may come from multiple public sources, but all evidence must eventually support the Business Record.

---

# Core Principle

External intelligence is organized by capability, not by source.

Examples:

- Contact Enrichment is a capability.
- Sunbiz is a possible source.
- Google Business Profile is a possible source.
- LinkedIn is a possible source.

Sources may change over time.

Capabilities should remain stable.

---

# Current Capability Map

## 1. Website Intelligence

**Status:** Active

**Purpose:** Understand what can be observed from the business website.

**Evidence Includes:**

- Business name
- Website URL
- Industry
- Products and services
- Target customer
- Geographic market
- Trust signals
- Website observations
- Growth opportunities
- Missing information

**Current Source:**

- Business website

---

## 2. Contact Enrichment

**Status:** Planned

**Purpose:** Identify publicly observable contact information that can improve first outreach.

**Evidence Includes:**

- Primary contact name
- Primary contact role
- Primary email
- Primary phone
- Contact page
- Additional contacts
- Source of each contact clue
- Confidence level

**Possible Sources:**

- Business website
- Contact page
- About page
- Team page
- Florida Sunbiz
- Google Business Profile
- LinkedIn
- Facebook

**Version 1 Schema:**

```json
{
  "contactEnrichment": {
    "primaryContactName": "Unknown",
    "primaryContactRole": "Unknown",
    "primaryEmail": "Unknown",
    "primaryPhone": "Unknown",
    "contactPage": "Unknown",
    "additionalContacts": [],
    "sources": [],
    "confidence": "Low"
  }
}
