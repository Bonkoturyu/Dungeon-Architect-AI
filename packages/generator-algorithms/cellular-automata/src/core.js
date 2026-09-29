export const CELLULAR_AUTOMATA_ALGORITHM_VERSION = '1';

const DEFAULTS = Object.freeze({
  roomSizeMin: 7,
  roomSizeMax: 9,
  cellSpacing: 14,
  initialWallProbability: 0.45,
  smoothingIterations: 4,
  wallThreshold: 5,
});

const CARDINAL = Object.freeze([
  Object.freeze({ dx: 1, dz: 0 }),
  Object.freeze({ dx: -1, dz: 0 }),
  Object.freeze({ dx: 0, dz: 1 }),
  Object.freeze({ dx: 0, dz: -1 }),
]);

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

function parseKey(value) {
  const [x, z] = value.split(',').map(Number);
  return { x, z };
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
  initialWallProbability,
  smoothingIterations,
  wallThreshold,
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
    typeof initialWallProbability !== 'number' ||
    !Number.isFinite(initialWallProbability) ||
    initialWallProbability < 0.1 ||
    initialWallProbability > 0.9
  ) {
    throw new RangeError('initialWallProbability must be between 0.1 and 0.9');
  }
  if (
    !Number.isInteger(smoothingIterations) ||
    smoothingIterations < 0 ||
    smoothingIterations > 8
  ) {
    throw new RangeError('smoothingIterations must be an integer between 0 and 8');
  }
  if (!Number.isInteger(wallThreshold) || wallThreshold < 1 || wallThreshold > 8) {
    throw new RangeError('wallThreshold must be an integer between 1 and 8');
  }
}

function gridDimensions(roomCount) {
  const side = Math.max(
    7,
    Math.ceil(Math.sqrt(roomCount * 3)) + 2,
  );
  return { width: side, height: side };
}

function isInterior(x, z, width, height) {
  return x > 0 && z > 0 && x < width - 1 && z < height - 1;
}

function createInitialOpenSet({ width, height, wallProbability, prng }) {
  const open = new Set();
  for (let z = 1; z < height - 1; z += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (prng() >= wallProbability) open.add(key(x, z));
    }
  }
  const centerX = Math.floor(width / 2);
  const centerZ = Math.floor(height / 2);
  open.add(key(centerX, centerZ));
  return open;
}

function countWallNeighbors(open, x, z, width, height) {
  let walls = 0;
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dz === 0) continue;
      const nx = x + dx;
      const nz = z + dz;
      if (
        nx < 0 || nz < 0 || nx >= width || nz >= height ||
        !open.has(key(nx, nz))
      ) {
        walls += 1;
      }
    }
  }
  return walls;
}

function smoothOpenSet(open, { width, height, iterations, wallThreshold }) {
  let current = new Set(open);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = new Set();
    for (let z = 1; z < height - 1; z += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const wallNeighbors = countWallNeighbors(current, x, z, width, height);
        if (wallNeighbors < wallThreshold) next.add(key(x, z));
      }
    }
    current = next;
  }
  current.add(key(Math.floor(width / 2), Math.floor(height / 2)));
  return current;
}

function components(open) {
  const remaining = new Set(open);
  const result = [];

  while (remaining.size > 0) {
    const start = [...remaining].sort()[0];
    const component = new Set([start]);
    const queue = [start];
    remaining.delete(start);

    while (queue.length > 0) {
      const currentKey = queue.shift();
      const current = parseKey(currentKey);
      for (const direction of CARDINAL) {
        const nextKey = key(
          current.x + direction.dx,
          current.z + direction.dz,
        );
        if (!remaining.has(nextKey)) continue;
        remaining.delete(nextKey);
        component.add(nextKey);
        queue.push(nextKey);
      }
    }
    result.push(component);
  }

  return result.sort((left, right) =>
    right.size - left.size ||
    [...left].sort()[0].localeCompare([...right].sort()[0]),
  );
}

function repairLargestComponent({
  open,
  component,
  roomCount,
  width,
  height,
  prng,
}) {
  const repairedOpen = new Set(open);
  const repaired = new Set(component);
  let carveCount = 0;

  while (repaired.size < roomCount) {
    const frontier = new Map();
    for (const cellKey of repaired) {
      const cell = parseKey(cellKey);
      for (const direction of CARDINAL) {
        const nx = cell.x + direction.dx;
        const nz = cell.z + direction.dz;
        if (!isInterior(nx, nz, width, height)) continue;
        const nextKey = key(nx, nz);
        if (repaired.has(nextKey)) continue;
        if (!frontier.has(nextKey)) {
          frontier.set(nextKey, { x: nx, z: nz });
        }
      }
    }

    const candidates = [...frontier.values()].sort((a, b) =>
      a.z - b.z || a.x - b.x,
    );
    if (candidates.length === 0) {
      throw new Error('Cellular Automata repair frontier exhausted');
    }

    const chosen = candidates[Math.floor(prng() * candidates.length)];
    const chosenKey = key(chosen.x, chosen.z);
    repaired.add(chosenKey);
    repairedOpen.add(chosenKey);
    carveCount += 1;
  }

  return {
    open: repairedOpen,
    component: repaired,
    carveCount,
  };
}

function selectConnectedCells(component, roomCount, prng) {
  const available = [...component].sort();
  const startKey = available[Math.floor(prng() * available.length)];
  const selectedKeys = [startKey];
  const selected = new Set([startKey]);
  const indexByKey = new Map([[startKey, 0]]);
  const treeEdges = [];
  const frontier = new Map();

  function addFrontier(fromKey) {
    const from = parseKey(fromKey);
    for (const direction of CARDINAL) {
      const nextKey = key(from.x + direction.dx, from.z + direction.dz);
      if (!component.has(nextKey) || selected.has(nextKey)) continue;
      if (!frontier.has(nextKey)) frontier.set(nextKey, fromKey);
    }
  }

  addFrontier(startKey);

  while (selectedKeys.length < roomCount) {
    const candidateKeys = [...frontier.keys()].sort();
    if (candidateKeys.length === 0) {
      throw new Error('Cellular Automata connected selection frontier exhausted');
    }
    const chosenKey = candidateKeys[Math.floor(prng() * candidateKeys.length)];
    const parentKey = frontier.get(chosenKey);
    frontier.delete(chosenKey);
    if (selected.has(chosenKey)) continue;

    const childIndex = selectedKeys.length;
    const parentIndex = indexByKey.get(parentKey);
    selected.add(chosenKey);
    selectedKeys.push(chosenKey);
    indexByKey.set(chosenKey, childIndex);
    treeEdges.push({
      a: parentIndex,
      b: childIndex,
      kind: 'cellular-automata-tree',
    });
    addFrontier(chosenKey);
  }

  return {
    cells: selectedKeys.map(parseKey),
    treeEdges,
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

function buildLoopEdges(cells, treeEdges, ratio, prng) {
  const indexByKey = new Map(
    cells.map((cell, index) => [key(cell.x, cell.z), index]),
  );
  const treeKeys = new Set(treeEdges.map((edge) => edgeKey(edge.a, edge.b)));
  const candidates = [];

  for (let a = 0; a < cells.length; a += 1) {
    for (const direction of CARDINAL) {
      const b = indexByKey.get(
        key(cells[a].x + direction.dx, cells[a].z + direction.dz),
      );
      if (!Number.isInteger(b) || b <= a) continue;
      const candidateKey = edgeKey(a, b);
      if (treeKeys.has(candidateKey)) continue;
      candidates.push({ a, b, kind: 'cellular-automata-loop' });
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
      'Cellular Automata tree edge mismatch: expected ' +
        (rooms.length - 1) + ', got ' + treeEdges.length,
    );
  }

  const seen = new Set();
  const adjacency = new Map(rooms.map((_, index) => [index, []]));
  for (const edge of finalEdges) {
    if (edge.a === edge.b) throw new Error('Cellular Automata generated a self edge');
    const value = edgeKey(edge.a, edge.b);
    if (seen.has(value)) throw new Error('Cellular Automata generated duplicate edge: ' + value);
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
        'Cellular Automata non-cardinal edge: ' + left.id + '/' + right.id,
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
      'Cellular Automata graph disconnected: ' + visited.size + '/' + rooms.length,
    );
  }
}

export function generateCellularAutomataCore({
  seed,
  roomCount = 8,
  extraConnectionRatio = 0.5,
  roomSizeMin = DEFAULTS.roomSizeMin,
  roomSizeMax = DEFAULTS.roomSizeMax,
  cellSpacing = DEFAULTS.cellSpacing,
  initialWallProbability = DEFAULTS.initialWallProbability,
  smoothingIterations = DEFAULTS.smoothingIterations,
  wallThreshold = DEFAULTS.wallThreshold,
} = {}) {
  validateOptions({
    seed,
    roomCount,
    extraConnectionRatio,
    roomSizeMin,
    roomSizeMax,
    cellSpacing,
    initialWallProbability,
    smoothingIterations,
    wallThreshold,
  });

  const initialPrng = createPrng((seed ^ 0x63617665) >>> 0);
  const repairPrng = createPrng((seed ^ 0x72657072) >>> 0);
  const selectPrng = createPrng((seed ^ 0x73656c65) >>> 0);
  const roomPrng = createPrng((seed ^ 0x726f6f6d) >>> 0);
  const loopPrng = createPrng((seed ^ 0x6c6f6f70) >>> 0);

  const grid = gridDimensions(roomCount);
  const initialOpen = createInitialOpenSet({
    ...grid,
    wallProbability: initialWallProbability,
    prng: initialPrng,
  });
  const smoothedOpen = smoothOpenSet(initialOpen, {
    ...grid,
    iterations: smoothingIterations,
    wallThreshold,
  });
  const componentList = components(smoothedOpen);
  const largest = componentList[0] ?? new Set();
  const repaired = repairLargestComponent({
    open: smoothedOpen,
    component: largest,
    roomCount,
    ...grid,
    prng: repairPrng,
  });
  const selected = selectConnectedCells(
    repaired.component,
    roomCount,
    selectPrng,
  );
  const remapped = remapDiameterEndpoints(
    selected.cells,
    selected.treeEdges,
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

  validateGenerated({ rooms, treeEdges: remapped.treeEdges, finalEdges });

  const degrees = new Map(rooms.map((_, index) => [index, 0]));
  for (const edge of finalEdges) {
    degrees.set(edge.a, degrees.get(edge.a) + 1);
    degrees.set(edge.b, degrees.get(edge.b) + 1);
  }

  return {
    algorithm: 'cellular-automata',
    algorithmVersion: CELLULAR_AUTOMATA_ALGORITHM_VERSION,
    seed,
    options: {
      roomCount,
      extraConnectionRatio,
      roomSizeMin,
      roomSizeMax,
      cellSpacing,
      initialWallProbability,
      smoothingIterations,
      wallThreshold,
    },
    grid: {
      width: grid.width,
      height: grid.height,
      openCells: [...repaired.open].sort().map(parseKey),
    },
    cells: remapped.cells.map((cell, index) => ({ index, x: cell.x, z: cell.z })),
    rooms,
    treeEdges: remapped.treeEdges,
    extraEdges: loops.extraEdges,
    finalEdges,
    diagnostics: {
      roomCount,
      initialOpenCount: initialOpen.size,
      smoothedOpenCount: smoothedOpen.size,
      componentCount: componentList.length,
      largestComponentSizeBeforeRepair: largest.size,
      repairCarveCount: repaired.carveCount,
      usableComponentSize: repaired.component.size,
      treeEdgeCount: remapped.treeEdges.length,
      treeDiameterLength: remapped.treeDiameterLength,
      extraCandidateCount: loops.candidates.length,
      extraConnectionTarget: loops.target,
      extraEdgeCount: loops.extraEdges.length,
      cycleRank: finalEdges.length - rooms.length + 1,
      deadEndCount: [...degrees.values()].filter((degree) => degree === 1).length,
    },
  };
}
