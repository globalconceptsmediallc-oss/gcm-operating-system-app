/* =========================================================
   Global Concepts Media Operating System
   File: shared/media-production-package.js
   Version: 1.0.0
   Status: Production Candidate
   Sprint: Complete Station Email Package
   Purpose: Extend media-production.html v2.0.0 with operator-selected
            script attachment controls and Media-specific multi-attachment
            Gmail drafting without changing the underlying creative workflow.
   ========================================================= */

(() => {
  "use strict";

  const ENDPOINT="https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const $=id=>document.getElementById(id);
  let workflow=null;
  let attachmentRows=[];

  const api=async(operation,extra={})=>{
    const response=await fetch(ENDPOINT,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"get-media-operations",operation,...extra})
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||payload?.ok!==true){
      throw new Error(payload?.error||payload?.details||`Worker returned ${response.status}`);
    }
    return payload;
  };

  const esc=value=>String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

  const currentCreativeId=()=>Number($("creative")?.value||0);
  const currentPackageId=()=>Number($("pkg")?.value||0);
  const selectedAssignmentIds=()=>[...document.querySelectorAll(".pa:checked")].map(input=>Number(input.value)).filter(Boolean);

  async function refreshData(){
    const [workflowPayload,attachmentPayload]=await Promise.all([
      api("get_creative_workflow"),
      api("get_station_package_attachments")
    ]);
    workflow=workflowPayload.creativeWorkflow||null;
    attachmentRows=Array.isArray(attachmentPayload.attachments)?attachmentPayload.attachments:[];
  }

  function creative(){
    const id=currentCreativeId();
    return workflow?.creatives?.find(item=>Number(item.id)===id)||null;
  }

  function scriptInfo(){
    const c=creative();
    const source=$("station-script-source")?.value||"final_script";
    if(!c||source==="none")return {source,label:"No Script",text:""};
    if(source==="coop_script")return {source,label:"Co-op Script",text:c.coopScript||""};
    if(source==="approved_script")return {source,label:"Approved Script",text:c.approvedScript||""};
    return {source:"final_script",label:"Final Script",text:c.finalScript||""};
  }

  function safeStem(value){
    return String(value||"")
      .trim()
      .replace(/\.[^.]+$/,"")
      .replace(/[^A-Za-z0-9_-]+/g,"_")
      .replace(/^_+|_+$/g,"")||"MediaCreative";
  }

  function suggestedScriptName(){
    const c=creative();
    const info=scriptInfo();
    if(info.source==="none")return "";
    const audioFile=$("file")?.files?.[0]?.name||c?.finalAudioFileName||$("audio")?.value||"";
    const base=safeStem(audioFile||c?.creativeName||$("name")?.value||"MediaCreative");
    const suffix=info.source==="coop_script"
      ?"CoopScript"
      :info.source==="approved_script"
        ?"ApprovedScript"
        :"FinalScript";
    return `${base}_${suffix}.txt`;
  }

  function refreshScriptPreview(forceName=false){
    const preview=$("station-script-preview");
    const filename=$("station-script-filename");
    const note=$("station-attachment-note");
    if(!preview||!filename||!note)return;

    const info=scriptInfo();
    preview.value=info.text;

    if(forceName||!filename.value.trim()){
      filename.value=suggestedScriptName();
    }

    note.textContent=info.source==="none"
      ?"Only the physical audio file will be attached. Nothing sends automatically."
      :`${info.label} will be generated from the saved Creative record and attached with the physical audio file. Nothing sends automatically.`;
  }

  async function restorePackageAttachments(){
    const packageId=currentPackageId();
    if(!packageId){
      $("station-script-source").value="final_script";
      $("station-script-filename").value="";
      refreshScriptPreview(true);
      return;
    }

    const script=attachmentRows.find(row=>
      Number(row.trafficPackageId)===packageId&&row.attachmentType==="script"
    );
    const audio=attachmentRows.find(row=>
      Number(row.trafficPackageId)===packageId&&row.attachmentType==="audio"
    );

    $("station-script-source").value=script?.sourceType||"final_script";
    $("station-script-filename").value=script?.fileName||"";
    refreshScriptPreview(!script);

    const pmsg=$("pmsg");
    if(audio?.fileName&&pmsg){
      pmsg.textContent=`Recorded package audio: ${audio.fileName}. Choose the physical audio file again before creating a new Gmail draft.`;
    }
  }

  function injectControls(){
    if($("station-script-source"))return true;
    const audioInput=$("file");
    const audioLabel=audioInput?.closest("label");
    const grid=audioLabel?.parentElement;
    if(!audioLabel||!grid)return false;

    const source=document.createElement("label");
    source.innerHTML=`Script Attachment Source
      <select id="station-script-source">
        <option value="final_script">Final Script</option>
        <option value="coop_script">Co-op Script</option>
        <option value="approved_script">Approved Script</option>
        <option value="none">Do Not Attach Script</option>
      </select>`;

    const filename=document.createElement("label");
    filename.className="two";
    filename.innerHTML=`Script Attachment Filename
      <input id="station-script-filename" placeholder="Generated from audio filename or spot name">`;

    const preview=document.createElement("label");
    preview.className="all";
    preview.innerHTML=`Script Attachment Preview
      <textarea id="station-script-preview" class="script" readonly placeholder="The selected saved script will appear here."></textarea>`;

    const note=document.createElement("div");
    note.className="all sub";
    note.id="station-attachment-note";
    note.textContent="The Gmail draft will include the physical audio file plus the selected saved script. Nothing sends automatically.";

    audioLabel.insertAdjacentElement("afterend",source);
    source.insertAdjacentElement("afterend",filename);
    filename.insertAdjacentElement("afterend",preview);
    preview.insertAdjacentElement("afterend",note);

    $("station-script-source").addEventListener("change",()=>refreshScriptPreview(true));
    audioInput.addEventListener("change",()=>refreshScriptPreview(true));

    return true;
  }

  async function buildEmail(){
    await refreshData();
    const c=creative();
    if(!c)throw new Error("Save and select the Creative first.");

    const assignmentIds=selectedAssignmentIds();
    const assignments=(workflow?.assignments||[]).filter(item=>
      Number(item.creativeId)===Number(c.id)&&assignmentIds.includes(Number(item.id))
    );
    const markets=assignments.map(item=>`${item.market} / ${item.outletName}`).join("; ");
    const subject=$("subject");
    if(!subject.value.trim()){
      subject.value=`Traffic — ${c.clientName} — ${c.creativeName}`;
    }

    const info=scriptInfo();
    const body=[
      "Hi,",
      "",
      `Please traffic the following ${c.mediaType||"media"} creative for ${c.clientName}:`,
      "",
      `Creative: ${c.creativeName}`,
      c.lengthSeconds?`Length: :${c.lengthSeconds}`:null,
      c.isci?`ISCI: ${c.isci}`:null,
      markets?`Markets / Stations: ${markets}`:null,
      $("schedule").value.trim()?`Schedule: ${$("schedule").value.trim()}`:null,
      $("io").value.trim()?`Insertion Order: ${$("io").value.trim()}`:null
    ];

    if($("special").value.trim()){
      body.push("","Special Instructions:","",$("special").value.trim());
    }

    body.push(
      "",
      info.source==="none"
        ?"The final production audio is attached."
        :`The final production audio and ${info.label.toLowerCase()} are attached.`,
      "Please confirm receipt and that the spots have been trafficked.",
      "",
      "Thank you,",
      "Andy",
      "Global Concepts Media"
    );

    $("body").value=body.filter(value=>value!==null).join("\n");
    const pmsg=$("pmsg");
    pmsg.className="status ok";
    pmsg.textContent="Email package built. Review and edit every line before saving or drafting.";
  }

  async function fileToBase64(file){
    const bytes=new Uint8Array(await file.arrayBuffer());
    let binary="";
    const chunk=0x8000;
    for(let index=0;index<bytes.length;index+=chunk){
      binary+=String.fromCharCode(...bytes.subarray(index,index+chunk));
    }
    return btoa(binary);
  }

  async function createDraft(){
    const pmsg=$("pmsg");
    try{
      await refreshData();

      const creativeId=currentCreativeId();
      const packageId=currentPackageId();
      if(!creativeId||!packageId){
        throw new Error("Save and select the traffic package first.");
      }

      const audio=$("file")?.files?.[0];
      if(!audio){
        throw new Error("Choose the physical final audio file before creating the Gmail draft.");
      }

      const info=scriptInfo();
      if(info.source!=="none"&&!info.text.trim()){
        throw new Error(`The selected ${info.label} is empty. Save that script in the Creative record or choose another source.`);
      }

      const assignmentIds=selectedAssignmentIds();
      await api("save_traffic_package",{
        trafficPackageId:packageId,
        creativeId,
        assignmentIds,
        trafficPackage:{
          creativeId,
          toEmail:$("to").value.trim(),
          ccEmail:$("cc").value.trim(),
          subject:$("subject").value.trim(),
          bodyText:$("body").value.trim(),
          specialInstructions:$("special").value.trim(),
          insertionOrderReference:$("io").value.trim(),
          scheduleReference:$("schedule").value.trim(),
          packageStatus:$("pkgStatus").value
        }
      });

      const draft=await api("create_station_gmail_draft",{
        trafficPackageId:packageId,
        audioAttachment:{
          fileName:audio.name,
          mimeType:audio.type||"audio/mpeg",
          base64:await fileToBase64(audio)
        },
        scriptSource:info.source,
        scriptFileName:$("station-script-filename").value.trim()||suggestedScriptName()
      });

      $("pkgStatus").value="gmail_draft";
      pmsg.className="status ok";
      pmsg.innerHTML=`Gmail draft created with ${draft.attachmentFileNames?.length||1} attachment${(draft.attachmentFileNames?.length||1)===1?"":"s"}. <a href="${esc(draft.gmailUrl||"https://mail.google.com/mail/u/0/#drafts")}" target="_blank" rel="noopener">Open Gmail Draft</a>. Nothing was sent.`;
      await refreshData();
    }catch(error){
      pmsg.className="status err";
      pmsg.textContent=error.message||String(error);
    }
  }

  function replaceActionButton(id,handler){
    const original=$(id);
    if(!original)return;
    const replacement=original.cloneNode(true);
    original.replaceWith(replacement);
    replacement.addEventListener("click",async()=>{
      replacement.disabled=true;
      try{await handler();}finally{replacement.disabled=false;}
    });
  }

  function updateVersion(){
    document.querySelectorAll("header .dark, header .version").forEach(node=>{
      if(/v2\.0\.0|media-production\.html/.test(node.textContent||"")){
        node.textContent=node.classList.contains("version")
          ?"media-production.html · v2.1.0"
          :"v2.1.0";
      }
    });

    setTimeout(()=>{
      const status=document.querySelector(".gcm-shell-status span:last-child");
      if(status)status.textContent="Media creative workflow · v2.1.0";
    },0);
  }

  async function start(){
    if(!injectControls())return;
    replaceActionButton("build",buildEmail);
    replaceActionButton("draft",createDraft);

    $("pkg")?.addEventListener("change",()=>setTimeout(async()=>{
      try{
        await refreshData();
        await restorePackageAttachments();
      }catch{}
    },0));

    $("creative")?.addEventListener("change",()=>setTimeout(async()=>{
      try{
        await refreshData();
        refreshScriptPreview(true);
      }catch{}
    },0));

    $("name")?.addEventListener("change",()=>refreshScriptPreview(false));
    $("audio")?.addEventListener("change",()=>refreshScriptPreview(false));

    updateVersion();

    try{
      await refreshData();
      await restorePackageAttachments();
      refreshScriptPreview(false);
    }catch(error){
      const pmsg=$("pmsg");
      if(pmsg){
        pmsg.className="status err";
        pmsg.textContent=error.message||String(error);
      }
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(start,0),{once:true});
  }else{
    setTimeout(start,0);
  }
})();
