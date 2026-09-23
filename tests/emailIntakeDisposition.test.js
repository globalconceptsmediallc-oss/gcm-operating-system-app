/* =========================================================
   Global Concepts Media Operating System
   File: tests/emailIntakeDisposition.test.js
   Version: 1.3.0
   Status: Production Regression Test
   Purpose:
   Verify no-action confirmation, Information routing, and Monitoring
   Proof/history routing for durable Universal Email Intake records.
   ========================================================= */

import assert from "node:assert/strict";
import {
  handleEmailIntakeDisposition,
  EMAIL_INTAKE_DISPOSITION_VERSION
} from "../routes/emailIntakeDisposition.js";

assert.equal(EMAIL_INTAKE_DISPOSITION_VERSION,"1.3.0");

function makeDeleteDb(record) {
  const state={ updateSql:"", updateCount:0, selects:0 };
  return {
    state,
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              state.selects += 1;
              return record;
            },
            async run() {
              state.updateSql=sql;
              state.updateCount += 1;
              return {meta:{changes:1}};
            }
          };
        }
      };
    }
  };
}

{
  const DB=makeDeleteDb(null);
  const response=await handleEmailIntakeDisposition(
    {intakeId:1,workspaceKey:"gcm",disposition:"delete"},
    {DB},
    "unconfirmed"
  );
  const payload=await response.json();
  assert.equal(response.status,400);
  assert.match(payload.error,/Explicit confirmation/i);
  assert.equal(DB.state.selects,0);
  assert.equal(DB.state.updateCount,0);
}

{
  const DB=makeDeleteDb({
    id:1,
    processing_status:"ready_for_review",
    disposition:null,
    communication_id:null,
    activity_record_id:null,
    investigation_id:null,
    work_item_id:null
  });
  const response=await handleEmailIntakeDisposition(
    {
      intakeId:1,
      workspaceKey:"gcm",
      disposition:"delete",
      confirmed:true,
      confirmation:"delete-no-action-required"
    },
    {DB},
    "confirmed-delete"
  );
  const payload=await response.json();
  assert.equal(response.status,200);
  assert.equal(payload.disposition,"delete");
  assert.equal(payload.communicationsCreated,0);
  assert.equal(payload.investigationsCreated,0);
  assert.equal(payload.workItemsCreated,0);
  assert.doesNotMatch(DB.state.updateSql,/DELETE\s+FROM/i);
}

function makeInformationDb() {
  const intake={
    id:2,
    workspace_key:"gcm",
    received_at:"2026-09-23T14:18:49.000Z",
    from_address:"globalconceptsmediallc@gmail.com",
    from_name:"Andy Belcher",
    subject:"GCM OS Information Route Test",
    body_text:"This is a test communication that should be saved as Information only.",
    processing_status:"ready_for_review",
    disposition:null,
    client_id:null,
    communication_id:null,
    activity_record_id:null,
    investigation_id:null,
    work_item_id:null
  };
  const client={id:10,client_code:"GCM",name:"Global Concepts Media"};
  const state={sql:[],communicationInserted:false,intakeUpdated:false};

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
              if (/FROM communications/i.test(sql)) {
                return state.communicationInserted ? {id:501} : null;
              }
              return null;
            },
            async run() {
              if (/INSERT INTO communications/i.test(sql)) {
                state.communicationInserted=true;
                return {meta:{changes:1}};
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

{
  const DB=makeInformationDb();
  const response=await handleEmailIntakeDisposition(
    {
      intakeId:2,
      workspaceKey:"gcm",
      disposition:"information",
      clientId:10
    },
    {DB},
    "information"
  );
  const payload=await response.json();
  assert.equal(response.status,200);
  assert.equal(payload.ok,true);
  assert.equal(payload.disposition,"information");
  assert.equal(payload.communicationId,501);
  assert.equal(payload.communicationsCreated,1);
  assert.equal(payload.activityRecordsCreated,0);
  assert.equal(payload.investigationsCreated,0);
  assert.equal(payload.workItemsCreated,0);
  assert.equal(DB.state.communicationInserted,true);
  assert.equal(DB.state.intakeUpdated,true);
  const allSql=DB.state.sql.join("\n");
  assert.match(allSql,/INSERT INTO communications/i);
  assert.doesNotMatch(allSql,/INSERT INTO investigations/i);
  assert.doesNotMatch(allSql,/INSERT INTO work_items/i);
  assert.doesNotMatch(allSql,/INSERT INTO activity_records/i);
}

{
  const DB=makeInformationDb();
  const response=await handleEmailIntakeDisposition(
    {intakeId:2,workspaceKey:"gcm",disposition:"information"},
    {DB},
    "information-no-client"
  );
  assert.equal(response.status,400);
  assert.equal(DB.state.sql.length,0);
}

function makeMonitoringDb() {
  const intake={
    id:3,
    workspace_key:"gcm",
    received_at:"2026-09-23T14:40:00.000Z",
    from_address:"reports@example.com",
    from_name:"Monitoring Test",
    subject:"GCM OS Monitoring Route Test",
    body_text:"This is trend evidence only.",
    processing_status:"ready_for_review",
    disposition:null,
    client_id:null,
    communication_id:null,
    activity_record_id:null,
    investigation_id:null,
    work_item_id:null
  };
  const client={id:10,client_code:"GCM",name:"Global Concepts Media"};
  const state={sql:[],activityInserted:false,intakeUpdated:false};

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
              if (/FROM activity_records/i.test(sql)) {
                return state.activityInserted ? {id:701} : null;
              }
              return null;
            },
            async run() {
              if (/INSERT INTO activity_records/i.test(sql)) {
                state.activityInserted=true;
                return {meta:{changes:1,last_row_id:701}};
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

{
  const DB=makeMonitoringDb();
  const response=await handleEmailIntakeDisposition(
    {
      intakeId:3,
      workspaceKey:"gcm",
      disposition:"monitoring",
      clientId:10
    },
    {DB},
    "monitoring"
  );
  const payload=await response.json();
  assert.equal(response.status,200);
  assert.equal(payload.ok,true);
  assert.equal(payload.disposition,"monitoring");
  assert.equal(payload.activityRecordId,701);
  assert.equal(payload.communicationsCreated,0);
  assert.equal(payload.activityRecordsCreated,1);
  assert.equal(payload.investigationsCreated,0);
  assert.equal(payload.workItemsCreated,0);
  assert.equal(DB.state.activityInserted,true);
  assert.equal(DB.state.intakeUpdated,true);
  const allSql=DB.state.sql.join("\n");
  assert.match(allSql,/INSERT INTO activity_records/i);
  assert.doesNotMatch(allSql,/INSERT INTO communications/i);
  assert.doesNotMatch(allSql,/INSERT INTO investigations/i);
  assert.doesNotMatch(allSql,/INSERT INTO work_items/i);
}

console.log("PASS Universal Email Intake no-action safety, Information routing, and Monitoring Proof/history routing");
