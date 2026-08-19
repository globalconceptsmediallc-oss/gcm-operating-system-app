/* =========================================================
   Global Concepts Media Operating System
   File: routes/gmailWorkRequests.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Gmail — Direct Requested Work
   Purpose:
   Provide a read-only candidate check and a human-approved write path from a
   concrete Gmail request to one durable Communication plus one linked direct
   Work Item, with no artificial Investigation.

   Change notes — v1.0.0:
   - Re-reads Gmail at approval time; browser preview state is never trusted as
     the production write authority.
   - Requires the pure direct-request intelligence contract to pass before any
     D1 write occurs.
   - Reuses operationalDecision.js for authoritative Communication + Work Item
     relationships and duplicate protection.
   - Marks Gmail read only after D1 confirms the direct Work Item.
   - Refuses to bolt new Work onto an existing Communication that was already
     processed through a different route.
   ========================================================= */

import { clean, safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase } from "../shared/database.js";
import { handleCommitOperationalDecision } from "./operationalDecision.js";
import { evaluateExplicitHumanWorkRequest } from "./gmailWorkRequestIntelligence.js";

export const EVALUATE_GMAIL_WORK_REQUEST_ACTION = "evaluate-gmail-work-request";
export const APPROVE_GMAIL_WORK_REQUEST_ACTION = "approve-gmail-work-request";
export const GMAIL_WORK_REQUEST_ACTIONS = Object.freeze([
  EVALUATE_GMAIL_WORK_REQUEST_ACTION,
  APPROVE_GMAIL_WORK_REQUEST_ACTION
]);

export const GMAIL_WORK_REQUEST_VERSION = "1.0.0";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

export async function handleGmailWorkRequests(body, env, requestId) {
  const action = clean(body?.action);

  if (action === EVALUATE_GMAIL_WORK_REQUEST_ACTION) {
    return evaluateRequest(body, env, requestId);
  }

  if (action === APPROVE_GMAIL_WORK_REQUEST_ACTION) {
    return approveRequest(body, env, requestId);
  }

  return null;
}

async function evaluateRequest(body, env, requestId) {
  const gmailMessageId = clean(body?.gmailMessageId);
  if (!gmailMessageId) {
    return jsonResponse({ ok:false, requestId, action:EVALUATE_GMAIL_WORK_REQUEST_ACTION, error:"gmailMessageId is required." }, 400);
  }

  try {
    const { message } = await loadLiveGmailMessage(gmailMessageId, env);
    const intelligence = evaluateExplicitHumanWorkRequest(message);

    return jsonResponse({
      ok: true,
      requestId,
      action: EVALUATE_GMAIL_WORK_REQUEST_ACTION,
      version: GMAIL_WORK_REQUEST_VERSION,
      writesPerformed: 0,
      candidate: intelligence.candidate === true,
      intelligence: mapIntelligence(intelligence)
    });
  } catch (error) {
    logWorkerError({ requestId, route:EVALUATE_GMAIL_WORK_REQUEST_ACTION, stage:"gmail_work_candidate", error });
    return jsonResponse({
      ok:false,
      requestId,
      action:EVALUATE_GMAIL_WORK_REQUEST_ACTION,
      error:safeErrorMessage(error)
    }, 500);
  }
}

async function approveRequest(body, env, requestId) {
  const gmailMessageId = clean(body?.gmailMessageId);
  if (!gmailMessageId) {
    return jsonResponse({ ok:false, requestId, action:APPROVE_GMAIL_WORK_REQUEST_ACTION, error:"gmailMessageId is required." }, 400);
  }

  try {
    const db = requireDb(env);
    const sourceReference = `gmail:${gmailMessageId}`;

    const existing = await db.prepare(`
      SELECT
        c.id AS communication_id,
        i.id AS investigation_id,
        wi.id AS work_item_id,
        c.client_id,
        c.subject
      FROM communications c
      LEFT JOIN investigations i ON i.communication_id = c.id
      LEFT JOIN work_items wi ON wi.communication_id = c.id
      WHERE c.external_id = ?
      ORDER BY wi.id DESC, i.id DESC
      LIMIT 1
    `).bind(sourceReference).first();

    if (existing?.communication_id && existing?.work_item_id && !existing?.investigation_id) {
      const live = await loadLiveGmailMessage(gmailMessageId, env);
      await markMessageRead(gmailMessageId, live.accessToken);
      return jsonResponse({
        ok:true,
        requestId,
        action:APPROVE_GMAIL_WORK_REQUEST_ACTION,
        version:GMAIL_WORK_REQUEST_VERSION,
        duplicate:true,
        writesPerformed:0,
        gmailMarkedRead:true,
        communicationId:existing.communication_id,
        investigationId:null,
        workItemId:existing.work_item_id
      });
    }

    if (existing?.communication_id) {
      return jsonResponse({
        ok:false,
        requestId,
        action:APPROVE_GMAIL_WORK_REQUEST_ACTION,
        error:"This Gmail message is already linked to a different OS route. Review the existing Communication before adding new Work."
      }, 409);
    }

    const { message, accessToken } = await loadLiveGmailMessage(gmailMessageId, env);
    const intelligence = evaluateExplicitHumanWorkRequest(message);

    if (intelligence.candidate !== true || !intelligence.client?.code || !intelligence.decision) {
      return jsonResponse({
        ok:false,
        requestId,
        action:APPROVE_GMAIL_WORK_REQUEST_ACTION,
        error:intelligence.reason || "This email is not a verified direct Work request.",
        intelligence:mapIntelligence(intelligence)
      }, 409);
    }

    const client = await db.prepare(`
      SELECT id, client_code, name
      FROM clients
      WHERE client_code = ? COLLATE NOCASE
         OR name = ? COLLATE NOCASE
      LIMIT 1
    `).bind(intelligence.client.code, intelligence.client.name).first();

    if (!client?.client_code) {
      return jsonResponse({
        ok:false,
        requestId,
        action:APPROVE_GMAIL_WORK_REQUEST_ACTION,
        error:`No production client matched ${intelligence.client.name}.`
      }, 409);
    }

    const commitResponse = await handleCommitOperationalDecision({
      action:"commit-operational-decision",
      clientCode:client.client_code,
      externalId:sourceReference,
      occurredAt:message.date,
      direction:"incoming",
      owner:"Andrew",
      rawContent:message.bodyText || message.snippet || message.subject,
      decision:intelligence.decision
    }, env, `${requestId}-commit`);

    const commit = await commitResponse.json();
    if (!commitResponse.ok || commit?.ok !== true) {
      return jsonResponse({
        ok:false,
        requestId,
        action:APPROVE_GMAIL_WORK_REQUEST_ACTION,
        error:typeof commit?.error === "string" ? commit.error : commit?.error?.message || "The requested Work decision could not be committed.",
        commit
      }, commitResponse.status || 500);
    }

    if (!commit.duplicate && (!commit.communicationId || !commit.workItemId || commit.investigationId)) {
      return jsonResponse({
        ok:false,
        requestId,
        action:APPROVE_GMAIL_WORK_REQUEST_ACTION,
        error:"D1 did not confirm exactly one Communication plus one direct Work Item with no Investigation. Gmail was left unread for review.",
        commit
      }, 500);
    }

    if (commit.duplicate) {
      const linked = await db.prepare(`
        SELECT c.id AS communication_id, wi.id AS work_item_id, i.id AS investigation_id
        FROM communications c
        LEFT JOIN work_items wi ON wi.communication_id = c.id
        LEFT JOIN investigations i ON i.communication_id = c.id
        WHERE c.external_id = ?
        ORDER BY wi.id DESC, i.id DESC
        LIMIT 1
      `).bind(sourceReference).first();

      if (!linked?.communication_id || !linked?.work_item_id || linked?.investigation_id) {
        return jsonResponse({
          ok:false,
          requestId,
          action:APPROVE_GMAIL_WORK_REQUEST_ACTION,
          error:"Duplicate protection triggered but the existing direct Work relationship could not be verified. Gmail was left unread.",
          commit
        }, 409);
      }

      await markMessageRead(gmailMessageId, accessToken);
      return jsonResponse({
        ok:true,
        requestId,
        action:APPROVE_GMAIL_WORK_REQUEST_ACTION,
        version:GMAIL_WORK_REQUEST_VERSION,
        duplicate:true,
        writesPerformed:0,
        gmailMarkedRead:true,
        communicationId:linked.communication_id,
        investigationId:null,
        workItemId:linked.work_item_id,
        client:{ id:client.id, clientCode:client.client_code, name:client.name },
        intelligence:mapIntelligence(intelligence)
      });
    }

    await markMessageRead(gmailMessageId, accessToken);

    return jsonResponse({
      ok:true,
      requestId,
      action:APPROVE_GMAIL_WORK_REQUEST_ACTION,
      version:GMAIL_WORK_REQUEST_VERSION,
      duplicate:false,
      writesPerformed:2,
      gmailMarkedRead:true,
      communicationId:commit.communicationId,
      investigationId:null,
      workItemId:commit.workItemId,
      workHref:`work.html?client=${encodeURIComponent(client.client_code)}&workItem=${encodeURIComponent(commit.workItemId)}`,
      client:{ id:client.id, clientCode:client.client_code, name:client.name },
      intelligence:mapIntelligence(intelligence)
    });
  } catch (error) {
    logWorkerError({ requestId, route:APPROVE_GMAIL_WORK_REQUEST_ACTION, stage:"gmail_work_approval", error });
    return jsonResponse({
      ok:false,
      requestId,
      action:APPROVE_GMAIL_WORK_REQUEST_ACTION,
      error:safeErrorMessage(error)
    }, 500);
  }
}

function mapIntelligence(value = {}) {
  return {
    candidate:value.candidate === true,
    reason:value.reason || null,
    role:value.role || null,
    client:value.client || null,
    explicitRequest:value.explicitRequest || "",
    action:value.action || "",
    priority:value.priority || null,
    businessImpact:value.businessImpact || "",
    expectedImpact:value.expectedImpact || ""
  };
}

async function loadLiveGmailMessage(gmailMessageId, env) {
  requireSecrets(env);
  const db = requireDb(env);
  const connection = await db.prepare(`
    SELECT account_email, encrypted_refresh_token
    FROM gmail_connections
    ORDER BY updated_at DESC
    LIMIT 1
  `).first();

  if (!connection?.encrypted_refresh_token) {
    throw new Error("Gmail is not connected.");
  }

  const refreshToken = await decrypt(connection.encrypted_refresh_token, env.GOOGLE_CLIENT_SECRET);
  const accessToken = await refreshAccessToken(refreshToken, env);
  const data = await gmailFetch(`${GMAIL_API}/users/me/messages/${encodeURIComponent(gmailMessageId)}?format=full`, accessToken);
  const headers = data?.payload?.headers || [];
  const header = name => clean(headers.find(item => clean(item.name).toLowerCase() === name.toLowerCase())?.value);
  const bodyText = extractMessageText(data?.payload).slice(0, 12000);

  return {
    accessToken,
    message:{
      gmailMessageId:data.id,
      threadId:data.threadId,
      from:header("From"),
      to:header("To"),
      subject:header("Subject") || "(No subject)",
      date:header("Date"),
      snippet:clean(data.snippet),
      bodyText:bodyText || clean(data.snippet)
    }
  };
}

function extractMessageText(payload) {
  const plain = [];
  const html = [];

  const visit = part => {
    if (!part || typeof part !== "object") return;
    const mime = clean(part.mimeType).toLowerCase();
    const data = part?.body?.data;

    if (data) {
      const decoded = decodeGmailText(data);
      if (mime === "text/plain") plain.push(decoded);
      else if (mime === "text/html") html.push(htmlToText(decoded));
    }

    for (const child of Array.isArray(part.parts) ? part.parts : []) visit(child);
  };

  visit(payload);
  const selected = plain.length ? plain.join("\n\n") : html.join("\n\n");
  return sanitizeEmailText(selected);
}

function decodeGmailText(value) {
  try {
    return new TextDecoder().decode(decodeBase64Url(value));
  } catch {
    return "";
  }
}

function htmlToText(value) {
  return sanitizeEmailText(String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'"));
}

function sanitizeEmailText(value) {
  return clean(String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n"));
}

async function markMessageRead(gmailMessageId, accessToken) {
  const response = await fetch(`${GMAIL_API}/users/me/messages/${encodeURIComponent(gmailMessageId)}/modify`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${accessToken}`, "Content-Type":"application/json" },
    body:JSON.stringify({ removeLabelIds:["UNREAD"] })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Gmail modify failed with HTTP ${response.status}.`);
  return data;
}

async function refreshAccessToken(refreshToken, env) {
  const response = await fetch(TOKEN_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/x-www-form-urlencoded" },
    body:new URLSearchParams({
      client_id:env.GOOGLE_CLIENT_ID,
      client_secret:env.GOOGLE_CLIENT_SECRET,
      refresh_token:refreshToken,
      grant_type:"refresh_token"
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "Google token refresh failed.");
  return data.access_token;
}

async function gmailFetch(url, accessToken) {
  const response = await fetch(url, { headers:{ Authorization:`Bearer ${accessToken}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Gmail API failed with HTTP ${response.status}.`);
  return data;
}

function requireDb(env) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") throw new Error("The production D1 binding is unavailable.");
  return db;
}

function requireSecrets(env) {
  if (!clean(env?.GOOGLE_CLIENT_ID) || !clean(env?.GOOGLE_CLIENT_SECRET)) {
    throw new Error("Google OAuth secrets are not configured.");
  }
}

async function cryptoKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["decrypt"]);
}

async function decrypt(value, secret) {
  const [iv, data] = String(value || "").split(".");
  if (!iv || !data) throw new Error("Stored Gmail connection token is invalid.");
  const bytes = await crypto.subtle.decrypt(
    { name:"AES-GCM", iv:decodeBase64Url(iv) },
    await cryptoKey(secret),
    decodeBase64Url(data)
  );
  return new TextDecoder().decode(bytes);
}

function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}
