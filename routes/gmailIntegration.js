/* =========================================================
   Global Concepts Media Operating System
   File: routes/gmailIntegration.js
   Version: 1.7.2
   Status: Production Road-Test Candidate
   Source: gmailIntegration.js 1.7.0 preserved as gmailIntegrationLegacy.js
   Sprint: Gmail — Backlink Audit Source Detection
   Purpose:
   Preserve the complete production Gmail integration while overriding only
   source-proven Backlink Audit cases that name specific adverse domains.

   Change Notes — 1.7.2
   - Detects Semrush Backlink Audit directly from the Gmail sender/subject/body
     instead of requiring the legacy classifier to label it backlink_audit first.
   - Covers the live backlink.audit@semrush.com sender variant that previously
     fell through to Manual Review before the evidence rule could execute.
   - Preserves the v1.7.1 Investigation boundary and all delegated Gmail behavior.

   Change Notes — 1.7.1
   - Delegates every existing Gmail behavior to the byte-preserved v1.7.0 module.
   - Reclassifies Backlink Audit emails with named adverse domains + TS values from
     routine Monitoring to Communication + Investigation.
   - Approval preserves the exact Gmail body in the operational decision and
     creates no Work Item until diagnosis proves corrective action.
   - Gmail is marked read only after D1 confirms the Communication/Investigation.
   ========================================================= */

import { ACTIONS } from "../shared/config.js";
import { clean, safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase } from "../shared/database.js";
import { handleCommitOperationalDecision } from "./operationalDecision.js";
import * as legacy from "./gmailIntegrationLegacy.js";
import { buildBacklinkAuditRecommendation } from "./gmailBacklinkAuditIntelligence.js";

export const GMAIL_INTEGRATION_VERSION = "1.7.2";
export const GMAIL_PATHS = legacy.GMAIL_PATHS;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

export function isBacklinkAuditSource(message) {
  const sender = clean(message?.from).toLowerCase();
  const subject = clean(message?.subject);
  const body = clean(message?.bodyText);
  const text = `${subject}\n${body}`;

  return /semrush\.com/i.test(sender) &&
    /backlink[ ._-]*audit/i.test(`${sender}\n${text}`) &&
    /(?:new toxic domains?|new trusted domains?|referring domains?|backlink audit updates)/i.test(text);
}

export async function handleGmailGet(request, env, requestId) {
  return legacy.handleGmailGet(request, env, requestId);
}

export async function handleGmailAction(body, env, requestId) {
  if (body?.action === ACTIONS.PREVIEW_GMAIL_INBOX) {
    return previewWithBacklinkAuditBoundary(body, env, requestId);
  }

  if (body?.action === ACTIONS.APPROVE_GMAIL_INVESTIGATION) {
    const backlinkResponse = await approveSpecificBacklinkInvestigation(body, env, requestId);
    if (backlinkResponse) return backlinkResponse;
  }

  return legacy.handleGmailAction(body, env, requestId);
}

async function previewWithBacklinkAuditBoundary(body, env, requestId) {
  const response = await legacy.handleGmailAction(body, env, requestId);
  if (!response || typeof response.json !== "function") return response;

  let payload;
  try {
    payload = await response.json();
  } catch {
    return response;
  }

  if (!response.ok || payload?.ok !== true || !Array.isArray(payload?.messages)) {
    return jsonResponse(payload, response.status || 500);
  }

  payload.messages = payload.messages.map(message => {
    if (!isBacklinkAuditSource(message)) return message;

    const current = message?.intelligence || {};
    const recommendation = buildBacklinkAuditRecommendation({
      message,
      analysis:{ client:{ name:current.client } },
      decision:current.sourceAnalysis || {},
      classification:{
        notificationFamily:current.communicationFamily || "SEMrush Backlink Audit",
        notificationType:"backlink_audit"
      }
    });

    return recommendation
      ? { ...message, intelligence:recommendation }
      : message;
  });

  payload.gmailIntegrationVersion = GMAIL_INTEGRATION_VERSION;
  return jsonResponse(payload, response.status || 200);
}

async function approveSpecificBacklinkInvestigation(body, env, requestId) {
  const gmailMessageId = clean(body?.gmailMessageId);
  if (!gmailMessageId) return null;

  try {
    const previewResponse = await legacy.handleGmailAction({
      action:ACTIONS.PREVIEW_GMAIL_INBOX,
      limit:20
    }, env, `${requestId}-backlink-source`);

    if (!previewResponse?.ok) return null;
    const preview = await previewResponse.json();
    const message = (preview?.messages || []).find(item => clean(item?.gmailMessageId) === gmailMessageId);
    if (!message || !isBacklinkAuditSource(message)) return null;

    const current = message?.intelligence || {};
    const recommendation = buildBacklinkAuditRecommendation({
      message,
      analysis:{ client:{ name:current.client } },
      decision:current.sourceAnalysis || {},
      classification:{
        notificationFamily:current.communicationFamily || "SEMrush Backlink Audit",
        notificationType:"backlink_audit"
      }
    });
    if (!recommendation?.investigationCandidate) return null;

    const db = requireDb(env);
    const client = await db.prepare(`
      SELECT id, name, client_code
      FROM clients
      WHERE name = ? COLLATE NOCASE
      LIMIT 1
    `).bind(recommendation.client).first();

    if (!client?.client_code) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
        error:`No production client matched ${recommendation.client}. Gmail was left unchanged.`
      }, 409);
    }

    const sourceReference = `gmail:${gmailMessageId}`;
    const decision = recommendation.sourceAnalysis;
    const commitResponse = await handleCommitOperationalDecision({
      action:ACTIONS.COMMIT_OPERATIONAL_DECISION,
      clientCode:client.client_code,
      externalId:sourceReference,
      occurredAt:message.date,
      direction:"incoming",
      owner:"Andrew",
      rawContent:message.bodyText || message.snippet || message.subject,
      decision
    }, env, `${requestId}-backlink-commit`);

    const commit = await commitResponse.json();
    if (!commitResponse.ok || commit?.ok !== true) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
        error:typeof commit?.error === "string"
          ? commit.error
          : commit?.error?.message || "The backlink Investigation could not be committed.",
        commit
      }, commitResponse.status || 500);
    }

    if (!commit.duplicate && (!commit.communicationId || !commit.investigationId || commit.workItemId)) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
        error:"D1 did not confirm exactly one Communication plus one Investigation with no Work Item. Gmail was left unread.",
        commit
      }, 500);
    }

    const accessToken = await liveGmailAccessToken(env);
    await markMessageRead(gmailMessageId, accessToken);

    return jsonResponse({
      ok:true,
      requestId,
      action:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
      gmailIntegrationVersion:GMAIL_INTEGRATION_VERSION,
      duplicate:Boolean(commit.duplicate),
      writesPerformed:commit.duplicate ? 0 : 2,
      gmailMarkedRead:true,
      communicationId:commit.communicationId || null,
      investigationId:commit.investigationId || null,
      workItemId:null,
      backlinkEvidence:recommendation.monitoringMetrics || null,
      client:{ id:client.id, clientCode:client.client_code, name:client.name }
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
      stage:"gmail_backlink_investigation_approval",
      error
    });
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
      error:safeErrorMessage(error)
    }, 500);
  }
}

function requireDb(env) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") {
    throw new Error("The production D1 binding is unavailable.");
  }
  return db;
}

async function liveGmailAccessToken(env) {
  if (!clean(env?.GOOGLE_CLIENT_ID) || !clean(env?.GOOGLE_CLIENT_SECRET)) {
    throw new Error("Google OAuth secrets are not configured.");
  }

  const db = requireDb(env);
  const connection = await db.prepare(`
    SELECT encrypted_refresh_token
    FROM gmail_connections
    ORDER BY updated_at DESC
    LIMIT 1
  `).first();
  if (!connection?.encrypted_refresh_token) throw new Error("Gmail is not connected.");

  const refreshToken = await decrypt(connection.encrypted_refresh_token, env.GOOGLE_CLIENT_SECRET);
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
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google token refresh failed.");
  }
  return data.access_token;
}

async function markMessageRead(gmailMessageId, accessToken) {
  const response = await fetch(`${GMAIL_API}/users/me/messages/${encodeURIComponent(gmailMessageId)}/modify`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${accessToken}`, "Content-Type":"application/json" },
    body:JSON.stringify({ removeLabelIds:["UNREAD"] })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Gmail modify failed with HTTP ${response.status}.`);
}

async function cryptoKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["decrypt"]);
}

async function decrypt(value, secret) {
  const [iv, data] = String(value || "").split(".");
  if (!iv || !data) throw new Error("Stored Gmail credential is invalid.");
  const bytes = await crypto.subtle.decrypt(
    { name:"AES-GCM", iv:decode(iv) },
    await cryptoKey(secret),
    decode(data)
  );
  return new TextDecoder().decode(bytes);
}

function decode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}
