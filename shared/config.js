/* =========================================================
   Global Concepts Media Operating System
   File: shared/config.js
   Version: 7.0.0
   Source: Production Worker 6.3.7
   Purpose: Shared production constants and configuration.
   ========================================================= */

export const VERSION = "7.0.0";
export const API_CONTRACT_VERSION = "communications-operational-decision-v3";
export const COMMUNICATION_ANALYSIS_ENGINE_VERSION = "3.4.0";
export const COMMUNICATION_VISION_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";
export const COMMUNICATION_REASONING_MODEL = "@cf/openai/gpt-oss-20b";

export const ACTIONS = Object.freeze({
  ANALYZE_COMMUNICATION: "analyze-client-communication",
  GET_CLIENT_WORKSPACE: "get-client-workspace",
  COMMIT_OPERATIONAL_DECISION: "commit-operational-decision"
});

export const STAGE_STATUS = Object.freeze({
  SUCCESS: "success",
  PARTIAL: "partial",
  FALLBACK: "fallback",
  FAILED: "failed",
  SKIPPED: "skipped"
});

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-GCM-Contract-Version",
  "Content-Type": "application/json; charset=utf-8"
};
