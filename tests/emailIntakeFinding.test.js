/* =========================================================
   Global Concepts Media Operating System
   File: tests/emailIntakeFinding.test.js
   Version: 1.4.0
   Status: Production Regression Test
   Purpose:
   Verify human-reviewed Signal Findings save useful business details while
   preserving source evidence and creating no Proof/Communication/Work noise.
   ========================================================= */

import fs from "node:fs";
import assert from "node:assert/strict";
import {
  handleEmailIntakeFinding,
  EMAIL_INTAKE_FINDING_VERSION
} from "../routes/emailIntakeFinding.js";

assert.equal(EMAIL_INTAKE_FINDING_VERSION,"1.0.0");

function makeDb() {
  const intake = {
    id:9,
    workspace_key:"gcm",
    received_at:"2026-09-08T14:46:46.000Z",
    source_date:"2026-09-08",
    from_address:"sc-noreply@google.com",
    from_name:"Google Search Console Team",
    subject:"Your August Search performance for https://sesafes.com/",
    body_text:"Source email remains evidence.",
    processing_status:"ready_for_review",
    disposition:null,
    client_id:null,
    finding_id:null,
    communication_id:null,
    activity_record_id:null,
    investigation_id:null,
    work_item_id:null
  };
  const client = {id:1,client_code:"SES",name:"Southeast Safes"};
  const state = {
    sql:[],
    findingInserted:false,
    intakeUpdated:false
  };

  return {
    state,
    prepare(sql) {
      state.sql.push(sql);
      return {
        bind() {
          return {
            async first() {
              if (/FROM email_intake/i.test(sql)) return intake;
              if (/FROM clients/i.test(sql)) return client;
              if (/FROM client_findings/i.test(sql)) {
                return state.findingInserted ? {id:1201} : null;
              }
              return null;
            },
            async run() {
              if (/INSERT INTO client_findings/i.test(sql)) {
                state.findingInserted=true;
                return {meta:{changes:1,last_row_id:1201}};
              }
              if (/UPDATE email_intake/i.test(sql)) {
                state.intakeUpdated=true;
                return {meta:{changes:1}};
              }
              return {meta:{changes:0}};
            }
          };
        }
      };
    }
  };
}

const DB = makeDb();
const response = await handleEmailIntakeFinding(
  {
    intakeId:9,
    workspaceKey:"gcm",
    clientId:1,
    reportingPeriod:"August 2026",
    details:"1.68K clicks; 149K impressions; Centurion 12 +106 clicks.",
    analysis:"Centurion demand is a meaningful positive signal.",
    decision:"Compare with July, prior quarter, and prior year before creating corrective work."
  },
  {DB},
  "finding-test"
);

const payload = await response.json();
assert.equal(response.status,200);
assert.equal(payload.ok,true);
assert.equal(payload.findingId,1201);
assert.equal(payload.findingsCreated,1);
assert.equal(payload.evidenceRetained,true);
assert.equal(payload.communicationsCreated,0);
assert.equal(payload.activityRecordsCreated,0);
assert.equal(payload.investigationsCreated,0);
assert.equal(payload.workItemsCreated,0);
assert.equal(DB.state.findingInserted,true);
assert.equal(DB.state.intakeUpdated,true);

const allSql = DB.state.sql.join("\n");
assert.match(allSql,/INSERT INTO client_findings/i);
assert.match(allSql,/finding_id/i);
assert.doesNotMatch(allSql,/INSERT INTO communications/i);
assert.doesNotMatch(allSql,/INSERT INTO activity_records/i);
assert.doesNotMatch(allSql,/INSERT INTO investigations/i);
assert.doesNotMatch(allSql,/INSERT INTO work_items/i);

const migration = fs.readFileSync(new URL("../migrations/0019_client_findings.sql", import.meta.url),"utf8");
assert.match(migration,/CREATE TABLE IF NOT EXISTS client_findings/i);
assert.match(migration,/ADD COLUMN finding_id/i);

const ui = fs.readFileSync(new URL("../shared/today-email-intake.js", import.meta.url),"utf8");
assert.match(ui,/Ready for Review/);
assert.match(ui,/Details to preserve/);
assert.match(ui,/What we learned/);
assert.match(ui,/Decision \/ next action/);
assert.match(ui,/Save Finding/);
assert.match(ui,/function inferClientId\(record\)/);
assert.match(ui,/function inferReportingPeriod\(record\)/);
assert.match(ui,/normalizeHost\(client\?\.website\)/);
assert.match(ui,/reporting\\s\*period/);
assert.match(ui,/monthOnlyPattern/);
assert.match(ui,/record\?\.sourceDate \|\| record\?\.receivedAt/);
assert.match(ui,/Number\(client\?\.id\) > 0/);
assert.doesNotMatch(ui,/\["active","prospect"\]\.includes/);
assert.match(ui,/const semrushDate = body\.match/);

const semrushBackfill = fs.readFileSync(new URL("../migrations/0022_backfill_sep8_semrush_position_tracking.sql", import.meta.url),"utf8");
assert.match(semrushBackfill,/1a082647a959b2ef/);
assert.match(semrushBackfill,/1a082647b8075515/);
assert.match(semrushBackfill,/1a082647bb5c6909/);
assert.match(semrushBackfill,/ready_for_review/);

const backfill = fs.readFileSync(new URL("../migrations/0020_backfill_sep8_search_console_reports.sql", import.meta.url),"utf8");
assert.match(backfill,/gmail_historical_backfill/);
assert.match(backfill,/1a081833c779f1c4/);
assert.match(backfill,/1a0818419adeb7b8/);
assert.match(backfill,/1a081842d018fd10/);
assert.match(backfill,/1a081878af21cf2c/);
assert.match(backfill,/ready_for_review/);
assert.doesNotMatch(ui,/Save as Monitoring/);
assert.doesNotMatch(ui,/Start Investigation/);
assert.doesNotMatch(ui,/Create Work Item/);

console.log("PASS Signal Review saves human-reviewed client findings and keeps Today title-first");
