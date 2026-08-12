/* =========================================================
   Global Concepts Media Operating System
   File: routes/workItemProcessing.js
   Version: 7.4.0
   Status: Production Road-Test Candidate
   Source: Production routes/workItemProcessing.js 7.3.3
   Sprint: Direct Requested Work Creation
   Purpose: Preserve verified Work Item completion behavior and add
            direct creation of known requested work without requiring
            an artificial Investigation.

   Changes in 7.4.0:
   - Adds create-requested-work.
   - Creates a normal open Work Item with investigation_id NULL.
   - Preserves optional Communication provenance.
   - Preserves all verified completion/evidence behavior.
   ========================================================= */

import { VERSION, ACTIONS } from "../shared/config.js";
import { clean, safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase } from "../shared/database.js";

export const CREATE_REQUESTED_WORK_ACTION = "create-requested-work";

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
    const inserted = await db.prepare(`
      INSERT INTO work_items (
        client_id, investigation_id, communication_id, title, description,
        category, priority, status, owner, expected_impact,
        started_at, created_at, updated_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, 'Open', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `).bind(client.id,communicationId||null,title,storedDescription,category,priority,owner,expectedImpact).first();

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
  const workPerformed=clean(body?.workPerformed||body?.work_performed);
  const actualImpact=clean(body?.actualImpact||body?.actual_impact||body?.result);
  const evidenceDescription=clean(body?.evidenceDescription||body?.evidence_description||body?.evidence);
  const evidenceSource=clean(body?.evidenceSource||body?.evidence_source||"Completion Evidence");
  const evidenceType=clean(body?.evidenceType||body?.evidence_type||"completion");
  const evidenceUrl=clean(body?.evidenceUrl||body?.evidence_url);

  if(!db||typeof db.prepare!=="function") return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:"The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."},503);
  if(!clientCode) return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:"A clientCode is required."},400);
  if(!Number.isInteger(workItemId)||workItemId<=0) return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:"A valid workItemId is required."},400);
  if(!workPerformed) return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:"A workPerformed value is required before a Work Item can be completed."},400);
  if(!actualImpact) return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:"An actualImpact/result value is required before a Work Item can be completed."},400);
  if(!evidenceDescription) return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:"Completion evidence is required before a Work Item can be completed."},400);

  try {
    const workItem=await db.prepare(`SELECT wi.id,wi.client_id,wi.investigation_id,wi.communication_id,wi.title,wi.description,wi.category,wi.priority,wi.status,wi.owner,wi.expected_impact,wi.actual_impact,wi.started_at,wi.completed_at,wi.created_at,wi.updated_at,c.client_code,c.name AS client_name FROM work_items wi JOIN clients c ON c.id=wi.client_id WHERE wi.id=? AND c.client_code=? COLLATE NOCASE LIMIT 1`).bind(workItemId,clientCode).first();
    if(!workItem) return jsonResponse({ok:false,requestId,action:ACTIONS.PROCESS_WORK_ITEM,error:`Work Item #${workItemId} was not found for client "${clientCode}".`},404);
    if(isCompletedStatus(workItem.status)&&workItem.completed_at){const existingEvidence=await loadWorkItemEvidence(db,workItem.id);return jsonResponse({ok:true,requestId,action:ACTIONS.PROCESS_WORK_ITEM,version:VERSION,source:"D1",updated:false,alreadyCompleted:true,workItem:mapWorkItem(workItem),evidence:existingEvidence.map(mapEvidence),message:`Work Item #${workItem.id} is already completed. No duplicate completion was recorded.`});}
    const completedDescription=appendWorkPerformed(workItem.description,workPerformed);
    const statements=[
      db.prepare(`UPDATE work_items SET description=?,status='completed',actual_impact=?,started_at=COALESCE(started_at,CURRENT_TIMESTAMP),completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND client_id=?`).bind(completedDescription,actualImpact,workItem.id,workItem.client_id),
      db.prepare(`INSERT INTO evidence (client_id,investigation_id,work_item_id,communication_id,evidence_type,source,description,url,captured_at) SELECT ?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM evidence WHERE work_item_id=? AND source=? AND description=?)`).bind(workItem.client_id,workItem.investigation_id,workItem.id,workItem.communication_id,evidenceType,evidenceSource,evidenceDescription,evidenceUrl||null,workItem.id,evidenceSource,evidenceDescription)
    ];
    if(workItem.investigation_id) statements.push(db.prepare(`UPDATE investigations SET status='closed',resolved_at=COALESCE(resolved_at,CURRENT_TIMESTAMP),closed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND client_id=?`).bind(workItem.investigation_id,workItem.client_id));
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
function isCompletedStatus(value){return String(value||"").trim().toLowerCase().replace(/\s+/g,"_")==="completed";}
function positiveInt(value){const n=Number(value);return Number.isInteger(n)&&n>0?n:null;}
