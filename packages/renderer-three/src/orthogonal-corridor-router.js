const EPSILON = 1e-9;
const SIDES = Object.freeze(['north', 'south', 'west', 'east']);

function roomRect(room, clearance = 0) {
  return {
    minX: room.x - room.width / 2 - clearance,
    maxX: room.x + room.width / 2 + clearance,
    minZ: room.z - room.depth / 2 - clearance,
    maxZ: room.z + room.depth / 2 + clearance,
  };
}

function doorPoint(room, side, offset = 0) {
  switch (side) {
    case 'north': return { x: room.x + offset, z: room.z - room.depth / 2 };
    case 'south': return { x: room.x + offset, z: room.z + room.depth / 2 };
    case 'west': return { x: room.x - room.width / 2, z: room.z + offset };
    case 'east': return { x: room.x + room.width / 2, z: room.z + offset };
    default: throw new Error(`Unsupported door side: ${side}`);
  }
}

function outsidePoint(room, side, clearance, offset = 0) {
  const point = doorPoint(room, side, offset);
  switch (side) {
    case 'north': return { x: point.x, z: point.z - clearance };
    case 'south': return { x: point.x, z: point.z + clearance };
    case 'west': return { x: point.x - clearance, z: point.z };
    case 'east': return { x: point.x + clearance, z: point.z };
    default: throw new Error(`Unsupported door side: ${side}`);
  }
}

function candidateDoorOffsets(room, side, corridorWidth) {
  const span = side === 'north' || side === 'south' ? room.width : room.depth;
  const maximum = Math.max(0, span / 2 - corridorWidth / 2 - 0.25);
  if (maximum <= EPSILON) return [0];

  const inner = maximum / 2;
  return [0, -inner, inner, -maximum, maximum]
    .filter((value, index, values) =>
      values.findIndex((candidate) => Math.abs(candidate - value) <= EPSILON) === index);
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.z - b.z) <= EPSILON;
}

function axisSegment(a, b) {
  if (Math.abs(a.z - b.z) <= EPSILON) {
    return {
      axis: 'x',
      fixed: a.z,
      start: Math.min(a.x, b.x),
      end: Math.max(a.x, b.x),
      a,
      b,
    };
  }
  if (Math.abs(a.x - b.x) <= EPSILON) {
    return {
      axis: 'z',
      fixed: a.x,
      start: Math.min(a.z, b.z),
      end: Math.max(a.z, b.z),
      a,
      b,
    };
  }
  return null;
}

function segmentLength(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

function pointInsideRectInterior(point, rect) {
  return point.x > rect.minX + EPSILON &&
    point.x < rect.maxX - EPSILON &&
    point.z > rect.minZ + EPSILON &&
    point.z < rect.maxZ - EPSILON;
}

function segmentCrossesRectInterior(a, b, rect) {
  const segment = axisSegment(a, b);
  if (!segment) return true;

  if (segment.axis === 'x') {
    if (segment.fixed <= rect.minZ + EPSILON || segment.fixed >= rect.maxZ - EPSILON) return false;
    return segment.end > rect.minX + EPSILON && segment.start < rect.maxX - EPSILON;
  }

  if (segment.fixed <= rect.minX + EPSILON || segment.fixed >= rect.maxX - EPSILON) return false;
  return segment.end > rect.minZ + EPSILON && segment.start < rect.maxZ - EPSILON;
}

function segmentsConflict(a1, a2, b1, b2) {
  const a = axisSegment(a1, a2);
  const b = axisSegment(b1, b2);
  if (!a || !b) return true;

  if (a.axis === b.axis) {
    if (Math.abs(a.fixed - b.fixed) > EPSILON) return false;
    return Math.min(a.end, b.end) - Math.max(a.start, b.start) > EPSILON;
  }

  const horizontal = a.axis === 'x' ? a : b;
  const vertical = a.axis === 'z' ? a : b;
  const x = vertical.fixed;
  const z = horizontal.fixed;
  const intersects =
    x >= horizontal.start - EPSILON &&
    x <= horizontal.end + EPSILON &&
    z >= vertical.start - EPSILON &&
    z <= vertical.end + EPSILON;
  if (!intersects) return false;

  const point = { x, z };
  const sharedEndpoint =
    [a1, a2].some((candidate) => samePoint(candidate, point)) &&
    [b1, b2].some((candidate) => samePoint(candidate, point));
  return !sharedEndpoint;
}

function simplify(points) {
  const deduped = [];
  for (const point of points) {
    if (!deduped.length || !samePoint(deduped[deduped.length - 1], point)) {
      deduped.push({ x: point.x, z: point.z });
    }
  }

  const result = [];
  for (const point of deduped) {
    result.push(point);
    while (result.length >= 3) {
      const a = result[result.length - 3];
      const b = result[result.length - 2];
      const c = result[result.length - 1];
      const sameX = Math.abs(a.x - b.x) <= EPSILON && Math.abs(b.x - c.x) <= EPSILON;
      const sameZ = Math.abs(a.z - b.z) <= EPSILON && Math.abs(b.z - c.z) <= EPSILON;
      if (!sameX && !sameZ) break;
      result.splice(result.length - 2, 1);
    }
  }
  return result;
}

function targetSidePenalty(room, target, side) {
  const dx = target.x - room.x;
  const dz = target.z - room.z;
  switch (side) {
    case 'east': return dx >= 0 ? 0 : 4;
    case 'west': return dx <= 0 ? 0 : 4;
    case 'south': return dz >= 0 ? 0 : 4;
    case 'north': return dz <= 0 ? 0 : 4;
    default: return 0;
  }
}

function makeCoordinateSet(rooms, start, goal, clearance, margin) {
  const xs = new Set([start.x, goal.x]);
  const zs = new Set([start.z, goal.z]);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const room of rooms) {
    const rect = roomRect(room, clearance);
    xs.add(rect.minX);
    xs.add(rect.maxX);
    xs.add(room.x);
    zs.add(rect.minZ);
    zs.add(rect.maxZ);
    zs.add(room.z);
    minX = Math.min(minX, rect.minX);
    maxX = Math.max(maxX, rect.maxX);
    minZ = Math.min(minZ, rect.minZ);
    maxZ = Math.max(maxZ, rect.maxZ);
  }

  xs.add(minX - margin);
  xs.add(maxX + margin);
  zs.add(minZ - margin);
  zs.add(maxZ + margin);

  return {
    xs: [...xs].sort((a, b) => a - b),
    zs: [...zs].sort((a, b) => a - b),
  };
}

function stateKey(x, z, direction) {
  return `${x}|${z}|${direction ?? '-'}`;
}

function reconstruct(cameFrom, state) {
  const points = [{ x: state.x, z: state.z }];
  let key = stateKey(state.x, state.z, state.direction);
  while (cameFrom.has(key)) {
    const previous = cameFrom.get(key);
    points.push({ x: previous.x, z: previous.z });
    key = stateKey(previous.x, previous.z, previous.direction);
  }
  return points.reverse();
}

function findOrthogonalPath({
  rooms,
  start,
  goal,
  clearance,
  margin,
  occupiedSegments,
  bendPenalty,
  allowCrossings,
}) {
  const obstacles = rooms.map((room) => roomRect(room, clearance));
  const { xs, zs } = makeCoordinateSet(rooms, start, goal, clearance, margin);
  const xIndex = new Map(xs.map((value, index) => [value, index]));
  const zIndex = new Map(zs.map((value, index) => [value, index]));

  function pointValid(point) {
    if (samePoint(point, start) || samePoint(point, goal)) return true;
    return obstacles.every((rect) => !pointInsideRectInterior(point, rect));
  }

  function segmentValid(a, b) {
    if (obstacles.some((rect) => segmentCrossesRectInterior(a, b, rect))) return false;
    if (allowCrossings) return true;
    return occupiedSegments.every(([c, d]) => !segmentsConflict(a, b, c, d));
  }

  function heuristic(point) {
    return Math.abs(point.x - goal.x) + Math.abs(point.z - goal.z);
  }

  const open = [{
    x: start.x,
    z: start.z,
    direction: null,
    g: 0,
    f: heuristic(start),
  }];
  const best = new Map([[stateKey(start.x, start.z, null), 0]]);
  const cameFrom = new Map();

  while (open.length) {
    open.sort((a, b) =>
      a.f - b.f ||
      a.g - b.g ||
      a.z - b.z ||
      a.x - b.x ||
      String(a.direction).localeCompare(String(b.direction)));
    const current = open.shift();
    if (samePoint(current, goal)) return simplify(reconstruct(cameFrom, current));

    const xi = xIndex.get(current.x);
    const zi = zIndex.get(current.z);
    const neighbors = [];
    if (xi > 0) neighbors.push({ x: xs[xi - 1], z: current.z, direction: 'x' });
    if (xi < xs.length - 1) neighbors.push({ x: xs[xi + 1], z: current.z, direction: 'x' });
    if (zi > 0) neighbors.push({ x: current.x, z: zs[zi - 1], direction: 'z' });
    if (zi < zs.length - 1) neighbors.push({ x: current.x, z: zs[zi + 1], direction: 'z' });

    for (const next of neighbors) {
      if (!pointValid(next) || !segmentValid(current, next)) continue;
      const bendCost = current.direction && current.direction !== next.direction ? bendPenalty : 0;
      const g = current.g + segmentLength(current, next) + bendCost;
      const key = stateKey(next.x, next.z, next.direction);
      if (g >= (best.get(key) ?? Infinity) - EPSILON) continue;
      best.set(key, g);
      cameFrom.set(key, {
        x: current.x,
        z: current.z,
        direction: current.direction,
      });
      open.push({
        ...next,
        g,
        f: g + heuristic(next),
      });
    }
  }

  return null;
}

function routeSegments(points) {
  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    if (!samePoint(points[index], points[index + 1])) {
      segments.push([points[index], points[index + 1]]);
    }
  }
  return segments;
}

export function planOrthogonalCorridors(spec, {
  clearancePadding = 0.5,
  outerMargin = 8,
  bendPenalty = 2,
  reusedDoorPenalty = 1000,
  allowCrossings = false,
} = {}) {
  const roomById = new Map(spec.rooms.map((room) => [room.id, room]));
  const usage = new Map(spec.rooms.map((room) => [room.id, new Map(SIDES.map((side) => [side, 0]))]));
  const occupiedSegments = [];
  const routes = new Map();

  const ordered = [...spec.corridors].sort((a, b) => {
    const aRank = a.kind === 'alternate' ? 1 : 0;
    const bRank = b.kind === 'alternate' ? 1 : 0;
    return aRank - bRank || a.id.localeCompare(b.id);
  });

  for (const corridor of ordered) {
    const fromRoom = roomById.get(corridor.fromRoomId);
    const toRoom = roomById.get(corridor.toRoomId);
    const clearance = corridor.width / 2 + clearancePadding;
    let best = null;

    const fromSides = corridor.fromSide ? [corridor.fromSide] : SIDES;
    const toSides = corridor.toSide ? [corridor.toSide] : SIDES;

    for (const fromSide of fromSides) {
      for (const toSide of toSides) {
        const fromOffsets = candidateDoorOffsets(fromRoom, fromSide, corridor.width);
        const toOffsets = candidateDoorOffsets(toRoom, toSide, corridor.width);

        for (const fromOffset of fromOffsets) {
          for (const toOffset of toOffsets) {
            const fromDoor = doorPoint(fromRoom, fromSide, fromOffset);
            const toDoor = doorPoint(toRoom, toSide, toOffset);
            const fromOutside = outsidePoint(fromRoom, fromSide, clearance, fromOffset);
            const toOutside = outsidePoint(toRoom, toSide, clearance, toOffset);

            const endpointSegments = [
              [fromDoor, fromOutside],
              [toOutside, toDoor],
            ];
            if (!allowCrossings && endpointSegments.some(([a, b]) =>
              occupiedSegments.some(([c, d]) => segmentsConflict(a, b, c, d)))) {
              continue;
            }

            const middle = findOrthogonalPath({
              rooms: spec.rooms,
              start: fromOutside,
              goal: toOutside,
              clearance,
              margin: outerMargin + routes.size * (corridor.width + 1),
              occupiedSegments: [...occupiedSegments, ...endpointSegments],
              bendPenalty,
              allowCrossings,
            });
            if (!middle) continue;

            const points = simplify([fromDoor, fromOutside, ...middle, toOutside, toDoor]);
            const segments = routeSegments(points);
            if (segments.some(([a, b]) => !axisSegment(a, b))) continue;

            let length = 0;
            let bends = 0;
            let previousAxis = null;
            for (const [a, b] of segments) {
              const axis = axisSegment(a, b).axis;
              length += segmentLength(a, b);
              if (previousAxis && previousAxis !== axis) bends += 1;
              previousAxis = axis;
            }

            const reused =
              usage.get(fromRoom.id).get(fromSide) +
              usage.get(toRoom.id).get(toSide);
            const directionalPenalty =
              targetSidePenalty(fromRoom, toRoom, fromSide) +
              targetSidePenalty(toRoom, fromRoom, toSide);
            // Preserve centered doors whenever they work. Along-wall offsets are
            // deterministic resilience candidates, not an aesthetic preference.
            const offsetPenalty =
              (Math.abs(fromOffset) > EPSILON ? 100 : 0) +
              (Math.abs(toOffset) > EPSILON ? 100 : 0) +
              (Math.abs(fromOffset) + Math.abs(toOffset)) * 0.01;
            const score =
              reused * reusedDoorPenalty +
              directionalPenalty +
              offsetPenalty +
              length +
              bends * bendPenalty;

            if (!best || score < best.score - EPSILON) {
              best = {
                score,
                route: {
                  corridorId: corridor.id,
                  points,
                  fromDoor: { roomId: fromRoom.id, side: fromSide, offset: fromOffset, width: corridor.width },
                  toDoor: { roomId: toRoom.id, side: toSide, offset: toOffset, width: corridor.width },
                },
                segments,
              };
            }
          }
        }
      }
    }

    if (!best) {
      throw new Error(`Unable to find non-overlapping orthogonal route for corridor ${corridor.id}`);
    }

    routes.set(corridor.id, best.route);
    usage.get(fromRoom.id).set(
      best.route.fromDoor.side,
      usage.get(fromRoom.id).get(best.route.fromDoor.side) + 1,
    );
    usage.get(toRoom.id).set(
      best.route.toDoor.side,
      usage.get(toRoom.id).get(best.route.toDoor.side) + 1,
    );
    occupiedSegments.push(...best.segments);
  }

  return routes;
}

export function corridorRouteSegments(route) {
  return routeSegments(route.points).map(([from, to]) => ({
    from: { ...from },
    to: { ...to },
    axis: axisSegment(from, to).axis,
  }));
}
