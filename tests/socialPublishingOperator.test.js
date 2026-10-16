/* =========================================================
 GCM OS · tests/socialPublishingOperator.test.js
 Version: 1.0.1
 Auth, exact-client publisher attribution, revision history and
 duplicate-safe extras. All tests use an isolated in-memory D1 mock.
 ========================================================= */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";
import {createOsSessionToken} from "../shared/osAuth.js";
import {handleSocialPublishingOperations as handle} from "../routes/socialPublishingOperations.js";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const secret="gcm-os-test-operator-signing-secret";
const signed=await createOsSessionToken({email:"operator@example.com",secret});
const authorized={headers:new Headers({Authorization:"Bearer "+signed})};
const unsigned={headers:new Headers()};
const forwardKey="schedule|ses:fall-2026:social_post:2026-10-15:SOCIAL — FALL SAVINGS LAUNCH|2026-10-15";
const schedule={id:31,client_id:11,source_key:"ses:fall-2026",item_type:"promotion",status:"active",archived_at:null};
const disposition={forward_key:forwardKey,disposition:"social_published",reason:JSON.stringify({
 schema:"gcm-social-execution-v1",scheduleItemId:31,plannedDate:"2026-10-15",
 platforms:[
  {platform:"Facebook",status:"published",publishedDate:"2026-10-15",proofReference:"https://facebook.com/photo/?fbid=123"},
  {platform:"Google Business Profile",status:"published",publishedDate:"2026-10-16",proofReference:"https://google.com/search?q=SES"},
  {platform:"Instagram",status:"published",publishedDate:"2026-10-16",proofReference:"https://instagram.com/p/123"}
 ]})};
const rows={attributions:[],history:[],posts:[],placements:[]};
let id=1,batchCount=0;
const db={
 prepare(sql){
  const statement={args:[],bind(...args){this.args=args;return this;},
   async first(){
    const a=this.args;
    if(sql.includes("FROM gmail_connections"))return {account_email:"operator@example.com"};
    if(sql.includes("FROM schedule_items")){
      return (schedule.id===Number(a[0])&&schedule.client_id===Number(a[1]))?schedule:null;
    }
    if(sql.includes("FROM forward_look_dispositions"))return a[0]===forwardKey?disposition:null;
    if(sql.includes("FROM clients"))return Number(a[0])===11?{id:11,name:"Southeast Safes"}:Number(a[0])===22?{id:22,name:"A1 Action Safe & Lock"}:null;
    if(sql.includes("FROM social_publishing_authorship"))return rows.attributions.find(x=>x.forward_key===a[0]&&x.platform===a[1])||null;
    if(sql.includes("FROM social_publishing_posts"))return rows.posts.find(x=>x.client_id===a[0]&&x.external_dedupe_key===a[1])||null;
    throw Error("Unexpected select SQL "+sql);
   },
   async all(){
    if(sql.includes("FROM social_publishing_authorship a"))return {results:rows.attributions.map(a=>({
      ...a,revision_count:rows.history.filter(h=>h.authorship_id===a.id).length
    }))};
    if(sql.includes("FROM social_publishing_posts p"))return {results:rows.placements.map(x=>{
      const p=rows.posts.find(row=>row.id===x.post_id);
      return {...x,post_id:p.id,client_id:p.client_id,client_name:"Southeast Safes",campaign_title:p.campaign_title,post_title:p.post_title,
       caption_text:p.caption_text,notes:p.notes,related_forward_key:p.related_forward_key};
    })};
    throw Error("Unexpected list SQL "+sql);
   },
   async run(){
    const a=this.args;
    if(sql.startsWith("INSERT INTO social_publishing_authorship(")){
      rows.attributions.push({id:id++,client_id:a[0],schedule_item_id:a[1],forward_key:a[2],platform:a[3],published_by:a[4],recorded_by:a[5]});return {meta:{changes:1}};
    }
    if(sql.startsWith("INSERT INTO social_publishing_authorship_history(")){
      rows.history.push({id:id++,authorship_id:a[0],prior_published_by:a[1],new_published_by:a[2],recorded_by:a[3]});return {meta:{changes:1}};
    }
    if(sql.startsWith("UPDATE social_publishing_authorship SET")){
      const row=rows.attributions.find(x=>x.id===a[2]&&x.client_id===a[3]&&x.schedule_item_id===a[4]);
      if(!row)throw Error("Attribution was not scoped");row.published_by=a[0];row.recorded_by=a[1];return {meta:{changes:1}};
    }
    if(sql.startsWith("INSERT OR IGNORE INTO social_publishing_posts(")){
      if(!rows.posts.some(x=>x.client_id===a[0]&&x.external_dedupe_key===a[6]))
      rows.posts.push({id:id++,client_id:a[0],campaign_title:a[1],post_title:a[2],caption_text:a[3],notes:a[4],
       created_by:a[5],external_dedupe_key:a[6],related_forward_key:a[7],source_kind:"additional"});
      return {meta:{changes:1}};
    }
    if(sql.startsWith("INSERT OR IGNORE INTO social_publishing_placements(")){
      const post=rows.posts.find(x=>x.client_id===a[5]&&x.external_dedupe_key===a[6]);
      if(!post)throw Error("Extra post not found");
      if(!rows.placements.some(x=>x.post_id===post.id&&x.platform===a[0])){
       rows.placements.push({id:id++,post_id:post.id,platform:a[0],status:"published",actual_published_date:a[1],
        proof_reference:a[2],published_by:a[3],recorded_by:a[4]});
      }
      return {meta:{changes:1}};
    }
    throw Error("Unexpected update SQL "+sql);
   }
  };
  return statement;
 },
 async batch(stmts){batchCount++;return Promise.all(stmts.map(s=>s.run()));}
};
const env={DB:db,GOOGLE_CLIENT_SECRET:secret};
const call=async (operation,body={},request=authorized)=>{
 const response=await handle({operation,...body},env,"test-social-publishing",request);
 return {status:response.status,...await response.json()};
};
let answer=await call("list",{},unsigned);
assert.equal(answer.status,401);
assert.equal(answer.writesPerformed,0);
assert.equal(rows.posts.length,0);
answer=await call("save_publisher",{clientId:22,scheduleItemId:31,forwardKey,platform:"Facebook",publishedBy:"Kristy"});
assert.equal(answer.status,409,"Wrong client must never get attribution");
answer=await call("save_publisher",{clientId:11,scheduleItemId:31,forwardKey,platform:"YouTube",publishedBy:"Kristy"});
assert.equal(answer.status,409,"Additional platform cannot be treated as a scheduled verified outcome");
assert.equal(rows.attributions.length,0);
answer=await call("save_publisher",{clientId:11,scheduleItemId:31,forwardKey,platform:"Facebook",publishedBy:"Kristy"});
assert.equal(answer.ok,true);
assert.equal(rows.attributions.length,1);
assert.equal(rows.attributions[0].published_by,"Kristy");
answer=await call("save_publisher",{clientId:11,scheduleItemId:31,forwardKey,platform:"Facebook",publishedBy:"Kristy"});
assert.equal(answer.duplicateProtected,true);
assert.equal(rows.history.length,0);
answer=await call("save_publisher",{clientId:11,scheduleItemId:31,forwardKey,platform:"Facebook",publishedBy:"Judi"});
assert.equal(answer.ok,true);
assert.equal(rows.history.length,1);
assert.equal(rows.history[0].prior_published_by,"Kristy");
assert.equal(rows.history[0].new_published_by,"Judi");
assert.equal(rows.attributions[0].published_by,"Judi");
answer=await call("add_additional",{clientId:22,campaign:"Liberty Fall Savings",title:"BOGO Community Post",
 platform:"YouTube",actualDate:"2026-10-16",publishedBy:"Operator",proofReference:"https://youtube.com/post/example",relatedForwardKey:forwardKey});
assert.equal(answer.status,409,"Cannot link another client's post to SES schedule");
answer=await call("add_additional",{clientId:11,campaign:"Liberty Fall Savings",title:"BOGO Community Post",
 platform:"YouTube",actualDate:"2026-10-16",publishedBy:"Operator",proofReference:"http://youtube.com/post/example",relatedForwardKey:forwardKey});
assert.equal(answer.status,400,"Proof must use HTTPS");
assert.equal(rows.posts.length,0);
const extra={clientId:11,campaign:"Liberty Fall Savings",title:"BOGO Community Post",platform:"YouTube",
 actualDate:"2026-10-16",publishedBy:"Operator",proofReference:"https://youtube.com/post/UgkxExample?si=abc",relatedForwardKey:forwardKey};
answer=await call("add_additional",extra);
assert.equal(answer.ok,true);
assert.equal(rows.posts.length,1);
assert.equal(rows.placements.length,1);
assert.equal(batchCount,2,"One atomic batch preserves attribution change history; another atomically records extra placement");
assert.equal(rows.placements[0].proof_reference,"https://youtube.com/post/UgkxExample");
answer=await call("add_additional",{...extra,proofReference:"https://youtube.com/post/UgkxExample?si=different"});
assert.equal(answer.duplicateProtected,true);
assert.equal(rows.posts.length,1);
assert.equal(rows.placements.length,1);
answer=await call("list");
assert.equal(answer.authorship[0].revisionCount,1);
assert.equal(answer.additional.length,1);
assert.equal(answer.additional[0].clientId,11);
assert.equal(answer.additional[0].relatedForwardKey,forwardKey);
assert.equal(answer.additional[0].platform,"YouTube");
assert.equal(answer.writesPerformed,0);
const html=fs.readFileSync(new URL("../social-publishing.html",import.meta.url),"utf8");
const ui=fs.readFileSync(new URL("../shared/social-publishing-operator-ui.js",import.meta.url),"utf8");
const worker=fs.readFileSync(new URL("../worker.js",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("../migrations/0047_social_publishing_operator_records.sql",import.meta.url),"utf8");
new vm.Script(ui,{filename:"social-publishing-operator-ui.js"});
const inline=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(inline);
new vm.Script(inline[1],{filename:"social-publishing.html inline"});
assert.match(html,/Version: 1\\.2\\.0/);
assert.match(html,/social-publishing-operator-ui\\.js\\?v=1\\.1\\.0/);
assert.match(html,/operator-sign-in/);
assert.match(html,/import-ses-history/);
assert.match(html,/ses-social-history-2026/);
assert.match(html,/publisher-dialog/);
assert.match(html,/extra-dialog/);
assert.match(worker,/SOCIAL_PUBLISHING_OPERATIONS_ACTION/);
assert.match(worker,/Version: 7\.44\.3/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS social_publishing_authorship_history/);
assert.match(migration,/external_dedupe_key/);
assert.doesNotMatch(migration,/UPDATE\s+forward_look_dispositions/i);
console.log("PASS authenticated publishing operator: wrong client blocked, schedule proof required, attribution revision history preserved");
console.log("PASS additional YouTube placement: matching client, HTTPS proof, retry-safe duplicate key and separate counts");
