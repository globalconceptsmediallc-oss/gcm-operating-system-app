GLOBAL CONCEPTS MEDIA OPERATING SYSTEM — MASTER

File: GCM_OS_MASTER.mdVersion: 1.2Status: AUTHORITATIVEPurpose: Master Architecture, Operating Standard, Production Handoff, and Current-State ReferenceLast Updated: 2026-07-25

1. AUTHORITY

This document is the primary authority for the Global Concepts Media Operating System (GCM OS).

It exists to prevent architecture drift, conflicting documentation, lost decisions, and incomplete handoffs between development sessions.

If an older GCM OS Markdown document conflicts with this document, this document takes precedence unless verified production evidence demonstrates that this document must be updated.

Production evidence may include:

Current production code

D1 database structure

Cloudflare configuration

Current application behavior

Verified operational road tests

Current business workflows

When production evidence reveals that this document is incomplete or inaccurate, this document should be updated.

Do not create another competing master architecture document.

2. PRODUCT MISSION

GCM OS is the Agency Operating System used to run Global Concepts Media.

Its purpose is to help Global Concepts Media consistently:

Acquire better clients.

Deliver measurable business improvements.

Prove the value of completed work.

Turn successful client engagements into future revenue.

The operating model is:

ACQUIRE
   ↓
DELIVER
   ↓
PROVE
   ↓
GROW
   ↓
ACQUIRE

This is the Global Concepts Media agency flywheel.

3. BUSINESS OBJECTIVE

GCM OS must become operational enough that system development no longer consumes the majority of available working time.

The operating system succeeds when it allows Global Concepts Media to spend the majority of its time:

Prospecting

Acquiring clients

Performing client work

Solving client problems

Measuring results

Communicating value

Growing the agency

GCM OS exists to support the business.

Building GCM OS is not itself the primary business activity.

4. CORE PRODUCT PRINCIPLE

The consulting workflow is the product.

Artificial Intelligence is an intelligence and assistance layer.

Technology exists to make the real operating workflow of Global Concepts Media easier, faster, more consistent, and more valuable.

Every feature should help Global Concepts Media:

Acquire clients

Deliver work

Prove results

Grow the agency

If a proposed feature does none of these things, it should not be prioritized.

5. OPERATIONAL PRINCIPLE

GCM OS should mirror the real operational workflow of Global Concepts Media.

The software should not force the agency to follow an artificial workflow simply because the software was designed that way.

Real operational evidence should determine how the system evolves.

6. EVIDENCE BEFORE ASSUMPTIONS

Evidence Before Assumptions is a permanent GCM OS principle.

The system must distinguish between:

Verified facts

Evidence

AI interpretation

Unknown information

Recommendations

Unknown information must not silently become fact.

Missing information must not automatically become a negative finding.

AI interpretation must remain distinguishable from factual evidence.

Important recommendations should remain traceable to supporting evidence.

7. EVIDENCE SOURCES

GCM OS may receive evidence from multiple sources.

Public Evidence

Examples:

Business websites

Google Business Profile

Search results

SEMrush

PageSpeed

Reviews

Social platforms

Public business records

Client Evidence

Examples:

Client emails

Client-provided documents

Screenshots

Business metrics

Sales information

Goals

Client confirmation

Meetings

Connected Evidence

Examples:

Google Analytics

Search Console

Google Ads

Meta Ads

CRM systems

Call tracking

Shopify

Other connected business systems

Evidence does not have to originate from AI to be valid.

8. DATA MODEL PRINCIPLE

GCM OS is a record-based operating system.

No single Business Record, Verified Business Record, report, dashboard, or AI response is the source of truth for the entire operating system.

Different durable records own different information.

The system should preserve relationships between those records rather than forcing all information into one master object.

9. BUSINESS RECORD

The Business Record remains useful but is not the entire operating system.

Its responsibility is to preserve relatively durable understanding of a business.

Examples may include:

Business identity

Website

Contacts

Industry

Services

Market

Public presence

Verified business characteristics

The principle remains:

Collect information once. Use it everywhere.

Known business information should not require repeated manual entry.

Operational history belongs in the appropriate operational records rather than being forced into the Business Record.

10. OPERATIONAL RECORDS

Current GCM OS includes concepts such as:

Clients

Communications

Investigations

Work / Activities

Evidence

Outcomes

KPI History

Proof of Work

Mission Control

Historical Client Activity

Each record should have a clear responsibility.

Reports and dashboards read from operational records.

Reports do not replace those records.

11. CURRENT OPERATIONAL CYCLE

The active-client operational cycle is:

Communication / Evidence
        ↓
Understand What Happened
        ↓
Investigation When Warranted
        ↓
Work When Required
        ↓
Evidence / Measurement
        ↓
Outcome
        ↓
Proof of Work
        ↓
Client Intelligence / Reporting
        ↓
Client Communication
        ↓
Next Action

Not every communication requires work.

Not every piece of evidence represents completed work.

Not every investigation produces an immediate task.

The system must preserve these distinctions.

12. COMMUNICATIONS

Communications represent meaningful incoming or outgoing business communication.

Examples include:

Client emails

Screenshots

Requests

Questions

Reports

Alerts

Performance information

Communications may provide evidence.

Communications may require investigation.

Communications may lead to work.

Receiving a communication or automated report does not automatically constitute Proof of Work.

13. CURRENT COMMUNICATIONS ROAD TEST

The production Communications workflow has now been road-tested with real screenshots and real client communications.

The current flow is:

Select / Detect Client
        ↓
Paste Email Text and/or Upload Screenshot
        ↓
Generate Operational Decision
        ↓
Review Detected Client
        ↓
Review Analysis
        ↓
Determine Routing
        ↓
Accept & Save
        ↓
Communication Saved to D1
        ↓
Investigation Created When Selected

Verified production behavior includes:

Screenshot intake is functioning.

Workers AI is reading usable screenshot evidence.

Client identification and operational interpretation are functioning across tested SEMrush, Google Analytics, Google Merchant Center, and related communications.

Accepted communications are saving to D1.

Recent D1 communications are visible in the Communications interface.

Investigations created from accepted communications are present in the D1 investigations table.

The Communications road test demonstrated that many routine monitoring notices should remain historical communication evidence and should not automatically become corrective work.

Some communications correctly warrant investigation.

Road testing is being performed by comparing GCM OS output against the richer historical Proof of Work / TSV interpretation process.

Current production behavior allows the consultant to decide whether an investigation should be created.

The road test established an important operational rule:

A communication may create an Investigation, but an Investigation must not automatically become a Work Item.

The Investigation exists to determine whether action is actually required.

14. INVESTIGATIONS

An Investigation represents something that requires further understanding before the correct operational action is known.

Investigation is distinct from Work.

Examples may include:

Unexpected ranking movement

Performance decline

Client-reported issue

Technical anomaly

Conflicting evidence

Situation requiring verification

Investigation exists so GCM OS does not prematurely convert uncertainty into work.

Investigation Processing Principle

The Investigation stage must reproduce the useful consulting function that previously happened manually with ChatGPT after reviewing the Proof of Work / TSV evidence.

The consultant should be able to ask:

What should we do with this?

The system should then support a process such as:

Review Original Evidence
        ↓
Define Investigation Objective
        ↓
Determine What Must Be Checked
        ↓
Collect Additional Evidence
        ↓
Interpret the Evidence
        ↓
Record the Finding
        ↓
Decision
   ↙             ↘
No Action        Action Required
   ↓                  ↓
Resolve          Create Specific Work Item
Investigation          ↓
                  Perform Work
                       ↓
                  Capture Evidence / Result

An investigation may legitimately end with:

No issue confirmed

Monitoring only

More evidence required

Corrective work required

The existence of an investigation does not prove that work is necessary.

15. WORK / ACTIVITIES

Work represents actions performed to improve, correct, create, investigate, implement, optimize, or maintain something for a client.

Work should preserve enough information to later explain:

What was done

Why it was done

Who performed it

When it happened

Supporting evidence

Expected impact

Actual impact when known

Time invested

Completed work contributes to client history and may become Proof of Work.

Current D1 Work State

The D1 work_items table is already structured and linked to:

client_id

investigation_id

communication_id

It also contains fields for:

Title

Description

Category

Priority

Status

Owner

Expected impact

Actual impact

Started / completed timestamps

As of the verified 2026-07-25 production road test:

Existing Work Items: 0

This is expected because Investigation Processing has not yet been operationalized.

The next phase should create Work Items only after an investigation confirms that specific corrective work is required.

16. PROOF OF WORK

Proof of Work represents completed work and its value.

Receiving information is not automatically Proof of Work.

An automated report is not automatically Proof of Work.

Proof of Work should preserve enough structured intelligence to explain completed work later without reconstructing the original evidence from scratch.

The historical Proof of Work spreadsheet demonstrated the value of rich structured records.

Important historical fields included:

Date

Client

Category

Task

Why it matters

Evidence Link

Status

Impact

Owner

Time

Week Start

Entry ID

Notes

Duplicate

Priority

Win

Later Proof of Work records became richer.

For example, SEMrush Position Tracking records could preserve:

Exact keyword

Ranking movement

Current position

Previous position when available

Whether the keyword entered Top 10

Why the keyword matters

Business significance

Whether the change represents a win

Supporting evidence

The richness of these records is important because downstream client communication depends on the quality of upstream operational intelligence.

17. HISTORICAL PROOF OF WORK LESSON

Before GCM OS, the successful workflow was approximately:

Client Email / Screenshot
        ↓
ChatGPT Analysis
        ↓
Business Interpretation
        ↓
Rich TSV Proof of Work Record
        ↓
Proof of Work Spreadsheet
        ↓
Accumulated Client History
        ↓
Weekly / Monthly Reporting
        ↓
Client Communication

The important function performed by ChatGPT was not transcription.

It transformed evidence into useful business intelligence.

GCM OS should preserve this capability.

Investigation-to-Proof Consulting Loop

The road test clarified that the historical process also contained an important middle loop:

Initial Evidence / TSV
        ↓
Ask: What Is the Next Step?
        ↓
Investigate
        ↓
Perform the Correct Fix
        ↓
Create Follow-Up TSV / Proof Record
        ↓
Wait for Result / Continue Monitoring
        ↓
Use Completed Work + Result in Weekly Client Email

This is now a required GCM OS behavior.

The software should not reduce this consulting loop to a generic ticket system.

18. SCREENSHOT AND DOCUMENT INTAKE

Screenshot analysis is an intake mechanism.

It is not the complete intelligence system.

The objective is not merely:

Make AI read a screenshot.

The objective is:

Screenshot / Email
        ↓
Understand the Evidence
        ↓
Identify the Correct Client
        ↓
Understand What Happened
        ↓
Preserve Important Measurable Evidence
        ↓
Explain Why It Matters
        ↓
Determine Whether Investigation Is Required
        ↓
Determine Whether Work Is Required
        ↓
Preserve Results
        ↓
Support Future Client Reporting

OCR or vision accuracy alone does not define success.

The intelligence created from the evidence is what creates business value.

19. CLIENT REPORTING

Operational records must preserve enough structured intelligence to support high-quality client communication.

The historical Email Builder demonstrated the downstream requirement.

It could filter Proof of Work records using:

Client

Start Date

End Date

Completed Work

Wins

Group by Client

It could produce outputs including:

Client Email

Internal Summary

Proof of Work Digest

Future GCM OS reporting should preserve this capability through structured operational history.

20. CLIENT COMMUNICATION STANDARD

Client communications should communicate value rather than merely list activity.

A strong client summary should answer:

What work was completed?

Why does it matter?

What measurable evidence or result exists?

What happens next?

Communication Intelligence may change presentation for the audience.

It must not change the underlying facts.

The weekly client communication should be able to explain:

What issue or opportunity was identified

What was investigated

What corrective or growth work was performed

What evidence/result currently exists

What is still being monitored

What work is planned for the week ahead

21. MISSION CONTROL

Mission Control is the operational starting point.

Its responsibility is to answer:

What needs my attention?

Mission Control should direct the user toward the appropriate operational record or workspace.

Mission Control does not own the underlying business information.

It reads from operational records.

Priority should remain understandable and useful rather than over-engineered.

Current Work Connection

Mission Control is now connected to the production Work Queue.

The left navigation Work link and the Open full work queue → link in today.html both route to:

work.html

This connection was deployed and verified in production.

22. BUSINESS / CLIENT WORKSPACE PRINCIPLE

A business should accumulate history rather than being recreated as it progresses through the GCM relationship.

The operating system should preserve continuity from prospect through client relationship.

For active clients, the workspace should make it possible to understand:

What do we know?

What needs attention?

What is being investigated?

What work is active?

What has been completed?

What results have been measured?

What value has been created?

What should happen next?

The workspace organizes operational information.

It does not replace the underlying records.

23. PROSPECTING

Prospecting belongs to the Acquire pillar.

The purpose of prospect intelligence is not merely to generate reports.

It should help answer:

Who should I call next, and why?

Prospect qualification is prioritization, not sales prediction.

GCM OS should not invent:

Sales probability

Budget

Willingness to buy

Client intent

Prospect qualification may consider:

Opportunity

Engagement

Potential business value

Unknown information remains unknown.

One highest-value next action should be clear.

24. CONSULTING CAPABILITIES

Capabilities exist to answer useful consulting questions.

Examples include:

Website Intelligence

Contact Intelligence

Public Presence Intelligence

Google Presence Intelligence

SEO Intelligence

Reputation Intelligence

Business Value Intelligence

A capability should exist because it improves a real consulting or operational decision.

Capabilities do not exist merely because the technology can support them.

25. ARTIFICIAL INTELLIGENCE

GCM OS is AI-assisted.

AI is not the product.

AI should assist with responsibilities such as:

Evidence interpretation

Information extraction

Classification

Research

Operational analysis

Consulting intelligence

Communication

Drafting

Identifying missing information

AI output must remain distinguishable from verified factual evidence.

AI should not invent missing facts.

AI architecture should remain modular where that improves reliability and maintainability.

The Worker is an orchestration/execution layer, not the consulting methodology itself.

26. 90-DAY GROWTH REVIEW

The 90-Day Growth Review remains an important paid consulting deliverable.

It is not the architectural center of the entire Agency Operating System.

Its purpose is to transform available verified business intelligence into consulting clarity.

The core principle is:

Find the Leak. Fix the Leak. Prove the Result.

The client is paying for clarity, not page count.

A strong Growth Review should explain:

Where the business is today

What matters most

What should be improved first

Why it matters

What evidence supports the conclusion

How improvement should be measured

What should happen next

For prospects, the Growth Review may rely heavily on public evidence.

For existing clients, it may use richer verified operational history already contained within GCM OS.

27. BUSINESS SNAPSHOT

The Business Snapshot remains a prospect-facing entry product.

Its role is to demonstrate consulting value using available observable evidence.

It should not attempt to replace the deeper consulting engagement.

The Snapshot belongs primarily to the Acquire pillar.

28. REPORTS AND DELIVERABLES

Reports are outputs.

They are not the operational source of truth.

Examples include:

Business Snapshot

90-Day Growth Review

Weekly Client Email

Monthly Summary

Proof of Work Digest

Executive Summary

Proposal

Case Study

Reports should be generated from durable operational intelligence whenever practical.

29. CONTINUOUS IMPROVEMENT

The operating cycle is:

Evidence
   ↓
Understand
   ↓
Recommend / Investigate
   ↓
Implement
   ↓
Measure
   ↓
Learn
   ↓
Improve

New evidence should improve the understanding of the business without destroying historical context.

30. PRODUCTION INFRASTRUCTURE

Current GCM OS production infrastructure includes:

Browser-based application

GitHub repository

GitHub Pages application hosting

Cloudflare Worker

Cloudflare D1

Cloudflare Workers AI

Cloudflare Images

Current Cloudflare bindings are:

AI = Workers AI
DB = D1
IMAGES = Cloudflare Images

Production application repository:

globalconceptsmediallc-oss/gcm-operating-system-app

Production GitHub Pages application:

https://globalconceptsmediallc-oss.github.io/gcm-operating-system-app/

Production Worker:

gcm-business-intelligence-worker

31. WRANGLER.TOML — PRODUCTION RULE

wrangler.toml is part of the production architecture.

Cloudflare bindings required by production must be declared in wrangler.toml.

A dashboard-only binding is not sufficient when Git deployment can replace deployment configuration.

This was verified when the Cloudflare Images binding disappeared after Git deployments because IMAGES had not been declared in wrangler.toml.

The current wrangler.toml contains:

AI

DB

IMAGES

That issue is considered resolved.

Do not reopen it unless new production evidence demonstrates a problem.

32. AUDITED REPOSITORY AND PRODUCTION STATE

The repository was audited file-by-file before this Master update.

Verified current production infrastructure and operational code include:

worker.js — 7.1.0 — lightweight production router.

shared/config.js — 7.1.1 — production constants, actions, and AI model configuration.

shared/ai.js — 7.0.1 — Workers AI execution, retry, timeout, JSON parsing, diagnostics, and stage results.

shared/database.js — 7.0.0 — D1 binding and operational database helpers.

shared/http.js — 7.0.0 — HTTP, normalization, and Worker diagnostics.

routes/missionControl.js — 7.1.0 — live clients-requiring-attention retrieval.

Operational routes exist for communication analysis, client workspace retrieval, and reviewed operational-decision commits.

wrangler.toml declares the AI, IMAGES, and DB bindings.

D1 database name: gcm-operating-system.

Production Worker name: gcm-business-intelligence-worker.

The current Worker exposes these operational actions:

analyze-client-communication

get-client-workspace

commit-operational-decision

get-mission-control

The current Worker explicitly identifies these older pipelines as removed from the production Worker:

business-snapshot

client-pre-research

website-intelligence

html-intelligence

prospect-qualification

This distinction is important: some files supporting those earlier pipelines remain in the repository, but their presence does not mean they are part of the current production Worker.

Current Communications AI Configuration

The audited configuration uses:

Communication vision model: @cf/meta/llama-3.2-11b-vision-instruct

Communication reasoning model: @cf/openai/gpt-oss-20b

The one-time Meta model license/AUP activation issue was resolved during the road test.

Screenshot extraction and downstream communication analysis are now functioning in production for the tested communication types.

Mission Control — Current Verified Rule

Mission Control identifies clients requiring attention from unresolved:

Investigations

Work Items

Each client appears once and links to that client's workspace.

Mission Control is therefore reading operational state rather than owning it.

Work Queue — Current Verified Production State

New production file:

work.html — 1.0.2 — production read-only Investigation / Work Queue.

Verified production behavior:

Connected from Mission Control navigation.

Reads live client attention state using the existing get-mission-control action.

Reads the associated client workspaces using the existing get-client-workspace action.

Loads 23 open investigations across 7 clients from production D1.

Shows the originating communication and investigation context.

Displays priority, status, assigned owner, investigation description, recommendation, and current finding.

Automatically opens the highest-priority investigation.

Client filter is built from live Mission Control data.

The earlier failed client-workspace request caused by hard-coded client guesses was removed.

Full Mission Control navigation shell is present.

Current state is intentionally read-only.

Verified D1 state at this checkpoint:

Open Investigations: 23
Clients With Open Investigations: 7
Existing Work Items: 0
Evidence Records: 0

The D1 schema already contains and links:

communications

investigations

work_items

evidence

activity_records

alerts

measurements

clients

client_baselines

No new table is currently required for the next phase.

Audited Legacy / Prototype Repository Material

The repository still contains older or non-production material from previous GCM OS generations, including prospecting, Business Snapshot, Growth Intelligence, Consulting Knowledge, Growth Review, parser/configuration, and related presentation files.

Examples include:

business-snapshot.html

business-snapshot-results.html

client-pre-research.html

processing.html

prospects.html

prospect-workspace.html

growth-intelligence-engine.js

consulting-knowledge.js

growth-review-generator.js

growth-review-presentation.js

growth-review-renderer.js

older root config.js

older root parser.js

older prompt definitions

website/code/html intelligence engines, prompts, tests, and GitHub test workflows

These files must not be assumed to be current production architecture merely because they remain in the repository.

They should be retained, updated, or removed only through the one-file-at-a-time audit process.

Files Removed During This Audit

Verified deletions during the audit include:

empty helper.js

obsolete root ui.js

obsolete browser test pages including consulting-knowledge-test.html and the reviewed Growth Intelligence / Growth Review test pages

Deletion of a test page does not by itself mean its underlying engine has been deleted.

Parser Duplication Identified

The audit found two AI JSON parsing implementations:

lib/aiResponseParser.js

parsing logic inside shared/ai.js

This is a verified duplication/overlap requiring a later deliberate decision.

Do not consolidate or delete either implementation merely because duplication exists. First determine which current or retained engines depend on each one.

Test / Workflow Drift Identified

The repository contains automated test infrastructure for website, code, and HTML intelligence, while the audited package.json directly exposes Website Intelligence and Code Intelligence test scripts.

This reflects historical capability development and may not match the current production Worker.

Tests and workflows should therefore be evaluated with the capability they protect rather than treated automatically as current production dependencies.

33. ENGINEERING GOVERNANCE

Engineering should minimize technical and business risk.

Permanent working principles include:

Business value drives decisions.

Evidence before assumptions.

One responsibility per component where practical.

Build one production change at a time.

Test before continuing.

Review current production before modifying it.

Do not break working features without demonstrated reason.

Avoid unnecessary complexity.

Do not add features simply because they are technically interesting.

Production changes follow:

Understand
   ↓
Define Success
   ↓
Change
   ↓
Deploy
   ↓
Test
   ↓
Verify
   ↓
Lock

34. DEVELOPMENT STANDARD

Andy is not a coder.

ChatGPT is responsible for helping control technical risk and direction.

Technical work should therefore:

Explain why a change is necessary.

Define what success looks like before changing production.

Avoid experimental paths without a clear reason.

Provide complete fresh-install replacement files when code changes are required.

Avoid partial patches or unexplained insertion snippets.

Make one change at a time unless Andy explicitly asks to bundle closely related fixes.

Verify the result before proceeding.

Do not ask Andy to rediscover files, routes, architecture, hosting, or configuration that were already established by the completed audit unless a specific current production file is genuinely required and is not available.

Mandatory Production File Version Header

Every production file must contain a clear installed-version header near the top of the file.

At minimum the header must identify:

Global Concepts Media Operating System
File: <filename>
Version: <version>
Status: Production

Use the correct comment syntax for the file type.

Example for HTML:

<!-- =========================================================
   Global Concepts Media Operating System
   File: work.html
   Version: 1.0.2
   Status: Production
   ========================================================= -->

This rule exists so the installed version can be identified quickly during:

Audits

Road tests

Debugging

Deployments

Handoffs

Future production replacement files must include this header before they are delivered for deployment.

35. DESIGN PRINCIPLES

GCM OS is a professional operating environment.

The interface should prioritize:

Clarity

Confidence

Simplicity

Consistency

Productivity

Decision making

Every screen should make the correct next action understandable.

Desktop is the primary working environment.

Visual complexity should not be introduced without operational value.

New operational pages should visually belong to the existing Mission Control application shell rather than introduce a competing interface style.

36. REPOSITORY PRINCIPLE

Repository responsibilities should remain clear.

Avoid duplicate authoritative documentation and duplicate functionality.

The GCM OS application repository owns operational execution of the Agency Operating System.

Other repositories may preserve specialized standards, methodology, marketing assets, or acquisition methodology where appropriate.

Methodology and operational execution should not be confused.

37. DOCUMENTATION AUTHORITY

This Master replaces the practice of requiring a new development session to interpret multiple generations of architecture before work can begin.

Older Markdown documents may remain for:

Historical reference

Specialized methodology

Supporting detail

But they do not override this Master when they conflict with it.

The Markdown audit identified multiple historical generations of GCM OS documentation.

Older statements such as these should not automatically be treated as current architecture:

Business Record is the single source of truth for all GCM OS.

Verified Business Record is the single source of truth for all GCM OS.

Every capability exists only to improve the 90-Day Growth Review.

Every business must follow one rigid linear workflow.

Reports or Markdown files are the permanent operational record.

The 90-Day Growth Review is the architectural center of GCM OS.

These statements reflect earlier stages of development.

38. HANDOFF STANDARD

A new GCM OS development thread should begin with this file.

The handoff instruction is:

Read GCM_OS_MASTER.md completely before proposing changes. It is the current authority for GCM OS. Do not rely on older architecture that conflicts with it. Use the completed file-by-file audit and current production state already recorded here. Do not ask Andy to reconstruct files or architecture that were already established unless a specific current production file is genuinely required for the next change. Review the actual production file involved in the current task before changing it. If production evidence conflicts with the Master, identify the conflict before changing either one.

This allows a new development session to understand:

What GCM OS is

Why it exists

How the agency operates

What records matter

How evidence is handled

How client work becomes Proof of Work

How reporting works

What infrastructure exists

What engineering rules apply

What production task is currently active

without reconstructing the entire project from old conversations.

Handoff Update Timing Rule

Do not continuously rewrite this Master during active development.

Update it at meaningful handoff checkpoints when:

A production capability has been verified.

A governing rule has changed.

Important production evidence changes the known system state.

The next development thread needs a new authoritative starting point.

This reduces development drag while preserving reliable handoffs.

39. CURRENT AUDIT STATUS

The repository discovery pass and file-by-file audit have been completed.

Do not restart repository discovery as the default response to a new task.

The audit has already:

Consolidated current architecture and operating rules into this Master.

Reviewed the repository one file at a time.

Identified current operational production code.

Identified historical, prototype, and potentially obsolete files requiring deliberate disposition.

Removed several files that were confirmed unnecessary.

Verified the current Cloudflare binding structure.

Identified parser duplication and test/workflow drift.

Confirmed that repository presence alone does not establish production responsibility.

Road-tested the Communications workflow with real client evidence.

Verified D1 Communication and Investigation persistence.

Verified the existing D1 Work Item and Evidence schemas.

Built, connected, deployed, and verified the production Work Queue.

The audit is not permission to mass-delete or mass-rewrite the repository.

For any future cleanup or production change:

Review the specific file and its dependencies.

Determine whether it is CURRENT, LEGACY/REFERENCE, or OBSOLETE.

Compare it with this Master and current production behavior.

Agree on the decision.

Change only that file or the smallest required dependency set.

Deploy when applicable.

Test.

Verify before continuing.

Do not redesign the system during cleanup.

40. CURRENT BUSINESS SUCCESS CONDITION

GCM OS is operational when Global Concepts Media can reliably:

Receive Client Communication / Evidence
        ↓
Understand What Happened
        ↓
Investigate When Necessary
        ↓
Perform the Correct Work
        ↓
Preserve Evidence and Results
        ↓
Create Useful Proof of Work
        ↓
Accumulate Client Intelligence
        ↓
Generate Strong Client Communications
        ↓
Know What Needs Attention Next

At the same time, the system must support prospecting and client acquisition.

The ultimate success condition is:

Global Concepts Media spends the majority of its time acquiring clients, performing valuable client work, communicating measurable value, and growing the business rather than continually building its operating system.

41. CURRENT PRODUCTION HANDOFF — 2026-07-25

This section is the authoritative starting point for the next development thread.

Verified Production State

Communications intake and persistence are operational enough to continue the end-to-end road test.

Production Work Queue:

File: work.html
Version: 1.0.2
Status: Production

Verified road-test result:

Open Investigations: 23
Clients With Open Investigations: 7
Existing Work Items: 0
Evidence Records: 0

work.html v1.0.2:

Is connected to Mission Control.

Reads live production D1 state.

Lists open investigations.

Filters by client.

Opens the highest-priority investigation automatically.

Displays originating communication context.

Displays investigation description and recommendation.

Displays current finding when present.

Is intentionally read-only at this checkpoint.

Uses existing Worker actions rather than creating duplicate routes.

Has the required production file/version/status header installed.

The previous Work page issue where one guessed client workspace request failed was corrected by using live Mission Control client discovery instead of a hard-coded client list.

Current Phase

Investigation Processing

This is the next development phase.

Do not skip directly from Investigation to Work Item creation.

The system must first recreate the useful consultant-guided process that historically happened after reviewing a Proof of Work / TSV entry.

The processing loop is:

Original Communication / Evidence
        ↓
Understand the Signal
        ↓
Define What Must Be Investigated
        ↓
Guide the Consultant Through the Checks
        ↓
Capture Additional Evidence
        ↓
Record the Finding
        ↓
Decision
   ↙             ↘
No Action        Action Required
   ↓                  ↓
Resolve          Create Specific Work Item
Investigation          ↓
                  Perform Work
                       ↓
                  Record What Was Done
                       ↓
                  Capture Evidence / Result
                       ↓
                  Proof of Work
                       ↓
                  Weekly / Client Communication
                       ↓
                  Continue Monitoring When Appropriate

First Road-Test Candidate

Use a real existing investigation rather than synthetic data.

Current first candidate:

Client: A1 Action Safe & Lock
Investigation: #21
Communication: #26
Title: SEMrush Position Tracking — Ranking Change Review

The road test should answer:

What exactly should be checked to determine whether the ranking decline represents a real business/search visibility problem, and what evidence is needed before corrective work is created?

Expected investigation logic includes:

Verify whether the observed keyword decline is isolated or persistent.

Evaluate the commercially important tracked keywords rather than treating every keyword equally.

Cross-check another source such as Search Console, Analytics, GBP, or other available evidence.

Diagnose cause only if a meaningful decline is confirmed.

Create a Work Item only for a specific confirmed corrective action.

Record the work performed.

Preserve evidence/results.

Continue monitoring where results require time.

Make the completed work and results available for weekly client communication.

Next Development Success Condition

The next Investigation Processing capability should allow an open investigation to move from:

Open Investigation

to a documented consultant finding and operational decision:

No Action / Monitoring

or:

Specific Work Required

without prematurely creating Work Items.

Do not redesign the D1 data model unless the road test demonstrates that the existing structure cannot support the required process.

42. MASTER UPDATE RULE

This document is authoritative, but it is not allowed to ignore verified reality.

As GCM OS develops:

If verified production evidence confirms the Master:

No change is required.

If verified production evidence adds important missing information:

Update the Master at the next meaningful handoff checkpoint.

If verified production evidence conflicts with the Master:

Stop and determine which represents the intended current system before changing production.

If obsolete implementation conflicts with the Master:

Do not automatically change the Master to match obsolete code.

Determine whether the code or the Master represents the agreed architecture.

Production evidence informs architecture.

It does not automatically dictate architecture.

43. GUIDING PRINCIPLE

GCM OS exists to make Global Concepts Media easier to operate and easier to grow.

The system should preserve knowledge, reduce repeated work, improve decisions, prove value, and make the next important action clear.

Technology serves the agency.

The agency does not serve the technology.
