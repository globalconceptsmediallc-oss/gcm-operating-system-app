/* =========================================================
   Global Concepts Media Operating System
   File: routes/gmailIntegration.js
   Version: 1.4.1
   Status: Production Candidate — Forced Gmail Reauthorization
   Source: New production route
   Sprint: Morning Command — Operational Decision Calibration
   Purpose: Preserve the verified Gmail intelligence and approval workflow,
            save human-approved monitoring evidence, and remove approved
            messages from the unread Gmail queue only after D1 succeeds.
   Production change:
   - Approved monitoring remains monitoring evidence, not completed work.
   - Gmail is marked read only after D1 confirms the save or duplicate.
   - Uses gmail.modify so approved messages leave Morning Command.
   ========================================================= */
import { VERSION, ACTIONS } from "../shared/config.js";
import { clean, safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase } from "../shared/database.js";
import { handleCommunicationAnalysis } from "./communicationAnalysis.js";
export const GMAIL_INTEGRATION_VERSION = "1.4.1";
export const GMAIL_PATHS = Object.freeze({ CONNECT: "/auth/google", CALLBACK: "/auth/google/callback" });
const AUTH_URL="https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL="https://oauth2.googleapis.com/token";
const API="https://gmail.googleapis.com/gmail/v1";
const SCOPE="https://www.googleapis.com/auth/gmail.modify";
const REDIRECT="https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/auth/google/callback";
const TODAY="https://globalconceptsmediallc-oss.github.io/gcm-operating-system-app/today.html";
export async function handleGmailGet(request,env,requestId){
  const url=new URL(request.url);
  if(url.pathname===GMAIL_PATHS.CONNECT)return beginAuth(url,env);
  if(url.pathname===GMAIL_PATHS.CALLBACK)return finishAuth(url,env,requestId);
  return null;
}
export async function handleGmailAction(body,env,requestId){
  if(body?.action===ACTIONS.GET_GMAIL_STATUS)return status(env,requestId);
  if(body?.action===ACTIONS.PREVIEW_GMAIL_INBOX)return preview(body,env,requestId);
  if(body?.action===ACTIONS.APPROVE_GMAIL_MONITORING)return approveMonitoring(body,env,requestId);
  return null;
}
async function beginAuth(url,env){
  requireSecrets(env);
  const returnTo=safeReturn(url.searchParams.get("return_to"));
  const state=await makeState({returnTo,issuedAt:Date.now()},env.GOOGLE_CLIENT_SECRET);
  const target=new URL(AUTH_URL);
  target.searchParams.set("client_id",env.GOOGLE_CLIENT_ID);
  target.searchParams.set("redirect_uri",REDIRECT);
  target.searchParams.set("response_type","code");
  target.searchParams.set("scope",SCOPE);
  target.searchParams.set("access_type","offline");
  target.searchParams.set("prompt","consent select_account");
  target.searchParams.set("include_granted_scopes","true");
  target.searchParams.set("state",state);
  return Response.redirect(target.toString(),302);
}
async function finishAuth(url,env,requestId){
  requireSecrets(env);
  let state;
  try{state=await readState(clean(url.searchParams.get("state")),env.GOOGLE_CLIENT_SECRET);}catch(error){return callbackPage(false,"Gmail connection could not be verified",safeErrorMessage(error),TODAY,400);}
  const oauthError=clean(url.searchParams.get("error"));
  if(oauthError)return callbackPage(false,"Gmail connection was not completed",oauthError,state.returnTo,400);
  const code=clean(url.searchParams.get("code"));
  if(!code)return callbackPage(false,"Google returned no authorization code","Return to Today and try again.",state.returnTo,400);
  try{
    const response=await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,code,grant_type:"authorization_code",redirect_uri:REDIRECT})});
    const token=await response.json();
    if(!response.ok||!token.refresh_token)throw new Error(token.error_description||token.error||"Google did not return a refresh token.");
    const grantedScope=clean(token.scope);
    if(!grantedScope.split(/\s+/).includes(SCOPE)){
      throw new Error("Google did not grant gmail.modify. Reconnect Gmail and approve the requested Gmail permission.");
    }
    const profile=await gmailFetch(`${API}/users/me/profile`,token.access_token);
    const db=requireDb(env);await ensureTable(db);
    const encrypted=await encrypt(token.refresh_token,env.GOOGLE_CLIENT_SECRET);
    await db.prepare(`INSERT INTO gmail_connections(account_email,encrypted_refresh_token,scope,connected_at,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(account_email) DO UPDATE SET encrypted_refresh_token=excluded.encrypted_refresh_token,scope=excluded.scope,updated_at=CURRENT_TIMESTAMP`).bind(profile.emailAddress,encrypted,clean(token.scope)||SCOPE).run();
    return callbackPage(true,"Gmail connected",`${profile.emailAddress} is connected. Approved monitoring can be marked read after D1 preservation.`,state.returnTo,200);
  }catch(error){logWorkerError({requestId,route:"gmail-oauth-callback",stage:"gmail_oauth",error});return callbackPage(false,"Gmail connection failed",safeErrorMessage(error),state.returnTo,500);}
}
async function status(env,requestId){
  try{const db=requireDb(env);await ensureTable(db);const connection=await db.prepare(`SELECT account_email,scope,connected_at,updated_at FROM gmail_connections ORDER BY updated_at DESC LIMIT 1`).first();return jsonResponse({ok:true,requestId,action:ACTIONS.GET_GMAIL_STATUS,version:VERSION,gmailIntegrationVersion:GMAIL_INTEGRATION_VERSION,connected:Boolean(connection),connection:connection||null,connectUrl:`${REDIRECT.replace('/auth/google/callback','/auth/google')}?return_to=${encodeURIComponent(TODAY)}&reauthorize=1`});}
  catch(error){return jsonResponse({ok:false,requestId,action:ACTIONS.GET_GMAIL_STATUS,error:safeErrorMessage(error)},500);}
}
async function preview(body,env,requestId){
  const limit=Math.min(Math.max(Number(body?.limit)||10,1),20);
  try{
    const db=requireDb(env);
    await ensureTable(db);
    const connection=await db.prepare(`SELECT account_email,encrypted_refresh_token FROM gmail_connections ORDER BY updated_at DESC LIMIT 1`).first();
    if(!connection)return jsonResponse({ok:false,requestId,connected:false,error:"Gmail is not connected."},401);
    const refreshToken=await decrypt(connection.encrypted_refresh_token,env.GOOGLE_CLIENT_SECRET);
    const accessToken=await refreshAccessToken(refreshToken,env);
    const listUrl=new URL(`${API}/users/me/messages`);
    listUrl.searchParams.set("q","is:unread in:inbox -in:spam -in:trash -category:promotions -category:social");
    listUrl.searchParams.set("maxResults",String(limit));
    const list=await gmailFetch(listUrl.toString(),accessToken);
    const rawMessages=await Promise.all((list.messages||[]).map(item=>readMessage(item.id,accessToken)));
    const messages=await mapWithConcurrency(rawMessages,3,(message,index)=>analyzePreviewMessage(message,env,`${requestId}-gmail-${index+1}`));
    return jsonResponse({
      ok:true,
      requestId,
      action:ACTIONS.PREVIEW_GMAIL_INBOX,
      version:VERSION,
      gmailIntegrationVersion:GMAIL_INTEGRATION_VERSION,
      connected:true,
      accountEmail:connection.account_email,
      mode:"read-only-intelligence-preview",
      reviewedCount:messages.length,
      writesPerformed:0,
      messages
    });
  }catch(error){
    logWorkerError({requestId,route:ACTIONS.PREVIEW_GMAIL_INBOX,stage:"gmail_intelligence_preview",error});
    return jsonResponse({ok:false,requestId,action:ACTIONS.PREVIEW_GMAIL_INBOX,error:safeErrorMessage(error)},500);
  }
}
async function approveMonitoring(body,env,requestId){
  const gmailMessageId=clean(body?.gmailMessageId);
  if(!gmailMessageId)return jsonResponse({ok:false,requestId,error:"gmailMessageId is required."},400);

  try{
    const db=requireDb(env);
    await ensureTable(db);

    const connection=await db.prepare(`SELECT account_email,encrypted_refresh_token,scope FROM gmail_connections ORDER BY updated_at DESC LIMIT 1`).first();
    if(!connection)return jsonResponse({ok:false,requestId,error:"Gmail is not connected."},401);

    const refreshToken=await decrypt(connection.encrypted_refresh_token,env.GOOGLE_CLIENT_SECRET);
    const accessToken=await refreshAccessToken(refreshToken,env);
    const sourceReference=`gmail:${gmailMessageId}`;
    const existing=await db.prepare(`SELECT id,client_id,activity_date,activity,source_reference FROM activity_records WHERE source_reference=? LIMIT 1`).bind(sourceReference).first();

    if(existing){
      await markMessageRead(gmailMessageId,accessToken);
      return jsonResponse({
        ok:true,
        requestId,
        action:ACTIONS.APPROVE_GMAIL_MONITORING,
        duplicate:true,
        writesPerformed:0,
        gmailMarkedRead:true,
        record:existing
      });
    }

    const message=await readMessage(gmailMessageId,accessToken);
    const analyzed=await analyzePreviewMessage(message,env,`${requestId}-approval`);
    const intel=analyzed.intelligence||{};

    if(!intel.monitoringOnly){
      return jsonResponse({
        ok:false,
        requestId,
        error:"This email is not classified as a Monitoring Candidate. Review it manually before creating an OS record.",
        intelligence:intel
      },409);
    }

    const clientName=clean(intel.client);
    if(!clientName||/unassigned|human review/i.test(clientName)){
      return jsonResponse({ok:false,requestId,error:"A verified client match is required before monitoring can be approved."},409);
    }

    const client=await db.prepare(`SELECT id,name FROM clients WHERE lower(name)=lower(?) LIMIT 1`).bind(clientName).first();
    if(!client)return jsonResponse({ok:false,requestId,error:`No production client matched ${clientName}.`},409);

    const activityDate=normalizeActivityDate(message.date);
    const category=monitoringCategory(intel.notificationType);
    const activity=clean(message.subject)||`${intel.communicationFamily||"Monitoring"} update`;
    const notes=[
      `Business meaning: ${clean(intel.businessMeaning)}`,
      `Recommended action: ${clean(intel.recommendedAction)}`,
      `Gmail message ID: ${gmailMessageId}`,
      `Gmail thread ID: ${clean(message.threadId)}`
    ].filter(Boolean).join("\n");

    const result=await db.prepare(`INSERT INTO activity_records (
      client_id,activity_date,category,activity,evidence_type,evidence_reference,
      status,owner,time_minutes,expected_impact,actual_impact,notes,source_type,
      source_reference,priority,win,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
      .bind(
        client.id,
        activityDate,
        category,
        activity,
        "Gmail",
        sourceReference,
        "completed",
        "Andy",
        0,
        "Monitoring / trend evidence",
        clean(intel.businessMeaning),
        notes,
        "gmail_monitoring",
        sourceReference,
        clean(intel.operationalPriority)||"Low",
        0
      ).run();

    await markMessageRead(gmailMessageId,accessToken);

    return jsonResponse({
      ok:true,
      requestId,
      action:ACTIONS.APPROVE_GMAIL_MONITORING,
      duplicate:false,
      writesPerformed:1,
      gmailMarkedRead:true,
      record:{
        id:result?.meta?.last_row_id||null,
        client_id:client.id,
        client:client.name,
        activity_date:activityDate,
        activity,
        source_reference:sourceReference
      }
    });
  }catch(error){
    logWorkerError({
      requestId,
      route:ACTIONS.APPROVE_GMAIL_MONITORING,
      stage:"gmail_monitoring_approval",
      error
    });
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.APPROVE_GMAIL_MONITORING,
      error:safeErrorMessage(error)
    },500);
  }
}

async function markMessageRead(gmailMessageId,accessToken){
  const response=await fetch(`${API}/users/me/messages/${encodeURIComponent(gmailMessageId)}/modify`,{
    method:"POST",
    headers:{
      Authorization:`Bearer ${accessToken}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({removeLabelIds:["UNREAD"]})
  });
  const data=await response.json();
  if(!response.ok){
    const message=data?.error?.message||`Gmail modify failed with HTTP ${response.status}.`;
    if(response.status===403){
      throw new Error(`${message} Reconnect Gmail once to grant permission to mark approved messages read.`);
    }
    throw new Error(message);
  }
  return data;
}
function normalizeActivityDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?new Date().toISOString().slice(0,10):d.toISOString().slice(0,10);}
function monitoringCategory(type){const map={position_tracking:"SEO Ranking Alert",search_performance:"Search Performance Notification",site_audit:"Technical SEO Audit Alert",backlink_audit:"SEO Backlink Alert",analytics:"Analytics Notification",business_profile:"Local Presence Notification"};return map[clean(type).toLowerCase()]||"Monitoring Intelligence";}

async function readMessage(id,token){
  const url=new URL(`${API}/users/me/messages/${encodeURIComponent(id)}`);
  url.searchParams.set("format","full");
  const data=await gmailFetch(url.toString(),token);
  const headers=data?.payload?.headers||[];
  const value=name=>clean(headers.find(item=>clean(item.name).toLowerCase()===name.toLowerCase())?.value);
  const bodyText=sanitizeEmailText(extractMessageText(data?.payload)).slice(0,8000);
  return{
    gmailMessageId:data.id,
    threadId:data.threadId,
    from:value("From"),
    to:value("To"),
    subject:value("Subject")||"(No subject)",
    date:value("Date"),
    snippet:clean(data.snippet),
    bodyText:bodyText||clean(data.snippet),
    labels:Array.isArray(data.labelIds)?data.labelIds:[]
  };
}
async function analyzePreviewMessage(message,env,requestId){
  const sourceText=[
    `From: ${message.from||"Unknown"}`,
    `To: ${message.to||"Unknown"}`,
    `Subject: ${message.subject||"(No subject)"}`,
    `Date: ${message.date||"Unknown"}`,
    "",
    message.bodyText||message.snippet||""
  ].join("\n");
  try{
    const response=await handleCommunicationAnalysis({
      action:ACTIONS.ANALYZE_COMMUNICATION,
      sourceText,
      fileName:`gmail-${message.gmailMessageId}.txt`,
      operationalContext:"Unread Gmail message reviewed in Morning Command Preview Mode. No records may be created from this analysis."
    },env,requestId);
    const analysis=await response.json();
    if(!response.ok||analysis?.ok!==true)throw new Error(analysis?.error?.message||analysis?.error||"Communication analysis failed.");
    return{
      ...message,
      intelligence:buildGmailRecommendation(message,analysis),
      analysisStatus:analysis.processingStatus||"complete"
    };
  }catch(error){
    logWorkerError({requestId,route:ACTIONS.PREVIEW_GMAIL_INBOX,stage:"gmail_message_analysis",error});
    return{
      ...message,
      intelligence:buildFallbackRecommendation(message,error),
      analysisStatus:"manual_review_required"
    };
  }
}
function buildGmailRecommendation(message,analysis){
  const classification=analysis?.classification||{};
  const decision=analysis?.operationalDecision||analysis?.analysis||{};
  const routes=decision?.recommendedRoutes||{};
  const sourceText=`${message.from} ${message.subject} ${message.bodyText}`.toLowerCase();
  const github=/github|notifications@github\.com/.test(sourceText);
  const githubFailure=github&&/(failed|failure|error|cancelled|timed out|deployment failed|build failed|workflow run failed|checks? failed|action required|security alert|vulnerability)/i.test(sourceText);
  if(github){
    return{
      communicationFamily:"GitHub / Development Operations",
      notificationType:githubFailure?"production_or_build_failure":"routine_repository_notification",
      client:analysis?.client?.name||"GCM — Internal",
      businessMeaning:githubFailure
        ? "A development or production failure was explicitly reported. The email proves a failed run, but it does not by itself prove client impact, root cause, or required corrective work."
        : "Routine repository activity does not establish client impact or operational work.",
      operationalPriority:githubFailure?"High":"Low",
      recommendedAction:githubFailure
        ? "Open the failed run and verify the failing job, affected environment, and production impact. Create an investigation only after that evidence confirms corrective work is required."
        : "No OS record is recommended. Archive after human review.",
      shouldCreateCommunication:false,
      shouldCreateInvestigation:false,
      shouldCreateWorkItem:false,
      monitoringOnly:false,
      archive:!githubFailure,
      proposedRoute:githubFailure?"Review Required":"Archive",
      confidence:"High",
      decisionReliability:githubFailure?"Provisional — failure confirmed, impact unverified":"Reliable — routine notice",
      evidenceSufficiency:githubFailure?"Partial":"Sufficient",
      evidenceComparedAgainst:"Current Gmail message only",
      verificationRequired:githubFailure?"Open the GitHub run and confirm failure scope, environment, and impact before creating any OS record.":"Confirm the notice is routine and archive it.",
      humanReviewRequired:true,
      sourceAnalysis:decision
    };
  }
  const type=clean(classification.notificationType).toLowerCase();
  const saveCommunication=Boolean(routes.saveCommunication);
  const createInvestigation=Boolean(routes.createInvestigation);
  const createWorkItem=Boolean(routes.createWorkItem);
  const monitoringOnly=saveCommunication&&!createInvestigation&&!createWorkItem&&!routes.replyRequired;
  const calibration=buildDecisionCalibration({message,analysis,classification,decision,monitoringOnly,createInvestigation});
  const previewMeaning=buildConciseBusinessMeaning({message,analysis,classification,decision,createInvestigation:false});
  const previewAction=buildConciseRecommendedAction({message,analysis,classification,decision,createInvestigation:false,monitoringOnly});
  const isKnownMonitoring=["position_tracking","search_performance","site_audit","backlink_audit"].includes(type);
  return{
    communicationFamily:classification.notificationFamily||decision.notificationFamily||"Unknown",
    notificationType:classification.notificationType||"unknown",
    client:analysis?.client?.name||"Unassigned — Human Review",
    businessMeaning:previewMeaning,
    operationalPriority:decision.operationalPriority||decision.importance||"Low",
    recommendedAction:previewAction,
    shouldCreateCommunication:isKnownMonitoring?false:saveCommunication&&calibration.productionDecisionReady,
    shouldCreateInvestigation:createInvestigation&&calibration.productionDecisionReady,
    shouldCreateWorkItem:createWorkItem&&calibration.productionDecisionReady,
    monitoringOnly:isKnownMonitoring?true:monitoringOnly&&calibration.productionDecisionReady,
    archive:false,
    proposedRoute:calibration.proposedRoute,
    confidence:confidenceLabel(decision.classificationConfidence),
    decisionReliability:calibration.decisionReliability,
    evidenceSufficiency:calibration.evidenceSufficiency,
    evidenceComparedAgainst:calibration.evidenceComparedAgainst,
    verificationRequired:calibration.verificationRequired,
    humanReviewRequired:true,
    productionDecisionReady:calibration.productionDecisionReady,
    sourceAnalysis:decision
  };
}
function buildDecisionCalibration({message,analysis,classification,decision,monitoringOnly,createInvestigation}){
  const type=clean(classification?.notificationType).toLowerCase();
  const evidenceText=[message.subject,message.bodyText,...(analysis?.evidence?.visibleMetrics||[]),...(analysis?.evidence?.visibleFacts||[])].filter(Boolean).join(" ");
  const hasKeywordMovement=/\b(keyword|position|rank|ranking)\b/i.test(evidenceText)&&/(moved|changed|gained|lost|up|down|position\s*\d+)/i.test(evidenceText);
  const hasSearchMetrics=/\b(clicks?|impressions?|ctr|average position)\b/i.test(evidenceText)&&/\b\d[\d,.]*\b/.test(evidenceText);
  const hasAuditMetrics=/\b(errors?|warnings?|notices?|site health|broken pages?)\b/i.test(evidenceText)&&/\b\d[\d,.%]*\b/.test(evidenceText);
  if(type==="position_tracking")return{
    decisionReliability:hasKeywordMovement?"Moderate — current movement detected":"Low — movement detail incomplete",
    evidenceSufficiency:hasKeywordMovement?"Current report sufficient for monitoring; insufficient for escalation":"Insufficient for production decision",
    evidenceComparedAgainst:"Current Gmail message only; no prior Position Tracking record, investigation, baseline, or proof compared",
    verificationRequired:"Compare the affected keyword, direction, current position, and prior report. Then decide whether to save monitoring evidence, attach it to existing work, or investigate.",
    productionDecisionReady:false,
    proposedRoute:"Calibration Required"
  };
  if(type==="search_performance")return{
    decisionReliability:hasSearchMetrics?"Moderate — current metrics detected":"Low — metric detail incomplete",
    evidenceSufficiency:hasSearchMetrics?"Current report sufficient for monitoring; insufficient for trend decision":"Insufficient for production decision",
    evidenceComparedAgainst:"Current Gmail message only; no prior Search Console period, baseline, investigation, or proof compared",
    verificationRequired:"Compare clicks, impressions, CTR, and position with the prior reporting period before approving monitoring or escalation.",
    productionDecisionReady:false,
    proposedRoute:"Calibration Required"
  };
  if(type==="site_audit"||type==="backlink_audit")return{
    decisionReliability:hasAuditMetrics?"Moderate — current condition detected":"Low — issue detail incomplete",
    evidenceSufficiency:"Current report is evidence, but change, cause, and client impact are not yet verified",
    evidenceComparedAgainst:"Current Gmail message only; no prior audit, open investigation, completed work, or proof compared",
    verificationRequired:"Compare the current issue counts and changes with the prior audit and any open investigation before approving a production route.",
    productionDecisionReady:false,
    proposedRoute:"Calibration Required"
  };
  return{
    decisionReliability:createInvestigation?"Provisional — escalation suggested":"Provisional — human judgment required",
    evidenceSufficiency:"Current email analyzed; broader client context not compared",
    evidenceComparedAgainst:"Current Gmail message only",
    verificationRequired:"Review the source email and compare it with relevant client records before approving any production action.",
    productionDecisionReady:false,
    proposedRoute:"Manual Review"
  };
}
function buildConciseBusinessMeaning({message,analysis,classification,decision,createInvestigation}){
  const type=clean(classification?.notificationType).toLowerCase();
  const client=analysis?.client?.name||"the client";
  const evidenceText=[message.subject,message.bodyText,...(analysis?.evidence?.visibleMetrics||[]),...(analysis?.evidence?.visibleFacts||[])].filter(Boolean).join(" ");
  if(type==="position_tracking"){
    const count=extractFirstCount(evidenceText,[/\b(\d+)\s+keywords?\b/i,/\bfor\s+(\d+)\s+keywords?\b/i]);
    const movement=count?`${count} tracked keyword${count===1?"":"s"} changed position`:`A tracked keyword ranking change was reported`;
    return `${movement} for ${client}. ${createInvestigation?"The evidence may represent adverse movement that requires cause verification.":"The notification is monitoring evidence until the actual keyword movement proves a meaningful gain or loss."}`;
  }
  if(type==="search_performance"){
    return `Google Search Console supplied a performance report for ${client}. The report should be retained as monitoring evidence and reviewed for material changes in clicks, impressions, CTR, or position.`;
  }
  if(type==="site_audit"){
    return `SEMrush supplied a Site Audit update for ${client}. Existing issue counts remain monitoring evidence unless the current report proves a new or materially worsening condition.`;
  }
  if(type==="backlink_audit"){
    return `SEMrush supplied a backlink-risk update for ${client}. The notice requires evidence review before deciding whether any link investigation is justified.`;
  }
  return conciseText(decision.operationalSummary||analysis?.consultantSummary?.summary||analysis?.businessMeaning?.operationalSummary||decision.businessImpact,"Manual review is required.");
}
function buildConciseRecommendedAction({classification,decision,createInvestigation,monitoringOnly}){
  const type=clean(classification?.notificationType).toLowerCase();
  if(type==="position_tracking"){
    return createInvestigation
      ? "Open the ranking evidence, identify the affected keyword and direction of movement, then verify the cause before creating corrective work."
      : "Compare the reported keyword movement with the prior Position Tracking evidence. Retain it as monitoring unless a meaningful loss, threshold change, or client-impact signal is proven.";
  }
  if(type==="search_performance"){
    return "Compare the current Search Console metrics with the prior reporting period. Escalate only when the evidence shows a material performance change requiring investigation.";
  }
  if(type==="site_audit"){
    return createInvestigation
      ? "Review the changed Site Audit metrics and isolate the new or worsening issue before defining corrective work."
      : "Save the report as monitoring evidence and continue watching for new or worsening errors, warnings, or broken pages.";
  }
  if(monitoringOnly)return "Save the communication as monitoring evidence and continue watching for a material change.";
  return conciseText(decision.recommendedAction,"Review the source email before approving any production action.");
}
function extractFirstCount(value,patterns){
  for(const pattern of patterns){const match=String(value||"").match(pattern);if(match)return Number(match[1]);}
  return null;
}
function conciseText(value,fallback){
  const text=sanitizeEmailText(value);
  if(!text)return fallback;
  const sentence=text.split(/(?<=[.!?])\s+/).find(item=>item.length>=20)||text;
  return sentence.length>420?`${sentence.slice(0,417).trim()}...`:sentence;
}
function buildFallbackRecommendation(message,error){
  return{
    communicationFamily:"Manual Review",
    notificationType:"analysis_unavailable",
    client:"Unassigned — Human Review",
    businessMeaning:"The email was retrieved successfully, but operational intelligence could not be completed.",
    operationalPriority:"Normal",
    recommendedAction:`Review this email manually. Analysis error: ${safeErrorMessage(error)}`,
    shouldCreateCommunication:false,
    shouldCreateInvestigation:false,
    shouldCreateWorkItem:false,
    monitoringOnly:false,
    archive:false,
    proposedRoute:"Manual Review",
    confidence:"Low",
    decisionReliability:"Unavailable",
    evidenceSufficiency:"Insufficient",
    evidenceComparedAgainst:"Current Gmail message only",
    verificationRequired:"Review the source email manually before taking any production action.",
    humanReviewRequired:true,
    productionDecisionReady:false
  };
}
function extractMessageText(payload){
  const plain=[];
  const html=[];
  const visit=part=>{
    if(!part||typeof part!=="object")return;
    const mime=clean(part.mimeType).toLowerCase();
    const data=part?.body?.data;
    if(data){
      const decoded=decodeGmailText(data);
      if(mime==="text/plain")plain.push(decoded);
      else if(mime==="text/html")html.push(htmlToText(decoded));
    }
    for(const child of Array.isArray(part.parts)?part.parts:[])visit(child);
  };
  visit(payload);
  return clean((plain.length?plain:html).join("\n\n"));
}
function decodeGmailText(value){
  try{return new TextDecoder().decode(decode(value));}catch{return"";}
}
function sanitizeEmailText(value){
  let text=String(value||"");
  for(let i=0;i<2;i++)text=decodeHtmlEntities(text);
  text=text
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/https?:\/\/\S+/gi," ")
    .replace(/\b(?:unsubscribe|manage preferences|view in browser|privacy policy|contact us|email preferences)\b[\s\S]{0,500}$/gi," ")
    .replace(/\b[A-Za-z0-9_-]{80,}\b/g," ")
    .replace(/[ \t]+/g," ")
    .replace(/\n[ \t]+/g,"\n")
    .replace(/\n{3,}/g,"\n\n");
  return clean(text);
}
function decodeHtmlEntities(value){
  return String(value||"")
    .replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;|&#38;/gi,"&")
    .replace(/&lt;|&#60;/gi,"<")
    .replace(/&gt;|&#62;/gi,">")
    .replace(/&quot;|&#34;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&#(\d+);/g,(_,code)=>{const value=Number(code);return value>0&&value<=1114111?String.fromCodePoint(value):" ";});
}
function htmlToText(value){
  return sanitizeEmailText(String(value||"")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<br\s*\/?\s*>/gi,"\n")
    .replace(/<\/p>/gi,"\n")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'"));
}
async function mapWithConcurrency(items,limit,mapper){
  const results=new Array(items.length);
  let next=0;
  const workers=Array.from({length:Math.min(limit,items.length)},async()=>{
    while(next<items.length){
      const index=next++;
      results[index]=await mapper(items[index],index);
    }
  });
  await Promise.all(workers);
  return results;
}
function confidenceLabel(value){
  const number=Number(value);
  if(Number.isFinite(number)&&number>=0.8)return"High";
  if(Number.isFinite(number)&&number>=0.5)return"Medium";
  return"Low";
}
async function refreshAccessToken(refreshToken,env){const response=await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:refreshToken,grant_type:"refresh_token"})});const data=await response.json();if(!response.ok||!data.access_token)throw new Error(data.error_description||data.error||"Google token refresh failed.");return data.access_token;}
async function gmailFetch(url,token){const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});const data=await response.json();if(!response.ok)throw new Error(data?.error?.message||`Gmail API failed with HTTP ${response.status}.`);return data;}
async function ensureTable(db){await db.prepare(`CREATE TABLE IF NOT EXISTS gmail_connections(id INTEGER PRIMARY KEY AUTOINCREMENT,account_email TEXT NOT NULL UNIQUE,encrypted_refresh_token TEXT NOT NULL,scope TEXT,connected_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();}
function requireDb(env){const db=getDatabase(env);if(!db||typeof db.prepare!=="function")throw new Error("The production D1 binding is unavailable.");return db;}
function requireSecrets(env){if(!clean(env?.GOOGLE_CLIENT_ID)||!clean(env?.GOOGLE_CLIENT_SECRET))throw new Error("Google OAuth secrets are not configured.");}
function safeReturn(value){try{const url=new URL(clean(value)||TODAY);return url.origin==="https://globalconceptsmediallc-oss.github.io"?url.toString():TODAY;}catch{return TODAY;}}
async function makeState(payload,secret){const body=encode(new TextEncoder().encode(JSON.stringify(payload)));return`${body}.${await sign(body,secret)}`;}
async function readState(value,secret){const[body,signature]=value.split(".");if(!body||!signature||signature!==await sign(body,secret))throw new Error("OAuth state verification failed.");const data=JSON.parse(new TextDecoder().decode(decode(body)));if(Date.now()-Number(data.issuedAt)>900000)throw new Error("OAuth state expired.");return data;}
async function sign(value,secret){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return encode(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value))));}
async function cryptoKey(secret){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret));return crypto.subtle.importKey("raw",digest,"AES-GCM",false,["encrypt","decrypt"]);}
async function encrypt(value,secret){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await cryptoKey(secret),new TextEncoder().encode(value)));return`${encode(iv)}.${encode(bytes)}`;}
async function decrypt(value,secret){const[iv,data]=value.split(".");const bytes=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(iv)},await cryptoKey(secret),decode(data));return new TextDecoder().decode(bytes);}
function encode(bytes){let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function decode(value){const normalized=value.replace(/-/g,"+").replace(/_/g,"/");const padded=normalized+"=".repeat((4-normalized.length%4)%4);return Uint8Array.from(atob(padded),character=>character.charCodeAt(0));}
function escapeHtml(value){return String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function callbackPage(ok,title,message,returnTo,status){return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f7fb;font-family:system-ui;color:#132238}.card{max-width:560px;padding:32px;border:1px solid #dbe2ec;border-radius:22px;background:#fff}a{display:inline-block;padding:12px 18px;border-radius:11px;background:#1f68d8;color:#fff;text-decoration:none;font-weight:800}</style></head><body><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="${escapeHtml(safeReturn(returnTo))}">Return to Today</a></main></body></html>`,{status,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});}
