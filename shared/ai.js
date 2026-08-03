/* =========================================================
   Global Concepts Media Operating System
   File: shared/ai.js
   Version: 7.0.2
   Source: Production shared/ai.js 7.0.1
   Status: Production Candidate — AI Diagnostic Isolation
   Purpose: Shared Workers AI execution, retry handling,
            timeout control, JSON parsing, diagnostics,
            operational error construction, optional stage
            debug-data preservation, and strict isolation of
            Workers AI/runtime errors from business evidence.
   ========================================================= */

import {
  clean,
  isPlainObject,
  safeErrorMessage,
  logWorkerError
} from "./http.js";

const AI_ERROR_CODES = Object.freeze({
  TIMEOUT: "AI_TIMEOUT",
  EMPTY_RESPONSE: "AI_EMPTY_RESPONSE",
  MALFORMED_JSON: "AI_MALFORMED_JSON",
  RATE_LIMIT: "AI_RATE_LIMIT",
  QUOTA_EXHAUSTED: "AI_QUOTA_EXHAUSTED",
  SERVICE_UNAVAILABLE: "AI_SERVICE_UNAVAILABLE",
  MODEL_FAILURE: "AI_MODEL_FAILURE"
});

/**
 * Execute a Workers AI request that must return a JSON object.
 * Retries once by default only when the failure is transient.
 *
 * Runtime/quota responses are retained in server diagnostics but are never
 * returned as client communication evidence or business-facing reasoning.
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
  let attemptsCompleted = 0;

  if (!env?.AI || typeof env.AI.run !== "function") {
    const unavailableError = createAiExecutionError(
      AI_ERROR_CODES.SERVICE_UNAVAILABLE,
      "Workers AI binding is unavailable.",
      false
    );

    return {
      ok: false,
      error: buildOperationalError({
        stage: stageName,
        code: unavailableError.code,
        message: publicMessageForAiFailure(unavailableError),
        retryable: false
      }),
      retryCount: 0,
      retryStatus: "not_attempted"
    };
  }

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    attemptsCompleted = attempt + 1;

    try {
      const response = await withTimeout(
        env.AI.run(model, input),
        timeoutMs,
        `${stageName} timed out after ${timeoutMs} ms.`
      );

      assertNoAiRuntimeFailure(response, stageName);

      const parsed = parseAiJsonResponse(response, stageName);

      return {
        ok: true,
        data: parsed,
        retryCount: attempt,
        retryStatus: attempt === 0 ? "not_required" : "succeeded"
      };
    } catch (error) {
      lastError = normalizeAiExecutionError(error);
      const retryable = isRetryableAiError(lastError);

      logWorkerError({
        requestId,
        route,
        stage: stageName,
        error: lastError,
        extra: {
          attempt,
          retryable,
          model,
          aiErrorCode: errorCodeForAiFailure(lastError)
        }
      });

      if (!retryable || attempt >= maxRetries) {
        break;
      }
    }
  }

  const code = errorCodeForAiFailure(lastError);
  const retryable = isRetryableAiError(lastError);

  return {
    ok: false,
    error: buildOperationalError({
      stage: stageName,
      code,
      message: publicMessageForAiFailure(lastError),
      retryable
    }),
    retryCount: Math.max(0, attemptsCompleted - 1),
    retryStatus: attemptsCompleted > 1 ? "failed" : "not_retried"
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
 * Runtime diagnostic responses are rejected before they can be interpreted
 * as business evidence.
 *
 * @param {unknown} response
 * @param {string} [label]
 * @returns {object}
 */
export function parseAiJsonResponse(response, label = "AI") {
  assertNoAiRuntimeFailure(response, label);

  const candidate = typeof response === "string"
    ? response
    : response?.response
      ?? response?.description
      ?? response?.result
      ?? response?.output
      ?? "";

  if (isPlainObject(candidate)) {
    assertNoAiRuntimeFailure(candidate, label);
    return candidate;
  }

  const text = String(candidate || "").trim();

  if (!text) {
    throw createAiExecutionError(
      AI_ERROR_CODES.EMPTY_RESPONSE,
      `${label} returned an empty response.`,
      true
    );
  }

  if (isAiRuntimeDiagnosticText(text)) {
    throw createAiExecutionError(
      errorCodeForAiFailure(text),
      text,
      isRetryableAiError(text)
    );
  }

  const withoutFences = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(withoutFences);

    if (!isPlainObject(parsed)) {
      throw createAiExecutionError(
        AI_ERROR_CODES.MALFORMED_JSON,
        `${label} JSON must be an object.`,
        false
      );
    }

    assertNoAiRuntimeFailure(parsed, label);
    return parsed;
  } catch (firstError) {
    if (firstError?.aiExecutionError === true) {
      throw firstError;
    }

    const start = withoutFences.indexOf("{");
    const end = withoutFences.lastIndexOf("}");

    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(withoutFences.slice(start, end + 1));

        if (!isPlainObject(parsed)) {
          throw createAiExecutionError(
            AI_ERROR_CODES.MALFORMED_JSON,
            `${label} JSON must be an object.`,
            false
          );
        }

        assertNoAiRuntimeFailure(parsed, label);
        return parsed;
      } catch (nestedError) {
        if (nestedError?.aiExecutionError === true) {
          throw nestedError;
        }
      }
    }

    throw createAiExecutionError(
      AI_ERROR_CODES.MALFORMED_JSON,
      `${label} did not return valid JSON.`,
      false
    );
  }
}

/**
 * Reject Workers AI/runtime responses before downstream evidence processing.
 *
 * @param {unknown} response
 * @param {string} label
 */
export function assertNoAiRuntimeFailure(response, label = "AI") {
  const diagnostic = extractAiRuntimeDiagnostic(response);

  if (!diagnostic) return;

  const code = errorCodeForAiFailure(diagnostic);

  throw createAiExecutionError(
    code,
    `${label}: ${diagnostic}`,
    isRetryableAiError(diagnostic)
  );
}

/**
 * Find runtime/quota diagnostics in common Workers AI response shapes.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function extractAiRuntimeDiagnostic(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") {
    return isAiRuntimeDiagnosticText(value) ? clean(value) : "";
  }

  if (value instanceof Error) {
    const message = safeErrorMessage(value);
    return isAiRuntimeDiagnosticText(message) ? clean(message) : "";
  }

  if (!isPlainObject(value)) return "";

  const candidates = [
    value.error,
    value.errors,
    value.message,
    value.detail,
    value.details,
    value.response,
    value.description,
    value.result,
    value.output
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && isAiRuntimeDiagnosticText(candidate)) {
      return clean(candidate);
    }

    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const nested = extractAiRuntimeDiagnostic(item);
        if (nested) return nested;
      }
    }

    if (isPlainObject(candidate)) {
      const nested = extractAiRuntimeDiagnostic(candidate);
      if (nested) return nested;
    }
  }

  return "";
}

/**
 * Detect text that belongs to Workers AI/runtime diagnostics rather than the
 * user's screenshot or supplied business content.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAiRuntimeDiagnosticText(value) {
  const message = clean(value).toLowerCase();
  if (!message) return false;

  return (
    /\b4006\b/.test(message) ||
    /\bdaily free allocation\b/.test(message) ||
    /\bneurons?\b/.test(message) ||
    /\bcloudflare(?:'s)? workers paid plan\b/.test(message) ||
    /\bquota exceeded\b/.test(message) ||
    /\bquota\b.*\b(?:exhausted|limit|allocation)\b/.test(message) ||
    /\bworkers ai\b.*\b(?:error|quota|limit|allocation|unavailable)\b/.test(message) ||
    /\brate limit(?:ed)?\b/.test(message) ||
    /\btoo many requests\b/.test(message) ||
    /\bmodel invocation\b.*\bfailed\b/.test(message) ||
    /\bservice unavailable\b/.test(message) ||
    /\boverloaded\b/.test(message) ||
    /\b(?:502|503|504)\b/.test(message)
  );
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
      () => reject(
        createAiExecutionError(
          AI_ERROR_CODES.TIMEOUT,
          message,
          true
        )
      ),
      timeoutMs
    );
  });

  return Promise.race([promise, timeout])
    .finally(() => clearTimeout(timer));
}

/**
 * Determine whether an AI failure should be retried.
 *
 * Quota exhaustion and malformed JSON are not transient and must not consume
 * additional AI calls.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isRetryableAiError(error) {
  const code = clean(error?.code || error?.aiErrorCode);
  const message = safeErrorMessage(error).toLowerCase();

  if (
    code === AI_ERROR_CODES.QUOTA_EXHAUSTED ||
    code === AI_ERROR_CODES.MALFORMED_JSON
  ) {
    return false;
  }

  if (
    /\b4006\b|daily free allocation|neurons?|quota exceeded|workers paid plan/.test(
      message
    )
  ) {
    return false;
  }

  return /timeout|timed out|429|rate limit|too many requests|temporar|unavailable|overloaded|502|503|504|empty response/.test(
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
  const suppliedCode = clean(error?.code || error?.aiErrorCode);

  if (Object.values(AI_ERROR_CODES).includes(suppliedCode)) {
    return suppliedCode;
  }

  const message = safeErrorMessage(error).toLowerCase();

  if (
    /\b4006\b|daily free allocation|neurons?|quota exceeded|workers paid plan/.test(
      message
    )
  ) {
    return AI_ERROR_CODES.QUOTA_EXHAUSTED;
  }

  if (/timeout|timed out/.test(message)) {
    return AI_ERROR_CODES.TIMEOUT;
  }

  if (/empty response/.test(message)) {
    return AI_ERROR_CODES.EMPTY_RESPONSE;
  }

  if (/valid json|json must be an object|malformed json/.test(message)) {
    return AI_ERROR_CODES.MALFORMED_JSON;
  }

  if (/429|rate limit|too many requests/.test(message)) {
    return AI_ERROR_CODES.RATE_LIMIT;
  }

  if (/temporar|unavailable|overloaded|502|503|504/.test(message)) {
    return AI_ERROR_CODES.SERVICE_UNAVAILABLE;
  }

  return AI_ERROR_CODES.MODEL_FAILURE;
}

/**
 * Return a stable business-safe message. The raw runtime message remains in
 * server logs but cannot enter evidence, summaries, reasoning, or D1 records.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function publicMessageForAiFailure(error) {
  const code = errorCodeForAiFailure(error);

  const messages = {
    [AI_ERROR_CODES.TIMEOUT]:
      "AI processing timed out before usable evidence was returned.",
    [AI_ERROR_CODES.EMPTY_RESPONSE]:
      "AI processing returned no usable response.",
    [AI_ERROR_CODES.MALFORMED_JSON]:
      "AI processing did not return usable structured evidence.",
    [AI_ERROR_CODES.RATE_LIMIT]:
      "AI processing is temporarily rate limited.",
    [AI_ERROR_CODES.QUOTA_EXHAUSTED]:
      "AI processing is temporarily unavailable because the usage allocation has been reached.",
    [AI_ERROR_CODES.SERVICE_UNAVAILABLE]:
      "AI processing is temporarily unavailable.",
    [AI_ERROR_CODES.MODEL_FAILURE]:
      "AI processing failed before usable evidence was returned."
  };

  return messages[code] || messages[AI_ERROR_CODES.MODEL_FAILURE];
}

/**
 * Normalize any thrown value into a stable AI execution error.
 *
 * @param {unknown} error
 * @returns {Error}
 */
function normalizeAiExecutionError(error) {
  if (error?.aiExecutionError === true) {
    return error;
  }

  return createAiExecutionError(
    errorCodeForAiFailure(error),
    safeErrorMessage(error),
    isRetryableAiError(error)
  );
}

/**
 * Create an Error with stable AI metadata.
 *
 * @param {string} code
 * @param {string} message
 * @param {boolean} retryable
 * @returns {Error}
 */
function createAiExecutionError(code, message, retryable) {
  const error = new Error(clean(message) || "AI processing failed.");
  error.name = "AiExecutionError";
  error.code = clean(code) || AI_ERROR_CODES.MODEL_FAILURE;
  error.aiErrorCode = error.code;
  error.retryable = Boolean(retryable);
  error.aiExecutionError = true;
  return error;
}

/**
 * Build a standard stage diagnostic result.
 *
 * IMPORTANT:
 * `debug` is intentionally preserved when supplied by a route.
 * This allows temporary road-test diagnostics such as the exact
 * processed vision image to survive createStageResult() and reach
 * the final API response.
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
  data = null,
  debug = null
}) {
  const result = {
    stageName,
    status,
    engine,
    model,
    executionTimeMs: Date.now() - startedAt,
    confidence,
    retryCount,
    retryStatus,
    rawAiError: sanitizeStageError(rawAiError),
    fallbackUsed,
    data
  };

  if (debug !== null && debug !== undefined) {
    result.debug = debug;
  }

  return result;
}

/**
 * Remove raw runtime/quota language from client-visible stage diagnostics.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
function sanitizeStageError(value) {
  const message = clean(value);
  if (!message) return null;

  if (isAiRuntimeDiagnosticText(message)) {
    return publicMessageForAiFailure(message);
  }

  return message;
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
  const stableCode = clean(code) || AI_ERROR_CODES.MODEL_FAILURE;
  const safeMessage = isAiRuntimeDiagnosticText(message)
    ? publicMessageForAiFailure({ code: stableCode, message })
    : clean(message);

  return {
    stage,
    code: stableCode,
    message: safeMessage,
    retryable: Boolean(retryable)
  };
}
