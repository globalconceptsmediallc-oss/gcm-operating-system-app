/* =========================================================
   Global Concepts Media Operating System
   File: routes/operatingSessionIntake.js
   Version: 1.0.0
   Status: OS 2.0 AI Intake Candidate
   Purpose: Prepare a rich human-approved session proposal with OpenAI.
   Writes: None.
   ========================================================= */

import { getDatabase, rowsOf } from "../shared/database.js";
import { jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";
import { authorizeOsRequest } from "../shared/osAuth.js";
import {
  PREPARE_OPERATING_SESSION_ACTION,
  OPERATING_INTAKE_MODEL,
  prepareOperatingSessionIntake,
  buildOperatingIntakeRequest,
  parseOperatingIntakeResponse
} from "../shared/operatingSessionIntakeTasks.js";

export { PREPARE_OPERATING_SESSION_ACTION };

export async function handleOperatingSessionIntake(body,env,requestId,request){
  const db=getDatabase(env);
  try{
    const user=await authorizeOsRequest(request,env,db);
    const intake=prepareOperatingSessionIntake(body);
    const client=await db.prepare("SELECT * FROM clients WHERE id = ? LIMIT 1").bind(intake.clientId).first();
    if(!client)throw new Error("The proven client record was not found.");
    if(!env?.OPENAI_API_KEY)throw new Error("The OpenAI operating-partner connection is not configured.");
    const history=await readRecentHistory(db,intake.clientId);
    const model=String(env.OPENAI_INTAKE_MODEL||OPERATING_INTAKE_MODEL);
    const openaiRequest=buildOperatingIntakeRequest({client,intake,history,model});
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":`Bearer ${env.OPENAI_API_KEY}`,"Content-Type":"application/json","X-Client-Request-Id":requestId},
      body:JSON.stringify(openaiRequest)
    });
    const providerRequestId=response.headers.get("x-request-id");
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(`OpenAI intake failed: ${payload?.error?.message||`HTTP ${response.status}`}`);
    const proposal=parseOperatingIntakeResponse(payload);
    return jsonResponse({ok:true,requestId,action:PREPARE_OPERATING_SESSION_ACTION,writesPerformed:0,user:{email:user.email},client:{id:Number(client.id),clientCode:client.client_code||null,name:client.name},proposal,ai:{model,responseId:payload.id||null,providerRequestId}});
  }catch(error){
    const message=safeErrorMessage(error);const unauthorized=/sign in|login token|signed-in account|verified/i.test(message);
    logWorkerError({requestId,route:PREPARE_OPERATING_SESSION_ACTION,stage:unauthorized?"authorization":"openai_intake",error});
    return jsonResponse({ok:false,requestId,action:PREPARE_OPERATING_SESSION_ACTION,writesPerformed:0,error:message},unauthorized?401:500);
  }
}

async function readRecentHistory(db,clientId){
  const sources=await Promise.all([
    safeRows(db,"activity_records",clientId),safeRows(db,"work_items",clientId),safeRows(db,"investigations",clientId)
  ]);
  return sources.flat().slice(0,24);
}

async function safeRows(db,table,clientId){
  try{
    const result=await db.prepare(`SELECT * FROM ${table} WHERE client_id = ? ORDER BY id DESC LIMIT 8`).bind(clientId).all();
    return rowsOf(result).map(row=>compactHistory(table,row));
  }catch{return[];}
}

function compactHistory(source,row){
  const allowed=["id","title","subject","summary","description","category","status","priority","finding","result","outcome","completed_at","created_at","updated_at"];
  const record={source};for(const key of allowed){if(row[key]!==null&&row[key]!==undefined&&String(row[key]).trim())record[key]=String(row[key]).slice(0,1200);}return record;
}
