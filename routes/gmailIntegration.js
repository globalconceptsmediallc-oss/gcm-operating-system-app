/* =========================================================
   Global Concepts Media Operating System
   File: routes/gmailIntegration.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Source: New production route
   Sprint: Morning Command — Gmail Read-Only Connection
   Purpose: Connect Gmail through OAuth, encrypt the refresh token in D1,
            and preview unread inbox messages without operational writes.
   ========================================================= */
import { VERSION, ACTIONS } from "../shared/config.js";
import { clean, safeErrorMessage, logWorkerError, jsonResponse } from "../shared/http.js";
import { getDatabase } from "../shared/database.js";

export const GMAIL_INTEGRATION_VERSION = "1.0.0";
export const GMAIL_PATHS = Object.freeze({ CONNECT: "/auth/google", CALLBACK: "/auth/google/callback" });
const AUTH_URL="https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL="https://oauth2.googleapis.com/token";
const API="https://gmail.googleapis.com/gmail/v1";
const SCOPE="https://www.googleapis.com/auth/gmail.readonly";
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
  target.searchParams.set("prompt","consent");
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
    const profile=await gmailFetch(`${API}/users/me/profile`,token.access_token);
    const db=requireDb(env);await ensureTable(db);
    const encrypted=await encrypt(token.refresh_token,env.GOOGLE_CLIENT_SECRET);
    await db.prepare(`INSERT INTO gmail_connections(account_email,encrypted_refresh_token,scope,connected_at,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(account_email) DO UPDATE SET encrypted_refresh_token=excluded.encrypted_refresh_token,scope=excluded.scope,updated_at=CURRENT_TIMESTAMP`).bind(profile.emailAddress,encrypted,clean(token.scope)||SCOPE).run();
    return callbackPage(true,"Gmail connected",`${profile.emailAddress} is connected in read-only mode.`,state.returnTo,200);
  }catch(error){logWorkerError({requestId,route:"gmail-oauth-callback",stage:"gmail_oauth",error});return callbackPage(false,"Gmail connection failed",safeErrorMessage(error),state.returnTo,500);}
}
async function status(env,requestId){
  try{const db=requireDb(env);await ensureTable(db);const connection=await db.prepare(`SELECT account_email,scope,connected_at,updated_at FROM gmail_connections ORDER BY updated_at DESC LIMIT 1`).first();return jsonResponse({ok:true,requestId,action:ACTIONS.GET_GMAIL_STATUS,version:VERSION,gmailIntegrationVersion:GMAIL_INTEGRATION_VERSION,connected:Boolean(connection),connection:connection||null,connectUrl:`${REDIRECT.replace('/auth/google/callback','/auth/google')}?return_to=${encodeURIComponent(TODAY)}`});}
  catch(error){return jsonResponse({ok:false,requestId,action:ACTIONS.GET_GMAIL_STATUS,error:safeErrorMessage(error)},500);}
}
async function preview(body,env,requestId){
  const limit=Math.min(Math.max(Number(body?.limit)||10,1),20);
  try{const db=requireDb(env);await ensureTable(db);const connection=await db.prepare(`SELECT account_email,encrypted_refresh_token FROM gmail_connections ORDER BY updated_at DESC LIMIT 1`).first();if(!connection)return jsonResponse({ok:false,requestId,connected:false,error:"Gmail is not connected."},401);
    const refreshToken=await decrypt(connection.encrypted_refresh_token,env.GOOGLE_CLIENT_SECRET);const accessToken=await refreshAccessToken(refreshToken,env);const listUrl=new URL(`${API}/users/me/messages`);listUrl.searchParams.set("q","is:unread in:inbox -in:spam -in:trash -category:promotions -category:social");listUrl.searchParams.set("maxResults",String(limit));const list=await gmailFetch(listUrl.toString(),accessToken);const messages=await Promise.all((list.messages||[]).map(item=>readMessage(item.id,accessToken)));return jsonResponse({ok:true,requestId,action:ACTIONS.PREVIEW_GMAIL_INBOX,version:VERSION,gmailIntegrationVersion:GMAIL_INTEGRATION_VERSION,connected:true,accountEmail:connection.account_email,mode:"read-only-preview",reviewedCount:messages.length,messages});
  }catch(error){logWorkerError({requestId,route:ACTIONS.PREVIEW_GMAIL_INBOX,stage:"gmail_preview",error});return jsonResponse({ok:false,requestId,action:ACTIONS.PREVIEW_GMAIL_INBOX,error:safeErrorMessage(error)},500);}
}
async function readMessage(id,token){const url=new URL(`${API}/users/me/messages/${encodeURIComponent(id)}`);url.searchParams.set("format","metadata");["From","To","Subject","Date"].forEach(name=>url.searchParams.append("metadataHeaders",name));const data=await gmailFetch(url.toString(),token);const headers=data?.payload?.headers||[];const value=name=>clean(headers.find(item=>clean(item.name).toLowerCase()===name.toLowerCase())?.value);return{gmailMessageId:data.id,threadId:data.threadId,from:value("From"),to:value("To"),subject:value("Subject")||"(No subject)",date:value("Date"),snippet:clean(data.snippet),labels:Array.isArray(data.labelIds)?data.labelIds:[]};}
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

