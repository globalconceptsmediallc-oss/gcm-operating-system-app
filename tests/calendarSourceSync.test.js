/* =========================================================
   Global Concepts Media Operating System (GCM OS)
   File: tests/calendarSourceSync.test.js
   Test Version: 1.2.2
   Status: Production Regression Lock
   Purpose: Lock D1 Schedule Operations as the only production schedule
            authority for Agency Calendar, Media Calendar, and Today.
            Static SES JSON files remain seed/history inputs only and must
            never be used as runtime production fallbacks.
   ========================================================= */

import fs from "node:fs";

const files = {
  shows: "data/ses-gun-shows.json",
  promotions: "data/ses-liberty-promotions.json",
  calendar: "calendar.html",
  today: "today.html",
  mediaCalendar: "media-calendar.html",
  scheduleControl: "schedule.html",
  scheduleRoute: "routes/scheduleOperations.js",
  worker: "worker.js"
};

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const shows = JSON.parse(read(files.shows));
const promotions = JSON.parse(read(files.promotions));
const calendar = read(files.calendar);
const today = read(files.today);
const mediaCalendar = read(files.mediaCalendar);
const scheduleControl = read(files.scheduleControl);
const scheduleRoute = read(files.scheduleRoute);
const worker = read(files.worker);

assert(String(shows.version || ""), "SES gun-show seed/history file must remain versioned.");
assert(String(promotions.version || ""), "SES Liberty promotion seed/history file must remain versioned.");
assert(Array.isArray(shows.shows) && shows.shows.length > 0,
  "SES gun-show seed/history file must retain seeded show records.");
assert(Array.isArray(promotions.promotions) && promotions.promotions.length > 0,
  "SES Liberty promotion seed/history file must retain seeded promotion records.");

for (const market of ["Melbourne", "Orlando"]) {
  assert(shows.rules && shows.rules[market],
    `Missing seeded gun-show rule for ${market}.`);
  assert(Number(shows.rules[market].trafficWarningDaysBeforeFlightStart) === 7,
    `${market} seeded traffic-warning rule must remain 7 days before flight start.`);
}

for (const [name, html] of [
  ["Agency Calendar", calendar],
  ["Media Calendar", mediaCalendar],
  ["Today", today]
]) {
  assert(html.includes("schedule-operations"),
    name + " must read D1 Schedule Operations.");
  assert(!html.includes('fetch("data/ses-gun-shows.json'),
    name + " must not fetch the static gun-show seed file at runtime.");
  assert(!html.includes('fetch("data/ses-liberty-promotions.json'),
    name + " must not fetch the static Liberty promotion seed file at runtime.");
  assert(!html.includes("SHOW_SCHEDULE_URL"),
    name + " must not expose a runtime gun-show JSON fallback constant.");
  assert(!html.includes("PROMO_SCHEDULE_URL"),
    name + " must not expose a runtime promotion JSON fallback constant.");
}

assert(calendar.includes("if(!scheduleAuthorityLoaded)return[]"),
  "Agency Calendar must show no schedule dates when D1 Schedule Authority is unavailable.");
assert(calendar.includes("Schedule data unavailable — D1 Schedule Authority did not respond."),
  "Agency Calendar must expose a visible D1 schedule fail-safe.");
assert(!calendar.includes("derivedShowEvents().concat(derivedPromotionEvents())"),
  "Agency Calendar must not substitute static-derived schedule events.");

assert(mediaCalendar.includes("scheduled=scheduleAuthorityRows()"),
  "Media Calendar must use D1 schedule rows without a static schedule fallback.");
assert(mediaCalendar.includes('id="schedule-authority-state"'),
  "Media Calendar must expose a visible D1 schedule fail-safe.");
assert(mediaCalendar.includes("Static schedule seeds are intentionally not used."),
  "Media Calendar must explicitly prevent stale static fallback behavior.");

assert(today.includes("let forwardLookScheduleAuthorityUnavailable = false;"),
  "Today Forward Look must declare the Schedule Authority availability state before strict-mode assignment.");
assert(today.includes("forwardLookScheduleAuthorityUnavailable = true"),
  "Today Forward Look must record D1 Schedule Authority failure.");
assert(today.includes("Schedule Authority unavailable — no static fallback"),
  "Today Forward Look must expose a visible no-fallback state.");
assert(today.includes("Static schedule seeds are intentionally not used."),
  "Today must explicitly prevent stale static schedule fallback behavior.");

assert(scheduleControl.includes('operation:"create_candidate"'),
  "Schedule Control must create review candidates instead of changing live dates directly.");

assert(scheduleControl.includes("const existingSchedule=Array.isArray(existingMeta.schedule)?existingMeta.schedule:[];"),
  "Promotion edit metadata must read the existing promotion schedule.");
assert(scheduleControl.includes("const exact=existingSchedule.find"),
  "Promotion edits must preserve existing social post metadata by original date.");
assert(scheduleControl.includes("const preserved=exact||existingSchedule[index]||null;"),
  "Promotion edits must preserve post title/theme by position when a social date moves.");
assert(scheduleControl.includes("return{offer:$(\"offer\").value.trim()||null,channels,schedule};"),
  "Promotion edits must preserve channels and the reconstructed schedule metadata.");
assert(scheduleControl.includes('operation,"approve_candidate"') || scheduleControl.includes('"approve_candidate"'),
  "Schedule Control must expose explicit human approval.");
assert(scheduleRoute.includes('SCHEDULE_OPERATIONS_ACTION = "schedule-operations"'),
  "Schedule Operations route contract is missing.");
assert(scheduleRoute.includes("schedule_item_history"),
  "Schedule Operations must preserve version history.");
assert(scheduleRoute.includes("trafficWarningDaysBeforeFlightStart"),
  "Schedule Operations must preserve the gun-show traffic-warning rule in durable metadata/events.");
assert(worker.includes("SCHEDULE_OPERATIONS_ACTION"),
  "Worker must route Schedule Operations.");

console.log("PASS: D1-only calendar schedule authority lock");
console.log(`Gun-show seed/history version: ${shows.version}`);
console.log(`Promotion seed/history version: ${promotions.version}`);
console.log("Runtime static schedule fallback: disabled");
console.log("Promotion edit metadata preservation: locked");
