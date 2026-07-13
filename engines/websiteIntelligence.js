/* =========================================================
   Global Concepts Media Operating System (GCM OS)
   Engine: Website Intelligence
   Version: 1.0.0
   Status: Production Foundation

   Responsibility:
   Extract publicly observable website evidence only.

   This engine MUST NOT:

   - Diagnose
   - Classify Growth Leaks
   - Prioritize findings
   - Recommend actions
   - Build Business Snapshots
   - Build Client Pre-Research
   - Generate Growth Reviews

   Principle:

   Evidence Before Assumptions.

========================================================= */

export const WebsiteIntelligenceEngine = {

    id: "website-intelligence",

    version: "1.0.0",

    name: "Website Intelligence Engine",

    description:
        "Extracts publicly observable website evidence into a standardized evidence package.",

    systemRole:

`You are the Website Intelligence Engine for the Global Concepts Media Operating System.

Your responsibility is limited to extracting publicly observable business evidence.

Never diagnose.

Never recommend.

Never prioritize.

Never classify Growth Leaks.

Never create consulting conclusions.

Return only observable evidence.`,

    objectives: [

        "Extract business identity.",

        "Extract industry evidence.",

        "Extract services.",

        "Extract service area.",

        "Extract contact paths.",

        "Extract trust evidence.",

        "Extract calls to action.",

        "Extract certifications.",

        "Extract ownership evidence when explicitly published.",

        "Separate observable facts from public marketing claims.",

        "Identify evidence requiring verification."

    ],

    evidenceRules: [

        "Never invent information.",

        "Never infer missing information.",

        "Unknown is acceptable.",

        "Missing information is NOT a Growth Leak.",

        "Marketing claims are not verified facts.",

        "Return observable evidence only."

    ],

    outputSchema: {

        businessName: "string",

        industry: "string",

        services: [],

        serviceAreas: [],

        contactPaths: [],

        trustEvidence: [],

        certifications: [],

        ownershipEvidence: [],

        callsToAction: [],

        publicClaims: [],

        verificationRequired: []

    }

};

/* =========================================================
   Prompt Builder
========================================================= */

export function buildWebsitePrompt(websiteText) {

    return `
${WebsiteIntelligenceEngine.systemRole}

WEBSITE CONTENT

${websiteText}

Return ONLY valid JSON matching the output schema.
`;

}

/* =========================================================
   Output Validator
========================================================= */

export function validateWebsiteEvidence(result) {

    if (!result || typeof result !== "object") {

        return false;

    }

    const requiredFields = [

        "businessName",

        "industry",

        "services",

        "serviceAreas",

        "contactPaths",

        "trustEvidence",

        "certifications",

        "ownershipEvidence",

        "callsToAction",

        "publicClaims",

        "verificationRequired"

    ];

    return requiredFields.every(field => field in result);

}

/* =========================================================
   End Website Intelligence Engine
========================================================= */
