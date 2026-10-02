import assert from 'node:assert/strict';
import test from 'node:test';
import { generateWfcCore } from '../src/index.js';

function edgeKey(edge) {
  return edge.a < edge.b
    ? edge.a + '|' + edge.b
    : edge.b + '|' + edge.a;
}

test('WFC Core is deterministic for the same Seed and options', () => {
  const input = {
    seed: 20260929,
    roomCount: 16,
    extraConnectionRatio: 0.6,
  };
  assert.deepEqual(
    generateWfcCore(input),
    generateWfcCore(input),
  );
});

test('different WFC Seeds can alter orientation, tiles, or Room sizes', () => {
  const left = generateWfcCore({
    seed: 101,
    roomCount: 16,
    extraConnectionRatio: 0.5,
  });
  const right = generateWfcCore({
    seed: 102,
    roomCount: 16,
    extraConnectionRatio: 0.5,
  });
  assert.notEqual(
    JSON.stringify({
      lattice: left.lattice,
      tiles: left.tiles,
      rooms: left.rooms,
    }),
    JSON.stringify({
      lattice: right.lattice,
      tiles: right.tiles,
      rooms: right.rooms,
    }),
  );
});

test('WFC always preserves the exact N-1 global backbone', () => {
  for (const roomCount of [3, 5, 8, 12, 20, 32, 64]) {
    const generated = generateWfcCore({
      seed: 7000 + roomCount,
      roomCount,
      extraConnectionRatio: 0,
    });
    assert.equal(generated.rooms.length, roomCount);
    assert.equal(
      generated.backboneEdges.length,
      roomCount - 1,
    );
    assert.equal(
      generated.diagnostics.treeEdgeCount,
      roomCount - 1,
    );
  }
});

test('WFC routeChoice zero yields only the required backbone', () => {
  const generated = generateWfcCore({
    seed: 424242,
    roomCount: 24,
    extraConnectionRatio: 0,
  });
  assert.equal(generated.extraEdges.length, 0);
  assert.equal(
    generated.finalEdges.length,
    generated.rooms.length - 1,
  );
  assert.equal(generated.diagnostics.cycleRank, 0);
});

test('WFC routeChoice one opens every optional active-cell adjacency', () => {
  const generated = generateWfcCore({
    seed: 424242,
    roomCount: 24,
    extraConnectionRatio: 1,
  });
  assert.equal(
    generated.extraEdges.length,
    generated.diagnostics.optionalCandidateCount,
  );
  assert.equal(
    generated.finalEdges.length,
    generated.diagnostics.candidateAdjacencyCount,
  );
});

test('collapsed WFC sockets agree on every final cardinal edge', () => {
  const generated = generateWfcCore({
    seed: 98765,
    roomCount: 28,
    extraConnectionRatio: 0.55,
  });
  const keys = generated.finalEdges.map(edgeKey);
  assert.equal(new Set(keys).size, keys.length);

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

test('WFC tiles expose local pattern classes and sockets', () => {
  const generated = generateWfcCore({
    seed: 3333,
    roomCount: 20,
    extraConnectionRatio: 0.7,
  });
  assert.equal(generated.tiles.length, 20);
  assert.ok(
    generated.tiles.every(
      (tile) =>
        Number.isInteger(tile.mask) &&
        Array.isArray(tile.sockets) &&
        typeof tile.name === 'string',
    ),
  );
  assert.ok(
    Object.values(
      generated.diagnostics.tileHistogram,
    ).reduce((sum, value) => sum + value, 0) === 20,
  );
});

test('WFC propagation completes without contradictions across supported counts', () => {
  for (const roomCount of [5, 8, 12, 16, 20]) {
    for (const routeChoice of [0, 0.25, 0.5, 0.75, 1]) {
      const generated = generateWfcCore({
        seed: 123456 + roomCount,
        roomCount,
        extraConnectionRatio: routeChoice,
      });
      assert.equal(
        generated.diagnostics.contradictionCount,
        0,
      );
      assert.ok(
        generated.diagnostics.propagationRevisions >= 0,
      );
    }
  }
});

test('WFC Rooms do not overlap at default spacing', () => {
  const generated = generateWfcCore({
    seed: 8888,
    roomCount: 40,
    extraConnectionRatio: 0.5,
  });
  for (let left = 0; left < generated.rooms.length; left += 1) {
    for (
      let right = left + 1;
      right < generated.rooms.length;
      right += 1
    ) {
      const a = generated.rooms[left];
      const b = generated.rooms[right];
      const overlapX =
        Math.min(
          a.x + a.width / 2,
          b.x + b.width / 2,
        ) -
        Math.max(
          a.x - a.width / 2,
          b.x - b.width / 2,
        );
      const overlapZ =
        Math.min(
          a.z + a.depth / 2,
          b.z + b.depth / 2,
        ) -
        Math.max(
          a.z - a.depth / 2,
          b.z - b.depth / 2,
        );
      assert.equal(
        overlapX > 1e-9 && overlapZ > 1e-9,
        false,
      );
    }
  }
});

test('invalid WFC options fail closed', () => {
  assert.throws(
    () => generateWfcCore({ seed: -1 }),
    /seed/,
  );
  assert.throws(
    () => generateWfcCore({
      seed: 1,
      roomCount: 2,
    }),
    /roomCount/,
  );
  assert.throws(
    () => generateWfcCore({
      seed: 1,
      extraConnectionRatio: 1.1,
    }),
    /extraConnectionRatio/,
  );
  assert.throws(
    () => generateWfcCore({
      seed: 1,
      roomSizeMin: 9,
      roomSizeMax: 8,
    }),
    /room size/,
  );
});
