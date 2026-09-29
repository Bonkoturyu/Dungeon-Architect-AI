import assert from 'node:assert/strict';
import test from 'node:test';
import { generateMazeCarvingCore } from '../src/index.js';

function edgeKey(edge) {
  return edge.a < edge.b
    ? edge.a + '|' + edge.b
    : edge.b + '|' + edge.a;
}

test('Maze Carving Core is deterministic for the same Seed', () => {
  const input = { seed: 20260929, roomCount: 16, extraConnectionRatio: 0.6 };
  assert.deepEqual(
    generateMazeCarvingCore(input),
    generateMazeCarvingCore(input),
  );
});

test('different Maze Carving Seeds alter wall carving or Room sizes', () => {
  const left = generateMazeCarvingCore({ seed: 101, roomCount: 16 });
  const right = generateMazeCarvingCore({ seed: 102, roomCount: 16 });
  assert.notEqual(
    JSON.stringify({ rooms: left.rooms, edges: left.finalEdges }),
    JSON.stringify({ rooms: right.rooms, edges: right.finalEdges }),
  );
});

test('Maze Carving compact lattice contains exactly requested Rooms', () => {
  for (const roomCount of [3, 5, 8, 12, 20, 32, 64]) {
    const generated = generateMazeCarvingCore({
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

test('Maze Carving tree edges are chosen only from compact lattice walls', () => {
  const generated = generateMazeCarvingCore({
    seed: 424242,
    roomCount: 28,
    extraConnectionRatio: 1,
  });
  for (const edge of generated.finalEdges) {
    const a = generated.rooms[edge.a];
    const b = generated.rooms[edge.b];
    assert.ok(
      Math.abs(
        Math.abs(a.cellX - b.cellX) +
          Math.abs(a.cellZ - b.cellZ) -
          1,
      ) < 1e-9,
    );
  }
});

test('Maze Carving Rooms do not overlap at default spacing', () => {
  const generated = generateMazeCarvingCore({
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

test('routeChoice restores a deterministic subset of remaining carved walls', () => {
  const zero = generateMazeCarvingCore({
    seed: 98765, roomCount: 24, extraConnectionRatio: 0,
  });
  const half = generateMazeCarvingCore({
    seed: 98765, roomCount: 24, extraConnectionRatio: 0.5,
  });
  const full = generateMazeCarvingCore({
    seed: 98765, roomCount: 24, extraConnectionRatio: 1,
  });
  assert.equal(zero.extraEdges.length, 0);
  assert.equal(full.extraEdges.length, full.diagnostics.extraCandidateCount);
  assert.ok(half.extraEdges.length <= full.extraEdges.length);
  const keys = full.finalEdges.map(edgeKey);
  assert.equal(new Set(keys).size, keys.length);
});

test('Maze Carving diagnostics expose candidate and remaining walls', () => {
  const generated = generateMazeCarvingCore({
    seed: 12345, roomCount: 20, extraConnectionRatio: 0.4,
  });
  assert.ok(generated.diagnostics.candidateWallCount >= 19);
  assert.equal(generated.diagnostics.carvedWallCount, 19);
  assert.equal(
    generated.diagnostics.remainingWallCount,
    generated.diagnostics.candidateWallCount - 19,
  );
});

test('Maze Carving maps tree diameter endpoints to first/last Room IDs', () => {
  const generated = generateMazeCarvingCore({
    seed: 8888, roomCount: 18, extraConnectionRatio: 0.25,
  });
  assert.equal(generated.rooms[0].id, 'room-001');
  assert.equal(generated.rooms.at(-1).id, 'room-018');
  assert.ok(generated.diagnostics.treeDiameterLength >= 1);
});

test('Maze Carving compact footprint depends only on Room count', () => {
  const left = generateMazeCarvingCore({ seed: 1, roomCount: 17 });
  const right = generateMazeCarvingCore({ seed: 2, roomCount: 17 });
  assert.deepEqual(
    left.cells.map(({ x, z }) => ({ x, z })).sort((a, b) => a.z - b.z || a.x - b.x),
    right.cells.map(({ x, z }) => ({ x, z })).sort((a, b) => a.z - b.z || a.x - b.x),
  );
});

test('invalid Maze Carving options fail closed', () => {
  assert.throws(() => generateMazeCarvingCore({ seed: -1 }), /seed/);
  assert.throws(() => generateMazeCarvingCore({ seed: 1, roomCount: 2 }), /roomCount/);
  assert.throws(() => generateMazeCarvingCore({
    seed: 1, roomCount: 8, extraConnectionRatio: 1.1,
  }), /extraConnectionRatio/);
  assert.throws(() => generateMazeCarvingCore({
    seed: 1, roomCount: 8, roomSizeMin: 9, roomSizeMax: 8,
  }), /room size/);
});
