import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CLOUD_EDIT_MODEL,
  createOpenAIEditCommandRequest,
  generateOpenAIEditCommand,
  parseOpenAIEditCommandResponse,
  validateNaturalEditCommand,
} from "../src/openai-edit-command-adapter.js";

const SPEC = Object.freeze({
  rooms: [
    { id: "room-start" },
    { id: "room-middle" },
    { id: "room-goal" },
  ],
  entities: [
    { id: "start-1", type: "start", roomId: "room-start" },
    { id: "treasure-1", type: "treasure", roomId: "room-middle" },
    { id: "goal-1", type: "goal", roomId: "room-goal" },
  ],
});

function completedBody(command = { type: "move-entity", entityId: "treasure-1", roomId: "room-goal" }) {
  return {
    id: "resp_edit_test",
    model: DEFAULT_CLOUD_EDIT_MODEL,
    status: "completed",
    output_text: JSON.stringify(command),
    usage: { input_tokens: 120, output_tokens: 20, total_tokens: 140 },
  };
}

test("natural edit request is stateless and constrains IDs to current context", () => {
  const request = createOpenAIEditCommandRequest("Move the treasure to the goal room", SPEC);
  assert.equal(request.model, DEFAULT_CLOUD_EDIT_MODEL);
  assert.equal(request.store, false);
  assert.equal(request.reasoning.effort, "low");
  assert.equal("tools" in request, false);
  assert.deepEqual(request.text.format.schema.properties.type.enum, ["move-entity"]);
  assert.deepEqual(request.text.format.schema.properties.entityId.enum, ["start-1", "treasure-1", "goal-1"]);
  assert.deepEqual(request.text.format.schema.properties.roomId.enum, ["room-start", "room-middle", "room-goal"]);
});

test("valid move-entity output passes independent context validation", () => {
  const result = parseOpenAIEditCommandResponse(completedBody(), SPEC);
  assert.equal(result.ok, true);
  assert.deepEqual(result.command, { type: "move-entity", entityId: "treasure-1", roomId: "room-goal" });
  assert.deepEqual(result.meta.usage, { inputTokens: 120, outputTokens: 20, totalTokens: 140 });
});

test("invented IDs and no-op moves are rejected", () => {
  const invented = validateNaturalEditCommand({ type: "move-entity", entityId: "treasure-missing", roomId: "room-goal" }, SPEC);
  assert.equal(invented.ok, false);
  assert.equal(invented.error.code, "ENTITY_NOT_FOUND");

  const noOp = validateNaturalEditCommand({ type: "move-entity", entityId: "treasure-1", roomId: "room-middle" }, SPEC);
  assert.equal(noOp.ok, false);
  assert.equal(noOp.error.code, "EDIT_COMMAND_NO_OP");
});

test("extra fields and unsupported command types are rejected", () => {
  const extra = validateNaturalEditCommand({ type: "move-entity", entityId: "treasure-1", roomId: "room-goal", note: "x" }, SPEC);
  assert.equal(extra.ok, false);
  assert.equal(extra.error.code, "EDIT_COMMAND_FIELDS_INVALID");

  const unsupported = validateNaturalEditCommand({ type: "remove-entity", entityId: "treasure-1", roomId: "room-goal" }, SPEC);
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.error.code, "EDIT_COMMAND_UNSUPPORTED");
});

test("429 is normalized without retrying inside the adapter", async () => {
  let calls = 0;
  const transport = async () => {
    calls += 1;
    return { ok: false, status: 429, retryAfter: "1", body: null };
  };
  const result = await generateOpenAIEditCommand("move treasure", SPEC, { transport });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PROVIDER_RATE_LIMITED");
  assert.equal(result.error.retryAfter, "1");
  assert.equal(calls, 1);
});
