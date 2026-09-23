/* =========================================================
   Global Concepts Media Operating System
   File: routes/emailIntakeDisposition.js
   Version: 1.3.0
   Status: Production Road-Test Candidate
   Sprint: Universal Email Intake — Human Disposition
   Purpose:
   Apply the operator's explicit disposition to a durable email_intake record
   without calling Gmail and without deleting source evidence from D1.

   Changes — 1.3.0:
   - Adds Monitoring disposition.
   - Monitoring requires an explicit client selection.
   - Creates exactly one activity_records Proof/history row.
   - Creates no Communication, Investigation, or Work Item.
   - Links the activity record back to email_intake and marks the intake processed.

   Changes — 1.2.0:
   - Adds Information disposition.
   - Information requires an explicit client selection.
   - Creates exactly one Communication/history record.
   - Creates no Activity Record, Investigation, or Work Item.
   - Links the Communication back to email_intake and marks the intake processed.

   Safety update — 1.1.0:
   - Requires an explicit backend confirmation token before any no-action write.
   - A missing or incorrect confirmation is rejected before D1 is read or changed.
   - Prevents refreshes, stale handlers, or accidental single requests from processing intake.

   Phase 1 behavior:
   - Delete — No Action Required preserves the intake row and creates 0 downstream records.
   - Information preserves the intake row and creates exactly 1 Communication.
   ========================================================= */

import { ACTIONS } from "../shared/config.js";
import { getDatabase } from "../shared/database.js";
import { jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";

export const EMAIL_INTAKE_DISPOSITION_VERSION = "1.3.0";
const UNIVERSAL_INTAKE_SOURCE = "Universal Email Intake";

export async function handleEmailIntakeDisposition(body, env, requestId) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
      error:"The production D1 binding is unavailable."
    },503);
  }

  const intakeId = Number(body?.intakeId);
  const workspaceKey = clean(body?.workspaceKey) || "gcm";
  const disposition = clean(body?.disposition).toLowerCase();

  if (!Number.isInteger(intakeId) || intakeId <= 0) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
      error:"A valid intakeId is required."
    },400);
  }

  if (disposition === "delete") {
    const confirmed = body?.confirmed === true;
    const confirmation = clean(body?.confirmation).toLowerCase();

    if (!confirmed || confirmation !== "delete-no-action-required") {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
        error:"Explicit confirmation is required before Delete — No Action Required can be saved."
      },400);
    }

    return handleDeleteNoAction({
      db,
      intakeId,
      workspaceKey,
      requestId
    });
  }

  if (disposition === "information") {
    return handleInformation({
      db,
      intakeId,
      workspaceKey,
      clientId:Number(body?.clientId),
      owner:clean(body?.owner) || "Andrew",
      requestId
    });
  }

  if (disposition === "monitoring") {
    return handleMonitoring({
      db,
      intakeId,
      workspaceKey,
      clientId:Number(body?.clientId),
      owner:clean(body?.owner) || "Andrew",
      requestId
    });
  }

  return jsonResponse({
    ok:false,
    requestId,
    action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
    error:"Supported dispositions in this phase are Delete — No Action Required, Information, and Monitoring."
  },400);
}

async function handleDeleteNoAction({
  db,
  intakeId,
  workspaceKey,
  requestId
}) {
  try {
    const existing = await loadIntake(db, intakeId, workspaceKey);

    if (!existing) {
      return notFoundResponse(requestId, intakeId);
    }

    if (
      existing.processing_status === "processed" &&
      existing.disposition === "delete"
    ) {
      return deleteSuccess({
        requestId,
        intakeId,
        workspaceKey,
        duplicate:true
      });
    }

    if (existing.processing_status !== "ready_for_review") {
      return notReadyResponse(requestId, intakeId, existing);
    }

    if (hasDownstreamLink(existing)) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
        error:"No-action disposition was blocked because downstream OS records are already linked to this intake record."
      },409);
    }

    const update = await db.prepare(`
      UPDATE email_intake
      SET
        processing_status = 'processed',
        disposition = 'delete',
        classification_source = 'human_operator',
        processed_at = CURRENT_TIMESTAMP,
        failure_stage = NULL,
        failure_message = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND workspace_key = ?
        AND processing_status = 'ready_for_review'
        AND communication_id IS NULL
        AND activity_record_id IS NULL
        AND investigation_id IS NULL
        AND work_item_id IS NULL
    `).bind(intakeId, workspaceKey).run();

    if (Number(update?.meta?.changes || 0) !== 1) {
      return staleResponse(requestId);
    }

    return deleteSuccess({
      requestId,
      intakeId,
      workspaceKey,
      duplicate:false
    });
  } catch (error) {
    return dispositionFailure({
      requestId,
      stage:"d1_email_intake_delete",
      error
    });
  }
}

async function handleInformation({
  db,
  intakeId,
  workspaceKey,
  clientId,
  owner,
  requestId
}) {
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
      error:"Choose a client before saving this intake as Information."
    },400);
  }

  try {
    const existing = await loadIntake(db, intakeId, workspaceKey);

    if (!existing) {
      return notFoundResponse(requestId, intakeId);
    }

    if (
      existing.processing_status === "processed" &&
      existing.disposition === "information" &&
      existing.communication_id
    ) {
      return informationSuccess({
        requestId,
        intakeId,
        workspaceKey,
        clientId:Number(existing.client_id || clientId),
        communicationId:Number(existing.communication_id),
        duplicate:true,
        communicationCreated:false
      });
    }

    if (existing.processing_status !== "ready_for_review") {
      return notReadyResponse(requestId, intakeId, existing);
    }

    if (hasDownstreamLink(existing)) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
        error:"Information disposition was blocked because downstream OS records are already linked to this intake record."
      },409);
    }

    const client = await db.prepare(`
      SELECT id, client_code, name
      FROM clients
      WHERE id = ?
      LIMIT 1
    `).bind(clientId).first();

    if (!client) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
        error:`Client #${clientId} was not found.`
      },404);
    }

    const externalId = `email-intake:${workspaceKey}:${intakeId}`;
    let communication = await db.prepare(`
      SELECT id
      FROM communications
      WHERE source = ?
        AND external_id = ?
      LIMIT 1
    `).bind(UNIVERSAL_INTAKE_SOURCE, externalId).first();

    let communicationCreated = false;

    if (!communication?.id) {
      const rawContent = clean(existing.body_text) || clean(existing.subject) || "(No content)";
      const summary = buildInformationSummary(existing);
      const analysisJson = JSON.stringify({
        source:UNIVERSAL_INTAKE_SOURCE,
        route:"information",
        intakeId,
        workspaceKey,
        operator:"human",
        sender:{
          name:existing.from_name || null,
          address:existing.from_address || null
        },
        evidenceRetained:true,
        recommendedRoutes:{
          saveCommunication:true,
          createInvestigation:false,
          createWorkItem:false,
          replyRequired:false
        }
      });

      await db.prepare(`
        INSERT INTO communications (
          client_id, external_id, occurred_at, direction, source, category,
          subject, raw_content, ai_summary, ai_analysis_json,
          operational_decision, status, requires_investigation,
          owner, minutes_spent, notes
        ) VALUES (?, ?, ?, 'incoming', ?, 'Information', ?, ?, ?, ?, 'information', 'analyzed', 0, ?, 0, ?)
      `).bind(
        Number(client.id),
        externalId,
        existing.received_at || new Date().toISOString(),
        UNIVERSAL_INTAKE_SOURCE,
        clean(existing.subject) || "(No subject)",
        rawContent,
        summary,
        analysisJson,
        owner,
        [
          `Universal Email Intake #${intakeId}`,
          `Client: ${client.name || client.client_code || client.id}`,
          "Human disposition: Information",
          "Source evidence retained in email_intake.",
          "No Investigation created.",
          "No Work Item created."
        ].join("\n")
      ).run();

      communication = await db.prepare(`
        SELECT id
        FROM communications
        WHERE source = ?
          AND external_id = ?
        ORDER BY id DESC
        LIMIT 1
      `).bind(UNIVERSAL_INTAKE_SOURCE, externalId).first();

      communicationCreated = true;
    }

    const communicationId = Number(communication?.id);

    if (!Number.isInteger(communicationId) || communicationId <= 0) {
      throw new Error("The Communication was not available after the Information save.");
    }

    const classificationJson = JSON.stringify({
      disposition:"information",
      operator:"human",
      clientId:Number(client.id),
      communicationId
    });

    const update = await db.prepare(`
      UPDATE email_intake
      SET
        processing_status = 'processed',
        disposition = 'information',
        classification_source = 'human_operator',
        classification_json = ?,
        classification_confidence = 'high',
        client_id = ?,
        communication_id = ?,
        processed_at = CURRENT_TIMESTAMP,
        failure_stage = NULL,
        failure_message = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND workspace_key = ?
        AND processing_status = 'ready_for_review'
        AND activity_record_id IS NULL
        AND investigation_id IS NULL
        AND work_item_id IS NULL
    `).bind(
      classificationJson,
      Number(client.id),
      communicationId,
      intakeId,
      workspaceKey
    ).run();

    if (Number(update?.meta?.changes || 0) !== 1) {
      const reconciled = await loadIntake(db, intakeId, workspaceKey);
      if (
        reconciled?.processing_status === "processed" &&
        reconciled?.disposition === "information" &&
        Number(reconciled?.communication_id) === communicationId
      ) {
        return informationSuccess({
          requestId,
          intakeId,
          workspaceKey,
          clientId:Number(client.id),
          communicationId,
          duplicate:true,
          communicationCreated:false
        });
      }
      return staleResponse(requestId);
    }

    return informationSuccess({
      requestId,
      intakeId,
      workspaceKey,
      clientId:Number(client.id),
      communicationId,
      duplicate:false,
      communicationCreated
    });
  } catch (error) {
    return dispositionFailure({
      requestId,
      stage:"d1_email_intake_information",
      error
    });
  }
}

async function handleMonitoring({
  db,
  intakeId,
  workspaceKey,
  clientId,
  owner,
  requestId
}) {
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return jsonResponse({
      ok:false,
      requestId,
      action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
      error:"Choose a client before saving this intake as Monitoring."
    },400);
  }

  try {
    const existing = await loadIntake(db, intakeId, workspaceKey);

    if (!existing) {
      return notFoundResponse(requestId, intakeId);
    }

    if (
      existing.processing_status === "processed" &&
      existing.disposition === "monitoring" &&
      existing.activity_record_id
    ) {
      return monitoringSuccess({
        requestId,
        intakeId,
        workspaceKey,
        clientId:Number(existing.client_id || clientId),
        activityRecordId:Number(existing.activity_record_id),
        duplicate:true,
        activityCreated:false
      });
    }

    if (existing.processing_status !== "ready_for_review") {
      return notReadyResponse(requestId, intakeId, existing);
    }

    if (hasDownstreamLink(existing)) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
        error:"Monitoring disposition was blocked because downstream OS records are already linked to this intake record."
      },409);
    }

    const client = await db.prepare(`
      SELECT id, client_code, name
      FROM clients
      WHERE id = ?
      LIMIT 1
    `).bind(clientId).first();

    if (!client) {
      return jsonResponse({
        ok:false,
        requestId,
        action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
        error:`Client #${clientId} was not found.`
      },404);
    }

    const sourceReference = `email-intake:${workspaceKey}:${intakeId}`;
    let activity = await db.prepare(`
      SELECT id
      FROM activity_records
      WHERE source_reference = ?
      LIMIT 1
    `).bind(sourceReference).first();

    let activityCreated = false;

    if (!activity?.id) {
      const activityDate = normalizeActivityDate(existing.received_at);
      const subject = clean(existing.subject) || "Monitoring update";
      const body = clean(existing.body_text);
      const notes = [
        `Universal Email Intake #${intakeId}`,
        `Client: ${client.name || client.client_code || client.id}`,
        "Human disposition: Monitoring",
        existing.from_address ? `Sender: ${existing.from_address}` : "",
        body ? `Source evidence excerpt: ${body.slice(0,1200)}` : "",
        "Source evidence retained in email_intake.",
        "No Communication created.",
        "No Investigation created.",
        "No Work Item created."
      ].filter(Boolean).join("\n");

      const result = await db.prepare(`
        INSERT INTO activity_records (
          client_id, activity_date, category, activity, evidence_type, evidence_reference,
          status, owner, time_minutes, expected_impact, actual_impact, notes, source_type,
          source_reference, priority, win, created_at, updated_at
        ) VALUES (?, ?, 'Monitoring Intelligence', ?, 'Email', ?, 'completed', ?, 0,
                  'Monitoring / trend evidence', ?, ?, 'email_intake_monitoring', ?, 'Low', 0,
                  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        Number(client.id),
        activityDate,
        subject,
        sourceReference,
        owner,
        body.slice(0,800),
        notes,
        sourceReference
      ).run();

      activity = {id:Number(result?.meta?.last_row_id || 0)};
      activityCreated = true;
    }

    const activityRecordId = Number(activity?.id);

    if (!Number.isInteger(activityRecordId) || activityRecordId <= 0) {
      throw new Error("The Monitoring activity record was not available after save.");
    }

    const classificationJson = JSON.stringify({
      disposition:"monitoring",
      operator:"human",
      clientId:Number(client.id),
      activityRecordId
    });

    const update = await db.prepare(`
      UPDATE email_intake
      SET
        processing_status = 'processed',
        disposition = 'monitoring',
        classification_source = 'human_operator',
        classification_json = ?,
        classification_confidence = 'high',
        client_id = ?,
        activity_record_id = ?,
        processed_at = CURRENT_TIMESTAMP,
        failure_stage = NULL,
        failure_message = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND workspace_key = ?
        AND processing_status = 'ready_for_review'
        AND communication_id IS NULL
        AND investigation_id IS NULL
        AND work_item_id IS NULL
    `).bind(
      classificationJson,
      Number(client.id),
      activityRecordId,
      intakeId,
      workspaceKey
    ).run();

    if (Number(update?.meta?.changes || 0) !== 1) {
      const reconciled = await loadIntake(db, intakeId, workspaceKey);
      if (
        reconciled?.processing_status === "processed" &&
        reconciled?.disposition === "monitoring" &&
        Number(reconciled?.activity_record_id) === activityRecordId
      ) {
        return monitoringSuccess({
          requestId,
          intakeId,
          workspaceKey,
          clientId:Number(client.id),
          activityRecordId,
          duplicate:true,
          activityCreated:false
        });
      }
      return staleResponse(requestId);
    }

    return monitoringSuccess({
      requestId,
      intakeId,
      workspaceKey,
      clientId:Number(client.id),
      activityRecordId,
      duplicate:false,
      activityCreated
    });
  } catch (error) {
    return dispositionFailure({
      requestId,
      stage:"d1_email_intake_monitoring",
      error
    });
  }
}

async function loadIntake(db, intakeId, workspaceKey) {
  return db.prepare(`
    SELECT
      id,
      workspace_key,
      received_at,
      from_address,
      from_name,
      subject,
      body_text,
      processing_status,
      disposition,
      client_id,
      communication_id,
      activity_record_id,
      investigation_id,
      work_item_id
    FROM email_intake
    WHERE id = ?
      AND workspace_key = ?
    LIMIT 1
  `).bind(intakeId, workspaceKey).first();
}

function hasDownstreamLink(record) {
  return [
    record?.communication_id,
    record?.activity_record_id,
    record?.investigation_id,
    record?.work_item_id
  ].some(value => value !== null && value !== undefined);
}

function buildInformationSummary(record) {
  const body = clean(record?.body_text).replace(/\s+/g," ");
  if (body) return body.slice(0,800);
  return clean(record?.subject) || "Inbound email saved as Information.";
}

function monitoringSuccess({
  requestId,
  intakeId,
  workspaceKey,
  clientId,
  activityRecordId,
  duplicate,
  activityCreated
}) {
  return jsonResponse({
    ok:true,
    requestId,
    action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
    emailIntakeDispositionVersion:EMAIL_INTAKE_DISPOSITION_VERSION,
    intakeId,
    workspaceKey,
    disposition:"monitoring",
    processingStatus:"processed",
    evidenceRetained:true,
    duplicate:Boolean(duplicate),
    clientId,
    activityRecordId,
    writesPerformed:activityCreated ? 1 : 0,
    communicationsCreated:0,
    activityRecordsCreated:activityCreated ? 1 : 0,
    investigationsCreated:0,
    workItemsCreated:0
  });
}

function deleteSuccess({
  requestId,
  intakeId,
  workspaceKey,
  duplicate
}) {
  return jsonResponse({
    ok:true,
    requestId,
    action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
    emailIntakeDispositionVersion:EMAIL_INTAKE_DISPOSITION_VERSION,
    intakeId,
    workspaceKey,
    disposition:"delete",
    processingStatus:"processed",
    evidenceRetained:true,
    duplicate:Boolean(duplicate),
    writesPerformed:0,
    communicationsCreated:0,
    activityRecordsCreated:0,
    investigationsCreated:0,
    workItemsCreated:0
  });
}

function informationSuccess({
  requestId,
  intakeId,
  workspaceKey,
  clientId,
  communicationId,
  duplicate,
  communicationCreated
}) {
  return jsonResponse({
    ok:true,
    requestId,
    action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
    emailIntakeDispositionVersion:EMAIL_INTAKE_DISPOSITION_VERSION,
    intakeId,
    workspaceKey,
    disposition:"information",
    processingStatus:"processed",
    evidenceRetained:true,
    duplicate:Boolean(duplicate),
    clientId,
    communicationId,
    writesPerformed:communicationCreated ? 1 : 0,
    communicationsCreated:communicationCreated ? 1 : 0,
    activityRecordsCreated:0,
    investigationsCreated:0,
    workItemsCreated:0
  });
}

function notFoundResponse(requestId, intakeId) {
  return jsonResponse({
    ok:false,
    requestId,
    action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
    error:`Email intake record #${intakeId} was not found.`
  },404);
}

function notReadyResponse(requestId, intakeId, record) {
  return jsonResponse({
    ok:false,
    requestId,
    action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
    error:`Email intake record #${intakeId} is not ready for review.`,
    processingStatus:record?.processing_status || null,
    disposition:record?.disposition || null
  },409);
}

function staleResponse(requestId) {
  return jsonResponse({
    ok:false,
    requestId,
    action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
    error:"The intake record changed before the disposition could be saved. Refresh Morning Command and review it again."
  },409);
}

function dispositionFailure({
  requestId,
  stage,
  error
}) {
  logWorkerError({
    requestId,
    route:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
    stage,
    error
  });

  return jsonResponse({
    ok:false,
    requestId,
    action:ACTIONS.ROUTE_EMAIL_INTAKE_DISPOSITION,
    error:safeErrorMessage(error)
  },500);
}

function normalizeActivityDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0,10)
    : date.toISOString().slice(0,10);
}

function clean(value) {
  return String(value ?? "").trim();
}
