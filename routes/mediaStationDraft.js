/* =========================================================
   Global Concepts Media Operating System
   File: routes/mediaStationDraft.js
   Version: 1.0.0
   Status: Production Candidate
   Sprint: Complete Station Email Package
   Purpose: Build operator-approved station Gmail drafts with multiple
            attachments while preserving attachment metadata on the same
            Media traffic package.

   Production rules:
   - Nothing sends automatically.
   - The saved traffic package supplies To, CC, subject, and body.
   - The physical audio file is supplied by the operator at draft time.
   - Script content comes only from a saved Creative script field selected
     by the operator: Final, Co-op, or Approved Script.
   - Attachment metadata is stored in D1; large attachment bytes are not.
   ========================================================= */

import { VERSION, ACTIONS } from "../shared/config.js";
import { clean, safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase } from "../shared/database.js";

export const MEDIA_STATION_DRAFT_OPERATIONS = Object.freeze([
  "get_station_package_attachments",
  "save_station_package_attachments",
  "create_station_gmail_draft"
]);

const TOKEN_URL="https://oauth2.googleapis.com/token";
const GMAIL_API="https://gmail.googleapis.com/gmail/v1";

export async function handleMediaStationDraft(operation,body,env,requestId){
  const db=getDatabase(env);
  if(!db||typeof db.prepare!=="function"){
    return reply({ok:false,error:"The production D1 binding is unavailable."},503);
  }

  try{
    if(operation==="get_station_package_attachments"){
      return await getAttachments(body,db,requestId);
    }
    if(operation==="save_station_package_attachments"){
      return await saveAttachmentSetup(body,db,requestId);
    }
    if(operation==="create_station_gmail_draft"){
      return await createStationDraft(body,db,env,requestId);
    }
    return reply({ok:false,error:`Unsupported Media station draft operation: ${operation}`},400);
  }catch(error){
    logWorkerError({
      requestId,
      route:ACTIONS.GET_MEDIA_OPERATIONS,
      stage:`media_station_draft_${operation}`,
      error
    });
    return reply({
      ok:false,
      error:"The Media station email package could not complete the requested operation.",
      details:safeErrorMessage(error)
    },500);
  }

  function reply(payload,status=200){
    return jsonResponse({
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      ...payload
    },status);
  }
}

async function getAttachments(body,db,requestId){
  const packageId=positiveInt(body?.trafficPackageId);
  const creativeId=positiveInt(body?.creativeId);
  const clauses=[];
  const binds=[];

  if(packageId){
    clauses.push("a.traffic_package_id = ?");
    binds.push(packageId);
  }
  if(creativeId){
    clauses.push("p.creative_id = ?");
    binds.push(creativeId);
  }

  const sql=`
    SELECT
      a.id,
      a.traffic_package_id,
      p.creative_id,
      a.attachment_type,
      a.source_type,
      a.file_name,
      a.mime_type,
      a.created_at,
      a.updated_at
    FROM media_traffic_package_attachments a
    INNER JOIN media_traffic_packages p ON p.id = a.traffic_package_id
    ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
    ORDER BY a.traffic_package_id, a.attachment_type
  `;

  const stmt=db.prepare(sql);
  const result=binds.length ? await stmt.bind(...binds).all() : await stmt.all();
  const rows=Array.isArray(result?.results)?result.results:[];

  return jsonResponse({
    ok:true,
    requestId,
    action:ACTIONS.GET_MEDIA_OPERATIONS,
    version:VERSION,
    operation:"get_station_package_attachments",
    attachments:rows.map(row=>({
      id:Number(row.id),
      trafficPackageId:Number(row.traffic_package_id),
      creativeId:Number(row.creative_id),
      attachmentType:String(row.attachment_type||""),
      sourceType:String(row.source_type||""),
      fileName:String(row.file_name||""),
      mimeType:row.mime_type==null?null:String(row.mime_type),
      createdAt:row.created_at==null?null:String(row.created_at),
      updatedAt:row.updated_at==null?null:String(row.updated_at)
    }))
  });
}

async function saveAttachmentSetup(body,db,requestId){
  const packageId=positiveInt(body?.trafficPackageId);
  if(!packageId){
    return jsonResponse({ok:false,requestId,action:ACTIONS.GET_MEDIA_OPERATIONS,version:VERSION,error:"trafficPackageId is required."},400);
  }

  const pkg=await db.prepare(`
    SELECT id, creative_id
    FROM media_traffic_packages
    WHERE id = ?
    LIMIT 1
  `).bind(packageId).first();

  if(!pkg){
    return jsonResponse({ok:false,requestId,action:ACTIONS.GET_MEDIA_OPERATIONS,version:VERSION,error:`Traffic package ${packageId} was not found.`},404);
  }

  const audioFileName=optional(body?.audioFileName);
  const scriptSource=normalizeScriptSource(body?.scriptSource);
  const scriptFileName=optional(body?.scriptFileName);

  if(audioFileName){
    await upsertAttachment(db,{
      packageId,
      attachmentType:"audio",
      sourceType:"operator_upload",
      fileName:audioFileName,
      mimeType:optional(body?.audioMimeType)||"audio/mpeg"
    });
  }

  if(scriptSource==="none"){
    await db.prepare(`
      DELETE FROM media_traffic_package_attachments
      WHERE traffic_package_id = ?
        AND attachment_type = 'script'
    `).bind(packageId).run();
  }else{
    const script=await savedScriptForCreative(db,Number(pkg.creative_id),scriptSource);
    if(!script.text){
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GET_MEDIA_OPERATIONS,
        version:VERSION,
        error:`The selected ${script.label} is empty. Save that script on the Creative record before attaching it.`
      },409);
    }
    if(!scriptFileName){
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GET_MEDIA_OPERATIONS,
        version:VERSION,
        error:"A script attachment filename is required."
      },400);
    }
    await upsertAttachment(db,{
      packageId,
      attachmentType:"script",
      sourceType:scriptSource,
      fileName:scriptFileName,
      mimeType:"text/plain; charset=UTF-8"
    });
  }

  return jsonResponse({
    ok:true,
    requestId,
    action:ACTIONS.GET_MEDIA_OPERATIONS,
    version:VERSION,
    operation:"save_station_package_attachments",
    trafficPackageId:packageId,
    creativeId:Number(pkg.creative_id),
    audioFileName:audioFileName||null,
    scriptSource,
    scriptFileName:scriptSource==="none"?null:scriptFileName
  });
}

async function createStationDraft(body,db,env,requestId){
  const packageId=positiveInt(body?.trafficPackageId);
  if(!packageId){
    return jsonResponse({ok:false,requestId,action:ACTIONS.GET_MEDIA_OPERATIONS,version:VERSION,error:"trafficPackageId is required."},400);
  }

  const pkg=await db.prepare(`
    SELECT
      p.id,
      p.creative_id,
      p.to_email,
      p.cc_email,
      p.subject,
      p.body_text,
      c.creative_name,
      c.client_id
    FROM media_traffic_packages p
    INNER JOIN media_creatives c ON c.id = p.creative_id
    WHERE p.id = ?
    LIMIT 1
  `).bind(packageId).first();

  if(!pkg){
    return jsonResponse({ok:false,requestId,action:ACTIONS.GET_MEDIA_OPERATIONS,version:VERSION,error:`Traffic package ${packageId} was not found.`},404);
  }

  const to=optional(pkg.to_email);
  const cc=optional(pkg.cc_email);
  const subject=optional(pkg.subject);
  const messageBody=optional(pkg.body_text);

  if(!to||!subject||!messageBody){
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:"Save the traffic package with To, Subject, and Email Body before creating the Gmail draft."
    },409);
  }

  const audio=normalizeAttachment(body?.audioAttachment);
  if(!audio){
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:"A physical final audio attachment is required."
    },400);
  }

  const scriptSource=normalizeScriptSource(body?.scriptSource);
  const scriptFileName=optional(body?.scriptFileName);
  const attachments=[audio];

  if(scriptSource!=="none"){
    const script=await savedScriptForCreative(db,Number(pkg.creative_id),scriptSource);
    if(!script.text){
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GET_MEDIA_OPERATIONS,
        version:VERSION,
        error:`The selected ${script.label} is empty. Save that script before creating the station draft.`
      },409);
    }
    if(!scriptFileName){
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.GET_MEDIA_OPERATIONS,
        version:VERSION,
        error:"A script attachment filename is required."
      },400);
    }
    attachments.push({
      fileName:scriptFileName,
      mimeType:"text/plain; charset=UTF-8",
      base64:bytesToStandardBase64(new TextEncoder().encode(script.text))
    });
  }

  const connection=await db.prepare(`
    SELECT account_email, encrypted_refresh_token
    FROM gmail_connections
    ORDER BY updated_at DESC
    LIMIT 1
  `).first();

  if(!connection){
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.GET_MEDIA_OPERATIONS,
      version:VERSION,
      error:"Gmail is not connected."
    },401);
  }

  requireGoogleSecrets(env);
  const refreshToken=await decrypt(connection.encrypted_refresh_token,env.GOOGLE_CLIENT_SECRET);
  const accessToken=await refreshAccessToken(refreshToken,env);

  const boundary=`GCM_MEDIA_${Date.now()}_${crypto.randomUUID().replace(/-/g,"")}`;
  const rawParts=[
    `To: ${to}`,
    cc?`Cc: ${cc}`:null,
    `Subject: ${encodeMimeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapMimeBase64(bytesToStandardBase64(new TextEncoder().encode(messageBody))),
    ""
  ].filter(value=>value!==null);

  for(const attachment of attachments){
    const safeName=attachment.fileName.replace(/[\r\n"]/g,"_");
    rawParts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${safeName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${safeName}"`,
      "",
      wrapMimeBase64(attachment.base64),
      ""
    );
  }

  rawParts.push(`--${boundary}--`,"");
  const raw=rawParts.join("\r\n");

  const gmailResponse=await fetch(`${GMAIL_API}/users/me/drafts`,{
    method:"POST",
    headers:{
      Authorization:`Bearer ${accessToken}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      message:{
        raw:encodeUrlSafe(new TextEncoder().encode(raw))
      }
    })
  });

  const gmail=await gmailResponse.json();
  if(!gmailResponse.ok||!gmail?.id){
    throw new Error(gmail?.error?.message||`Gmail draft creation failed with HTTP ${gmailResponse.status}.`);
  }

  const threadId=optional(gmail?.message?.threadId);

  await db.prepare(`
    UPDATE media_traffic_packages
    SET package_status = 'gmail_draft',
        gmail_draft_id = ?,
        gmail_thread_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(gmail.id,threadId,packageId).run();

  await upsertAttachment(db,{
    packageId,
    attachmentType:"audio",
    sourceType:"operator_upload",
    fileName:audio.fileName,
    mimeType:audio.mimeType
  });

  if(scriptSource==="none"){
    await db.prepare(`
      DELETE FROM media_traffic_package_attachments
      WHERE traffic_package_id = ?
        AND attachment_type = 'script'
    `).bind(packageId).run();
  }else{
    await upsertAttachment(db,{
      packageId,
      attachmentType:"script",
      sourceType:scriptSource,
      fileName:scriptFileName,
      mimeType:"text/plain; charset=UTF-8"
    });
  }

  await db.prepare(`
    INSERT INTO media_creative_history(
      creative_id, entry_type, stage, author, content, created_at
    ) VALUES(
      ?, 'traffic', 'Station Email Package', 'Andy', ?, CURRENT_TIMESTAMP
    )
  `).bind(
    Number(pkg.creative_id),
    `Gmail draft created for Traffic Package ${packageId} with ${attachments.length} attachment${attachments.length===1?"":"s"}; nothing sent.`
  ).run();

  return jsonResponse({
    ok:true,
    requestId,
    action:ACTIONS.GET_MEDIA_OPERATIONS,
    version:VERSION,
    operation:"create_station_gmail_draft",
    trafficPackageId:packageId,
    creativeId:Number(pkg.creative_id),
    draftId:gmail.id,
    messageId:gmail?.message?.id||null,
    threadId:threadId||null,
    gmailUrl:threadId
      ? `https://mail.google.com/mail/u/0/#drafts/${encodeURIComponent(threadId)}`
      : "https://mail.google.com/mail/u/0/#drafts",
    attachmentFileNames:attachments.map(item=>item.fileName),
    sent:false
  });
}

async function savedScriptForCreative(db,creativeId,source){
  const row=await db.prepare(`
    SELECT approved_script, final_script, coop_script
    FROM media_creatives
    WHERE id = ?
    LIMIT 1
  `).bind(creativeId).first();

  if(!row){
    return {label:"Script",text:""};
  }

  if(source==="coop_script"){
    return {label:"Co-op Script",text:optional(row.coop_script)||""};
  }
  if(source==="approved_script"){
    return {label:"Approved Script",text:optional(row.approved_script)||""};
  }
  return {label:"Final Script",text:optional(row.final_script)||""};
}

async function upsertAttachment(db,{packageId,attachmentType,sourceType,fileName,mimeType}){
  await db.prepare(`
    INSERT INTO media_traffic_package_attachments(
      traffic_package_id,
      attachment_type,
      source_type,
      file_name,
      mime_type,
      created_at,
      updated_at
    ) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(traffic_package_id, attachment_type)
    DO UPDATE SET
      source_type = excluded.source_type,
      file_name = excluded.file_name,
      mime_type = excluded.mime_type,
      updated_at = CURRENT_TIMESTAMP
  `).bind(packageId,attachmentType,sourceType,fileName,mimeType).run();
}

function normalizeAttachment(value){
  if(!value||typeof value!=="object")return null;
  const fileName=optional(value.fileName);
  const base64=String(value.base64||"").replace(/\s+/g,"");
  const mimeType=optional(value.mimeType)||"application/octet-stream";
  if(!fileName||!base64)return null;
  return {fileName,mimeType,base64};
}

function normalizeScriptSource(value){
  const source=String(value||"final_script").trim().toLowerCase();
  return ["final_script","coop_script","approved_script","none"].includes(source)
    ? source
    : "final_script";
}

function optional(value){
  const text=String(value??"").trim();
  return text||null;
}

function positiveInt(value){
  const number=Number(value);
  return Number.isInteger(number)&&number>0?number:null;
}

function requireGoogleSecrets(env){
  if(!clean(env?.GOOGLE_CLIENT_ID)||!clean(env?.GOOGLE_CLIENT_SECRET)){
    throw new Error("Google OAuth secrets are not configured.");
  }
}

async function refreshAccessToken(refreshToken,env){
  const response=await fetch(TOKEN_URL,{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({
      client_id:env.GOOGLE_CLIENT_ID,
      client_secret:env.GOOGLE_CLIENT_SECRET,
      refresh_token:refreshToken,
      grant_type:"refresh_token"
    })
  });
  const data=await response.json();
  if(!response.ok||!data.access_token){
    throw new Error(data.error_description||data.error||"Google token refresh failed.");
  }
  return data.access_token;
}

async function cryptoKey(secret){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw",digest,"AES-GCM",false,["decrypt"]);
}

async function decrypt(value,secret){
  const [iv,data]=String(value||"").split(".");
  if(!iv||!data)throw new Error("Stored Gmail connection could not be decrypted.");
  const bytes=await crypto.subtle.decrypt(
    {name:"AES-GCM",iv:decodeUrlSafe(iv)},
    await cryptoKey(secret),
    decodeUrlSafe(data)
  );
  return new TextDecoder().decode(bytes);
}

function bytesToStandardBase64(bytes){
  let binary="";
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk){
    binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  }
  return btoa(binary);
}

function wrapMimeBase64(value){
  return String(value||"").match(/.{1,76}/g)?.join("\r\n")||"";
}

function encodeMimeHeader(value){
  return `=?UTF-8?B?${bytesToStandardBase64(new TextEncoder().encode(String(value||"")))}?=`;
}

function encodeUrlSafe(bytes){
  return bytesToStandardBase64(bytes)
    .replace(/\+/g,"-")
    .replace(/\//g,"_")
    .replace(/=+$/g,"");
}

function decodeUrlSafe(value){
  const normalized=String(value||"").replace(/-/g,"+").replace(/_/g,"/");
  const padded=normalized+"=".repeat((4-normalized.length%4)%4);
  return Uint8Array.from(atob(padded),character=>character.charCodeAt(0));
}
