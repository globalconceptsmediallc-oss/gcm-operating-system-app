/* =========================================================
   Global Concepts Media Operating System
   File: routes/emailIntake.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Universal Email Intake — Cloudflare Email Worker
   Purpose:
   Receive provider-independent inbound email from Cloudflare Email Routing,
   normalize it once, preserve source evidence in D1, and place it into the
   durable Morning Command intake queue without AI or Gmail API reads.
   ========================================================= */

import PostalMime from "postal-mime";
import { getDatabase } from "../shared/database.js";

export const EMAIL_INTAKE_VERSION = "1.0.0";
const MAX_BODY_CHARS = 120000;

export async function handleInboundEmail(message, env, ctx) {
  const db = requireDb(env);
  const intakeAddress = cleanAddress(message?.to);

  if (!intakeAddress) {
    message?.setReject?.("The GCM OS intake recipient is missing.");
    return { ok:false, rejected:true, reason:"missing_recipient" };
  }

  const addressRecord = await db.prepare(`
    SELECT id, workspace_key, intake_address, label
    FROM email_intake_addresses
    WHERE lower(intake_address)=lower(?)
      AND is_active=1
    LIMIT 1
  `).bind(intakeAddress).first();

  if (!addressRecord) {
    message?.setReject?.("This GCM OS intake address is not active.");
    return { ok:false, rejected:true, reason:"unknown_intake_address" };
  }

  const rawBytes = await readRawBytes(message?.raw);
  const parsed = await PostalMime.parse(rawBytes);
  const headers = selectedHeaders(message?.headers);
  const internetMessageId = clean(
    parsed?.messageId ||
    headers["message-id"]
  );
  const dedupeKey = internetMessageId
    ? `message-id:${internetMessageId.toLowerCase()}`
    : `sha256:${await sha256(rawBytes)}`;

  const existing = await db.prepare(`
    SELECT id, processing_status, disposition
    FROM email_intake
    WHERE workspace_key=?
      AND dedupe_key=?
    LIMIT 1
  `).bind(addressRecord.workspace_key, dedupeKey).first();

  if (existing) {
    return {
      ok:true,
      duplicate:true,
      intakeId:existing.id,
      processingStatus:existing.processing_status,
      disposition:existing.disposition || null
    };
  }

  const from = mailbox(parsed?.from) || {
    address:cleanAddress(message?.from),
    name:""
  };
  const to = mailboxList(parsed?.to);
  if (!to.some(item => cleanAddress(item.address) === intakeAddress)) {
    to.push({ address:intakeAddress, name:"" });
  }
  const cc = mailboxList(parsed?.cc);
  const replyTo = mailboxList(parsed?.replyTo)[0]?.address || "";
  const subject = clean(parsed?.subject || headers.subject) || "(No subject)";
  const bodyText = normalizeBody(parsed?.text, parsed?.html);
  const attachmentMetadata = (Array.isArray(parsed?.attachments) ? parsed.attachments : [])
    .map(attachment => ({
      filename:clean(attachment?.filename) || null,
      mimeType:clean(attachment?.mimeType) || null,
      contentId:clean(attachment?.contentId) || null,
      disposition:clean(attachment?.disposition) || null,
      related:Boolean(attachment?.related),
      size:attachmentSize(attachment)
    }));

  const receivedAt = new Date().toISOString();
  const sourceDate = clean(parsed?.date || headers.date);
  const providerMessageId = internetMessageId || dedupeKey;

  const result = await db.prepare(`
    INSERT INTO email_intake (
      workspace_key,
      intake_address_id,
      provider,
      provider_message_id,
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
      client_id,
      processing_status,
      created_at,
      updated_at
    ) VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `).bind(
    addressRecord.workspace_key,
    addressRecord.id,
    "cloudflare_email_routing",
    providerMessageId,
    internetMessageId || null,
    dedupeKey,
    receivedAt,
    sourceDate || null,
    cleanAddress(from.address) || cleanAddress(message?.from) || null,
    clean(from.name) || null,
    JSON.stringify(to),
    JSON.stringify(cc),
    cleanAddress(replyTo) || null,
    subject,
    bodyText,
    JSON.stringify(headers),
    attachmentMetadata.length ? 1 : 0,
    JSON.stringify(attachmentMetadata),
    null,
    "ready_for_review"
  ).run();

  const intakeId = result?.meta?.last_row_id || null;
  console.log(JSON.stringify({
    event:"gcm_email_intake_received",
    emailIntakeVersion:EMAIL_INTAKE_VERSION,
    intakeId,
    workspaceKey:addressRecord.workspace_key,
    intakeAddress,
    subject,
    hasAttachments:attachmentMetadata.length > 0
  }));

  return {
    ok:true,
    duplicate:false,
    intakeId,
    processingStatus:"ready_for_review",
    workspaceKey:addressRecord.workspace_key,
    intakeAddress
  };
}

async function readRawBytes(raw) {
  if (!raw) throw new Error("Inbound email contained no raw MIME stream.");
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  const buffer = await new Response(raw).arrayBuffer();
  return new Uint8Array(buffer);
}

function selectedHeaders(headers) {
  const names = [
    "message-id",
    "in-reply-to",
    "references",
    "date",
    "from",
    "to",
    "cc",
    "reply-to",
    "subject",
    "list-id",
    "auto-submitted",
    "x-original-to"
  ];
  const output = {};
  for (const name of names) {
    const value = clean(headers?.get?.(name));
    if (value) output[name] = value;
  }
  return output;
}

function mailbox(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return mailbox(value[0]);
  if (Array.isArray(value.group)) return mailbox(value.group[0]);
  const address = cleanAddress(value.address);
  if (!address) return null;
  return { address, name:clean(value.name) };
}

function mailboxList(value) {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  const output = [];
  for (const item of source) {
    if (Array.isArray(item?.group)) {
      output.push(...mailboxList(item.group));
      continue;
    }
    const normalized = mailbox(item);
    if (normalized) output.push(normalized);
  }
  return output;
}

function normalizeBody(text, html) {
  const plain = cleanMultiline(text);
  if (plain) return plain.slice(0, MAX_BODY_CHARS);
  const fallback = cleanMultiline(stripHtml(html));
  return (fallback || "[No readable message body was available.]")
    .slice(0, MAX_BODY_CHARS);
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function cleanMultiline(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/[\t ]{2,}/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function attachmentSize(attachment) {
  const content = attachment?.content;
  if (content?.byteLength !== undefined) return Number(content.byteLength) || 0;
  if (content?.length !== undefined) return Number(content.length) || 0;
  return 0;
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function cleanAddress(value) {
  return clean(value).toLowerCase();
}

function clean(value) {
  return String(value ?? "").trim();
}

function requireDb(env) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") {
    throw new Error("The production D1 binding is unavailable.");
  }
  return db;
}
