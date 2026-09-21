const EPSILON = 1e-9;

export const CARDINAL_SIDES = Object.freeze(['north', 'east', 'south', 'west']);

export function oppositeCorridorSide(side) {
  return {
    north: 'south',
    east: 'west',
    south: 'north',
    west: 'east',
  }[side] ?? null;
}

export function wallSideFromPart(part) {
  const match = /^wall-(north|east|south|west)-/.exec(String(part ?? ''));
  return match?.[1] ?? null;
}

export function roomDoorPoint(room, side) {
  switch (side) {
    case 'north': return { x: room.x, z: room.z - room.depth / 2 };
    case 'east': return { x: room.x + room.width / 2, z: room.z };
    case 'south': return { x: room.x, z: room.z + room.depth / 2 };
    case 'west': return { x: room.x - room.width / 2, z: room.z };
    default: throw new RangeError(`Unsupported wall side: ${side}`);
  }
}

function outwardNormal(side) {
  switch (side) {
    case 'north': return { x: 0, z: -1 };
    case 'east': return { x: 1, z: 0 };
    case 'south': return { x: 0, z: 1 };
    case 'west': return { x: -1, z: 0 };
    default: throw new RangeError(`Unsupported wall side: ${side}`);
  }
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.z - b.z) <= EPSILON;
}

function simplify(points) {
  const deduped = [];
  for (const point of points) {
    if (!deduped.length || !samePoint(deduped.at(-1), point)) {
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

function buildPointerPath(sourceDoor, sourceSide, pointer, width) {
  const normal = outwardNormal(sourceSide);
  const clearance = width / 2 + 0.5;
  const outside = {
    x: sourceDoor.x + normal.x * clearance,
    z: sourceDoor.z + normal.z * clearance,
  };

  let bend;
  let end;

  if (sourceSide === 'east' || sourceSide === 'west') {
    const x = sourceSide === 'east'
      ? Math.max(pointer.x, outside.x)
      : Math.min(pointer.x, outside.x);
    bend = { x, z: outside.z };
    end = { x, z: pointer.z };
  } else {
    const z = sourceSide === 'south'
      ? Math.max(pointer.z, outside.z)
      : Math.min(pointer.z, outside.z);
    bend = { x: outside.x, z };
    end = { x: pointer.x, z };
  }

  return simplify([sourceDoor, outside, bend, end]);
}

function roomRect(room) {
  return {
    minX: room.x - room.width / 2,
    maxX: room.x + room.width / 2,
    minZ: room.z - room.depth / 2,
    maxZ: room.z + room.depth / 2,
  };
}

function valueWithin(value, min, max) {
  return value >= min - EPSILON && value <= max + EPSILON;
}

function segmentRoomEntry(a, b, room) {
  const rect = roomRect(room);

  if (Math.abs(a.z - b.z) <= EPSILON && Math.abs(a.x - b.x) > EPSILON) {
    if (!valueWithin(a.z, rect.minZ, rect.maxZ)) return null;
    const direction = Math.sign(b.x - a.x);
    const x = direction > 0 ? rect.minX : rect.maxX;
    if (!valueWithin(x, Math.min(a.x, b.x), Math.max(a.x, b.x))) return null;
    return {
      point: { x, z: a.z },
      side: direction > 0 ? 'west' : 'east',
      distance: Math.abs(x - a.x),
    };
  }

  if (Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.z - b.z) > EPSILON) {
    if (!valueWithin(a.x, rect.minX, rect.maxX)) return null;
    const direction = Math.sign(b.z - a.z);
    const z = direction > 0 ? rect.minZ : rect.maxZ;
    if (!valueWithin(z, Math.min(a.z, b.z), Math.max(a.z, b.z))) return null;
    return {
      point: { x: a.x, z },
      side: direction > 0 ? 'north' : 'south',
      distance: Math.abs(z - a.z),
    };
  }

  return null;
}

function segmentLength(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

function firstRoomCollision(points, rooms, sourceRoomId) {
  let elapsed = 0;
  let best = null;

  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    const a = points[segmentIndex];
    const b = points[segmentIndex + 1];

    for (const room of rooms) {
      if (room.id === sourceRoomId) continue;
      const hit = segmentRoomEntry(a, b, room);
      if (!hit) continue;
      const totalDistance = elapsed + hit.distance;
      if (!best || totalDistance < best.totalDistance - EPSILON) {
        best = {
          ...hit,
          roomId: room.id,
          segmentIndex,
          totalDistance,
        };
      }
    }

    if (best && best.segmentIndex === segmentIndex) break;
    elapsed += segmentLength(a, b);
  }

  return best;
}

function axisSegment(a, b) {
  if (Math.abs(a.z - b.z) <= EPSILON && Math.abs(a.x - b.x) > EPSILON) {
    return {
      axis: 'x',
      fixed: a.z,
      start: Math.min(a.x, b.x),
      end: Math.max(a.x, b.x),
      a,
      b,
    };
  }
  if (Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.z - b.z) > EPSILON) {
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

function segmentsConflict(a1, a2, b1, b2) {
  const a = axisSegment(a1, a2);
  const b = axisSegment(b1, b2);
  if (!a || !b) return false;

  if (a.axis === b.axis) {
    if (Math.abs(a.fixed - b.fixed) > EPSILON) return false;
    const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
    if (overlap <= EPSILON) return false;

    const overlapStart = a.axis === 'x'
      ? { x: Math.max(a.start, b.start), z: a.fixed }
      : { x: a.fixed, z: Math.max(a.start, b.start) };
    const sharedEndpoint =
      [a1, a2].some((point) => samePoint(point, overlapStart)) &&
      [b1, b2].some((point) => samePoint(point, overlapStart));
    return !sharedEndpoint || overlap > EPSILON;
  }

  const horizontal = a.axis === 'x' ? a : b;
  const vertical = a.axis === 'z' ? a : b;
  const point = { x: vertical.fixed, z: horizontal.fixed };
  if (!valueWithin(point.x, horizontal.start, horizontal.end) ||
      !valueWithin(point.z, vertical.start, vertical.end)) {
    return false;
  }

  const sharedEndpoint =
    [a1, a2].some((candidate) => samePoint(candidate, point)) &&
    [b1, b2].some((candidate) => samePoint(candidate, point));
  return !sharedEndpoint;
}

function pathSegments(points) {
  const result = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    if (!samePoint(points[index], points[index + 1])) {
      result.push([points[index], points[index + 1]]);
    }
  }
  return result;
}

function firstCorridorConflict(points, corridorRoutes, excludedCorridorId) {
  const previewSegments = pathSegments(points);
  for (const route of corridorRoutes ?? []) {
    if (!route || route.corridorId === excludedCorridorId || !Array.isArray(route.points)) continue;
    const existingSegments = pathSegments(route.points);
    for (const [a, b] of previewSegments) {
      for (const [c, d] of existingSegments) {
        if (segmentsConflict(a, b, c, d)) {
          return { corridorId: route.corridorId };
        }
      }
    }
  }
  return null;
}

function truncateAtRoomCollision(points, collision) {
  if (!collision) return points;
  return simplify([
    ...points.slice(0, collision.segmentIndex + 1),
    collision.point,
  ]);
}

export function buildCorridorDragPreview(spec, {
  sourceRoomId,
  sourceSide,
  pointer,
  width = 3,
  existingCorridorId = null,
  corridorRoutes = [],
} = {}) {
  if (!spec || !Array.isArray(spec.rooms) || !Array.isArray(spec.corridors)) {
    throw new TypeError('buildCorridorDragPreview requires a DungeonSpec-like object.');
  }
  if (!CARDINAL_SIDES.includes(sourceSide)) {
    throw new RangeError(`Unsupported source side: ${sourceSide}`);
  }
  if (!pointer || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.z)) {
    throw new TypeError('pointer must contain finite x/z values.');
  }

  const sourceRoom = spec.rooms.find((room) => room.id === sourceRoomId);
  if (!sourceRoom) throw new RangeError(`Unknown source room: ${sourceRoomId}`);

  const sourceDoor = roomDoorPoint(sourceRoom, sourceSide);
  const rawPoints = buildPointerPath(sourceDoor, sourceSide, pointer, width);
  const roomCollision = firstRoomCollision(rawPoints, spec.rooms, sourceRoomId);
  const points = truncateAtRoomCollision(rawPoints, roomCollision);

  if (!roomCollision) {
    const corridorCollision = firstCorridorConflict(points, corridorRoutes, existingCorridorId);
    return {
      points,
      sourceRoomId,
      sourceSide,
      targetRoomId: null,
      targetSide: null,
      state: corridorCollision ? 'blocked' : 'open',
      blockedCode: corridorCollision ? 'CORRIDOR_COLLISION' : null,
      blockedCorridorId: corridorCollision?.corridorId ?? null,
    };
  }

  const duplicate = spec.corridors.find((corridor) =>
    corridor.id !== existingCorridorId &&
    (
      (corridor.fromRoomId === sourceRoomId && corridor.toRoomId === roomCollision.roomId) ||
      (corridor.toRoomId === sourceRoomId && corridor.fromRoomId === roomCollision.roomId)
    ));

  if (duplicate) {
    return {
      points,
      sourceRoomId,
      sourceSide,
      targetRoomId: roomCollision.roomId,
      targetSide: roomCollision.side,
      state: 'blocked',
      blockedCode: 'DUPLICATE_CORRIDOR',
      blockedCorridorId: duplicate.id,
    };
  }

  const corridorCollision = firstCorridorConflict(points, corridorRoutes, existingCorridorId);
  if (corridorCollision) {
    return {
      points,
      sourceRoomId,
      sourceSide,
      targetRoomId: roomCollision.roomId,
      targetSide: roomCollision.side,
      state: 'blocked',
      blockedCode: 'CORRIDOR_COLLISION',
      blockedCorridorId: corridorCollision.corridorId,
    };
  }

  return {
    points,
    sourceRoomId,
    sourceSide,
    targetRoomId: roomCollision.roomId,
    targetSide: roomCollision.side,
    state: 'ready',
    blockedCode: null,
    blockedCorridorId: null,
  };
}

export function findCorridorOpeningAtWall(plan, {
  roomId,
  side,
  point,
  room,
  tolerance = 1,
} = {}) {
  if (!plan || !roomId || !CARDINAL_SIDES.includes(side) || !point || !room) return null;
  const group = plan.roomGroups?.find((entry) => entry.specId === roomId);
  if (!group) return null;

  const clickOffset = side === 'north' || side === 'south'
    ? point.x - room.x
    : point.z - room.z;

  const candidates = (group.doorOpenings ?? [])
    .filter((opening) => opening.side === side)
    .map((opening) => ({
      ...opening,
      distance: Math.abs((opening.centerOffset ?? 0) - clickOffset),
    }))
    .sort((a, b) => a.distance - b.distance);

  const candidate = candidates[0] ?? null;
  if (!candidate) return null;
  const half = Math.max(0.5, (candidate.width ?? 0) / 2) + tolerance;
  return candidate.distance <= half ? candidate : null;
}

export function corridorSideForRoom(plan, corridorId, roomId) {
  const group = plan?.corridorGroups?.find((entry) => entry.specId === corridorId);
  if (!group) return null;
  if (group.fromDoor?.roomId === roomId) return group.fromDoor.side ?? null;
  if (group.toDoor?.roomId === roomId) return group.toDoor.side ?? null;
  return null;
}
