import { DEFAULT_CLOUD_INTENT_MODEL } from "./cloud-intent-adapter.js";

export const DEFAULT_CLOUD_EDIT_MODEL = DEFAULT_CLOUD_INTENT_MODEL;
export const DEFAULT_CLOUD_EDIT_MAX_OUTPUT_TOKENS = 768;

export const NATURAL_EDIT_COMMAND_TYPES = Object.freeze([
  "move-entity",
  "move-room",
  "resize-room",
  "add-entity",
  "remove-entity",
]);

export const NATURAL_EDIT_ENTITY_TYPES = Object.freeze([
  "enemy",
  "treasure",
  "trap",
  "recovery",
]);

const ROOM_COORDINATE_LIMIT = 256;
const ROOM_SIZE_MIN = 4;
const ROOM_SIZE_MAX = 32;

const INSTRUCTIONS = [
  "Translate one natural-language dungeon authoring edit into exactly one supported command.",
  "Supported commands are move-entity, move-room, resize-room, add-entity, and remove-entity.",
  "Return every schema field. Fields unused by the selected command must be null.",
  "Use only exact existing entityId and roomId values from context; never invent existing IDs.",
  "For add-entity set entityId to null; the server deterministically creates the new entity ID.",
  "add-entity supports only enemy, treasure, trap, or recovery.",
  "For move-room use absolute x/z coordinates derived from the current room geometry.",
  "For resize-room use absolute width/depth values between 4 and 32.",
  "Resolve semantic references such as treasure, enemy, start room, goal room, leftmost room, or largest room from the bounded context.",
  "Do not generate code, explanations, extra fields, multiple commands, room creation/removal, corridor edits, or event edits.",
  "Return only the structured object required by the response schema.",
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
  if (value.length > 4000) {
    throw new RangeError("prompt exceeds the 4000 character natural-edit limit");
  }
  return value;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function normalizeContext(spec) {
  if (
    !spec ||
    typeof spec !== "object" ||
    !Array.isArray(spec.rooms) ||
    !Array.isArray(spec.entities)
  ) {
    throw new TypeError("natural-edit context requires rooms and entities arrays");
  }

  const rooms = spec.rooms.map((room) => ({
    id: String(room.id ?? ""),
    x: finiteOrNull(room.x),
    z: finiteOrNull(room.z),
    width: finiteOrNull(room.width),
    depth: finiteOrNull(room.depth),
  }));
  const entities = spec.entities.map((entity) => ({
    id: String(entity.id ?? ""),
    type: String(entity.type ?? ""),
    roomId: String(entity.roomId ?? ""),
  }));

  if (rooms.length === 0 || rooms.some((room) => !room.id)) {
    throw new TypeError("natural-edit context contains an invalid room ID");
  }
  if (
    entities.length === 0 ||
    entities.some((entity) => !entity.id || !entity.type || !entity.roomId)
  ) {
    throw new TypeError("natural-edit context contains an invalid entity");
  }

  return { rooms, entities };
}

function nullableEnum(values) {
  return {
    type: ["string", "null"],
    enum: [...values, null],
  };
}

function editCommandSchema(context) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      type: {
        type: "string",
        enum: [...NATURAL_EDIT_COMMAND_TYPES],
      },
      entityId: nullableEnum(context.entities.map((entity) => entity.id)),
      roomId: nullableEnum(context.rooms.map((room) => room.id)),
      x: {
        type: ["number", "null"],
        minimum: -ROOM_COORDINATE_LIMIT,
        maximum: ROOM_COORDINATE_LIMIT,
      },
      z: {
        type: ["number", "null"],
        minimum: -ROOM_COORDINATE_LIMIT,
        maximum: ROOM_COORDINATE_LIMIT,
      },
      width: {
        type: ["number", "null"],
        minimum: ROOM_SIZE_MIN,
        maximum: ROOM_SIZE_MAX,
      },
      depth: {
        type: ["number", "null"],
        minimum: ROOM_SIZE_MIN,
        maximum: ROOM_SIZE_MAX,
      },
      entityType: nullableEnum(NATURAL_EDIT_ENTITY_TYPES),
    },
    required: [
      "type",
      "entityId",
      "roomId",
      "x",
      "z",
      "width",
      "depth",
      "entityType",
    ],
  };
}

export function createOpenAIEditCommandRequest(
  prompt,
  spec,
  {
    model = DEFAULT_CLOUD_EDIT_MODEL,
    maxOutputTokens = DEFAULT_CLOUD_EDIT_MAX_OUTPUT_TOKENS,
    reasoningEffort = "low",
  } = {},
) {
  const normalizedPrompt = normalizePrompt(prompt);
  const context = normalizeContext(spec);
  if (typeof model !== "string" || !model.trim()) {
    throw new TypeError("model must be a non-empty string");
  }
  if (
    !Number.isSafeInteger(maxOutputTokens) ||
    maxOutputTokens < 128 ||
    maxOutputTokens > 4096
  ) {
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
        name: "edit_command_v2_single_safe_command",
        strict: true,
        schema: editCommandSchema(context),
      },
    },
  };
}

function extractOutputText(body) {
  if (typeof body?.output_text === "string" && body.output_text.trim()) {
    return body.output_text;
  }
  if (!Array.isArray(body?.output)) return null;
  const chunks = [];
  for (const item of body.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
      if (content?.type === "refusal") return null;
    }
  }
  return chunks.length ? chunks.join("") : null;
}

function sanitizedUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const pick = (value) =>
    Number.isSafeInteger(value) && value >= 0 ? value : null;
  return {
    inputTokens: pick(usage.input_tokens),
    outputTokens: pick(usage.output_tokens),
    totalTokens: pick(usage.total_tokens),
  };
}

function exactKeys(command) {
  return Object.keys(command).sort().join(",") ===
    "depth,entityId,entityType,roomId,type,width,x,z";
}

function allNull(command, fields) {
  return fields.every((field) => command[field] == null);
}

function finiteWithin(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function roomById(spec, id) {
  return spec.rooms.find((room) => room.id === id) ?? null;
}

function entityById(spec, id) {
  return spec.entities.find((entity) => entity.id === id) ?? null;
}

function nextEntityId(spec, type) {
  for (let index = 1; index <= 999; index += 1) {
    const id = `${type}-ai-${String(index).padStart(3, "0")}`;
    if (!spec.entities.some((entity) => entity.id === id)) return id;
  }
  return null;
}

export function validateNaturalEditCommand(command, spec) {
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    return fail("EDIT_COMMAND_INVALID", "Provider edit command must be an object.");
  }
  if (!NATURAL_EDIT_COMMAND_TYPES.includes(command.type)) {
    return fail(
      "EDIT_COMMAND_UNSUPPORTED",
      `Unsupported natural edit command: ${String(command.type)}`,
    );
  }
  if (!exactKeys(command)) {
    return fail(
      "EDIT_COMMAND_FIELDS_INVALID",
      "Natural edit command contains unsupported or missing fields.",
    );
  }

  const roomIds = new Set(spec.rooms.map((room) => room.id));
  const entityIds = new Set(spec.entities.map((entity) => entity.id));

  if (command.roomId != null && !roomIds.has(command.roomId)) {
    return fail("ROOM_NOT_FOUND", `Unknown room: ${String(command.roomId)}`);
  }
  if (command.entityId != null && !entityIds.has(command.entityId)) {
    return fail(
      "ENTITY_NOT_FOUND",
      `Unknown entity: ${String(command.entityId)}`,
    );
  }

  switch (command.type) {
    case "move-entity": {
      if (
        typeof command.entityId !== "string" ||
        typeof command.roomId !== "string" ||
        !allNull(command, ["x", "z", "width", "depth", "entityType"])
      ) {
        return fail(
          "EDIT_COMMAND_FIELDS_INVALID",
          "move-entity requires only entityId and roomId.",
        );
      }
      const entity = entityById(spec, command.entityId);
      if (entity.roomId === command.roomId) {
        return fail(
          "EDIT_COMMAND_NO_OP",
          `${entity.id} is already in ${command.roomId}.`,
        );
      }
      if (entity.type === "start" || entity.type === "goal") {
        const counterpartType = entity.type === "start" ? "goal" : "start";
        const counterpart = spec.entities.find(
          (item) => item.type === counterpartType,
        );
        if (counterpart?.roomId === command.roomId) {
          return fail(
            "START_GOAL_SAME_ROOM",
            "Start and Goal must remain in different rooms.",
          );
        }
      }
      return {
        ok: true,
        command: {
          type: "move-entity",
          entityId: command.entityId,
          roomId: command.roomId,
        },
      };
    }

    case "move-room": {
      if (
        typeof command.roomId !== "string" ||
        !finiteWithin(
          command.x,
          -ROOM_COORDINATE_LIMIT,
          ROOM_COORDINATE_LIMIT,
        ) ||
        !finiteWithin(
          command.z,
          -ROOM_COORDINATE_LIMIT,
          ROOM_COORDINATE_LIMIT,
        ) ||
        !allNull(command, ["entityId", "width", "depth", "entityType"])
      ) {
        return fail(
          "EDIT_COMMAND_FIELDS_INVALID",
          "move-room requires only roomId and bounded x/z coordinates.",
        );
      }
      const room = roomById(spec, command.roomId);
      if (room?.x === command.x && room?.z === command.z) {
        return fail(
          "EDIT_COMMAND_NO_OP",
          `${command.roomId} is already at that position.`,
        );
      }
      return {
        ok: true,
        command: {
          type: "move-room",
          roomId: command.roomId,
          x: command.x,
          z: command.z,
        },
      };
    }

    case "resize-room": {
      if (
        typeof command.roomId !== "string" ||
        !finiteWithin(command.width, ROOM_SIZE_MIN, ROOM_SIZE_MAX) ||
        !finiteWithin(command.depth, ROOM_SIZE_MIN, ROOM_SIZE_MAX) ||
        !allNull(command, ["entityId", "x", "z", "entityType"])
      ) {
        return fail(
          "EDIT_COMMAND_FIELDS_INVALID",
          "resize-room requires only roomId and bounded width/depth.",
        );
      }
      const room = roomById(spec, command.roomId);
      if (room?.width === command.width && room?.depth === command.depth) {
        return fail(
          "EDIT_COMMAND_NO_OP",
          `${command.roomId} already has that size.`,
        );
      }
      return {
        ok: true,
        command: {
          type: "resize-room",
          roomId: command.roomId,
          width: command.width,
          depth: command.depth,
        },
      };
    }

    case "remove-entity": {
      if (
        typeof command.entityId !== "string" ||
        !allNull(command, [
          "roomId",
          "x",
          "z",
          "width",
          "depth",
          "entityType",
        ])
      ) {
        return fail(
          "EDIT_COMMAND_FIELDS_INVALID",
          "remove-entity requires only entityId.",
        );
      }
      const entity = entityById(spec, command.entityId);
      if (["start", "goal"].includes(entity.type)) {
        return fail(
          "PROTECTED_ENTITY_TYPE",
          "Start/Goal cannot be removed by natural edit.",
        );
      }
      return {
        ok: true,
        command: {
          type: "remove-entity",
          entityId: command.entityId,
        },
      };
    }

    case "add-entity": {
      if (
        command.entityId !== null ||
        typeof command.roomId !== "string" ||
        !NATURAL_EDIT_ENTITY_TYPES.includes(command.entityType) ||
        !allNull(command, ["x", "z", "width", "depth"])
      ) {
        return fail(
          "EDIT_COMMAND_FIELDS_INVALID",
          "add-entity requires roomId and a supported entityType; entityId must be null.",
        );
      }
      const id = nextEntityId(spec, command.entityType);
      if (!id) {
        return fail(
          "ENTITY_ID_EXHAUSTED",
          "Could not allocate a safe entity ID.",
        );
      }
      return {
        ok: true,
        command: {
          type: "add-entity",
          entity: {
            id,
            type: command.entityType,
            roomId: command.roomId,
          },
        },
      };
    }

    default:
      return fail(
        "EDIT_COMMAND_UNSUPPORTED",
        `Unsupported natural edit command: ${String(command.type)}`,
      );
  }
}

export function parseOpenAIEditCommandResponse(
  body,
  spec,
  { requestedModel = DEFAULT_CLOUD_EDIT_MODEL } = {},
) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail("PROVIDER_RESPONSE_INVALID", "Provider response body is not an object.");
  }
  if (body.error) {
    return fail("PROVIDER_RESPONSE_ERROR", "Provider returned an error response.");
  }
  if (body.status && body.status !== "completed") {
    return fail(
      "PROVIDER_RESPONSE_INCOMPLETE",
      `Provider response status is ${String(body.status)}.`,
    );
  }

  const outputText = extractOutputText(body);
  if (!outputText) {
    return fail(
      "PROVIDER_OUTPUT_MISSING",
      "Provider response contained no edit command output.",
    );
  }

  let command;
  try {
    command = JSON.parse(outputText);
  } catch {
    return fail(
      "PROVIDER_OUTPUT_NOT_JSON",
      "Provider edit command output was not valid JSON.",
    );
  }

  const validation = validateNaturalEditCommand(command, spec);
  if (!validation.ok) return validation;

  return {
    ok: true,
    command: clone(validation.command),
    meta: {
      provider: "openai",
      model: typeof body.model === "string" ? body.model : requestedModel,
      responseId: typeof body.id === "string" ? body.id : null,
      usage: sanitizedUsage(body.usage),
    },
  };
}

export async function generateOpenAIEditCommand(
  prompt,
  spec,
  {
    transport,
    model = DEFAULT_CLOUD_EDIT_MODEL,
    maxOutputTokens = DEFAULT_CLOUD_EDIT_MAX_OUTPUT_TOKENS,
    reasoningEffort = "low",
    signal,
  } = {},
) {
  if (typeof transport !== "function") {
    return fail(
      "PROVIDER_TRANSPORT_REQUIRED",
      "A backend provider transport is required.",
    );
  }

  let request;
  try {
    request = createOpenAIEditCommandRequest(prompt, spec, {
      model,
      maxOutputTokens,
      reasoningEffort,
    });
  } catch (cause) {
    return fail(
      "CLOUD_EDIT_REQUEST_INVALID",
      cause instanceof Error ? cause.message : String(cause),
    );
  }

  let response;
  try {
    response = await transport(request, { signal });
  } catch (cause) {
    const aborted = cause?.name === "AbortError";
    return fail(
      aborted ? "PROVIDER_ABORTED" : "PROVIDER_TRANSPORT_ERROR",
      aborted ? "Provider request was aborted." : "Provider transport failed.",
    );
  }

  if (!response || typeof response !== "object") {
    return fail(
      "PROVIDER_TRANSPORT_INVALID",
      "Provider transport returned an invalid response envelope.",
    );
  }
  if (response.status === 429) {
    return fail("PROVIDER_RATE_LIMITED", "Provider rate limit reached.", {
      retryAfter:
        typeof response.retryAfter === "string" ? response.retryAfter : null,
    });
  }
  if (!response.ok) {
    return fail(
      "PROVIDER_HTTP_ERROR",
      `Provider HTTP request failed with status ${String(response.status)}.`,
      {
        status: Number.isInteger(response.status) ? response.status : null,
      },
    );
  }

  return parseOpenAIEditCommandResponse(response.body, spec, {
    requestedModel: model,
  });
}
