# GCM_OS_MASTER.md

Version: 1.3.0
Status: Authoritative Production Handoff

---

# Completed This Thread

## Operational Reviews

Implemented Operational Reviews as the approval bridge between Communications and Media.

One Operational Review is created per Media Instruction.

Human approval is required before Media records are updated.

---

## Production Schema

Confirmed production schema uses:

- confirmation_received_at
- confirmation_communication_id

The obsolete confirmed_at column is not used.

---

## Road Test Results

Successfully completed an end-to-end road test:

Communication
→ Operational Review
→ Human Approval
→ Media Update

Results:

- Communications saved correctly.
- Operational Reviews created successfully.
- Reviews matched to Media Instructions.
- Media approvals updated production records.
- One orphan approval exposed the historical confirmed_at bug and was repaired.
- media_records and media_instructions are synchronized.

---

## Communications Road Test

Production road testing identified an important operational requirement for Workers AI screenshot analysis.

### Discovery

Workers AI performs significantly better when the uploaded screenshot is tightly cropped around the communication.

Full-screen screenshots containing browser chrome, Gmail navigation, and excessive whitespace can produce intermittent "Unknown — Information" classifications.

### Production Requirement

Before analysis:

- Crop to the communication.
- Exclude browser chrome.
- Exclude Gmail navigation.
- Exclude unnecessary whitespace.

Evidence should occupy the majority of the image.

### Future Enhancement

Implement an integrated crop tool before Communications analysis.

---

## Gmail Workflow

Successfully verified:

- Gmail draft generation
- MP3 attachment support
- Recipient lookup
- Manual review workflow

Road testing identified that generated traffic emails must include complete operational traffic instructions before production deployment.

---

## Media Operations Architecture

Major architectural discovery:

Media Operations is not a media-buy management system.

Media Operations is an Active Commercial Inventory Management System.

The system manages:

- Commercial inventory
- Active rotation
- Markets
- Stations
- ISCI codes
- Assets
- Start dates
- End dates
- Rotation status

The dashboard should always answer:

> What commercials should be running today?

---

## Traffic Instruction Model

Road testing confirmed:

The station order is persistent.

Traffic instructions communicate operational changes only.

Examples:

- Add commercial
- Replace commercial
- Remove commercial
- Extend schedule

Traffic emails communicate the operational delta instead of reproducing the complete station order.

---

## Communications Relationship

Production architecture:

Communications = Operational Evidence

Media = Operational State

Proof = Historical Client Reporting

Communication history should never be duplicated inside Media.

Modules remain linked through shared production records.

---

## Operational Milestone

Successfully completed another production Communications road test.

Operational inbox reached zero after processing all production communications through GCM OS.

---

# Outstanding Investigation

## Investigation #22

### Media Dashboard "Needs Attention" Query

Observed:

Dashboard displayed a placement whose database record contained:

- attention_status = clear
- confirmation_status = confirmed
- traffic_status = sent

Conclusion:

- Operational workflow is functioning correctly.
- Remaining defect exists only in the dashboard query.

---

# UI Standards Adopted

Display business objects before database identifiers.

Example:

Preferred:

WMMB — Pre-Loved Safes

Extend through Aug 31, 2026

Secondary metadata:

- Communication ID
- Review ID
- Instruction ID

---

# Current Production State

Operational pipeline:

Communication
→ Operational Review
→ Human Approval
→ Media Update
→ Dashboard
→ Proof

Production architecture:

Communications = Evidence

Investigations = Operational Decisions

Work Items = Execution

Media = Operational State

Proof = Client Reporting

---

# Immediate Priorities

## Priority 1

Complete Investigation #22 by correcting the Media "Needs Attention" dashboard query.

## Priority 2

Complete Media Operations road testing.

Implement production Traffic Instruction workflow.

## Priority 3

Build Calendar module.

Integrated scheduling for:

- Client appointments
- Investigations
- Work Items
- Media flights
- Follow-ups
- Deadlines

## Priority 4

Build Billing module.

Support:

- Monthly retainers
- Invoice generation
- Payment tracking
- Revenue dashboard
- Outstanding balances

## Priority 5

Continue production road testing.

Expand GCM OS only through operational workflows proven during real-world use.

---

# Development Rules

- Production system only.
- Evidence Before Assumptions.
- One Change → Deploy → Test → Verify → Lock.
- Never redesign working production features.
- Every file includes visible production version headers.
- Always provide complete deployable files.
- Road-test every workflow before expanding the system.

---

# Documentation Hierarchy

Development should always follow this order:

1. GCM project Markdown documentation (permanent architectural reference)
2. GCM_OS_MASTER.md (current production state)
3. Current development thread

The Master documents production state.

The Markdown documentation defines the operating system.

The conversation is the active development session.
