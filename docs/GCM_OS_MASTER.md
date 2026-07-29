GCM_OS_MASTER.md

Version: 1.2.0 Status: Authoritative Production Handoff

Completed This Thread

Operational Reviews

Implemented Operational Reviews as the approval bridge betweenCommunications and Media.

One Operational Review is created per Media Instruction.

Human approval is required before Media records are updated.

Production Schema

Confirmed production schema uses: - confirmation_received_at -confirmation_communication_id

The obsolete confirmed_at column is not used.

Road Test Results

Successfully completed an end-to-end road test:

Communication → Operational Review → Human Approval → Media Update

Results: - Communications saved correctly. - Operational Reviews createdsuccessfully. - Reviews matched to Media Instructions. - Media approvalsupdated production records. - One orphan approval exposed the historicalconfirmed_at bug and was repaired. - media_records andmedia_instructions are synchronized.

Outstanding Investigation

Investigation #22

Media Dashboard "Needs Attention" Query

Observed: - Dashboard displayed a placement whose database record had: -attention_status = clear - confirmation_status = confirmed -traffic_status = sent

Conclusion: - Workflow is operational. - Remaining defect is in thedashboard query, not the operational workflow.

UI Standards Adopted

Display business objects before database identifiers.

Example:

Preferred: - WMMB --- Pre-Loved Safes - Extend through Aug 31, 2026

Secondary metadata: - Communication ID - Review ID - Instruction ID

Current Production State

Operational pipeline:

Email → Communication → Operational Review → Human Approval → MediaUpdate → Dashboard

Next Thread

Read this Master completely.

Continue from the completed Media road test.

Investigation #22: Audit and correct the Media "Needs Attention"query.

After the query passes road test: Implement Media UI improvementsdiscovered during testing.
