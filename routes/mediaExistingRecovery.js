/* =========================================================
   Global Concepts Media Operating System
   File: routes/mediaExistingRecovery.js
   Version: 1.0.0
   Status: Production Candidate
   Sprint: Existing / Already-Trafficked Media Recovery
   Purpose: Create an authoritative Media record when real media work already
            happened outside the OS, without inventing earlier workflow stages.

   Production rules:
   - Never creates fake Creative workflow history.
   - Creates one media_records row only after explicit operator submission.
   - Preserves sent-traffic and station-confirmation evidence in the record.
   - Recovered records are traffic sent + station confirmed by definition.
   - Duplicate flight protection remains mandatory.
   ========================================================= */

import { VERSION, ACTIONS } from "../shared/config.js";
import { safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase, rowsOf } from "../shared/database.js";

export const MEDIA_EXISTING_RECOVERY_OPERATIONS = ["record_existing_media"];

export async function handleMediaExistingRecovery(operation, body, env, requestId) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:"The D1 binding is unavailable."
    },503);
  }

  if (operation !== "record_existing_media") {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:`Unsupported existing Media recovery operation: ${operation}`
    },400);
  }

  return recordExistingMedia(body, db, requestId);
}

async function recordExistingMedia(body, db, requestId) {
  const record = body?.record || {};
  const traffic = body?.trafficEvidence || {};
  const confirmation = body?.confirmationEvidence || {};

  const clientId = positiveInt(record.clientId);
  const mediaType = clean(record.mediaType) || "Radio";
  const campaignName = clean(record.campaignName);
  const creativeName = clean(record.creativeName);
  const isci = clean(record.isci);
  const fileName = clean(record.fileName);
  const market = clean(record.market);
  const outletName = clean(record.outletName);
  const startDate = dateOnly(record.startDate);
  const endDate = dateOnly(record.endDate);
  const eventStartDate = dateOnly(record.eventStartDate);
  const eventEndDate = dateOnly(record.eventEndDate);
  const coopPartner = clean(record.coopPartner);
  const scriptText = clean(record.scriptText);
  const owner = clean(record.owner) || "Andy";
  const currentState = normalizeState(record.currentState);

  const missing = [];
  if (!clientId) missing.push("client");
  if (!campaignName) missing.push("campaign name");
  if (!creativeName) missing.push("creative name");
  if (!isci) missing.push("ISCI / ID");
  if (!fileName) missing.push("production filename");
  if (!market) missing.push("market");
  if (!outletName) missing.push("station / outlet");
  if (!startDate) missing.push("first air date");
  if (!endDate) missing.push("last air date");
  if (!currentState) missing.push("current state");
  if (!clean(traffic.subject)) missing.push("sent traffic subject");
  if (!clean(traffic.bodyText)) missing.push("sent traffic email body");
  if (!clean(confirmation.subject)) missing.push("confirmation subject");
  if (!clean(confirmation.bodyText)) missing.push("confirmation email body");
  if (confirmation.receivedConfirmed !== true) missing.push("station received confirmation");
  if (confirmation.traffickedConfirmed !== true) missing.push("station trafficked confirmation");

  if (missing.length) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:`Existing Media recovery requires: ${missing.join(", ")}.`
    },400);
  }

  if (endDate < startDate) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:"The last air date cannot be earlier than the first air date."
    },400);
  }
  if (eventStartDate && eventEndDate && eventEndDate < eventStartDate) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:"The event end date cannot be earlier than the event start date."
    },400);
  }

  const status = currentState === "running" ? "active" : currentState === "completed" ? "completed" : "planned";

  try {
    const client = await db.prepare(`
      SELECT id, client_code, name
      FROM clients
      WHERE id = ? AND LOWER(COALESCE(status,'active')) NOT IN ('inactive','archived','deleted')
      LIMIT 1
    `).bind(clientId).first();

    if (!client) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GET_MEDIA_OPERATIONS,
        version:VERSION,
        error:`Active client ${clientId} was not found.`
      },404);
    }

    const duplicate = rowsOf(await db.prepare(`
      SELECT id, campaign_name, creative_version
      FROM media_records
      WHERE client_id = ?
        AND LOWER(COALESCE(creative_version,'')) = LOWER(?)
        AND LOWER(COALESCE(market,'')) = LOWER(?)
        AND LOWER(COALESCE(outlet_name,'')) = LOWER(?)
        AND COALESCE(start_date,'') = ?
        AND COALESCE(end_date,'') = ?
      LIMIT 1
    `).bind(clientId,isci,market,outletName,startDate,endDate).all())[0];

    if (duplicate) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GET_MEDIA_OPERATIONS,
        version:VERSION,
        error:`This recovered flight already exists as Media record ${duplicate.id}.`,
        mediaRecordId:Number(duplicate.id)
      },409);
    }

    const notes = buildRecoveryNotes({
      currentState, owner, eventStartDate, eventEndDate, isci, traffic, confirmation
    });

    const result = await db.prepare(`
      INSERT INTO media_records (
        client_id, media_type, market, outlet_name, campaign_name,
        creative_name, creative_version, file_name, coop_partner,
        start_date, end_date, status, action_type, script_text, notes,
        traffic_status, confirmation_status, attention_status,
        attention_reason, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'existing_media_recovery', ?, ?,
        'sent', 'confirmed', 'clear', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).bind(
      clientId, mediaType, market, outletName, campaignName,
      creativeName, isci, fileName, coopPartner || null,
      startDate, endDate, status, scriptText || null, notes
    ).run();

    const mediaRecordId = Number(result?.meta?.last_row_id || result?.meta?.lastRowId || 0) || null;

    return jsonResponse({
      ok:true,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      operation:"record_existing_media",
      mediaRecordId,
      recoveredMedia:{
        clientId,
        clientCode:String(client.client_code || ""),
        clientName:String(client.name || client.client_code || "Unknown Client"),
        campaignName,
        creativeName,
        isci,
        fileName,
        mediaType,
        market,
        outletName,
        startDate,
        endDate,
        currentState,
        status,
        trafficStatus:"sent",
        confirmationStatus:"confirmed"
      }
    },201);
  } catch (error) {
    logWorkerError({
      requestId,
      route:ACTIONS.GET_MEDIA_OPERATIONS,
      stage:"record_existing_media",
      error
    });
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:"The existing Media record could not be recovered.",
      details:safeErrorMessage(error)
    },500);
  }
}

function buildRecoveryNotes({currentState, owner, eventStartDate, eventEndDate, isci, traffic, confirmation}) {
  const lines = [
    "Recovery Source: Existing / Already-Trafficked Media",
    `Recovered current state: ${currentState}`,
    `GCM ISCI: ${isci}`,
    `Radio owner: ${owner}`,
    eventStartDate ? `Event dates: ${eventStartDate}${eventEndDate ? ` through ${eventEndDate}` : ""}` : null,
    "",
    "=== SENT TRAFFIC EVIDENCE ===",
    traffic.sentAt ? `Sent at: ${clean(traffic.sentAt)}` : null,
    clean(traffic.gmailMessageId) ? `Gmail Message ID: ${clean(traffic.gmailMessageId)}` : null,
    clean(traffic.gmailThreadId) ? `Gmail Thread ID: ${clean(traffic.gmailThreadId)}` : null,
    clean(traffic.fromEmail) ? `From: ${clean(traffic.fromEmail)}` : null,
    clean(traffic.toEmail) ? `To: ${clean(traffic.toEmail)}` : null,
    `Subject: ${clean(traffic.subject)}`,
    "Traffic Email Body:",
    clean(traffic.bodyText),
    "",
    "=== STATION CONFIRMATION EVIDENCE ===",
    confirmation.receivedAt ? `Received at: ${clean(confirmation.receivedAt)}` : null,
    clean(confirmation.gmailMessageId) ? `Gmail Message ID: ${clean(confirmation.gmailMessageId)}` : null,
    clean(confirmation.gmailThreadId) ? `Gmail Thread ID: ${clean(confirmation.gmailThreadId)}` : null,
    clean(confirmation.fromEmail) ? `From: ${clean(confirmation.fromEmail)}` : null,
    clean(confirmation.toEmail) ? `To: ${clean(confirmation.toEmail)}` : null,
    `Subject: ${clean(confirmation.subject)}`,
    "Station confirms received: Yes",
    "Station confirms trafficked: Yes",
    "Confirmation Email Body:",
    clean(confirmation.bodyText)
  ];
  return lines.filter(value => value !== null).join("\n");
}

function normalizeState(value) {
  const state = clean(value).toLowerCase();
  return ["scheduled","running","completed"].includes(state) ? state : "";
}
function positiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
function dateOnly(value) {
  const text = clean(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}
function clean(value) {
  return String(value ?? "").trim();
}
