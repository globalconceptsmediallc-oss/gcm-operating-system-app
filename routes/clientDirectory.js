/* =========================================================
   Global Concepts Media Operating System
   File: routes/clientDirectory.js
   Version: 7.5.0
   Status: Production Candidate
   Source: Production Worker 7.4.0
   Sprint: Shared GCM OS Application Shell — Client Directory
   Purpose: Read-only retrieval of the GCM OS client directory
            from the existing D1 clients table.

   IMPORTANT:
   - This route does not create or modify client records.
   - This route does not load full Client Workspace history.
   - D1 remains the source of truth.
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
   Client Directory — D1 Read-Only Retrieval
   ========================================================= */

export async function handleClientDirectory(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_CLIENT_DIRECTORY,
      error:
        "The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."
    }, 503);
  }

  try {
    const clientsResult = await db.prepare(`
      SELECT
        id,
        client_code,
        name,
        legal_name,
        status,
        website,
        industry,
        primary_contact_name,
        primary_contact_email,
        notes,
        created_at,
        updated_at
      FROM clients
      ORDER BY
        CASE LOWER(COALESCE(status, ''))
          WHEN 'active' THEN 0
          WHEN 'prospect' THEN 1
          WHEN 'inactive' THEN 2
          WHEN 'historical' THEN 3
          ELSE 4
        END,
        LOWER(name),
        id
    `).all();

    const clients = rowsOf(clientsResult).map(mapClientDirectoryRecord);

    const statusCounts = clients.reduce((counts, client) => {
      const key = normalizeStatus(client.status) || "unknown";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});

    return jsonResponse({
      ok: true,
      requestId,
      action: ACTIONS.GET_CLIENT_DIRECTORY,
      version: VERSION,
      source: "D1",
      generatedAt: new Date().toISOString(),
      counts: {
        total: clients.length,
        active: statusCounts.active || 0,
        inactive: statusCounts.inactive || 0,
        historical: statusCounts.historical || 0,
        prospect: statusCounts.prospect || 0,
        unknown: statusCounts.unknown || 0
      },
      statusCounts,
      clients
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.GET_CLIENT_DIRECTORY,
      stage: "d1_client_directory",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_CLIENT_DIRECTORY,
      error: safeErrorMessage(error)
    }, 500);
  }
}

/* =========================================================
   Directory Record Mapping
   ========================================================= */

function mapClientDirectoryRecord(client) {
  return {
    id: Number(client.id),
    clientCode: client.client_code || null,
    name: client.name || "Unnamed Client",
    legalName: client.legal_name || null,
    status: normalizeStatus(client.status) || "unknown",
    statusLabel: titleCase(client.status || "Unknown"),
    website: client.website || null,
    industry: client.industry || null,
    primaryContact: {
      name: client.primary_contact_name || null,
      email: client.primary_contact_email || null
    },
    notes: client.notes || null,
    createdAt: client.created_at || null,
    updatedAt: client.updated_at || null
  };
}

/* =========================================================
   Route-Specific Helpers
   ========================================================= */

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}
