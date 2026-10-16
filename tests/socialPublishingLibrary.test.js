/* =========================================================
   Global Concepts Media Operating System
   File: tests/socialPublishingLibrary.test.js
   Version: 1.0.0
   Status: Read-only Regression Test
   Purpose: Guarantee scoped, accurate D1 publishing projections and
            schema-only library foundation without migration/backfill.
   ========================================================= */
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import "../shared/social-publishing-library.js";
const {normalizedScheduled,totals}=globalThis.GCMSocialPublishingLibrary;
const channels=["Facebook","Google Business Profile","Instagram"];
const event={
 key:"SES:Liberty:Fall:2026:social_post:2026-10-15:SOCIAL — FALL SAVINGS LAUNCH",
 scheduleItemId:20,clientId:11,clientName:"Southeast Safes",clientCode:"SES",
 kind:"social_post",title:"SOCIAL — FALL SAVINGS LAUNCH",startDate:"2026-10-15",
 metadata:{channels,parentType:"promotion"}
};
const key="schedule|"+event.key+"|2026-10-15";
const disposition={
 forwardKey:key,title:event.title,disposition:"social_published",reviewedBy:"GCM operator",
 reason:JSON.stringify({
  schema:"gcm-social-execution-v1",plannedDate:"2026-10-15",scheduleItemId:20,
  note:"YouTube additional: https://www.youtube.com/post/example",
  correctionHistory:[{previousDisposition:"social_missed"}],
  platforms:[
   {platform:"Facebook",status:"published",publishedDate:"2026-10-15",proofReference:"https://www.facebook.com/photo/?fbid=example"},
   {platform:"Google Business Profile",status:"published",publishedDate:"2026-10-16",proofReference:"https://www.google.com/search?q=Southeast+Safes"},
   {platform:"Instagram",status:"published",publishedDate:"2026-10-16",proofReference:"https://www.instagram.com/p/example"}
  ]
 })
};
let projection=normalizedScheduled([event],[disposition],"2026-10-16");
assert.equal(projection.posts.length,1);
assert.equal(projection.unmatched.length,0);
const p=projection.posts[0];
assert.equal(p.clientName,"Southeast Safes");
assert.equal(p.clientId,11);
assert.equal(p.plannedDate,"2026-10-15","Scheduled date must not shift to actual publishing date");
assert.deepEqual(p.platforms.map(x=>x.actualDate),["2026-10-15","2026-10-16","2026-10-16"]);
assert.ok(p.platforms.every(x=>x.status==="published"));
assert.equal(p.platforms[0].publishedBy,null,"Correcting operator must not become inferred publisher");
assert.equal(p.reviewedBy,"GCM operator");
assert.equal(p.revisions,1,"Prior missed disposition remains traceable");
assert.match(p.note,/YouTube additional/,"Unscheduled video stays in notes, not an invented placement");
assert.equal(p.platforms.length,3,"YouTube in notes must not become a fourth scheduled platform");
assert.equal(totals(projection.posts).published,3);

const other={...event,key:"A1:campaign:post",clientId:22,clientName:"A1 Action Safe & Lock",clientCode:"A1",scheduleItemId:23,title:"Separate A1 post",startDate:"2026-10-20"};
projection=normalizedScheduled([event,other],[disposition],"2026-10-16");
assert.equal(projection.posts.length,2);
assert.equal(projection.posts.find(x=>x.clientId===22).platforms.every(x=>x.status==="planned"),true,
 "Evidence from SES must never be attributed to A1");
assert.equal(totals(projection.posts).published,3);
assert.equal(totals(projection.posts).planned,3);

projection=normalizedScheduled([event],[],"2026-10-16");
assert.equal(projection.posts[0].platforms.every(x=>x.status==="unverified"),true,
 "Past unsourced posts are NOT silently missed");
projection=normalizedScheduled([other],[],"2026-10-16");
assert.equal(projection.posts[0].platforms.every(x=>x.status==="planned"),true,
 "Future posts are planned, never called published");
const malformed={...disposition,reason:JSON.stringify({schema:"gcm-social-execution-v1",scheduleItemId:999,plannedDate:"2026-10-15",platforms:[]})};
projection=normalizedScheduled([event],[malformed],"2026-10-16");
assert.equal(projection.posts[0].evidenceMismatch,true);
assert.equal(projection.posts[0].platforms.every(x=>x.status==="unverified"),true);

const pending={...disposition,reason:JSON.stringify({
 schema:"gcm-social-execution-v1",scheduleItemId:20,plannedDate:"2026-10-15",
 platforms:channels.map((platform,i)=>({platform,status:i?"missed":"published",publishedDate:"2026-10-15",proofReference:i?"":"https://proof.example/post"}))
})};
projection=normalizedScheduled([event],[pending],"2026-10-16");
assert.deepEqual(projection.posts[0].platforms.map(x=>x.status),["published","missed","missed"]);
assert.equal(totals(projection.posts).missed,2);

const orphan={...disposition,forwardKey:"schedule|archived-item|2026-09-30"};
projection=normalizedScheduled([event],[disposition,orphan],"2026-10-16");
assert.equal(projection.unmatched.length,1,"Unlinked history must not silently disappear or gain a client");
assert.equal(projection.unmatched[0].status,"needs_source_link");
assert.throws(()=>normalizedScheduled(undefined,[], "2026-10-16"),/unavailable/);
assert.throws(()=>normalizedScheduled([],null, "2026-10-16"),/unavailable/);
assert.equal(totals([]).posts,0);

const html=fs.readFileSync(new URL("../social-publishing.html",import.meta.url),"utf8");
const media=fs.readFileSync(new URL("../media.html",import.meta.url),"utf8");
const script=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script);
new vm.Script(script[1],{filename:"social-publishing.html inline script"});
assert.match(html,/Version: 1\.0\.0/);
assert.match(html,/Social Publishing Library/);
assert.match(html,/read-only/i);
assert.match(html,/data-gcm-shell-sidebar/);
assert.match(html,/social-publishing-library\.js\?v=1\.0\.0/);
assert.match(media,/href="social-publishing\.html"/);
assert.match(media,/Version: 2\.5\.2/);
assert.doesNotMatch(html,/operation:"(create|update|delete|save|post|publish)"/);
assert.match(html,/if\(!response\.ok\|\|json\?\.ok!==true\)/,"Failed source calls must not masquerade as empty history");
assert.match(html,/No publishing records match these filters/);
assert.match(html,/Unattributed client/);

const migration=fs.readFileSync(new URL("../migrations/0046_social_publishing_library.sql",import.meta.url),"utf8");
assert.match(migration,/CREATE TABLE IF NOT EXISTS social_publishing_posts/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS social_publishing_placements/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS social_publishing_assets/);
assert.match(migration,/FOREIGN KEY \(client_id\) REFERENCES clients\(id\)/);
assert.match(migration,/FOREIGN KEY \(schedule_item_id\) REFERENCES schedule_items\(id\)/);
assert.match(migration,/UNIQUE \(post_id,platform\)/);
assert.match(migration,/UNIQUE \(post_id,storage_provider,storage_reference\)/);
assert.doesNotMatch(migration,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER)\s+(?:INTO|FROM|TABLE|social_|schedule_|forward_look_)/i,
 "Phase 1 migration creates empty tables without touching production source rows");
console.log("PASS Social Publishing Library v1.0.0 client proof isolation, real dates, mixed states, unmatched history, and empty/error UI");
console.log("PASS Phase 1 creates only new D1 tables, links Media, and exposes no publishing/edit/upload writes");
