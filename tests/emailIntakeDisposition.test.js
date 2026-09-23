/* =========================================================
   Global Concepts Media Operating System
   File: tests/emailIntakeDisposition.test.js
   Version: 1.1.0
   Status: Production Regression Test
   Purpose:
   Verify Delete — No Action Required requires explicit confirmation, preserves
   email evidence, creates no downstream OS records, is duplicate-safe, and
   never deletes the D1 row.
   ========================================================= */

import assert from "node:assert/strict";
import { handleEmailIntakeDisposition, EMAIL_INTAKE_DISPOSITION_VERSION } from "../routes/emailIntakeDisposition.js";

assert.equal(EMAIL_INTAKE_DISPOSITION_VERSION,"1.1.0");

function makeDb(record) {
  const state={ updateSql:"", updateArgs:[], updateCount:0, selects:0 };

  return {
    state,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              state.selects += 1;
              return record;
            },
            async run() {
              state.updateSql=sql;
              state.updateArgs=args;
              state.updateCount += 1;
              return { meta:{ changes:1 } };
            }
          };
        }
      };
    }
  };
}

{
  const DB=makeDb(null);
  const response=await handleEmailIntakeDisposition(
    {action:"route-email-intake-disposition",intakeId:1,workspaceKey:"gcm",disposition:"delete"},
    {DB},
    "test-unconfirmed"
  );
  const payload=await response.json();
  assert.equal(response.status,400);
  assert.match(payload.error,/Explicit confirmation/i);
  assert.equal(DB.state.selects,0);
  assert.equal(DB.state.updateCount,0);
}

{
  const DB=makeDb({
    id:1,
    processing_status:"ready_for_review",
    disposition:null,
    communication_id:null,
    activity_record_id:null,
    investigation_id:null,
    work_item_id:null
  });

  const response=await handleEmailIntakeDisposition(
    {action:"route-email-intake-disposition",intakeId:1,workspaceKey:"gcm",disposition:"delete",confirmed:true,confirmation:"delete-no-action-required"},
    {DB},
    "test-delete"
  );

  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.ok,true);
  assert.equal(payload.disposition,"delete");
  assert.equal(payload.processingStatus,"processed");
  assert.equal(payload.evidenceRetained,true);
  assert.equal(payload.writesPerformed,0);
  assert.equal(payload.communicationsCreated,0);
  assert.equal(payload.activityRecordsCreated,0);
  assert.equal(payload.investigationsCreated,0);
  assert.equal(payload.workItemsCreated,0);
  assert.equal(DB.state.updateCount,1);
  assert.match(DB.state.updateSql,/UPDATE email_intake/i);
  assert.match(DB.state.updateSql,/processing_status = 'processed'/i);
  assert.match(DB.state.updateSql,/disposition = 'delete'/i);
  assert.doesNotMatch(DB.state.updateSql,/DELETE\s+FROM/i);
  assert.doesNotMatch(DB.state.updateSql,/INSERT\s+INTO/i);
}

{
  const DB=makeDb({
    id:1,
    processing_status:"processed",
    disposition:"delete",
    communication_id:null,
    activity_record_id:null,
    investigation_id:null,
    work_item_id:null
  });

  const response=await handleEmailIntakeDisposition(
    {intakeId:1,workspaceKey:"gcm",disposition:"delete",confirmed:true,confirmation:"delete-no-action-required"},
    {DB},
    "test-duplicate"
  );
  const payload=await response.json();
  assert.equal(response.status,200);
  assert.equal(payload.duplicate,true);
  assert.equal(DB.state.updateCount,0);
}

{
  const DB=makeDb({
    id:1,
    processing_status:"ready_for_review",
    disposition:null,
    communication_id:88,
    activity_record_id:null,
    investigation_id:null,
    work_item_id:null
  });

  const response=await handleEmailIntakeDisposition(
    {intakeId:1,workspaceKey:"gcm",disposition:"delete",confirmed:true,confirmation:"delete-no-action-required"},
    {DB},
    "test-linked"
  );
  assert.equal(response.status,409);
  assert.equal(DB.state.updateCount,0);
}

{
  const DB=makeDb(null);
  const response=await handleEmailIntakeDisposition(
    {intakeId:1,workspaceKey:"gcm",disposition:"information",confirmed:true,confirmation:"delete-no-action-required"},
    {DB},
    "test-unsupported"
  );
  assert.equal(response.status,400);
  assert.equal(DB.state.selects,0);
}

console.log("PASS Universal Email Intake Delete — No Action Required preserves evidence and creates 0 downstream records");
