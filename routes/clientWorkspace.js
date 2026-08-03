/* =========================================================
   Global Concepts Media Operating System
   File: routes/clientWorkspace.js
   Version: 7.2.0
   Status: Production Candidate
   Source: Production routes/clientWorkspace.js 7.1.1
   Sprint: Unified Client Operational State
   Purpose: Preserve the complete live D1 client workspace and client tool
            router while making open Investigations authoritative in the
            Business Workspace before unstarted Work Items, alerts, and
            fallback planning.
   Production changes:
   - Open Investigations now drive account health, current priority, next
     action, Business Priorities, and operational counts.
   - Investigation priority is ranked before Work Items and alerts.
   - Existing communications, work items, evidence, proof, tools, history,
     clientToolRouter, response shape, and D1 queries are preserved.
   ========================================================= */

import {
  VERSION,
  ACTIONS
} from "../shared/config.js";

import {
  clean,
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "../shared/http.js";

import {
  getDatabase,
  rowsOf
} from "../shared/database.js";

/* =========================================================
   Client Workspace — D1 Operational Record
   ========================================================= */

export async function handleClientWorkspace(body, env, requestId) {
  const db = getDatabase(env);
  const clientCode = clean(body?.clientCode || body?.client || "SES");

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_CLIENT_WORKSPACE,
      error:
        "The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."
    }, 503);
  }

  if (!clientCode) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_CLIENT_WORKSPACE,
      error: "A clientCode is required."
    }, 400);
  }

  try {
    const client = await db.prepare(`
      SELECT id, client_code, name, legal_name, status, website, industry,
             primary_contact_name, primary_contact_email, notes,
             created_at, updated_at
      FROM clients
      WHERE client_code = ? COLLATE NOCASE
      LIMIT 1
    `).bind(clientCode).first();

    if (!client) {
      return jsonResponse({
        ok: false,
        requestId,
        action: ACTIONS.GET_CLIENT_WORKSPACE,
        error: `Client "${clientCode}" was not found.`
      }, 404);
    }

    const [
      communicationsResult,
      investigationsResult,
      workItemsResult,
      evidenceResult,
      alertsResult,
      proofResult,
      clientToolsResult
    ] = await Promise.all([
      db.prepare(`
        SELECT *
        FROM communications
        WHERE client_id = ?
        ORDER BY occurred_at DESC, id DESC
      `).bind(client.id).all(),

      db.prepare(`
        SELECT *
        FROM investigations
        WHERE client_id = ?
        ORDER BY
          CASE priority
            WHEN 'urgent' THEN 0
            WHEN 'highest' THEN 0
            WHEN 'high' THEN 1
            WHEN 'normal' THEN 2
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
            ELSE 4
          END,
          opened_at DESC,
          id DESC
      `).bind(client.id).all(),

      db.prepare(`
        SELECT *
        FROM work_items
        WHERE client_id = ?
        ORDER BY
          CASE priority
            WHEN 'urgent' THEN 0
            WHEN 'high' THEN 1
            WHEN 'normal' THEN 2
            ELSE 3
          END,
          created_at DESC,
          id DESC
      `).bind(client.id).all(),

      db.prepare(`
        SELECT *
        FROM evidence
        WHERE client_id = ?
        ORDER BY captured_at DESC, id DESC
      `).bind(client.id).all(),

      db.prepare(`
        SELECT *
        FROM alerts
        WHERE client_id = ?
        ORDER BY
          CASE severity
            WHEN 'critical' THEN 0
            WHEN 'warning' THEN 1
            ELSE 2
          END,
          created_at DESC,
          id DESC
      `).bind(client.id).all(),

      db.prepare(`
        SELECT *
        FROM activity_records
        WHERE client_id = ?
        ORDER BY activity_date DESC, id DESC
      `).bind(client.id).all(),

      db.prepare(`
        SELECT
          id,
          client_id,
          tool_family,
          tool_key,
          label,
          url,
          status,
          notes,
          created_at,
          updated_at
        FROM client_tools
        WHERE client_id = ?
          AND status = 'active'
        ORDER BY tool_family, tool_key, id
      `).bind(client.id).all()
    ]);

    const communications = rowsOf(communicationsResult);
    const investigations = rowsOf(investigationsResult);
    const workItems = rowsOf(workItemsResult);
    const evidence = rowsOf(evidenceResult);
    const alerts = rowsOf(alertsResult);
    const proofOfWork = rowsOf(proofResult);
    const clientTools = rowsOf(clientToolsResult);
    const clientToolRouter = buildClientToolRouter(clientTools);

    const record = buildClientWorkspaceRecord({
      client,
      communications,
      investigations,
      workItems,
      evidence,
      alerts,
      proofOfWork,
      clientTools
    });

    const openInvestigations = investigations.filter(isOpenInvestigation);
    const openWorkItems = workItems.filter(isOpenWorkItem);
    const activeAlerts = alerts.filter(isActiveAlert);

    return jsonResponse({
      ok: true,
      requestId,
      action: ACTIONS.GET_CLIENT_WORKSPACE,
      version: VERSION,
      source: "D1",
      generatedAt: new Date().toISOString(),

      clientTools,
      clientToolRouter,

      record,

      operational: {
        client,
        communications,
        investigations,
        workItems,
        evidence,
        alerts,
        proofOfWork,
        clientTools,
        clientToolRouter
      },

      counts: {
        communications: communications.length,
        openCommunications: communications.filter(
          item => !["closed", "ignored"].includes(normalizeStatus(item.status))
        ).length,
        investigations: investigations.length,
        openInvestigations: openInvestigations.length,
        workItems: workItems.length,
        openWorkItems: openWorkItems.length,
        proofOfWork: proofOfWork.length,
        activeAlerts: activeAlerts.length,
        evidence: evidence.length,
        clientTools: clientTools.length
      },

      diagnostics: {
        unifiedOperationalState: {
          version: "1.0.0",
          firstRecordType:
            openInvestigations.length > 0
              ? "investigation"
              : openWorkItems.length > 0
                ? "work_item"
                : activeAlerts.length > 0
                  ? "alert"
                  : "none",
          firstRecordId:
            openInvestigations[0]?.id ||
            openWorkItems[0]?.id ||
            activeAlerts[0]?.id ||
            null,
          openInvestigationCount: openInvestigations.length,
          openWorkItemCount: openWorkItems.length,
          activeAlertCount: activeAlerts.length
        },
        clientToolRouter: {
          clientCode: client.client_code,
          activeToolCount: clientTools.length,
          toolKeys: Object.keys(clientToolRouter),
          semrushSiteAuditIssuesConfigured: Boolean(
            clientToolRouter.semrush_site_audit_issues?.url
          )
        }
      }
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.GET_CLIENT_WORKSPACE,
      stage: "d1_workspace",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_CLIENT_WORKSPACE,
      error: safeErrorMessage(error)
    }, 500);
  }
}

function buildClientWorkspaceRecord({
  client,
  communications,
  investigations,
  workItems,
  evidence,
  alerts,
  proofOfWork,
  clientTools
}) {
  const openInvestigations = investigations.filter(isOpenInvestigation);
  const openWork = workItems.filter(isOpenWorkItem);
  const activeAlerts = alerts.filter(isActiveAlert);

  const latestActivity = latestDate([
    ...communications.map(item => item.occurred_at),
    ...investigations.map(item => item.updated_at || item.opened_at),
    ...workItems.map(item => item.updated_at || item.created_at),
    ...proofOfWork.map(item => item.activity_date)
  ]);

  const firstInvestigation = openInvestigations[0] || null;
  const firstWork = openWork[0] || null;
  const firstAlert = activeAlerts[0] || null;

  const authoritativeRecord =
    firstInvestigation || firstWork || firstAlert || null;

  const authoritativeType = firstInvestigation
    ? "Investigation"
    : firstWork
      ? "Work"
      : firstAlert
        ? "Alert"
        : null;

  const currentPriority = authoritativeRecord
    ? `${authoritativeType} #${authoritativeRecord.id}: ${
        authoritativeRecord.title || "Operational review required"
      }`
    : "No open priority is recorded.";

  const nextAction = firstInvestigation
    ? `Continue Investigation #${firstInvestigation.id}: ${
        firstInvestigation.title || "Review required"
      }`
    : firstWork?.title ||
      firstAlert?.title ||
      "Review the client record.";

  const nextActionReason = firstInvestigation
    ? investigationReason(firstInvestigation)
    : firstWork?.description ||
      firstAlert?.description ||
      "No open operational record currently requires action.";

  const owner =
    firstInvestigation?.owner ||
    firstInvestigation?.assigned_to ||
    firstWork?.owner ||
    firstAlert?.owner ||
    "Global Concepts Media";

  const accountNeedsAttention =
    openInvestigations.length > 0 ||
    activeAlerts.length > 0;

  return {
    schemaVersion: "1.1.0",
    businessId: slugify(client.name || client.client_code),

    business: {
      name: client.name,
      legalName: client.legal_name || null,
      industry: client.industry || "Needs Verification",
      businessType: null,
      website: client.website || null,
      primaryMarket: null,
      serviceAreas: [],
      address: {
        street: null,
        city: null,
        state: null,
        postalCode: null,
        country: null
      },
      phone: null,
      email: client.primary_contact_email || null,
      primaryContact: {
        name: client.primary_contact_name || null,
        role: null,
        phone: null,
        email: client.primary_contact_email || null
      },
      summary:
        client.notes ||
        `${client.name} is a ${client.status} Global Concepts Media client.`,
      tags: ["Client", titleCase(client.status)]
    },

    relationship: {
      recordType: "Client",
      status: titleCase(client.status),
      entryMethod: "Existing Client",
      stage:
        openInvestigations.length || openWork.length
          ? "Implementation"
          : "Management",
      clientSince: dateOnly(client.created_at),
      clientEnded: null,
      monthlyAgreement: null,
      billingStatus: null,
      accountHealth: accountNeedsAttention
        ? "Needs Attention"
        : "Healthy",
      accountHealthReason: firstInvestigation
        ? `Investigation #${firstInvestigation.id} is open: ${
            firstInvestigation.title || "Review required"
          }`
        : firstAlert?.description ||
          firstAlert?.title ||
          null
    },

    workspace: {
      currentPriority,
      nextAction,
      nextActionReason,
      nextActionType: firstInvestigation
        ? "investigation"
        : firstWork
          ? "work_item"
          : firstAlert
            ? "alert"
            : "planning",
      nextActionRecordId:
        authoritativeRecord?.id || null,
      nextActionHref: firstInvestigation
        ? `work.html?investigation=${encodeURIComponent(firstInvestigation.id)}`
        : firstWork
          ? `work.html?workItem=${encodeURIComponent(firstWork.id)}`
          : null,
      nextReviewDate:
        dateOnly(
          firstInvestigation?.due_at ||
          firstInvestigation?.review_due_at ||
          firstAlert?.due_at
        ),
      lastClientContact: dateOnly(communications[0]?.occurred_at),
      lastWorkDate: dateOnly(latestActivity),
      owner,
      workingNotes:
        "Loaded from the live GCM OS D1 operational database."
    },

    currentPriorities: [
      ...openInvestigations.map(mapInvestigationToPriority),
      ...activeAlerts.map(mapAlertToPriority)
    ],

    workQueue: openWork.map(mapWorkItem),

    tools: clientTools.map(mapClientTool),

    advertising: {
      currentStatus: "Unknown",
      monthlyBudget: null,
      campaigns: []
    },

    seo: {
      status: "Unknown",
      primaryProject:
        clientTools.find(
          tool => tool.tool_key === "semrush_site_audit_issues"
        )?.url || null,
      visibility: null,
      topThreeKeywords: null,
      topTenKeywords: null,
      keywordsImproved: null,
      keywordsDeclined: null,
      technicalIssuesOpen: null,
      lastReviewed: null,
      nextAction: null,
      records: []
    },

    website: {
      platform: null,
      repository:
        clientTools.find(tool => tool.tool_key === "github_repository")?.url ||
        null,
      productionUrl: client.website || null,
      status: client.website ? "Active" : "Unknown",
      lastDeployment: null,
      nextAction: null,
      changes: []
    },

    socialMedia: {
      status: "Unknown",
      lastReviewed: null,
      nextAction: null,
      channels: [],
      content: []
    },

    proofOfWork: proofOfWork.map(
      item => mapProofOfWork(item, evidence)
    ),

    metrics: [],
    results: [],
    growthReviews: [],

    caseStudy: {
      status: "Not Ready",
      title: null,
      summary: null,
      challenge: null,
      strategy: null,
      workCompleted: [],
      results: [],
      proofOfWorkIds: [],
      resultIds: [],
      notes: null
    },

    documents: [],

    history: buildOperationalHistory({
      communications,
      investigations,
      workItems,
      proofOfWork
    }),

    metadata: {
      source: "D1",
      clientCode: client.client_code,
      clientId: client.id,
      generatedAt: new Date().toISOString(),
      updatedAt: client.updated_at,
      operationalCounts: {
        communications: communications.length,
        investigations: investigations.length,
        openInvestigations: openInvestigations.length,
        workItems: workItems.length,
        openWorkItems: openWork.length,
        proofOfWork: proofOfWork.length,
        alerts: activeAlerts.length,
        evidence: evidence.length,
        clientTools: clientTools.length
      },
      authoritativeOperationalState: {
        type: firstInvestigation
          ? "investigation"
          : firstWork
            ? "work_item"
            : firstAlert
              ? "alert"
              : "none",
        recordId: authoritativeRecord?.id || null
      },
      dataQuality: "Live operational records"
    }
  };
}

function isOpenInvestigation(item) {
  return ![
    "resolved",
    "closed",
    "complete",
    "completed",
    "cancelled",
    "archived"
  ].includes(normalizeStatus(item?.status));
}

function isOpenWorkItem(item) {
  return ![
    "completed",
    "complete",
    "cancelled",
    "closed",
    "archived"
  ].includes(normalizeStatus(item?.status));
}

function isActiveAlert(item) {
  return ["open", "acknowledged"].includes(normalizeStatus(item?.status));
}

function investigationReason(item) {
  return (
    item.current_next_step ||
    item.next_step ||
    item.next_question ||
    item.description ||
    item.finding_summary ||
    "Review the evidence and decide the specific work required."
  );
}

function mapInvestigationToPriority(item) {
  return {
    id: `investigation-${item.id}`,
    title: `Investigation #${item.id}: ${
      item.title || "Review required"
    }`,
    category: titleCase(item.category || "Investigation"),
    status: "In Progress",
    priority: workspacePriority(item.priority),
    owner:
      item.owner ||
      item.assigned_to ||
      "Global Concepts Media",
    businessValue:
      item.description ||
      item.objective ||
      item.finding_summary ||
      "This investigation requires an evidence-supported operational decision.",
    dueDate: dateOnly(item.due_at || item.review_due_at),
    nextAction: investigationReason(item),
    href: `work.html?investigation=${encodeURIComponent(item.id)}`,
    sourceType: "Investigation",
    sourceId: item.id
  };
}

function buildClientToolRouter(clientTools) {
  return clientTools.reduce((router, item) => {
    const key = normalizeToolKey(item.tool_key);

    if (!key || !item.url) {
      return router;
    }

    router[key] = {
      id: item.id,
      clientId: item.client_id,
      family: item.tool_family,
      key,
      label: item.label,
      url: item.url,
      status: item.status,
      notes: item.notes || "",
      createdAt: item.created_at,
      updatedAt: item.updated_at
    };

    return router;
  }, {});
}

function normalizeToolKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mapClientTool(item) {
  return {
    id: `tool-${item.id}`,
    family: item.tool_family,
    key: item.tool_key,
    label: item.label,
    url: item.url,
    status: titleCase(item.status),
    notes: item.notes || "",
    updatedAt: item.updated_at
  };
}

function mapWorkItem(item) {
  return {
    id: `work-${item.id}`,
    title: item.title,
    description: item.description || "",
    category: item.category || "General",
    status: workspaceStatus(item.status),
    priority: workspacePriority(item.priority),
    owner: item.owner || "Global Concepts Media",
    estimatedMinutes: null,
    actualMinutes: 0,
    createdDate: dateOnly(item.created_at),
    dueDate: dateOnly(item.due_at),
    completedDate: dateOnly(item.completed_at),
    businessValue: item.expected_impact || item.actual_impact || "",
    nextAction: item.description || item.title,
    proofOfWorkId: null,
    href: `work.html?workItem=${encodeURIComponent(item.id)}`
  };
}

function mapAlertToPriority(item) {
  const severity = normalizeStatus(item.severity);
  const status = normalizeStatus(item.status);

  return {
    id: `alert-${item.id}`,
    title: item.title,
    category: titleCase(item.related_type || "Alert"),
    status:
      ["resolved", "closed"].includes(status)
        ? "Complete"
        : "In Progress",
    priority:
      severity === "critical"
        ? "Critical"
        : severity === "warning" || severity === "high"
          ? "High"
          : "Medium",
    owner: item.owner || "Global Concepts Media",
    businessValue:
      item.description || "This condition requires review.",
    dueDate: dateOnly(item.due_at),
    nextAction: item.description || item.title
  };
}

function mapProofOfWork(item, evidence) {
  const linkedEvidence = evidence
    .filter(
      entry =>
        item.work_item_id &&
        Number(entry.work_item_id) === Number(item.work_item_id)
    )
    .map(entry => ({
      type: titleCase(entry.evidence_type || "Evidence"),
      label: entry.source || "Evidence",
      url: entry.url || null,
      value: entry.description || ""
    }));

  if (item.evidence_reference) {
    linkedEvidence.unshift({
      type: titleCase(item.evidence_type || "Evidence"),
      label: item.source_type || "Proof of Work",
      url: /^https?:\/\//i.test(item.evidence_reference)
        ? item.evidence_reference
        : null,
      value: item.evidence_reference
    });
  }

  const impact = item.actual_impact || item.expected_impact || "";

  return {
    id: `pow-${item.id}`,
    date: dateOnly(item.activity_date),
    phase: "Client Operations",
    category: item.category || "General",
    task: item.activity,
    universeImpact: impact,
    canonLocked: true,
    assetCreated: null,
    status: workspaceStatus(item.status || "completed"),
    priority: workspacePriority(item.priority),
    version: null,
    timeMinutes: item.time_minutes || 0,
    nextAction: null,
    revenuePath: false,
    notes: item.notes || "",
    milestoneTag: item.win ? "Win" : null,
    businessValue: impact,
    evidence: linkedEvidence,
    result: item.actual_impact || "",
    resultStatus: item.actual_impact
      ? "Recorded"
      : "Not Measured",
    caseStudyEligible: Boolean(item.win),
    sourceWorkItemId: item.work_item_id
      ? `work-${item.work_item_id}`
      : null
  };
}

function buildOperationalHistory({
  communications,
  investigations,
  workItems,
  proofOfWork
}) {
  return [
    ...communications.map(item => ({
      id: `communication-${item.id}`,
      date: dateOnly(item.occurred_at),
      time: timeOnly(item.occurred_at),
      type: "Communication",
      category: item.category || "Communication",
      title: item.subject || `${item.source} communication`,
      description:
        item.ai_summary || item.raw_content || "",
      sourceId: `communication-${item.id}`,
      createdBy: item.owner || "Global Concepts Media"
    })),

    ...investigations.map(item => ({
      id: `investigation-${item.id}`,
      date: dateOnly(item.opened_at),
      time: timeOnly(item.opened_at),
      type: "Investigation",
      category: item.category || "Investigation",
      title: item.title,
      description:
        item.finding_summary || item.description || "",
      sourceId: `investigation-${item.id}`,
      createdBy:
        item.owner ||
        item.assigned_to ||
        "Global Concepts Media"
    })),

    ...workItems.map(item => ({
      id: `work-${item.id}`,
      date: dateOnly(item.updated_at || item.created_at),
      time: timeOnly(item.updated_at || item.created_at),
      type: "Work",
      category: item.category || "General",
      title: item.title,
      description: item.description || "",
      sourceId: `work-${item.id}`,
      createdBy: item.owner || "Global Concepts Media"
    })),

    ...proofOfWork.map(item => ({
      id: `proof-${item.id}`,
      date: dateOnly(item.activity_date),
      time: "00:00:00",
      type: "Proof of Work",
      category: item.category || "General",
      title: item.activity,
      description:
        item.actual_impact ||
        item.expected_impact ||
        item.notes ||
        "",
      sourceId: `pow-${item.id}`,
      createdBy: item.owner || "Global Concepts Media"
    }))
  ];
}

/* =========================================================
   Route-Specific Production Helpers
   ========================================================= */

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function workspaceStatus(value) {
  const statuses = {
    open: "Not Started",
    planned: "Planned",
    in_progress: "In Progress",
    blocked: "Blocked",
    implemented: "In Progress",
    verifying: "Waiting",
    completed: "Complete",
    complete: "Complete",
    closed: "Complete",
    cancelled: "Deferred"
  };

  return (
    statuses[String(value || "").toLowerCase()] ||
    titleCase(value || "Not Started")
  );
}

function workspacePriority(value) {
  const priorities = {
    urgent: "Critical",
    highest: "Critical",
    critical: "Critical",
    high: "High",
    normal: "Medium",
    medium: "Medium",
    low: "Low"
  };

  return (
    priorities[String(value || "").toLowerCase()] ||
    "Medium"
  );
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, character =>
      character.toUpperCase()
    );
}

function slugify(value) {
  return (
    String(value || "client")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    "client"
  );
}

function dateOnly(value) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}/.test(text)
    ? text.slice(0, 10)
    : null;
}

function timeOnly(value) {
  const match = String(value || "").match(
    /T(\d{2}:\d{2}:\d{2})/
  );

  return match ? match[1] : "00:00:00";
}

function latestDate(values) {
  return values
    .filter(Boolean)
    .sort()
    .reverse()[0] || null;
}
