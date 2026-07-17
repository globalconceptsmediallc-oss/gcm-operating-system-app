# GCM OS WORKFLOW ARCHITECTURE

**Document Version:** 1.0

**Status:** Locked

**Last Updated:** 2026-07-17

---

# Purpose

This document defines how work flows through the Global Concepts Media Operating System (GCM OS).

While the Product Blueprint defines **what the product is** and the Data Model defines **what records exist**, this document defines **how the agency operates** and how every component of GCM OS supports that operation.

The workflow documented here becomes the operational blueprint for future development.

---

# Core Principle

## The Agency Workflow Principle

> **GCM OS mirrors the operational workflow of Global Concepts Media.**

The software is not intended to redefine how the agency works.

Instead, every engine, page, report, prompt, automation, and AI capability exists to support a real operational step performed by the agency.

When evaluating new features, the primary question is:

> **Which part of the agency workflow does this improve?**

If no answer exists, the feature does not belong in GCM OS.

---

# System Lifecycle

Every business progresses through the same lifecycle.

```
Prospect
        ↓
Business Intelligence
        ↓
Verified Business Record
        ↓
Business Snapshot
        ↓
90-Day Growth Review
        ↓
Proposal
        ↓
Client
        ↓
Continuous Improvement
```

Every stage builds upon verified information collected during the previous stage.

No stage should require recreating information already known.

---

# Daily Operational Workflow

This represents the daily operation of Global Concepts Media.

```
Mission Control
        ↓
Determine Priorities
        ↓
Prospecting
        ↓
Client Work
        ↓
Evidence Collection
        ↓
Outcome Verification
        ↓
Client Communication
        ↓
Business Development
        ↓
End of Day
```

Mission Control becomes the operational starting point every day.

---

# Prospecting Workflow

Prospecting is the process of discovering businesses, evaluating growth opportunities, and preparing for first outreach.

```
Prospect
        ↓
Website Intelligence
        ↓
HTML Intelligence
        ↓
Code Intelligence
        ↓
Contact Intelligence
        ↓
Public Presence Intelligence
        ↓
Verified Business Record
        ↓
Consulting Intelligence
        ↓
Business Snapshot
        ↓
Sales Conversation
```

The objective is not simply to generate a report.

The objective is to prepare the consultant for a productive first conversation.

---

# Discovery Workflow

Once a prospect expresses interest, additional information is collected.

```
Verified Business Record
        ↓
Business Snapshot
        ↓
Additional Verification
        ↓
Growth Review
        ↓
Business Discussion
```

The Growth Review expands upon the Snapshot using verified business information.

---

# Proposal Workflow

```
Growth Review
        ↓
Recommendations
        ↓
Approved Recommendations
        ↓
Program Creation
```

Only approved recommendations become Programs.

---

# Client Delivery Workflow

After onboarding, work is organized into structured operational records.

```
Program
        ↓
Objectives
        ↓
Initiatives
        ↓
Activities
        ↓
Evidence
        ↓
Outcomes
```

This operational workflow represents the execution of consulting services.

---

# Measurement Workflow

Operational work continuously updates the understanding of the business.

```
Activities
        ↓
Evidence
        ↓
Outcome
        ↓
KPI Measurements
        ↓
Current Business State
```

The Current Business State always reflects the latest verified understanding of the client.

---

# Consulting Workflow

Consulting Intelligence transforms verified information into professional consulting insight.

```
Current Business State
        ↓
Consulting Intelligence
        ↓
Recommendations
        ↓
Implementation Options
```

Consulting Intelligence never invents information.

It interprets verified evidence.

---

# Reporting Workflow

Reports organize verified information into structured deliverables.

```
Activities
        ↓
Evidence
        ↓
Outcomes
        ↓
Report Configuration
        ↓
Report Generation
```

Report Configuration controls:

- Scope
- Date range
- Client selection
- Grouping
- Included records
- Output format

Reports never become the source of truth.

They are generated from operational records.

---

# Communication Workflow

Communication Intelligence explains consulting work in language appropriate for the audience.

```
Report Generation
        ↓
Communication Intelligence
        ↓
Audience-Specific Deliverables
```

Deliverables include:

- Weekly Client Email
- Monthly Summary
- Proof of Work Digest
- Executive Summary
- Case Study
- Proposal
- Presentation
- Growth Review Narrative

Communication Intelligence does not change facts.

It changes presentation.

---

# Weekly Client Communication Workflow

The weekly reporting process used by Global Concepts Media is:

```
Activities
        ↓
Evidence
        ↓
Verified Outcomes
        ↓
Report Configuration
        ↓
Operational Report
        ↓
Communication Intelligence
        ↓
Client Email
```

Client emails should answer four questions:

1. What work was completed?
2. Why does it matter?
3. What business value was created?
4. What happens next?

The objective is to communicate value rather than simply list completed tasks.

---

# Quarterly Growth Workflow

Every Growth Review feeds the next consulting cycle.

```
Current Business State
        ↓
Growth Review
        ↓
Recommendations
        ↓
Approved Programs
        ↓
Execution
        ↓
Measurement
        ↓
Updated Current Business State
        ↓
Next Growth Review
```

The operating system continuously improves the client's business.

---

# AI Workflow

Every AI capability follows the same architecture.

```
Capability Engines
        ↓
Verified Business Record
        ↓
Current Business State
        ↓
Consulting Intelligence
        ↓
Report Generation
        ↓
Communication Intelligence
        ↓
Client Deliverables
```

Each engine has exactly one responsibility.

No engine should duplicate responsibilities performed elsewhere.

---

# Agency Operational States

Every page, engine, prompt, report, and automation belongs to one or more operational states.

## State 1

Prospecting

---

## State 2

Discovery

---

## State 3

Proposal

---

## State 4

Onboarding

---

## State 5

Planning

---

## State 6

Execution

---

## State 7

Measurement

---

## State 8

Communication

---

## State 9

Growth Review

---

## State 10

Expansion

---

# Continuous Improvement Loop

The operating system is designed around continuous improvement.

```
Evidence
        ↓
Measure
        ↓
Understand
        ↓
Recommend
        ↓
Implement
        ↓
Measure Again
```

Every completed cycle increases understanding of the client's business.

---

# Architectural Responsibilities

## Capability Engines

Observe.

---

## Business Record

Store verified facts.

---

## Current Business State

Represent current verified understanding.

---

## Consulting Intelligence

Interpret meaning.

---

## Report Generation

Organize information.

---

## Communication Intelligence

Explain business value.

---

# Development Principle

Future development should be capability-driven.

A capability is not complete until:

- Architecture exists.
- Data model supports it.
- Engines exist.
- Worker endpoints exist.
- User interface exists.
- Reports exist.
- Communication exists.
- Testing is complete.
- Production deployment is verified.

Only then should development proceed to the next capability.

---

# Development Roadmap

The recommended implementation order is:

```
Mission Control
        ↓
Prospecting
        ↓
Business Snapshot
        ↓
Growth Review
        ↓
Client Delivery
        ↓
Reporting
        ↓
Communication
        ↓
Automation
```

Each completed capability increases the operational usefulness of GCM OS.

---

# Workflow Integrity Rules

- Workflow always begins with observable evidence.
- Evidence precedes conclusions.
- Verified Business Record is the single source of truth.
- Current Business State represents verified understanding.
- Consulting Intelligence interprets facts.
- Reports organize information.
- Communication Intelligence explains value.
- Deliverables never replace operational records.
- Every recommendation must be traceable to evidence.
- Every automation must support an operational workflow.
- Every feature must support an Agency Operational State.

---

# Approval Status

**Version 1.0:** Locked

This document defines the operational workflow of the Global Concepts Media Operating System.

Future development should implement this workflow rather than redefine it.
