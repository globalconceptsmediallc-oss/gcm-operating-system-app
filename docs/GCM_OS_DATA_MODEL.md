# GCM OS DATA MODEL

**Document Version:** 1.1  
**Status:** Ready for Review  
**Last Updated:** 2026-07-17  
**System:** Global Concepts Media Operating System  
**Document Role:** Foundational Architecture  

---

# Purpose

This document defines the foundational data model for the Global Concepts Media Operating System.

The data model determines:

- What information the operating system stores
- Which record owns each piece of information
- How operational records relate to one another
- How historical information is preserved
- How current client conditions are calculated
- How consulting intelligence is generated
- How reports, dashboards, reviews, case studies, and other outputs are produced

This document is the foundation of GCM OS.

All future application architecture, database structures, capability engines, workflows, dashboards, reports, and client deliverables must conform to this model.

If another document conflicts with this data model, this document takes precedence unless the conflict is resolved through a formally approved architectural decision.

---

# Foundational Principle

GCM OS is a record-based operating system.

The system does not treat reports, dashboards, documents, or the Business Record as the primary source of truth.

The system stores durable operational records and generates current views and outputs from those records.

The foundational sequence is:

```text
Operational Records
        ↓
Current Business State
        ↓
Consulting Intelligence
        ↓
Report Generation
        ↓
Communication Intelligence
        ↓
Audience-Specific Deliverables
```

The operating system must preserve what happened, when it happened, why it mattered, what evidence supports it, and what business outcome resulted.

---

# Core Architectural Decision

The Data Model is the foundation of GCM OS.

The Business Record is no longer the foundational record of the platform.

The former Business Record concept is replaced by the:

# Current Business State

The Current Business State is a generated representation of the client’s most recently verified condition.

It is built from:

- Client information
- Baselines
- Programs
- Objectives
- Initiatives
- Activities
- Evidence
- Deliverables
- KPI History
- Verified observations
- Historical records

The Current Business State does not replace or overwrite the records from which it was generated.

It is a current view of those records.

---

# System Hierarchy

The primary conceptual hierarchy is:

```text
Client
├── Baselines
├── Programs
│   ├── Objectives
│   └── Initiatives
│       ├── Activities
│       │   └── Evidence
│       ├── Deliverables
│       └── Outcomes
├── KPI History
├── Current Business State
├── Consulting Intelligence
├── Report Configurations
├── Reports
└── Communication Intelligence
```

This hierarchy describes responsibility and relationship.

It does not require every record to be physically embedded inside another record.

Records may be stored independently and connected through permanent identifiers.

---

# Primary Data Model

The GCM OS data model consists of the following primary record types:

1. Client
2. Baseline
3. Program
4. Objective
5. Initiative
6. Activity
7. Evidence
8. Deliverable
9. Outcome
10. KPI History
11. Current Business State
12. Consulting Intelligence
13. Report Configuration
14. Report
15. Communication Intelligence

Each record type has one clearly defined responsibility.

---

# Record Ownership Principle

Every piece of information must have exactly one authoritative owner.

Other records may reference that information, display it, summarize it, calculate from it, or include it in a generated output.

They must not create a second authoritative copy.

For example:

- Client identity is owned by the Client record.
- Starting performance is owned by the Baseline record.
- Work performed is owned by the Activity record.
- Supporting proof is owned by the Evidence record.
- KPI measurements are owned by KPI History.
- Current conditions are represented by the Current Business State.
- Interpretations and recommendations are owned by Consulting Intelligence.
- Reports display generated information but do not own the underlying facts.

This prevents duplication, contradiction, and record drift.

---

# Historical Preservation Principle

Historical information is never overwritten.

When information changes, GCM OS must preserve the previous state and create a new historical record, revision, measurement, or effective period.

The system must be able to determine:

- What was known at a specific time
- What work had been completed at a specific time
- What evidence was available at a specific time
- What a KPI measured at a specific time
- What the client’s condition was believed to be at a specific time
- Which recommendations were active at a specific time
- What changed between two periods

Historical preservation applies to both human-created and system-generated records.

---

# Generated Output Principle

The following are generated outputs or generated views:

- Dashboards
- Mission Control
- Today views
- Client Workspace views
- Growth Reviews
- Business Snapshots
- Proof of Work reports
- Weekly reports
- Monthly reports
- Quarterly reviews
- Case studies
- Performance summaries
- Client presentations
- Internal operating summaries

These outputs must be generated from authoritative records in the data model.

They must not become separate sources of truth.

A generated output may preserve a historical snapshot of what was presented at a particular time, but it must retain references to the source records used to produce it.

---

# Universal Operational Record Standard

Every operational record should answer four questions:

1. What happened?
2. Why does it matter?
3. What evidence proves it?
4. What business outcome resulted?

These four questions form the operational record standard for GCM OS.

Not every record will contain a final measurable business outcome immediately.

When the outcome is not yet known, the record must state that the outcome is:

- Pending
- Not yet measurable
- Indirect
- Unknown
- Not applicable

The system must never invent an outcome.

---

# Common Record Fields

Every durable record should include a standard set of system fields where applicable.

```text
id
recordType
clientId
status
createdAt
createdBy
updatedAt
updatedBy
effectiveAt
source
sourceRecordIds
version
```

Recommended meanings:

## id

Permanent unique identifier for the record.

An identifier must not change when the display name or content changes.

## recordType

The defined GCM OS record type.

Examples:

- client
- baseline
- program
- objective
- initiative
- activity
- evidence
- deliverable
- kpiMeasurement
- currentBusinessState
- consultingIntelligence
- report

## clientId

The permanent identifier of the client that owns or is affected by the record.

System-level records may not require a client identifier.

## status

The record’s current lifecycle state.

Status values must be defined by the owning record type.

## createdAt

The date and time the record was first created.

## createdBy

The human, engine, workflow, or system process that created the record.

## updatedAt

The date and time the current version was produced.

## updatedBy

The human, engine, workflow, or system process responsible for the current version.

## effectiveAt

The date and time the information became operationally true.

This may differ from the creation date.

## source

The origin of the information.

Examples:

- Human entry
- Client interview
- Website observation
- Google Search Console
- Google Business Profile
- SEMrush
- Google Ads
- Social platform
- Internal workflow
- Capability engine
- Imported historical record

## sourceRecordIds

References to records used to create, calculate, or support the current record.

## version

The revision number or schema version of the record.

---

# 1. Client

## Responsibility

The Client record owns the permanent identity and relationship-level information for a client.

The Client record answers:

> Who is the operating system working for?

## The Client record owns

- Legal or recognized business name
- Internal client name
- Client code
- Primary domain
- Known business locations
- Primary market
- Industry
- Engagement status
- Relationship start date
- Relationship end date, when applicable
- Primary contacts
- Contract or service relationship references
- Active program references
- Client-level configuration
- Client-level permissions
- Permanent client identifiers

## The Client record does not own

- Historical performance measurements
- Work performed
- Evidence
- Recommendations
- Current website condition
- Current marketing performance
- Report content
- Baseline values
- KPI trends

Those belong to their respective records.

## Minimum Client structure

```text
Client
├── id
├── clientCode
├── name
├── legalName
├── primaryDomain
├── industry
├── primaryMarket
├── locations
├── contacts
├── engagementStatus
├── relationshipStartDate
├── relationshipEndDate
├── activeProgramIds
└── metadata
```

---

# 2. Baseline

## Responsibility

The Baseline record owns the verified starting condition for a client, program, initiative, channel, or KPI.

The Baseline answers:

> Where did the client start?

A baseline provides the reference point against which future change is evaluated.

## Baseline types

A baseline may apply to:

- Entire client relationship
- Program
- Initiative
- Marketing channel
- Website
- Search visibility
- Advertising performance
- Social presence
- Sales performance
- Operational process
- Individual KPI

## The Baseline record owns

- Baseline date
- Measurement period
- Starting values
- Starting conditions
- Data sources
- Evidence references
- Verification status
- Lock status
- Notes explaining the baseline
- Scope of the baseline
- Applicable client, program, initiative, or KPI

## Baseline locking

Once verified and locked, a baseline must not be edited to reflect later performance.

If the original baseline is discovered to be factually incorrect:

1. The original record must remain preserved.
2. A corrected baseline record or revision must be created.
3. The reason for the correction must be documented.
4. Reports must identify which baseline version was used.

## Minimum Baseline structure

```text
Baseline
├── id
├── clientId
├── scopeType
├── scopeId
├── baselineDate
├── measurementStartDate
├── measurementEndDate
├── metrics
├── conditions
├── evidenceIds
├── verificationStatus
├── locked
├── lockedAt
├── correctionOfBaselineId
└── notes
```

---

# 3. Program

## Responsibility

The Program record owns a long-term area of client work or business improvement.

A Program answers:

> What long-term business objective are we helping the client achieve?

Programs organize sustained agency work across multiple initiatives.

## Examples

- Organic Search Growth
- Paid Media Performance
- Local Market Visibility
- Website Conversion Improvement
- Reputation Development
- Content and Social Presence
- Sales Enablement
- Business Intelligence
- Client Growth System

## The Program record owns

- Program name
- Program purpose
- Program scope
- Strategic rationale
- Start date
- End date, when applicable
- Program status
- Program owner
- Related objectives
- Related initiatives
- Applicable KPI references
- Program-level success definition

## The Program record does not own

- Individual work entries
- Individual pieces of evidence
- Individual KPI measurements
- Generated reports

## Minimum Program structure

```text
Program
├── id
├── clientId
├── name
├── description
├── purpose
├── strategicRationale
├── scope
├── status
├── owner
├── startDate
├── endDate
├── objectiveIds
├── initiativeIds
├── kpiDefinitionIds
└── successDefinition
```

---

# 4. Objective

## Responsibility

The Objective record owns a defined result that a Program is intended to achieve.

An Objective answers:

> What measurable or observable result are we trying to create?

Objectives provide direction for initiatives and activities.

## Objective characteristics

An objective should be:

- Connected to a Program
- Specific enough to guide work
- Measurable or verifiable
- Time-bound when appropriate
- Connected to one or more KPIs when measurement is possible

## Objective types

Objectives may be:

- Business objectives
- Marketing objectives
- Operational objectives
- Performance objectives
- Visibility objectives
- Conversion objectives
- Foundational objectives

## The Objective record owns

- Objective statement
- Desired result
- Measurement method
- Target value or target condition
- Target date
- Priority
- Status
- Applicable KPIs
- Related initiative references
- Completion criteria

## Minimum Objective structure

```text
Objective
├── id
├── clientId
├── programId
├── statement
├── desiredResult
├── objectiveType
├── priority
├── measurementMethod
├── targetValue
├── targetCondition
├── targetDate
├── kpiDefinitionIds
├── initiativeIds
├── completionCriteria
└── status
```

---

# 5. Initiative

## Responsibility

The Initiative record owns a coordinated body of related work intended to advance one or more objectives.

An Initiative answers:

> What organized effort are we undertaking?

Initiatives sit between strategic Programs and individual Activities.

## Examples

- Rebuild Melbourne Locksmith landing page
- Improve Google Business Profile completeness
- Repair technical SEO issues
- Launch Phoenix Metro paid search campaign
- Consolidate negative keyword lists
- Build Business Snapshot workflow
- Improve client review acquisition process

## The Initiative record owns

- Initiative name
- Defined problem or opportunity
- Intended outcome
- Scope
- Priority
- Status
- Owner
- Start date
- Target completion date
- Completion date
- Related Program
- Related objectives
- Related activities
- Related deliverables
- Applicable KPIs
- Dependencies
- Constraints
- Initiative-level outcome summary

## Initiative status

Recommended status values:

- Proposed
- Approved
- Planned
- Active
- Blocked
- On Hold
- Completed
- Cancelled
- Replaced

## Minimum Initiative structure

```text
Initiative
├── id
├── clientId
├── programId
├── objectiveIds
├── name
├── problemOrOpportunity
├── intendedOutcome
├── scope
├── priority
├── status
├── owner
├── startDate
├── targetCompletionDate
├── completedAt
├── activityIds
├── deliverableIds
├── kpiDefinitionIds
├── dependencies
├── constraints
└── outcomeSummary
```

---

# 6. Activity

## Responsibility

The Activity record owns the smallest meaningful unit of work performed by the agency or operating system.

An Activity answers:

> What happened?

Activities are the foundation of operational history and Proof of Work.

Every completed action that may matter operationally should be represented by an Activity record.

## Examples

- Added a page title
- Corrected a canonical tag
- Reviewed a Google Ads search term report
- Added negative keywords
- Updated delivery settings
- Published a landing page
- Reviewed Google Search Console performance
- Tested a Worker deployment
- Called a prospect
- Verified a Google Business Profile category
- Created a client recommendation
- Corrected an analytics implementation

## The Activity record owns

- The action performed
- Date and time of the action
- Person or system that performed it
- Time spent
- Reason for the activity
- Business relevance
- Status
- Related client
- Related Program
- Related Initiative
- Related objective
- Evidence references
- Immediate result
- Business outcome, when known
- Follow-up requirement
- Source system
- External record reference, when applicable

## Required Activity questions

Every Activity should answer:

### What happened?

A factual description of the completed or attempted work.

### Why does it matter?

The operational or business reason for performing the work.

### What evidence proves it?

References to screenshots, URLs, files, exports, tests, platform records, or other evidence.

### What business outcome resulted?

The observed result, pending result, or reason an outcome cannot yet be measured.

## Activity status

Recommended status values:

- Planned
- In Progress
- Completed
- Blocked
- Cancelled
- Failed
- Verified

## Activity granularity

An Activity should represent one meaningful unit of work.

Multiple highly related actions may be condensed into one Activity when they:

- Occurred within the same work session
- Served the same immediate purpose
- Affected the same system area
- Share the same evidence
- Would not create useful operational distinction if separated

Condensed Activities may have a higher time-spent value.

The system must not assume that a longer duration means the Activity is incorrectly recorded.

## Minimum Activity structure

```text
Activity
├── id
├── clientId
├── programId
├── objectiveId
├── initiativeId
├── activityType
├── title
├── description
├── reason
├── businessRelevance
├── status
├── performedBy
├── startedAt
├── completedAt
├── timeSpentMinutes
├── evidenceIds
├── immediateResult
├── businessOutcomeStatus
├── businessOutcome
├── followUpRequired
├── followUpDate
├── sourceSystem
└── externalReference
```

---

# 7. Evidence

## Responsibility

The Evidence record owns the proof that supports an observation, activity, condition, measurement, recommendation, or outcome.

Evidence answers:

> What proves this?

Evidence must be observable, traceable, and connected to the claim or record it supports.

## Evidence types

Evidence may include:

- Screenshot
- URL
- Web page observation
- HTML source
- Source code
- Test result
- Analytics export
- KPI measurement
- Search Console export
- SEMrush export
- Google Ads record
- Google Business Profile observation
- Social platform observation
- Email
- Client statement
- Call note
- Document
- Invoice
- Published deliverable
- Before-and-after comparison
- System log
- Deployment record
- External platform identifier

## The Evidence record owns

- Evidence type
- Evidence description
- Source
- Capture date
- Effective date
- File or location reference
- Supporting record references
- Verification status
- Verified by
- Verification date
- Reliability classification
- Limitations
- Observed value or finding

## Evidence immutability

Evidence should not be altered after capture in a way that changes what it originally proved.

When evidence is updated or replaced:

- Preserve the original Evidence record.
- Create a new Evidence record.
- Link the new evidence to the previous evidence when relevant.

## Minimum Evidence structure

```text
Evidence
├── id
├── clientId
├── evidenceType
├── title
├── description
├── source
├── sourceUrl
├── fileReference
├── externalReference
├── capturedAt
├── effectiveAt
├── observedValue
├── supportsRecordIds
├── verificationStatus
├── verifiedBy
├── verifiedAt
├── reliability
├── limitations
└── supersedesEvidenceId
```

---

# 8. Deliverable

## Responsibility

The Deliverable record owns a completed item intentionally produced for internal use, client use, publication, implementation, or presentation.

A Deliverable answers:

> What was produced?

## Examples

- Landing page
- Advertisement
- Radio script
- Website file
- Campaign
- Keyword list
- Growth Review
- Business Snapshot
- Client presentation
- Technical audit
- Strategy document
- Content calendar
- Report
- Case study
- Code deployment
- Process document

## Deliverables and Reports

A Report is a specialized generated output.

A Deliverable may reference a Report, but not every Deliverable is a Report.

For example:

- A published landing page is a Deliverable.
- A weekly performance summary is both a generated Report and a client Deliverable.
- A code file is a Deliverable but not a Report.

## The Deliverable record owns

- Deliverable identity
- Deliverable type
- Purpose
- Intended audience
- Related initiative
- Related activities
- Version
- Completion status
- Delivery or publication date
- File, URL, or system location
- Approval status
- Acceptance status
- Supporting evidence
- Superseded deliverable reference

## Minimum Deliverable structure

```text
Deliverable
├── id
├── clientId
├── programId
├── initiativeId
├── deliverableType
├── name
├── purpose
├── audience
├── status
├── version
├── activityIds
├── evidenceIds
├── createdAt
├── completedAt
├── deliveredAt
├── approvedAt
├── acceptedAt
├── fileReference
├── url
├── systemLocation
└── supersedesDeliverableId
```

---


# 9. Outcome

## Responsibility

The Outcome record owns a verified result, milestone, achievement, or business effect produced by one or more Activities, Initiatives, Deliverables, or KPI changes.

An Outcome answers:

> What meaningful result occurred, and what records prove it?

An Outcome may represent:

- Operational result
- Completed milestone
- Leading indicator
- Performance improvement
- Measured business outcome
- Strategic outcome
- Verified client win

An Outcome must not be created solely because work was completed.

It must be supported by source records and evidence.

## The Outcome record owns

- Outcome identity
- Outcome type
- Description
- Business significance
- Observation date
- Measurement period
- Source records
- Supporting Evidence
- Supporting KPI Measurements
- Verification status
- Win classification
- Business impact
- Limitations
- Status

## Win classification

A Win is not a separate source of truth.

A Win is a verified classification of an Outcome.

Recommended win status values:

- Not Evaluated
- Candidate Win
- Verified Win
- Not a Win
- Superseded

## Minimum Outcome structure

```text
Outcome
├── id
├── clientId
├── programId
├── objectiveId
├── initiativeId
├── title
├── description
├── outcomeType
├── significance
├── status
├── observedAt
├── measurementPeriodStart
├── measurementPeriodEnd
├── sourceRecordIds
├── evidenceIds
├── kpiMeasurementIds
├── businessImpact
├── verificationStatus
├── winStatus
└── notes
```

---

# 10. KPI History

## Responsibility

KPI History owns time-based performance measurements.

KPI History answers:

> What was measured, when was it measured, and how did it change?

KPI History must preserve every valid measurement over time.

A current KPI value must not overwrite an earlier KPI value.

## KPI structure

KPI History should distinguish between:

1. KPI Definition
2. KPI Measurement

## KPI Definition

A KPI Definition explains what is being measured.

It owns:

- KPI name
- Description
- Unit
- Data source
- Measurement method
- Measurement frequency
- Applicable client, Program, Objective, or Initiative
- Direction of improvement
- Calculation method
- Data quality requirements

## KPI Measurement

A KPI Measurement records a value for a specific period.

It owns:

- KPI definition reference
- Measurement date
- Measurement period
- Value
- Unit
- Source
- Evidence
- Verification status
- Comparison values
- Notes
- Data completeness

## Examples

- Organic clicks
- Search visibility
- Website traffic
- Leads
- Form submissions
- Phone calls
- Conversion rate
- Cost per conversion
- Advertising spend
- Revenue
- Review count
- Average review rating
- Keyword ranking
- Google Business Profile activity
- Social posting frequency
- Technical issue count

## Minimum KPI Definition structure

```text
KPIDefinition
├── id
├── clientId
├── programId
├── objectiveId
├── initiativeId
├── name
├── description
├── unit
├── source
├── measurementMethod
├── calculationMethod
├── frequency
├── improvementDirection
└── dataQualityRequirements
```

## Minimum KPI Measurement structure

```text
KPIMeasurement
├── id
├── clientId
├── kpiDefinitionId
├── measurementDate
├── periodStart
├── periodEnd
├── value
├── unit
├── source
├── evidenceIds
├── verificationStatus
├── comparisonBaselineId
├── dataCompleteness
└── notes
```

---

# 11. Current Business State

## Responsibility

The Current Business State is the generated representation of the client’s most recently verified condition.

It answers:

> What is true about the client now, based on the available evidence?

The Current Business State replaces the Business Record as the current-state representation of the client.

It is not the foundational data store.

## The Current Business State is generated from

- Client records
- Active and historical Baselines
- Programs
- Objectives
- Initiatives
- Activities
- Evidence
- Deliverables
- KPI History
- Verified observations
- Relevant source systems

## The Current Business State may include

- Current business identity
- Current market
- Current services
- Current offers
- Current website condition
- Current technical condition
- Current search visibility
- Current paid media condition
- Current Google Business Profile condition
- Current social presence
- Current reputation condition
- Current contact intelligence
- Current conversion condition
- Current Programs
- Active Initiatives
- Current KPI values
- Current risks
- Current opportunities
- Data confidence
- Verification requirements

## Current-state rules

The Current Business State must:

- Cite or reference its source records
- Identify when each component was last verified
- Distinguish verified facts from calculated values
- Distinguish unknown information from absent information
- Identify conflicting records
- State confidence where appropriate
- Never silently replace historical records
- Be reproducible from source records

## Snapshot history

Each generated Current Business State may be stored as a timestamped snapshot for historical comparison.

Stored snapshots remain generated records.

They do not become the owner of the underlying facts.

## Minimum Current Business State structure

```text
CurrentBusinessState
├── id
├── clientId
├── generatedAt
├── generatedBy
├── sourceRecordIds
├── identityState
├── marketState
├── serviceState
├── websiteState
├── searchState
├── paidMediaState
├── localPresenceState
├── socialState
├── reputationState
├── contactState
├── conversionState
├── activeProgramState
├── activeInitiativeState
├── currentKPIState
├── risks
├── opportunities
├── unknowns
├── conflicts
├── confidence
└── verificationRequirements
```

---

# 12. Consulting Intelligence

## Responsibility

Consulting Intelligence owns the interpretation of verified records and current conditions.

It answers:

> What does the available information mean, what matters most, and what should happen next?

Consulting Intelligence converts data into professional judgment.

## Consulting Intelligence may include

- Findings
- Diagnoses
- Opportunities
- Risks
- Priorities
- Recommendations
- Strategic implications
- Expected business impact
- Confidence
- Required verification
- Recommended Initiatives
- Recommended Activities
- Measurement plans
- Implementation sequence

## Consulting Intelligence must be based on

- Current Business State
- Baselines
- KPI History
- Activities
- Evidence
- Program objectives
- Initiative outcomes
- Verified client information
- Approved consulting frameworks

## Evidence-before-assumptions rule

Consulting Intelligence must clearly distinguish among:

- Verified finding
- Calculated conclusion
- Professional interpretation
- Hypothesis
- Recommendation
- Unknown
- Required verification

The system must not present an assumption as a verified fact.

## Intelligence history

Consulting Intelligence is time-dependent.

A later interpretation must not overwrite an earlier interpretation.

Each intelligence record should preserve:

- The information available when it was created
- The source records used
- The model, engine, or consultant responsible
- The recommendation made at that time
- The confidence level
- Any later validation or invalidation

## Minimum Consulting Intelligence structure

```text
ConsultingIntelligence
├── id
├── clientId
├── intelligenceType
├── generatedAt
├── generatedBy
├── sourceRecordIds
├── finding
├── interpretation
├── businessSignificance
├── priority
├── recommendation
├── expectedOutcome
├── confidence
├── verificationStatus
├── verificationRequirements
├── recommendedProgramId
├── recommendedInitiativeId
├── recommendedActivityTypes
├── measurementPlan
├── validFrom
├── supersededAt
└── supersededById
```

---


# 13. Report Configuration

## Responsibility

The Report Configuration record owns the reusable rules used to select, filter, group, and render operational records into a Report.

A Report Configuration answers:

> Which records should be included, how should they be organized, and what type of output should be produced?

Report Configurations support workflows such as:

- Single-client weekly email
- Multi-client internal summary
- All-client Proof of Work digest
- Monthly performance report
- Growth Review generation
- Case study generation

## The Report Configuration record owns

- Report type
- Scope mode
- Selected clients
- Reporting period rules
- Activity filters
- Outcome and Win filters
- Deliverable filters
- KPI filters
- Grouping rules
- Audience
- Output variant
- Template version
- Status
- Creation and ownership metadata

## Recommended scope modes

- Single Client
- Multi-Client
- All Clients

## Recommended output variants

- Client Email
- Internal Summary
- Proof of Work Digest
- Executive Summary
- Growth Review
- Case Study
- Presentation

## Minimum Report Configuration structure

```text
ReportConfiguration
├── id
├── name
├── reportType
├── scopeMode
├── clientIds
├── periodStart
├── periodEnd
├── includeCompletedActivities
├── includeOutcomes
├── includeWins
├── includeDeliverables
├── includeKPIChanges
├── groupingMode
├── outputVariant
├── audience
├── templateVersion
├── createdAt
├── createdBy
└── status
```

---

# 14. Report

## Responsibility

The Report record owns a generated presentation of information for a defined audience and purpose.

A Report answers:

> What information was presented, to whom, for what purpose, and from which records?

Reports are generated outputs.

They are not the primary owner of operational facts.

## Report types

Examples include:

- Business Snapshot
- 90-Day Growth Review
- Weekly Client Report
- Monthly Performance Report
- Proof of Work Report
- Baseline Report
- Initiative Summary
- KPI Performance Report
- Case Study
- Prospect Research Report
- Internal Operating Review
- Client Presentation

## The Report record owns

- Report identity
- Report type
- Audience
- Reporting period
- Generation date
- Template version
- Source record references
- Included sections
- Presentation format
- Delivery status
- Historical rendered output
- Approval status
- Delivery reference

## The Report record does not own

- The original Activities
- The original Evidence
- The original KPI measurements
- The authoritative Current Business State
- The authoritative Consulting Intelligence

## Reproducibility

A stored Report must identify:

- Which source records were used
- Which Current Business State snapshot was used
- Which Consulting Intelligence records were used
- Which template version was used
- When the Report was generated

This allows the system to explain why a Report contained specific information.

## Minimum Report structure

```text
Report
├── id
├── clientId
├── reportType
├── title
├── audience
├── periodStart
├── periodEnd
├── generatedAt
├── generatedBy
├── templateVersion
├── currentBusinessStateId
├── consultingIntelligenceIds
├── sourceRecordIds
├── includedSections
├── format
├── fileReference
├── url
├── approvalStatus
├── deliveryStatus
├── deliveredAt
└── deliverableId
```

---


# 15. Communication Intelligence

## Responsibility

Communication Intelligence owns the audience-specific explanation of verified work, outcomes, and consulting meaning.

It answers:

> How should this information be communicated so the intended audience understands why it matters?

Communication Intelligence transforms accurate operational and consulting records into appropriate language without changing the underlying facts.

## Communication Intelligence may produce

- Client email narrative
- Executive summary
- Proof of Work narrative
- Growth Review narrative
- Case study narrative
- Proposal language
- Sales collateral
- Internal management summary
- Presentation copy

## Communication Intelligence must be based on

- Activities
- Evidence
- Deliverables
- Outcomes
- KPI History
- Current Business State
- Consulting Intelligence
- Report Configuration
- Generated Report data

## Client-value communication principle

Client-facing communication should explain:

- What was done
- Why it matters to the client
- What changed
- What result or opportunity it creates
- What happens next

The language should emphasize business value rather than merely listing technical tasks.

For example:

```text
Operational record:
Updated page titles.

Consulting meaning:
Improved page relevance for important search topics.

Client communication:
We strengthened how search engines understand your services, helping improve long-term visibility for customers searching online.
```

## Communication integrity rules

Communication Intelligence must not:

- Invent work
- Invent Evidence
- Invent KPI results
- Overstate business impact
- Convert a pending outcome into a completed result
- Present assumptions as verified facts
- Remove important limitations
- Change the meaning of the source records

## Minimum Communication Intelligence structure

```text
CommunicationIntelligence
├── id
├── clientId
├── reportId
├── reportConfigurationId
├── communicationType
├── audience
├── voice
├── generatedAt
├── generatedBy
├── sourceRecordIds
├── summary
├── narrative
├── keyClientBenefits
├── nextSteps
├── limitations
├── approvalStatus
└── deliveredAt
```

---

# Relationship Model

The principal record relationships are:

```text
Client
  ├── has many Baselines
  ├── has many Programs
  ├── has many KPI Definitions
  ├── has many KPI Measurements
  ├── has many Current Business State snapshots
  ├── has many Consulting Intelligence records
  └── has many Reports

Program
  ├── belongs to one Client
  ├── has many Objectives
  ├── has many Initiatives
  └── references many KPI Definitions

Objective
  ├── belongs to one Client
  ├── belongs to one Program
  ├── may relate to many Initiatives
  └── may reference many KPI Definitions

Initiative
  ├── belongs to one Client
  ├── belongs to one Program
  ├── may support many Objectives
  ├── has many Activities
  ├── has many Deliverables
  ├── may produce many Outcomes
  └── may reference many KPI Definitions

Activity
  ├── belongs to one Client
  ├── may belong to one Program
  ├── may belong to one Initiative
  ├── may support one Objective
  ├── has zero or more Evidence records
  └── may contribute to one or more outcomes

Evidence
  ├── belongs to one Client when client-specific
  └── may support multiple records

Deliverable
  ├── belongs to one Client
  ├── may belong to one Program
  ├── may belong to one Initiative
  ├── may result from many Activities
  └── may have many Evidence records

Outcome
  ├── belongs to one Client
  ├── may belong to one Program
  ├── may belong to one Objective
  ├── may belong to one Initiative
  ├── may result from many source records
  ├── may reference many KPI Measurements
  └── may be classified as a verified Win

KPI Measurement
  ├── belongs to one KPI Definition
  ├── belongs to one Client
  ├── may reference one Baseline
  └── has zero or more Evidence records

Current Business State
  ├── belongs to one Client
  └── is generated from many source records

Consulting Intelligence
  ├── belongs to one Client
  ├── is generated from many source records
  └── may recommend Programs, Initiatives, or Activities

Report Configuration
  ├── defines scope, filters, grouping, audience, and output type
  └── may generate many Reports

Report
  ├── belongs to one or more Clients
  ├── references one Report Configuration
  ├── may reference one Current Business State snapshot
  ├── references Consulting Intelligence
  └── references all material source records

Communication Intelligence
  ├── belongs to one generated Report
  ├── references the Report Configuration
  ├── references all material source records
  └── produces audience-specific communication
```

---

# Authoritative Ownership Matrix

| Information | Authoritative Owner |
|---|---|
| Client identity | Client |
| Client contact information | Client |
| Relationship status | Client |
| Starting condition | Baseline |
| Long-term area of work | Program |
| Desired measurable result | Objective |
| Coordinated body of work | Initiative |
| Work performed | Activity |
| Proof supporting a claim | Evidence |
| Item produced | Deliverable |
| Verified result or Win | Outcome |
| KPI meaning and calculation | KPI Definition |
| KPI value for a period | KPI Measurement |
| Current verified client condition | Current Business State |
| Interpretation and recommendation | Consulting Intelligence |
| Report filtering and grouping rules | Report Configuration |
| Presented output | Report |
| Audience-specific narrative | Communication Intelligence |

No secondary record may become an independent owner of information assigned in this matrix.

---

# Source and Confidence Model

Every factual claim should retain information about its origin and reliability.

Recommended source classifications:

- Direct system data
- Direct human observation
- Client-provided information
- Publicly observable information
- Calculated information
- AI-extracted information
- AI-interpreted information
- Imported historical information
- Unverified information

Recommended confidence classifications:

- Verified
- High confidence
- Moderate confidence
- Low confidence
- Unknown
- Conflicting

Confidence does not replace verification status.

A record may have high confidence while still requiring formal verification.

---

# Verification Model

Verification should be represented explicitly.

Recommended verification statuses:

- Not Required
- Unverified
- Pending Verification
- Verified
- Partially Verified
- Disputed
- Rejected
- Superseded

Verification should identify:

- Who or what verified the information
- When it was verified
- What evidence was used
- What limitations remain

---

# Outcome Model

Activities and Initiatives may produce different levels of outcome.

Recommended outcome classifications:

- Operational output
- Immediate result
- Leading indicator
- Measured business outcome
- Strategic outcome
- No measurable outcome
- Outcome pending
- Outcome unknown

Examples:

```text
Activity:
Added conversion tracking.

Immediate result:
Form submissions can now be recorded.

Leading indicator:
Conversion events are appearing in analytics.

Measured business outcome:
Lead attribution accuracy improved.

Strategic outcome:
Advertising decisions can be made using reliable conversion data.
```

The system must not claim a measured business outcome when only an operational output has occurred.

---

# Time Model

The data model must distinguish among:

- Record creation time
- Record update time
- Effective time
- Work start time
- Work completion time
- Measurement period
- Evidence capture time
- Verification time
- Report generation time
- Delivery time

These dates may be different.

For example, an Activity may be entered on Friday for work completed on Wednesday.

The Activity’s `createdAt` would be Friday, while its `completedAt` would be Wednesday.

---

# Record Status Versus Historical State

A record’s current status does not erase its history.

For example:

```text
Initiative
Proposed → Approved → Active → Blocked → Active → Completed
```

The system should preserve meaningful status changes through:

- Status history
- Event records
- Revisions
- Timestamped transitions

The final status alone is not a complete operational history.

---

# Corrections and Supersession

GCM OS must support correcting inaccurate information without deleting history.

A correction should:

1. Preserve the original record.
2. Create a corrected record or new version.
3. Identify the original record.
4. Explain the reason for correction.
5. Identify who made the correction.
6. Record when the correction occurred.
7. Update generated views to use the valid record.

Recommended relationship fields:

```text
correctsRecordId
supersedesRecordId
supersededById
correctionReason
```

Deletion should be limited to duplicate, invalid, test, or legally required removals.

Where possible, records should be deactivated or superseded instead of deleted.

---

# Current Views Versus Permanent Records

The system must distinguish between a permanent record and a current view.

## Permanent records

Examples:

- Activity
- Evidence
- Baseline
- KPI Measurement
- Deliverable
- Consulting Intelligence record
- Generated Report snapshot

## Current views

Examples:

- Current Business State
- Active Initiative list
- Current KPI scorecard
- Mission Control
- Today page
- Prospect priority list
- Client Workspace
- Current recommendation list

A current view may change whenever its source records change.

A permanent record remains part of historical truth.

---

# Workspace Model

The Workspace is a generated operating interface.

It may display:

- Client identity
- Active Programs
- Active Objectives
- Active Initiatives
- Recent Activities
- Pending follow-up
- Current KPI performance
- Current Business State
- Consulting Intelligence
- Recent Deliverables
- Reports
- Risks
- Opportunities
- Required verification

The Workspace does not own these records.

It reads and updates the underlying record types through controlled workflows.

---

# Proof of Work Model

Proof of Work must be generated primarily from:

- Activities
- Evidence
- Deliverables
- Initiative relationships
- Time records
- Immediate results
- Business outcomes
- KPI changes

The Proof of Work system must not require a second manually maintained work-history database.

An Activity is the authoritative record of work performed.

Evidence proves the Activity.

Deliverables show what was produced.

KPI History and outcome records show what changed.

---


# Email Builder and Client Communication Model

The Email Builder is a generated reporting and communication workflow.

It must not become an independent operational database.

Its workflow is:

```text
Client Selection
        +
Date Range
        +
Activity, Outcome, Win, Deliverable, and KPI Filters
        +
Grouping Rules
        +
Output Template
        ↓
Generated Report
        ↓
Communication Intelligence
        ↓
Client Email, Internal Summary, or Proof of Work Digest
```

Completed work is generated from Activity records.

Wins are generated from verified Outcome records.

Date range, client scope, grouping, and output type are owned by the Report Configuration.

The initial Report organizes the selected facts.

Communication Intelligence then converts the Report into a client-value voice that explains what was done, why it matters, what result it supports, and what happens next.

The client email is therefore a rendered communication artifact, not a source of truth.

---

# Growth Review Model

The 90-Day Growth Review must be generated from:

- Baselines
- Current Business State
- KPI History
- Programs
- Objectives
- Initiatives
- Activities
- Evidence
- Deliverables
- Consulting Intelligence

The Growth Review is not an independent database of client facts.

Recommendations created during the Growth Review process should be stored as Consulting Intelligence and may create proposed Objectives or Initiatives.

Once approved, proposed Initiatives should become formal Initiative records.

---

# Business Snapshot Model

The Business Snapshot is a limited generated Report created from publicly observable information and approved intelligence rules.

It may use:

- Client or Prospect identity
- Public website evidence
- Public presence evidence
- Contact evidence
- Technical observations
- Current Business State
- Consulting Intelligence

The Business Snapshot must distinguish between:

- Verified public facts
- Observed gaps
- Preliminary interpretations
- Unknown information
- Items requiring paid or human verification

The Snapshot must not become the authoritative owner of the evidence or findings displayed within it.

---

# Case Study Model

A Case Study is a generated Report based on selected historical records.

It may include:

- Baseline
- Business problem
- Program
- Objectives
- Initiatives
- Activities
- Evidence
- Deliverables
- KPI History
- Outcomes
- Consulting interpretation

A Case Study must remain traceable to the original client records.

Public versions may anonymize or exclude protected information, but the internal source relationships must remain intact.

---

# Data Integrity Rules

All GCM OS implementations must follow these rules:

1. Every durable record has a permanent identifier.
2. Every client-specific record references a Client.
3. Every piece of information has one authoritative owner.
4. Historical information is not overwritten.
5. Evidence remains traceable to its source.
6. Generated outputs reference their source records.
7. Unknown information remains Unknown.
8. Assumptions are not presented as verified facts.
9. KPI measurements are stored historically.
10. Current state is generated from records.
11. Consulting intelligence is separated from factual evidence.
12. Reports do not become primary data.
13. Corrections preserve the original record.
14. Record dates reflect the actual event, not only the entry date.
15. Business outcomes are not claimed without support.
16. Automated records identify the engine or process that created them.
17. Human verification is recorded when required.
18. Record relationships use permanent identifiers rather than display names.
19. Current views must be reproducible from authoritative records.
20. Duplicate sources of truth are prohibited.

---

# Engine Responsibilities

Capability engines may:

- Collect observable evidence
- Normalize evidence
- Create proposed records
- Calculate metrics
- Generate Current Business State components
- Generate Consulting Intelligence
- Identify conflicts
- Identify unknowns
- Recommend verification
- Generate Reports

Capability engines must not:

- Silently overwrite historical records
- Convert assumptions into facts
- Create duplicate authoritative owners
- Remove source traceability
- Claim outcomes without supporting records
- Treat generated Reports as source data

---

# Human Responsibilities

Human operators may:

- Verify records
- Correct inaccurate information
- Approve Programs
- Approve Objectives
- Approve Initiatives
- Record Activities
- Attach Evidence
- Confirm business outcomes
- Approve Consulting Intelligence
- Approve client-facing Reports
- Resolve conflicting records

Human decisions must remain attributable to the person who made them.

---

# Initial Implementation Priority

The data model should be implemented in the following order:

```text
1. Client
2. Baseline
3. Program
4. Objective
5. Initiative
6. Activity
7. Evidence
8. Deliverable
9. Outcome
10. KPI Definition
11. KPI Measurement
12. Current Business State
13. Consulting Intelligence
14. Report Configuration
15. Report
16. Communication Intelligence
```

This order establishes the permanent operational records before generated intelligence and outputs.

---

# Migration Principle

Existing agency systems and records should be mapped into this data model rather than discarded.

Examples:

- Existing Baseline Registry entries become Baseline records.
- Proof of Work entries become Activity records.
- Supporting links and screenshots become Evidence records.
- Existing client goals become Objectives.
- Related bodies of work become Initiatives.
- Long-term service areas become Programs.
- Historical metrics become KPI Measurements.
- Existing Business Record data becomes source material for Current Business State generation.
- Existing Growth Reviews become historical Report records.
- Existing recommendations become Consulting Intelligence records.
- Existing Wins become verified Outcome records.
- Existing Email Builder settings become Report Configuration records.
- Existing client-facing email summaries become Communication Intelligence records.

Migration must preserve original dates, sources, and historical meaning whenever available.

---

# Architectural Boundary

This document defines the conceptual data model.

It does not yet define:

- Physical database technology
- Database table names
- Storage provider
- API endpoint structure
- User interface layout
- Authentication
- Permission implementation
- File storage architecture
- Exact JSON schemas
- Exact validation code
- Migration scripts

Those implementation decisions must be created after this model is approved and locked.

All future implementation decisions must preserve the responsibilities and ownership rules defined here.

---

# Locked Architectural Summary

GCM OS is built on durable, connected operational records.

The foundational model is:

```text
Client
├── Baselines
├── Programs
│   ├── Objectives
│   └── Initiatives
│       ├── Activities
│       │   └── Evidence
│       ├── Deliverables
│       └── Outcomes
├── KPI History
├── Current Business State
├── Consulting Intelligence
├── Report Configurations
├── Reports
└── Communication Intelligence
```

The governing rules are:

- The Data Model is the foundation.
- The Current Business State replaces the Business Record as the generated current-state view.
- Historical information is never overwritten.
- Every piece of information has exactly one owner.
- Activities are the smallest meaningful unit of work.
- Evidence proves claims and completed work.
- Programs organize long-term client work.
- Objectives define desired results.
- Initiatives organize related Activities.
- KPI History preserves performance over time.
- Consulting Intelligence interprets verified information.
- Reports are generated outputs.
- Dashboards and Workspaces are generated views.
- Proof of Work and Case Studies are produced from existing records.
- Evidence comes before assumptions.
- The operating system must mirror how the agency actually works.

---

# Approval Status

**Version 1.1:** Ready for Review  

This revision adds formal Outcome, Report Configuration, and Communication Intelligence records based on the verified Email Builder and client communication workflow.

Once approved, Version 1.1 becomes the foundational architectural authority for the Global Concepts Media Operating System data model.

Future changes require:

1. Identification of the architectural problem
2. Review of affected record ownership
3. Review of historical-data implications
4. Review of generated-output implications
5. Formal approval
6. Document version update
7. Corresponding entry in `DECISIONS.md`
