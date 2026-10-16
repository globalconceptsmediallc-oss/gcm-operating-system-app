/* =========================================================
 Global Concepts Media Operating System
 File: routes/socialPublishingOperations.js
 Version: 1.0.0
 Status: Production Candidate
 Purpose: Authenticated supplemental publisher attribution and additional
          verified placements; never mutate Forward Look or Schedule Authority.
 ========================================================= */
import {authorizeOsRequest} from "../shared/osAuth.js";
import {jsonResponse} from "../shared/http.js";
export const SOCIAL_PUBLISHING_OPERATIONS_ACTION="social-publishing-operations";
export const SOCIAL_PUBLISHING_OPERATIONS_VERSION="1.0.0";
const CHANNELS=new Set(["Facebook","Google Business Profile","Instagram","YouTube","Other"]);
const clean=(v,max=200)=>String(v??"").trim().slice(0,max);
const id=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null;};
const date=v=>{const s=clean(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return "";const d=new Date(s+"T12:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().startsWith(s)?s:"";};
const rows=r=>Array.isArray(r?.results)?r.results:[];
const response=(obj,code=200)=>jsonResponse({action:SOCIAL_PUBLISHING_OPERATIONS_ACTION,socialPublishingOperationsVersion:SOCIAL_PUBLISHING_OPERATIONS_VERSION,...obj},code);
const bad=(error,status=400)=>response({ok:false,error,writesPerformed:0},status);
function normalizedUrl(raw){
  const value=clean(raw,1100);
  try{
    const u=new URL(value);
    if(u.protocol!=="https:"||!u.hostname||u.username||u.password||u.port)return "";
    u.hash="";
    if(/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(u.hostname))u.searchParams.delete("si");
    if(/(^|\.)instagram\.com$/i.test(u.hostname))u.searchParams.delete("igsh");
    return u.href.slice(0,1000);
  }catch{return "";}
}
async function digest(text){
  const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)));
  return [...bytes].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function ownerForForward(db,{clientId,scheduleItemId,forwardKey,platform}){
  const schedule=await db.prepare(
    "SELECT id,client_id,source_key,item_type,status,archived_at FROM schedule_items WHERE id=? AND client_id=? LIMIT 1"
  ).bind(scheduleItemId,clientId).first();
  if(!schedule||schedule.archived_at||["canceled","cancelled"].includes(clean(schedule.status).toLowerCase()))return null;
  const disposed=await db.prepare(
    "SELECT forward_key,disposition,reason FROM forward_look_dispositions WHERE forward_key=? LIMIT 1"
  ).bind(forwardKey).first();
  if(!disposed||!["social_published","social_mixed"].includes(disposed.disposition))return null;
  let p;try{p=JSON.parse(disposed.reason);}catch{return null;}
  if(p?.schema!=="gcm-social-execution-v1"||Number(p.scheduleItemId)!==scheduleItemId||
     !date(p.plannedDate)||!forwardKey.startsWith("schedule|"+schedule.source_key+":social_post:"+p.plannedDate+":")||
     !forwardKey.endsWith("|"+p.plannedDate))return null;
  const exact=p.platforms?.filter(x=>x.platform===platform);
  if(exact?.length!==1||exact[0].status!=="published"||!date(exact[0].publishedDate)||
     !normalizedUrl(exact[0].proofReference))return null;
  return schedule;
}
async function list(db){
  const [authorship,extra]=await Promise.all([
    db.prepare("SELECT a.client_id,a.schedule_item_id,a.forward_key,a.platform,a.published_by,a.recorded_by,a.updated_at,COUNT(h.id) AS revision_count FROM social_publishing_authorship a LEFT JOIN social_publishing_authorship_history h ON h.authorship_id=a.id GROUP BY a.id ORDER BY a.updated_at DESC LIMIT 2000").all(),
    db.prepare("SELECT p.id AS post_id,p.client_id,c.name AS client_name,p.campaign_title,p.post_title,p.caption_text,p.notes,p.related_forward_key,pl.platform,pl.status,pl.actual_published_date,pl.proof_reference,pl.published_by,pl.recorded_by FROM social_publishing_posts p JOIN social_publishing_placements pl ON pl.post_id=p.id JOIN clients c ON c.id=p.client_id WHERE p.source_kind='additional' ORDER BY pl.actual_published_date DESC,p.id DESC LIMIT 2000").all()
  ]);
  return response({ok:true,operation:"list",authorship:rows(authorship).map(r=>({
    clientId:r.client_id,scheduleItemId:r.schedule_item_id,forwardKey:r.forward_key,platform:r.platform,
    publishedBy:r.published_by,recordedBy:r.recorded_by,updatedAt:r.updated_at,revisionCount:Number(r.revision_count||0)
  })),additional:rows(extra).map(r=>({
    postId:r.post_id,clientId:r.client_id,clientName:r.client_name,campaign:r.campaign_title,
    title:r.post_title,caption:r.caption_text,notes:r.notes,relatedForwardKey:r.related_forward_key,
    platform:r.platform,status:r.status,actualDate:r.actual_published_date,
    proofReference:r.proof_reference,publishedBy:r.published_by,recordedBy:r.recorded_by
  })),writesPerformed:0});
}
async function savePublisher(db,body,identity){
  const clientId=id(body?.clientId),scheduleItemId=id(body?.scheduleItemId);
  const forwardKey=clean(body?.forwardKey,1000),platform=clean(body?.platform,60),publishedBy=clean(body?.publishedBy,120);
  if(!clientId||!scheduleItemId||!forwardKey||!CHANNELS.has(platform)||publishedBy.length<2)return bad("Select a verified published placement and enter the actual publisher.");
  if(!await ownerForForward(db,{clientId,scheduleItemId,forwardKey,platform}))return bad("Scheduled ownership or published evidence could not be verified.",409);
  const existing=await db.prepare("SELECT id,published_by FROM social_publishing_authorship WHERE forward_key=? AND platform=?").bind(forwardKey,platform).first();
  if(existing&&existing.published_by===publishedBy)return response({ok:true,operation:"save_publisher",duplicateProtected:true,writesPerformed:0});
  if(existing){
    await db.batch([
      db.prepare("INSERT INTO social_publishing_authorship_history(authorship_id,prior_published_by,new_published_by,recorded_by) VALUES(?,?,?,?)").bind(existing.id,existing.published_by,publishedBy,identity.email),
      db.prepare("UPDATE social_publishing_authorship SET published_by=?,recorded_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND client_id=? AND schedule_item_id=?").bind(publishedBy,identity.email,existing.id,clientId,scheduleItemId)
    ]);
  }else{
    await db.prepare("INSERT INTO social_publishing_authorship(client_id,schedule_item_id,forward_key,platform,published_by,recorded_by) VALUES(?,?,?,?,?,?)")
      .bind(clientId,scheduleItemId,forwardKey,platform,publishedBy,identity.email).run();
  }
  return response({ok:true,operation:"save_publisher",writesPerformed:existing?2:1});
}
async function addAdditional(db,body,identity){
  const clientId=id(body?.clientId),platform=clean(body?.platform,60),actualDate=date(body?.actualDate);
  const url=normalizedUrl(body?.proofReference),publishedBy=clean(body?.publishedBy,120);
  const title=clean(body?.title,150),campaign=clean(body?.campaign,150)||title;
  const caption=clean(body?.caption,2000)||null,notes=clean(body?.notes,1000)||null;
  const relatedForwardKey=clean(body?.relatedForwardKey,1000)||null;
  if(!clientId||!CHANNELS.has(platform)||!actualDate||!url||!title||publishedBy.length<2){
    return bad("Client, post title, publisher, platform, actual publication date and HTTPS post link are required.");
  }
  const client=await db.prepare("SELECT id,name FROM clients WHERE id=? LIMIT 1").bind(clientId).first();
  if(!client)return bad("Client does not exist.",404);
  if(relatedForwardKey){
    const relation=await db.prepare("SELECT reason FROM forward_look_dispositions WHERE forward_key=? LIMIT 1").bind(relatedForwardKey).first();
    let payload;try{payload=JSON.parse(relation?.reason||"{}");}catch{return bad("The related scheduled record was not found.",409);}
    const scheduleItemId=id(payload?.scheduleItemId);
    const schedule=scheduleItemId?await db.prepare("SELECT id,client_id,source_key FROM schedule_items WHERE id=? AND client_id=? LIMIT 1").bind(scheduleItemId,clientId).first():null;
    if(!schedule||!date(payload.plannedDate)||!relatedForwardKey.startsWith("schedule|"+schedule.source_key+":social_post:"+payload.plannedDate+":")||
       !relatedForwardKey.endsWith("|"+payload.plannedDate))return bad("The related campaign belongs to a different client or source.",409);
  }
  const key=await digest(String(clientId)+"|"+platform+"|"+url);
  const existing=await db.prepare("SELECT id FROM social_publishing_posts WHERE client_id=? AND external_dedupe_key=? AND source_kind='additional' LIMIT 1").bind(clientId,key).first();
  if(existing)return response({ok:true,operation:"add_additional",postId:existing.id,duplicateProtected:true,writesPerformed:0});
  // D1 batch is a single transaction. No orphaned post if the placement insert fails.
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO social_publishing_posts(client_id,source_kind,campaign_title,post_title,caption_text,notes,created_by,external_dedupe_key,related_forward_key) VALUES(?,'additional',?,?,?,?,?,?,?)")
      .bind(clientId,campaign,title,caption,notes,identity.email,key,relatedForwardKey),
    db.prepare("INSERT OR IGNORE INTO social_publishing_placements(post_id,platform,status,actual_published_date,proof_reference,published_by,recorded_by) SELECT id,?,'published',?,?,?,? FROM social_publishing_posts WHERE client_id=? AND external_dedupe_key=? AND source_kind='additional'")
      .bind(platform,actualDate,url,publishedBy,identity.email,clientId,key)
  ]);
  const created=await db.prepare("SELECT id FROM social_publishing_posts WHERE client_id=? AND external_dedupe_key=? LIMIT 1").bind(clientId,key).first();
  if(!created?.id)throw Error("Additional placement could not be verified after insertion.");
  return response({ok:true,operation:"add_additional",postId:created.id,writesPerformed:2});
}
export async function handleSocialPublishingOperations(body,env,requestId,request){
  const db=env?.DB;
  if(!db?.prepare)return bad("Publishing database is unavailable.",503);
  let identity;
  try{identity=await authorizeOsRequest(request,env,db);}
  catch(_err){return bad("Verified GCM OS Google sign-in required.",401);}
  try{
    const op=clean(body?.operation,50);
    if(op==="list")return await list(db);
    if(op==="save_publisher")return await savePublisher(db,body,identity);
    if(op==="add_additional")return await addAdditional(db,body,identity);
    return bad("Unsupported social publishing operation.");
  }catch(error){
    console.error("social-publishing-operations",requestId,String(error?.message||error));
    return bad("Social publishing action could not be completed; no result was confirmed.",500);
  }
}
/* END OF FILE — routes/socialPublishingOperations.js v1.0.0 */
