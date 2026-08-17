/* =========================================================
   Global Concepts Media Operating System
   File: routes/missionControl.js
   Version: 7.7.5
   Status: Production Candidate
   Source: Production routes/missionControl.js 7.7.4
   Sprint: Durable Investigation Monitoring State
   Purpose: Preserve the live Mission Control contract while ranking
            only records that require current human action.

   Production rules:
   - Mission Control reads operational state; it does not own it.
   - Existing clientsRequiringAttention output remains compatible.
   - Each client is represented once by its strongest actionable record.
   - Client queue order uses the same priority, record type, and recency
     rules as highestPriorityDecision, so both views agree on what is first.
   - Monitoring / awaiting-external-validation Investigations remain durable
     D1 history but do not appear as current attention or highest-value work.
   - No recommendation or evidence is manufactured.
   ========================================================= */

import {
  VERSION,
  ACTIONS
} from "../shared/config.js";

import {
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "../shared/http.js";

import {
  getDatabase,
  rowsOf
} from "../shared/database.js";

const NON_ACTION_INVESTIGATION_STATUSES = `
  'complete',
  'completed',
  'closed',
  'resolved',
  'cancelled',
  'canceled',
  'archived',
  'ignored',
  'no_action',
  'monitoring',
  'awaiting_external_validation',
  'waiting_external',
  'waiting_on_external'
`;

const CLOSED_WORK_STATUSES = `
  'complete',
  'completed',
  'closed',
  'resolved',
  'cancelled',
  'canceled',
  'archived',
  'ignored',
  'no_action',
  'published'
`;

/* =========================================================
   Mission Control
   ========================================================= */

export async function handleMissionControl(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_MISSION_CONTROL,
      version: VERSION,
      error:
        "The D1 binding is unavailable. Bind the production database as DB, GCM_OS_DB, or DATABASE."
    }, 503);
  }

  try {
    const [clientsResult, decisionResult] = await Promise.all([
      loadClientsRequiringAttention(db),
      loadHighestPriorityDecision(db)
    ]);

    const clientsRequiringAttention = rowsOf(clientsResult).map((client) => ({
      clientId: Number(client.id),
      clientCode: String(client.client_code || ""),
      clientName: String(
        client.name ||
        client.client_code ||
        "Unknown Client"
      ),
      href: buildClientWorkspaceHref(client.client_code)
    }));

    const decisionRow = rowsOf(decisionResult)[0] || null;
    const highestPriorityDecision = decisionRow
      ? mapHighestPriorityDecision(decisionRow)
      : null;

    return jsonResponse({
      ok: true,
      requestId,
      action: ACTIONS.GET_MISSION_CONTROL,
      version: VERSION,
      missionControl: {
        clientsRequiringAttention,
        highestPriorityDecision
      }
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.GET_MISSION_CONTROL,
      stage: "mission_control_query",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.GET_MISSION_CONTROL,
      version: VERSION,
      error: "Mission Control could not load the live operating state.",
      details: safeErrorMessage(error)
    }, 500);
  }
}

/* =========================================================
   Existing Client Attention Contract
   ========================================================= */

async function loadClientsRequiringAttention(db) {
  return db.prepare(`
    WITH unresolved_records AS (
      SELECT
        i.client_id,
        c.client_code,
        c.name AS client_name,
        i.id AS record_id,
        CASE LOWER(COALESCE(i.priority, 'normal'))
          WHEN 'urgent' THEN 0
          WHEN 'critical' THEN 0
          WHEN 'highest' THEN 0
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END AS priority_rank,
        1 AS record_type_rank,
        i.opened_at AS attention_at,
        i.created_at
      FROM investigations i
      INNER JOIN clients c ON c.id = i.client_id
      WHERE ${normalizedStatus("i.status", "open")}
        NOT IN (${NON_ACTION_INVESTIGATION_STATUSES})

      UNION ALL

      SELECT
        w.client_id,
        c.client_code,
        c.name AS client_name,
        w.id AS record_id,
        CASE LOWER(COALESCE(w.priority, 'normal'))
          WHEN 'urgent' THEN 0
          WHEN 'critical' THEN 0
          WHEN 'highest' THEN 0
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END AS priority_rank,
        0 AS record_type_rank,
        COALESCE(w.started_at, w.created_at) AS attention_at,
        w.created_at
      FROM work_items w
      INNER JOIN clients c ON c.id = w.client_id
      WHERE ${normalizedStatus("w.status", "open")}
        NOT IN (${CLOSED_WORK_STATUSES})
    ),
    ranked_client_records AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY client_id
          ORDER BY
            priority_rank ASC,
            record_type_rank ASC,
            datetime(COALESCE(attention_at, created_at)) DESC,
            record_id DESC
        ) AS client_record_rank
      FROM unresolved_records
    )
    SELECT
      client_id AS id,
      client_code,
      client_name AS name
    FROM ranked_client_records
    WHERE client_record_rank = 1
    ORDER BY
      priority_rank ASC,
      record_type_rank ASC,
      datetime(COALESCE(attention_at, created_at)) DESC,
      record_id DESC,
      LOWER(client_name) ASC,
      client_id ASC
  `).all();
}

/* =========================================================
   Highest-Priority Operational Decision

   Selection order:
   1. Urgent
   2. High
   3. Normal / Medium
   4. Low / Unspecified

   At equal priority, unresolved Work Items rank before
   actionable Investigations because work is already committed.
   Newer records break any remaining tie.
   ========================================================= */

async function loadHighestPriorityDecision(db) {
  return db.prepare(`
    SELECT *
    FROM (
      SELECT
        'investigation' AS record_type,
        i.id AS record_id,
        i.client_id,
        c.client_code,
        c.name AS client_name,
        i.communication_id,
        NULL AS investigation_id,
        i.title,
        i.description,
        i.priority,
        i.status,
        i.assigned_to AS owner,
        i.recommendation AS why_it_matters,
        i.finding_summary AS evidence_summary,
        i.opened_at AS attention_at,
        i.created_at,
        CASE LOWER(COALESCE(i.priority, 'normal'))
          WHEN 'urgent' THEN 0
          WHEN 'critical' THEN 0
          WHEN 'highest' THEN 0
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END AS priority_rank,
        1 AS record_type_rank
      FROM investigations i
      INNER JOIN clients c ON c.id = i.client_id
      WHERE ${normalizedStatus("i.status", "open")}
        NOT IN (${NON_ACTION_INVESTIGATION_STATUSES})

      UNION ALL

      SELECT
        'work_item' AS record_type,
        w.id AS record_id,
        w.client_id,
        c.client_code,
        c.name AS client_name,
        w.communication_id,
        w.investigation_id,
        w.title,
        w.description,
        w.priority,
        w.status,
        w.owner,
        w.expected_impact AS why_it_matters,
        w.actual_impact AS evidence_summary,
        COALESCE(w.started_at, w.created_at) AS attention_at,
        w.created_at,
        CASE LOWER(COALESCE(w.priority, 'normal'))
          WHEN 'urgent' THEN 0
          WHEN 'critical' THEN 0
          WHEN 'highest' THEN 0
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END AS priority_rank,
        0 AS record_type_rank
      FROM work_items w
      INNER JOIN clients c ON c.id = w.client_id
      WHERE ${normalizedStatus("w.status", "open")}
        NOT IN (${CLOSED_WORK_STATUSES})
    )
    ORDER BY
      priority_rank ASC,
      record_type_rank ASC,
      datetime(COALESCE(attention_at, created_at)) DESC,
      record_id DESC
    LIMIT 1
  `).all();
}

/* =========================================================
   Response Mapping
   ========================================================= */

function mapHighestPriorityDecision(row) {
  const recordType = String(row.record_type || "");
  const recordId = Number(row.record_id);
  const clientCode = String(row.client_code || "");
  const clientName = String(
    row.client_name ||
    row.client_code ||
    "Unknown Client"
  );
  const communicationId = nullablePositiveInteger(row.communication_id);
  const investigationId =
    recordType === "investigation"
      ? recordId
      : nullablePositiveInteger(row.investigation_id);

  const what =
    cleanText(row.title) ||
    (recordType === "work_item"
      ? `Complete Work Item #${recordId}`
      : `Review Investigation #${recordId}`);

  const why =
    cleanText(row.why_it_matters) ||
    cleanText(row.description) ||
    "Review the linked operational record before deciding what happens next.";

  const evidence = buildEvidence({
    recordType,
    recordId,
    communicationId,
    investigationId,
    evidenceSummary: cleanText(row.evidence_summary)
  });

  return {
    recordType,
    recordId,
    clientId: Number(row.client_id),
    clientCode,
    clientName,

    who: {
      client: clientName,
      owner: cleanText(row.owner) || "Unassigned"
    },

    what,

    when: {
      priority: cleanText(row.priority) || "normal",
      attentionAt: nullableText(row.attention_at),
      status: cleanText(row.status) || "open"
    },

    why,

    evidence,

    references: {
      communicationId,
      investigationId,
      workItemId: recordType === "work_item" ? recordId : null
    },

    nextAction: {
      label:
        recordType === "work_item"
          ? `Open Work Item #${recordId}`
          : `Open Investigation #${recordId}`,
      href: buildWorkHref({
        clientCode,
        recordType,
        recordId,
        investigationId
      })
    }
  };
}

/* =========================================================
   Evidence and Navigation
   ========================================================= */

function buildEvidence({
  recordType,
  recordId,
  communicationId,
  investigationId,
  evidenceSummary
}) {
  const references = [];

  if (communicationId) {
    references.push(`Communication #${communicationId}`);
  }

  if (investigationId) {
    references.push(`Investigation #${investigationId}`);
  }

  if (recordType === "work_item") {
    references.push(`Work Item #${recordId}`);
  }

  return {
    summary:
      evidenceSummary ||
      (references.length
        ? `Source record: ${references.join(" · ")}`
        : "No separate evidence summary has been recorded yet."),
    sourceReferences: references
  };
}

function buildClientWorkspaceHref(clientCode) {
  const code = String(clientCode || "").trim();

  return code
    ? `clients.html?client=${encodeURIComponent(code)}`
    : "clients.html";
}

function buildWorkHref({
  clientCode,
  recordType,
  recordId,
  investigationId
}) {
  const params = new URLSearchParams();

  if (clientCode) {
    params.set("client", clientCode);
  }

  if (recordType === "investigation") {
    params.set("investigation", String(recordId));
  } else {
    params.set("workItem", String(recordId));

    if (investigationId) {
      params.set("investigation", String(investigationId));
    }
  }

  const query = params.toString();

  return query ? `work.html?${query}` : "work.html";
}

/* =========================================================
   Helpers
   ========================================================= */

function normalizedStatus(column, fallback) {
  return `
    LOWER(
      REPLACE(
        REPLACE(
          COALESCE(${column}, '${fallback}'),
          '-',
          '_'
        ),
        ' ',
        '_'
      )
    )
  `;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function nullableText(value) {
  const text = cleanText(value);
  return text || null;
}

function nullablePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0
    ? number
    : null;
}
