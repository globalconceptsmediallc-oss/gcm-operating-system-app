/* =========================================================
   Global Concepts Media Operating System
   File: routes/communicationIntelligence.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Source: Today / Agency Command Center Rebuild
   Sprint: Communication → Durable Intelligence
   Purpose:
   Read one existing Communication, interpret what it means using
   current client/operational context, and hand a normalized signal to
   the common intelligence correlation/persistence route.

   Production rules:
   - Reads an existing communications row by ID.
   - Does not create or alter Communications.
   - Uses existing D1 history as context before interpretation.
   - Uses AI only for business interpretation; deterministic fallback is retained.
   - Delegates correlation and Intelligence persistence to intelligenceProcessing.js.
   - Passes communicationId so active Investigation/Work relationships can be
     discovered deterministically by the common correlation engine.
   - Never creates Investigation, Work Item, Evidence, Measurement, Activity,
     Media, Calendar, Prospect, Finance, Proof, or Case Study records.
   ========================================================= */

import { COMMUNICATION_REASONING_MODEL } from "../shared/config.js";
import { getDatabase } from "../shared/database.js";
import { clean, safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { runAiJsonWithRetry } from "../shared/ai.js";
import { handleIntelligenceProcessing } from "./intelligenceProcessing.js";

export const COMMUNICATION_INTELLIGENCE_VERSION = "1.0.0";
export const COMMUNICATION_INTELLIGENCE_ACTION = "process-communication-intelligence";

export async function handleCommunicationIntelligence(body, env, requestId) {
  const startedAt = Date.now();
  const db = getDatabase(env);
  const communicationId = positiveInt(
    body?.communicationId ?? body?.communication_id ?? body?.recordId ?? body?.id
  );

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({ ok:false, requestId, action:COMMUNICATION_INTELLIGENCE_ACTION, error:"The production D1 database binding is unavailable." }, 503);
  }

  if (!communicationId) {
    return jsonResponse({ ok:false, requestId, action:COMMUNICATION_INTELLIGENCE_ACTION, error:"A valid communicationId is required." }, 400);
  }

  try {
    const communication = await db.prepare(`
      SELECT comm.*, client.client_code, client.name AS client_name
      FROM communications comm
      INNER JOIN clients client ON client.id = comm.client_id
      WHERE comm.id = ?
      LIMIT 1
    `).bind(communicationId).first();

    if (!communication) {
      return jsonResponse({ ok:false, requestId, action:COMMUNICATION_INTELLIGENCE_ACTION, error:`Communication #${communicationId} was not found.` }, 404);
    }

    const context = await loadContext(db, communication.client_id);
    const fallback = buildDeterministicInterpretation(communication);
    const aiResult = await interpretCommunication({ communication, context, fallback, env, requestId });
    const interpretation = aiResult.ok ? normalizeInterpretation(aiResult.data, fallback) : fallback;

    const intelligenceResponse = await handleIntelligenceProcessing({
      action:"process-intelligence",
      intelligence:{
        clientId:communication.client_id,
        intelligenceType:interpretation.intelligenceType,
        subject:interpretation.subject,
        source:interpretation.source,
        sourceType:"communication",
        sourceReference:`communication:${communication.id}`,
        whatHappened:interpretation.whatHappened,
        businessMeaning:interpretation.businessMeaning,
        trend:interpretation.trend,
        importance:interpretation.importance,
        handlingState:interpretation.handlingState,
        recommendedAction:interpretation.recommendedAction,
        whyNow:interpretation.whyNow,
        proofRequirement:interpretation.proofRequirement,
        communicationId:communication.id,
        observedAt:communicationObservedAt(communication)
      }
    }, env, `${requestId}-correlation`);

    let intelligencePayload = null;
    try { intelligencePayload = await intelligenceResponse.clone().json(); } catch { intelligencePayload = null; }

    if (!intelligenceResponse.ok || !intelligencePayload?.ok) {
      return jsonResponse({
        ok:false,
        requestId,
        action:COMMUNICATION_INTELLIGENCE_ACTION,
        communicationIntelligenceVersion:COMMUNICATION_INTELLIGENCE_VERSION,
        communicationId,
        interpretation,
        aiUsed:Boolean(aiResult.ok),
        error:intelligencePayload?.error || "The Communication was interpreted but Intelligence persistence failed."
      }, intelligenceResponse.status || 500);
    }

    return jsonResponse({
      ok:true,
      requestId,
      action:COMMUNICATION_INTELLIGENCE_ACTION,
      communicationIntelligenceVersion:COMMUNICATION_INTELLIGENCE_VERSION,
      communication:{
        id:Number(communication.id),
        clientId:Number(communication.client_id),
        clientCode:clean(communication.client_code),
        clientName:clean(communication.client_name),
        date:communicationObservedAt(communication),
        source:communicationSource(communication),
        category:communicationCategory(communication),
        subject:communicationSubject(communication),
        status:firstClean(communication.status, communication.processing_status, communication.review_status)
      },
      interpretation,
      interpretationDiagnostics:{
        aiUsed:Boolean(aiResult.ok),
        fallbackUsed:!aiResult.ok,
        aiError:aiResult.ok ? null : aiResult.error?.message || null
      },
      intelligence:intelligencePayload,
      writes:intelligencePayload.writes,
      executionTimeMs:Date.now()-startedAt
    });
  } catch (error) {
    logWorkerError({ requestId, route:COMMUNICATION_INTELLIGENCE_ACTION, stage:"communication_intelligence", error });
    return jsonResponse({ ok:false, requestId, action:COMMUNICATION_INTELLIGENCE_ACTION, communicationIntelligenceVersion:COMMUNICATION_INTELLIGENCE_VERSION, error:safeErrorMessage(error) }, 500);
  }
}

async function loadContext(db, clientId) {
  const [investigationsResult, workResult, intelligenceResult, communicationResult, activityResult] = await Promise.all([
    db.prepare(`SELECT id,title,description,priority,status,recommendation,finding_summary,communication_id,created_at FROM investigations WHERE client_id=? ORDER BY id DESC LIMIT 20`).bind(clientId).all(),
    db.prepare(`SELECT id,title,description,priority,status,expected_impact,actual_impact,investigation_id,communication_id,created_at FROM work_items WHERE client_id=? ORDER BY id DESC LIMIT 20`).bind(clientId).all(),
    db.prepare(`SELECT id,intelligence_type,subject,what_happened,business_meaning,novelty,trend,importance,handling_state,recommended_action,communication_id,investigation_id,work_item_id,first_observed_at,last_observed_at,status FROM intelligence WHERE client_id=? ORDER BY id DESC LIMIT 20`).bind(clientId).all(),
    db.prepare(`SELECT * FROM communications WHERE client_id=? ORDER BY id DESC LIMIT 20`).bind(clientId).all(),
    db.prepare(`SELECT id,activity_date,category,activity,expected_impact,actual_impact,notes,source_type,source_reference,priority,status FROM activity_records WHERE client_id=? ORDER BY id DESC LIMIT 20`).bind(clientId).all()
  ]);

  return {
    investigations:rows(investigationsResult),
    workItems:rows(workResult),
    intelligence:rows(intelligenceResult),
    recentCommunications:rows(communicationResult),
    recentActivity:rows(activityResult)
  };
}

async function interpretCommunication({ communication, context, fallback, env, requestId }) {
  const prompt = [
    "GCM OS COMMUNICATION INTELLIGENCE INTERPRETATION",
    "",
    "Interpret one already-saved agency Communication in the context of the client's durable operational history.",
    "This is consulting interpretation, not a source-specific rule engine.",
    "Use only the supplied Communication and D1 context as facts.",
    "Do not invent metrics, causes, deadlines, work, investigations, or outcomes.",
    "The downstream correlation engine decides novelty and record links.",
    "If an open Investigation or Work Item already addresses the condition, do not recommend duplicate work.",
    "If the Communication is monitoring evidence, say so.",
    "If deterioration is explicit, trend may be deteriorating.",
    "If improvement is explicit, trend may be improving.",
    "Recommended action should be the highest-value next action supported by evidence, not a task list.",
    "Proof requirement must state what evidence would verify the recommendation or establish resolution.",
    "",
    "COMMUNICATION",
    JSON.stringify(communication, null, 2),
    "",
    "CLIENT CONTEXT",
    JSON.stringify(context, null, 2),
    "",
    "Return one JSON object only with this exact shape:",
    JSON.stringify({
      intelligenceType:fallback.intelligenceType,
      subject:fallback.subject,
      source:fallback.source,
      whatHappened:fallback.whatHappened,
      businessMeaning:fallback.businessMeaning,
      trend:fallback.trend,
      importance:fallback.importance,
      handlingState:fallback.handlingState,
      recommendedAction:fallback.recommendedAction,
      whyNow:fallback.whyNow,
      proofRequirement:fallback.proofRequirement
    }, null, 2)
  ].join("\n");

  return runAiJsonWithRetry({
    env,
    model:COMMUNICATION_REASONING_MODEL,
    input:{
      messages:[
        { role:"system", content:"You are the GCM OS durable intelligence interpretation engine. Return one JSON object only. Evidence before assumptions. WWPOWD." },
        { role:"user", content:prompt }
      ],
      max_tokens:1400,
      temperature:0
    },
    stageName:"communication_intelligence_interpretation",
    requestId,
    route:COMMUNICATION_INTELLIGENCE_ACTION,
    timeoutMs:30000,
    maxRetries:0
  });
}

function buildDeterministicInterpretation(communication) {
  const subject = communicationSubject(communication);
  const category = communicationCategory(communication);
  const source = communicationSource(communication);
  const body = communicationBody(communication);
  const summary = firstClean(
    communication.operational_summary,
    communication.summary,
    communication.analysis_summary,
    communication.description,
    body
  );
  const businessMeaning = firstClean(
    communication.business_impact,
    communication.business_meaning,
    communication.expected_impact,
    communication.reasoning
  );
  const recommendedAction = firstClean(
    communication.recommended_action,
    communication.next_action,
    communication.recommendation
  );
  const text = [category, subject, summary, businessMeaning, recommendedAction].filter(Boolean).join(" ");

  return {
    intelligenceType:key(category || "communication intelligence") || "communication_intelligence",
    subject:subject || category || `Communication ${communication.id}`,
    source:source || "Communication",
    whatHappened:summary || subject || `Communication #${communication.id} was recorded.`,
    businessMeaning:businessMeaning || "This Communication is durable agency evidence and requires correlation with existing client history before new work is justified.",
    trend:inferTrend(text),
    importance:normalizeImportance(firstClean(communication.priority, communication.operational_priority)),
    handlingState:"unhandled",
    recommendedAction:recommendedAction || "Correlate this Communication with existing Investigation and Work history before deciding whether new work is justified.",
    whyNow:businessMeaning || summary || "This Communication is now being evaluated against durable client history.",
    proofRequirement:firstClean(communication.proof_requirement, communication.proof_required) || "Verify the condition against later evidence or completed work and preserve the result against the same Intelligence record."
  };
}

function normalizeInterpretation(value, fallback) {
  const v=value && typeof value === "object" ? value : {};
  return {
    intelligenceType:key(v.intelligenceType || fallback.intelligenceType) || fallback.intelligenceType,
    subject:clean(v.subject) || fallback.subject,
    source:clean(v.source) || fallback.source,
    whatHappened:clean(v.whatHappened) || fallback.whatHappened,
    businessMeaning:clean(v.businessMeaning) || fallback.businessMeaning,
    trend:normalizeTrend(v.trend || fallback.trend),
    importance:normalizeImportance(v.importance || fallback.importance),
    handlingState:normalizeHandling(v.handlingState || fallback.handlingState),
    recommendedAction:clean(v.recommendedAction) || fallback.recommendedAction,
    whyNow:clean(v.whyNow) || fallback.whyNow,
    proofRequirement:clean(v.proofRequirement) || fallback.proofRequirement
  };
}

function communicationSubject(row) { return firstClean(row.subject,row.title,row.email_subject,row.communication_subject); }
function communicationCategory(row) { return firstClean(row.category,row.communication_type,row.type,row.notification_type); }
function communicationSource(row) { return firstClean(row.source,row.platform,row.sender_name,row.from_name,row.from_email); }
function communicationBody(row) { return firstClean(row.body,row.content,row.message,row.email_text,row.raw_text,row.text); }
function communicationObservedAt(row) { return firstClean(row.communication_date,row.received_at,row.date,row.occurred_at,row.created_at); }

function inferTrend(value) {
  const text=clean(value).toLowerCase();
  if (/\b(declin|drop|fall|fell|lost|worse|down|decreas|deteriorat|error[s]?\s+(?:increased|rose)|warning[s]?\s+(?:increased|rose))/.test(text)) return "deteriorating";
  if (/\b(improv|gain|increase|grew|growth|rose|higher|top 10|top ten|win|resolved|fixed|recovered)/.test(text)) return "improving";
  if (/\b(stable|unchanged|steady|flat)/.test(text)) return "stable";
  return "unknown";
}

function normalizeTrend(value) { const x=key(value); return ["improving","deteriorating","stable","unknown"].includes(x)?x:"unknown"; }
function normalizeImportance(value) { return ({informational:"informational",info:"informational",low:"low",normal:"normal",medium:"normal",high:"high",urgent:"urgent",critical:"urgent",highest:"urgent"})[key(value)] || "normal"; }
function normalizeHandling(value) { const x=key(value); return new Set(["unhandled","monitoring","investigating","work_underway","awaiting_proof","awaiting_reply","scheduled","resolved"]).has(x)?x:"unhandled"; }
function firstClean(...values) { for (const value of values) { const text=clean(value); if (text) return text; } return ""; }
function positiveInt(value) { const n=Number(value); return Number.isInteger(n)&&n>0?n:null; }
function rows(result) { return Array.isArray(result?.results)?result.results:[]; }
function key(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }
