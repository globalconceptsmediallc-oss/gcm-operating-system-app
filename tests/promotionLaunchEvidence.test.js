/* =========================================================
   Global Concepts Media Operating System
   File: tests/promotionLaunchEvidence.test.js
   Version: 1.0.0
   Status: Regression Test
   Purpose: Link a verified launch-day social post to ONLY the same
            promotion's start milestone; retain its full sales window
            and never treat social posts as storefront/checkout proof.
   ========================================================= */
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import "../shared/promotion-launch-evidence.js";

const find=globalThis.GCMPromotionLaunchEvidence.findVerifiedPromotionLaunch;
assert.equal(globalThis.GCMPromotionLaunchEvidence.fileVersion,"1.0.0");
const channels=["Facebook","Google Business Profile","Instagram"];
const base={sourceKey:"ses:liberty:fall-2026",scheduleItemId:41,startDate:"2026-10-15",endDate:"2026-11-01"};
const promo={...base,kind:"promotion",key:base.sourceKey+":promotion:2026-10-15:Liberty Fall Savings"};
const social={...base,kind:"social_post",endDate:"2026-10-15",key:base.sourceKey+":social_post:2026-10-15:SOCIAL — FALL SAVINGS LAUNCH",metadata:{parentType:"promotion",channels}};
const key="schedule|"+social.key+"|2026-10-15";
function makeEvidence(statuses=["published","published","published"]){
 return new Map([[key.toLowerCase(),{
  forwardKey:key,disposition:statuses.every(s=>s==="published")?"social_published":"social_mixed",
  reason:JSON.stringify({
   schema:"gcm-social-execution-v1",scheduleItemId:41,plannedDate:"2026-10-15",
   platforms:channels.map((platform,i)=>({
    platform,status:statuses[i],publishedDate:i===0?"2026-10-15":"2026-10-16",
    proofReference:i===0?"https://www.facebook.com/photo/?fbid=example":
      i===1?"https://www.google.com/search?q=Southeast+Safes":"https://www.instagram.com/p/example/"
   }))
  })
 }]]);
}
const evidence=makeEvidence();
const match=find(promo,[promo,social],evidence);
assert.ok(match,"Fully verified first-day social launch must close its own promotion-start milestone");
assert.equal(match.promotionSourceKey,base.sourceKey);
assert.equal(match.scheduleItemId,41);
assert.equal(match.launchScheduledDate,"2026-10-15");
assert.equal(match.firstPublishedDate,"2026-10-15");
assert.equal(match.lastPublishedDate,"2026-10-16");
assert.equal(match.channels.length,3);
assert.deepEqual(match.channels.map(p=>p.platform),channels);
assert.equal(promo.endDate,"2026-11-01","Original sale run end date must be preserved");
assert.equal(social.endDate,"2026-10-15","Social obligation date must remain original");
assert.ok(find(promo,[promo,social],evidence),"Evidence lookup must be read-only and repeatable");

assert.equal(find({...promo,sourceKey:"ses:other-promo"},[promo,social],evidence),null,"Do not infer a launch from another promotion");
assert.equal(find({...promo,scheduleItemId:400},[promo,social],evidence),null,"Do not link a different D1 schedule record");
assert.equal(find({...promo,kind:"gun_show"},[promo,social],evidence),null,"Gun shows are not promotions");
assert.equal(find(promo,[promo,{...social,startDate:"2026-10-16"}],evidence),null,"A later campaign post is not first-day launch evidence");
assert.equal(find(promo,[promo,{...social,metadata:{...social.metadata,parentType:"gun_show"}}],evidence),null,"Parent type must be promotion");
assert.equal(find(promo,[promo,social],new Map()),null,"No stored proof means the overdue milestone must remain");
assert.equal(find(promo,[promo,social],makeEvidence(["published","missed","published"])),null,"A mixed outcome does not establish a complete launch");

function withMutatedProof(fn) {
 const mutated=makeEvidence();
 const row=mutated.get(key.toLowerCase());
 const reason=JSON.parse(row.reason);
 fn(row,reason);
 row.reason=JSON.stringify(reason);
 return find(promo,[promo,social],mutated);
}
assert.equal(withMutatedProof((row,p)=>{p.platforms[1].proofReference="";}),null,"Every scheduled channel needs a proof reference");
assert.equal(withMutatedProof((row,p)=>{p.platforms[1].publishedDate="2026-12-01";}),null,"Posting after promotion end does not prove launch within sale window");
assert.equal(withMutatedProof((row,p)=>{p.plannedDate="2026-10-16";}),null,"An unrelated scheduled posting date cannot complete the launch");
assert.equal(withMutatedProof((row,p)=>{p.scheduleItemId=77;}),null,"Mismatched D1 item id is not launch proof");
assert.equal(withMutatedProof((row,p)=>{p.platforms[0].proofReference="unverified";}),null,"References must be durable HTTPS links");
assert.equal(withMutatedProof((row,p)=>{p.platforms.push({...p.platforms[0]});}),null,"Additional unverified scheduled channel cannot silently satisfy the contract");
assert.equal(withMutatedProof((row,p)=>{row.disposition="social_missed";}),null,"Missed dispositions are not publication proof");

const today=fs.readFileSync(new URL("../today.html",import.meta.url),"utf8");
const calendar=fs.readFileSync(new URL("../media-calendar.html",import.meta.url),"utf8");
const helperSrc=fs.readFileSync(new URL("../shared/promotion-launch-evidence.js",import.meta.url),"utf8");
new vm.Script(helperSrc,{filename:"promotion-launch-evidence.js"});
for (const [name,html] of [["Today",today],["Media Calendar",calendar]]) {
 assert.match(html,/shared\/promotion-launch-evidence\.js\?v=1\.0\.0/);
 const inline=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(inline,name+" inline application script must exist");
 new vm.Script(inline[1],{filename:name+".js"});
}
assert.match(today,/function promotionStartLaunchPublished\(item\)/);
assert.match(today,/!promotionStartLaunchPublished\(item\)/,"Only the proven launch milestone is excluded from open Forward Look");
assert.match(today,/item\.kind !== "Promotion Start"/,"Only a promotion-start may be suppressed");
assert.match(calendar,/launchEvidence:launch\|\|null/,"Calendar must attach only the linked evidence");
assert.match(calendar,/Launch posted/,"Calendar must distinguish published marketing from scheduled sale");
assert.match(calendar,/Retail checkout, stock, and fulfillment not independently verified/);
assert.match(calendar,/endDate:ev\.endDate/,"Original promotion end-date must remain authoritative");
assert.match(calendar,/if\(ev\.kind==="takedown_due"\)/,"Takedown due must remain a separate schedule milestone");
console.log("PASS promotion first-day proof link requires exact D1 source, 3 published channels and dates");
console.log("PASS missing proof/unrelated promotions remain open; launch status never verifies retail checkout");
console.log("PASS Today and Media Calendar scripts compile and preserve promotion run / takedown milestones");
