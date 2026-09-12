import test from "node:test";
import assert from "node:assert/strict";
import { generateRoomGraph } from "../src/room-graph.js";
import { layoutRoomGraph } from "../src/layout.js";
import { generateDungeonSpec } from "../src/dungeon-generator.js";
import { validateDungeonSpec } from "../../core/src/dungeon-spec.js";

function serialize(value) {
  return JSON.stringify(value);
}

test("room graph is deterministic for the same seed and options", () => {
  const a = generateRoomGraph({ seed: 42, roomCount: 10, routeChoice: 0.75 });
  const b = generateRoomGraph({ seed: 42, roomCount: 10, routeChoice: 0.75 });
  assert.equal(serialize(a), serialize(b));
});

test("different seeds can change alternate route selection", () => {
  const a = generateRoomGraph({ seed: 1, roomCount: 12, routeChoice: 1 });
  const b = generateRoomGraph({ seed: 2, roomCount: 12, routeChoice: 1 });
  assert.notEqual(serialize(a.edges), serialize(b.edges));
});

test("backbone always connects every sequential room", () => {
  const graph = generateRoomGraph({ seed: 99, roomCount: 7, routeChoice: 0 });
  assert.equal(graph.edges.length, 6);
  for (let i = 0; i < 6; i += 1) {
    assert.equal(graph.edges[i].from, graph.rooms[i].id);
    assert.equal(graph.edges[i].to, graph.rooms[i + 1].id);
  }
});

test("layout produces non-overlapping room coordinates for default settings", () => {
  const graph = generateRoomGraph({ seed: 5, roomCount: 16, routeChoice: 0.5 });
  const layout = layoutRoomGraph(graph);
  const positions = new Set(layout.rooms.map((room) => `${room.x},${room.z}`));
  assert.equal(positions.size, layout.rooms.length);
});

test("generated DungeonSpec passes current structural validation", () => {
  const spec = generateDungeonSpec({ seed: 12092026, roomCount: 12, routeChoice: 0.8 });
  const result = validateDungeonSpec(spec);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("routeChoice adds alternate edges without removing the guaranteed backbone", () => {
  const noChoice = generateRoomGraph({ seed: 123, roomCount: 12, routeChoice: 0 });
  const highChoice = generateRoomGraph({ seed: 123, roomCount: 12, routeChoice: 1 });
  assert.equal(noChoice.edges.length, 11);
  assert.ok(highChoice.edges.length > noChoice.edges.length);
  assert.ok(highChoice.edges.some((edge) => edge.kind === "alternate"));
});

test("generated DungeonSpec is byte-stable for the same inputs", () => {
  const a = generateDungeonSpec({ seed: 777, roomCount: 15, routeChoice: 0.6, id: "stable" });
  const b = generateDungeonSpec({ seed: 777, roomCount: 15, routeChoice: 0.6, id: "stable" });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
