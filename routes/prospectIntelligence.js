/* =========================================================
   Global Concepts Media Operating System
   File: routes/prospectIntelligence.js
   Version: 1.5.0
   Status: Production Road-Test Candidate
   Source: routes/prospectIntelligence.js 1.4.2
   Sprint: Prospect Intelligence Evidence Reliability
   Purpose: Preserve the Business Intelligence Record foundation and
            add consultant-grade reasoning that connects evidence to
            business meaning, action, expected result, and proof.

   Changes — 1.5.0:
   - Makes prospect origin authoritative: relationship/referral, research, and advertisement leads no longer share one advertisement-first script.
   - Existing Relationship without ad evidence cannot generate "I received your advertisement" language.
   - Relationship context now survives into outreach, discovery opening, evidence classification, and durable fullBusinessRecord metadata.
   - Final products/services are constrained to the normalized Business Intelligence Record instead of accepting unrelated AI/navigation labels.
   - Adds explicit prompt guardrails against footer/navigation/cross-site category contamination.

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

import {
  buildBusinessIntelligenceRecord,
  applyBusinessIntelligenceRecordToBrief
} from "../shared/engines/businessIntelligenceRecord.js";

import {
  CONSULTANT_INTELLIGENCE_VERSION,
  buildConsultantIntelligence,
  applyConsultantIntelligenceToBrief
} from "../shared/engines/consultantIntelligence.js";

export const PROSPECT_INTELLIGENCE_VERSION = "1.5.0";

const MAX_WEBSITE_TEXT = 18000;
const MAX_IMAGES = 2;

export async function handleProspectIntelligence(body, env, requestId) {
  const websiteUrl = normalizeUrl(body?.websiteUrl || body?.website || body?.url);
  const businessName = clean(body?.businessName);
  const prospectContext = normalizeProspectContext(body);
  const advertisementImages = normalizeImages(
    body?.advertisementImages || body?.images || []
  );
  const prospectSourceMode = classifyProspectSource(
    prospectContext,
    advertisementImages.length
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

    const businessProfile = await identifyBusinessProfile({
      websiteUrl,
      suppliedBusinessName: businessName,
      websiteEvidence,
      prospectContext,
      env,
      requestId
    });

    const enrichedWebsiteEvidence = {
      ...websiteEvidence,
      identifiedBusinessName: clean(businessProfile.businessName),
      identifiedIndustry: clean(businessProfile.industry),
      identifiedMarket: clean(businessProfile.geographicMarket),
      businessModel: clean(businessProfile.businessModel),
      revenueStreams: Array.isArray(businessProfile.revenueStreams)
        ? businessProfile.revenueStreams
        : [],
      primaryBrandAssets: Array.isArray(businessProfile.primaryBrandAssets)
        ? businessProfile.primaryBrandAssets
        : [],
      identificationConfidence: clean(businessProfile.confidence)
    };

    const advertisementEvidence = await analyzeAdvertisementEvidence({
      images: advertisementImages,
      businessName,
      websiteUrl,
      prospectContext,
      env,
      requestId
    });

    const businessIntelligenceRecord =
      buildBusinessIntelligenceRecord({
        websiteUrl,
        suppliedBusinessName: businessName,
        prospectContext,
        websiteEvidence: enrichedWebsiteEvidence,
        advertisementEvidence
      });

    const consultantIntelligence =
      await buildConsultantIntelligence({
        websiteUrl,
        businessProfile,
        businessIntelligenceRecord,
        websiteEvidence: enrichedWebsiteEvidence,
        advertisementEvidence,
        prospectContext,
        env,
        requestId
      });

    const deterministicFallback =
      applyConsultantIntelligenceToBrief(
        applyBusinessIntelligenceRecordToBrief(
          buildFallbackBrief({
            websiteUrl,
            businessName,
            prospectContext,
            websiteEvidence: enrichedWebsiteEvidence,
            advertisementEvidence,
            prospectSourceMode
          }),
          businessIntelligenceRecord
        ),
        consultantIntelligence
      );

    if (!env?.AI || typeof env.AI.run !== "function") {
      return jsonResponse({
        ok: true,
        requestId,
        action: ACTIONS.ANALYZE_PROSPECT_INTELLIGENCE,
        version: VERSION,
        prospectIntelligenceVersion: PROSPECT_INTELLIGENCE_VERSION,
        engine: "deterministic-fallback",
        warning: "Workers AI binding was unavailable.",
        consultantIntelligenceVersion: CONSULTANT_INTELLIGENCE_VERSION,
        consultantIntelligence,
        businessIntelligenceRecord,
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
              "Think like an experienced agency consultant preparing for a real owner conversation, not like a generic website auditor.",
              "Before making recommendations, establish what the business is, how it likely makes money, who it serves, and which visible brand or operating assets matter most.",
              "Do not confuse navigation labels such as Home with the business name.",
              "Do not use Requires consultant verification when the public evidence clearly establishes the business category or market.",
              "Treat prospect origin as controlling evidence. Relationship/referral, research, and advertisement leads require different outreach language.",
              "When prospectSourceMode is relationship and no advertisement image was supplied, never claim GCM received an advertisement, mailer, campaign, QR code, or promotional offer.",
              "When prospectSourceMode is advertisement, use the advertisement evidence as part of the reasoning, not as decoration.",
              "Compare an advertisement promise with the website customer journey only when advertisement evidence actually exists.",
              "Do not treat footer links, navigation labels, directory categories, franchise cross-links, or unrelated page labels as products or services.",
              "Products and services must remain consistent with the identified business model and normalized Business Intelligence Record.",
              "Use the supplied Consultant Intelligence as the reasoning authority for the executive brief, strongest asset, largest opportunity, and first action.",
              "The strongest asset, largest opportunity, and first action must be distinct and specific to this business model.",
              "The largest opportunity must diagnose the weakness, risk, friction, or lost-value condition.",
              "The first recommendation must begin with an action verb and prescribe the first concrete review, test, change, or measurement.",
              "Never repeat or lightly paraphrase the largest opportunity as the first recommendation.",
              "Never use the phrases visible business activity, focused customer-journey review, or additional marketing investment.",
              "For the most important opportunity, explicitly connect evidence, business meaning, recommended first engagement, expected business result, and proof to verify.",
              "Prioritize improving the return from existing marketing before recommending more spending when the evidence supports that conclusion.",
              "Never invent ad spend, revenue, ownership, campaign performance, competitor facts, rankings, review counts, technology, or guaranteed outcomes.",
              "Clearly label estimates and verification needs.",
              "Recommend one first contact and one highest-value next action.",
              "Use direct, specific consultant language that could win the attention of a business owner.",
              "Return one valid JSON object only."
            ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Create the GCM prospect intelligence and pre-call brief.",
              prospectContext,
              prospectSourceMode,
              businessName,
              websiteUrl,
              advertisementEvidence,
              websiteEvidence: enrichedWebsiteEvidence,
              businessProfile,
              businessIntelligenceRecord,
              consultantIntelligence,
              requiredOutput: {
                businessName: "string",
                industry: "string",
                geographicMarket: "string",
                businessSummary: "specific executive brief based on Consultant Intelligence",
                strongestArea: "specific strongest visible business asset and why it matters",
                largestOpportunity: "diagnosis only: specific highest-value weakness, risk, friction, or lost-value condition and why it matters",
                highestPriorityRecommendation: "action only: begin with a verb and prescribe the first concrete review, test, change, or measurement; must not restate the opportunity",
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
                consultantReasoning: {
                  evidence: ["string"],
                  businessMeaning: "string",
                  recommendedFirstEngagement: {
                    name: "string",
                    scope: ["string"],
                    whyFirst: "string"
                  },
                  expectedBusinessResult: "string",
                  proofWeWillLookFor: ["string"],
                  priority: "High | Medium | Low",
                  impact: "Very High | High | Medium | Low",
                  effort: "Low | Medium | High",
                  ownerConversation: "string"
                },
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

    const generatedBrief = applyConsultantIntelligenceToBrief(
      applyConsultantReasoningToBrief(
        applyBusinessIntelligenceRecordToBrief(
          aiResult.ok
            ? normalizeBrief(aiResult.data, deterministicFallback)
            : deterministicFallback,
          businessIntelligenceRecord
        )
      ),
      consultantIntelligence
    );

    const brief = enforceProspectSourceSemantics({
      brief: generatedBrief,
      prospectSourceMode,
      prospectContext,
      businessName,
      websiteUrl,
      advertisementEvidence,
      businessIntelligenceRecord
    });

    return jsonResponse({
      ok: true,
      requestId,
      action: ACTIONS.ANALYZE_PROSPECT_INTELLIGENCE,
      version: VERSION,
      prospectIntelligenceVersion: PROSPECT_INTELLIGENCE_VERSION,
      consultantIntelligenceVersion: CONSULTANT_INTELLIGENCE_VERSION,
      engine: aiResult.ok
        ? COMMUNICATION_REASONING_MODEL
        : "deterministic-fallback",
      warning: aiResult.ok ? null : aiResult?.error?.message || "Reasoning fallback used.",
      advertisementEvidence,
      websiteEvidence: enrichedWebsiteEvidence,
      businessProfile,
      consultantIntelligence,
      businessIntelligenceRecord,
      ...brief,
      fullBusinessRecord: {
        businessIntelligenceRecord,
        consultantIntelligence,
        websiteUrl,
        prospectContext,
        advertisementEvidence,
        websiteEvidence,
        evidenceClassification: {
          mode: evidenceModeFor(prospectSourceMode, advertisementImages.length),
          prospectSourceMode,
          advertisementImageCount: advertisementImages.length
        },
        evidencePackages: [
          {
            sourceType: "Business Intelligence Record",
            rawEvidence: businessIntelligenceRecord
          },
          {
            sourceType: "Consultant Intelligence",
            rawEvidence: consultantIntelligence
          },
          {
            sourceType: "Advertisement Intelligence",
            rawEvidence: advertisementEvidence
          },
          {
            sourceType: "Website Intelligence",
            rawEvidence: enrichedWebsiteEvidence
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
    const prompt = buildAdvertisementVisionPrompt({
      imageNumber: index + 1,
      businessName,
      websiteUrl,
      source: prospectContext.source
    });

    const result = await runAiJsonWithRetry({
      env,
      model: COMMUNICATION_VISION_MODEL,
      input: {
        image: dataUrlToByteArray(image),
        prompt,
        max_tokens: 1600
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

function buildAdvertisementVisionPrompt({
  imageNumber,
  businessName,
  websiteUrl,
  source
}) {
  return [
    "You extract visible advertising evidence for GCM OS.",
    "Read only what is clearly visible in the supplied advertisement image.",
    "Do not judge campaign performance or invent business facts.",
    "Return one valid JSON object only. No markdown and no commentary.",
    `Image number: ${imageNumber}.`,
    `Known business name: ${businessName || "Unknown"}.`,
    `Known website: ${websiteUrl || "Unknown"}.`,
    `Known source: ${source || "Unknown"}.`,
    "Return exactly this JSON shape:",
    JSON.stringify({
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
    }, null, 2)
  ].join("\n");
}

async function identifyBusinessProfile({
  websiteUrl,
  suppliedBusinessName,
  websiteEvidence,
  prospectContext,
  env,
  requestId
}) {
  const deterministic = {
    businessName:
      suppliedBusinessName ||
      clean(websiteEvidence.openGraphSiteName) ||
      clean(websiteEvidence.structuredBusinessName) ||
      clean(websiteEvidence.title) ||
      new URL(websiteUrl).hostname,
    industry: "",
    geographicMarket: clean(prospectContext.location),
    businessModel: "",
    revenueStreams: [],
    primaryBrandAssets: [],
    confidence: "Low",
    evidence: []
  };

  if (!env?.AI || typeof env.AI.run !== "function") {
    return deterministic;
  }

  const result = await runAiJsonWithRetry({
    env,
    model: COMMUNICATION_REASONING_MODEL,
    input: {
      messages: [
        {
          role: "system",
          content: [
            "Identify the business before any marketing analysis.",
            "Use only the supplied public website evidence.",
            "Do not use navigation labels such as Home as the business name.",
            "Recognize major brands, franchises, dealerships, professional practices, retailers, and multi-location companies when clearly visible.",
            "Infer the business model and revenue streams only when supported by visible services or offers.",
            "Do not treat footer links, navigation menus, nearby-business categories, franchise-directory cross-links, or unrelated labels as services.",
            "Prioritize the supplied business name, title, meta description, repeated H1/H2 service language, and service phrases clearly tied to the business.",
            "Return one valid JSON object only."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            websiteUrl,
            suppliedBusinessName,
            title: websiteEvidence.title,
            openGraphSiteName: websiteEvidence.openGraphSiteName,
            structuredBusinessName: websiteEvidence.structuredBusinessName,
            metaDescription: websiteEvidence.metaDescription,
            headings: websiteEvidence.headings,
            callsToAction: websiteEvidence.callsToAction,
            visibleText: clean(websiteEvidence.visibleText).slice(0, 12000),
            requestedOutput: {
              businessName: "string",
              industry: "specific industry or business category",
              geographicMarket: "specific visible market or Requires consultant verification",
              businessModel: "one sentence",
              revenueStreams: ["string"],
              primaryBrandAssets: ["string"],
              targetCustomer: "string",
              confidence: "High | Medium | Low",
              evidence: ["short observable evidence statement"],
              uncertainties: ["string"]
            }
          })
        }
      ],
      max_tokens: 1400,
      temperature: 0
    },
    stageName: "prospect_business_identification",
    requestId,
    route: ACTIONS.ANALYZE_PROSPECT_INTELLIGENCE,
    timeoutMs: 25000,
    maxRetries: 1
  });

  if (!result.ok || !result.data || typeof result.data !== "object") {
    return deterministic;
  }

  return {
    ...deterministic,
    ...result.data,
    businessName:
      clean(result.data.businessName) ||
      deterministic.businessName,
    confidence:
      clean(result.data.confidence) ||
      deterministic.confidence
  };
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
    const contentHtml = removeNonVisibleHtml(html);

    const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescription =
      firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
      firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);

    const openGraphSiteName =
      firstMatch(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["']/i) ||
      firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:site_name["']/i);

    const structuredBusinessName =
      firstMatch(html, /"name"\s*:\s*"([^"]{2,120})"/i);

    const headings = [...contentHtml.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
      .map(match => stripHtml(match[1]))
      .filter(Boolean)
      .slice(0, 30);

    const callsToAction = [...contentHtml.matchAll(/<(?:a|button)[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)]
      .map(match => stripHtml(match[1]))
      .filter(isUsefulCallToAction)
      .slice(0, 30);

    const links = [...contentHtml.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
      .map(match => clean(match[1]))
      .filter(Boolean)
      .slice(0, 50);

    const visibleText = stripHtml(contentHtml).slice(0, MAX_WEBSITE_TEXT);

    return {
      status: visibleText.length >= 200 ? "complete" : "limited",
      websiteUrl: response.url || websiteUrl,
      httpStatus: response.status,
      title: clean(title) || "Unknown",
      metaDescription: clean(metaDescription) || "Unknown",
      openGraphSiteName: clean(openGraphSiteName),
      structuredBusinessName: clean(structuredBusinessName),
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

function removeNonVisibleHtml(value) {
  return String(value || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<template\b[\s\S]*?<\/template>/gi, " ");
}

function isUsefulCallToAction(value) {
  const text = clean(value);
  if (!text || text.length > 180) return false;
  if (/[{}]/.test(text)) return false;
  if (/\b(?:window\.|function\s*\(|object\.assign|lazyload|@media|box-sizing|font-family)\b/i.test(text)) {
    return false;
  }

  return /quote|call|contact|schedule|book|learn|start|get|claim|save|request/i.test(text);
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

function dataUrlToByteArray(dataUrl) {
  const value = clean(dataUrl);
  const match = value.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i);

  if (!match) {
    throw new Error("Advertisement image must be a valid base64 data URL.");
  }

  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return [...bytes];
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
  advertisementEvidence,
  prospectSourceMode
}) {
  const name =
    businessName ||
    advertisementEvidence.visibleBusinessName ||
    websiteEvidence.title ||
    new URL(websiteUrl).hostname;

  const hasAdvertisement = clean(advertisementEvidence.status) === "complete" ||
    Number(advertisementEvidence.imageCount) > 0;
  const offer = hasAdvertisement && advertisementEvidence.offer !== "Unknown"
    ? advertisementEvidence.offer
    : "No advertisement evidence was supplied.";
  const relationshipMode = prospectSourceMode === "relationship";
  const sourceLabel = clean(prospectContext.source) || "research";

  return {
    businessName: name,
    industry: "Requires consultant verification",
    geographicMarket:
      prospectContext.location ||
      advertisementEvidence.geographicSignals?.[0] ||
      "Requires consultant verification",
    businessSummary:
      relationshipMode
        ? `${name} is a prospect connected to GCM through ${sourceLabel}. The existing relationship context and public website should be reviewed together before the next outreach.`
        : hasAdvertisement
          ? `${name} is a prospect identified through ${sourceLabel}. The advertisement and public website should be reviewed together before outreach.`
          : `${name} is a prospect identified through ${sourceLabel}. The public website and supplied context should be reviewed together before outreach.`,
    productsAndServices: [],
    targetCustomer:
      hasAdvertisement && advertisementEvidence.audienceSignals?.length
        ? advertisementEvidence.audienceSignals.join("; ")
        : "Target customer requires verification.",
    trustSignals: [],
    websiteObservations: hasAdvertisement
      ? [
          `Website status: ${websiteEvidence.status}.`,
          `Advertisement offer: ${offer}`,
          "Verify whether the advertisement promise continues clearly on the landing page.",
          "Verify campaign-specific call, form, QR-code, and analytics tracking."
        ]
      : [
          `Website status: ${websiteEvidence.status}.`,
          `Prospect source: ${sourceLabel}.`,
          relationshipMode
            ? "Use the existing relationship context as the outreach starting point."
            : "Verify the primary customer journey and conversion path."
        ],
    growthOpportunities: hasAdvertisement
      ? [
          "Compare the advertisement promise with the landing-page experience.",
          "Verify direct-response tracking before recommending additional media.",
          "Research local competitors before the first sales conversation."
        ]
      : [
          "Verify the highest-value customer and service path before recommending additional marketing.",
          "Verify call, form, lead-source, and booked-work attribution.",
          "Research local competitors before the next sales conversation."
        ],
    missingInformation: [
      "Campaign performance and attribution",
      "Current marketing budget",
      "Decision maker and sales process",
      "Competitive rankings and review position"
    ],
    personalizedOutreachInsights: hasAdvertisement
      ? [
          "Lead with the advertisement you actually received.",
          "Compliment the visible investment before raising opportunities.",
          "Offer a small number of specific observations rather than a generic agency pitch."
        ]
      : relationshipMode
        ? [
            "Lead with the existing relationship and the reason the contact is already connected to GCM.",
            "Use the public-site review to add value, not to invent a cold-prospect story.",
            "Offer a small number of specific observations rather than a generic agency pitch."
          ]
        : [
            "Lead with the actual research source.",
            "Offer a small number of specific observations rather than a generic agency pitch."
          ],
    qualificationScore: hasAdvertisement ? 7 : 5,
    outreachReadiness: "Needs Verification",
    firstContactEmail: relationshipMode
      ? {
          subject: `A few observations after our recent contact`,
          body:
            `Thanks for the recent contact. I took a look at ${name} and noted a few opportunities that may be worth comparing with what you are seeing inside the business. Would you be open to a short conversation so I can share the observations?`
        }
      : hasAdvertisement
        ? {
            subject: `A few observations about your ${clean(advertisementEvidence.format) || "advertising"} campaign`,
            body:
              `I received your recent advertisement and it caught my attention. ` +
              `I reviewed the customer journey from the advertisement to ${websiteUrl} and noted a few opportunities that may help you get more value from the marketing you are already running. ` +
              `Would you be open to a short conversation so I can share the observations?`
          }
        : {
            subject: `A few observations about ${name}`,
            body:
              `I reviewed ${name}'s public website and noted a few opportunities that may be worth discussing. Would you be open to a short conversation so I can share the observations?`
          },
    discoveryCallScript: {
      opening: relationshipMode
        ? `After our recent contact, I took a closer look at ${name} and found a few items worth comparing with what you are seeing inside the business.`
        : hasAdvertisement
          ? `I received your advertisement and liked that it gives people a clear reason to respond. I reviewed the path from the advertisement to your website and found a few items worth discussing.`
          : `I reviewed ${name}'s public website and found a few items worth discussing.`,
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
    humanVerificationChecklist: hasAdvertisement
      ? [
          "Open and test the advertisement URL and QR code.",
          "Confirm the advertised offer and restrictions.",
          "Check calls, forms, and analytics tracking.",
          "Review Google Business Profile, reviews, paid ads, organic visibility, and key competitors."
        ]
      : [
          "Verify the source and relationship context.",
          "Check calls, forms, and analytics tracking.",
          "Verify service-area and service-page clarity.",
          "Review Google Business Profile, reviews, paid ads, organic visibility, and key competitors."
        ],
    consultantReasoning: {
      evidence: [
        advertisementEvidence.status === "complete"
          ? "The business is actively using paid advertising to attract customers."
          : "The public website is the primary observable marketing evidence currently available.",
        offer && !/not verified|not extracted/i.test(offer)
          ? `The visible offer is ${offer}.`
          : "The campaign offer requires verification.",
        websiteEvidence.callsToAction?.length
          ? `The website provides response paths including ${websiteEvidence.callsToAction.slice(0, 4).join(", ")}.`
          : "The primary response path requires verification."
      ],
      businessMeaning:
        advertisementEvidence.status === "complete"
          ? "The business is already investing in customer acquisition. Before recommending more advertising, the highest-value question is whether the existing campaign promise, landing-page experience, and lead tracking work together efficiently."
          : "The website shows enough visible business activity to justify a focused customer-journey review, but deeper evidence is required before recommending additional marketing investment.",
      recommendedFirstEngagement: {
        name:
          advertisementEvidence.status === "complete"
            ? "Campaign-to-Customer Journey Review"
            : "Website Growth Opportunity Review",
        scope: [
          "Verify the primary offer and response path.",
          "Compare the campaign or homepage promise with the landing-page message.",
          "Review calls to action and customer-response friction.",
          "Verify call, form, and analytics tracking.",
          "Identify the single highest-impact improvement."
        ],
        whyFirst:
          "This review improves the return from existing marketing before additional budget is recommended."
      },
      expectedBusinessResult:
        "A clearer and more measurable path from marketing response to qualified inquiry, with one prioritized improvement tied to business value.",
      proofWeWillLookFor: [
        "Message continuity",
        "Working calls, forms, links, and QR-code destination",
        "Verified analytics or lead-tracking coverage",
        "Reduced customer-journey friction",
        "A measurable inquiry or conversion baseline"
      ],
      priority: "High",
      impact:
        advertisementEvidence.status === "complete"
          ? "Very High"
          : "High",
      effort: "Medium",
      ownerConversation:
        `Before suggesting more marketing, I would first verify whether the path from your current advertising and website to a qualified inquiry is working as efficiently as it should.`
    },
    prospectIntelligence: {
      advertisementAssessment: hasAdvertisement
        ? `The advertisement is usable prospect evidence. Extracted offer: ${offer}`
        : `No advertisement evidence was supplied. Prospect source is ${sourceLabel}.`,
      messageMatch: hasAdvertisement
        ? "Requires comparison between the advertisement promise and the landing page."
        : "Not applicable without advertisement evidence.",
      marketingMaturity:
        hasAdvertisement ? "Established" : "Unknown",
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
      recommendedFirstContact: relationshipMode
        ? "Reference the existing relationship, offer useful observations, and ask permission to compare notes."
        : hasAdvertisement
          ? "Reference the advertisement, offer useful observations, and ask permission to share them."
          : "Reference the actual research source, offer useful observations, and ask permission to share them.",
      recommendedNextAction: hasAdvertisement
        ? "Complete the advertisement-to-website comparison and local competitor review."
        : "Complete the website, customer-path, attribution, and local competitor review.",
      campaignConcepts: []
    }
  };
}

export function classifyProspectSource(prospectContext, advertisementImageCount = 0) {
  const source = clean(prospectContext?.source).toLowerCase();

  if (
    Number(advertisementImageCount) > 0 ||
    /advertisement|direct mail|postcard|mailer|magazine|flyer|billboard|vehicle graphic|social ad|print ad/.test(source)
  ) {
    return "advertisement";
  }

  if (/relationship|referral|networking|inbound/.test(source)) {
    return "relationship";
  }

  if (/google search|google maps|research|target vertical/.test(source)) {
    return "research";
  }

  return "general";
}

function evidenceModeFor(prospectSourceMode, advertisementImageCount) {
  if (Number(advertisementImageCount) > 0 || prospectSourceMode === "advertisement") {
    return "advertisement-plus-website";
  }
  if (prospectSourceMode === "relationship") {
    return "relationship-plus-website";
  }
  if (prospectSourceMode === "research") {
    return "research-plus-website";
  }
  return "website-only";
}

export function enforceProspectSourceSemantics({
  brief,
  prospectSourceMode,
  prospectContext,
  businessName,
  websiteUrl,
  advertisementEvidence,
  businessIntelligenceRecord
}) {
  const source = brief && typeof brief === "object" ? { ...brief } : {};
  const verifiedServices = Array.isArray(businessIntelligenceRecord?.services?.primaryServices)
    ? businessIntelligenceRecord.services.primaryServices.filter(Boolean)
    : [];
  const verifiedName =
    clean(businessIntelligenceRecord?.identity?.businessName) ||
    clean(businessName) ||
    "the business";
  const sourceLabel = clean(prospectContext?.source) || "Unknown";
  const hasAdvertisement =
    clean(advertisementEvidence?.status) === "complete" ||
    Number(advertisementEvidence?.imageCount) > 0 ||
    prospectSourceMode === "advertisement";

  if (verifiedServices.length) {
    source.productsAndServices = [...verifiedServices];
  }

  if (!hasAdvertisement) {
    source.websiteObservations = (Array.isArray(source.websiteObservations) ? source.websiteObservations : [])
      .filter(item => !/advertisement offer|advertisement promise|campaign-specific|qr[- ]?code/i.test(clean(item)));

    source.growthOpportunities = (Array.isArray(source.growthOpportunities) ? source.growthOpportunities : [])
      .filter(item => !/advertisement promise|direct-response tracking|campaign-to-landing/i.test(clean(item)));

    source.humanVerificationChecklist = (Array.isArray(source.humanVerificationChecklist) ? source.humanVerificationChecklist : [])
      .filter(item => !/advertisement|advertised offer|qr code/i.test(clean(item)));

    source.prospectIntelligence = {
      ...(source.prospectIntelligence || {}),
      advertisementAssessment: `No advertisement evidence was supplied. Prospect source is ${sourceLabel}.`,
      messageMatch: "Not applicable without advertisement evidence."
    };
  }

  if (prospectSourceMode === "relationship" && !hasAdvertisement) {
    const contextText =
      clean(prospectContext?.evidenceDescription) ||
      clean(prospectContext?.notes) ||
      `Existing relationship with ${clean(prospectContext?.contactName) || "the contact"}.`;

    source.businessSummary =
      clean(source.businessSummary) ||
      `${verifiedName} is connected to GCM through an existing relationship. ${contextText}`;

    source.personalizedOutreachInsights = unique([
      "Lead with the existing relationship and the reason the contact is already connected to GCM.",
      "Use the website review to add value; do not invent an advertisement or cold-prospect origin.",
      ...(Array.isArray(source.personalizedOutreachInsights)
        ? source.personalizedOutreachInsights.filter(item => !/advertisement|mailer|postcard|campaign/i.test(clean(item)))
        : [])
    ]);

    source.firstContactEmail = {
      subject: `A few observations after our recent contact`,
      body:
        `Thanks for the recent contact. I took a look at ${verifiedName} and noted a few opportunities that may be worth comparing with what you are seeing inside the business. Would you be open to a short conversation so I can share the observations?`
    };

    source.discoveryCallScript = {
      ...(source.discoveryCallScript || {}),
      opening:
        `After our recent contact, I took a closer look at ${verifiedName} and found a few items worth comparing with what you are seeing inside the business.`
    };

    source.prospectIntelligence = {
      ...(source.prospectIntelligence || {}),
      recommendedFirstContact:
        "Reference the existing relationship and the reason for the recent contact, then offer the specific observations.",
      recommendedNextAction:
        "Compare the public website and supplied relationship context, verify the highest-value customer path, and prepare the next evidence-based conversation."
    };
  }

  return source;
}

function applyConsultantReasoningToBrief(brief) {
  const source = brief && typeof brief === "object" ? brief : {};
  const reasoning =
    source.consultantReasoning &&
    typeof source.consultantReasoning === "object"
      ? source.consultantReasoning
      : {};
  const engagement =
    reasoning.recommendedFirstEngagement &&
    typeof reasoning.recommendedFirstEngagement === "object"
      ? reasoning.recommendedFirstEngagement
      : {};

  const evidence = Array.isArray(reasoning.evidence)
    ? reasoning.evidence
    : [];
  const proof = Array.isArray(reasoning.proofWeWillLookFor)
    ? reasoning.proofWeWillLookFor
    : [];

  return {
    ...source,
    strongestArea:
      clean(source.strongestArea) ||
      evidence[0] ||
      "Strongest observable asset requires verification.",
    largestOpportunity:
      clean(reasoning.businessMeaning) ||
      clean(source.largestOpportunity) ||
      firstKnown(source.growthOpportunities || []) ||
      "Largest visible opportunity requires verification.",
    highestPriorityRecommendation:
      clean(engagement.name)
        ? `${clean(engagement.name)}: ${clean(engagement.whyFirst) || "Verify the highest-impact opportunity before recommending additional investment."}`
        : clean(source.highestPriorityRecommendation),
    personalizedOutreachInsights: unique([
      clean(reasoning.ownerConversation),
      ...(Array.isArray(source.personalizedOutreachInsights)
        ? source.personalizedOutreachInsights
        : [])
    ]).filter(Boolean),
    growthOpportunities: unique([
      clean(reasoning.businessMeaning),
      clean(reasoning.expectedBusinessResult),
      ...proof,
      ...(Array.isArray(source.growthOpportunities)
        ? source.growthOpportunities
        : [])
    ]).filter(Boolean)
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
    consultantReasoning: {
      ...fallback.consultantReasoning,
      ...(source.consultantReasoning || {}),
      evidence: arrayOrFallback(
        source?.consultantReasoning?.evidence,
        fallback?.consultantReasoning?.evidence || []
      ),
      recommendedFirstEngagement: {
        ...(fallback?.consultantReasoning?.recommendedFirstEngagement || {}),
        ...(source?.consultantReasoning?.recommendedFirstEngagement || {}),
        scope: arrayOrFallback(
          source?.consultantReasoning?.recommendedFirstEngagement?.scope,
          fallback?.consultantReasoning?.recommendedFirstEngagement?.scope || []
        )
      },
      proofWeWillLookFor: arrayOrFallback(
        source?.consultantReasoning?.proofWeWillLookFor,
        fallback?.consultantReasoning?.proofWeWillLookFor || []
      )
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
