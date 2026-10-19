/* =========================================================
 GCM OS | Parent Company / Multi-Brand Prospect Relationships
 File: routes/prospectCompanyGroups.js
 Version: 1.0.0 | 2026-10-19
 Additive CRM subroute, no automatic marketing outreach or data copying.
 Requires migration 0048_prospect_parent_companies.sql.
 ========================================================= */
import { rowsOf } from "../shared/database.js";

const ACTION = "prospect-crm";
const VERSION = "1.7.0";
const OPERATIONS = new Set(["list_parent_companies", "create_parent_company", "set_radar_parent_company"]);

function reply(requestId, operation, data, status = 200) {
  return new Response(JSON.stringify({
    ok: status < 400, requestId, action: ACTION, operation,
    prospectCrmVersion: VERSION, ...data
  }), {
    status,
    headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
  });
}
const clean = value => String(value ?? "").trim();
const integer = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
function invalid(requestId, op, error, status = 400) {
  return reply(requestId, op, {error, writesPerformed:0}, status);
}
function linkFrom(row) {
  return {
    radarId:Number(row.radar_id), parentCompanyId:Number(row.parent_company_id),
    businessName:row.business_name||null, market:row.market||null,
    status:row.status||"radar", archivedAt:row.archived_at||null,
    promotedProspectId:integer(row.promoted_prospect_id)
  };
}
function companyFrom(row, members) {
  return {
    id:Number(row.id), name:row.name, website:row.website||null,
    relationshipNotes:row.relationship_notes||null,
    contactName:row.contact_name||null, contactRole:row.contact_role||null,
    contactUrl:row.contact_url||null,
    createdAt:row.created_at, updatedAt:row.updated_at,
    members:members.filter(m=>m.parentCompanyId===Number(row.id))
  };
}
async function listCompanies(db, requestId) {
  const [parents, memberships] = await Promise.all([
    db.prepare("SELECT * FROM crm_parent_companies ORDER BY name COLLATE NOCASE, id").all(),
    db.prepare(`SELECT l.parent_company_id, l.radar_id, r.business_name, r.market, r.status,
                        r.archived_at, r.promoted_prospect_id
                 FROM crm_parent_company_radar_links l
                 JOIN crm_prospect_radar r ON r.id=l.radar_id
                 ORDER BY r.business_name COLLATE NOCASE, r.id`).all()
  ]);
  const members=rowsOf(memberships).map(linkFrom);
  const companies=rowsOf(parents).map(row=>companyFrom(row,members));
  return reply(requestId,"list_parent_companies",{
    source:"D1", companies, count:companies.length, writesPerformed:0
  });
}
async function createCompany(body, db, requestId) {
  const op="create_parent_company";
  const name=clean(body.name||body.parentCompanyName);
  if(name.length<2||name.length>160) return invalid(requestId,op,"Parent company name must be 2–160 characters.");
  const website=clean(body.website);
  if(website && (!/^https?:\/\//i.test(website)||website.length>1000))return invalid(requestId,op,"Website must be an http(s) URL.");
  const notes=clean(body.relationshipNotes);
  if(notes.length>2000)return invalid(requestId,op,"Notes must be under 2,000 characters.");
  const contactName=clean(body.contactName);
  const contactRole=clean(body.contactRole);
  const contactUrl=clean(body.contactUrl);
  if(contactUrl && (!/^https?:\/\//i.test(contactUrl)||contactUrl.length>1000))return invalid(requestId,op,"Contact profile URL must be an http(s) URL.");
  if(contactName.length>160||contactRole.length>160)return invalid(requestId,op,"Contact name and role must be under 160 characters.");
  // Atomic name uniqueness is case-insensitive. Retries never create two parents.
  const insert=await db.prepare(`INSERT INTO crm_parent_companies
    (name,website,relationship_notes,contact_name,contact_role,contact_url)
    VALUES (?,?,?,?,?,?) ON CONFLICT(name) DO NOTHING RETURNING id`)
    .bind(name,website||null,notes||null,contactName||null,contactRole||null,contactUrl||null).all();
  const id=integer(rowsOf(insert)[0]?.id);
  const matched=await db.prepare("SELECT * FROM crm_parent_companies WHERE name = ? COLLATE NOCASE LIMIT 1").bind(name).all();
  const row=rowsOf(matched)[0];
  if(!row)throw new Error("Parent-company duplicate guard failed.");
  return reply(requestId,op,{
    company:companyFrom(row,[]), duplicateProtected:!id,
    writesPerformed:id?1:0
  },id?201:200);
}
async function setRadarCompany(body, db, requestId) {
  const op="set_radar_parent_company";
  const radarId=integer(body.radarId);
  if(!radarId)return invalid(requestId,op,"Select a valid Radar record.");
  const target=(body.parentCompanyId===null||body.parentCompanyId===""||body.parentCompanyId===undefined)
    ? null:integer(body.parentCompanyId);
  if(body.parentCompanyId!==null&&body.parentCompanyId!==""&&body.parentCompanyId!==undefined&&!target)
    return invalid(requestId,op,"Select a valid parent company, or clear the link.");
  const radar=rowsOf(await db.prepare("SELECT id, archived_at, promoted_prospect_id FROM crm_prospect_radar WHERE id=?").bind(radarId).all())[0];
  if(!radar)return invalid(requestId,op,"Radar record not found.",404);
  if(radar.archived_at||radar.promoted_prospect_id)return invalid(requestId,op,"Edit the active Radar record before it is archived or promoted.",409);
  if(target){
    const company=rowsOf(await db.prepare("SELECT id FROM crm_parent_companies WHERE id=?").bind(target).all())[0];
    if(!company)return invalid(requestId,op,"Parent company was not found.",404);
  }
  const before=rowsOf(await db.prepare("SELECT parent_company_id FROM crm_parent_company_radar_links WHERE radar_id=?").bind(radarId).all())[0];
  if((before?Number(before.parent_company_id):null)===target)return reply(requestId,op,{radarId,parentCompanyId:target,writesPerformed:0,unchanged:true});
  if(target){
    await db.prepare(`INSERT INTO crm_parent_company_radar_links(radar_id,parent_company_id)
      VALUES (?,?) ON CONFLICT(radar_id) DO UPDATE SET
      parent_company_id=excluded.parent_company_id, updated_at=CURRENT_TIMESTAMP`).bind(radarId,target).run();
  }else{
    await db.prepare("DELETE FROM crm_parent_company_radar_links WHERE radar_id=?").bind(radarId).run();
  }
  return reply(requestId,op,{radarId,parentCompanyId:target,writesPerformed:1});
}
export function isParentCompanyOperation(op) {return OPERATIONS.has(op);}
export async function handleParentCompanyOperation(body,db,requestId){
  const operation=clean(body?.operation).toLowerCase();
  try{
    switch(operation){
      case "list_parent_companies":return await listCompanies(db,requestId);
      case "create_parent_company":return await createCompany(body,db,requestId);
      case "set_radar_parent_company":return await setRadarCompany(body,db,requestId);
      default:return invalid(requestId,operation,"Unsupported company grouping operation.");
    }
  }catch(error){
    // Migration may not yet be applied. Do not disturb legacy CRM operations.
    return reply(requestId,operation,{
      error:"Parent-company records are not available yet. Verify that D1 migration 0048 has been applied.",
      details:clean(error?.message).slice(0,300),writesPerformed:0
    },503);
  }
}
