/* =========================================================
   Global Concepts Media Operating System
   File: routes/operationalReviews.js
   Version: 7.7.2
   Status: Production Candidate
   Sprint: Investigation #22 — Media Confirmation Matching Hardening
   Purpose: Match saved inbound Communications to pending Media
            instructions and require operator approval before
            authoritative media_records are changed.
   ========================================================= */

import { VERSION, ACTIONS } from "../shared/config.js";
import { safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase, rowsOf } from "../shared/database.js";

export async function handleOperationalReviews(body, env, requestId) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({ ok:false, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, error:"The D1 binding is unavailable." },503);
  }

  const operation = String(body?.operation || "list").trim().toLowerCase();
  try {
    if (operation === "match_media_confirmation") return matchMediaConfirmation(body, db, requestId);
    if (operation === "approve") return decideReview(body, db, requestId, "approved");
    if (operation === "reject") return decideReview(body, db, requestId, "rejected");
    if (operation === "defer") return decideReview(body, db, requestId, "deferred");
    if (operation === "list") return listReviews(body, db, requestId);
    return jsonResponse({ ok:false, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, error:`Unsupported Operational Reviews operation: ${operation}` },400);
  } catch (error) {
    logWorkerError({ requestId, route:ACTIONS.OPERATIONAL_REVIEWS, stage:`operational_reviews_${operation}`, error });
    return jsonResponse({ ok:false, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, error:"Operational Reviews could not complete the request.", details:safeErrorMessage(error) },500);
  }
}

async function listReviews(body, db, requestId) {
  const clientId = positiveInt(body?.clientId);
  const where = clientId ? "AND r.client_id = ?" : "";
  const stmt = db.prepare(`
    SELECT r.id,r.communication_id,r.client_id,c.client_code,c.name AS client_name,
      r.department,r.object_type,r.matched_record_id,r.evidence_summary,
      r.recommended_action,r.status,r.operator_decision,r.decision_notes,
      r.created_at,r.updated_at,r.decided_at,
      mi.instruction_type,mi.requested_start_date,mi.requested_end_date,
      mi.requested_change,mi.sent_to,mi.sent_at,mi.status AS instruction_status,
      mr.market,mr.outlet_name,mr.campaign_name,mr.creative_name,
      mr.start_date AS current_start_date,mr.end_date AS current_end_date,
      mr.status AS media_status
    FROM operational_reviews r
    INNER JOIN clients c ON c.id = r.client_id
    LEFT JOIN media_instructions mi ON mi.id = r.matched_record_id AND r.object_type = 'media_instruction'
    LEFT JOIN media_records mr ON mr.id = mi.media_record_id
    WHERE r.department = 'media' ${where}
    ORDER BY CASE r.status WHEN 'pending' THEN 1 WHEN 'deferred' THEN 2 ELSE 3 END,
      datetime(r.created_at) DESC, r.id DESC
  `);
  const result = clientId ? await stmt.bind(clientId).all() : await stmt.all();
  return jsonResponse({ ok:true, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, operationalReviews:{ reviews:rowsOf(result).map(mapReview) } });
}

async function matchMediaConfirmation(body, db, requestId) {
  const communicationId = positiveInt(body?.communicationId);
  const clientCode = clean(body?.clientCode);
  const evidenceText = clean(body?.evidenceText || body?.rawContent || body?.operationalSummary);
  if (!communicationId || !clientCode) {
    return jsonResponse({ ok:false, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, error:"communicationId and clientCode are required." },400);
  }

  const client = await db.prepare(`SELECT id,client_code,name FROM clients WHERE client_code = ? COLLATE NOCASE LIMIT 1`).bind(clientCode).first();
  if (!client) return jsonResponse({ ok:false, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, error:`Client "${clientCode}" was not found.` },404);

  const pending = rowsOf(await db.prepare(`
    SELECT mi.id,mi.media_record_id,mi.instruction_type,mi.requested_start_date,
      mi.requested_end_date,mi.requested_change,mi.sent_to,mi.sent_at,
      mr.market,mr.outlet_name,mr.campaign_name,mr.creative_name,
      mr.start_date,mr.end_date
    FROM media_instructions mi
    INNER JOIN media_records mr ON mr.id = mi.media_record_id
    WHERE mi.client_id = ? AND mi.status = 'awaiting_confirmation'
    ORDER BY datetime(mi.sent_at) DESC, mi.id DESC
  `).bind(client.id).all());

  if (!pending.length) {
    return jsonResponse({ ok:true, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, matched:0, message:"No media instructions are awaiting confirmation for this client." });
  }

  const normalized = normalizeMatchText(evidenceText);
  const candidates = pending.filter(item => matchEvidenceScore(item, normalized) >= 6);
  const selected = candidates.length ? candidates : (pending.length === 1 ? pending : []);

  let created = 0;
  for (const item of selected) {
    const existing = await db.prepare(`
      SELECT id FROM operational_reviews
      WHERE communication_id = ? AND department = 'media'
        AND object_type = 'media_instruction' AND matched_record_id = ?
      LIMIT 1
    `).bind(communicationId,item.id).first();
    if (existing) continue;

    const evidenceSummary = buildEvidenceSummary(item, evidenceText);
    const recommendedAction = buildRecommendedAction(item);
    await db.prepare(`
      INSERT INTO operational_reviews (
        communication_id,client_id,department,object_type,matched_record_id,
        evidence_summary,recommended_action,status,created_at,updated_at
      ) VALUES (?,?,'media','media_instruction',?,?,?,'pending',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `).bind(communicationId,client.id,item.id,evidenceSummary,recommendedAction).run();
    created += 1;
  }

  return jsonResponse({ ok:true, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, matched:selected.length, created, pendingInstructions:pending.length, requiresManualReview:selected.length === 0 && pending.length > 1 });
}

async function decideReview(body, db, requestId, decision) {
  const reviewId = positiveInt(body?.reviewId);
  const notes = clean(body?.notes);
  if (!reviewId) return jsonResponse({ ok:false, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, error:"reviewId is required." },400);

  const review = await db.prepare(`
    SELECT r.*,mi.media_record_id,mi.instruction_type,mi.requested_start_date,
      mi.requested_end_date,mi.requested_change,mi.status AS instruction_status
    FROM operational_reviews r
    LEFT JOIN media_instructions mi ON mi.id = r.matched_record_id
    WHERE r.id = ? LIMIT 1
  `).bind(reviewId).first();
  if (!review) return jsonResponse({ ok:false, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, error:`Operational Review ${reviewId} was not found.` },404);
  if (!["pending","deferred"].includes(String(review.status || "").toLowerCase())) {
    return jsonResponse({ ok:false, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, error:`Operational Review ${reviewId} has already been decided.` },409);
  }

  if (decision !== "approved") {
    await db.prepare(`UPDATE operational_reviews SET status=?,operator_decision=?,decision_notes=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(decision,decision,notes,reviewId).run();
    return jsonResponse({ ok:true, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, reviewId, decision });
  }

  if (review.department !== "media" || review.object_type !== "media_instruction" || !review.media_record_id) {
    return jsonResponse({ ok:false, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, error:"This review is not linked to a valid Media instruction." },409);
  }
  if (review.instruction_status !== "awaiting_confirmation") {
    return jsonResponse({ ok:false, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, error:"The linked Media instruction is no longer awaiting confirmation." },409);
  }

  const mediaUpdate = buildMediaUpdate(review, db);
  const statements = [
    mediaUpdate,
    db.prepare(`UPDATE media_instructions SET status='confirmed',confirmation_received_at=CURRENT_TIMESTAMP,confirmation_communication_id=?,notes=CASE WHEN ?='' THEN notes ELSE COALESCE(notes || '\n','') || ? END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(review.communication_id,notes,notes,review.matched_record_id),
    db.prepare(`UPDATE operational_reviews SET status='approved',operator_decision='approved',decision_notes=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(notes,reviewId)
  ];
  if (typeof db.batch === "function") await db.batch(statements); else for (const stmt of statements) await stmt.run();

  return jsonResponse({ ok:true, requestId, action:ACTIONS.OPERATIONAL_REVIEWS, version:VERSION, reviewId, decision:"approved", mediaRecordId:Number(review.media_record_id), instructionId:Number(review.matched_record_id) });
}

function buildMediaUpdate(review, db) {
  const type = String(review.instruction_type || "").toLowerCase();
  if (type === "extend") {
    return db.prepare(`UPDATE media_records SET end_date=?,status='active',confirmation_status='confirmed',attention_status='clear',attention_reason=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(review.requested_end_date,review.media_record_id);
  }
  if (type === "end") {
    return db.prepare(`UPDATE media_records SET end_date=COALESCE(?,end_date),status='expired',confirmation_status='confirmed',attention_status='clear',attention_reason=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(review.requested_end_date,review.media_record_id);
  }
  if (type === "start") {
    return db.prepare(`UPDATE media_records SET start_date=COALESCE(?,start_date),end_date=COALESCE(?,end_date),status='active',confirmation_status='confirmed',attention_status='clear',attention_reason=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(review.requested_start_date,review.requested_end_date,review.media_record_id);
  }
  return db.prepare(`UPDATE media_records SET confirmation_status='confirmed',attention_status='clear',attention_reason=NULL,notes=CASE WHEN ?='' THEN notes ELSE COALESCE(notes || '\n','') || ? END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(clean(review.requested_change),clean(review.requested_change),review.media_record_id);
}

function matchEvidenceScore(item, normalizedEvidence) {
  if (!normalizedEvidence) return 0;

  const fields = [
    { value:item.outlet_name, weight:4 },
    { value:item.creative_name, weight:4 },
    { value:item.campaign_name, weight:3 },
    { value:item.market, weight:2 },
    { value:item.requested_end_date, weight:2 },
    { value:item.requested_start_date, weight:1 }
  ];

  return fields.reduce((score, field) => {
    const token = normalizeMatchText(field.value);
    if (!token || token.length < 3) return score;
    return normalizedEvidence.includes(token) ? score + field.weight : score;
  },0);
}

function normalizeMatchText(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[-_/.,()]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}
function buildEvidenceSummary(item, evidenceText) {
  const target = [item.outlet_name,item.market].filter(Boolean).join(" — ") || `Media instruction #${item.id}`;
  const request = buildRecommendedAction(item);
  const excerpt = evidenceText ? evidenceText.slice(0,600) : "Inbound communication saved without pasted text.";
  return `${target}. ${request}. Evidence: ${excerpt}`;
}
function buildRecommendedAction(item) {
  const type = String(item.instruction_type || "change").toUpperCase();
  if (type === "EXTEND") return `Approve extension through ${item.requested_end_date || "the confirmed date"}`;
  if (type === "END") return `Approve placement end ${item.requested_end_date ? `on ${item.requested_end_date}` : "as confirmed"}`;
  if (type === "START") return `Approve placement start ${item.requested_start_date ? `on ${item.requested_start_date}` : "as confirmed"}`;
  return `Approve confirmed media change: ${item.requested_change || "update placement record"}`;
}
function mapReview(row) { return {
  id:Number(row.id),communicationId:Number(row.communication_id),clientId:Number(row.client_id),clientCode:row.client_code,clientName:row.client_name,
  department:row.department,objectType:row.object_type,matchedRecordId:Number(row.matched_record_id),evidenceSummary:row.evidence_summary,recommendedAction:row.recommended_action,status:row.status,operatorDecision:row.operator_decision,decisionNotes:row.decision_notes,createdAt:row.created_at,updatedAt:row.updated_at,decidedAt:row.decided_at,
  instructionType:row.instruction_type,requestedStartDate:row.requested_start_date,requestedEndDate:row.requested_end_date,requestedChange:row.requested_change,sentTo:row.sent_to,sentAt:row.sent_at,instructionStatus:row.instruction_status,market:row.market,outletName:row.outlet_name,campaignName:row.campaign_name,creativeName:row.creative_name,currentStartDate:row.current_start_date,currentEndDate:row.current_end_date,mediaStatus:row.media_status
}; }
function clean(value){return String(value ?? "").trim();}
function positiveInt(value){const n=Number(value);return Number.isInteger(n)&&n>0?n:null;}
