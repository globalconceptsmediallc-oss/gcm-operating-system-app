/* GCM independent prospect preview • privacy minimized */
(() => {"use strict";
 const key=document.body.dataset.conceptKey,version="1.0.0";
 if(!key||new URLSearchParams(location.search).get("gcm_preview")==="1")return;
 const sessionKey="gcm-concept-view:"+key;
 try{if(sessionStorage.getItem(sessionKey))return;}catch{}
 const send=async()=>{
  if(document.visibilityState!=="visible")return;
  try{
   const r=await fetch("https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"prospect-concept-view",conceptKey:key,pagePath:location.pathname,pageVersion:version,viewedAt:new Date().toISOString()}),
    keepalive:true
   });
   if(r.ok){try{sessionStorage.setItem(sessionKey,"1")}catch{}}
  }catch{}
 };
 window.setTimeout(send,2500);
})();
