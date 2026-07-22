/* =========================================================
   Global Concepts Media Operating System
   File: shared/http.js
   Version: 7.0.0
   Source: Production Worker 6.3.7
   Purpose: Shared HTTP responses, text normalization,
            safe error handling, and Worker diagnostics.
   ========================================================= */

import { corsHeaders } from "./config.js";

/**
 * Convert a value into a clean single-line string.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/**
 * Confirm that a value is a plain object.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
}

/**
 * Return a safe error message for API responses and diagnostics.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function safeErrorMessage(error) {
  if (error instanceof Error) {
    return error.message || "Unknown error.";
  }

  if (isPlainObject(error) && clean(error.message)) {
    return clean(error.message);
  }

  return clean(error) || "Unknown error.";
}

/**
 * Write a structured error to Cloudflare Worker logs.
 *
 * @param {object} input
 * @param {string} input.requestId
 * @param {string} input.route
 * @param {string} input.stage
 * @param {unknown} input.error
 * @param {unknown} [input.extra]
 */
export function logWorkerError({
  requestId,
  route,
  stage,
  error,
  extra = null
}) {
  console.error("[GCM OS]", {
    requestId,
    route,
    stage,
    error: safeErrorMessage(error),
    stack: error instanceof Error ? error.stack : null,
    extra
  });
}

/**
 * Return a JSON response using the shared GCM OS CORS headers.
 *
 * @param {unknown} data
 * @param {number} [status]
 * @returns {Response}
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders
  });
}
