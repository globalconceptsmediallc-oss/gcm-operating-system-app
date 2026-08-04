/* =========================================================
   Global Concepts Media Operating System
   File: routes/prospectIntelligence.js
   Version: 1.0.0
   Status: Production Road-Test Candidate
   Source: New production route
   Sprint: Agency Intelligence — Prospect Advertisement Intake
   Purpose: Combine prospect advertisement evidence, public website
            evidence, and consultant reasoning into one read-only
            pre-call intelligence brief.

   PRODUCTION RULES
   - Read-only route.
   - Creates no D1 records.
   - Uses advertisement images as evidence, not decoration.
   - Uses only visible advertisement evidence and fetched website evidence.
   - Marks competitor, budget, performance, and ownership claims as estimates
     or verification requirements when they are not directly established.
   ========================================================= */

import {
  VERSION,
  ACTIONS,
  COMMUNICATION_VISION_MODEL,
  COMMUNICATION_REASONING_MODEL
} from "../shared/config.js";

import {
  clean,
  safeErrorMessage,
  logWorkerError,
  jsonResponse
} from "../shared/http.js";

import { runAiJsonWithRetry } from "../shared/ai.js";

export const PROSPECT_INTELLIGENCE_VERSION = "1.0.0";

const MAX_WEBSITE_TEXT = 18000;
const MAX_IMAGES = 2;

export async function handleProspectIntelligence(body, env, requestId) {
  const websiteUrl = normalizeUrl(body?.websiteUrl || body?.website || body?.url);
  const businessName = clean(body?.businessName);
  const prospectContext = normalizeProspectContext(body);
  const advertisementImages = normalizeImages(
    body?.advertisementImages || body?.images || []
  );

  if (!websiteUrl) {
    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.ANALYZE_PROSPECT_INTELLIGENCE,
      version: VERSION,
      prospectIntelligenceVersion: PROSPECT_INTELLIGENCE_VERSION,
      error: "A valid business website is required."
    }, 400);
  }

  try {
    const websiteEvidence = await collectWebsiteEvidence(websiteUrl);
    const advertisementEvidence = await analyzeAdvertisementEvidence({
      images: advertisementImages,
      businessName,
      websiteUrl,
      prospectContext,
      env,
      requestId
    });

    const deterministicFallback = buildFallbackBrief({
      websiteUrl,
      businessName,
      prospectContext,
      websiteEvidence,
      advertisementEvidence
    });

    if (!env?.AI || typeof env.AI.run !== "function") {
      return jsonResponse({
        ok: true,
        requestId,
        action: ACTIONS.ANALYZE_PROSPECT_INTELLIGENCE,
        version: VERSION,
        prospectIntelligenceVersion: PROSPECT_INTELLIGENCE_VERSION,
        engine: "deterministic-fallback",
        warning: "Workers AI binding was unavailable.",
        ...deterministicFallback
      });
    }

    const aiResult = await runAiJsonWithRetry({
      env,
      model: COMMUNICATION_REASONING_MODEL,
      input: {
        messages: [
          {
            role: "system",
            content: [
              "You are the senior business-development strategist for Global Concepts Media.",
              "Prepare one practical prospect intelligence brief for a one-person agency owner with limited time.",
              "Use the advertisement evidence as part of the reasoning, not as decoration.",
              "Compare the advertisement promise with the website customer journey.",
              "Identify credible marketing, website, SEO, tracking, creative, and sales-conversation opportunities.",
              "Never invent ad spend, revenue, ownership, campaign performance, competitor facts, rankings, review counts, or technology.",
              "Clearly label estimates and verification needs.",
              "Recommend one first contact and one next action.",
              "Return one valid JSON object only."
            ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Create the GCM prospect intelligence and pre-call brief.",
              prospectContext,
              businessName,
              websiteUrl,
              advertisementEvidence,
              websiteEvidence,
              requiredOutput: {
                businessName: "string",
                industry: "string",
                geographicMarket: "string",
                businessSummary: "string",
                productsAndServices: ["string"],
                targetCustomer: "string",
                trustSignals: ["string"],
                websiteObservations: ["string"],
                growthOpportunities: ["string"],
                missingInformation: ["string"],
                personalizedOutreachInsights: ["string"],
                qualificationScore: "integer 1 to 10",
                outreachReadiness: "Ready | Needs Verification | Not Ready",
                firstContactEmail: {
                  subject: "string",
                  body: "string"
                },
                discoveryCallScript: {
                  opening: "string",
                  questions: ["string"],
                  positioningStatement: "string",
                  nextStep: "string"
                },
                humanVerificationChecklist: ["string"],
                prospectIntelligence: {
                  advertisementAssessment: "string",
                  messageMatch: "string",
                  marketingMaturity: "Low | Developing | Established | Advanced | Unknown",
                  likelyOpportunityAreas: ["string"],
                  estimatedFirstProject: "string or Unknown",
                  estimatedFirstInvoice: "string or Unknown",
                  estimatedAnnualClientValue: "string or Unknown",
                  closingProbability: "Low | Medium | High | Unknown",
                  recommendedFirstContact: "string",
                  recommendedNextAction: "string",
                  campaignConcepts: [
                    {
                      name: "string",
                      audience: "string",
                      message: "string",
                      visualDirection: "string",
                      offer: "string",
                      channel: "string"
                    }
                  ]
                }
              }
            })
          }
        ],
        max_tokens: 3200,
        temperature: 0.2
      },
      stageName: "prospect_intelligence_reasoning",
      requestId,
      route: ACTIONS.ANALYZE_PROSPECT_INTELLIGENCE,
      timeoutMs: 45000,
      maxRetries: 1
    });

    const brief = aiResult.ok
      ? normalizeBrief(aiResult.data, deterministicFallback)
      : deterministicFallback;

    return jsonResponse({
      ok: true,
      requestId,
      action: ACTIONS.ANALYZE_PROSPECT_INTELLIGENCE,
      version: VERSION,
      prospectIntelligenceVersion: PROSPECT_INTELLIGENCE_VERSION,
      engine: aiResult.ok
        ? COMMUNICATION_REASONING_MODEL
        : "deterministic-fallback",
      warning: aiResult.ok ? null : aiResult?.error?.message || "Reasoning fallback used.",
      advertisementEvidence,
      websiteEvidence,
      ...brief,
      fullBusinessRecord: {
        websiteUrl,
        prospectContext,
        advertisementEvidence,
        websiteEvidence,
        evidenceClassification: {
          mode: advertisementImages.length ? "advertisement-plus-website" : "website-only",
          advertisementImageCount: advertisementImages.length
        },
        evidencePackages: [
          {
            sourceType: "Advertisement Intelligence",
            rawEvidence: advertisementEvidence
          },
          {
            sourceType: "Website Intelligence",
            rawEvidence: websiteEvidence
          }
        ]
      }
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route: ACTIONS.ANALYZE_PROSPECT_INTELLIGENCE,
      stage: "prospect_intelligence",
      error
    });

    return jsonResponse({
      ok: false,
      requestId,
      action: ACTIONS.ANALYZE_PROSPECT_INTELLIGENCE,
      version: VERSION,
      prospectIntelligenceVersion: PROSPECT_INTELLIGENCE_VERSION,
      error: safeErrorMessage(error)
    }, 500);
  }
}

async function analyzeAdvertisementEvidence({
  images,
  businessName,
  websiteUrl,
  prospectContext,
  env,
  requestId
}) {
  if (!images.length) {
    return {
      status: "not_provided",
      imageCount: 0,
      visibleBusinessName: businessName || "Unknown",
      visibleWebsite: websiteUrl,
      format: "Unknown",
      headline: "Unknown",
      offer: "Unknown",
      callsToAction: [],
      visibleServices: [],
      audienceSignals: [],
      geographicSignals: [],
      contactSignals: [],
      visualSignals: [],
      campaignSignals: [],
      uncertainties: ["No advertisement image was supplied."],
      confidence: "Low"
    };
  }

  if (!env?.AI || typeof env.AI.run !== "function") {
    return {
      status: "image_received_ai_unavailable",
      imageCount: images.length,
      visibleBusinessName: businessName || "Unknown",
      visibleWebsite: websiteUrl,
      format: clean(prospectContext.source) || "Advertisement",
      headline: "Unknown",
      offer: "Unknown",
      callsToAction: [],
      visibleServices: [],
      audienceSignals: [],
      geographicSignals: [],
      contactSignals: [],
      visualSignals: [],
      campaignSignals: [],
      uncertainties: ["Advertisement image was received but Workers AI was unavailable."],
      confidence: "Low"
    };
  }

  const extracted = [];

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];

    const result = await runAiJsonWithRetry({
      env,
      model: COMMUNICATION_VISION_MODEL,
      input: {
        messages: [
          {
            role: "system",
            content: [
              "You extract visible advertising evidence for GCM OS.",
              "Read only what is clearly visible.",
              "Do not judge campaign performance or invent business facts.",
              "Return one valid JSON object only."
            ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Extract the visible facts and creative signals from this prospect advertisement.",
              imageNumber: index + 1,
              knownBusinessName: businessName || "Unknown",
              knownWebsite: websiteUrl,
              knownSource: prospectContext.source || "Unknown",
              requiredOutput: {
                format: "postcard | magazine_ad | flyer | billboard | vehicle_graphic | social_ad | print_ad | unknown",
                visibleBusinessName: "string or Unknown",
                visibleWebsite: "string or Unknown",
                headline: "string or Unknown",
                supportingMessage: "string or Unknown",
                offer: "string or Unknown",
                callsToAction: ["string"],
                visibleServices: ["string"],
                audienceSignals: ["string"],
                geographicSignals: ["string"],
                contactSignals: ["string"],
                visualSignals: ["string"],
                campaignSignals: ["string"],
                uncertainties: ["string"],
                confidence: "High | Medium | Low"
              }
            })
          }
        ],
        image,
        max_tokens: 1600,
        temperature: 0
      },
      stageName: `prospect_advertisement_image_${index + 1}`,
      requestId,
      route: ACTIONS.ANALYZE_PROSPECT_INTELLIGENCE,
      timeoutMs: 30000,
      maxRetries: 0
    });

    if (result.ok && result.data && typeof result.data === "object") {
      extracted.push(result.data);
    }
  }

  return mergeAdvertisementEvidence(extracted, {
    imageCount: images.length,
    businessName,
    websiteUrl,
    source: prospectContext.source
  });
}

async function collectWebsiteEvidence(websiteUrl) {
  try {
    const response = await fetch(websiteUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": `Mozilla/5.0 GCM-OS/${PROSPECT_INTELLIGENCE_VERSION}`
      }
    });

    if (!response.ok) {
      return {
        status: "limited",
        websiteUrl,
        httpStatus: response.status,
        title: "Unknown",
        metaDescription: "Unknown",
        visibleText: "",
        headings: [],
        callsToAction: [],
        links: [],
        uncertainty: `Website returned HTTP ${response.status}.`
      };
    }

    const html = await response.text();
    const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescription =
      firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
      firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);

    const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
      .map(match => stripHtml(match[1]))
      .filter(Boolean)
      .slice(0, 30);

    const callsToAction = [...html.matchAll(/<(?:a|button)[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)]
      .map(match => stripHtml(match[1]))
      .filter(text => /quote|call|contact|schedule|book|learn|start|get|claim|save|request/i.test(text))
      .slice(0, 30);

    const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
      .map(match => clean(match[1]))
      .filter(Boolean)
      .slice(0, 50);

    const visibleText = stripHtml(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
    ).slice(0, MAX_WEBSITE_TEXT);

    return {
      status: visibleText.length >= 200 ? "complete" : "limited",
      websiteUrl: response.url || websiteUrl,
      httpStatus: response.status,
      title: clean(title) || "Unknown",
      metaDescription: clean(metaDescription) || "Unknown",
      visibleText,
      headings: unique(headings),
      callsToAction: unique(callsToAction),
      links: unique(links),
      uncertainty: visibleText.length >= 200
        ? "None"
        : "Website returned limited readable text."
    };
  } catch (error) {
    return {
      status: "failed",
      websiteUrl,
      httpStatus: null,
      title: "Unknown",
      metaDescription: "Unknown",
      visibleText: "",
      headings: [],
      callsToAction: [],
      links: [],
      uncertainty: safeErrorMessage(error)
    };
  }
}

function normalizeProspectContext(body) {
  const nested =
    body?.prospectContext && typeof body.prospectContext === "object"
      ? body.prospectContext
      : {};

  return {
    source: clean(nested.source || body?.prospectSource),
    contactName: clean(nested.contactName || body?.contactName),
    location: clean(nested.location || body?.location),
    notes: clean(nested.notes || body?.researchNotes),
    evidenceDescription: clean(
      nested.evidenceDescription || body?.evidenceDescription
    )
  };
}

function normalizeImages(value) {
  const images = Array.isArray(value) ? value : value ? [value] : [];

  return images
    .map(item => {
      if (typeof item === "string") return clean(item);
      if (item && typeof item === "object") {
        return clean(item.dataUrl || item.imageDataUrl || item.image);
      }
      return "";
    })
    .filter(item => /^data:image\/(?:png|jpe?g|webp);base64,/i.test(item))
    .slice(0, MAX_IMAGES);
}

function normalizeUrl(value) {
  const raw = clean(value);
  if (!raw) return "";

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!url.hostname.includes(".")) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function mergeAdvertisementEvidence(items, fallback) {
  const records = Array.isArray(items) ? items : [];
  const first = records[0] || {};

  return {
    status: records.length ? "complete" : "limited",
    imageCount: fallback.imageCount,
    format: firstKnown(records.map(item => item.format)) || clean(fallback.source) || "Unknown",
    visibleBusinessName:
      firstKnown(records.map(item => item.visibleBusinessName)) ||
      fallback.businessName ||
      "Unknown",
    visibleWebsite:
      firstKnown(records.map(item => item.visibleWebsite)) ||
      fallback.websiteUrl ||
      "Unknown",
    headline: firstKnown(records.map(item => item.headline)) || "Unknown",
    supportingMessage:
      firstKnown(records.map(item => item.supportingMessage)) || "Unknown",
    offer: firstKnown(records.map(item => item.offer)) || "Unknown",
    callsToAction: mergeArrays(records, "callsToAction"),
    visibleServices: mergeArrays(records, "visibleServices"),
    audienceSignals: mergeArrays(records, "audienceSignals"),
    geographicSignals: mergeArrays(records, "geographicSignals"),
    contactSignals: mergeArrays(records, "contactSignals"),
    visualSignals: mergeArrays(records, "visualSignals"),
    campaignSignals: mergeArrays(records, "campaignSignals"),
    uncertainties: mergeArrays(records, "uncertainties"),
    confidence: strongestConfidence(records.map(item => item.confidence))
  };
}

function buildFallbackBrief({
  websiteUrl,
  businessName,
  prospectContext,
  websiteEvidence,
  advertisementEvidence
}) {
  const name =
    businessName ||
    advertisementEvidence.visibleBusinessName ||
    websiteEvidence.title ||
    new URL(websiteUrl).hostname;

  const offer = advertisementEvidence.offer !== "Unknown"
    ? advertisementEvidence.offer
    : "No verified advertisement offer was extracted.";

  return {
    businessName: name,
    industry: "Requires consultant verification",
    geographicMarket:
      prospectContext.location ||
      advertisementEvidence.geographicSignals?.[0] ||
      "Requires consultant verification",
    businessSummary:
      `${name} is a prospect identified through ${prospectContext.source || "observable marketing evidence"}. ` +
      `The advertisement and public website should be reviewed together before outreach.`,
    productsAndServices:
      advertisementEvidence.visibleServices?.length
        ? advertisementEvidence.visibleServices
        : websiteEvidence.headings?.slice(0, 8) || [],
    targetCustomer:
      advertisementEvidence.audienceSignals?.join("; ") ||
      "Target customer requires verification.",
    trustSignals: [],
    websiteObservations: [
      `Website status: ${websiteEvidence.status}.`,
      `Advertisement offer: ${offer}`,
      "Verify whether the advertisement promise continues clearly on the landing page.",
      "Verify campaign-specific call, form, QR-code, and analytics tracking."
    ],
    growthOpportunities: [
      "Compare the advertisement promise with the landing-page experience.",
      "Verify direct-response tracking before recommending additional media.",
      "Research local competitors before the first sales conversation."
    ],
    missingInformation: [
      "Campaign performance and attribution",
      "Current marketing budget",
      "Decision maker and sales process",
      "Competitive rankings and review position"
    ],
    personalizedOutreachInsights: [
      "Lead with the advertisement you actually received.",
      "Compliment the visible investment before raising opportunities.",
      "Offer a small number of specific observations rather than a generic agency pitch."
    ],
    qualificationScore: advertisementEvidence.status === "complete" ? 7 : 5,
    outreachReadiness: "Needs Verification",
    firstContactEmail: {
      subject: `A few observations about your ${clean(advertisementEvidence.format) || "advertising"} campaign`,
      body:
        `I received your recent advertisement and it caught my attention. ` +
        `I reviewed the customer journey from the advertisement to ${websiteUrl} and noted a few opportunities that may help you get more value from the marketing you are already running. ` +
        `Would you be open to a short conversation so I can share the observations?`
    },
    discoveryCallScript: {
      opening:
        `I received your advertisement and liked that it gives homeowners a clear reason to respond. ` +
        `I reviewed the path from the advertisement to your website and found a few items worth discussing.`,
      questions: [
        "How are responses from this campaign currently tracked?",
        "Which service and geographic area are most important to grow?",
        "What happens after a prospect scans the QR code, visits the site, or calls?",
        "Which competitors do you most often encounter?"
      ],
      positioningStatement:
        "GCM helps established local advertisers connect media, websites, measurement, and follow-up so existing marketing creates more measurable value.",
      nextStep:
        "Verify the landing-page experience and campaign tracking, then prepare three evidence-based recommendations."
    },
    humanVerificationChecklist: [
      "Open and test the advertisement URL and QR code.",
      "Confirm the advertised offer and restrictions.",
      "Check calls, forms, and analytics tracking.",
      "Review Google Business Profile, reviews, paid ads, organic visibility, and key competitors."
    ],
    prospectIntelligence: {
      advertisementAssessment:
        `The advertisement is usable prospect evidence. Extracted offer: ${offer}`,
      messageMatch:
        "Requires comparison between the advertisement promise and the landing page.",
      marketingMaturity:
        advertisementEvidence.status === "complete" ? "Established" : "Unknown",
      likelyOpportunityAreas: [
        "Campaign-to-landing-page alignment",
        "Lead attribution and conversion tracking",
        "Local competitive visibility",
        "Creative testing and offer development"
      ],
      estimatedFirstProject: "Campaign and landing-page opportunity review",
      estimatedFirstInvoice: "Unknown",
      estimatedAnnualClientValue: "Unknown",
      closingProbability: "Medium",
      recommendedFirstContact:
        "Reference the advertisement, offer useful observations, and ask permission to share them.",
      recommendedNextAction:
        "Complete the advertisement-to-website comparison and local competitor review.",
      campaignConcepts: []
    }
  };
}

function normalizeBrief(value, fallback) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...fallback,
    ...source,
    productsAndServices: arrayOrFallback(source.productsAndServices, fallback.productsAndServices),
    trustSignals: arrayOrFallback(source.trustSignals, fallback.trustSignals),
    websiteObservations: arrayOrFallback(source.websiteObservations, fallback.websiteObservations),
    growthOpportunities: arrayOrFallback(source.growthOpportunities, fallback.growthOpportunities),
    missingInformation: arrayOrFallback(source.missingInformation, fallback.missingInformation),
    personalizedOutreachInsights: arrayOrFallback(
      source.personalizedOutreachInsights,
      fallback.personalizedOutreachInsights
    ),
    humanVerificationChecklist: arrayOrFallback(
      source.humanVerificationChecklist,
      fallback.humanVerificationChecklist
    ),
    firstContactEmail: {
      ...fallback.firstContactEmail,
      ...(source.firstContactEmail || {})
    },
    discoveryCallScript: {
      ...fallback.discoveryCallScript,
      ...(source.discoveryCallScript || {}),
      questions: arrayOrFallback(
        source?.discoveryCallScript?.questions,
        fallback.discoveryCallScript.questions
      )
    },
    prospectIntelligence: {
      ...fallback.prospectIntelligence,
      ...(source.prospectIntelligence || {}),
      likelyOpportunityAreas: arrayOrFallback(
        source?.prospectIntelligence?.likelyOpportunityAreas,
        fallback.prospectIntelligence.likelyOpportunityAreas
      ),
      campaignConcepts: Array.isArray(source?.prospectIntelligence?.campaignConcepts)
        ? source.prospectIntelligence.campaignConcepts.slice(0, 5)
        : fallback.prospectIntelligence.campaignConcepts
    }
  };
}

function arrayOrFallback(value, fallback) {
  return Array.isArray(value) && value.length
    ? value.map(clean).filter(Boolean)
    : fallback;
}

function stripHtml(value) {
  return clean(
    String(value || "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/<[^>]+>/g, " ")
  );
}

function firstMatch(value, regex) {
  const match = String(value || "").match(regex);
  return match ? stripHtml(match[1]) : "";
}

function mergeArrays(records, key) {
  return unique(
    records.flatMap(item => Array.isArray(item?.[key]) ? item[key] : [])
  );
}

function firstKnown(values) {
  return values
    .map(clean)
    .find(value => value && value.toLowerCase() !== "unknown") || "";
}

function strongestConfidence(values) {
  const rank = { Low: 1, Medium: 2, High: 3 };
  return values
    .map(value => {
      const normalized = clean(value).toLowerCase();
      if (normalized === "high") return "High";
      if (normalized === "medium") return "Medium";
      return "Low";
    })
    .sort((a, b) => rank[b] - rank[a])[0] || "Low";
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}
