import { DEFAULT_CLOUD_INTENT_MODEL } from "./cloud-intent-adapter.js";

export const DEFAULT_CLOUD_EDIT_MODEL = DEFAULT_CLOUD_INTENT_MODEL;
export const DEFAULT_CLOUD_EDIT_MAX_OUTPUT_TOKENS = 512;

const INSTRUCTIONS = [
  "Translate one natural-language dungeon authoring edit into exactly one supported EditCommand.",
  "For this MVP path, the only supported command is move-entity.",
  "Use only the exact entityId and roomId values provided in the input context; never invent IDs.",
  "Resolve semantic references such as treasure, enemy, start room, or goal room from the provided entity types and locations.",
  "Do not generate code, explanations, extra fields, or multiple commands.",
  "Return only the structured command required by the response schema."
].join(" ");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fail(code, message, extra = {}) {
  return { ok: false, error: { code, message, ...extra } };
}

function normalizePrompt(prompt) {
  const value = String(prompt ?? "").trim();
  if (!value) throw new TypeError("prompt must be a non-empty string");
  if (value.length > 4000) throw new RangeError("prompt exceeds the 4000 character natural-edit limit");
  return value;
}

function normalizeContext(spec) {
  if (!spec || typeof spec !== "object" || !Array.isArray(spec.rooms) || !Array.isArray(spec.entities)) {
    throw new TypeError("natural-edit context requires rooms and entities arrays");
  }

  const rooms = spec.rooms.map((room) => ({
    id: String(room.id ?? ""),
  }));
  const entities = spec.entities.map((entity) => ({
    id: String(entity.id ?? ""),
    type: String(entity.type ?? ""),
    roomId: String(entity.roomId ?? ""),
  }));

  if (rooms.length === 0 || rooms.some((room) => !room.id)) {
    throw new TypeError("natural-edit context contains an invalid room ID");
  }
  if (entities.length === 0 || entities.some((entity) => !entity.id || !entity.type || !entity.roomId)) {
    throw new TypeError("natural-edit context contains an invalid entity");
  }

  return { rooms, entities };
}

function editCommandSchema(context) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", enum: ["move-entity"] },
      entityId: { type: "string", enum: context.entities.map((entity) => entity.id) },
      roomId: { type: "string", enum: context.rooms.map((room) => room.id) },
    },
    required: ["type", "entityId", "roomId"],
  };
}

export function createOpenAIEditCommandRequest(prompt, spec, {
  model = DEFAULT_CLOUD_EDIT_MODEL,
  maxOutputTokens = DEFAULT_CLOUD_EDIT_MAX_OUTPUT_TOKENS,
  reasoningEffort = "low",
} = {}) {
  const normalizedPrompt = normalizePrompt(prompt);
  const context = normalizeContext(spec);
  if (typeof model !== "string" || !model.trim()) throw new TypeError("model must be a non-empty string");
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 128 || maxOutputTokens > 4096) {
    throw new RangeError("maxOutputTokens must be an integer between 128 and 4096");
  }
  if (!["none", "low", "medium", "high", "xhigh", "max"].includes(reasoningEffort)) {
    throw new RangeError(`unsupported reasoningEffort: ${reasoningEffort}`);
  }

  return {
    model,
    store: false,
    instructions: INSTRUCTIONS,
    input: JSON.stringify({ request: normalizedPrompt, context }),
    max_output_tokens: maxOutputTokens,
    reasoning: { effort: reasoningEffort },
    text: {
      format: {
        type: "json_schema",
        name: "edit_command_v1_move_entity",
        strict: true,
        schema: editCommandSchema(context),
      },
    },
  };
}

function extractOutputText(body) {
  if (typeof body?.output_text === "string" && body.output_text.trim()) return body.output_text;
  if (!Array.isArray(body?.output)) return null;
  const chunks = [];
  for (const item of body.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
      if (content?.type === "refusal") return null;
    }
  }
  return chunks.length ? chunks.join("") : null;
}

function sanitizedUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const pick = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
  return {
    inputTokens: pick(usage.input_tokens),
    outputTokens: pick(usage.output_tokens),
    totalTokens: pick(usage.total_tokens),
  };
}

export function validateNaturalEditCommand(command, spec) {
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    return fail("EDIT_COMMAND_INVALID", "Provider edit command must be an object.");
  }
  if (command.type !== "move-entity") {
    return fail("EDIT_COMMAND_UNSUPPORTED", `Unsupported natural edit command: ${String(command.type)}`);
  }
  const keys = Object.keys(command).sort();
  if (keys.join(",") !== "entityId,roomId,type") {
    return fail("EDIT_COMMAND_FIELDS_INVALID", "Natural edit command contains unsupported fields.");
  }
  const entity = spec.entities.find((item) => item.id === command.entityId);
  if (!entity) return fail("ENTITY_NOT_FOUND", `Unknown entity: ${String(command.entityId)}`);
  if (!spec.rooms.some((room) => room.id === command.roomId)) {
    return fail("ROOM_NOT_FOUND", `Unknown room: ${String(command.roomId)}`);
  }
  if (entity.roomId === command.roomId) {
    return fail("EDIT_COMMAND_NO_OP", `${entity.id} is already in ${command.roomId}.`);
  }
  return { ok: true, command: clone(command) };
}

export function parseOpenAIEditCommandResponse(body, spec, { requestedModel = DEFAULT_CLOUD_EDIT_MODEL } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail("PROVIDER_RESPONSE_INVALID", "Provider response body is not an object.");
  }
  if (body.error) return fail("PROVIDER_RESPONSE_ERROR", "Provider returned an error response.");
  if (body.status && body.status !== "completed") {
    return fail("PROVIDER_RESPONSE_INCOMPLETE", `Provider response status is ${String(body.status)}.`);
  }

  const outputText = extractOutputText(body);
  if (!outputText) return fail("PROVIDER_OUTPUT_MISSING", "Provider response contained no edit command output.");

  let command;
  try {
    command = JSON.parse(outputText);
  } catch {
    return fail("PROVIDER_OUTPUT_NOT_JSON", "Provider edit command output was not valid JSON.");
  }

  const validation = validateNaturalEditCommand(command, spec);
  if (!validation.ok) return validation;

  return {
    ok: true,
    command: validation.command,
    meta: {
      provider: "openai",
      model: typeof body.model === "string" ? body.model : requestedModel,
      responseId: typeof body.id === "string" ? body.id : null,
      usage: sanitizedUsage(body.usage),
    },
  };
}

export async function generateOpenAIEditCommand(prompt, spec, {
  transport,
  model = DEFAULT_CLOUD_EDIT_MODEL,
  maxOutputTokens = DEFAULT_CLOUD_EDIT_MAX_OUTPUT_TOKENS,
  reasoningEffort = "low",
  signal,
} = {}) {
  if (typeof transport !== "function") return fail("PROVIDER_TRANSPORT_REQUIRED", "A backend provider transport is required.");

  let request;
  try {
    request = createOpenAIEditCommandRequest(prompt, spec, { model, maxOutputTokens, reasoningEffort });
  } catch (cause) {
    return fail("CLOUD_EDIT_REQUEST_INVALID", cause instanceof Error ? cause.message : String(cause));
  }

  let response;
  try {
    response = await transport(request, { signal });
  } catch (cause) {
    const aborted = cause?.name === "AbortError";
    return fail(aborted ? "PROVIDER_ABORTED" : "PROVIDER_TRANSPORT_ERROR", aborted ? "Provider request was aborted." : "Provider transport failed.");
  }

  if (!response || typeof response !== "object") return fail("PROVIDER_TRANSPORT_INVALID", "Provider transport returned an invalid response envelope.");
  if (response.status === 429) {
    return fail("PROVIDER_RATE_LIMITED", "Provider rate limit reached.", {
      retryAfter: typeof response.retryAfter === "string" ? response.retryAfter : null,
    });
  }
  if (!response.ok) {
    return fail("PROVIDER_HTTP_ERROR", `Provider HTTP request failed with status ${String(response.status)}.`, {
      status: Number.isInteger(response.status) ? response.status : null,
    });
  }

  return parseOpenAIEditCommandResponse(response.body, spec, { requestedModel: model });
}
