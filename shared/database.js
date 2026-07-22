/* =========================================================
   Global Concepts Media Operating System
   File: shared/database.js
   Version: 7.0.0
   Source: Production Worker 6.3.7
   Purpose: Shared D1 database binding, result handling,
            and duplicate-safe operational record identifiers.
   ========================================================= */

/**
 * Return the production D1 database binding.
 *
 * Supported binding names are preserved from Worker 6.3.7:
 *   DB
 *   GCM_OS_DB
 *   DATABASE
 *
 * @param {object} env
 * @returns {object|null}
 */
export function getDatabase(env) {
  return env?.DB || env?.GCM_OS_DB || env?.DATABASE || null;
}

/**
 * Return the rows from a Cloudflare D1 result.
 *
 * @param {object|null|undefined} result
 * @returns {Array<object>}
 */
export function rowsOf(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

/**
 * Return the first numeric ID from a Cloudflare D1 result.
 *
 * @param {object|null|undefined} result
 * @returns {number|null}
 */
export function firstResultId(result) {
  const rows = Array.isArray(result?.results) ? result.results : [];
  const id = rows[0]?.id;

  return id === undefined || id === null
    ? null
    : Number(id);
}

/**
 * Create the duplicate-protection external ID used when committing a
 * reviewed operational decision.
 *
 * This preserves the production Worker 6.3.7 fingerprint contract:
 *   client ID
 *   occurred date
 *   source
 *   communication type
 *   title
 *   operational summary
 *
 * @param {object} input
 * @param {number|string} input.clientId
 * @param {string} input.occurredAt
 * @param {object} input.decision
 * @returns {Promise<string>}
 */
export async function createOperationalDecisionExternalId({
  clientId,
  occurredAt,
  decision
}) {
  const fingerprint = JSON.stringify({
    clientId,
    occurredDate: String(occurredAt || "").slice(0, 10),
    source: String(decision?.source || "").toLowerCase(),
    communicationType: String(
      decision?.communicationType || ""
    ).toLowerCase(),
    title: String(decision?.title || "").toLowerCase(),
    operationalSummary: String(
      decision?.operationalSummary || ""
    ).toLowerCase()
  });

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(fingerprint)
  );

  const hash = [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);

  return `gcm-${clientId}-${hash}`;
}
