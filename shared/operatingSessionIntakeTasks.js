/* =========================================================
   Global Concepts Media Operating System
   File: shared/operatingSessionIntakeTasks.js
   Version: 1.0.0
   Status: OS 2.0 AI Intake Candidate
   Purpose: Validate intake input and structured AI operating briefs.
   ========================================================= */

export const PREPARE_OPERATING_SESSION_ACTION = "prepare-operating-session";
export const OPERATING_INTAKE_MODEL = "gpt-5.6";

export const OPERATING_BRIEF_SCHEMA = Object.freeze({
  type:"object",
  additionalProperties:false,
  required:[
    "title","issueSummary","businessReason","priority","operationalCategory",
    "knownFacts","assumptions","unknowns","potentialCauses","clientImpact",
    "recommendedFirstAction","evidenceNeeded","verificationStandard",
    "relevantHistory","proofValue","followUpQuestions","confidence"
  ],
  properties:{
    title:{type:"string"},
    issueSummary:{type:"string"},
    businessReason:{type:"string"},
    priority:{type:"string",enum:["critical","high","normal","low"]},
    operationalCategory:{type:"string"},
    knownFacts:{type:"array",items:{type:"string"}},
    assumptions:{type:"array",items:{type:"string"}},
    unknowns:{type:"array",items:{type:"string"}},
    potentialCauses:{type:"array",items:{type:"string"}},
    clientImpact:{type:"string"},
    recommendedFirstAction:{type:"string"},
    evidenceNeeded:{type:"array",items:{type:"string"}},
    verificationStandard:{type:"array",items:{type:"string"}},
    relevantHistory:{type:"array",items:{type:"string"}},
    proofValue:{type:"string"},
    followUpQuestions:{type:"array",items:{type:"string"}},
    confidence:{type:"string",enum:["high","medium","low"]}
  }
});

export function prepareOperatingSessionIntake(input = {}) {
  const clientId=positiveInteger(input.clientId ?? input.client_id);
  if(!clientId) throw new Error("Choose the proven client before preparing the session.");
  const issue=cleanText(input.issue ?? input.issueDescription ?? input.issue_description,12000);
  if(issue.length<5) throw new Error("Tell me what happened before preparing the session.");
  return {clientId,issue,supportingEvidence:cleanText(input.supportingEvidence ?? input.supporting_evidence,20000)};
}

export function buildOperatingIntakeRequest({client,intake,history=[],model=OPERATING_INTAKE_MODEL}) {
  const clientContext={id:Number(client.id),code:client.client_code||null,name:client.name||"Unknown client"};
  return {
    model,
    store:false,
    instructions:[
      "You are the operating partner inside Global Concepts Media's private operating system.",
      "Prepare a decision-ready operating brief from the owner's plain-language issue.",
      "Do not claim that anything is proven, diagnosed, fixed, or verified unless the supplied evidence or history explicitly proves it.",
      "Known facts must be directly supported. Put interpretations in assumptions, unknowns, or potential causes.",
      "Potential causes are hypotheses, not findings. Relevant history may use only the supplied history.",
      "Focus on business operations, client impact, priority, next action, information needed, and verification—not merely Proof of Work.",
      "Keep the title concise, the issue summary specific, and the recommended first action practical."
    ].join(" "),
    input:JSON.stringify({client:clientContext,ownerStatement:intake.issue,supportingEvidence:intake.supportingEvidence||null,recentClientHistory:history}),
    text:{format:{type:"json_schema",name:"gcm_operating_session_brief",strict:true,schema:OPERATING_BRIEF_SCHEMA}},
    max_output_tokens:3000
  };
}

export function parseOperatingIntakeResponse(response) {
  const outputText=String(response?.output_text||extractOutputText(response?.output)||"").trim();
  if(!outputText) throw new Error("OpenAI returned no operating brief.");
  let proposal;
  try{proposal=JSON.parse(outputText);}catch{throw new Error("OpenAI returned an unreadable operating brief.");}
  return validateOperatingBrief(proposal);
}

export function validateOperatingBrief(value={}) {
  const proposal={
    title:required(value.title,"title",240),
    issueSummary:required(value.issueSummary,"issue summary",6000),
    businessReason:required(value.businessReason,"business reason",6000),
    priority:choice(value.priority,["critical","high","normal","low"],"priority"),
    operationalCategory:required(value.operationalCategory,"operational category",300),
    knownFacts:list(value.knownFacts), assumptions:list(value.assumptions), unknowns:list(value.unknowns),
    potentialCauses:list(value.potentialCauses), clientImpact:required(value.clientImpact,"client impact",6000),
    recommendedFirstAction:required(value.recommendedFirstAction,"recommended first action",6000),
    evidenceNeeded:list(value.evidenceNeeded), verificationStandard:list(value.verificationStandard),
    relevantHistory:list(value.relevantHistory), proofValue:required(value.proofValue,"record value",6000),
    followUpQuestions:list(value.followUpQuestions), confidence:choice(value.confidence,["high","medium","low"],"confidence")
  };
  return proposal;
}

export function formatOperatingBrief(proposal) {
  const sections=[
    ["Operational category",proposal.operationalCategory],
    ["Client impact",proposal.clientImpact],
    ["Recommended first action",proposal.recommendedFirstAction],
    ["Known facts",proposal.knownFacts],
    ["Assumptions",proposal.assumptions],
    ["Unknowns",proposal.unknowns],
    ["Potential causes — hypotheses only",proposal.potentialCauses],
    ["Evidence needed",proposal.evidenceNeeded],
    ["Verification standard",proposal.verificationStandard],
    ["Relevant client history",proposal.relevantHistory],
    ["Business record and Proof value",proposal.proofValue],
    ["Questions to resolve",proposal.followUpQuestions],
    ["AI confidence",proposal.confidence]
  ];
  return sections.map(([label,content])=>`${label}:\n${Array.isArray(content)?(content.length?content.map(item=>`- ${item}`).join("\n"):"- None identified"):content}`).join("\n\n");
}

function extractOutputText(output){for(const item of Array.isArray(output)?output:[]){for(const part of Array.isArray(item?.content)?item.content:[]){if(part?.type==="output_text"&&part.text)return part.text;}}return "";}
function positiveInteger(value){const number=Number(value);return Number.isInteger(number)&&number>0?number:null;}
function cleanText(value,max){const text=String(value??"").trim();if(text.length>max)throw new Error(`Intake text exceeds ${max} characters.`);return text;}
function required(value,label,max){const text=cleanText(value,max);if(!text)throw new Error(`The AI operating brief is missing ${label}.`);return text;}
function choice(value,allowed,label){const text=String(value??"").trim().toLowerCase();if(!allowed.includes(text))throw new Error(`The AI operating brief has an invalid ${label}.`);return text;}
function list(value){if(!Array.isArray(value))return[];const seen=new Set();return value.map(item=>String(item??"").trim()).filter(item=>{const key=item.toLowerCase();if(!item||seen.has(key))return false;seen.add(key);return true;}).slice(0,30);}
