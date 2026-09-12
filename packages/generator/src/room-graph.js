import { createPrng, pickIndex } from "./prng.js";

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function generateRoomGraph({ seed, roomCount = 8, routeChoice = 0.5 } = {}) {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError("seed must be a non-negative safe integer");
  }
  if (!Number.isInteger(roomCount) || roomCount < 3 || roomCount > 64) {
    throw new RangeError("roomCount must be an integer between 3 and 64");
  }
  if (typeof routeChoice !== "number" || !Number.isFinite(routeChoice) || routeChoice < 0 || routeChoice > 1) {
    throw new RangeError("routeChoice must be between 0 and 1");
  }

  const rooms = Array.from({ length: roomCount }, (_, index) => ({
    id: `room-${String(index + 1).padStart(3, "0")}`,
    index
  }));

  const edges = [];
  const edgeSet = new Set();

  for (let i = 0; i < roomCount - 1; i += 1) {
    const from = rooms[i].id;
    const to = rooms[i + 1].id;
    edges.push({ from, to, kind: "backbone" });
    edgeSet.add(edgeKey(from, to));
  }

  const prng = createPrng((seed ^ 0x9e3779b9) >>> 0);
  const targetExtraEdges = Math.round(routeChoice * Math.max(1, Math.floor(roomCount / 3)));
  let attempts = 0;

  while (edges.length < roomCount - 1 + targetExtraEdges && attempts < roomCount * roomCount * 2) {
    attempts += 1;
    const a = pickIndex(prng, roomCount - 2);
    const maxJump = Math.min(4, roomCount - 1 - a);
    if (maxJump < 2) continue;
    const jump = 2 + pickIndex(prng, maxJump - 1);
    const b = a + jump;
    const from = rooms[a].id;
    const to = rooms[b].id;
    const key = edgeKey(from, to);
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    edges.push({ from, to, kind: "alternate" });
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
