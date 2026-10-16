/* GCM OS · One-time verified Southeast Safes cross-platform social history
 * Independent from Schedule Authority and Forward Look; no status rewrites.
 * All records are authenticated, reviewed in UI, transactionally inserted.
 */
import {jsonResponse} from "../shared/http.js";
const clean=(v,max=200)=>String(v??"").trim().slice(0,max);
const date=s=>/^2026-(?:09|10)-\d{2}$/.test(String(s||"")) && !Number.isNaN(Date.parse(s+"T12:00:00Z")) &&
 new Date(s+"T12:00:00Z").toISOString().slice(0,10)===s;
const normalized=s=>{
 try{
  const u=new URL(clean(s,1000));if(u.protocol!=="https:"||u.username||u.password||u.port||u.search||u.hash)return "";
  if(!["www.facebook.com","facebook.com","www.instagram.com","instagram.com"].includes(u.hostname.toLowerCase()))return "";
  return u.href;
 }catch{return "";}
};
const fingerprint=async s=>{
 const data=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));
 return [...data].map(x=>x.toString(16).padStart(2,"0")).join("");
};
const response=(object,status=200)=>jsonResponse({action:"social-publishing-operations",socialPublishingOperationsVersion:"1.1.0",...object},status);
const fail=(error,status=400)=>response({ok:false,error,writesPerformed:0},status);
export async function importVerifiedSesHistory(db,body,identity){
 const clientId=Number(body?.clientId),sourcePosts=body?.posts;
 if(!Number.isSafeInteger(clientId)||clientId<=0||!Array.isArray(sourcePosts)||sourcePosts.length!==25)
  return fail("Southeast Safes historical import requires exactly 25 reviewed source posts.");
 const client=await db.prepare("SELECT id,name FROM clients WHERE id=? LIMIT 1").bind(clientId).first();
 if(client?.name!=="Southeast Safes")return fail("Import is restricted to the verified Southeast Safes client.",409);
 const prepared=[],allEvidence=new Set();let reelCount=0,regularCount=0;
 for(const raw of sourcePosts){
  const placements=raw?.placements;
  if(!Array.isArray(placements)||![1,2].includes(placements.length))return fail("Invalid historical placement group.");
  const campaign=clean(raw.campaign,150),title=clean(raw.title,150),caption=clean(raw.caption,2000);
  if(!campaign||!title||title!==String(raw.title??"").trim()||!["Organic Reels — Fall 2026","Organic Facebook — Fall 2026"].includes(campaign))
   return fail("Incomplete or unexpected historic campaign.");
  const validated=[],seenPlatforms=new Set();
  for(const row of placements){
   const platform=clean(row.platform,50),url=normalized(row.url),actualDate=clean(row.date,10),publisher=clean(row.publisher,120);
   if(!["Facebook","Instagram"].includes(platform)||seenPlatforms.has(platform)||!url||!date(actualDate)||
     actualDate<"2026-09-01"||actualDate>"2026-10-16")return fail("A verified historical link or date is invalid.");
   if(platform==="Facebook"&&!new URL(url).hostname.includes("facebook.com") ||
      platform==="Instagram"&&!new URL(url).hostname.includes("instagram.com"))return fail("Platform and link mismatch.");
   const key=platform+"|"+url;
   if(allEvidence.has(key))return fail("Duplicate history proof inside the import.");
   allEvidence.add(key);seenPlatforms.add(platform);
   validated.push({platform,url,actualDate,publisher});
  }
  if(placements.length===2){
   reelCount++;
   if(campaign!=="Organic Reels — Fall 2026"||validated.some(x=>x.publisher!=="Judi")||
    seenPlatforms.size!==2||!seenPlatforms.has("Facebook")||!seenPlatforms.has("Instagram")||
    validated.some(x=>!new URL(x.url).pathname.startsWith("/reel/"))||
    validated[0].actualDate!==validated[1].actualDate)return fail("Unverified Facebook/Instagram Reel pairing.");
  }else{
   regularCount++;
   if(campaign!=="Organic Facebook — Fall 2026"||validated[0].platform!=="Facebook"||
    validated[0].publisher!=="Kristy Schirmer"||new URL(validated[0].url).pathname.startsWith("/reel/"))
    return fail("Unverified Kristy Facebook post.");
  }
  const anchor=validated.find(x=>x.platform==="Facebook");
  const key="ses-history-2026-"+await fingerprint(clientId+"|"+anchor.url);
  prepared.push({campaign,title,caption,placements:validated,key});
 }
 if(reelCount!==18||regularCount!==7||allEvidence.size!==43)
  return fail("History must contain 18 cross-posted Reels and 7 additional Facebook posts.");
 const keys=prepared.map(x=>x.key);
 const placeholders=keys.map(()=>"?").join(",");
 const previous=await db.prepare("SELECT external_dedupe_key FROM social_publishing_posts WHERE client_id=? AND source_kind='additional' AND external_dedupe_key IN ("+placeholders+")")
  .bind(clientId,...keys).all();
 const existingKeys=new Set((previous?.results||[]).map(x=>x.external_dedupe_key));
 if(existingKeys.size===25)return response({ok:true,operation:"import_historical",duplicateProtected:true,postsAdded:0,placementsAdded:0,writesPerformed:0});
 if(existingKeys.size)return fail("A partial historical backfill already exists. Review before retrying.",409);
 const links=[...allEvidence].map(x=>x.slice(x.indexOf("|")+1));
 const existingProof=await db.prepare("SELECT pl.platform,pl.proof_reference FROM social_publishing_placements pl JOIN social_publishing_posts p ON p.id=pl.post_id WHERE p.client_id=? AND pl.proof_reference IN ("+links.map(()=>"?").join(",")+")")
  .bind(clientId,...links).all();
 if((existingProof?.results||[]).length)return fail("One or more historical links already exist as additional placements. No records were changed.",409);
 const batch=[],notes="Verified Southeast Safes Facebook/Instagram account history, retrieved 2026-10-16; publisher assignment confirmed by GCM operator.";
 for(const row of prepared){
  batch.push(db.prepare("INSERT INTO social_publishing_posts(client_id,source_kind,campaign_title,post_title,caption_text,notes,created_by,external_dedupe_key) VALUES(?,'additional',?,?,?,?,?,?)")
   .bind(clientId,row.campaign,row.title,row.caption||null,notes,identity.email,row.key));
  for(const p of row.placements){
   batch.push(db.prepare("INSERT INTO social_publishing_placements(post_id,platform,status,actual_published_date,proof_reference,published_by,recorded_by,evidence_notes) SELECT id,?,'published',?,?,?,?,? FROM social_publishing_posts WHERE client_id=? AND external_dedupe_key=? AND source_kind='additional'")
    .bind(p.platform,p.actualDate,p.url,p.publisher,identity.email,"Verified source-platform permalink",clientId,row.key));
  }
 }
 // Cloudflare D1 batch executes statements in one database transaction, or rolls back.
 await db.batch(batch);
 const check=await db.prepare("SELECT COUNT(*) AS n FROM social_publishing_posts WHERE client_id=? AND external_dedupe_key IN ("+placeholders+")").bind(clientId,...keys).first();
 if(Number(check?.n)!==25)throw Error("Historical backfill integrity check failed.");
 return response({ok:true,operation:"import_historical",postsAdded:25,placementsAdded:43,writesPerformed:68});
}
