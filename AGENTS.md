# GCM Operating System — Repository Instructions

These instructions apply to the entire repository.

## Purpose

Build GCM OS as an AI-supported operating partner for Andy—not as a rigid rules engine. The system must help identify what matters, improve clients, preserve evidence, recommend the next action, and support sound human judgment.

## Working Method

- Work on one page and one proven problem at a time.
- Inspect the existing repository and production flow before proposing changes.
- Diagnose and explain the root cause before coding.
- Do not begin another phase until the current change is deployed and verified.
- Use Fix → Build → Deploy → Test.
- Do not replace human judgment with arbitrary workflow gates.
- Do not ask Andy to repeat information that is already available in the repository, current thread, or supplied evidence.

## Data and Evidence

- Production D1 data is important and must be preserved.
- Never delete, rewrite, or migrate production records without explicit approval.
- Correct client attribution must be proven before information appears in Today, Work, Investigations, Proof, or client records.
- Never infer a client from keywords alone when stronger identifiers are available.
- Separate source facts from AI interpretation, recommendations, and decisions.
- Evidence should support better client outcomes—not merely document activity.
- Historical evidence must remain available when it provides useful context.
- Do not create investigations or work items unless the evidence supports a real decision or action.

## Screenshot Rule

If Andy still needs to upload a screenshot into GCM OS, do not ask him to send that only copy into ChatGPT first. Once sent, it may no longer be available to him for the investigation. Analyze a duplicate or recreate a downloadable copy when necessary.

## Code Delivery

- Andy is not a coder. Explain actions in plain language.
- Provide complete consolidated files, not patch fragments.
- Do not create temporary fixes when a permanent correction is practical.
- Every code file must include a visible filename and installed version header.
- Increment the version whenever a file changes.
- Preserve working production behavior unless the approved task requires changing it.
- Test client identity, data writes, navigation, errors, empty states, and mobile behavior.
- Do not rename repositories, Workers, databases, bindings, routes, or production resources without explicit approval.

## Rebuild Direction

- Rebuild GCM OS page by page.
- AI should analyze evidence and recommend action; deterministic code should enforce security, data integrity, and permissions.
- Today must show the correct client, the actual business issue, why it matters, supporting evidence, and the recommended next action.
- Raw notifications and long data dumps must not be presented as executive decisions.
- The system should make Andy and the agency more effective before attempting to become a product for other agencies.

## Approval Boundary

Before making material changes:

1. State the proven problem.
2. State the proposed permanent correction.
3. Identify affected files, data, and production risks.
4. Wait for Andy’s approval.
5. Build, deploy, and verify one controlled change.
