import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { corridorRouteSegments, planOrthogonalCorridors } from './orthogonal-corridor-router.js';

export const DEFAULT_SCENE_STYLE = Object.freeze({
  roomHeight: 3,
  wallThickness: 0.2,
  floorThickness: 0.2,
  markerHeight: 0.8,
});

const EPSILON = 1e-9;
const WALL_SIDES = Object.freeze(['north', 'south', 'west', 'east']);

export class DungeonScenePlanError extends Error {
  constructor(errors) {
    super(`DungeonSpec is invalid for rendering (${errors.length} validation error${errors.length === 1 ? '' : 's'}).`);
    this.name = 'DungeonScenePlanError';
    this.errors = errors;
  }
}

function makeBox(specId, part, position, size, rotationY = 0) {
  return {
    specId,
    part,
    position: { x: position.x, y: position.y, z: position.z },
    size: { x: size.x, y: size.y, z: size.z },
    rotationY: Object.is(rotationY, -0) ? 0 : rotationY,
  };
}

function makeBounds(rooms, corridorRoutes = new Map()) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const room of rooms) {
    minX = Math.min(minX, room.x - room.width / 2);
    maxX = Math.max(maxX, room.x + room.width / 2);
    minZ = Math.min(minZ, room.z - room.depth / 2);
    maxZ = Math.max(maxZ, room.z + room.depth / 2);
  }

  for (const route of corridorRoutes.values()) {
    for (const point of route.points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
    }
  }

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}

function intersectRanges(a, b) {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return end - start > EPSILON ? { start, end } : null;
}

function rangeForLinearConstraint(base, slope, minValue, maxValue) {
  if (Math.abs(slope) <= EPSILON) {
    if (base < minValue - EPSILON || base > maxValue + EPSILON) return null;
    return { start: -Infinity, end: Infinity };
  }

  const first = (minValue - base) / slope;
  const second = (maxValue - base) / slope;
  return { start: Math.min(first, second), end: Math.max(first, second) };
}

function sideParameter(room, side) {
  switch (side) {
    case 'north':
      return {
        min: -room.width / 2,
        max: room.width / 2,
        point: (offset) => ({ x: room.x + offset, z: room.z - room.depth / 2 }),
        tangent: { x: 1, z: 0 },
      };
    case 'south':
      return {
        min: -room.width / 2,
        max: room.width / 2,
        point: (offset) => ({ x: room.x + offset, z: room.z + room.depth / 2 }),
        tangent: { x: 1, z: 0 },
      };
    case 'west':
      return {
        min: -room.depth / 2,
        max: room.depth / 2,
        point: (offset) => ({ x: room.x - room.width / 2, z: room.z + offset }),
        tangent: { x: 0, z: 1 },
      };
    case 'east':
      return {
        min: -room.depth / 2,
        max: room.depth / 2,
        point: (offset) => ({ x: room.x + room.width / 2, z: room.z + offset }),
        tangent: { x: 0, z: 1 },
      };
    default:
      throw new Error(`Unsupported wall side: ${side}`);
  }
}

function corridorWallOpening(room, side, corridor, fromRoom, toRoom) {
  const dx = toRoom.x - fromRoom.x;
  const dz = toRoom.z - fromRoom.z;
  const length = Math.hypot(dx, dz);
  if (length <= EPSILON) return null;

  const ux = dx / length;
  const uz = dz / length;
  const nx = -uz;
  const nz = ux;
  const wall = sideParameter(room, side);
  const basePoint = wall.point(0);
  const relX = basePoint.x - fromRoom.x;
  const relZ = basePoint.z - fromRoom.z;

  const longitudinalBase = relX * ux + relZ * uz;
  const longitudinalSlope = wall.tangent.x * ux + wall.tangent.z * uz;
  const lateralBase = relX * nx + relZ * nz;
  const lateralSlope = wall.tangent.x * nx + wall.tangent.z * nz;

  let interval = { start: wall.min, end: wall.max };
  const longitudinal = rangeForLinearConstraint(longitudinalBase, longitudinalSlope, 0, length);
  if (!longitudinal) return null;
  interval = intersectRanges(interval, longitudinal);
  if (!interval) return null;

  const lateral = rangeForLinearConstraint(lateralBase, lateralSlope, -corridor.width / 2, corridor.width / 2);
  if (!lateral) return null;
  interval = intersectRanges(interval, lateral);
  if (!interval) return null;

  return {
    corridorId: corridor.id,
    side,
    startOffset: interval.start,
    endOffset: interval.end,
    centerOffset: (interval.start + interval.end) / 2,
    width: interval.end - interval.start,
  };
}

function collectDoorOpenings(spec, corridorRoutes) {
  const byRoom = new Map(spec.rooms.map((room) => [room.id, []]));

  for (const corridor of spec.corridors) {
    const route = corridorRoutes.get(corridor.id);
    if (!route) continue;

    for (const door of [route.fromDoor, route.toDoor]) {
      const half = door.width / 2;
      byRoom.get(door.roomId).push({
        corridorId: corridor.id,
        side: door.side,
        startOffset: door.offset - half,
        endOffset: door.offset + half,
        centerOffset: door.offset,
        width: door.width,
      });
    }
  }

  for (const openings of byRoom.values()) {
    openings.sort((a, b) =>
      a.side.localeCompare(b.side) ||
      a.startOffset - b.startOffset ||
      a.corridorId.localeCompare(b.corridorId));
  }

  return byRoom;
}

function mergedIntervalsForSide(openings, side) {
  const intervals = openings
    .filter((opening) => opening.side === side)
    .map((opening) => ({ start: opening.startOffset, end: opening.endOffset }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged = [];
  for (const interval of intervals) {
    const previous = merged[merged.length - 1];
    if (!previous || interval.start > previous.end + EPSILON) {
      merged.push({ ...interval });
    } else {
      previous.end = Math.max(previous.end, interval.end);
    }
  }
  return merged;
}

function addWallSegment(boxes, room, side, startOffset, endOffset, config, segmentIndex) {
  const length = endOffset - startOffset;
  if (length <= EPSILON) return;
  const centerOffset = (startOffset + endOffset) / 2;
  const y = config.roomHeight / 2;

  if (side === 'north' || side === 'south') {
    boxes.push(makeBox(
      room.id,
      `wall-${side}-${segmentIndex}`,
      {
        x: room.x + centerOffset,
        y,
        z: room.z + (side === 'north' ? -room.depth / 2 : room.depth / 2),
      },
      { x: length, y: config.roomHeight, z: config.wallThickness },
    ));
    return;
  }

  boxes.push(makeBox(
    room.id,
    `wall-${side}-${segmentIndex}`,
    {
      x: room.x + (side === 'west' ? -room.width / 2 : room.width / 2),
      y,
      z: room.z + centerOffset,
    },
    { x: config.wallThickness, y: config.roomHeight, z: length },
  ));
}

function addSegmentedWall(boxes, room, side, openings, config) {
  const wallLength = side === 'north' || side === 'south' ? room.width : room.depth;
  const half = wallLength / 2;
  const merged = mergedIntervalsForSide(openings, side);
  let cursor = -half;
  let segmentIndex = 0;

  for (const opening of merged) {
    const start = Math.max(-half, opening.start);
    const end = Math.min(half, opening.end);
    if (end <= -half + EPSILON || start >= half - EPSILON) continue;
    if (start > cursor + EPSILON) {
      addWallSegment(boxes, room, side, cursor, start, config, segmentIndex);
      segmentIndex += 1;
    }
    cursor = Math.max(cursor, end);
  }

  if (cursor < half - EPSILON) {
    addWallSegment(boxes, room, side, cursor, half, config, segmentIndex);
  }
}

function buildRoomGroup(room, doorOpenings, config) {
  const boxes = [
    makeBox(
      room.id,
      'floor',
      { x: room.x, y: -config.floorThickness / 2, z: room.z },
      { x: room.width, y: config.floorThickness, z: room.depth },
    ),
  ];

  for (const side of WALL_SIDES) addSegmentedWall(boxes, room, side, doorOpenings, config);

  return {
    specId: room.id,
    kind: 'room',
    boxes,
    doorOpenings: doorOpenings.map((opening) => ({ ...opening })),
  };
}

export function createDungeonScenePlan(spec, style = {}) {
  const validation = validateDungeonSpec(spec);
  if (!validation.valid) throw new DungeonScenePlanError(validation.errors);

  const config = { ...DEFAULT_SCENE_STYLE, ...style };
  const roomById = new Map(spec.rooms.map((room) => [room.id, room]));
  const corridorRoutes = planOrthogonalCorridors(spec);
  const doorOpeningsByRoom = collectDoorOpenings(spec, corridorRoutes);
  const roomGroups = spec.rooms.map((room) => buildRoomGroup(room, doorOpeningsByRoom.get(room.id) ?? [], config));
  const corridorGroups = [];
  const markers = [];

  for (const corridor of spec.corridors) {
    const route = corridorRoutes.get(corridor.id);
    const boxes = corridorRouteSegments(route).map((segment, index) => {
      const length = Math.abs(segment.to.x - segment.from.x) + Math.abs(segment.to.z - segment.from.z);
      const rotationY = segment.axis === 'x' ? 0 : -Math.PI / 2;
      return makeBox(
        corridor.id,
        `corridor-floor-${index}`,
        {
          x: (segment.from.x + segment.to.x) / 2,
          y: -config.floorThickness / 2,
          z: (segment.from.z + segment.to.z) / 2,
        },
        { x: length, y: config.floorThickness, z: corridor.width },
        rotationY,
      );
    });
    corridorGroups.push({
      specId: corridor.id,
      kind: 'corridor',
      boxes,
      route: route.points.map((point) => ({ ...point })),
      fromDoor: { ...route.fromDoor },
      toDoor: { ...route.toDoor },
    });
  }

  for (const entity of spec.entities) {
    if (entity.type !== 'start' && entity.type !== 'goal') continue;
    const room = roomById.get(entity.roomId);
    markers.push({
      specId: entity.id,
      roomId: entity.roomId,
      type: entity.type,
      position: { x: room.x, y: config.markerHeight / 2, z: room.z },
      height: config.markerHeight,
    });
  }

  return {
    sourceSpecId: spec.id,
    roomGroups,
    corridorGroups,
    markers,
    bounds: makeBounds(spec.rooms, corridorRoutes),
  };
}
