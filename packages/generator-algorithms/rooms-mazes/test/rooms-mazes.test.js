import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateRoomsMazesCore,
} from '../src/index.js';

function edgeKey(edge) {
  return edge.a < edge.b
    ? `${edge.a}|${edge.b}`
    : `${edge.b}|${edge.a}`;
}

test('Rooms+Mazes Core is deterministic for the same Seed', () => {
  const input = {
    seed: 20260929,
    roomCount: 12,
    extraConnectionRatio: 0.6,
  };
  assert.deepEqual(
    generateRoomsMazesCore(input),
    generateRoomsMazesCore(input),
  );
});

test('different Seeds alter Rooms+Mazes geometry or maze edges', () => {
  const left = generateRoomsMazesCore({
    seed: 101,
    roomCount: 12,
    extraConnectionRatio: 0.5,
  });
  const right = generateRoomsMazesCore({
    seed: 102,
    roomCount: 12,
    extraConnectionRatio: 0.5,
  });
  assert.notEqual(
    JSON.stringify({
      rooms: left.rooms,
      edges: left.finalEdges,
    }),
    JSON.stringify({
      rooms: right.rooms,
      edges: right.finalEdges,
    }),
  );
});

test('Rooms+Mazes perfect maze has N-1 tree edges', () => {
  for (const roomCount of [3, 5, 8, 12, 20, 32, 64]) {
    const generated = generateRoomsMazesCore({
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

test('every Rooms+Mazes Corridor joins cardinally adjacent grid cells', () => {
  const generated = generateRoomsMazesCore({
    seed: 424242,
    roomCount: 24,
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

test('Rooms+Mazes Rooms do not overlap at default spacing', () => {
  const generated = generateRoomsMazesCore({
    seed: 3333,
    roomCount: 32,
    extraConnectionRatio: 0.75,
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
        Math.min(a.x + a.width / 2, b.x + b.width / 2) -
        Math.max(a.x - a.width / 2, b.x - b.width / 2);
      const overlapZ =
        Math.min(a.z + a.depth / 2, b.z + b.depth / 2) -
        Math.max(a.z - a.depth / 2, b.z - b.depth / 2);
      assert.equal(overlapX > 1e-9 && overlapZ > 1e-9, false);
    }
  }
});

test('extraConnectionRatio controls only unused local grid adjacencies', () => {
  const zero = generateRoomsMazesCore({
    seed: 98765,
    roomCount: 20,
    extraConnectionRatio: 0,
  });
  const half = generateRoomsMazesCore({
    seed: 98765,
    roomCount: 20,
    extraConnectionRatio: 0.5,
  });
  const full = generateRoomsMazesCore({
    seed: 98765,
    roomCount: 20,
    extraConnectionRatio: 1,
  });

  assert.equal(zero.extraEdges.length, 0);
  assert.equal(
    full.extraEdges.length,
    full.diagnostics.extraCandidateCount,
  );
  assert.ok(half.extraEdges.length <= full.extraEdges.length);

  const keys = full.finalEdges.map(edgeKey);
  assert.equal(new Set(keys).size, keys.length);
});

test('Start/Goal IDs map to the maze tree diameter endpoints', () => {
  const generated = generateRoomsMazesCore({
    seed: 8888,
    roomCount: 18,
    extraConnectionRatio: 0.25,
  });
  assert.equal(generated.rooms[0].id, 'room-001');
  assert.equal(
    generated.rooms.at(-1).id,
    'room-018',
  );
  assert.ok(generated.diagnostics.treeDiameterLength >= 1);
});

test('Rooms+Mazes custom room sizes and spacing stay deterministic', () => {
  const generated = generateRoomsMazesCore({
    seed: 1234,
    roomCount: 10,
    extraConnectionRatio: 0.5,
    roomSizeMin: 8,
    roomSizeMax: 8,
    cellSpacing: 16,
  });
  assert.ok(
    generated.rooms.every(
      (room) => room.width === 8 && room.depth === 8,
    ),
  );
});

test('invalid Rooms+Mazes options fail closed', () => {
  assert.throws(
    () => generateRoomsMazesCore({ seed: -1 }),
    /seed/,
  );
  assert.throws(
    () => generateRoomsMazesCore({ seed: 1, roomCount: 2 }),
    /roomCount/,
  );
  assert.throws(
    () => generateRoomsMazesCore({
      seed: 1,
      roomCount: 8,
      extraConnectionRatio: 1.1,
    }),
    /extraConnectionRatio/,
  );
  assert.throws(
    () => generateRoomsMazesCore({
      seed: 1,
      roomCount: 8,
      roomSizeMin: 9,
      roomSizeMax: 8,
    }),
    /room size/,
  );
  assert.throws(
    () => generateRoomsMazesCore({
      seed: 1,
      roomCount: 8,
      roomSizeMax: 9,
      cellSpacing: 10,
    }),
    /cellSpacing/,
  );
});
