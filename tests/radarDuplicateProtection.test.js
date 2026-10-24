/* =========================================================
   GCM Operating System
   File: tests/radarDuplicateProtection.test.js
   Version: 1.0.0
   Status: Non-destructive regression — mocked D1, no production writes.
   Purpose: Cover atomic business identity guard and Radar UI submit lock.
   ========================================================= */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {handleProspectCrm} from "../routes/prospectCrm.js";

const ui=readFileSync("prospects.html","utf8");
assert.match(ui,/File: prospects\.html[\s\S]*?Version: 3\.10\.0/);
assert.match(ui,/let radarCreatePending=false/);
assert.match(ui,/if\(radarCreatePending\)return/);
assert.match(ui,/radarCreatePending=true;save\.disabled=true/);
assert.match(ui,/finally\s*\{\s*radarCreatePending=false;save\.disabled=false/);
assert.match(ui,/if\(result\.duplicateProtected\)/);
assert.match(ui,/await openRadar\(r\.id\)/);
assert.match(ui,/if\(r\.archivedAt\)/);
assert.match(ui,/else if\(r\.promotedProspectId\)/);
const scripts=[...ui.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(Boolean);
const main=scripts.find(x=>x.includes('const FILE_VERSION="3.10.0"'));
assert.ok(main);
new Script(main,{filename:"prospects.html:inline"});

const recordRows=[];
let seq=21,actualInserts=0;
const norm=v=>String(v??"").replace(/\s+/g," ").trim().toLowerCase();
const existing=(name,market)=>recordRows.filter(x=>norm(x.business_name)===name
  &&(!norm(x.market)||!market||norm(x.market)===market)).sort((a,b)=>a.id-b.id)[0];
class Stmt{
  constructor(sql){this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async all(){
    const sql=this.sql.toLowerCase().trim();
    if(sql.startsWith("insert into crm_prospect_radar")){
      assert.match(sql,/not exists \(select 1 from crm_prospect_radar r where /i);
      assert.match(sql,/returning id/i);
      const a=this.args,n=norm(a[1]),m=norm(a[5]);
      assert.equal(a.length,17);
      assert.equal(a[14],n);
      assert.equal(a[15],m);
      assert.equal(a[16],m);
      if(n&&existing(n,m))return{results:[]};
      const row={id:seq++,entry_type:a[0],business_name:a[1],website:a[2],
        test_site_url:a[3],vertical:a[4],market:a[5],source_type:a[6],
        source_description:a[7],contact_name:a[8],contact_email:a[9],
        contact_phone:a[10],evidence_reference:a[11],notes:a[12],status:a[13],
        created_at:"2026-10-15",updated_at:"2026-10-15",archived_at:null,promoted_prospect_id:null};
      recordRows.push(row);actualInserts++;
      return{results:[{id:row.id}]};
    }
    if(sql.startsWith("select id from crm_prospect_radar r")){
      const n=this.args[0],m=this.args[1];assert.equal(this.args[2],m);
      const match=existing(n,m);return{results:match?[{id:match.id}]:[]};
    }
    if(sql.includes("select * from crm_prospect_radar where id = ? limit 1")){
      const row=recordRows.find(x=>x.id===this.args[0]);
      return{results:row?[{...row}]:[]};
    }
    throw Error("Unexpected SQL in duplicate regression: "+sql.slice(0,190));
  }
}
const env={DB:{prepare:sql=>new Stmt(sql)}};
async function create(payload){
  const r=await handleProspectCrm({operation:"create_radar",sourceType:"advertisement",...payload},env,"test-radar-dedupe");
  return{status:r.status,data:await r.json()};
}
const base={businessName:"Savant Wealth Management",market:"Satellite Beach / Melbourne",website:"https://savantwealth.com/",
  sourceDescription:"Received tax-smart retirement invitation.",contactName:"Patricia"};
const one=await create(base);
assert.equal(one.status,201);
assert.equal(one.data.writesPerformed,1);
assert.equal(one.data.radar.id,21);
const second=await create({...base,businessName:"  sAvAnT  Wealth Management ",market:"SATELLITE BEACH / MELBOURNE",
  sourceDescription:"New mailer should never replace the old research."});
assert.equal(second.status,200);
assert.equal(second.data.duplicateProtected,true);
assert.equal(second.data.radar.id,21);
assert.equal(second.data.writesPerformed,0);
assert.equal(recordRows[0].source_description,"Received tax-smart retirement invitation.");
assert.equal(actualInserts,1);

const anotherMarket=await create({...base,market:"Orlando",sourceDescription:"Different location"});
assert.equal(anotherMarket.status,201);
assert.equal(anotherMarket.data.radar.id,22);
assert.equal(actualInserts,2);
const blankMarket=await create({...base,market:""});
assert.equal(blankMarket.data.duplicateProtected,true);
assert.equal(blankMarket.data.radar.id,21);
assert.equal(actualInserts,2);
const different=await create({businessName:"2000 Auto",market:"Suntree / Viera"});
assert.equal(different.status,201);
recordRows.at(-1).status="outreach";
recordRows.at(-1).last_outreach_at="2026-10-14T16:00:00";
const activeAgain=await create({businessName:"2000 Auto",market:"Suntree / Viera"});
assert.equal(activeAgain.data.duplicateProtected,true);
assert.equal(activeAgain.data.radar.status,"outreach");
assert.equal(recordRows.at(-1).last_outreach_at,"2026-10-14T16:00:00");

recordRows[0].archived_at="2026-10-15";
const archived=await create(base);
assert.equal(archived.data.duplicateProtected,true);
assert.ok(archived.data.radar.archivedAt);
recordRows[0].archived_at=null;
recordRows[0].status="promoted";
recordRows[0].promoted_prospect_id=42;
const promoted=await create(base);
assert.equal(promoted.data.duplicateProtected,true);
assert.equal(promoted.data.radar.promotedProspectId,42);
const before=actualInserts;
const twoAtOnce=await Promise.all([create({businessName:"Space Coast New Roofing",market:"Melbourne"}),
  create({businessName:"Space Coast New Roofing",market:"Melbourne"})]);
assert.equal(actualInserts,before+1);
assert.deepEqual(twoAtOnce.map(x=>x.data.writesPerformed).sort(),[0,1]);

const validation=await create({businessName:"Empty",sourceType:""});
assert.equal(validation.status,400);
assert.equal(actualInserts,before+1);
console.log("PASS Radar duplicate guard: one atomic insert, concurrent retries, normalization, distinct markets, archived and promoted preservation, no history changes");
console.log("PASS Prospects 3.10.0 UI: single Save guard, existing-record navigation and inline JavaScript syntax");
