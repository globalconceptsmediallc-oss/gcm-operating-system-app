/******************************************************************************
 * Global Concepts Media Operating System
 * Version 2 Foundation
 * parser.js
 ******************************************************************************/

function extractJson(text) {

    try {

        return JSON.parse(text);

    } catch (error) {

        console.error("Unable to parse AI response.");

        console.error(error);

        return null;

    }

}

function validateBusinessRecord(record) {

    if (!record) return false;

    if (!record.businessName)
        record.businessName = "Unknown Business";

    if (!record.industry)
        record.industry = "Unknown";

    if (!record.market)
        record.market = "Unknown";

    if (!record.website)
        record.website = "";

    if (!record.primaryService)
        record.primaryService = "Unknown";

    if (!record.qualificationScore)
        record.qualificationScore = 0;

    if (!record.decision)
        record.decision = "NO";

    if (!record.outreachReady)
        record.outreachReady = false;

    return record;

}

function buildMarkdown(record) {

    return `# Business Intelligence Brief

## Business

${record.businessName}

## Website

${record.website}

## Industry

${record.industry}

## Market

${record.market}

## Primary Service

${record.primaryService}

## Qualification Score

${record.qualificationScore}

## Outreach Decision

${record.decision}

---

${record.report || ""}
`;

}

function buildSnapshot(record){

    return {

        businessName: record.businessName,

        website: record.website,

        industry: record.industry,

        market: record.market,

        primaryService: record.primaryService,

        qualificationScore: record.qualificationScore,

        decision: record.decision,

        outreachReady: record.outreachReady

    };

}

function parseBusinessResponse(responseText){

    let record = extractJson(responseText);

    record = validateBusinessRecord(record);

    return {

        snapshot: buildSnapshot(record),

        markdown: buildMarkdown(record),

        record: record

    };

}
