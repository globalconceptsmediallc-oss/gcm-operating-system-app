/* =========================================================
   Global Concepts Media Operating System
   File: config.js
   Version: 7.7.3
   Status: Production Candidate
   Source: Root config.js 7.6.1
   Sprint: Agency Intelligence — Prospect Advertisement Intake
   Purpose: Root production configuration. Preserves all
            production action contracts and adds the Prospect
            Intelligence action used by the Prospect Research
            page.
   ========================================================= */

export const VERSION = "7.7.3";
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

  ANALYZE_PROSPECT_INTELLIGENCE: "analyze-prospect-intelligence",

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
  "Access-Control-Allow-Headers":
    "Content-Type, X-GCM-Contract-Version",
  "Content-Type": "application/json; charset=utf-8"
};
