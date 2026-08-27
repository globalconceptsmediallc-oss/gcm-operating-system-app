/* =========================================================
   MediaForge
   File: functions/api/classify.js
   Version: 1.7.0
   Status: Hardware Classification Road Test
   Source: Production Development
   Purpose: Compare one complete Liberty Premium product image
            against approved Black Chrome, Brass, and Chrome
            references on one comparison board, and estimate size.
   Binding Required: AI
   Model: @cf/meta/llama-3.2-11b-vision-instruct
   ========================================================= */

const MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + chunkSize)
    );
  }

  return btoa(binary);
}

function getRawOutput(aiResponse) {
  if (aiResponse == null) return "";

  if (typeof aiResponse === "string") {
    return aiResponse.trim();
  }

  const direct =
    aiResponse.response ??
    aiResponse.answer ??
    aiResponse.result ??
    aiResponse.output_text ??
    aiResponse.text ??
    "";

  if (typeof direct === "string") {
    return direct.trim();
  }

  if (direct && typeof direct === "object") {
    return JSON.stringify(direct);
  }

  return JSON.stringify(aiResponse);
}

function parseJsonObject(rawText) {
  const source = String(rawText || "").trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : source;
  const match = candidate.match(/\{[\s\S]*\}/);

  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function cleanValue(value) {
  return String(value || "")
    .replace(/\*\*/g, "")
    .replace(/^[\s\-–—•*]+/, "")
    .trim();
}

function findLabeledValue(source, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `(?:^|\\n)\\s*(?:[-*•]\\s*)?(?:\\*\\*)?${escaped}(?:\\*\\*)?\\s*[:=#-]\\s*([^\\n]+)`,
        "i"
      ),
      new RegExp(
        `\\b${escaped}\\s*[:=#-]\\s*([^\\n,;]+)`,
        "i"
      )
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match) return cleanValue(match[1]);
    }
  }

  return null;
}

function normalizeYesNo(value) {
  const source = String(value || "").trim().toLowerCase();

  if (
    source === "yes" ||
    source.startsWith("yes ") ||
    source.includes("answer: yes") ||
    source.includes("true")
  ) {
    return true;
  }

  if (
    source === "no" ||
    source.startsWith("no ") ||
    source.includes("answer: no") ||
    source.includes("false")
  ) {
    return false;
  }

  return null;
}

function firstInteger(value) {
  const match = String(value || "").match(/\d{1,3}/);
  return match ? Number(match[0]) : null;
}

function parseBinaryResponse(rawText) {
  const jsonObject = parseJsonObject(rawText);

  if (jsonObject) {
    const answer = normalizeYesNo(
      jsonObject.answer ??
      jsonObject.yes ??
      jsonObject.result ??
      jsonObject.classification
    );

    if (answer == null) return null;

    return {
      answer,
      confidence: Math.max(
        0,
        Math.min(
          100,
          Number(
            jsonObject.confidence ??
            jsonObject.confidence_score ??
            60
          ) || 0
        )
      ),
      explanation: String(
        jsonObject.explanation ??
        jsonObject.reason ??
        jsonObject.visual_evidence ??
        ""
      ).slice(0, 500)
    };
  }

  const source = String(rawText || "")
    .replace(/\r/g, "")
    .trim();

  const answer = normalizeYesNo(
    findLabeledValue(source, [
      "Answer",
      "Decision",
      "Classification",
      "Result"
    ]) || source.split("\n")[0]
  );

  if (answer == null) return null;

  const confidence = firstInteger(
    findLabeledValue(source, [
      "Confidence",
      "Confidence Score"
    ])
  );

  const explanation =
    findLabeledValue(source, [
      "Explanation",
      "Reason",
      "Visual Evidence"
    ]) || source.slice(0, 500);

  return {
    answer,
    confidence: confidence == null ? 60 : confidence,
    explanation
  };
}

function buildPrompt() {
  return `You are analyzing one comparison board.

BOARD LAYOUT
- The large product image is labeled PRODUCT IMAGE.
- Three approved references are labeled:
  BLACK CHROME REFERENCE
  BRASS REFERENCE
  CHROME REFERENCE

PART 1 — HARDWARE
Look at the complete PRODUCT IMAGE.
Locate the electronic lock/keypad, lock surround, center hub, handle spokes, and nearby metal trim yourself.
Do not use a fixed crop.
Compare those parts directly against the three approved references.
Choose: Black Chrome, Brass, Chrome, or Unclear.

PART 2 — SAFE SIZE
Use the complete product image, including overall proportions, door height, width-to-height ratio, hardware scale relative to the door, and visible interior when present.
Estimate: 08, 12, 17, or Unclear.

Ignore filename, exterior color, marble/gloss finish, lock model, and variant position.

Return only:
Hardware Match: Black Chrome
Hardware Confidence: 94
Safe Size: 12
Size Confidence: 82
Explanation: The hardware most closely matches the dark reference and the full safe proportions appear closest to size 12.`;
}

function normalizeHardware(value) {
  const source = String(value || "").replace(/\*\*/g, "").trim().toLowerCase();

  if (
    source.includes("black chrome") ||
    source.includes("black-chrome") ||
    source.includes("dark chrome") ||
    source.includes("gunmetal") ||
    source === "bc"
  ) return "black_chrome";

  if (source.includes("brass") || source.includes("gold")) return "brass";

  if (
    source === "chrome" ||
    source.includes("bright chrome") ||
    source.includes("silver chrome") ||
    source.includes("bright silver")
  ) return "chrome";

  if (
    source.includes("unclear") ||
    source.includes("unknown") ||
    source.includes("cannot determine")
  ) return "unclear";

  return "";
}

function normalizeSize(value) {
  const source = String(value || "").trim().toLowerCase();

  if (
    source.includes("unclear") ||
    source.includes("unknown") ||
    source.includes("cannot determine")
  ) return "unclear";

  const match = source.match(/\b(08|8|12|17)\b/);
  if (!match) return "";
  return match[1] === "8" ? "08" : match[1];
}

function parseComparisonResponse(rawText) {
  const jsonObject = parseJsonObject(rawText);

  if (jsonObject) {
    return {
      hardware: normalizeHardware(
        jsonObject.hardware_match ??
        jsonObject.hardware ??
        jsonObject.hardware_finish
      ),
      hardware_confidence: Number(
        jsonObject.hardware_confidence ??
        jsonObject.hardware_match_confidence ??
        60
      ),
      size: normalizeSize(
        jsonObject.safe_size ??
        jsonObject.size ??
        jsonObject.estimated_size
      ),
      size_confidence: Number(
        jsonObject.size_confidence ??
        jsonObject.safe_size_confidence ??
        60
      ),
      explanation: String(
        jsonObject.explanation ??
        jsonObject.reason ??
        ""
      ).slice(0, 900)
    };
  }

  const source = String(rawText || "").replace(/\r/g, "").trim();

  const hardware = normalizeHardware(
    findLabeledValue(source, [
      "Hardware Match",
      "Hardware",
      "Hardware Finish",
      "Closest Hardware Reference"
    ])
  );

  const size = normalizeSize(
    findLabeledValue(source, [
      "Safe Size",
      "Size",
      "Estimated Size"
    ])
  );

  if (!hardware || !size) return null;

  return {
    hardware,
    hardware_confidence:
      firstInteger(findLabeledValue(source, [
        "Hardware Confidence",
        "Hardware Match Confidence"
      ])) ?? 60,
    size,
    size_confidence:
      firstInteger(findLabeledValue(source, [
        "Size Confidence",
        "Safe Size Confidence"
      ])) ?? 60,
    explanation:
      findLabeledValue(source, [
        "Explanation",
        "Reason",
        "Visual Evidence"
      ]) || source.slice(0, 900)
  };
}

function normalizeClassification(raw, rawOutput) {
  const allowedHardware = {
    black_chrome:{label:"Black Chrome",code:"bc"},
    brass:{label:"Brass",code:"brass"},
    chrome:{label:"Chrome",code:"chrome"},
    unclear:{label:"Unclear",code:null}
  };

  if (!raw.hardware || !allowedHardware[raw.hardware]) {
    throw new Error(
      `The classifier returned an invalid hardware value. Raw response: ${rawOutput.slice(0,1000)}`
    );
  }

  if (!["08","12","17","unclear"].includes(raw.size)) {
    throw new Error(
      `The classifier returned an invalid size value. Raw response: ${rawOutput.slice(0,1000)}`
    );
  }

  const hardwareConfidence = Math.max(0, Math.min(100, Number(raw.hardware_confidence) || 0));
  const sizeConfidence = Math.max(0, Math.min(100, Number(raw.size_confidence) || 0));
  const reference = allowedHardware[raw.hardware];

  return {
    method:"full-image-reference-board",
    hardware:raw.hardware,
    hardware_label:reference.label,
    hardware_code:reference.code,
    hardware_confidence:hardwareConfidence,
    size:raw.size,
    size_confidence:sizeConfidence,
    explanation:String(raw.explanation || "").slice(0,900),
    review_required:
      raw.hardware === "unclear" ||
      raw.size === "unclear" ||
      hardwareConfidence < 85 ||
      sizeConfidence < 70
  };
}

export async function onRequestPost(context) {
  try {
    if (!context.env.AI) {
      return json({ ok:false, error:"Workers AI binding 'AI' is not configured." }, 500);
    }

    const form = await context.request.formData();
    const image = form.get("image");

    if (!(image instanceof File)) {
      return json({ ok:false, error:"A comparison-board image is required." }, 400);
    }

    if (!["image/jpeg","image/png","image/webp"].includes(image.type)) {
      return json({ ok:false, error:"Only JPG, PNG, and WebP images are supported." }, 415);
    }

    if (image.size > MAX_IMAGE_BYTES) {
      return json({ ok:false, error:"The comparison board exceeds the 10 MB analysis limit." }, 413);
    }

    const imageData =
      `data:${image.type};base64,${arrayBufferToBase64(await image.arrayBuffer())}`;

    const aiResponse = await context.env.AI.run(MODEL, {
      prompt:buildPrompt(),
      image:imageData,
      stream:false,
      max_tokens:420,
      temperature:0,
      top_p:0.15
    });

    const rawOutput = getRawOutput(aiResponse);

    if (!rawOutput) {
      throw new Error(
        `Workers AI returned an empty response. Raw object: ${JSON.stringify(aiResponse).slice(0,700)}`
      );
    }

    const parsed = parseComparisonResponse(rawOutput);

    if (!parsed) {
      throw new Error(
        `The full-image reference response could not be parsed. Raw response: ${rawOutput.slice(0,1200)}`
      );
    }

    return json({
      ok:true,
      version:"1.7.0",
      model:MODEL,
      method:"full-image-reference-board",
      classification:normalizeClassification(parsed, rawOutput),
      raw_output:rawOutput.slice(0,1600)
    });
  } catch (error) {
    console.error("MediaForge full-image reference classification error", error);

    return json({
      ok:false,
      error:error instanceof Error
        ? error.message
        : "Full-image reference classification failed."
    }, 500);
  }
}

export function onRequestGet() {
  return json({
    ok:true,
    service:"MediaForge full-image reference classifier",
    version:"1.7.0",
    model:MODEL,
    method:"full-image-reference-board",
    hardware_values:["Black Chrome","Brass","Chrome","Unclear"],
    size_values:["08","12","17","Unclear"]
  });
}