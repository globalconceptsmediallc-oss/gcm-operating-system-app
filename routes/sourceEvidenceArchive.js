/* =========================================================
   Global Concepts Media Operating System
   File: routes/sourceEvidenceArchive.js
   Version: 1.0.0
   Purpose: Authenticated private R2 evidence for pre-appointment Radar.
   Optimized copies only; no automated deletion or external original upload.
   ========================================================= */
import { authorizeOsRequest } from "../shared/osAuth.js";
import { jsonResponse } from "../shared/http.js";
export const SOURCE_EVIDENCE_ACTION="source-evidence";
export const SOURCE_EVIDENCE_VERSION="1.0.0";
const BUCKET="gcm-os-source-evidence-private";
const MAX_FILE=1100000, MAX_TOTAL=2200000, MAX_RECORDS=50, MAX_ARCHIVE=8000000000;
const SOURCES=new Set(["door_hanger","direct_mail","business_card","flyer","postcard","advertisement","other"]);
function clean(v,max=300){return String(v??"").trim().slice(0,max);}
function id(v){const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null;}
function rows(x){return Array.isArray(x?.results)?x.results:[];}
function fail(message,status=400){return jsonResponse({ok:false,action:SOURCE_EVIDENCE_ACTION,error:message,writesPerformed:0},status);}
function from64(value){
  if(typeof value!=="string"||value.length>1600000||!/^[A-Za-z0-9+/=]+$/.test(value))throw Error("Invalid encoded image.");
  let bin;try{bin=atob(value);}catch{throw Error("Invalid encoded image.");}
  return Uint8Array.from(bin,c=>c.charCodeAt(0));
}
function to64(bytes){let b="";for(let i=0;i<bytes.length;i+=8192)b+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(b);}
async function sha256(bytes){const d=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(d)].map(n=>n.toString(16).padStart(2,"0")).join("");}
function parseImage(file){
  const mime=clean(file?.contentType,40).toLowerCase(),data=from64(file?.dataBase64);
  const jpeg=data.length>3&&data[0]===255&&data[1]===216&&data[2]===255;
  const webp=data.length>12&&String.fromCharCode(...data.slice(0,4))==="RIFF"&&String.fromCharCode(...data.slice(8,12))==="WEBP";
  if(!((mime==="image/jpeg"&&jpeg)||(mime==="image/webp"&&webp)))throw Error("Upload an optimized JPEG or WebP image.");
  const width=id(file?.widthPx),height=id(file?.heightPx);
  if(!data.length||data.length>MAX_FILE||!width||!height||width>4000||height>4000)throw Error("Each image must be 1.1 MB or less, with valid dimensions.");
  return {data,mime,width,height};
}
async function getRadar(db,radarId){return db.prepare("SELECT id,business_name,status,archived_at,promoted_prospect_id FROM crm_prospect_radar WHERE id=? LIMIT 1").bind(radarId).first();}
async function list(body,db,requestId){
  const radarId=id(body?.radarId);if(!radarId)return fail("Select a Radar record.");
  const radar=await getRadar(db,radarId);if(!radar)return fail("Radar record not found.",404);
  const found=rows(await db.prepare(
    "SELECT i.id,i.title,i.source_type,i.description,i.campaign_notes,i.observed_at,i.collected_at,i.retention_state,o.id AS image_id,o.content_type,o.size_bytes,o.width_px,o.height_px,l.rendition,l.display_order "+
    "FROM crm_source_evidence_items i LEFT JOIN crm_source_evidence_links l ON l.evidence_id=i.id "+
    "LEFT JOIN crm_source_evidence_objects o ON o.id=l.object_id AND o.deleted_at IS NULL "+
    "WHERE i.radar_id=? ORDER BY i.id DESC,l.display_order ASC"
  ).bind(radarId).all());
  const grouped=new Map();
  for(const r of found){
    if(!grouped.has(r.id))grouped.set(r.id,{id:r.id,title:r.title,sourceType:r.source_type,description:r.description,campaignNotes:r.campaign_notes,observedAt:r.observed_at,collectedAt:r.collected_at,retentionState:r.retention_state,images:[]});
    if(r.image_id)grouped.get(r.id).images.push({id:r.image_id,contentType:r.content_type,sizeBytes:r.size_bytes,widthPx:r.width_px,heightPx:r.height_px,order:r.display_order});
  }
  return jsonResponse({ok:true,requestId,action:SOURCE_EVIDENCE_ACTION,operation:"list",sourceEvidenceVersion:SOURCE_EVIDENCE_VERSION,evidence:[...grouped.values()],writesPerformed:0});
}
async function getImage(body,db,env,requestId){
  const radarId=id(body?.radarId),imageId=id(body?.imageId);
  if(!radarId||!imageId)return fail("Valid image and Radar IDs are required.");
  const row=await db.prepare("SELECT o.bucket_name,o.object_key,o.content_type FROM crm_source_evidence_objects o "+
    "JOIN crm_source_evidence_links l ON l.object_id=o.id JOIN crm_source_evidence_items i ON i.id=l.evidence_id "+
    "WHERE i.radar_id=? AND o.id=? AND o.storage_provider='r2' AND o.deleted_at IS NULL AND i.retention_state!='deleted' LIMIT 1"
  ).bind(radarId,imageId).first();
  if(!row||row.bucket_name!==BUCKET)return fail("Evidence image was not found.",404);
  const obj=await env.EVIDENCE_BUCKET.get(row.object_key);if(!obj)return fail("Evidence image missing from private storage.",404);
  const bytes=new Uint8Array(await obj.arrayBuffer());
  if(bytes.length>MAX_FILE)return fail("Stored image is too large to display.",413);
  return jsonResponse({ok:true,requestId,action:SOURCE_EVIDENCE_ACTION,operation:"get_image",contentType:row.content_type,dataBase64:to64(bytes),writesPerformed:0});
}
async function create(body,db,env,requestId){
  const radarId=id(body?.radarId),title=clean(body?.title,130),sourceType=clean(body?.sourceType,60);
  const description=clean(body?.description,1200),notes=clean(body?.campaignNotes,1200),date=clean(body?.observedAt,10);
  if(!radarId||!title||!SOURCES.has(sourceType)||date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return fail("A title, valid type and optional YYYY-MM-DD date are required.");
  if(!Array.isArray(body?.files)||body.files.length<1||body.files.length>2)return fail("Select one or two image files.");
  const radar=await getRadar(db,radarId);
  if(!radar)return fail("Radar record not found.",404);
  if(radar.archived_at||radar.promoted_prospect_id||!["radar","outreach","nurture"].includes(radar.status))return fail("This Radar record no longer accepts evidence.",409);
  const existingItems=rows(await db.prepare("SELECT id FROM crm_source_evidence_items WHERE radar_id=?").bind(radarId).all());
  if(existingItems.length>=MAX_RECORDS)return fail("Maximum evidence entries reached for this business.",413);
  let total=0;const images=[];
  for(const f of body.files){
    const parsed=parseImage(f);total+=parsed.data.length;const digest=await sha256(parsed.data);
    images.push({...parsed,digest,key:"radar/"+radarId+"/"+digest+(parsed.mime==="image/webp"?".webp":".jpg")});
  }
  if(total>MAX_TOTAL)return fail("The images exceed the 2.2 MB entry limit.",413);
  if(new Set(images.map(f=>f.digest)).size!==images.length)return fail("You selected the same image twice.",409);
  const existing=rows(await db.prepare(
    "SELECT i.id,GROUP_CONCAT(o.sha256,'|') AS hashes FROM crm_source_evidence_items i "+
    "JOIN crm_source_evidence_links l ON l.evidence_id=i.id JOIN crm_source_evidence_objects o ON o.id=l.object_id AND o.deleted_at IS NULL "+
    "WHERE i.radar_id=? AND i.retention_state!='deleted' GROUP BY i.id"
  ).bind(radarId).all());
  const signature=images.map(f=>f.digest).sort().join("|");
  for(const row of existing)if(String(row.hashes||"").split("|").sort().join("|")===signature)return jsonResponse({
    ok:true,requestId,action:SOURCE_EVIDENCE_ACTION,operation:"create",duplicateProtected:true,evidenceId:row.id,writesPerformed:0
  });
  const totalStored=await db.prepare("SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM crm_source_evidence_objects WHERE storage_provider='r2' AND deleted_at IS NULL").first();
  if(Number(totalStored?.bytes||0)+total>MAX_ARCHIVE)return fail("The evidence archive has reached its 8 GB storage guard.",413);
  // Deterministic object keys make retries harmless; overwrite of existing keys is avoided.
  for(const image of images){
    const saved=await db.prepare("SELECT id FROM crm_source_evidence_objects WHERE storage_provider='r2' AND bucket_name=? AND object_key=? AND deleted_at IS NULL").bind(BUCKET,image.key).first();
    if(!saved)await env.EVIDENCE_BUCKET.put(image.key,image.data,{httpMetadata:{contentType:image.mime}});
  }
  const inserted=await db.prepare("INSERT INTO crm_source_evidence_items(radar_id,title,source_type,description,campaign_notes,observed_at) VALUES(?,?,?,?,?,?)").bind(radarId,title,sourceType,description||null,notes||null,date||null).run();
  const evidenceId=id(inserted?.meta?.last_row_id);if(!evidenceId)throw Error("Evidence item insertion could not be confirmed.");
  for(let n=0;n<images.length;n++){
    const f=images[n];
    await db.prepare("INSERT OR IGNORE INTO crm_source_evidence_objects(storage_provider,bucket_name,object_key,sha256,content_type,size_bytes,width_px,height_px) VALUES('r2',?,?,?,?,?,?,?)")
      .bind(BUCKET,f.key,f.digest,f.mime,f.data.length,f.width,f.height).run();
    const obj=await db.prepare("SELECT id FROM crm_source_evidence_objects WHERE storage_provider='r2' AND bucket_name=? AND object_key=? AND deleted_at IS NULL").bind(BUCKET,f.key).first();
    if(!id(obj?.id))throw Error("Private image storage index not found.");
    await db.prepare("INSERT INTO crm_source_evidence_links(evidence_id,object_id,rendition,display_order) VALUES(?,?,?,?)").bind(evidenceId,obj.id,"optimized",n).run();
  }
  return jsonResponse({ok:true,requestId,action:SOURCE_EVIDENCE_ACTION,operation:"create",sourceEvidenceVersion:SOURCE_EVIDENCE_VERSION,evidenceId,radarId,writesPerformed:1+images.length*2},201);
}
export async function handleSourceEvidenceArchive(body,env,requestId,request){
  if(!env?.DB?.prepare||!env?.EVIDENCE_BUCKET)return fail("Private evidence storage is not configured.",503);
  try{await authorizeOsRequest(request,env,env.DB);}
  catch(error){return fail(String(error?.message||"GCM OS sign-in required."),401);}
  try{
    const op=clean(body?.operation,30).toLowerCase();
    if(op==="list")return await list(body,env.DB,requestId);
    if(op==="get_image")return await getImage(body,env.DB,env,requestId);
    if(op==="create")return await create(body,env.DB,env,requestId);
    return fail("Unsupported evidence operation.");
  }catch(e){
    console.error("Evidence archive:",requestId,String(e?.message||"error"));
    const m=String(e?.message||"");
    return fail(/^(Invalid encoded|Upload an optimized|Each image)/.test(m)?m:"Private evidence operation failed.",400);
  }
}
/* END OF FILE — routes/sourceEvidenceArchive.js v1.0.0 */