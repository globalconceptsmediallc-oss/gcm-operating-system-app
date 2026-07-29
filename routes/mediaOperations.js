/* =========================================================
   Global Concepts Media Operating System
   File: routes/mediaOperations.js
   Version: 7.7.0
   Status: Production Candidate
   Source: Production routes/mediaOperations.js 7.4.2
   Sprint: Media Operations — Durable Awaiting Confirmation
   Purpose: Retrieve authoritative media placement records and
            persist reviewed station instructions after they have
            actually been sent, without changing confirmed live
            media placement dates before station confirmation.

   Production rules:
   - media_records remains the source of truth for confirmed media.
   - media_instructions stores requested changes and confirmation state.
   - Marking instructions sent does NOT update media_records dates.
   - Each submitted instruction is validated against its live media record.
   ========================================================= */

import { VERSION, ACTIONS } from "../shared/config.js";
import { safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase, rowsOf } from "../shared/database.js";

export async function handleMediaOperations(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:"The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."
    },503);
  }

  const operation = String(body?.operation || "get").trim().toLowerCase();

  if (operation === "mark_sent_awaiting_confirmation") {
    return handleMarkSentAwaitingConfirmation(body, db, requestId);
  }

  if (operation !== "get") {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:`Unsupported Media Operations operation: ${operation}`
    },400);
  }

  return handleMediaRetrieval(body, db, requestId);
}

async function handleMediaRetrieval(body, db, requestId) {
  const requestedClientId = normalizeOptionalClientId(body?.clientId);

  if (body?.clientId !== undefined && requestedClientId === null) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:"clientId must be a positive integer when provided."
    },400);
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
      clientId:Number(client.id),
      clientCode:String(client.client_code||""),
      clientName:String(client.name||client.client_code||"Unknown Client"),
      status:String(client.status||"")
    }));

    const now = new Date();
    const mediaRecords = rowsOf(mediaResult).map(row => enrichMediaRecord(mapMediaRecord(row), now));

    return jsonResponse({
      ok:true,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      mediaOperations:{
        clientId:requestedClientId,
        clients,
        summary:buildSummary(mediaRecords),
        records:mediaRecords
      }
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:ACTIONS.GET_MEDIA_OPERATIONS,
      stage:"media_operations_query",
      error
    });

    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:"Media Operations could not load media records.",
      details:safeErrorMessage(error)
    },500);
  }
}

async function handleMarkSentAwaitingConfirmation(body, db, requestId) {
  const instructions = Array.isArray(body?.instructions) ? body.instructions : [];
  const sentTo = cleanText(body?.sentTo);
  const sentAt = normalizeTimestamp(body?.sentAt) || new Date().toISOString();

  if (!instructions.length) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:"At least one media instruction is required."
    },400);
  }

  if (instructions.length > 100) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:"No more than 100 media instructions may be recorded at once."
    },400);
  }

  try {
    const prepared = [];

    for (const item of instructions) {
      const mediaRecordId = normalizePositiveInteger(item?.mediaRecordId);
      const instructionType = normalizeInstructionType(item?.instructionType);

      if (!mediaRecordId || !instructionType) {
        return jsonResponse({
          ok:false,
          requestId,
          action:ACTIONS.GET_MEDIA_OPERATIONS,
          version:VERSION,
          error:"Every instruction requires a valid mediaRecordId and instructionType."
        },400);
      }

      const recordResult = await db.prepare(`
        SELECT
          id,
          client_id,
          start_date,
          end_date
        FROM media_records
        WHERE id = ?
        LIMIT 1
      `).bind(mediaRecordId).all();

      const record = rowsOf(recordResult)[0];

      if (!record) {
        return jsonResponse({
          ok:false,
          requestId,
          action:ACTIONS.GET_MEDIA_OPERATIONS,
          version:VERSION,
          error:`Media record ${mediaRecordId} was not found.`
        },404);
      }

      const requestedStartDate = normalizeDateOnly(item?.requestedStartDate);
      const requestedEndDate = normalizeDateOnly(item?.requestedEndDate);
      const requestedChange = cleanText(item?.requestedChange);
      const notes = cleanText(item?.notes);

      if (instructionType === "extend" && !requestedEndDate) {
        return jsonResponse({
          ok:false,
          requestId,
          action:ACTIONS.GET_MEDIA_OPERATIONS,
          version:VERSION,
          error:`EXTEND instruction for media record ${mediaRecordId} requires requestedEndDate.`
        },400);
      }

      const duplicateResult = await db.prepare(`
        SELECT id
        FROM media_instructions
        WHERE media_record_id = ?
          AND status = 'awaiting_confirmation'
        LIMIT 1
      `).bind(mediaRecordId).all();

      if (rowsOf(duplicateResult).length) {
        return jsonResponse({
          ok:false,
          requestId,
          action:ACTIONS.GET_MEDIA_OPERATIONS,
          version:VERSION,
          error:`Media record ${mediaRecordId} already has an instruction awaiting confirmation.`
        },409);
      }

      prepared.push({
        mediaRecordId,
        clientId:Number(record.client_id),
        instructionType,
        requestedStartDate,
        requestedEndDate,
        requestedChange,
        sentTo,
        sentAt,
        originalStartDate:nullableString(record.start_date),
        originalEndDate:nullableString(record.end_date),
        notes
      });
    }

    const statements = prepared.map(item => db.prepare(`
      INSERT INTO media_instructions (
        media_record_id,
        client_id,
        instruction_type,
        requested_start_date,
        requested_end_date,
        requested_change,
        sent_to,
        sent_at,
        status,
        original_start_date,
        original_end_date,
        notes,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_confirmation', ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      item.mediaRecordId,
      item.clientId,
      item.instructionType,
      item.requestedStartDate,
      item.requestedEndDate,
      item.requestedChange,
      item.sentTo,
      item.sentAt,
      item.originalStartDate,
      item.originalEndDate,
      item.notes
    ));

    if (typeof db.batch === "function") {
      await db.batch(statements);
    } else {
      for (const statement of statements) {
        await statement.run();
      }
    }

    return jsonResponse({
      ok:true,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      operation:"mark_sent_awaiting_confirmation",
      mediaInstructions:{
        created:prepared.length,
        status:"awaiting_confirmation",
        sentTo:sentTo || null,
        sentAt
      }
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:ACTIONS.GET_MEDIA_OPERATIONS,
      stage:"media_instructions_mark_sent",
      error
    });

    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:"The sent media instructions could not be recorded.",
      details:safeErrorMessage(error)
    },500);
  }
}

function mapMediaRecord(row) {
  return {
    id:Number(row.id),
    clientId:Number(row.client_id),
    clientCode:String(row.client_code||""),
    clientName:String(row.client_name||row.client_code||"Unknown Client"),
    mediaType:nullableString(row.media_type),
    market:nullableString(row.market),
    outletName:nullableString(row.outlet_name),
    campaignName:nullableString(row.campaign_name),
    creativeName:nullableString(row.creative_name),
    creativeVersion:nullableString(row.creative_version),
    fileName:nullableString(row.file_name),
    coopPartner:nullableString(row.coop_partner),
    startDate:nullableString(row.start_date),
    endDate:nullableString(row.end_date),
    status:nullableString(row.status),
    actionType:nullableString(row.action_type),
    scriptText:nullableString(row.script_text),
    notes:nullableString(row.notes),
    trafficStatus:nullableString(row.traffic_status),
    confirmationStatus:nullableString(row.confirmation_status),
    attentionStatus:nullableString(row.attention_status),
    attentionReason:nullableString(row.attention_reason),
    createdAt:nullableString(row.created_at),
    updatedAt:nullableString(row.updated_at)
  };
}

function enrichMediaRecord(record, now) {
  const storedAttention = String(record.attentionStatus||"").toLowerCase()==="attention";
  const deadline = stationDeadlineForRecord(record);
  const calculatedAttention = isCalculatedAttention(record, deadline, now);
  const calculatedReason = calculatedAttentionReason(record);

  return {
    ...record,
    stationDeadline:deadline ? formatDateOnly(deadline) : null,
    stationDeadlineTime:deadline ? "12:00 noon" : null,
    needsAttention:storedAttention || calculatedAttention,
    calculatedAttention,
    calculatedAttentionReason:calculatedAttention ? calculatedReason : null,
    effectiveAttentionReason:calculatedAttention
      ? calculatedReason
      : storedAttention
        ? (record.attentionReason||"Stored media attention flag.")
        : null
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
  const result=new Date(date);
  let remaining=count;
  while(remaining>0){
    result.setDate(result.getDate()-1);
    if(isWorkingDay(result)) remaining--;
  }
  return result;
}

function previousWorkingDay(date) {
  if(!date) return null;
  const result=new Date(date);
  do{
    result.setDate(result.getDate()-1);
  }while(!isWorkingDay(result));
  return result;
}

function isWorkingDay(date) {
  const day=date.getDay();
  return day!==0&&day!==6;
}

function parseDateOnly(value) {
  if(!value) return null;
  const m=String(value).slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return null;
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
  const date=new Date(y,mo-1,d,12,0,0,0);
  return date.getFullYear()===y&&date.getMonth()===mo-1&&date.getDate()===d ? date : null;
}

function formatDateOnly(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function buildSummary(records) {
  return records.reduce((summary,record)=>{
    const status=String(record.status||"").toLowerCase();
    summary.total++;
    if(status==="active") summary.active++;
    else if(status==="pending"||status==="planned") summary.upcoming++;
    else if(status==="expired") summary.history++;
    else summary.other++;
    if(String(record.attentionStatus||"").toLowerCase()==="attention") summary.flaggedAttention++;
    if(record.calculatedAttention===true) summary.calculatedAttention++;
    if(record.needsAttention===true) summary.needsAttention++;
    return summary;
  },{
    total:0,
    active:0,
    upcoming:0,
    history:0,
    other:0,
    flaggedAttention:0,
    calculatedAttention:0,
    needsAttention:0
  });
}

function normalizeOptionalClientId(value) {
  if(value===undefined||value===null||value==="") return undefined;
  const numeric=Number(value);
  return Number.isInteger(numeric)&&numeric>0 ? numeric : null;
}

function normalizePositiveInteger(value) {
  const numeric=Number(value);
  return Number.isInteger(numeric)&&numeric>0 ? numeric : null;
}

function normalizeInstructionType(value) {
  const normalized=String(value||"").trim().toLowerCase();
  return ["extend","change","end","verify_current_copy"].includes(normalized) ? normalized : null;
}

function normalizeDateOnly(value) {
  if(value===undefined||value===null||value==="") return null;
  const text=String(value).trim().slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeTimestamp(value) {
  if(value===undefined||value===null||value==="") return null;
  const date=new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cleanText(value) {
  if(value===undefined||value===null) return null;
  const text=String(value).trim();
  return text || null;
}

function nullableString(value) {
  return value===undefined||value===null ? null : String(value);
}
