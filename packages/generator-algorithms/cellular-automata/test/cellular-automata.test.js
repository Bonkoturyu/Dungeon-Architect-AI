import assert from 'node:assert/strict';
import test from 'node:test';
import { generateCellularAutomataCore } from '../src/index.js';

function edgeKey(edge) {
  return edge.a < edge.b
    ? edge.a + '|' + edge.b
    : edge.b + '|' + edge.a;
}

test('Cellular Automata Core is deterministic for the same Seed', () => {
  const input = { seed: 20260929, roomCount: 16, extraConnectionRatio: 0.6 };
  assert.deepEqual(
    generateCellularAutomataCore(input),
    generateCellularAutomataCore(input),
  );
});

test('different Cellular Automata Seeds alter cave mask or Room layout', () => {
  const left = generateCellularAutomataCore({ seed: 101, roomCount: 16 });
  const right = generateCellularAutomataCore({ seed: 102, roomCount: 16 });
  assert.notEqual(
    JSON.stringify({ grid: left.grid, rooms: left.rooms, edges: left.finalEdges }),
    JSON.stringify({ grid: right.grid, rooms: right.rooms, edges: right.finalEdges }),
  );
});

test('Cellular Automata selected graph has N Rooms and N-1 tree edges', () => {
  for (const roomCount of [3, 5, 8, 12, 20, 32, 64]) {
    const generated = generateCellularAutomataCore({
      seed: 7000 + roomCount,
      roomCount,
      extraConnectionRatio: 0,
    });
    assert.equal(generated.rooms.length, roomCount);
    assert.equal(generated.treeEdges.length, roomCount - 1);
    assert.equal(generated.finalEdges.length, roomCount - 1);
    assert.equal(generated.diagnostics.cycleRank, 0);
  }
});

test('Cellular Automata final edges stay cardinally local', () => {
  const generated = generateCellularAutomataCore({
    seed: 424242,
    roomCount: 28,
    extraConnectionRatio: 1,
  });
  for (const edge of generated.finalEdges) {
    const a = generated.rooms[edge.a];
    const b = generated.rooms[edge.b];
    assert.equal(
      Math.abs(a.cellX - b.cellX) + Math.abs(a.cellZ - b.cellZ),
      1,
    );
  }
});

test('Cellular Automata Rooms do not overlap at default spacing', () => {
  const generated = generateCellularAutomataCore({
    seed: 3333,
    roomCount: 40,
    extraConnectionRatio: 0.75,
  });
  for (let left = 0; left < generated.rooms.length; left += 1) {
    for (let right = left + 1; right < generated.rooms.length; right += 1) {
      const a = generated.rooms[left];
      const b = generated.rooms[right];
      const overlapX =
        Math.min(a.x + a.width / 2, b.x + b.width / 2) -
        Math.max(a.x - a.width / 2, b.x - b.width / 2);
      const overlapZ =
        Math.min(a.z + a.depth / 2, b.z + b.depth / 2) -
        Math.max(a.z - a.depth / 2, b.z - b.depth / 2);
      assert.equal(overlapX > 1e-9 && overlapZ > 1e-9, false);
    }
  }
});

test('routeChoice adds deterministic loops only from selected-cell adjacency', () => {
  const zero = generateCellularAutomataCore({
    seed: 98765, roomCount: 24, extraConnectionRatio: 0,
  });
  const half = generateCellularAutomataCore({
    seed: 98765, roomCount: 24, extraConnectionRatio: 0.5,
  });
  const full = generateCellularAutomataCore({
    seed: 98765, roomCount: 24, extraConnectionRatio: 1,
  });
  assert.equal(zero.extraEdges.length, 0);
  assert.equal(full.extraEdges.length, full.diagnostics.extraCandidateCount);
  assert.ok(half.extraEdges.length <= full.extraEdges.length);
  const keys = full.finalEdges.map(edgeKey);
  assert.equal(new Set(keys).size, keys.length);
});

test('high-wall Cellular Automata input repairs to requested connected Room count', () => {
  const generated = generateCellularAutomataCore({
    seed: 12345,
    roomCount: 20,
    initialWallProbability: 0.88,
    smoothingIterations: 6,
  });
  assert.equal(generated.rooms.length, 20);
  assert.equal(generated.treeEdges.length, 19);
  assert.ok(generated.diagnostics.repairCarveCount >= 0);
  assert.ok(generated.diagnostics.usableComponentSize >= 20);
});

test('Cellular Automata maps tree diameter endpoints to first/last Room IDs', () => {
  const generated = generateCellularAutomataCore({
    seed: 8888, roomCount: 18, extraConnectionRatio: 0.25,
  });
  assert.equal(generated.rooms[0].id, 'room-001');
  assert.equal(generated.rooms.at(-1).id, 'room-018');
  assert.ok(generated.diagnostics.treeDiameterLength >= 1);
});

test('smoothing parameters remain deterministic and observable', () => {
  const raw = generateCellularAutomataCore({
    seed: 24680, roomCount: 16, smoothingIterations: 0,
  });
  const smooth = generateCellularAutomataCore({
    seed: 24680, roomCount: 16, smoothingIterations: 5,
  });
  assert.notEqual(
    JSON.stringify(raw.grid.openCells),
    JSON.stringify(smooth.grid.openCells),
  );
});

test('invalid Cellular Automata options fail closed', () => {
  assert.throws(() => generateCellularAutomataCore({ seed: -1 }), /seed/);
  assert.throws(() => generateCellularAutomataCore({ seed: 1, roomCount: 2 }), /roomCount/);
  assert.throws(() => generateCellularAutomataCore({
    seed: 1, roomCount: 8, initialWallProbability: 0.95,
  }), /initialWallProbability/);
  assert.throws(() => generateCellularAutomataCore({
    seed: 1, roomCount: 8, smoothingIterations: 9,
  }), /smoothingIterations/);
  assert.throws(() => generateCellularAutomataCore({
    seed: 1, roomCount: 8, wallThreshold: 9,
  }), /wallThreshold/);
});
