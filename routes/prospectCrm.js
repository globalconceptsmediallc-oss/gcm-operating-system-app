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
