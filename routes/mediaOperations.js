/* =========================================================
   Global Concepts Media Operating System
   File: routes/mediaOperations.js
   Version: 8.4.0
   Status: Production Candidate
   Source: routes/mediaOperations.js 8.3.0
   Sprint: Placement End-of-Run Disposition
   Purpose: Preserve legacy placement operations and the creative workflow
            while routing Media-specific Gmail draft, attachment, recovered
            existing-media, market-level Traffic ID, and placement disposition
            operations.

   Production rules:
   - Existing media_records behavior remains unchanged in the legacy module.
   - Creative workflow operations remain additive and separate from placements.
   - Station email draft operations preserve attachment metadata and never send.
   - Existing Media recovery preserves authoritative placement history.
   - Traffic IDs / ISCIs belong to market assignments when one Creative runs
     in more than one market.
   - Placement disposition records an explicit operator decision without
     changing the placement's current run dates or status.
   - Nothing in the creative chain automatically changes a placement record.
   ========================================================= */

import { handleMediaOperations as handleLegacyMediaOperations } from "./mediaOperationsLegacy.js";
import { handleMediaCreativeWorkflow, MEDIA_CREATIVE_OPERATIONS } from "./mediaCreativeWorkflow.js";
import { handleMediaStationDraft, MEDIA_STATION_DRAFT_OPERATIONS } from "./mediaStationDraft.js";
import { handleMediaExistingRecovery, MEDIA_EXISTING_RECOVERY_OPERATIONS } from "./mediaExistingRecovery.js";
import {
  handleMediaAssignmentTrafficIds,
  MEDIA_ASSIGNMENT_TRAFFIC_ID_OPERATIONS
} from "./mediaAssignmentTrafficIds.js";
import {
  handleMediaPlacementDisposition,
  MEDIA_PLACEMENT_DISPOSITION_OPERATIONS
} from "./mediaPlacementDisposition.js";

export async function handleMediaOperations(body,env,requestId){
  const operation=String(body?.operation||"get").trim().toLowerCase();
  if(MEDIA_EXISTING_RECOVERY_OPERATIONS.includes(operation)){
    return handleMediaExistingRecovery(operation,body,env,requestId);
  }
  if(MEDIA_STATION_DRAFT_OPERATIONS.includes(operation)){
    return handleMediaStationDraft(operation,body,env,requestId);
  }
  if(MEDIA_ASSIGNMENT_TRAFFIC_ID_OPERATIONS.includes(operation)){
    return handleMediaAssignmentTrafficIds(operation,body,env,requestId);
  }
  if(MEDIA_PLACEMENT_DISPOSITION_OPERATIONS.includes(operation)){
    return handleMediaPlacementDisposition(operation,body,env,requestId);
  }
  if(MEDIA_CREATIVE_OPERATIONS.includes(operation)){
    return handleMediaCreativeWorkflow(operation,body,env,requestId);
  }
  return handleLegacyMediaOperations(body,env,requestId);
}
