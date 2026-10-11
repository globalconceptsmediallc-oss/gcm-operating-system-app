/* =========================================================
   Global Concepts Media Operating System
   File: routes/growthReviewInterpretation.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Purpose: Save and explicitly approve evidence-bound interpretations
            of human-included Growth Review issues.
   Guardrails: No operational writes, no AI generation, no report unlock.
   ========================================================= */
import { getDatabase, rowsOf } from "../shared/database.js";
import { clean, jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";

export const GROWTH_REVIEW_INTERPRETATION_ACTION = "growth-review-interpretation";
export const GROWTH_REVIEW_INTERPRETATION_VERSION = "1.0.0";

const CLOSED_INVESTIGATION = new Set(["resolved","closed","complete","completed","cancelled","canceled","archived","ignored","no_action"]);
const CLOSED_WORK = new Set(["completed","complete","closed","resolved","cancelled","canceled"]);
const FIELDS = ["verifiedFacts","evidenceReferences","growthImplications","recommendedAction","clientNarrative","caveats"];
const DB_COLUMNS = ["verified_facts","evidence_references","growth_implications","recommended_action","client_narrative","caveats"];

function isoDate(value) {
  const s = clean(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2]-1 && d.getUTCDate() === +m[3] ? s : "";
}
function invalid(requestId, message, status=400) {
  return jsonResponse({ok:false,requestId,action:GROWTH_REVIEW_INTERPRETATION_ACTION,growthReviewInterpretationVersion:GROWTH_REVIEW_INTERPRETATION_VERSION,error:message,writesPerformed:0},status);
}
function normalizeText(value) { return value == null ? "" : String(value).replace(/\r\n/g,"\n").trim(); }
function norm(value) { return clean(value).toLowerCase().replace(/[-\s]+/g,"_"); }
function goodId(value) { return Number.isSafeInteger(Number(value)) && Number(value)>0 ? Number(value) : 0; }
function isOpen(type,status) { return !(type==="investigation" ? CLOSED_INVESTIGATION : CLOSED_WORK).has(norm(status)); }
function pickFields(body) {
  const value=body?.interpretation||{};
  const result={};
  for(let i=0;i<FIELDS.length;i++) {
    const content=normalizeText(value[FIELDS[i]]);
    if(content.length>10000) return null;
    result[FIELDS[i]]=content;
  }
  return result;
}
function dbFields(row) {
  if(!row || row.interp_id==null) return null;
  const fields={};
  FIELDS.forEach((k,i)=>fields[k]=normalizeText(row[DB_COLUMNS[i]]));
  return {
    id:Number(row.interp_id),
    reviewStatus:clean(row.review_status),
    savedBy:clean(row.saved_by),
    approvedBy:clean(row.approved_by)||null,
    approvedAt:clean(row.approved_at)||null,
    updatedAt:clean(row.interp_updated_at),
    draftSourceSnapshot:clean(row.draft_source_snapshot),
    ...fields
  };
}
const LIST_SQL = [
  "SELECT s.id AS selection_id,s.client_id,s.period_start,s.period_end,",
  "s.record_type,s.record_id,s.selection,s.decided_at,",
  "c.client_code,c.name AS client_name,",
  "i.id AS interp_id,i.verified_facts,i.evidence_references,",
  "i.growth_implications,i.recommended_action,i.client_narrative,i.caveats,",
  "i.draft_source_snapshot,i.approval_source_snapshot,i.review_status,",
  "i.saved_by,i.approved_by,i.approved_at,i.updated_at AS interp_updated_at",
  "FROM growth_review_issue_selections s",
  "JOIN clients c ON c.id=s.client_id",
  "LEFT JOIN growth_review_interpretations i ON i.selection_id=s.id",
  "WHERE c.client_code=? COLLATE NOCASE AND s.period_start=? AND s.period_end=?",
  "AND s.selection='include' ORDER BY s.record_type,s.record_id"
].join(" ");
async function sourceFor(db,row) {
  const table=row.record_type==="investigation" ? "investigations" : "work_items";
  if(row.record_type!=="investigation" && row.record_type!=="work_item") return {record:null,signature:""};
  const record=await db.prepare("SELECT id,client_id,title,status,updated_at FROM "+table+" WHERE id=? AND client_id=? LIMIT 1")
    .bind(row.record_id,row.client_id).first();
  if(!record) return {record:null,signature:""};
  let progress=null;
  if(row.record_type==="investigation") {
    progress=await db.prepare("SELECT id,captured_at,raw_data FROM evidence WHERE investigation_id=? AND client_id=? AND evidence_type='investigation_progress' ORDER BY captured_at DESC,id DESC LIMIT 1")
      .bind(row.record_id,row.client_id).first();
  }
  let progressSummary="";
  if(progress) {
    try {
      const p=JSON.parse(progress.raw_data||"{}");
      progressSummary=clean(p.findingSummary||p.finding_summary||"");
    }catch(error) { progressSummary=""; }
  }
  const source={
    type:row.record_type,id:Number(record.id),title:clean(record.title),
    status:clean(record.status),updatedAt:clean(record.updated_at),
    latestProgressId:progress?Number(progress.id):null,
    latestProgressAt:progress?clean(progress.captured_at):null,
    latestProgressSummary:progressSummary
  };
  const raw=JSON.stringify({clientId:row.client_id,source:source,latestProgressRaw:progress?String(progress.raw_data||""):""});
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw));
  const signature=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
  return {record:source,signature};
}
async function enrich(db,row) {
  const {record,signature}=await sourceFor(db,row);
  const interpretation=dbFields(row);
  const sourceChanged=Boolean(interpretation && interpretation.draftSourceSnapshot && interpretation.draftSourceSnapshot!==signature);
  const approved=Boolean(interpretation && interpretation.reviewStatus==="approved"
    && clean(row.approval_source_snapshot)===signature && !sourceChanged);
  const currentOpen=Boolean(record && isOpen(row.record_type,record.status));
  return {
    selectionId:Number(row.selection_id),
    clientCode:clean(row.client_code),
    periodStart:clean(row.period_start),periodEnd:clean(row.period_end),
    recordType:clean(row.record_type),recordId:Number(row.record_id),
    selectedAt:clean(row.decided_at),
    operationalRecord:record,
    sourceSnapshot:signature,
    sourceChanged,
    eligibleForReview:currentOpen,
    effectiveStatus:!currentOpen||sourceChanged||interpretation?.reviewStatus==="needs_review"?"needs_review":approved?"approved":"draft",
    interpretation
  };
}
export async function handleGrowthReviewInterpretation(body,env,requestId) {
  const db=getDatabase(env);
  if(!db||typeof db.prepare!=="function") return invalid(requestId,"Production D1 binding unavailable.",503);
  const operation=clean(body?.operation||"list").toLowerCase();
  const clientCode=clean(body?.clientCode||"");
  const start=isoDate(body?.periodStart),end=isoDate(body?.periodEnd);
  if(!clientCode||!start||!end||end<start) return invalid(requestId,"An exact clientCode, periodStart and periodEnd are required.");
  if(!["list","save","approve"].includes(operation)) return invalid(requestId,"Supported operations are list, save and approve.");
  try {
    const result=await db.prepare(LIST_SQL).bind(clientCode,start,end).all();
    const selected=rowsOf(result);
    if(operation==="list") {
      const items=[];
      for(const row of selected) items.push(await enrich(db,row));
      return jsonResponse({ok:true,requestId,action:GROWTH_REVIEW_INTERPRETATION_ACTION,operation,
        growthReviewInterpretationVersion:GROWTH_REVIEW_INTERPRETATION_VERSION,
        clientCode,periodStart:start,periodEnd:end,items,generatorLocked:true,writesPerformed:0});
    }
    const selectionId=goodId(body?.selectionId);
    const row=selected.find(x=>Number(x.selection_id)===selectionId);
    if(!row) return invalid(requestId,"This included selection is missing, excluded or outside this client and period.",404);
    const current=await enrich(db,row);
    if(!current.eligibleForReview) return invalid(requestId,"The source operational record is missing or closed. Reconcile it before reviewing.",409);
    const expected=clean(body?.expectedSourceSnapshot);
    if(!expected||expected!==current.sourceSnapshot) return invalid(requestId,"Source evidence changed. Refresh before saving or approving.",409);
    if(operation==="save") {
      const fields=pickFields(body);
      if(!fields) return invalid(requestId,"Each interpretation field must be 10,000 characters or fewer.");
      await db.prepare([
        "INSERT INTO growth_review_interpretations (selection_id,verified_facts,evidence_references,",
        "growth_implications,recommended_action,client_narrative,caveats,draft_source_snapshot,",
        "review_status,saved_by,updated_at) VALUES (?,?,?,?,?,?,?,?, 'draft',?,CURRENT_TIMESTAMP)",
        "ON CONFLICT(selection_id) DO UPDATE SET verified_facts=excluded.verified_facts,",
        "evidence_references=excluded.evidence_references,growth_implications=excluded.growth_implications,",
        "recommended_action=excluded.recommended_action,client_narrative=excluded.client_narrative,",
        "caveats=excluded.caveats,draft_source_snapshot=excluded.draft_source_snapshot,",
        "review_status='draft',saved_by=excluded.saved_by,approved_by=NULL,approved_at=NULL,",
        "approval_source_snapshot=NULL,updated_at=CURRENT_TIMESTAMP"
      ].join(" ")).bind(selectionId,...FIELDS.map(x=>fields[x]),current.sourceSnapshot,clean(body?.reviewedBy||"Andy")||"Andy").run();
      return jsonResponse({ok:true,requestId,action:GROWTH_REVIEW_INTERPRETATION_ACTION,operation,
        growthReviewInterpretationVersion:GROWTH_REVIEW_INTERPRETATION_VERSION,
        selectionId,reviewStatus:"draft",generatorLocked:true,writesPerformed:1});
    }
    if(!row.interp_id) return invalid(requestId,"Save an interpretation draft before approving.",409);
    if(row.review_status!=="draft" && row.review_status!=="needs_review") return invalid(requestId,"Reopen the interpretation as a draft before approving.",409);
    if(clean(row.draft_source_snapshot)!==current.sourceSnapshot) return invalid(requestId,"The saved draft is stale. Refresh and save it again.",409);
    const missing=DB_COLUMNS.slice(0,5).filter(k=>!normalizeText(row[k]));
    if(missing.length) return invalid(requestId,"Complete facts, evidence, implications, action and narrative before approval.",409);
    const saved=await db.prepare([
      "UPDATE growth_review_interpretations SET review_status='approved',",
      "approval_source_snapshot=?,approved_by=?,approved_at=CURRENT_TIMESTAMP,",
      "updated_at=CURRENT_TIMESTAMP WHERE id=? AND draft_source_snapshot=? AND review_status IN ('draft','needs_review')"
    ].join(" ")).bind(current.sourceSnapshot,clean(body?.reviewedBy||"Andy")||"Andy",row.interp_id,current.sourceSnapshot).run();
    if(!Number(saved?.meta?.changes)) return invalid(requestId,"Interpretation approval was not saved. Refresh and retry.",409);
    return jsonResponse({ok:true,requestId,action:GROWTH_REVIEW_INTERPRETATION_ACTION,operation,
      growthReviewInterpretationVersion:GROWTH_REVIEW_INTERPRETATION_VERSION,
      selectionId,reviewStatus:"approved",generatorLocked:true,writesPerformed:1});
  }catch(error) {
    logWorkerError({requestId,route:GROWTH_REVIEW_INTERPRETATION_ACTION,stage:"growth_review_interpretation",error});
    return jsonResponse({ok:false,requestId,action:GROWTH_REVIEW_INTERPRETATION_ACTION,
      growthReviewInterpretationVersion:GROWTH_REVIEW_INTERPRETATION_VERSION,
      error:"Growth Review Interpretation could not complete the request.",
      details:safeErrorMessage(error),writesPerformed:0},500);
  }
}
