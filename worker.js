/* =========================================================
   Global Concepts Media Operating System
   File: worker.js
   Version: 7.14.0
   Status: Production Road-Test Candidate
   Source: Production worker.js 7.13.0
   Sprint: Historical Record Rehabilitation — Bulk Apply
   Purpose: Preserve every verified production route and expose the
            controlled bulk rehabilitation apply action for the verified
            Gmail monitoring proposal class.

   Changes in 7.13.0:
   - Adds apply-historical-rehabilitation-bulk to the Worker action allowlist.
   - Routes it to routes/historicalRehabilitation.js v1.2.0.
   - Preserves single-record apply and proposal-generation behavior.
   - Leaves Intelligence Backlog v1.0.1 and Intelligence Refresh v1.2.0 unchanged.
   - Preserves all existing production behavior.
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
import { handleProspectIntelligence } from "./routes/prospectIntelligence.js";
import { handleClientWorkspace } from "./routes/clientWorkspace.js";
import { handleClientDirectory } from "./routes/clientDirectory.js";
import { handleCommitOperationalDecision } from "./routes/operationalDecision.js";
import { handleMissionControl } from "./routes/missionControl.js";
import { handleProcessInvestigation } from "./routes/investigationProcessing.js";
import { handleGuidedInvestigation } from "./routes/guidedInvestigation.js";
import { handleProcessWorkItem, handleCreateRequestedWork, CREATE_REQUESTED_WORK_ACTION } from "./routes/workItemProcessing.js";
import { handleMediaOperations } from "./routes/mediaOperations.js";
import { handleOperationalReviews } from "./routes/operationalReviews.js";
import {
  handleAgencyCommand,
  AGENCY_COMMAND_ACTION
} from "./routes/agencyCommand.js";
import {
  handleIntelligenceProcessing,
  INTELLIGENCE_PROCESSING_ACTION
} from "./routes/intelligenceProcessing.js";
import {
  handleActivityIntelligence,
  ACTIVITY_INTELLIGENCE_ACTION
} from "./routes/activityIntelligence.js";
import {
  handleCommunicationIntelligence,
  COMMUNICATION_INTELLIGENCE_ACTION
} from "./routes/communicationIntelligence.js";
import {
  handleIntelligenceRefresh,
  INTELLIGENCE_REFRESH_ACTION
} from "./routes/intelligenceRefresh.js";
import {
  handleIntelligenceBacklog,
  INTELLIGENCE_BACKLOG_ACTION
} from "./routes/intelligenceBacklog.js";
import {
  handleHistoricalRehabilitation,
  handleHistoricalRehabilitationProposals,
  handleHistoricalRehabilitationBulk,
  HISTORICAL_REHABILITATION_ACTION,
  HISTORICAL_REHABILITATION_PROPOSAL_ACTION,
  HISTORICAL_REHABILITATION_BULK_ACTION
} from "./routes/historicalRehabilitation.js";

import { handleGmailGet, handleGmailAction } from "./routes/gmailIntegration.js";

const WORKER_FILE_VERSION = "7.14.0";

const SUPPORTED_ACTIONS = [
  ACTIONS.ANALYZE_COMMUNICATION,
  ACTIONS.ANALYZE_PROSPECT_INTELLIGENCE,
  ACTIONS.GET_CLIENT_WORKSPACE,
  ACTIONS.GET_CLIENT_DIRECTORY,
  ACTIONS.COMMIT_OPERATIONAL_DECISION,
  ACTIONS.GET_MISSION_CONTROL,
  ACTIONS.GET_GUIDED_INVESTIGATION,
  ACTIONS.PROCESS_INVESTIGATION,
  ACTIONS.PROCESS_WORK_ITEM,
  CREATE_REQUESTED_WORK_ACTION,
  ACTIONS.GET_MEDIA_OPERATIONS,
  ACTIONS.OPERATIONAL_REVIEWS,
  AGENCY_COMMAND_ACTION,
  INTELLIGENCE_PROCESSING_ACTION,
  ACTIVITY_INTELLIGENCE_ACTION,
  COMMUNICATION_INTELLIGENCE_ACTION,
  INTELLIGENCE_REFRESH_ACTION,
  INTELLIGENCE_BACKLOG_ACTION,
  HISTORICAL_REHABILITATION_ACTION,
  HISTORICAL_REHABILITATION_PROPOSAL_ACTION,
  HISTORICAL_REHABILITATION_BULK_ACTION,
  ACTIONS.GET_GMAIL_STATUS,
  ACTIONS.PREVIEW_GMAIL_INBOX,
  ACTIONS.APPROVE_GMAIL_MONITORING,
  ACTIONS.APPROVE_GMAIL_INVESTIGATION,
  ACTIONS.CREATE_GMAIL_DRAFT
].filter(Boolean);

export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    const requestStartedAt = Date.now();

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "GET") {
      const gmailResponse = await handleGmailGet(request, env, requestId);
      if (gmailResponse) return gmailResponse;
      return jsonResponse({
        ok: true,
        status: "online",
        system: "GCM OS Operational Worker",
        version: VERSION,
        workerFileVersion: WORKER_FILE_VERSION,
        contractVersion: API_CONTRACT_VERSION,
        sprint: "Historical Record Rehabilitation — Bulk Apply",
        architecture:
          "Modular production router with Agency Command, Historical Rehabilitation, Intelligence Backlog, Intelligence Refresh, Communication Intelligence, Activity Intelligence, Intelligence Processing, Prospect Intelligence, Communications analysis, Guided Investigation, and operational processing.",
        actions: SUPPORTED_ACTIONS,
        engines: [
          "agency-command",
          "historical-rehabilitation",
          "intelligence-backlog",
          "intelligence-refresh",
          "communication-intelligence",
          "activity-intelligence",
          "intelligence-processing",
          "prospect-intelligence",
          "communications-review-adapter",
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
            "historical-rehabilitation",
            "intelligence-backlog",
            "intelligence-refresh",
            "communication-intelligence",
            "activity-intelligence",
            "intelligence-processing",
            "prospect-intelligence",
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
        case ACTIONS.GET_GMAIL_STATUS:
        case ACTIONS.PREVIEW_GMAIL_INBOX:
        case ACTIONS.APPROVE_GMAIL_MONITORING:
        case ACTIONS.APPROVE_GMAIL_INVESTIGATION:
        case ACTIONS.CREATE_GMAIL_DRAFT:
          return await handleGmailAction(body, env, requestId);

        case AGENCY_COMMAND_ACTION:
          return await handleAgencyCommand(body, env, requestId);

        case INTELLIGENCE_PROCESSING_ACTION:
          return await handleIntelligenceProcessing(body, env, requestId);

        case ACTIVITY_INTELLIGENCE_ACTION:
          return await handleActivityIntelligence(body, env, requestId);

        case COMMUNICATION_INTELLIGENCE_ACTION:
          return await handleCommunicationIntelligence(body, env, requestId);

        case INTELLIGENCE_REFRESH_ACTION:
          return await handleIntelligenceRefresh(body, env, requestId);

        case INTELLIGENCE_BACKLOG_ACTION:
          return await handleIntelligenceBacklog(body, env, requestId);

        case HISTORICAL_REHABILITATION_ACTION:
          return await handleHistoricalRehabilitation(body, env, requestId);

        case HISTORICAL_REHABILITATION_PROPOSAL_ACTION:
          return await handleHistoricalRehabilitationProposals(body, env, requestId);

        case HISTORICAL_REHABILITATION_BULK_ACTION:
          return await handleHistoricalRehabilitationBulk(body, env, requestId);

        case ACTIONS.ANALYZE_PROSPECT_INTELLIGENCE:
          return await handleProspectIntelligence(body, env, requestId);

        case ACTIONS.ANALYZE_COMMUNICATION:
          return await handleCommunicationAnalysisWithReviewAdapter(
            body,
            env,
            requestId
          );

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

        case CREATE_REQUESTED_WORK_ACTION:
          return await handleCreateRequestedWork(body, env, requestId);

        case ACTIONS.GET_MEDIA_OPERATIONS:
          return await handleMediaOperations(body, env, requestId);

        case ACTIONS.OPERATIONAL_REVIEWS:
          return await handleOperationalReviews(body, env, requestId);

        default:
          return jsonResponse({
            ok: false,
            requestId,
            version: VERSION,
            workerFileVersion: WORKER_FILE_VERSION,
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
        workerFileVersion: WORKER_FILE_VERSION,
        processingStatus: "failed",
        error: safeErrorMessage(error),
        executionTimeMs: Date.now() - requestStartedAt
      }, 500);
    }
  }
};

async function handleCommunicationAnalysisWithReviewAdapter(
  body,
  env,
  requestId
) {
  const response = await handleCommunicationAnalysis(body, env, requestId);

  if (!response || typeof response.json !== "function") {
    return response;
  }

  let payload;

  try {
    payload = await response.json();
  } catch {
    return response;
  }

  if (
    response.ok &&
    payload?.ok === true &&
    payload?.analysis &&
    typeof payload.analysis === "object"
  ) {
    payload.analysis = buildCommunicationsReviewAnalysis(payload);
    payload.reviewAdapter = {
      applied: true,
      version: "1.0.0",
      workerFileVersion: WORKER_FILE_VERSION
    };
  }

  return jsonResponse(payload, response.status);
}

function buildCommunicationsReviewAnalysis(payload) {
  const original = payload.analysis || {};
  const classification = payload.classification || {};
  const recognition = payload.reportRecognition || {};
  const evidence = payload.evidence || {};
  const meaning = payload.businessMeaning || {};
  const wwPowd = payload.wwPowdAnalysis || {};
  const consultant = payload.consultantSummary || {};
  const clientObject =
    payload.client && typeof payload.client === "object"
      ? payload.client
      : {};

  const source = firstMeaningful(
    original.source,
    sourceForNotificationType(classification.notificationType),
    sourceForPlatform(classification.platform),
    sourceForPlatform(recognition.platform),
    evidence.visibleSource
  ) || "Unknown";

  const communicationType = firstMeaningful(
    original.communicationType,
    typeForNotificationType(classification.notificationType),
    humanize(recognition.reportType),
    classification.notificationFamily
  ) || "General Communication";

  const title = firstMeaningful(
    original.title,
    buildReviewTitle({
      source,
      communicationType,
      label: meaning.operationalLabel
    }),
    evidence.visibleSubject
  ) || "Client communication";

  const operationalSummary = firstMeaningful(
    original.operationalSummary,
    wwPowd.operationalSummary,
    meaning.operationalSummary,
    consultant.summary,
    buildEvidenceSummary(evidence, classification)
  ) || "The communication was received and requires human review.";

  const businessImpact = firstMeaningful(
    original.businessImpact,
    wwPowd.businessImpact,
    meaning.businessImpact
  ) || "Business impact has not yet been verified.";

  const recommendedAction = firstMeaningful(
    original.recommendedAction,
    wwPowd.nextAction,
    meaning.recommendedAction,
    consultant.nextAction
  ) || "Review and retain the communication.";

  const reasoning = firstMeaningful(
    original.reasoning,
    wwPowd.reasoning,
    meaning.reasoning,
    evidence.uncertainty
  ) || "The recommendation is based on the strongest structured evidence returned by the analysis pipeline.";

  return {
    ...original,
    client: firstMeaningful(
      original.client,
      original.clientName,
      clientObject.name
    ),
    clientName: firstMeaningful(
      original.clientName,
      original.client,
      clientObject.name
    ),
    clientCode: firstMeaningful(
      original.clientCode,
      original.clientId,
      clientObject.id
    ),
    source,
    communicationType,
    title,
    operationalSummary,
    businessImpact,
    recommendedAction,
    reasoning,
    evidenceSummary: buildEvidenceSummary(evidence, classification),
    reviewEvidence: {
      visibleSource: evidence.visibleSource || null,
      visibleSubject: evidence.visibleSubject || null,
      visibleFacts: Array.isArray(evidence.visibleFacts)
        ? evidence.visibleFacts
        : [],
      visibleMetrics: Array.isArray(evidence.visibleMetrics)
        ? evidence.visibleMetrics
        : [],
      confidence: evidence.confidence || null,
      notificationType: classification.notificationType || null,
      notificationFamily: classification.notificationFamily || null,
      reportType: recognition.reportType || null,
      reportFamily: recognition.reportFamily || null
    }
  };
}

function firstMeaningful(...values) {
  for (const value of values) {
    const text = clean(value);
    if (!text) continue;
    if (isWeakFallback(text)) continue;
    return text;
  }
  return "";
}

function isWeakFallback(value) {
  const normalized = clean(value).toLowerCase();
  return [
    "unknown",
    "general communication",
    "client communication",
    "an unknown communication was received.",
    "a unknown communication was received.",
    "the communication was received.",
    "review the communication."
  ].includes(normalized);
}

function sourceForNotificationType(value) {
  const sources = {
    position_tracking: "SEMrush",
    backlink_audit: "SEMrush",
    site_audit: "SEMrush",
    page_indexing_resolution: "Google Search Console",
    merchant_listing_structured_data: "Google Search Console",
    disavow_file_update: "Google Search Console",
    search_performance: "Google Search Console",
    business_profile: "Google Business Profile",
    analytics: "Google Analytics"
  };
  return sources[clean(value).toLowerCase()] || "";
}

function sourceForPlatform(value) {
  const platforms = {
    semrush: "SEMrush",
    google_search_console: "Google Search Console",
    google_business_profile: "Google Business Profile",
    google_analytics: "Google Analytics",
    google_merchant_center: "Google Merchant Center",
    client_email: "Client",
    vendor_email: "Vendor"
  };
  return platforms[clean(value).toLowerCase()] || humanize(value);
}

function typeForNotificationType(value) {
  const types = {
    position_tracking: "SEO Ranking Alert",
    page_indexing_resolution: "Page Indexing Resolution Confirmation",
    backlink_audit: "SEO Backlink Alert",
    site_audit: "Technical SEO Audit Alert",
    merchant_listing_structured_data:
      "Merchant Listings Structured Data Alert",
    search_performance: "Search Performance Notification",
    business_profile: "Local Presence Notification",
    analytics: "Analytics Notification",
    client_request: "Client or Human Communication",
    vendor_notice: "Vendor Notice",
    billing_notice: "Billing Notice",
    access_security: "Access Alert"
  };
  return types[clean(value).toLowerCase()] || "";
}

function buildReviewTitle({ source, communicationType, label }) {
  const cleanLabel = clean(label);
  if (cleanLabel) return `${source} ${communicationType} — ${cleanLabel}`;
  if (source && communicationType) return `${source} — ${communicationType}`;
  return source || communicationType || "";
}

function buildEvidenceSummary(evidence, classification) {
  const values = [];

  if (evidence?.visibleSubject) {
    values.push(clean(evidence.visibleSubject));
  }

  const facts = Array.isArray(evidence?.visibleFacts)
    ? evidence.visibleFacts
    : [];

  const metrics = Array.isArray(evidence?.visibleMetrics)
    ? evidence.visibleMetrics
    : [];

  for (const item of [...metrics, ...facts]) {
    const text = evidenceItemToText(item);

    if (text && !values.some(existing =>
      existing.toLowerCase() === text.toLowerCase()
    )) {
      values.push(text);
    }
  }

  if (!values.length && classification?.notificationFamily) {
    values.push(clean(classification.notificationFamily));
  }

  return values.slice(0, 12).join("; ");
}

function evidenceItemToText(item) {
  if (item === null || item === undefined) return "";
  if (typeof item === "string" || typeof item === "number") return clean(item);
  if (typeof item !== "object") return "";

  const label = clean(
    item.label ||
    item.key ||
    item.name ||
    item.metric ||
    item.category
  );

  const value = clean(
    item.displayValue ||
    item.display_value ||
    item.value ||
    item.statement ||
    item.evidence ||
    item.text
  );

  if (label && value) return `${label}: ${value}`;
  return label || value;
}

function humanize(value) {
  const text = clean(value);
  if (!text || text.toLowerCase() === "unknown") return "";
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}
