/* =========================================================
   Global Concepts Media Operating System
   File: routes/gmailWorkRequests.js
   Version: 1.1.2
   Status: Production Road-Test Candidate
   Source: routes/gmailWorkRequests.js 1.0.0 production
   Sprint: Gmail — Durable Operational Intake
   Purpose:
   Preserve the verified Gmail direct-Work approval path while adding a
   read-only backlog mode that finds operational email by GCM OS disposition
   state instead of Gmail read/unread state.

   Change notes — v1.1.2:
   - Routes operational backlog cards through evidence-aware backlog intelligence.
   - Metric labels such as Errors and Issues no longer force Investigation when
     the live client report instead provides measurable Monitoring evidence.
   - Preserves the existing direct Work approval and durable backlog behavior.

   Change notes — v1.1.1:
   - Open Decision Hold / Work Lite records now count as a durable disposition
     source, so parked Gmail does not immediately return to Morning Command.
   - Released Decision Holds no longer suppress the source email.
   - Preserves all v1.1.0 backlog and direct Work behavior.

   Change notes — v1.1.0:
   - Adds read-only operational-backlog mode to evaluate-gmail-work-request.
   - Searches Inbox, Kristy, Frank & Adrianne Stuff, and REPORTS-SEO regardless
     of Gmail read state, while excluding Spam and Trash.
   - Filters messages already preserved by Communications or activity_records.
   - Accepts already-displayed Gmail IDs so the Today page can merge the backlog
     without duplicating normal unread-preview cards.
   - Uses lightweight route hints only for display; existing Monitoring,
     Investigation, Information, Work, and Delete approval routes remain the
     authoritative write-time validators.
   - Preserves v1.0.0 direct Work duplicate protection and Gmail behavior.

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
import {
  evaluateExplicitHumanWorkRequest,
  inferClientFromText
} from "./gmailWorkRequestIntelligence.js";
import { classifyOperationalBacklogMessage } from "./gmailBacklogIntelligence.js";

export const EVALUATE_GMAIL_WORK_REQUEST_ACTION = "evaluate-gmail-work-request";
export const APPROVE_GMAIL_WORK_REQUEST_ACTION = "approve-gmail-work-request";
export const GMAIL_WORK_REQUEST_ACTIONS = Object.freeze([
  EVALUATE_GMAIL_WORK_REQUEST_ACTION,
  APPROVE_GMAIL_WORK_REQUEST_ACTION
]);

export const GMAIL_WORK_REQUEST_VERSION = "1.1.2";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const OPERATIONAL_GMAIL_QUERY =
  '-in:spam -in:trash {in:inbox label:Kristy label:"Frank & Adrianne Stuff" label:"REPORTS-SEO"}';

export async function handleGmailWorkRequests(body, env, requestId) {
  const action = clean(body?.action);

  if (action === EVALUATE_GMAIL_WORK_REQUEST_ACTION) {
    if (clean(body?.mode).toLowerCase() === "operational-backlog") {
      return evaluateOperationalBacklog(body, env, requestId);
    }
    return evaluateRequest(body, env, requestId);
  }

  if (action === APPROVE_GMAIL_WORK_REQUEST_ACTION) {
    return approveRequest(body, env, requestId);
  }

  return null;
}

async function evaluateOperationalBacklog(body, env, requestId) {
  const limit = Math.min(Math.max(Number(body?.limit) || 10, 1), 20);
  const scanLimit = Math.min(Math.max(Number(body?.scanLimit) || 100, limit), 100);
  const excluded = new Set(
    (Array.isArray(body?.excludeIds) ? body.excludeIds : [])
      .map(value => clean(value))
      .filter(Boolean)
      .slice(0, 100)
  );

  try {
    requireSecrets(env);
    const db = requireDb(env);
    const connection = await db.prepare(`
      SELECT account_email, encrypted_refresh_token
      FROM gmail_connections
      ORDER BY updated_at DESC
      LIMIT 1
    `).first();

    if (!connection?.encrypted_refresh_token) {
      return jsonResponse({
        ok:false,
        requestId,
        action:EVALUATE_GMAIL_WORK_REQUEST_ACTION,
        mode:"operational-backlog",
        error:"Gmail is not connected."
      }, 401);
    }

    const refreshToken = await decrypt(
      connection.encrypted_refresh_token,
      env.GOOGLE_CLIENT_SECRET
    );
    const accessToken = await refreshAccessToken(refreshToken, env);

    const listUrl = new URL(`${GMAIL_API}/users/me/messages`);
    listUrl.searchParams.set("q", OPERATIONAL_GMAIL_QUERY);
    listUrl.searchParams.set("maxResults", String(scanLimit));

    const list = await gmailFetch(listUrl.toString(), accessToken);
    const ids = (Array.isArray(list?.messages) ? list.messages : [])
      .map(item => clean(item?.id))
      .filter(Boolean);

    const processed = await findProcessedGmailIds(db, ids);
    const eligibleIds = ids.filter(id => !processed.has(id) && !excluded.has(id));
    const selectedIds = eligibleIds.slice(0, limit);

    const messages = await Promise.all(
      selectedIds.map(id => loadMessageWithAccessToken(id, accessToken))
    );

    return jsonResponse({
      ok:true,
      requestId,
      action:EVALUATE_GMAIL_WORK_REQUEST_ACTION,
      mode:"operational-backlog",
      version:GMAIL_WORK_REQUEST_VERSION,
      writesPerformed:0,
      querySources:["Inbox", "Kristy", "Frank & Adrianne Stuff", "REPORTS-SEO"],
      scannedCount:ids.length,
      processedFilteredCount:ids.filter(id => processed.has(id)).length,
      displayedExcludedCount:ids.filter(id => excluded.has(id)).length,
      remainingUnprocessedCount:eligibleIds.length,
      messages:messages.map(classifyOperationalBacklogMessage)
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:EVALUATE_GMAIL_WORK_REQUEST_ACTION,
      stage:"gmail_operational_backlog",
      error
    });
    return jsonResponse({
      ok:false,
      requestId,
      action:EVALUATE_GMAIL_WORK_REQUEST_ACTION,
      mode:"operational-backlog",
      error:safeErrorMessage(error)
    }, 500);
  }
}

async function findProcessedGmailIds(db, gmailIds) {
  const found = new Set();
  const refs = gmailIds.map(id => `gmail:${id}`);
  const chunkSize = 40;

  for (let start = 0; start < refs.length; start += chunkSize) {
    const chunk = refs.slice(start, start + chunkSize);
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => "?").join(",");

    const communicationRows = await db.prepare(`
      SELECT external_id AS source_reference
      FROM communications
      WHERE external_id IN (${placeholders})
    `).bind(...chunk).all();

    for (const row of communicationRows?.results || []) {
      const ref = clean(row?.source_reference);
      if (ref.startsWith("gmail:")) found.add(ref.slice(6));
    }

    const activityRows = await db.prepare(`
      SELECT COALESCE(source_reference, evidence_reference) AS source_reference
      FROM activity_records
      WHERE source_reference IN (${placeholders})
         OR evidence_reference IN (${placeholders})
    `).bind(...chunk, ...chunk).all();

    for (const row of activityRows?.results || []) {
      const ref = clean(row?.source_reference);
      if (ref.startsWith("gmail:")) found.add(ref.slice(6));
    }

    const holdRows = await db.prepare(`
      SELECT source_reference
      FROM decision_holds
      WHERE source_reference IN (${placeholders})
        AND LOWER(COALESCE(status, 'open')) IN ('open','held','waiting')
    `).bind(...chunk).all();

    for (const row of holdRows?.results || []) {
      const ref = clean(row?.source_reference);
      if (ref.startsWith("gmail:")) found.add(ref.slice(6));
    }
  }

  return found;
}

function mapOperationalBacklogMessage(message) {
  const text = `${message.subject}\n${message.bodyText}`;
  const work = evaluateExplicitHumanWorkRequest(message);
  const client = work.client || inferClientFromText(text);
  const reportSignal = /\b(semrush|search console|google analytics|analytics|youtube|site audit|position tracking|backlink audit|performance report|page indexing|merchant center)\b/i.test(text);
  const adverseSignal = /\b(broken|not firing|failed|failure|error|issue|declin(?:e|ed|ing)|drops? to zero|zero traffic|validation failed|not registering|critical|urgent)\b/i.test(text);
  const monitorCandidate = reportSignal && !adverseSignal && work.candidate !== true;
  const investigationCandidate = adverseSignal && work.candidate !== true;

  let proposedRoute = "Manual Review";
  if (work.candidate === true) proposedRoute = "Requested Work";
  else if (investigationCandidate) proposedRoute = "Investigation Review";
  else if (monitorCandidate) proposedRoute = "Monitoring Review";

  const communicationFamily = work.role
    ? "Human — Operational Email"
    : reportSignal
      ? "Operational Report / Monitoring"
      : "Operational Email";

  const businessMeaning = work.businessImpact ||
    (client
      ? `This ${client.name} email remains in an operational Gmail source and no GCM OS Communication or monitoring source record proves that it has been processed.`
      : "This email remains in an operational Gmail source and no GCM OS source record proves that it has been processed.");

  const recommendedAction = work.action ||
    (investigationCandidate
      ? "Review the evidence and use Investigation only if the live email proves a problem whose corrective action is not yet established."
      : monitorCandidate
        ? "Review the report and save it as Monitoring only if the live evidence is still useful for trend history."
        : "Choose the correct disposition: Delete if it has no durable value, Keep as Information if it matters historically, or use a stronger route when the email proves action is required.");

  return {
    gmailMessageId:message.gmailMessageId,
    threadId:message.threadId,
    from:message.from,
    to:message.to,
    subject:message.subject,
    date:message.date,
    snippet:message.snippet,
    bodyText:message.bodyText,
    labels:message.labels,
    read:!message.labels.includes("UNREAD"),
    intelligence:{
      communicationFamily,
      notificationType:work.candidate === true
        ? "direct_work_request"
        : reportSignal
          ? "operational_report"
          : "manual_review",
      client:client?.name || "Unassigned — Human Review",
      businessMeaning,
      operationalPriority:work.priority || (adverseSignal ? "High" : "Normal"),
      recommendedAction,
      shouldCreateCommunication:Boolean(client),
      shouldCreateInvestigation:investigationCandidate,
      investigationCandidate,
      shouldCreateWorkItem:work.candidate === true,
      monitoringOnly:monitorCandidate,
      archive:false,
      proposedRoute,
      confidence:client ? "High" : "Medium",
      decisionReliability:"Backlog intake signal — authoritative approval re-validates the live email",
      evidenceSufficiency:"Sufficient to require operator disposition; write route is re-verified at approval time",
      evidenceComparedAgainst:"Current Gmail message ID compared with production Communication, monitoring, and open Decision Hold source references",
      verificationRequired:"Choose one explicit disposition. Do not treat Gmail read state as proof that the email was processed.",
      humanReviewRequired:true,
      productionDecisionReady:false
    }
  };
}

async function evaluateRequest(body, env, requestId) {
  const gmailMessageId = clean(body?.gmailMessageId);
  if (!gmailMessageId) {
    return jsonResponse({
      ok:false,
      requestId,
      action:EVALUATE_GMAIL_WORK_REQUEST_ACTION,
      error:"gmailMessageId is required."
    }, 400);
  }

  try {
    const { message } = await loadLiveGmailMessage(gmailMessageId, env);
    const intelligence = evaluateExplicitHumanWorkRequest(message);

    return jsonResponse({
      ok:true,
      requestId,
      action:EVALUATE_GMAIL_WORK_REQUEST_ACTION,
      version:GMAIL_WORK_REQUEST_VERSION,
      writesPerformed:0,
      candidate:intelligence.candidate === true,
      intelligence:mapIntelligence(intelligence)
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:EVALUATE_GMAIL_WORK_REQUEST_ACTION,
      stage:"gmail_work_candidate",
      error
    });
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
    return jsonResponse({
      ok:false,
      requestId,
      action:APPROVE_GMAIL_WORK_REQUEST_ACTION,
      error:"gmailMessageId is required."
    }, 400);
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
        error:typeof commit?.error === "string"
          ? commit.error
          : commit?.error?.message || "The requested Work decision could not be committed.",
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
        client:{
          id:client.id,
          clientCode:client.client_code,
          name:client.name
        },
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
      client:{
        id:client.id,
        clientCode:client.client_code,
        name:client.name
      },
      intelligence:mapIntelligence(intelligence)
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:APPROVE_GMAIL_WORK_REQUEST_ACTION,
      stage:"gmail_work_approval",
      error
    });
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

  const refreshToken = await decrypt(
    connection.encrypted_refresh_token,
    env.GOOGLE_CLIENT_SECRET
  );
  const accessToken = await refreshAccessToken(refreshToken, env);
  const message = await loadMessageWithAccessToken(gmailMessageId, accessToken);

  return { accessToken, message };
}

async function loadMessageWithAccessToken(gmailMessageId, accessToken) {
  const data = await gmailFetch(
    `${GMAIL_API}/users/me/messages/${encodeURIComponent(gmailMessageId)}?format=full`,
    accessToken
  );
  const headers = data?.payload?.headers || [];
  const header = name => clean(
    headers.find(item => clean(item.name).toLowerCase() === name.toLowerCase())?.value
  );
  const bodyText = extractMessageText(data?.payload).slice(0, 12000);

  return {
    gmailMessageId:data.id,
    threadId:data.threadId,
    from:header("From"),
    to:header("To"),
    subject:header("Subject") || "(No subject)",
    date:header("Date"),
    snippet:clean(data.snippet),
    bodyText:bodyText || clean(data.snippet),
    labels:Array.isArray(data?.labelIds) ? data.labelIds : []
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
  const response = await fetch(
    `${GMAIL_API}/users/me/messages/${encodeURIComponent(gmailMessageId)}/modify`,
    {
      method:"POST",
      headers:{
        Authorization:`Bearer ${accessToken}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({ removeLabelIds:["UNREAD"] })
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gmail modify failed with HTTP ${response.status}.`);
  }
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
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google token refresh failed.");
  }
  return data.access_token;
}

async function gmailFetch(url, accessToken) {
  const response = await fetch(url, {
    headers:{ Authorization:`Bearer ${accessToken}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gmail API failed with HTTP ${response.status}.`);
  }
  return data;
}

function requireDb(env) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") {
    throw new Error("The production D1 binding is unavailable.");
  }
  return db;
}

function requireSecrets(env) {
  if (!clean(env?.GOOGLE_CLIENT_ID) || !clean(env?.GOOGLE_CLIENT_SECRET)) {
    throw new Error("Google OAuth secrets are not configured.");
  }
}

async function cryptoKey(secret) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret)
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    "AES-GCM",
    false,
    ["decrypt"]
  );
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
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(
    atob(padded),
    character => character.charCodeAt(0)
  );
}
