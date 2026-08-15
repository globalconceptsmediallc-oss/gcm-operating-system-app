/* =========================================================
Global Concepts Media Operating System
File: shared/media-existing-entry.js
Version: 1.0.0
Status: Production Candidate
Sprint: Existing / Already-Trafficked Media Recovery
Purpose: Add the Record Existing Media entry path to the Media operator workspace.
========================================================= */

(()=>{"use strict";
function install(){
  const controls=document.querySelector("header .controls");
  if(!controls||document.getElementById("record-existing-media"))return;
  const link=document.createElement("a");
  link.id="record-existing-media";
  link.className="button";
  link.href="media-existing.html";
  link.textContent="Record Existing Media";
  link.addEventListener("click",event=>{
    const client=document.getElementById("client")?.value||"";
    if(!client)return;
    event.preventDefault();
    window.location.assign(`media-existing.html?clientId=${encodeURIComponent(client)}`);
  });
  const create=[...controls.querySelectorAll("a")].find(a=>/Create Media Campaign/i.test(a.textContent||""));
  if(create)create.insertAdjacentElement("afterend",link);else controls.prepend(link);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();
