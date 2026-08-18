/* =========================================================
   Global Concepts Media Operating System
   File: routes/workItemProcessing.js
   Version: 7.5.1
   Status: Production Road-Test Candidate
   Source: Production routes/workItemProcessing.js 7.5.0
   Sprint: Work Item Responsibility Disposition
   Purpose: Preserve verified Work Item creation/completion behavior while
            adding a non-proof closure path when responsibility has been
            reassigned outside GCM.

   Changes in 7.5.1:
   - Fixes both Evidence INSERT statements so 9 named columns receive 9 values.
   - Repairs reassigned Work Item closure that previously failed with
     "10 values for 9 columns" from D1.
   - Repairs the same placeholder mismatch in normal Work Item completion.
   - Preserves all existing Work Item, Investigation, Evidence, and proof rules.

   Changes in 7.5.0:
   - Extends the existing process-work-item action; no new route or schema.
   - Adds disposition=reassigned for Work Items no longer owned by GCM.
   - Preserves the Work Item and linked Investigation as closed history.
   - Does not set completed_at and does not create completion proof.
   - Records a work_disposition Evidence entry with the responsibility note.
   - Returns proofOfWorkEligible=false for reassigned closures.

   Changes in 7.4.1:
   - Establishes America/New_York as the business date authority for this route.
   - Replaces D1 CURRENT_TIMESTAMP writes with one request-scoped Eastern
     business timestamp generated with Intl.DateTimeFormat.
   - Applies the same timestamp consistently to Work Item creation/completion,
     completion evidence, and linked Investigation closure.
   - Preserves all verified creation, completion, evidence, and D1 behavior.
   ========================================================= */

import { VERSION, ACTIONS } from "../shared/config.js";
import { clean, safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase } from "../shared/database.js";

export const CREATE_REQUESTED_WORK_ACTION = "create-requested-work";
const GCM_BUSINESS_TIME_ZONE = "America/New_York";

export async function handleCreateRequestedWork(body, env, requestId) {
  const db = getDatabase(env);
  const clientCode = clean(body?.clientCode || body?.client);
  const requestedBy = clean(body?.requestedBy || body?.requested_by);
  const title = clean(body?.title);
  const description = clean(body?.description);
  const expectedImpact = clean(body?.expectedImpact || body?.expected_impact);
  const priority = clean(body?.priority) || "Normal";
  const owner = clean(body?.owner) || "Andy";
  const category = clean(body?.category) || "Client Requested Work";
  const communicationId = positiveInt(body?.communicationId || body?.communication_id);

  if (!db || typeof db.prepare !== "function") return jsonResponse({ok:false,requestId,action:CREATE_REQUESTED_WORK_ACTION,error:"The production D1 database binding is unavailable."},503);
  if (!clientCode || !title || !description || !expectedImpact) return jsonResponse({ok:false,requestId,action:CREATE_REQUESTED_WORK_ACTION,error:"clientCode, title, description, and expectedImpact are required."},400);

  try {
    const client = await db.prepare(`SELECT id, client_code, name FROM clients WHERE client_code = ? COLLATE NOCASE LIMIT 1`).bind(clientCode).first();
    if (!client) return jsonResponse({ok:false,requestId,action:CREATE_REQUESTED_WORK_ACTION,error:`Client "${clientCode}" was not found.`},404);

    if (communicationId) {
      const communication = await db.prepare(`SELECT id FROM communications WHERE id = ? AND client_id = ? LIMIT 1`).bind(communicationId,client.id).first();
      if (!communication) return jsonResponse({ok:false,requestId,action:CREATE_REQUESTED_WORK_ACTION,error:`Communication #${communicationId} was not found for client "${client.client_code}".`},400);
    }

    const storedDescription = requestedBy ? `${description}\n\nRequested By: ${requestedBy}` : description;
    const businessTimestamp = gcmBusinessTimestamp();
    const inserted = await db.prepare(`
      INSERT INTO work_items (
        client_id, investigation_id, communication_id, title, description,
        category, priority, status, owner, expected_impact,
        started_at, created_at, updated_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?, ?)
      RETURNING id
    `).bind(
      client.id,
      communicationId||null,
      title,
      storedDescription,
      category,
      priority,
      owner,
      expectedImpact,
      businessTimestamp,
      businessTimestamp,
      businessTimestamp
    ).first();

    const workItemId=Number(inserted?.id||0);
    if(!workItemId) throw new Error("D1 created the requested Work Item but did not return its ID.");
    const workItem=await loadWorkItem(db,workItemId);
    if(!workItem) throw new Error(`D1 created Work Item #${workItemId} but it could not be reloaded.`);
    return jsonResponse({ok:true,requestId,action:CREATE_REQUESTED_WORK_ACTION,version:VERSION,source:"D1",created:true,workItemId,workItem:mapWorkItem(workItem)});
  } catch(error) {
    logWorkerError({requestId,route:CREATE_REQUESTED_WORK_ACTION,stage:"d1_requested_work_creation",error});
    return jsonResponse({ok:false,requestId,action:CREATE_REQUESTED_WORK_ACTION,error:safeErrorMessage(error)},500);
  }
}

export async function handleProcessWorkItem(body, env, requestId) {
  const db=getDatabase(env);
  const clientCode=clean(body?.clientCode||body?.client);
  const workItemId=Number(body?.workItemId||body?.work_item_id);
  const disposition=normalizeDisposition(body?.disposition||body?.workDisposition||body?.work_disposition);
  const dispositionNote=clean(body?.dispositionNote||body?.disposition_note||body?.responsibilityNote||body?.responsibility_note);
  const isReassignment=disposition==="reassigned";
  const workPerformed=clean(body?.workPerformed||body?.work_performed);
  const actualImpact=clean(body?.actualImpact||body?.actual_impact||body?.result);
  const evidenceDescription=clean(body?.evidenceDescription||body?.evidence_description||body?.evidence);
  const evidenceSource=clean(body?.evidenceSource||body?.evidence_source||"Completion Evidence");
  const evidenceType=clean(body?.evidenceType||body?.evidence_type||"completion");
  const evidenceUrl=clean(body?.evidenceUrl||body?.evidence_url);

  if(!db||typeof db.prepare!=="function") return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:"The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."},503);
  if(!clientCode) return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:"A clientCode is required."},400);
  if(!Number.isInteger(workItemId)||workItemId<=0) return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:"A valid workItemId is required."},400);
  if(isReassignment&&!dispositionNote) return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:"A responsibility/disposition note is required before a Work Item can be closed as reassigned."},400);
  if(!isReassignment&&!workPerformed) return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:"A workPerformed value is required before a Work Item can be completed."},400);
  if(!isReassignment&&!actualImpact) return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:"An actualImpact/result value is required before a Work Item can be completed."},400);
  if(!isReassignment&&!evidenceDescription) return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:"Completion evidence is required before a Work Item can be completed."},400);

  try {
    const workItem=await db.prepare(`SELECT wi.id,wi.client_id,wi.investigation_id,wi.communication_id,wi.title,wi.description,wi.category,wi.priority,wi.status,wi.owner,wi.expected_impact,wi.actual_impact,wi.started_at,wi.completed_at,wi.created_at,wi.updated_at,c.client_code,c.name AS client_name FROM work_items wi JOIN clients c ON c.id=wi.client_id WHERE wi.id=? AND c.client_code=? COLLATE NOCASE LIMIT 1`).bind(workItemId,clientCode).first();
    if(!workItem) return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:`Work Item #${workItemId} was not found for client "${clientCode}".`},404);

    if(isReassignment){
      if(isTerminalWorkItemStatus(workItem.status)){
        const existingEvidence=await loadWorkItemEvidence(db,workItem.id);
        return jsonResponse({
          ok:true,
          requestId,
          action:ACTIONS.PROCESS_WORK_ITEM,
          version:VERSION,
          source:"D1",
          updated:false,
          alreadyClosed:true,
          outcome:"reassigned",
          proofOfWorkEligible:false,
          workItem:mapWorkItem(workItem),
          evidence:existingEvidence.map(mapEvidence),
          message:`Work Item #${workItem.id} is already closed. No duplicate responsibility disposition was recorded.`
        });
      }

      const businessTimestamp=gcmBusinessTimestamp();
      const dispositionDescription=appendDisposition(workItem.description,dispositionNote);
      const dispositionImpact="Reassigned / No Longer GCM Responsibility. No completion claim was recorded.";
      const dispositionSource="Responsibility Transition";
      const dispositionEvidenceType="work_disposition";
      const statements=[
        db.prepare(`UPDATE work_items SET description=?,status='closed',actual_impact=?,updated_at=? WHERE id=? AND client_id=?`).bind(dispositionDescription,dispositionImpact,businessTimestamp,workItem.id,workItem.client_id),
        db.prepare(`INSERT INTO evidence (client_id,investigation_id,work_item_id,communication_id,evidence_type,source,description,url,captured_at) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM evidence WHERE work_item_id=? AND evidence_type=? AND source=? AND description=?)`).bind(workItem.client_id,workItem.investigation_id,workItem.id,workItem.communication_id,dispositionEvidenceType,dispositionSource,dispositionNote,null,businessTimestamp,workItem.id,dispositionEvidenceType,dispositionSource,dispositionNote)
      ];
      if(workItem.investigation_id) statements.push(db.prepare(`UPDATE investigations SET status='closed',resolved_at=COALESCE(resolved_at,?),closed_at=?,updated_at=? WHERE id=? AND client_id=?`).bind(businessTimestamp,businessTimestamp,businessTimestamp,workItem.investigation_id,workItem.client_id));

      await db.batch(statements);
      const [updatedWorkItem,updatedInvestigation,evidence]=await Promise.all([loadWorkItem(db,workItem.id),workItem.investigation_id?loadInvestigation(db,workItem.investigation_id):Promise.resolve(null),loadWorkItemEvidence(db,workItem.id)]);
      if(!updatedWorkItem) throw new Error(`D1 closed the reassigned Work Item but Work Item #${workItem.id} could not be reloaded.`);
      return jsonResponse({
        ok:true,
        requestId,
        action:ACTIONS.PROCESS_WORK_ITEM,
        version:VERSION,
        source:"D1",
        updated:true,
        outcome:"reassigned",
        disposition:"reassigned",
        proofOfWorkEligible:false,
        workItem:mapWorkItem(updatedWorkItem),
        investigation:updatedInvestigation?mapInvestigation(updatedInvestigation):null,
        evidence:evidence.map(mapEvidence)
      });
    }

    if(isCompletedStatus(workItem.status)&&workItem.completed_at){const existingEvidence=await loadWorkItemEvidence(db,workItem.id);return jsonResponse({ok:true,requestId,action:ACTIONS.PROCESS_WORK_ITEM,version:VERSION,source:"D1",updated:false,alreadyCompleted:true,workItem:mapWorkItem(workItem),evidence:existingEvidence.map(mapEvidence),message:`Work Item #${workItem.id} is already completed. No duplicate completion was recorded.`});}

    const completedDescription=appendWorkPerformed(workItem.description,workPerformed);
    const businessTimestamp = gcmBusinessTimestamp();
    const statements=[
      db.prepare(`UPDATE work_items SET description=?,status='completed',actual_impact=?,started_at=COALESCE(started_at,?),completed_at=?,updated_at=? WHERE id=? AND client_id=?`).bind(completedDescription,actualImpact,businessTimestamp,businessTimestamp,businessTimestamp,workItem.id,workItem.client_id),
      db.prepare(`INSERT INTO evidence (client_id,investigation_id,work_item_id,communication_id,evidence_type,source,description,url,captured_at) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM evidence WHERE work_item_id=? AND source=? AND description=?)`).bind(workItem.client_id,workItem.investigation_id,workItem.id,workItem.communication_id,evidenceType,evidenceSource,evidenceDescription,evidenceUrl||null,businessTimestamp,workItem.id,evidenceSource,evidenceDescription)
    ];
    if(workItem.investigation_id) statements.push(db.prepare(`UPDATE investigations SET status='closed',resolved_at=COALESCE(resolved_at,?),closed_at=?,updated_at=? WHERE id=? AND client_id=?`).bind(businessTimestamp,businessTimestamp,businessTimestamp,workItem.investigation_id,workItem.client_id));

    await db.batch(statements);
    const [updatedWorkItem,updatedInvestigation,evidence]=await Promise.all([loadWorkItem(db,workItem.id),workItem.investigation_id?loadInvestigation(db,workItem.investigation_id):Promise.resolve(null),loadWorkItemEvidence(db,workItem.id)]);
    if(!updatedWorkItem) throw new Error(`D1 completed the Work Item update but Work Item #${workItem.id} could not be reloaded.`);
    return jsonResponse({ok:true,requestId,action:ACTIONS.PROCESS_WORK_ITEM,version:VERSION,source:"D1",updated:true,outcome:"completed",proofOfWorkEligible:updatedWorkItem.status==="completed"&&Boolean(updatedWorkItem.completed_at),workItem:mapWorkItem(updatedWorkItem),investigation:updatedInvestigation?mapInvestigation(updatedInvestigation):null,evidence:evidence.map(mapEvidence)});
  } catch(error) {
    logWorkerError({requestId,route:ACTIONS.PROCESS_WORK_ITEM,stage:"d1_work_item_processing",error});
    return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:safeErrorMessage(error)},500);
  }
}

async function loadWorkItem(db,id){return await db.prepare(`SELECT wi.id,wi.client_id,wi.investigation_id,wi.communication_id,wi.title,wi.description,wi.category,wi.priority,wi.status,wi.owner,wi.expected_impact,wi.actual_impact,wi.started_at,wi.completed_at,wi.created_at,wi.updated_at,c.client_code,c.name AS client_name FROM work_items wi JOIN clients c ON c.id=wi.client_id WHERE wi.id=? LIMIT 1`).bind(id).first();}
async function loadInvestigation(db,id){return await db.prepare(`SELECT i.id,i.client_id,i.communication_id,i.title,i.description,i.priority,i.status,i.assigned_to,i.finding_summary,i.recommendation,i.opened_at,i.resolved_at,i.closed_at,i.created_at,i.updated_at,c.client_code,c.name AS client_name FROM investigations i JOIN clients c ON c.id=i.client_id WHERE i.id=? LIMIT 1`).bind(id).first();}
async function loadWorkItemEvidence(db,id){const result=await db.prepare(`SELECT id,client_id,investigation_id,work_item_id,communication_id,evidence_type,source,description,url,raw_data,captured_at,created_at FROM evidence WHERE work_item_id=? ORDER BY captured_at DESC,id DESC`).bind(id).all();return Array.isArray(result?.results)?result.results:[];}
function mapWorkItem(r){if(!r)return null;return{id:r.id,clientId:r.client_id,clientCode:r.client_code,clientName:r.client_name,investigationId:r.investigation_id,communicationId:r.communication_id,title:r.title,description:r.description,category:r.category,priority:r.priority,status:r.status,owner:r.owner,expectedImpact:r.expected_impact,actualImpact:r.actual_impact,startedAt:r.started_at,completedAt:r.completed_at,createdAt:r.created_at,updatedAt:r.updated_at};}
function mapInvestigation(r){if(!r)return null;return{id:r.id,clientId:r.client_id,clientCode:r.client_code,clientName:r.client_name,communicationId:r.communication_id,title:r.title,description:r.description,priority:r.priority,status:r.status,assignedTo:r.assigned_to,findingSummary:r.finding_summary,recommendation:r.recommendation,openedAt:r.opened_at,resolvedAt:r.resolved_at,closedAt:r.closed_at,createdAt:r.created_at,updatedAt:r.updated_at};}
function mapEvidence(r){if(!r)return null;return{id:r.id,clientId:r.client_id,investigationId:r.investigation_id,workItemId:r.work_item_id,communicationId:r.communication_id,evidenceType:r.evidence_type,source:r.source,description:r.description,url:r.url,capturedAt:r.captured_at,createdAt:r.created_at};}
function appendWorkPerformed(existingDescription,workPerformed){const existing=clean(existingDescription);if(!existing)return `Work Performed: ${workPerformed}`;if(existing.includes(`Work Performed: ${workPerformed}`))return existing;return `${existing}\n\nWork Performed: ${workPerformed}`;}
function appendDisposition(existingDescription,dispositionNote){const existing=clean(existingDescription);const marker=`Disposition: Reassigned / No Longer GCM Responsibility\n${dispositionNote}`;if(!existing)return marker;if(existing.includes(marker))return existing;return `${existing}\n\n${marker}`;}
function normalizeDisposition(value){return clean(value).toLowerCase().replace(/[\s-]+/g,"_");}
function isCompletedStatus(value){return String(value||"").trim().toLowerCase().replace(/\s+/g,"_")==="completed";}
function isTerminalWorkItemStatus(value){return ["complete","completed","closed","resolved","cancelled","canceled"].includes(String(value||"").trim().toLowerCase().replace(/\s+/g,"_"));}
function positiveInt(value){const n=Number(value);return Number.isInteger(n)&&n>0?n:null;}

function gcmBusinessTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: GCM_BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}