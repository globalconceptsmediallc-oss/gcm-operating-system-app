/* =========================================================
   Global Concepts Media Operating System
   File: shared/social-publishing-library.js
   Version: 1.0.0
   Status: Read-only Foundation
   Purpose: Project exact Schedule Authority events + D1 Forward Look
            dispositions into client-scoped social publishing records.
   Boundaries:
   - No inferred client, author, publication date, or extra placement.
   - Never change existing schedule or D1 evidence.
   - Show archived/unmatched dispositions separately without misattribution.
   ========================================================= */
(function(root){
  "use strict";
  const VERSION="1.0.0";
  function val(x){return String(x??"").trim();}
  function date(x){var d=val(x).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)?d:"";}
  function safeUrl(value){var s=val(value);return /^https:\/\/[^\s<>"]+$/i.test(s)?s:"";}
  function evidence(row){
    try{var p=JSON.parse(row?.reason||"{}");return p?.schema==="gcm-social-execution-v1"?p:null;}
    catch(_err){return null;}
  }
  function normalizedScheduled(events,dispositions,todayKey){
    if(!Array.isArray(events)||!Array.isArray(dispositions))throw Error("Authoritative publishing sources unavailable");
    var rowsByKey=new Map(dispositions.map(function(d){return[val(d?.forwardKey).toLowerCase(),d];}));
    var matchedKeys=new Set();
    var posts=[];
    events.filter(function(e){return e&&e.kind==="social_post";}).forEach(function(ev){
      var plannedDate=date(ev.startDate);
      var key="schedule|"+val(ev.key)+"|"+plannedDate;
      var d=rowsByKey.get(key.toLowerCase());
      if(d)matchedKeys.add(key.toLowerCase());
      var p=d?evidence(d):null;
      var ownerMatches=Boolean(p&&p.plannedDate===plannedDate&&Number(p.scheduleItemId)===Number(ev.scheduleItemId));
      var channels=Array.isArray(ev.metadata?.channels)?[...new Set(ev.metadata.channels.map(val).filter(Boolean))]:[];
      var platforms=channels.map(function(platform){
        var old=ownerMatches?p.platforms?.find(function(x){return x.platform===platform;}):null;
        var status="planned",actualDate="",reference="";
        if(d&&!ownerMatches)status="unverified";
        else if(old&&["pending","published","missed"].includes(old.status)){
          status=old.status;
          if(status==="published"){
            actualDate=date(old.publishedDate);
            reference=safeUrl(old.proofReference);
            if(!actualDate||!reference)status="unverified";
          }
        }else if(d)status="unverified";
        else if(plannedDate&&plannedDate<todayKey)status="unverified";
        return {platform,status,actualDate,proofReference:reference,publishedBy:null};
      });
      posts.push({
        source:"schedule",id:key,forwardKey:key,
        clientId:Number.isSafeInteger(Number(ev.clientId))&&Number(ev.clientId)>0?Number(ev.clientId):null,
        clientName:val(ev.clientName),clientCode:val(ev.clientCode),
        scheduleItemId:Number(ev.scheduleItemId)||null,
        campaign:val(ev.metadata?.parentType)==="promotion"?"Promotion":val(ev.metadata?.parentType)==="gun_show"?"Gun Show":"Scheduled Social",
        title:val(ev.title)||"Scheduled social post",plannedDate,
        platforms,sourceStatus:val(d?.disposition),note:ownerMatches?val(p.note):"",
        reviewedBy:val(d?.reviewedBy),revisions:ownerMatches&&Array.isArray(p.correctionHistory)?p.correctionHistory.length:0,
        evidenceMismatch:Boolean(d&&!ownerMatches)
      });
    });
    posts.sort(function(a,b){return b.plannedDate.localeCompare(a.plannedDate)||a.title.localeCompare(b.title);});
    const unmatched=dispositions.filter(function(row){
      return ["social_published","social_missed","social_mixed","social_partial"].includes(val(row?.disposition))&&
        !matchedKeys.has(val(row?.forwardKey).toLowerCase());
    }).map(function(row){
      const p=evidence(row);
      return {
        id:val(row.forwardKey),title:val(row.title)||"Unmatched historical social record",
        plannedDate:date(p?.plannedDate),disposition:val(row.disposition),status:"needs_source_link"
      };
    });
    return {posts,unmatched};
  }
  function totals(posts){
    var counts={posts:posts.length,scheduled:0,published:0,missed:0,pending:0,planned:0,unverified:0};
    posts.forEach(function(post){
      if(post.source==="schedule")counts.scheduled++;
      (post.platforms||[]).forEach(function(p){
        counts[p.status] = (counts[p.status]||0)+1;
      });
    });
    return counts;
  }
  root.GCMSocialPublishingLibrary={version:VERSION,normalizedScheduled,totals,safeUrl};
})(typeof window!=="undefined"?window:globalThis);
