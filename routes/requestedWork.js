/* =========================================================
   Global Concepts Media Operating System
   File: routes/requestedWork.js
   Version: 1.0.0
   Status: Production Candidate
   Source: New production route
   Sprint: Create Requested Work
   Purpose: Create a normal D1 Work Item directly from a known client
            request or agency commitment without manufacturing an Investigation.
   ========================================================= */

import { clean, jsonResponse } from "../shared/http.js";

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export async function handleCreateRequestedWork(body, env, requestId) {
  if (!env?.DB) {
    return jsonResponse(
      {
        ok: false,
        requestId,
        error: "The D1 database binding is unavailable."
      },
      500
    );
  }

  const clientCode = clean(body?.clientCode).toUpperCase();
  const title = clean(body?.title);
  const description = clean(body?.description);
  const expectedImpact = clean(body?.expectedImpact);
  const requestedBy = clean(body?.requestedBy);
  const category = clean(body?.category) || "Client Requested Work";
  const priority = clean(body?.priority) || "Normal";
  const owner = clean(body?.owner) || "Andy";
  const communicationId = positiveInteger(body?.communicationId);

  if (!clientCode || !title || !description || !expectedImpact) {
    return jsonResponse(
      {
        ok: false,
        requestId,
        error:
          "clientCode, title, description, and expectedImpact are required."
      },
      400
    );
  }

  const client = await env.DB.prepare(`
    SELECT id, name, client_code, status
    FROM clients
    WHERE UPPER(client_code) = UPPER(?)
    LIMIT 1
  `)
    .bind(clientCode)
    .first();

  if (!client) {
    return jsonResponse(
      {
        ok: false,
        requestId,
        error: `No client was found for code ${clientCode}.`
      },
      404
    );
  }

  if (communicationId) {
    const communication = await env.DB.prepare(`
      SELECT id
      FROM communications
      WHERE id = ?
        AND client_id = ?
      LIMIT 1
    `)
      .bind(communicationId, client.id)
      .first();

    if (!communication) {
      return jsonResponse(
        {
          ok: false,
          requestId,
          error:
            `Communication #${communicationId} does not belong to ${client.name}.`
        },
        400
      );
    }
  }

  const storedDescription = requestedBy
    ? `Requested by: ${requestedBy}\n\n${description}`
    : description;

  const result = await env.DB.prepare(`
    INSERT INTO work_items (
      client_id,
      investigation_id,
      communication_id,
      title,
      description,
      category,
      priority,
      status,
      owner,
      expected_impact,
      started_at,
      created_at,
      updated_at
    )
    VALUES (
      ?,
      NULL,
      ?,
      ?,
      ?,
      ?,
      ?,
      'Open',
      ?,
      ?,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `)
    .bind(
      client.id,
      communicationId,
      title,
      storedDescription,
      category,
      priority,
      owner,
      expectedImpact
    )
    .run();

  const workItemId =
    Number(result?.meta?.last_row_id) ||
    Number(result?.meta?.lastRowId) ||
    null;

  return jsonResponse(
    {
      ok: true,
      requestId,
      message: "Requested Work Item created.",
      workItem: {
        id: workItemId,
        clientId: client.id,
        clientCode: client.client_code,
        clientName: client.name,
        investigationId: null,
        communicationId,
        title,
        description: storedDescription,
        category,
        priority,
        status: "Open",
        owner,
        expectedImpact
      }
    },
    201
  );
}
