/* =========================================================
   Global Concepts Media Operating System
   File: routes/activityIntelligence.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Source: Today / Agency Command Center Rebuild
   Sprint: Activity Record → Durable Intelligence
   Purpose:
   Read one existing Activity Record, interpret what it means using
   current client/operational context, and hand a normalized signal to
   the common intelligence correlation/persistence route.

   Production rules:
   - Reads an existing activity_records row by ID.
   - Does not create or alter Activity Records.
   - Uses existing D1 history as context before interpretation.
   - Uses AI only for business interpretation; deterministic fallback is retained.
   - Delegates correlation and Intelligence persistence to intelligenceProcessing.js.
   - Never creates Communication, Investigation, Work Item, Evidence, Measurement,
     Media, Calendar, Prospect, Finance, Proof, or Case Study records.
   ========================================================= */

import { COMMUNICATION_REASONING_MODEL } from "../shared/config.js";
import { getDatabase } from "../shared/database.js";
import { clean, safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { runAiJsonWithRetry } from "../shared/ai.js";
import { handleIntelligenceProcessing } from "./intelligenceProcessing.js";

export const ACTIVITY_INTELLIGENCE_VERSION = "1.0.0";
export const ACTIVITY_INTELLIGENCE_ACTION = "process-activity-intelligence";

export async function handleActivityIntelligence(body, env, requestId) {
  const startedAt = Date.now();
  const db = getDatabase(env);
  const activityRecordId = positiveInt(body?.activityRecordId ?? body?.activity_record_id ?? body?.recordId ?? body?.id);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({ ok:false, requestId, action:ACTIVITY_INTELLIGENCE_ACTION, error:"The production D1 database binding is unavailable." }, 503);
  }

  if (!activityRecordId) {
    return jsonResponse({ ok:false, requestId, action:ACTIVITY_INTELLIGENCE_ACTION, error:"A valid activityRecordId is required." }, 400);
  }

  try {
    const activity = await db.prepare(`
      SELECT
        ar.*,
        c.client_code,
        c.name AS client_name
      FROM activity_records ar
      INNER JOIN clients c ON c.id = ar.client_id
      WHERE ar.id = ?
      LIMIT 1
    `).bind(activityRecordId).first();

    if (!activity) {
      return jsonResponse({ ok:false, requestId, action:ACTIVITY_INTELLIGENCE_ACTION, error:`Activity Record #${activityRecordId} was not found.` }, 404);
    }

    const context = await loadContext(db, activity.client_id);
    const fallback = buildDeterministicInterpretation(activity);
    const aiResult = await interpretActivity({ activity, context, fallback, env, requestId });
    const interpretation = aiResult.ok
      ? normalizeInterpretation(aiResult.data, fallback)
      : fallback;

    const intelligenceResponse = await handleIntelligenceProcessing({
      action: "process-intelligence",
      intelligence: {
        clientId: activity.client_id,
        intelligenceType: interpretation.intelligenceType,
        subject: interpretation.subject,
        source: interpretation.source,
        sourceType: activity.source_type || "activity_record",
        sourceReference: activity.source_reference || `activity:${activity.id}`,
        whatHappened: interpretation.whatHappened,
        businessMeaning: interpretation.businessMeaning,
        trend: interpretation.trend,
        importance: interpretation.importance,
        handlingState: interpretation.handlingState,
        recommendedAction: interpretation.recommendedAction,
        whyNow: interpretation.whyNow,
        proofRequirement: interpretation.proofRequirement,
        workItemId: activity.work_item_id || null,
        observedAt: activity.activity_date || activity.created_at
      }
    }, env, `${requestId}-correlation`);

    let intelligencePayload = null;
    try {
      intelligencePayload = await intelligenceResponse.clone().json();
    } catch {
      intelligencePayload = null;
    }

    if (!intelligenceResponse.ok || !intelligencePayload?.ok) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIVITY_INTELLIGENCE_ACTION,
        activityIntelligenceVersion:ACTIVITY_INTELLIGENCE_VERSION,
        activityRecordId,
        interpretation,
        aiUsed:Boolean(aiResult.ok),
        error:intelligencePayload?.error || "The Activity Record was interpreted but Intelligence persistence failed."
      }, intelligenceResponse.status || 500);
    }

    return jsonResponse({
      ok:true,
      requestId,
      action:ACTIVITY_INTELLIGENCE_ACTION,
      activityIntelligenceVersion:ACTIVITY_INTELLIGENCE_VERSION,
      activityRecord:{
        id:Number(activity.id),
        clientId:Number(activity.client_id),
        clientCode:clean(activity.client_code),
        clientName:clean(activity.client_name),
        activityDate:activity.activity_date,
        category:activity.category,
        activity:activity.activity,
        sourceType:activity.source_type,
        sourceReference:activity.source_reference,
        priority:activity.priority,
        status:activity.status
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
    logWorkerError({ requestId, route:ACTIVITY_INTELLIGENCE_ACTION, stage:"activity_intelligence", error });
    return jsonResponse({ ok:false, requestId, action:ACTIVITY_INTELLIGENCE_ACTION, activityIntelligenceVersion:ACTIVITY_INTELLIGENCE_VERSION, error:safeErrorMessage(error) }, 500);
  }
}

async function loadContext(db, clientId) {
  const [investigationsResult, workResult, intelligenceResult, activityResult] = await Promise.all([
    db.prepare(`SELECT id,title,description,priority,status,recommendation,finding_summary,communication_id,created_at FROM investigations WHERE client_id=? ORDER BY id DESC LIMIT 20`).bind(clientId).all(),
    db.prepare(`SELECT id,title,description,priority,status,expected_impact,actual_impact,investigation_id,communication_id,created_at FROM work_items WHERE client_id=? ORDER BY id DESC LIMIT 20`).bind(clientId).all(),
    db.prepare(`SELECT id,intelligence_type,subject,what_happened,business_meaning,novelty,trend,importance,handling_state,recommended_action,investigation_id,work_item_id,first_observed_at,last_observed_at,status FROM intelligence WHERE client_id=? ORDER BY id DESC LIMIT 20`).bind(clientId).all(),
    db.prepare(`SELECT id,activity_date,category,activity,expected_impact,actual_impact,notes,source_type,source_reference,priority,status FROM activity_records WHERE client_id=? ORDER BY id DESC LIMIT 20`).bind(clientId).all()
  ]);

  return {
    investigations:rows(investigationsResult),
    workItems:rows(workResult),
    intelligence:rows(intelligenceResult),
    recentActivity:rows(activityResult)
  };
}

async function interpretActivity({ activity, context, fallback, env, requestId }) {
  const prompt = [
    "GCM OS ACTIVITY INTELLIGENCE INTERPRETATION",
    "",
    "Interpret one already-saved agency Activity Record in the context of the client's existing operational history.",
    "This is consulting interpretation, not a source-specific rule engine.",
    "Use only the supplied record and D1 context as facts.",
    "Do not invent metrics, causes, work, investigations, deadlines, or outcomes.",
    "Distinguish monitoring from deterioration, improvement, repeated evidence, and already-handled conditions.",
    "The downstream correlation engine will decide novelty and record links. Your subject must describe the enduring business condition, not merely repeat an email subject line.",
    "If the Activity Record is only monitoring evidence, say so. If deterioration is explicit, trend may be deteriorating. If improvement is explicit, trend may be improving.",
    "Recommended action should be the highest-value next action supported by evidence, not a long task list.",
    "Proof requirement must state what evidence would establish that the recommended work or monitoring conclusion is resolved/verified.",
    "",
    "ACTIVITY RECORD",
    JSON.stringify(activity, null, 2),
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
    stageName:"activity_intelligence_interpretation",
    requestId,
    route:ACTIVITY_INTELLIGENCE_ACTION,
    timeoutMs:30000,
    maxRetries:0
  });
}

function buildDeterministicInterpretation(activity) {
  const text = [activity.category, activity.activity, activity.actual_impact, activity.expected_impact, activity.notes].filter(Boolean).join(" ");
  return {
    intelligenceType:key(activity.category || "activity intelligence") || "activity_intelligence",
    subject:clean(activity.activity || activity.category || `Activity Record ${activity.id}`),
    source:clean(activity.evidence_type || activity.source_type || "Activity Record"),
    whatHappened:clean(activity.activity || activity.actual_impact || activity.category || `Activity Record #${activity.id} was recorded.`),
    businessMeaning:clean(activity.actual_impact || activity.expected_impact || extractNoteValue(activity.notes, "Business meaning")) || "The saved activity is durable client history, but its business significance requires correlation with existing records.",
    trend:inferTrend(text),
    importance:normalizeImportance(activity.priority),
    handlingState:"unhandled",
    recommendedAction:extractNoteValue(activity.notes, "Recommended action") || "Correlate this signal with existing client history before deciding whether new work is justified.",
    whyNow:clean(activity.actual_impact || activity.expected_impact) || "This signal is now being evaluated against durable client history.",
    proofRequirement:"Verify the condition against later evidence or measurements and preserve the result against the same Intelligence record."
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

function inferTrend(value) {
  const text=clean(value).toLowerCase();
  if (/\b(declin|drop|fall|fell|lost|worse|down|decreas|deteriorat)/.test(text)) return "deteriorating";
  if (/\b(improv|gain|increase|grew|growth|rose|higher|top 10|top ten|win|resolved)/.test(text)) return "improving";
  if (/\b(stable|unchanged|steady|flat)/.test(text)) return "stable";
  return "unknown";
}

function extractNoteValue(notes, label) {
  const text=clean(notes);
  if (!text) return "";
  const pattern=new RegExp(`(?:^|\\n)${escapeRegex(label)}\\s*:\\s*([^\\n]+)`, "i");
  return clean(text.match(pattern)?.[1]);
}

function normalizeTrend(value) { const x=key(value); return ["improving","deteriorating","stable","unknown"].includes(x)?x:"unknown"; }
function normalizeImportance(value) { return ({informational:"informational",info:"informational",low:"low",normal:"normal",medium:"normal",high:"high",urgent:"urgent",critical:"urgent",highest:"urgent"})[key(value)] || "normal"; }
function normalizeHandling(value) { const x=key(value); return new Set(["unhandled","monitoring","investigating","work_underway","awaiting_proof","awaiting_reply","scheduled","resolved"]).has(x)?x:"unhandled"; }
function positiveInt(value) { const n=Number(value); return Number.isInteger(n)&&n>0?n:null; }
function rows(result) { return Array.isArray(result?.results)?result.results:[]; }
function key(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
