/* =========================================================
   Global Concepts Media Operating System (GCM OS)
   File: tests/calendarSourceSync.test.js
   Test Version: 1.1.0
   Status: Production Regression Lock
   Purpose: Prevent Agency Calendar, Today Forward Look, and Media Calendar
            from drifting away from the authoritative SES gun-show and
            Liberty promotion schedule sources.
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

function sourceVersion(html, fileName) {
  const marker = fileName + "?v=";
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const rest = html.slice(start + marker.length);
  const match = rest.match(/^([0-9.]+)/);
  return match ? match[1] : null;
}

const shows = JSON.parse(read(files.shows));
const promotions = JSON.parse(read(files.promotions));
const calendar = read(files.calendar);
const today = read(files.today);
const mediaCalendar = read(files.mediaCalendar);
const scheduleControl = read(files.scheduleControl);
const scheduleRoute = read(files.scheduleRoute);
const worker = read(files.worker);

const showVersion = String(shows.version || "");
const promoVersion = String(promotions.version || "");

assert(showVersion, "SES gun-show schedule must have a version.");
assert(promoVersion, "SES Liberty promotion schedule must have a version.");

const calendarShowVersion = sourceVersion(calendar, "data/ses-gun-shows.json");
const todayShowVersion = sourceVersion(today, "data/ses-gun-shows.json");
const mediaShowVersion = sourceVersion(mediaCalendar, "data/ses-gun-shows.json");

assert(calendarShowVersion === showVersion,
  `Agency Calendar gun-show source drift: expected ${showVersion}, found ${calendarShowVersion || "missing"}.`);
assert(todayShowVersion === showVersion,
  `Today gun-show source drift: expected ${showVersion}, found ${todayShowVersion || "missing"}.`);
assert(mediaShowVersion === showVersion,
  `Media Calendar gun-show source drift: expected ${showVersion}, found ${mediaShowVersion || "missing"}.`);

const calendarPromoVersion = sourceVersion(calendar, "data/ses-liberty-promotions.json");
const mediaPromoVersion = sourceVersion(mediaCalendar, "data/ses-liberty-promotions.json");

assert(calendarPromoVersion === promoVersion,
  `Agency Calendar promotion source drift: expected ${promoVersion}, found ${calendarPromoVersion || "missing"}.`);
assert(mediaPromoVersion === promoVersion,
  `Media Calendar promotion source drift: expected ${promoVersion}, found ${mediaPromoVersion || "missing"}.`);

for (const market of ["Melbourne", "Orlando"]) {
  assert(shows.rules && shows.rules[market],
    `Missing authoritative gun-show rule for ${market}.`);
  assert(Number(shows.rules[market].trafficWarningDaysBeforeFlightStart) === 7,
    `${market} traffic warning must remain 7 days before flight start.`);
}

assert(calendar.includes("trafficWarningDaysBeforeFlightStart"),
  "Agency Calendar must derive Traffic Due from the authoritative gun-show rule.");
assert(today.includes("trafficWarningDaysBeforeFlightStart"),
  "Today Forward Look must derive Traffic Due from the authoritative gun-show rule.");
assert(mediaCalendar.includes("function gunShowRows()"),
  "Media Calendar must derive gun-show events from the authoritative schedule.");
assert(mediaCalendar.includes('source:"gun-show-source"'),
  "Media Calendar authoritative gun-show rows are missing.");
assert(calendar.includes("addCalendarDays(flightStart,-2)"),
  "Hard Monday station deadline derivation must remain two calendar days before Wednesday flight.");

assert(calendar.includes("derivedPromotionEvents()"),
  "Agency Calendar must derive Liberty promotion events from the shared promotion source.");
assert(mediaCalendar.includes("function promotionRows()"),
  "Media Calendar must derive Liberty promotion rows from the shared promotion source.");
assert(Array.isArray(promotions.promotions) && promotions.promotions.length > 0,
  "Liberty promotion source must contain promotions.");

for (const [name, html] of [
  ["Agency Calendar", calendar],
  ["Media Calendar", mediaCalendar],
  ["Today", today]
]) {
  assert(html.includes("schedule-operations"),
    name + " must read the durable D1 Schedule Operations authority.");
}

assert(scheduleControl.includes('operation:"create_candidate"'),
  "Schedule Control must create review candidates instead of changing live dates directly.");
assert(scheduleControl.includes('operation,"approve_candidate"') || scheduleControl.includes('"approve_candidate"'),
  "Schedule Control must expose explicit human approval.");
assert(scheduleRoute.includes('SCHEDULE_OPERATIONS_ACTION = "schedule-operations"'),
  "Schedule Operations route contract is missing.");
assert(scheduleRoute.includes('schedule_item_history'),
  "Schedule Operations must preserve version history.");
assert(worker.includes("SCHEDULE_OPERATIONS_ACTION"),
  "Worker must route Schedule Operations.");

console.log("PASS: Calendar source sync lock");
console.log(`Gun-show source version: ${showVersion}`);
console.log(`Promotion source version: ${promoVersion}`);
console.log("Traffic warning lead: 7 days");
