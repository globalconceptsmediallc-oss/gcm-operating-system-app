/* =========================================================
   Global Concepts Media Operating System
   File: tests/osAuth.test.js
   Version: 1.0.0
   Status: OS 2.0 Authentication Test
   Purpose: Verify signed, expiring GCM OS login tokens.
   ========================================================= */

import assert from "node:assert/strict";
import {
  createOsSessionToken,
  verifyOsSessionToken
} from "../shared/osAuth.js";

const now = Date.parse("2026-08-12T12:00:00Z");
const secret = "test-only-secret";
const token = await createOsSessionToken({
  email: "GlobalConceptsMediaLLC@gmail.com",
  secret,
  now,
  ttlSeconds: 600
});

const identity = await verifyOsSessionToken(token, secret, now + 1000);
assert.equal(identity.email, "globalconceptsmediallc@gmail.com");

await assert.rejects(
  () => verifyOsSessionToken(token, "wrong-secret", now + 1000),
  /could not be verified/
);

await assert.rejects(
  () => verifyOsSessionToken(token, secret, now + 700000),
  /expired/
);

console.log("PASS signed OS login tokens, wrong-secret rejection, and expiration");
