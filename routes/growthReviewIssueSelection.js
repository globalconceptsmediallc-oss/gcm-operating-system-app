/* =========================================================
   Global Concepts Media Operating System
   File: routes/growthReviewIssueSelection.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Sprint: Existing Client Growth Review — Human Issue Selection
   Purpose:
   Persist the consultant's explicit Include / Exclude decision for an
   operational record in one exact client review period.

   Rules:
   - Human decision only. No AI selection or recommendation.
   - A decision is scoped by client + exact period + operational record.
   - Changing a decision updates that same scoped selection.
   - Underlying Investigation / Work Item evidence is never changed.
   - This route does not run Growth Intelligence or generate client-facing copy.
   ========================================================= */

import { getDatabase, rowsOf } from "../shared/database.js";
import { clean, jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";

export const GROWTH_REVIEW_ISSUE_SELECTION_ACTION = "growth-review-issue-selection";
export const GROWTH_REVIEW_ISSUE_SELECTION_VERSION = "1.0.0";

const PERIOD_TYPES = new Set(["monthly","quarterly","yearly","custom"]);
const RECORD_TYPES = new Set(["investigation","work_item"]);
const SELECTIONS = new Set(["include","exclude"]);

export async function handleGrowthReviewIssueSelection(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok:false,
      requestId,
      action:GROWTH_REVIEW_ISSUE_SELECTION_ACTION,
      growthReviewIssueSelectionVersion:GROWTH_REVIEW_ISSUE_SELECTION_VERSION,
      error:"The production D1 database binding is unavailable."
    },503);
  }

  const operation = clean(body?.operation || "list").toLowerCase();

  try {
    const clientCode = clean(body?.clientCode || body?.client || "");
    const periodStart = isoDate(body?.periodStart || body?.start);
    const periodEnd = isoDate(body?.periodEnd || body?.end);
    const periodType = normalizePeriodType(body?.periodType || body?.period || "custom");

    if (!clientCode) {
      return invalid(requestId,"A clientCode is required.");
    }
    if (!periodStart || !periodEnd || periodEnd < periodStart) {
      return invalid(requestId,"A valid periodStart and periodEnd are required.");
    }

    const client = await db.prepare(`
      SELECT id, client_code, name
      FROM clients
      WHERE client_code = ? COLLATE NOCASE
      LIMIT 1
    `).bind(clientCode).first();

    if (!client) {
      return jsonResponse({
        ok:false,
        requestId,
        action:GROWTH_REVIEW_ISSUE_SELECTION_ACTION,
        growthReviewIssueSelectionVersion:GROWTH_REVIEW_ISSUE_SELECTION_VERSION,
        error:`Client "${clientCode}" was not found.`
      },404);
    }

    if (operation === "list") {
      const result = await db.prepare(`
        SELECT
          id,
          client_id,
          review_period_type,
          period_start,
          period_end,
          record_type,
          record_id,
          selection,
          decision_note,
          decided_by,
          decided_at,
          created_at,
          updated_at
        FROM growth_review_issue_selections
        WHERE client_id = ?
          AND period_start = ?
          AND period_end = ?
        ORDER BY record_type ASC, record_id ASC
      `).bind(client.id,periodStart,periodEnd).all();

      return jsonResponse({
        ok:true,
        requestId,
        action:GROWTH_REVIEW_ISSUE_SELECTION_ACTION,
        operation:"list",
        growthReviewIssueSelectionVersion:GROWTH_REVIEW_ISSUE_SELECTION_VERSION,
        client:{
          id:Number(client.id),
          clientCode:clean(client.client_code),
          name:clean(client.name)
        },
        reviewPeriod:{
          type:periodType,
          start:periodStart,
          end:periodEnd
        },
        selections:rowsOf(result).map(normalizeRow),
        writesPerformed:0
      });
    }

    if (operation !== "save") {
      return invalid(requestId,"Supported operations are list and save.");
    }

    const recordType = normalizeRecordType(body?.recordType);
    const recordId = positiveInteger(body?.recordId);
    const selection = clean(body?.selection).toLowerCase();
    const decidedBy = clean(body?.decidedBy || "Andy") || "Andy";

    if (!recordType) {
      return invalid(requestId,"recordType must be investigation or work_item.");
    }
    if (!recordId) {
      return invalid(requestId,"A positive recordId is required.");
    }
    if (!SELECTIONS.has(selection)) {
      return invalid(requestId,"selection must be include or exclude.");
    }

    const table = recordType === "investigation" ? "investigations" : "work_items";
    const record = await db.prepare(`
      SELECT id, client_id, title, status
      FROM ${table}
      WHERE id = ? AND client_id = ?
      LIMIT 1
    `).bind(recordId,client.id).first();

    if (!record) {
      return jsonResponse({
        ok:false,
        requestId,
        action:GROWTH_REVIEW_ISSUE_SELECTION_ACTION,
        operation:"save",
        growthReviewIssueSelectionVersion:GROWTH_REVIEW_ISSUE_SELECTION_VERSION,
        error:`The ${recordType} #${recordId} is not owned by ${clean(client.name)||clientCode}.`,
        writesPerformed:0
      },404);
    }

    await db.prepare(`
      INSERT INTO growth_review_issue_selections (
        client_id,
        review_period_type,
        period_start,
        period_end,
        record_type,
        record_id,
        selection,
        decision_note,
        decided_by,
        decided_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (client_id, period_start, period_end, record_type, record_id)
      DO UPDATE SET
        review_period_type = excluded.review_period_type,
        selection = excluded.selection,
        decision_note = excluded.decision_note,
        decided_by = excluded.decided_by,
        decided_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      client.id,
      periodType,
      periodStart,
      periodEnd,
      recordType,
      recordId,
      selection,
      clean(body?.decisionNote || ""),
      decidedBy
    ).run();

    const saved = await db.prepare(`
      SELECT
        id,
        client_id,
        review_period_type,
        period_start,
        period_end,
        record_type,
        record_id,
        selection,
        decision_note,
        decided_by,
        decided_at,
        created_at,
        updated_at
      FROM growth_review_issue_selections
      WHERE client_id = ?
        AND period_start = ?
        AND period_end = ?
        AND record_type = ?
        AND record_id = ?
      LIMIT 1
    `).bind(client.id,periodStart,periodEnd,recordType,recordId).first();

    return jsonResponse({
      ok:true,
      requestId,
      action:GROWTH_REVIEW_ISSUE_SELECTION_ACTION,
      operation:"save",
      growthReviewIssueSelectionVersion:GROWTH_REVIEW_ISSUE_SELECTION_VERSION,
      client:{
        id:Number(client.id),
        clientCode:clean(client.client_code),
        name:clean(client.name)
      },
      operationalRecord:{
        type:recordType,
        id:Number(record.id),
        title:clean(record.title),
        status:clean(record.status)
      },
      selection:normalizeRow(saved),
      writesPerformed:1
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:GROWTH_REVIEW_ISSUE_SELECTION_ACTION,
      stage:"growth_review_issue_selection",
      error
    });

    return jsonResponse({
      ok:false,
      requestId,
      action:GROWTH_REVIEW_ISSUE_SELECTION_ACTION,
      growthReviewIssueSelectionVersion:GROWTH_REVIEW_ISSUE_SELECTION_VERSION,
      error:"Growth Review Issue Selection could not complete the request.",
      details:safeErrorMessage(error),
      writesPerformed:0
    },500);
  }
}

function invalid(requestId,error) {
  return jsonResponse({
    ok:false,
    requestId,
    action:GROWTH_REVIEW_ISSUE_SELECTION_ACTION,
    growthReviewIssueSelectionVersion:GROWTH_REVIEW_ISSUE_SELECTION_VERSION,
    error,
    writesPerformed:0
  },400);
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    id:Number(row.id),
    clientId:Number(row.client_id),
    reviewPeriodType:clean(row.review_period_type),
    periodStart:clean(row.period_start),
    periodEnd:clean(row.period_end),
    recordType:clean(row.record_type),
    recordId:Number(row.record_id),
    selection:clean(row.selection),
    decisionNote:clean(row.decision_note) || null,
    decidedBy:clean(row.decided_by),
    decidedAt:clean(row.decided_at),
    createdAt:clean(row.created_at),
    updatedAt:clean(row.updated_at)
  };
}

function isoDate(value) {
  const text = clean(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const date=new Date(Date.UTC(year,month-1,day));
  if (
    date.getUTCFullYear()!==year ||
    date.getUTCMonth()!==month-1 ||
    date.getUTCDate()!==day
  ) return "";
  return text;
}

function normalizePeriodType(value) {
  const periodType = clean(value).toLowerCase();
  return PERIOD_TYPES.has(periodType) ? periodType : "custom";
}

function normalizeRecordType(value) {
  const recordType = clean(value).toLowerCase().replace(/[-\s]+/g,"_");
  return RECORD_TYPES.has(recordType) ? recordType : "";
}

function positiveInteger(value) {
  const n=Number(value);
  return Number.isInteger(n)&&n>0?n:null;
}
