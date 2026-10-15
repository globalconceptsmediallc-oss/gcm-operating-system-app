/* =========================================================
   GCM Operating System
   File: routes/sourceEvidenceRetention.js
   Version: 1.0.0
   Purpose: Private R2 evidence cleanup, 30 days after Radar archive.
   Invoked only by Cloudflare Worker scheduled handler.
   Never delete formal Prospect/Client/held/reopened/shared objects.
   Originals outside R2 are not managed by this module.
   No new D1 schema; audit metadata from migration 0045.
   ========================================================= */
export const SOURCE_EVIDENCE_RETENTION_VERSION="1.0.0";
const BUCKET="gcm-os-source-evidence-private";
const POLICY="radar-closed-30-days";
const MAX_PER_RUN=30;
const RADAR_KEY=/^radar\/[1-9]\d*\/[a-f0-9]{64}\.(?:jpg|webp)$/;

// Object deletion is allowed only if linked to eligible expired evidence
// and EVERY relationship using that physical object is eligible.
// A single active, reopened, client-owned, promoted, held or future due
// reference vetoes physical deletion.
const CANDIDATE_SQL=[
"SELECT o.id, o.bucket_name, o.object_key",
"FROM crm_source_evidence_objects o",
"WHERE o.storage_provider = 'r2'",
"AND o.bucket_name = ?",
"AND o.deleted_at IS NULL",
"AND EXISTS (",
"  SELECT 1 FROM crm_source_evidence_links l",
"  JOIN crm_source_evidence_items i ON i.id = l.evidence_id",
"  JOIN crm_prospect_radar r ON r.id = i.radar_id",
"  WHERE l.object_id = o.id",
"    AND i.retention_state = 'pending_deletion'",
"    AND i.deletion_completed_at IS NULL",
"    AND i.deletion_eligible_at IS NOT NULL",
"    AND i.deletion_eligible_at <= CURRENT_TIMESTAMP",
"    AND i.prospect_id IS NULL AND i.client_id IS NULL",
"    AND r.archived_at IS NOT NULL",
"    AND r.promoted_prospect_id IS NULL",
"    AND datetime(r.archived_at, '+30 days') <= CURRENT_TIMESTAMP",
")",
"AND NOT EXISTS (",
"  SELECT 1 FROM crm_source_evidence_links l",
"  LEFT JOIN crm_source_evidence_items i ON i.id = l.evidence_id",
"  LEFT JOIN crm_prospect_radar r ON r.id = i.radar_id",
"  WHERE l.object_id = o.id AND (",
"    i.id IS NULL OR",
"    i.retention_state <> 'pending_deletion' OR",
"    i.deletion_completed_at IS NOT NULL OR",
"    i.deletion_eligible_at IS NULL OR",
"    i.deletion_eligible_at > CURRENT_TIMESTAMP OR",
"    i.prospect_id IS NOT NULL OR",
"    i.client_id IS NOT NULL OR",
"    i.radar_id IS NULL OR",
"    r.id IS NULL OR",
"    r.archived_at IS NULL OR",
"    r.promoted_prospect_id IS NOT NULL OR",
"    datetime(r.archived_at, '+30 days') > CURRENT_TIMESTAMP",
"  )",
")"
].join("\n");

// Finalize only when EVERY physical file linked to the entry is deleted.
// Campaign notes and outreach history are never deleted.
const FINALIZE_SQL=[
"UPDATE crm_source_evidence_items",
"SET retention_state='deleted',",
"deletion_completed_at=CURRENT_TIMESTAMP,",
"updated_at=CURRENT_TIMESTAMP",
"WHERE retention_state='pending_deletion'",
"AND deletion_completed_at IS NULL",
"AND deletion_eligible_at IS NOT NULL",
"AND deletion_eligible_at <= CURRENT_TIMESTAMP",
"AND radar_id IS NOT NULL",
"AND prospect_id IS NULL AND client_id IS NULL",
"AND EXISTS (",
" SELECT 1 FROM crm_prospect_radar r",
" WHERE r.id=crm_source_evidence_items.radar_id",
" AND r.archived_at IS NOT NULL",
" AND r.promoted_prospect_id IS NULL",
" AND datetime(r.archived_at, '+30 days') <= CURRENT_TIMESTAMP",
")",
"AND EXISTS (",
" SELECT 1 FROM crm_source_evidence_links l",
" WHERE l.evidence_id=crm_source_evidence_items.id",
")",
"AND NOT EXISTS (",
" SELECT 1 FROM crm_source_evidence_links l",
" JOIN crm_source_evidence_objects o ON o.id=l.object_id",
" WHERE l.evidence_id=crm_source_evidence_items.id",
" AND o.deleted_at IS NULL",
")"
].join("\n");

const rows=result=>Array.isArray(result?.results)?result.results:[];
const id=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
export async function runSourceEvidenceRetention(env,{dryRun=false}={}){
  if(!env?.DB?.prepare||!env?.EVIDENCE_BUCKET?.delete)throw Error("Private evidence storage bindings unavailable.");
  const summary={retentionVersion:SOURCE_EVIDENCE_RETENTION_VERSION,dryRun,scanned:0,deleted:0,invalidKeys:0,skippedOnRecheck:0,errors:0,finalized:0};
  const candidates=rows(await env.DB.prepare(CANDIDATE_SQL+" ORDER BY o.id ASC LIMIT ?").bind(BUCKET,MAX_PER_RUN).all());
  summary.scanned=candidates.length;
  for(const candidate of candidates){
    const oid=id(candidate.id);
    if(!oid||candidate.bucket_name!==BUCKET||!RADAR_KEY.test(String(candidate.object_key||""))){
      summary.invalidKeys++;continue;
    }
    const latest=rows(await env.DB.prepare(CANDIDATE_SQL+" AND o.id = ? LIMIT 1").bind(BUCKET,oid).all());
    if(latest.length!==1||latest[0].object_key!==candidate.object_key){
      summary.skippedOnRecheck++;continue;
    }
    if(dryRun)continue;
    try{
      await env.EVIDENCE_BUCKET.delete(candidate.object_key);
      await env.DB.prepare([
        "UPDATE crm_source_evidence_objects",
        "SET deleted_at=CURRENT_TIMESTAMP, deletion_reason=?",
        "WHERE id=? AND storage_provider='r2' AND bucket_name=?",
        "AND object_key=? AND deleted_at IS NULL"
      ].join(" ")).bind(POLICY,oid,BUCKET,candidate.object_key).run();
      summary.deleted++;
    }catch(error){
      summary.errors++;
      console.error("Private evidence cleanup failed",oid,String(error?.message||error));
    }
  }
  if(!dryRun){
    const completed=await env.DB.prepare(FINALIZE_SQL).run();
    summary.finalized=Number(completed?.meta?.changes||0);
  }
  console.log("GCM private evidence retention",JSON.stringify(summary));
  return summary;
}
/* END OF FILE — routes/sourceEvidenceRetention.js v1.0.0 */