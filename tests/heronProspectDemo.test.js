/* =========================================================
 GCM OS | tests/heronProspectDemo.test.js
 Version: 4.0.0 — Owner-to-owner Heron prospect note
 Verifies candid personal language, retained researched evidence,
 optional interactive demo, privacy and no manufactured economics.
 ========================================================= */
import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
const html=fs.readFileSync(new URL("../prospect-previews/heron-home-outdoor/index.html",import.meta.url),"utf8");
assert.match(html,/Version: 4\.0\.0/);
assert.match(html,/noindex,nofollow,noarchive,noimageindex/);
assert.match(html,/heron-home-outdoor-mailer-to-customer-v1/);
assert.match(html,/I saw your lawn-care postcard, and/);
assert.match(html,/From one business owner to another/);
assert.match(html,/I spend time in my clients' offices/);
assert.match(html,/what actually makes those customers profitable/);
assert.match(html,/I'm not claiming I know what Heron needs/);
assert.match(html,/not reaching out to tell you your website is broken/);
assert.match(html,/id="why-i-reached-out"/);
assert.match(html,/id="what-i-saw"/);
assert.match(html,/id="how-i-work"/);
assert.match(html,/id="campaign-detail"/);
assert.match(html,/id="conversation"/);
assert.match(html,/id="try-handoff"/);
assert.match(html,/What caught my eye/);
assert.match(html,/nothing worth fixing|nothing worth/i);
assert.match(html,/August 31, 2026/);
assert.match(html,/October 31, 2026/);
assert.match(html,/customer-acquisition|new lawn-care customers|new customers/i);
assert.match(html,/mailto:globalconceptsmediallc@gmail.com/);
assert.match(html,/15 minutes/);
assert.match(html,/myheronhome\.com\/specials\//);
assert.match(html,/myheronhome\.com\/lawn-care-offer-save100\//);
assert.match(html,/shared\/prospect-print-concept\.js\?v=1\.0\.0/);
const copyBeforeDemo=html.indexOf('id="why-i-reached-out"');
const demo=html.indexOf('id="campaign-example"');
assert.ok(copyBeforeDemo>0&&demo>copyBeforeDemo,"Personal introduction must precede technical concept");
assert.match(html,/<details id="campaign-detail">/,"Technical demo is optional, not the pitch");
assert.doesNotMatch(html,/Track the transition with available tools|more traffic is only useful|simply measure the next campaign|could win more customers from the same interest/i);
assert.doesNotMatch(html,/<form\b|type="email"|type="tel"|name="first_name"|name="phone"/i,"No consumer intake on a prospect letter");
assert.doesNotMatch(html,/Teresa S Belcher|431 Vizcaya|32940-1833|Heron's conversion rate is|Heron loses \d+ leads/i);
const script=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script);
assert.doesNotMatch(script[1],/fetch\(|XMLHttpRequest|navigator\.sendBeacon|localStorage|sessionStorage/);
new vm.Script(script[1],{filename:"Heron v4 owner demo"});
const buttons=["quote-offer","quote-only"].map(choice=>({
 dataset:{choice},attrs:{},events:{},
 addEventListener(name,fn){this.events[name]=fn;},
 setAttribute(name,value){this.attrs[name]=value;}
}));
const fields={};
for(const id of ["handoff-intent","choice-explanation","handoff-result","try-handoff"]){
 fields[id]={textContent:"",events:{},addEventListener(name,fn){this.events[name]=fn;}};
}
const document={
 querySelectorAll(s){assert.equal(s,".choice");return buttons;},
 getElementById(s){assert.ok(fields[s],"Missing "+s);return fields[s];}
};
new vm.Script(script[1]).runInNewContext({document});
assert.equal(fields["handoff-intent"].textContent,"Lawn-care quote + check eligible offer");
assert.equal(buttons[0].attrs["aria-pressed"],"true");
buttons[1].events.click();
assert.equal(fields["handoff-intent"].textContent,"Lawn-care quote only");
assert.equal(buttons[1].attrs["aria-pressed"],"true");
fields["try-handoff"].events.click();
assert.match(fields["handoff-result"].textContent,/Nothing was transmitted/);
buttons[0].events.click();
assert.match(fields["handoff-result"].textContent,/Nothing is submitted, stored, or sent/);
console.log("PASS Heron v4: authentic owner-to-owner voice, verified observation, optional safe example and clear low-pressure CTA");
console.log("PASS Heron v4: no personal data capture, preview-safe engagement identity and simulation changes only visible UI");
