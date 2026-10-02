import { createPrng, randomInt, shuffleInPlace } from './prng.js';

export const BSP_ALGORITHM_VERSION = '1';

const DEFAULTS = Object.freeze({
  roomSizeMin: 7,
  roomSizeMax: 9,
  roomMargin: 3,
  splitJitter: 0.18,
  coordinateStep: 0.5,
});

function quantize(value, step) {
  return Math.round(value / step) * step;
}

function validateOptions({
  seed,
  roomCount,
  extraConnectionRatio,
  roomSizeMin,
  roomSizeMax,
  roomMargin,
  splitJitter,
  coordinateStep,
}) {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError('seed must be a non-negative safe integer');
  }
  if (!Number.isInteger(roomCount) || roomCount < 3 || roomCount > 64) {
    throw new RangeError('roomCount must be an integer between 3 and 64');
  }
  if (
    typeof extraConnectionRatio !== 'number' ||
    !Number.isFinite(extraConnectionRatio) ||
    extraConnectionRatio < 0 ||
    extraConnectionRatio > 1
  ) {
    throw new RangeError('extraConnectionRatio must be between 0 and 1');
  }
  if (
    !Number.isInteger(roomSizeMin) ||
    !Number.isInteger(roomSizeMax) ||
    roomSizeMin <= 0 ||
    roomSizeMax < roomSizeMin
  ) {
    throw new RangeError('room size bounds are invalid');
  }
  if (!Number.isFinite(roomMargin) || roomMargin < 1) {
    throw new RangeError('roomMargin must be >= 1');
  }
  if (
    typeof splitJitter !== 'number' ||
    !Number.isFinite(splitJitter) ||
    splitJitter < 0 ||
    splitJitter > 0.3
  ) {
    throw new RangeError('splitJitter must be between 0 and 0.3');
  }
  if (!Number.isFinite(coordinateStep) || coordinateStep <= 0) {
    throw new RangeError('coordinateStep must be greater than zero');
  }
}

function minimumLeafSpan(roomSizeMax, roomMargin) {
  return roomSizeMax + roomMargin * 2;
}

function makeRootBounds(roomCount, minLeafSpan) {
  const columns = Math.ceil(Math.sqrt(roomCount));
  const rows = Math.ceil(roomCount / columns);
  const scale = 1.55;

  return {
    minX: 0,
    minZ: 0,
    width: Math.max(minLeafSpan * 2, columns * minLeafSpan * scale),
    depth: Math.max(minLeafSpan * 2, rows * minLeafSpan * scale),
  };
}

function leafArea(node) {
  return node.width * node.depth;
}

function canSplitAxis(node, axis, minLeafSpan) {
  const span = axis === 'x' ? node.width : node.depth;
  return span >= minLeafSpan * 2;
}

function chooseSplitAxis(node, minLeafSpan, prng) {
  const canX = canSplitAxis(node, 'x', minLeafSpan);
  const canZ = canSplitAxis(node, 'z', minLeafSpan);

  if (!canX && !canZ) return null;
  if (canX && !canZ) return 'x';
  if (!canX && canZ) return 'z';

  const ratio = node.width / node.depth;
  if (ratio >= 1.25) return 'x';
  if (ratio <= 0.8) return 'z';
  return prng() < 0.5 ? 'x' : 'z';
}

function chooseSplitPosition(span, minLeafSpan, splitJitter, prng, step) {
  const minSplit = minLeafSpan;
  const maxSplit = span - minLeafSpan;
  const center = span / 2;
  const jitter = (prng() * 2 - 1) * splitJitter * span;
  return quantize(
    Math.max(minSplit, Math.min(maxSplit, center + jitter)),
    step,
  );
}

function buildPartitionTree({
  roomCount,
  minLeafSpan,
  splitJitter,
  coordinateStep,
  prng,
}) {
  const root = makeRootBounds(roomCount, minLeafSpan);
  const nodes = [
    {
      id: 'partition-001',
      parentId: null,
      depth: 0,
      minX: root.minX,
      minZ: root.minZ,
      width: root.width,
      depthSpan: root.depth,
      splitAxis: null,
      leftId: null,
      rightId: null,
    },
  ];
  const leaves = [nodes[0]];
  let nextNodeNumber = 2;

  while (leaves.length < roomCount) {
    const candidates = leaves
      .map((node) => ({
        node,
        axis: chooseSplitAxis(
          {
            width: node.width,
            depth: node.depthSpan,
          },
          minLeafSpan,
          prng,
        ),
      }))
      .filter((entry) => entry.axis !== null)
      .sort((left, right) =>
        leafArea({
          width: right.node.width,
          depth: right.node.depthSpan,
        }) -
          leafArea({
            width: left.node.width,
            depth: left.node.depthSpan,
          }) ||
        left.node.depth - right.node.depth ||
        left.node.id.localeCompare(right.node.id),
      );

    if (candidates.length === 0) {
      throw new Error(
        `BSP could not reach requested leaf count ${roomCount}; stopped at ${leaves.length}`,
      );
    }

    const selected = candidates[0];
    const node = selected.node;
    const axis = selected.axis;
    const span = axis === 'x' ? node.width : node.depthSpan;
    const split = chooseSplitPosition(
      span,
      minLeafSpan,
      splitJitter,
      prng,
      coordinateStep,
    );

    const left = {
      id: `partition-${String(nextNodeNumber).padStart(3, '0')}`,
      parentId: node.id,
      depth: node.depth + 1,
      minX: node.minX,
      minZ: node.minZ,
      width: axis === 'x' ? split : node.width,
      depthSpan: axis === 'z' ? split : node.depthSpan,
      splitAxis: null,
      leftId: null,
      rightId: null,
    };
    nextNodeNumber += 1;

    const right = {
      id: `partition-${String(nextNodeNumber).padStart(3, '0')}`,
      parentId: node.id,
      depth: node.depth + 1,
      minX: axis === 'x' ? node.minX + split : node.minX,
      minZ: axis === 'z' ? node.minZ + split : node.minZ,
      width: axis === 'x' ? node.width - split : node.width,
      depthSpan: axis === 'z' ? node.depthSpan - split : node.depthSpan,
      splitAxis: null,
      leftId: null,
      rightId: null,
    };
    nextNodeNumber += 1;

    node.splitAxis = axis;
    node.leftId = left.id;
    node.rightId = right.id;

    const leafIndex = leaves.indexOf(node);
    leaves.splice(leafIndex, 1, left, right);
    nodes.push(left, right);
  }

  return {
    rootBounds: {
      minX: root.minX,
      minZ: root.minZ,
      width: root.width,
      depth: root.depth,
    },
    nodes,
    leaves,
  };
}

function buildRooms({
  leaves,
  roomSizeMin,
  roomSizeMax,
  roomMargin,
  coordinateStep,
  prng,
}) {
  return leaves
    .slice()
    .sort((left, right) =>
      left.minZ - right.minZ ||
      left.minX - right.minX ||
      left.id.localeCompare(right.id),
    )
    .map((leaf, index) => {
      const width = randomInt(prng, roomSizeMin, roomSizeMax);
      const depth = randomInt(prng, roomSizeMin, roomSizeMax);
      const centerX = leaf.minX + leaf.width / 2;
      const centerZ = leaf.minZ + leaf.depthSpan / 2;
      const availableX = Math.max(
        0,
        leaf.width / 2 - roomMargin - width / 2,
      );
      const availableZ = Math.max(
        0,
        leaf.depthSpan / 2 - roomMargin - depth / 2,
      );
      const x = quantize(
        centerX + (prng() * 2 - 1) * availableX,
        coordinateStep,
      );
      const z = quantize(
        centerZ + (prng() * 2 - 1) * availableZ,
        coordinateStep,
      );

      return {
        id: `room-${String(index + 1).padStart(3, '0')}`,
        leafId: leaf.id,
        x,
        z,
        width,
        depth,
      };
    });
}

function edgeKey(left, right) {
  return left < right
    ? `${left}|${right}`
    : `${right}|${left}`;
}

function buildTreeEdges(nodes, rooms) {
  const roomIndexByLeafId = new Map(
    rooms.map((room, index) => [room.leafId, index]),
  );
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = [];

  function representativeRoomIndex(nodeId) {
    const node = nodeById.get(nodeId);
    if (!node) {
      throw new Error(`Unknown BSP node: ${nodeId}`);
    }

    if (!node.leftId && !node.rightId) {
      const roomIndex = roomIndexByLeafId.get(node.id);
      if (!Number.isInteger(roomIndex)) {
        throw new Error(
          `Leaf ${node.id} has no Room mapping`,
        );
      }
      return roomIndex;
    }

    const leftRepresentative = representativeRoomIndex(node.leftId);
    const rightRepresentative = representativeRoomIndex(node.rightId);

    edges.push({
      a: leftRepresentative,
      b: rightRepresentative,
      kind: 'bsp-tree',
      partitionId: node.id,
    });

    const leftRoom = rooms[leftRepresentative];
    const rightRoom = rooms[rightRepresentative];
    const leftDistance = Math.hypot(
      leftRoom.x -
        (node.minX + node.width / 2),
      leftRoom.z -
        (node.minZ + node.depthSpan / 2),
    );
    const rightDistance = Math.hypot(
      rightRoom.x -
        (node.minX + node.width / 2),
      rightRoom.z -
        (node.minZ + node.depthSpan / 2),
    );

    return leftDistance <= rightDistance
      ? leftRepresentative
      : rightRepresentative;
  }

  representativeRoomIndex('partition-001');

  return edges.sort((left, right) =>
    Math.min(left.a, left.b) -
      Math.min(right.a, right.b) ||
    Math.max(left.a, left.b) -
      Math.max(right.a, right.b) ||
    left.partitionId.localeCompare(right.partitionId),
  );
}

function buildExtraEdges({
  rooms,
  treeEdges,
  extraConnectionRatio,
  prng,
}) {
  const treeKeys = new Set(
    treeEdges.map((edge) => edgeKey(edge.a, edge.b)),
  );
  const candidateMap = new Map();

  for (let index = 0; index < rooms.length; index += 1) {
    const nearest = rooms
      .map((room, otherIndex) => {
        if (index === otherIndex) return null;
        return {
          otherIndex,
          distance: Math.hypot(
            room.x - rooms[otherIndex].x,
            room.z - rooms[otherIndex].z,
          ),
        };
      })
      .filter(Boolean)
      .sort((left, right) =>
        left.distance - right.distance ||
        left.otherIndex - right.otherIndex,
      )
      .slice(0, 3);

    for (const candidate of nearest) {
      const a = Math.min(index, candidate.otherIndex);
      const b = Math.max(index, candidate.otherIndex);
      const key = edgeKey(a, b);
      if (treeKeys.has(key) || candidateMap.has(key)) continue;
      candidateMap.set(key, {
        a,
        b,
        weight: candidate.distance,
      });
    }
  }

  const candidates = [...candidateMap.values()];
  shuffleInPlace(candidates, prng);

  const capacity = Math.min(
    candidates.length,
    Math.max(1, Math.floor(rooms.length / 3)),
  );
  const target = Math.round(
    extraConnectionRatio * capacity,
  );
  const extraEdges = candidates
    .slice(0, target)
    .sort((left, right) =>
      left.a - right.a ||
      left.b - right.b,
    )
    .map((edge) => ({
      ...edge,
      kind: 'bsp-extra',
    }));

  return {
    candidates,
    capacity,
    target,
    extraEdges,
  };
}

function roomsOverlap(left, right) {
  const overlapX =
    Math.min(
      left.x + left.width / 2,
      right.x + right.width / 2,
    ) -
    Math.max(
      left.x - left.width / 2,
      right.x - right.width / 2,
    );
  const overlapZ =
    Math.min(
      left.z + left.depth / 2,
      right.z + right.depth / 2,
    ) -
    Math.max(
      left.z - left.depth / 2,
      right.z - right.depth / 2,
    );
  return overlapX > 1e-9 && overlapZ > 1e-9;
}

function validateGeneratedCore({
  rooms,
  leaves,
  treeEdges,
  finalEdges,
}) {
  if (rooms.length !== leaves.length) {
    throw new Error(
      `Room/leaf mismatch: ${rooms.length}/${leaves.length}`,
    );
  }
  if (treeEdges.length !== rooms.length - 1) {
    throw new Error(
      `BSP tree edge count mismatch: expected ${rooms.length - 1}, got ${treeEdges.length}`,
    );
  }

  for (let left = 0; left < rooms.length; left += 1) {
    for (
      let right = left + 1;
      right < rooms.length;
      right += 1
    ) {
      if (roomsOverlap(rooms[left], rooms[right])) {
        throw new Error(
          `BSP room overlap: ${rooms[left].id} / ${rooms[right].id}`,
        );
      }
    }
  }

  const seenEdges = new Set();
  const adjacency = new Map(
    rooms.map((_, index) => [index, []]),
  );

  for (const edge of finalEdges) {
    if (edge.a === edge.b) {
      throw new Error('BSP generated a self edge');
    }
    const key = edgeKey(edge.a, edge.b);
    if (seenEdges.has(key)) {
      throw new Error(
        `BSP generated duplicate edge: ${key}`,
      );
    }
    seenEdges.add(key);
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
      `BSP graph disconnected: reached ${visited.size}/${rooms.length}`,
    );
  }
}

export function generateBspCore({
  seed,
  roomCount = 8,
  extraConnectionRatio = 0.5,
  roomSizeMin = DEFAULTS.roomSizeMin,
  roomSizeMax = DEFAULTS.roomSizeMax,
  roomMargin = DEFAULTS.roomMargin,
  splitJitter = DEFAULTS.splitJitter,
  coordinateStep = DEFAULTS.coordinateStep,
} = {}) {
  validateOptions({
    seed,
    roomCount,
    extraConnectionRatio,
    roomSizeMin,
    roomSizeMax,
    roomMargin,
    splitJitter,
    coordinateStep,
  });

  const minLeafSpan = minimumLeafSpan(
    roomSizeMax,
    roomMargin,
  );
  const splitPrng = createPrng(
    (seed ^ 0x13579bdf) >>> 0,
  );
  const roomPrng = createPrng(
    (seed ^ 0x2468ace0) >>> 0,
  );
  const extraPrng = createPrng(
    (seed ^ 0x9e3779b9) >>> 0,
  );

  const partition = buildPartitionTree({
    roomCount,
    minLeafSpan,
    splitJitter,
    coordinateStep,
    prng: splitPrng,
  });
  const rooms = buildRooms({
    leaves: partition.leaves,
    roomSizeMin,
    roomSizeMax,
    roomMargin,
    coordinateStep,
    prng: roomPrng,
  });
  const treeEdges = buildTreeEdges(
    partition.nodes,
    rooms,
  );
  const extra = buildExtraEdges({
    rooms,
    treeEdges,
    extraConnectionRatio,
    prng: extraPrng,
  });
  const finalEdges = [
    ...treeEdges,
    ...extra.extraEdges,
  ];

  validateGeneratedCore({
    rooms,
    leaves: partition.leaves,
    treeEdges,
    finalEdges,
  });

  return {
    algorithm: 'bsp',
    algorithmVersion: BSP_ALGORITHM_VERSION,
    seed,
    options: {
      roomCount,
      extraConnectionRatio,
      roomSizeMin,
      roomSizeMax,
      roomMargin,
      splitJitter,
      coordinateStep,
    },
    rootBounds: partition.rootBounds,
    partitions: partition.nodes.map((node) => ({
      id: node.id,
      parentId: node.parentId,
      depth: node.depth,
      minX: node.minX,
      minZ: node.minZ,
      width: node.width,
      depthSpan: node.depthSpan,
      splitAxis: node.splitAxis,
      leftId: node.leftId,
      rightId: node.rightId,
    })),
    leaves: partition.leaves.map((leaf) => ({
      id: leaf.id,
      parentId: leaf.parentId,
      depth: leaf.depth,
      minX: leaf.minX,
      minZ: leaf.minZ,
      width: leaf.width,
      depthSpan: leaf.depthSpan,
    })),
    rooms,
    treeEdges,
    extraEdges: extra.extraEdges,
    finalEdges,
    diagnostics: {
      roomCount,
      partitionCount: partition.nodes.length,
      leafCount: partition.leaves.length,
      maxDepth: Math.max(
        ...partition.leaves.map((leaf) => leaf.depth),
      ),
      treeEdgeCount: treeEdges.length,
      extraCandidateCount: extra.candidates.length,
      extraConnectionCapacity: extra.capacity,
      extraConnectionTarget: extra.target,
      extraEdgeCount: extra.extraEdges.length,
      cycleRank:
        finalEdges.length - rooms.length + 1,
    },
  };
}
