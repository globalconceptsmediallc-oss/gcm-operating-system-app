/* GCM OS · SES historical publishing import safety regression */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";
import {importVerifiedSesHistory as importHistory} from "../routes/socialPublishingHistoryImport.js";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const script=fs.readFileSync(new URL("../shared/ses-social-history-2026.js",import.meta.url),"utf8");
const ctx={};new vm.Script(script,{filename:"ses-social-history-2026.js"}).runInNewContext({window:ctx});
const source=JSON.parse(JSON.stringify(ctx.GCMSESHistory2026));
assert.equal(source.clientName,"Southeast Safes");
assert.equal(source.posts.length,25);
assert.equal(source.posts.filter(p=>p.placements.length===2).length,18);
assert.equal(source.posts.filter(p=>p.placements.length===1).length,7);
assert.equal(source.posts.reduce((n,p)=>n+p.placements.length,0),43);
const allProof=source.posts.flatMap(p=>p.placements.map(x=>x.url));
assert.equal(new Set(allProof).size,43);
assert.ok(!allProof.some(x=>x.includes("/p/Dejz6mzEXxk/")),"Existing scheduled Instagram outcome must not be imported");
assert.ok(!allProof.some(x=>x.includes("/posts/1778603930933774")),"Existing scheduled Facebook outcome must not be imported");
const state={posts:[],placements:[],batch:0,seq:1};
const db={
 prepare(sql){
  const stmt={params:[],bind(...a){this.params=a;return this;},
   async first(){
    const a=this.params;
    if(sql.includes("FROM clients"))return a[0]===11?{id:11,name:"Southeast Safes"}:{id:22,name:"A1 Action Safe & Lock"};
    if(sql.startsWith("SELECT COUNT(*) AS n"))return {n:state.posts.filter(x=>x.client_id===a[0]&&a.slice(1).includes(x.external_dedupe_key)).length};
    throw Error("Unknown first query: "+sql);
   },
   async all(){
    const a=this.params;
    if(sql.startsWith("SELECT external_dedupe_key"))return {results:state.posts.filter(x=>x.client_id===a[0]&&a.slice(1).includes(x.external_dedupe_key))};
    if(sql.startsWith("SELECT pl.platform"))return {results:state.placements.filter(x=>a.slice(1).includes(x.proof_reference))};
    throw Error("Unknown all query: "+sql);
   },
   async run(){
    const a=this.params;
    if(sql.startsWith("INSERT INTO social_publishing_posts")){
     if(state.posts.some(x=>x.external_dedupe_key===a[6]))throw Error("Unexpected duplicate post");
     state.posts.push({id:state.seq++,client_id:a[0],campaign:a[1],title:a[2],caption:a[3],notes:a[4],recorded_by:a[5],external_dedupe_key:a[6]});return;
    }
    if(sql.startsWith("INSERT INTO social_publishing_placements")){
     const post=state.posts.find(x=>x.client_id===a[6]&&x.external_dedupe_key===a[7]);
     if(!post)throw Error("Placement orphan");
     state.placements.push({post_id:post.id,platform:a[0],actualDate:a[1],proof_reference:a[2],publisher:a[3],recordedBy:a[4]});return;
    }
    throw Error("Unknown write query: "+sql);
   }
  };return stmt;
 },
 async batch(stmts){state.batch++;for(const stmt of stmts)await stmt.run();}
};
const call=async (body)=>{const r=await importHistory(db,body,{email:"gcm-test-operator@example.com"});return {status:r.status,...await r.json()};};
let r=await call({clientId:22,posts:source.posts});
assert.equal(r.status,409);assert.equal(state.posts.length,0);
const corrupted=JSON.parse(JSON.stringify(source.posts));
corrupted[0].placements[0].publisher="Not Judi";
r=await call({clientId:11,posts:corrupted});
assert.equal(r.status,400);assert.equal(state.posts.length,0);
r=await call({clientId:11,posts:source.posts});
assert.equal(r.ok,true);assert.equal(r.postsAdded,25);assert.equal(r.placementsAdded,43);
assert.equal(state.posts.length,25);assert.equal(state.placements.length,43);assert.equal(state.batch,1);
assert.equal(state.posts.filter(x=>state.placements.filter(p=>p.post_id===x.id).length===2).length,18);
assert.equal(state.placements.filter(p=>p.publisher==="Judi").length,36);
assert.equal(state.placements.filter(p=>p.publisher==="Kristy Schirmer").length,7);
assert.ok(state.posts.every(p=>p.recorded_by==="gcm-test-operator@example.com"));
r=await call({clientId:11,posts:source.posts});
assert.equal(r.duplicateProtected,true);assert.equal(r.writesPerformed,0);
assert.equal(state.batch,1);assert.equal(state.placements.length,43);
console.log("PASS SES social backfill: 25 historical content records, 43 verified platform placements, 18 paired Reels");
console.log("PASS existing scheduled BOGO outcomes excluded; publisher, wrong-client and duplicate safeguards enforced");
