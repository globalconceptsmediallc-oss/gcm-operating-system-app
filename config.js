/* =========================================================
   Global Concepts Media Operating System
   File: shared/config.js
   Version: 7.6.0
   Status: Production Candidate
   Source: Production Worker 7.5.0
   Sprint: Guided Investigation Engine — Phase 1
   Purpose: Preserve production constants and add guided
            Investigation retrieval.
   ========================================================= */

export const VERSION = "7.6.0";
export const API_CONTRACT_VERSION = "communications-operational-decision-v3";
export const COMMUNICATION_ANALYSIS_ENGINE_VERSION = "3.4.1";

export const COMMUNICATION_VISION_MODEL =
  "@cf/meta/llama-3.2-11b-vision-instruct";

export const COMMUNICATION_REASONING_MODEL =
  "@cf/openai/gpt-oss-20b";

export const ACTIONS = Object.freeze({
  ANALYZE_COMMUNICATION: "analyze-client-communication",
  GET_CLIENT_WORKSPACE: "get-client-workspace",
  GET_CLIENT_DIRECTORY: "get-client-directory",
  COMMIT_OPERATIONAL_DECISION: "commit-operational-decision",
  GET_MISSION_CONTROL: "get-mission-control",
  GET_GUIDED_INVESTIGATION: "get-guided-investigation",
  PROCESS_INVESTIGATION: "process-investigation",
  PROCESS_WORK_ITEM: "process-work-item",
  GET_MEDIA_OPERATIONS: "get-media-operations"
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
