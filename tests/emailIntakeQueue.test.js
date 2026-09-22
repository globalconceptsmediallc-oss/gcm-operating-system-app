/* =========================================================
   Global Concepts Media Operating System
   File: tests/emailIntakeQueue.test.js
   Version: 1.0.0
   Status: Production Regression Test
   Purpose: Verify the OS can read ready-for-review Universal Email Intake
            records from D1 without touching Gmail or modifying intake data.
   ========================================================= */

import assert from "node:assert/strict";
import { handleEmailIntakeQueue, EMAIL_INTAKE_QUEUE_VERSION } from "../routes/emailIntakeQueue.js";

assert.equal(EMAIL_INTAKE_QUEUE_VERSION,"1.0.0");

function mockDb() {
  const calls=[];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          calls.push({sql,args});
          return {
            async all() {
              return {
                results:[{
                  id:1,
                  received_at:"2026-09-22T15:31:57.149Z",
                  source_date:"Tue, 22 Sep 2026 11:31:56 -0400",
                  from_address:"globalconceptsmediallc@gmail.com",
                  from_name:"Andy Belcher",
                  subject:"GCM OS Universal Intake Test",
                  body_text:"This is the first live Universal Email Intake test.",
                  has_attachments:0,
                  attachment_metadata_json:"[]",
                  processing_status:"ready_for_review",
                  disposition:null,
                  classification_source:null,
                  classification_confidence:null,
                  client_id:null,
                  client_code:null,
                  client_name:null,
                  intake_address:"operations@gcmosmail.com",
                  intake_label:"GCM Operations Intake"
                }]
              };
            },
            async first() {
              return {count:1};
            }
          };
        }
      };
    }
  };
}

const DB=mockDb();
const response=await handleEmailIntakeQueue(
  {action:"get-email-intake-queue",workspaceKey:"gcm",limit:10},
  {DB},
  "test-request"
);

assert.equal(response.status,200);
const payload=await response.json();
assert.equal(payload.ok,true);
assert.equal(payload.action,"get-email-intake-queue");
assert.equal(payload.source,"D1");
assert.equal(payload.counts.readyForReview,1);
assert.equal(payload.counts.returned,1);
assert.equal(payload.queue[0].id,1);
assert.equal(payload.queue[0].subject,"GCM OS Universal Intake Test");
assert.equal(payload.queue[0].processingStatus,"ready_for_review");
assert.equal(payload.queue[0].intake.address,"operations@gcmosmail.com");
assert.match(payload.queue[0].bodyText,/first live Universal Email Intake test/);
assert.ok(DB.calls.some(call=>/FROM email_intake ei/i.test(call.sql)));
assert.ok(DB.calls.every(call=>!/(gmail|googleapis)/i.test(call.sql)));

console.log("PASS Universal Email Intake D1 review queue is read-only, Gmail-independent, and ready for Morning Command");
