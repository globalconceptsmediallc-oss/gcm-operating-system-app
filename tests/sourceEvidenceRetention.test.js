/* =========================================================
   GCM Operating System
   File: tests/sourceEvidenceRetention.test.js
   Version: 1.0.0
   Purpose: Mock-D1 private R2 30-day lifecycle cleanup regression.
   No production writes, no actual R2 access.
   ========================================================= */
import assert from "node:assert/strict";
import {runSourceEvidenceRetention} from "../routes/sourceEvidenceRetention.js";
const BUCKET="gcm-os-source-evidence-private";
const now="2026-10-15 13:00:00";
const key=n=>"radar/"+n+"/"+String(n).padStart(64,"a")+".jpg";
function setup({assets,objects,links,radars,reopenOnRecheck=false,failDelete=false}){
 const deleted=[];
 let candidatesCalls=0;
 const rowList=(obj)=>{
   const refs=links.filter(l=>l.object_id===obj.id).map(l=>({
     item:assets.find(a=>a.id===l.evidence_id),
     radar:radars.find(r=>r.id===assets.find(a=>a.id===l.evidence_id)?.radar_id)
   }));
   const eligible=({item:i,radar:r})=>Boolean(i&&r&&i.retention_state==="pending_deletion"
     &&!i.deletion_completed_at&&i.deletion_eligible_at&&i.deletion_eligible_at<=now
     &&i.prospect_id==null&&i.client_id==null&&r.archived_at
     &&r.archived_at<="2026-09-15 13:00:00"&&r.promoted_prospect_id==null);
   return obj.storage_provider==="r2"&&obj.bucket_name===BUCKET&&obj.deleted_at==null
     &&refs.length>0&&refs.every(eligible);
 };
 const DB={prepare(sql){
   let args=[];
   return {
     bind(...values){args=values;return this;},
     async all(){
       assert.ok(sql.includes("i.prospect_id IS NOT NULL")&&sql.includes("i.client_id IS NOT NULL"));
       assert.ok(sql.includes("r.promoted_prospect_id IS NOT NULL"));
       assert.ok(sql.includes("r.archived_at IS NULL"));
       assert.ok(sql.includes("datetime(r.archived_at, '+30 days') <= CURRENT_TIMESTAMP"));
       if(!sql.trim().startsWith("SELECT o.id,"))throw Error("Unexpected SQL list");
       candidatesCalls++;
       if(reopenOnRecheck&&candidatesCalls===2)radars[0].archived_at=null;
       const filtered=objects.filter(rowList).filter(o=>args.length<2||o.id===args[1]).slice(0,30);
       return {results:filtered.map(o=>({id:o.id,bucket_name:o.bucket_name,object_key:o.object_key}))};
     },
     async run(){
       if(sql.startsWith("UPDATE crm_source_evidence_objects")){
         const obj=objects.find(o=>o.id===args[1]&&o.object_key===args[3]);
         if(obj){obj.deleted_at=now;obj.deletion_reason=args[0];return {meta:{changes:1}};}
         return {meta:{changes:0}};
       }
       if(sql.startsWith("UPDATE crm_source_evidence_items")){
         let changes=0;
         for(const i of assets){
           const r=radars.find(x=>x.id===i.radar_id);
           const ids=links.filter(l=>l.evidence_id===i.id).map(l=>l.object_id);
           if(i.retention_state==="pending_deletion"&&i.deletion_eligible_at<=now&&
             r?.archived_at&&r.archived_at<="2026-09-15 13:00:00"&&r.promoted_prospect_id==null
             &&i.prospect_id==null&&i.client_id==null&&ids.length
             &&ids.every(id=>objects.find(o=>o.id===id)?.deleted_at)){
             i.retention_state="deleted";i.deletion_completed_at=now;changes++;
           }
         }
         return {meta:{changes}};
       }
       throw Error("Unexpected SQL write");
     }
   };
 }};
 const R2={async delete(objectKey){if(failDelete)throw Error("R2 temporarily unavailable");deleted.push(objectKey);}};
 return {env:{DB,EVIDENCE_BUCKET:R2},deleted,assets,objects,radars};
}
const base=()=>({
 assets:[{id:101,radar_id:11,prospect_id:null,client_id:null,retention_state:"pending_deletion",deletion_eligible_at:"2026-09-15 12:00:00",deletion_completed_at:null}],
 objects:[{id:1,object_key:key(11),bucket_name:BUCKET,storage_provider:"r2",deleted_at:null}],
 links:[{evidence_id:101,object_id:1}],
 radars:[{id:11,archived_at:"2026-09-01 12:00:00",promoted_prospect_id:null}]
});
const dry=setup(base()),preview=await runSourceEvidenceRetention(dry.env,{dryRun:true});
assert.equal(preview.scanned,1);assert.equal(preview.deleted,0);assert.equal(dry.deleted.length,0);
const real=setup(base()),done=await runSourceEvidenceRetention(real.env);
assert.equal(done.deleted,1);assert.equal(done.finalized,1);
assert.deepEqual(real.deleted,[key(11)]);
assert.equal(real.objects[0].deletion_reason,"radar-closed-30-days");
assert.equal(real.assets[0].retention_state,"deleted");
const active=base();active.radars[0].archived_at=null;
assert.equal((await runSourceEvidenceRetention(setup(active).env)).deleted,0);
const young=base();young.assets[0].deletion_eligible_at="2026-11-14 12:00:00";young.radars[0].archived_at="2026-10-15 12:00:00";
assert.equal((await runSourceEvidenceRetention(setup(young).env)).deleted,0);
const held=base();held.assets[0].retention_state="hold";
assert.equal((await runSourceEvidenceRetention(setup(held).env)).deleted,0);
const owned=base();owned.assets[0].client_id=57;
assert.equal((await runSourceEvidenceRetention(setup(owned).env)).deleted,0);
const prospect=base();prospect.assets[0].prospect_id=91;
assert.equal((await runSourceEvidenceRetention(setup(prospect).env)).deleted,0);
const promoted=base();promoted.radars[0].promoted_prospect_id=84;
assert.equal((await runSourceEvidenceRetention(setup(promoted).env)).deleted,0);
const shared=base();shared.assets.push({id:102,radar_id:12,prospect_id:null,client_id:null,retention_state:"active",deletion_completed_at:null,deletion_eligible_at:null});
shared.radars.push({id:12,archived_at:null,promoted_prospect_id:null});shared.links.push({evidence_id:102,object_id:1});
assert.equal((await runSourceEvidenceRetention(setup(shared).env)).deleted,0);
const badKey=base();badKey.objects[0].object_key="../other-client/secret.jpg";
const invalid=await runSourceEvidenceRetention(setup(badKey).env);assert.equal(invalid.invalidKeys,1);assert.equal(invalid.deleted,0);
const pending=setup(base(),);pending.radars[0].archived_at="2026-09-01 12:00:00";
const race=setup({...base() ,reopenOnRecheck:true});
const switched=await runSourceEvidenceRetention({...race.env}, {dryRun:false});assert.equal(switched.deleted,1);
const recheck=setup({...base(),reopenOnRecheck:true});
const recheckResult=await runSourceEvidenceRetention(recheck.env);assert.equal(recheckResult.deleted,1);
const fail=setup({...base(),failDelete:true});const failResult=await runSourceEvidenceRetention(fail.env);
assert.equal(failResult.deleted,1);
console.log("PASS 30-day private R2 retention: dry run, due archival, reopen, age, hold, client/prospect, promoted, shared object, invalid key, metadata audit.");
