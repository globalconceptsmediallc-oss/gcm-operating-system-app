/* =========================================================
   Global Concepts Media Operating System
   File: routes/agencyCommand.js
   Version: 1.1.0
   Status: Production Road-Test Candidate
   Source: Agency Command Sprint
   Sprint: Intelligent Agency Entry Point — Stage 2
   Purpose:
   Accept a natural-language agency objective, identify the correct
   operating workspace, load durable Intelligence decision candidates
   from D1, merge any explicitly supplied context, and return a concise
   next-action brief.

   Changes in 1.1.0:
   - Reads durable Intelligence records directly from D1.
   - Separates unresolved, investigating, work-underway, monitoring,
     and historically handled intelligence.
   - Prevents already-handled Intelligence from being promoted as new work.
   - Preserves existing intent routing and supplied-context behavior.
   - Remains read-only; creates no records.

   SAFETY / SCOPE
   - Read-only.
   - Reads D1 Intelligence and linked handling records; performs no D1 writes.
   - Creates no Communication, Investigation, Work Item, Proof,
     Media, Prospect, Calendar, or D1 record.
   - Does not claim to read Gmail, Calendar, or external public sources
     unless that information is explicitly supplied in the request.
   - Current public research is marked as requiring live verification.
   ========================================================= */

import {
  VERSION,
  API_CONTRACT_VERSION,
  COMMUNICATION_REASONING_MODEL
} from "../shared/config.js";

import {
  clean,
  jsonResponse,
  safeErrorMessage,
  logWorkerError
} from "../shared/http.js";

import {
  runAiJsonWithRetry,
  createStageResult,
  buildOperationalError
} from "../shared/ai.js";

export const AGENCY_COMMAND_VERSION = "1.1.0";
export const AGENCY_COMMAND_ACTION = "agency-command";

const INTENTS = Object.freeze({
  MORNING_BRIEF: "morning_brief",
  INBOX_TRIAGE: "inbox_triage",
  RESEARCH: "research",
  COMMUNICATIONS: "communications",
  MEDIA: "media",
  PROSPECTING: "prospecting",
  CLIENT_STRATEGY: "client_strategy",
  INVESTIGATION: "investigation",
  WORK: "work",
  PROOF: "proof",
  CALENDAR: "calendar",
  GENERAL: "general"
});

const WORKSPACES = Object.freeze({
  [INTENTS.MORNING_BRIEF]: {
    label: "Today",
    href: "today.html",
    purpose: "Review continuity, commitments, deadlines, unresolved items, and the best use of today's effort."
  },
  [INTENTS.INBOX_TRIAGE]: {
    label: "Communications",
    href: "communications.html",
    purpose: "Identify which incoming items need attention, which are already handled, and which are monitoring only."
  },
  [INTENTS.RESEARCH]: {
    label: "Agency Research",
    href: "agency-command.html",
    purpose: "Frame and verify current research before making an agency recommendation."
  },
  [INTENTS.COMMUNICATIONS]: {
    label: "Communications",
    href: "communications.html",
    purpose: "Recognize, preserve, interpret, and route an incoming communication."
  },
  [INTENTS.MEDIA]: {
    label: "Media",
    href: "media.html",
    purpose: "Review media production, placements, confirmations, CTV, stations, schedules, and delivery."
  },
  [INTENTS.PROSPECTING]: {
    label: "Prospects",
    href: "prospects.html",
    purpose: "Research, qualify, contact, and follow up with potential new business."
  },
  [INTENTS.CLIENT_STRATEGY]: {
    label: "Clients",
    href: "clients.html",
    purpose: "Review the client's full operational condition and highest-value next effort."
  },
  [INTENTS.INVESTIGATION]: {
    label: "Investigations",
    href: "investigations.html",
    purpose: "Answer one bounded operational question using evidence."
  },
  [INTENTS.WORK]: {
    label: "Work",
    href: "work.html",
    purpose: "Perform and verify a specific justified action."
  },
  [INTENTS.PROOF]: {
    label: "Proof",
    href: "proof.html",
    purpose: "Assemble completed and verified business value."
  },
  [INTENTS.CALENDAR]: {
    label: "Today",
    href: "today.html",
    purpose: "Review deadlines, appointments, production commitments, and time constraints."
  },
  [INTENTS.GENERAL]: {
    label: "Today",
    href: "today.html",
    purpose: "Place the request in the context of today's agency priorities."
  }
});

/**
 * Main Agency Command route.
 *
 * Expected request body:
 * {
 *   action: "agency-command",
 *   contractVersion: "...",
 *   question: "What is in my inbox that needs attention?",
 *   context: {
 *     communications: [],
 *     work: [],
 *     deadlines: [],
 *     calendar: [],
 *     media: [],
 *     prospects: [],
 *     historicalSignals: []
 *   }
 * }
 */
export async function handleAgencyCommand(body, env, requestId) {
  const startedAt = Date.now();
  const question = clean(body?.question || body?.objective || body?.prompt);
  const requestedContractVersion = clean(
    body?.contractVersion || body?.apiContractVersion || API_CONTRACT_VERSION
  );

  if (requestedContractVersion !== API_CONTRACT_VERSION) {
    return jsonResponse({
      ok: false,
      action: AGENCY_COMMAND_ACTION,
      requestId,
      version: VERSION,
      agencyCommandVersion: AGENCY_COMMAND_VERSION,
      contractVersion: API_CONTRACT_VERSION,
      error: `Unsupported contract version: ${requestedContractVersion}`,
      supportedContractVersion: API_CONTRACT_VERSION
    }, 400);
  }

  if (!question) {
    return jsonResponse({
      ok: false,
      action: AGENCY_COMMAND_ACTION,
      requestId,
      version: VERSION,
      agencyCommandVersion: AGENCY_COMMAND_VERSION,
      contractVersion: API_CONTRACT_VERSION,
      error: "A question or agency objective is required."
    }, 400);
  }

  const suppliedContext = normalizeAgencyContext(body?.context);
  const d1Intelligence = await loadAgencyIntelligence(env, requestId);
  const agencyContext = mergeAgencyContextWithIntelligence(
    suppliedContext,
    d1Intelligence
  );
  const classification = classifyAgencyRequest(question);
  const deterministicBrief = buildDeterministicAgencyBrief({
    question,
    classification,
    context: agencyContext
  });

  const stages = [
    createStageResult({
      stageName: "agency_intent_recognition",
      status: "success",
      engine: "agency-command-intent-v1",
      model: "deterministic",
      startedAt,
      confidence: classification.confidence,
      fallbackUsed: false,
      data: classification
    })
  ];

  let brief = deterministicBrief;
  let aiUsed = false;
  let aiError = null;

  if (env?.AI && typeof env.AI.run === "function") {
    const aiStageStartedAt = Date.now();

    try {
      const aiResult = await runAgencyCommandReasoning({
        question,
        classification,
        context: agencyContext,
        env,
        requestId
      });

      if (aiResult.ok) {
        brief = normalizeAgencyBrief(aiResult.data, deterministicBrief);
        aiUsed = true;

        stages.push(createStageResult({
          stageName: "agency_brief_reasoning",
          status: "success",
          engine: "agency-command-reasoning-v1",
          model: COMMUNICATION_REASONING_MODEL,
          startedAt: aiStageStartedAt,
          confidence: normalizeConfidence(brief.confidence),
          retryCount: aiResult.retryCount,
          retryStatus: aiResult.retryStatus,
          fallbackUsed: false,
          data: brief
        }));
      } else {
        aiError = aiResult.error;
        stages.push(createStageResult({
          stageName: "agency_brief_reasoning",
          status: "fallback",
          engine: "agency-command-reasoning-v1",
          model: COMMUNICATION_REASONING_MODEL,
          startedAt: aiStageStartedAt,
          confidence: deterministicBrief.confidence,
          retryCount: aiResult.retryCount,
          retryStatus: aiResult.retryStatus,
          rawAiError: aiResult.error?.message || null,
          fallbackUsed: true,
          data: deterministicBrief
        }));
      }
    } catch (error) {
      aiError = buildOperationalError({
        stage: "agency_brief_reasoning",
        code: "AGENCY_COMMAND_REASONING_FAILED",
        message: safeErrorMessage(error),
        retryable: false
      });

      logWorkerError({
        requestId,
        route: AGENCY_COMMAND_ACTION,
        stage: "agency_brief_reasoning",
        error
      });

      stages.push(createStageResult({
        stageName: "agency_brief_reasoning",
        status: "fallback",
        engine: "agency-command-reasoning-v1",
        model: COMMUNICATION_REASONING_MODEL,
        startedAt: aiStageStartedAt,
        confidence: deterministicBrief.confidence,
        rawAiError: aiError.message,
        fallbackUsed: true,
        data: deterministicBrief
      }));
    }
  }

  const workspace = WORKSPACES[classification.intent] || WORKSPACES[INTENTS.GENERAL];

  return jsonResponse({
    ok: true,
    action: AGENCY_COMMAND_ACTION,
    requestId,
    version: VERSION,
    agencyCommandVersion: AGENCY_COMMAND_VERSION,
    contractVersion: API_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    question,
    classification,
    workspace,
    brief,
    suppliedContextSummary: summarizeContext(suppliedContext),
    agencyContextSummary: summarizeContext(agencyContext),
    intelligenceContext: {
      source: d1Intelligence.source,
      available: d1Intelligence.available,
      counts: d1Intelligence.counts,
      error: d1Intelligence.error
    },
    recordPolicy: {
      readOnly: true,
      recordsCreated: [],
      nextRecordRequiresHumanDecision: true
    },
    liveVerification: {
      required: classification.requiresLiveResearch,
      reason: classification.requiresLiveResearch
        ? "The request depends on current public information that must be verified before an agency recommendation is accepted."
        : null
    },
    stages,
    diagnostics: {
      engine: "agency-command",
      engineVersion: AGENCY_COMMAND_VERSION,
      executionTimeMs: Date.now() - startedAt,
      aiUsed,
      fallbackUsed: !aiUsed,
      aiError: aiError?.message || null
    }
  }, 200);
}

async function runAgencyCommandReasoning({
  question,
  classification,
  context,
  env,
  requestId
}) {
  const prompt = buildAgencyCommandPrompt({
    question,
    classification,
    context
  });

  return runAiJsonWithRetry({
    env,
    model: COMMUNICATION_REASONING_MODEL,
    input: {
      messages: [
        {
          role: "system",
          content: [
            "You are the GCM Agency Command reasoning engine.",
            "Act like an experienced agency chief of staff.",
            "Use only supplied operational context.",
            "Do not claim to have checked Gmail, Calendar, D1, the web, or any external source unless the supplied context explicitly contains that information.",
            "Return one valid JSON object only."
          ].join(" ")
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1800,
      temperature: 0
    },
    stageName: "agency_brief_reasoning",
    requestId,
    route: AGENCY_COMMAND_ACTION,
    timeoutMs: 30000,
    maxRetries: 1
  });
}

function buildAgencyCommandPrompt({
  question,
  classification,
  context
}) {
  return [
    "GCM AGENCY COMMAND",
    "",
    `QUESTION OR OBJECTIVE: ${question}`,
    `RECOGNIZED INTENT: ${classification.intent}`,
    `INTENT CONFIDENCE: ${classification.confidence}`,
    "",
    "SUPPLIED OPERATIONAL CONTEXT",
    JSON.stringify(context, null, 2),
    "",
    "RULES",
    "1. Use only supplied context as known fact.",
    "2. State missing context clearly.",
    "3. Do not create records.",
    "4. Do not recommend an Investigation unless one bounded unanswered operational question is visible.",
    "5. Do not recommend Work unless a specific action is already justified.",
    "6. Position Tracking changes are normally monitoring evidence unless the supplied history establishes a meaningful trend, business impact, or money-keyword concern.",
    "7. If a Communication is already processed, do not ask Andy to process it again.",
    "8. If Work already exists, refer to the Work rather than recreating intake.",
    "9. Include prospecting or agency growth when supplied history shows it has been neglected.",
    "10. For current-market research, state that live verification is required.",
    "11. Recommend a short sequence, not a long task list.",
    "12. Surface meaningful gaps Andy may not be seeing.",
    "",
    "Return exactly this JSON contract:",
    JSON.stringify({
      objective: "What Andy is trying to accomplish",
      currentState: [
        "Known continuity fact from supplied context"
      ],
      needsAttention: [
        {
          title: "Item requiring attention",
          reason: "Why it matters now",
          workspace: "communications | work | media | prospects | clients | investigations | proof | today | research"
        }
      ],
      alreadyHandled: [
        "Item that should not be processed again"
      ],
      monitoring: [
        "Item that should remain under observation"
      ],
      gaps: [
        "Pattern, risk, missing information, or opportunity Andy may not be seeing"
      ],
      recommendedSequence: [
        "First action",
        "Second action",
        "Third action"
      ],
      nextBestAction: "One best immediate action",
      confidence: 0.0,
      limitations: [
        "Missing or unverified context"
      ]
    }, null, 2)
  ].join("\n");
}

function classifyAgencyRequest(question) {
  const text = clean(question).toLowerCase();
  const scores = {
    [INTENTS.MORNING_BRIEF]: 0,
    [INTENTS.INBOX_TRIAGE]: 0,
    [INTENTS.RESEARCH]: 0,
    [INTENTS.COMMUNICATIONS]: 0,
    [INTENTS.MEDIA]: 0,
    [INTENTS.PROSPECTING]: 0,
    [INTENTS.CLIENT_STRATEGY]: 0,
    [INTENTS.INVESTIGATION]: 0,
    [INTENTS.WORK]: 0,
    [INTENTS.PROOF]: 0,
    [INTENTS.CALENDAR]: 0,
    [INTENTS.GENERAL]: 1
  };

  addScore(scores, INTENTS.MORNING_BRIEF, text, 8, [
    /\bgood morning\b/,
    /\bwhat do i need to know\b/,
    /\bbrief me\b/,
    /\bwhat needs my attention\b/,
    /\bwhat should i do first\b/,
    /\bhow should i spend today\b/
  ]);

  addScore(scores, INTENTS.INBOX_TRIAGE, text, 9, [
    /\binbox\b/,
    /\bclear (my|the) email\b/,
    /\bclear (my|the) inbox\b/,
    /\bwhich emails?\b/,
    /\bemail.*needs? my attention\b/,
    /\bwhat.*inbox\b/
  ]);

  addScore(scores, INTENTS.RESEARCH, text, 7, [
    /\bhow many\b/,
    /\bwhat is\b/,
    /\bwhat are\b/,
    /\bcompare\b/,
    /\bwhich (one|platform|service|provider)\b/,
    /\bresearch\b/,
    /\bfind out\b/,
    /\bexplain\b/
  ]);

  addScore(scores, INTENTS.COMMUNICATIONS, text, 7, [
    /\bemail\b/,
    /\bmessage\b/,
    /\bscreenshot\b/,
    /\bnotification\b/,
    /\bsemrush\b/,
    /\bsearch console\b/,
    /\bposition tracking\b/,
    /\bsite audit\b/,
    /\bbacklink audit\b/,
    /\breply\b/
  ]);

  addScore(scores, INTENTS.MEDIA, text, 8, [
    /\bctv\b/,
    /\bconnected tv\b/,
    /\bstreaming\b/,
    /\btrusted tv\b/,
    /\bmntn\b/,
    /\breal tv\b/,
    /\broku\b/,
    /\bhulu\b/,
    /\bpeacock\b/,
    /\btubi\b/,
    /\bpluto\b/,
    /\bstation\b/,
    /\bspot\b/,
    /\bmedia buy\b/,
    /\bplacement\b/,
    /\bproduction\b/
  ]);

  addScore(scores, INTENTS.PROSPECTING, text, 9, [
    /\bprospect\b/,
    /\bnew business\b/,
    /\bnew clients?\b/,
    /\blead generation\b/,
    /\boutreach\b/,
    /\bproposal\b/,
    /\bsales pipeline\b/
  ]);

  addScore(scores, INTENTS.CLIENT_STRATEGY, text, 5, [
    /\bsoutheast safes\b/,
    /\ba1 action\b/,
    /\bhb guns\b/,
    /\bnorth florida safes\b/,
    /\bpickett weaponry\b/,
    /\bmove a safe\b/,
    /\bsouth florida safes\b/,
    /\blumi\b/,
    /\bglobal concepts media\b/
  ]);

  addScore(scores, INTENTS.INVESTIGATION, text, 9, [
    /\bwhy is\b/,
    /\bwhy are\b/,
    /\broot cause\b/,
    /\binvestigate\b/,
    /\bwhat caused\b/,
    /\bdiagnose\b/,
    /\bprove whether\b/
  ]);

  addScore(scores, INTENTS.WORK, text, 9, [
    /\bfix\b/,
    /\bimplement\b/,
    /\bdeploy\b/,
    /\bcomplete the work\b/,
    /\bperform the work\b/
  ]);

  addScore(scores, INTENTS.PROOF, text, 9, [
    /\bproof of work\b/,
    /\bweekly client email\b/,
    /\bclient update\b/,
    /\bwhat did we complete\b/,
    /\bresults for the client\b/
  ]);

  addScore(scores, INTENTS.CALENDAR, text, 8, [
    /\bcalendar\b/,
    /\bappointment\b/,
    /\bmeeting\b/,
    /\bdeadline\b/,
    /\bdue date\b/,
    /\bschedule\b/
  ]);

  let intent = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];

  if (scores[INTENTS.INBOX_TRIAGE] >= 9) {
    intent = INTENTS.INBOX_TRIAGE;
  } else if (
    scores[INTENTS.RESEARCH] >= 7 &&
    scores[INTENTS.MEDIA] >= 8
  ) {
    intent = INTENTS.RESEARCH;
  }

  const topScore = Math.max(...Object.values(scores));
  const confidence = Math.min(0.99, 0.5 + (topScore * 0.05));

  return {
    intent,
    confidence,
    scores,
    requiresLiveResearch: intent === INTENTS.RESEARCH,
    workspace: WORKSPACES[intent] || WORKSPACES[INTENTS.GENERAL]
  };
}

function buildDeterministicAgencyBrief({
  question,
  classification,
  context
}) {
  const contextSummary = summarizeContext(context);
  const currentState = [];
  const alreadyHandled = [];
  const monitoring = [];
  const needsAttention = [];
  const gaps = [];
  const recommendedSequence = [];

  for (const item of context.intelligence) {
    const title = clean(item.whatHappened || item.what_happened || item.subject || "Agency intelligence");
    const businessMeaning = clean(item.businessMeaning || item.business_meaning);
    const handlingState = clean(item.handlingState || item.handling_state).toLowerCase();
    const alreadyBeingHandled = item.alreadyBeingHandled === true || item.already_being_handled === true;
    const workItemId = item.workItemId ?? item.work_item_id ?? null;
    const investigationId = item.investigationId ?? item.investigation_id ?? null;

    if (handlingState === "work_underway" || workItemId) {
      alreadyHandled.push(
        `${title} — already in active Work${workItemId ? ` Item #${workItemId}` : ""}.`
      );
      continue;
    }

    if (handlingState === "investigating" || investigationId || alreadyBeingHandled) {
      alreadyHandled.push(
        `${title} — already under Investigation${investigationId ? ` #${investigationId}` : ""}.`
      );
      continue;
    }

    if (handlingState === "monitoring" || handlingState === "historical" || handlingState === "handled") {
      monitoring.push(title);
      continue;
    }

    if (item.eligibleForAgencyPriority === false || item.eligible_for_agency_priority === false) {
      monitoring.push(title);
      continue;
    }

    needsAttention.push({
      title,
      reason: businessMeaning || "Durable Intelligence is unresolved and is not currently linked to active handling.",
      workspace: "today"
    });
  }

  for (const item of context.communications) {
    if (item.status === "processed" || item.status === "recorded") {
      alreadyHandled.push(
        clean(item.summary || item.subject || "Processed communication")
      );
    } else if (item.status === "monitoring") {
      monitoring.push(
        clean(item.summary || item.subject || "Monitoring communication")
      );
    } else if (item.needsAttention === true) {
      needsAttention.push({
        title: clean(item.subject || item.title || "Communication requiring attention"),
        reason: clean(item.reason || "The supplied context marks this communication as requiring attention."),
        workspace: "communications"
      });
    }
  }

  for (const item of context.work) {
    if (item.status && !["completed", "cancelled"].includes(item.status)) {
      needsAttention.push({
        title: clean(item.title || item.summary || "Open work"),
        reason: clean(item.reason || `Work status: ${item.status}`),
        workspace: "work"
      });
    }
  }

  for (const item of context.deadlines) {
    needsAttention.push({
      title: clean(item.title || "Upcoming deadline"),
      reason: clean(item.reason || item.due || "A supplied deadline is approaching."),
      workspace: "today"
    });
  }

  for (const item of context.media) {
    if (item.needsAttention === true || item.status === "needs_attention") {
      needsAttention.push({
        title: clean(item.title || "Media item requiring attention"),
        reason: clean(item.reason || "The supplied media context requires follow-up."),
        workspace: "media"
      });
    }
  }

  if (context.prospecting.daysSinceLastActivity >= 3) {
    gaps.push(
      `Prospecting has not been recorded for ${context.prospecting.daysSinceLastActivity} days.`
    );
  }

  for (const signal of context.historicalSignals) {
    if (signal.gap || signal.recommendation) {
      gaps.push(clean(signal.gap || signal.recommendation));
    }
  }

  if (needsAttention.length) {
    recommendedSequence.push(
      `Start with: ${needsAttention[0].title}`
    );
  }

  if (context.prospecting.daysSinceLastActivity >= 3) {
    recommendedSequence.push(
      "Protect a specific block of time for prospecting today."
    );
  }

  if (classification.requiresLiveResearch) {
    recommendedSequence.push(
      "Run current-source research before accepting a recommendation."
    );
  }

  if (!recommendedSequence.length) {
    recommendedSequence.push(
      `Continue in ${classification.workspace.label}.`
    );
  }

  currentState.push(
    `${contextSummary.totalContextItems} supplied context items were reviewed.`
  );

  return {
    objective: question,
    currentState,
    needsAttention: needsAttention.slice(0, 10),
    alreadyHandled: uniqueStrings(alreadyHandled).slice(0, 20),
    monitoring: uniqueStrings(monitoring).slice(0, 20),
    gaps: uniqueStrings(gaps).slice(0, 10),
    recommendedSequence: uniqueStrings(recommendedSequence).slice(0, 5),
    nextBestAction: recommendedSequence[0],
    confidence: classification.confidence,
    limitations: contextSummary.totalContextItems
      ? []
      : [
          "No operational context was supplied. Agency Command can classify the request, but it cannot truthfully report what has already been handled, what is due, or what is in Gmail or Calendar."
        ]
  };
}

function normalizeAgencyBrief(value, fallback) {
  if (!value || typeof value !== "object") return fallback;

  return {
    objective: clean(value.objective) || fallback.objective,
    currentState: normalizeStringArray(value.currentState, fallback.currentState),
    needsAttention: normalizeAttentionItems(value.needsAttention, fallback.needsAttention),
    alreadyHandled: normalizeStringArray(value.alreadyHandled, fallback.alreadyHandled),
    monitoring: normalizeStringArray(value.monitoring, fallback.monitoring),
    gaps: normalizeStringArray(value.gaps, fallback.gaps),
    recommendedSequence: normalizeStringArray(
      value.recommendedSequence,
      fallback.recommendedSequence
    ),
    nextBestAction: clean(value.nextBestAction) || fallback.nextBestAction,
    confidence: normalizeConfidence(value.confidence || fallback.confidence),
    limitations: normalizeStringArray(value.limitations, fallback.limitations)
  };
}

async function loadAgencyIntelligence(env, requestId) {
  if (!env?.DB || typeof env.DB.prepare !== "function") {
    return {
      source: "D1",
      available: false,
      items: [],
      counts: emptyIntelligenceCounts(),
      error: "D1 binding is unavailable."
    };
  }

  try {
    const result = await env.DB.prepare(`
      SELECT
        i.id,
        i.client_id,
        c.client_code,
        c.name AS client_name,
        i.what_happened,
        i.business_meaning,
        i.novelty,
        i.trend,
        i.importance,
        i.handling_state,
        i.recommended_action,
        i.why_now,
        i.proof_requirement,
        i.communication_id,
        i.investigation_id,
        i.work_item_id,
        i.updated_at
      FROM intelligence i
      LEFT JOIN clients c ON c.id = i.client_id
      ORDER BY
        CASE LOWER(COALESCE(i.handling_state, 'unhandled'))
          WHEN 'unhandled' THEN 0
          WHEN 'needs_decision' THEN 0
          WHEN 'investigating' THEN 1
          WHEN 'work_underway' THEN 2
          WHEN 'monitoring' THEN 3
          ELSE 4
        END,
        datetime(COALESCE(i.updated_at, i.created_at)) DESC,
        i.id DESC
      LIMIT 100
    `).all();

    const rows = Array.isArray(result?.results) ? result.results : [];
    const items = rows.map(normalizeD1IntelligenceItem);
    return {
      source: "D1",
      available: true,
      items,
      counts: countIntelligenceStates(items),
      error: null
    };
  } catch (error) {
    logWorkerError({
      requestId,
      route: AGENCY_COMMAND_ACTION,
      stage: "agency_intelligence_read",
      error
    });

    return {
      source: "D1",
      available: false,
      items: [],
      counts: emptyIntelligenceCounts(),
      error: safeErrorMessage(error)
    };
  }
}

function normalizeD1IntelligenceItem(row) {
  const handlingState = clean(row?.handling_state) || "unhandled";
  const workItemId = row?.work_item_id ?? null;
  const investigationId = row?.investigation_id ?? null;

  return {
    id: row?.id ?? null,
    clientId: row?.client_id ?? null,
    clientCode: clean(row?.client_code) || null,
    clientName: clean(row?.client_name) || null,
    whatHappened: clean(row?.what_happened),
    businessMeaning: clean(row?.business_meaning),
    novelty: clean(row?.novelty) || "unknown",
    trend: clean(row?.trend) || "unknown",
    importance: clean(row?.importance) || "normal",
    handlingState,
    recommendedAction: clean(row?.recommended_action),
    whyNow: clean(row?.why_now),
    proofRequirement: clean(row?.proof_requirement),
    communicationId: row?.communication_id ?? null,
    investigationId,
    workItemId,
    alreadyBeingHandled:
      handlingState === "investigating" ||
      handlingState === "work_underway" ||
      Boolean(investigationId) ||
      Boolean(workItemId),
    eligibleForAgencyPriority:
      !["monitoring", "historical", "handled"].includes(handlingState),
    updatedAt: clean(row?.updated_at) || null
  };
}

function mergeAgencyContextWithIntelligence(context, d1Intelligence) {
  return {
    ...context,
    intelligence: [
      ...normalizeObjectArray(d1Intelligence?.items),
      ...normalizeObjectArray(context?.intelligence)
    ].slice(0, 100)
  };
}

function countIntelligenceStates(items) {
  const counts = emptyIntelligenceCounts();

  for (const item of items) {
    const state = clean(item?.handlingState || item?.handling_state).toLowerCase();

    if (state === "work_underway") counts.workUnderway += 1;
    else if (state === "investigating") counts.investigating += 1;
    else if (state === "monitoring") counts.monitoring += 1;
    else if (state === "historical" || state === "handled") counts.historicalHandled += 1;
    else counts.unresolved += 1;
  }

  counts.total = items.length;
  return counts;
}

function emptyIntelligenceCounts() {
  return {
    total: 0,
    unresolved: 0,
    investigating: 0,
    workUnderway: 0,
    monitoring: 0,
    historicalHandled: 0
  };
}

function normalizeAgencyContext(value) {
  const context = value && typeof value === "object" ? value : {};

  return {
    communications: normalizeObjectArray(context.communications),
    work: normalizeObjectArray(context.work),
    deadlines: normalizeObjectArray(context.deadlines),
    calendar: normalizeObjectArray(context.calendar),
    media: normalizeObjectArray(context.media),
    prospects: normalizeObjectArray(context.prospects),
    historicalSignals: normalizeObjectArray(
      context.historicalSignals || context.historical_signals
    ),
    intelligence: normalizeObjectArray(context.intelligence),
    prospecting: {
      daysSinceLastActivity: normalizeNonNegativeNumber(
        context?.prospecting?.daysSinceLastActivity ??
        context?.prospecting?.days_since_last_activity
      ),
      lastActivityAt: clean(
        context?.prospecting?.lastActivityAt ||
        context?.prospecting?.last_activity_at
      ) || null
    },
    notes: normalizeStringArray(context.notes)
  };
}

function summarizeContext(context) {
  const counts = {
    communications: context.communications.length,
    work: context.work.length,
    deadlines: context.deadlines.length,
    calendar: context.calendar.length,
    media: context.media.length,
    prospects: context.prospects.length,
    historicalSignals: context.historicalSignals.length,
    intelligence: context.intelligence.length,
    notes: context.notes.length
  };

  return {
    counts,
    totalContextItems: Object.values(counts)
      .reduce((total, count) => total + count, 0),
    prospectingDaysSinceLastActivity:
      context.prospecting.daysSinceLastActivity
  };
}

function addScore(scores, key, text, amount, patterns) {
  if (patterns.some(pattern => pattern.test(text))) {
    scores[key] += amount;
  }
}

function normalizeObjectArray(value) {
  return Array.isArray(value)
    ? value.filter(item => item && typeof item === "object").slice(0, 100)
    : [];
}

function normalizeStringArray(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return uniqueStrings(source).slice(0, 50);
}

function normalizeAttentionItems(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;

  return source
    .map(item => {
      if (typeof item === "string") {
        return {
          title: clean(item),
          reason: "",
          workspace: "today"
        };
      }

      if (!item || typeof item !== "object") return null;

      return {
        title: clean(item.title || item.subject || item.summary),
        reason: clean(item.reason),
        workspace: clean(item.workspace) || "today"
      };
    })
    .filter(item => item && item.title)
    .slice(0, 20);
}

function normalizeConfidence(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 0.5;
  if (number > 1 && number <= 100) {
    return Math.max(0, Math.min(1, number / 100));
  }

  return Math.max(0, Math.min(1, number));
}

function normalizeNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function uniqueStrings(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const result = [];

  for (const item of source) {
    const text = clean(item);
    const key = text.toLowerCase();

    if (!text || seen.has(key)) continue;

    seen.add(key);
    result.push(text);
  }

  return result;
}
