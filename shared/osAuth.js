/* =========================================================
   Global Concepts Media Operating System
   File: shared/osAuth.js
   Version: 1.0.0
   Status: OS 2.0 Production Candidate
   Purpose: Create and verify short-lived signed operator sessions.
   ========================================================= */

const TOKEN_VERSION = 1;
const DEFAULT_TTL_SECONDS = 12 * 60 * 60;

export async function createOsSessionToken({ email, secret, now = Date.now(), ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
  const normalizedEmail = normalizeEmail(email);
  const signingSecret = requireSecret(secret);
  const issuedAt = Math.floor(Number(now) / 1000);
  const ttl = Math.max(60, Math.min(Number(ttlSeconds) || DEFAULT_TTL_SECONDS, DEFAULT_TTL_SECONDS));
  const payload = { v:TOKEN_VERSION, email:normalizedEmail, iat:issuedAt, exp:issuedAt + ttl };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(encodedPayload, signingSecret);
  return `${encodedPayload}.${signature}`;
}

export async function verifyOsSessionToken(token, secret, now = Date.now()) {
  const signingSecret = requireSecret(secret);
  const parts = String(token || "").trim().split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("The GCM OS login token could not be verified.");
  const valid = await verifySignature(parts[0], parts[1], signingSecret);
  if (!valid) throw new Error("The GCM OS login token could not be verified.");
  let payload;
  try { payload = JSON.parse(base64UrlDecode(parts[0])); }
  catch { throw new Error("The GCM OS login token could not be verified."); }
  if (payload?.v !== TOKEN_VERSION) throw new Error("The GCM OS login token could not be verified.");
  payload.email = normalizeEmail(payload.email);
  const currentTime = Math.floor(Number(now) / 1000);
  if (!Number.isFinite(payload.exp) || currentTime >= payload.exp) throw new Error("The GCM OS login token has expired. Sign in again.");
  if (!Number.isFinite(payload.iat) || payload.iat > currentTime + 60) throw new Error("The GCM OS login token could not be verified.");
  return payload;
}

export async function authorizeOsRequest(request, env, db) {
  const header = String(request?.headers?.get?.("Authorization") || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("Sign in to GCM OS to continue.");
  const identity = await verifyOsSessionToken(match[1], env?.OS_SESSION_SECRET || env?.GOOGLE_CLIENT_SECRET);
  const configuredOperator = String(env?.OS_OPERATOR_EMAIL || "").trim().toLowerCase();
  if (configuredOperator && identity.email !== configuredOperator) throw new Error("This signed-in account is not authorized for GCM OS.");
  if (db?.prepare) {
    const connection = await db.prepare("SELECT account_email FROM gmail_connections WHERE lower(account_email) = ? LIMIT 1").bind(identity.email).first();
    if (!connection) throw new Error("The signed-in account is not a verified GCM OS Gmail connection.");
  }
  return identity;
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid verified email address is required.");
  return email;
}

function requireSecret(value) {
  const secret = String(value || "");
  if (secret.length < 8) throw new Error("The GCM OS session signing secret is unavailable.");
  return secret;
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(bytes));
}

async function verifySignature(value, signature, secret) {
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name:"HMAC", hash:"SHA-256" }, false, ["verify"]);
    return await crypto.subtle.verify("HMAC", key, base64UrlBytes(signature), new TextEncoder().encode(value));
  } catch { return false; }
}

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) { return new TextDecoder().decode(base64UrlBytes(value)); }
function base64UrlBytes(value) {
  const normalized = String(value).replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
