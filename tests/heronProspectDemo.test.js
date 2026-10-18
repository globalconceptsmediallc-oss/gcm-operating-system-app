/* =========================================================
 GCM OS | tests/heronProspectDemo.test.js
 Version: 3.0.0 | Side-by-side customer acquisition business case
 Regresses substantive pitch, safe public evidence, consumer privacy,
 independent sample economics and interactive simulation.
 ========================================================= */
import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
const html=fs.readFileSync(new URL("../prospect-previews/heron-home-outdoor/index.html",import.meta.url),"utf8");
assert.match(html,/Version: 3\.0\.0/);
assert.match(html,/noindex,nofollow,noarchive,noimageindex/);
assert.match(html,/heron-home-outdoor-mailer-to-customer-v1/);
assert.match(html,/Your next lawn-care mailer could/);
assert.match(html,/id="finding"/);
assert.match(html,/id="comparison"/);
assert.match(html,/id="value"/);
assert.match(html,/id="pilot"/);
assert.match(html,/id="meeting"/);
assert.match(html,/Two separate response choices/);
assert.match(html,/One clear offer-to-quote path/);
assert.match(html,/What GCM needs from Heron/);
assert.match(html,/October 31, 2026/);
assert.match(html,/August 31, 2026/);
assert.match(html,/mailing.*could|could.*mailing|could.*win more customers/is);
assert.match(html,/Heron's existing|Heron has a campaign-specific page/i);
assert.match(html,/internal lead routing|internally/);
assert.match(html,/illustration|hypothetical/i);
assert.match(html,/gross contribution/i);
assert.match(html,/mailto:globalconceptsmediallc@gmail.com/);
assert.match(html,/15-minute/i);
assert.match(html,/myheronhome\.com\/specials\//);
assert.match(html,/myheronhome\.com\/lawn-care-offer-save100\//);
assert.match(html,/shared\/prospect-print-concept\.js\?v=1\.0\.0/);
assert.doesNotMatch(html,/Track the transition with available tools|more traffic is only useful|simply measure the next campaign/i);
assert.doesNotMatch(html,/<form\b|type="email"|type="tel"|name="first_name"|name="phone"/i,"No consumer lead-capture form on prospect demonstration.");
assert.doesNotMatch(html,/Teresa S Belcher|431 Vizcaya|32940-1833|Heron's conversion rate is|Heron loses \d+ leads/i);
const inline=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(inline,"Actual demonstration must be interactive.");
assert.doesNotMatch(inline[1],/fetch\(|XMLHttpRequest|navigator\.sendBeacon|localStorage|sessionStorage/);
new vm.Script(inline[1],{filename:"Heron v3 demo"});
const buttons=["quote-offer","quote-only"].map(choice=>({
 dataset:{choice},attrs:{},events:{},
 addEventListener(name,fn){this.events[name]=fn;},
 setAttribute(k,value){this.attrs[k]=value;}
}));
const nodes={};
for(const id of ["choice-explanation","handoff-intent","handoff-route","handoff-offer","handoff-result","try-handoff","result-quotes","result-money","calc-disclaimer"]){
 nodes[id]={textContent:"",events:{},addEventListener(n,fn){this.events[n]=fn;}};
}
for(const [id,value] of Object.entries({
 "calc-visits":"400","calc-before":"8","calc-after":"10","calc-close":"25","calc-value":"450"
})){
 nodes[id]={value,events:{},addEventListener(n,fn){this.events[n]=fn;}};
}
const document={
 querySelectorAll(selector){assert.equal(selector,".mock");return buttons;},
 getElementById(id){assert.ok(nodes[id],"Missing mock "+id);return nodes[id];}
};
new vm.Script(inline[1]).runInNewContext({document,Intl});
assert.ok(buttons.every(x=>typeof x.events.click==="function"));
assert.equal(nodes["handoff-intent"].textContent,"Lawn-care quote + offer eligibility review");
assert.equal(buttons[0].attrs["aria-pressed"],"true");
assert.equal(buttons[1].attrs["aria-pressed"],"false");
buttons[1].events.click();
assert.equal(nodes["handoff-intent"].textContent,"Lawn-care quote only");
assert.equal(nodes["handoff-offer"].textContent,"No coupon requested");
assert.equal(buttons[1].attrs["aria-pressed"],"true");
nodes["try-handoff"].events.click();
assert.match(nodes["handoff-result"].textContent,/No information was transmitted/);
buttons[0].events.click();
assert.match(nodes["handoff-intent"].textContent,/offer eligibility/);
assert.equal(nodes["result-quotes"].textContent,"8");
assert.equal(nodes["result-money"].textContent,"$900");
nodes["calc-after"].value="8";nodes["calc-after"].events.input();
assert.equal(nodes["result-quotes"].textContent,"0");
assert.equal(nodes["result-money"].textContent,"$0");
nodes["calc-after"].value="6";nodes["calc-after"].events.input();
assert.equal(nodes["result-quotes"].textContent,"-8");
assert.match(nodes["calc-disclaimer"].textContent,/lose qualified quote requests/);
console.log("PASS Heron v3: evidence-grounded offer clarity, exact customer value, explicit CTA, conditional claims, no consumer data.");
console.log("PASS Heron v3: current vs proposed path, safe simulated handoff and transparent incremental contribution math.");
