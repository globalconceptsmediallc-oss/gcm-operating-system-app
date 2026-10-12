/* =========================================================
 Global Concepts Media Operating System
 File: tests/mediaCreativeClientScope.test.js
 Version: 1.0.0
 Purpose: Guard against cross-client creative cards, status counts and
          filter options when Media Workspace client selector is active.
 No production data writes or external calls.
 ========================================================= */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../media.html",import.meta.url),"utf8");
const start=html.indexOf("  function creativeItems() {");
const end=html.indexOf("\n  function creativeStage(",start);
assert.ok(start>=0&&end>start,"Media page must declare its creativeItems projection");
assert.match(html,/Version: 2\.5\.1/);
assert.match(html,/const ci=creativeItems\(\)/,"Media filter options must use scoped creatives");
assert.match(html,/const creativeVisible=creativeItems\(\)\.filter\(creativeMatchesFilters\)/,"Commercial dashboard counts must use scoped creatives");
const source=html.slice(start,end);
assert.match(source,/Number\(c\.clientId\) === selectedClientId/,"Scope must use authoritative client ID");
const workflow={
 creatives:[
  {id:101,clientId:11,clientCode:"SES",clientName:"Southeast Safes",creativeName:"Safe Moving Services 2",status:"running"},
  {id:102,clientId:22,clientCode:"A1",clientName:"A1 Action Safe & Lock",creativeName:"Expensive Key",status:"running"},
  {id:103,clientId:11,clientCode:"SES",clientName:"Southeast Safes",creativeName:"Christmas 2026",status:"draft"},
  {id:104,clientId:22,clientCode:"A1",clientName:"A1 Action Safe & Lock",creativeName:"Christmas 2026",status:"draft"},
  {id:105,clientId:null,clientCode:"SES",clientName:"Southeast Safes",creativeName:"Unverified Owner",status:"running"}
 ],
 assignments:[
  {id:201,creativeId:101,market:"Melbourne",outletName:"WMMB",rotationStartDate:"2026-09-01",rotationEndDate:"2026-10-31"},
  {id:202,creativeId:102,market:"Melbourne",outletName:"WMMB",rotationStartDate:"2026-09-01",rotationEndDate:"2026-10-31"},
  {id:203,creativeId:104,market:"Orlando",outletName:"WFLA",rotationStartDate:"2026-10-01",rotationEndDate:"2026-10-31"}
 ],
 trafficPackages:[
  {id:301,creativeId:101,packageStatus:"confirmed"},
  {id:302,creativeId:102,packageStatus:"confirmed"}
 ],
 confirmations:[
  {id:401,trafficPackageId:301,stationTraffickedConfirmed:true},
  {id:402,trafficPackageId:302,stationTraffickedConfirmed:true}
 ]
};
let selected="11";
const select=id=>{assert.equal(id,"client");return {value:selected};};
const creativeItems=new Function("creativeWorkflow","$",source+"\nreturn creativeItems;")(workflow,select);
function names(items){return items.map(x=>x.creativeName).sort();}
let result=creativeItems();
assert.deepEqual(names(result),["Christmas 2026","Safe Moving Services 2"],"SES selection must exclude A1 and unowned cards");
assert.equal(result.filter(x=>x.status==="running").length,1,"SES running count excludes A1 running");
assert.equal(result.filter(x=>x.status==="draft").length,1,"SES draft count excludes A1 drafts");
assert.deepEqual(result.flatMap(x=>x.assignments).map(x=>x.id),[201],"SES option data must exclude A1 market assignments");
assert.deepEqual(result.flatMap(x=>x.confirmations).map(x=>x.id),[401],"SES cards must not inherit A1 station confirmations");
selected="22";result=creativeItems();
assert.deepEqual(names(result),["Christmas 2026","Expensive Key"],"A1 must display only A1");
assert.equal(result.filter(x=>x.status==="running").length,1,"A1 running count excludes SES running");
assert.deepEqual(result.flatMap(x=>x.confirmations).map(x=>x.id),[402]);
selected="";assert.equal(creativeItems().length,5,"All clients intentionally displays the global workflow");
selected="999";assert.deepEqual(creativeItems(),[],"Unknown valid numeric client must not leak creatives");
selected="invalid";assert.deepEqual(creativeItems(),[],"Unexpected client selector must fail closed");
selected="11";assert.equal(creativeItems().length,2,"Changing client back must update without page reload");
assert.equal(workflow.creatives.length,5,"Filtering must not mutate source records");
console.log("PASS Media v2.5.1 Creative Client Scope: SES, A1, all, invalid, counts, options, confirmation and read-only");
