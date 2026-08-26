from pathlib import Path
import json

# routes/gmailDispositions.js
path = Path("routes/gmailDispositions.js")
text = path.read_text()
text = text.replace("Version: 2.1.0", "Version: 2.2.0", 1)
text = text.replace(
    "   Thread-routing changes — 2.1.0:\n",
    "   Requested Work content changes — 2.2.0:\n"
    "   - Human-routed Requested Work now carries an explicit workTitle from the Gmail subject.\n"
    "   - Human-routed Requested Work now carries workDescription from the cleaned preserved source conversation.\n"
    "   - AI/classifier eligibility remains outside the critical path; source evidence defines the task.\n\n"
    "   Thread-routing changes — 2.1.0:\n",
    1,
)
text = text.replace(
    'export const GMAIL_HUMAN_ROUTING_VERSION = "2.1.0";',
    'export const GMAIL_HUMAN_ROUTING_VERSION = "2.2.0";',
    1,
)
old = '''  const actions = {
    information:"Retain as client/business history. No action required unless later evidence changes its relevance.",
    investigation:"Review the preserved source evidence, determine the actual condition, and establish the correct next action before creating corrective work.",
    requested_work:"Execute the requested work from the preserved source email and record the result as Proof of Work."
  };

  return {
    source:"Gmail — Human Routing",
    communicationType:labels[disposition] || "Gmail Communication",
    title:clean(message.subject) || "Gmail communication",
'''
new = '''  const actions = {
    information:"Retain as client/business history. No action required unless later evidence changes its relevance.",
    investigation:"Review the preserved source evidence, determine the actual condition, and establish the correct next action before creating corrective work.",
    requested_work:"Execute the requested work from the preserved source email and record the result as Proof of Work."
  };
  const requestedWorkSource = disposition === "requested_work"
    ? sanitizeEmailText(message.bodyText || message.snippet || message.subject).slice(0, 12000)
    : "";

  return {
    source:"Gmail — Human Routing",
    communicationType:labels[disposition] || "Gmail Communication",
    title:clean(message.subject) || "Gmail communication",
    workTitle:disposition === "requested_work"
      ? clean(message.subject) || "Requested Work"
      : "",
    workDescription:requestedWorkSource,
'''
if old not in text:
    raise SystemExit("gmailDispositions Requested Work anchor not found")
text = text.replace(old, new, 1)
path.write_text(text)

# routes/operationalDecision.js
path = Path("routes/operationalDecision.js")
text = path.read_text()
text = text.replace("Version: 7.0.0", "Version: 7.1.0", 1)
text = text.replace(
    "   Purpose: Commit one reviewed operational decision to D1\n"
    "            as a Communication and, when selected, an\n"
    "            Investigation or Work Item.\n",
    "   Purpose: Commit one reviewed operational decision to D1\n"
    "            as a Communication and, when selected, an\n"
    "            Investigation or Work Item.\n"
    "   Changes — 7.1.0:\n"
    "   - Adds optional workTitle/workDescription fields for human-reviewed Work Items.\n"
    "   - Uses those explicit fields before legacy recommendedAction/reasoning fallbacks.\n"
    "   - Preserves backward compatibility for every existing caller that omits them.\n",
    1,
)
text = text.replace(
    "        decision.recommendedAction || decision.title,\n        decision.reasoning || decision.operationalSummary,",
    "        decision.workTitle || decision.recommendedAction || decision.title,\n        decision.workDescription || decision.reasoning || decision.operationalSummary,",
    1,
)
text = text.replace(
    "    title: clean(decision.title || decision.subject),\n    operationalSummary: clean(decision.operationalSummary || decision.summary),",
    "    title: clean(decision.title || decision.subject),\n    workTitle: clean(decision.workTitle || decision.work_title),\n    workDescription: clean(decision.workDescription || decision.work_description),\n    operationalSummary: clean(decision.operationalSummary || decision.summary),",
    1,
)
path.write_text(text)

# Additive repair migration for already-created placeholder Gmail Human Routing work.
migration = Path("migrations/0015_gmail_requested_work_content_repair.sql")
migration.write_text('''-- =========================================================\n-- Global Concepts Media Operating System\n-- File: migrations/0015_gmail_requested_work_content_repair.sql\n-- Version: 1.0.0\n-- Status: Additive Production Migration\n-- Purpose: Repair human-routed Gmail Requested Work records created with\n--          generic routing metadata instead of the preserved source request.\n-- =========================================================\n\nUPDATE work_items\nSET\n  title = COALESCE(\n    (\n      SELECT NULLIF(TRIM(c.subject), '')\n      FROM communications c\n      WHERE c.id = work_items.communication_id\n      LIMIT 1\n    ),\n    title\n  ),\n  description = COALESCE(\n    (\n      SELECT NULLIF(TRIM(c.raw_content), '')\n      FROM communications c\n      WHERE c.id = work_items.communication_id\n      LIMIT 1\n    ),\n    description\n  )\nWHERE title = 'Execute the requested work from the preserved source email and record the result as Proof of Work.'\n  AND description = 'Human operational decision. AI/classifier eligibility was not used to permit or block this route.'\n  AND EXISTS (\n    SELECT 1\n    FROM communications c\n    WHERE c.id = work_items.communication_id\n      AND c.source = 'Gmail — Human Routing'\n      AND c.category = 'Requested Work'\n  );\n''')

# Permanent regression.
test = Path("tests/gmailRequestedWorkContent.test.js")
test.write_text('''/* =========================================================\n   Global Concepts Media Operating System\n   File: tests/gmailRequestedWorkContent.test.js\n   Version: 1.0.0\n   Status: Production Regression Test\n   Purpose: Lock human-routed Gmail Requested Work to executable source\n            content instead of generic routing metadata.\n   ========================================================= */\n\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\n\nfunction read(path) {\n  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");\n}\n\nconst dispositions = read("routes/gmailDispositions.js");\nconst operationalDecision = read("routes/operationalDecision.js");\nconst migration = read("migrations/0015_gmail_requested_work_content_repair.sql");\n\nassert.match(dispositions, /Version: 2\\.2\\.0/);\nassert.match(dispositions, /GMAIL_HUMAN_ROUTING_VERSION = "2\\.2\\.0"/);\nassert.match(dispositions, /workTitle:disposition === "requested_work"/);\nassert.match(dispositions, /workDescription:requestedWorkSource/);\nassert.match(dispositions, /sanitizeEmailText\\(message\\.bodyText \\|\\| message\\.snippet \\|\\| message\\.subject\\)/);\n\nassert.match(operationalDecision, /Version: 7\\.1\\.0/);\nassert.match(operationalDecision, /workTitle: clean\\(decision\\.workTitle \\|\\| decision\\.work_title\\)/);\nassert.match(operationalDecision, /workDescription: clean\\(decision\\.workDescription \\|\\| decision\\.work_description\\)/);\nassert.match(operationalDecision, /decision\\.workTitle \\|\\| decision\\.recommendedAction \\|\\| decision\\.title/);\nassert.match(operationalDecision, /decision\\.workDescription \\|\\| decision\\.reasoning \\|\\| decision\\.operationalSummary/);\n\nassert.match(migration, /c\\.source = 'Gmail — Human Routing'/);\nassert.match(migration, /c\\.category = 'Requested Work'/);\nassert.match(migration, /SELECT NULLIF\\(TRIM\\(c\\.subject\\), ''\\)/);\nassert.match(migration, /SELECT NULLIF\\(TRIM\\(c\\.raw_content\\), ''\\)/);\nassert.match(migration, /Execute the requested work from the preserved source email and record the result as Proof of Work/);\n\nconsole.log("PASS Gmail human Requested Work preserves executable source content and repairs generic placeholders");\n''')

# package.json: add permanent regression to the full suite and bump package metadata.
package_path = Path("package.json")
package = json.loads(package_path.read_text())
package["version"] = "6.1.26"
package.setdefault("gcm", {})["fileVersion"] = "6.1.26"
package["gcm"]["purpose"] = "Preserve human-routed Gmail Requested Work as executable source-based work rather than generic routing metadata."
package["gcm"]["changeNotes"] = [
    "Updates Gmail Human Routing to 2.2.0 and Operational Decision commit to 7.1.0.",
    "Adds explicit workTitle/workDescription fields while preserving legacy fallbacks for existing callers.",
    "Adds migration 0015 to repair existing Gmail Human Routing Requested Work placeholders from linked Communication source evidence.",
    "Adds permanent Requested Work content regression coverage."
]
scripts = package.setdefault("scripts", {})
scripts["test:gmail-requested-work-content"] = "node tests/gmailRequestedWorkContent.test.js"
full = scripts["test"]
anchor = "npm run test:gmail-thread-routing"
if "test:gmail-requested-work-content" not in full:
    full = full.replace(anchor, anchor + " && npm run test:gmail-requested-work-content")
scripts["test"] = full
package_path.write_text(json.dumps(package, indent=2) + "\n")
