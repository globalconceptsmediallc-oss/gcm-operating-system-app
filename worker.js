/* =========================================================
   Global Concepts Media Operating System
   File: worker.js
   Version: 7.7.3
   Status: Production Candidate
   Source: Production worker.js 7.7.2
   Sprint: Agency Command Route Connection
   Purpose: Preserve every verified production route and connect the
            read-only Agency Command orchestration route.

   Changes in 7.7.3:
   - Added routes/agencyCommand.js import.
   - Added agency-command to supported actions.
   - Added Agency Command dispatch.
   - Added Agency Command to Worker health output.
   - No existing route, binding, D1 table, workflow, or action removed.
   ========================================================= */

import {
  VERSION,
  API_CONTRACT_VERSION,
  ACTIONS,
  corsHeaders
} from "./shared/config.js";

import {
  clean,
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "./shared/http.js";

import { handleCommunicationAnalysis } from "./routes/communicationAnalysis.js";
import { handleClientWorkspace } from "./routes/clientWorkspace.js";
import { handleClientDirectory } from "./routes/clientDirectory.js";
import { handleCommitOperationalDecision } from "./routes/operationalDecision.js";
import { handleMissionControl } from "./routes/missionControl.js";
import { handleProcessInvestigation } from "./routes/investigationProcessing.js";
import { handleGuidedInvestigation } from "./routes/guidedInvestigation.js";
import { handleProcessWorkItem } from "./routes/workItemProcessing.js";
import { handleMediaOperations } from "./routes/mediaOperations.js";
import { handleOperationalReviews } from "./routes/operationalReviews.js";
import {
  handleAgencyCommand,
  AGENCY_COMMAND_ACTION
} from "./routes/agencyCommand.js";

const SUPPORTED_ACTIONS = [
  ACTIONS.ANALYZE_COMMUNICATION,
  ACTIONS.GET_CLIENT_WORKSPACE,
  ACTIONS.GET_CLIENT_DIRECTORY,
  ACTIONS.COMMIT_OPERATIONAL_DECISION,
  ACTIONS.GET_MISSION_CONTROL,
  ACTIONS.GET_GUIDED_INVESTIGATION,
  ACTIONS.PROCESS_INVESTIGATION,
  ACTIONS.PROCESS_WORK_ITEM,
  ACTIONS.GET_MEDIA_OPERATIONS,
  ACTIONS.OPERATIONAL_REVIEWS,
  AGENCY_COMMAND_ACTION
].filter(Boolean);

export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    const requestStartedAt = Date.now();

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "GET") {
      return jsonResponse({
        ok: true,
        status: "online",
        system: "GCM OS Operational Worker",
        version: VERSION,
        workerFileVersion: "7.7.3",
        contractVersion: API_CONTRACT_VERSION,
        sprint: "Agency Command Route Connection",
        architecture:
          "Modular production router with Agency Command orchestration, guided Investigation reasoning, and verified repository-backed routes.",
        actions: SUPPORTED_ACTIONS,
        engines: [
          "agency-command",
          "notification-detection",
          "evidence-extraction",
          "business-meaning",
          "operational-routing",
          "consultant-summary",
          "client-workspace",
          "client-directory",
          "operational-decision-commit",
          "mission-control",
          "guided-investigation",
          "investigation-processing",
          "work-item-processing",
          "media-operations",
          "operational-reviews"
        ],
        modules: {
          shared: ["config", "http", "database", "ai"],
          routes: [
            "agency-command",
            "communication-analysis",
            "client-workspace",
            "client-directory",
            "operational-decision",
            "mission-control",
            "guided-investigation",
            "investigation-processing",
            "work-item-processing",
            "media-operations",
            "operational-reviews"
          ]
        },
        temporarilyDisconnectedModules: [
          {
            module: "calendar-operations",
            reason: "routes/calendarOperations.js is not present in the repository."
          }
        ],
        removedLegacyPipelines: [
          "business-snapshot",
          "client-pre-research",
          "website-intelligence",
          "html-intelligence",
          "prospect-qualification"
        ],
        requestId
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({
        ok: false,
        requestId,
        error: "Method not allowed."
      }, 405);
    }

    let body;

    try {
      body = await request.json();
    } catch (error) {
      logWorkerError({
        requestId,
        route: "request-parser",
        stage: "request_validation",
        error
      });

      return jsonResponse({
        ok: false,
        requestId,
        error: "The request body must contain valid JSON.",
        details: safeErrorMessage(error)
      }, 400);
    }

    const action = clean(body?.action);

    try {
      switch (action) {
        case AGENCY_COMMAND_ACTION:
          return await handleAgencyCommand(body, env, requestId);

        case ACTIONS.ANALYZE_COMMUNICATION:
          return await handleCommunicationAnalysis(body, env, requestId);

        case ACTIONS.GET_CLIENT_WORKSPACE:
          return await handleClientWorkspace(body, env, requestId);

        case ACTIONS.GET_CLIENT_DIRECTORY:
          return await handleClientDirectory(body, env, requestId);

        case ACTIONS.COMMIT_OPERATIONAL_DECISION:
          return await handleCommitOperationalDecision(body, env, requestId);

        case ACTIONS.GET_MISSION_CONTROL:
          return await handleMissionControl(body, env, requestId);

        case ACTIONS.GET_GUIDED_INVESTIGATION:
          return await handleGuidedInvestigation(body, env, requestId);

        case ACTIONS.PROCESS_INVESTIGATION:
          return await handleProcessInvestigation(body, env, requestId);

        case ACTIONS.PROCESS_WORK_ITEM:
          return await handleProcessWorkItem(body, env, requestId);

        case ACTIONS.GET_MEDIA_OPERATIONS:
          return await handleMediaOperations(body, env, requestId);

        case ACTIONS.OPERATIONAL_REVIEWS:
          return await handleOperationalReviews(body, env, requestId);

        default:
          return jsonResponse({
            ok: false,
            requestId,
            version: VERSION,
            workerFileVersion: "7.7.3",
            error: action
              ? `Unsupported action: ${action}`
              : "An action is required.",
            supportedActions: SUPPORTED_ACTIONS
          }, 400);
      }
    } catch (error) {
      logWorkerError({
        requestId,
        route: action || "unknown",
        stage: "request_handler",
        error
      });

      return jsonResponse({
        ok: false,
        requestId,
        version: VERSION,
        workerFileVersion: "7.7.3",
        processingStatus: "failed",
        error: safeErrorMessage(error),
        executionTimeMs: Date.now() - requestStartedAt
      }, 500);
    }
  }
};
