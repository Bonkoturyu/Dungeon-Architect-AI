import assert from 'node:assert/strict';
import test from 'node:test';
import { generateRandomWalkCore } from '../src/index.js';

function edgeKey(edge) {
  return edge.a < edge.b
    ? edge.a + '|' + edge.b
    : edge.b + '|' + edge.a;
}

test('Random Walk Core is deterministic for the same Seed', () => {
  const input = {
    seed: 20260929,
    roomCount: 16,
    extraConnectionRatio: 0.6,
  };
  assert.deepEqual(
    generateRandomWalkCore(input),
    generateRandomWalkCore(input),
  );
});

test('different Random Walk Seeds alter cells, Rooms, or edges', () => {
  const left = generateRandomWalkCore({
    seed: 1001,
    roomCount: 16,
    extraConnectionRatio: 0.5,
  });
  const right = generateRandomWalkCore({
    seed: 1002,
    roomCount: 16,
    extraConnectionRatio: 0.5,
  });
  assert.notEqual(
    JSON.stringify({ rooms: left.rooms, edges: left.finalEdges }),
    JSON.stringify({ rooms: right.rooms, edges: right.finalEdges }),
  );
});

test('Random Walk discovery tree has exactly N-1 edges', () => {
  for (const roomCount of [3, 5, 8, 12, 20, 32, 64]) {
    const generated = generateRandomWalkCore({
      seed: 7000 + roomCount,
      roomCount,
      extraConnectionRatio: 0,
    });
    assert.equal(generated.rooms.length, roomCount);
    assert.equal(generated.treeEdges.length, roomCount - 1);
    assert.equal(generated.finalEdges.length, roomCount - 1);
    assert.equal(generated.diagnostics.cycleRank, 0);
    assert.ok(generated.diagnostics.walkStepCount >= roomCount - 1);
  }
});

test('Random Walk final edges stay cardinally local', () => {
  const generated = generateRandomWalkCore({
    seed: 424242,
    roomCount: 28,
    extraConnectionRatio: 1,
  });
  for (const edge of generated.finalEdges) {
    const a = generated.rooms[edge.a];
    const b = generated.rooms[edge.b];
    assert.equal(
      Math.abs(a.cellX - b.cellX) +
        Math.abs(a.cellZ - b.cellZ),
      1,
    );
  }
});

test('Random Walk Rooms do not overlap at default spacing', () => {
  const generated = generateRandomWalkCore({
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

test('routeChoice adds only unused visited-cell adjacency loops', () => {
  const zero = generateRandomWalkCore({
    seed: 98765,
    roomCount: 24,
    extraConnectionRatio: 0,
  });
  const half = generateRandomWalkCore({
    seed: 98765,
    roomCount: 24,
    extraConnectionRatio: 0.5,
  });
  const full = generateRandomWalkCore({
    seed: 98765,
    roomCount: 24,
    extraConnectionRatio: 1,
  });
  assert.equal(zero.extraEdges.length, 0);
  assert.equal(full.extraEdges.length, full.diagnostics.extraCandidateCount);
  assert.ok(half.extraEdges.length <= full.extraEdges.length);
  const keys = full.finalEdges.map(edgeKey);
  assert.equal(new Set(keys).size, keys.length);
});

test('Random Walk maps discovery-tree diameter endpoints to first/last Room IDs', () => {
  const generated = generateRandomWalkCore({
    seed: 8888,
    roomCount: 18,
    extraConnectionRatio: 0.25,
  });
  assert.equal(generated.rooms[0].id, 'room-001');
  assert.equal(generated.rooms.at(-1).id, 'room-018');
  assert.ok(generated.diagnostics.treeDiameterLength >= 1);
});

test('direction persistence changes deterministic walk shape', () => {
  const low = generateRandomWalkCore({
    seed: 24680,
    roomCount: 20,
    directionPersistence: 0,
  });
  const high = generateRandomWalkCore({
    seed: 24680,
    roomCount: 20,
    directionPersistence: 0.9,
  });
  assert.notEqual(
    JSON.stringify(low.cells),
    JSON.stringify(high.cells),
  );
});

test('Random Walk custom Room size and spacing remain bounded', () => {
  const generated = generateRandomWalkCore({
    seed: 1234,
    roomCount: 10,
    roomSizeMin: 8,
    roomSizeMax: 8,
    cellSpacing: 16,
  });
  assert.ok(generated.rooms.every((room) => room.width === 8 && room.depth === 8));
});

test('invalid Random Walk options fail closed', () => {
  assert.throws(() => generateRandomWalkCore({ seed: -1 }), /seed/);
  assert.throws(() => generateRandomWalkCore({ seed: 1, roomCount: 2 }), /roomCount/);
  assert.throws(() => generateRandomWalkCore({
    seed: 1, roomCount: 8, extraConnectionRatio: 1.1,
  }), /extraConnectionRatio/);
  assert.throws(() => generateRandomWalkCore({
    seed: 1, roomCount: 8, directionPersistence: 1,
  }), /directionPersistence/);
  assert.throws(() => generateRandomWalkCore({
    seed: 1, roomCount: 8, escapeAfter: 4,
  }), /escapeAfter/);
});
