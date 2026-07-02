/* =========================================================
   Global Concepts Media Operating System
   Version 2 Foundation
   File: worker.js
   Purpose: Hidden AI Business Intelligence Worker
   ========================================================= */

/*
  IMPORTANT:
  This file is designed to run as a serverless Worker.

  Do NOT expose this as a normal public JavaScript file in the browser.
  The API key and hidden prompt must stay server-side.

  Required environment variable:
  AI_API_KEY
*/

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return handleCors();
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
      const body = await request.json();
      const websiteUrl = body.websiteUrl;

      if (!websiteUrl) {
        return jsonResponse({ error: "Website URL is required." }, 400);
      }

      const prompt = buildBusinessIntelligencePrompt(websiteUrl);

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.AI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: "You are a Business Intelligence Analyst for Global Concepts Media. Return only valid JSON."
            },
            {
              role: "user",
              content: prompt
            }
          ]
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        return jsonResponse(
          {
            error: "AI provider request failed.",
            details: errorText
          },
          500
        );
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content;

      if (!content) {
        return jsonResponse({ error: "AI provider returned no content." }, 500);
      }

      const parsed = safeJsonParse(content);

      if (!parsed) {
        return jsonResponse(
          {
            error: "AI response was not valid JSON.",
            raw: content
          },
          500
        );
      }

      return jsonResponse(parsed, 200);
    } catch (error) {
      return jsonResponse(
        {
          error: "Worker failed.",
          details: error.message
        },
        500
      );
    }
  }
};

function buildBusinessIntelligencePrompt(websiteUrl) {
  return `
You are acting as a Business Intelligence Analyst for Global Concepts Media.

Your objective is NOT to perform a full business audit.

Your objective is to determine whether enough publicly observable information exists to confidently begin personalized first outreach.

Research only information that can be reasonably observed from the provided business website.

Never invent information.
Never speculate.
If something cannot be verified, clearly state "Unknown".

Analyze this business:

Website: ${websiteUrl}

Return ONLY valid JSON using this exact structure:

{
  "businessName": "",
  "website": "",
  "businessSummary": "",
  "productsServices": [],
  "targetCustomer": "",
  "geographicMarket": "",
  "trustSignals": [],
  "websiteObservations": {
    "professionalAppearance": "",
    "messagingClarity": "",
    "callsToAction": "",
    "navigation": "",
    "mobileExperience": "",
    "contentQuality": "",
    "seoObservations": "",
    "conversionOpportunities": ""
  },
  "growthOpportunities": [],
  "missingInformation": [],
  "qualificationScore": "",
  "outreachReadiness": "",
  "personalizedOutreachInsights": [],
  "firstContactEmail": "",
  "discoveryCallScript": "",
  "humanVerificationChecklist": [],
  "businessRecord": ""
}

Scoring rules:
- 80–100 = Strong outreach candidate
- 60–79 = Worth first contact with verification
- 40–59 = Needs more research before outreach
- 0–39 = Not enough public information

Outreach readiness must be one of:
- Ready for personalized first contact
- Ready after human verification
- More research required
- Not enough information

First Contact Email rules:
- Keep it professional and conversational.
- Do not overclaim.
- Reference only observable facts.
- Do not say a full audit was completed.
- Position the outreach as a practical growth conversation.

Discovery Call Script rules:
- Create a short opening call script.
- Include a reason for calling.
- Include 3 discovery questions.
- Include a soft next step.

Human Verification Checklist rules:
- List items a human should confirm before sending outreach.
- Include business name, location, services, owner/contact if visible, and any important claims.

Business Record rules:
- Format as clean Markdown.
- Include website, observable summary, qualification score, readiness, top opportunities, missing info, email, and call script.
`;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    const cleaned = value
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders()
    }
  });
}

function handleCors() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
