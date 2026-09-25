const ORIENTATION_COUNT = 8;

function validateGraph(graph) {
  if (!graph || !Array.isArray(graph.rooms) || !Array.isArray(graph.edges)) {
    throw new TypeError("graph must contain rooms and edges arrays");
  }
  if (!Number.isSafeInteger(graph.seed) || graph.seed < 0) {
    throw new TypeError("graph.seed must be a non-negative safe integer");
  }
}

function mix32(value) {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function pickVariant(seed, salt, count) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError("variant count must be a positive integer");
  }
  return mix32((seed ^ salt) >>> 0) % count;
}

function orientationPoint(x, z, orientation) {
  switch (orientation) {
    case 0: return { x, z };
    case 1: return { x: z, z: x };
    case 2: return { x: -x, z };
    case 3: return { x, z: -z };
    case 4: return { x: -x, z: -z };
    case 5: return { x: -z, z: x };
    case 6: return { x: z, z: -x };
    case 7: return { x: -z, z: -x };
    default:
      throw new RangeError(`unsupported orientation: ${orientation}`);
  }
}

function normalizePositions(rooms) {
  const minX = Math.min(...rooms.map((room) => room.x));
  const minZ = Math.min(...rooms.map((room) => room.z));
  return rooms.map((room) => ({
    ...room,
    x: room.x - minX,
    z: room.z - minZ,
  }));
}

export function deriveLayoutProfileV2({
  seed,
  roomCount,
} = {}) {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError("seed must be a non-negative safe integer");
  }
  if (!Number.isInteger(roomCount) || roomCount < 3 || roomCount > 64) {
    throw new RangeError("roomCount must be an integer between 3 and 64");
  }

  const columnChoices =
    roomCount <= 5 ? [2, 3] :
    roomCount <= 9 ? [3, 4] :
    [3, 4, 5];

  const columns =
    columnChoices[pickVariant(seed, 0x13579bdf, columnChoices.length)];
  const spacing =
    [12, 13, 14][pickVariant(seed, 0x2468ace0, 3)];
  const orientation =
    pickVariant(seed, 0x51f15e5d, ORIENTATION_COUNT);
  const firstRowReverse =
    pickVariant(seed, 0xa5a5a5a5, 2) === 1;

  return Object.freeze({
    columns,
    spacing,
    orientation,
    firstRowReverse,
  });
}

export function layoutRoomGraphV2(graph) {
  validateGraph(graph);
  const profile = deriveLayoutProfileV2({
    seed: graph.seed,
    roomCount: graph.rooms.length,
  });

  const baseRooms = graph.rooms.map((room, index) => {
    const row = Math.floor(index / profile.columns);
    const indexInRow = index % profile.columns;
    const reverse =
      (row % 2 === 1) !== profile.firstRowReverse;
    const column = reverse
      ? profile.columns - 1 - indexInRow
      : indexInRow;

    const point = orientationPoint(
      column * profile.spacing,
      row * profile.spacing,
      profile.orientation,
    );

    const roomSeed = mix32(
      (graph.seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0,
    );
    const width = 7 + (roomSeed % 3);
    const depth = 7 + ((roomSeed >>> 8) % 3);

    return {
      id: room.id,
      x: point.x,
      z: point.z,
      width,
      depth,
    };
  });

  const rooms = normalizePositions(baseRooms);

  const corridors = graph.edges.map((edge, index) => ({
    id: `corridor-${String(index + 1).padStart(3, "0")}`,
    fromRoomId: edge.from,
    toRoomId: edge.to,
    width: 3,
    kind: edge.kind,
  }));

  return {
    rooms,
    corridors,
    layoutProfile: { ...profile },
  };
}
