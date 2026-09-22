/* =========================================================
   Global Concepts Media Operating System
   File: tests/universalEmailIntake.test.js
   Version: 1.0.1
   Status: Production Regression Test
   Purpose: Verify Cloudflare Email Routing intake is provider-independent,
            duplicate-safe, requires an active intake address, and stores
            normalized source evidence in D1 without AI.
   ========================================================= */

import assert from "node:assert/strict";
import { handleInboundEmail, EMAIL_INTAKE_VERSION } from "../routes/emailIntake.js";

assert.equal(EMAIL_INTAKE_VERSION, "1.0.0");

function mockDb({ knownAddress=true, duplicate=false } = {}) {
  const state = { insertArgs:null, insertSql:null };

  return {
    state,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/FROM email_intake_addresses/i.test(sql)) {
                return knownAddress
                  ? { id:1, workspace_key:"gcm", intake_address:"operations@gcmosmail.com", label:"GCM Operations Intake" }
                  : null;
              }
              if (/FROM email_intake\b/i.test(sql)) {
                return duplicate
                  ? { id:77, processing_status:"ready_for_review", disposition:null }
                  : null;
              }
              return null;
            },
            async run() {
              state.insertSql = sql;
              state.insertArgs = args;
              return { meta:{ last_row_id:101 } };
            }
          };
        }
      };
    }
  };
}

function testMessage() {
  const raw = [
    "From: Test Sender <sender@example.com>",
    "To: operations@gcmosmail.com",
    "Subject: Universal intake test",
    "Message-ID: <universal-intake-test@example.com>",
    "Date: Tue, 22 Sep 2026 15:00:00 +0000",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Hello from the universal intake test.",
    ""
  ].join("\r\n");

  let rejected = "";
  return {
    from:"sender@example.com",
    to:"operations@gcmosmail.com",
    raw:new TextEncoder().encode(raw),
    rawSize:raw.length,
    headers:new Headers({
      from:"Test Sender <sender@example.com>",
      to:"operations@gcmosmail.com",
      subject:"Universal intake test",
      "message-id":"<universal-intake-test@example.com>",
      date:"Tue, 22 Sep 2026 15:00:00 +0000"
    }),
    setReject(reason) { rejected = String(reason || ""); },
    get rejected() { return rejected; }
  };
}

{
  const DB = mockDb();
  const message = testMessage();
  const result = await handleInboundEmail(message, { DB }, {});

  assert.equal(result.ok, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.intakeId, 101);
  assert.equal(result.processingStatus, "ready_for_review");
  assert.equal(message.rejected, "");
  assert.ok(DB.state.insertSql);
  assert.equal(DB.state.insertArgs[0], "gcm");
  assert.equal(DB.state.insertArgs[2], "cloudflare_email_routing");
  assert.equal(DB.state.insertArgs[4], "<universal-intake-test@example.com>");
  assert.equal(DB.state.insertArgs[19], "ready_for_review");
  assert.match(DB.state.insertArgs[13], /Universal intake test/);
  assert.match(DB.state.insertArgs[14], /Hello from the universal intake test/);
}

{
  const DB = mockDb({ duplicate:true });
  const result = await handleInboundEmail(testMessage(), { DB }, {});
  assert.equal(result.ok, true);
  assert.equal(result.duplicate, true);
  assert.equal(result.intakeId, 77);
  assert.equal(DB.state.insertArgs, null);
}

{
  const DB = mockDb({ knownAddress:false });
  const message = testMessage();
  const result = await handleInboundEmail(message, { DB }, {});
  assert.equal(result.ok, false);
  assert.equal(result.rejected, true);
  assert.match(message.rejected, /not active/i);
  assert.equal(DB.state.insertArgs, null);
}

console.log("PASS Universal Email Intake receives, normalizes, deduplicates, and stages inbound email in D1");
