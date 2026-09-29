export const ROOMS_MAZES_ALGORITHM_VERSION = '1';

const DEFAULTS = Object.freeze({
  roomSizeMin: 7,
  roomSizeMax: 9,
  cellSpacing: 14,
});

function createPrng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(prng, min, max) {
  return min + Math.floor(prng() * (max - min + 1));
}

function shuffle(values, prng) {
  const copy = values.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(prng() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function key(x, z) {
  return `${x},${z}`;
}

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function validateOptions({
  seed,
  roomCount,
  extraConnectionRatio,
  roomSizeMin,
  roomSizeMax,
  cellSpacing,
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
    roomSizeMin < 4 ||
    roomSizeMax < roomSizeMin ||
    roomSizeMax > 16
  ) {
    throw new RangeError('room size bounds are invalid');
  }
  if (
    !Number.isInteger(cellSpacing) ||
    cellSpacing < roomSizeMax + 3 ||
    cellSpacing > 40
  ) {
    throw new RangeError(
      'cellSpacing must be an integer at least roomSizeMax + 3 and at most 40',
    );
  }
}

function buildConnectedCells(roomCount, prng) {
  const side = Math.max(2, Math.ceil(Math.sqrt(roomCount * 1.35)));
  const width = side;
  const height = Math.max(side, Math.ceil(roomCount / side) + 1);
  const start = {
    x: randomInt(prng, 0, width - 1),
    z: randomInt(prng, 0, height - 1),
  };

  const visited = new Set([key(start.x, start.z)]);
  const order = [start];
  const stack = [start];
  const directions = [
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: 0, dz: -1 },
  ];

  while (order.length < roomCount) {
    if (stack.length === 0) {
      throw new Error('Rooms+Mazes failed to build a connected cell set');
    }

    const current = stack[stack.length - 1];
    const candidates = shuffle(directions, prng)
      .map(({ dx, dz }) => ({
        x: current.x + dx,
        z: current.z + dz,
      }))
      .filter((cell) =>
        cell.x >= 0 &&
        cell.z >= 0 &&
        cell.x < width &&
        cell.z < height &&
        !visited.has(key(cell.x, cell.z)),
      );

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const next = candidates[0];
    visited.add(key(next.x, next.z));
    order.push(next);
    stack.push(next);
  }

  return { width, height, cells: order };
}

function buildAdjacency(cells) {
  const indexByKey = new Map(
    cells.map((cell, index) => [key(cell.x, cell.z), index]),
  );
  const adjacency = new Map(
    cells.map((_, index) => [index, []]),
  );

  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const other = indexByKey.get(key(cell.x + dx, cell.z + dz));
      if (Number.isInteger(other)) adjacency.get(index).push(other);
    }
    adjacency.get(index).sort((a, b) => a - b);
  }

  return adjacency;
}

function carveMazeTree(cells, adjacency, prng) {
  const start = randomInt(prng, 0, cells.length - 1);
  const visited = new Set([start]);
  const stack = [start];
  const edges = [];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const candidates = shuffle(
      adjacency.get(current).filter((next) => !visited.has(next)),
      prng,
    );

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const next = candidates[0];
    visited.add(next);
    edges.push({
      a: current,
      b: next,
      kind: 'rooms-mazes-tree',
    });
    stack.push(next);
  }

  if (visited.size !== cells.length) {
    throw new Error(
      `Rooms+Mazes maze disconnected: reached ${visited.size}/${cells.length}`,
    );
  }
  return edges;
}

function farthest(start, count, edges) {
  const adjacency = new Map(
    Array.from({ length: count }, (_, index) => [index, []]),
  );
  for (const edge of edges) {
    adjacency.get(edge.a).push(edge.b);
    adjacency.get(edge.b).push(edge.a);
  }

  const queue = [start];
  const distance = new Map([[start, 0]]);
  let best = start;

  while (queue.length > 0) {
    const current = queue.shift();
    const currentDistance = distance.get(current);
    if (
      currentDistance > distance.get(best) ||
      (currentDistance === distance.get(best) && current < best)
    ) {
      best = current;
    }
    for (const next of adjacency.get(current)) {
      if (distance.has(next)) continue;
      distance.set(next, currentDistance + 1);
      queue.push(next);
    }
  }

  return { index: best, distance: distance.get(best) };
}

function treeDiameter(count, edges) {
  const first = farthest(0, count, edges);
  const second = farthest(first.index, count, edges);
  return {
    start: first.index,
    goal: second.index,
    length: second.distance,
  };
}

function remapForStartGoal(cells, treeEdges) {
  const diameter = treeDiameter(cells.length, treeEdges);
  const middle = cells
    .map((cell, index) => ({ cell, index }))
    .filter(
      ({ index }) =>
        index !== diameter.start &&
        index !== diameter.goal,
    )
    .sort((left, right) =>
      left.cell.z - right.cell.z ||
      left.cell.x - right.cell.x ||
      left.index - right.index,
    );

  const oldOrder = [
    diameter.start,
    ...middle.map((entry) => entry.index),
    diameter.goal,
  ];
  const newIndexByOld = new Map(
    oldOrder.map((oldIndex, newIndex) => [oldIndex, newIndex]),
  );

  return {
    cells: oldOrder.map((oldIndex) => cells[oldIndex]),
    treeEdges: treeEdges.map((edge) => ({
      ...edge,
      a: newIndexByOld.get(edge.a),
      b: newIndexByOld.get(edge.b),
    })),
    diameterLength: diameter.length,
  };
}

function addLoops({
  cells,
  treeEdges,
  extraConnectionRatio,
  prng,
}) {
  const adjacency = buildAdjacency(cells);
  const treeKeys = new Set(
    treeEdges.map((edge) => edgeKey(edge.a, edge.b)),
  );
  const candidates = [];

  for (let a = 0; a < cells.length; a += 1) {
    for (const b of adjacency.get(a)) {
      if (b <= a) continue;
      const keyValue = edgeKey(a, b);
      if (treeKeys.has(keyValue)) continue;
      candidates.push({
        a,
        b,
        kind: 'rooms-mazes-loop',
      });
    }
  }

  const shuffled = shuffle(candidates, prng);
  const target = Math.round(
    extraConnectionRatio * shuffled.length,
  );
  const extraEdges = shuffled
    .slice(0, target)
    .sort((left, right) =>
      left.a - right.a || left.b - right.b,
    );

  return {
    candidates,
    extraEdges,
    target,
  };
}

function buildRooms({
  cells,
  roomSizeMin,
  roomSizeMax,
  cellSpacing,
  prng,
}) {
  const minX = Math.min(...cells.map((cell) => cell.x));
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const minZ = Math.min(...cells.map((cell) => cell.z));
  const maxZ = Math.max(...cells.map((cell) => cell.z));
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  return cells.map((cell, index) => ({
    id: `room-${String(index + 1).padStart(3, '0')}`,
    cellX: cell.x,
    cellZ: cell.z,
    x: (cell.x - centerX) * cellSpacing,
    z: (cell.z - centerZ) * cellSpacing,
    width: randomInt(prng, roomSizeMin, roomSizeMax),
    depth: randomInt(prng, roomSizeMin, roomSizeMax),
  }));
}

function validateGenerated({ rooms, treeEdges, finalEdges }) {
  if (treeEdges.length !== rooms.length - 1) {
    throw new Error(
      `Rooms+Mazes tree edge mismatch: expected ${rooms.length - 1}, got ${treeEdges.length}`,
    );
  }

  const seen = new Set();
  const adjacency = new Map(
    rooms.map((_, index) => [index, []]),
  );

  for (const edge of finalEdges) {
    if (edge.a === edge.b) {
      throw new Error('Rooms+Mazes generated a self edge');
    }
    const keyValue = edgeKey(edge.a, edge.b);
    if (seen.has(keyValue)) {
      throw new Error(
        `Rooms+Mazes generated duplicate edge: ${keyValue}`,
      );
    }
    seen.add(keyValue);
    adjacency.get(edge.a).push(edge.b);
    adjacency.get(edge.b).push(edge.a);

    const left = rooms[edge.a];
    const right = rooms[edge.b];
    const dx = Math.abs(left.cellX - right.cellX);
    const dz = Math.abs(left.cellZ - right.cellZ);
    if (dx + dz !== 1) {
      throw new Error(
        `Rooms+Mazes non-cardinal adjacency: ${left.id}/${right.id}`,
      );
    }
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
      `Rooms+Mazes graph disconnected: ${visited.size}/${rooms.length}`,
    );
  }
}

export function generateRoomsMazesCore({
  seed,
  roomCount = 8,
  extraConnectionRatio = 0.5,
  roomSizeMin = DEFAULTS.roomSizeMin,
  roomSizeMax = DEFAULTS.roomSizeMax,
  cellSpacing = DEFAULTS.cellSpacing,
} = {}) {
  validateOptions({
    seed,
    roomCount,
    extraConnectionRatio,
    roomSizeMin,
    roomSizeMax,
    cellSpacing,
  });

  const cellPrng = createPrng((seed ^ 0x726f6f6d) >>> 0);
  const mazePrng = createPrng((seed ^ 0x6d617a65) >>> 0);
  const roomPrng = createPrng((seed ^ 0x9e3779b9) >>> 0);
  const loopPrng = createPrng((seed ^ 0x51ed270b) >>> 0);

  const generatedCells = buildConnectedCells(
    roomCount,
    cellPrng,
  );
  const originalAdjacency = buildAdjacency(
    generatedCells.cells,
  );
  const carvedTree = carveMazeTree(
    generatedCells.cells,
    originalAdjacency,
    mazePrng,
  );
  const remapped = remapForStartGoal(
    generatedCells.cells,
    carvedTree,
  );
  const loops = addLoops({
    cells: remapped.cells,
    treeEdges: remapped.treeEdges,
    extraConnectionRatio,
    prng: loopPrng,
  });
  const rooms = buildRooms({
    cells: remapped.cells,
    roomSizeMin,
    roomSizeMax,
    cellSpacing,
    prng: roomPrng,
  });
  const finalEdges = [
    ...remapped.treeEdges,
    ...loops.extraEdges,
  ];

  validateGenerated({
    rooms,
    treeEdges: remapped.treeEdges,
    finalEdges,
  });

  const deadEnds = new Map(
    rooms.map((_, index) => [index, 0]),
  );
  for (const edge of finalEdges) {
    deadEnds.set(edge.a, deadEnds.get(edge.a) + 1);
    deadEnds.set(edge.b, deadEnds.get(edge.b) + 1);
  }

  return {
    algorithm: 'rooms-mazes',
    algorithmVersion: ROOMS_MAZES_ALGORITHM_VERSION,
    seed,
    options: {
      roomCount,
      extraConnectionRatio,
      roomSizeMin,
      roomSizeMax,
      cellSpacing,
    },
    grid: {
      width: generatedCells.width,
      height: generatedCells.height,
    },
    cells: remapped.cells.map((cell, index) => ({
      index,
      x: cell.x,
      z: cell.z,
    })),
    rooms,
    treeEdges: remapped.treeEdges,
    extraEdges: loops.extraEdges,
    finalEdges,
    diagnostics: {
      roomCount,
      treeEdgeCount: remapped.treeEdges.length,
      extraCandidateCount: loops.candidates.length,
      extraConnectionTarget: loops.target,
      extraEdgeCount: loops.extraEdges.length,
      cycleRank: finalEdges.length - rooms.length + 1,
      deadEndCount: [...deadEnds.values()]
        .filter((degree) => degree === 1).length,
      treeDiameterLength: remapped.diameterLength,
    },
  };
}
