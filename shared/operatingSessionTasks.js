/* =========================================================
   Global Concepts Media Operating System
   File: shared/operatingSessionTasks.js
   Version: 1.0.0
   Status: OS 2.0 Production Candidate
   Purpose: Validate small Operating Session write tasks before D1 writes.
   ========================================================= */

export const SESSION_STATUSES = Object.freeze(["detected","needs_decision","working_with_ai","awaiting_verification","verified","proof_recorded","closed"]);
export const SESSION_PRIORITIES = Object.freeze(["critical","high","normal","low"]);
export const EVIDENCE_TYPES = Object.freeze(["email","link","written","file","screenshot","test_result","verification"]);
export const VERIFICATION_STATUSES = Object.freeze(["unverified","verified","limited","rejected"]);
export const ENTRY_TYPES = Object.freeze(["human_note","ai_interpretation","decision","action","result","verification","system"]);
export const AUTHOR_TYPES = Object.freeze(["human","ai","system"]);

export function prepareCreateSessionTask(input = {}) {
  return {
    clientId: requiredId(input.clientId ?? input.client_id, "A proven clientId is required."),
    title: requiredText(input.title, "A session title is required.", 240),
    issueSummary: requiredText(input.issueSummary ?? input.issue_summary, "An issue summary is required.", 5000),
    businessReason: optionalText(input.businessReason ?? input.business_reason, 5000),
    priority: choice(input.priority || "normal", SESSION_PRIORITIES, "priority"),
    status: choice(input.status || "detected", SESSION_STATUSES, "session status"),
    sourceCommunicationId: optionalId(input.sourceCommunicationId ?? input.source_communication_id),
    openaiConversationId: optionalText(input.openaiConversationId ?? input.openai_conversation_id, 300)
  };
}

export function prepareAddEvidenceTask(input = {}, session = {}) {
  const operatingSessionId = requiredId(input.operatingSessionId ?? input.operating_session_id, "A valid Operating Session ID is required.");
  const clientId = requiredId(input.clientId ?? input.client_id, "A proven clientId is required.");
  assertSessionIdentity(operatingSessionId, clientId, session);
  return {
    operatingSessionId,
    clientId,
    evidenceType: choice(input.evidenceType ?? input.evidence_type, EVIDENCE_TYPES, "evidence type"),
    sourceLabel: requiredText(input.sourceLabel ?? input.source_label, "An evidence source label is required.", 300),
    sourceLocator: optionalText(input.sourceLocator ?? input.source_locator, 2000),
    rawContent: optionalText(input.rawContent ?? input.raw_content, 1_000_000),
    sourceFacts: normalizeFacts(input.sourceFacts ?? input.source_facts),
    aiInterpretation: optionalText(input.aiInterpretation ?? input.ai_interpretation, 10000),
    humanVerificationNote: optionalText(input.humanVerificationNote ?? input.human_verification_note, 10000),
    verificationStatus: choice(input.verificationStatus ?? input.verification_status ?? "unverified", VERIFICATION_STATUSES, "verification status"),
    contentSha256: optionalText(input.contentSha256 ?? input.content_sha256, 128),
    capturedAt: optionalText(input.capturedAt ?? input.captured_at, 80)
  };
}

export function prepareAddSessionEntryTask(input = {}, session = {}) {
  const operatingSessionId = requiredId(input.operatingSessionId ?? input.operating_session_id, "A valid Operating Session ID is required.");
  const clientId = requiredId(input.clientId ?? input.client_id, "A proven clientId is required.");
  assertSessionIdentity(operatingSessionId, clientId, session);
  return {
    operatingSessionId,
    clientId,
    entryType: choice(input.entryType ?? input.entry_type ?? "human_note", ENTRY_TYPES, "entry type"),
    authorType: choice(input.authorType ?? input.author_type ?? "human", AUTHOR_TYPES, "author type"),
    authorName: optionalText(input.authorName ?? input.author_name, 300),
    content: requiredText(input.content, "Work-log content is required.", 20000),
    sourceEvidenceId: optionalId(input.sourceEvidenceId ?? input.source_evidence_id)
  };
}

function assertSessionIdentity(operatingSessionId, clientId, session) {
  const sessionId = requiredId(session.id ?? session.operatingSessionId, "The authoritative Operating Session is required.");
  const sessionClientId = requiredId(session.clientId ?? session.client_id, "The authoritative session client is required.");
  if (operatingSessionId !== sessionId) throw new Error("The evidence or entry does not match the selected Operating Session.");
  if (clientId !== sessionClientId) throw new Error("The evidence or entry client does not match the Operating Session client.");
}

function requiredId(value, message) { const id=Number(value); if (!Number.isInteger(id)||id<1) throw new Error(message); return id; }
function optionalId(value) { if (value===null||value===undefined||value==="") return null; return requiredId(value,"A referenced record ID must be a positive integer."); }
function requiredText(value, message, max) { const text=String(value??"").trim(); if(!text) throw new Error(message); if(text.length>max) throw new Error(`${message.replace(/\.$/,"")} Maximum length is ${max} characters.`); return text; }
function optionalText(value, max) { if(value===null||value===undefined||value==="") return null; const text=String(value).trim(); if(text.length>max) throw new Error(`Text exceeds the ${max}-character limit.`); return text||null; }
function choice(value, allowed, label) { const normalized=String(value??"").trim().toLowerCase(); if(!allowed.includes(normalized)) throw new Error(`Unsupported ${label}: ${normalized||"missing"}`); return normalized; }
function normalizeFacts(value) {
  let facts=value;
  if(typeof facts==="string") { try { const parsed=JSON.parse(facts); facts=Array.isArray(parsed)?parsed:facts.split(/\n+/); } catch { facts=facts.split(/\n+/); } }
  if(!Array.isArray(facts)) return [];
  const seen=new Set(); const result=[];
  for(const item of facts){const text=String(item??"").trim(); const key=text.toLowerCase(); if(!text||seen.has(key)) continue; seen.add(key); result.push(text.slice(0,2000)); if(result.length===100) break;}
  return result;
}
