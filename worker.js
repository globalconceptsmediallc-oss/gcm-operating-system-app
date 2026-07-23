/* =========================================================
   Global Concepts Media Operating System
   File: worker.js
   Version: 7.1.0
   Source: Production Worker 7.0.0
   Sprint: Mission Control — Card 1
   Purpose: Lightweight production router for operational
            communication analysis, client workspace retrieval,
            reviewed operational-decision commits, and live
            Mission Control retrieval.

   Required project structure:

   worker.js

   shared/
     config.js
     http.js
     database.js
     ai.js

   routes/
     communicationAnalysis.js
     operationalDecision.js
     clientWorkspace.js
     missionControl.js
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

import {
  handleCommunicationAnalysis
} from "./routes/communicationAnalysis.js";

import {
  handleClientWorkspace
} from "./routes/clientWorkspace.js";

import {
  handleCommitOperationalDecision
} from "./routes/operationalDecision.js";

import {
  handleMissionControl
} from "./routes/missionControl.js";

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
        sprint: "Mission Control — Card 1",
        architecture: "Lightweight router with modular operational routes, shared infrastructure, isolated diagnostics, deterministic classification, guarded AI, D1 persistence, and live Mission Control retrieval",
        actions: Object.values(ACTIONS),
        engines: [
          "notification-detection",
          "evidence-extraction",
          "business-meaning",
          "operational-routing",
          "consultant-summary",
          "client-workspace",
          "operational-decision-commit",
          "mission-control"
        ],
        modules: {
          shared: [
            "config",
            "http",
            "database",
            "ai"
          ],
          routes: [
            "communication-analysis",
            "client-workspace",
            "operational-decision",
            "mission-control"
          ]
        },
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
          return await handleCommunicationAnalysis(
            body,
            env,
            requestId
          );

        case ACTIONS.GET_CLIENT_WORKSPACE:
          return await handleClientWorkspace(
            body,
            env,
            requestId
          );

        case ACTIONS.COMMIT_OPERATIONAL_DECISION:
          return await handleCommitOperationalDecision(
            body,
            env,
            requestId
          );

        case ACTIONS.GET_MISSION_CONTROL:
          return await handleMissionControl(
            body,
            env,
            requestId
          );

        default:
          return jsonResponse({
            ok: false,
            requestId,
            version: VERSION,
            error: action
              ? `Unsupported action: ${action}`
              : "An action is required.",
            supportedActions: Object.values(ACTIONS)
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
