/* =========================================================
   Global Concepts Media Operating System (GCM OS)
   File: lib/aiResponseParser.js
   Version: 1.0.0
   Status: Production Foundation

   Responsibility:
   Normalize Cloudflare Workers AI response shapes and return
   a validated JSON object to intelligence engines.

   This module does not:
   - create prompts,
   - call AI models,
   - validate engine-specific schemas,
   - classify evidence,
   - or generate consulting intelligence.
   ========================================================= */

export const AiResponseParser = Object.freeze({
  id: "ai-response-parser",
  version: "1.0.0"
});

/**
 * Parse a Cloudflare Workers AI response into a JSON object.
 *
 * Supported response shapes include:
 * - direct JSON objects
 * - { response: "{...}" }
 * - { response: { ... } } from JSON Mode
 * - { output_text: "{...}" }
 * - OpenAI-compatible choices[0].message.content
 * - Responses API output[].content[].text
 * - common result/data wrappers
 *
 * @param {unknown} response Raw value returned by env.AI.run().
 * @param {{ label?: string }} [options]
 * @returns {Record<string, unknown>}
 */
export function parseAiJsonResponse(response, options = {}) {
  const label = cleanLabel(options.label || "AI");
  const value = extractAiResponseValue(response, { label });

  if (isPlainObject(value)) {
    return value;
  }

  if (typeof value !== "string") {
    throw new Error(`${label} returned no parseable JSON value.`);
  }

  return parseJsonText(value, { label });
}

/**
 * Extract the model's useful response value without parsing JSON text.
 * Returns either a string or a plain object.
 *
 * @param {unknown} response
 * @param {{ label?: string }} [options]
 * @returns {string | Record<string, unknown>}
 */
export function extractAiResponseValue(response, options = {}) {
  const label = cleanLabel(options.label || "AI");

  if (typeof response === "string") {
    return response;
  }

  if (!response || typeof response !== "object") {
    throw new Error(`${label} returned no readable response.`);
  }

  // Cloudflare JSON Mode can return the completed object here.
  if (isPlainObject(response.response)) {
    return response.response;
  }

  // Standard Workers AI text-generation output.
  if (typeof response.response === "string") {
    return response.response;
  }

  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  // Some SDK and REST wrappers expose the payload under result or data.
  const wrapped = extractFromWrapper(response.result, label) ||
    extractFromWrapper(response.data, label);

  if (wrapped !== null) {
    return wrapped;
  }

  // OpenAI-compatible Chat Completions shape.
  const choiceContent = response.choices?.[0]?.message?.content;
  const choiceValue = extractContentValue(choiceContent);

  if (choiceValue !== null) {
    return choiceValue;
  }

  // OpenAI Responses API / Workers AI Responses-style output shape.
  const outputValue = extractOutputValue(response.output);

  if (outputValue !== null) {
    return outputValue;
  }

  // A direct plain object may already be the requested structured output.
  if (isLikelyStructuredPayload(response)) {
    return response;
  }

  throw new Error(
    `${label} could not extract model output. Response keys: ${Object.keys(response).join(", ") || "none"}.`
  );
}

/**
 * Parse JSON text while tolerating Markdown fences and surrounding prose.
 *
 * @param {string} rawText
 * @param {{ label?: string }} [options]
 * @returns {Record<string, unknown>}
 */
export function parseJsonText(rawText, options = {}) {
  const label = cleanLabel(options.label || "AI");
  const cleaned = stripMarkdownFences(String(rawText || "").trim());

  if (!cleaned) {
    throw new Error(`${label} returned an empty response.`);
  }

  const direct = tryParseJson(cleaned);

  if (isPlainObject(direct)) {
    return direct;
  }

  // Extract the first balanced JSON object instead of using first/last brace,
  // which can fail when explanatory text or multiple objects are present.
  const candidate = findFirstBalancedJsonObject(cleaned);

  if (!candidate) {
    throw new Error(`${label} did not return a JSON object.`);
  }

  const parsed = tryParseJson(candidate);

  if (!isPlainObject(parsed)) {
    throw new Error(`${label} returned invalid JSON.`);
  }

  return parsed;
}

function extractFromWrapper(wrapper, label) {
  if (typeof wrapper === "string") {
    return wrapper;
  }

  if (!wrapper || typeof wrapper !== "object") {
    return null;
  }

  if (isPlainObject(wrapper.response)) {
    return wrapper.response;
  }

  if (typeof wrapper.response === "string") {
    return wrapper.response;
  }

  if (typeof wrapper.output_text === "string") {
    return wrapper.output_text;
  }

  const choiceContent = wrapper.choices?.[0]?.message?.content;
  const choiceValue = extractContentValue(choiceContent);

  if (choiceValue !== null) {
    return choiceValue;
  }

  const outputValue = extractOutputValue(wrapper.output);

  if (outputValue !== null) {
    return outputValue;
  }

  if (isLikelyStructuredPayload(wrapper)) {
    return wrapper;
  }

  return null;
}

function extractContentValue(content) {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const textParts = [];

  for (const part of content) {
    if (typeof part === "string") {
      textParts.push(part);
      continue;
    }

    if (!part || typeof part !== "object") {
      continue;
    }

    if (isPlainObject(part.json)) {
      return part.json;
    }

    if (typeof part.text === "string") {
      textParts.push(part.text);
      continue;
    }

    if (typeof part.content === "string") {
      textParts.push(part.content);
    }
  }

  return textParts.length ? textParts.join("\n") : null;
}

function extractOutputValue(output) {
  if (!Array.isArray(output)) {
    return null;
  }

  const textParts = [];

  for (const outputItem of output) {
    if (!outputItem || typeof outputItem !== "object") {
      continue;
    }

    if (isPlainObject(outputItem.json)) {
      return outputItem.json;
    }

    if (typeof outputItem.text === "string") {
      textParts.push(outputItem.text);
    }

    const contentValue = extractContentValue(outputItem.content);

    if (isPlainObject(contentValue)) {
      return contentValue;
    }

    if (typeof contentValue === "string") {
      textParts.push(contentValue);
    }
  }

  return textParts.length ? textParts.join("\n") : null;
}

function stripMarkdownFences(value) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function findFirstBalancedJsonObject(value) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (character === "}" && depth > 0) {
      depth -= 1;

      if (depth === 0 && start !== -1) {
        return value.slice(start, index + 1);
      }
    }
  }

  return null;
}

function isLikelyStructuredPayload(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const transportKeys = new Set([
    "response",
    "output_text",
    "output",
    "choices",
    "usage",
    "tool_calls",
    "result",
    "data",
    "success",
    "errors",
    "messages"
  ]);

  return Object.keys(value).some(key => !transportKeys.has(key));
}

function isPlainObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function cleanLabel(value) {
  const cleaned = String(value || "AI")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "AI";
}
