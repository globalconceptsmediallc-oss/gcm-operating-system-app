/* =========================================================
   Global Concepts Media Operating System
   File: routes/mediaOperations.js
   Version: 7.4.0
   Status: Production Candidate
   Sprint: Media Operations — Phase 1 Retrieval
   Purpose: Read-only retrieval of durable media placement records
            from D1 for the Media Operations workspace.

   Production rules:
   - media_records owns media placement / rotation state.
   - clients owns client identity.
   - communications owns actual sent / received communication.
   - evidence owns proof.
   - work_items owns actionable work.
   - This route does not create, update, or delete records.
   - Optional clientId filtering is supported.
   ========================================================= */

import {
  VERSION,
  ACTIONS
} from "../shared/config.js";

import {
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "../shared/http.js";

import {
  getDatabase,
  rowsOf
} from "../shared/database.js";

/* =========================================================
   Media Operations — Read-Only Retrieval
   ========================================================= */

export async function handleMediaOperations(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      error: "The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."
    }, 503);
  }

  const requestedClientId = normalizeOptionalClientId(body?.clientId);

  if (body?.clientId !== undefined && requestedClientId === null) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      error: "clientId must be a positive integer when provided."
    }, 400);
  }

  try {
    const [clientsResult, mediaResult] = await Promise.all([
      db.prepare(`
        SELECT
          id,
          client_code,
          name,
          status
        FROM clients
        WHERE LOWER(COALESCE(status, 'active')) NOT IN (
          'inactive',
          'archived',
          'deleted'
        )
        ORDER BY
          LOWER(name) ASC,
          id ASC
      `).all(),

      requestedClientId
        ? db.prepare(`
            SELECT
              mr.id,
              mr.client_id,
              c.client_code,
              c.name AS client_name,
              mr.media_type,
              mr.market,
              mr.outlet_name,
              mr.campaign_name,
              mr.creative_name,
              mr.creative_version,
              mr.file_name,
              mr.coop_partner,
              mr.start_date,
              mr.end_date,
              mr.status,
              mr.action_type,
              mr.script_text,
              mr.notes,
              mr.traffic_status,
              mr.confirmation_status,
              mr.attention_status,
              mr.attention_reason,
              mr.created_at,
              mr.updated_at
            FROM media_records mr
            INNER JOIN clients c
              ON c.id = mr.client_id
            WHERE mr.client_id = ?
            ORDER BY
              CASE LOWER(COALESCE(mr.status, ''))
                WHEN 'active' THEN 1
                WHEN 'pending' THEN 2
                WHEN 'planned' THEN 3
                WHEN 'expired' THEN 4
                ELSE 5
              END,
              COALESCE(mr.end_date, '9999-12-31') ASC,
              COALESCE(mr.start_date, '9999-12-31') ASC,
              LOWER(COALESCE(mr.market, '')) ASC,
              LOWER(COALESCE(mr.outlet_name, '')) ASC,
              mr.id ASC
          `).bind(requestedClientId).all()
        : db.prepare(`
            SELECT
              mr.id,
              mr.client_id,
              c.client_code,
              c.name AS client_name,
              mr.media_type,
              mr.market,
              mr.outlet_name,
              mr.campaign_name,
              mr.creative_name,
              mr.creative_version,
              mr.file_name,
              mr.coop_partner,
              mr.start_date,
              mr.end_date,
              mr.status,
              mr.action_type,
              mr.script_text,
              mr.notes,
              mr.traffic_status,
              mr.confirmation_status,
              mr.attention_status,
              mr.attention_reason,
              mr.created_at,
              mr.updated_at
            FROM media_records mr
            INNER JOIN clients c
              ON c.id = mr.client_id
            ORDER BY
              LOWER(c.name) ASC,
              CASE LOWER(COALESCE(mr.status, ''))
                WHEN 'active' THEN 1
                WHEN 'pending' THEN 2
                WHEN 'planned' THEN 3
                WHEN 'expired' THEN 4
                ELSE 5
              END,
              COALESCE(mr.end_date, '9999-12-31') ASC,
              COALESCE(mr.start_date, '9999-12-31') ASC,
              LOWER(COALESCE(mr.market, '')) ASC,
              LOWER(COALESCE(mr.outlet_name, '')) ASC,
              mr.id ASC
          `).all()
    ]);

    const clients = rowsOf(clientsResult).map((client) => ({
      clientId: Number(client.id),
      clientCode: String(client.client_code || ""),
      clientName: String(client.name || client.client_code || "Unknown Client"),
      status: String(client.status || "")
    }));

    const mediaRecords = rowsOf(mediaResult).map(mapMediaRecord);

    const summary = buildSummary(mediaRecords);

    return jsonResponse({
      ok: true,
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      mediaOperations: {
        clientId: requestedClientId,
        clients,
        summary,
        records: mediaRecords
      }
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.GET_MEDIA_OPERATIONS,
      stage: "media_operations_query",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      error: "Media Operations could not load media records.",
      details: safeErrorMessage(error)
    }, 500);
  }
}

/* =========================================================
   Mapping
   ========================================================= */

function mapMediaRecord(row) {
  return {
    id: Number(row.id),
    clientId: Number(row.client_id),
    clientCode: String(row.client_code || ""),
    clientName: String(row.client_name || row.client_code || "Unknown Client"),
    mediaType: nullableString(row.media_type),
    market: nullableString(row.market),
    outletName: nullableString(row.outlet_name),
    campaignName: nullableString(row.campaign_name),
    creativeName: nullableString(row.creative_name),
    creativeVersion: nullableString(row.creative_version),
    fileName: nullableString(row.file_name),
    coopPartner: nullableString(row.coop_partner),
    startDate: nullableString(row.start_date),
    endDate: nullableString(row.end_date),
    status: nullableString(row.status),
    actionType: nullableString(row.action_type),
    scriptText: nullableString(row.script_text),
    notes: nullableString(row.notes),
    trafficStatus: nullableString(row.traffic_status),
    confirmationStatus: nullableString(row.confirmation_status),
    attentionStatus: nullableString(row.attention_status),
    attentionReason: nullableString(row.attention_reason),
    createdAt: nullableString(row.created_at),
    updatedAt: nullableString(row.updated_at)
  };
}

function buildSummary(records) {
  return records.reduce((summary, record) => {
    const status = String(record.status || "").toLowerCase();

    summary.total += 1;

    if (status === "active") {
      summary.active += 1;
    } else if (status === "pending" || status === "planned") {
      summary.upcoming += 1;
    } else if (status === "expired") {
      summary.history += 1;
    } else {
      summary.other += 1;
    }

    if (
      String(record.attentionStatus || "").toLowerCase() === "attention"
    ) {
      summary.flaggedAttention += 1;
    }

    return summary;
  }, {
    total: 0,
    active: 0,
    upcoming: 0,
    history: 0,
    other: 0,
    flaggedAttention: 0
  });
}

/* =========================================================
   Validation Helpers
   ========================================================= */

function normalizeOptionalClientId(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numeric = Number(value);

  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
}

function nullableString(value) {
  return value === undefined || value === null
    ? null
    : String(value);
}
