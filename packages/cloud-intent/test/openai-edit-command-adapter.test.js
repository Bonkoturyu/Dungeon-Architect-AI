import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CLOUD_EDIT_MODEL,
  NATURAL_EDIT_COMMAND_TYPES,
  createOpenAIEditCommandRequest,
  generateOpenAIEditCommand,
  parseOpenAIEditCommandResponse,
  validateNaturalEditCommand,
} from "../src/openai-edit-command-adapter.js";

const SPEC = Object.freeze({
  rooms: [
    { id: "room-start", x: 0, z: 0, width: 8, depth: 8 },
    { id: "room-middle", x: 12, z: 0, width: 8, depth: 8 },
    { id: "room-goal", x: 24, z: 0, width: 8, depth: 8 },
  ],
  entities: [
    { id: "start-1", type: "start", roomId: "room-start" },
    { id: "enemy-1", type: "enemy", roomId: "room-middle" },
    { id: "treasure-1", type: "treasure", roomId: "room-middle" },
    { id: "goal-1", type: "goal", roomId: "room-goal" },
  ],
});

function envelope(overrides = {}) {
  return {
    type: "move-entity",
    entityId: "treasure-1",
    roomId: "room-goal",
    x: null,
    z: null,
    width: null,
    depth: null,
    entityType: null,
    ...overrides,
  };
}

function completedBody(command = envelope()) {
  return {
    id: "resp_edit_test",
    model: DEFAULT_CLOUD_EDIT_MODEL,
    status: "completed",
    output_text: JSON.stringify(command),
    usage: { input_tokens: 120, output_tokens: 20, total_tokens: 140 },
  };
}

test("natural edit V2 request is stateless, bounded, and exposes the safe command set", () => {
  const request = createOpenAIEditCommandRequest(
    "Move the treasure to the goal room",
    SPEC,
  );

  assert.equal(request.model, DEFAULT_CLOUD_EDIT_MODEL);
  assert.equal(request.store, false);
  assert.equal(request.reasoning.effort, "low");
  assert.equal("tools" in request, false);
  assert.deepEqual(
    request.text.format.schema.properties.type.enum,
    NATURAL_EDIT_COMMAND_TYPES,
  );
  assert.deepEqual(
    request.text.format.schema.properties.entityId.enum,
    ["start-1", "enemy-1", "treasure-1", "goal-1", null],
  );
  assert.deepEqual(
    request.text.format.schema.properties.roomId.enum,
    ["room-start", "room-middle", "room-goal", null],
  );
  assert.deepEqual(
    request.text.format.schema.required,
    [
      "type",
      "entityId",
      "roomId",
      "x",
      "z",
      "width",
      "depth",
      "entityType",
    ],
  );

  const parsedInput = JSON.parse(request.input);
  assert.deepEqual(parsedInput.context.rooms[1], {
    id: "room-middle",
    x: 12,
    z: 0,
    width: 8,
    depth: 8,
  });
});

test("valid move-entity output passes independent context validation", () => {
  const result = parseOpenAIEditCommandResponse(completedBody(), SPEC);
  assert.equal(result.ok, true);
  assert.deepEqual(result.command, {
    type: "move-entity",
    entityId: "treasure-1",
    roomId: "room-goal",
  });
  assert.deepEqual(result.meta.usage, {
    inputTokens: 120,
    outputTokens: 20,
    totalTokens: 140,
  });
});

test("move-room and resize-room outputs are materialized as existing EditCommands", () => {
  const move = parseOpenAIEditCommandResponse(
    completedBody(
      envelope({
        type: "move-room",
        entityId: null,
        roomId: "room-middle",
        x: 12,
        z: 12,
      }),
    ),
    SPEC,
  );
  assert.deepEqual(move.command, {
    type: "move-room",
    roomId: "room-middle",
    x: 12,
    z: 12,
  });

  const resize = parseOpenAIEditCommandResponse(
    completedBody(
      envelope({
        type: "resize-room",
        entityId: null,
        roomId: "room-middle",
        width: 10,
        depth: 12,
      }),
    ),
    SPEC,
  );
  assert.deepEqual(resize.command, {
    type: "resize-room",
    roomId: "room-middle",
    width: 10,
    depth: 12,
  });
});

test("add-entity allocates a deterministic server-side ID", () => {
  const result = parseOpenAIEditCommandResponse(
    completedBody(
      envelope({
        type: "add-entity",
        entityId: null,
        roomId: "room-middle",
        entityType: "enemy",
      }),
    ),
    {
      ...SPEC,
      entities: [
        ...SPEC.entities,
        { id: "enemy-ai-001", type: "enemy", roomId: "room-start" },
      ],
    },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.command, {
    type: "add-entity",
    entity: {
      id: "enemy-ai-002",
      type: "enemy",
      roomId: "room-middle",
    },
  });
});

test("remove-entity allows ordinary entities and rejects Start/Goal", () => {
  const ordinary = validateNaturalEditCommand(
    envelope({
      type: "remove-entity",
      entityId: "enemy-1",
      roomId: null,
    }),
    SPEC,
  );
  assert.deepEqual(ordinary, {
    ok: true,
    command: { type: "remove-entity", entityId: "enemy-1" },
  });

  const protectedResult = validateNaturalEditCommand(
    envelope({
      type: "remove-entity",
      entityId: "start-1",
      roomId: null,
    }),
    SPEC,
  );
  assert.equal(protectedResult.ok, false);
  assert.equal(protectedResult.error.code, "PROTECTED_ENTITY_TYPE");
});

test("invented IDs, no-op moves, and no-op resizes are rejected", () => {
  const invented = validateNaturalEditCommand(
    envelope({ entityId: "treasure-missing" }),
    SPEC,
  );
  assert.equal(invented.ok, false);
  assert.equal(invented.error.code, "ENTITY_NOT_FOUND");

  const noOpEntity = validateNaturalEditCommand(
    envelope({ roomId: "room-middle" }),
    SPEC,
  );
  assert.equal(noOpEntity.ok, false);
  assert.equal(noOpEntity.error.code, "EDIT_COMMAND_NO_OP");

  const noOpRoom = validateNaturalEditCommand(
    envelope({
      type: "move-room",
      entityId: null,
      roomId: "room-middle",
      x: 12,
      z: 0,
    }),
    SPEC,
  );
  assert.equal(noOpRoom.ok, false);
  assert.equal(noOpRoom.error.code, "EDIT_COMMAND_NO_OP");

  const noOpResize = validateNaturalEditCommand(
    envelope({
      type: "resize-room",
      entityId: null,
      roomId: "room-middle",
      width: 8,
      depth: 8,
    }),
    SPEC,
  );
  assert.equal(noOpResize.ok, false);
  assert.equal(noOpResize.error.code, "EDIT_COMMAND_NO_OP");
});

test("unused fields, out-of-range geometry, and unsupported commands fail closed", () => {
  const extraSemanticField = validateNaturalEditCommand(
    envelope({
      type: "move-room",
      entityId: null,
      roomId: "room-middle",
      x: 12,
      z: 12,
      entityType: "enemy",
    }),
    SPEC,
  );
  assert.equal(extraSemanticField.ok, false);
  assert.equal(extraSemanticField.error.code, "EDIT_COMMAND_FIELDS_INVALID");

  const oversized = validateNaturalEditCommand(
    envelope({
      type: "resize-room",
      entityId: null,
      roomId: "room-middle",
      width: 99,
      depth: 8,
    }),
    SPEC,
  );
  assert.equal(oversized.ok, false);
  assert.equal(oversized.error.code, "EDIT_COMMAND_FIELDS_INVALID");

  const unsupported = validateNaturalEditCommand(
    {
      ...envelope(),
      type: "remove-room",
    },
    SPEC,
  );
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.error.code, "EDIT_COMMAND_UNSUPPORTED");
});

test("429 is normalized without retrying inside the adapter", async () => {
  let calls = 0;
  const transport = async () => {
    calls += 1;
    return { ok: false, status: 429, retryAfter: "1", body: null };
  };
  const result = await generateOpenAIEditCommand(
    "move treasure",
    SPEC,
    { transport },
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PROVIDER_RATE_LIMITED");
  assert.equal(result.error.retryAfter, "1");
  assert.equal(calls, 1);
});
