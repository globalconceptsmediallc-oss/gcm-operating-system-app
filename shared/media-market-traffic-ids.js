/* =========================================================
   Global Concepts Media Operating System
   File: shared/media-market-traffic-ids.js
   Version: 1.0.1
   Status: Production Candidate
   Sprint: Market-Level Traffic ID / ISCI
   Purpose: Keep one reusable Creative while assigning the station Traffic ID
            / ISCI to each market assignment, and carry those identifiers into
            the reviewed Station Email package.

   Changes in 1.0.1:
   - Removes self-triggering package-market observation.
   - Refreshes package Traffic ID labels only on real operator/page events.
   - Preserves all market, schedule, Creative, and station-package behavior.
   ========================================================= */

(() => {
  "use strict";

  const VERSION="1.0.1";
  const PAGE_VERSION="3.2.0";
  const ENDPOINT="https://gcm-business-intelligence-worker.globalconceptsmediallc.workers.dev/";
  const $=id=>document.getElementById(id);
  const clean=value=>String(value??"").trim();
  const low=value=>clean(value).toLowerCase();

  let workflow=null;
  let trafficRows=[];
  let marketObserver=null;

  async function api(operation,extra={}){
    const response=await fetch(ENDPOINT,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"get-media-operations",operation,...extra})
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||payload?.ok!==true){
      throw new Error(payload?.error||payload?.details||`Worker returned HTTP ${response.status}`);
    }
    return payload;
  }

  function currentCreativeId(){
    return Number($("creative")?.value||new URLSearchParams(location.search).get("creativeId")||0);
  }

  async function refreshData(){
    const [workflowPayload,trafficPayload]=await Promise.all([
      api("get_creative_workflow"),
      api("get_assignment_traffic_ids")
    ]);
    workflow=workflowPayload.creativeWorkflow||null;
    trafficRows=Array.isArray(trafficPayload.assignments)?trafficPayload.assignments:[];
  }

  function creative(){
    const id=currentCreativeId();
    return workflow?.creatives?.find(item=>Number(item.id)===id)||null;
  }

  function assignmentFor(market,outletName){
    const id=currentCreativeId();
    return workflow?.assignments?.find(item=>
      Number(item.creativeId)===id&&
      low(item.market)===low(market)&&
      low(item.outletName)===low(outletName)
    )||null;
  }

  function trafficIdForAssignment(assignment){
    if(!assignment)return"";
    return clean(trafficRows.find(row=>Number(row.assignmentId)===Number(assignment.id))?.trafficId);
  }

  function setStatus(id,text,type=""){
    const node=$(id);
    if(!node)return;
    node.className=`status${type?` ${type}`:""}`;
    node.textContent=text;
  }

  function escapeAttribute(value){
    return String(value??"")
      .replaceAll("&","&amp;")
      .replaceAll('"',"&quot;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  function formatDate(value,options={month:"long",day:"numeric",year:"numeric"}){
    if(!value)return"";
    const date=new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())?value:date.toLocaleDateString("en-US",options);
  }

  function formatRange(start,end){
    if(!start&&!end)return"Schedule not set";
    if(start&&!end)return`${formatDate(start)} — end date not set`;
    if(!start&&end)return`Start date not set — ${formatDate(end)}`;
    const s=new Date(`${start}T12:00:00`),e=new Date(`${end}T12:00:00`);
    if(Number.isNaN(s.getTime())||Number.isNaN(e.getTime()))return`${start} — ${end}`;
    if(start===end)return formatDate(start);
    const sameYear=s.getFullYear()===e.getFullYear();
    const sameMonth=sameYear&&s.getMonth()===e.getMonth();
    if(sameMonth)return`${s.toLocaleDateString("en-US",{month:"long",day:"numeric"})}–${e.toLocaleDateString("en-US",{day:"numeric",year:"numeric"})}`;
    if(sameYear)return`${s.toLocaleDateString("en-US",{month:"long",day:"numeric"})}–${e.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}`;
    return`${formatDate(start)}–${formatDate(end)}`;
  }

  function updateVersionAndCreativeLabel(){
    document.querySelectorAll("header .dark").forEach(node=>{
      if(/^v3\./i.test(clean(node.textContent)))node.textContent=`v${PAGE_VERSION}`;
    });

    const label=$("isci")?.closest("label");
    if(label){
      const textNode=[...label.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&clean(node.nodeValue));
      if(textNode)textNode.nodeValue="Creative Master ID (optional)";
      if(!$("creative-isci-help")){
        const help=document.createElement("span");
        help.id="creative-isci-help";
        help.className="sub";
        help.style.display="block";
        help.style.marginTop="5px";
        help.textContent="Station Traffic IDs / ISCIs are assigned per market below.";
        label.appendChild(help);
      }
    }

    setTimeout(()=>{
      const status=document.querySelector(".gcm-shell-status span:last-child");
      if(status)status.textContent=`Media creative workflow · v${PAGE_VERSION}`;
    },0);
  }

  function injectTrafficInputs(){
    document.querySelectorAll("#marketList .market-row").forEach(row=>{
      if(row.querySelector(".traffic-id"))return;
      const market=clean(row.querySelector(".mk")?.value);
      const outletName=clean(row.querySelector(".out")?.value);
      const assignment=assignmentFor(market,outletName);
      const value=trafficIdForAssignment(assignment);
      const notesLabel=row.querySelector(".notes")?.closest("label");
      if(!notesLabel)return;
      notesLabel.classList.remove("two");
      const label=document.createElement("label");
      label.innerHTML=`Traffic ID / ISCI<input class="traffic-id" autocomplete="off" placeholder="Market-specific Traffic ID" value="${escapeAttribute(value)}">`;
      notesLabel.insertAdjacentElement("beforebegin",label);
    });
  }

  function decoratePackageMarkets(){
    document.querySelectorAll("#pkgMarkets .pkgmarket").forEach(label=>{
      const assignmentId=Number(label.querySelector(".pa")?.value||0);
      const assignment=workflow?.assignments?.find(item=>Number(item.id)===assignmentId);
      const selectedCount=document.querySelectorAll("#pkgMarkets .pa:checked").length;
      const trafficId=trafficIdForAssignment(assignment)||(selectedCount===1?clean(creative()?.isci):"");
      let span=label.querySelector(".market-traffic-id-display");
      if(!trafficId){span?.remove();return;}
      if(!span){
        span=document.createElement("span");
        span.className="market-traffic-id-display";
        span.style.fontWeight="800";
        span.style.color="#1659b9";
        label.appendChild(span);
      }
      span.textContent=` · ISCI: ${trafficId}`;
    });
  }

  function collectMarketRows(requireComplete=false){
    const rows=[];
    document.querySelectorAll("#marketList .market-row").forEach(row=>{
      const market=clean(row.querySelector(".mk")?.value);
      const outletName=clean(row.querySelector(".out")?.value);
      const trafficId=clean(row.querySelector(".traffic-id")?.value);
      const rotationAction=clean(row.querySelector(".act")?.value)||"add_to_rotation";
      const assignmentStatus=clean(row.querySelector(".ast")?.value)||"planned";
      const rotationStartDate=clean(row.querySelector(".start")?.value);
      const rotationEndDate=clean(row.querySelector(".end")?.value);
      const notes=clean(row.querySelector(".notes")?.value);

      if(!market&&!outletName&&!trafficId)return;
      if(!market||!outletName)throw new Error("Each market row needs both Market and Station / Outlet.");

      const existing=assignmentFor(market,outletName);
      const removed=low(assignmentStatus)==="removed";
      if(!removed&&rotationStartDate&&rotationEndDate&&rotationEndDate<rotationStartDate){
        throw new Error(`${market} / ${outletName}: Run End cannot be before Run Start.`);
      }
      if(requireComplete&&!removed&&(!rotationStartDate||!rotationEndDate)){
        throw new Error(`${market} / ${outletName}: choose both Commercial Run Start and Commercial Run End before continuing.`);
      }
      if(requireComplete&&!removed&&!trafficId){
        throw new Error(`${market} / ${outletName}: enter the market Traffic ID / ISCI before continuing.`);
      }

      rows.push({
        mediaRecordId:existing?.mediaRecordId||null,
        mediaType:clean($("type")?.value)||existing?.mediaType||"Radio",
        market,
        outletName,
        placementReference:existing?.placementReference||(existing?.mediaRecordId?`Media record #${existing.mediaRecordId}`:"Direct Creative assignment"),
        rotationAction,
        assignmentStatus,
        rotationStartDate,
        rotationEndDate,
        notes,
        trafficId
      });
    });
    if(!rows.length)throw new Error("Add at least one Market and Station / Outlet.");
    return rows;
  }

  async function saveMarketState(requireComplete=false){
    const creativeId=currentCreativeId();
    if(!creativeId)throw new Error("Save the Creative first.");
    const rows=collectMarketRows(requireComplete);

    await api("save_creative_assignments",{
      creativeId,
      assignments:rows.map(({trafficId,...assignment})=>assignment)
    });
    await refreshData();

    const identifiers=rows
      .filter(row=>clean(row.trafficId))
      .map(row=>({market:row.market,outletName:row.outletName,trafficId:row.trafficId}));
    if(identifiers.length){
      await api("save_assignment_traffic_ids",{creativeId,assignments:identifiers});
      await refreshData();
    }

    injectTrafficInputs();
    decoratePackageMarkets();
    setStatus("mmsg",`${rows.length} market assignment${rows.length===1?"":"s"}, Traffic ID${rows.length===1?"":"s"}, and schedule saved.`,"ok");
    return rows;
  }

  function creativePayload(stage){
    return{
      clientId:Number($("client")?.value||0),
      creativeName:clean($("name")?.value),
      mediaType:clean($("type")?.value)||"Radio",
      lengthSeconds:Number($("length")?.value||0)||null,
      isci:clean($("isci")?.value),
      currentStage:stage||clean($("stage")?.value),
      status:clean($("cstatus")?.value)||"working",
      ideaDirection:clean($("idea")?.value),
      workingScript:clean($("working")?.value),
      approvedScript:clean($("approved")?.value),
      finalScript:clean($("final")?.value),
      voiceTalent:clean($("voice")?.value),
      recordingStatus:clean($("rstatus")?.value),
      recordingReceivedDate:clean($("rdate")?.value),
      recordingReviewNotes:clean($("rnotes")?.value),
      productionStatus:clean($("pstatus")?.value),
      finalAudioFileName:clean($("audio")?.value),
      coopScript:clean($("coop")?.value),
      owner:clean($("owner")?.value)||"Andy"
    };
  }

  async function continueToStationEmail(){
    const creativeId=currentCreativeId();
    const rows=await saveMarketState(true);
    await api("save_creative",{creativeId,creative:creativePayload("Station Email Package")});

    const history=rows
      .filter(row=>low(row.assignmentStatus)!=="removed")
      .map(row=>`${row.market} / ${row.outletName} — ISCI: ${row.trafficId} — ${formatRange(row.rotationStartDate,row.rotationEndDate)}`)
      .join("; ");
    await api("append_creative_history",{
      creativeId,
      stage:"Market Assignment",
      entryType:"decision",
      author:"Andy",
      content:`Market assignment completed: ${history}.`
    });

    try{sessionStorage.setItem("gcmMediaCreativeId",String(creativeId));}catch{}
    location.reload();
  }

  function selectedAssignments(){
    const creativeId=currentCreativeId();
    const ids=[...document.querySelectorAll("#pkgMarkets .pa:checked")].map(input=>Number(input.value)).filter(Boolean);
    return(workflow?.assignments||[]).filter(item=>Number(item.creativeId)===creativeId&&ids.includes(Number(item.id)));
  }

  function assignmentTrafficId(assignment,selectedCount){
    return trafficIdForAssignment(assignment)||(selectedCount===1?clean(creative()?.isci):"");
  }

  async function buildStationEmail(){
    await refreshData();
    decoratePackageMarkets();
    const c=creative();
    if(!c)throw new Error("Save and select the Creative first.");
    const assignments=selectedAssignments();
    if(!assignments.length)throw new Error("Choose at least one market for this email.");

    const rows=assignments.map(assignment=>({...assignment,trafficId:assignmentTrafficId(assignment,assignments.length)}));
    rows.forEach(row=>{
      if(!row.rotationStartDate||!row.rotationEndDate)throw new Error(`${row.market} / ${row.outletName} does not have a Commercial Schedule yet.`);
      if(!row.trafficId)throw new Error(`${row.market} / ${row.outletName} does not have a Traffic ID / ISCI yet. Return to Markets and save it first.`);
    });

    if(!clean($("subject")?.value)){
      $("subject").value=rows.length===1
        ?`Traffic Instructions — ${c.clientName} — ${c.creativeName} — ${rows[0].trafficId}`
        :`Traffic Instructions — ${c.clientName} — ${c.creativeName}`;
    }

    const scriptSource=clean($("scriptSource")?.value)||"final_script";
    const scriptLabel=scriptSource==="coop_script"?"co-op script":scriptSource==="approved_script"?"approved script":"final script";
    const body=[
      "Hi,","",`Please traffic the following ${c.mediaType||"media"} creative for ${c.clientName}:`,"",
      `Creative: ${c.creativeName}`,
      c.lengthSeconds?`Length: :${c.lengthSeconds}`:null,
      "Markets / Stations:",
      ...rows.map(row=>`${row.market} / ${row.outletName} — ISCI: ${row.trafficId}`),
      clean($("schedule")?.value)?`Schedule: ${clean($("schedule").value)}`:null,
      clean($("io")?.value)?`Insertion Order: ${clean($("io").value)}`:null
    ];
    if(clean($("special")?.value))body.push("","Special Instructions:","",clean($("special").value));
    body.push(
      "",
      scriptSource==="none"?"The final production audio is attached.":`The final production audio and ${scriptLabel} are attached.`,
      "Please confirm receipt and that the spots have been trafficked.","","Thank you,","Andy","Global Concepts Media"
    );
    $("emailBody").value=body.filter(value=>value!==null).join("\n");
    setStatus("pmsg","Email package built with market-specific Traffic IDs / ISCIs and the Commercial Schedule. Review every line before saving or drafting.","ok");
  }

  function replaceButton(node,handler,statusTarget){
    if(!node||node.dataset.marketTrafficIdsBound==="1")return;
    const replacement=node.cloneNode(true);
    replacement.dataset.marketTrafficIdsBound="1";
    node.replaceWith(replacement);
    replacement.addEventListener("click",async()=>{
      replacement.disabled=true;
      try{await handler();}
      catch(error){setStatus(statusTarget,error.message||String(error),"err");}
      finally{replacement.disabled=false;}
    });
  }

  function bindActions(){
    replaceButton($("saveMarkets"),()=>saveMarketState(false),"mmsg");
    replaceButton(document.querySelector('[data-complete="5"]'),continueToStationEmail,"mmsg");
    replaceButton($("buildEmail"),buildStationEmail,"pmsg");
  }

  function observeMarketRows(){
    const list=$("marketList");
    if(!list||marketObserver)return;
    marketObserver=new MutationObserver(()=>injectTrafficInputs());
    marketObserver.observe(list,{childList:true,subtree:true});
  }

  async function refreshUi(){
    await refreshData();
    injectTrafficInputs();
    decoratePackageMarkets();
    updateVersionAndCreativeLabel();
  }

  async function start(){
    try{
      updateVersionAndCreativeLabel();
      await refreshData();
      injectTrafficInputs();
      decoratePackageMarkets();
      bindActions();
      observeMarketRows();

      $("creative")?.addEventListener("change",()=>setTimeout(()=>refreshUi().catch(()=>{}),180));
      $("pkg")?.addEventListener("change",()=>setTimeout(()=>refreshUi().catch(()=>{}),120));
      document.querySelectorAll(".step").forEach(step=>{
        step.addEventListener("click",()=>setTimeout(()=>refreshUi().catch(()=>{}),120));
      });
      document.addEventListener("change",event=>{
        if(event.target?.matches?.("#pkgMarkets .pa"))setTimeout(()=>decoratePackageMarkets(),0);
      });
    }catch(error){
      setStatus("cmsg",`Market Traffic ID enhancement could not load: ${error.message||String(error)}`,"err");
    }
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(start,0),{once:true});
  else setTimeout(start,0);

  console.info(`GCM Media Market Traffic IDs v${VERSION}`);
})();
