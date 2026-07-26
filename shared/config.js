/* =========================================================
   Global Concepts Media Operating System
   File: shared/config.js
   Version: 7.3.0
   Status: Production Candidate
   Source: Production Worker 7.2.0
   Sprint: Work Item Completion — Road Test #21
   Purpose: Shared production constants and configuration.
            Adds the existing Work Item processing action without
            changing communication or Investigation behavior.
   ========================================================= */

export const VERSION = "7.3.0";
export const API_CONTRACT_VERSION = "communications-operational-decision-v3";
export const COMMUNICATION_ANALYSIS_ENGINE_VERSION = "3.4.1";

/*
 * Workers AI vision model used to read communication screenshots.
 */
export const COMMUNICATION_VISION_MODEL =
  "@cf/meta/llama-3.2-11b-vision-instruct";

export const COMMUNICATION_REASONING_MODEL =
  "@cf/openai/gpt-oss-20b";

export const ACTIONS = Object.freeze({
  ANALYZE_COMMUNICATION: "analyze-client-communication",
  GET_CLIENT_WORKSPACE: "get-client-workspace",
  COMMIT_OPERATIONAL_DECISION: "commit-operational-decision",
  GET_MISSION_CONTROL: "get-mission-control",
  PROCESS_INVESTIGATION: "process-investigation",
  PROCESS_WORK_ITEM: "process-work-item"
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
  "Access-Control-Allow-Headers":
    "Content-Type, X-GCM-Contract-Version",
  "Content-Type": "application/json; charset=utf-8"
};
