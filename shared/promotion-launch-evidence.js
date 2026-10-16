/* =========================================================
   Global Concepts Media Operating System
   File: shared/promotion-launch-evidence.js
   Version: 1.0.0
   Status: Production Candidate
   Purpose: Read-only evidence linkage between a scheduled promotion start
            and its exact first-day social publishing commitments.
   Production rules:
   - Link by authoritative Schedule Authority sourceKey + scheduleItemId,
     planned date, and immutable Forward Look social-post key, never by title.
   - Require all scheduled first-day channels to have valid publication dates
     and durable proof references in a social_published disposition.
   - This proves a promotional publishing launch, NOT the availability,
     checkout eligibility, or fulfillment of the retail offer.
   - Do not write D1 or hide a promotional takedown/end milestone.
   ========================================================= */
(function(root){
  "use strict";
  function value(v){return String(v == null ? "" : v).trim();}
  function dateOnly(v){var s=value(v);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:"";}
  function findVerifiedPromotionLaunch(promotion,events,dispositionMap){
    if(!promotion||promotion.kind!=="promotion"||!Array.isArray(events)||
       !dispositionMap||typeof dispositionMap.get!=="function")return null;
    var start=dateOnly(promotion.startDate),end=dateOnly(promotion.endDate)||start;
    var sourceKey=value(promotion.sourceKey),scheduleItemId=Number(promotion.scheduleItemId);
    if(!start||!end||end<start||!sourceKey||!Number.isSafeInteger(scheduleItemId)||scheduleItemId<=0)return null;
    var candidates=events.filter(function(ev){
      return ev&&ev.kind==="social_post"&&ev.metadata&&ev.metadata.parentType==="promotion"&&
        value(ev.sourceKey)===sourceKey&&Number(ev.scheduleItemId)===scheduleItemId&&
        dateOnly(ev.startDate)===start;
    });
    for(var i=0;i<candidates.length;i++){
      var post=candidates[i];
      var channels=Array.isArray(post.metadata.channels)?post.metadata.channels.map(value).filter(Boolean):[];
      if(!channels.length||new Set(channels).size!==channels.length)continue;
      var key="schedule|"+value(post.key)+"|"+start;
      var recorded=dispositionMap.get(key.toLowerCase());
      if(!recorded||recorded.disposition!=="social_published"||
         value(recorded.forwardKey).toLowerCase()!==key.toLowerCase())continue;
      var proof;
      try{proof=JSON.parse(recorded.reason||"{}");}catch(_err){continue;}
      if(!proof||proof.schema!=="gcm-social-execution-v1"||
         Number(proof.scheduleItemId)!==scheduleItemId||dateOnly(proof.plannedDate)!==start||
         !Array.isArray(proof.platforms)||proof.platforms.length!==channels.length)continue;
      var published=[],valid=true;
      channels.forEach(function(channel){
        var matches=proof.platforms.filter(function(p){return p&&p.platform===channel;});
        var p=matches[0];
        var publishedDate=p&&dateOnly(p.publishedDate);
        var reference=p&&value(p.proofReference);
        if(matches.length!==1||p.status!=="published"||!publishedDate||
           publishedDate<start||publishedDate>end||!/^https:\/\//i.test(reference||"")){
          valid=false;return;
        }
        published.push({platform:channel,publishedDate:publishedDate,proofReference:reference});
      });
      if(!valid||published.length!==channels.length)continue;
      var firstPublishedDate=published.map(function(p){return p.publishedDate;}).sort()[0];
      var lastPublishedDate=published.map(function(p){return p.publishedDate;}).sort().slice(-1)[0];
      return {
        promotionSourceKey:sourceKey,scheduleItemId:scheduleItemId,
        launchScheduledDate:start,socialPostKey:key,
        firstPublishedDate:firstPublishedDate,lastPublishedDate:lastPublishedDate,
        channels:published
      };
    }
    return null;
  }
  root.GCMPromotionLaunchEvidence={
    fileVersion:"1.0.0",
    findVerifiedPromotionLaunch:findVerifiedPromotionLaunch
  };
})(typeof window!=="undefined"?window:globalThis);
