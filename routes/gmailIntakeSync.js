/* =========================================================
   Global Concepts Media Operating System
   File: routes/gmailIntakeSync.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Gmail ↔ Universal Intake Reconciliation
   Purpose:
   Reconcile the live Global Concepts Media Gmail Inbox against durable D1
   email_intake records. New Inbox messages are staged into Universal Intake.
   Gmail messages whose matching D1 intake record is already processed are
   moved to Trash only after D1 confirms that processed state.
   ========================================================= */

import { getDatabase } from "../shared/database.js";
import { clean, jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";
import { inferClientFromText } from "./gmailWorkRequestIntelligence.js";
import {
  gmailFetch,
  liveGmailAccessToken,
  loadLiveGmailMessageWithAccessToken
} from "./gmailDispositions.js";

export const GMAIL_INTAKE_SYNC_VERSION = "1.0.0";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const DEFAULT_SCAN_LIMIT = 100;
const MAX_SCAN_LIMIT = 200;
const MAX_BODY_CHARS = 120000;

export async function handleGmailIntakeSync(body, env, requestId) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok:false,
      requestId,
      action:"sync-gmail-intake",
      error:"The production D1 binding is unavailable."
    },503);
  }

  const workspaceKey = clean(body?.workspaceKey) || "gcm";
  const requestedLimit = Number(body?.scanLimit);
  const scanLimit = Number.isFinite(requestedLimit)
    ? Math.min(MAX_SCAN_LIMIT, Math.max(1, Math.trunc(requestedLimit)))
    : DEFAULT_SCAN_LIMIT;
  const trashProcessed = body?.trashProcessed !== false;

  try {
    const accessToken = await liveGmailAccessToken(env);
    const account = await db.prepare(`
      SELECT account_email
      FROM gmail_connections
      ORDER BY updated_at DESC
      LIMIT 1
    `).first();

    const listUrl = new URL(`${GMAIL_API}/users/me/messages`);
    listUrl.searchParams.set("q","in:inbox -in:spam -in:trash");
    listUrl.searchParams.set("maxResults",String(scanLimit));

    const list = await gmailFetch(listUrl.toString(), accessToken);
    const refs = (Array.isArray(list?.messages) ? list.messages : [])
      .map(item => ({
        gmailMessageId:clean(item?.id),
        threadId:clean(item?.threadId || item?.id)
      }))
      .filter(item => item.gmailMessageId);

    const messages = await mapWithConcurrency(
      refs,
      4,
      item => loadLiveGmailMessageWithAccessToken(item.gmailMessageId, accessToken)
    );

    let inserted = 0;
    let alreadyReady = 0;
    let processedMatched = 0;
    let movedToTrash = 0;
    let retainedForReview = 0;
    let unresolved = 0;
    const movedSubjects = [];
    const newlyStagedSubjects = [];

    for (const message of messages) {
      let intake = await findExistingIntake(db, workspaceKey, message);

      if (!intake) {
        const clientId = await resolveClientId(db, message);
        await insertGmailIntake(db, {
          workspaceKey,
          message,
          clientId,
          accountEmail:clean(account?.account_email)
        });
        intake = await findExistingIntake(db, workspaceKey, message);
        if (intake) {
          inserted += 1;
          newlyStagedSubjects.push(clean(message?.subject) || "(No subject)");
        }
      }

      if (!intake) {
        unresolved += 1;
        continue;
      }

      const status = clean(intake.processing_status).toLowerCase();
      const disposition = clean(intake.disposition).toLowerCase();

      if (status === "processed" && disposition) {
        processedMatched += 1;
        if (trashProcessed && Array.isArray(message?.labels) && message.labels.includes("INBOX")) {
          await trashGmailMessage(message.gmailMessageId, accessToken);
          movedToTrash += 1;
          movedSubjects.push(clean(message?.subject) || "(No subject)");
        }
        continue;
      }

      if (status === "ready_for_review") {
        if (clean(intake.provider_message_id) === clean(message?.gmailMessageId)) {
          alreadyReady += 1;
        }
        retainedForReview += 1;
        continue;
      }

      retainedForReview += 1;
    }

    const countRow = await db.prepare(`
      SELECT COUNT(*) AS count
      FROM email_intake
      WHERE workspace_key=?
        AND processing_status='ready_for_review'
    `).bind(workspaceKey).first();

    return jsonResponse({
      ok:true,
      requestId,
      action:"sync-gmail-intake",
      gmailIntakeSyncVersion:GMAIL_INTAKE_SYNC_VERSION,
      accountEmail:clean(account?.account_email) || null,
      scannedInboxMessages:messages.length,
      newlyStaged:inserted,
      alreadyReady,
      processedMatched,
      movedToTrash,
      retainedForReview,
      unresolved,
      readyForReview:Number(countRow?.count || 0),
      movedSubjects:movedSubjects.slice(0,25),
      newlyStagedSubjects:newlyStagedSubjects.slice(0,25),
      trashProcessed
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:"sync-gmail-intake",
      stage:"gmail_d1_reconciliation",
      error
    });
    return jsonResponse({
      ok:false,
      requestId,
      action:"sync-gmail-intake",
      error:safeErrorMessage(error)
    },500);
  }
}

async function findExistingIntake(db, workspaceKey, message) {
  const gmailMessageId = clean(message?.gmailMessageId);
  const internetMessageId = normalizeInternetMessageId(message?.internetMessageId);
  const dedupeKey = internetMessageId
    ? `message-id:${internetMessageId.toLowerCase()}`
    : `gmail-message:${gmailMessageId}`;

  const row = await db.prepare(`
    SELECT
      id,
      provider,
      provider_message_id,
      provider_thread_id,
      internet_message_id,
      dedupe_key,
      processing_status,
      disposition,
      processed_at
    FROM email_intake
    WHERE workspace_key=?
      AND (
        provider_message_id=?
        OR dedupe_key=?
        OR (? <> '' AND lower(COALESCE(internet_message_id,''))=lower(?))
      )
    ORDER BY
      CASE WHEN provider_message_id=? THEN 0 ELSE 1 END,
      id DESC
    LIMIT 1
  `).bind(
    workspaceKey,
    gmailMessageId,
    dedupeKey,
    internetMessageId,
    internetMessageId,
    gmailMessageId
  ).first();

  return row || null;
}

async function insertGmailIntake(db, {
  workspaceKey,
  message,
  clientId,
  accountEmail
}) {
  const gmailMessageId = clean(message?.gmailMessageId);
  const threadId = clean(message?.threadId);
  const internetMessageId = normalizeInternetMessageId(message?.internetMessageId);
  const dedupeKey = internetMessageId
    ? `message-id:${internetMessageId.toLowerCase()}`
    : `gmail-message:${gmailMessageId}`;
  const mailbox = parseMailbox(message?.from);
  const receivedAt = receivedIso(message);
  const rawStorageReference = accountEmail
    ? `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(accountEmail)}#all/${gmailMessageId}`
    : null;

  await db.prepare(`
    INSERT OR IGNORE INTO email_intake (
      workspace_key,
      intake_address_id,
      provider,
      provider_message_id,
      provider_thread_id,
      internet_message_id,
      dedupe_key,
      received_at,
      source_date,
      from_address,
      from_name,
      to_addresses_json,
      cc_addresses_json,
      reply_to_address,
      subject,
      body_text,
      source_headers_json,
      has_attachments,
      attachment_metadata_json,
      raw_storage_reference,
      client_id,
      processing_status,
      created_at,
      updated_at
    ) VALUES (
      ?,NULL,'gmail_live_sync',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
      'ready_for_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    )
  `).bind(
    workspaceKey,
    gmailMessageId,
    threadId || null,
    internetMessageId || null,
    dedupeKey,
    receivedAt,
    clean(message?.date) || receivedAt,
    mailbox.address || null,
    mailbox.name || null,
    JSON.stringify(clean(message?.to) ? [clean(message.to)] : []),
    "[]",
    null,
    clean(message?.subject) || "(No subject)",
    clean(message?.bodyText || message?.snippet).slice(0,MAX_BODY_CHARS),
    JSON.stringify({
      gmail_message_id:gmailMessageId,
      gmail_thread_id:threadId || null,
      internet_message_id:internetMessageId || null,
      labels:Array.isArray(message?.labels) ? message.labels : []
    }),
    0,
    "[]",
    rawStorageReference,
    clientId || null
  ).run();
}

async function resolveClientId(db, message) {
  const inferred = inferClientFromText([
    message?.from,
    message?.to,
    message?.subject,
    message?.bodyText
  ].filter(Boolean).join("\n"));

  const code = clean(inferred?.code);
  const name = clean(inferred?.name);
  if (!code && !name) return null;

  const row = await db.prepare(`
    SELECT id
    FROM clients
    WHERE client_code=? COLLATE NOCASE
       OR name=? COLLATE NOCASE
    LIMIT 1
  `).bind(code || name, name || code).first();

  return Number(row?.id) || null;
}

async function trashGmailMessage(gmailMessageId, accessToken) {
  const response = await fetch(
    `${GMAIL_API}/users/me/messages/${encodeURIComponent(gmailMessageId)}/trash`,
    {
      method:"POST",
      headers:{
        Authorization:`Bearer ${accessToken}`,
        "Content-Type":"application/json"
      },
      body:"{}"
    }
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gmail Trash returned HTTP ${response.status}.`);
  }
  return payload;
}

function normalizeInternetMessageId(value) {
  return clean(value).replace(/^<|>$/g,"");
}

function parseMailbox(value) {
  const text = clean(value);
  const match = text.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return {
      name:clean(match[1]).replace(/^"|"$/g,""),
      address:clean(match[2]).toLowerCase()
    };
  }
  return {
    name:"",
    address:text.includes("@") ? text.toLowerCase() : ""
  };
}

function receivedIso(message) {
  const internal = Number(message?.internalDate || 0);
  if (Number.isFinite(internal) && internal > 0) {
    return new Date(internal).toISOString();
  }
  const parsed = Date.parse(clean(message?.date));
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return new Date().toISOString();
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const output = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from(
    { length:Math.min(Math.max(1,concurrency), Math.max(1,items.length)) },
    () => worker()
  );
  await Promise.all(workers);
  return output;
}
