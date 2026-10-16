/* =========================================================
 Global Concepts Media Operating System
 File: shared/social-publishing-operator-ui.js
 Version: 1.0.0
 Status: Authenticated Operator Controls
 Purpose: Publisher attribution and independently verified extra placements
          without rewriting Schedule Authority or Forward Look.
 ========================================================= */
(function(root){
"use strict";
const KEY="gcm-social-publishing-session",API="https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
const $=id=>document.getElementById(id);
const safe=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const token=()=>{try{return sessionStorage.getItem(KEY)||"";}catch{return"";}};
let operatorData=null,working=false,selection=null,relatedForwardKey="";
function bridge(){return root.GCMSocialLibraryBridge;}
function posts(){return bridge()?.getPosts?.()||[];}
function notify(text){$("operator-state").textContent=text;}
function consume(){
 const params=new URLSearchParams(location.hash.replace(/^#/,""));
 const found=params.get("gcm_os_session");if(!found)return;
 try{sessionStorage.setItem(KEY,found);}catch{}
 history.replaceState(null,"",location.pathname+location.search);
}
function beginSignIn(){
 const back=location.origin+location.pathname+location.search;
 location.href=API+"auth/google?os_login=1&return_to="+encodeURIComponent(back);
}
async function api(operation,payload={}){
 if(!token())throw Error("Secure Google operator sign-in required.");
 const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token()},
  body:JSON.stringify({action:"social-publishing-operations",operation,...payload})});
 const data=await res.json().catch(()=>({}));
 if(res.status===401){try{sessionStorage.removeItem(KEY);}catch{}throw Error("Your GCM OS session has expired. Sign in again.");}
 if(!res.ok||!data.ok)throw Error(data.error||"The publishing operation could not be confirmed.");
 return data;
}
async function refreshOperator(){
 operatorData=null;
 if(token()){
  try{operatorData=await api("list");notify("Signed in — publisher attribution and extra placements are available.");}
  catch(e){notify(e.message);}
 }else notify("Sign in to record publishers and additional verified platform placements.");
 $("operator-sign-in").textContent=operatorData?"Google operator connected":"Secure Google Sign-In";
 paint();
}
function decorate(){
 const attributions=operatorData?.authorship||[];
 document.querySelectorAll('#records .post[data-post-id]').forEach(card=>{
  const record=posts().find(p=>p.id===card.getAttribute("data-post-id"));if(!record)return;
  card.querySelectorAll('.channel[data-platform]').forEach(channel=>{
   channel.querySelectorAll(".publisher-attribution").forEach(n=>n.remove());
   const platform=channel.getAttribute("data-platform");
   const outcome=record.platforms.find(p=>p.platform===platform);
   if(outcome?.status!=="published"||!record.clientId||!record.scheduleItemId)return;
   const author=attributions.find(a=>a.forwardKey===record.forwardKey&&a.platform===platform&&
    Number(a.clientId)===record.clientId&&Number(a.scheduleItemId)===record.scheduleItemId);
   const container=document.createElement("div");container.className="publisher-attribution";
   const detail=document.createElement("p");
   detail.textContent=author?"Published by "+author.publishedBy+(author.revisionCount?" · "+author.revisionCount+" earlier attribution(s)":""):
    operatorData?"Publisher not yet attributed":"Sign in for publisher attribution";
   container.appendChild(detail);
   const button=document.createElement("button");button.type="button";button.className="record-link";
   button.textContent=author?"Correct publisher":"Record publisher";
   button.addEventListener("click",()=>openPublisher(record,outcome,author));
   container.appendChild(button);channel.appendChild(container);
  });
  card.querySelectorAll(".operator-additional").forEach(n=>n.remove());
  if(record.clientId){
   const b=document.createElement("button");b.className="record-link operator-additional";b.type="button";
   b.textContent="Link extra platform placement";
   b.addEventListener("click",()=>openExtra(record));
   card.querySelector(".postdetails")?.appendChild(b);
  }
 });
}
function extrasForFilters(){
 const client=$("client").value,platform=$("platform").value,month=$("month").value,status=$("status").value;
 const query=$("search").value.toLowerCase().trim();
 return (operatorData?.additional||[]).filter(p=>(!client||String(p.clientId)===client)&&
 (!platform||p.platform===platform)&&(!month||String(p.actualDate).startsWith(month))&&
 (!status||p.status===status)&&
 (!query||[p.title,p.clientName,p.campaign].join(" ").toLowerCase().includes(query)));
}
function renderExtras(){
 if(!operatorData){
  $("count-extra").textContent="—";$("extras-visible").textContent="Operator sign-in required";
  $("extras").innerHTML='<div class="state">Sign in securely to view additional verified placements.</div>';return;
 }
 const list=extrasForFilters();
 $("count-extra").textContent=String(list.length);
 $("extras-visible").textContent=list.length+" additional verified placement"+(list.length===1?"":"s");
 $("extras").innerHTML=list.length?list.map(x=>'<div class="extra-row"><strong>'+safe(x.title)+'</strong>'+
 '<p>'+safe(x.clientName)+' · '+safe(x.campaign)+' · '+safe(x.platform)+' · Published '+safe(x.actualDate)+'</p>'+
 '<p>Published by '+safe(x.publishedBy)+' · <a href="'+safe(x.proofReference)+'" target="_blank" rel="noopener noreferrer">Open proof ↗</a></p>'+
 (x.relatedForwardKey?'<p>Linked to the original scheduled campaign</p>':'')+
 '</div>').join(""):'<div class="state">No additional placements match these filters.</div>';
}
function paint(){decorate();renderExtras();}
function requireSignedIn(){
 if(operatorData)return true;
 notify("Use Secure Google Sign-In to record publisher and extra publication evidence.");
 return false;
}
function openPublisher(post,outcome,author){
 if(!requireSignedIn()||outcome.status!=="published")return;
 selection={post,outcome};
 $("publisher-context").textContent=post.clientName+" · "+post.title+" · "+outcome.platform+" · Published "+outcome.actualDate;
 $("publisher-person").value=author?.publishedBy||"";
 $("publisher-error").hidden=true;
 $("publisher-dialog").showModal();
}
function clients(chosen){
 const map=new Map();
 posts().forEach(p=>{if(p.clientId&&p.clientName)map.set(String(p.clientId),p.clientName);});
 $("extra-client").innerHTML='<option value="">Select client</option>'+
 [...map].sort((a,b)=>a[1].localeCompare(b[1])).map(x=>'<option value="'+safe(x[0])+'">'+safe(x[1])+'</option>').join("");
 $("extra-client").value=chosen?String(chosen):$("client").value;
}
function openExtra(parent=null){
 if(!requireSignedIn())return;
 relatedForwardKey=parent?.forwardKey||"";
 $("extra-form").reset();$("extra-error").hidden=true;
 clients(parent?.clientId);
 $("extra-campaign").value=parent?.campaign||"";
 $("extra-post-title").value=parent?parent.title+" — additional placement":"";
 $("extra-platform").value="YouTube";
 $("extra-dialog").showModal();
}
async function savePublisher(event){
 event.preventDefault();if(working||!selection)return;
 const {post,outcome}=selection;
 working=true;const submit=$("publisher-form").querySelector('[type="submit"]');submit.disabled=true;
 try{
  await api("save_publisher",{clientId:post.clientId,scheduleItemId:post.scheduleItemId,
   forwardKey:post.forwardKey,platform:outcome.platform,publishedBy:$("publisher-person").value});
  $("publisher-dialog").close();await refreshOperator();
 }catch(e){$("publisher-error").textContent=e.message;$("publisher-error").hidden=false;}
 finally{working=false;submit.disabled=false;}
}
async function saveExtra(event){
 event.preventDefault();if(working)return;
 const payload={clientId:Number($("extra-client").value),campaign:$("extra-campaign").value,
  title:$("extra-post-title").value,platform:$("extra-platform").value,actualDate:$("extra-date").value,
  publishedBy:$("extra-person").value,proofReference:$("extra-link").value,notes:$("extra-notes").value,
  relatedForwardKey:relatedForwardKey||null};
 working=true;const submit=$("extra-form").querySelector('[type="submit"]');submit.disabled=true;
 try{
  const saved=await api("add_additional",payload);$("extra-dialog").close();await refreshOperator();
  notify(saved.duplicateProtected?"Already recorded — no duplicate was created.":"Additional platform placement saved with evidence.");
 }catch(e){$("extra-error").textContent=e.message;$("extra-error").hidden=false;}
 finally{working=false;submit.disabled=false;}
}
function init(){
 consume();
 $("operator-sign-in").addEventListener("click",()=>{if(!operatorData)beginSignIn();});
 $("add-placement").addEventListener("click",()=>openExtra());
 document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener("click",()=>$(btn.dataset.close).close()));
 $("publisher-form").addEventListener("submit",savePublisher);
 $("extra-form").addEventListener("submit",saveExtra);
 document.addEventListener("gcm-social-library-render",paint);
 $("refresh").addEventListener("click",()=>{if(token())refreshOperator();});
 refreshOperator();
}
init();
root.GCMSocialPublishingOperator={version:"1.0.0",refreshOperator};
})(typeof window!=="undefined"?window:globalThis);
/* END OF FILE — shared/social-publishing-operator-ui.js v1.0.0 */
