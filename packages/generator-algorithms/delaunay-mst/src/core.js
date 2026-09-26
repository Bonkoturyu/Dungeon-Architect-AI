import { buildDelaunayTriangulation, buildMinimumSpanningTree } from './geometry.js';
import { createPrng, randomInt, shuffleInPlace } from './prng.js';

export const DELAUNAY_MST_ALGORITHM_VERSION = '1';

const DEFAULTS = Object.freeze({
  roomSizeMin: 7,
  roomSizeMax: 9,
  minCenterDistance: 15,
  scatterStep: 0.5,
  maxScatterAttemptsPerRoom: 256,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function validateOptions({
  seed,
  roomCount,
  loopRatio,
  roomSizeMin,
  roomSizeMax,
  minCenterDistance,
  scatterStep,
  maxScatterAttemptsPerRoom,
}) {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError('seed must be a non-negative safe integer');
  }
  if (!Number.isInteger(roomCount) || roomCount < 3 || roomCount > 64) {
    throw new RangeError('roomCount must be an integer between 3 and 64');
  }
  if (
    typeof loopRatio !== 'number' ||
    !Number.isFinite(loopRatio) ||
    loopRatio < 0 ||
    loopRatio > 1
  ) {
    throw new RangeError('loopRatio must be between 0 and 1');
  }
  if (
    !Number.isInteger(roomSizeMin) ||
    !Number.isInteger(roomSizeMax) ||
    roomSizeMin <= 0 ||
    roomSizeMax < roomSizeMin
  ) {
    throw new RangeError('room size bounds are invalid');
  }
  if (!Number.isFinite(minCenterDistance) || minCenterDistance <= roomSizeMax) {
    throw new RangeError('minCenterDistance must be greater than roomSizeMax');
  }
  if (!Number.isFinite(scatterStep) || scatterStep <= 0) {
    throw new RangeError('scatterStep must be greater than zero');
  }
  if (
    !Number.isInteger(maxScatterAttemptsPerRoom) ||
    maxScatterAttemptsPerRoom < 8
  ) {
    throw new RangeError('maxScatterAttemptsPerRoom must be an integer >= 8');
  }
}

function quantize(value, step) {
  return Math.round(value / step) * step;
}

function pointDistance(left, right) {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

function roomsOverlap(left, right) {
  const overlapX =
    Math.min(left.x + left.width / 2, right.x + right.width / 2) -
    Math.max(left.x - left.width / 2, right.x - right.width / 2);
  const overlapZ =
    Math.min(left.z + left.depth / 2, right.z + right.depth / 2) -
    Math.max(left.z - left.depth / 2, right.z - right.depth / 2);
  return overlapX > 1e-9 && overlapZ > 1e-9;
}

function scatterPoints({
  prng,
  roomCount,
  minCenterDistance,
  scatterStep,
  maxScatterAttemptsPerRoom,
}) {
  const side = Math.ceil(Math.sqrt(roomCount));
  const extent = Math.max(
    minCenterDistance * 2,
    side * minCenterDistance * 1.55,
  );
  const points = [];

  for (let index = 0; index < roomCount; index += 1) {
    let accepted = null;

    for (
      let attempt = 0;
      attempt < maxScatterAttemptsPerRoom;
      attempt += 1
    ) {
      const candidate = {
        x: quantize((prng() - 0.5) * extent, scatterStep),
        z: quantize((prng() - 0.5) * extent, scatterStep),
      };

      if (
        points.every(
          (existing) =>
            pointDistance(existing, candidate) >= minCenterDistance,
        )
      ) {
        accepted = candidate;
        break;
      }
    }

    if (!accepted) {
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      let fallbackIndex = index;
      while (!accepted) {
        const radius =
          minCenterDistance *
          (1.15 + Math.sqrt(fallbackIndex + 1) * 1.2);
        const angle =
          goldenAngle * (fallbackIndex + 1) +
          (prng() - 0.5) * 0.2;
        const candidate = {
          x: quantize(Math.cos(angle) * radius, scatterStep),
          z: quantize(Math.sin(angle) * radius, scatterStep),
        };
        if (
          points.every(
            (existing) =>
              pointDistance(existing, candidate) >= minCenterDistance,
          )
        ) {
          accepted = candidate;
          break;
        }
        fallbackIndex += 1;
      }
    }

    points.push(accepted);
  }

  const minX = Math.min(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));

  return points.map((point) => ({
    x: quantize(point.x - minX, scatterStep),
    z: quantize(point.z - minZ, scatterStep),
  }));
}

function buildRoomModels(points, prng, roomSizeMin, roomSizeMax) {
  return points.map((point, index) => ({
    id: `room-${String(index + 1).padStart(3, '0')}`,
    x: point.x,
    z: point.z,
    width: randomInt(prng, Math.ceil(roomSizeMin), Math.floor(roomSizeMax)),
    depth: randomInt(prng, Math.ceil(roomSizeMin), Math.floor(roomSizeMax)),
  }));
}

function edgeKey(edge) {
  const a = Math.min(edge.a, edge.b);
  const b = Math.max(edge.a, edge.b);
  return `${a}|${b}`;
}

function buildFinalEdges({
  delaunayEdges,
  mstEdges,
  roomCount,
  loopRatio,
  prng,
}) {
  const mstKeys = new Set(mstEdges.map(edgeKey));
  const loopCandidates = delaunayEdges
    .filter((edge) => !mstKeys.has(edgeKey(edge)))
    .map((edge) => ({ ...edge }));

  shuffleInPlace(loopCandidates, prng);

  const loopCapacity = Math.min(
    loopCandidates.length,
    Math.max(1, Math.floor(roomCount / 3)),
  );
  const loopTarget = Math.round(loopRatio * loopCapacity);
  const loopEdges = loopCandidates
    .slice(0, loopTarget)
    .sort((left, right) =>
      left.a - right.a ||
      left.b - right.b);

  const treeEdges = [...mstEdges].sort((left, right) =>
    left.a - right.a ||
    left.b - right.b);

  return {
    treeEdges,
    loopEdges,
    loopCandidates,
    loopCapacity,
    loopTarget,
    finalEdges: [
      ...treeEdges.map((edge) => ({ ...edge, kind: 'spanning-tree' })),
      ...loopEdges.map((edge) => ({ ...edge, kind: 'loop' })),
    ],
  };
}

function validateGeneratedCore(rooms, finalEdges) {
  const edgeKeys = new Set();
  for (const edge of finalEdges) {
    if (edge.a === edge.b) throw new Error('self edge generated');
    const key = edgeKey(edge);
    if (edgeKeys.has(key)) throw new Error(`duplicate edge generated: ${key}`);
    edgeKeys.add(key);
  }

  for (let left = 0; left < rooms.length; left += 1) {
    for (let right = left + 1; right < rooms.length; right += 1) {
      if (roomsOverlap(rooms[left], rooms[right])) {
        throw new Error(
          `room overlap generated: ${rooms[left].id} / ${rooms[right].id}`,
        );
      }
    }
  }

  const adjacency = new Map(
    rooms.map((_, index) => [index, []]),
  );
  for (const edge of finalEdges) {
    adjacency.get(edge.a).push(edge.b);
    adjacency.get(edge.b).push(edge.a);
  }

  const visited = new Set([0]);
  const queue = [0];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const next of adjacency.get(current)) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }

  if (visited.size !== rooms.length) {
    throw new Error(
      `generated graph disconnected: reached ${visited.size}/${rooms.length}`,
    );
  }
}

export function generateDelaunayMstCore({
  seed,
  roomCount = 8,
  loopRatio = 0.5,
  roomSizeMin = DEFAULTS.roomSizeMin,
  roomSizeMax = DEFAULTS.roomSizeMax,
  minCenterDistance = DEFAULTS.minCenterDistance,
  scatterStep = DEFAULTS.scatterStep,
  maxScatterAttemptsPerRoom = DEFAULTS.maxScatterAttemptsPerRoom,
} = {}) {
  validateOptions({
    seed,
    roomCount,
    loopRatio,
    roomSizeMin,
    roomSizeMax,
    minCenterDistance,
    scatterStep,
    maxScatterAttemptsPerRoom,
  });

  const scatterPrng = createPrng((seed ^ 0x8d12f3a1) >>> 0);
  const roomPrng = createPrng((seed ^ 0x19a5c4e7) >>> 0);
  const loopPrng = createPrng((seed ^ 0x53f91b2d) >>> 0);

  const points = scatterPoints({
    prng: scatterPrng,
    roomCount,
    minCenterDistance,
    scatterStep,
    maxScatterAttemptsPerRoom,
  });
  const rooms = buildRoomModels(
    points,
    roomPrng,
    roomSizeMin,
    roomSizeMax,
  );

  const triangulation = buildDelaunayTriangulation(points);
  const mstEdges = buildMinimumSpanningTree(
    roomCount,
    triangulation.edges,
  );
  const loopSelection = buildFinalEdges({
    delaunayEdges: triangulation.edges,
    mstEdges,
    roomCount,
    loopRatio,
    prng: loopPrng,
  });

  validateGeneratedCore(rooms, loopSelection.finalEdges);

  return {
    algorithm: 'delaunay-mst-loops',
    algorithmVersion: DELAUNAY_MST_ALGORITHM_VERSION,
    seed,
    options: {
      roomCount,
      loopRatio: clamp(loopRatio, 0, 1),
      roomSizeMin,
      roomSizeMax,
      minCenterDistance,
      scatterStep,
    },
    rooms,
    triangles: triangulation.triangles,
    delaunayEdges: triangulation.edges,
    mstEdges: loopSelection.treeEdges,
    loopEdges: loopSelection.loopEdges,
    finalEdges: loopSelection.finalEdges,
    diagnostics: {
      roomCount,
      triangleCount: triangulation.triangles.length,
      delaunayEdgeCount: triangulation.edges.length,
      mstEdgeCount: loopSelection.treeEdges.length,
      loopCandidateCount: loopSelection.loopCandidates.length,
      loopCapacity: loopSelection.loopCapacity,
      loopTarget: loopSelection.loopTarget,
      loopEdgeCount: loopSelection.loopEdges.length,
      cycleRank:
        loopSelection.finalEdges.length - roomCount + 1,
    },
  };
}
