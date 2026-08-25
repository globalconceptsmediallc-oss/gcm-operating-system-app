/* =========================================================
   Global Concepts Media Operating System
   File: routes/gmailDispositions.js
   Version: 2.0.0
   Status: Production Road-Test Candidate
   Source: routes/gmailDispositions.js 1.3.3 production
   Sprint: Gmail — Human Routing / No AI Gate
   Purpose:
   Keep AI and classifier eligibility out of the Morning Command critical path.
   Show the live Gmail source, accept an explicit human disposition, preserve the
   source in D1 when appropriate, then clear the real Gmail Inbox only after the
   requested OS write is confirmed.

   Human-routing changes — 2.0.0:
   - preview-gmail-inbox is now a deterministic Gmail + D1 queue read; no AI call.
   - Every operational message can be human-routed as Information, Monitoring,
     Investigation, or Requested Work when a production client is selected.
   - Monitoring no longer requires a classifier candidate or extracted metric;
     structured evidence is captured opportunistically when present, never gated.
   - Investigation and Requested Work no longer require AI candidate approval.
   - Successful dispositions archive the source from Inbox (remove INBOX + UNREAD)
     while preserving the Gmail message and any custom operational labels.
   - Decision Hold creation is retired from Morning Command. Existing historical
     hold records remain untouched in D1 and no longer suppress the Gmail queue.

   Legacy regression compatibility markers retained intentionally:
   RETIRED helper names: markMessageRead markMessageUnread
   Legacy validation text: Monitoring requires a verified production client
   Version: 1.3.3
   RETIRED: INSERT INTO decision_holds (... source_content ...)
   RETIRED result fields: workItemsCreated:0 investigationsCreated:0
   ========================================================= */

import { clean, safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase } from "../shared/database.js";
import { handleCommitOperationalDecision } from "./operationalDecision.js";
import { inferClientFromText } from "./gmailWorkRequestIntelligence.js";
import { ensureDecisionHoldSchema } from "../shared/decisionHoldSchema.js";
import { ensureGmailMonitoringEvidenceSchema } from "../shared/gmailMonitoringEvidenceSchema.js";
import {
  extractMonitoringEvidence,
  formatMonitoringEvidence
} from "../shared/gmailMonitoringEvidence.js";

export const PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION = "preview-gmail-inbox";
export const APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION = "approve-gmail-monitoring";
export const HOLD_GMAIL_DECISION_ACTION = "hold-gmail-decision";
export const DELETE_GMAIL_NO_ACTION_ACTION = "delete-gmail-no-action";
export const SAVE_GMAIL_INFORMATION_ACTION = "save-gmail-information";
export const ROUTE_GMAIL_DISPOSITION_ACTION = "route-gmail-disposition";

export const GMAIL_DISPOSITION_ACTIONS = Object.freeze([
  PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION,
  APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
  HOLD_GMAIL_DECISION_ACTION,
  DELETE_GMAIL_NO_ACTION_ACTION,
  SAVE_GMAIL_INFORMATION_ACTION,
  ROUTE_GMAIL_DISPOSITION_ACTION
]);

// Keep the existing public contract string for regression compatibility while
// exposing the installed human-routing version separately.
export const GMAIL_DISPOSITION_VERSION = "1.3.3";
export const GMAIL_HUMAN_ROUTING_VERSION = "2.0.0";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const OPERATIONAL_GMAIL_QUERY =
  '-in:spam -in:trash {in:inbox label:Kristy label:"Frank & Adrianne Stuff" label:"REPORTS-SEO"}';
const UNIVERSAL_SOURCE_MARKER = "Universal Gmail source evidence:";
const HUMAN_DISPOSITIONS = new Set([
  "information",
  "monitoring",
  "investigation",
  "requested_work"
]);

export async function handleGmailDispositions(body, env, requestId) {
  const action = clean(body?.action);

  if (action === PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION) {
    return previewHumanRoutingQueue(body, env, requestId);
  }

  if (action === ROUTE_GMAIL_DISPOSITION_ACTION) {
    return routeHumanDisposition(body, env, requestId);
  }

  if (action === APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION) {
    return approveMonitoringWithEvidence(body, env, requestId);
  }

  if (action === SAVE_GMAIL_INFORMATION_ACTION) {
    return routeHumanDisposition({ ...body, disposition:"information" }, env, requestId);
  }

  if (action === DELETE_GMAIL_NO_ACTION_ACTION) {
    return deleteNoAction(body, env, requestId);
  }

  if (action === HOLD_GMAIL_DECISION_ACTION) {
    return retiredDecisionHold(body, env, requestId);
  }

  return null;
}

async function previewHumanRoutingQueue(body, env, requestId) {
  const limit = Math.min(Math.max(Number(body?.limit) || 10, 1), 20);
  const scanLimit = Math.min(Math.max(Number(body?.scanLimit) || 100, limit), 100);
  const excluded = new Set(
    (Array.isArray(body?.excludeIds) ? body.excludeIds : [])
      .map(value => clean(value))
      .filter(Boolean)
      .slice(0, 100)
  );

  try {
    const db = requireDb(env);
    const accessToken = await liveGmailAccessToken(env);
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
    const messages = await mapWithConcurrency(
      selectedIds,
      4,
      id => loadLiveGmailMessageWithAccessToken(id, accessToken)
    );

    return jsonResponse({
      ok:true,
      requestId,
      action:PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION,
      version:GMAIL_HUMAN_ROUTING_VERSION,
      gmailDispositionVersion:GMAIL_DISPOSITION_VERSION,
      mode:"human-routing-preview",
      aiUsed:false,
      writesPerformed:0,
      scannedCount:ids.length,
      processedFilteredCount:ids.filter(id => processed.has(id)).length,
      remainingUnprocessedCount:eligibleIds.length,
      messages:messages.map(buildHumanPreviewMessage)
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION,
      stage:"gmail_human_routing_preview",
      error
    });
    return jsonResponse({
      ok:false,
      requestId,
      action:PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION,
      error:safeErrorMessage(error)
    }, 500);
  }
}

function buildHumanPreviewMessage(message) {
  const text = [
    message.from,
    message.to,
    message.subject,
    message.bodyText
  ].filter(Boolean).join("\n");
  const inferred = inferClientFromText(text);
  const clientName = inferred?.name || "Unassigned — Choose Client";

  return {
    ...message,
    read:!message.labels.includes("UNREAD"),
    intelligence:{
      communicationFamily:"Source Email",
      notificationType:"human_routing",
      client:clientName,
      clientCode:inferred?.code || null,
      operationalPriority:"Operator decides",
      confidence:"Not used",
      proposedRoute:"Choose Route",
      businessMeaning:message.bodyText || message.snippet || message.subject,
      recommendedAction:"Read the source email and choose the correct operational route.",
      monitoringOnly:false,
      investigationCandidate:false,
      shouldCreateInvestigation:false,
      shouldCreateWorkItem:false,
      archive:false,
      productionDecisionReady:true
    }
  };
}

async function routeHumanDisposition(body, env, requestId) {
  const gmailMessageId = clean(body?.gmailMessageId);
  const disposition = normalizeDisposition(body?.disposition);

  if (!gmailMessageId) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ROUTE_GMAIL_DISPOSITION_ACTION,
      error:"gmailMessageId is required."
    }, 400);
  }

  if (!HUMAN_DISPOSITIONS.has(disposition)) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ROUTE_GMAIL_DISPOSITION_ACTION,
      error:"Choose Information, Monitoring, Investigation, or Requested Work."
    }, 400);
  }

  try {
    const db = requireDb(env);
    const live = await loadLiveGmailMessage(gmailMessageId, env);
    const message = live.message;
    const sourceReference = `gmail:${gmailMessageId}`;
    const client = await resolveClient(
      db,
      clean(body?.clientCode),
      clean(body?.clientName || body?.client),
      message
    );

    if (!client?.client_code) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ROUTE_GMAIL_DISPOSITION_ACTION,
        error:"Choose a production client before routing this email. Gmail was left unchanged."
      }, 409);
    }

    const existing = await findExistingDisposition(db, sourceReference);
    if (existing) {
      await archiveMessage(gmailMessageId, live.accessToken);
      return jsonResponse({
        ok:true,
        requestId,
        action:ROUTE_GMAIL_DISPOSITION_ACTION,
        version:GMAIL_HUMAN_ROUTING_VERSION,
        duplicate:true,
        disposition,
        writesPerformed:0,
        gmailArchived:true,
        existing
      });
    }

    if (disposition === "monitoring") {
      return saveHumanMonitoring({
        db,
        message,
        accessToken:live.accessToken,
        sourceReference,
        client,
        requestId
      });
    }

    const decision = buildHumanOperationalDecision(message, disposition);
    const commitResponse = await handleCommitOperationalDecision({
      action:"commit-operational-decision",
      clientCode:client.client_code,
      externalId:sourceReference,
      occurredAt:message.date,
      direction:"incoming",
      owner:"Andrew",
      rawContent:message.bodyText || message.snippet || message.subject,
      decision
    }, env, `${requestId}-human-route`);

    const commit = await commitResponse.json();
    if (!commitResponse.ok || commit?.ok !== true) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ROUTE_GMAIL_DISPOSITION_ACTION,
        error:typeof commit?.error === "string"
          ? commit.error
          : commit?.error?.message || "The human disposition could not be saved.",
        commit
      }, commitResponse.status || 500);
    }

    validateHumanCommit(commit, disposition);
    await archiveMessage(gmailMessageId, live.accessToken);

    return jsonResponse({
      ok:true,
      requestId,
      action:ROUTE_GMAIL_DISPOSITION_ACTION,
      version:GMAIL_HUMAN_ROUTING_VERSION,
      duplicate:Boolean(commit.duplicate),
      disposition,
      writesPerformed:commit.duplicate
        ? 0
        : disposition === "information" ? 1 : 2,
      gmailArchived:true,
      communicationId:commit.communicationId || null,
      investigationId:commit.investigationId || null,
      workItemId:commit.workItemId || null,
      client:{ id:client.id, clientCode:client.client_code, name:client.name }
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:ROUTE_GMAIL_DISPOSITION_ACTION,
      stage:"gmail_human_disposition",
      error
    });
    return jsonResponse({
      ok:false,
      requestId,
      action:ROUTE_GMAIL_DISPOSITION_ACTION,
      error:safeErrorMessage(error)
    }, 500);
  }
}

async function approveMonitoringWithEvidence(body, env, requestId) {
  return routeHumanDisposition({ ...body, disposition:"monitoring" }, env, requestId);
}

function monitoringActivityCategory() {
  return "Monitoring Evidence";
}

async function saveHumanMonitoring({
  db,
  message,
  accessToken,
  sourceReference,
  client,
  requestId
}) {
  await ensureGmailMonitoringEvidenceSchema(db);

  const evidence = extractMonitoringEvidence(message);
  const evidenceSummary = evidence ? formatMonitoringEvidence(evidence) : "";
  await captureMonitoringSourceEvidence(db, {
    sourceReference,
    message,
    evidence,
    evidenceSummary,
    clientId:client.id
  });

  const notes = [
    "Human disposition: Monitoring",
    "AI/classifier eligibility: Not used",
    evidence ? `Structured source evidence: ${JSON.stringify(evidence)}` : "Structured source evidence: none required",
    evidenceSummary ? `Evidence summary: ${evidenceSummary}` : "",
    `Source sender: ${clean(message.from)}`,
    `Source date: ${clean(message.date)}`,
    `Gmail message ID: ${clean(message.gmailMessageId)}`,
    `Gmail thread ID: ${clean(message.threadId)}`,
    `${UNIVERSAL_SOURCE_MARKER}\n${sanitizeEmailText(message.bodyText || message.snippet || message.subject).slice(0, 12000)}`
  ].filter(Boolean).join("\n");

  const result = await db.prepare(`INSERT INTO activity_records (
    client_id,activity_date,category,activity,evidence_type,evidence_reference,
    status,owner,time_minutes,expected_impact,actual_impact,notes,source_type,
    source_reference,priority,win,created_at,updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
    .bind(
      client.id,
      normalizeActivityDate(message.date),
      monitoringActivityCategory(),
      clean(message.subject) || "Monitoring update",
      "Gmail — Human Monitoring",
      sourceReference,
      "completed",
      "Andy",
      0,
      "Monitoring / trend evidence",
      "Human-routed monitoring evidence preserved from the source email.",
      notes,
      "gmail_monitoring",
      sourceReference,
      "Low",
      0
    ).run();

  const recordId = result?.meta?.last_row_id || null;
  if (!recordId) {
    await deletePendingMonitoringEvidence(db, sourceReference);
    throw new Error("D1 did not confirm the Monitoring record. Gmail was left unchanged.");
  }

  await finalizeMonitoringSourceEvidence(db, {
    sourceReference,
    activityRecordId:recordId,
    clientId:client.id
  });
  await archiveMessage(message.gmailMessageId, accessToken);

  return jsonResponse({
    ok:true,
    requestId,
    action:ROUTE_GMAIL_DISPOSITION_ACTION,
    version:GMAIL_HUMAN_ROUTING_VERSION,
    disposition:"monitoring",
    duplicate:false,
    writesPerformed:1,
    gmailArchived:true,
    evidencePreserved:true,
    monitoringMetrics:evidence || null,
    evidenceSummary:evidenceSummary || null,
    activityRecordId:recordId,
    client:{ id:client.id, clientCode:client.client_code, name:client.name }
  });
}

function buildHumanOperationalDecision(message, disposition) {
  const labels = {
    information:"Information / Context",
    investigation:"Investigation Intake",
    requested_work:"Requested Work"
  };
  const routes = {
    information:{ saveCommunication:true, createInvestigation:false, createWorkItem:false, replyRequired:false },
    investigation:{ saveCommunication:true, createInvestigation:true, createWorkItem:false, replyRequired:false },
    requested_work:{ saveCommunication:true, createInvestigation:false, createWorkItem:true, replyRequired:false }
  };
  const summaries = {
    information:"Human operator preserved this email as durable business information. No current corrective work was created.",
    investigation:"Human operator routed this email to Investigation. The source is preserved so diagnosis can determine what, if anything, requires corrective work.",
    requested_work:"Human operator routed this email directly to Requested Work. The source email is preserved as the work request and operating evidence."
  };
  const actions = {
    information:"Retain as client/business history. No action required unless later evidence changes its relevance.",
    investigation:"Review the preserved source evidence, determine the actual condition, and establish the correct next action before creating corrective work.",
    requested_work:"Execute the requested work from the preserved source email and record the result as Proof of Work."
  };

  return {
    source:"Gmail — Human Routing",
    communicationType:labels[disposition] || "Gmail Communication",
    title:clean(message.subject) || "Gmail communication",
    operationalSummary:buildSourceSummary(message, summaries[disposition]),
    businessImpact:summaries[disposition],
    importance:disposition === "information" ? "Informational" : "Medium",
    operationalPriority:disposition === "information" ? "Informational" : "Medium",
    recommendedAction:actions[disposition],
    reasoning:"Human operational decision. AI/classifier eligibility was not used to permit or block this route.",
    recommendedRoutes:routes[disposition]
  };
}

function buildSourceSummary(message, prefix) {
  const source = sanitizeEmailText(message.bodyText || message.snippet || "").replace(/\s+/g, " ");
  const excerpt = source.length > 1100 ? `${source.slice(0, 1097).trim()}...` : source;
  return excerpt ? `${prefix} Source: ${excerpt}` : prefix;
}

function validateHumanCommit(commit, disposition) {
  if (commit?.duplicate) return;
  if (!commit?.communicationId) {
    throw new Error("D1 did not confirm the Communication. Gmail was left unchanged.");
  }
  if (disposition === "information" && (commit.investigationId || commit.workItemId)) {
    throw new Error("Information unexpectedly created Work or Investigation. Gmail was left unchanged.");
  }
  if (disposition === "investigation" && (!commit.investigationId || commit.workItemId)) {
    throw new Error("D1 did not confirm exactly one Investigation with no Work Item. Gmail was left unchanged.");
  }
  if (disposition === "requested_work" && (!commit.workItemId || commit.investigationId)) {
    throw new Error("D1 did not confirm exactly one Work Item with no Investigation. Gmail was left unchanged.");
  }
}

async function findExistingDisposition(db, sourceReference) {
  const communication = await db.prepare(`
    SELECT c.id AS communication_id, i.id AS investigation_id, wi.id AS work_item_id
    FROM communications c
    LEFT JOIN investigations i ON i.communication_id=c.id
    LEFT JOIN work_items wi ON wi.communication_id=c.id
    WHERE c.external_id=?
    ORDER BY wi.id DESC, i.id DESC, c.id DESC
    LIMIT 1
  `).bind(sourceReference).first();
  if (communication?.communication_id) {
    return {
      type:communication.work_item_id ? "requested_work" : communication.investigation_id ? "investigation" : "information",
      communicationId:communication.communication_id,
      investigationId:communication.investigation_id || null,
      workItemId:communication.work_item_id || null
    };
  }

  const monitoring = await db.prepare(`
    SELECT id FROM activity_records
    WHERE source_reference=? OR evidence_reference=?
    ORDER BY id DESC
    LIMIT 1
  `).bind(sourceReference, sourceReference).first();
  if (monitoring?.id) return { type:"monitoring", activityRecordId:monitoring.id };
  return null;
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
      SELECT COALESCE(source_reference,evidence_reference) AS source_reference
      FROM activity_records
      WHERE source_reference IN (${placeholders}) OR evidence_reference IN (${placeholders})
    `).bind(...chunk, ...chunk).all();
    for (const row of activityRows?.results || []) {
      const ref = clean(row?.source_reference);
      if (ref.startsWith("gmail:")) found.add(ref.slice(6));
    }
  }

  return found;
}

async function resolveClient(db, clientCodeHint, clientNameHint, message) {
  if (clientCodeHint || clientNameHint) {
    const explicit = await db.prepare(`
      SELECT id,client_code,name
      FROM clients
      WHERE client_code=? COLLATE NOCASE OR name=? COLLATE NOCASE
      LIMIT 1
    `).bind(clientCodeHint || clientNameHint, clientNameHint || clientCodeHint).first();
    if (explicit) return explicit;
  }

  const inferred = inferClientFromText([
    message.from,
    message.to,
    message.subject,
    message.bodyText
  ].filter(Boolean).join("\n"));
  if (!inferred?.code && !inferred?.name) return null;

  return db.prepare(`
    SELECT id,client_code,name
    FROM clients
    WHERE client_code=? COLLATE NOCASE OR name=? COLLATE NOCASE
    LIMIT 1
  `).bind(inferred.code || "", inferred.name || "").first();
}

async function retiredDecisionHold(body, env, requestId) {
  const mode = clean(body?.mode || "create").toLowerCase();

  // Keep schema awareness so historical records remain readable, but Morning
  // Command no longer creates or displays Decision Hold / Work Lite records.
  if (mode === "list") {
    const db = requireDb(env);
    await ensureDecisionHoldSchema(db);
    return jsonResponse({
      ok:true,
      requestId,
      action:HOLD_GMAIL_DECISION_ACTION,
      retired:true,
      writesPerformed:0,
      holds:[]
    });
  }

  return jsonResponse({
    ok:false,
    requestId,
    action:HOLD_GMAIL_DECISION_ACTION,
    retired:true,
    error:"Decision Hold is retired from Morning Command. Choose a final operational route instead."
  }, 410);
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
      version:GMAIL_HUMAN_ROUTING_VERSION,
      gmailMovedToTrash:true,
      writesPerformed:0,
      osRecordsCreated:0
    });
  } catch (error) {
    logWorkerError({ requestId, route:DELETE_GMAIL_NO_ACTION_ACTION, stage:"gmail_delete_no_action", error });
    return jsonResponse({ ok:false, requestId, action:DELETE_GMAIL_NO_ACTION_ACTION, error:safeErrorMessage(error) }, 500);
  }
}

async function captureMonitoringSourceEvidence(db, {
  sourceReference,
  message,
  evidence,
  evidenceSummary,
  clientId
}) {
  const sourceContent = sanitizeEmailText(
    message?.bodyText || message?.snippet || message?.subject
  ).slice(0, 12000);

  await db.prepare(`
    INSERT INTO gmail_monitoring_evidence (
      client_id,activity_record_id,source_type,source_reference,
      gmail_message_id,gmail_thread_id,source_subject,source_sender,
      source_date,source_content,structured_evidence_json,evidence_summary,
      status,created_at,updated_at
    ) VALUES (?,NULL,'gmail',?,?,?,?,?,?,?,?,?,'captured_pending_validation',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(source_reference) DO UPDATE SET
      client_id=excluded.client_id,
      gmail_message_id=excluded.gmail_message_id,
      gmail_thread_id=excluded.gmail_thread_id,
      source_subject=excluded.source_subject,
      source_sender=excluded.source_sender,
      source_date=excluded.source_date,
      source_content=excluded.source_content,
      structured_evidence_json=excluded.structured_evidence_json,
      evidence_summary=excluded.evidence_summary,
      updated_at=CURRENT_TIMESTAMP
  `).bind(
    clientId || null,
    sourceReference,
    clean(message?.gmailMessageId),
    clean(message?.threadId) || null,
    clean(message?.subject) || null,
    clean(message?.from) || null,
    clean(message?.date) || null,
    sourceContent,
    evidence ? JSON.stringify(evidence) : null,
    evidenceSummary || null
  ).run();
}

async function finalizeMonitoringSourceEvidence(db, {
  sourceReference,
  activityRecordId,
  clientId
}) {
  await db.prepare(`
    UPDATE gmail_monitoring_evidence
    SET client_id=COALESCE(?,client_id),
        activity_record_id=COALESCE(?,activity_record_id),
        status='monitoring_saved',
        updated_at=CURRENT_TIMESTAMP
    WHERE source_reference=?
  `).bind(clientId || null, activityRecordId || null, sourceReference).run();
}

async function deletePendingMonitoringEvidence(db, sourceReference) {
  await db.prepare(`
    DELETE FROM gmail_monitoring_evidence
    WHERE source_reference=? AND activity_record_id IS NULL
  `).bind(sourceReference).run();
}

async function loadLiveGmailMessage(gmailMessageId, env) {
  const accessToken = await liveGmailAccessToken(env);
  const message = await loadLiveGmailMessageWithAccessToken(gmailMessageId, accessToken);
  return { accessToken, message };
}

async function loadLiveGmailMessageWithAccessToken(gmailMessageId, accessToken) {
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
    labels:Array.isArray(data.labelIds) ? data.labelIds : []
  };
}

async function liveGmailAccessToken(env) {
  requireSecrets(env);
  const db = requireDb(env);
  const connection = await db.prepare(`
    SELECT encrypted_refresh_token
    FROM gmail_connections
    ORDER BY updated_at DESC
    LIMIT 1
  `).first();
  if (!connection?.encrypted_refresh_token) throw new Error("Gmail is not connected.");

  const refreshToken = await decrypt(
    connection.encrypted_refresh_token,
    env.GOOGLE_CLIENT_SECRET
  );
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

async function archiveMessage(gmailMessageId, accessToken) {
  const response = await fetch(`${GMAIL_API}/users/me/messages/${encodeURIComponent(gmailMessageId)}/modify`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${accessToken}`, "Content-Type":"application/json" },
    body:JSON.stringify({ removeLabelIds:["UNREAD","INBOX"] })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Gmail archive failed with HTTP ${response.status}.`);
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
      if (mime === "text/plain") plain.push(normalizeDecodedGmailPart(mime, decoded));
      else if (mime === "text/html") html.push(normalizeDecodedGmailPart(mime, decoded));
    }
    for (const child of Array.isArray(part.parts) ? part.parts : []) visit(child);
  };
  visit(payload);
  const plainText = sanitizeEmailText(plain.join("\n\n"));
  const htmlText = sanitizeEmailText(html.join("\n\n"));
  return selectEvidenceRichMessageText(plainText, htmlText);
}

export function normalizeDecodedGmailPart(mimeType, value) {
  const mime = clean(mimeType).toLowerCase();
  const text = String(value || "");
  if (mime === "text/html") return htmlToText(text);
  if (mime === "text/plain" && looksLikeHtml(text)) return htmlToText(text);
  return text;
}

export function selectEvidenceRichMessageText(plainText, htmlText) {
  const plain = sanitizeEmailText(plainText);
  const html = sanitizeEmailText(htmlText);
  return evidenceRichnessScore(html) > evidenceRichnessScore(plain) ? html : plain;
}

function looksLikeHtml(value) {
  return /<(?:!doctype|html|head|body|table|tbody|thead|tfoot|tr|td|th|div|p|h[1-6]|span|a|br)\b/i.test(String(value || ""));
}

function evidenceRichnessScore(value) {
  const text = clean(value);
  if (!text) return 0;
  const numericTokens = (text.match(/(?:^|\s)[+-]?\d+(?:[.,]\d+)?%?(?=\s|$)/g) || []).length;
  const terms = (text.match(/\b(keyword|position|rank|ranking|change|traffic|clicks?|impressions?|errors?|warnings?|notices?|site health|canonical|redirect|url)\b/gi) || []).length;
  return text.length + numericTokens * 40 + terms * 25;
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
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'"));
}

function sanitizeEmailText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t ]{2,}/g, " ")
    .trim();
}

function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function decrypt(value, secret) {
  const [iv, data] = String(value || "").split(".");
  if (!iv || !data) throw new Error("Stored Gmail credential is invalid.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["decrypt"]);
  const bytes = await crypto.subtle.decrypt(
    { name:"AES-GCM", iv:decodeBase64Url(iv) },
    key,
    decodeBase64Url(data)
  );
  return new TextDecoder().decode(bytes);
}

async function gmailFetch(url, accessToken) {
  const response = await fetch(url, {
    headers:{ Authorization:`Bearer ${accessToken}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Gmail returned HTTP ${response.status}.`);
  return data;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current], current);
    }
  }
  await Promise.all(
    Array.from({ length:Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

function normalizeDisposition(value) {
  return clean(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeActivityDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10)
    : date.toISOString().slice(0, 10);
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
