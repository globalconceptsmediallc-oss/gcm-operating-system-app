from pathlib import Path

path = Path("work.html")
text = path.read_text()

if "Version: 1.9.17" not in text:
    text = text.replace("Version: 1.9.16", "Version: 1.9.17", 1)
    text = text.replace(
        "   - v1.9.16 makes Safari new-tab evidence clicks deterministic.\n",
        "   - v1.9.16 makes Safari new-tab evidence clicks deterministic.\n"
        "   - v1.9.17 keeps Open Work Items as the authoritative open-work queue even when an Investigation is selected.\n"
        "   - v1.9.17 uses the client filter for queue scope and only prioritizes, rather than filters to, the selected Investigation linked Work Item.\n"
        "   - v1.9.17 keeps direct Requested Work visible beside Investigation-created work.\n",
        1,
    )
    text = text.replace(
        "Requested Work + WWPOWD Investigation · v1.9.16",
        "Requested Work + WWPOWD Investigation · v1.9.17",
    )
    text = text.replace(
        "Requested work + WWPOWD investigation · Work v1.9.16",
        "Requested work + WWPOWD investigation · Work v1.9.17",
    )

    start = text.index("  function renderWorkItems(selectedInvestigation){")
    end = text.index("  async function completeWorkItem(item){", start)

    replacement = r'''  function renderWorkItems(selectedInvestigation){
    const selectedClient=normalizedClientCode(el.filter.value);
    const selectedInvestigationId=positiveInt(selectedInvestigation?.id);
    const selectedInvestigationClient=normalizedClientCode(selectedInvestigation?.clientCode);
    const linkedToSelectedInvestigation=item=>
      Boolean(selectedInvestigationId) &&
      directWorkInvestigationId(item)===selectedInvestigationId &&
      normalizedClientCode(item.clientCode)===selectedInvestigationClient;

    const visibleWorkItems=workItems.filter(item=>
      !selectedClient||normalizedClientCode(item.clientCode)===selectedClient
    ).sort((a,b)=>{
      const selectedDelta=Number(linkedToSelectedInvestigation(b))-Number(linkedToSelectedInvestigation(a));
      if(selectedDelta)return selectedDelta;
      return Number(b.id)-Number(a.id);
    });

    if(!visibleWorkItems.length){
      el.openWork.innerHTML='<div class="empty">No open Work Items match this view.</div>';
      return;
    }

    el.openWork.innerHTML=visibleWorkItems.map(i=>`
      <article class="work-card" data-work-id="${esc(i.id)}">
        <h3>Work Item #${esc(i.id)} · ${esc(i.title||"Work Item")}</h3>
        ${i.investigation_id?"":'<span class="direct-work-label">Direct Requested Work</span>'}
        <p class="detail-subtitle">
          ${esc(i.clientName)} · ${i.investigation_id?`Investigation #${esc(i.investigation_id)}`:"No Investigation required"}
        </p>
        <section class="detail-section">
          <h3>Specific Action</h3>
          <p>${esc(i.description||"No work description stored.")}</p>
        </section>
        <section class="detail-section">
          <h3>Complete Work Item</h3>
          <label>Work Performed</label>
          <textarea id="work-performed-${esc(i.id)}" placeholder="Record what was actually done."></textarea>
          <label>Result</label>
          <textarea id="work-result-${esc(i.id)}" placeholder="Record the verified result or actual impact."></textarea>
          <label>Completion Evidence</label>
          <textarea id="work-evidence-${esc(i.id)}" placeholder="Record the evidence that proves completion."></textarea>
          <div class="processing-actions">
            <button class="button primary" data-complete-work="${esc(i.id)}">
              Complete Work Item
            </button>
          </div>
          <div id="work-message-${esc(i.id)}"></div>
        </section>
      </article>
    `).join("");

    el.openWork.querySelectorAll("[data-complete-work]").forEach(button=>{
      button.addEventListener("click",()=>{
        const id=Number(button.dataset.completeWork);
        const item=visibleWorkItems.find(entry=>Number(entry.id)===id);
        if(item)completeWorkItem(item);
      });
    });
  }

'''

    text = text[:start] + replacement + text[end:]
    path.write_text(text)
