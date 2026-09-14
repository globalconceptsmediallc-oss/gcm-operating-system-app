/* =========================================================
   Global Concepts Media Operating System
   File: shared/engines/consultantIntelligence.js
   Version: 1.0.2
   Status: Production Road-Test Candidate
   Source: shared/engines/consultantIntelligence.js 1.0.1
   Sprint: Prospect Intelligence Medical Fallback Reliability
   Purpose: Convert verified business identity and public website evidence
            into industry-aware consultant reasoning before the public
            Business Snapshot is written.

   PRODUCTION RULES
   - Read-only.
   - Creates no D1 records.
   - Evidence before assumptions.
   - Industry playbooks guide questions; they do not create facts.
   - No revenue, spend, ranking, performance, or competitor claims without
     observable evidence.
   ========================================================= */

import {
  ACTIONS,
  COMMUNICATION_REASONING_MODEL
} from "../config.js";

import { runAiJsonWithRetry } from "../ai.js";

export const CONSULTANT_INTELLIGENCE_VERSION = "1.0.2";

const PLAYBOOKS = Object.freeze({
  automotive: {
    label: "Automotive Dealership",
    likelyRevenueStreams: [
      "New vehicle sales",
      "Used and Certified Pre-Owned vehicle sales",
      "Service appointments",
      "Parts and accessories",
      "Financing and leasing",
      "Trade-in acquisition"
    ],
    growthDrivers: [
      "Inventory visibility and vehicle-detail-page quality",
      "Test-drive and sales inquiry conversion",
      "Service appointment volume and retention",
      "Trade-in and financing conversion",
      "Local search visibility and dealership reputation",
      "Accurate call, form, appointment, and source attribution"
    ],
    ownerQuestions: [
      "Which departments create the most profitable customer relationships?",
      "How efficiently do inventory visitors become calls, appointments, or test drives?",
      "How much service and parts demand is generated from existing customers?",
      "Can the dealership attribute calls, forms, chats, and appointments to their source?"
    ],
    risks: [
      "Paying for traffic that does not become qualified dealership inquiries",
      "Weak differentiation between the local dealership and competing dealers",
      "Inventory, trade-in, finance, or service friction",
      "Incomplete attribution across calls, forms, chats, and appointments"
    ]
  },

  legal: {
    label: "Legal Services",
    likelyRevenueStreams: [
      "Qualified case intake",
      "Contingency-fee matters",
      "Consultations and retained matters",
      "Referral and co-counsel relationships"
    ],
    growthDrivers: [
      "Practice-area visibility",
      "Local office and market visibility",
      "Attorney authority and public trust",
      "Phone and form intake conversion",
      "Case qualification and response speed",
      "Source-to-signed-case attribution"
    ],
    ownerQuestions: [
      "Which practice areas and locations create the highest-value qualified cases?",
      "How quickly are calls and form submissions answered and qualified?",
      "Do local pages, attorney profiles, and proof assets establish enough trust?",
      "Can the firm attribute signed cases to search, media, referrals, and local offices?"
    ],
    risks: [
      "High lead volume without qualified case conversion",
      "National brand strength masking weak local-market execution",
      "Practice-area or location pages competing without clear differentiation",
      "Incomplete attribution from inquiry to signed case"
    ]
  },

  medical: {
    label: "Medical Services",
    likelyRevenueStreams: [
      "Direct-pay consultations and assessments",
      "Physician-supervised treatment programs",
      "Advanced diagnostics and testing",
      "Ongoing memberships or care programs"
    ],
    growthDrivers: [
      "Inquiry or RSVP-to-consultation conversion",
      "Consultation-to-patient conversion",
      "Source-to-patient attribution",
      "Physician credibility and patient trust",
      "Follow-up after events and consultations",
      "Compliance-safe offer and claims alignment"
    ],
    ownerQuestions: [
      "How are campaign inquiries or event RSVPs tied back to the specific source?",
      "What percentage of respondents or attendees schedule a discovery call, assessment, or consultation?",
      "Can the practice follow a respondent from first response through consultation to a new patient or treatment plan?",
      "Which services or programs is the campaign intended to grow?"
    ],
    risks: [
      "Acquisition response that cannot be attributed through consultation and patient conversion",
      "Strong clinical differentiation that is not carried consistently through the campaign journey",
      "Follow-up gaps between first response, consultation, and patient decision",
      "Healthcare claims or testimonial use that creates avoidable compliance risk"
    ]
  },

  homeServices: {
    label: "Home Services",
    likelyRevenueStreams: [
      "Inbound service calls",
      "Quote and estimate requests",
      "Recurring service plans",
      "Emergency or high-intent appointments",
      "Cross-sell and customer retention"
    ],
    growthDrivers: [
      "Local search and Google Business Profile visibility",
      "Service-area and service-page clarity",
      "Reviews, licensing, guarantees, and project proof",
      "Call and form conversion",
      "Fast response and scheduling",
      "Lead-source and booked-job attribution"
    ],
    ownerQuestions: [
      "Which services and service areas create the most valuable booked work?",
      "Can customers quickly verify trust and schedule the next step?",
      "Are calls, forms, and booked jobs attributed to the right source?",
      "Is existing marketing producing profitable work or only inquiries?"
    ],
    risks: [
      "Broad service messaging that hides the highest-value offer",
      "Weak local proof or service-area relevance",
      "Lost calls, slow follow-up, or scheduling friction",
      "Marketing spend disconnected from booked revenue"
    ]
  },

  ecommerce: {
    label: "Ecommerce",
    likelyRevenueStreams: [
      "Online product sales",
      "Repeat purchases",
      "Bundles and upsells",
      "Email and retention revenue"
    ],
    growthDrivers: [
      "Product discoverability",
      "Product-page clarity and trust",
      "Checkout conversion",
      "Merchandising and offer strategy",
      "Customer retention",
      "Revenue and channel attribution"
    ],
    ownerQuestions: [
      "Which products and acquisition channels create profitable customers?",
      "Where do shoppers abandon the product or checkout journey?",
      "Are trust, delivery, returns, and product proof clear?",
      "Can repeat revenue and acquisition cost be measured?"
    ],
    risks: [
      "Traffic growth without profitable conversion",
      "Weak product differentiation or trust",
      "Checkout friction",
      "Acquisition reporting disconnected from contribution margin"
    ]
  },

  general: {
    label: "General Business",
    likelyRevenueStreams: [
      "Qualified inquiries",
      "Sales or appointments",
      "Repeat and referral business"
    ],
    growthDrivers: [
      "Visibility",
      "Offer clarity",
      "Customer trust",
      "Conversion path",
      "Measurement and attribution"
    ],
    ownerQuestions: [
      "Which customers, offers, and markets create the most business value?",
      "Where does the customer journey lose confidence or momentum?",
      "Can inquiries and sales be attributed to their source?",
      "What one improvement would create the most measurable value first?"
    ],
    risks: [
      "More marketing activity without a verified business priority",
      "Weak differentiation",
      "Customer-journey friction",
      "Incomplete measurement"
    ]
  }
});

export async function buildConsultantIntelligence({
  websiteUrl,
  businessProfile,
  businessIntelligenceRecord,
  websiteEvidence,
  advertisementEvidence,
  prospectContext,
  env,
  requestId
}) {
  const playbook = selectPlaybook(
    businessProfile?.industry ||
    businessIntelligenceRecord?.identity?.industry
  );

  const deterministic = buildDeterministicConsultantIntelligence({
    businessProfile,
    businessIntelligenceRecord,
    websiteEvidence,
    advertisementEvidence,
    playbook
  });

  if (!env?.AI || typeof env.AI.run !== "function") {
    return deterministic;
  }

  const aiResult = await runAiJsonWithRetry({
    env,
    model: COMMUNICATION_REASONING_MODEL,
    input: {
      messages: [
        {
          role: "system",
          content: [
            "You are the Consultant Intelligence Layer for Global Concepts Media.",
            "Your job is to understand how this specific business likely creates value before writing any recommendation.",
            "Use the industry playbook as a question framework, never as proof that a fact is true.",
            "Every conclusion must connect to supplied public evidence or be clearly labeled as requiring verification.",
            "Write observations that could only apply to this business or its business model.",
            "Do not use generic phrases such as visible business activity, focused customer-journey review, or additional marketing investment.",
            "The strongest asset, largest opportunity, and first action must be three distinct ideas.",
            "The largest opportunity is a diagnosis: describe the business weakness, risk, or lost-value condition.",
            "The recommended first action is an imperative action: begin with a verb and state exactly what should be reviewed, tested, changed, or measured first.",
            "Never repeat, lightly paraphrase, or restate the largest opportunity as the recommended first action.",
            "The first action must be specific, practical, and explain what should be verified first.",
            "State what should not be recommended until missing evidence is verified.",
            "Do not invent revenue, spend, rankings, review counts, performance, ownership, market share, or guaranteed outcomes.",
            "Return one valid JSON object only."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Build the consultant reasoning that a senior GCM consultant would use in the first five minutes of an owner conversation.",
            websiteUrl,
            businessProfile,
            businessIntelligenceRecord,
            websiteEvidence: {
              title: websiteEvidence?.title,
              metaDescription: websiteEvidence?.metaDescription,
              headings: websiteEvidence?.headings,
              callsToAction: websiteEvidence?.callsToAction,
              businessModel: websiteEvidence?.businessModel,
              revenueStreams: websiteEvidence?.revenueStreams,
              primaryBrandAssets: websiteEvidence?.primaryBrandAssets,
              visibleText: clean(websiteEvidence?.visibleText).slice(0, 14000)
            },
            advertisementEvidence,
            prospectContext,
            industryPlaybook: playbook,
            requiredOutput: {
              businessModel: "specific one-sentence explanation",
              likelyRevenueStreams: ["specific supported or clearly qualified stream"],
              primaryCustomerDecision: "what the customer must decide",
              visibleCompetitiveAdvantage: "strongest observable asset and why it matters",
              largestObservableRisk: "specific risk and why it matters",
              highestValueOpportunity: "diagnosis only: specific weakness, risk, friction, or lost-value condition connected to business value",
              recommendedFirstAction: "action only: begin with a verb and specify the first review, test, change, or measurement",
              whyThisActionFirst: "business reason",
              expectedBusinessResult: "non-guaranteed measurable result",
              whatNotToRecommendYet: ["recommendation to avoid until evidence exists"],
              evidenceChain: [
                {
                  evidence: "observable fact",
                  meaning: "business implication",
                  confidence: "High | Medium | Low"
                }
              ],
              missingEvidence: ["important item to verify"],
              proofToVerify: ["specific proof or metric"],
              ownerConversation: "two or three sentences Andy could say to the owner",
              executiveBrief: "specific 70-120 word executive briefing",
              confidence: "High | Medium | Low"
            }
          })
        }
      ],
      max_tokens: 2400,
      temperature: 0.1
    },
    stageName: "consultant_intelligence_layer",
    requestId,
    route: ACTIONS.ANALYZE_PROSPECT_INTELLIGENCE,
    timeoutMs: 35000,
    maxRetries: 1
  });

  if (!aiResult.ok || !aiResult.data || typeof aiResult.data !== "object") {
    return deterministic;
  }

  return enforceDiagnosisActionSeparation(
    normalizeConsultantIntelligence(aiResult.data, deterministic, playbook)
  );
}

export function applyConsultantIntelligenceToBrief(brief, intelligence) {
  const source = brief && typeof brief === "object" ? brief : {};
  const insight = enforceDiagnosisActionSeparation(
    intelligence && typeof intelligence === "object" ? intelligence : {}
  );

  const evidenceStatements = Array.isArray(insight.evidenceChain)
    ? insight.evidenceChain
        .map((item) => clean(item?.evidence))
        .filter(Boolean)
    : [];

  return {
    ...source,
    businessSummary:
      clean(insight.executiveBrief) ||
      clean(source.businessSummary),
    strongestArea:
      clean(insight.visibleCompetitiveAdvantage) ||
      clean(source.strongestArea),
    largestOpportunity:
      clean(insight.highestValueOpportunity) ||
      clean(source.largestOpportunity),
    highestPriorityRecommendation:
      clean(insight.recommendedFirstAction) ||
      clean(source.highestPriorityRecommendation),
    growthOpportunities: unique([
      clean(insight.highestValueOpportunity),
      clean(insight.expectedBusinessResult),
      ...(Array.isArray(source.growthOpportunities)
        ? source.growthOpportunities
        : [])
    ]).filter(Boolean),
    missingInformation: unique([
      ...(Array.isArray(insight.missingEvidence)
        ? insight.missingEvidence
        : []),
      ...(Array.isArray(source.missingInformation)
        ? source.missingInformation
        : [])
    ]).filter(Boolean),
    humanVerificationChecklist: unique([
      ...(Array.isArray(insight.proofToVerify)
        ? insight.proofToVerify
        : []),
      ...(Array.isArray(source.humanVerificationChecklist)
        ? source.humanVerificationChecklist
        : [])
    ]).filter(Boolean),
    personalizedOutreachInsights: unique([
      clean(insight.ownerConversation),
      ...(Array.isArray(source.personalizedOutreachInsights)
        ? source.personalizedOutreachInsights
        : [])
    ]).filter(Boolean),
    consultantReasoning: {
      ...(source.consultantReasoning || {}),
      evidence: evidenceStatements.length
        ? evidenceStatements
        : source?.consultantReasoning?.evidence || [],
      businessMeaning:
        clean(insight.largestObservableRisk) ||
        clean(source?.consultantReasoning?.businessMeaning),
      recommendedFirstEngagement: {
        ...(source?.consultantReasoning?.recommendedFirstEngagement || {}),
        name:
          clean(insight.recommendedFirstAction) ||
          clean(source?.consultantReasoning?.recommendedFirstEngagement?.name),
        whyFirst:
          clean(insight.whyThisActionFirst) ||
          clean(source?.consultantReasoning?.recommendedFirstEngagement?.whyFirst),
        scope: Array.isArray(insight.proofToVerify)
          ? insight.proofToVerify
          : source?.consultantReasoning?.recommendedFirstEngagement?.scope || []
      },
      expectedBusinessResult:
        clean(insight.expectedBusinessResult) ||
        clean(source?.consultantReasoning?.expectedBusinessResult),
      proofWeWillLookFor: Array.isArray(insight.proofToVerify)
        ? insight.proofToVerify
        : source?.consultantReasoning?.proofWeWillLookFor || [],
      ownerConversation:
        clean(insight.ownerConversation) ||
        clean(source?.consultantReasoning?.ownerConversation),
      whatNotToRecommendYet: Array.isArray(insight.whatNotToRecommendYet)
        ? insight.whatNotToRecommendYet
        : []
    },
    consultantIntelligence: insight
  };
}

function selectPlaybook(industryValue) {
  const industry = clean(industryValue).toLowerCase();

  if (
    /automotive|dealership|vehicle|car dealer|bmw|mercedes|lexus|audi/.test(
      industry
    )
  ) {
    return PLAYBOOKS.automotive;
  }

  if (
    /legal|law firm|attorney|lawyer|personal injury/.test(industry)
  ) {
    return PLAYBOOKS.legal;
  }

  if (
    /medical|healthcare|health care|physician|clinic|longevity|regenerative|concierge medicine/.test(
      industry
    )
  ) {
    return PLAYBOOKS.medical;
  }

  if (
    /home service|hvac|plumb|electric|roof|pest|lawn|landscap|locksmith/.test(
      industry
    )
  ) {
    return PLAYBOOKS.homeServices;
  }

  if (/ecommerce|e-commerce|online retail|online store/.test(industry)) {
    return PLAYBOOKS.ecommerce;
  }

  return PLAYBOOKS.general;
}

function buildDeterministicConsultantIntelligence({
  businessProfile,
  businessIntelligenceRecord,
  websiteEvidence,
  advertisementEvidence,
  playbook
}) {
  const name =
    clean(businessProfile?.businessName) ||
    clean(businessIntelligenceRecord?.identity?.businessName) ||
    "The business";

  const industry =
    clean(businessProfile?.industry) ||
    clean(businessIntelligenceRecord?.identity?.industry) ||
    playbook.label;

  const market =
    clean(businessProfile?.geographicMarket) ||
    clean(businessIntelligenceRecord?.identity?.geographicMarket);

  const services =
    arrayOrEmpty(businessIntelligenceRecord?.services?.primaryServices);

  const brandAssets = unique([
    ...arrayOrEmpty(businessProfile?.primaryBrandAssets),
    ...arrayOrEmpty(websiteEvidence?.primaryBrandAssets)
  ]);

  const trustSignals =
    arrayOrEmpty(businessIntelligenceRecord?.trust?.observableTrustSignals);

  const callsToAction =
    arrayOrEmpty(businessIntelligenceRecord?.offer?.primaryCallsToAction);

  const isMedical = playbook === PLAYBOOKS.medical;
  const hasAdvertisement = advertisementEvidence?.status === "complete";
  const isEventCampaign = /dinner|event|rsvp/i.test([
    clean(advertisementEvidence?.supportingMessage),
    clean(advertisementEvidence?.headline),
    clean(advertisementEvidence?.offer),
    ...arrayOrEmpty(advertisementEvidence?.callsToAction)
  ].join(" "));

  const strongest =
    trustSignals[0] ||
    brandAssets[0] ||
    services[0] ||
    "The website establishes a visible operating presence, but the strongest competitive advantage requires verification.";

  const opportunity = isMedical && hasAdvertisement
    ? `${name} should verify how campaign response${isEventCampaign ? " and event RSVPs" : ""} progress into consultations and new patients, and where attribution or follow-up is lost between those stages.`
    : `${name} should verify which ${playbook.growthDrivers
        .slice(0, 3)
        .join(", ")} create qualified customer action before expanding disconnected marketing activity.`;

  const firstAction = isMedical && hasAdvertisement
    ? `Map the campaign${isEventCampaign ? " → RSVP → event" : " response"} → consultation → patient journey, verify tracking at each handoff, and establish a source-to-patient baseline.`
    : `Complete a focused ${playbook.label} growth review that verifies ${playbook.growthDrivers
        .slice(0, 3)
        .join(", ")} and establishes one measurable priority.`;

  const executiveBrief = isMedical
    ? `${name} is a physician-led medical practice${market && !/requires|unknown/i.test(market) ? ` serving ${market}` : ""}. Public evidence shows ${services.length ? `services including ${services.slice(0, 4).join(", ")}` : "a broad clinical offering"}, and the strongest visible trust asset is ${strongest}. ${hasAdvertisement ? `The current acquisition campaign${isEventCampaign ? " uses an event/RSVP path" : " provides direct-response paths"}, making source-to-consultation and source-to-patient attribution the first business question to verify.` : "The first consulting priority is to verify the patient acquisition and conversion path before recommending additional marketing."}`
    : `${name} is identified as a ${industry.toLowerCase()} business` +
      (market && !/requires|unknown/i.test(market)
        ? ` serving ${market}`
        : "") +
      `. Public evidence shows ${services.length
        ? `offers including ${services.slice(0, 4).join(", ")}`
        : "an established public business presence"}. ` +
      `The strongest visible asset is ${strongest}. ` +
      `The first consulting priority is to verify ${playbook.growthDrivers
        .slice(0, 3)
        .join(", ")} so the next recommendation is tied to measurable business value.`;

  const result = {
    intelligenceVersion: CONSULTANT_INTELLIGENCE_VERSION,
    playbook: playbook.label,
    businessModel:
      clean(businessProfile?.businessModel) ||
      (isMedical
        ? `${name} appears to create value through direct-pay consultations, diagnostics, physician-supervised treatment programs, and ongoing care; the exact revenue mix requires verification.`
        : `${name} appears to create value through ${playbook.likelyRevenueStreams
            .slice(0, 3)
            .join(", ")}; the exact revenue mix requires verification.`),
    likelyRevenueStreams: unique([
      ...arrayOrEmpty(businessProfile?.revenueStreams),
      ...playbook.likelyRevenueStreams
    ]).slice(0, 8),
    primaryCustomerDecision: isMedical
      ? "Whether the practice's physician credibility, clinical fit, and next-step experience justify scheduling a consultation or assessment."
      : "Whether the business provides enough relevance, confidence, and convenience to justify taking the next step.",
    visibleCompetitiveAdvantage: strongest,
    largestObservableRisk:
      playbook.risks[0],
    highestValueOpportunity: opportunity,
    recommendedFirstAction: firstAction,
    whyThisActionFirst: isMedical && hasAdvertisement
      ? "It tests whether existing acquisition activity can be measured through the patient journey before more media, automation, or follow-up work is added."
      : "It verifies the customer and measurement path before recommending additional implementation or spending.",
    expectedBusinessResult: isMedical && hasAdvertisement
      ? "A measurable baseline for campaign response, consultation, and new-patient conversion, with the first tracking or follow-up gap identified."
      : "A prioritized improvement connected to qualified inquiries, appointments, sales, cases, booked work, or another measurable business outcome.",
    whatNotToRecommendYet: isMedical
      ? [
          "Do not recommend increasing advertising spend until consultation and patient attribution is verified.",
          "Do not recommend new healthcare claims, testimonials, or treatment-promotional creative without compliance review.",
          "Do not promise patient volume, revenue, rankings, or lead growth without a measured baseline."
        ]
      : [
          "Do not recommend increasing advertising spend until conversion and attribution evidence is verified.",
          "Do not promise revenue, rankings, or lead growth without a measured baseline."
        ],
    evidenceChain: unique([
      strongest
        ? {
            evidence: strongest,
            meaning: "This is the clearest visible asset that may already support customer confidence or action.",
            confidence: "Medium"
          }
        : null,
      callsToAction.length
        ? {
            evidence: `Visible response paths include ${callsToAction
              .slice(0, 4)
              .join(", ")}.`,
            meaning: isMedical
              ? "The practice provides observable patient-response paths that should be connected to consultation and patient attribution."
              : "The business provides observable conversion paths that should be tested for friction and tracking.",
            confidence: "High"
          }
        : null,
      advertisementEvidence?.status === "complete"
        ? {
            evidence: isMedical && isEventCampaign
              ? "The practice is using a direct-response advertisement tied to an RSVP/event path."
              : "The business is using visible paid advertising.",
            meaning: isMedical
              ? "Existing acquisition activity should be measured through consultation and patient conversion before more spending is recommended."
              : "Existing acquisition investment should be measured before more spending is recommended.",
            confidence: "High"
          }
        : null
    ].filter(Boolean)),
    missingEvidence: unique([
      ...playbook.ownerQuestions,
      isMedical
        ? "Verified RSVP or inquiry, consultation, new-patient, and treatment attribution"
        : "Verified lead, appointment, sale, case, booking, or revenue attribution",
      "Current business priority and decision-maker goals"
    ]),
    proofToVerify: unique([
      ...playbook.growthDrivers,
      isMedical
        ? "Working RSVP, call, form, discovery-call, and assessment paths"
        : "Working calls, forms, chats, appointments, or purchase paths",
      isMedical
        ? "Source-to-patient measurement baseline"
        : "Source-to-outcome measurement baseline"
    ]),
    ownerConversation: isMedical && hasAdvertisement
      ? `${name} is already investing in a direct-response patient acquisition path${isEventCampaign ? " built around an RSVP event" : ""}. Before I suggest more marketing, I would map how that response becomes a consultation and new patient, then identify where attribution or follow-up is being lost.`
      : `${name} already shows a credible public foundation. ` +
        `Before I recommend more marketing, I would verify which customer path and measurement gap has the greatest business impact, then focus the first engagement there.`,
    executiveBrief,
    confidence:
      clean(businessIntelligenceRecord?.confidence?.label) ||
      clean(businessProfile?.confidence) ||
      "Medium"
  };

  return enforceDiagnosisActionSeparation(result);
}

function enforceDiagnosisActionSeparation(intelligence) {
  const source = intelligence && typeof intelligence === "object" ? { ...intelligence } : {};
  const diagnosis = clean(source.highestValueOpportunity);
  let action = clean(source.recommendedFirstAction);
  const proofItems = arrayOrEmpty(source.proofToVerify);
  const missingItems = arrayOrEmpty(source.missingEvidence);

  if (!action || isSubstantiallySimilar(diagnosis, action) || !startsWithActionVerb(action)) {
    action = buildDistinctFirstAction({ diagnosis, proofItems, missingItems, playbook: clean(source.playbook) });
  }

  source.highestValueOpportunity = diagnosis || "The highest-value business opportunity requires verification.";
  source.recommendedFirstAction = action;
  return source;
}

function buildDistinctFirstAction({ proofItems, missingItems, playbook }) {
  const targets = unique([...proofItems, ...missingItems]).slice(0, 3);
  if (targets.length) {
    return `Audit ${targets.join(", ")} and establish a measured baseline before choosing the next implementation or spending decision.`;
  }
  const subject = playbook && !/general business/i.test(playbook) ? playbook.toLowerCase() : "business";
  return `Map the highest-value ${subject} customer path from discovery to qualified action, test each response point, and document the first measurable source of friction.`;
}

function isSubstantiallySimilar(leftValue, rightValue) {
  const leftTokens = meaningfulTokens(leftValue);
  const rightTokens = meaningfulTokens(rightValue);
  if (!leftTokens.length || !rightTokens.length) return false;
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  const jaccard = union ? intersection / union : 0;
  const shorterCoverage = intersection / Math.max(1, Math.min(leftSet.size, rightSet.size));
  return jaccard >= 0.5 || shorterCoverage >= 0.72;
}

function meaningfulTokens(value) {
  const stopWords = new Set(["a","an","and","are","as","at","be","before","but","by","for","from","has","have","in","is","it","of","on","or","should","that","the","their","this","to","verify","with","without"]);
  return clean(value).toLowerCase().replace(/[^a-z0-9\s-]/g," ").split(/\s+/).filter((token) => token.length > 2 && !stopWords.has(token));
}

function startsWithActionVerb(value) {
  return /^(audit|analyze|benchmark|compare|confirm|document|evaluate|identify|inspect|map|measure|prioritize|review|test|track|validate|verify)\b/i.test(clean(value));
}

function normalizeConsultantIntelligence(value, fallback, playbook) {
  const source = value && typeof value === "object" ? value : {};

  return {
    ...fallback,
    ...source,
    intelligenceVersion: CONSULTANT_INTELLIGENCE_VERSION,
    playbook: playbook.label,
    likelyRevenueStreams: arrayOrFallback(
      source.likelyRevenueStreams,
      fallback.likelyRevenueStreams
    ),
    whatNotToRecommendYet: arrayOrFallback(
      source.whatNotToRecommendYet,
      fallback.whatNotToRecommendYet
    ),
    evidenceChain: Array.isArray(source.evidenceChain)
      ? source.evidenceChain.slice(0, 8)
      : fallback.evidenceChain,
    missingEvidence: arrayOrFallback(
      source.missingEvidence,
      fallback.missingEvidence
    ),
    proofToVerify: arrayOrFallback(
      source.proofToVerify,
      fallback.proofToVerify
    )
  };
}

function arrayOrEmpty(value) {
  return Array.isArray(value)
    ? value.map(clean).filter(Boolean)
    : [];
}

function arrayOrFallback(value, fallback) {
  const items = arrayOrEmpty(value);
  return items.length ? items : fallback;
}

function unique(values) {
  const output = [];
  const seen = new Set();

  for (const value of values || []) {
    if (value && typeof value === "object") {
      const key = JSON.stringify(value);
      if (!seen.has(key)) {
        seen.add(key);
        output.push(value);
      }
      continue;
    }

    const item = clean(value);
    const key = item.toLowerCase();

    if (item && !seen.has(key)) {
      seen.add(key);
      output.push(item);
    }
  }

  return output;
}

function clean(value) {
  return value === null || value === undefined
    ? ""
    : String(value).replace(/\s+/g, " ").trim();
}
