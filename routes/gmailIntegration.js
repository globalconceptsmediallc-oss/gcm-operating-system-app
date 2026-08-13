/* =========================================================
   Global Concepts Media Operating System
   File: routes/gmailIntegration.js
   Version: 1.7.0
   Status: Production Candidate â€” Human Operational Intelligence
   Source: routes/gmailIntegration.js 1.5.4
   Sprint: Media â€” Gmail Attached Draft Creation
   Purpose: Preserve the verified Gmail intelligence and monitoring approval
            workflow, add human-approved Communication + Investigation
            processing through the existing operational decision commit route,
            and remove approved messages from the unread Gmail queue only after
            D1 succeeds.
   Production change:
   - Approved monitoring remains monitoring evidence, not completed work.
   - Approved Investigation candidates reuse operationalDecision.js so existing
     Communication + Investigation relationships remain authoritative.
   - Gmail is marked read only after D1 confirms the save or duplicate.
   - No Work Item is created by Gmail Investigation approval.
   - Uses gmail.modify so approved messages leave Morning Command.
   - Recognizes YouTube monthly performance emails as monitoring evidence and preserves
     subscribers, minutes watched, and total views for future growth/decline comparison.
   - Recognizes Google Analytics performance-report emails, extracts report-level metrics,
     and maps a client only when the Gmail evidence contains a verified client/property alias.
   - Analytics reports without a verified client/property match remain Manual Review; they
     are never silently assigned or saved to the wrong client.
   - Position Tracking client identity is deterministically resolved from the explicit
     project/domain in Gmail evidence before using AI client classification.
   - northfloridasafes.com maps only to North Florida Safes; verified identity now propagates
     into Business Meaning as well as the structured Client field.
   - Verified, non-adverse Position Tracking updates may route to Monitoring; explicit decline
     signals remain Calibration Required for human review.
   - Morning Command now includes unread operational mail routed by Gmail rules to the
     Kristy and Frank & Adrianne Stuff labels, in addition to unread Inbox mail.
   - Existing spam/trash exclusions remain in place; Inbox promotion/social filtering is
     preserved without excluding explicitly monitored operational labels.
   - Known human senders are interpreted by operational role before generic platform keywords.
   - Kristy communications distinguish completed/corrective website work, active research,
     MediaForge opportunities, show-calendar planning, and cross-channel follow-up opportunities.
   - Frank communications are treated as leadership/operational heads-up unless the message
     itself proves a direct action request.
   - Ted/Liberty regional communications are treated as manufacturer-relationship intelligence;
     visit notices trigger meeting preparation rather than generic client-request classification.
   - Human-email preview remains read-only: this version changes intelligence, not D1 write rules.
   - Adrianne is now treated as a known SES leadership/operations human before generic platform keywords.
   - Explicit client names in billing subjects/body override weaker inferred client assignment.
   - iHeart invoices are recognized as finance/co-op coordination: Adrianne payment + Kristy co-op support.
   - Cloudflare promotional mail is classified as non-operational archive noise rather than Manual Review work.
   - Archive candidates can now be cleared through the existing Gmail approval action with zero D1 writes.
   - Archive removes UNREAD and INBOX labels only after the message is re-verified as an archive candidate.
   ========================================================= */
import { VERSION, ACTIONS } from "../shared/config.js";
import { clean, safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase } from "../shared/database.js";
import { handleCommunicationAnalysis } from "./communicationAnalysis.js";
import { handleCommitOperationalDecision } from "./operationalDecision.js";
import { createOsSessionToken } from "../shared/osAuth.js";
export const GMAIL_INTEGRATION_VERSION = "1.7.0";
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
  if(body?.action===ACTIONS.APPROVE_GMAIL_INVESTIGATION)return approveInvestigation(body,env,requestId);
  if(body?.action===ACTIONS.CREATE_GMAIL_DRAFT)return createGmailDraft(body,env,requestId);
  return null;
}
async function beginAuth(url,env){
  requireSecrets(env);
  const returnTo=safeReturn(url.searchParams.get("return_to"));
  const osLogin=url.searchParams.get("os_login")==="1";
  const state=await makeState({returnTo,issuedAt:Date.now(),osLogin},env.GOOGLE_CLIENT_SECRET);
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
    const osSessionToken=state.osLogin
      ? await createOsSessionToken({email:profile.emailAddress,secret:env.GOOGLE_CLIENT_SECRET})
      : null;
    return callbackPage(true,state.osLogin?"GCM OS sign-in complete":"Gmail connected",state.osLogin?`${profile.emailAddress} is verified. Continue to Work With Me.`:`${profile.emailAddress} is connected. Approved monitoring can be marked read after D1 preservation.`,state.returnTo,200,osSessionToken);
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
    listUrl.searchParams.set("q",'is:unread -in:spam -in:trash {(in:inbox -category:promotions -category:social) label:Kristy label:"Frank & Adrianne Stuff"}');
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

    if(body?.archiveOnly===true){
      const message=await readMessage(gmailMessageId,accessToken);
      const analyzed=await analyzePreviewMessage(message,env,`${requestId}-archive-approval`);
      const intel=analyzed.intelligence||{};
      if(!intel.archive){
        return jsonResponse({
          ok:false,
          requestId,
          action:ACTIONS.APPROVE_GMAIL_MONITORING,
          error:"This email is no longer classified as an Archive Candidate. Gmail was left unchanged for review.",
          intelligence:intel
        },409);
      }
      await archiveMessage(gmailMessageId,accessToken);
      return jsonResponse({
        ok:true,
        requestId,
        action:ACTIONS.APPROVE_GMAIL_MONITORING,
        archiveOnly:true,
        writesPerformed:0,
        gmailArchived:true,
        gmailMarkedRead:true
      });
    }

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
    const monitoringMetrics=intel.monitoringMetrics&&typeof intel.monitoringMetrics==="object"?intel.monitoringMetrics:null;
    const metricsNote=monitoringMetrics?`Monitoring metrics: ${JSON.stringify(monitoringMetrics)}`:"";
    const notes=[
      `Business meaning: ${clean(intel.businessMeaning)}`,
      metricsNote,
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


async function approveInvestigation(body,env,requestId){
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

    const existing=await db.prepare(`
      SELECT
        c.id AS communication_id,
        i.id AS investigation_id,
        c.client_id,
        c.subject
      FROM communications c
      LEFT JOIN investigations i ON i.communication_id=c.id
      WHERE c.external_id=?
      ORDER BY i.id DESC
      LIMIT 1
    `).bind(sourceReference).first();

    if(existing?.communication_id&&existing?.investigation_id){
      await markMessageRead(gmailMessageId,accessToken);
      return jsonResponse({
        ok:true,
        requestId,
        action:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
        duplicate:true,
        writesPerformed:0,
        gmailMarkedRead:true,
        communicationId:existing.communication_id,
        investigationId:existing.investigation_id,
        workItemId:null
      });
    }

    if(existing?.communication_id&&!existing?.investigation_id){
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
        error:"This Gmail message is already linked to a Communication without an Investigation. Review the existing Communication before creating another production record."
      },409);
    }

    const message=await readMessage(gmailMessageId,accessToken);
    const analyzed=await analyzePreviewMessage(message,env,`${requestId}-investigation-approval`);
    const intel=analyzed.intelligence||{};
    const sourceDecision=intel.sourceAnalysis&&typeof intel.sourceAnalysis==="object"?intel.sourceAnalysis:{};
    const notificationType=clean(intel.notificationType).toLowerCase();
    const directIssueTypes=new Set(["page_indexing_issue","merchant_listing_structured_data","merchant_center_configuration"]);
    const routeRequestsInvestigation=Boolean(sourceDecision?.recommendedRoutes?.createInvestigation);
    const investigationCandidate=Boolean(
      intel.investigationCandidate ||
      intel.shouldCreateInvestigation ||
      (routeRequestsInvestigation&&directIssueTypes.has(notificationType))
    );

    if(!investigationCandidate){
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
        error:"This email is not currently a verified Investigation Candidate. Review its evidence and calibration before creating production records.",
        intelligence:intel
      },409);
    }

    const clientName=clean(intel.client);
    if(!clientName||/unassigned|human review/i.test(clientName)){
      return jsonResponse({ok:false,requestId,error:"A verified client match is required before an Investigation can be approved."},409);
    }

    const client=await db.prepare(`SELECT id,name,client_code FROM clients WHERE lower(name)=lower(?) LIMIT 1`).bind(clientName).first();
    if(!client?.client_code)return jsonResponse({ok:false,requestId,error:`No production client matched ${clientName}.`},409);

    const decision={
      ...sourceDecision,
      source:clean(sourceDecision.source)||clean(intel.communicationFamily)||"Gmail",
      communicationType:clean(sourceDecision.communicationType)||clean(intel.notificationType)||"Operational Alert",
      title:clean(sourceDecision.title)||clean(message.subject)||"Gmail Investigation",
      operationalSummary:clean(sourceDecision.operationalSummary)||clean(intel.businessMeaning)||clean(message.snippet)||"Gmail evidence requires investigation.",
      businessImpact:clean(sourceDecision.businessImpact)||clean(intel.businessMeaning),
      importance:clean(sourceDecision.importance)||clean(intel.operationalPriority)||"Medium",
      operationalPriority:clean(sourceDecision.operationalPriority)||clean(intel.operationalPriority)||"Medium",
      recommendedAction:clean(sourceDecision.recommendedAction)||clean(intel.recommendedAction)||"Investigate the reported condition and determine the required corrective action.",
      reasoning:clean(sourceDecision.reasoning)||`Human-approved Gmail Investigation candidate: ${clean(intel.communicationFamily)||notificationType}.`,
      recommendedRoutes:{
        saveCommunication:true,
        createInvestigation:true,
        createWorkItem:false,
        replyRequired:false
      }
    };

    const commitResponse=await handleCommitOperationalDecision({
      action:ACTIONS.COMMIT_OPERATIONAL_DECISION,
      clientCode:client.client_code,
      externalId:sourceReference,
      occurredAt:message.date,
      direction:"incoming",
      owner:"Andrew",
      rawContent:message.bodyText||message.snippet||message.subject,
      decision
    },env,`${requestId}-commit`);

    const commit=await commitResponse.json();
    if(!commitResponse.ok||commit?.ok!==true){
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
        error:typeof commit?.error==="string"?commit.error:commit?.error?.message||"The operational decision could not be committed.",
        commit
      },commitResponse.status||500);
    }

    if(!commit.duplicate&&(!commit.communicationId||!commit.investigationId||commit.workItemId)){
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
        error:"D1 did not confirm exactly one Communication plus one Investigation with no Work Item. Gmail was left unread for review.",
        commit
      },500);
    }

    if(commit.duplicate&&!commit.communicationId){
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
        error:"Duplicate protection triggered without a confirmed Communication ID. Gmail was left unread for review.",
        commit
      },500);
    }

    await markMessageRead(gmailMessageId,accessToken);

    return jsonResponse({
      ok:true,
      requestId,
      action:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
      duplicate:Boolean(commit.duplicate),
      writesPerformed:commit.duplicate?0:2,
      gmailMarkedRead:true,
      communicationId:commit.communicationId||null,
      investigationId:commit.investigationId||null,
      workItemId:null,
      client:{
        id:client.id,
        clientCode:client.client_code,
        name:client.name
      }
    });
  }catch(error){
    logWorkerError({
      requestId,
      route:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
      stage:"gmail_investigation_approval",
      error
    });
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.APPROVE_GMAIL_INVESTIGATION,
      error:safeErrorMessage(error)
    },500);
  }
}

async function createGmailDraft(body,env,requestId){
  const to=clean(body?.to);
  const subject=clean(body?.subject);
  const messageBody=String(body?.body||"").trim();
  const attachment=body?.attachment&&typeof body.attachment==="object"?body.attachment:null;
  const fileName=clean(attachment?.fileName);
  const mimeType=clean(attachment?.mimeType)||"application/octet-stream";
  const base64=String(attachment?.base64||"").replace(/\s+/g,"");
  if(!to||!subject||!messageBody)return jsonResponse({ok:false,requestId,error:"Draft recipient, subject, and body are required."},400);
  if(!fileName||!base64)return jsonResponse({ok:false,requestId,error:"A physical attachment filename and base64 payload are required."},400);
  try{
    const db=requireDb(env);
    await ensureTable(db);
    const connection=await db.prepare(`SELECT account_email,encrypted_refresh_token,scope FROM gmail_connections ORDER BY updated_at DESC LIMIT 1`).first();
    if(!connection)return jsonResponse({ok:false,requestId,error:"Gmail is not connected."},401);
    const refreshToken=await decrypt(connection.encrypted_refresh_token,env.GOOGLE_CLIENT_SECRET);
    const accessToken=await refreshAccessToken(refreshToken,env);
    const boundary=`GCM_OS_${Date.now()}_${crypto.randomUUID().replace(/-/g,"")}`;
    const safeName=fileName.replace(/[\r\n"]/g,"_");
    const raw=[
      `To: ${to}`,
      `Subject: ${encodeMimeHeader(subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      wrapMimeBase64(bytesToStandardBase64(new TextEncoder().encode(messageBody))),
      "",
      `--${boundary}`,
      `Content-Type: ${mimeType}; name="${safeName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${safeName}"`,
      "",
      wrapMimeBase64(base64),
      "",
      `--${boundary}--`,
      ""
    ].join("\r\n");
    const response=await fetch(`${API}/users/me/drafts`,{
      method:"POST",
      headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},
      body:JSON.stringify({message:{raw:encode(new TextEncoder().encode(raw))}})
    });
    const data=await response.json();
    if(!response.ok||!data?.id)throw new Error(data?.error?.message||`Gmail draft creation failed with HTTP ${response.status}.`);
    const threadId=clean(data?.message?.threadId);
    return jsonResponse({ok:true,requestId,action:ACTIONS.CREATE_GMAIL_DRAFT,gmailIntegrationVersion:GMAIL_INTEGRATION_VERSION,draftId:data.id,messageId:data?.message?.id||null,threadId:threadId||null,gmailUrl:threadId?`https://mail.google.com/mail/u/0/#drafts/${encodeURIComponent(threadId)}`:"https://mail.google.com/mail/u/0/#drafts",to,subject,attachmentFileName:fileName,sent:false,writesPerformed:0});
  }catch(error){
    logWorkerError({requestId,route:ACTIONS.CREATE_GMAIL_DRAFT,stage:"gmail_draft_creation",error});
    return jsonResponse({ok:false,requestId,action:ACTIONS.CREATE_GMAIL_DRAFT,error:safeErrorMessage(error)},500);
  }
}
function bytesToStandardBase64(bytes){let binary="";const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(binary);}
function wrapMimeBase64(value){return String(value||"").match(/.{1,76}/g)?.join("\r\n")||"";}
function encodeMimeHeader(value){return `=?UTF-8?B?${bytesToStandardBase64(new TextEncoder().encode(String(value||"")))}?=`;}

async function archiveMessage(gmailMessageId,accessToken){
  const response=await fetch(`${API}/users/me/messages/${encodeURIComponent(gmailMessageId)}/modify`,{
    method:"POST",
    headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},
    body:JSON.stringify({removeLabelIds:["UNREAD","INBOX"]})
  });
  const data=await response.json();
  if(!response.ok){
    const message=data?.error?.message||`Gmail archive failed with HTTP ${response.status}.`;
    if(response.status===403)throw new Error(`${message} Reconnect Gmail once to grant permission to archive messages.`);
    throw new Error(message);
  }
  return data;
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
function monitoringCategory(type){const map={position_tracking:"SEO Ranking Alert",search_performance:"Search Performance Notification",site_audit:"Technical SEO Audit Alert",backlink_audit:"SEO Backlink Alert",analytics:"Analytics Notification",business_profile:"Local Presence Notification",youtube_performance:"YouTube Performance"};return map[clean(type).toLowerCase()]||"Monitoring Intelligence";}

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
    evidenceText:(bodyText||clean(data.snippet)).slice(0,6000),
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
  const youtubeMonthly=isYouTubeMonthlyPerformance(message);
  const analyticsPerformance=isGoogleAnalyticsPerformance(message);
  if(analyticsPerformance){
    const metrics=extractGoogleAnalyticsMetrics(message.bodyText);
    const client=inferAnalyticsClient(message);
    const metricParts=[
      metrics.activeUsers!==null?`${metrics.activeUsers} active users`:"",
      metrics.newUsers!==null?`${metrics.newUsers} new users`:"",
      metrics.averageEngagementTime?`${metrics.averageEngagementTime} average engagement time`:"",
      metrics.eventCount!==null?`${metrics.eventCount} events`:""
    ].filter(Boolean);
    const hasMetrics=metricParts.length>0;
    const verifiedClient=Boolean(client);
    return{
      communicationFamily:"Google Analytics Performance",
      notificationType:"analytics",
      client:verifiedClient?client:"Unassigned â€” Human Review",
      businessMeaning:verifiedClient
        ? `Google Analytics performance for ${client}: ${metricParts.join(", ")||"report metrics received"}. Preserve these metrics as monitoring evidence for future growth or decline comparison.`
        : `Google Analytics performance report received${hasMetrics?`: ${metricParts.join(", ")}`:""}, but the Gmail evidence does not prove which GCM client/property owns the report.`,
      operationalPriority:"Low",
      recommendedAction:verifiedClient
        ? "Save the Google Analytics metrics as monitoring evidence so the next report can be compared for growth or decline."
        : "Verify the Google Analytics property/client before saving these metrics. Do not assign the report from page names or unrelated text alone.",
      shouldCreateCommunication:false,
      shouldCreateInvestigation:false,
      investigationCandidate:false,
      shouldCreateWorkItem:false,
      monitoringOnly:verifiedClient,
      monitoringMetrics:metrics,
      archive:false,
      proposedRoute:verifiedClient?"Monitoring":"Manual Review",
      confidence:verifiedClient&&hasMetrics?"High":hasMetrics?"Medium":"Low",
      decisionReliability:verifiedClient?"Reliable â€” Analytics report and client/property matched":"Review Required â€” Analytics metrics found but client/property is unverified",
      evidenceSufficiency:verifiedClient?"Sufficient for monitoring and future trend comparison":"Insufficient for client assignment",
      evidenceComparedAgainst:"Current Gmail message; future reports can compare against an approved saved monitoring record",
      verificationRequired:verifiedClient?"No investigation required. Human approval saves the current Analytics metrics as the comparison reference.":"Open the Analytics report or verify the property identity before approving any client monitoring record.",
      humanReviewRequired:true,
      productionDecisionReady:verifiedClient,
      sourceAnalysis:decision
    };
  }
  if(youtubeMonthly){
    const metrics=extractYouTubeMonthlyMetrics(message.bodyText);
    const client=inferYouTubeClient(message)||analysis?.client?.name||"Unassigned â€” Human Review";
    const metricParts=[
      metrics.newSubscribers!==null?`${metrics.newSubscribers} new subscriber${metrics.newSubscribers===1?"":"s"}`:"",
      metrics.minutesWatched!==null?`${metrics.minutesWatched} minutes watched`:"",
      metrics.totalViews!==null?`${metrics.totalViews} total views`:""
    ].filter(Boolean);
    const hasMetrics=metricParts.length>0;
    return{
      communicationFamily:"YouTube Monthly Performance",
      notificationType:"youtube_performance",
      client,
      businessMeaning:hasMetrics
        ? `YouTube monthly performance for ${client}: ${metricParts.join(", ")}. Preserve these metrics as monitoring evidence for future growth or decline comparison.`
        : `YouTube monthly performance was received for ${client}. Preserve the report as monitoring evidence for future comparison.`,
      operationalPriority:"Low",
      recommendedAction:"Save the monthly YouTube metrics as monitoring evidence so the next report can be compared for growth or decline.",
      shouldCreateCommunication:false,
      shouldCreateInvestigation:false,
      investigationCandidate:false,
      shouldCreateWorkItem:false,
      monitoringOnly:true,
      monitoringMetrics:metrics,
      archive:false,
      proposedRoute:"Monitoring",
      confidence:hasMetrics?"High":"Medium",
      decisionReliability:hasMetrics?"Reliable â€” monthly metrics extracted":"Moderate â€” monthly report recognized",
      evidenceSufficiency:hasMetrics?"Sufficient for monitoring and future trend comparison":"Sufficient to retain as monitoring evidence",
      evidenceComparedAgainst:"Current Gmail message; future reports can compare against this saved monitoring record",
      verificationRequired:"No investigation required. Human approval saves the current monthly metrics as the comparison reference.",
      humanReviewRequired:true,
      productionDecisionReady:true,
      sourceAnalysis:decision
    };
  }
  const billingOperational=buildBillingRecommendation(message,analysis,decision);
  if(billingOperational)return billingOperational;
  const promotionalOperational=buildPromotionalRecommendation(message,analysis,decision);
  if(promotionalOperational)return promotionalOperational;
  const humanOperational=buildKnownHumanRecommendation(message,analysis,decision);
  if(humanOperational)return humanOperational;

  const hbgMerchantCenter=isHbgMerchantCenterStoreRatings(message);
  if(hbgMerchantCenter){
    return{
      communicationFamily:"Google Merchant Center",
      notificationType:"merchant_center_configuration",
      client:"HB Guns",
      businessMeaning:"Google Merchant Center account 5611556858 is associated with Harry Beckwith Guns & Range. Human verification found the account setup incomplete, with no product data source and zero product clicks. The account requires investigation before any configuration changes are made.",
      operationalPriority:"Normal",
      recommendedAction:"Create an HBG Communication + Investigation to determine why Merchant Center is incomplete, whether HBG should have an active product feed, and whether completing the setup is a worthwhile growth action. Do not create a Work Item until the investigation establishes the corrective action.",
      shouldCreateCommunication:true,
      shouldCreateInvestigation:true,
      investigationCandidate:true,
      shouldCreateWorkItem:false,
      monitoringOnly:false,
      archive:false,
      proposedRoute:"Investigation",
      confidence:"High",
      decisionReliability:"Reliable â€” Merchant Center account and HBG identity verified by human review",
      evidenceSufficiency:"Sufficient to open an investigation; insufficient to prescribe corrective work",
      evidenceComparedAgainst:"Gmail Merchant Center notice plus human verification of Merchant Center account 5611556858",
      verificationRequired:"Investigate the existing Merchant Center configuration and product eligibility before making setup changes.",
      humanReviewRequired:true,
      productionDecisionReady:true,
      sourceAnalysis:{
        ...decision,
        source:"Google Merchant Center",
        communicationType:"Merchant Center Configuration",
        title:"HBG â€” Google Merchant Center configuration and product feed investigation",
        operationalSummary:"Harry Beckwith Guns & Range has Merchant Center account 5611556858. Human verification found setup incomplete, no product data source, and zero product clicks.",
        businessImpact:"Potential unused Google product-distribution opportunity; current value and required configuration are not yet proven.",
        importance:"Normal",
        operationalPriority:"Normal",
        recommendedAction:"Determine whether HBG should have an active Merchant Center product feed and what configuration, if any, is justified.",
        reasoning:"Human review verified that the Merchant Center email belongs to HBG and uncovered an incomplete account with no product source. Preserve the email as evidence and investigate before creating corrective work.",
        recommendedRoutes:{saveCommunication:true,createInvestigation:true,createWorkItem:false,replyRequired:false}
      }
    };
  }
  const github=/github|notifications@github\.com/.test(sourceText);
  const githubFailure=github&&/(failed|failure|error|cancelled|timed out|deployment failed|build failed|workflow run failed|checks? failed|action required|security alert|vulnerability)/i.test(sourceText);
  if(github){
    return{
      communicationFamily:"GitHub / Development Operations",
      notificationType:githubFailure?"production_or_build_failure":"routine_repository_notification",
      client:analysis?.client?.name||"GCM â€” Internal",
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
      decisionReliability:githubFailure?"Provisional â€” failure confirmed, impact unverified":"Reliable â€” routine notice",
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
  const verifiedMonitoringClient=type==="position_tracking"?inferPositionTrackingClient(message):"";
  const calibration=buildDecisionCalibration({message,analysis,classification,decision,monitoringOnly,createInvestigation,verifiedMonitoringClient});
  const previewMeaning=buildConciseBusinessMeaning({message,analysis,classification,decision,createInvestigation:false,verifiedClient:verifiedMonitoringClient});
  const previewAction=buildConciseRecommendedAction({message,analysis,classification,decision,createInvestigation:false,monitoringOnly});
  const isKnownMonitoring=["position_tracking","search_performance","site_audit","backlink_audit"].includes(type);
  return{
    communicationFamily:classification.notificationFamily||decision.notificationFamily||"Unknown",
    notificationType:classification.notificationType||"unknown",
    client:verifiedMonitoringClient||analysis?.client?.name||"Unassigned â€” Human Review",
    businessMeaning:previewMeaning,
    operationalPriority:decision.operationalPriority||decision.importance||"Low",
    recommendedAction:previewAction,
    shouldCreateCommunication:isKnownMonitoring?false:saveCommunication&&calibration.productionDecisionReady,
    shouldCreateInvestigation:createInvestigation&&calibration.productionDecisionReady,
    investigationCandidate:createInvestigation&&(
      calibration.productionDecisionReady||["page_indexing_issue","merchant_listing_structured_data"].includes(type)
    ),
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

function buildKnownHumanRecommendation(message,analysis,decision){
  const sender=clean(message?.from).toLowerCase();
  const subject=clean(message?.subject);
  const body=clean(message?.bodyText);
  const text=`${subject}\n${body}`;
  const client=inferHumanClient(message)||analysis?.client?.name||"Unassigned â€” Human Review";
  const base={
    shouldCreateCommunication:false,
    shouldCreateInvestigation:false,
    investigationCandidate:false,
    shouldCreateWorkItem:false,
    monitoringOnly:false,
    archive:false,
    proposedRoute:"Human Review",
    confidence:"High",
    decisionReliability:"Role-aware preview â€” human judgment retained",
    evidenceSufficiency:"Current human email analyzed in sender-role context",
    evidenceComparedAgainst:"Current Gmail message and known sender role; existing OS records are not yet automatically matched",
    humanReviewRequired:true,
    productionDecisionReady:false,
    sourceAnalysis:decision
  };

  const isKristy=/\bkristy\b/.test(sender);
  const isAdrianne=/\badrianne\b/.test(sender);
  const isFrank=/\bfrank\b/.test(sender);
  const isTed=/\bted\b/.test(sender)&&/(liberty|safe|sales|regional|visit|scorecard)/i.test(text);

  if(isKristy){
    const mediaForge=/(media\s*forge|premium.*(?:image|photo)|accessor(?:y|ies)|liberty.*accessor)/i.test(text);
    const showCalendar=/(calendar of shows|show calendar|gun show|shows?\b.*(?:calendar|schedule|date))/i.test(text);
    const correctiveWork=/(canonical|sitemap|weebly|square platform|permalink|redirect|internal link|we move safes|shopify)/i.test(text)&&/(updated|added|verified|fixed|looked into|changed|rebuil|consolidat|cannot|can't|limitation)/i.test(text);
    const activeResearch=/(i(?:'|â€™)ll|i will|i need to|i(?:'|â€™)m going to|look back through|research|check into|look into)/i.test(text);
    const completedWork=/(i (?:updated|added|changed|fixed|created|built|rebuilt|consolidated)|has been updated|now outputs|i looked into)/i.test(text);
    const crossChannel=/(google (?:business )?profile|facebook|instagram|youtube|social|website|web site)/i.test(text);

    let notificationType="human_content_operations";
    let meaning=`Kristy sent operational website/content information${client&&!/unassigned/i.test(client)?` for ${client}`:""}. Her role is website/content execution; cross-channel coordination remains with GCM.`;
    let action="Review what Kristy completed or is doing, preserve useful work evidence, and decide whether Andy needs to coordinate a next step.";
    let verification="Determine whether the message reports completed work, active work, a request, or a cross-channel opportunity before creating any new record.";

    if(correctiveWork){
      notificationType="corrective_work_report";
      meaning=`Kristy is reporting corrective website work or a platform constraint${client&&!/unassigned/i.test(client)?` for ${client}`:""}. This is implementation evidence that may belong to existing investigation/work and may now require verification.`;
      action="Match this reply to the existing issue/work if possible. Verify the live change, preserve any unresolved platform constraint, rerun the relevant audit when appropriate, and record Proof of Work only after verification.";
      verification="Existing related work should be matched before creating a new investigation. Separate solved changes, platform constraints, future migration resolution, and still-in-progress work.";
    }else if(showCalendar){
      notificationType="future_event_planning";
      meaning="Kristy supplied or discussed show-calendar information. Show dates are future planning intelligence: Kristy handles show-related Facebook execution, while GCM owns broader coordination and support.";
      action="Preserve the show dates as planning memory and use them to work backward on media, Facebook support assets, and other appropriate channel opportunities before each show.";
      verification="Confirm the client/show dates and avoid treating the calendar as a one-time FYI; it should feed future planning.";
    }else if(mediaForge){
      notificationType="mediaforge_opportunity";
      meaning="Kristy is connecting the successful Liberty Premium image workflow to a possible next MediaForge use, such as new accessories. The same email may also contain separate completed-work information.";
      action="Preserve the MediaForge opportunity separately from any completed website work in the same email. Verify Liberty's accessory/model readiness before reopening production work.";
      verification="Treat this as a multi-signal human email: do not collapse a new MediaForge opportunity and unrelated completed work into one generic classification.";
    }else if(activeResearch){
      notificationType="work_in_progress_support_opportunity";
      meaning=`Kristy is actively working/researching website content${client&&!/unassigned/i.test(client)?` for ${client}`:""}. She is not automatically assigning the research to Andy; the opportunity is for GCM to support her while the work is still active.`;
      action="Review promptly and offer useful research/evidence support if it can help Kristy before she completes the work. Do not create an Andy investigation merely because Kristy says she will research something.";
      verification="Time-sensitive support opportunity; determine whether assistance is still useful before routing work.";
    }else if(completedWork||crossChannel){
      notificationType=completedWork?"completed_content_work":"content_coordination_signal";
      meaning=`Kristy is reporting website/content activity${client&&!/unassigned/i.test(client)?` for ${client}`:""}. Completed content may also create a separate cross-channel coordination opportunity for Andy/GCM.`;
      action="Preserve completed work as evidence when supported, then consider whether the content should be coordinated to Google Business Profile, Facebook, Instagram, YouTube, or other appropriate channels. Kristy does not own that broader coordination except show-related Facebook.";
      verification="Separate Kristy's executed work from Andy/GCM's possible cross-channel next action.";
    }

    return{...base,communicationFamily:"Human â€” Website / Content Operations",notificationType,client,businessMeaning:meaning,operationalPriority:(activeResearch||mediaForge)?"Normal":"Low",recommendedAction:action,verificationRequired:verification};
  }

  if(isAdrianne){
    const crossChannel=/(google (?:business )?profile|facebook|instagram|youtube|social|website|web site)/i.test(text);
    return{...base,communicationFamily:"Human â€” Leadership / Client Operations",notificationType:crossChannel?"content_coordination_signal":"operational_heads_up",client,businessMeaning:crossChannel?`Adrianne is participating in a human client/operations conversation${client&&!/unassigned/i.test(client)?` for ${client}`:""}. Platform names inside the thread are context, not proof that the email itself is a Google or social-platform notification.`:"Adrianne is providing client/operations context. Treat the human conversation by its business meaning rather than by platform words quoted inside the thread.",operationalPriority:"Normal",recommendedAction:crossChannel?"Review the underlying website/content change and decide what cross-channel coordination Andy/GCM owns. Do not reclassify Adrianne's human reply as a Google Business Profile notification merely because the thread mentions Google or social channels.":"Read the operational context, identify any explicit decision or follow-up Andy owns, and otherwise preserve it as human client context.",verificationRequired:"Create work only when the human conversation proves a concrete action, deadline, unresolved issue, or coordination responsibility."};
  }

  if(isFrank){
    return{...base,communicationFamily:"Human â€” Leadership / Client Operations",notificationType:"operational_heads_up",client,businessMeaning:"Frank is providing an operational heads-up or client/business context. The message should inform Andy's coordination, but it is not automatically website-content work or a new investigation.",operationalPriority:"Normal",recommendedAction:"Read the heads-up in context, identify any explicit decision or follow-up Andy owns, and otherwise preserve it as relationship/operational context rather than inventing work.",verificationRequired:"Only create work when Frank's message contains or proves a concrete action, decision, deadline, or issue."};
  }

  if(isTed){
    const visit=/\bvisit|coming|meet(?:ing)?|stop(?:ping)? by|scorecards?/i.test(text);
    return{...base,communicationFamily:"Human â€” Liberty Corporate / Regional Sales",notificationType:visit?"manufacturer_visit_preparation":"manufacturer_relationship_update",client:client&&!/unassigned/i.test(client)?client:"Southeast Safes",businessMeaning:visit?"Ted, Liberty Safe's regional sales manager, is signaling an upcoming visit/meeting. His communications can cover new/upcoming Liberty products, programs, scorecards, dealer matters, and other Liberty corporate business.":"Ted is providing Liberty corporate/regional sales relationship intelligence.",operationalPriority:visit?"Normal":"Low",recommendedAction:visit?"Prepare for the visit by surfacing relevant Liberty issues, upcoming products, MediaForge dependencies, dealer/co-op matters, performance questions, and other open items already known to GCM. Review any attached scorecards.":"Preserve the Liberty relationship context and surface any concrete follow-up Andy should prepare.",verificationRequired:visit?"Confirm visit timing and review attachments/context before deciding what should be raised with Ted.":"Determine whether the update creates a concrete preparation or follow-up action."};
  }
  return null;
}
function buildBillingRecommendation(message,analysis,decision){
  const sender=clean(message?.from).toLowerCase();
  const subject=clean(message?.subject);
  const body=clean(message?.bodyText);
  const text=`${subject}\n${body}`;
  const isInvoice=/\binvoice\b/i.test(text);
  const isIheart=/iheartmedia|iheart media|hanselmann/i.test(`${sender}\n${text}`);
  if(!isInvoice||!isIheart)return null;
  const explicitClient=inferHumanClient(message);
  const client=explicitClient||analysis?.client?.name||"Unassigned â€” Human Review";
  return{
    communicationFamily:"Human â€” Finance / Media Operations",
    notificationType:"billing_coop_coordination",
    client,
    businessMeaning:`iHeartMedia sent an invoice${client&&!/unassigned/i.test(client)?` explicitly tied to ${client}`:""}. This is operational finance/media evidence: Adrianne handles payment and Kristy needs the invoice for co-op reporting.`,
    operationalPriority:"Normal",
    recommendedAction:"Route the invoice context to Adrianne for payment and Kristy for co-op reporting. Preserve the client association from the explicit invoice subject/body; do not assign it from unrelated account history.",
    shouldCreateCommunication:false,shouldCreateInvestigation:false,investigationCandidate:false,shouldCreateWorkItem:false,monitoringOnly:false,archive:false,proposedRoute:"Human Review",confidence:explicitClient?"High":"Medium",decisionReliability:explicitClient?"Reliable â€” invoice and client identity explicitly matched":"Review Required â€” invoice recognized but client identity is not explicit",evidenceSufficiency:"Sufficient for finance/co-op coordination; not evidence of completed client work",evidenceComparedAgainst:"Current Gmail invoice subject/body and known operational roles",verificationRequired:"Confirm the invoice attachment/details before payment or co-op submission. No investigation is implied by receipt of a normal invoice.",humanReviewRequired:true,productionDecisionReady:false,sourceAnalysis:decision
  };
}
function buildPromotionalRecommendation(message,analysis,decision){
  const sender=clean(message?.from).toLowerCase();
  const subject=clean(message?.subject);
  const body=clean(message?.bodyText);
  const text=`${subject}\n${body}`;
  const cloudflare=/cloudflare/.test(sender)||/cloudflare/i.test(text);
  const promo=/(last chance|\$\d+ off|promo(?:tion)?|discount|agents week|offer expires|register now)/i.test(text);
  if(!cloudflare||!promo)return null;
  return{
    communicationFamily:"Vendor â€” Promotional / Non-Operational",
    notificationType:"vendor_promotion",
    client:"GCM â€” Internal",
    businessMeaning:"Cloudflare promotional/marketing email. It does not establish a client issue, production failure, deadline, or operational work.",
    operationalPriority:"Low",recommendedAction:"Archive as non-operational promotional mail. Do not create a Communication, Investigation, Work Item, or monitoring record.",shouldCreateCommunication:false,shouldCreateInvestigation:false,investigationCandidate:false,shouldCreateWorkItem:false,monitoringOnly:false,archive:true,proposedRoute:"Archive",confidence:"High",decisionReliability:"Reliable â€” promotional language detected",evidenceSufficiency:"Sufficient to exclude from operational review",evidenceComparedAgainst:"Current Gmail sender, subject, and body",verificationRequired:"None unless the message separately reports a production/security/account issue.",humanReviewRequired:false,productionDecisionReady:true,sourceAnalysis:decision
  };
}
function inferHumanClient(message){
  const text=`${clean(message?.subject)}\n${clean(message?.bodyText)}`.toLowerCase();
  const rules=[
    [/southfloridasafes\.com|south florida safes/,"South Florida Safes"],
    [/northfloridasafes\.com|north florida safes/,"North Florida Safes"],
    [/sesafes\.com|southeast safes/,"Southeast Safes"],
    [/a1actionsafeandlock\.com|a1 action safe(?: & lock)?/,"A1 Action Safe & Lock"],
    [/hbguns\.com|hb guns|harry beckwith guns/,"HB Guns"],
    [/pickettweaponry\.com|pickett weaponry/,"Pickett Weaponry"],
    [/moveasafe\.com|move a safe/,"Move A Safe"],
    [/globalconceptsmedia\.com|global concepts media/,"Global Concepts Media"]
  ];
  for(const [pattern,name] of rules)if(pattern.test(text))return name;
  return "";
}

function inferPositionTrackingClient(message){
  const text=`${clean(message?.subject)}\n${clean(message?.bodyText)}`.toLowerCase();
  const rules=[
    [/\bnorthfloridasafes\.com\b|\bnorth florida safes\b/,"North Florida Safes"],
    [/\bsouthfloridasafes\.com\b|\bsouth florida safes\b/,"South Florida Safes"],
    [/\bsesafes\.com\b|\bsoutheast safes\b/,"Southeast Safes"],
    [/\ba1actionsafeandlock\.com\b|\ba1 action safe(?: & lock)?\b/,"A1 Action Safe & Lock"],
    [/\bhbguns\.com\b|\bhb guns\b|\bharry beckwith guns\b/,"HB Guns"],
    [/\bpickettweaponry\.com\b|\bpickett weaponry\b/,"Pickett Weaponry"],
    [/\bmoveasafe\.com\b|\bmove a safe\b/,"Move A Safe"],
    [/\bglobalconceptsmedia\.com\b|\bglobal concepts media\b/,"Global Concepts Media"]
  ];
  for(const [pattern,name] of rules)if(pattern.test(text))return name;
  return "";
}

function isHbgMerchantCenterStoreRatings(message){
  const sender=clean(message?.from).toLowerCase();
  const text=`${clean(message?.subject)}\n${clean(message?.bodyText)}`;
  return /google|merchant/i.test(sender)&&
    /harry beckwith guns(?: & range)?/i.test(text)&&
    /(?:merchant center|store ratings|google customer reviews|5611556858)/i.test(text);
}
function isGoogleAnalyticsPerformance(message){
  const sender=clean(message?.from).toLowerCase();
  const subject=clean(message?.subject);
  const body=clean(message?.bodyText);
  return /(?:google analytics|analytics-noreply@google\.com)/i.test(sender)&&
    /(?:google analytics performance report|performance report)/i.test(subject)&&
    /(?:active users|new users|average engagement|engagement time|events|views)/i.test(body);
}
function extractGoogleAnalyticsMetrics(value){
  const text=sanitizeEmailText(value);
  const summary=text.split(/\bView report snapshot\b/i)[0];
  const lines=summary
    .split(/\r?\n/)
    .map(line=>clean(line))
    .filter(Boolean);

  const parseMetricNumber=value=>{
    const raw=String(value||"").replace(/,/g,"").trim();
    // Metric suffixes are valid only when attached directly to the number.
    // This prevents the first letter of a following label (for example
    // "Bounce Rate") from being misread as B = billion.
    const match=raw.match(/^([\d]+(?:\.[\d]+)?)([KMB])?$/i);
    if(!match)return null;
    const base=Number(match[1]);
    if(!Number.isFinite(base))return null;
    const suffix=(match[2]||"").toUpperCase();
    const multiplier=suffix==="K"?1000:suffix==="M"?1000000:suffix==="B"?1000000000:1;
    return Math.round(base*multiplier);
  };

  const findSummaryValue=label=>{
    const index=lines.findIndex(line=>label.test(line));
    if(index<0)return "";
    // Google Analytics emails place all four labels first, followed by the
    // four metric values and their percentage deltas. Prefer the ordered
    // summary block rather than later page/screen tables.
    const labels=[/^(?:active users)$/i,/^(?:new users)$/i,/^(?:avg|average) engagement time$/i,/^events$/i];
    const labelIndexes=labels.map(pattern=>lines.findIndex(line=>pattern.test(line)));
    const lastLabel=Math.max(...labelIndexes);
    if(lastLabel>=0){
      const values=lines.slice(lastLabel+1).filter(line=>
        /^(?:[\d,.]+(?:[KMB])?|[\d.]+(?:s|sec|secs|seconds?|m|min|mins|minutes?))$/i.test(line)
      );
      const metricPosition=labelIndexes.findIndex(i=>i===index);
      if(metricPosition>=0&&values[metricPosition])return values[metricPosition];
    }
    return "";
  };

  const activeRaw=findSummaryValue(/^active users$/i);
  const newRaw=findSummaryValue(/^new users$/i);
  const engagementRaw=findSummaryValue(/^(?:avg|average) engagement time$/i);
  const eventsRaw=findSummaryValue(/^events$/i);

  return{
    activeUsers:parseMetricNumber(activeRaw),
    newUsers:parseMetricNumber(newRaw),
    averageEngagementTime:clean(engagementRaw),
    eventCount:parseMetricNumber(eventsRaw)
  };
}
function inferAnalyticsClient(message){
  const subject=clean(message?.subject).toLowerCase();
  const body=clean(message?.bodyText).toLowerCase();
  // Strong identity evidence only. Body matches require an explicit Analytics property/project label;
  // page/screen names are intentionally excluded because they can mention unrelated brands.
  const strongText=subject;
  const propertyText=(body.match(/(?:property|account|stream|website)\s*(?:name|:)?\s*[^\n]{0,140}/gi)||[]).join(" ");
  const text=`${strongText} ${propertyText}`;
  const rules=[
    [/a1[- ]?action safe|a1 action safe|a1actionsafeandlock/,"A1 Action Safe & Lock"],
    [/southeast safes|southeast-safes|sesafes/,"Southeast Safes"],
    [/south florida safes|south-florida-s|southfloridasafes/,"South Florida Safes"],
    [/north florida safes|northfloridasafes/,"North Florida Safes"],
    [/harry beckwith guns|hb guns|hbguns/,"HB Guns"],
    [/pickett weaponry|pickettweaponry/,"Pickett Weaponry"],
    [/move a safe|moveasafe/,"Move A Safe"],
    [/global concepts media|globalconceptsmedia/,"Global Concepts Media"]
  ];
  for(const [pattern,name] of rules)if(pattern.test(text))return name;
  return "";
}

function isYouTubeMonthlyPerformance(message){
  const sender=clean(message?.from).toLowerCase();
  const subject=clean(message?.subject);
  const body=clean(message?.bodyText);
  return /(?:youtube creators|no-reply@youtube\.com)/i.test(sender)&&
    /(?:your\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+month in review is here/i.test(subject)&&
    /(?:minutes watched|total views|new subscribers?)/i.test(body);
}
function extractYouTubeMonthlyMetrics(value){
  const text=sanitizeEmailText(value);
  const first=(patterns)=>{for(const pattern of patterns){const m=text.match(pattern);if(m)return Number(String(m[1]).replace(/,/g,""));}return null;};
  return{
    newSubscribers:first([/([\d,]+)\s+new subscribers?/i,/new subscribers?\s+([\d,]+)/i]),
    minutesWatched:first([/([\d,]+)\s+minutes watched/i,/minutes watched\s+([\d,]+)/i]),
    totalViews:first([/([\d,]+)\s+total views/i,/total views\s+([\d,]+)/i])
  };
}
function inferYouTubeClient(message){
  const subject=clean(message?.subject).toLowerCase();
  const recipient=clean(message?.to).toLowerCase();
  const text=`${subject} ${recipient}`;
  const rules=[
    [/a1[- ]?action safe|a1 action safe|a1actionsafeandlock/,"A1 Action Safe & Lock"],
    [/southeast safes|southeast-safes|sesafes/,"Southeast Safes"],
    [/south florida safes|south-florida-s|southfloridasafes/,"South Florida Safes"],
    [/north florida safes|northfloridasafes/,"North Florida Safes"],
    [/harry beckwith guns|hb guns|hbguns/,"HB Guns"],
    [/pickett weaponry|pickettweaponry/,"Pickett Weaponry"],
    [/move a safe|moveasafe/,"Move A Safe"],
    [/global concepts media|globalconceptsmedia/,"Global Concepts Media"]
  ];
  for(const [pattern,name] of rules)if(pattern.test(text))return name;
  return "";
}

function buildDecisionCalibration({message,analysis,classification,decision,monitoringOnly,createInvestigation,verifiedMonitoringClient}){
  const type=clean(classification?.notificationType).toLowerCase();
  const evidenceText=[message.subject,message.bodyText,...(analysis?.evidence?.visibleMetrics||[]),...(analysis?.evidence?.visibleFacts||[])].filter(Boolean).join(" ");
  const hasKeywordMovement=/\b(keyword|position|rank|ranking)\b/i.test(evidenceText)&&/(moved|changed|gained|lost|up|down|position\s*\d+)/i.test(evidenceText);
  const hasSearchMetrics=/\b(clicks?|impressions?|ctr|average position)\b/i.test(evidenceText)&&/\b\d[\d,.]*\b/.test(evidenceText);
  const hasAuditMetrics=/\b(errors?|warnings?|notices?|site health|broken pages?)\b/i.test(evidenceText)&&/\b\d[\d,.%]*\b/.test(evidenceText);
  if(type==="position_tracking"){
    const adverseSignal=/(rankings? declined|rankings? decreased|lost rankings?|visibility[^\n]{0,40}-\d|traffic[^\n]{0,40}-\d)/i.test(evidenceText);
    const routineMonitoringReady=Boolean(verifiedMonitoringClient)&&hasKeywordMovement&&!adverseSignal;
    return{
      decisionReliability:routineMonitoringReady?"Reliable â€” verified client and current ranking movement detected":hasKeywordMovement?"Moderate â€” current movement detected":"Low â€” movement detail incomplete",
      evidenceSufficiency:routineMonitoringReady?"Sufficient for monitoring; no adverse escalation signal proven":hasKeywordMovement?"Current report sufficient for monitoring; insufficient for escalation":"Insufficient for production decision",
      evidenceComparedAgainst:"Current Gmail message only; no prior Position Tracking record, investigation, baseline, or proof compared",
      verificationRequired:routineMonitoringReady?"No investigation required. Human approval may save this Position Tracking update as monitoring evidence.":"Compare the affected keyword, direction, current position, and prior report. Then decide whether to save monitoring evidence, attach it to existing work, or investigate.",
      productionDecisionReady:routineMonitoringReady,
      proposedRoute:routineMonitoringReady?"Monitoring":"Calibration Required"
    };
  }
  if(type==="search_performance")return{
    decisionReliability:hasSearchMetrics?"Moderate â€” current metrics detected":"Low â€” metric detail incomplete",
    evidenceSufficiency:hasSearchMetrics?"Current report sufficient for monitoring; insufficient for trend decision":"Insufficient for production decision",
    evidenceComparedAgainst:"Current Gmail message only; no prior Search Console period, baseline, investigation, or proof compared",
    verificationRequired:"Compare clicks, impressions, CTR, and position with the prior reporting period before approving monitoring or escalation.",
    productionDecisionReady:false,
    proposedRoute:"Calibration Required"
  };
  if(type==="site_audit"||type==="backlink_audit")return{
    decisionReliability:hasAuditMetrics?"Moderate â€” current condition detected":"Low â€” issue detail incomplete",
    evidenceSufficiency:"Current report is evidence, but change, cause, and client impact are not yet verified",
    evidenceComparedAgainst:"Current Gmail message only; no prior audit, open investigation, completed work, or proof compared",
    verificationRequired:"Compare the current issue counts and changes with the prior audit and any open investigation before approving a production route.",
    productionDecisionReady:false,
    proposedRoute:"Calibration Required"
  };
  return{
    decisionReliability:createInvestigation?"Provisional â€” escalation suggested":"Provisional â€” human judgment required",
    evidenceSufficiency:"Current email analyzed; broader client context not compared",
    evidenceComparedAgainst:"Current Gmail message only",
    verificationRequired:"Review the source email and compare it with relevant client records before approving any production action.",
    productionDecisionReady:false,
    proposedRoute:"Manual Review"
  };
}
function buildConciseBusinessMeaning({message,analysis,classification,decision,createInvestigation,verifiedClient}){
  const type=clean(classification?.notificationType).toLowerCase();
  const client=verifiedClient||analysis?.client?.name||"the client";
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
    client:"Unassigned â€” Human Review",
    businessMeaning:"The email was retrieved successfully, but operational intelligence could not be completed.",
    operationalPriority:"Normal",
    recommendedAction:`Review this email manually. Analysis error: ${safeErrorMessage(error)}`,
    shouldCreateCommunication:false,
    shouldCreateInvestigation:false,
    investigationCandidate:false,
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
  const plainText=clean(plain.join("\n\n"));
  const htmlText=clean(html.join("\n\n"));
  if(!plainText)return htmlText;
  if(!htmlText)return plainText;

  // Multipart/alternative emails often contain a short text/plain summary while
  // the useful report table exists only in text/html. Preserve the richer body
  // instead of automatically discarding HTML whenever plain text is present.
  const plainScore=evidenceRichnessScore(plainText);
  const htmlScore=evidenceRichnessScore(htmlText);
  return htmlScore>plainScore?htmlText:plainText;
}
function evidenceRichnessScore(value){
  const text=clean(value);
  if(!text)return 0;
  const numericTokens=(text.match(/(?:^|\s)[+-]?\d+(?:[.,]\d+)?%?(?=\s|$)/g)||[]).length;
  const seoTerms=(text.match(/\b(keyword|position|rank|ranking|change|traffic|clicks?|impressions?|errors?|warnings?|notices?|site health|canonical|redirect|url)\b/gi)||[]).length;
  return text.length+(numericTokens*40)+(seoTerms*25);
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
function callbackPage(ok,title,message,returnTo,status,osSessionToken=null){const destination=new URL(safeReturn(returnTo));if(osSessionToken)destination.hash=`gcm_os_session=${encodeURIComponent(osSessionToken)}`;return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f7fb;font-family:system-ui;color:#132238}.card{max-width:560px;padding:32px;border:1px solid #dbe2ec;border-radius:22px;background:#fff}a{display:inline-block;padding:12px 18px;border-radius:11px;background:#1f68d8;color:#fff;text-decoration:none;font-weight:800}</style></head><body><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="${escapeHtml(destination.toString())}">${osSessionToken?"Open Work With Me":"Return to Today"}</a></main></body></html>`,{status,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});}
