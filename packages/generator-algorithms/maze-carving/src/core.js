export const MAZE_CARVING_ALGORITHM_VERSION = '1';

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

function edgeKey(a, b) {
  return a < b ? a + '|' + b : b + '|' + a;
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

function buildCompactCells(roomCount) {
  const width = Math.ceil(Math.sqrt(roomCount));
  const height = Math.ceil(roomCount / width);
  const cells = [];

  for (let z = 0; z < height; z += 1) {
    const remaining = roomCount - cells.length;
    const rowCount = Math.min(width, remaining);
    const offset = (width - rowCount) / 2;
    for (let x = 0; x < rowCount; x += 1) {
      cells.push({
        x: x + offset,
        z,
      });
    }
  }

  return { width, height, cells };
}

function buildCandidateWalls(cells) {
  const indexByKey = new Map(
    cells.map((cell, index) => [cell.x + ',' + cell.z, index]),
  );
  const edges = [];

  for (let a = 0; a < cells.length; a += 1) {
    const cell = cells[a];
    for (const [dx, dz] of [[1, 0], [0, 1]]) {
      const b = indexByKey.get((cell.x + dx) + ',' + (cell.z + dz));
      if (!Number.isInteger(b)) continue;
      edges.push({
        a,
        b,
        kind: 'maze-carving-wall',
      });
    }
  }

  return edges;
}

function carveKruskalTree(roomCount, candidates, prng) {
  const parent = Array.from({ length: roomCount }, (_, index) => index);
  const rank = Array(roomCount).fill(0);

  function find(value) {
    let current = value;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  }

  function union(left, right) {
    const rootLeft = find(left);
    const rootRight = find(right);
    if (rootLeft === rootRight) return false;
    if (rank[rootLeft] < rank[rootRight]) {
      parent[rootLeft] = rootRight;
    } else if (rank[rootLeft] > rank[rootRight]) {
      parent[rootRight] = rootLeft;
    } else {
      parent[rootRight] = rootLeft;
      rank[rootLeft] += 1;
    }
    return true;
  }

  const shuffled = shuffle(candidates, prng);
  const treeEdges = [];
  for (const edge of shuffled) {
    if (!union(edge.a, edge.b)) continue;
    treeEdges.push({
      a: edge.a,
      b: edge.b,
      kind: 'maze-carving-tree',
    });
    if (treeEdges.length === roomCount - 1) break;
  }

  if (treeEdges.length !== roomCount - 1) {
    throw new Error(
      'Maze Carving compact lattice is disconnected: carved ' +
        treeEdges.length + '/' + (roomCount - 1),
    );
  }

  return treeEdges;
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

function remapDiameterEndpoints(cells, treeEdges) {
  const first = farthest(0, cells.length, treeEdges);
  const second = farthest(first.index, cells.length, treeEdges);
  const middle = cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ index }) => index !== first.index && index !== second.index)
    .sort((left, right) =>
      left.cell.z - right.cell.z ||
      left.cell.x - right.cell.x ||
      left.index - right.index,
    );
  const oldOrder = [first.index, ...middle.map((entry) => entry.index), second.index];
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
    treeDiameterLength: second.distance,
  };
}

function buildRooms(cells, { roomSizeMin, roomSizeMax, cellSpacing, prng }) {
  const minX = Math.min(...cells.map((cell) => cell.x));
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const minZ = Math.min(...cells.map((cell) => cell.z));
  const maxZ = Math.max(...cells.map((cell) => cell.z));
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  return cells.map((cell, index) => ({
    id: 'room-' + String(index + 1).padStart(3, '0'),
    cellX: cell.x,
    cellZ: cell.z,
    x: (cell.x - centerX) * cellSpacing,
    z: (cell.z - centerZ) * cellSpacing,
    width: randomInt(prng, roomSizeMin, roomSizeMax),
    depth: randomInt(prng, roomSizeMin, roomSizeMax),
  }));
}

function remapCandidateEdges(candidates, originalCells, remappedCells) {
  const remappedIndexByKey = new Map(
    remappedCells.map((cell, index) => [cell.x + ',' + cell.z, index]),
  );
  return candidates.map((edge) => {
    const left = originalCells[edge.a];
    const right = originalCells[edge.b];
    return {
      a: remappedIndexByKey.get(left.x + ',' + left.z),
      b: remappedIndexByKey.get(right.x + ',' + right.z),
      kind: edge.kind,
    };
  });
}

function buildLoopEdges(candidates, treeEdges, ratio, prng) {
  const treeKeys = new Set(treeEdges.map((edge) => edgeKey(edge.a, edge.b)));
  const unused = candidates
    .filter((edge) => !treeKeys.has(edgeKey(edge.a, edge.b)))
    .map((edge) => ({
      a: edge.a,
      b: edge.b,
      kind: 'maze-carving-loop',
    }));

  const shuffled = shuffle(unused, prng);
  const target = Math.round(ratio * shuffled.length);
  const extraEdges = shuffled
    .slice(0, target)
    .sort((left, right) => left.a - right.a || left.b - right.b);
  return { candidates: unused, target, extraEdges };
}

function validateGenerated({ rooms, treeEdges, finalEdges }) {
  if (treeEdges.length !== rooms.length - 1) {
    throw new Error(
      'Maze Carving tree edge mismatch: expected ' +
        (rooms.length - 1) + ', got ' + treeEdges.length,
    );
  }

  const seen = new Set();
  const adjacency = new Map(rooms.map((_, index) => [index, []]));
  for (const edge of finalEdges) {
    if (edge.a === edge.b) throw new Error('Maze Carving generated a self edge');
    const value = edgeKey(edge.a, edge.b);
    if (seen.has(value)) throw new Error('Maze Carving generated duplicate edge: ' + value);
    seen.add(value);
    adjacency.get(edge.a).push(edge.b);
    adjacency.get(edge.b).push(edge.a);
    const left = rooms[edge.a];
    const right = rooms[edge.b];
    const distance =
      Math.abs(left.cellX - right.cellX) +
      Math.abs(left.cellZ - right.cellZ);
    if (Math.abs(distance - 1) > 1e-9) {
      throw new Error(
        'Maze Carving non-cardinal edge: ' + left.id + '/' + right.id,
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
      'Maze Carving graph disconnected: ' + visited.size + '/' + rooms.length,
    );
  }
}

export function generateMazeCarvingCore({
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

  const carvePrng = createPrng((seed ^ 0x6d617a65) >>> 0);
  const roomPrng = createPrng((seed ^ 0x726f6f6d) >>> 0);
  const loopPrng = createPrng((seed ^ 0x6c6f6f70) >>> 0);

  const footprint = buildCompactCells(roomCount);
  const candidateWalls = buildCandidateWalls(footprint.cells);
  const carvedTree = carveKruskalTree(
    roomCount,
    candidateWalls,
    carvePrng,
  );
  const remapped = remapDiameterEndpoints(
    footprint.cells,
    carvedTree,
  );
  const remappedCandidates = remapCandidateEdges(
    candidateWalls,
    footprint.cells,
    remapped.cells,
  );
  const rooms = buildRooms(remapped.cells, {
    roomSizeMin,
    roomSizeMax,
    cellSpacing,
    prng: roomPrng,
  });
  const loops = buildLoopEdges(
    remappedCandidates,
    remapped.treeEdges,
    extraConnectionRatio,
    loopPrng,
  );
  const finalEdges = [
    ...remapped.treeEdges,
    ...loops.extraEdges,
  ];

  validateGenerated({
    rooms,
    treeEdges: remapped.treeEdges,
    finalEdges,
  });

  const degrees = new Map(rooms.map((_, index) => [index, 0]));
  for (const edge of finalEdges) {
    degrees.set(edge.a, degrees.get(edge.a) + 1);
    degrees.set(edge.b, degrees.get(edge.b) + 1);
  }

  return {
    algorithm: 'maze-carving',
    algorithmVersion: MAZE_CARVING_ALGORITHM_VERSION,
    seed,
    options: {
      roomCount,
      extraConnectionRatio,
      roomSizeMin,
      roomSizeMax,
      cellSpacing,
    },
    grid: {
      width: footprint.width,
      height: footprint.height,
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
      candidateWallCount: candidateWalls.length,
      carvedWallCount: remapped.treeEdges.length,
      remainingWallCount: candidateWalls.length - remapped.treeEdges.length,
      treeDiameterLength: remapped.treeDiameterLength,
      extraCandidateCount: loops.candidates.length,
      extraConnectionTarget: loops.target,
      extraEdgeCount: loops.extraEdges.length,
      cycleRank: finalEdges.length - rooms.length + 1,
      deadEndCount: [...degrees.values()].filter((degree) => degree === 1).length,
    },
  };
}
