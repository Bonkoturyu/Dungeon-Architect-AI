import { createPrng, pickIndex } from "./prng.js";

const MAX_ALTERNATE_JUMP = 4;

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function validateRoomCount(roomCount) {
  if (!Number.isInteger(roomCount) || roomCount < 3 || roomCount > 64) {
    throw new RangeError("roomCount must be an integer between 3 and 64");
  }
}

function validateRouteChoice(routeChoice) {
  if (typeof routeChoice !== "number" || !Number.isFinite(routeChoice) || routeChoice < 0 || routeChoice > 1) {
    throw new RangeError("routeChoice must be between 0 and 1");
  }
}

export function getAlternateRouteCapacity(roomCount) {
  validateRoomCount(roomCount);
  return Math.max(1, Math.floor(roomCount / 3));
}

export function getAlternateRouteTarget(roomCount, routeChoice) {
  validateRoomCount(roomCount);
  validateRouteChoice(routeChoice);
  return Math.round(routeChoice * getAlternateRouteCapacity(roomCount));
}

function buildAlternateCandidates(rooms, seed) {
  const candidates = [];

  for (let a = 0; a < rooms.length - 2; a += 1) {
    const maxB = Math.min(rooms.length - 1, a + MAX_ALTERNATE_JUMP);
    for (let b = a + 2; b <= maxB; b += 1) {
      candidates.push({
        from: rooms[a].id,
        to: rooms[b].id,
        kind: "alternate",
        backboneSpan: b - a,
      });
    }
  }

  const prng = createPrng((seed ^ 0x9e3779b9) >>> 0);
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = pickIndex(prng, i + 1);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates;
}

export function analyzeRoomGraphRoutes(graph) {
  if (!graph || !Array.isArray(graph.rooms) || !Array.isArray(graph.edges)) {
    throw new TypeError("graph must contain rooms and edges arrays");
  }

  const roomIndex = new Map(graph.rooms.map((room, index) => [room.id, index]));
  const alternateEdges = graph.edges.filter((edge) => edge.kind === "alternate");
  const spans = alternateEdges.map((edge) => {
    const fromIndex = roomIndex.get(edge.from);
    const toIndex = roomIndex.get(edge.to);
    return Number.isInteger(fromIndex) && Number.isInteger(toIndex)
      ? Math.abs(toIndex - fromIndex)
      : null;
  });

  const uniqueEdges = new Set(graph.edges.map((edge) => edgeKey(edge.from, edge.to)));
  const connectedCycleRank = Math.max(0, graph.edges.length - graph.rooms.length + 1);

  return {
    roomCount: graph.rooms.length,
    edgeCount: graph.edges.length,
    backboneEdgeCount: graph.edges.filter((edge) => edge.kind === "backbone").length,
    alternateEdgeCount: alternateEdges.length,
    cycleRank: connectedCycleRank,
    alternateBackboneSpans: spans,
    allEdgesUnique: uniqueEdges.size === graph.edges.length,
    alternatesRejoinBackbone: spans.every((span) => Number.isInteger(span) && span >= 2 && span <= MAX_ALTERNATE_JUMP),
    hasMultipleStartGoalRoutes: alternateEdges.length > 0,
  };
}

export function generateRoomGraph({ seed, roomCount = 8, routeChoice = 0.5 } = {}) {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError("seed must be a non-negative safe integer");
  }
  validateRoomCount(roomCount);
  validateRouteChoice(routeChoice);

  const rooms = Array.from({ length: roomCount }, (_, index) => ({
    id: `room-${String(index + 1).padStart(3, "0")}`,
    index
  }));

  const edges = [];

  for (let i = 0; i < roomCount - 1; i += 1) {
    edges.push({
      from: rooms[i].id,
      to: rooms[i + 1].id,
      kind: "backbone"
    });
  }

  const targetExtraEdges = getAlternateRouteTarget(roomCount, routeChoice);
  const alternateCandidates = buildAlternateCandidates(rooms, seed);

  if (alternateCandidates.length < targetExtraEdges) {
    throw new Error(
      `alternate route candidate capacity ${alternateCandidates.length} is below requested target ${targetExtraEdges}`
    );
  }

  for (const candidate of alternateCandidates.slice(0, targetExtraEdges)) {
    edges.push({ from: candidate.from, to: candidate.to, kind: candidate.kind });
  }

  return {
    seed,
    roomCount,
    routeChoice,
    startRoomId: rooms[0].id,
    goalRoomId: rooms[rooms.length - 1].id,
    rooms,
    edges
  };
}
