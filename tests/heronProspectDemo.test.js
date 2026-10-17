/* GCM OS • Heron high-conversion prospect presentation regression • v2.0.0 */
import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
const html=fs.readFileSync(new URL("../prospect-previews/heron-home-outdoor/index.html",import.meta.url),"utf8");
assert.match(html,/Version: 2\.0\.0/);
assert.match(html,/name="robots" content="noindex,nofollow,noarchive,noimageindex"/);
assert.match(html,/heron-home-outdoor-mailer-to-customer-v1/);
assert.match(html,/Your next lawn-care mailer could/);
assert.match(html,/already have a website quote process/);
assert.match(html,/one upcoming mail campaign/i);
assert.match(html,/What we would actually deliver/);
assert.match(html,/Request the 15-minute demo/);
assert.match(html,/mailto:globalconceptsmediallc@gmail.com/);
assert.match(html,/myheronhome\.com\/lawn\//);
assert.match(html,/August 31, 2026/);
assert.match(html,/no actual lead was sent/i);
assert.doesNotMatch(html,/Track the transition with available tools|the next customer step visible|simply measure the next campaign/i);
assert.doesNotMatch(html,/<form|<input|<textarea/,"The concept must not capture consumer PII");
assert.doesNotMatch(html,/Teresa S Belcher|431 Vizcaya|32940-1833|client ROI|converted \d+ leads/i);
assert.match(html,/shared\/prospect-print-concept\.js\?v=1\.0\.0/);
const inline=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(inline,"Working interactive sample is required");
new vm.Script(inline[1],{filename:"Heron interaction inline"});
const issueNames=["Broadleaf weeds","Lawn insects","Brown or thin grass"];
const buttons=issueNames.map((issue,i)=>({
 dataset:{issue,need:["Weed suppression","Insect suppression","Lawn health assessment"][i]},
 attrs:{"aria-pressed":"false"},events:{},
 addEventListener(name,fn){this.events[name]=fn;},
 setAttribute(k,v){this.attrs[k]=v;}
}));
const nodes={
 "preview-handoff":{disabled:true,textContent:"",events:{},addEventListener(name,fn){this.events[name]=fn;}},
 "handoff-concern":{textContent:""},
 "handoff-service":{textContent:""},
 "handoff-next":{textContent:""},
 "handoff-caption":{textContent:""}
};
const document={
 querySelectorAll(selector){assert.equal(selector,".issue");return buttons;},
 getElementById(id){assert.ok(nodes[id],id);return nodes[id];}
};
new vm.Script(inline[1]).runInNewContext({document});
assert.ok(buttons.every(x=>typeof x.events.click==="function"));
assert.equal(nodes["preview-handoff"].disabled,true);
buttons[1].events.click();
assert.equal(nodes["handoff-concern"].textContent,"Lawn insects");
assert.equal(nodes["handoff-service"].textContent,"Insect suppression");
assert.equal(nodes["preview-handoff"].disabled,false);
assert.equal(buttons[1].attrs["aria-pressed"],"true");
assert.equal(buttons[0].attrs["aria-pressed"],"false");
nodes["preview-handoff"].events.click();
assert.match(nodes["handoff-caption"].textContent,/No actual lead was sent/);
buttons[0].events.click();
assert.equal(nodes["handoff-service"].textContent,"Weed suppression");
assert.equal(buttons[1].attrs["aria-pressed"],"false");
console.log("PASS Heron: conversion-led sales message, explicit deliverables, credible research, no fake offer or consumer intake");
console.log("PASS Heron mobile proof-of-concept: interactive issue selection and simulated handoff without external writes");
