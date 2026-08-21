/* =========================================================
   Global Concepts Media Operating System
   File: routes/gmailDispositions.js
   Version: 1.3.0
   Status: Production Road-Test Candidate
   Sprint: Gmail — Universal Monitoring Evidence
   Purpose:
   Give Morning Command explicit human dispositions while preserving exact
   source evidence before a Monitoring decision can clear Gmail, and preserve
   the lightweight Decision Hold / Work Lite workflow.

   Change notes — v1.3.0:
   - Applies Evidence Before Assumptions to every Gmail Monitoring approval.
   - Re-reads the live Gmail source and captures it in an additive evidence vault
     before the authoritative Monitoring route can mark Gmail read.
   - Preserves normalized source-grounded measurable facts when they can be
     deterministically extracted without deciding what those facts mean.
   - Enriches Monitoring preview cards with compact evidence snapshots when the
     existing intelligence has no structured monitoring metrics.
   - Keeps Position Tracking's specialized keyword parser and exact-signal path.
   - If authoritative Monitoring validation fails, no final Monitoring record is
     invented; pending evidence is removed when no operational write occurred.
   - If an operational write succeeds but Gmail clearing fails, the captured
     source remains durable and linked to the activity record.
   - Uses runtime schema guards for both Monitoring Evidence and Decision Hold
     additive tables so application rollout cannot outrun D1 schema rollout.

   Change notes — v1.2.0:
   - Adds Hold for Review / Work Lite as a durable, client-linked decision state.
   - A held Gmail source creates 0 Work Items and 0 Investigations.
   - Preserves the full source text, blocking question/follow-up, reason,
     priority, due date when present, Gmail message ID, and thread ID.
   - Marks Gmail read only after D1 confirms the Decision Hold.
   - Lists open Decision Holds for Today and can release one back to Morning
     Command without deleting its history.
   - Resolves client identity from strongest message context first: subject,
     body, snippet, thread context, recipients, then sender.

   Change notes — v1.1.0:
   - Adds exact Position Tracking keyword, position, movement, trigger, domain,
     report date, source text, message ID, and thread ID preservation.

   Change notes — v1.0.0:
   - Delete — No Action Required moves Gmail to Trash and creates zero OS records.
   - Keep as Information creates one durable Communication with no Investigation
     and no Work Item, then marks Gmail read only after D1 confirms the record.
   ========================================================= */

import { clean, safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase } from "../shared/database.js";
import { handleCommitOperationalDecision } from "./operationalDecision.js";
import { handleGmailAction } from "./gmailIntegration.js";
import { inferClientFromText } from "./gmailWorkRequestIntelligence.js";
import {
  extractPositionTrackingEvidence,
  extractMonitoringEvidence,
  formatPositionTrackingEvidence,
  formatMonitoringEvidence,
  buildPositionTrackingBusinessMeaning,
  buildMonitoringBusinessMeaning
} from "../shared/gmailMonitoringEvidence.js";
import {
  inferClientFromMessageContext,
  evaluateDecisionHold,
  buildDecisionHoldBusinessMeaning
} from "../shared/gmailDecisionHold.js";
import { ensureDecisionHoldSchema } from "../shared/decisionHoldSchema.js";
import { ensureGmailMonitoringEvidenceSchema } from "../shared/gmailMonitoringEvidenceSchema.js";

export const PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION = "preview-gmail-inbox";
export const APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION = "approve-gmail-monitoring";
export const HOLD_GMAIL_DECISION_ACTION = "hold-gmail-decision";
export const DELETE_GMAIL_NO_ACTION_ACTION = "delete-gmail-no-action";
export const SAVE_GMAIL_INFORMATION_ACTION = "save-gmail-information";
export const GMAIL_DISPOSITION_ACTIONS = Object.freeze([
  PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION,
  APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
  HOLD_GMAIL_DECISION_ACTION,
  DELETE_GMAIL_NO_ACTION_ACTION,
  SAVE_GMAIL_INFORMATION_ACTION
]);
export const GMAIL_DISPOSITION_VERSION = "1.3.0";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const UNIVERSAL_SOURCE_MARKER = "Universal Gmail source evidence:";

export async function handleGmailDispositions(body, env, requestId) {
  const action = clean(body?.action);
  if (action === PREVIEW_GMAIL_INBOX_EVIDENCE_ACTION) return previewWithEvidence(body, env, requestId);
  if (action === APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION) return approveMonitoringWithEvidence(body, env, requestId);
  if (action === HOLD_GMAIL_DECISION_ACTION) return handleDecisionHold(body, env, requestId);
  if (action === DELETE_GMAIL_NO_ACTION_ACTION) return deleteNoAction(body, env, requestId);
  if (action === SAVE_GMAIL_INFORMATION_ACTION) return saveInformation(body, env, requestId);
  return null;
}

async function previewWithEvidence(body, env, requestId) {
  const legacyResponse = await handleGmailAction(body, env, requestId);
  if (!legacyResponse || typeof legacyResponse.json !== "function") return legacyResponse;

  let payload;
  try {
    payload = await legacyResponse.json();
  } catch {
    return legacyResponse;
  }

  if (!legacyResponse.ok || payload?.ok !== true || !Array.isArray(payload?.messages)) {
    return jsonResponse(payload, legacyResponse.status || 500);
  }

  payload.messages = payload.messages.map(enrichPreviewMessage);
  payload.gmailDispositionVersion = GMAIL_DISPOSITION_VERSION;
  payload.evidencePreservation = "Universal source evidence + exact monitoring facts + Decision Hold guard active";
  return jsonResponse(payload, legacyResponse.status || 200);
}

function enrichPreviewMessage(message) {
  const monitoringEnriched = enrichMonitoringPreview(message);
  const current = monitoringEnriched?.intelligence || {};
  const inferred = inferClientFromMessageContext(monitoringEnriched, inferClientFromText);
  const clientName = inferred?.name || current.client || "Unassigned — Human Review";
  const normalized = {
    ...monitoringEnriched,
    intelligence:{
      ...current,
      client:clientName
    }
  };

  const hold = evaluateDecisionHold(normalized, normalized.intelligence, { clientName });
  if (!hold.candidate) return normalized;

  return {
    ...normalized,
    intelligence:{
      ...normalized.intelligence,
      client:clientName,
      businessMeaning:buildDecisionHoldBusinessMeaning(hold, clientName),
      operationalPriority:hold.priority || normalized.intelligence.operationalPriority || "Low",
      recommendedAction:hold.suggestedNextAction,
      proposedRoute:"Decision Hold",
      decisionHoldCandidate:true,
      decisionHold:hold,
      evidenceSufficiency:"Source evidence is sufficient to preserve; one decision-critical question or future follow-up remains unresolved.",
      evidenceComparedAgainst:"Current Gmail source and verified client identity; no final Work/Investigation disposition is assumed.",
      verificationRequired:hold.question,
      productionDecisionReady:false
    }
  };
}

function enrichMonitoringPreview(message) {
  const positionEnriched = enrichPositionTrackingPreview(message);
  const current = positionEnriched?.intelligence || {};

  if (current.monitoringOnly !== true) return positionEnriched;
  if (current.monitoringMetrics && typeof current.monitoringMetrics === "object") {
    return positionEnriched;
  }

  const evidence = extractMonitoringEvidence(positionEnriched);
  if (!evidence || evidence.type === "position_tracking") return positionEnriched;

  const inferred = inferClientFromMessageContext(positionEnriched, inferClientFromText);
  const clientName = inferred?.name || current.client || "Unassigned — Human Review";
  const evidenceSummary = formatMonitoringEvidence(evidence);
  const businessMeaning = buildMonitoringBusinessMeaning(evidence, clientName);

  return {
    ...positionEnriched,
    snippet:evidenceSummary || positionEnriched?.snippet,
    intelligence:{
      ...current,
      client:clientName,
      businessMeaning:businessMeaning || current.businessMeaning,
      monitoringMetrics:evidence,
      evidenceSummary,
      evidenceSufficiency:evidenceSummary
        ? "Exact measurable facts were extracted from the Gmail source; the complete source will be captured before Monitoring approval clears Gmail."
        : current.evidenceSufficiency,
      evidenceComparedAgainst:"Current Gmail source preserved as the future comparison reference",
      verificationRequired:"Human approval may save these exact source-grounded facts as Monitoring. The evidence itself does not create corrective Work."
    }
  };
}

function enrichPositionTrackingPreview(message) {
  const evidence = extractPositionTrackingEvidence(
    `${clean(message?.subject)}\n${clean(message?.bodyText)}`
  );
  if (!evidence) return message;

  const inferred = inferClientFromMessageContext(message, inferClientFromText);
  const current = message?.intelligence || {};
  const clientName = inferred?.name || current.client || "Unassigned — Human Review";
  const evidenceSummary = formatPositionTrackingEvidence(evidence);
  const businessMeaning = buildPositionTrackingBusinessMeaning(evidence, clientName);

  return {
    ...message,
    snippet:evidenceSummary || message?.snippet,
    intelligence:{
      ...current,
      notificationType:"position_tracking",
      client:clientName,
      businessMeaning:businessMeaning || current.businessMeaning,
      monitoringMetrics:evidence,
      evidenceSummary,
      evidenceSufficiency:evidence.keywords?.length
        ? "Exact keyword, current position, movement, trigger, domain, and report date extracted from the Gmail source"
        : current.evidenceSufficiency,
      evidenceComparedAgainst:"Current Gmail source preserved for future D1 trend comparison",
      verificationRequired:"Human approval may save this exact Position Tracking signal as monitoring evidence. Escalate only when later comparison proves a meaningful adverse condition."
    }
  };
}

async function approveMonitoringWithEvidence(body, env, requestId) {
  const gmailMessageId = clean(body?.gmailMessageId);
  if (!gmailMessageId) {
    return jsonResponse({
      ok:false,
      requestId,
      action:APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
      error:"gmailMessageId is required."
    }, 400);
  }

  try {
    const db = requireDb(env);
    await ensureGmailMonitoringEvidenceSchema(db);

    const sourceReference = `gmail:${gmailMessageId}`;
    const existing = await findMonitoringActivity(db, sourceReference);
    const { message, accessToken } = await loadLiveGmailMessage(gmailMessageId, env);
    const evidence = extractMonitoringEvidence(message);
    const evidenceSummary = formatMonitoringEvidence(evidence);
    const inferred = inferClientFromMessageContext(message, inferClientFromText);
    const preClient = await resolveClient(db, inferred, clean(body?.clientName || body?.client));

    await captureMonitoringSourceEvidence(db, {
      sourceReference,
      message,
      evidence,
      evidenceSummary,
      clientId:preClient?.id || null
    });

    if (existing?.id) {
      await patchMonitoringActivityEvidence(db, existing.id, {
        message,
        evidence,
        evidenceSummary
      });
      await finalizeMonitoringSourceEvidence(db, {
        sourceReference,
        activityRecordId:existing.id,
        clientId:existing.client_id || preClient?.id || null,
        status:"monitoring_saved"
      });
      await markMessageRead(gmailMessageId, accessToken);
      return jsonResponse({
        ok:true,
        requestId,
        action:APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
        version:GMAIL_DISPOSITION_VERSION,
        duplicate:true,
        writesPerformed:0,
        gmailMarkedRead:true,
        evidencePreserved:true,
        monitoringMetrics:evidence || null,
        evidenceSummary:evidenceSummary || null,
        record:existing
      });
    }

    if (evidence?.type === "position_tracking") {
      if (!preClient?.client_code) {
        await deletePendingMonitoringEvidence(db, sourceReference);
        return jsonResponse({
          ok:false,
          requestId,
          action:APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
          error:"Position Tracking evidence was found, but the production client could not be verified. Gmail was left unchanged for manual review."
        }, 409);
      }

      const activityDate = normalizeActivityDate(message.date);
      const businessMeaning = buildPositionTrackingBusinessMeaning(evidence, preClient.name);
      const notes = [
        `Business meaning: ${businessMeaning}`,
        `Evidence summary: ${evidenceSummary}`,
        `Gmail message ID: ${gmailMessageId}`,
        `Gmail thread ID: ${clean(message.threadId)}`
      ].filter(Boolean).join("\n");

      const result = await db.prepare(`INSERT INTO activity_records (
        client_id,activity_date,category,activity,evidence_type,evidence_reference,
        status,owner,time_minutes,expected_impact,actual_impact,notes,source_type,
        source_reference,priority,win,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
        .bind(
          preClient.id,
          activityDate,
          "SEO Ranking Alert",
          clean(message.subject) || "Position Tracking update",
          "Gmail — Position Tracking",
          sourceReference,
          "completed",
          "Andy",
          0,
          "Monitoring / trend evidence",
          businessMeaning,
          notes,
          "gmail_monitoring",
          sourceReference,
          "Low",
          0
        ).run();

      const recordId = result?.meta?.last_row_id || null;
      if (!recordId) {
        await deletePendingMonitoringEvidence(db, sourceReference);
        return jsonResponse({
          ok:false,
          requestId,
          action:APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
          error:"D1 did not confirm the Position Tracking monitoring record. Gmail was left unread."
        }, 500);
      }

      await patchMonitoringActivityEvidence(db, recordId, {
        message,
        evidence,
        evidenceSummary
      });
      await finalizeMonitoringSourceEvidence(db, {
        sourceReference,
        activityRecordId:recordId,
        clientId:preClient.id,
        status:"monitoring_saved"
      });
      await markMessageRead(gmailMessageId, accessToken);

      return jsonResponse({
        ok:true,
        requestId,
        action:APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
        version:GMAIL_DISPOSITION_VERSION,
        duplicate:false,
        writesPerformed:1,
        gmailMarkedRead:true,
        evidencePreserved:true,
        monitoringMetrics:evidence,
        evidenceSummary,
        record:{
          id:recordId,
          client_id:preClient.id,
          client:preClient.name,
          activity_date:activityDate,
          activity:clean(message.subject) || "Position Tracking update",
          source_reference:sourceReference
        }
      });
    }

    const legacyResponse = await handleGmailAction(body, env, requestId);
    if (!legacyResponse || typeof legacyResponse.json !== "function") {
      await deletePendingMonitoringEvidence(db, sourceReference);
      return legacyResponse;
    }

    let legacyPayload;
    try {
      legacyPayload = await legacyResponse.json();
    } catch (error) {
      await deletePendingMonitoringEvidence(db, sourceReference);
      throw error;
    }

    if (!legacyResponse.ok || legacyPayload?.ok !== true) {
      const writtenAfterFailure = await findMonitoringActivity(db, sourceReference);
      if (writtenAfterFailure?.id) {
        await patchMonitoringActivityEvidence(db, writtenAfterFailure.id, {
          message,
          evidence,
          evidenceSummary
        });
        await finalizeMonitoringSourceEvidence(db, {
          sourceReference,
          activityRecordId:writtenAfterFailure.id,
          clientId:writtenAfterFailure.client_id || preClient?.id || null,
          status:"monitoring_saved_gmail_pending"
        });
      } else {
        await deletePendingMonitoringEvidence(db, sourceReference);
      }
      return jsonResponse(legacyPayload, legacyResponse.status || 500);
    }

    let recordId = Number(legacyPayload?.record?.id || 0) || null;
    let clientId = Number(legacyPayload?.record?.client_id || 0) || preClient?.id || null;
    if (!recordId) {
      const written = await findMonitoringActivity(db, sourceReference);
      recordId = Number(written?.id || 0) || null;
      clientId = Number(written?.client_id || 0) || clientId;
    }

    if (!recordId) {
      await finalizeMonitoringSourceEvidence(db, {
        sourceReference,
        activityRecordId:null,
        clientId,
        status:"source_preserved_activity_unverified"
      });
      return jsonResponse({
        ...legacyPayload,
        evidencePreserved:true,
        evidenceWarning:"Gmail source evidence was preserved, but the Monitoring activity record ID could not be independently verified."
      }, legacyResponse.status || 200);
    }

    await patchMonitoringActivityEvidence(db, recordId, {
      message,
      evidence,
      evidenceSummary
    });
    await finalizeMonitoringSourceEvidence(db, {
      sourceReference,
      activityRecordId:recordId,
      clientId,
      status:"monitoring_saved"
    });

    return jsonResponse({
      ...legacyPayload,
      evidencePreserved:true,
      monitoringMetrics:legacyPayload.monitoringMetrics || evidence || null,
      evidenceSummary:evidenceSummary || null
    }, legacyResponse.status || 200);
  } catch (error) {
    logWorkerError({
      requestId,
      route:APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
      stage:"gmail_monitoring_evidence",
      error
    });
    return jsonResponse({
      ok:false,
      requestId,
      action:APPROVE_GMAIL_MONITORING_EVIDENCE_ACTION,
      error:safeErrorMessage(error)
    }, 500);
  }
}

async function findMonitoringActivity(db, sourceReference) {
  return db.prepare(`
    SELECT id, client_id, activity_date, activity, source_reference
    FROM activity_records
    WHERE source_reference = ? OR evidence_reference = ?
    ORDER BY id DESC
    LIMIT 1
  `).bind(sourceReference, sourceReference).first();
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
  if (!sourceContent) throw new Error("The live Gmail source contained no preservable evidence text.");

  await db.prepare(`
    INSERT INTO gmail_monitoring_evidence (
      client_id, activity_record_id, source_type, source_reference,
      gmail_message_id, gmail_thread_id, source_subject, source_sender,
      source_date, source_content, structured_evidence_json, evidence_summary,
      status, created_at, updated_at
    ) VALUES (?,NULL,'gmail',?,?,?,?,?,?,?,?,?,'captured_pending_validation',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(source_reference) DO UPDATE SET
      client_id=COALESCE(gmail_monitoring_evidence.client_id,excluded.client_id),
      gmail_message_id=excluded.gmail_message_id,
      gmail_thread_id=excluded.gmail_thread_id,
      source_subject=excluded.source_subject,
      source_sender=excluded.source_sender,
      source_date=excluded.source_date,
      source_content=excluded.source_content,
      structured_evidence_json=COALESCE(excluded.structured_evidence_json,gmail_monitoring_evidence.structured_evidence_json),
      evidence_summary=COALESCE(excluded.evidence_summary,gmail_monitoring_evidence.evidence_summary),
      status=CASE
        WHEN gmail_monitoring_evidence.activity_record_id IS NULL THEN 'captured_pending_validation'
        ELSE gmail_monitoring_evidence.status
      END,
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
  clientId,
  status
}) {
  await db.prepare(`
    UPDATE gmail_monitoring_evidence
    SET client_id=COALESCE(?,client_id),
        activity_record_id=COALESCE(?,activity_record_id),
        status=?,
        updated_at=CURRENT_TIMESTAMP
    WHERE source_reference=?
  `).bind(
    clientId || null,
    activityRecordId || null,
    clean(status) || "monitoring_saved",
    sourceReference
  ).run();
}

async function deletePendingMonitoringEvidence(db, sourceReference) {
  await db.prepare(`
    DELETE FROM gmail_monitoring_evidence
    WHERE source_reference=?
      AND activity_record_id IS NULL
      AND status='captured_pending_validation'
  `).bind(sourceReference).run();
}

async function patchMonitoringActivityEvidence(db, recordId, {
  message,
  evidence,
  evidenceSummary
}) {
  if (!Number.isInteger(Number(recordId)) || Number(recordId) <= 0) return;

  const sourceContent = sanitizeEmailText(
    message?.bodyText || message?.snippet || message?.subject
  ).slice(0, 8000);
  const block = [
    evidence ? `Structured source evidence: ${JSON.stringify(evidence)}` : "",
    evidenceSummary ? `Evidence summary: ${evidenceSummary}` : "",
    `Source sender: ${clean(message?.from)}`,
    `Source date: ${clean(message?.date)}`,
    `Gmail message ID: ${clean(message?.gmailMessageId)}`,
    `Gmail thread ID: ${clean(message?.threadId)}`,
    sourceContent ? `${UNIVERSAL_SOURCE_MARKER}\n${sourceContent}` : ""
  ].filter(Boolean).join("\n");
  if (!block) return;

  await db.prepare(`
    UPDATE activity_records
    SET notes=CASE
          WHEN TRIM(COALESCE(notes,''))='' THEN ?
          ELSE notes || '\n' || ?
        END,
        updated_at=CURRENT_TIMESTAMP
    WHERE id=?
      AND INSTR(COALESCE(notes,''),?)=0
  `).bind(block, block, Number(recordId), UNIVERSAL_SOURCE_MARKER).run();
}

async function handleDecisionHold(body, env, requestId) {
  const mode = clean(body?.mode || "create").toLowerCase();
  if (mode === "list") return listDecisionHolds(env, requestId);
  if (mode === "release") return releaseDecisionHold(body, env, requestId);
  return createDecisionHold(body, env, requestId);
}

async function createDecisionHold(body, env, requestId) {
  const gmailMessageId = clean(body?.gmailMessageId);
  if (!gmailMessageId) {
    return jsonResponse({
      ok:false,
      requestId,
      action:HOLD_GMAIL_DECISION_ACTION,
      error:"gmailMessageId is required."
    }, 400);
  }

  try {
    const db = requireDb(env);
    await ensureDecisionHoldSchema(db);
    const sourceReference = `gmail:${gmailMessageId}`;
    const existing = await db.prepare(`
      SELECT dh.*, c.client_code, c.name AS client_name
      FROM decision_holds dh
      LEFT JOIN clients c ON c.id = dh.client_id
      WHERE dh.source_reference = ?
        AND LOWER(COALESCE(dh.status, 'open')) IN ('open','held','waiting')
      ORDER BY dh.id DESC
      LIMIT 1
    `).bind(sourceReference).first();

    if (existing?.id) {
      const live = await loadLiveGmailMessage(gmailMessageId, env);
      await markMessageRead(gmailMessageId, live.accessToken);
      return jsonResponse({
        ok:true,
        requestId,
        action:HOLD_GMAIL_DECISION_ACTION,
        version:GMAIL_DISPOSITION_VERSION,
        duplicate:true,
        writesPerformed:0,
        gmailMarkedRead:true,
        hold:mapDecisionHold(existing)
      });
    }

    const { message, accessToken } = await loadLiveGmailMessage(gmailMessageId, env);
    const inferred = inferClientFromMessageContext(message, inferClientFromText);
    const client = await resolveClient(db, inferred, clean(body?.clientName || body?.client));

    if (!client?.client_code) {
      return jsonResponse({
        ok:false,
        requestId,
        action:HOLD_GMAIL_DECISION_ACTION,
        error:"Decision Hold requires a verified production client. Gmail was left unchanged for manual review."
      }, 409);
    }

    const leadershipContext = /\b(frank|adrianne)\b/i.test(`${message.from} ${message.to}`)
      ? "Human — Leadership / Client Operations"
      : "Human Review";
    const plan = evaluateDecisionHold(
      message,
      {
        client:client.name,
        proposedRoute:"Manual Review",
        communicationFamily:leadershipContext,
        archive:false,
        monitoringOnly:false,
        shouldCreateInvestigation:false,
        shouldCreateWorkItem:false
      },
      { clientName:client.name }
    );

    const safePlan = plan.candidate ? plan : {
      candidate:true,
      holdType:"decision_question",
      priority:"Low",
      question:"What decision-critical fact is still missing before this communication can be given a final disposition?",
      whyItMatters:"The source matters enough to preserve, but the operator intentionally deferred the final decision.",
      suggestedNextAction:"Park this as Work Lite and return after higher-priority work is handled.",
      dueDate:null,
      reviewOn:null
    };

    const result = await db.prepare(`
      INSERT INTO decision_holds (
        client_id, source_type, source_reference, source_thread_reference,
        source_subject, source_sender, source_date, source_content, title,
        hold_type, question, why_it_matters, suggested_next_action, priority,
        due_date, review_on, status, owner, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `).bind(
      client.id,
      "gmail",
      sourceReference,
      message.threadId ? `gmail-thread:${message.threadId}` : null,
      clean(message.subject),
      clean(message.from),
      clean(message.date),
      clean(message.bodyText || message.snippet || message.subject).slice(0, 12000),
      `Decision Hold — ${clean(message.subject) || "Gmail review"}`,
      safePlan.holdType,
      safePlan.question,
      safePlan.whyItMatters,
      safePlan.suggestedNextAction,
      safePlan.priority || "Low",
      safePlan.dueDate || null,
      safePlan.reviewOn || null,
      "Open",
      "Andy"
    ).run();

    const holdId = result?.meta?.last_row_id || null;
    if (!holdId) {
      return jsonResponse({
        ok:false,
        requestId,
        action:HOLD_GMAIL_DECISION_ACTION,
        error:"D1 did not confirm the Decision Hold. Gmail was left unchanged."
      }, 500);
    }

    await markMessageRead(gmailMessageId, accessToken);

    return jsonResponse({
      ok:true,
      requestId,
      action:HOLD_GMAIL_DECISION_ACTION,
      version:GMAIL_DISPOSITION_VERSION,
      duplicate:false,
      writesPerformed:1,
      workItemsCreated:0,
      investigationsCreated:0,
      gmailMarkedRead:true,
      hold:{
        id:holdId,
        clientId:client.id,
        clientCode:client.client_code,
        clientName:client.name,
        sourceReference,
        sourceSubject:message.subject,
        holdType:safePlan.holdType,
        question:safePlan.question,
        whyItMatters:safePlan.whyItMatters,
        suggestedNextAction:safePlan.suggestedNextAction,
        priority:safePlan.priority || "Low",
        dueDate:safePlan.dueDate || null,
        reviewOn:safePlan.reviewOn || null,
        status:"Open"
      }
    });
  } catch (error) {
    logWorkerError({ requestId, route:HOLD_GMAIL_DECISION_ACTION, stage:"gmail_decision_hold", error });
    return jsonResponse({ ok:false, requestId, action:HOLD_GMAIL_DECISION_ACTION, error:safeErrorMessage(error) }, 500);
  }
}

async function listDecisionHolds(env, requestId) {
  try {
    const db = requireDb(env);
    await ensureDecisionHoldSchema(db);
    const result = await db.prepare(`
      SELECT
        dh.*,
        c.client_code,
        c.name AS client_name
      FROM decision_holds dh
      LEFT JOIN clients c ON c.id = dh.client_id
      WHERE LOWER(COALESCE(dh.status, 'open')) IN ('open','held','waiting')
      ORDER BY
        CASE LOWER(COALESCE(dh.priority, 'low'))
          WHEN 'urgent' THEN 0
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        CASE WHEN dh.due_date IS NULL OR dh.due_date = '' THEN 1 ELSE 0 END,
        date(dh.due_date) ASC,
        datetime(dh.created_at) ASC,
        dh.id ASC
      LIMIT 50
    `).all();

    const holds = (result?.results || []).map(mapDecisionHold);
    return jsonResponse({
      ok:true,
      requestId,
      action:HOLD_GMAIL_DECISION_ACTION,
      mode:"list",
      version:GMAIL_DISPOSITION_VERSION,
      writesPerformed:0,
      count:holds.length,
      holds
    });
  } catch (error) {
    logWorkerError({ requestId, route:HOLD_GMAIL_DECISION_ACTION, stage:"list_decision_holds", error });
    return jsonResponse({ ok:false, requestId, action:HOLD_GMAIL_DECISION_ACTION, error:safeErrorMessage(error) }, 500);
  }
}

async function releaseDecisionHold(body, env, requestId) {
  const holdId = Number(body?.holdId);
  if (!Number.isInteger(holdId) || holdId <= 0) {
    return jsonResponse({
      ok:false,
      requestId,
      action:HOLD_GMAIL_DECISION_ACTION,
      error:"holdId is required."
    }, 400);
  }

  try {
    const db = requireDb(env);
    await ensureDecisionHoldSchema(db);
    const hold = await db.prepare(`
      SELECT *
      FROM decision_holds
      WHERE id = ?
        AND LOWER(COALESCE(status, 'open')) IN ('open','held','waiting')
      LIMIT 1
    `).bind(holdId).first();

    if (!hold?.id) {
      return jsonResponse({
        ok:false,
        requestId,
        action:HOLD_GMAIL_DECISION_ACTION,
        error:"Open Decision Hold was not found."
      }, 404);
    }

    await db.prepare(`
      UPDATE decision_holds
      SET status = 'Released',
          released_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP,
          resolution = 'Returned to Morning Command for final disposition'
      WHERE id = ?
    `).bind(holdId).run();

    const gmailMessageId = clean(hold.source_reference).startsWith("gmail:")
      ? clean(hold.source_reference).slice(6)
      : "";
    let gmailMarkedUnread = false;
    if (gmailMessageId) {
      try {
        const live = await loadLiveGmailMessage(gmailMessageId, env);
        await markMessageUnread(gmailMessageId, live.accessToken);
        gmailMarkedUnread = true;
      } catch (error) {
        logWorkerError({ requestId, route:HOLD_GMAIL_DECISION_ACTION, stage:"release_decision_hold_gmail", error });
      }
    }

    return jsonResponse({
      ok:true,
      requestId,
      action:HOLD_GMAIL_DECISION_ACTION,
      mode:"release",
      version:GMAIL_DISPOSITION_VERSION,
      writesPerformed:1,
      holdId,
      gmailMarkedUnread,
      returnedToMorningCommand:true
    });
  } catch (error) {
    logWorkerError({ requestId, route:HOLD_GMAIL_DECISION_ACTION, stage:"release_decision_hold", error });
    return jsonResponse({ ok:false, requestId, action:HOLD_GMAIL_DECISION_ACTION, error:safeErrorMessage(error) }, 500);
  }
}

function mapDecisionHold(row) {
  const sourceReference = clean(row?.source_reference);
  const gmailMessageId = sourceReference.startsWith("gmail:") ? sourceReference.slice(6) : null;
  return {
    id:Number(row?.id),
    clientId:Number(row?.client_id) || null,
    clientCode:clean(row?.client_code) || null,
    clientName:clean(row?.client_name) || null,
    title:clean(row?.title),
    sourceType:clean(row?.source_type),
    sourceReference,
    sourceSubject:clean(row?.source_subject),
    sourceSender:clean(row?.source_sender),
    sourceDate:clean(row?.source_date),
    holdType:clean(row?.hold_type),
    question:clean(row?.question),
    whyItMatters:clean(row?.why_it_matters),
    suggestedNextAction:clean(row?.suggested_next_action),
    priority:clean(row?.priority) || "Low",
    dueDate:clean(row?.due_date) || null,
    reviewOn:clean(row?.review_on) || null,
    status:clean(row?.status) || "Open",
    owner:clean(row?.owner) || "Andy",
    createdAt:clean(row?.created_at) || null,
    gmailMessageId,
    gmailUrl:gmailMessageId ? `https://mail.google.com/mail/#all/${gmailMessageId}` : null
  };
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
      version:GMAIL_DISPOSITION_VERSION,
      gmailMovedToTrash:true,
      writesPerformed:0,
      osRecordsCreated:0
    });
  } catch (error) {
    logWorkerError({ requestId, route:DELETE_GMAIL_NO_ACTION_ACTION, stage:"gmail_delete_no_action", error });
    return jsonResponse({ ok:false, requestId, action:DELETE_GMAIL_NO_ACTION_ACTION, error:safeErrorMessage(error) }, 500);
  }
}

async function saveInformation(body, env, requestId) {
  const gmailMessageId = clean(body?.gmailMessageId);
  const clientNameHint = clean(body?.clientName || body?.client);
  if (!gmailMessageId) {
    return jsonResponse({ ok:false, requestId, action:SAVE_GMAIL_INFORMATION_ACTION, error:"gmailMessageId is required." }, 400);
  }

  try {
    const db = requireDb(env);
    const sourceReference = `gmail:${gmailMessageId}`;
    const existing = await db.prepare(`
      SELECT
        c.id AS communication_id,
        i.id AS investigation_id,
        wi.id AS work_item_id,
        c.client_id,
        c.subject
      FROM communications c
      LEFT JOIN investigations i ON i.communication_id = c.id
      LEFT JOIN work_items wi ON wi.communication_id = c.id
      WHERE c.external_id = ?
      ORDER BY wi.id DESC, i.id DESC, c.id DESC
      LIMIT 1
    `).bind(sourceReference).first();

    if (existing?.communication_id && !existing?.investigation_id && !existing?.work_item_id) {
      const live = await loadLiveGmailMessage(gmailMessageId, env);
      await markMessageRead(gmailMessageId, live.accessToken);
      return jsonResponse({
        ok:true,
        requestId,
        action:SAVE_GMAIL_INFORMATION_ACTION,
        version:GMAIL_DISPOSITION_VERSION,
        duplicate:true,
        writesPerformed:0,
        gmailMarkedRead:true,
        communicationId:existing.communication_id,
        investigationId:null,
        workItemId:null
      });
    }

    if (existing?.communication_id) {
      return jsonResponse({
        ok:false,
        requestId,
        action:SAVE_GMAIL_INFORMATION_ACTION,
        error:"This Gmail message is already linked to an Investigation or Work Item. Its stronger existing route was preserved."
      }, 409);
    }

    const { message, accessToken } = await loadLiveGmailMessage(gmailMessageId, env);
    const inferred = inferClientFromMessageContext(message, inferClientFromText);
    const client = await resolveClient(db, inferred, clientNameHint);

    if (!client?.client_code) {
      return jsonResponse({
        ok:false,
        requestId,
        action:SAVE_GMAIL_INFORMATION_ACTION,
        error:"Keep as Information requires a verified client. The email was left unchanged for manual review."
      }, 409);
    }

    const summary = buildInformationSummary(message);
    const decision = {
      source:"Gmail — Information",
      communicationType:"Information / Context",
      title:message.subject || "Informational email",
      operationalSummary:summary,
      businessImpact:"Useful client or business context was preserved for future historical comparison and consulting decisions. No current action is required.",
      importance:"Informational",
      operationalPriority:"Informational",
      recommendedAction:"No action required. Retain this Communication as historical client context.",
      reasoning:"Human operator classified this Gmail message as useful information rather than disposable mail, monitoring, investigation, or requested work.",
      recommendedRoutes:{
        saveCommunication:true,
        createInvestigation:false,
        createWorkItem:false,
        replyRequired:false
      }
    };

    const commitResponse = await handleCommitOperationalDecision({
      action:"commit-operational-decision",
      clientCode:client.client_code,
      externalId:sourceReference,
      occurredAt:message.date,
      direction:"incoming",
      owner:"Andrew",
      rawContent:message.bodyText || message.snippet || message.subject,
      decision
    }, env, `${requestId}-commit`);

    const commit = await commitResponse.json();
    if (!commitResponse.ok || commit?.ok !== true) {
      return jsonResponse({
        ok:false,
        requestId,
        action:SAVE_GMAIL_INFORMATION_ACTION,
        error:typeof commit?.error === "string" ? commit.error : commit?.error?.message || "The informational Communication could not be saved.",
        commit
      }, commitResponse.status || 500);
    }

    if (!commit.duplicate && (!commit.communicationId || commit.investigationId || commit.workItemId)) {
      return jsonResponse({
        ok:false,
        requestId,
        action:SAVE_GMAIL_INFORMATION_ACTION,
        error:"D1 did not confirm exactly one informational Communication with no Investigation and no Work Item. Gmail was left unread.",
        commit
      }, 500);
    }

    await markMessageRead(gmailMessageId, accessToken);

    return jsonResponse({
      ok:true,
      requestId,
      action:SAVE_GMAIL_INFORMATION_ACTION,
      version:GMAIL_DISPOSITION_VERSION,
      duplicate:Boolean(commit.duplicate),
      writesPerformed:commit.duplicate ? 0 : 1,
      gmailMarkedRead:true,
      communicationId:commit.communicationId || null,
      investigationId:null,
      workItemId:null,
      client:{ id:client.id, clientCode:client.client_code, name:client.name }
    });
  } catch (error) {
    logWorkerError({ requestId, route:SAVE_GMAIL_INFORMATION_ACTION, stage:"gmail_information", error });
    return jsonResponse({ ok:false, requestId, action:SAVE_GMAIL_INFORMATION_ACTION, error:safeErrorMessage(error) }, 500);
  }
}

async function resolveClient(db, inferred, clientNameHint) {
  if (inferred?.code || inferred?.name) {
    const match = await db.prepare(`
      SELECT id, client_code, name
      FROM clients
      WHERE client_code = ? COLLATE NOCASE
         OR name = ? COLLATE NOCASE
      LIMIT 1
    `).bind(inferred.code || "", inferred.name || "").first();
    if (match) return match;
  }

  if (clientNameHint && !/unassigned|human review/i.test(clientNameHint)) {
    return db.prepare(`
      SELECT id, client_code, name
      FROM clients
      WHERE name = ? COLLATE NOCASE
         OR client_code = ? COLLATE NOCASE
      LIMIT 1
    `).bind(clientNameHint, clientNameHint).first();
  }

  return null;
}

function buildInformationSummary(message) {
  const subject = clean(message.subject) || "Informational email";
  const body = clean(message.bodyText || message.snippet).replace(/\s+/g, " ");
  const excerpt = body.length > 650 ? `${body.slice(0, 647).trim()}...` : body;
  return excerpt ? `${subject}. ${excerpt}` : `${subject}.`;
}

function normalizeActivityDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10)
    : date.toISOString().slice(0, 10);
}

async function loadLiveGmailMessage(gmailMessageId, env) {
  requireSecrets(env);
  const db = requireDb(env);
  const connection = await db.prepare(`
    SELECT account_email, encrypted_refresh_token
    FROM gmail_connections
    ORDER BY updated_at DESC
    LIMIT 1
  `).first();
  if (!connection?.encrypted_refresh_token) throw new Error("Gmail is not connected.");

  const refreshToken = await decrypt(connection.encrypted_refresh_token, env.GOOGLE_CLIENT_SECRET);
  const accessToken = await refreshAccessToken(refreshToken, env);
  const data = await gmailFetch(`${GMAIL_API}/users/me/messages/${encodeURIComponent(gmailMessageId)}?format=full`, accessToken);
  const headers = data?.payload?.headers || [];
  const header = name => clean(headers.find(item => clean(item.name).toLowerCase() === name.toLowerCase())?.value);
  const bodyText = extractMessageText(data?.payload).slice(0, 12000);

  return {
    accessToken,
    message:{
      gmailMessageId:data.id,
      threadId:data.threadId,
      from:header("From"),
      to:header("To"),
      subject:header("Subject") || "(No subject)",
      date:header("Date"),
      snippet:clean(data.snippet),
      bodyText:bodyText || clean(data.snippet)
    }
  };
}

async function markMessageRead(gmailMessageId, accessToken) {
  const response = await fetch(`${GMAIL_API}/users/me/messages/${encodeURIComponent(gmailMessageId)}/modify`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${accessToken}`, "Content-Type":"application/json" },
    body:JSON.stringify({ removeLabelIds:["UNREAD"] })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Gmail modify failed with HTTP ${response.status}.`);
  return payload;
}

async function markMessageUnread(gmailMessageId, accessToken) {
  const response = await fetch(`${GMAIL_API}/users/me/messages/${encodeURIComponent(gmailMessageId)}/modify`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${accessToken}`, "Content-Type":"application/json" },
    body:JSON.stringify({ addLabelIds:["UNREAD"] })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Gmail modify failed with HTTP ${response.status}.`);
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
      if (mime === "text/plain") plain.push(decoded);
      else if (mime === "text/html") html.push(htmlToText(decoded));
    }
    for (const child of Array.isArray(part.parts) ? part.parts : []) visit(child);
  };
  visit(payload);
  return sanitizeEmailText(plain.length ? plain.join("\n\n") : html.join("\n\n"));
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
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'"));
}

function sanitizeEmailText(value) {
  return clean(String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n"));
}

async function refreshAccessToken(refreshToken, env) {
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
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || "Google token refresh failed.");
  return payload.access_token;
}

async function gmailFetch(url, accessToken) {
  const response = await fetch(url, { headers:{ Authorization:`Bearer ${accessToken}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Gmail API failed with HTTP ${response.status}.`);
  return payload;
}

function requireDb(env) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") throw new Error("The production D1 binding is unavailable.");
  return db;
}

function requireSecrets(env) {
  if (!clean(env?.GOOGLE_CLIENT_ID) || !clean(env?.GOOGLE_CLIENT_SECRET)) throw new Error("Google OAuth secrets are not configured.");
}

async function cryptoKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["decrypt"]);
}

async function decrypt(value, secret) {
  const [iv, data] = String(value || "").split(".");
  if (!iv || !data) throw new Error("Stored Gmail connection token is invalid.");
  const bytes = await crypto.subtle.decrypt(
    { name:"AES-GCM", iv:decodeBase64Url(iv) },
    await cryptoKey(secret),
    decodeBase64Url(data)
  );
  return new TextDecoder().decode(bytes);
}

function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}
