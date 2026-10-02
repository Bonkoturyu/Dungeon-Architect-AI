import assert from 'node:assert/strict';
import test from 'node:test';
import { generateBspCore } from '../src/index.js';

function edgeKey(edge) {
  return edge.a < edge.b
    ? `${edge.a}|${edge.b}`
    : `${edge.b}|${edge.a}`;
}

function hasRoomOverlap(rooms) {
  for (let left = 0; left < rooms.length; left += 1) {
    for (
      let right = left + 1;
      right < rooms.length;
      right += 1
    ) {
      const a = rooms[left];
      const b = rooms[right];
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
      if (overlapX > 1e-9 && overlapZ > 1e-9) {
        return true;
      }
    }
  }
  return false;
}

test('BSP Core is byte-stable for the same Seed and options', () => {
  const input = {
    seed: 20260927,
    roomCount: 12,
    extraConnectionRatio: 0.65,
  };
  const left = generateBspCore(input);
  const right = generateBspCore(input);
  assert.deepEqual(left, right);
});

test('different BSP Seeds alter partitions or room placement', () => {
  const left = generateBspCore({
    seed: 1001,
    roomCount: 12,
    extraConnectionRatio: 0.5,
  });
  const right = generateBspCore({
    seed: 1002,
    roomCount: 12,
    extraConnectionRatio: 0.5,
  });

  assert.notEqual(
    JSON.stringify({
      partitions: left.partitions,
      rooms: left.rooms,
      finalEdges: left.finalEdges,
    }),
    JSON.stringify({
      partitions: right.partitions,
      rooms: right.rooms,
      finalEdges: right.finalEdges,
    }),
  );
});

test('BSP creates exactly one Room per leaf and N - 1 tree edges', () => {
  for (const roomCount of [3, 5, 8, 12, 20, 32, 64]) {
    const generated = generateBspCore({
      seed: 7000 + roomCount,
      roomCount,
      extraConnectionRatio: 0,
    });

    assert.equal(generated.leaves.length, roomCount);
    assert.equal(generated.rooms.length, roomCount);
    assert.equal(
      generated.treeEdges.length,
      roomCount - 1,
    );
    assert.equal(
      generated.finalEdges.length,
      roomCount - 1,
    );
    assert.equal(generated.diagnostics.cycleRank, 0);
  }
});

test('BSP Rooms remain inside their own leaf region with margin allowance', () => {
  const generated = generateBspCore({
    seed: 3333,
    roomCount: 24,
    extraConnectionRatio: 0.5,
  });
  const leafById = new Map(
    generated.leaves.map((leaf) => [leaf.id, leaf]),
  );

  for (const room of generated.rooms) {
    const leaf = leafById.get(room.leafId);
    assert.ok(leaf);
    assert.ok(
      room.x - room.width / 2 >=
        leaf.minX - 1e-9,
    );
    assert.ok(
      room.x + room.width / 2 <=
        leaf.minX + leaf.width + 1e-9,
    );
    assert.ok(
      room.z - room.depth / 2 >=
        leaf.minZ - 1e-9,
    );
    assert.ok(
      room.z + room.depth / 2 <=
        leaf.minZ + leaf.depthSpan + 1e-9,
    );
  }
});

test('BSP generated room rectangles do not overlap', () => {
  for (const seed of [1, 2, 3, 77, 123456789]) {
    const generated = generateBspCore({
      seed,
      roomCount: 20,
      extraConnectionRatio: 0.75,
    });
    assert.equal(
      hasRoomOverlap(generated.rooms),
      false,
    );
  }
});

test('extraConnectionRatio adds a bounded deterministic subset', () => {
  const zero = generateBspCore({
    seed: 987654,
    roomCount: 16,
    extraConnectionRatio: 0,
  });
  const half = generateBspCore({
    seed: 987654,
    roomCount: 16,
    extraConnectionRatio: 0.5,
  });
  const full = generateBspCore({
    seed: 987654,
    roomCount: 16,
    extraConnectionRatio: 1,
  });

  assert.equal(zero.extraEdges.length, 0);
  assert.ok(full.extraEdges.length > 0);
  assert.equal(
    full.extraEdges.length,
    full.diagnostics.extraConnectionCapacity,
  );
  assert.ok(
    half.extraEdges.length <=
      full.extraEdges.length,
  );

  const fullKeys = new Set(
    full.extraEdges.map(edgeKey),
  );
  assert.ok(
    half.extraEdges.every((edge) =>
      fullKeys.has(edgeKey(edge))),
  );
});

test('BSP final edges are unique and connected by construction', () => {
  const generated = generateBspCore({
    seed: 424242,
    roomCount: 18,
    extraConnectionRatio: 0.8,
  });
  const keys = generated.finalEdges.map(edgeKey);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(
    generated.diagnostics.treeEdgeCount,
    generated.rooms.length - 1,
  );
});

test('invalid BSP Core parameters fail closed', () => {
  assert.throws(
    () =>
      generateBspCore({
        seed: -1,
        roomCount: 8,
      }),
    /seed/,
  );
  assert.throws(
    () =>
      generateBspCore({
        seed: 1,
        roomCount: 2,
      }),
    /roomCount/,
  );
  assert.throws(
    () =>
      generateBspCore({
        seed: 1,
        roomCount: 8,
        extraConnectionRatio: 1.1,
      }),
    /extraConnectionRatio/,
  );
  assert.throws(
    () =>
      generateBspCore({
        seed: 1,
        roomCount: 8,
        splitJitter: 0.5,
      }),
    /splitJitter/,
  );
});
