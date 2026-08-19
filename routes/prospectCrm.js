/* =========================================================
   Global Concepts Media Operating System
   File: routes/prospectCrm.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Purpose: Durable Prospecting Radar + CRM operations for GCM.

   Change Notes:
   - Adds a durable Radar record for pre-appointment prospecting intelligence.
   - Creates a formal CRM Prospect only when a real appointment is scheduled.
   - Preserves contacts, relationship activity, intelligence briefs, proposals,
     dated next actions, signed scope agreements, and payment history.
   - Enforces GCM's minimum 25% initial-payment rule before work authorization.
   - Automatically creates proposal follow-up due 3 business days after the
     latest meaningful proposal-stage contact.
   - Surfaces active CRM records with no dated Next Action as unmanaged.
   - Does not create or modify a Client record; client conversion remains a
     separate verified handoff step.
   ========================================================= */

import { getDatabase, rowsOf } from "../shared/database.js";
import {
  jsonResponse,
  logWorkerError,
  safeErrorMessage
} from "../shared/http.js";

export const PROSPECT_CRM_ACTION = "prospect-crm";
export const PROSPECT_CRM_VERSION = "1.0.0";

const ACTIVE_MANAGED_STATUSES = new Set(["active", "nurture"]);
const ALLOWED_STATUSES = new Set([
  "active",
  "nurture",
  "lost",
  "converted"
]);
const ALLOWED_STAGES = new Set([
  "appointment_scheduled",
  "discovery_completed",
  "qualified",
  "proposal_preparing",
  "proposal_sent",
  "awaiting_decision",
  "verbal_commitment",
  "contract_pending",
  "awaiting_signature",
  "contracted",
  "awaiting_initial_payment",
  "work_authorized",
  "nurture",
  "lost",
  "converted"
]);

export async function handleProspectCrm(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: PROSPECT_CRM_ACTION,
      prospectCrmVersion: PROSPECT_CRM_VERSION,
      error: "The production D1 database binding is unavailable."
    }, 503);
  }

  const operation = cleanText(body?.operation || "list_prospects").toLowerCase();

  try {
    switch (operation) {
      case "list_radar":
        return await listRadar(db, requestId);
      case "create_radar":
        return await createRadar(body, db, requestId);
      case "promote_radar":
        return await promoteRadar(body, db, requestId);
      case "create_prospect":
        return await createProspect(body, db, requestId);
      case "list_prospects":
        return await listProspects(db, requestId);
      case "get_prospect":
        return await getProspect(body, db, requestId);
      case "update_prospect":
        return await updateProspect(body, db, requestId);
      case "add_contact":
        return await addContact(body, db, requestId);
      case "add_activity":
        return await addActivity(body, db, requestId);
      case "add_intelligence":
        return await addIntelligence(body, db, requestId);
      case "record_proposal":
        return await recordProposal(body, db, requestId);
      case "set_next_action":
        return await setNextActionOperation(body, db, requestId);
      case "complete_next_action":
        return await completeNextAction(body, db, requestId);
      case "record_agreement":
        return await recordAgreement(body, db, requestId);
      case "record_payment":
        return await recordPayment(body, db, requestId);
      default:
        return jsonResponse({
          ok: false,
          requestId,
          action: PROSPECT_CRM_ACTION,
          operation,
          prospectCrmVersion: PROSPECT_CRM_VERSION,
          error: `Unsupported Prospect CRM operation: ${operation || "unknown"}.`,
          supportedOperations: supportedOperations()
        }, 400);
    }
  } catch (error) {
    logWorkerError({
      requestId,
      route: PROSPECT_CRM_ACTION,
      stage: `prospect_crm_${operation || "unknown"}`,
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: PROSPECT_CRM_ACTION,
      operation,
      prospectCrmVersion: PROSPECT_CRM_VERSION,
      error: "Prospect CRM could not complete the request.",
      details: safeErrorMessage(error)
    }, 500);
  }
}

function supportedOperations() {
  return [
    "list_radar",
    "create_radar",
    "promote_radar",
    "create_prospect",
    "list_prospects",
    "get_prospect",
    "update_prospect",
    "add_contact",
    "add_activity",
    "add_intelligence",
    "record_proposal",
    "set_next_action",
    "complete_next_action",
    "record_agreement",
    "record_payment"
  ];
}

async function listRadar(db, requestId) {
  const result = await db.prepare(`
    SELECT
      id,
      entry_type,
      business_name,
      website,
      vertical,
      market,
      source_type,
      source_description,
      contact_name,
      contact_email,
      contact_phone,
      evidence_reference,
      notes,
      status,
      promoted_prospect_id,
      created_at,
      updated_at,
      promoted_at,
      archived_at
    FROM crm_prospect_radar
    WHERE archived_at IS NULL
    ORDER BY
      CASE LOWER(COALESCE(status, ''))
        WHEN 'radar' THEN 0
        WHEN 'outreach' THEN 1
        WHEN 'appointment_scheduled' THEN 2
        WHEN 'promoted' THEN 3
        ELSE 4
      END,
      datetime(updated_at) DESC,
      id DESC
  `).all();

  const radar = rowsOf(result).map(mapRadarRow);

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "list_radar",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    source: "D1",
    count: radar.length,
    radar,
    writesPerformed: 0
  });
}

async function createRadar(body, db, requestId) {
  const entryType = normalizeKey(body?.entryType || body?.entry_type || "business") || "business";
  const businessName = nullableText(body?.businessName || body?.business_name);
  const website = nullableText(body?.website);
  const vertical = nullableText(body?.vertical);
  const market = nullableText(body?.market || body?.location);
  const sourceType = cleanText(body?.sourceType || body?.source_type);
  const sourceDescription = nullableText(body?.sourceDescription || body?.source_description);
  const contactName = nullableText(body?.contactName || body?.contact_name);
  const contactEmail = nullableText(body?.contactEmail || body?.contact_email);
  const contactPhone = nullableText(body?.contactPhone || body?.contact_phone);
  const evidenceReference = nullableText(body?.evidenceReference || body?.evidence_reference);
  const notes = nullableText(body?.notes);
  const status = normalizeKey(body?.status || "radar") || "radar";

  if (!sourceType) {
    return validationError(requestId, "create_radar", "Radar requires a sourceType such as advertisement, vertical, business_card, referral, or research.");
  }

  if (!businessName && !vertical && !sourceDescription) {
    return validationError(requestId, "create_radar", "Radar requires a businessName, vertical, or sourceDescription so the lead intelligence has durable meaning.");
  }

  const result = await db.prepare(`
    INSERT INTO crm_prospect_radar (
      entry_type,
      business_name,
      website,
      vertical,
      market,
      source_type,
      source_description,
      contact_name,
      contact_email,
      contact_phone,
      evidence_reference,
      notes,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    entryType,
    businessName,
    website,
    vertical,
    market,
    sourceType,
    sourceDescription,
    contactName,
    contactEmail,
    contactPhone,
    evidenceReference,
    notes,
    status
  ).run();

  const radarId = await insertedId(db, result);
  const radar = await readRadarById(db, radarId);

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "create_radar",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    radar,
    writesPerformed: 1
  }, 201);
}

async function promoteRadar(body, db, requestId) {
  const radarId = positiveInteger(body?.radarId || body?.radar_id);
  if (!radarId) {
    return validationError(requestId, "promote_radar", "promote_radar requires a positive radarId.");
  }

  const radar = await readRadarById(db, radarId);
  if (!radar) {
    return validationError(requestId, "promote_radar", `Radar record ${radarId} was not found.`, 404);
  }

  if (radar.promotedProspectId) {
    const existing = await readProspectSummary(db, radar.promotedProspectId);
    return jsonResponse({
      ok: true,
      requestId,
      action: PROSPECT_CRM_ACTION,
      operation: "promote_radar",
      prospectCrmVersion: PROSPECT_CRM_VERSION,
      duplicateProtected: true,
      prospect: existing,
      writesPerformed: 0
    });
  }

  const appointmentAt = normalizeDateTime(body?.appointmentAt || body?.appointment_at);
  if (!appointmentAt) {
    return validationError(
      requestId,
      "promote_radar",
      "A formal CRM Prospect is not created until a real appointment is scheduled. appointmentAt is required."
    );
  }

  const businessName = cleanText(body?.businessName || body?.business_name || radar.businessName);
  if (!businessName) {
    return validationError(requestId, "promote_radar", "Promotion requires the businessName for the scheduled prospect appointment.");
  }

  const promotedStage = normalizeProspectStage(body?.stage || "appointment_scheduled");
  const promotedStatus = normalizeProspectStatus(body?.status || stageToStatus(promotedStage));
  if (!ALLOWED_STAGES.has(promotedStage)) {
    return validationError(requestId, "promote_radar", `Unsupported prospect stage: ${promotedStage}.`);
  }
  if (!ALLOWED_STATUSES.has(promotedStatus)) {
    return validationError(requestId, "promote_radar", `Unsupported prospect status: ${promotedStatus}.`);
  }

  const created = await createProspectRecord({
    db,
    radarId,
    businessName,
    legalName: nullableText(body?.legalName || body?.legal_name),
    website: nullableText(body?.website || radar.website),
    industry: nullableText(body?.industry || radar.vertical),
    market: nullableText(body?.market || radar.market),
    sourceType: nullableText(body?.sourceType || radar.sourceType),
    sourceDescription: nullableText(body?.sourceDescription || radar.sourceDescription),
    appointmentAt,
    calendarAppointmentId: positiveInteger(body?.calendarAppointmentId || body?.calendar_appointment_id),
    appointmentStatus: normalizeKey(body?.appointmentStatus || body?.appointment_status || "scheduled") || "scheduled",
    stage: promotedStage,
    status: promotedStatus,
    opportunitySummary: nullableText(body?.opportunitySummary || body?.opportunity_summary),
    notes: nullableText(body?.notes || radar.notes),
    lastMeaningfulContactAt: normalizeDateTime(body?.lastMeaningfulContactAt || body?.last_meaningful_contact_at)
  });

  if (radar.contactName) {
    await insertContact(db, created.id, {
      name: radar.contactName,
      email: radar.contactEmail,
      phone: radar.contactPhone,
      role: "initial_contact",
      isPrimary: true
    });
  }

  await db.prepare(`
    UPDATE crm_prospect_radar
    SET status = 'promoted',
        promoted_prospect_id = ?,
        promoted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(created.id, radarId).run();

  const prospect = await readProspectDetail(db, created.id);

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "promote_radar",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    prospect,
    writesPerformed: 4 + (radar.contactName ? 1 : 0)
  }, 201);
}

async function createProspect(body, db, requestId) {
  const appointmentAt = normalizeDateTime(body?.appointmentAt || body?.appointment_at);

  if (!appointmentAt) {
    return validationError(
      requestId,
      "create_prospect",
      "A formal CRM Prospect is not created until a real appointment is scheduled. appointmentAt is required."
    );
  }

  const businessName = cleanText(body?.businessName || body?.business_name);
  if (!businessName) {
    return validationError(requestId, "create_prospect", "create_prospect requires businessName.");
  }

  const stage = normalizeProspectStage(body?.stage || "appointment_scheduled");
  const status = normalizeProspectStatus(body?.status || stageToStatus(stage));

  if (!ALLOWED_STAGES.has(stage)) {
    return validationError(requestId, "create_prospect", `Unsupported prospect stage: ${stage}.`);
  }
  if (!ALLOWED_STATUSES.has(status)) {
    return validationError(requestId, "create_prospect", `Unsupported prospect status: ${status}.`);
  }

  const created = await createProspectRecord({
    db,
    radarId: positiveInteger(body?.radarId || body?.radar_id),
    businessName,
    legalName: nullableText(body?.legalName || body?.legal_name),
    website: nullableText(body?.website),
    industry: nullableText(body?.industry),
    market: nullableText(body?.market || body?.location),
    sourceType: nullableText(body?.sourceType || body?.source_type),
    sourceDescription: nullableText(body?.sourceDescription || body?.source_description),
    appointmentAt,
    calendarAppointmentId: positiveInteger(body?.calendarAppointmentId || body?.calendar_appointment_id),
    appointmentStatus: normalizeKey(body?.appointmentStatus || body?.appointment_status || "scheduled") || "scheduled",
    stage,
    status,
    opportunitySummary: nullableText(body?.opportunitySummary || body?.opportunity_summary),
    notes: nullableText(body?.notes),
    lastMeaningfulContactAt: normalizeDateTime(body?.lastMeaningfulContactAt || body?.last_meaningful_contact_at),
    estimatedValueLowCents: moneyToCents(body?.estimatedValueLowCents, body?.estimatedValueLow),
    estimatedValueHighCents: moneyToCents(body?.estimatedValueHighCents, body?.estimatedValueHigh),
    recurringValueCents: moneyToCents(body?.recurringValueCents, body?.recurringValue),
    recurringPeriod: nullableText(body?.recurringPeriod || body?.recurring_period)
  });

  const contact = body?.primaryContact && typeof body.primaryContact === "object"
    ? body.primaryContact
    : null;

  if (contact && cleanText(contact.name)) {
    await insertContact(db, created.id, {
      name: contact.name,
      title: contact.title,
      email: contact.email,
      phone: contact.phone,
      role: contact.role || "decision_maker",
      isPrimary: true,
      notes: contact.notes
    });
  }

  const prospect = await readProspectDetail(db, created.id);

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "create_prospect",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    prospect,
    writesPerformed: 3 + (contact && cleanText(contact.name) ? 1 : 0)
  }, 201);
}

async function createProspectRecord(input) {
  const {
    db,
    radarId,
    businessName,
    legalName,
    website,
    industry,
    market,
    sourceType,
    sourceDescription,
    appointmentAt,
    calendarAppointmentId,
    appointmentStatus = "scheduled",
    stage,
    status,
    opportunitySummary,
    notes,
    lastMeaningfulContactAt,
    estimatedValueLowCents = null,
    estimatedValueHighCents = null,
    recurringValueCents = null,
    recurringPeriod = null
  } = input;

  const result = await db.prepare(`
    INSERT INTO crm_prospects (
      radar_id,
      business_name,
      legal_name,
      website,
      industry,
      market,
      source_type,
      source_description,
      appointment_at,
      calendar_appointment_id,
      appointment_status,
      stage,
      status,
      opportunity_summary,
      estimated_value_low_cents,
      estimated_value_high_cents,
      recurring_value_cents,
      recurring_period,
      last_meaningful_contact_at,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    radarId || null,
    businessName,
    legalName,
    website,
    industry,
    market,
    sourceType,
    sourceDescription,
    appointmentAt,
    calendarAppointmentId || null,
    appointmentStatus,
    stage,
    status,
    opportunitySummary,
    estimatedValueLowCents,
    estimatedValueHighCents,
    recurringValueCents,
    recurringPeriod,
    lastMeaningfulContactAt || null,
    notes
  ).run();

  const prospectId = await insertedId(db, result);

  await insertActivity(db, prospectId, {
    activityType: "appointment_scheduled",
    occurredAt: appointmentAt,
    direction: "internal",
    subject: "Discovery appointment scheduled",
    summary: `A real appointment was scheduled with ${businessName}; formal CRM Prospect created.`,
    outcome: "scheduled",
    meaningfulContact: false,
    sourceType: calendarAppointmentId ? "calendar" : "crm"
  });

  let nextActionDueDate = dateOnly(appointmentAt);
  let nextActionTitle = "Prepare Agnor-standard pre-meeting intelligence brief";
  let nextActionType = "prepare_discovery_intelligence";
  let nextActionReason = "Every scheduled prospect appointment requires a consultant-grade discovery intelligence brief before the meeting.";

  if (["proposal_sent", "awaiting_decision"].includes(stage) && lastMeaningfulContactAt) {
    nextActionDueDate = addBusinessDays(dateOnly(lastMeaningfulContactAt), 3);
    nextActionTitle = "Follow up on active proposal";
    nextActionType = "proposal_follow_up_email";
    nextActionReason = "GCM active-proposal rule: follow up 3 business days after the latest meaningful contact.";
  }

  if (ACTIVE_MANAGED_STATUSES.has(status)) {
    await replaceOpenNextAction(db, prospectId, {
      actionType: nextActionType,
      title: nextActionTitle,
      dueDate: nextActionDueDate,
      priority: stage === "awaiting_decision" ? "High" : "Normal",
      reason: nextActionReason,
      sourceType: "crm"
    });
  }

  return { id: prospectId };
}

async function listProspects(db, requestId) {
  const result = await db.prepare(`
    SELECT
      p.*,
      (
        SELECT a.id
        FROM crm_prospect_next_actions a
        WHERE a.prospect_id = p.id
          AND LOWER(COALESCE(a.status, 'open')) = 'open'
        ORDER BY date(a.due_date) ASC, a.id ASC
        LIMIT 1
      ) AS next_action_id,
      (
        SELECT a.title
        FROM crm_prospect_next_actions a
        WHERE a.prospect_id = p.id
          AND LOWER(COALESCE(a.status, 'open')) = 'open'
        ORDER BY date(a.due_date) ASC, a.id ASC
        LIMIT 1
      ) AS next_action_title,
      (
        SELECT a.action_type
        FROM crm_prospect_next_actions a
        WHERE a.prospect_id = p.id
          AND LOWER(COALESCE(a.status, 'open')) = 'open'
        ORDER BY date(a.due_date) ASC, a.id ASC
        LIMIT 1
      ) AS next_action_type,
      (
        SELECT a.due_date
        FROM crm_prospect_next_actions a
        WHERE a.prospect_id = p.id
          AND LOWER(COALESCE(a.status, 'open')) = 'open'
        ORDER BY date(a.due_date) ASC, a.id ASC
        LIMIT 1
      ) AS open_next_action_due_date,
      (
        SELECT c.name
        FROM crm_prospect_contacts c
        WHERE c.prospect_id = p.id
        ORDER BY c.is_primary DESC, c.id ASC
        LIMIT 1
      ) AS primary_contact_name,
      (
        SELECT c.email
        FROM crm_prospect_contacts c
        WHERE c.prospect_id = p.id
        ORDER BY c.is_primary DESC, c.id ASC
        LIMIT 1
      ) AS primary_contact_email
    FROM crm_prospects p
    ORDER BY
      CASE LOWER(COALESCE(p.status, 'active'))
        WHEN 'active' THEN 0
        WHEN 'nurture' THEN 1
        WHEN 'lost' THEN 2
        WHEN 'converted' THEN 3
        ELSE 4
      END,
      CASE WHEN p.next_action_due_date IS NULL THEN 1 ELSE 0 END,
      date(p.next_action_due_date) ASC,
      datetime(p.updated_at) DESC,
      p.id DESC
  `).all();

  const prospects = rowsOf(result).map(mapProspectSummaryRow);

  const counts = prospects.reduce((acc, prospect) => {
    acc.total += 1;
    acc[prospect.status] = (acc[prospect.status] || 0) + 1;
    if (prospect.isUnmanaged) acc.unmanaged += 1;
    if (prospect.nextAction?.dueState === "overdue") acc.overdue += 1;
    if (prospect.nextAction?.dueState === "due_today") acc.dueToday += 1;
    return acc;
  }, { total: 0, active: 0, nurture: 0, lost: 0, converted: 0, unmanaged: 0, overdue: 0, dueToday: 0 });

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "list_prospects",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    source: "D1",
    counts,
    prospects,
    writesPerformed: 0
  });
}

async function getProspect(body, db, requestId) {
  const prospectId = positiveInteger(body?.prospectId || body?.prospect_id);
  if (!prospectId) {
    return validationError(requestId, "get_prospect", "get_prospect requires a positive prospectId.");
  }

  const prospect = await readProspectDetail(db, prospectId);
  if (!prospect) {
    return validationError(requestId, "get_prospect", `CRM Prospect ${prospectId} was not found.`, 404);
  }

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "get_prospect",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    prospect,
    writesPerformed: 0
  });
}

async function updateProspect(body, db, requestId) {
  const prospectId = positiveInteger(body?.prospectId || body?.prospect_id);
  if (!prospectId) {
    return validationError(requestId, "update_prospect", "update_prospect requires a positive prospectId.");
  }

  const existing = await readProspectSummary(db, prospectId);
  if (!existing) {
    return validationError(requestId, "update_prospect", `CRM Prospect ${prospectId} was not found.`, 404);
  }

  const stage = body?.stage === undefined
    ? existing.stage
    : normalizeProspectStage(body.stage);
  const status = body?.status === undefined
    ? existing.status
    : normalizeProspectStatus(body.status);

  if (!ALLOWED_STAGES.has(stage)) {
    return validationError(requestId, "update_prospect", `Unsupported prospect stage: ${stage}.`);
  }
  if (!ALLOWED_STATUSES.has(status)) {
    return validationError(requestId, "update_prospect", `Unsupported prospect status: ${status}.`);
  }

  await db.prepare(`
    UPDATE crm_prospects
    SET business_name = ?,
        legal_name = ?,
        website = ?,
        industry = ?,
        market = ?,
        stage = ?,
        status = ?,
        opportunity_summary = ?,
        estimated_value_low_cents = ?,
        estimated_value_high_cents = ?,
        recurring_value_cents = ?,
        recurring_period = ?,
        notes = ?,
        lost_reason = ?,
        nurture_reason = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    cleanText(body?.businessName || body?.business_name || existing.businessName),
    bodyHas(body, "legalName", "legal_name") ? nullableText(body?.legalName ?? body?.legal_name) : existing.legalName,
    bodyHas(body, "website") ? nullableText(body.website) : existing.website,
    bodyHas(body, "industry") ? nullableText(body.industry) : existing.industry,
    bodyHas(body, "market") ? nullableText(body.market) : existing.market,
    stage,
    status,
    bodyHas(body, "opportunitySummary", "opportunity_summary") ? nullableText(body?.opportunitySummary ?? body?.opportunity_summary) : existing.opportunitySummary,
    moneyToCentsOrExisting(body, "estimatedValueLowCents", "estimatedValueLow", existing.estimatedValueLowCents),
    moneyToCentsOrExisting(body, "estimatedValueHighCents", "estimatedValueHigh", existing.estimatedValueHighCents),
    moneyToCentsOrExisting(body, "recurringValueCents", "recurringValue", existing.recurringValueCents),
    bodyHas(body, "recurringPeriod", "recurring_period") ? nullableText(body?.recurringPeriod ?? body?.recurring_period) : existing.recurringPeriod,
    bodyHas(body, "notes") ? nullableText(body.notes) : existing.notes,
    bodyHas(body, "lostReason", "lost_reason") ? nullableText(body?.lostReason ?? body?.lost_reason) : existing.lostReason,
    bodyHas(body, "nurtureReason", "nurture_reason") ? nullableText(body?.nurtureReason ?? body?.nurture_reason) : existing.nurtureReason,
    prospectId
  ).run();

  if (!ACTIVE_MANAGED_STATUSES.has(status)) {
    await closeOpenNextActions(db, prospectId, "closed", `Prospect status changed to ${status}.`);
    await syncProspectNextActionCache(db, prospectId);
  }

  const prospect = await readProspectDetail(db, prospectId);

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "update_prospect",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    prospect,
    writesPerformed: 1
  });
}

async function addContact(body, db, requestId) {
  const prospectId = positiveInteger(body?.prospectId || body?.prospect_id);
  const name = cleanText(body?.name || body?.contactName || body?.contact_name);

  if (!prospectId) {
    return validationError(requestId, "add_contact", "add_contact requires a positive prospectId.");
  }
  if (!name) {
    return validationError(requestId, "add_contact", "add_contact requires the contact name.");
  }
  if (!(await prospectExists(db, prospectId))) {
    return validationError(requestId, "add_contact", `CRM Prospect ${prospectId} was not found.`, 404);
  }

  const contactId = await insertContact(db, prospectId, {
    name,
    title: body?.title,
    email: body?.email,
    phone: body?.phone,
    role: body?.role,
    isPrimary: Boolean(body?.isPrimary ?? body?.is_primary),
    notes: body?.notes
  });

  const prospect = await readProspectDetail(db, prospectId);

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "add_contact",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    contactId,
    prospect,
    writesPerformed: 1
  }, 201);
}

async function addActivity(body, db, requestId) {
  const prospectId = positiveInteger(body?.prospectId || body?.prospect_id);
  const activityType = normalizeKey(body?.activityType || body?.activity_type);
  const occurredAt = normalizeDateTime(body?.occurredAt || body?.occurred_at);
  const summary = cleanText(body?.summary);
  const externalKey = nullableText(body?.externalKey || body?.external_key);

  if (!prospectId) {
    return validationError(requestId, "add_activity", "add_activity requires a positive prospectId.");
  }
  if (!activityType || !occurredAt || !summary) {
    return validationError(requestId, "add_activity", "add_activity requires activityType, occurredAt, and summary.");
  }
  if (!(await prospectExists(db, prospectId))) {
    return validationError(requestId, "add_activity", `CRM Prospect ${prospectId} was not found.`, 404);
  }

  if (externalKey) {
    const duplicate = await readExistingByExternalKey(db, "crm_prospect_activities", externalKey);
    if (duplicate) {
      const prospect = await readProspectDetail(db, prospectId);
      return jsonResponse({
        ok: true,
        requestId,
        action: PROSPECT_CRM_ACTION,
        operation: "add_activity",
        prospectCrmVersion: PROSPECT_CRM_VERSION,
        duplicateProtected: true,
        activityId: duplicate.id,
        prospect,
        writesPerformed: 0
      });
    }
  }

  const stageAfterRaw = body?.stageAfter || body?.stage_after;
  const validatedStageAfter = stageAfterRaw ? normalizeProspectStage(stageAfterRaw) : null;
  if (validatedStageAfter && !ALLOWED_STAGES.has(validatedStageAfter)) {
    return validationError(requestId, "add_activity", `Unsupported stageAfter: ${validatedStageAfter}.`);
  }

  const meaningfulContact = Boolean(body?.meaningfulContact ?? body?.meaningful_contact);
  const activityId = await insertActivity(db, prospectId, {
    activityType,
    occurredAt,
    direction: body?.direction,
    subject: body?.subject,
    summary,
    outcome: body?.outcome,
    meaningfulContact,
    sourceType: body?.sourceType || body?.source_type,
    sourceReference: body?.sourceReference || body?.source_reference,
    externalKey,
    notes: body?.notes
  });

  if (validatedStageAfter) {
    await db.prepare(`
      UPDATE crm_prospects
      SET stage = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(validatedStageAfter, stageToStatus(validatedStageAfter), prospectId).run();
  }

  if (meaningfulContact) {
    await db.prepare(`
      UPDATE crm_prospects
      SET last_meaningful_contact_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(occurredAt, prospectId).run();

    const current = await readProspectSummary(db, prospectId);
    if (current && ["proposal_sent", "awaiting_decision"].includes(current.stage) && isProposalCadenceActivity(activityType)) {
      const next = followUpAfterActivity(activityType, occurredAt, body?.outcome);
      if (next) {
        await replaceOpenNextAction(db, prospectId, next);
      }

      if (normalizeKey(activityType) === "close_loop_email" && isNoResponseOutcome(body?.outcome)) {
        await db.prepare(`
          UPDATE crm_prospects
          SET stage = 'nurture',
              status = 'nurture',
              nurture_reason = COALESCE(nurture_reason, 'Active proposal follow-up cadence completed without a response.'),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(prospectId).run();
      }
    }
  }

  const prospect = await readProspectDetail(db, prospectId);

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "add_activity",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    activityId,
    prospect,
    writesPerformed: meaningfulContact ? 3 : 1
  }, 201);
}

async function addIntelligence(body, db, requestId) {
  const prospectId = positiveInteger(body?.prospectId || body?.prospect_id);
  const intelligenceType = normalizeKey(body?.intelligenceType || body?.intelligence_type || "meeting_brief");
  const title = cleanText(body?.title);
  const capturedAt = normalizeDateTime(body?.capturedAt || body?.captured_at || new Date().toISOString());
  const externalKey = nullableText(body?.externalKey || body?.external_key);

  if (!prospectId || !title || !capturedAt) {
    return validationError(requestId, "add_intelligence", "add_intelligence requires prospectId, title, and a valid capturedAt.");
  }
  if (!(await prospectExists(db, prospectId))) {
    return validationError(requestId, "add_intelligence", `CRM Prospect ${prospectId} was not found.`, 404);
  }

  if (externalKey) {
    const duplicate = await readExistingByExternalKey(db, "crm_prospect_intelligence", externalKey);
    if (duplicate) {
      return jsonResponse({
        ok: true,
        requestId,
        action: PROSPECT_CRM_ACTION,
        operation: "add_intelligence",
        prospectCrmVersion: PROSPECT_CRM_VERSION,
        duplicateProtected: true,
        intelligenceId: duplicate.id,
        writesPerformed: 0
      });
    }
  }

  const intelligenceJson = body?.intelligence === undefined && body?.intelligenceJson === undefined
    ? null
    : JSON.stringify(body?.intelligence ?? body?.intelligenceJson);

  const result = await db.prepare(`
    INSERT INTO crm_prospect_intelligence (
      prospect_id,
      intelligence_type,
      title,
      summary,
      intelligence_json,
      source_type,
      source_reference,
      external_key,
      captured_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    prospectId,
    intelligenceType,
    title,
    nullableText(body?.summary),
    intelligenceJson,
    nullableText(body?.sourceType || body?.source_type),
    nullableText(body?.sourceReference || body?.source_reference),
    externalKey,
    capturedAt
  ).run();

  const intelligenceId = await insertedId(db, result);

  await insertActivity(db, prospectId, {
    activityType: "intelligence_created",
    occurredAt: capturedAt,
    direction: "internal",
    subject: title,
    summary: cleanText(body?.summary) || `${title} preserved as durable prospect intelligence.`,
    outcome: "preserved",
    sourceType: body?.sourceType || body?.source_type || "crm",
    sourceReference: body?.sourceReference || body?.source_reference || String(intelligenceId)
  });

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "add_intelligence",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    intelligenceId,
    prospect: await readProspectDetail(db, prospectId),
    writesPerformed: 2
  }, 201);
}

async function recordProposal(body, db, requestId) {
  const prospectId = positiveInteger(body?.prospectId || body?.prospect_id);
  const title = cleanText(body?.title || "Proposal");
  const sentAt = normalizeDateTime(body?.sentAt || body?.sent_at);
  const externalKey = nullableText(body?.externalKey || body?.external_key);

  if (!prospectId || !sentAt) {
    return validationError(requestId, "record_proposal", "record_proposal requires prospectId and sentAt.");
  }
  if (!(await prospectExists(db, prospectId))) {
    return validationError(requestId, "record_proposal", `CRM Prospect ${prospectId} was not found.`, 404);
  }

  if (externalKey) {
    const duplicate = await readExistingByExternalKey(db, "crm_prospect_proposals", externalKey);
    if (duplicate) {
      return jsonResponse({
        ok: true,
        requestId,
        action: PROSPECT_CRM_ACTION,
        operation: "record_proposal",
        prospectCrmVersion: PROSPECT_CRM_VERSION,
        duplicateProtected: true,
        proposalId: duplicate.id,
        prospect: await readProspectDetail(db, prospectId),
        writesPerformed: 0
      });
    }
  }

  const valueLowCents = moneyToCents(body?.valueLowCents, body?.valueLow);
  const valueHighCents = moneyToCents(body?.valueHighCents, body?.valueHigh);
  const recurringValueCents = moneyToCents(body?.recurringValueCents, body?.recurringValue);
  const termsJson = body?.terms === undefined ? null : JSON.stringify(body.terms);

  const result = await db.prepare(`
    INSERT INTO crm_prospect_proposals (
      prospect_id,
      proposal_type,
      title,
      sent_at,
      status,
      scope_summary,
      value_low_cents,
      value_high_cents,
      recurring_value_cents,
      recurring_period,
      terms_json,
      source_type,
      source_reference,
      external_key,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    prospectId,
    normalizeKey(body?.proposalType || body?.proposal_type || "proposal") || "proposal",
    title,
    sentAt,
    nullableText(body?.scopeSummary || body?.scope_summary),
    valueLowCents,
    valueHighCents,
    recurringValueCents,
    nullableText(body?.recurringPeriod || body?.recurring_period),
    termsJson,
    nullableText(body?.sourceType || body?.source_type),
    nullableText(body?.sourceReference || body?.source_reference),
    externalKey
  ).run();

  const proposalId = await insertedId(db, result);

  await db.prepare(`
    UPDATE crm_prospects
    SET stage = 'awaiting_decision',
        status = 'active',
        last_meaningful_contact_at = ?,
        opportunity_summary = COALESCE(?, opportunity_summary),
        estimated_value_low_cents = COALESCE(?, estimated_value_low_cents),
        estimated_value_high_cents = COALESCE(?, estimated_value_high_cents),
        recurring_value_cents = COALESCE(?, recurring_value_cents),
        recurring_period = COALESCE(?, recurring_period),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    sentAt,
    nullableText(body?.scopeSummary || body?.scope_summary),
    valueLowCents,
    valueHighCents,
    recurringValueCents,
    nullableText(body?.recurringPeriod || body?.recurring_period),
    prospectId
  ).run();

  await insertActivity(db, prospectId, {
    activityType: "proposal_sent",
    occurredAt: sentAt,
    direction: "outbound",
    subject: title,
    summary: cleanText(body?.activitySummary) || `${title} sent to prospect.`,
    outcome: "awaiting_decision",
    meaningfulContact: true,
    sourceType: body?.sourceType || body?.source_type || "crm",
    sourceReference: body?.sourceReference || body?.source_reference || String(proposalId),
    externalKey: externalKey ? `${externalKey}:activity` : null
  });

  await replaceOpenNextAction(db, prospectId, {
    actionType: "proposal_follow_up_email",
    title: "Follow up on active proposal",
    dueDate: addBusinessDays(dateOnly(sentAt), 3),
    priority: "High",
    reason: "GCM active-proposal rule: first follow-up is due 3 business days after the latest meaningful contact.",
    sourceType: "proposal",
    sourceReference: String(proposalId)
  });

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "record_proposal",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    proposalId,
    prospect: await readProspectDetail(db, prospectId),
    writesPerformed: 4
  }, 201);
}

async function setNextActionOperation(body, db, requestId) {
  const prospectId = positiveInteger(body?.prospectId || body?.prospect_id);
  const actionType = normalizeKey(body?.actionType || body?.action_type || "follow_up");
  const title = cleanText(body?.title);
  const dueDate = normalizeDateOnly(body?.dueDate || body?.due_date);

  if (!prospectId || !title || !dueDate) {
    return validationError(requestId, "set_next_action", "set_next_action requires prospectId, title, and dueDate (YYYY-MM-DD).");
  }
  if (!(await prospectExists(db, prospectId))) {
    return validationError(requestId, "set_next_action", `CRM Prospect ${prospectId} was not found.`, 404);
  }

  const nextActionId = await replaceOpenNextAction(db, prospectId, {
    actionType,
    title,
    dueDate,
    priority: cleanText(body?.priority || "Normal") || "Normal",
    reason: nullableText(body?.reason),
    sourceType: nullableText(body?.sourceType || body?.source_type || "crm"),
    sourceReference: nullableText(body?.sourceReference || body?.source_reference)
  });

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "set_next_action",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    nextActionId,
    prospect: await readProspectDetail(db, prospectId),
    writesPerformed: 2
  });
}

async function completeNextAction(body, db, requestId) {
  const nextActionId = positiveInteger(body?.nextActionId || body?.next_action_id);
  if (!nextActionId) {
    return validationError(requestId, "complete_next_action", "complete_next_action requires a positive nextActionId.");
  }

  const actionResult = await db.prepare(`
    SELECT prospect_id, title, status
    FROM crm_prospect_next_actions
    WHERE id = ?
    LIMIT 1
  `).bind(nextActionId).all();
  const actionRow = rowsOf(actionResult)[0];

  if (!actionRow) {
    return validationError(requestId, "complete_next_action", `Next Action ${nextActionId} was not found.`, 404);
  }

  let validatedReplacement = null;
  if (body?.replacement && typeof body.replacement === "object") {
    const replacementTitle = cleanText(body.replacement.title);
    const replacementDueDate = normalizeDateOnly(body.replacement.dueDate || body.replacement.due_date);
    if (!replacementTitle || !replacementDueDate) {
      return validationError(requestId, "complete_next_action", "replacement Next Action requires title and dueDate.");
    }
    validatedReplacement = { ...body.replacement, title: replacementTitle, dueDate: replacementDueDate };
  }

  await db.prepare(`
    UPDATE crm_prospect_next_actions
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        completion_note = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(nullableText(body?.completionNote || body?.completion_note), nextActionId).run();

  const prospectId = positiveInteger(actionRow.prospect_id);

  if (validatedReplacement) {
    const replacement = validatedReplacement;
    await replaceOpenNextAction(db, prospectId, {
      actionType: normalizeKey(replacement.actionType || replacement.action_type || "follow_up"),
      title: replacement.title,
      dueDate: replacement.dueDate,
      priority: cleanText(replacement.priority || "Normal") || "Normal",
      reason: nullableText(replacement.reason),
      sourceType: "crm",
      sourceReference: String(nextActionId)
    });
  } else {
    await syncProspectNextActionCache(db, prospectId);
  }

  const prospect = await readProspectDetail(db, prospectId);

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "complete_next_action",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    prospect,
    managementWarning: prospect?.isUnmanaged
      ? "This active Prospect now has no dated Next Action and must be surfaced as unmanaged."
      : null,
    writesPerformed: validatedReplacement ? 3 : 2
  });
}

async function recordAgreement(body, db, requestId) {
  const prospectId = positiveInteger(body?.prospectId || body?.prospect_id);
  const signedAt = normalizeDateTime(body?.signedAt || body?.signed_at);
  const scopeSummary = cleanText(body?.scopeSummary || body?.scope_summary);
  const contractValueCents = moneyToCents(body?.contractValueCents, body?.contractValue);
  const externalKey = nullableText(body?.externalKey || body?.external_key);

  if (!prospectId || !signedAt || !scopeSummary || !contractValueCents || contractValueCents <= 0) {
    return validationError(
      requestId,
      "record_agreement",
      "record_agreement requires prospectId, signedAt, defined scopeSummary, and a positive contract value."
    );
  }
  if (!(await prospectExists(db, prospectId))) {
    return validationError(requestId, "record_agreement", `CRM Prospect ${prospectId} was not found.`, 404);
  }

  const minimumRequired = minimumInitialPaymentCents(contractValueCents);
  const requestedInitial = moneyToCents(
    body?.initialPaymentRequiredCents,
    body?.initialPaymentRequired
  );
  const initialPaymentRequiredCents = requestedInitial === null
    ? minimumRequired
    : requestedInitial;

  if (initialPaymentRequiredCents < minimumRequired) {
    return validationError(
      requestId,
      "record_agreement",
      `GCM requires at least 25% of the total contracted amount before project work begins. Minimum required for this contract is ${minimumRequired} cents.`
    );
  }

  if (externalKey) {
    const duplicate = await readExistingByExternalKey(db, "crm_prospect_agreements", externalKey);
    if (duplicate) {
      return jsonResponse({
        ok: true,
        requestId,
        action: PROSPECT_CRM_ACTION,
        operation: "record_agreement",
        prospectCrmVersion: PROSPECT_CRM_VERSION,
        duplicateProtected: true,
        agreementId: duplicate.id,
        prospect: await readProspectDetail(db, prospectId),
        writesPerformed: 0
      });
    }
  }

  const result = await db.prepare(`
    INSERT INTO crm_prospect_agreements (
      prospect_id,
      agreement_type,
      status,
      signed_at,
      scope_summary,
      contract_value_cents,
      initial_payment_required_cents,
      source_type,
      source_reference,
      external_key,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, 'signed', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    prospectId,
    normalizeKey(body?.agreementType || body?.agreement_type || "signed_scope") || "signed_scope",
    signedAt,
    scopeSummary,
    contractValueCents,
    initialPaymentRequiredCents,
    nullableText(body?.sourceType || body?.source_type),
    nullableText(body?.sourceReference || body?.source_reference),
    externalKey,
    nullableText(body?.notes)
  ).run();

  const agreementId = await insertedId(db, result);

  await db.prepare(`
    UPDATE crm_prospects
    SET stage = 'awaiting_initial_payment',
        status = 'active',
        opportunity_summary = ?,
        estimated_value_low_cents = ?,
        estimated_value_high_cents = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(scopeSummary, contractValueCents, contractValueCents, prospectId).run();

  await insertActivity(db, prospectId, {
    activityType: "agreement_signed",
    occurredAt: signedAt,
    direction: "mutual",
    subject: "Signed agreement with defined scope",
    summary: scopeSummary,
    outcome: "awaiting_initial_payment",
    meaningfulContact: true,
    sourceType: body?.sourceType || body?.source_type || "agreement",
    sourceReference: body?.sourceReference || body?.source_reference || String(agreementId),
    externalKey: externalKey ? `${externalKey}:activity` : null
  });

  await replaceOpenNextAction(db, prospectId, {
    actionType: "collect_initial_payment",
    title: "Collect required initial payment and begin onboarding",
    dueDate: dateOnly(signedAt),
    priority: "High",
    reason: `Signed scope is in place. Work begins only after at least ${initialPaymentRequiredCents} cents of the contracted amount is received.`,
    sourceType: "agreement",
    sourceReference: String(agreementId)
  });

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "record_agreement",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    agreementId,
    contractValueCents,
    minimumInitialPaymentCents: minimumRequired,
    initialPaymentRequiredCents,
    prospect: await readProspectDetail(db, prospectId),
    writesPerformed: 4
  }, 201);
}

async function recordPayment(body, db, requestId) {
  const prospectId = positiveInteger(body?.prospectId || body?.prospect_id);
  let agreementId = positiveInteger(body?.agreementId || body?.agreement_id);
  const amountCents = moneyToCents(body?.amountCents, body?.amount);
  const receivedAt = normalizeDateTime(body?.receivedAt || body?.received_at);
  const externalKey = nullableText(body?.externalKey || body?.external_key);

  if (!prospectId || !amountCents || amountCents <= 0 || !receivedAt) {
    return validationError(requestId, "record_payment", "record_payment requires prospectId, positive amount, and receivedAt.");
  }

  if (!agreementId) {
    const latestResult = await db.prepare(`
      SELECT id
      FROM crm_prospect_agreements
      WHERE prospect_id = ?
      ORDER BY datetime(signed_at) DESC, id DESC
      LIMIT 1
    `).bind(prospectId).all();
    agreementId = positiveInteger(rowsOf(latestResult)[0]?.id);
  }

  if (!agreementId) {
    return validationError(requestId, "record_payment", "No signed agreement was found for this Prospect. Record the signed scope before payment.");
  }

  const agreement = await readAgreementById(db, agreementId);
  if (!agreement || agreement.prospectId !== prospectId) {
    return validationError(requestId, "record_payment", `Agreement ${agreementId} does not belong to CRM Prospect ${prospectId}.`, 404);
  }

  if (externalKey) {
    const duplicate = await readExistingByExternalKey(db, "crm_prospect_payments", externalKey);
    if (duplicate) {
      return jsonResponse({
        ok: true,
        requestId,
        action: PROSPECT_CRM_ACTION,
        operation: "record_payment",
        prospectCrmVersion: PROSPECT_CRM_VERSION,
        duplicateProtected: true,
        paymentId: duplicate.id,
        prospect: await readProspectDetail(db, prospectId),
        writesPerformed: 0
      });
    }
  }

  const result = await db.prepare(`
    INSERT INTO crm_prospect_payments (
      prospect_id,
      agreement_id,
      amount_cents,
      received_at,
      payment_method,
      source_type,
      source_reference,
      external_key,
      notes,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    prospectId,
    agreementId,
    amountCents,
    receivedAt,
    nullableText(body?.paymentMethod || body?.payment_method),
    nullableText(body?.sourceType || body?.source_type),
    nullableText(body?.sourceReference || body?.source_reference),
    externalKey,
    nullableText(body?.notes)
  ).run();
  const paymentId = await insertedId(db, result);

  const totalResult = await db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS total_received
    FROM crm_prospect_payments
    WHERE agreement_id = ?
  `).bind(agreementId).all();
  const totalReceivedCents = Number(rowsOf(totalResult)[0]?.total_received || 0);
  const workAuthorized = totalReceivedCents >= agreement.initialPaymentRequiredCents;

  await db.prepare(`
    UPDATE crm_prospect_agreements
    SET initial_payment_received_cents = ?,
        initial_payment_received_at = CASE WHEN ? >= initial_payment_required_cents THEN COALESCE(initial_payment_received_at, ?) ELSE initial_payment_received_at END,
        work_authorized_at = CASE WHEN ? >= initial_payment_required_cents THEN COALESCE(work_authorized_at, ?) ELSE work_authorized_at END,
        status = CASE WHEN ? >= initial_payment_required_cents THEN 'work_authorized' ELSE 'signed' END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    totalReceivedCents,
    totalReceivedCents,
    receivedAt,
    totalReceivedCents,
    receivedAt,
    totalReceivedCents,
    agreementId
  ).run();

  await insertActivity(db, prospectId, {
    activityType: "payment_received",
    occurredAt: receivedAt,
    direction: "inbound",
    subject: "Initial contract payment received",
    summary: `Received ${amountCents} cents toward agreement ${agreementId}; total received is ${totalReceivedCents} cents.`,
    outcome: workAuthorized ? "payment_gate_cleared" : "partial_initial_payment",
    meaningfulContact: false,
    sourceType: body?.sourceType || body?.source_type || "finance",
    sourceReference: body?.sourceReference || body?.source_reference || String(paymentId),
    externalKey: externalKey ? `${externalKey}:activity` : null
  });

  if (workAuthorized) {
    await db.prepare(`
      UPDATE crm_prospects
      SET stage = 'work_authorized',
          status = 'active',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(prospectId).run();

    await replaceOpenNextAction(db, prospectId, {
      actionType: "begin_onboarding",
      title: "Begin service-specific onboarding",
      dueDate: addBusinessDays(dateOnly(receivedAt), 1),
      priority: "High",
      reason: "Signed scope exists and the required initial-payment gate has been cleared. Gather the access, assets, and kickoff requirements appropriate to the contracted service.",
      sourceType: "agreement",
      sourceReference: String(agreementId)
    });
  } else {
    await replaceOpenNextAction(db, prospectId, {
      actionType: "collect_initial_payment",
      title: "Collect remaining required initial payment",
      dueDate: addBusinessDays(dateOnly(receivedAt), 3),
      priority: "High",
      reason: `Received ${totalReceivedCents} cents; ${agreement.initialPaymentRequiredCents} cents is required before work begins.`,
      sourceType: "agreement",
      sourceReference: String(agreementId)
    });
  }

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "record_payment",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    paymentId,
    agreementId,
    amountCents,
    totalReceivedCents,
    initialPaymentRequiredCents: agreement.initialPaymentRequiredCents,
    workAuthorized,
    prospect: await readProspectDetail(db, prospectId),
    writesPerformed: 5
  }, 201);
}

async function readProspectDetail(db, prospectId) {
  const prospect = await readProspectSummary(db, prospectId);
  if (!prospect) return null;

  const [contactsResult, activitiesResult, intelligenceResult, proposalsResult, actionsResult, agreementsResult, paymentsResult] = await Promise.all([
    db.prepare(`SELECT * FROM crm_prospect_contacts WHERE prospect_id = ? ORDER BY is_primary DESC, id ASC`).bind(prospectId).all(),
    db.prepare(`SELECT * FROM crm_prospect_activities WHERE prospect_id = ? ORDER BY datetime(occurred_at) DESC, id DESC`).bind(prospectId).all(),
    db.prepare(`SELECT * FROM crm_prospect_intelligence WHERE prospect_id = ? ORDER BY datetime(captured_at) DESC, id DESC`).bind(prospectId).all(),
    db.prepare(`SELECT * FROM crm_prospect_proposals WHERE prospect_id = ? ORDER BY datetime(sent_at) DESC, id DESC`).bind(prospectId).all(),
    db.prepare(`SELECT * FROM crm_prospect_next_actions WHERE prospect_id = ? ORDER BY CASE LOWER(status) WHEN 'open' THEN 0 ELSE 1 END, date(due_date) ASC, id DESC`).bind(prospectId).all(),
    db.prepare(`SELECT * FROM crm_prospect_agreements WHERE prospect_id = ? ORDER BY datetime(signed_at) DESC, id DESC`).bind(prospectId).all(),
    db.prepare(`SELECT * FROM crm_prospect_payments WHERE prospect_id = ? ORDER BY datetime(received_at) ASC, id ASC`).bind(prospectId).all()
  ]);

  return {
    ...prospect,
    contacts: rowsOf(contactsResult).map(mapContactRow),
    activities: rowsOf(activitiesResult).map(mapActivityRow),
    intelligence: rowsOf(intelligenceResult).map(mapIntelligenceRow),
    proposals: rowsOf(proposalsResult).map(mapProposalRow),
    nextActions: rowsOf(actionsResult).map(mapNextActionRow),
    agreements: rowsOf(agreementsResult).map(mapAgreementRow),
    payments: rowsOf(paymentsResult).map(mapPaymentRow)
  };
}

async function readProspectSummary(db, prospectId) {
  const result = await db.prepare(`
    SELECT
      p.*,
      (
        SELECT a.id FROM crm_prospect_next_actions a
        WHERE a.prospect_id = p.id AND LOWER(COALESCE(a.status, 'open')) = 'open'
        ORDER BY date(a.due_date) ASC, a.id ASC LIMIT 1
      ) AS next_action_id,
      (
        SELECT a.title FROM crm_prospect_next_actions a
        WHERE a.prospect_id = p.id AND LOWER(COALESCE(a.status, 'open')) = 'open'
        ORDER BY date(a.due_date) ASC, a.id ASC LIMIT 1
      ) AS next_action_title,
      (
        SELECT a.action_type FROM crm_prospect_next_actions a
        WHERE a.prospect_id = p.id AND LOWER(COALESCE(a.status, 'open')) = 'open'
        ORDER BY date(a.due_date) ASC, a.id ASC LIMIT 1
      ) AS next_action_type,
      (
        SELECT a.due_date FROM crm_prospect_next_actions a
        WHERE a.prospect_id = p.id AND LOWER(COALESCE(a.status, 'open')) = 'open'
        ORDER BY date(a.due_date) ASC, a.id ASC LIMIT 1
      ) AS open_next_action_due_date,
      (
        SELECT c.name FROM crm_prospect_contacts c
        WHERE c.prospect_id = p.id
        ORDER BY c.is_primary DESC, c.id ASC LIMIT 1
      ) AS primary_contact_name,
      (
        SELECT c.email FROM crm_prospect_contacts c
        WHERE c.prospect_id = p.id
        ORDER BY c.is_primary DESC, c.id ASC LIMIT 1
      ) AS primary_contact_email
    FROM crm_prospects p
    WHERE p.id = ?
    LIMIT 1
  `).bind(prospectId).all();

  const row = rowsOf(result)[0];
  return row ? mapProspectSummaryRow(row) : null;
}

async function readRadarById(db, radarId) {
  const result = await db.prepare(`SELECT * FROM crm_prospect_radar WHERE id = ? LIMIT 1`).bind(radarId).all();
  const row = rowsOf(result)[0];
  return row ? mapRadarRow(row) : null;
}

async function readAgreementById(db, agreementId) {
  const result = await db.prepare(`SELECT * FROM crm_prospect_agreements WHERE id = ? LIMIT 1`).bind(agreementId).all();
  const row = rowsOf(result)[0];
  return row ? mapAgreementRow(row) : null;
}

async function prospectExists(db, prospectId) {
  const result = await db.prepare(`SELECT id FROM crm_prospects WHERE id = ? LIMIT 1`).bind(prospectId).all();
  return Boolean(rowsOf(result)[0]);
}

async function readExistingByExternalKey(db, tableName, externalKey) {
  const allowed = new Set([
    "crm_prospect_activities",
    "crm_prospect_intelligence",
    "crm_prospect_proposals",
    "crm_prospect_agreements",
    "crm_prospect_payments"
  ]);
  if (!allowed.has(tableName)) return null;

  const result = await db.prepare(`SELECT id FROM ${tableName} WHERE external_key = ? LIMIT 1`).bind(externalKey).all();
  return rowsOf(result)[0] || null;
}

async function insertContact(db, prospectId, contact) {
  const isPrimary = contact.isPrimary ? 1 : 0;
  if (isPrimary) {
    await db.prepare(`
      UPDATE crm_prospect_contacts
      SET is_primary = 0, updated_at = CURRENT_TIMESTAMP
      WHERE prospect_id = ?
    `).bind(prospectId).run();
  }

  const result = await db.prepare(`
    INSERT INTO crm_prospect_contacts (
      prospect_id, name, title, email, phone, role, is_primary, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    prospectId,
    cleanText(contact.name),
    nullableText(contact.title),
    nullableText(contact.email),
    nullableText(contact.phone),
    nullableText(contact.role),
    isPrimary,
    nullableText(contact.notes)
  ).run();

  return insertedId(db, result);
}

async function insertActivity(db, prospectId, activity) {
  const result = await db.prepare(`
    INSERT INTO crm_prospect_activities (
      prospect_id,
      activity_type,
      occurred_at,
      direction,
      subject,
      summary,
      outcome,
      meaningful_contact,
      source_type,
      source_reference,
      external_key,
      notes,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    prospectId,
    normalizeKey(activity.activityType) || "activity",
    normalizeDateTime(activity.occurredAt) || new Date().toISOString(),
    nullableText(activity.direction),
    nullableText(activity.subject),
    cleanText(activity.summary) || "Prospect CRM activity",
    nullableText(activity.outcome),
    activity.meaningfulContact ? 1 : 0,
    nullableText(activity.sourceType),
    nullableText(activity.sourceReference),
    nullableText(activity.externalKey),
    nullableText(activity.notes)
  ).run();

  return insertedId(db, result);
}

async function replaceOpenNextAction(db, prospectId, action) {
  await closeOpenNextActions(db, prospectId, "superseded", "Replaced by the current highest-value CRM Next Action.");

  const result = await db.prepare(`
    INSERT INTO crm_prospect_next_actions (
      prospect_id,
      action_type,
      title,
      due_date,
      priority,
      status,
      reason,
      source_type,
      source_reference,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    prospectId,
    normalizeKey(action.actionType) || "follow_up",
    cleanText(action.title),
    normalizeDateOnly(action.dueDate),
    cleanText(action.priority || "Normal") || "Normal",
    nullableText(action.reason),
    nullableText(action.sourceType),
    nullableText(action.sourceReference)
  ).run();

  const nextActionId = await insertedId(db, result);
  await syncProspectNextActionCache(db, prospectId);
  return nextActionId;
}

async function closeOpenNextActions(db, prospectId, status, note) {
  await db.prepare(`
    UPDATE crm_prospect_next_actions
    SET status = ?,
        completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
        completion_note = COALESCE(completion_note, ?),
        updated_at = CURRENT_TIMESTAMP
    WHERE prospect_id = ?
      AND LOWER(COALESCE(status, 'open')) = 'open'
  `).bind(status, status, nullableText(note), prospectId).run();
}

async function syncProspectNextActionCache(db, prospectId) {
  const nextResult = await db.prepare(`
    SELECT due_date
    FROM crm_prospect_next_actions
    WHERE prospect_id = ?
      AND LOWER(COALESCE(status, 'open')) = 'open'
    ORDER BY date(due_date) ASC, id ASC
    LIMIT 1
  `).bind(prospectId).all();
  const dueDate = nullableText(rowsOf(nextResult)[0]?.due_date);

  await db.prepare(`
    UPDATE crm_prospects
    SET next_action_due_date = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(dueDate, prospectId).run();
}

function isProposalCadenceActivity(activityType) {
  return new Set([
    "proposal_sent",
    "proposal_email",
    "value_add_email",
    "follow_up_email",
    "proposal_follow_up_email",
    "phone_call",
    "proposal_phone_call",
    "voicemail",
    "close_loop_email"
  ]).has(normalizeKey(activityType));
}

function isNoResponseOutcome(outcome) {
  return new Set(["no_response", "sent_no_response", "left_voicemail", "sent"]).has(normalizeKey(outcome));
}

function followUpAfterActivity(activityType, occurredAt, outcome) {
  const type = normalizeKey(activityType);
  const normalizedOutcome = normalizeKey(outcome);
  const baseDate = dateOnly(occurredAt);

  if (type === "follow_up_email" || type === "proposal_follow_up_email") {
    return {
      actionType: "proposal_phone_call",
      title: "Call prospect about active proposal",
      dueDate: addBusinessDays(baseDate, 2),
      priority: "High",
      reason: "GCM active-proposal cadence: call 2 business days after an unanswered email follow-up.",
      sourceType: "crm"
    };
  }

  if (["phone_call", "proposal_phone_call", "voicemail"].includes(type)) {
    return {
      actionType: "close_loop_email",
      title: "Send close-the-loop proposal email",
      dueDate: addBusinessDays(baseDate, 3),
      priority: "High",
      reason: "GCM active-proposal cadence: close the loop 3 business days after the unanswered phone attempt.",
      sourceType: "crm"
    };
  }

  if (type === "close_loop_email" && ["no_response", "sent_no_response", "sent"].includes(normalizedOutcome)) {
    return {
      actionType: "nurture_review",
      title: "Review prospect for a value-based nurture touch",
      dueDate: addCalendarDays(baseDate, 30),
      priority: "Normal",
      reason: "Active chase is complete. Reconnect only when there is a useful reason to do so.",
      sourceType: "crm"
    };
  }

  return {
    actionType: "proposal_follow_up_email",
    title: "Follow up on active proposal",
    dueDate: addBusinessDays(baseDate, 3),
    priority: "High",
    reason: "GCM active-proposal rule: follow up 3 business days after the latest meaningful contact.",
    sourceType: "crm"
  };
}

function mapRadarRow(row) {
  return {
    id: Number(row.id),
    entryType: row.entry_type || null,
    businessName: row.business_name || null,
    website: row.website || null,
    vertical: row.vertical || null,
    market: row.market || null,
    sourceType: row.source_type || null,
    sourceDescription: row.source_description || null,
    contactName: row.contact_name || null,
    contactEmail: row.contact_email || null,
    contactPhone: row.contact_phone || null,
    evidenceReference: row.evidence_reference || null,
    notes: row.notes || null,
    status: row.status || "radar",
    promotedProspectId: positiveInteger(row.promoted_prospect_id),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    promotedAt: row.promoted_at || null,
    archivedAt: row.archived_at || null
  };
}

function mapProspectSummaryRow(row) {
  const status = normalizeProspectStatus(row.status || "active");
  const stage = normalizeProspectStage(row.stage || "appointment_scheduled");
  const nextActionDue = row.open_next_action_due_date || row.next_action_due_date || null;
  const nextAction = row.next_action_id
    ? {
        id: Number(row.next_action_id),
        type: row.next_action_type || null,
        title: row.next_action_title || null,
        dueDate: nextActionDue,
        dueState: dueState(nextActionDue)
      }
    : null;
  const requiresManagement = ACTIVE_MANAGED_STATUSES.has(status);
  const isUnmanaged = requiresManagement && !nextAction;

  return {
    id: Number(row.id),
    radarId: positiveInteger(row.radar_id),
    businessName: row.business_name || "Unnamed Prospect",
    legalName: row.legal_name || null,
    website: row.website || null,
    industry: row.industry || null,
    market: row.market || null,
    sourceType: row.source_type || null,
    sourceDescription: row.source_description || null,
    appointmentAt: row.appointment_at || null,
    calendarAppointmentId: positiveInteger(row.calendar_appointment_id),
    appointmentStatus: row.appointment_status || "scheduled",
    stage,
    status,
    opportunitySummary: row.opportunity_summary || null,
    estimatedValueLowCents: nullableNumber(row.estimated_value_low_cents),
    estimatedValueHighCents: nullableNumber(row.estimated_value_high_cents),
    recurringValueCents: nullableNumber(row.recurring_value_cents),
    recurringPeriod: row.recurring_period || null,
    lastMeaningfulContactAt: row.last_meaningful_contact_at || null,
    nextActionDueDate: nextActionDue,
    nextAction,
    managementState: isUnmanaged ? "unmanaged" : requiresManagement ? "managed" : "closed",
    isUnmanaged,
    primaryContact: {
      name: row.primary_contact_name || null,
      email: row.primary_contact_email || null
    },
    convertedClientId: positiveInteger(row.converted_client_id),
    convertedAt: row.converted_at || null,
    lostReason: row.lost_reason || null,
    nurtureReason: row.nurture_reason || null,
    notes: row.notes || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function mapContactRow(row) {
  return {
    id: Number(row.id),
    prospectId: Number(row.prospect_id),
    name: row.name,
    title: row.title || null,
    email: row.email || null,
    phone: row.phone || null,
    role: row.role || null,
    isPrimary: Number(row.is_primary || 0) === 1,
    notes: row.notes || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function mapActivityRow(row) {
  return {
    id: Number(row.id),
    prospectId: Number(row.prospect_id),
    activityType: row.activity_type,
    occurredAt: row.occurred_at,
    direction: row.direction || null,
    subject: row.subject || null,
    summary: row.summary,
    outcome: row.outcome || null,
    meaningfulContact: Number(row.meaningful_contact || 0) === 1,
    sourceType: row.source_type || null,
    sourceReference: row.source_reference || null,
    externalKey: row.external_key || null,
    notes: row.notes || null,
    createdAt: row.created_at || null
  };
}

function mapIntelligenceRow(row) {
  return {
    id: Number(row.id),
    prospectId: Number(row.prospect_id),
    intelligenceType: row.intelligence_type,
    title: row.title,
    summary: row.summary || null,
    intelligence: parseJson(row.intelligence_json),
    sourceType: row.source_type || null,
    sourceReference: row.source_reference || null,
    externalKey: row.external_key || null,
    capturedAt: row.captured_at,
    createdAt: row.created_at || null
  };
}

function mapProposalRow(row) {
  return {
    id: Number(row.id),
    prospectId: Number(row.prospect_id),
    proposalType: row.proposal_type,
    title: row.title,
    sentAt: row.sent_at,
    status: row.status,
    scopeSummary: row.scope_summary || null,
    valueLowCents: nullableNumber(row.value_low_cents),
    valueHighCents: nullableNumber(row.value_high_cents),
    recurringValueCents: nullableNumber(row.recurring_value_cents),
    recurringPeriod: row.recurring_period || null,
    terms: parseJson(row.terms_json),
    sourceType: row.source_type || null,
    sourceReference: row.source_reference || null,
    externalKey: row.external_key || null,
    decisionAt: row.decision_at || null,
    decisionNote: row.decision_note || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function mapNextActionRow(row) {
  return {
    id: Number(row.id),
    prospectId: Number(row.prospect_id),
    actionType: row.action_type,
    title: row.title,
    dueDate: row.due_date,
    dueState: dueState(row.due_date),
    priority: row.priority,
    status: row.status,
    reason: row.reason || null,
    sourceType: row.source_type || null,
    sourceReference: row.source_reference || null,
    completedAt: row.completed_at || null,
    completionNote: row.completion_note || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function mapAgreementRow(row) {
  return {
    id: Number(row.id),
    prospectId: Number(row.prospect_id),
    agreementType: row.agreement_type,
    status: row.status,
    signedAt: row.signed_at,
    scopeSummary: row.scope_summary,
    contractValueCents: Number(row.contract_value_cents),
    initialPaymentRequiredCents: Number(row.initial_payment_required_cents),
    initialPaymentReceivedCents: Number(row.initial_payment_received_cents || 0),
    initialPaymentReceivedAt: row.initial_payment_received_at || null,
    workAuthorizedAt: row.work_authorized_at || null,
    sourceType: row.source_type || null,
    sourceReference: row.source_reference || null,
    externalKey: row.external_key || null,
    notes: row.notes || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function mapPaymentRow(row) {
  return {
    id: Number(row.id),
    prospectId: Number(row.prospect_id),
    agreementId: Number(row.agreement_id),
    amountCents: Number(row.amount_cents),
    receivedAt: row.received_at,
    paymentMethod: row.payment_method || null,
    sourceType: row.source_type || null,
    sourceReference: row.source_reference || null,
    externalKey: row.external_key || null,
    notes: row.notes || null,
    createdAt: row.created_at || null
  };
}

function validationError(requestId, operation, error, status = 400) {
  return jsonResponse({
    ok: false,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation,
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    error
  }, status);
}

async function insertedId(db, result) {
  const metaId = positiveInteger(result?.meta?.last_row_id);
  if (metaId) return metaId;
  const fallback = await db.prepare(`SELECT last_insert_rowid() AS id`).all();
  return positiveInteger(rowsOf(fallback)[0]?.id);
}

export function normalizeProspectStage(value) {
  return normalizeKey(value || "appointment_scheduled") || "appointment_scheduled";
}

export function normalizeProspectStatus(value) {
  return normalizeKey(value || "active") || "active";
}

function stageToStatus(stage) {
  const normalized = normalizeProspectStage(stage);
  if (normalized === "nurture") return "nurture";
  if (normalized === "lost") return "lost";
  if (normalized === "converted") return "converted";
  return "active";
}

export function minimumInitialPaymentCents(contractValueCents) {
  const cents = Number(contractValueCents);
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return Math.ceil(cents * 0.25);
}

export function addBusinessDays(dateValue, count) {
  const date = parseDateOnly(dateValue);
  const days = Number(count);
  if (!date || !Number.isInteger(days) || days < 0) return "";

  let remaining = days;
  let cursor = date;

  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + 86400000);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }

  if (days === 0) {
    while ([0, 6].includes(cursor.getUTCDay())) {
      cursor = new Date(cursor.getTime() + 86400000);
    }
  }

  return formatUtcDate(cursor);
}

function addCalendarDays(dateValue, count) {
  const date = parseDateOnly(dateValue);
  const days = Number(count);
  if (!date || !Number.isFinite(days)) return "";
  return formatUtcDate(new Date(date.getTime() + Math.trunc(days) * 86400000));
}

function parseDateOnly(value) {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date;
}

function formatUtcDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function normalizeDateOnly(value) {
  const text = cleanText(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  return parseDateComponents(normalized) ? normalized : "";
}

function parseDateComponents(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeDateTime(value) {
  const text = cleanText(value);
  if (!text) return "";

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(text)) {
    return normalizeDateOnly(text) ? text : "";
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(text)) {
    return normalizeDateOnly(text) ? text.replace(" ", "T") : "";
  }

  return "";
}

function dateOnly(value) {
  return normalizeDateOnly(value);
}

function dueState(value) {
  const due = normalizeDateOnly(value);
  if (!due) return "unknown";
  const today = currentNewYorkDate();
  if (due < today) return "overdue";
  if (due === today) return "due_today";
  return "upcoming";
}

function currentNewYorkDate() {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function moneyToCents(centsValue, dollarValue) {
  if (centsValue !== undefined && centsValue !== null && centsValue !== "") {
    const cents = Number(centsValue);
    return Number.isFinite(cents) ? Math.round(cents) : null;
  }

  if (dollarValue !== undefined && dollarValue !== null && dollarValue !== "") {
    const dollars = Number(dollarValue);
    return Number.isFinite(dollars) ? Math.round(dollars * 100) : null;
  }

  return null;
}

function moneyToCentsOrExisting(body, centsKey, dollarsKey, existing) {
  if (!bodyHas(body, centsKey, dollarsKey)) return existing;
  return moneyToCents(body?.[centsKey], body?.[dollarsKey]);
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function nullableText(value) {
  const text = cleanText(value);
  return text || null;
}

function normalizeKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function bodyHas(body, ...keys) {
  return keys.some(key => Object.prototype.hasOwnProperty.call(body || {}, key));
}

function parseJson(value) {
  const text = cleanText(value);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
