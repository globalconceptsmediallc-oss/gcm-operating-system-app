/* =========================================================
 GCM OS | Parent Company Grouping Regression
 File: tests/prospectParentCompanies.test.js
 Version: 1.0.0 | 2026-10-19
 No production D1 access or network activity.
 ========================================================= */
import assert from "node:assert/strict";
import fs from "node:fs";
import {handleParentCompanyOperation,isParentCompanyOperation} from "../routes/prospectCompanyGroups.js";

const route=fs.readFileSync("routes/prospectCrm.js","utf8");
const ui=fs.readFileSync("prospects.html","utf8");
const migration=fs.readFileSync("migrations/0048_prospect_parent_companies.sql","utf8");
assert.match(migration,/CREATE TABLE IF NOT EXISTS crm_parent_companies/);
assert.match(migration,/name TEXT NOT NULL COLLATE NOCASE UNIQUE/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS crm_parent_company_radar_links/);
assert.match(migration,/radar_id INTEGER PRIMARY KEY/);
assert.doesNotMatch(migration,/ALTER TABLE|UPDATE crm_prospect|DELETE FROM crm_prospect/i);
assert.match(route,/isParentCompanyOperation\(operation\)/);
assert.match(ui,/Parent Companies &amp; Brands/);
assert.match(ui,/renderParentCompanies\(\)/);
assert.match(ui,/id="parent-company-dialog"/);
assert.match(ui,/id="radar-parent-dialog"/);
assert.match(ui,/set_radar_parent_company/);
assert.match(ui,/list_parent_companies"\)\.catch/);
assert.match(ui,/data-parent-open-radar/);
assert.match(ui,/No contacts or messages will be copied/);
assert.equal(isParentCompanyOperation("create_parent_company"),true);
assert.equal(isParentCompanyOperation("archive_radar"),false);

const parents=[];
const radar=[{id:16, business_name:"Heron Home & Outdoor",market:"Central Florida",status:"nurture",archived_at:null,promoted_prospect_id:null},
             {id:17,business_name:"Florida Pest Control",market:"Central Florida",status:"radar",archived_at:null,promoted_prospect_id:null},
             {id:18,business_name:"Archived Brand",status:"radar",archived_at:"2026-10-01",promoted_prospect_id:null}];
const links=new Map();
const clone=x=>JSON.parse(JSON.stringify(x));
const db={
 prepare(sql){
   let values=[];
   return {
     bind(...args){values=args;return this},
     async all(){
       const q=sql.replace(/\s+/g," ").trim();
       let rows=[];
       if(q.startsWith("SELECT * FROM crm_parent_companies ORDER"))rows=clone(parents);
       else if(q.startsWith("SELECT l.parent_company_id"))rows=[...links.entries()].map(([id,pid])=>{
         const r=radar.find(x=>x.id===id);return {parent_company_id:pid,radar_id:id,...r};
       });
       else if(q.startsWith("INSERT INTO crm_parent_companies")){
         if(!parents.some(x=>x.name.toLowerCase()===values[0].toLowerCase())){
           const row={id:parents.length+1,name:values[0],website:values[1],relationship_notes:values[2],
             contact_name:values[3],contact_role:values[4],contact_url:values[5],
             created_at:"2026-10-19",updated_at:"2026-10-19"};
           parents.push(row);rows=[{id:row.id}];
         }
       }else if(q.startsWith("SELECT * FROM crm_parent_companies WHERE name"))
         rows=clone(parents.filter(x=>x.name.toLowerCase()===String(values[0]).toLowerCase()).slice(0,1));
       else if(q.startsWith("SELECT id, archived_at, promoted_prospect_id FROM crm_prospect_radar"))
         rows=clone(radar.filter(x=>x.id===values[0]).slice(0,1));
       else if(q.startsWith("SELECT id FROM crm_parent_companies WHERE"))
         rows=parents.filter(x=>x.id===values[0]).map(x=>({id:x.id}));
       else if(q.startsWith("SELECT parent_company_id FROM crm_parent_company_radar_links"))
         rows=links.has(values[0])?[{parent_company_id:links.get(values[0])}]:[];
       else throw Error("Unmocked query: "+q);
       return {results:rows};
     },
     async run(){
       const q=sql.replace(/\s+/g," ").trim();
       if(q.startsWith("INSERT INTO crm_parent_company_radar_links")) links.set(values[0],values[1]);
       else if(q.startsWith("DELETE FROM crm_parent_company_radar_links"))links.delete(values[0]);
       else throw Error("Unmocked write: "+q);
       return {success:true};
     }
   };
 }
};
async function call(body,database=db){
 const response=await handleParentCompanyOperation(body,database,"test-request");
 return {status:response.status,payload:await response.json()};
}
const created=await call({operation:"create_parent_company",name:"Rentokil North America",
 website:"https://www.rentokil.com/",relationshipNotes:"Local brands under one parent.",
 contactName:"Rebecca Drinnon",contactRole:"Field Marketing"});
assert.equal(created.status,201);
assert.equal(created.payload.writesPerformed,1);
const duplicate=await call({operation:"create_parent_company",name:"rentokil north america"});
assert.equal(duplicate.status,200);
assert.equal(duplicate.payload.duplicateProtected,true);
assert.equal(parents.length,1);

const linked=await call({operation:"set_radar_parent_company",radarId:16,parentCompanyId:1});
assert.equal(linked.status,200);
assert.equal(links.get(16),1);
const linkedAgain=await call({operation:"set_radar_parent_company",radarId:16,parentCompanyId:1});
assert.equal(linkedAgain.payload.writesPerformed,0);
assert.equal((await call({operation:"set_radar_parent_company",radarId:17,parentCompanyId:1})).status,200);

const listed=await call({operation:"list_parent_companies"});
assert.equal(listed.payload.count,1);
assert.equal(listed.payload.companies[0].members.length,2);
assert.deepEqual(listed.payload.companies[0].members.map(x=>x.businessName),
 ["Heron Home & Outdoor","Florida Pest Control"]);
assert.equal(listed.payload.companies[0].members[0].status,"nurture");
assert.equal((await call({operation:"set_radar_parent_company",radarId:18,parentCompanyId:1})).status,409);
assert.equal((await call({operation:"set_radar_parent_company",radarId:17,parentCompanyId:999})).status,404);
assert.equal((await call({operation:"set_radar_parent_company",radarId:17,parentCompanyId:null})).status,200);
assert.equal(links.has(17),false);
const unavailable=await call({operation:"list_parent_companies",{...db,prepare(){throw Error("no such table: crm_parent_companies")}}});
assert.equal(unavailable.status,503);
assert.equal(parents.length,1);
console.log("PASS multi-brand parent grouping: unique corporation, independent member history, safe linking, unlinking, archive guard, migration fallback.");
