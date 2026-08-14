/* =========================================================
   Global Concepts Media Operating System
   File: routes/mediaOperations.js
   Version: 8.0.0
   Status: Production Candidate
   Source: routes/mediaOperations.js 7.9.0
   Sprint: Media Creative Workflow Router
   Purpose: Preserve the full legacy placement engine while routing the new
            creative-production operations to mediaCreativeWorkflow.js.

   Production rules:
   - Existing media_records behavior remains unchanged in the legacy module.
   - Creative workflow operations are additive and use separate D1 tables.
   - Nothing in the new creative chain automatically changes a placement record.
   ========================================================= */

import { handleMediaOperations as handleLegacyMediaOperations } from "./mediaOperationsLegacy.js";
import { handleMediaCreativeWorkflow, MEDIA_CREATIVE_OPERATIONS } from "./mediaCreativeWorkflow.js";

export async function handleMediaOperations(body,env,requestId){
  const operation=String(body?.operation||"get").trim().toLowerCase();
  if(MEDIA_CREATIVE_OPERATIONS.includes(operation)){
    return handleMediaCreativeWorkflow(operation,body,env,requestId);
  }
  return handleLegacyMediaOperations(body,env,requestId);
}
