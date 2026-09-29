export const RANDOM_WALK_ALGORITHM_VERSION = '1';

const DEFAULTS = Object.freeze({
  roomSizeMin: 7,
  roomSizeMax: 9,
  cellSpacing: 14,
  directionPersistence: 0.58,
  escapeAfter: 48,
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
  return x + ',' + z;
}

function edgeKey(a, b) {
  return a < b ? a + '|' + b : b + '|' + a;
}

const DIRECTIONS = Object.freeze([
  Object.freeze({ dx: 1, dz: 0, name: 'east' }),
  Object.freeze({ dx: -1, dz: 0, name: 'west' }),
  Object.freeze({ dx: 0, dz: 1, name: 'south' }),
  Object.freeze({ dx: 0, dz: -1, name: 'north' }),
]);

function validateOptions({
  seed,
  roomCount,
  extraConnectionRatio,
  roomSizeMin,
  roomSizeMax,
  cellSpacing,
  directionPersistence,
  escapeAfter,
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
  if (
    typeof directionPersistence !== 'number' ||
    !Number.isFinite(directionPersistence) ||
    directionPersistence < 0 ||
    directionPersistence > 0.95
  ) {
    throw new RangeError('directionPersistence must be between 0 and 0.95');
  }
  if (!Number.isInteger(escapeAfter) || escapeAfter < 8 || escapeAfter > 512) {
    throw new RangeError('escapeAfter must be an integer between 8 and 512');
  }
}

function unvisitedDirections(cell, visited) {
  return DIRECTIONS.filter(
    (direction) =>
      !visited.has(
        key(cell.x + direction.dx, cell.z + direction.dz),
      ),
  );
}

function chooseDirection(prng, previous, persistence) {
  if (previous && prng() < persistence) return previous;
  return DIRECTIONS[Math.floor(prng() * DIRECTIONS.length)];
}

function buildWalk({
  roomCount,
  directionPersistence,
  escapeAfter,
  prng,
}) {
  const start = { x: 0, z: 0 };
  const cells = [start];
  const indexByKey = new Map([[key(0, 0), 0]]);
  const visited = new Set([key(0, 0)]);
  const discoveryEdges = [];
  let current = start;
  let previousDirection = null;
  let stepCount = 0;
  let revisitCount = 0;
  let escapeCount = 0;
  let stagnantSteps = 0;
  const maxSteps = Math.max(4096, roomCount * 2048);

  while (cells.length < roomCount && stepCount < maxSteps) {
    if (stagnantSteps >= escapeAfter) {
      const frontier = cells.filter(
        (cell) => unvisitedDirections(cell, visited).length > 0,
      );
      if (frontier.length === 0) {
        throw new Error('Random Walk frontier unexpectedly exhausted');
      }
      current = frontier[Math.floor(prng() * frontier.length)];
      previousDirection = null;
      stagnantSteps = 0;
      escapeCount += 1;
    }

    const direction = chooseDirection(
      prng,
      previousDirection,
      directionPersistence,
    );
    const next = {
      x: current.x + direction.dx,
      z: current.z + direction.dz,
    };
    const nextKey = key(next.x, next.z);
    stepCount += 1;

    if (!visited.has(nextKey)) {
      const parentIndex = indexByKey.get(key(current.x, current.z));
      const childIndex = cells.length;
      visited.add(nextKey);
      indexByKey.set(nextKey, childIndex);
      cells.push(next);
      discoveryEdges.push({
        a: parentIndex,
        b: childIndex,
        kind: 'random-walk-discovery',
        step: stepCount,
      });
      stagnantSteps = 0;
    } else {
      revisitCount += 1;
      stagnantSteps += 1;
    }

    current = next;
    previousDirection = direction;
  }

  if (cells.length !== roomCount) {
    throw new Error(
      'Random Walk could not discover requested Room count: ' +
        cells.length + '/' + roomCount,
    );
  }

  return {
    cells,
    discoveryEdges,
    stepCount,
    revisitCount,
    escapeCount,
  };
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
  const oldOrder = [
    first.index,
    ...middle.map((entry) => entry.index),
    second.index,
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
    treeDiameterLength: second.distance,
  };
}

function buildRooms(cells, {
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
    id: 'room-' + String(index + 1).padStart(3, '0'),
    cellX: cell.x,
    cellZ: cell.z,
    x: (cell.x - centerX) * cellSpacing,
    z: (cell.z - centerZ) * cellSpacing,
    width: randomInt(prng, roomSizeMin, roomSizeMax),
    depth: randomInt(prng, roomSizeMin, roomSizeMax),
  }));
}

function buildLoopEdges(cells, treeEdges, ratio, prng) {
  const indexByKey = new Map(
    cells.map((cell, index) => [key(cell.x, cell.z), index]),
  );
  const treeKeys = new Set(
    treeEdges.map((edge) => edgeKey(edge.a, edge.b)),
  );
  const candidates = [];

  for (let a = 0; a < cells.length; a += 1) {
    for (const direction of DIRECTIONS) {
      const b = indexByKey.get(
        key(
          cells[a].x + direction.dx,
          cells[a].z + direction.dz,
        ),
      );
      if (!Number.isInteger(b) || b <= a) continue;
      const candidateKey = edgeKey(a, b);
      if (treeKeys.has(candidateKey)) continue;
      candidates.push({
        a,
        b,
        kind: 'random-walk-loop',
      });
    }
  }

  const shuffled = shuffle(candidates, prng);
  const target = Math.round(ratio * shuffled.length);
  const extraEdges = shuffled
    .slice(0, target)
    .sort((left, right) => left.a - right.a || left.b - right.b);

  return { candidates, target, extraEdges };
}

function validateGenerated({ rooms, treeEdges, finalEdges }) {
  if (treeEdges.length !== rooms.length - 1) {
    throw new Error(
      'Random Walk discovery tree edge mismatch: expected ' +
        (rooms.length - 1) + ', got ' + treeEdges.length,
    );
  }

  const seen = new Set();
  const adjacency = new Map(
    rooms.map((_, index) => [index, []]),
  );
  for (const edge of finalEdges) {
    if (edge.a === edge.b) {
      throw new Error('Random Walk generated a self edge');
    }
    const value = edgeKey(edge.a, edge.b);
    if (seen.has(value)) {
      throw new Error('Random Walk generated duplicate edge: ' + value);
    }
    seen.add(value);
    adjacency.get(edge.a).push(edge.b);
    adjacency.get(edge.b).push(edge.a);

    const left = rooms[edge.a];
    const right = rooms[edge.b];
    const distance =
      Math.abs(left.cellX - right.cellX) +
      Math.abs(left.cellZ - right.cellZ);
    if (distance !== 1) {
      throw new Error(
        'Random Walk non-cardinal edge: ' +
          left.id + '/' + right.id,
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
      'Random Walk graph disconnected: ' +
        visited.size + '/' + rooms.length,
    );
  }
}

export function generateRandomWalkCore({
  seed,
  roomCount = 8,
  extraConnectionRatio = 0.5,
  roomSizeMin = DEFAULTS.roomSizeMin,
  roomSizeMax = DEFAULTS.roomSizeMax,
  cellSpacing = DEFAULTS.cellSpacing,
  directionPersistence = DEFAULTS.directionPersistence,
  escapeAfter = DEFAULTS.escapeAfter,
} = {}) {
  validateOptions({
    seed,
    roomCount,
    extraConnectionRatio,
    roomSizeMin,
    roomSizeMax,
    cellSpacing,
    directionPersistence,
    escapeAfter,
  });

  const walkPrng = createPrng((seed ^ 0x6472756e) >>> 0);
  const roomPrng = createPrng((seed ^ 0x726f6f6d) >>> 0);
  const loopPrng = createPrng((seed ^ 0x6c6f6f70) >>> 0);

  const walk = buildWalk({
    roomCount,
    directionPersistence,
    escapeAfter,
    prng: walkPrng,
  });
  const remapped = remapDiameterEndpoints(
    walk.cells,
    walk.discoveryEdges,
  );
  const rooms = buildRooms(remapped.cells, {
    roomSizeMin,
    roomSizeMax,
    cellSpacing,
    prng: roomPrng,
  });
  const loops = buildLoopEdges(
    remapped.cells,
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

  const degrees = new Map(
    rooms.map((_, index) => [index, 0]),
  );
  for (const edge of finalEdges) {
    degrees.set(edge.a, degrees.get(edge.a) + 1);
    degrees.set(edge.b, degrees.get(edge.b) + 1);
  }

  return {
    algorithm: 'random-walk',
    algorithmVersion: RANDOM_WALK_ALGORITHM_VERSION,
    seed,
    options: {
      roomCount,
      extraConnectionRatio,
      roomSizeMin,
      roomSizeMax,
      cellSpacing,
      directionPersistence,
      escapeAfter,
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
      walkStepCount: walk.stepCount,
      revisitCount: walk.revisitCount,
      escapeCount: walk.escapeCount,
      treeEdgeCount: remapped.treeEdges.length,
      treeDiameterLength: remapped.treeDiameterLength,
      extraCandidateCount: loops.candidates.length,
      extraConnectionTarget: loops.target,
      extraEdgeCount: loops.extraEdges.length,
      cycleRank: finalEdges.length - rooms.length + 1,
      deadEndCount: [...degrees.values()]
        .filter((degree) => degree === 1).length,
    },
  };
}
