/* =========================================================
   Global Concepts Media Operating System
   File: routes/gmailDispositions.js
   Version: 1.1.0
   Status: Production Road-Test Candidate
   Sprint: Gmail — Evidence Before Assumptions
   Purpose:
   Give Morning Command explicit human dispositions while preventing Position
   Tracking monitoring summaries from replacing the source evidence needed for
   future comparison, verification, and consulting decisions.

   Change notes — v1.1.0:
   - Intercepts preview-gmail-inbox only to enrich Position Tracking cards with
     exact keyword, current position, movement, trigger, domain, and report date.
   - Intercepts approve-gmail-monitoring for Position Tracking and re-reads Gmail
     at write time before any D1 mutation.
   - Saves structured Position Tracking evidence plus the relevant Gmail source
     text, message ID, thread ID, sender, and source date into activity_records.
   - Marks Gmail read only after D1 confirms the evidence record.
   - Delegates non-Position-Tracking preview/monitoring behavior to the verified
     production Gmail integration unchanged.
   - Preserves v1.0.0 Delete — No Action and Keep as Information behavior.

   Change notes — v1.0.0:
   - Delete — No Action Required moves the Gmail message to Trash and creates
     zero GCM OS records.
   - Keep as Information creates one durable Communication with no Investigation
     and no Work Item, then marks Gmail read only after D1 confirms the record.
   - Useful Information requires a verified production client; unassigned mail
     cannot be silently stored under the wrong account.
   - Reuses operationalDecision.js so Information remains part of the durable
     Communication history rather than a parallel notes table.
   ========================================================= */

import { clean, safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase } from "../shared/database.js";
import { handleCommitOperationalDecision } from "./operationalDecision.js";
import { handleGmailAction } from "./gmailIntegration.js";
import { inferClientFromText } from "./gmailWorkRequestIntelligence.js";
import {
  extractPositionTrackingEvidence,
  formatPositionTrackingEvidence,
  buildPositionTrackingBusinessMeaning
} from "../shared/gmailMonitoringEvidence.js";

export const PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION = "preview-gmail-inbox";
export const APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION = "approve-gmail-monitoring";
export const DELETE_GMAIL_NO_ACTION_ACTION = "delete-gmail-no-action";
export const SAVE_GMAIL_INFORMATION_ACTION = "save-gmail-information";
export const GMAIL_DISPOSITION_ACTIONS = Object.freeze([
  PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION,
  APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
  DELETE_GMAIL_NO_ACTION_ACTION,
  SAVE_GMAIL_INFORMATION_ACTION
]);
export const GMAIL_DISPOSITION_VERSION = "1.1.0";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

export async function handleGmailDispositions(body, env, requestId) {
  const action = clean(body?.action);
  if (action === PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION) return previewWithEvidence(body, env, requestId);
  if (action === APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION) return approveMonitoringWithEvidence(body, env, requestId);
  if (action === DELETE_GMAIL_NO_ACTION_ACTION) return deleteNoAction(body, env, requestId);
  if (action === SAVE_GMAIL_INFORMATION_ACTION) return saveInformation(body, env, requestId);
  return null;
}

async function previewWithEvidence(body, env, requestId) {
  const legacyResponse = await handleGmailAction(body, env, requestId);
  if (!legacyResponse || typeof legacyResponse.json !== "function") return legacyResponse;

  let payload;
  try {
    payload = await legacyResponse.json();
  } catch {
    return legacyResponse;
  }

  if (!legacyResponse.ok || payload?.ok !== true || !Array.isArray(payload?.messages)) {
    return jsonResponse(payload, legacyResponse.status || 500);
  }

  payload.messages = payload.messages.map(enrichPositionTrackingPreview);
  payload.gmailDispositionVersion = GMAIL_DISPOSITION_VERSION;
  payload.evidencePreservation = "Position Tracking exact-signal guard active";
  return jsonResponse(payload, legacyResponse.status || 200);
}

function enrichPositionTrackingPreview(message) {
  const evidence = extractPositionTrackingEvidence(
    `${clean(message?.subject)}\n${clean(message?.bodyText)}`
  );
  if (!evidence) return message;

  const inferred = inferClientFromText(
    `${clean(message?.subject)}\n${clean(message?.bodyText)}`
  );
  const current = message?.intelligence || {};
  const clientName = inferred?.name || current.client || "Unassigned — Human Review";
  const evidenceSummary = formatPositionTrackingEvidence(evidence);
  const businessMeaning = buildPositionTrackingBusinessMeaning(evidence, clientName);

  return {
    ...message,
    snippet:evidenceSummary || message?.snippet,
    intelligence:{
      ...current,
      notificationType:"position_tracking",
      client:clientName,
      businessMeaning:businessMeaning || current.businessMeaning,
      monitoringMetrics:evidence,
      evidenceSummary,
      evidenceSufficiency:evidence.keywords?.length
        ? "Exact keyword, current position, movement, trigger, domain, and report date extracted from the Gmail source"
        : current.evidenceSufficiency,
      evidenceComparedAgainst:"Current Gmail source preserved for future D1 trend comparison",
      verificationRequired:"Human approval may save this exact Position Tracking signal as monitoring evidence. Escalate only when later comparison proves a meaningful adverse condition."
    }
  };
}

async function approveMonitoringWithEvidence(body, env, requestId) {
  const gmailMessageId = clean(body?.gmailMessageId);
  if (!gmailMessageId) {
    return jsonResponse({
      ok:false,
      requestId,
      action:APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
      error:"gmailMessageId is required."
    }, 400);
  }

  try {
    const db = requireDb(env);
    const sourceReference = `gmail:${gmailMessageId}`;
    const existing = await db.prepare(`
      SELECT id, client_id, activity_date, activity, source_reference
      FROM activity_records
      WHERE source_reference = ? OR evidence_reference = ?
      LIMIT 1
    `).bind(sourceReference, sourceReference).first();

    if (existing) {
      const live = await loadLiveGmailMessage(gmailMessageId, env);
      await markMessageRead(gmailMessageId, live.accessToken);
      return jsonResponse({
        ok:true,
        requestId,
        action:APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
        version:GMAIL_DISPOSITION_VERSION,
        duplicate:true,
        writesPerformed:0,
        gmailMarkedRead:true,
        evidencePreserved:true,
        record:existing
      });
    }

    const { message, accessToken } = await loadLiveGmailMessage(gmailMessageId, env);
    const evidence = extractPositionTrackingEvidence(
      `${clean(message.subject)}\n${clean(message.bodyText)}`
    );

    if (!evidence) {
      return handleGmailAction(body, env, requestId);
    }

    const inferred = inferClientFromText(`${message.subject}\n${message.bodyText}`);
    const client = await resolveClient(db, inferred, "");
    if (!client?.client_code) {
      return jsonResponse({
        ok:false,
        requestId,
        action:APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
        error:"Position Tracking evidence was found, but the production client could not be verified. Gmail was left unchanged for manual review."
      }, 409);
    }

    const activityDate = normalizeActivityDate(message.date);
    const evidenceSummary = formatPositionTrackingEvidence(evidence);
    const businessMeaning = buildPositionTrackingBusinessMeaning(evidence, client.name);
    const sourceEvidence = positionTrackingSourceEvidence(message.bodyText);
    const notes = [
      `Business meaning: ${businessMeaning}`,
      `Structured evidence: ${JSON.stringify(evidence)}`,
      `Evidence summary: ${evidenceSummary}`,
      `Source sender: ${clean(message.from)}`,
      `Source date: ${clean(message.date)}`,
      `Gmail message ID: ${gmailMessageId}`,
      `Gmail thread ID: ${clean(message.threadId)}`,
      sourceEvidence ? `Gmail source evidence:\n${sourceEvidence}` : ""
    ].filter(Boolean).join("\n");

    const result = await db.prepare(`INSERT INTO activity_records (
      client_id,activity_date,category,activity,evidence_type,evidence_reference,
      status,owner,time_minutes,expected_impact,actual_impact,notes,source_type,
      source_reference,priority,win,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
      .bind(
        client.id,
        activityDate,
        "SEO Ranking Alert",
        clean(message.subject) || "Position Tracking update",
        "Gmail — Position Tracking",
        sourceReference,
        "completed",
        "Andy",
        0,
        "Monitoring / trend evidence",
        businessMeaning,
        notes,
        "gmail_monitoring",
        sourceReference,
        "Low",
        0
      ).run();

    const recordId = result?.meta?.last_row_id || null;
    if (!recordId) {
      return jsonResponse({
        ok:false,
        requestId,
        action:APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
        error:"D1 did not confirm the Position Tracking monitoring record. Gmail was left unread."
      }, 500);
    }

    await markMessageRead(gmailMessageId, accessToken);

    return jsonResponse({
      ok:true,
      requestId,
      action:APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
      version:GMAIL_DISPOSITION_VERSION,
      duplicate:false,
      writesPerformed:1,
      gmailMarkedRead:true,
      evidencePreserved:true,
      monitoringMetrics:evidence,
      evidenceSummary,
      record:{
        id:recordId,
        client_id:client.id,
        client:client.name,
        activity_date:activityDate,
        activity:clean(message.subject) || "Position Tracking update",
        source_reference:sourceReference
      }
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
      stage:"gmail_monitoring_evidence",
      error
    });
    return jsonResponse({
      ok:false,
      requestId,
      action:APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
      error:safeErrorMessage(error)
    }, 500);
  }
}

async function deleteNoAction(body, env, requestId) {
  const gmailMessageId = clean(body?.gmailMessageId);
  if (!gmailMessageId) {
    return jsonResponse({ ok:false, requestId, action:DELETE_GMAIL_NO_ACTION_ACTION, error:"gmailMessageId is required." }, 400);
  }

  try {
    const { accessToken } = await loadLiveGmailMessage(gmailMessageId, env);
    const response = await fetch(`${GMAIL_API}/users/me/messages/${encodeURIComponent(gmailMessageId)}/trash`, {
      method:"POST",
      headers:{ Authorization:`Bearer ${accessToken}`, "Content-Type":"application/json" },
      body:"{}"
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || `Gmail Trash returned HTTP ${response.status}.`);

    return jsonResponse({
      ok:true,
      requestId,
      action:DELETE_GMAIL_NO_ACTION_ACTION,
      version:GMAIL_DISPOSITION_VERSION,
      gmailMovedToTrash:true,
      writesPerformed:0,
      osRecordsCreated:0
    });
  } catch (error) {
    logWorkerError({ requestId, route:DELETE_GMAIL_NO_ACTION_ACTION, stage:"gmail_delete_no_action", error });
    return jsonResponse({ ok:false, requestId, action:DELETE_GMAIL_NO_ACTION_ACTION, error:safeErrorMessage(error) }, 500);
  }
}

async function saveInformation(body, env, requestId) {
  const gmailMessageId = clean(body?.gmailMessageId);
  const clientNameHint = clean(body?.clientName || body?.client);
  if (!gmailMessageId) {
    return jsonResponse({ ok:false, requestId, action:SAVE_GMAIL_INFORMATION_ACTION, error:"gmailMessageId is required." }, 400);
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
      ORDER BY wi.id DESC, i.id DESC, c.id DESC
      LIMIT 1
    `).bind(sourceReference).first();

    if (existing?.communication_id && !existing?.investigation_id && !existing?.work_item_id) {
      const live = await loadLiveGmailMessage(gmailMessageId, env);
      await markMessageRead(gmailMessageId, live.accessToken);
      return jsonResponse({
        ok:true,
        requestId,
        action:SAVE_GMAIL_INFORMATION_ACTION,
        version:GMAIL_DISPOSITION_VERSION,
        duplicate:true,
        writesPerformed:0,
        gmailMarkedRead:true,
        communicationId:existing.communication_id,
        investigationId:null,
        workItemId:null
      });
    }

    if (existing?.communication_id) {
      return jsonResponse({
        ok:false,
        requestId,
        action:SAVE_GMAIL_INFORMATION_ACTION,
        error:"This Gmail message is already linked to an Investigation or Work Item. Its stronger existing route was preserved."
      }, 409);
    }

    const { message, accessToken } = await loadLiveGmailMessage(gmailMessageId, env);
    const text = `${message.subject}\n${message.bodyText}`;
    const inferred = inferClientFromText(text);
    const client = await resolveClient(db, inferred, clientNameHint);

    if (!client?.client_code) {
      return jsonResponse({
        ok:false,
        requestId,
        action:SAVE_GMAIL_INFORMATION_ACTION,
        error:"Keep as Information requires a verified client. The email was left unchanged for manual review."
      }, 409);
    }

    const summary = buildInformationSummary(message);
    const decision = {
      source:"Gmail — Information",
      communicationType:"Information / Context",
      title:message.subject || "Informational email",
      operationalSummary:summary,
      businessImpact:"Useful client or business context was preserved for future historical comparison and consulting decisions. No current action is required.",
      importance:"Informational",
      operationalPriority:"Informational",
      recommendedAction:"No action required. Retain this Communication as historical client context.",
      reasoning:"Human operator classified this Gmail message as useful information rather than disposable mail, monitoring, investigation, or requested work.",
      recommendedRoutes:{
        saveCommunication:true,
        createInvestigation:false,
        createWorkItem:false,
        replyRequired:false
      }
    };

    const commitResponse = await handleCommitOperationalDecision({
      action:"commit-operational-decision",
      clientCode:client.client_code,
      externalId:sourceReference,
      occurredAt:message.date,
      direction:"incoming",
      owner:"Andrew",
      rawContent:message.bodyText || message.snippet || message.subject,
      decision
    }, env, `${requestId}-commit`);

    const commit = await commitResponse.json();
    if (!commitResponse.ok || commit?.ok !== true) {
      return jsonResponse({
        ok:false,
        requestId,
        action:SAVE_GMAIL_INFORMATION_ACTION,
        error:typeof commit?.error === "string" ? commit.error : commit?.error?.message || "The informational Communication could not be saved.",
        commit
      }, commitResponse.status || 500);
    }

    if (!commit.duplicate && (!commit.communicationId || commit.investigationId || commit.workItemId)) {
      return jsonResponse({
        ok:false,
        requestId,
        action:SAVE_GMAIL_INFORMATION_ACTION,
        error:"D1 did not confirm exactly one informational Communication with no Investigation and no Work Item. Gmail was left unread.",
        commit
      }, 500);
    }

    await markMessageRead(gmailMessageId, accessToken);

    return jsonResponse({
      ok:true,
      requestId,
      action:SAVE_GMAIL_INFORMATION_ACTION,
      version:GMAIL_DISPOSITION_VERSION,
      duplicate:Boolean(commit.duplicate),
      writesPerformed:commit.duplicate ? 0 : 1,
      gmailMarkedRead:true,
      communicationId:commit.communicationId || null,
      investigationId:null,
      workItemId:null,
      client:{ id:client.id, clientCode:client.client_code, name:client.name }
    });
  } catch (error) {
    logWorkerError({ requestId, route:SAVE_GMAIL_INFORMATION_ACTION, stage:"gmail_information", error });
    return jsonResponse({ ok:false, requestId, action:SAVE_GMAIL_INFORMATION_ACTION, error:safeErrorMessage(error) }, 500);
  }
}

async function resolveClient(db, inferred, clientNameHint) {
  if (inferred?.code || inferred?.name) {
    const match = await db.prepare(`
      SELECT id, client_code, name
      FROM clients
      WHERE client_code = ? COLLATE NOCASE
         OR name = ? COLLATE NOCASE
      LIMIT 1
    `).bind(inferred.code || "", inferred.name || "").first();
    if (match) return match;
  }

  if (clientNameHint && !/unassigned|human review/i.test(clientNameHint)) {
    return db.prepare(`
      SELECT id, client_code, name
      FROM clients
      WHERE name = ? COLLATE NOCASE
         OR client_code = ? COLLATE NOCASE
      LIMIT 1
    `).bind(clientNameHint, clientNameHint).first();
  }

  return null;
}

function buildInformationSummary(message) {
  const subject = clean(message.subject) || "Informational email";
  const body = clean(message.bodyText || message.snippet).replace(/\s+/g, " ");
  const excerpt = body.length > 650 ? `${body.slice(0, 647).trim()}...` : body;
  return excerpt ? `${subject}. ${excerpt}` : `${subject}.`;
}

function positionTrackingSourceEvidence(value) {
  const text = sanitizeEmailText(value);
  if (!text) return "";
  const relevant = text.split(/\bGo to Campaign\b/i)[0].trim();
  return (relevant || text).slice(0, 8000);
}

function normalizeActivityDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10)
    : date.toISOString().slice(0, 10);
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
  if (!connection?.encrypted_refresh_token) throw new Error("Gmail is not connected.");

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

async function markMessageRead(gmailMessageId, accessToken) {
  const response = await fetch(`${GMAIL_API}/users/me/messages/${encodeURIComponent(gmailMessageId)}/modify`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${accessToken}`, "Content-Type":"application/json" },
    body:JSON.stringify({ removeLabelIds:["UNREAD"] })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Gmail modify failed with HTTP ${response.status}.`);
  return payload;
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
  return sanitizeEmailText(plain.length ? plain.join("\n\n") : html.join("\n\n"));
}

function decodeGmailText(value) {
  try { return new TextDecoder().decode(decodeBase64Url(value)); }
  catch { return ""; }
}

function htmlToText(value) {
  return sanitizeEmailText(String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
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
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || "Google token refresh failed.");
  return payload.access_token;
}

async function gmailFetch(url, accessToken) {
  const response = await fetch(url, { headers:{ Authorization:`Bearer ${accessToken}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Gmail API failed with HTTP ${response.status}.`);
  return payload;
}

function requireDb(env) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") throw new Error("The production D1 binding is unavailable.");
  return db;
}

function requireSecrets(env) {
  if (!clean(env?.GOOGLE_CLIENT_ID) || !clean(env?.GOOGLE_CLIENT_SECRET)) throw new Error("Google OAuth secrets are not configured.");
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
