/* =========================================================
   Global Concepts Media Operating System
   File: shared/config.js
   Version: 7.10.0
   Status: Production Road-Test Candidate
   Source: shared/config.js 7.9.0 production
   Sprint: Prospecting + CRM — Durable Relationship Record
   Purpose: Preserve all existing production constants and add the
            durable Prospect CRM action contract.

   Change Notes in 7.10.0:
   - Adds PROSPECT_CRM: "prospect-crm".
   - Preserves every existing Gmail, Client, Work, Media, Investigation,
     Operating Session, and Calendar action unchanged.
   ========================================================= */

export const VERSION = "7.10.0";
export const API_CONTRACT_VERSION = "communications-operational-decision-v3";
export const COMMUNICATION_ANALYSIS_ENGINE_VERSION = "3.4.1";

export const COMMUNICATION_VISION_MODEL =
  "@cf/meta/llama-3.2-11b-vision-instruct";

export const COMMUNICATION_REASONING_MODEL =
  "@cf/openai/gpt-oss-20b";

export const ACTIONS = Object.freeze({
  ANALYZE_COMMUNICATION: "analyze-client-communication",
  ANALYZE_PROSPECT_INTELLIGENCE: "analyze-prospect-intelligence",
  PROSPECT_CRM: "prospect-crm",
  GET_GMAIL_STATUS: "get-gmail-status",
  PREVIEW_GMAIL_INBOX: "preview-gmail-inbox",
  APPROVE_GMAIL_MONITORING: "approve-gmail-monitoring",
  APPROVE_GMAIL_INVESTIGATION: "approve-gmail-investigation",
  CREATE_GMAIL_DRAFT: "create-gmail-draft",
  GET_CLIENT_WORKSPACE: "get-client-workspace",
  GET_CLIENT_DIRECTORY: "get-client-directory",
  COMMIT_OPERATIONAL_DECISION: "commit-operational-decision",
  GET_MISSION_CONTROL: "get-mission-control",
  GET_GUIDED_INVESTIGATION: "get-guided-investigation",
  PROCESS_INVESTIGATION: "process-investigation",
  PROCESS_WORK_ITEM: "process-work-item",
  CREATE_REQUESTED_WORK: "create-requested-work",
  GET_MEDIA_OPERATIONS: "get-media-operations",
  OPERATIONAL_REVIEWS: "operational-reviews",

  LIST_OPERATING_SESSIONS: "list-operating-sessions",
  GET_OPERATING_SESSION: "get-operating-session",
  CREATE_OPERATING_SESSION: "create-operating-session",
  ADD_OPERATING_SESSION_EVIDENCE: "add-operating-session-evidence",
  ADD_OPERATING_SESSION_ENTRY: "add-operating-session-entry",
  UPDATE_OPERATING_SESSION_STATUS: "update-operating-session-status",
  PREPARE_OPERATING_SESSION: "prepare-operating-session",

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
    "Content-Type, Authorization, X-GCM-Contract-Version",
  "Content-Type": "application/json; charset=utf-8"
};
