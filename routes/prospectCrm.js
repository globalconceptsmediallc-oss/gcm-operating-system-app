/* =========================================================
   Global Concepts Media Operating System
   File: routes/prospectCrm.js
   Version: 1.2.0
   Status: Production Road-Test Candidate
   Purpose: Durable Prospecting Radar + CRM operations for GCM.

   Change Notes — 1.2.0:
   - Completes the pre-appointment Radar operating loop.
   - Adds durable Radar intelligence and Radar outreach/contact history.
   - Adds a dated Radar Next Action so pre-appointment follow-up cannot disappear.
   - Adds get_radar, add_radar_activity, and add_radar_intelligence operations.
   - Carries Radar intelligence and outreach history into the formal Prospect
     automatically when a real appointment promotes the Radar record.
   - Preserves every verified CRM 1.1.0 service/startup, proposal, agreement,
     payment, and management rule.

   Change Notes — 1.1.0:
   - Adds a service catalog for proposed and contracted GCM services.
   - Preserves proposed services without treating them as signed responsibility.
   - Confirms contracted services only against a signed agreement.
   - Builds one deduplicated startup package from the agreed services.
   - Tracks startup requirements as Needed → Requested → Received → Verified.
   - Separates client/mutual requirements from GCM internal startup requirements.
   - Advances the highest-value Next Action from payment gate to startup collection
     and then to begin contracted work when the package is verified.
   - Preserves every verified CRM 1.0.0 Radar, appointment, follow-up, proposal,
     agreement, payment, and management rule.

   Change Notes — 1.0.0:
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
export const PROSPECT_CRM_VERSION = "1.2.0";

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

const SERVICE_CATALOG = [
  {
    key: "website_rebuild",
    name: "Website Design / Rebuild",
    category: "Website",
    description: "New website, redesign, migration, or major rebuild work.",
    requirements: [
      requirement("domain_dns_access", "Domain / DNS access", "Please provide access to the domain registrar and DNS currently controlling the website.", "Access", "client"),
      requirement("hosting_access", "Current hosting access", "Please provide access to the current website hosting account or hosting provider.", "Access", "client"),
      requirement("website_admin_access", "Website / CMS admin access", "Please provide administrator access to the current website or content management system.", "Access", "client"),
      requirement("brand_assets", "Logo and brand assets", "Please send the current logo files, brand colors, fonts, and any brand standards you want preserved.", "Assets", "client"),
      requirement("photo_video_assets", "Approved photo and video assets", "Please provide approved photos, video, and other visual assets that can be used on the website.", "Assets", "client"),
      requirement("content_inventory", "Current content and must-keep material", "Please identify existing pages, copy, downloads, forms, or other content that must be preserved in the rebuild.", "Content", "mutual"),
      requirement("priority_services", "Priority services / products", "Please confirm the services or products that should receive the strongest emphasis on the new site.", "Business", "client"),
      requirement("service_areas", "Primary markets and service areas", "Please confirm the cities, counties, regions, or other geographic markets the website should support.", "Business", "client"),
      requirement("form_destinations", "Lead and form destinations", "Please confirm where website calls, forms, quote requests, or other leads should be delivered.", "Operations", "client"),
      requirement("project_staging_plan", "Project workspace and staging plan", "GCM establishes the project workspace, repository/staging plan, and deployment path.", "Internal", "gcm")
    ]
  },
  {
    key: "website_maintenance",
    name: "Website Maintenance",
    category: "Website",
    description: "Ongoing website updates, maintenance, fixes, and improvement work.",
    requirements: [
      requirement("website_admin_access", "Website / CMS admin access", "Please provide administrator access to the website or content management system.", "Access", "client"),
      requirement("hosting_access", "Current hosting access", "Please provide access to the current hosting account when hosting-level work may be required.", "Access", "client"),
      requirement("domain_dns_access", "Domain / DNS access", "Please provide domain and DNS access when DNS, SSL, redirects, or deployment changes may be required.", "Access", "client"),
      requirement("approval_contact", "Primary approval contact", "Please identify who can approve website changes and content decisions.", "Operations", "client"),
      requirement("brand_assets", "Logo and brand assets", "Please provide current approved logos and brand standards for future updates.", "Assets", "client")
    ]
  },
  {
    key: "seo_search_visibility",
    name: "SEO / Search Visibility",
    category: "Search",
    description: "Organic search visibility, technical SEO, content, and competitive search improvement.",
    requirements: [
      requirement("gsc_access", "Google Search Console access", "Please add GCM to the Google Search Console property for the website.", "Access", "client"),
      requirement("ga4_access", "Google Analytics 4 access", "Please add GCM to the Google Analytics 4 property used by the website.", "Access", "client"),
      requirement("website_admin_access", "Website / CMS admin access", "Please provide administrator access so approved SEO changes can be implemented.", "Access", "client"),
      requirement("priority_services", "Priority services / products", "Please identify the services or products that matter most for revenue and growth.", "Business", "client"),
      requirement("service_areas", "Primary markets and service areas", "Please confirm the geographic markets where organic visibility matters most.", "Business", "client"),
      requirement("known_competitors", "Known competitors", "Please identify the competitors you most often encounter or want GCM to watch.", "Business", "client"),
      requirement("existing_seo_reports", "Existing SEO reports / tools", "Please share any current SEO reports, tracking projects, or agency/vendor information that may contain useful history.", "Evidence", "client"),
      requirement("search_baseline", "Initial search baseline", "GCM captures the starting search visibility, technical condition, and competitive baseline before material SEO changes.", "Internal", "gcm")
    ]
  },
  {
    key: "local_seo_gbp",
    name: "Local SEO / Google Business Profile",
    category: "Search",
    description: "Local search visibility, Google Business Profile, listings, and geographic positioning.",
    requirements: [
      requirement("gbp_access", "Google Business Profile access", "Please add GCM as a manager to the applicable Google Business Profile location(s).", "Access", "client"),
      requirement("business_nap", "Verified business name, address, and phone", "Please confirm the official business name, address, phone number, hours, and primary website used for local listings.", "Business", "client"),
      requirement("service_areas", "Primary markets and service areas", "Please confirm the local markets and service areas that matter most.", "Business", "client"),
      requirement("priority_services", "Priority services / products", "Please identify the local services or products that should receive priority.", "Business", "client"),
      requirement("website_admin_access", "Website / CMS admin access", "Please provide administrator access when local landing-page or on-site changes are part of the work.", "Access", "client"),
      requirement("local_baseline", "Local visibility baseline", "GCM records the starting Google Business Profile, listings, review, and local search condition.", "Internal", "gcm")
    ]
  },
  {
    key: "google_ads_paid_search",
    name: "Google Ads / Paid Search",
    category: "Advertising",
    description: "Google Ads account management, paid search, landing pages, and conversion improvement.",
    requirements: [
      requirement("google_ads_access", "Google Ads access", "Please provide access to the Google Ads account or approve the GCM manager-account invitation.", "Access", "client"),
      requirement("ga4_access", "Google Analytics 4 access", "Please add GCM to the GA4 property used for paid-search measurement.", "Access", "client"),
      requirement("gtm_access", "Google Tag Manager access", "Please add GCM to Google Tag Manager if the site uses GTM for advertising or conversion tracking.", "Access", "client"),
      requirement("website_admin_access", "Website / landing-page access", "Please provide access to the website or landing-page system when campaign pages or tracking changes are required.", "Access", "client"),
      requirement("conversion_goals", "Lead and conversion definition", "Please confirm which calls, forms, purchases, appointments, or other actions count as valuable conversions.", "Business", "mutual"),
      requirement("service_areas", "Campaign geography", "Please confirm the geographic areas that paid advertising should target or exclude.", "Business", "client"),
      requirement("ad_budget", "Approved advertising budget", "Please confirm the monthly media budget available for Google Ads, separate from GCM fees.", "Finance", "client"),
      requirement("paid_search_baseline", "Paid-search baseline", "GCM captures existing campaigns, goals, spend, performance, and tracking condition before making material changes.", "Internal", "gcm")
    ]
  },
  {
    key: "social_media",
    name: "Social Media",
    category: "Marketing",
    description: "Organic social content, account management, publishing, and campaign support.",
    requirements: [
      requirement("social_account_access", "Social account access", "Please provide access to the social profiles and business-manager accounts included in the work.", "Access", "client"),
      requirement("brand_assets", "Logo and brand assets", "Please send approved logo files, brand colors, fonts, and visual standards.", "Assets", "client"),
      requirement("photo_video_assets", "Approved photo and video assets", "Please provide the current photo/video library and identify what GCM may publish.", "Assets", "client"),
      requirement("approval_contact", "Primary approval contact", "Please identify who can approve social content and how quickly approvals can normally be returned.", "Operations", "client"),
      requirement("social_goals", "Social priorities and audience", "Please confirm the audiences, offers, services, events, or business goals social media should support.", "Business", "mutual"),
      requirement("social_content_plan", "Initial social content plan", "GCM establishes the first content themes, publishing cadence, and measurement approach.", "Internal", "gcm")
    ]
  },
  {
    key: "media_planning_buying",
    name: "Media Planning / Buying",
    category: "Advertising",
    description: "Traditional/digital media evaluation, planning, buying, trafficking, and vendor coordination.",
    requirements: [
      requirement("current_media_schedule", "Current media schedules / contracts", "Please provide current media schedules, orders, contracts, invoices, or proposals that GCM should evaluate or manage.", "Evidence", "client"),
      requirement("media_contacts", "Current media/vendor contacts", "Please provide the sales representatives, stations, publications, platforms, or vendors currently involved.", "Operations", "client"),
      requirement("media_budget", "Approved media budget", "Please confirm the working media budget and any committed spend already in place.", "Finance", "client"),
      requirement("target_markets", "Target markets and audience", "Please confirm the geographic markets and audiences the media plan should reach.", "Business", "client"),
      requirement("approval_contact", "Primary approval contact", "Please identify who can approve schedules, creative, and material media changes.", "Operations", "client"),
      requirement("historical_media_performance", "Historical media results", "Please share prior performance reports, lead information, call tracking, or other evidence that can improve planning.", "Evidence", "client"),
      requirement("media_baseline", "Current media baseline", "GCM records the active schedule, commitments, deadlines, and available performance evidence before recommending changes.", "Internal", "gcm")
    ]
  },
  {
    key: "analytics_measurement",
    name: "Analytics / GA4 / Measurement",
    category: "Analytics",
    description: "Analytics, tag management, measurement repair, conversion tracking, and reporting foundations.",
    requirements: [
      requirement("ga4_access", "Google Analytics 4 access", "Please add GCM to the Google Analytics 4 property used by the website.", "Access", "client"),
      requirement("gtm_access", "Google Tag Manager access", "Please add GCM to Google Tag Manager if the site uses GTM.", "Access", "client"),
      requirement("gsc_access", "Google Search Console access", "Please add GCM to Search Console when organic-search measurement is part of the analytics picture.", "Access", "client"),
      requirement("website_admin_access", "Website / CMS admin access", "Please provide website access if tags, pixels, code, or ecommerce integrations need to be installed or repaired.", "Access", "client"),
      requirement("conversion_goals", "Lead and conversion definition", "Please confirm which business actions should be measured as leads, sales, appointments, or other conversions.", "Business", "mutual"),
      requirement("measurement_baseline", "Measurement baseline and live validation", "GCM documents the current measurement stack and verifies what is and is not collecting before changes are made.", "Internal", "gcm")
    ]
  },
  {
    key: "email_marketing",
    name: "Email Marketing",
    category: "Marketing",
    description: "Email platform, campaigns, automations, lists, and reporting support.",
    requirements: [
      requirement("email_platform_access", "Email marketing platform access", "Please provide access to the email platform used for campaigns, automations, or customer lists.", "Access", "client"),
      requirement("email_list_source", "Approved email list / audience source", "Please identify the approved customer/prospect lists and how consent or list ownership is maintained.", "Data", "client"),
      requirement("brand_assets", "Logo and brand assets", "Please provide approved brand assets for email design.", "Assets", "client"),
      requirement("approval_contact", "Primary approval contact", "Please identify who approves campaign copy, offers, and send timing.", "Operations", "client"),
      requirement("email_goals", "Email business goals", "Please confirm the products, services, events, offers, or customer actions email should support.", "Business", "mutual"),
      requirement("email_baseline", "Email program baseline", "GCM records current lists, automations, campaigns, deliverability signals, and available performance history.", "Internal", "gcm")
    ]
  },
  {
    key: "creative_graphic_design",
    name: "Creative / Graphic Design",
    category: "Creative",
    description: "Brand, campaign, print, digital, and marketing creative production.",
    requirements: [
      requirement("brand_assets", "Logo and brand assets", "Please send the current logo files, brand colors, fonts, and existing brand standards.", "Assets", "client"),
      requirement("brand_guidelines", "Brand guidelines / examples", "Please provide any formal brand guide plus examples of work you do or do not want GCM to follow.", "Assets", "client"),
      requirement("creative_source_assets", "Source photos, copy, and production assets", "Please provide the approved photos, copy, product information, disclaimers, and other source material needed for the agreed creative.", "Assets", "client"),
      requirement("approval_contact", "Primary approval contact", "Please identify who can approve creative and final production files.", "Operations", "client"),
      requirement("creative_specs", "Deliverables and production specifications", "GCM confirms sizes, formats, placements, deadlines, and vendor specifications before production.", "Internal", "gcm")
    ]
  },
  {
    key: "video_radio_commercial_production",
    name: "Video / Radio / Commercial Production",
    category: "Creative",
    description: "Script, audio, video, commercial production, traffic assets, and co-op support.",
    requirements: [
      requirement("brand_assets", "Logo and brand assets", "Please provide approved logos and brand assets needed for production.", "Assets", "client"),
      requirement("production_direction", "Campaign topic and direction", "Please confirm the offer, topic, business objective, mandatory points, and intended audience for the production.", "Business", "mutual"),
      requirement("existing_audio_video", "Existing audio/video assets", "Please provide any existing voice, music, video, photography, or prior commercial assets that may be reused or referenced.", "Assets", "client"),
      requirement("approval_contact", "Primary approval contact", "Please identify who has final approval authority for scripts and produced spots.", "Operations", "client"),
      requirement("coop_requirements", "Co-op / compliance requirements", "Please provide manufacturer, co-op, legal, disclaimer, ISCI, traffic, or other compliance requirements that apply.", "Compliance", "client"),
      requirement("production_workflow", "Production and delivery workflow", "GCM establishes script approval, talent/recording, production, co-op, traffic, and final-proof checkpoints.", "Internal", "gcm")
    ]
  },
  {
    key: "consulting_agency_of_record",
    name: "Consulting / Agency-of-Record",
    category: "Consulting",
    description: "Ongoing strategic marketing, growth, vendor, and agency operating support.",
    requirements: [
      requirement("business_goals", "Current business goals and priorities", "Please identify the most important business goals GCM should help improve over the next 90 days and year.", "Business", "mutual"),
      requirement("decision_makers", "Decision makers and operating contacts", "Please identify the owners, managers, staff, or partners who make or influence marketing and operational decisions.", "Operations", "client"),
      requirement("marketing_accounts_overview", "Current marketing accounts and vendors", "Please provide a list of current marketing platforms, agencies, vendors, media partners, and key account relationships GCM will need to understand.", "Operations", "client"),
      requirement("known_competitors", "Known competitors", "Please identify the businesses you consider your most meaningful competitors.", "Business", "client"),
      requirement("marketing_budget", "Current marketing investment", "Please provide the current or planned marketing/media budget ranges needed for practical recommendations.", "Finance", "client"),
      requirement("reporting_expectations", "Reporting and communication expectations", "Please confirm the decision cadence, meetings, reporting expectations, and primary communication contacts.", "Operations", "mutual"),
      requirement("agency_baseline", "Agency operating baseline", "GCM establishes the starting business, marketing, measurement, visibility, reputation, media, and competitive picture within the contracted responsibility.", "Internal", "gcm")
    ]
  },
  {
    key: "custom_other",
    name: "Custom / Other",
    category: "Other",
    description: "A specifically defined service that does not fit the standard catalog.",
    requirements: [
      requirement("custom_scope_definition", "Custom scope startup requirements", "GCM and the client confirm the access, assets, information, approvals, and other inputs required by the custom signed scope.", "Scope", "mutual")
    ]
  }
];

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
      case "get_radar":
        return await getRadar(body, db, requestId);
      case "create_radar":
        return await createRadar(body, db, requestId);
      case "add_radar_activity":
        return await addRadarActivity(body, db, requestId);
      case "add_radar_intelligence":
        return await addRadarIntelligence(body, db, requestId);
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
      case "list_service_catalog":
        return listServiceCatalog(requestId);
      case "set_proposed_services":
        return await setProposedServices(body, db, requestId);
      case "confirm_contracted_services":
        return await confirmContractedServices(body, db, requestId);
      case "get_startup_package":
        return await getStartupPackage(body, db, requestId);
      case "update_startup_requirement":
        return await updateStartupRequirement(body, db, requestId);
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
    "get_radar",
    "create_radar",
    "add_radar_activity",
    "add_radar_intelligence",
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
    "record_payment",
    "list_service_catalog",
    "set_proposed_services",
    "confirm_contracted_services",
    "get_startup_package",
    "update_startup_requirement"
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
      last_outreach_at,
      next_action_title,
      next_action_due_date,
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


async function getRadar(body, db, requestId) {
  const radarId = positiveInteger(body?.radarId || body?.radar_id);
  if (!radarId) {
    return validationError(requestId, "get_radar", "get_radar requires a positive radarId.");
  }

  const radar = await readRadarDetail(db, radarId);
  if (!radar) {
    return validationError(requestId, "get_radar", `Radar record ${radarId} was not found.`, 404);
  }

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "get_radar",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    radar,
    writesPerformed: 0
  });
}

async function addRadarActivity(body, db, requestId) {
  const radarId = positiveInteger(body?.radarId || body?.radar_id);
  const activityType = normalizeKey(body?.activityType || body?.activity_type);
  const occurredAt = normalizeDateTime(body?.occurredAt || body?.occurred_at);
  const summary = cleanText(body?.summary);
  const externalKey = nullableText(body?.externalKey || body?.external_key);

  if (!radarId) {
    return validationError(requestId, "add_radar_activity", "add_radar_activity requires a positive radarId.");
  }
  if (!activityType || !occurredAt || !summary) {
    return validationError(requestId, "add_radar_activity", "add_radar_activity requires activityType, occurredAt, and summary.");
  }

  const radar = await readRadarById(db, radarId);
  if (!radar) {
    return validationError(requestId, "add_radar_activity", `Radar record ${radarId} was not found.`, 404);
  }
  if (radar.promotedProspectId) {
    return validationError(requestId, "add_radar_activity", "This Radar record has already been promoted. Record new activity on the formal Prospect instead.");
  }

  if (externalKey) {
    const duplicate = await readExistingRadarByExternalKey(db, "crm_prospect_radar_activities", externalKey);
    if (duplicate) {
      return jsonResponse({
        ok: true,
        requestId,
        action: PROSPECT_CRM_ACTION,
        operation: "add_radar_activity",
        prospectCrmVersion: PROSPECT_CRM_VERSION,
        duplicateProtected: true,
        activityId: duplicate.id,
        radar: await readRadarDetail(db, radarId),
        writesPerformed: 0
      });
    }
  }

  const nextActionTitle = nullableText(body?.nextActionTitle || body?.next_action_title);
  const nextActionDueDate = normalizeDateOnly(body?.nextActionDueDate || body?.next_action_due_date);
  const hasAnyNextAction = Boolean(nextActionTitle || body?.nextActionDueDate || body?.next_action_due_date);

  if (hasAnyNextAction && (!nextActionTitle || !nextActionDueDate)) {
    return validationError(
      requestId,
      "add_radar_activity",
      "A Radar follow-up requires both nextActionTitle and nextActionDueDate."
    );
  }

  const meaningfulContact = Boolean(body?.meaningfulContact ?? body?.meaningful_contact);
  const result = await db.prepare(`
    INSERT INTO crm_prospect_radar_activities (
      radar_id,
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
    radarId,
    activityType,
    occurredAt,
    nullableText(body?.direction),
    nullableText(body?.subject),
    summary,
    nullableText(body?.outcome),
    meaningfulContact ? 1 : 0,
    nullableText(body?.sourceType || body?.source_type || "crm"),
    nullableText(body?.sourceReference || body?.source_reference),
    externalKey,
    nullableText(body?.notes)
  ).run();

  const activityId = await insertedId(db, result);
  const outreachLike = meaningfulContact || [
    "email",
    "outreach_email",
    "phone_call",
    "voicemail",
    "linkedin",
    "text_message",
    "follow_up"
  ].includes(activityType);

  await db.prepare(`
    UPDATE crm_prospect_radar
    SET status = CASE WHEN status = 'promoted' THEN status ELSE 'outreach' END,
        last_outreach_at = CASE WHEN ? = 1 THEN ? ELSE last_outreach_at END,
        next_action_title = CASE WHEN ? IS NOT NULL THEN ? ELSE next_action_title END,
        next_action_due_date = CASE WHEN ? IS NOT NULL THEN ? ELSE next_action_due_date END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    outreachLike ? 1 : 0,
    occurredAt,
    nextActionTitle,
    nextActionTitle,
    nextActionDueDate || null,
    nextActionDueDate || null,
    radarId
  ).run();

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "add_radar_activity",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    activityId,
    radar: await readRadarDetail(db, radarId),
    writesPerformed: 2
  }, 201);
}

async function addRadarIntelligence(body, db, requestId) {
  const radarId = positiveInteger(body?.radarId || body?.radar_id);
  const title = cleanText(body?.title);
  const intelligenceType = normalizeKey(body?.intelligenceType || body?.intelligence_type || "prospect_research");
  const capturedAt = normalizeDateTime(body?.capturedAt || body?.captured_at || new Date().toISOString());
  const externalKey = nullableText(body?.externalKey || body?.external_key);

  if (!radarId || !title || !capturedAt) {
    return validationError(requestId, "add_radar_intelligence", "add_radar_intelligence requires radarId, title, and a valid capturedAt.");
  }

  const radar = await readRadarById(db, radarId);
  if (!radar) {
    return validationError(requestId, "add_radar_intelligence", `Radar record ${radarId} was not found.`, 404);
  }
  if (radar.promotedProspectId) {
    return validationError(requestId, "add_radar_intelligence", "This Radar record has already been promoted. Save new intelligence to the formal Prospect instead.");
  }

  if (externalKey) {
    const duplicate = await readExistingRadarByExternalKey(db, "crm_prospect_radar_intelligence", externalKey);
    if (duplicate) {
      return jsonResponse({
        ok: true,
        requestId,
        action: PROSPECT_CRM_ACTION,
        operation: "add_radar_intelligence",
        prospectCrmVersion: PROSPECT_CRM_VERSION,
        duplicateProtected: true,
        intelligenceId: duplicate.id,
        radar: await readRadarDetail(db, radarId),
        writesPerformed: 0
      });
    }
  }

  const intelligenceJson = body?.intelligence === undefined && body?.intelligenceJson === undefined
    ? null
    : JSON.stringify(body?.intelligence ?? body?.intelligenceJson);

  const result = await db.prepare(`
    INSERT INTO crm_prospect_radar_intelligence (
      radar_id,
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
    radarId,
    intelligenceType,
    title,
    nullableText(body?.summary),
    intelligenceJson,
    nullableText(body?.sourceType || body?.source_type || "prospect_research"),
    nullableText(body?.sourceReference || body?.source_reference),
    externalKey,
    capturedAt
  ).run();

  const intelligenceId = await insertedId(db, result);

  await db.prepare(`
    UPDATE crm_prospect_radar
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(radarId).run();

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "add_radar_intelligence",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    intelligenceId,
    radar: await readRadarDetail(db, radarId),
    writesPerformed: 2
  }, 201);
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
    lastMeaningfulContactAt:
      normalizeDateTime(body?.lastMeaningfulContactAt || body?.last_meaningful_contact_at) ||
      normalizeDateTime(radar.lastOutreachAt)
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

  const radarActivitiesResult = await db.prepare(`
    SELECT *
    FROM crm_prospect_radar_activities
    WHERE radar_id = ?
      AND promoted_prospect_activity_id IS NULL
    ORDER BY datetime(occurred_at) ASC, id ASC
  `).bind(radarId).all();

  let transferredActivities = 0;
  for (const row of rowsOf(radarActivitiesResult)) {
    const prospectActivityId = await insertActivity(db, created.id, {
      activityType: row.activity_type,
      occurredAt: row.occurred_at,
      direction: row.direction,
      subject: row.subject,
      summary: row.summary,
      outcome: row.outcome,
      meaningfulContact: Number(row.meaningful_contact || 0) === 1,
      sourceType: row.source_type || "radar",
      sourceReference: row.source_reference || `radar-activity:${row.id}`,
      externalKey: row.external_key ? `radar:${row.external_key}` : null,
      notes: row.notes
    });
    await db.prepare(`
      UPDATE crm_prospect_radar_activities
      SET promoted_prospect_activity_id = ?
      WHERE id = ?
    `).bind(prospectActivityId, row.id).run();
    transferredActivities += 1;
  }

  const radarIntelligenceResult = await db.prepare(`
    SELECT *
    FROM crm_prospect_radar_intelligence
    WHERE radar_id = ?
      AND promoted_prospect_intelligence_id IS NULL
    ORDER BY datetime(captured_at) ASC, id ASC
  `).bind(radarId).all();

  let transferredIntelligence = 0;
  for (const row of rowsOf(radarIntelligenceResult)) {
    const prospectIntelligenceResult = await db.prepare(`
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
      created.id,
      row.intelligence_type,
      row.title,
      row.summary,
      row.intelligence_json,
      row.source_type || "radar",
      row.source_reference || `radar-intelligence:${row.id}`,
      row.external_key ? `radar:${row.external_key}` : null,
      row.captured_at
    ).run();

    const prospectIntelligenceId = await insertedId(db, prospectIntelligenceResult);
    await db.prepare(`
      UPDATE crm_prospect_radar_intelligence
      SET promoted_prospect_intelligence_id = ?
      WHERE id = ?
    `).bind(prospectIntelligenceId, row.id).run();
    transferredIntelligence += 1;
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
    transferredRadarActivities: transferredActivities,
    transferredRadarIntelligence: transferredIntelligence,
    writesPerformed: 4 + (radar.contactName ? 1 : 0) + (transferredActivities * 2) + (transferredIntelligence * 2)
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

    const startup = await readStartupState(db, prospectId, agreementId);
    const packageReady = startup?.package?.readyToStart === true;
    const hasPackage = Boolean(startup?.package);

    await replaceOpenNextAction(db, prospectId, {
      actionType: packageReady
        ? "begin_contracted_work"
        : hasPackage
          ? "collect_startup_requirements"
          : "confirm_contracted_services",
      title: packageReady
        ? "Begin contracted work"
        : hasPackage
          ? "Collect and verify startup requirements"
          : "Confirm contracted services and build startup package",
      dueDate: addBusinessDays(dateOnly(receivedAt), 1),
      priority: "High",
      reason: packageReady
        ? "Signed scope, required initial payment, and startup requirements are verified. The agreed work is ready to begin."
        : hasPackage
          ? "The payment gate is cleared. Collect and verify the remaining startup requirements generated from the signed services."
          : "The payment gate is cleared, but the signed services have not yet been confirmed into a startup package.",
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


function listServiceCatalog(requestId) {
  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "list_service_catalog",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    services: serviceCatalogForResponse(),
    writesPerformed: 0
  });
}

async function setProposedServices(body, db, requestId) {
  const prospectId = positiveInteger(body?.prospectId || body?.prospect_id);
  if (!prospectId) {
    return validationError(requestId, "set_proposed_services", "set_proposed_services requires a positive prospectId.");
  }
  if (!(await prospectExists(db, prospectId))) {
    return validationError(requestId, "set_proposed_services", `CRM Prospect ${prospectId} was not found.`, 404);
  }

  const serviceKeys = normalizeServiceKeys(body?.serviceKeys || body?.service_keys || body?.services || []);
  const validation = validateServiceKeys(serviceKeys);
  if (!validation.valid) {
    return validationError(requestId, "set_proposed_services", `Unsupported service key(s): ${validation.unknown.join(", ")}.`);
  }

  await db.prepare(`
    UPDATE crm_prospect_services
    SET status = 'not_selected',
        updated_at = CURRENT_TIMESTAMP
    WHERE prospect_id = ?
      AND status = 'proposed'
  `).bind(prospectId).run();

  for (const serviceKey of serviceKeys) {
    const service = serviceByKey(serviceKey);
    await db.prepare(`
      INSERT INTO crm_prospect_services (
        prospect_id,
        service_key,
        service_name,
        status,
        scope_notes,
        selected_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'proposed', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(prospect_id, service_key) DO UPDATE SET
        service_name = excluded.service_name,
        status = CASE
          WHEN crm_prospect_services.status = 'contracted' THEN 'contracted'
          ELSE 'proposed'
        END,
        scope_notes = COALESCE(excluded.scope_notes, crm_prospect_services.scope_notes),
        selected_at = COALESCE(crm_prospect_services.selected_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      prospectId,
      service.key,
      service.name,
      nullableText(body?.scopeNotes?.[serviceKey] || body?.scope_notes?.[serviceKey])
    ).run();
  }

  const serviceNames = serviceKeys.map(key => serviceByKey(key)?.name).filter(Boolean);
  await insertActivity(db, prospectId, {
    activityType: "services_proposed",
    occurredAt: new Date().toISOString(),
    direction: "internal",
    subject: "Proposed services updated",
    summary: serviceNames.length
      ? `Proposed services: ${serviceNames.join(", ")}. These remain proposed until a signed agreement confirms scope.`
      : "Proposed service selections were cleared. No service is treated as contracted responsibility.",
    outcome: "proposal_scope_only",
    meaningfulContact: false,
    sourceType: "crm"
  });

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "set_proposed_services",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    serviceKeys,
    startup: await readStartupState(db, prospectId),
    prospect: await readProspectDetail(db, prospectId),
    writesPerformed: 2 + serviceKeys.length
  });
}

async function confirmContractedServices(body, db, requestId) {
  const prospectId = positiveInteger(body?.prospectId || body?.prospect_id);
  let agreementId = positiveInteger(body?.agreementId || body?.agreement_id);

  if (!prospectId) {
    return validationError(requestId, "confirm_contracted_services", "confirm_contracted_services requires a positive prospectId.");
  }
  if (!(await prospectExists(db, prospectId))) {
    return validationError(requestId, "confirm_contracted_services", `CRM Prospect ${prospectId} was not found.`, 404);
  }

  const serviceKeys = normalizeServiceKeys(body?.serviceKeys || body?.service_keys || body?.services || []);
  if (!serviceKeys.length) {
    return validationError(requestId, "confirm_contracted_services", "At least one signed service must be selected before a startup package can be generated.");
  }

  const validation = validateServiceKeys(serviceKeys);
  if (!validation.valid) {
    return validationError(requestId, "confirm_contracted_services", `Unsupported service key(s): ${validation.unknown.join(", ")}.`);
  }

  if (!agreementId) {
    const latestResult = await db.prepare(`
      SELECT id
      FROM crm_prospect_agreements
      WHERE prospect_id = ?
        AND LOWER(COALESCE(status, 'signed')) IN ('signed', 'work_authorized')
      ORDER BY datetime(signed_at) DESC, id DESC
      LIMIT 1
    `).bind(prospectId).all();
    agreementId = positiveInteger(rowsOf(latestResult)[0]?.id);
  }

  if (!agreementId) {
    return validationError(
      requestId,
      "confirm_contracted_services",
      "Contracted services require a signed agreement with defined scope. Record the agreement before confirming services."
    );
  }

  const agreement = await readAgreementById(db, agreementId);
  if (!agreement || agreement.prospectId !== prospectId) {
    return validationError(requestId, "confirm_contracted_services", `Agreement ${agreementId} does not belong to CRM Prospect ${prospectId}.`, 404);
  }

  await db.prepare(`
    UPDATE crm_prospect_services
    SET status = 'not_contracted',
        agreement_id = NULL,
        contracted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE prospect_id = ?
      AND status IN ('proposed', 'contracted')
  `).bind(prospectId).run();

  for (const serviceKey of serviceKeys) {
    const service = serviceByKey(serviceKey);
    await db.prepare(`
      INSERT INTO crm_prospect_services (
        prospect_id,
        agreement_id,
        service_key,
        service_name,
        status,
        scope_notes,
        selected_at,
        contracted_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, 'contracted', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(prospect_id, service_key) DO UPDATE SET
        agreement_id = excluded.agreement_id,
        service_name = excluded.service_name,
        status = 'contracted',
        scope_notes = COALESCE(excluded.scope_notes, crm_prospect_services.scope_notes),
        selected_at = COALESCE(crm_prospect_services.selected_at, CURRENT_TIMESTAMP),
        contracted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      prospectId,
      agreementId,
      service.key,
      service.name,
      nullableText(body?.scopeNotes?.[serviceKey] || body?.scope_notes?.[serviceKey])
    ).run();
  }

  await db.prepare(`
    INSERT INTO crm_prospect_startup_packages (
      prospect_id,
      agreement_id,
      status,
      generated_at,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, 'active', CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(prospect_id, agreement_id) DO UPDATE SET
      status = CASE
        WHEN crm_prospect_startup_packages.status = 'complete' THEN 'complete'
        ELSE 'active'
      END,
      notes = COALESCE(excluded.notes, crm_prospect_startup_packages.notes),
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    prospectId,
    agreementId,
    nullableText(body?.packageNotes || body?.package_notes)
  ).run();

  const packageRow = await readStartupPackageRow(db, prospectId, agreementId);
  const packageId = positiveInteger(packageRow?.id);
  if (!packageId) {
    throw new Error("Startup package could not be created for the signed agreement.");
  }

  const priorRequirementsResult = await db.prepare(`
    SELECT requirement_key, status
    FROM crm_prospect_startup_requirements
    WHERE package_id = ?
  `).bind(packageId).all();
  const priorRequirementStatus = new Map(
    rowsOf(priorRequirementsResult).map(row => [row.requirement_key, row.status])
  );

  await db.prepare(`
    UPDATE crm_prospect_startup_requirements
    SET status = 'not_required',
        updated_at = CURRENT_TIMESTAMP
    WHERE package_id = ?
  `).bind(packageId).run();

  const requirements = buildStartupRequirements(
    serviceKeys,
    Array.isArray(body?.customRequirements || body?.custom_requirements)
      ? (body?.customRequirements || body?.custom_requirements)
      : []
  );

  for (const item of requirements) {
    const priorStatus = priorRequirementStatus.get(item.key);
    const restoredStatus = ["requested", "received", "verified"].includes(priorStatus)
      ? priorStatus
      : "needed";

    await db.prepare(`
      INSERT INTO crm_prospect_startup_requirements (
        package_id,
        prospect_id,
        agreement_id,
        requirement_key,
        title,
        client_request,
        category,
        responsible_party,
        status,
        source_services_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(package_id, requirement_key) DO UPDATE SET
        title = excluded.title,
        client_request = excluded.client_request,
        category = excluded.category,
        responsible_party = excluded.responsible_party,
        source_services_json = excluded.source_services_json,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      packageId,
      prospectId,
      agreementId,
      item.key,
      item.title,
      item.clientRequest,
      item.category,
      item.responsibleParty,
      restoredStatus,
      JSON.stringify(item.sourceServices)
    ).run();
  }

  await refreshStartupPackageStatus(db, packageId);

  const serviceNames = serviceKeys.map(key => serviceByKey(key)?.name).filter(Boolean);
  await insertActivity(db, prospectId, {
    activityType: "contracted_services_confirmed",
    occurredAt: new Date().toISOString(),
    direction: "internal",
    subject: "Signed services confirmed and startup package generated",
    summary: `Contracted services confirmed from agreement ${agreementId}: ${serviceNames.join(", ")}. One deduplicated startup package was generated from the signed scope.`,
    outcome: "startup_package_generated",
    meaningfulContact: false,
    sourceType: "agreement",
    sourceReference: String(agreementId)
  });

  const startup = await readStartupState(db, prospectId, agreementId);
  if (agreement.workAuthorizedAt) {
    await setStartupNextAction(db, prospectId, agreementId, startup?.package, new Date().toISOString());
  }

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "confirm_contracted_services",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    agreementId,
    contractedServiceKeys: serviceKeys,
    startup: await readStartupState(db, prospectId, agreementId),
    prospect: await readProspectDetail(db, prospectId),
    writesPerformed: 5 + serviceKeys.length + requirements.length
  }, 201);
}

async function getStartupPackage(body, db, requestId) {
  const prospectId = positiveInteger(body?.prospectId || body?.prospect_id);
  const agreementId = positiveInteger(body?.agreementId || body?.agreement_id);

  if (!prospectId) {
    return validationError(requestId, "get_startup_package", "get_startup_package requires a positive prospectId.");
  }
  if (!(await prospectExists(db, prospectId))) {
    return validationError(requestId, "get_startup_package", `CRM Prospect ${prospectId} was not found.`, 404);
  }

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "get_startup_package",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    startup: await readStartupState(db, prospectId, agreementId),
    writesPerformed: 0
  });
}

async function updateStartupRequirement(body, db, requestId) {
  const requirementId = positiveInteger(body?.requirementId || body?.requirement_id);
  const status = normalizeKey(body?.status);
  const allowed = new Set(["needed", "requested", "received", "verified", "not_required"]);

  if (!requirementId || !allowed.has(status)) {
    return validationError(
      requestId,
      "update_startup_requirement",
      "update_startup_requirement requires a positive requirementId and status of needed, requested, received, verified, or not_required."
    );
  }

  const result = await db.prepare(`
    SELECT id, package_id, prospect_id, agreement_id
    FROM crm_prospect_startup_requirements
    WHERE id = ?
    LIMIT 1
  `).bind(requirementId).all();
  const row = rowsOf(result)[0];
  if (!row) {
    return validationError(requestId, "update_startup_requirement", `Startup requirement ${requirementId} was not found.`, 404);
  }

  const now = normalizeDateTime(body?.occurredAt || body?.occurred_at || new Date().toISOString()) || new Date().toISOString();

  await db.prepare(`
    UPDATE crm_prospect_startup_requirements
    SET status = ?,
        requested_at = CASE WHEN ? = 'requested' THEN COALESCE(requested_at, ?) ELSE requested_at END,
        received_at = CASE WHEN ? = 'received' THEN COALESCE(received_at, ?) ELSE received_at END,
        verified_at = CASE WHEN ? = 'verified' THEN COALESCE(verified_at, ?) ELSE verified_at END,
        notes = CASE WHEN ? IS NOT NULL THEN ? ELSE notes END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    status,
    status,
    now,
    status,
    now,
    status,
    now,
    nullableText(body?.notes),
    nullableText(body?.notes),
    requirementId
  ).run();

  const packageId = positiveInteger(row.package_id);
  const prospectId = positiveInteger(row.prospect_id);
  const agreementId = positiveInteger(row.agreement_id);
  await refreshStartupPackageStatus(db, packageId);

  const agreement = agreementId ? await readAgreementById(db, agreementId) : null;
  const startup = await readStartupState(db, prospectId, agreementId);
  if (agreement?.workAuthorizedAt) {
    await setStartupNextAction(db, prospectId, agreementId, startup?.package, now);
  }

  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CRM_ACTION,
    operation: "update_startup_requirement",
    prospectCrmVersion: PROSPECT_CRM_VERSION,
    requirementId,
    status,
    startup: await readStartupState(db, prospectId, agreementId),
    prospect: await readProspectDetail(db, prospectId),
    writesPerformed: agreement?.workAuthorizedAt ? 4 : 2
  });
}

async function readStartupState(db, prospectId, agreementId = null) {
  const servicesResult = await db.prepare(`
    SELECT *
    FROM crm_prospect_services
    WHERE prospect_id = ?
      AND status IN ('proposed', 'contracted')
    ORDER BY
      CASE status WHEN 'contracted' THEN 0 WHEN 'proposed' THEN 1 ELSE 2 END,
      service_name ASC,
      id ASC
  `).bind(prospectId).all();

  const packageRow = agreementId
    ? await readStartupPackageRow(db, prospectId, agreementId)
    : await readLatestStartupPackageRow(db, prospectId);

  if (!packageRow) {
    return {
      services: rowsOf(servicesResult).map(mapServiceSelectionRow),
      package: null
    };
  }

  const requirementsResult = await db.prepare(`
    SELECT *
    FROM crm_prospect_startup_requirements
    WHERE package_id = ?
    ORDER BY
      CASE responsible_party WHEN 'client' THEN 0 WHEN 'mutual' THEN 1 ELSE 2 END,
      category ASC,
      title ASC,
      id ASC
  `).bind(packageRow.id).all();

  const requirements = rowsOf(requirementsResult).map(mapStartupRequirementRow);
  const active = requirements.filter(item => item.status !== "not_required");
  const counts = active.reduce((acc, item) => {
    acc.total += 1;
    acc[item.status] = (acc[item.status] || 0) + 1;
    if (["client", "mutual"].includes(item.responsibleParty) && item.status !== "verified") acc.clientOutstanding += 1;
    if (item.responsibleParty === "gcm" && item.status !== "verified") acc.gcmOutstanding += 1;
    return acc;
  }, { total: 0, needed: 0, requested: 0, received: 0, verified: 0, clientOutstanding: 0, gcmOutstanding: 0 });

  const readyToStart = counts.total > 0 && counts.verified === counts.total;
  const clientRequestItems = active.filter(item => ["client", "mutual"].includes(item.responsibleParty));
  const internalItems = active.filter(item => item.responsibleParty === "gcm");

  return {
    services: rowsOf(servicesResult).map(mapServiceSelectionRow),
    package: {
      ...mapStartupPackageRow(packageRow),
      counts,
      readyToStart,
      requirements,
      clientRequestItems,
      internalItems
    }
  };
}

async function readStartupPackageRow(db, prospectId, agreementId) {
  const result = await db.prepare(`
    SELECT *
    FROM crm_prospect_startup_packages
    WHERE prospect_id = ?
      AND agreement_id = ?
    LIMIT 1
  `).bind(prospectId, agreementId).all();
  return rowsOf(result)[0] || null;
}

async function readLatestStartupPackageRow(db, prospectId) {
  const result = await db.prepare(`
    SELECT *
    FROM crm_prospect_startup_packages
    WHERE prospect_id = ?
    ORDER BY datetime(generated_at) DESC, id DESC
    LIMIT 1
  `).bind(prospectId).all();
  return rowsOf(result)[0] || null;
}

async function refreshStartupPackageStatus(db, packageId) {
  const countsResult = await db.prepare(`
    SELECT
      SUM(CASE WHEN status != 'not_required' THEN 1 ELSE 0 END) AS total_active,
      SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) AS verified_count
    FROM crm_prospect_startup_requirements
    WHERE package_id = ?
  `).bind(packageId).all();
  const counts = rowsOf(countsResult)[0] || {};
  const total = Number(counts.total_active || 0);
  const verified = Number(counts.verified_count || 0);
  const ready = total > 0 && total === verified;

  await db.prepare(`
    UPDATE crm_prospect_startup_packages
    SET status = CASE WHEN ? = 1 THEN 'ready' ELSE 'active' END,
        completed_at = CASE WHEN ? = 1 THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(ready ? 1 : 0, ready ? 1 : 0, packageId).run();
}

async function setStartupNextAction(db, prospectId, agreementId, startupPackage, atValue) {
  const baseDate = dateOnly(atValue) || currentNewYorkDate();
  const ready = startupPackage?.readyToStart === true;

  await replaceOpenNextAction(db, prospectId, {
    actionType: ready ? "begin_contracted_work" : "collect_startup_requirements",
    title: ready ? "Begin contracted work" : "Collect and verify startup requirements",
    dueDate: addBusinessDays(baseDate, 1),
    priority: "High",
    reason: ready
      ? "Signed scope, required initial payment, and startup requirements are verified. The agreed work is ready to begin."
      : "The payment gate is cleared. Complete the service-specific startup package before beginning the agreed work.",
    sourceType: "agreement",
    sourceReference: String(agreementId)
  });
}

function normalizeServiceKeys(value) {
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.map(item => {
    if (item && typeof item === "object") return normalizeKey(item.key || item.serviceKey || item.service_key);
    return normalizeKey(item);
  }).filter(Boolean))];
}

function validateServiceKeys(serviceKeys) {
  const known = new Set(SERVICE_CATALOG.map(service => service.key));
  const unknown = serviceKeys.filter(key => !known.has(key));
  return { valid: unknown.length === 0, unknown };
}

function serviceByKey(serviceKey) {
  return SERVICE_CATALOG.find(service => service.key === serviceKey) || null;
}

function requirement(key, title, clientRequest, category, responsibleParty) {
  return { key, title, clientRequest, category, responsibleParty };
}

export function serviceCatalogForResponse() {
  return SERVICE_CATALOG.map(service => ({
    key: service.key,
    name: service.name,
    category: service.category,
    description: service.description
  }));
}

export function buildStartupRequirements(serviceKeys, customRequirements = []) {
  const keys = normalizeServiceKeys(serviceKeys);
  const validation = validateServiceKeys(keys);
  if (!validation.valid) return [];

  const byRequirement = new Map();
  for (const serviceKey of keys) {
    const service = serviceByKey(serviceKey);
    for (const item of service?.requirements || []) {
      if (!byRequirement.has(item.key)) {
        byRequirement.set(item.key, {
          ...item,
          sourceServices: [serviceKey]
        });
      } else {
        const existing = byRequirement.get(item.key);
        if (!existing.sourceServices.includes(serviceKey)) existing.sourceServices.push(serviceKey);
      }
    }
  }

  for (let index = 0; index < customRequirements.length; index += 1) {
    const raw = customRequirements[index];
    const title = cleanText(typeof raw === "string" ? raw : raw?.title || raw?.label);
    if (!title) continue;
    const key = normalizeKey(typeof raw === "object" ? raw?.key : "") || `custom_requirement_${index + 1}`;
    const responsibleParty = normalizeKey(typeof raw === "object" ? raw?.responsibleParty || raw?.responsible_party : "mutual") || "mutual";
    byRequirement.set(key, {
      key,
      title,
      clientRequest: cleanText(typeof raw === "object" ? raw?.clientRequest || raw?.client_request : title) || title,
      category: cleanText(typeof raw === "object" ? raw?.category : "Custom") || "Custom",
      responsibleParty: ["client", "gcm", "mutual"].includes(responsibleParty) ? responsibleParty : "mutual",
      sourceServices: ["custom_other"]
    });
  }

  return [...byRequirement.values()].sort((a, b) => {
    const partyRank = { client: 0, mutual: 1, gcm: 2 };
    const partyDifference = (partyRank[a.responsibleParty] ?? 9) - (partyRank[b.responsibleParty] ?? 9);
    if (partyDifference !== 0) return partyDifference;
    const categoryDifference = a.category.localeCompare(b.category);
    if (categoryDifference !== 0) return categoryDifference;
    return a.title.localeCompare(b.title);
  });
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

  const startup = await readStartupState(db, prospectId);

  return {
    ...prospect,
    contacts: rowsOf(contactsResult).map(mapContactRow),
    activities: rowsOf(activitiesResult).map(mapActivityRow),
    intelligence: rowsOf(intelligenceResult).map(mapIntelligenceRow),
    proposals: rowsOf(proposalsResult).map(mapProposalRow),
    nextActions: rowsOf(actionsResult).map(mapNextActionRow),
    agreements: rowsOf(agreementsResult).map(mapAgreementRow),
    payments: rowsOf(paymentsResult).map(mapPaymentRow),
    services: startup.services,
    startupPackage: startup.package
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


async function readRadarDetail(db, radarId) {
  const radar = await readRadarById(db, radarId);
  if (!radar) return null;

  const [activitiesResult, intelligenceResult] = await Promise.all([
    db.prepare(`
      SELECT *
      FROM crm_prospect_radar_activities
      WHERE radar_id = ?
      ORDER BY datetime(occurred_at) DESC, id DESC
    `).bind(radarId).all(),
    db.prepare(`
      SELECT *
      FROM crm_prospect_radar_intelligence
      WHERE radar_id = ?
      ORDER BY datetime(captured_at) DESC, id DESC
    `).bind(radarId).all()
  ]);

  return {
    ...radar,
    activities: rowsOf(activitiesResult).map(mapRadarActivityRow),
    intelligence: rowsOf(intelligenceResult).map(mapRadarIntelligenceRow)
  };
}

async function readExistingRadarByExternalKey(db, tableName, externalKey) {
  const allowed = new Set([
    "crm_prospect_radar_activities",
    "crm_prospect_radar_intelligence"
  ]);
  if (!allowed.has(tableName)) return null;

  const result = await db.prepare(`SELECT id FROM ${tableName} WHERE external_key = ? LIMIT 1`).bind(externalKey).all();
  return rowsOf(result)[0] || null;
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
  const status = row.status || "radar";
  const nextActionDueDate = row.next_action_due_date || null;
  const managementState = radarManagementState(status, nextActionDueDate);

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
    status,
    lastOutreachAt: row.last_outreach_at || null,
    nextAction: nextActionDueDate || row.next_action_title
      ? {
          title: row.next_action_title || null,
          dueDate: nextActionDueDate,
          dueState: dueState(nextActionDueDate)
        }
      : null,
    managementState,
    isUnmanaged: managementState === "unmanaged",
    promotedProspectId: positiveInteger(row.promoted_prospect_id),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    promotedAt: row.promoted_at || null,
    archivedAt: row.archived_at || null
  };
}

function mapRadarActivityRow(row) {
  return {
    id: Number(row.id),
    radarId: Number(row.radar_id),
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
    promotedProspectActivityId: positiveInteger(row.promoted_prospect_activity_id),
    createdAt: row.created_at || null
  };
}

function mapRadarIntelligenceRow(row) {
  return {
    id: Number(row.id),
    radarId: Number(row.radar_id),
    intelligenceType: row.intelligence_type,
    title: row.title,
    summary: row.summary || null,
    intelligence: parseJson(row.intelligence_json),
    sourceType: row.source_type || null,
    sourceReference: row.source_reference || null,
    externalKey: row.external_key || null,
    capturedAt: row.captured_at,
    promotedProspectIntelligenceId: positiveInteger(row.promoted_prospect_intelligence_id),
    createdAt: row.created_at || null
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


function mapServiceSelectionRow(row) {
  return {
    id: Number(row.id),
    prospectId: Number(row.prospect_id),
    agreementId: positiveInteger(row.agreement_id),
    serviceKey: row.service_key,
    serviceName: row.service_name,
    status: row.status,
    scopeNotes: row.scope_notes || null,
    selectedAt: row.selected_at || null,
    contractedAt: row.contracted_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function mapStartupPackageRow(row) {
  return {
    id: Number(row.id),
    prospectId: Number(row.prospect_id),
    agreementId: Number(row.agreement_id),
    status: row.status,
    generatedAt: row.generated_at,
    completedAt: row.completed_at || null,
    notes: row.notes || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function mapStartupRequirementRow(row) {
  return {
    id: Number(row.id),
    packageId: Number(row.package_id),
    prospectId: Number(row.prospect_id),
    agreementId: Number(row.agreement_id),
    requirementKey: row.requirement_key,
    title: row.title,
    clientRequest: row.client_request || null,
    category: row.category || null,
    responsibleParty: row.responsible_party || "client",
    status: row.status || "needed",
    sourceServices: parseJson(row.source_services_json) || [],
    requestedAt: row.requested_at || null,
    receivedAt: row.received_at || null,
    verifiedAt: row.verified_at || null,
    notes: row.notes || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
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


export function radarManagementState(statusValue, nextActionDueDate) {
  const status = normalizeKey(statusValue || "radar") || "radar";
  if (status === "promoted") return "closed";
  if (status !== "outreach") return "radar";
  return normalizeDateOnly(nextActionDueDate) ? "managed" : "unmanaged";
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

/* END OF FILE — routes/prospectCrm.js v1.2.0 — 3548-line full install */
