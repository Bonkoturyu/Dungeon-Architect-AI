import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDelaunayTriangulation,
  buildMinimumSpanningTree,
  generateDelaunayMstCore,
} from '../src/index.js';

function edgeKey(edge) {
  return edge.a < edge.b
    ? `${edge.a}|${edge.b}`
    : `${edge.b}|${edge.a}`;
}

function hasRoomOverlap(rooms) {
  for (let left = 0; left < rooms.length; left += 1) {
    for (let right = left + 1; right < rooms.length; right += 1) {
      const a = rooms[left];
      const b = rooms[right];
      const overlapX =
        Math.min(a.x + a.width / 2, b.x + b.width / 2) -
        Math.max(a.x - a.width / 2, b.x - b.width / 2);
      const overlapZ =
        Math.min(a.z + a.depth / 2, b.z + b.depth / 2) -
        Math.max(a.z - a.depth / 2, b.z - b.depth / 2);
      if (overlapX > 1e-9 && overlapZ > 1e-9) return true;
    }
  }
  return false;
}

test('Delaunay core is byte-stable for the same Seed and options', () => {
  const input = {
    seed: 20260926,
    roomCount: 12,
    loopRatio: 0.65,
  };
  const left = generateDelaunayMstCore(input);
  const right = generateDelaunayMstCore(input);
  assert.deepEqual(left, right);
});

test('different Seeds change the spatial/topology result', () => {
  const left = generateDelaunayMstCore({
    seed: 1001,
    roomCount: 12,
    loopRatio: 0.5,
  });
  const right = generateDelaunayMstCore({
    seed: 1002,
    roomCount: 12,
    loopRatio: 0.5,
  });

  assert.notEqual(
    JSON.stringify({
      rooms: left.rooms,
      finalEdges: left.finalEdges,
    }),
    JSON.stringify({
      rooms: right.rooms,
      finalEdges: right.finalEdges,
    }),
  );
});

test('MST always contains exactly roomCount - 1 edges and connects all rooms', () => {
  for (const roomCount of [3, 5, 8, 12, 20, 32, 64]) {
    const generated = generateDelaunayMstCore({
      seed: 7000 + roomCount,
      roomCount,
      loopRatio: 0,
    });

    assert.equal(generated.mstEdges.length, roomCount - 1);
    assert.equal(generated.finalEdges.length, roomCount - 1);
    assert.equal(generated.diagnostics.cycleRank, 0);
  }
});

test('loopRatio maps to a bounded deterministic prefix of loop candidates', () => {
  const zero = generateDelaunayMstCore({
    seed: 987654,
    roomCount: 16,
    loopRatio: 0,
  });
  const half = generateDelaunayMstCore({
    seed: 987654,
    roomCount: 16,
    loopRatio: 0.5,
  });
  const full = generateDelaunayMstCore({
    seed: 987654,
    roomCount: 16,
    loopRatio: 1,
  });

  assert.equal(zero.loopEdges.length, 0);
  assert.ok(full.loopEdges.length > 0);
  assert.equal(
    full.loopEdges.length,
    full.diagnostics.loopCapacity,
  );
  assert.ok(
    half.loopEdges.length <= full.loopEdges.length,
  );

  const fullKeys = new Set(full.loopEdges.map(edgeKey));
  assert.ok(
    half.loopEdges.every((edge) => fullKeys.has(edgeKey(edge))),
  );
});

test('generated room rectangles do not overlap', () => {
  for (const seed of [1, 2, 3, 77, 123456789]) {
    const generated = generateDelaunayMstCore({
      seed,
      roomCount: 20,
      loopRatio: 0.75,
    });
    assert.equal(hasRoomOverlap(generated.rooms), false);
  }
});

test('Delaunay edges are unique and MST uses only Delaunay edges', () => {
  const generated = generateDelaunayMstCore({
    seed: 424242,
    roomCount: 18,
    loopRatio: 0.8,
  });

  const delaunayKeys = generated.delaunayEdges.map(edgeKey);
  assert.equal(
    new Set(delaunayKeys).size,
    delaunayKeys.length,
  );
  const delaunaySet = new Set(delaunayKeys);
  assert.ok(
    generated.mstEdges.every((edge) =>
      delaunaySet.has(edgeKey(edge))),
  );
});

test('standalone geometry helpers triangulate and span deterministic point input', () => {
  const points = [
    { x: 0, z: 0 },
    { x: 20, z: 0 },
    { x: 5, z: 14 },
    { x: 24, z: 18 },
    { x: 11, z: 29 },
  ];

  const triangulation = buildDelaunayTriangulation(points);
  const mst = buildMinimumSpanningTree(
    points.length,
    triangulation.edges,
  );

  assert.ok(triangulation.triangles.length >= 3);
  assert.ok(triangulation.edges.length >= points.length - 1);
  assert.equal(mst.length, points.length - 1);
});

test('invalid reusable Core parameters fail closed', () => {
  assert.throws(
    () =>
      generateDelaunayMstCore({
        seed: -1,
        roomCount: 8,
        loopRatio: 0.5,
      }),
    /seed/,
  );
  assert.throws(
    () =>
      generateDelaunayMstCore({
        seed: 1,
        roomCount: 2,
        loopRatio: 0.5,
      }),
    /roomCount/,
  );
  assert.throws(
    () =>
      generateDelaunayMstCore({
        seed: 1,
        roomCount: 8,
        loopRatio: 1.1,
      }),
    /loopRatio/,
  );
});
