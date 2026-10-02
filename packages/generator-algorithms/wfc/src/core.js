export const WFC_ALGORITHM_VERSION = '1';

const NORTH = 1;
const EAST = 2;
const SOUTH = 4;
const WEST = 8;
const ALL_SOCKET_MASK = NORTH | EAST | SOUTH | WEST;

const DIRECTIONS = Object.freeze([
  Object.freeze({ name: 'north', bit: NORTH, opposite: SOUTH, dx: 0, dz: -1 }),
  Object.freeze({ name: 'east', bit: EAST, opposite: WEST, dx: 1, dz: 0 }),
  Object.freeze({ name: 'south', bit: SOUTH, opposite: NORTH, dx: 0, dz: 1 }),
  Object.freeze({ name: 'west', bit: WEST, opposite: EAST, dx: -1, dz: 0 }),
]);

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

function key(x, z) {
  return x + ',' + z;
}

function edgeKey(a, b) {
  return a < b ? a + '|' + b : b + '|' + a;
}

function bitCount(value) {
  let count = 0;
  let remaining = value >>> 0;
  while (remaining !== 0) {
    count += remaining & 1;
    remaining >>>= 1;
  }
  return count;
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

function buildSerpentineCells(roomCount, seed) {
  const width = Math.max(2, Math.ceil(Math.sqrt(roomCount)));
  const height = Math.ceil(roomCount / width);
  const raw = [];

  for (let z = 0; z < height; z += 1) {
    const remaining = roomCount - raw.length;
    const rowCount = Math.min(width, remaining);
    const xs =
      z % 2 === 0
        ? Array.from(
            { length: rowCount },
            (_, x) => x,
          )
        : Array.from(
            { length: rowCount },
            (_, offset) => width - 1 - offset,
          );
    for (const x of xs) raw.push({ x, z });
  }

  const rotation = seed % 4;
  const reflected = ((seed >>> 2) & 1) === 1;
  const cells = raw.map((cell) => {
    let x = cell.x;
    let z = cell.z;
    if (reflected) x = -x;
    for (let turn = 0; turn < rotation; turn += 1) {
      const nextX = -z;
      const nextZ = x;
      x = nextX;
      z = nextZ;
    }
    return { x, z };
  });

  return {
    width,
    height,
    rotation,
    reflected,
    cells,
  };
}

function directionBetween(left, right) {
  const dx = right.x - left.x;
  const dz = right.z - left.z;
  return DIRECTIONS.find(
    (direction) =>
      direction.dx === dx && direction.dz === dz,
  ) ?? null;
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
    for (const direction of DIRECTIONS) {
      const other = indexByKey.get(
        key(cell.x + direction.dx, cell.z + direction.dz),
      );
      if (!Number.isInteger(other)) continue;
      adjacency.get(index).push({
        index: other,
        direction,
      });
    }
    adjacency.get(index).sort((left, right) =>
      left.index - right.index ||
      left.direction.bit - right.direction.bit,
    );
  }

  return adjacency;
}

function buildRequiredMasks(cells) {
  const required = Array(cells.length).fill(0);
  const edges = [];

  for (let index = 0; index < cells.length - 1; index += 1) {
    const next = index + 1;
    const direction = directionBetween(
      cells[index],
      cells[next],
    );
    if (!direction) {
      throw new Error(
        'WFC backbone contains non-cardinal consecutive cells: ' +
          index + '/' + next,
      );
    }
    required[index] |= direction.bit;
    required[next] |= direction.opposite;
    edges.push({
      a: index,
      b: next,
      kind: 'wfc-backbone',
    });
  }

  return { required, edges };
}

function availableMaskFor(index, adjacency) {
  return adjacency.get(index).reduce(
    (mask, entry) => mask | entry.direction.bit,
    0,
  );
}

function initialDomain(requiredMask, availableMask) {
  const domain = [];
  for (let mask = 0; mask <= ALL_SOCKET_MASK; mask += 1) {
    if ((mask & requiredMask) !== requiredMask) continue;
    if ((mask & ~availableMask) !== 0) continue;
    domain.push(mask);
  }
  if (domain.length === 0) {
    throw new Error(
      'WFC initial domain is empty for required=' +
        requiredMask + ' available=' + availableMask,
    );
  }
  return domain;
}

function socketValues(domain, bit) {
  let hasClosed = false;
  let hasOpen = false;
  for (const mask of domain) {
    if ((mask & bit) !== 0) hasOpen = true;
    else hasClosed = true;
  }
  return { hasClosed, hasOpen };
}

function propagate(domains, adjacency, startIndices) {
  const queue = [...startIndices];
  const queued = new Set(queue);
  let revisions = 0;

  while (queue.length > 0) {
    const index = queue.shift();
    queued.delete(index);
    const sourceDomain = domains[index];

    for (const entry of adjacency.get(index)) {
      const allowed = socketValues(
        sourceDomain,
        entry.direction.bit,
      );
      const targetIndex = entry.index;
      const before = domains[targetIndex];
      const filtered = before.filter((mask) => {
        const open =
          (mask & entry.direction.opposite) !== 0;
        return open ? allowed.hasOpen : allowed.hasClosed;
      });

      if (filtered.length === 0) {
        throw new Error(
          'WFC contradiction at cell ' +
            targetIndex + ' after propagating from ' + index,
        );
      }

      if (filtered.length === before.length) continue;
      domains[targetIndex] = filtered;
      revisions += 1;
      if (!queued.has(targetIndex)) {
        queue.push(targetIndex);
        queued.add(targetIndex);
      }
    }
  }

  return revisions;
}

function tileWeight({
  mask,
  requiredMask,
  availableMask,
  extraConnectionRatio,
}) {
  const optionalAvailable =
    availableMask & ~requiredMask;
  const optionalMask =
    mask & optionalAvailable;
  const optionalCount = bitCount(optionalAvailable);
  const selectedCount = bitCount(optionalMask);

  if (optionalCount === 0) return 1;
  if (extraConnectionRatio === 0) {
    return selectedCount === 0 ? 1 : 0;
  }
  if (extraConnectionRatio === 1) {
    return selectedCount === optionalCount ? 1 : 0;
  }

  return (
    extraConnectionRatio ** selectedCount *
    (1 - extraConnectionRatio) **
      (optionalCount - selectedCount)
  );
}

function weightedPick({
  domain,
  requiredMask,
  availableMask,
  extraConnectionRatio,
  prng,
}) {
  const weighted = domain.map((mask) => ({
    mask,
    weight: tileWeight({
      mask,
      requiredMask,
      availableMask,
      extraConnectionRatio,
    }),
  }));
  const total = weighted.reduce(
    (sum, entry) => sum + entry.weight,
    0,
  );

  if (!(total > 0)) {
    throw new Error('WFC tile weights collapsed to zero');
  }

  let cursor = prng() * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.mask;
  }
  return weighted.at(-1).mask;
}

function solveWfc({
  cells,
  adjacency,
  requiredMasks,
  extraConnectionRatio,
  prng,
}) {
  const availableMasks = cells.map((_, index) =>
    availableMaskFor(index, adjacency),
  );
  const domains = cells.map((_, index) =>
    initialDomain(
      requiredMasks[index],
      availableMasks[index],
    ),
  );

  let collapseCount = 0;
  let propagationRevisions = propagate(
    domains,
    adjacency,
    cells.map((_, index) => index),
  );
  const entropyTrace = [];

  while (domains.some((domain) => domain.length > 1)) {
    let minEntropy = Infinity;
    const candidates = [];

    for (let index = 0; index < domains.length; index += 1) {
      const entropy = domains[index].length;
      if (entropy <= 1) continue;
      if (entropy < minEntropy) {
        minEntropy = entropy;
        candidates.length = 0;
        candidates.push(index);
      } else if (entropy === minEntropy) {
        candidates.push(index);
      }
    }

    const chosenIndex =
      candidates[Math.floor(prng() * candidates.length)];
    const chosenMask = weightedPick({
      domain: domains[chosenIndex],
      requiredMask: requiredMasks[chosenIndex],
      availableMask: availableMasks[chosenIndex],
      extraConnectionRatio,
      prng,
    });

    entropyTrace.push({
      index: chosenIndex,
      entropy: domains[chosenIndex].length,
      chosenMask,
    });
    domains[chosenIndex] = [chosenMask];
    collapseCount += 1;
    propagationRevisions += propagate(
      domains,
      adjacency,
      [chosenIndex],
    );
  }

  return {
    masks: domains.map((domain) => domain[0]),
    collapseCount,
    propagationRevisions,
    entropyTrace,
  };
}

function tileName(mask) {
  const degree = bitCount(mask);
  if (degree === 0) return 'isolated';
  if (degree === 1) return 'dead-end';
  if (degree === 4) return 'cross';
  if (degree === 3) return 't-junction';
  if (
    mask === (NORTH | SOUTH) ||
    mask === (EAST | WEST)
  ) {
    return 'straight';
  }
  return 'turn';
}

function socketsFor(mask) {
  return DIRECTIONS
    .filter((direction) => (mask & direction.bit) !== 0)
    .map((direction) => direction.name);
}

function buildEdges({
  cells,
  adjacency,
  masks,
  backboneEdges,
}) {
  const backboneKeys = new Set(
    backboneEdges.map((edge) => edgeKey(edge.a, edge.b)),
  );
  const finalEdges = [];

  for (let a = 0; a < cells.length; a += 1) {
    for (const entry of adjacency.get(a)) {
      const b = entry.index;
      if (b <= a) continue;
      const openA =
        (masks[a] & entry.direction.bit) !== 0;
      const openB =
        (masks[b] & entry.direction.opposite) !== 0;
      if (openA !== openB) {
        throw new Error(
          'WFC socket disagreement after collapse: ' + a + '/' + b,
        );
      }
      if (!openA) continue;
      const backbone = backboneKeys.has(edgeKey(a, b));
      finalEdges.push({
        a,
        b,
        kind: backbone ? 'wfc-backbone' : 'wfc-extra',
      });
    }
  }

  finalEdges.sort((left, right) =>
    left.a - right.a || left.b - right.b,
  );

  return {
    finalEdges,
    extraEdges: finalEdges.filter(
      (edge) => edge.kind === 'wfc-extra',
    ),
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

function validateGenerated({
  rooms,
  backboneEdges,
  finalEdges,
}) {
  if (backboneEdges.length !== rooms.length - 1) {
    throw new Error(
      'WFC backbone edge mismatch: expected ' +
        (rooms.length - 1) + ', got ' + backboneEdges.length,
    );
  }

  const seen = new Set();
  const adjacency = new Map(
    rooms.map((_, index) => [index, []]),
  );

  for (const edge of finalEdges) {
    if (edge.a === edge.b) {
      throw new Error('WFC generated a self edge');
    }
    const value = edgeKey(edge.a, edge.b);
    if (seen.has(value)) {
      throw new Error('WFC generated duplicate edge: ' + value);
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
        'WFC generated non-cardinal edge: ' +
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
      'WFC graph disconnected: ' +
        visited.size + '/' + rooms.length,
    );
  }
}

export function generateWfcCore({
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

  const collapsePrng =
    createPrng((seed ^ 0x77666331) >>> 0);
  const roomPrng =
    createPrng((seed ^ 0x726f6f6d) >>> 0);

  const lattice =
    buildSerpentineCells(roomCount, seed);
  const adjacency = buildAdjacency(lattice.cells);
  const backbone =
    buildRequiredMasks(lattice.cells);
  const solved = solveWfc({
    cells: lattice.cells,
    adjacency,
    requiredMasks: backbone.required,
    extraConnectionRatio,
    prng: collapsePrng,
  });
  const edgeResult = buildEdges({
    cells: lattice.cells,
    adjacency,
    masks: solved.masks,
    backboneEdges: backbone.edges,
  });
  const rooms = buildRooms(lattice.cells, {
    roomSizeMin,
    roomSizeMax,
    cellSpacing,
    prng: roomPrng,
  });

  validateGenerated({
    rooms,
    backboneEdges: backbone.edges,
    finalEdges: edgeResult.finalEdges,
  });

  const candidateAdjacencyCount =
    [...adjacency.values()]
      .reduce((sum, entries) => sum + entries.length, 0) / 2;
  const optionalCandidateCount =
    candidateAdjacencyCount - backbone.edges.length;
  const histogram = {};
  const tiles = solved.masks.map((mask, index) => {
    const name = tileName(mask);
    histogram[name] = (histogram[name] ?? 0) + 1;
    return {
      index,
      mask,
      name,
      sockets: socketsFor(mask),
    };
  });

  return {
    algorithm: 'wfc',
    algorithmVersion: WFC_ALGORITHM_VERSION,
    seed,
    options: {
      roomCount,
      extraConnectionRatio,
      roomSizeMin,
      roomSizeMax,
      cellSpacing,
    },
    lattice: {
      width: lattice.width,
      height: lattice.height,
      rotation: lattice.rotation,
      reflected: lattice.reflected,
    },
    cells: lattice.cells.map((cell, index) => ({
      index,
      x: cell.x,
      z: cell.z,
    })),
    tiles,
    rooms,
    backboneEdges: backbone.edges,
    extraEdges: edgeResult.extraEdges,
    finalEdges: edgeResult.finalEdges,
    diagnostics: {
      roomCount,
      treeEdgeCount: backbone.edges.length,
      candidateAdjacencyCount,
      optionalCandidateCount,
      extraEdgeCount: edgeResult.extraEdges.length,
      cycleRank:
        edgeResult.finalEdges.length - rooms.length + 1,
      collapseCount: solved.collapseCount,
      propagationRevisions:
        solved.propagationRevisions,
      contradictionCount: 0,
      tileHistogram: histogram,
      entropyTrace: solved.entropyTrace,
    },
  };
}
