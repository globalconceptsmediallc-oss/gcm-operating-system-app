/* =========================================================
   Global Concepts Media Operating System
   File: routes/mediaOperations.js
   Version: 8.1.0
   Status: Production Candidate
   Source: routes/mediaOperations.js 8.0.0
   Sprint: Complete Station Email Package
   Purpose: Preserve legacy placement operations and the creative workflow
            while routing Media-specific Gmail draft + attachment operations.

   Production rules:
   - Existing media_records behavior remains unchanged in the legacy module.
   - Creative workflow operations remain additive and separate from placements.
   - Station email draft operations preserve attachment metadata and never send.
   - Nothing in the creative chain automatically changes a placement record.
   ========================================================= */

import { handleMediaOperations as handleLegacyMediaOperations } from "./mediaOperationsLegacy.js";
import { handleMediaCreativeWorkflow, MEDIA_CREATIVE_OPERATIONS } from "./mediaCreativeWorkflow.js";
import { handleMediaStationDraft, MEDIA_STATION_DRAFT_OPERATIONS } from "./mediaStationDraft.js";

export async function handleMediaOperations(body,env,requestId){
  const operation=String(body?.operation||"get").trim().toLowerCase();
  if(MEDIA_STATION_DRAFT_OPERATIONS.includes(operation)){
    return handleMediaStationDraft(operation,body,env,requestId);
  }
  if(MEDIA_CREATIVE_OPERATIONS.includes(operation)){
    return handleMediaCreativeWorkflow(operation,body,env,requestId);
  }
  return handleLegacyMediaOperations(body,env,requestId);
}
