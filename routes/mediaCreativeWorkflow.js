/* =========================================================
   Global Concepts Media Operating System
   File: routes/mediaCreativeWorkflow.js
   Version: 1.1.1
   Status: Production Road-Test Candidate
   Source: Production routes/mediaCreativeWorkflow.js 1.0.0
   Sprint: Media → Calendar Natural Workflow
   Purpose:
   Preserve the existing Media creative/traffic workflow and add durable
   production sessions that connect scheduled Media work to Calendar.

   Change Notes — 1.1.1
   - Preserves every existing creative, assignment, traffic-package, and
     station-confirmation operation.
   - Adds durable productionSessions and productionSessionCreatives to
     get_creative_workflow.
   - Adds save_production_session.
   - Adds complete_production_session.
   - One session may link multiple creatives for the same client.
   - Saving a session automatically creates/updates one durable
     calendar_appointments record.
   - Completing a session completes its connected Calendar appointment.
   - Adds Media history entries to linked creatives.
   - Fixes Calendar UPSERT matching for the existing partial UNIQUE source_key index.
   - Makes new-session saves retry-safe by recovering the same open client/title/date
     session after a partial failure instead of creating a duplicate.
   ========================================================= */

import { VERSION, ACTIONS } from "../shared/config.js";
import {
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "../shared/http.js";
import {
  getDatabase,
  rowsOf
} from "../shared/database.js";

export const MEDIA_CREATIVE_WORKFLOW_VERSION = "1.1.1";

export const MEDIA_CREATIVE_OPERATIONS = Object.freeze([
  "get_creative_workflow",
  "save_creative",
  "append_creative_history",
  "save_creative_assignments",
  "save_traffic_package",
  "mark_traffic_package_sent",
  "record_station_confirmation",
  "save_production_session",
  "complete_production_session"
]);

const BUSINESS_TIME_ZONE = "America/New_York";
const MEDIA_SESSION_SOURCE = "media_production_session";
const MEDIA_SESSION_STATUSES = new Set([
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "canceled"
]);

export async function handleMediaCreativeWorkflow(
  operation,
  body,
  env,
  requestId
) {
  const db = getDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    return reply(
      {
        ok: false,
        error: "D1 is unavailable."
      },
      503
    );
  }

  try {
    if (operation === "get_creative_workflow") {
      return getWorkflow(db, requestId);
    }

    if (operation === "save_creative") {
      return saveCreative(body, db, requestId);
    }

    if (operation === "append_creative_history") {
      return addHistory(body, db, requestId);
    }

    if (operation === "save_creative_assignments") {
      return saveAssignments(body, db, requestId);
    }

    if (operation === "save_traffic_package") {
      return savePackage(body, db, requestId);
    }

    if (operation === "mark_traffic_package_sent") {
      return markSent(body, db, requestId);
    }

    if (operation === "record_station_confirmation") {
      return saveConfirmation(body, db, requestId);
    }

    if (operation === "save_production_session") {
      return saveProductionSession(body, db, requestId);
    }

    if (operation === "complete_production_session") {
      return completeProductionSession(body, db, requestId);
    }

    return reply(
      {
        ok: false,
        error: `Unsupported Media creative operation: ${operation}`
      },
      400
    );
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.GET_MEDIA_OPERATIONS,
      stage: `media_creative_${operation}`,
      error
    });

    return reply(
      {
        ok: false,
        error:
          "The Media creative workflow could not complete the requested operation.",
        details: safeErrorMessage(error)
      },
      500
    );
  }

  function reply(payload, status = 200) {
    return jsonResponse(
      {
        requestId,
        action: ACTIONS.GET_MEDIA_OPERATIONS,
        version: VERSION,
        mediaCreativeWorkflowVersion: MEDIA_CREATIVE_WORKFLOW_VERSION,
        ...payload
      },
      status
    );
  }
}

/* =========================================================
   Read complete Media workflow
   ========================================================= */

async function getWorkflow(db, requestId) {
  const [
    clientsR,
    placementsR,
    creativesR,
    assignR,
    historyR,
    packagesR,
    packageAssignR,
    confirmR,
    sessionsR,
    sessionCreativesR
  ] = await Promise.all([
    db.prepare(`
      SELECT id, client_code, name, status
      FROM clients
      WHERE LOWER(COALESCE(status, 'active'))
        NOT IN ('inactive', 'archived', 'deleted')
      ORDER BY LOWER(name), id
    `).all(),

    db.prepare(`
      SELECT
        mr.id,
        mr.client_id,
        c.client_code,
        c.name client_name,
        mr.media_type,
        mr.market,
        mr.outlet_name,
        mr.campaign_name,
        mr.start_date,
        mr.end_date,
        mr.status,
        mr.traffic_status,
        mr.confirmation_status
      FROM media_records mr
      JOIN clients c ON c.id = mr.client_id
      ORDER BY
        LOWER(c.name),
        LOWER(COALESCE(mr.market, '')),
        LOWER(COALESCE(mr.outlet_name, '')),
        mr.id
    `).all(),

    db.prepare(`
      SELECT
        mc.*,
        c.client_code,
        c.name client_name
      FROM media_creatives mc
      JOIN clients c ON c.id = mc.client_id
      ORDER BY mc.updated_at DESC, mc.id DESC
    `).all(),

    db.prepare(`
      SELECT
        a.*,
        mc.client_id,
        mr.campaign_name,
        mr.start_date placement_start_date,
        mr.end_date placement_end_date,
        mr.status placement_status
      FROM media_creative_assignments a
      JOIN media_creatives mc ON mc.id = a.creative_id
      LEFT JOIN media_records mr ON mr.id = a.media_record_id
      ORDER BY a.creative_id, a.id
    `).all(),

    db.prepare(`
      SELECT *
      FROM media_creative_history
      ORDER BY creative_id, created_at DESC, id DESC
    `).all(),

    db.prepare(`
      SELECT *
      FROM media_traffic_packages
      ORDER BY creative_id, updated_at DESC, id DESC
    `).all(),

    db.prepare(`
      SELECT *
      FROM media_traffic_package_assignments
      ORDER BY traffic_package_id, assignment_id
    `).all(),

    db.prepare(`
      SELECT
        ce.*,
        cl.traffic_package_id
      FROM media_confirmation_evidence ce
      JOIN media_confirmation_links cl
        ON cl.confirmation_id = ce.id
      ORDER BY ce.received_at DESC, ce.id DESC
    `).all(),

    db.prepare(`
      SELECT
        s.*,
        c.client_code,
        c.name client_name,
        ca.id calendar_appointment_id,
        ca.status calendar_status
      FROM media_production_sessions s
      JOIN clients c ON c.id = s.client_id
      LEFT JOIN calendar_appointments ca
        ON ca.source_key = ('media_production_session:' || s.id)
       AND ca.deleted_at IS NULL
      ORDER BY datetime(s.scheduled_at) DESC, s.id DESC
    `).all(),

    db.prepare(`
      SELECT
        l.session_id,
        l.creative_id,
        mc.creative_name
      FROM media_production_session_creatives l
      JOIN media_creatives mc ON mc.id = l.creative_id
      ORDER BY l.session_id, LOWER(mc.creative_name), l.creative_id
    `).all()
  ]);

  return jsonResponse({
    ok: true,
    requestId,
    action: ACTIONS.GET_MEDIA_OPERATIONS,
    version: VERSION,
    mediaCreativeWorkflowVersion: MEDIA_CREATIVE_WORKFLOW_VERSION,
    operation: "get_creative_workflow",
    creativeWorkflow: {
      clients: rowsOf(clientsR).map(r => ({
        clientId: +r.id,
        clientCode: s(r.client_code),
        clientName: s(r.name),
        status: s(r.status)
      })),

      placements: rowsOf(placementsR).map(r => ({
        id: +r.id,
        clientId: +r.client_id,
        clientCode: s(r.client_code),
        clientName: s(r.client_name),
        mediaType: n(r.media_type),
        market: n(r.market),
        outletName: n(r.outlet_name),
        campaignName: n(r.campaign_name),
        startDate: n(r.start_date),
        endDate: n(r.end_date),
        status: n(r.status),
        trafficStatus: n(r.traffic_status),
        confirmationStatus: n(r.confirmation_status)
      })),

      creatives: rowsOf(creativesR).map(mapCreative),

      assignments: rowsOf(assignR).map(r => ({
        id: +r.id,
        creativeId: +r.creative_id,
        mediaRecordId:
          r.media_record_id == null ? null : +r.media_record_id,
        clientId: +r.client_id,
        mediaType: n(r.media_type),
        market: n(r.market),
        outletName: n(r.outlet_name),
        placementReference: n(r.placement_reference),
        campaignName: n(r.campaign_name),
        placementStartDate: n(r.placement_start_date),
        placementEndDate: n(r.placement_end_date),
        placementStatus: n(r.placement_status),
        rotationAction: n(r.rotation_action),
        assignmentStatus: n(r.assignment_status),
        rotationStartDate: n(r.rotation_start_date),
        rotationEndDate: n(r.rotation_end_date),
        notes: n(r.notes),
        createdAt: n(r.created_at),
        updatedAt: n(r.updated_at)
      })),

      history: rowsOf(historyR).map(r => ({
        id: +r.id,
        creativeId: +r.creative_id,
        entryType: n(r.entry_type),
        stage: n(r.stage),
        author: n(r.author),
        content: s(r.content),
        createdAt: n(r.created_at)
      })),

      trafficPackages: rowsOf(packagesR).map(r => ({
        id: +r.id,
        creativeId: +r.creative_id,
        toEmail: n(r.to_email),
        ccEmail: n(r.cc_email),
        subject: n(r.subject),
        bodyText: n(r.body_text),
        specialInstructions: n(r.special_instructions),
        insertionOrderReference: n(r.insertion_order_reference),
        scheduleReference: n(r.schedule_reference),
        packageStatus: n(r.package_status),
        gmailDraftId: n(r.gmail_draft_id),
        gmailThreadId: n(r.gmail_thread_id),
        sentGmailMessageId: n(r.sent_gmail_message_id),
        sentAt: n(r.sent_at),
        confirmedAt: n(r.confirmed_at),
        createdAt: n(r.created_at),
        updatedAt: n(r.updated_at)
      })),

      trafficPackageAssignments: rowsOf(packageAssignR).map(r => ({
        trafficPackageId: +r.traffic_package_id,
        assignmentId: +r.assignment_id,
        createdAt: n(r.created_at)
      })),

      confirmations: rowsOf(confirmR).map(r => ({
        id: +r.id,
        trafficPackageId: +r.traffic_package_id,
        gmailMessageId: n(r.gmail_message_id),
        gmailThreadId: n(r.gmail_thread_id),
        fromEmail: n(r.from_email),
        toEmail: n(r.to_email),
        subject: n(r.subject),
        receivedAt: n(r.received_at),
        bodyText: s(r.body_text),
        stationReceivedConfirmed:
          +r.station_received_confirmed === 1,
        stationTraffickedConfirmed:
          +r.station_trafficked_confirmed === 1,
        approvedBy: n(r.approved_by),
        approvedAt: n(r.approved_at),
        createdAt: n(r.created_at)
      })),

      productionSessions: rowsOf(sessionsR).map(r => ({
        id: +r.id,
        clientId: +r.client_id,
        clientCode: s(r.client_code),
        clientName: s(r.client_name),
        sessionType: n(r.session_type),
        title: s(r.title),
        scheduledAt: s(r.scheduled_at),
        timeZone: n(r.time_zone) || BUSINESS_TIME_ZONE,
        location: n(r.location),
        contactName: n(r.contact_name),
        notes: n(r.notes),
        status: n(r.status),
        calendarAppointmentId:
          r.calendar_appointment_id == null
            ? null
            : +r.calendar_appointment_id,
        calendarStatus: n(r.calendar_status),
        createdAt: n(r.created_at),
        updatedAt: n(r.updated_at)
      })),

      productionSessionCreatives:
        rowsOf(sessionCreativesR).map(r => ({
          sessionId: +r.session_id,
          creativeId: +r.creative_id,
          creativeName: s(r.creative_name)
        }))
    }
  });
}

/* =========================================================
   Existing Creative Operations — preserved
   ========================================================= */

async function saveCreative(body, db, requestId) {
  const x = body?.creative || {};
  const id = pos(body?.creativeId);
  const clientId = pos(x.clientId ?? body?.clientId);
  const name = req(x.creativeName);

  if (!clientId || !name) {
    return response(
      requestId,
      {
        ok: false,
        error: "Creative save requires clientId and creativeName."
      },
      400
    );
  }

  if (
    !await db.prepare(`
      SELECT id
      FROM clients
      WHERE id = ?
      LIMIT 1
    `).bind(clientId).first()
  ) {
    return response(
      requestId,
      {
        ok: false,
        error: `Client ${clientId} was not found.`
      },
      404
    );
  }

  const v = [
    clientId,
    name,
    opt(x.mediaType) || "Radio",
    pos(x.lengthSeconds),
    opt(x.isci),
    opt(x.currentStage) || "Idea / Direction",
    opt(x.status) || "draft",
    opt(x.ideaDirection),
    opt(x.workingScript),
    opt(x.approvedScript),
    opt(x.finalScript),
    opt(x.voiceTalent),
    opt(x.recordingStatus),
    dateOnly(x.recordingReceivedDate),
    opt(x.recordingReviewNotes),
    opt(x.productionStatus),
    opt(x.finalAudioFileName),
    opt(x.coopScript),
    opt(x.owner) || "Andy"
  ];

  if (id) {
    if (
      !await db.prepare(`
        SELECT id
        FROM media_creatives
        WHERE id = ?
        LIMIT 1
      `).bind(id).first()
    ) {
      return response(
        requestId,
        {
          ok: false,
          error: `Creative ${id} was not found.`
        },
        404
      );
    }

    await db.prepare(`
      UPDATE media_creatives
      SET
        client_id = ?,
        creative_name = ?,
        media_type = ?,
        length_seconds = ?,
        isci = ?,
        current_stage = ?,
        status = ?,
        idea_direction = ?,
        working_script = ?,
        approved_script = ?,
        final_script = ?,
        voice_talent = ?,
        recording_status = ?,
        recording_received_date = ?,
        recording_review_notes = ?,
        production_status = ?,
        final_audio_file_name = ?,
        coop_script = ?,
        owner = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(...v, id).run();

    return response(requestId, {
      ok: true,
      operation: "save_creative",
      creativeId: id,
      created: false
    });
  }

  const r = await db.prepare(`
    INSERT INTO media_creatives (
      client_id,
      creative_name,
      media_type,
      length_seconds,
      isci,
      current_stage,
      status,
      idea_direction,
      working_script,
      approved_script,
      final_script,
      voice_talent,
      recording_status,
      recording_received_date,
      recording_review_notes,
      production_status,
      final_audio_file_name,
      coop_script,
      owner,
      created_at,
      updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `).bind(...v).run();

  const newId =
    +(r?.meta?.last_row_id || r?.meta?.lastRowId || 0) || null;

  if (newId) {
    await db.prepare(`
      INSERT INTO media_creative_history (
        creative_id,
        entry_type,
        stage,
        author,
        content,
        created_at
      ) VALUES (
        ?,
        'system',
        ?,
        'GCM OS',
        'Creative record created.',
        CURRENT_TIMESTAMP
      )
    `).bind(newId, v[5]).run();
  }

  return response(
    requestId,
    {
      ok: true,
      operation: "save_creative",
      creativeId: newId,
      created: true
    },
    201
  );
}

async function addHistory(body, db, requestId) {
  const creativeId = pos(body?.creativeId);
  const content = req(body?.content ?? body?.note);

  if (!creativeId || !content) {
    return response(
      requestId,
      {
        ok: false,
        error: "creativeId and history content are required."
      },
      400
    );
  }

  const r = await db.prepare(`
    INSERT INTO media_creative_history (
      creative_id,
      entry_type,
      stage,
      author,
      content,
      created_at
    )
    SELECT
      ?,
      ?,
      ?,
      ?,
      ?,
      CURRENT_TIMESTAMP
    WHERE EXISTS (
      SELECT 1
      FROM media_creatives
      WHERE id = ?
    )
  `).bind(
    creativeId,
    opt(body?.entryType) || "production_note",
    opt(body?.stage),
    opt(body?.author) || "Andy",
    content,
    creativeId
  ).run();

  if (!r?.meta?.changes) {
    return response(
      requestId,
      {
        ok: false,
        error: `Creative ${creativeId} was not found.`
      },
      404
    );
  }

  return response(requestId, {
    ok: true,
    operation: "append_creative_history",
    creativeId,
    historyId: +(r?.meta?.last_row_id || 0) || null
  });
}

async function saveAssignments(body, db, requestId) {
  const creativeId = pos(body?.creativeId);
  const items = Array.isArray(body?.assignments)
    ? body.assignments
    : [];

  if (!creativeId) {
    return response(
      requestId,
      {
        ok: false,
        error: "creativeId is required."
      },
      400
    );
  }

  const c = await db.prepare(`
    SELECT id, client_id
    FROM media_creatives
    WHERE id = ?
  `).bind(creativeId).first();

  if (!c) {
    return response(
      requestId,
      {
        ok: false,
        error: `Creative ${creativeId} was not found.`
      },
      404
    );
  }

  let count = 0;

  for (const x of items) {
    const market = req(x?.market);
    const outlet = req(x?.outletName);

    if (!market || !outlet) continue;

    const mediaRecordId = pos(x?.mediaRecordId);

    if (mediaRecordId) {
      const p = await db.prepare(`
        SELECT client_id
        FROM media_records
        WHERE id = ?
      `).bind(mediaRecordId).first();

      if (!p || +p.client_id !== +c.client_id) {
        return response(
          requestId,
          {
            ok: false,
            error:
              `Media record ${mediaRecordId} is not a valid placement anchor for this client.`
          },
          409
        );
      }
    }

    await db.prepare(`
      INSERT INTO media_creative_assignments (
        creative_id,
        media_record_id,
        media_type,
        market,
        outlet_name,
        placement_reference,
        rotation_action,
        assignment_status,
        rotation_start_date,
        rotation_end_date,
        notes,
        created_at,
        updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(creative_id, market, outlet_name)
      DO UPDATE SET
        media_record_id = excluded.media_record_id,
        media_type = excluded.media_type,
        placement_reference = excluded.placement_reference,
        rotation_action = excluded.rotation_action,
        assignment_status = excluded.assignment_status,
        rotation_start_date = excluded.rotation_start_date,
        rotation_end_date = excluded.rotation_end_date,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      creativeId,
      mediaRecordId,
      opt(x?.mediaType) || "Radio",
      market,
      outlet,
      opt(x?.placementReference),
      opt(x?.rotationAction) || "add_to_rotation",
      opt(x?.assignmentStatus) || "planned",
      dateOnly(x?.rotationStartDate),
      dateOnly(x?.rotationEndDate),
      opt(x?.notes)
    ).run();

    count += 1;
  }

  return response(requestId, {
    ok: true,
    operation: "save_creative_assignments",
    creativeId,
    savedCount: count
  });
}

async function savePackage(body, db, requestId) {
  const x = body?.trafficPackage || body?.package || {};
  const id = pos(body?.trafficPackageId);
  const creativeId = pos(x.creativeId ?? body?.creativeId);

  const ids = [
    ...new Set(
      (
        Array.isArray(body?.assignmentIds)
          ? body.assignmentIds
          : x.assignmentIds || []
      )
        .map(pos)
        .filter(Boolean)
    )
  ];

  if (!creativeId) {
    return response(
      requestId,
      {
        ok: false,
        error: "creativeId is required for a traffic package."
      },
      400
    );
  }

  if (
    !await db.prepare(`
      SELECT id
      FROM media_creatives
      WHERE id = ?
    `).bind(creativeId).first()
  ) {
    return response(
      requestId,
      {
        ok: false,
        error: `Creative ${creativeId} was not found.`
      },
      404
    );
  }

  for (const aid of ids) {
    const a = await db.prepare(`
      SELECT creative_id
      FROM media_creative_assignments
      WHERE id = ?
    `).bind(aid).first();

    if (!a || +a.creative_id !== creativeId) {
      return response(
        requestId,
        {
          ok: false,
          error:
            `Assignment ${aid} is not linked to Creative ${creativeId}.`
        },
        409
      );
    }
  }

  const v = [
    opt(x.toEmail),
    opt(x.ccEmail),
    opt(x.subject),
    opt(x.bodyText),
    opt(x.specialInstructions),
    opt(x.insertionOrderReference),
    opt(x.scheduleReference),
    opt(x.packageStatus) || "draft",
    opt(x.gmailDraftId),
    opt(x.gmailThreadId)
  ];

  let packageId = id;

  if (id) {
    const p = await db.prepare(`
      SELECT creative_id
      FROM media_traffic_packages
      WHERE id = ?
    `).bind(id).first();

    if (!p || +p.creative_id !== creativeId) {
      return response(
        requestId,
        {
          ok: false,
          error:
            `Traffic package ${id} was not found for Creative ${creativeId}.`
        },
        404
      );
    }

    await db.prepare(`
      UPDATE media_traffic_packages
      SET
        to_email = ?,
        cc_email = ?,
        subject = ?,
        body_text = ?,
        special_instructions = ?,
        insertion_order_reference = ?,
        schedule_reference = ?,
        package_status = ?,
        gmail_draft_id = ?,
        gmail_thread_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(...v, id).run();
  } else {
    const r = await db.prepare(`
      INSERT INTO media_traffic_packages (
        creative_id,
        to_email,
        cc_email,
        subject,
        body_text,
        special_instructions,
        insertion_order_reference,
        schedule_reference,
        package_status,
        gmail_draft_id,
        gmail_thread_id,
        created_at,
        updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `).bind(creativeId, ...v).run();

    packageId =
      +(r?.meta?.last_row_id || r?.meta?.lastRowId || 0) || null;
  }

  await db.prepare(`
    DELETE FROM media_traffic_package_assignments
    WHERE traffic_package_id = ?
  `).bind(packageId).run();

  for (const aid of ids) {
    await db.prepare(`
      INSERT OR IGNORE INTO media_traffic_package_assignments (
        traffic_package_id,
        assignment_id,
        created_at
      ) VALUES (?, ?, CURRENT_TIMESTAMP)
    `).bind(packageId, aid).run();
  }

  return response(requestId, {
    ok: true,
    operation: "save_traffic_package",
    trafficPackageId: packageId,
    creativeId,
    assignmentIds: ids,
    created: !id
  });
}

async function markSent(body, db, requestId) {
  const id = pos(body?.trafficPackageId ?? body?.packageId);

  if (!id) {
    return response(
      requestId,
      {
        ok: false,
        error: "trafficPackageId is required."
      },
      400
    );
  }

  const p = await db.prepare(`
    SELECT creative_id
    FROM media_traffic_packages
    WHERE id = ?
  `).bind(id).first();

  if (!p) {
    return response(
      requestId,
      {
        ok: false,
        error: `Traffic package ${id} was not found.`
      },
      404
    );
  }

  const sentAt = opt(body?.sentAt) || new Date().toISOString();

  await db.prepare(`
    UPDATE media_traffic_packages
    SET
      package_status = 'sent',
      sent_at = ?,
      sent_gmail_message_id = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    sentAt,
    opt(body?.sentGmailMessageId),
    id
  ).run();

  await db.prepare(`
    INSERT INTO media_creative_history (
      creative_id,
      entry_type,
      stage,
      author,
      content,
      created_at
    ) VALUES (
      ?,
      'traffic',
      'Station Email Package',
      'Andy',
      ?,
      CURRENT_TIMESTAMP
    )
  `).bind(
    +p.creative_id,
    `Traffic package ${id} marked sent by operator.`
  ).run();

  return response(requestId, {
    ok: true,
    operation: "mark_traffic_package_sent",
    trafficPackageId: id,
    sentAt
  });
}

async function saveConfirmation(body, db, requestId) {
  const packageId = pos(body?.trafficPackageId ?? body?.packageId);
  const x = body?.confirmation || {};
  const text = req(x.bodyText ?? x.confirmationText);

  if (!packageId || !text) {
    return response(
      requestId,
      {
        ok: false,
        error:
          "trafficPackageId and confirmation email text are required."
      },
      400
    );
  }

  const p = await db.prepare(`
    SELECT creative_id
    FROM media_traffic_packages
    WHERE id = ?
  `).bind(packageId).first();

  if (!p) {
    return response(
      requestId,
      {
        ok: false,
        error:
          `Traffic package ${packageId} was not found.`
      },
      404
    );
  }

  const gm = opt(x.gmailMessageId);
  const received =
    x.stationReceivedConfirmed === true ? 1 : 0;
  const trafficked =
    x.stationTraffickedConfirmed === true ? 1 : 0;
  const approved = opt(x.approvedBy) || "Andy";
  const receivedAt =
    opt(x.receivedAt) || new Date().toISOString();

  let e = gm
    ? await db.prepare(`
        SELECT id
        FROM media_confirmation_evidence
        WHERE gmail_message_id = ?
      `).bind(gm).first()
    : null;

  let id = e ? +e.id : null;

  const v = [
    opt(x.gmailThreadId),
    opt(x.fromEmail),
    opt(x.toEmail),
    opt(x.subject),
    receivedAt,
    text,
    received,
    trafficked,
    approved
  ];

  if (id) {
    await db.prepare(`
      UPDATE media_confirmation_evidence
      SET
        gmail_thread_id = ?,
        from_email = ?,
        to_email = ?,
        subject = ?,
        received_at = ?,
        body_text = ?,
        station_received_confirmed = ?,
        station_trafficked_confirmed = ?,
        approved_by = ?,
        approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(...v, id).run();
  } else {
    const r = await db.prepare(`
      INSERT INTO media_confirmation_evidence (
        gmail_message_id,
        gmail_thread_id,
        from_email,
        to_email,
        subject,
        received_at,
        body_text,
        station_received_confirmed,
        station_trafficked_confirmed,
        approved_by,
        approved_at,
        created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `).bind(gm, ...v).run();

    id =
      +(r?.meta?.last_row_id || r?.meta?.lastRowId || 0) || null;
  }

  await db.prepare(`
    INSERT OR IGNORE INTO media_confirmation_links (
      confirmation_id,
      traffic_package_id,
      created_at
    ) VALUES (?, ?, CURRENT_TIMESTAMP)
  `).bind(id, packageId).run();

  const status = trafficked
    ? "confirmed"
    : received
      ? "received_confirmed"
      : "confirmation_saved";

  await db.prepare(`
    UPDATE media_traffic_packages
    SET
      package_status = ?,
      confirmed_at =
        CASE
          WHEN ? = 1 THEN CURRENT_TIMESTAMP
          ELSE confirmed_at
        END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    status,
    trafficked,
    packageId
  ).run();

  await db.prepare(`
    INSERT INTO media_creative_history (
      creative_id,
      entry_type,
      stage,
      author,
      content,
      created_at
    ) VALUES (
      ?,
      'confirmation',
      'Station Confirmation',
      ?,
      ?,
      CURRENT_TIMESTAMP
    )
  `).bind(
    +p.creative_id,
    approved,
    `Station confirmation saved for package ${packageId}. Received: ${received ? "yes" : "no"}; trafficked: ${trafficked ? "yes" : "no"}.`
  ).run();

  return response(requestId, {
    ok: true,
    operation: "record_station_confirmation",
    trafficPackageId: packageId,
    confirmationId: id,
    packageStatus: status,
    stationReceivedConfirmed: !!received,
    stationTraffickedConfirmed: !!trafficked
  });
}

/* =========================================================
   Production Sessions
   ========================================================= */

async function saveProductionSession(body, db, requestId) {
  const x = body?.session || {};
  const sessionId = pos(body?.sessionId ?? x.id);
  const clientId = pos(x.clientId ?? body?.clientId);
  const title = req(x.title);
  const scheduledAt = localDateTime(x.scheduledAt);
  const sessionType =
    normalizeKey(x.sessionType || "recording") || "recording";
  const status =
    normalizeKey(x.status || "scheduled") || "scheduled";
  const creativeIds = [
    ...new Set(
      (
        Array.isArray(x.creativeIds)
          ? x.creativeIds
          : Array.isArray(body?.creativeIds)
            ? body.creativeIds
            : []
      )
        .map(pos)
        .filter(Boolean)
    )
  ];

  if (!clientId) {
    return response(
      requestId,
      {
        ok: false,
        error: "Production session requires clientId."
      },
      400
    );
  }

  if (!title) {
    return response(
      requestId,
      {
        ok: false,
        error: "Production session requires a title."
      },
      400
    );
  }

  if (!scheduledAt) {
    return response(
      requestId,
      {
        ok: false,
        error:
          "Production session requires scheduledAt in YYYY-MM-DDTHH:MM format."
      },
      400
    );
  }

  if (!MEDIA_SESSION_STATUSES.has(status)) {
    return response(
      requestId,
      {
        ok: false,
        error: `Unsupported production session status: ${status}.`
      },
      400
    );
  }

  if (!creativeIds.length) {
    return response(
      requestId,
      {
        ok: false,
        error:
          "Production session requires at least one linked Media creative."
      },
      400
    );
  }

  const client = await db.prepare(`
    SELECT id, client_code, name
    FROM clients
    WHERE id = ?
    LIMIT 1
  `).bind(clientId).first();

  if (!client) {
    return response(
      requestId,
      {
        ok: false,
        error: `Client ${clientId} was not found.`
      },
      404
    );
  }

  const creativeRows = [];

  for (const creativeId of creativeIds) {
    const creative = await db.prepare(`
      SELECT id, client_id, creative_name
      FROM media_creatives
      WHERE id = ?
      LIMIT 1
    `).bind(creativeId).first();

    if (!creative) {
      return response(
        requestId,
        {
          ok: false,
          error: `Creative ${creativeId} was not found.`
        },
        404
      );
    }

    if (+creative.client_id !== clientId) {
      return response(
        requestId,
        {
          ok: false,
          error:
            `Creative ${creativeId} belongs to a different client and cannot be linked to this session.`
        },
        409
      );
    }

    creativeRows.push(creative);
  }

  const values = [
    clientId,
    sessionType,
    title,
    scheduledAt,
    BUSINESS_TIME_ZONE,
    opt(x.location),
    opt(x.contactName),
    opt(x.notes),
    status
  ];

  let id = sessionId;
  let created = false;
  let recoveredExisting = false;

  if (!id) {
    const retryMatch = await db.prepare(`
      SELECT id
      FROM media_production_sessions
      WHERE client_id = ?
        AND LOWER(TRIM(COALESCE(session_type, 'recording'))) = LOWER(?)
        AND LOWER(TRIM(title)) = LOWER(?)
        AND scheduled_at = ?
        AND LOWER(TRIM(COALESCE(status, 'scheduled')))
          NOT IN ('completed', 'cancelled', 'canceled')
      ORDER BY id DESC
      LIMIT 1
    `).bind(
      clientId,
      sessionType,
      title,
      scheduledAt
    ).first();

    if (retryMatch?.id) {
      id = +retryMatch.id;
      recoveredExisting = true;
    }
  }

  if (id) {
    const existing = await db.prepare(`
      SELECT id
      FROM media_production_sessions
      WHERE id = ?
      LIMIT 1
    `).bind(id).first();

    if (!existing) {
      return response(
        requestId,
        {
          ok: false,
          error: `Production session ${id} was not found.`
        },
        404
      );
    }

    await db.prepare(`
      UPDATE media_production_sessions
      SET
        client_id = ?,
        session_type = ?,
        title = ?,
        scheduled_at = ?,
        time_zone = ?,
        location = ?,
        contact_name = ?,
        notes = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(...values, id).run();
  } else {
    const result = await db.prepare(`
      INSERT INTO media_production_sessions (
        client_id,
        session_type,
        title,
        scheduled_at,
        time_zone,
        location,
        contact_name,
        notes,
        status,
        created_at,
        updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `).bind(...values).run();

    id =
      +(result?.meta?.last_row_id ||
        result?.meta?.lastRowId ||
        0) || null;

    created = true;
  }

  if (!id) {
    return response(
      requestId,
      {
        ok: false,
        error:
          "Production session save did not return a durable session id."
      },
      500
    );
  }

  await db.prepare(`
    DELETE FROM media_production_session_creatives
    WHERE session_id = ?
  `).bind(id).run();

  for (const creativeId of creativeIds) {
    await db.prepare(`
      INSERT OR IGNORE INTO media_production_session_creatives (
        session_id,
        creative_id,
        created_at
      ) VALUES (?, ?, CURRENT_TIMESTAMP)
    `).bind(id, creativeId).run();
  }

  const sourceKey = `${MEDIA_SESSION_SOURCE}:${id}`;
  const calendarStatus = calendarStatusForSession(status);
  const creativeNames = creativeRows
    .map(row => s(row.creative_name))
    .filter(Boolean);

  const calendarNotes = [
    `Media session type: ${sessionType.replaceAll("_", " ")}`,
    opt(x.contactName)
      ? `Contact: ${opt(x.contactName)}`
      : null,
    creativeNames.length
      ? `Creatives: ${creativeNames.join("; ")}`
      : null,
    opt(x.notes)
  ]
    .filter(Boolean)
    .join("\n");

  await db.prepare(`
    INSERT INTO calendar_appointments (
      client_id,
      title,
      appointment_type_id,
      scheduled_at,
      time_zone,
      location,
      address,
      contact_email,
      client_label,
      notes,
      status,
      source,
      source_key,
      created_at,
      updated_at,
      deleted_at
    ) VALUES (
      ?,
      ?,
      NULL,
      ?,
      ?,
      ?,
      NULL,
      NULL,
      ?,
      ?,
      ?,
      ?,
      ?,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      NULL
    )
    ON CONFLICT(source_key)
    WHERE source_key IS NOT NULL
    DO UPDATE SET
      client_id = excluded.client_id,
      title = excluded.title,
      scheduled_at = excluded.scheduled_at,
      time_zone = excluded.time_zone,
      location = excluded.location,
      client_label = excluded.client_label,
      notes = excluded.notes,
      status = excluded.status,
      source = excluded.source,
      updated_at = CURRENT_TIMESTAMP,
      deleted_at = NULL
  `).bind(
    clientId,
    title,
    scheduledAt,
    BUSINESS_TIME_ZONE,
    opt(x.location),
    s(client.name),
    calendarNotes || null,
    calendarStatus,
    MEDIA_SESSION_SOURCE,
    sourceKey
  ).run();

  const calendar = await db.prepare(`
    SELECT id
    FROM calendar_appointments
    WHERE source_key = ?
      AND deleted_at IS NULL
    LIMIT 1
  `).bind(sourceKey).first();

  if (created) {
    for (const creative of creativeRows) {
      await db.prepare(`
        INSERT INTO media_creative_history (
          creative_id,
          entry_type,
          stage,
          author,
          content,
          created_at
        ) VALUES (
          ?,
          'session',
          'Recording',
          'Andy',
          ?,
          CURRENT_TIMESTAMP
        )
      `).bind(
        +creative.id,
        `Production session scheduled: ${title} · ${scheduledAt}${opt(x.location) ? ` · ${opt(x.location)}` : ""}.`
      ).run();
    }
  }

  return response(
    requestId,
    {
      ok: true,
      operation: "save_production_session",
      mediaCreativeWorkflowVersion:
        MEDIA_CREATIVE_WORKFLOW_VERSION,
      sessionId: id,
      calendarAppointmentId:
        calendar?.id == null ? null : +calendar.id,
      clientId,
      creativeIds,
      scheduledAt,
      status,
      created,
      recoveredExisting
    },
    created ? 201 : 200
  );
}

async function completeProductionSession(body, db, requestId) {
  const sessionId = pos(
    body?.sessionId ??
    body?.session?.id
  );

  if (!sessionId) {
    return response(
      requestId,
      {
        ok: false,
        error: "sessionId is required."
      },
      400
    );
  }

  const session = await db.prepare(`
    SELECT
      s.id,
      s.title,
      s.scheduled_at,
      s.location,
      s.status
    FROM media_production_sessions s
    WHERE s.id = ?
    LIMIT 1
  `).bind(sessionId).first();

  if (!session) {
    return response(
      requestId,
      {
        ok: false,
        error:
          `Production session ${sessionId} was not found.`
      },
      404
    );
  }

  await db.prepare(`
    UPDATE media_production_sessions
    SET
      status = 'completed',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(sessionId).run();

  await db.prepare(`
    UPDATE calendar_appointments
    SET
      status = 'completed',
      updated_at = CURRENT_TIMESTAMP
    WHERE source_key = ?
      AND deleted_at IS NULL
  `).bind(
    `${MEDIA_SESSION_SOURCE}:${sessionId}`
  ).run();

  const linked = await db.prepare(`
    SELECT creative_id
    FROM media_production_session_creatives
    WHERE session_id = ?
    ORDER BY creative_id
  `).bind(sessionId).all();

  for (const row of rowsOf(linked)) {
    await db.prepare(`
      INSERT INTO media_creative_history (
        creative_id,
        entry_type,
        stage,
        author,
        content,
        created_at
      ) VALUES (
        ?,
        'session',
        'Recording',
        'Andy',
        ?,
        CURRENT_TIMESTAMP
      )
    `).bind(
      +row.creative_id,
      `Production session completed: ${s(session.title)}.`
    ).run();
  }

  return response(requestId, {
    ok: true,
    operation: "complete_production_session",
    mediaCreativeWorkflowVersion:
      MEDIA_CREATIVE_WORKFLOW_VERSION,
    sessionId,
    status: "completed"
  });
}

/* =========================================================
   Helpers
   ========================================================= */

function response(requestId, payload, status = 200) {
  return jsonResponse(
    {
      requestId,
      action: ACTIONS.GET_MEDIA_OPERATIONS,
      version: VERSION,
      mediaCreativeWorkflowVersion:
        MEDIA_CREATIVE_WORKFLOW_VERSION,
      ...payload
    },
    status
  );
}

function mapCreative(r) {
  return {
    id: +r.id,
    clientId: +r.client_id,
    clientCode: s(r.client_code),
    clientName: s(r.client_name),
    creativeName: s(r.creative_name),
    mediaType: n(r.media_type),
    lengthSeconds:
      r.length_seconds == null ? null : +r.length_seconds,
    isci: n(r.isci),
    currentStage: n(r.current_stage),
    status: n(r.status),
    ideaDirection: n(r.idea_direction),
    workingScript: n(r.working_script),
    approvedScript: n(r.approved_script),
    finalScript: n(r.final_script),
    voiceTalent: n(r.voice_talent),
    recordingStatus: n(r.recording_status),
    recordingReceivedDate: n(r.recording_received_date),
    recordingReviewNotes: n(r.recording_review_notes),
    productionStatus: n(r.production_status),
    finalAudioFileName: n(r.final_audio_file_name),
    coopScript: n(r.coop_script),
    owner: n(r.owner),
    createdAt: n(r.created_at),
    updatedAt: n(r.updated_at)
  };
}

function calendarStatusForSession(status) {
  const normalized = normalizeKey(status);

  if (normalized === "completed") return "completed";

  if (
    normalized === "cancelled" ||
    normalized === "canceled"
  ) {
    return "cancelled";
  }

  return "scheduled";
}

function localDateTime(value) {
  const text = String(value ?? "").trim();

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || 0);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second
    )
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${String(second).padStart(2, "0")}`;
}

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pos(v) {
  const number = Number(v);
  return Number.isInteger(number) && number > 0
    ? number
    : null;
}

function req(v) {
  const x = String(v ?? "").trim();
  return x || null;
}

function opt(v) {
  const x = String(v ?? "").trim();
  return x || null;
}

function n(v) {
  return v == null ? null : String(v);
}

function s(v) {
  return String(v ?? "");
}

function dateOnly(v) {
  if (!v) return null;

  const m = String(v)
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!m) return null;

  return `${m[1]}-${m[2]}-${m[3]}`;
}

/* END OF FILE — routes/mediaCreativeWorkflow.js v1.1.1 */
