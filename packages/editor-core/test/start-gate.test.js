import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateStartGate } from "../src/start-gate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, "../../../spec/dungeon/fixtures/minimal-valid-v1.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("valid DungeonSpec allows START with zero Critical errors", () => {
  const gate = evaluateStartGate(fixture);
  assert.equal(gate.allowed, true);
  assert.equal(gate.criticalCount, 0);
  assert.deepEqual(gate.errors, []);
});

test("unreachable goal blocks START and surfaces Critical validation evidence", () => {
  const invalid = clone(fixture);
  invalid.corridors = [];
  const gate = evaluateStartGate(invalid);
  assert.equal(gate.allowed, false);
  assert.ok(gate.criticalCount > 0);
  assert.ok(gate.errors.some((entry) => entry.code === "GOAL_UNREACHABLE"));
  assert.ok(gate.errors.every((entry) => entry.severity === "critical"));
});

test("invalid entity room reference blocks START", () => {
  const invalid = clone(fixture);
  invalid.entities.find((entity) => entity.id === "treasure-1").roomId = "missing-room";
  const gate = evaluateStartGate(invalid);
  assert.equal(gate.allowed, false);
  assert.ok(gate.errors.some((entry) => entry.code === "ROOM_REFERENCE_MISSING"));
});
