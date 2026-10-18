/* GCM OS • Eight advertiser print-source concepts • Version: 1.3.0 */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const files=[
 ["heron-home-outdoor","Heron Home & Outdoor","$100","August 31, 2026"],
 ["florida-pest-control","Florida Pest Control","$50","August 31, 2026"],
 ["renewal-by-andersen-river-rocks","Renewal by Andersen","August 25, 2026","River Rocks"],
 ["prosper-exterior-cleaning","Prosper Exterior Cleaning LLC","$300","November 15, 2026"],
 ["restore-wellness-center","Restore Wellness Center","$99","patient"],
 ["a-picture-perfect-pet","A Picture Perfect Pet","$10","November 15, 2026"],
 ["karen-nierenberg-one-percent-lists","Karen Nierenberg / 1 Percent Lists","1%","listing"],
 ["fiesta-azteca-melbourne","Fiesta Azteca","Viva Hour","November 15, 2026"]
];
const route=fs.readFileSync(new URL("../routes/prospectConceptTracking.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../shared/prospect-print-concept.css",import.meta.url),"utf8");
const js=fs.readFileSync(new URL("../shared/prospect-print-concept.js",import.meta.url),"utf8");
new vm.Script(js);assert.match(js,/gcm_preview/);assert.match(js,/prospect-concept-view/);
assert.match(route,/VERSION = "1\.2\.0"/);
for(const [slug,name,offer,boundary] of files){
 const html=fs.readFileSync(new URL("../prospect-previews/"+slug+"/index.html",import.meta.url),"utf8");
 assert.match(html,/noindex,nofollow,noarchive,noimageindex/);
 assert.match(html,/independent/i);assert.ok(html.includes(name.replaceAll('&','&amp;')));
 assert.ok(html.includes(offer));assert.ok(html.includes(boundary));
 assert.ok(html.includes(slug+"-mailer-to-customer-v1"));
 assert.ok(route.includes('businessName: "'+name+'"'));
 assert.ok(route.includes('"/prospect-previews/'+slug+'/"'));
 assert.match(html,/prospect-print-concept\.js/);
 if(slug==="heron-home-outdoor"){
  assert.match(html,/Version: 4\.0\.0/);
  assert.match(html,/id="campaign-detail"/);
  assert.match(html,/id="try-handoff"/);
  assert.match(html,/id="conversation"/);
  assert.match(html,/I saw your lawn-care postcard/i);
 }else{
  assert.match(html,/prospect-print-concept\.css/);
  assert.match(html,/compare|Compare/);assert.match(html,/90-day|90 days/i);
 }
 assert.doesNotMatch(html,/Teresa S Belcher|431 Vizcaya Ct|32940-1833/i);
}
assert.match(css,/\.hero/);assert.match(css,/\.mailer/);
assert.doesNotMatch(route,/businessName:\s*"River Rocks"/,"River Rocks is only an event venue");
console.log("PASS eight independent print advertiser concepts: safe history, tailored funnels, unlisted previews and exact Radar tracker names");
