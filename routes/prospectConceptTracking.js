/* =========================================================
   Global Concepts Media Operating System
   File: routes/prospectConceptTracking.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Purpose: Record privacy-minimized engagement when a personalized
            GCM prospect concept page is viewed.

   Change Notes — 1.0.0:
   - Adds an allowlisted concept-key route for personalized prospect pages.
   - Resolves each concept to one exact Radar relationship server-side.
   - Records a durable inbound concept_page_view activity without storing
     visitor IP address, user agent, email address, or other visitor PII.
   - Carries future views into the formal Prospect relationship after Radar
     promotion without changing outreach dates or Next Action cadence.
   ========================================================= */

import { getDatabase, rowsOf } from "../shared/database.js";
import {
  jsonResponse,
  logWorkerError,
  safeErrorMessage
} from "../shared/http.js";

export const PROSPECT_CONCEPT_VIEW_ACTION = "prospect-concept-view";
export const PROSPECT_CONCEPT_TRACKING_VERSION = "1.0.0";

const CONCEPTS = new Map([
  ["john-curri-v1", {
    businessName: "Realty World Curri Properties",
    sourceReference: "/prospect-previews/john-curri/",
    subject: "Prospect concept page viewed",
    summary: "The personalized John Curri / Realty World Curri Properties prospect concept page was viewed."
  }]
]);

export async function handleProspectConceptView(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: PROSPECT_CONCEPT_VIEW_ACTION,
      trackingVersion: PROSPECT_CONCEPT_TRACKING_VERSION,
      error: "The production D1 database binding is unavailable."
    }, 503);
  }

  const conceptKey = cleanKey(body?.conceptKey || body?.concept_key);
  const concept = CONCEPTS.get(conceptKey);

  if (!concept) {
    return jsonResponse({
      ok: false,
      requestId,
      action: PROSPECT_CONCEPT_VIEW_ACTION,
      trackingVersion: PROSPECT_CONCEPT_TRACKING_VERSION,
      error: "Unknown prospect concept key."
    }, 404);
  }

  const viewedAt = normalizeViewTime(body?.viewedAt || body?.viewed_at);

  try {
    const matchResult = await db.prepare(`
      SELECT id, business_name, promoted_prospect_id
      FROM crm_prospect_radar
      WHERE archived_at IS NULL
        AND LOWER(TRIM(COALESCE(business_name, ''))) = LOWER(TRIM(?))
      ORDER BY id DESC
      LIMIT 2
    `).bind(concept.businessName).all();

    const matches = rowsOf(matchResult);

    if (matches.length === 0) {
      return jsonResponse({
        ok: false,
        requestId,
        action: PROSPECT_CONCEPT_VIEW_ACTION,
        trackingVersion: PROSPECT_CONCEPT_TRACKING_VERSION,
        error: "The prospect relationship for this concept was not found."
      }, 404);
    }

    if (matches.length > 1) {
      return jsonResponse({
        ok: false,
        requestId,
        action: PROSPECT_CONCEPT_VIEW_ACTION,
        trackingVersion: PROSPECT_CONCEPT_TRACKING_VERSION,
        error: "Prospect concept attribution is ambiguous; no engagement was recorded."
      }, 409);
    }

    const radarId = positiveInteger(matches[0]?.id);
    const promotedProspectId = positiveInteger(matches[0]?.promoted_prospect_id);

    if (promotedProspectId) {
      await db.prepare(`
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
        ) VALUES (?, 'concept_page_view', ?, 'inbound', ?, ?, 'viewed', 0,
                  'prospect_concept_page', ?, NULL, NULL, CURRENT_TIMESTAMP)
      `).bind(
        promotedProspectId,
        viewedAt,
        concept.subject,
        concept.summary,
        concept.sourceReference
      ).run();

      await db.prepare(`
        UPDATE crm_prospects
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(promotedProspectId).run();

      return successResponse({
        requestId,
        conceptKey,
        viewedAt,
        target: "prospect"
      });
    }

    await db.prepare(`
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
      ) VALUES (?, 'concept_page_view', ?, 'inbound', ?, ?, 'viewed', 0,
                'prospect_concept_page', ?, NULL, NULL, CURRENT_TIMESTAMP)
    `).bind(
      radarId,
      viewedAt,
      concept.subject,
      concept.summary,
      concept.sourceReference
    ).run();

    await db.prepare(`
      UPDATE crm_prospect_radar
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(radarId).run();

    return successResponse({
      requestId,
      conceptKey,
      viewedAt,
      target: "radar"
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: PROSPECT_CONCEPT_VIEW_ACTION,
      stage: "record_concept_view",
      error,
      extra: { conceptKey }
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: PROSPECT_CONCEPT_VIEW_ACTION,
      trackingVersion: PROSPECT_CONCEPT_TRACKING_VERSION,
      error: "Prospect concept engagement could not be recorded.",
      details: safeErrorMessage(error)
    }, 500);
  }
}

function successResponse({ requestId, conceptKey, viewedAt, target }) {
  return jsonResponse({
    ok: true,
    requestId,
    action: PROSPECT_CONCEPT_VIEW_ACTION,
    trackingVersion: PROSPECT_CONCEPT_TRACKING_VERSION,
    conceptKey,
    recorded: true,
    target,
    viewedAt,
    writesPerformed: 2
  }, 201);
}

function cleanKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeViewTime(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
