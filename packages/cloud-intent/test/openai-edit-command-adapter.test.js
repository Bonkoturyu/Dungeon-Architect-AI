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
  corridors: [
    {
      id: "corridor-1",
      fromRoomId: "room-start",
      toRoomId: "room-middle",
      width: 3,
      kind: "backbone",
    },
    {
      id: "corridor-2",
      fromRoomId: "room-middle",
      toRoomId: "room-goal",
      width: 3,
      kind: "backbone",
    },
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
    corridorId: null,
    fromRoomId: null,
    toRoomId: null,
    fromSide: null,
    toSide: null,
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

test("natural edit V3 request is stateless, bounded, and exposes the structural command set", () => {
  const request = createOpenAIEditCommandRequest(
    "Move the treasure to the goal room",
    SPEC,
  );

  assert.equal(request.model, DEFAULT_CLOUD_EDIT_MODEL);
  assert.equal(request.store, false);
  assert.equal(request.reasoning.effort, "low");
  assert.equal("tools" in request, false);
  assert.equal(
    request.text.format.name,
    "edit_command_v3_single_safe_command",
  );
  assert.deepEqual(
    request.text.format.schema.properties.type.enum,
    NATURAL_EDIT_COMMAND_TYPES,
  );
  assert.deepEqual(NATURAL_EDIT_COMMAND_TYPES, [
    "move-entity",
    "move-room",
    "resize-room",
    "add-entity",
    "remove-entity",
    "add-room",
    "remove-room",
    "add-corridor",
    "remove-corridor",
    "reconnect-corridor",
    "set-corridor-doors",
  ]);
  assert.deepEqual(
    request.text.format.schema.properties.entityId.enum,
    ["start-1", "enemy-1", "treasure-1", "goal-1", null],
  );
  assert.deepEqual(
    request.text.format.schema.properties.roomId.enum,
    ["room-start", "room-middle", "room-goal", null],
  );
  assert.deepEqual(
    request.text.format.schema.properties.corridorId.enum,
    ["corridor-1", "corridor-2", null],
  );
  assert.deepEqual(
    request.text.format.schema.properties.fromSide.enum,
    ["north", "east", "south", "west", null],
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
      "corridorId",
      "fromRoomId",
      "toRoomId",
      "fromSide",
      "toSide",
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
  assert.deepEqual(parsedInput.context.corridors[0], {
    id: "corridor-1",
    fromRoomId: "room-start",
    toRoomId: "room-middle",
    width: 3,
    kind: "backbone",
    fromSide: null,
    toSide: null,
  });
  assert.deepEqual(Object.keys(parsedInput.context).sort(), [
    "corridors",
    "entities",
    "rooms",
  ]);
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

test("move-room and resize-room outputs remain existing EditCommands", () => {
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
  assert.equal(move.ok, true);
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
  assert.equal(resize.ok, true);
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

test("add-room allocates a deterministic server-side ID and rejects overlap", () => {
  const valid = parseOpenAIEditCommandResponse(
    completedBody(
      envelope({
        type: "add-room",
        entityId: null,
        roomId: null,
        x: 12,
        z: 12,
        width: 8,
        depth: 8,
      }),
    ),
    {
      ...SPEC,
      rooms: [
        ...SPEC.rooms,
        { id: "room-ai-001", x: -12, z: 0, width: 8, depth: 8 },
      ],
    },
  );
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.command, {
    type: "add-room",
    room: {
      id: "room-ai-002",
      x: 12,
      z: 12,
      width: 8,
      depth: 8,
    },
  });

  const overlap = validateNaturalEditCommand(
    envelope({
      type: "add-room",
      entityId: null,
      roomId: null,
      x: 12,
      z: 0,
      width: 8,
      depth: 8,
    }),
    SPEC,
  );
  assert.equal(overlap.ok, false);
  assert.equal(overlap.error.code, "ROOM_OVERLAP");
});

test("remove-room accepts ordinary Rooms and rejects Start/Goal Rooms", () => {
  const sideSpec = {
    ...SPEC,
    rooms: [
      ...SPEC.rooms,
      { id: "room-side", x: 12, z: 12, width: 8, depth: 8 },
    ],
  };

  const ordinary = validateNaturalEditCommand(
    envelope({
      type: "remove-room",
      entityId: null,
      roomId: "room-side",
    }),
    sideSpec,
  );
  assert.deepEqual(ordinary, {
    ok: true,
    command: { type: "remove-room", roomId: "room-side" },
  });

  const protectedResult = validateNaturalEditCommand(
    envelope({
      type: "remove-room",
      entityId: null,
      roomId: "room-start",
    }),
    SPEC,
  );
  assert.equal(protectedResult.ok, false);
  assert.equal(protectedResult.error.code, "PROTECTED_ROOM");
});

test("add-corridor allocates a deterministic server-side ID and sides", () => {
  const spec = {
    ...SPEC,
    rooms: [
      ...SPEC.rooms,
      { id: "room-side", x: 0, z: 12, width: 8, depth: 8 },
    ],
    corridors: [
      ...SPEC.corridors,
      {
        id: "corridor-ai-001",
        fromRoomId: "room-start",
        toRoomId: "room-side",
        width: 3,
        kind: "ai",
      },
    ],
  };
  const result = parseOpenAIEditCommandResponse(
    completedBody(
      envelope({
        type: "add-corridor",
        entityId: null,
        roomId: null,
        corridorId: null,
        fromRoomId: "room-start",
        toRoomId: "room-goal",
        fromSide: "east",
        toSide: "west",
      }),
    ),
    spec,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.command, {
    type: "add-corridor",
    corridor: {
      id: "corridor-ai-002",
      fromRoomId: "room-start",
      toRoomId: "room-goal",
      width: 3,
      kind: "ai",
      fromSide: "east",
      toSide: "west",
    },
  });
});

test("duplicate Corridor endpoints are rejected independent of direction", () => {
  const duplicate = validateNaturalEditCommand(
    envelope({
      type: "add-corridor",
      entityId: null,
      roomId: null,
      corridorId: null,
      fromRoomId: "room-middle",
      toRoomId: "room-start",
    }),
    SPEC,
  );
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error.code, "CORRIDOR_DUPLICATE_ENDPOINTS");
});

test("remove, reconnect, and doorway-side Corridor commands materialize safely", () => {
  const remove = validateNaturalEditCommand(
    envelope({
      type: "remove-corridor",
      entityId: null,
      roomId: null,
      corridorId: "corridor-2",
    }),
    SPEC,
  );
  assert.deepEqual(remove, {
    ok: true,
    command: { type: "remove-corridor", corridorId: "corridor-2" },
  });

  const reconnect = validateNaturalEditCommand(
    envelope({
      type: "reconnect-corridor",
      entityId: null,
      roomId: null,
      corridorId: "corridor-2",
      fromRoomId: "room-start",
      toRoomId: "room-goal",
      fromSide: "east",
      toSide: "west",
    }),
    SPEC,
  );
  assert.deepEqual(reconnect, {
    ok: true,
    command: {
      type: "reconnect-corridor",
      corridorId: "corridor-2",
      fromRoomId: "room-start",
      toRoomId: "room-goal",
      fromSide: "east",
      toSide: "west",
    },
  });

  const sides = validateNaturalEditCommand(
    envelope({
      type: "set-corridor-doors",
      entityId: null,
      roomId: null,
      corridorId: "corridor-1",
      fromSide: "east",
      toSide: "west",
    }),
    SPEC,
  );
  assert.deepEqual(sides, {
    ok: true,
    command: {
      type: "set-corridor-doors",
      corridorId: "corridor-1",
      fromSide: "east",
      toSide: "west",
    },
  });
});

test("Corridor no-op, duplicate reconnect, and self-loop requests fail closed", () => {
  const sideSpec = {
    ...SPEC,
    corridors: SPEC.corridors.map((corridor) =>
      corridor.id === "corridor-1"
        ? { ...corridor, fromSide: "east", toSide: "west" }
        : corridor),
  };

  const noOpSides = validateNaturalEditCommand(
    envelope({
      type: "set-corridor-doors",
      entityId: null,
      roomId: null,
      corridorId: "corridor-1",
      fromSide: "east",
      toSide: "west",
    }),
    sideSpec,
  );
  assert.equal(noOpSides.ok, false);
  assert.equal(noOpSides.error.code, "EDIT_COMMAND_NO_OP");

  const duplicateReconnect = validateNaturalEditCommand(
    envelope({
      type: "reconnect-corridor",
      entityId: null,
      roomId: null,
      corridorId: "corridor-2",
      fromRoomId: "room-start",
      toRoomId: "room-middle",
    }),
    SPEC,
  );
  assert.equal(duplicateReconnect.ok, false);
  assert.equal(
    duplicateReconnect.error.code,
    "CORRIDOR_DUPLICATE_ENDPOINTS",
  );

  const selfLoop = validateNaturalEditCommand(
    envelope({
      type: "add-corridor",
      entityId: null,
      roomId: null,
      corridorId: null,
      fromRoomId: "room-middle",
      toRoomId: "room-middle",
    }),
    SPEC,
  );
  assert.equal(selfLoop.ok, false);
  assert.equal(selfLoop.error.code, "EDIT_COMMAND_FIELDS_INVALID");
});

test("invented IDs, no-op moves, and no-op resizes are rejected", () => {
  const invented = validateNaturalEditCommand(
    envelope({ entityId: "treasure-missing" }),
    SPEC,
  );
  assert.equal(invented.ok, false);
  assert.equal(invented.error.code, "ENTITY_NOT_FOUND");

  const inventedCorridor = validateNaturalEditCommand(
    envelope({
      type: "remove-corridor",
      entityId: null,
      roomId: null,
      corridorId: "corridor-missing",
    }),
    SPEC,
  );
  assert.equal(inventedCorridor.ok, false);
  assert.equal(inventedCorridor.error.code, "CORRIDOR_NOT_FOUND");

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
  assert.equal(
    extraSemanticField.error.code,
    "EDIT_COMMAND_FIELDS_INVALID",
  );

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
      type: "edit-event",
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
