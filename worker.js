/* =========================================================
   Global Concepts Media Operating System
   File: worker.js
   Version: 7.7.2
   Status: Audited Production Candidate
   Source: Production worker.js 7.7.1
   Sprint: Worker Build Recovery
   Purpose: Restore clean GitHub-to-Cloudflare deployments by preserving
            every route module that exists in the public repository and
            disconnecting only the unfinished Calendar handler whose route
            file is not present.

   Repository audit:
   - Verified existing route imports:
     communicationAnalysis.js
     clientWorkspace.js
     clientDirectory.js
     operationalDecision.js
     missionControl.js
     investigationProcessing.js
     guidedInvestigation.js
     workItemProcessing.js
     mediaOperations.js
     operationalReviews.js
   - Removed unresolved import:
     routes/calendarOperations.js
   - Removed Calendar dispatch that depended on that missing module.
   - Calendar pages, D1 tables, action constants, and stored data are not
     deleted by this file.
   - Health output now reports only actions this Worker can actually route.
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
  ACTIONS.OPERATIONAL_REVIEWS
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
        contractVersion: API_CONTRACT_VERSION,
        sprint: "Worker Build Recovery",
        architecture:
          "Modular production router with guided Investigation reasoning and verified repository-backed routes.",
        actions: SUPPORTED_ACTIONS,
        engines: [
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
        processingStatus: "failed",
        error: safeErrorMessage(error),
        executionTimeMs: Date.now() - requestStartedAt
      }, 500);
    }
  }
};
