/* =========================================================
   Global Concepts Media Operating System
   File: tests/prospectCrm.test.js
   Version: 1.1.0
   Status: Production Test Candidate
   Purpose: Verify locked CRM timing/payment rules plus service-selection and
            startup-package generation without production D1 writes.
   Change Notes — 1.1.0:
   - Preserves proposal follow-up and 25% payment-gate tests.
   - Verifies the standard GCM service catalog is available.
   - Verifies multi-service startup requirements are deduplicated.
   - Verifies client and GCM internal startup requirements remain distinguishable.
   - Verifies custom startup requirements can extend a signed custom scope.
   ========================================================= */

import assert from "node:assert/strict";
import {
  addBusinessDays,
  buildStartupRequirements,
  minimumInitialPaymentCents,
  normalizeProspectStage,
  normalizeProspectStatus,
  serviceCatalogForResponse
} from "../routes/prospectCrm.js";

assert.equal(
  addBusinessDays("2026-08-17", 3),
  "2026-08-20",
  "Agnor Aug 17 meaningful contact must create Aug 20 follow-up."
);

assert.equal(
  addBusinessDays("2026-08-21", 2),
  "2026-08-25",
  "Two business days from Friday must skip the weekend."
);

assert.equal(
  addBusinessDays("2026-08-22", 1),
  "2026-08-24",
  "A business-day calculation starting on Saturday must land on Monday."
);

assert.equal(
  minimumInitialPaymentCents(100000),
  25000,
  "A $1,000 contract must require at least $250 before work begins."
);

assert.equal(
  minimumInitialPaymentCents(99999),
  25000,
  "The 25% minimum must round up to the nearest cent."
);

assert.equal(normalizeProspectStage("Proposal Sent"), "proposal_sent");
assert.equal(normalizeProspectStage("Awaiting Decision"), "awaiting_decision");
assert.equal(normalizeProspectStatus("Active"), "active");
assert.equal(normalizeProspectStatus("NURTURE"), "nurture");

const catalog = serviceCatalogForResponse();
assert.ok(catalog.length >= 12, "GCM service catalog should contain the standard service families.");
for (const requiredService of [
  "website_rebuild",
  "seo_search_visibility",
  "analytics_measurement",
  "media_planning_buying",
  "consulting_agency_of_record",
  "custom_other"
]) {
  assert.ok(catalog.some(service => service.key === requiredService), `Missing service catalog entry: ${requiredService}`);
}

const agnorStartup = buildStartupRequirements([
  "website_rebuild",
  "seo_search_visibility",
  "analytics_measurement"
]);
const agnorKeys = agnorStartup.map(item => item.key);
assert.equal(new Set(agnorKeys).size, agnorKeys.length, "Startup package must deduplicate requirements shared by multiple services.");
for (const requiredKey of [
  "domain_dns_access",
  "hosting_access",
  "website_admin_access",
  "ga4_access",
  "gsc_access",
  "gtm_access",
  "priority_services",
  "service_areas"
]) {
  assert.ok(agnorKeys.includes(requiredKey), `Agnor-style website/search/analytics startup is missing ${requiredKey}.`);
}

const websiteAdmin = agnorStartup.find(item => item.key === "website_admin_access");
assert.ok(websiteAdmin.sourceServices.length >= 3, "Shared website access should be requested once but show every service that requires it.");
assert.ok(agnorStartup.some(item => item.responsibleParty === "client"), "Startup package must identify client-provided requirements.");
assert.ok(agnorStartup.some(item => item.responsibleParty === "gcm"), "Startup package must also preserve GCM internal setup work.");

const custom = buildStartupRequirements(["custom_other"], [
  {
    key: "hangar_asset_inventory",
    title: "Hangar asset inventory",
    clientRequest: "Please provide the approved list of hangar assets included in the custom scope.",
    responsibleParty: "client",
    category: "Custom"
  }
]);
assert.ok(custom.some(item => item.key === "hangar_asset_inventory"), "Custom signed scope must be able to add a specific startup requirement.");

console.log("PASS Prospect CRM business rules + service startup package");
