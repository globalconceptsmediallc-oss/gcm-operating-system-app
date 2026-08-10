/* =========================================================
   Global Concepts Media Operating System
   File: routes/intelligenceProcessing.js
   Version: 1.0.0
   Status: Production Candidate
   Source: Today / Agency Command Center Rebuild
   Sprint: Common Intelligence Correlation Foundation
   Purpose: Persist already-interpreted agency intelligence, correlate
            repeated signals to existing Intelligence / Investigation /
            Work history, and return a normalized decision candidate.

   Production rules:
   - Source-neutral; no source-specific interpretation lives here.
   - Never creates Communication, Investigation, Work, Evidence,
     Measurement, Activity, Media, Calendar, Prospect, or Finance records.
   - Reuses one active Intelligence record per correlation key.
   - Preserves first observed date and advances last observed date.
   ========================================================= */

import { getDatabase } from "../shared/database.js";
import { clean, safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";

export const INTELLIGENCE_PROCESSING_VERSION = "1.0.0";
export const INTELLIGENCE_PROCESSING_ACTION = "process-intelligence";

const CLOSED = "'complete','completed','closed','resolved','cancelled','canceled','archived','ignored','no_action','published'";

export async function handleIntelligenceProcessing(body, env, requestId) {
  const db = getDatabase(env);
  const input = normalizeInput(body);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({ ok:false, requestId, action:INTELLIGENCE_PROCESSING_ACTION, error:"The production D1 database binding is unavailable." }, 503);
  }

  if (!input.clientId && !input.clientCode && !input.clientName) {
    return jsonResponse({ ok:false, requestId, action:INTELLIGENCE_PROCESSING_ACTION, error:"A verified client identifier is required." }, 400);
  }

  if (!input.intelligenceType || !input.subject || !input.source || !input.whatHappened) {
    return jsonResponse({ ok:false, requestId, action:INTELLIGENCE_PROCESSING_ACTION, error:"intelligenceType, subject, source, and whatHappened are required." }, 400);
  }

  try {
    const client = await resolveClient(db, input);
    if (!client) return jsonResponse({ ok:false, requestId, action:INTELLIGENCE_PROCESSING_ACTION, error:"No production client matched the supplied client identifier." }, 404);

    const observedAt = normalizeIsoDate(input.observedAt);
    const correlationKey = input.correlationKey || await createCorrelationKey(client.id, input.intelligenceType, input.subject);
    const existing = await db.prepare(`SELECT * FROM intelligence WHERE client_id=? AND correlation_key=? AND LOWER(COALESCE(status,'active'))='active' ORDER BY id DESC LIMIT 1`).bind(client.id, correlationKey).first();
    const handling = await findHandling(db, client.id, input);
    const novelty = determineNovelty(existing, input);
    const handlingState = determineHandlingState(input.handlingState, handling);
    const links = resolveLinks(input, existing, handling);

    let id = Number(existing?.id || 0) || null;
    let created = false;

    if (existing) {
      await db.prepare(`UPDATE intelligence SET intelligence_type=?,subject=?,source=?,source_type=?,source_reference=?,what_happened=?,business_meaning=?,novelty=?,trend=?,importance=?,handling_state=?,recommended_action=?,why_now=?,proof_requirement=?,communication_id=?,investigation_id=?,work_item_id=?,last_observed_at=?,status='active',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(
        input.intelligenceType,input.subject,input.source,input.sourceType,input.sourceReference,input.whatHappened,input.businessMeaning,novelty.value,input.trend,input.importance,handlingState,input.recommendedAction,input.whyNow,input.proofRequirement,links.communicationId,links.investigationId,links.workItemId,observedAt,existing.id
      ).run();
    } else {
      const result = await db.prepare(`INSERT INTO intelligence (client_id,intelligence_type,subject,source,source_type,source_reference,what_happened,business_meaning,novelty,trend,importance,handling_state,recommended_action,why_now,proof_requirement,communication_id,investigation_id,work_item_id,correlation_key,first_observed_at,last_observed_at,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(
        client.id,input.intelligenceType,input.subject,input.source,input.sourceType,input.sourceReference,input.whatHappened,input.businessMeaning,novelty.value,input.trend,input.importance,handlingState,input.recommendedAction,input.whyNow,input.proofRequirement,links.communicationId,links.investigationId,links.workItemId,correlationKey,observedAt,observedAt
      ).run();
      id = Number(result?.meta?.last_row_id || 0) || null;
      created = true;
    }

    if (!id) throw new Error("D1 did not return a valid Intelligence record ID.");
    const record = await db.prepare(`SELECT * FROM intelligence WHERE id=? LIMIT 1`).bind(id).first();

    return jsonResponse({
      ok:true,
      requestId,
      action:INTELLIGENCE_PROCESSING_ACTION,
      intelligenceProcessingVersion:INTELLIGENCE_PROCESSING_VERSION,
      source:"D1",
      client:{ id:Number(client.id), clientCode:clean(client.client_code), name:clean(client.name) },
      result:{ intelligenceId:id, created, updated:!created, novelty:novelty.value, changedFields:novelty.changedFields, handlingState, correlationKey, links },
      decisionCandidate:buildDecisionCandidate(record, client, Boolean(handling)),
      writes:{ intelligence:1, communications:0, investigations:0, workItems:0, evidence:0, measurements:0, activityRecords:0 }
    });
  } catch (error) {
    logWorkerError({ requestId, route:INTELLIGENCE_PROCESSING_ACTION, stage:"intelligence_correlation", error });
    return jsonResponse({ ok:false, requestId, action:INTELLIGENCE_PROCESSING_ACTION, intelligenceProcessingVersion:INTELLIGENCE_PROCESSING_VERSION, error:safeErrorMessage(error) }, 500);
  }
}

function normalizeInput(body) {
  const v = body?.intelligence && typeof body.intelligence === "object" ? body.intelligence : (body || {});
  return {
    clientId: positiveInt(v.clientId ?? v.client_id), clientCode:clean(v.clientCode ?? v.client_code), clientName:clean(v.clientName ?? v.client),
    intelligenceType:key(v.intelligenceType ?? v.intelligence_type ?? v.type), subject:clean(v.subject ?? v.title), source:clean(v.source),
    sourceType:nullable(v.sourceType ?? v.source_type), sourceReference:nullable(v.sourceReference ?? v.source_reference ?? v.externalId),
    whatHappened:clean(v.whatHappened ?? v.what_happened ?? v.operationalSummary ?? v.summary), businessMeaning:nullable(v.businessMeaning ?? v.business_meaning ?? v.businessImpact),
    trend:normalizeTrend(v.trend), importance:normalizeImportance(v.importance ?? v.operationalPriority ?? v.priority), handlingState:normalizeHandling(v.handlingState ?? v.handling_state),
    recommendedAction:nullable(v.recommendedAction ?? v.recommended_action), whyNow:nullable(v.whyNow ?? v.why_now), proofRequirement:nullable(v.proofRequirement ?? v.proof_requirement),
    communicationId:positiveInt(v.communicationId ?? v.communication_id), investigationId:positiveInt(v.investigationId ?? v.investigation_id), workItemId:positiveInt(v.workItemId ?? v.work_item_id),
    correlationKey:nullable(v.correlationKey ?? v.correlation_key), observedAt:v.observedAt ?? v.observed_at ?? v.occurredAt ?? v.occurred_at ?? null
  };
}

async function resolveClient(db, v) {
  if (v.clientId) { const r=await db.prepare(`SELECT id,client_code,name FROM clients WHERE id=? LIMIT 1`).bind(v.clientId).first(); if (r) return r; }
  if (v.clientCode) { const r=await db.prepare(`SELECT id,client_code,name FROM clients WHERE client_code=? COLLATE NOCASE LIMIT 1`).bind(v.clientCode).first(); if (r) return r; }
  if (v.clientName) return db.prepare(`SELECT id,client_code,name FROM clients WHERE name=? COLLATE NOCASE LIMIT 1`).bind(v.clientName).first();
  return null;
}

async function findHandling(db, clientId, v) {
  if (v.workItemId) {
    const w=await db.prepare(`SELECT * FROM work_items WHERE id=? AND client_id=? LIMIT 1`).bind(v.workItemId,clientId).first();
    if (w && !isClosed(w.status)) return { kind:"work_item", record:w };
  }
  if (v.investigationId) {
    const i=await db.prepare(`SELECT * FROM investigations WHERE id=? AND client_id=? LIMIT 1`).bind(v.investigationId,clientId).first();
    if (i && !isClosed(i.status)) {
      const w=await db.prepare(`SELECT * FROM work_items WHERE investigation_id=? AND LOWER(REPLACE(REPLACE(COALESCE(status,'open'),'-','_'),' ','_')) NOT IN (${CLOSED}) ORDER BY id DESC LIMIT 1`).bind(i.id).first();
      return w ? { kind:"work_item", record:w, investigation:i } : { kind:"investigation", record:i };
    }
  }
  if (v.communicationId) {
    const w=await db.prepare(`SELECT * FROM work_items WHERE communication_id=? AND client_id=? AND LOWER(REPLACE(REPLACE(COALESCE(status,'open'),'-','_'),' ','_')) NOT IN (${CLOSED}) ORDER BY id DESC LIMIT 1`).bind(v.communicationId,clientId).first();
    if (w) return { kind:"work_item", record:w };
    const i=await db.prepare(`SELECT * FROM investigations WHERE communication_id=? AND client_id=? AND LOWER(REPLACE(REPLACE(COALESCE(status,'open'),'-','_'),' ','_')) NOT IN (${CLOSED}) ORDER BY id DESC LIMIT 1`).bind(v.communicationId,clientId).first();
    if (i) return { kind:"investigation", record:i };
  }

  const rows=(await db.prepare(`SELECT 'work_item' record_type,id,title,description,status,priority,communication_id,investigation_id,expected_impact context_text,created_at FROM work_items WHERE client_id=? AND LOWER(REPLACE(REPLACE(COALESCE(status,'open'),'-','_'),' ','_')) NOT IN (${CLOSED}) UNION ALL SELECT 'investigation',id,title,description,status,priority,communication_id,id,recommendation,created_at FROM investigations WHERE client_id=? AND LOWER(REPLACE(REPLACE(COALESCE(status,'open'),'-','_'),' ','_')) NOT IN (${CLOSED}) ORDER BY datetime(created_at) DESC LIMIT 30`).bind(clientId,clientId).all())?.results || [];
  const target=tokens(v.subject); let best=null, score=0;
  for (const r of rows) { const s=overlap(target,tokens([r.title,r.description,r.context_text].filter(Boolean).join(" "))); if (s>score) {score=s;best=r;} }
  return best && score>=0.5 ? { kind:best.record_type, record:{...best,id:Number(best.id)}, matchConfidence:score } : null;
}

function determineNovelty(existing, v) {
  if (!existing) return { value:"new", changedFields:[] };
  const pairs=[['what_happened',existing.what_happened,v.whatHappened],['business_meaning',existing.business_meaning,v.businessMeaning],['trend',existing.trend,v.trend],['importance',existing.importance,v.importance],['recommended_action',existing.recommended_action,v.recommendedAction],['why_now',existing.why_now,v.whyNow],['proof_requirement',existing.proof_requirement,v.proofRequirement]];
  const changed=pairs.filter(([,a,b])=>canon(a)!==canon(b)).map(([name])=>name);
  return { value:changed.length?"changed":"repeated", changedFields:changed };
}

function determineHandlingState(explicit, handling) { if (explicit && explicit!=="unhandled") return explicit; if (handling?.kind==="work_item") return "work_underway"; if (handling?.kind==="investigation") return "investigating"; return explicit||"unhandled"; }
function resolveLinks(v, existing, handling) { const r=handling?.record||{}; return { communicationId:v.communicationId||positiveInt(r.communication_id)||positiveInt(existing?.communication_id), investigationId:v.investigationId||(handling?.kind==="investigation"?positiveInt(r.id):positiveInt(r.investigation_id))||positiveInt(existing?.investigation_id), workItemId:v.workItemId||(handling?.kind==="work_item"?positiveInt(r.id):null)||positiveInt(existing?.work_item_id) }; }
function buildDecisionCandidate(r,c,handled) { const state=clean(r?.handling_state)||"unhandled"; return { recordType:"intelligence",recordId:Number(r?.id||0)||null,clientId:Number(c.id),clientCode:clean(c.client_code),clientName:clean(c.name),whatHappened:clean(r?.what_happened),businessMeaning:clean(r?.business_meaning),novelty:clean(r?.novelty)||"unknown",trend:clean(r?.trend)||"unknown",importance:clean(r?.importance)||"normal",handlingState:state,recommendedAction:clean(r?.recommended_action),whyNow:clean(r?.why_now),proofRequirement:clean(r?.proof_requirement),references:{communicationId:positiveInt(r?.communication_id),investigationId:positiveInt(r?.investigation_id),workItemId:positiveInt(r?.work_item_id)},alreadyBeingHandled:handled,eligibleForAgencyPriority:clean(r?.status).toLowerCase()==="active"&&!['monitoring','resolved'].includes(state)}; }

async function createCorrelationKey(clientId,type,subject) { const raw=JSON.stringify({clientId,intelligenceType:key(type),subject:canon(subject)}); const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)); const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,32); return `intel-${clientId}-${hash}`; }
function normalizeTrend(v){const x=key(v);return ['improving','deteriorating','stable','unknown'].includes(x)?x:'unknown';}
function normalizeImportance(v){return ({informational:'informational',info:'informational',low:'low',normal:'normal',medium:'normal',high:'high',urgent:'urgent',critical:'urgent',highest:'urgent'})[key(v)]||'normal';}
function normalizeHandling(v){const x=key(v);return new Set(['unhandled','monitoring','investigating','work_underway','awaiting_proof','awaiting_reply','scheduled','resolved']).has(x)?x:'unhandled';}
function normalizeIsoDate(v){const x=clean(v);if(x){const d=new Date(x);if(!Number.isNaN(d.getTime()))return d.toISOString();}return new Date().toISOString();}
function positiveInt(v){const n=Number(v);return Number.isInteger(n)&&n>0?n:null;}
function nullable(v){const x=clean(v);return x||null;}
function key(v){return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
function canon(v){return clean(v).toLowerCase().replace(/\s+/g,' ').trim();}
function isClosed(v){return new Set(['complete','completed','closed','resolved','cancelled','canceled','archived','ignored','no_action','published']).has(key(v||'open'));}
function tokens(v){const stop=new Set(['the','and','for','with','from','that','this','into','your','you','are','was','were','has','have','had','not','but','report','update','review','required','issue','problem']);return new Set(canon(v).replace(/[^a-z0-9]+/g,' ').split(' ').filter(t=>t.length>=4&&!stop.has(t)));}
function overlap(a,b){if(!a.size||!b.size)return 0;let n=0;for(const t of a)if(b.has(t))n++;return n/Math.max(1,Math.min(a.size,b.size));}
