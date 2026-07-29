/* =========================================================
   Global Concepts Media Operating System
   File: routes/mediaOperations.js
   Version: 7.8.2
   Status: Production Candidate
   Source: Production routes/mediaOperations.js 7.4.2
   Sprint: Connected Media Campaign Insertion — Syntax-Correct Production Replacement
   Purpose: Preserve authoritative Media retrieval and attention logic,
            while adding a controlled create_campaign operation that
            inserts a reviewed campaign into the existing media_records
            workflow so it immediately appears on media.html.

   Production rules:
   - media_records remains the source of truth for Media Operations.
   - Existing retrieval and Investigation #22 attention correction remain intact.
   - create_campaign validates the client and prevents duplicate campaign flights.
   - Existing mark_sent_awaiting_confirmation behavior remains available.
   - The audio file remains a repository asset referenced by file_name.
   - ISCI and gun-show operational details are retained in durable notes.
   ========================================================= */

import { VERSION, ACTIONS } from "../shared/config.js";
import { safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase, rowsOf } from "../shared/database.js";

export async function handleMediaOperations(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({ok:false,requestId,action:ACTIONS.GET_MEDIA_OPERATIONS,version:VERSION,error:"The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."},503);
  }

  const operation = String(body?.operation || "get").trim().toLowerCase();

  if (operation === "create_campaign") {
    return handleCreateCampaign(body, db, requestId);
  }

  if (operation === "mark_sent_awaiting_confirmation") {
    return handleMarkSentAwaitingConfirmation(body, db, requestId);
  }

  if (operation !== "get") {
    return jsonResponse({ok:false,requestId,action:ACTIONS.GET_MEDIA_OPERATIONS,version:VERSION,error:`Unsupported Media Operations operation: ${operation}`},400);
  }

  return handleMediaRetrieval(body, db, requestId);
}

async function handleCreateCampaign(body, db, requestId) {
  const campaign = body?.campaign || {};
  const asset = body?.asset || {};

  const clientId = normalizePositiveInteger(body?.clientId);
  const campaignName = cleanRequired(campaign?.campaignName);
  const mediaType = cleanRequired(campaign?.campaignType) || "Radio";
  const market = cleanRequired(campaign?.market);
  const outletName = cleanRequired(campaign?.outletName);
  const startDate = normalizeDateOnly(campaign?.startDate);
  const endDate = normalizeDateOnly(campaign?.endDate);
  const showStartDate = normalizeDateOnly(campaign?.showStartDate);
  const showEndDate = normalizeDateOnly(campaign?.showEndDate);
  const creativeName = cleanRequired(asset?.creativeName);
  const creativeVersion = cleanRequired(asset?.isci);
  const fileName = cleanRequired(asset?.fileName);
  const coopPartner = cleanOptional(campaign?.coopPartner);
  const scriptText = cleanOptional(asset?.scriptText);
  const owner = cleanOptional(campaign?.owner) || "Andy";
  const trafficLeadDays = normalizePositiveInteger(campaign?.trafficLeadDays) || 17;
  const confirmationCheckDays = normalizePositiveInteger(campaign?.confirmationCheckDays) || 10;
  const criticalBusinessDays = normalizePositiveInteger(campaign?.criticalBusinessDays) || 3;
  const criticalCutoff = cleanOptional(campaign?.criticalCutoff) || "12:00";

  const missing = [];
  if (!clientId) missing.push("clientId");
  if (!campaignName) missing.push("campaignName");
  if (!market) missing.push("market");
  if (!outletName) missing.push("outletName");
  if (!startDate) missing.push("startDate");
  if (!endDate) missing.push("endDate");
  if (!creativeName) missing.push("creativeName");
  if (!creativeVersion) missing.push("ISCI");
  if (!fileName) missing.push("fileName");

  if (missing.length) {
    return jsonResponse({ok:false,requestId,action:ACTIONS.GET_MEDIA_OPERATIONS,version:VERSION,error:`Campaign insertion requires: ${missing.join(", ")}.`},400);
  }

  if (endDate < startDate) {
    return jsonResponse({ok:false,requestId,action:ACTIONS.GET_MEDIA_OPERATIONS,version:VERSION,error:"The last air date cannot be earlier than the first air date."},400);
  }

  try {
    const clientResult = await db.prepare(`
      SELECT id, client_code, name
      FROM clients
      WHERE id = ?
        AND LOWER(COALESCE(status,'active')) NOT IN ('inactive','archived','deleted')
      LIMIT 1
    `).bind(clientId).all();

    const client = rowsOf(clientResult)[0];
    if (!client) {
      return jsonResponse({ok:false,requestId,action:ACTIONS.GET_MEDIA_OPERATIONS,version:VERSION,error:`Active client ${clientId} was not found.`},404);
    }

    const duplicateResult = await db.prepare(`
      SELECT id
      FROM media_records
      WHERE client_id = ?
        AND LOWER(COALESCE(campaign_name,'')) = LOWER(?)
        AND LOWER(COALESCE(outlet_name,'')) = LOWER(?)
        AND COALESCE(start_date,'') = ?
        AND COALESCE(end_date,'') = ?
      LIMIT 1
    `).bind(clientId,campaignName,outletName,startDate,endDate).all();

    const duplicate = rowsOf(duplicateResult)[0];
    if (duplicate) {
      return jsonResponse({ok:false,requestId,action:ACTIONS.GET_MEDIA_OPERATIONS,version:VERSION,error:`This campaign flight already exists as Media record ${duplicate.id}.`,mediaRecordId:Number(duplicate.id)},409);
    }

    const notes = [
      `GCM ISCI: ${creativeVersion}`,
      `Show dates: ${showStartDate || "not set"}${showEndDate ? ` through ${showEndDate}` : ""}`,
      `Agency traffic preparation: ${trafficLeadDays} calendar days before first air`,
      `First confirmation check: ${confirmationCheckDays} calendar days before first air`,
      `Critical confirmation rule: ${criticalBusinessDays} business days before first air by ${criticalCutoff}`,
      `Radio owner: ${owner}`,
      `Facebook owner: ${cleanOptional(body?.assignments?.facebookOwner) || "Kristie"}`,
      `Asset decision: ${cleanOptional(asset?.reuseDecision) || "Reuse exact approved production"}`
    ].join("\n");

    const insertResult = await db.prepare(`
      INSERT INTO media_records (
        client_id, media_type, market, outlet_name, campaign_name,
        creative_name, creative_version, file_name, coop_partner,
        start_date, end_date, status, action_type, script_text, notes,
        traffic_status, confirmation_status, attention_status,
        attention_reason, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, 'planned', 'campaign_insertion', ?, ?,
        'not_sent', 'not_requested', 'clear',
        NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).bind(
      clientId, mediaType, market, outletName, campaignName,
      creativeName, creativeVersion, fileName, coopPartner,
      startDate, endDate, scriptText, notes
    ).run();

    const mediaRecordId = Number(insertResult?.meta?.last_row_id || insertResult?.meta?.lastRowId || 0) || null;

    return jsonResponse({
      ok:true,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      operation:"create_campaign",
      mediaRecordId,
      campaign:{
        clientId,
        clientCode:String(client.client_code||""),
        clientName:String(client.name||client.client_code||"Unknown Client"),
        campaignName,
        market,
        outletName,
        startDate,
        endDate,
        status:"planned",
        creativeName,
        isci:creativeVersion,
        fileName
      }
    },201);
  } catch (error) {
    logWorkerError({requestId,route:ACTIONS.GET_MEDIA_OPERATIONS,stage:"media_campaign_insertion",error});
    return jsonResponse({ok:false,requestId,action:ACTIONS.GET_MEDIA_OPERATIONS,version:VERSION,error:"The Media campaign could not be inserted.",details:safeErrorMessage(error)},500);
  }
}


async function handleMarkSentAwaitingConfirmation(body, db, requestId) {
  const mediaRecordId = normalizePositiveInteger(
    body?.mediaRecordId ?? body?.recordId ?? body?.id
  );
  const communicationId = normalizePositiveInteger(
    body?.communicationId ?? body?.confirmationCommunicationId
  );
  const instructionId = normalizePositiveInteger(
    body?.instructionId ?? body?.mediaInstructionId
  );

  if (!mediaRecordId) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      error: "mediaRecordId must be a positive integer."
    }, 400);
  }

  try {
    const existingResult = await db.prepare(`
      SELECT id
      FROM media_records
      WHERE id = ?
      LIMIT 1
    `).bind(mediaRecordId).all();

    const existing = rowsOf(existingResult)[0];
    if (!existing) {
      return jsonResponse({
        ok: false,
        requestId,
        action: ACTIONS.GET_MEDIA_OPERATIONS,
        version: VERSION,
        error: `Media record ${mediaRecordId} was not found.`
      }, 404);
    }

    const durableReferences = [
      communicationId ? `Traffic communication ID: ${communicationId}` : null,
      instructionId ? `Media instruction ID: ${instructionId}` : null
    ].filter(Boolean).join("\n");

    await db.prepare(`
      UPDATE media_records
      SET
        traffic_status = 'sent',
        confirmation_status = 'awaiting_confirmation',
        attention_status = 'clear',
        attention_reason = NULL,
        notes = CASE
          WHEN ? = '' THEN notes
          WHEN COALESCE(notes, '') = '' THEN ?
          ELSE notes || CHAR(10) || ?
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      durableReferences,
      durableReferences,
      durableReferences,
      mediaRecordId
    ).run();

    return jsonResponse({
      ok: true,
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      operation: "mark_sent_awaiting_confirmation",
      mediaRecordId,
      trafficStatus: "sent",
      confirmationStatus: "awaiting_confirmation",
      communicationId,
      instructionId
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.GET_MEDIA_OPERATIONS,
      stage: "media_mark_sent_awaiting_confirmation",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      error: "The Media record could not be marked sent and awaiting confirmation.",
      details: safeErrorMessage(error)
    }, 500);
  }
}

async function handleMediaRetrieval(body, db, requestId) {
  const requestedClientId = normalizeOptionalClientId(body?.clientId);

  if (body?.clientId !== undefined && requestedClientId === null) {
    return jsonResponse({ok:false,requestId,action:ACTIONS.GET_MEDIA_OPERATIONS,version:VERSION,error:"clientId must be a positive integer when provided."},400);
  }

  try {
    const clientsResult = await db.prepare(`
      SELECT id, client_code, name, status FROM clients
      WHERE LOWER(COALESCE(status, 'active')) NOT IN ('inactive','archived','deleted')
      ORDER BY LOWER(name) ASC, id ASC
    `).all();

    const sql = `
      SELECT mr.id,mr.client_id,c.client_code,c.name AS client_name,
        mr.media_type,mr.market,mr.outlet_name,mr.campaign_name,mr.creative_name,
        mr.creative_version,mr.file_name,mr.coop_partner,mr.start_date,mr.end_date,
        mr.status,mr.action_type,mr.script_text,mr.notes,mr.traffic_status,
        mr.confirmation_status,mr.attention_status,mr.attention_reason,
        mr.created_at,mr.updated_at
      FROM media_records mr
      INNER JOIN clients c ON c.id = mr.client_id
      ${requestedClientId ? "WHERE mr.client_id = ?" : ""}
      ORDER BY LOWER(c.name) ASC,
        CASE LOWER(COALESCE(mr.status,'')) WHEN 'active' THEN 1 WHEN 'pending' THEN 2 WHEN 'planned' THEN 3 WHEN 'expired' THEN 4 ELSE 5 END,
        COALESCE(mr.end_date,'9999-12-31') ASC,
        COALESCE(mr.start_date,'9999-12-31') ASC,
        LOWER(COALESCE(mr.market,'')) ASC,
        LOWER(COALESCE(mr.outlet_name,'')) ASC,
        mr.id ASC
    `;

    const stmt = db.prepare(sql);
    const mediaResult = requestedClientId ? await stmt.bind(requestedClientId).all() : await stmt.all();

    const clients = rowsOf(clientsResult).map(client => ({
      clientId:Number(client.id),clientCode:String(client.client_code||""),
      clientName:String(client.name||client.client_code||"Unknown Client"),status:String(client.status||"")
    }));

    const now = new Date();
    const mediaRecords = rowsOf(mediaResult).map(row => enrichMediaRecord(mapMediaRecord(row), now));

    return jsonResponse({
      ok:true,requestId,action:ACTIONS.GET_MEDIA_OPERATIONS,version:VERSION,
      mediaOperations:{clientId:requestedClientId,clients,summary:buildSummary(mediaRecords),records:mediaRecords}
    });
  } catch (error) {
    logWorkerError({requestId,route:ACTIONS.GET_MEDIA_OPERATIONS,stage:"media_operations_query",error});
    return jsonResponse({ok:false,requestId,action:ACTIONS.GET_MEDIA_OPERATIONS,version:VERSION,error:"Media Operations could not load media records.",details:safeErrorMessage(error)},500);
  }
}

function mapMediaRecord(row) {
  return {
    id:Number(row.id),clientId:Number(row.client_id),clientCode:String(row.client_code||""),
    clientName:String(row.client_name||row.client_code||"Unknown Client"),
    mediaType:nullableString(row.media_type),market:nullableString(row.market),
    outletName:nullableString(row.outlet_name),campaignName:nullableString(row.campaign_name),
    creativeName:nullableString(row.creative_name),creativeVersion:nullableString(row.creative_version),
    fileName:nullableString(row.file_name),coopPartner:nullableString(row.coop_partner),
    startDate:nullableString(row.start_date),endDate:nullableString(row.end_date),
    status:nullableString(row.status),actionType:nullableString(row.action_type),
    scriptText:nullableString(row.script_text),notes:nullableString(row.notes),
    trafficStatus:nullableString(row.traffic_status),confirmationStatus:nullableString(row.confirmation_status),
    attentionStatus:nullableString(row.attention_status),attentionReason:nullableString(row.attention_reason),
    createdAt:nullableString(row.created_at),updatedAt:nullableString(row.updated_at)
  };
}

function enrichMediaRecord(record, now) {
  const storedAttention = String(record.attentionStatus||"").toLowerCase()==="attention";
  const deadline = stationDeadlineForRecord(record);
  const calculatedAttention = isCalculatedAttention(record, deadline, now);
  const calculatedReason = calculatedAttentionReason(record);

  return {...record,
    stationDeadline:deadline ? formatDateOnly(deadline) : null,
    stationDeadlineTime:deadline ? "12:00 noon" : null,
    needsAttention:storedAttention || calculatedAttention,
    calculatedAttention,
    calculatedAttentionReason:calculatedAttention ? calculatedReason : null,
    effectiveAttentionReason:calculatedAttention ? calculatedReason : storedAttention ? (record.attentionReason||"Stored media attention flag.") : null
  };
}

function stationDeadlineForRecord(record) {
  const status=String(record.status||"").toLowerCase();
  if(status==="active") return subtractWorkingDays(parseDateOnly(record.endDate),3);
  if(status==="pending"||status==="planned") return subtractWorkingDays(parseDateOnly(record.startDate),3);
  return null;
}

function isCalculatedAttention(record, deadline, now) {
  if(!deadline) return false;

  const attentionStatus=String(record.attentionStatus||"").toLowerCase();
  const confirmationStatus=String(record.confirmationStatus||"").toLowerCase();
  const trafficStatus=String(record.trafficStatus||"").toLowerCase();

  if(attentionStatus==="clear" && confirmationStatus==="confirmed" && trafficStatus==="sent") return false;

  const status=String(record.status||"").toLowerCase();
  if(!["active","pending","planned"].includes(status)) return false;
  const warningStart=previousWorkingDay(deadline);
  if(!warningStart) return false;
  const start=new Date(warningStart.getFullYear(),warningStart.getMonth(),warningStart.getDate(),0,0,0,0);
  return now>=start;
}

function calculatedAttentionReason(record) {
  const status=String(record.status||"").toLowerCase();
  if(status==="active") return "CURRENT PLACEMENT TRAFFIC DEADLINE";
  if(status==="pending"||status==="planned") return "UPCOMING PLACEMENT TRAFFIC DEADLINE";
  return null;
}

function subtractWorkingDays(date,count) {
  if(!date) return null;
  const result=new Date(date); let remaining=count;
  while(remaining>0){result.setDate(result.getDate()-1);if(isWorkingDay(result))remaining--;}
  return result;
}

function previousWorkingDay(date) {
  if(!date) return null;
  const result=new Date(date);
  do{result.setDate(result.getDate()-1);}while(!isWorkingDay(result));
  return result;
}

function isWorkingDay(date){const day=date.getDay();return day!==0&&day!==6;}

function parseDateOnly(value) {
  if(!value) return null;
  const m=String(value).slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return null;
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
  const date=new Date(y,mo-1,d,12,0,0,0);
  return date.getFullYear()===y&&date.getMonth()===mo-1&&date.getDate()===d ? date : null;
}

function normalizeDateOnly(value) {
  const date = parseDateOnly(value);
  return date ? formatDateOnly(date) : null;
}

function formatDateOnly(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function buildSummary(records) {
  return records.reduce((summary,record)=>{
    const status=String(record.status||"").toLowerCase();
    summary.total++;
    if(status==="active")summary.active++;
    else if(status==="pending"||status==="planned")summary.upcoming++;
    else if(status==="expired")summary.history++;
    else summary.other++;
    if(String(record.attentionStatus||"").toLowerCase()==="attention")summary.flaggedAttention++;
    if(record.calculatedAttention===true)summary.calculatedAttention++;
    if(record.needsAttention===true)summary.needsAttention++;
    return summary;
  },{total:0,active:0,upcoming:0,history:0,other:0,flaggedAttention:0,calculatedAttention:0,needsAttention:0});
}

function normalizeOptionalClientId(value){
  if(value===undefined||value===null||value==="")return undefined;
  const numeric=Number(value);
  return Number.isInteger(numeric)&&numeric>0 ? numeric : null;
}

function normalizePositiveInteger(value){
  const numeric=Number(value);
  return Number.isInteger(numeric)&&numeric>0 ? numeric : null;
}

function cleanRequired(value){
  const text=String(value??"").trim();
  return text || null;
}

function cleanOptional(value){
  const text=String(value??"").trim();
  return text || null;
}

function nullableString(value){return value===undefined||value===null?null:String(value);}
