# GCM OS BUSINESS WORKSPACE STANDARD

**Document Version:** 1.0

**Status:** CANONICAL

**Architecture:** LOCKED

**Last Updated:** 2026-07-16

---

# Purpose

The Business Workspace is the central operating environment of the Global Concepts Media Agency Operating System.

Every business has exactly one Business Workspace.

The Business Workspace follows a business from first prospect through completed case study.

It is not a report.

It is not a CRM record.

It is the permanent operational record for that business.

---

# Product Principle

Mission Control tells Andy **which Business Workspace to open.**

The Business Workspace is where the work happens.

---

# Core Architecture

```
Mission Control
        │
        ▼
Business Workspace
        │
        ▼
Business Record
        │
        ├── Client Pre-Research
        ├── Business Snapshot
        ├── Discovery
        ├── 90-Day Growth Review
        ├── Implementation
        ├── Weekly Work
        ├── Results
        ├── Proof of Work
        └── Case Study
```

The Business Record remains the single source of truth.

The Business Workspace organizes and executes consulting work around that record.

---

# One Business = One Workspace

Every business has exactly one Business Workspace.

The workspace is never recreated.

The workspace evolves.

Information accumulates over time.

Nothing is duplicated.

---

# Lifecycle

Every workspace progresses through the following stages.

```
Prospect

↓

Research

↓

Discovery

↓

Growth Review

↓

Client

↓

Implementation

↓

Measurement

↓

Proof of Work

↓

Case Study

↓

Archive
```

The workspace remains the same.

Only its stage changes.

---

# Workspace Responsibilities

The Business Workspace answers:

• What do we know?

• What still needs verification?

• What should happen next?

• What work is currently active?

• What has already been completed?

• What measurable results have been created?

---

# Workspace Sections

Version 1 contains the following sections.

## Overview

Business summary

Current status

Opportunity Score

Highest Value Next Action

---

## Business Record

Verified observable evidence.

Never speculation.

Never assumptions.

---

## Research

Client Pre-Research

Observable findings

Contact intelligence

Market observations

---

## Snapshot

Business Snapshot

Priority opportunities

Readiness

Initial recommendations

---

## Discovery

Discovery preparation

Meeting notes

Questions

Decisions

---

## Growth Review

90-Day Growth Review

Priority roadmap

Implementation recommendations

---

## Implementation

Projects

Tasks

Weekly work

Status

---

## Results

Completed improvements

Measured outcomes

KPIs

Evidence

---

## Proof of Work

Automatically generated from completed implementation.

No manual recreation.

---

## Case Study

Automatically generated from:

Completed work

Measured improvements

Business outcomes

Lessons learned

---

# Business Record Rule

The Business Record is the permanent source of truth.

All sections read from the Business Record.

Capability Engines update the Business Record.

The Workspace displays the Business Record.

---

# Engine Rule

AI Engines are not products.

Their only responsibility is to improve the Business Workspace.

Every engine must answer:

"What information does this add to the Business Workspace?"

If none,

the engine should not exist.

---

# Mission Control Rule

Mission Control never stores business information.

Mission Control answers:

Which Business Workspace needs attention?

Why?

What should happen next?

---

# Reports

Reports are outputs.

They never become the operating record.

Examples:

Business Snapshot

90-Day Growth Review

Proof of Work

Case Study

All reports are generated from the Business Workspace.

---

# Product Philosophy

The Agency Operating System is not a collection of reports.

The Agency Operating System is a collection of Business Workspaces.

Every feature exists to improve one of those workspaces.

---

# Development Rule

Before adding any feature ask:

Does this improve the Business Workspace?

Does this help acquire clients?

Does this help deliver work?

Does this prove measurable results?

If not,

defer the feature.

---

# Canonical Decision

The Business Workspace is the center of GCM OS.

Mission Control exists to direct work toward the correct Business Workspace.

All future development should strengthen this architecture.

END
