/* =========================================================
   Global Concepts Media Operating System
   File: shared/ai.js
   Version: 7.0.0
   Source: Production Worker 6.3.7
   Purpose: Shared Workers AI execution, retry handling,
            timeout control, JSON parsing, diagnostics,
            and operational error construction.
   ========================================================= */

import {
  clean,
  isPlainObject,
  safeErrorMessage,
  logWorkerError
} from "./http.js";

/**
 * Execute a Workers AI request that must return a JSON object.
 * Retries once by default when the failure is considered retryable.
 *
 * @param {object} input
 * @param {object} input.env
 * @param {string} input.model
 * @param {object} input.input
 * @param {string} input.stageName
 * @param {string} input.requestId
 * @param {string} input.route
 * @param {number} [input.timeoutMs]
 * @param {number} [input.maxRetries]
 * @returns {Promise<object>}
 */
export async function runAiJsonWithRetry({
  env,
  model,
  input,
  stageName,
  requestId,
  route,
  timeoutMs = 30000,
  maxRetries = 1
}) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await withTimeout(
        env.AI.run(model, input),
        timeoutMs,
        `${stageName} timed out after ${timeoutMs} ms.`
      );

      const parsed = parseAiJsonResponse(response, stageName);

      return {
        ok: true,
        data: parsed,
        retryCount: attempt,
        retryStatus: attempt === 0 ? "not_required" : "succeeded"
      };
    } catch (error) {
      lastError = error;
      const retryable = isRetryableAiError(error);

      logWorkerError({
        requestId,
        route,
        stage: stageName,
        error,
        extra: {
          attempt,
          retryable,
          model
        }
      });

      if (!retryable || attempt >= maxRetries) {
        break;
      }
    }
  }

  const operationalError = buildOperationalError({
    stage: stageName,
    code: errorCodeForAiFailure(lastError),
    message: safeErrorMessage(lastError),
    retryable: isRetryableAiError(lastError)
  });

  return {
    ok: false,
    error: operationalError,
    retryCount: maxRetries,
    retryStatus: maxRetries > 0 ? "failed" : "not_attempted"
  };
}

/**
 * Parse a Workers AI response into one plain JSON object.
 *
 * Handles:
 * - direct object responses
 * - response/description/result/output wrappers
 * - markdown JSON fences
 * - extra text surrounding one JSON object
 *
 * @param {unknown} response
 * @param {string} [label]
 * @returns {object}
 */
export function parseAiJsonResponse(response, label = "AI") {
  const candidate = typeof response === "string"
    ? response
    : response?.response
      ?? response?.description
      ?? response?.result
      ?? response?.output
      ?? "";

  if (isPlainObject(candidate)) {
    return candidate;
  }

  const text = String(candidate || "").trim();

  if (!text) {
    throw new Error(`${label} returned an empty response.`);
  }

  const withoutFences = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(withoutFences);

    if (!isPlainObject(parsed)) {
      throw new Error(`${label} JSON must be an object.`);
    }

    return parsed;
  } catch (firstError) {
    const start = withoutFences.indexOf("{");
    const end = withoutFences.lastIndexOf("}");

    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(withoutFences.slice(start, end + 1));

        if (!isPlainObject(parsed)) {
          throw new Error(`${label} JSON must be an object.`);
        }

        return parsed;
      } catch {
        // Use the explicit malformed JSON error below.
      }
    }

    throw new Error(`${label} did not return valid JSON.`);
  }
}

/**
 * Race a promise against a timeout.
 *
 * @param {Promise<unknown>} promise
 * @param {number} timeoutMs
 * @param {string} message
 * @returns {Promise<unknown>}
 */
export function withTimeout(promise, timeoutMs, message) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(message)),
      timeoutMs
    );
  });

  return Promise.race([promise, timeout])
    .finally(() => clearTimeout(timer));
}

/**
 * Determine whether an AI failure should be retried.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isRetryableAiError(error) {
  const message = safeErrorMessage(error).toLowerCase();

  return /timeout|timed out|429|rate limit|temporar|unavailable|overloaded|502|503|504|empty response/.test(
    message
  );
}

/**
 * Convert an AI error into a stable operational error code.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function errorCodeForAiFailure(error) {
  const message = safeErrorMessage(error).toLowerCase();

  if (/timeout|timed out/.test(message)) {
    return "AI_TIMEOUT";
  }

  if (/empty response/.test(message)) {
    return "AI_EMPTY_RESPONSE";
  }

  if (/valid json|json/.test(message)) {
    return "AI_MALFORMED_JSON";
  }

  if (/429|rate limit/.test(message)) {
    return "AI_RATE_LIMIT";
  }

  return "AI_MODEL_FAILURE";
}

/**
 * Build a standard stage diagnostic result.
 *
 * @param {object} input
 * @returns {object}
 */
export function createStageResult({
  stageName,
  status,
  engine,
  model,
  startedAt,
  confidence = null,
  retryCount = 0,
  retryStatus = "not_required",
  rawAiError = null,
  fallbackUsed = false,
  data = null
}) {
  return {
    stageName,
    status,
    engine,
    model,
    executionTimeMs: Date.now() - startedAt,
    confidence,
    retryCount,
    retryStatus,
    rawAiError,
    fallbackUsed,
    data
  };
}

/**
 * Build a stable operational error object.
 *
 * @param {object} input
 * @param {string} input.stage
 * @param {string} input.code
 * @param {string} input.message
 * @param {boolean} input.retryable
 * @returns {object}
 */
export function buildOperationalError({
  stage,
  code,
  message,
  retryable
}) {
  return {
    stage,
    code,
    message: clean(message),
    retryable: Boolean(retryable)
  };
}
