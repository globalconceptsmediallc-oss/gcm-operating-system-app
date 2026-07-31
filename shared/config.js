/* =========================================================
   Global Concepts Media Operating System
   File: shared/config.js
   Version: 7.7.1
   Status: Production Candidate
   Source: shared/config.js 7.7.0
   Sprint: Calendar — D1 Operations Integration
   Purpose: Preserve all existing production constants and add
            Calendar appointment, reminder, appointment-type,
            and availability-rule action contracts.
   ========================================================= */

export const VERSION = "7.7.1";
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
  GET_CLIENT_DIRECTORY: "get-client-directory",
  COMMIT_OPERATIONAL_DECISION: "commit-operational-decision",
  GET_MISSION_CONTROL: "get-mission-control",
  GET_GUIDED_INVESTIGATION: "get-guided-investigation",
  PROCESS_INVESTIGATION: "process-investigation",
  PROCESS_WORK_ITEM: "process-work-item",
  GET_MEDIA_OPERATIONS: "get-media-operations",
  OPERATIONAL_REVIEWS: "operational-reviews",

  GET_CALENDAR_APPOINTMENTS: "get-calendar-appointments",
  CREATE_CALENDAR_APPOINTMENT: "create-calendar-appointment",
  UPDATE_CALENDAR_APPOINTMENT: "update-calendar-appointment",
  DELETE_CALENDAR_APPOINTMENT: "delete-calendar-appointment",

  GET_CALENDAR_REMINDERS: "get-calendar-reminders",
  CREATE_CALENDAR_REMINDER: "create-calendar-reminder",
  UPDATE_CALENDAR_REMINDER: "update-calendar-reminder",
  DELETE_CALENDAR_REMINDER: "delete-calendar-reminder",

  GET_CALENDAR_APPOINTMENT_TYPES: "get-calendar-appointment-types",
  CREATE_CALENDAR_APPOINTMENT_TYPE: "create-calendar-appointment-type",
  UPDATE_CALENDAR_APPOINTMENT_TYPE: "update-calendar-appointment-type",

  GET_CALENDAR_AVAILABILITY_RULES: "get-calendar-availability-rules",
  UPDATE_CALENDAR_AVAILABILITY_RULES: "update-calendar-availability-rules"
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
