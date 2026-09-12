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
