import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeRoomGraphRoutes,
  generateRoomGraph,
  getAlternateRouteCapacity,
  getAlternateRouteTarget,
} from "../src/room-graph.js";
import { layoutRoomGraph } from "../src/layout.js";
import { generateDungeonSpec } from "../src/dungeon-generator.js";
import { validateDungeonSpec } from "../../core/src/dungeon-spec.js";

function serialize(value) {
  return JSON.stringify(value);
}

function alternateKeys(graph) {
  return graph.edges
    .filter((edge) => edge.kind === "alternate")
    .map((edge) => `${edge.from}|${edge.to}`);
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

test("routeChoice maps to an exact alternate-edge target", () => {
  const roomCount = 12;
  assert.equal(getAlternateRouteCapacity(roomCount), 4);

  const expected = new Map([
    [0, 0],
    [0.25, 1],
    [0.5, 2],
    [0.75, 3],
    [1, 4],
  ]);

  for (const [routeChoice, target] of expected) {
    assert.equal(getAlternateRouteTarget(roomCount, routeChoice), target);
    const graph = generateRoomGraph({ seed: 123, roomCount, routeChoice });
    assert.equal(analyzeRoomGraphRoutes(graph).alternateEdgeCount, target);
  }
});

test("increasing routeChoice preserves lower-choice alternates as a deterministic prefix", () => {
  const levels = [0, 0.25, 0.5, 0.75, 1];
  let previous = [];

  for (const routeChoice of levels) {
    const current = alternateKeys(generateRoomGraph({ seed: 8080, roomCount: 18, routeChoice }));
    assert.deepEqual(current.slice(0, previous.length), previous);
    previous = current;
  }
});

test("alternate edges create bounded rejoining route choices without duplicates", () => {
  const graph = generateRoomGraph({ seed: 2026, roomCount: 20, routeChoice: 1 });
  const metrics = analyzeRoomGraphRoutes(graph);

  assert.equal(metrics.backboneEdgeCount, 19);
  assert.equal(metrics.alternateEdgeCount, getAlternateRouteCapacity(20));
  assert.equal(metrics.cycleRank, metrics.alternateEdgeCount);
  assert.equal(metrics.allEdgesUnique, true);
  assert.equal(metrics.alternatesRejoinBackbone, true);
  assert.equal(metrics.hasMultipleStartGoalRoutes, true);
  assert.ok(metrics.alternateBackboneSpans.every((span) => span >= 2 && span <= 4));
});

test("routeChoice zero is a single backbone route and any positive target creates multiple routes", () => {
  const noChoice = generateRoomGraph({ seed: 123, roomCount: 12, routeChoice: 0 });
  const someChoice = generateRoomGraph({ seed: 123, roomCount: 12, routeChoice: 0.25 });
  const noChoiceMetrics = analyzeRoomGraphRoutes(noChoice);
  const someChoiceMetrics = analyzeRoomGraphRoutes(someChoice);

  assert.equal(noChoiceMetrics.alternateEdgeCount, 0);
  assert.equal(noChoiceMetrics.cycleRank, 0);
  assert.equal(noChoiceMetrics.hasMultipleStartGoalRoutes, false);

  assert.equal(someChoiceMetrics.alternateEdgeCount, 1);
  assert.equal(someChoiceMetrics.cycleRank, 1);
  assert.equal(someChoiceMetrics.hasMultipleStartGoalRoutes, true);
});

test("maximum routeChoice reaches exact route capacity for every supported room count", () => {
  for (let roomCount = 3; roomCount <= 64; roomCount += 1) {
    const graph = generateRoomGraph({ seed: 17, roomCount, routeChoice: 1 });
    const metrics = analyzeRoomGraphRoutes(graph);
    assert.equal(metrics.alternateEdgeCount, getAlternateRouteCapacity(roomCount), `roomCount=${roomCount}`);
    assert.equal(metrics.cycleRank, metrics.alternateEdgeCount, `roomCount=${roomCount}`);
    assert.equal(metrics.alternatesRejoinBackbone, true, `roomCount=${roomCount}`);
  }
});

test("generated DungeonSpec is byte-stable for the same inputs", () => {
  const a = generateDungeonSpec({ seed: 777, roomCount: 15, routeChoice: 0.6, id: "stable" });
  const b = generateDungeonSpec({ seed: 777, roomCount: 15, routeChoice: 0.6, id: "stable" });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
