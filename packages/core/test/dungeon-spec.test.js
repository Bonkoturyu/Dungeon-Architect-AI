import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseDungeonSpec, validateDungeonSpec } from "../src/dungeon-spec.js";

const fixtureUrl = new URL("../../../spec/dungeon/fixtures/minimal-valid-v1.json", import.meta.url);

async function loadFixture() {
  return JSON.parse(await readFile(fixtureUrl, "utf8"));
}

test("valid minimal DungeonSpec passes", async () => {
  const spec = await loadFixture();
  const result = validateDungeonSpec(spec);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("string input parses and validates", async () => {
  const spec = await loadFixture();
  const result = parseDungeonSpec(JSON.stringify(spec));
  assert.equal(result.ok, true);
  assert.equal(result.spec.id, spec.id);
});

test("broken room reference is rejected", async () => {
  const spec = await loadFixture();
  spec.corridors[0].toRoomId = "missing-room";
  const result = validateDungeonSpec(spec);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "ROOM_REFERENCE_MISSING"));
});

test("duplicate stable IDs are rejected", async () => {
  const spec = await loadFixture();
  spec.entities[1].id = spec.entities[0].id;
  const result = validateDungeonSpec(spec);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "DUPLICATE_ID"));
});

test("exactly one Start and Goal are required", async () => {
  const spec = await loadFixture();
  spec.entities = spec.entities.filter((entity) => entity.type !== "goal");
  const result = validateDungeonSpec(spec);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "GOAL_COUNT_INVALID"));
});

test("malformed JSON is rejected without throwing", () => {
  const result = parseDungeonSpec("{not-json");
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "JSON_PARSE_ERROR");
});

test("unreachable Goal is rejected", async () => {
  const spec = await loadFixture();
  spec.corridors = [spec.corridors[0]];
  const result = validateDungeonSpec(spec);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "GOAL_UNREACHABLE"));
});


test("Start and Goal cannot share a room", async () => {
  const spec = await loadFixture();
  const goal = spec.entities.find((entity) => entity.type === "goal");
  const start = spec.entities.find((entity) => entity.type === "start");
  goal.roomId = start.roomId;
  const result = validateDungeonSpec(spec);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "START_GOAL_SAME_ROOM"));
});


test("overlapping room interiors are rejected while touching edges remain valid", async () => {
  const overlapping = await loadFixture();
  overlapping.rooms.find((room) => room.id === "room-middle").width = 50;
  const overlapResult = validateDungeonSpec(overlapping);
  assert.equal(overlapResult.valid, false);
  assert.ok(overlapResult.errors.some((error) => error.code === "ROOM_OVERLAP"));

  const touching = await loadFixture();
  touching.rooms.find((room) => room.id === "room-middle").x = 8;
  const touchingResult = validateDungeonSpec(touching);
  assert.equal(touchingResult.valid, true);
  assert.ok(!touchingResult.errors.some((error) => error.code === "ROOM_OVERLAP"));
});


test("corridor doorway side preferences accept cardinal sides and reject invalid values", async () => {
  const valid = await loadFixture();
  valid.corridors[0].fromSide = "east";
  valid.corridors[0].toSide = "west";
  const validResult = validateDungeonSpec(valid);
  assert.equal(validResult.valid, true);

  const invalid = await loadFixture();
  invalid.corridors[0].fromSide = "up-left";
  const invalidResult = validateDungeonSpec(invalid);
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.errors.some((error) => error.code === "CORRIDOR_SIDE_INVALID"));
});


test("cyclic and runtime-only values are rejected before START snapshotting", async () => {
  const cyclic = await loadFixture();
  cyclic.rooms[0].runtime = {};
  cyclic.rooms[0].runtime.self = cyclic.rooms[0].runtime;
  const cyclicResult = validateDungeonSpec(cyclic);
  assert.equal(cyclicResult.valid, false);
  assert.ok(cyclicResult.errors.some((error) => error.code === "JSON_CYCLE"));

  const callable = await loadFixture();
  callable.rooms[0].runtimeCallback = () => {};
  const callableResult = validateDungeonSpec(callable);
  assert.equal(callableResult.valid, false);
  assert.ok(callableResult.errors.some((error) => error.code === "JSON_VALUE_UNSUPPORTED"));

  const runtimeObject = await loadFixture();
  runtimeObject.rooms[0].runtimeObject = new Date(0);
  const runtimeObjectResult = validateDungeonSpec(runtimeObject);
  assert.equal(runtimeObjectResult.valid, false);
  assert.ok(runtimeObjectResult.errors.some((error) => error.code === "JSON_OBJECT_UNSUPPORTED"));
});
