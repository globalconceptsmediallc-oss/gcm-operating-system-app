/* =========================================================
   Global Concepts Media Operating System
   File: routes/operatingSessions.js
   Version: 1.0.0
   Status: OS 2.0 Production Candidate
   Purpose:
   Execute small authenticated Operating Session tasks: list/read,
   create, add evidence, add a working entry, and change status.
   This route contains no AI or source-specific processing engine.
   ========================================================= */

import { getDatabase, rowsOf } from "../shared/database.js";
import { jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";
import { authorizeOsRequest } from "../shared/osAuth.js";
import {
  SESSION_STATUSES,
  prepareCreateSessionTask,
  prepareAddEvidenceTask,
  prepareAddSessionEntryTask
} from "../shared/operatingSessionTasks.js";
import { formatOperatingBrief, validateOperatingBrief } from "../shared/operatingSessionIntakeTasks.js";

export const OPERATING_SESSIONS_VERSION = "1.0.0";
export const OPERATING_SESSION_ACTIONS = Object.freeze({
  LIST: "list-operating-sessions",
  GET: "get-operating-session",
  CREATE: "create-operating-session",
  ADD_EVIDENCE: "add-operating-session-evidence",
  ADD_ENTRY: "add-operating-session-entry",
  UPDATE_STATUS: "update-operating-session-status"
});
export const OPERATING_SESSION_ACTION_LIST = Object.freeze(
  Object.values(OPERATING_SESSION_ACTIONS)
);

const MAX_RAW_CONTENT_LENGTH = 1_000_000;

export async function handleOperatingSessions(body, env, requestId, request) {
  const db = getDatabase(env);
  const action = String(body?.action || "").trim();
  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({ ok:false, requestId, action, error:"The production D1 binding is unavailable." }, 503);
  }

  try {
    const user = await authorizeOsRequest(request, env, db);
    if (action === OPERATING_SESSION_ACTIONS.LIST) return listSessions(body, db, requestId, user);
    if (action === OPERATING_SESSION_ACTIONS.GET) return getSession(body, db, requestId, user);
    if (action === OPERATING_SESSION_ACTIONS.CREATE) return createSession(body, db, requestId, user);
    if (action === OPERATING_SESSION_ACTIONS.ADD_EVIDENCE) return addEvidence(body, db, requestId, user);
    if (action === OPERATING_SESSION_ACTIONS.ADD_ENTRY) return addEntry(body, db, requestId, user);
    if (action === OPERATING_SESSION_ACTIONS.UPDATE_STATUS) return updateStatus(body, db, requestId, user);
    return jsonResponse({ ok:false, requestId, action, error:"Unsupported Operating Session task." }, 400);
  } catch (error) {
    const message = safeErrorMessage(error);
    const unauthorized = /sign in|login token|signed-in account|verified/i.test(message);
    logWorkerError({ requestId, route:action || "operating-sessions", stage:unauthorized ? "authorization" : "operating_session_task", error });
    return jsonResponse({ ok:false, requestId, action, operatingSessionsVersion:OPERATING_SESSIONS_VERSION, error:message }, unauthorized ? 401 : 400);
  }
}

async function listSessions(body, db, requestId, user) {
  const clientId = positiveInteger(body?.clientId ?? body?.client_id);
  const result = clientId
    ? await db.prepare(`${SESSION_SELECT} WHERE os.client_id = ? ORDER BY datetime(os.updated_at) DESC, os.id DESC LIMIT 100`).bind(clientId).all()
    : await db.prepare(`${SESSION_SELECT} ORDER BY CASE os.status WHEN 'working_with_ai' THEN 0 WHEN 'needs_decision' THEN 1 WHEN 'awaiting_verification' THEN 2 ELSE 3 END, datetime(os.updated_at) DESC, os.id DESC LIMIT 100`).all();
  return jsonResponse(baseResponse(requestId, user, { sessions:rowsOf(result).map(mapSession) }));
}

async function getSession(body, db, requestId, user) {
  const session = await requireSession(db, body?.operatingSessionId ?? body?.id);
  const [evidenceResult, entriesResult] = await Promise.all([
    db.prepare(`SELECT * FROM operating_session_evidence WHERE operating_session_id = ? ORDER BY datetime(captured_at) DESC, id DESC`).bind(session.id).all(),
    db.prepare(`SELECT * FROM operating_session_entries WHERE operating_session_id = ? ORDER BY datetime(created_at) ASC, id ASC`).bind(session.id).all()
  ]);
  return jsonResponse(baseResponse(requestId, user, {
    session:mapSession(session),
    evidence:rowsOf(evidenceResult).map(mapEvidence),
    entries:rowsOf(entriesResult).map(mapEntry)
  }));
}

async function createSession(body, db, requestId, user) {
  const task = prepareCreateSessionTask(body?.session || body);
  const client = await db.prepare(`SELECT id, client_code, name FROM clients WHERE id = ? LIMIT 1`).bind(task.clientId).first();
  if (!client) throw new Error("The proven client record was not found.");
  if (task.sourceCommunicationId) {
    const source = await db.prepare(`SELECT id FROM communications WHERE id = ? AND client_id = ? LIMIT 1`).bind(task.sourceCommunicationId, task.clientId).first();
    if (!source) throw new Error("The source email/Communication does not belong to this client.");
  }
  const result = await db.prepare(`
    INSERT INTO operating_sessions (
      client_id,title,issue_summary,business_reason,priority,status,
      source_communication_id,openai_conversation_id,opened_by
    ) VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(
    task.clientId, task.title, task.issueSummary, task.businessReason,
    task.priority, task.status, task.sourceCommunicationId,
    task.openaiConversationId, user.email
  ).run();
  const session = await requireSession(db, result?.meta?.last_row_id);
  await insertEntry(db, {
    operatingSessionId:session.id,
    clientId:session.client_id,
    entryType:"system",
    authorType:"system",
    authorName:"GCM OS",
    content:`Operating Session opened by ${user.email}.`,
    sourceEvidenceId:null
  });
  let writesPerformed=2;
  const intakeSource=body?.intakeSource;
  if(intakeSource?.issue){
    await insertEntry(db,{operatingSessionId:session.id,clientId:session.client_id,entryType:"human_note",authorType:"human",authorName:user.email,content:formatIntakeSource(intakeSource),sourceEvidenceId:null});
    writesPerformed+=1;
  }
  if(body?.intakeBrief){
    const brief=validateOperatingBrief(body.intakeBrief);
    await insertEntry(db,{operatingSessionId:session.id,clientId:session.client_id,entryType:"ai_interpretation",authorType:"ai",authorName:`OpenAI ${String(body?.aiMeta?.model||"").trim()||"operating partner"}`,content:formatOperatingBrief(brief),sourceEvidenceId:null});
    writesPerformed+=1;
  }
  return jsonResponse(baseResponse(requestId, user, { session:mapSession(session), writesPerformed }), 201);
}

async function addEvidence(body, db, requestId, user) {
  const session = await requireSession(db, body?.operatingSessionId ?? body?.operating_session_id);
  const rawContent = String(body?.rawContent ?? body?.raw_content ?? "");
  if (rawContent.length > MAX_RAW_CONTENT_LENGTH) {
    throw new Error("Evidence exceeds the 1 MB Phase 1 storage limit.");
  }
  const task = prepareAddEvidenceTask({ ...body, rawContent }, session);
  const sha = task.contentSha256 || await sha256([task.sourceLocator, task.rawContent].filter(Boolean).join("\n"));
  const result = await db.prepare(`
    INSERT INTO operating_session_evidence (
      operating_session_id,client_id,evidence_type,source_label,source_locator,
      raw_content,source_facts_json,ai_interpretation,human_verification_note,
      verification_status,content_sha256,captured_by,captured_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP))
  `).bind(
    task.operatingSessionId,task.clientId,task.evidenceType,task.sourceLabel,
    task.sourceLocator,task.rawContent,JSON.stringify(task.sourceFacts),
    task.aiInterpretation,task.humanVerificationNote,task.verificationStatus,
    sha,user.email,task.capturedAt
  ).run();
  await touchSession(db, session.id);
  const evidence = await db.prepare(`SELECT * FROM operating_session_evidence WHERE id = ?`).bind(result?.meta?.last_row_id).first();
  return jsonResponse(baseResponse(requestId, user, { evidence:mapEvidence(evidence), writesPerformed:1 }), 201);
}

async function addEntry(body, db, requestId, user) {
  const session = await requireSession(db, body?.operatingSessionId ?? body?.operating_session_id);
  const requestedAuthorType = String(body?.authorType ?? body?.author_type ?? "human").toLowerCase();
  if (requestedAuthorType !== "human") throw new Error("Only a human entry may be added directly in Phase 1.");
  const task = prepareAddSessionEntryTask({ ...body, authorType:"human", authorName:user.email }, session);
  if (task.sourceEvidenceId) {
    const evidence = await db.prepare(`SELECT id FROM operating_session_evidence WHERE id = ? AND operating_session_id = ? AND client_id = ?`).bind(task.sourceEvidenceId,session.id,session.client_id).first();
    if (!evidence) throw new Error("The referenced evidence does not belong to this Operating Session.");
  }
  const id = await insertEntry(db, task);
  await touchSession(db, session.id);
  const entry = await db.prepare(`SELECT * FROM operating_session_entries WHERE id = ?`).bind(id).first();
  return jsonResponse(baseResponse(requestId, user, { entry:mapEntry(entry), writesPerformed:1 }), 201);
}

async function updateStatus(body, db, requestId, user) {
  const session = await requireSession(db, body?.operatingSessionId ?? body?.operating_session_id);
  const status = String(body?.status || "").trim().toLowerCase();
  if (!SESSION_STATUSES.includes(status)) throw new Error(`Unsupported session status: ${status || "missing"}`);
  const timestampColumn = {
    verified:"verified_at",
    proof_recorded:"proof_recorded_at",
    closed:"closed_at"
  }[status];
  const sql = timestampColumn
    ? `UPDATE operating_sessions SET status = ?, ${timestampColumn} = COALESCE(${timestampColumn},CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    : `UPDATE operating_sessions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  await db.prepare(sql).bind(status,session.id).run();
  await insertEntry(db, {
    operatingSessionId:session.id,clientId:session.client_id,entryType:"system",
    authorType:"system",authorName:"GCM OS",content:`Status changed from ${session.status} to ${status} by ${user.email}.`,sourceEvidenceId:null
  });
  const updated = await requireSession(db, session.id);
  return jsonResponse(baseResponse(requestId, user, { session:mapSession(updated), writesPerformed:2 }));
}

const SESSION_SELECT = `SELECT os.*, c.client_code, c.name AS client_name FROM operating_sessions os INNER JOIN clients c ON c.id = os.client_id`;

async function requireSession(db, value) {
  const id = positiveInteger(value);
  if (!id) throw new Error("A valid Operating Session ID is required.");
  const session = await db.prepare(`${SESSION_SELECT} WHERE os.id = ? LIMIT 1`).bind(id).first();
  if (!session) throw new Error(`Operating Session #${id} was not found.`);
  return session;
}

async function insertEntry(db, task) {
  const result = await db.prepare(`INSERT INTO operating_session_entries (operating_session_id,client_id,entry_type,author_type,author_name,content,source_evidence_id) VALUES (?,?,?,?,?,?,?)`).bind(task.operatingSessionId,task.clientId,task.entryType,task.authorType,task.authorName,task.content,task.sourceEvidenceId).run();
  return Number(result?.meta?.last_row_id) || null;
}

function touchSession(db, id) {
  return db.prepare(`UPDATE operating_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
}

function baseResponse(requestId, user, extra) {
  return { ok:true, requestId, action:"operating-sessions", operatingSessionsVersion:OPERATING_SESSIONS_VERSION, user:{ email:user.email }, ...extra };
}

function mapSession(row) {
  return { id:Number(row.id),clientId:Number(row.client_id),clientCode:row.client_code||null,clientName:row.client_name||null,title:row.title,issueSummary:row.issue_summary,businessReason:row.business_reason||null,priority:row.priority,status:row.status,sourceCommunicationId:nullableNumber(row.source_communication_id),openaiConversationId:row.openai_conversation_id||null,openedBy:row.opened_by,openedAt:row.opened_at,verifiedAt:row.verified_at||null,proofRecordedAt:row.proof_recorded_at||null,closedAt:row.closed_at||null,createdAt:row.created_at,updatedAt:row.updated_at };
}
function mapEvidence(row) {
  return { id:Number(row.id),operatingSessionId:Number(row.operating_session_id),clientId:Number(row.client_id),evidenceType:row.evidence_type,sourceLabel:row.source_label,sourceLocator:row.source_locator||null,rawContent:row.raw_content||null,sourceFacts:parseFacts(row.source_facts_json),aiInterpretation:row.ai_interpretation||null,humanVerificationNote:row.human_verification_note||null,verificationStatus:row.verification_status,contentSha256:row.content_sha256||null,capturedBy:row.captured_by,capturedAt:row.captured_at,createdAt:row.created_at };
}
function mapEntry(row) {
  return { id:Number(row.id),operatingSessionId:Number(row.operating_session_id),clientId:Number(row.client_id),entryType:row.entry_type,authorType:row.author_type,authorName:row.author_name||null,content:row.content,sourceEvidenceId:nullableNumber(row.source_evidence_id),createdAt:row.created_at };
}
function parseFacts(value) { try { const data=JSON.parse(value||"[]"); return Array.isArray(data)?data:[]; } catch { return []; } }
function positiveInteger(value) { const number=Number(value); return Number.isInteger(number)&&number>0?number:null; }
function nullableNumber(value) { const number=Number(value); return Number.isFinite(number)&&number>0?number:null; }
async function sha256(value) { const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value||""))); return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,"0")).join(""); }

function formatIntakeSource(value){
  const issue=String(value?.issue||"").trim();
  const support=String(value?.supportingEvidence||"").trim();
  return [`Original issue provided by the operator:\n${issue}`,support?`Original supporting material:\n${support}`:null].filter(Boolean).join("\n\n");
}
