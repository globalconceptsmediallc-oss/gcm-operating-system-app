/* =========================================================
   GCM OS — Source Evidence Archive
   File: tests/sourceEvidenceArchive.test.js
   Version: 1.0.0
   Production-free authenticated evidence boundary regression.
   ========================================================= */
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { handleSourceEvidenceArchive, SOURCE_EVIDENCE_ACTION } from "../routes/sourceEvidenceArchive.js";
import { createOsSessionToken } from "../shared/osAuth.js";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const secret="test-secret-for-evidence-boundary";
const signed=await createOsSessionToken({email:"operator@example.com",secret});
const request={headers:new Headers({"Authorization":"Bearer "+signed})};
const photos=new Map();
const rows={evidence:[],objects:[],links:[]};
let nextId=1;
const db={prepare(sql){
  let args=[];
  return {
    bind(...values){args=values;return this;},
    async first(){
      if(sql.includes("FROM gmail_connections"))return {account_email:"operator@example.com"};
      if(sql.includes("FROM crm_prospect_radar"))return Number(args[0])===12?{id:12,business_name:"Sunny Roofing",status:"radar",archived_at:null,promoted_prospect_id:null}:null;
      if(sql.includes("COALESCE(SUM(size_bytes)"))return{bytes:rows.objects.reduce((n,x)=>n+x.size_bytes,0)};
      if(sql.includes("SELECT id FROM crm_source_evidence_objects"))return rows.objects.find(x=>x.bucket_name===args[0]&&x.object_key===args[1])||null;
      if(sql.includes("SELECT o.bucket_name")) {
        const link=rows.links.find(x=>x.object_id===Number(args[1])&&rows.evidence.some(e=>e.id===x.evidence_id&&e.radar_id===Number(args[0])));
        const object=link&&rows.objects.find(x=>x.id===link.object_id);
        return object?{bucket_name:object.bucket_name,object_key:object.object_key,content_type:object.content_type}:null;
      }
      return null;
    },
    async all(){
      if(sql.includes("SELECT id FROM crm_source_evidence_items"))return{results:rows.evidence.filter(x=>x.radar_id===args[0]).map(x=>({id:x.id}))};
      if(sql.includes("GROUP_CONCAT")){
        return{results:rows.evidence.filter(e=>e.radar_id===args[0]).map(e=>({id:e.id,hashes:rows.links.filter(l=>l.evidence_id===e.id).map(l=>rows.objects.find(o=>o.id===l.object_id)?.sha256).join("|")}))};
      }
      if(sql.includes("LEFT JOIN crm_source_evidence_links")) {
        return{results:rows.evidence.filter(e=>e.radar_id===args[0]).flatMap(e=>{
          const links=rows.links.filter(l=>l.evidence_id===e.id);
          return links.map(l=>({...e,image_id:l.object_id,content_type:rows.objects.find(o=>o.id===l.object_id).content_type,
            size_bytes:rows.objects.find(o=>o.id===l.object_id).size_bytes,display_order:l.display_order}));
        })};
      }
      return{results:[]};
    },
    async run(){
      if(sql.includes("INSERT INTO crm_source_evidence_items")){
        const evidence={id:nextId++,radar_id:args[0],title:args[1],source_type:args[2],description:args[3],campaign_notes:args[4],
          observed_at:args[5],retention_state:"active",collected_at:"2026-10-15"};
        rows.evidence.push(evidence);return{meta:{last_row_id:evidence.id}};
      }
      if(sql.includes("INSERT OR IGNORE INTO crm_source_evidence_objects")){
        if(!rows.objects.some(x=>x.object_key===args[1]))rows.objects.push({
          id:nextId++,bucket_name:args[0],object_key:args[1],sha256:args[2],content_type:args[3],size_bytes:args[4],width_px:args[5],height_px:args[6]
        });
        return{meta:{last_row_id:rows.objects.at(-1).id}};
      }
      if(sql.includes("INSERT INTO crm_source_evidence_links")){
        rows.links.push({evidence_id:args[0],object_id:args[1],display_order:args[3]});
      }
      return{meta:{last_row_id:null}};
    }
  };
}};
const r2={
  async put(key,bytes){photos.set(key,bytes);},
  async get(key){const b=photos.get(key);return b?{async arrayBuffer(){return b.slice().buffer;}}:null;}
};
const env={DB:db,EVIDENCE_BUCKET:r2,GOOGLE_CLIENT_SECRET:secret};
const call=(body,req=request)=>handleSourceEvidenceArchive({action:SOURCE_EVIDENCE_ACTION,...body},env,"test-evidence",req);
const read=async response=>({status:response.status,json:await response.json()});
const missing=await read(await call({operation:"list",radarId:12},{headers:new Headers()}));
assert.equal(missing.status,401);
assert.equal(rows.evidence.length,0);
const foreign=await read(await call({operation:"list",radarId:999}));
assert.equal(foreign.status,404);
const jpeg=Uint8Array.from([255,216,255,224,0,1,2,3,255,217]);
const file={contentType:"image/jpeg",dataBase64:Buffer.from(jpeg).toString("base64"),widthPx:100,heightPx:150};
const saved=await read(await call({operation:"create",radarId:12,title:"Door Hanger — October 2026",sourceType:"door_hanger",files:[file]}));
assert.equal(saved.status,201);
assert.equal(saved.json.evidenceId>0,true);
assert.equal(photos.size,1);
const twice=await read(await call({operation:"create",radarId:12,title:"Duplicate",sourceType:"door_hanger",files:[file]}));
assert.equal(twice.json.duplicateProtected,true);
assert.equal(rows.evidence.length,1);
const listing=await read(await call({operation:"list",radarId:12}));
assert.equal(listing.json.evidence.length,1);
const imageId=listing.json.evidence[0].images[0].id;
const fetched=await read(await call({operation:"get_image",radarId:12,imageId}));
assert.equal(Buffer.from(fetched.json.dataBase64,"base64").equals(Buffer.from(jpeg)),true);
const otherId=await read(await call({operation:"get_image",radarId:999,imageId}));
assert.equal(otherId.status,404);
const spoofed=await read(await call({operation:"create",radarId:12,title:"Bad image",sourceType:"door_hanger",files:[{...file,contentType:"image/webp"}]}));
assert.equal(spoofed.status,400);
assert.equal(rows.evidence.length,1);
console.log("PASS private evidence: Google session required, record boundary, optimized file validation, upload, read, duplicate protection");