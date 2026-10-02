import {
  DESIGN_INTENT_JSON_SCHEMA,
  validateDesignIntent
} from "../../intent/src/design-intent.js";

export const DEFAULT_CLOUD_INTENT_MODEL = "gpt-5.6-luna";
export const DEFAULT_CLOUD_INTENT_MAX_OUTPUT_TOKENS = 4096;

const INSTRUCTIONS = [
  "Translate the user's dungeon-design request into DesignIntent v1.",
  "Return only the structured DesignIntent object requested by the response schema.",
  "Interpret qualitative language as relative design preferences, not literal world facts.",
  "Use 0 for very low/absent, 0.5 for genuinely neutral/moderate, and 1 for very high/strong; when the user gives a clear directional preference, move the relevant axis meaningfully away from 0.5 instead of defaulting to neutral.",
  "Axis meanings: fairness = how avoidably/predictably the dungeon treats the player rather than using arbitrary punishment; tension = sustained pressure, fear, or urgency; exploration = incentive for optional discovery and detours; greedPunishment = how strongly pursuing optional or tempting rewards increases risk, cost, or danger; routeChoice = amount of meaningful branching between routes; learnability = how well observation or prior failure lets the player improve.",
  "Supporting axis meanings: combatDensity = frequency of enemy/combat encounters; trapDensity = frequency of traps or hazards; rewardDensity = frequency and availability of meaningful rewards or tempting reward opportunities; deception = use of misleading cues, bait, false safety, or deliberately obscured risk; telegraphStrength = clarity of warnings before danger; backtracking = amount of returning through already visited spaces; targetDifficulty = overall intended challenge.",
  "If the request explicitly says greed, optional rewards, treasure, or pursuing rewards should carry consequences, treat that as a strong positive signal for greedPunishment. If rewards/treasure are a prominent recurring part of the requested experience, also raise rewardDensity. Raise deception only when the wording also implies bait, misleading cues, false safety, hidden risk, or deliberate trickery.",
  "targetDuration means expected single-play completion time in seconds, not content size or difficulty.",
  "Respect explicit time expressions closely by converting them to seconds; for example, 5 minutes is about 300 seconds.",
  "Without an explicit time, interpret short or brief dungeon requests as 240 to 420 seconds and long dungeon requests as roughly 720 to 1200 seconds.",
  "An explicit numeric duration takes priority over qualitative length words, and negated wording such as 'not long' must not be treated as a request for a long duration.",
  "Do not generate executable code, scripts, runtime event definitions, or provider-specific metadata.",
  "Keep instantDeathAllowed false for the MVP."
].join(" ");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function error(code, message, extra = {}) {
  return { ok: false, error: { code, message, ...extra } };
}

function normalizePrompt(prompt) {
  const value = String(prompt ?? "").trim();
  if (!value) throw new TypeError("prompt must be a non-empty string");
  if (value.length > 12000) throw new RangeError("prompt exceeds the 12000 character cloud-intent limit");
  return value;
}

function assertModel(model) {
  if (typeof model !== "string" || model.trim() === "") {
    throw new TypeError("model must be a non-empty string");
  }
}

function assertMaxOutputTokens(value) {
  if (!Number.isSafeInteger(value) || value < 256 || value > 16384) {
    throw new RangeError("maxOutputTokens must be an integer between 256 and 16384");
  }
}

export function createOpenAIIntentRequest(prompt, {
  model = DEFAULT_CLOUD_INTENT_MODEL,
  maxOutputTokens = DEFAULT_CLOUD_INTENT_MAX_OUTPUT_TOKENS,
  reasoningEffort = "low"
} = {}) {
  const normalizedPrompt = normalizePrompt(prompt);
  assertModel(model);
  assertMaxOutputTokens(maxOutputTokens);
  if (!["none", "low", "medium", "high", "xhigh", "max"].includes(reasoningEffort)) {
    throw new RangeError(`unsupported reasoningEffort: ${reasoningEffort}`);
  }

  return {
    model,
    store: false,
    instructions: INSTRUCTIONS,
    input: normalizedPrompt,
    max_output_tokens: maxOutputTokens,
    reasoning: { effort: reasoningEffort },
    text: {
      format: {
        type: "json_schema",
        name: "design_intent_v1",
        strict: true,
        schema: clone(DESIGN_INTENT_JSON_SCHEMA)
      }
    }
  };
}

function extractRefusal(body) {
  if (!Array.isArray(body?.output)) return null;
  for (const item of body.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (content?.type === "refusal" && typeof content.refusal === "string") return content.refusal;
    }
  }
  return null;
}

function extractOutputText(body) {
  if (typeof body?.output_text === "string" && body.output_text.trim()) return body.output_text;
  if (!Array.isArray(body?.output)) return null;

  const chunks = [];
  for (const item of body.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.length > 0 ? chunks.join("") : null;
}

function sanitizedUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const pickInteger = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
  return {
    inputTokens: pickInteger(usage.input_tokens),
    outputTokens: pickInteger(usage.output_tokens),
    totalTokens: pickInteger(usage.total_tokens)
  };
}

export function parseOpenAIIntentResponse(body, { requestedModel = DEFAULT_CLOUD_INTENT_MODEL } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return error("PROVIDER_RESPONSE_INVALID", "Provider response body is not an object.");
  }

  if (body.error) {
    return error(
      "PROVIDER_RESPONSE_ERROR",
      typeof body.error.message === "string" ? body.error.message : "Provider returned an error response."
    );
  }

  const refusal = extractRefusal(body);
  if (refusal) {
    return error("PROVIDER_REFUSAL", "Provider refused the cloud intent request.");
  }

  if (body.status && body.status !== "completed") {
    return error("PROVIDER_RESPONSE_INCOMPLETE", `Provider response status is ${String(body.status)}.`);
  }

  const outputText = extractOutputText(body);
  if (!outputText) {
    return error("PROVIDER_OUTPUT_MISSING", "Provider response contained no structured output text.");
  }

  let intent;
  try {
    intent = JSON.parse(outputText);
  } catch {
    return error("PROVIDER_OUTPUT_NOT_JSON", "Provider structured output was not valid JSON.");
  }

  const validation = validateDesignIntent(intent);
  if (!validation.valid) {
    return error(
      "PROVIDER_INTENT_INVALID",
      "Provider output failed the independent DesignIntent validator.",
      { validationErrors: validation.errors.map((entry) => ({ ...entry })) }
    );
  }

  return {
    ok: true,
    intent: clone(intent),
    meta: {
      provider: "openai",
      model: typeof body.model === "string" ? body.model : requestedModel,
      responseId: typeof body.id === "string" ? body.id : null,
      usage: sanitizedUsage(body.usage)
    }
  };
}

export async function generateOpenAIIntent(prompt, {
  transport,
  model = DEFAULT_CLOUD_INTENT_MODEL,
  maxOutputTokens = DEFAULT_CLOUD_INTENT_MAX_OUTPUT_TOKENS,
  reasoningEffort = "low",
  signal
} = {}) {
  if (typeof transport !== "function") {
    return error("PROVIDER_TRANSPORT_REQUIRED", "A backend provider transport is required.");
  }

  let request;
  try {
    request = createOpenAIIntentRequest(prompt, { model, maxOutputTokens, reasoningEffort });
  } catch (cause) {
    return error("CLOUD_INTENT_REQUEST_INVALID", cause instanceof Error ? cause.message : String(cause));
  }

  let response;
  try {
    response = await transport(request, { signal });
  } catch (cause) {
    const aborted = cause?.name === "AbortError";
    return error(
      aborted ? "PROVIDER_ABORTED" : "PROVIDER_TRANSPORT_ERROR",
      aborted ? "Provider request was aborted." : "Provider transport failed."
    );
  }

  if (!response || typeof response !== "object") {
    return error("PROVIDER_TRANSPORT_INVALID", "Provider transport returned an invalid response envelope.");
  }

  if (response.status === 429) {
    return error("PROVIDER_RATE_LIMITED", "Provider rate limit reached.", {
      retryAfter: typeof response.retryAfter === "string" ? response.retryAfter : null
    });
  }

  if (!response.ok) {
    return error("PROVIDER_HTTP_ERROR", `Provider HTTP request failed with status ${String(response.status)}.`, {
      status: Number.isInteger(response.status) ? response.status : null
    });
  }

  return parseOpenAIIntentResponse(response.body, { requestedModel: model });
}
