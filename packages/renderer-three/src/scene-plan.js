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

function sharedRoomBoundary(fromRoom, toRoom) {
  const from = {
    minX: fromRoom.x - fromRoom.width / 2,
    maxX: fromRoom.x + fromRoom.width / 2,
    minZ: fromRoom.z - fromRoom.depth / 2,
    maxZ: fromRoom.z + fromRoom.depth / 2,
  };
  const to = {
    minX: toRoom.x - toRoom.width / 2,
    maxX: toRoom.x + toRoom.width / 2,
    minZ: toRoom.z - toRoom.depth / 2,
    maxZ: toRoom.z + toRoom.depth / 2,
  };

  function verticalBoundary(x, fromSide, toSide) {
    const start = Math.max(from.minZ, to.minZ);
    const end = Math.min(from.maxZ, to.maxZ);
    if (end - start <= EPSILON) return null;
    const center = (start + end) / 2;
    return {
      point: { x, z: center },
      width: end - start,
      fromDoor: {
        roomId: fromRoom.id,
        side: fromSide,
        offset: center - fromRoom.z,
      },
      toDoor: {
        roomId: toRoom.id,
        side: toSide,
        offset: center - toRoom.z,
      },
    };
  }

  function horizontalBoundary(z, fromSide, toSide) {
    const start = Math.max(from.minX, to.minX);
    const end = Math.min(from.maxX, to.maxX);
    if (end - start <= EPSILON) return null;
    const center = (start + end) / 2;
    return {
      point: { x: center, z },
      width: end - start,
      fromDoor: {
        roomId: fromRoom.id,
        side: fromSide,
        offset: center - fromRoom.x,
      },
      toDoor: {
        roomId: toRoom.id,
        side: toSide,
        offset: center - toRoom.x,
      },
    };
  }

  if (Math.abs(from.maxX - to.minX) <= EPSILON) {
    return verticalBoundary(from.maxX, 'east', 'west');
  }
  if (Math.abs(from.minX - to.maxX) <= EPSILON) {
    return verticalBoundary(from.minX, 'west', 'east');
  }
  if (Math.abs(from.maxZ - to.minZ) <= EPSILON) {
    return horizontalBoundary(from.maxZ, 'south', 'north');
  }
  if (Math.abs(from.minZ - to.maxZ) <= EPSILON) {
    return horizontalBoundary(from.minZ, 'north', 'south');
  }
  return null;
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


function boundsFromPlanGroups(roomGroups, corridorGroups, fallbackBounds) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const group of [...roomGroups, ...corridorGroups]) {
    for (const box of group.boxes ?? []) {
      const rotationY = box.rotationY ?? 0;
      const cos = Math.cos(rotationY);
      const sin = Math.sin(rotationY);
      const halfX = (Math.abs(cos) * box.size.x + Math.abs(sin) * box.size.z) / 2;
      const halfZ = (Math.abs(sin) * box.size.x + Math.abs(cos) * box.size.z) / 2;
      minX = Math.min(minX, box.position.x - halfX);
      maxX = Math.max(maxX, box.position.x + halfX);
      minZ = Math.min(minZ, box.position.z - halfZ);
      maxZ = Math.max(maxZ, box.position.z + halfZ);
    }
  }

  if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return { ...fallbackBounds };

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

export function projectDungeonScenePlan(plan, visibility) {
  if (!visibility) return plan;
  if (!plan || typeof plan !== 'object') throw new TypeError('projectDungeonScenePlan requires a scene plan.');

  const roomIds = new Set(Array.isArray(visibility.roomIds) ? visibility.roomIds : []);
  const corridorIds = new Set(Array.isArray(visibility.corridorIds) ? visibility.corridorIds : []);
  const currentRoomId = typeof visibility.currentRoomId === 'string' ? visibility.currentRoomId : null;

  const roomGroups = plan.roomGroups
    .filter((group) => roomIds.has(group.specId))
    .map((group) => ({
      ...group,
      visibilityState: group.specId === currentRoomId ? 'current' : 'explored',
    }));

  const corridorGroups = plan.corridorGroups
    .filter((group) => corridorIds.has(group.specId))
    .map((group) => ({ ...group, visibilityState: 'explored' }));

  const markers = plan.markers.filter((marker) => roomIds.has(marker.roomId));
  const bounds = boundsFromPlanGroups(roomGroups, corridorGroups, plan.bounds);

  return {
    ...plan,
    roomGroups,
    corridorGroups,
    markers,
    bounds,
    visibility: {
      roomIds: [...roomIds],
      corridorIds: [...corridorIds],
      currentRoomId,
    },
  };
}

export function shouldRenderMarkerForRuntime(marker, entityStates) {
  if (!marker || !entityStates) return true;

  const state = entityStates[marker.specId] ?? null;
  if (marker.type === 'enemy') {
    const status = state?.status ?? (marker.initiallyActive === false ? 'dormant' : 'active');
    return status === 'active';
  }
  if (marker.type === 'treasure') return state?.status !== 'opened';
  if (marker.type === 'trap') return state?.status == null || state.status === 'armed';
  if (marker.type === 'recovery') return state?.status !== 'used';
  return true;
}

export function createDungeonScenePlan(spec, style = {}) {
  const validation = validateDungeonSpec(spec);
  if (!validation.valid) throw new DungeonScenePlanError(validation.errors);

  const config = { ...DEFAULT_SCENE_STYLE, ...style };
  const roomById = new Map(spec.rooms.map((room) => [room.id, room]));
  const touchingByCorridor = new Map();
  const routedCorridors = [];

  for (const corridor of spec.corridors) {
    const fromRoom = roomById.get(corridor.fromRoomId);
    const toRoom = roomById.get(corridor.toRoomId);
    const shared = fromRoom && toRoom ? sharedRoomBoundary(fromRoom, toRoom) : null;
    const sharedMatchesPreference =
      shared &&
      (!corridor.fromSide || corridor.fromSide === shared.fromDoor.side) &&
      (!corridor.toSide || corridor.toSide === shared.toDoor.side);
    if (sharedMatchesPreference) touchingByCorridor.set(corridor.id, shared);
    else routedCorridors.push(corridor);
  }

  let corridorRoutes;
  let routingFallbackUsed = false;
  let routingFallbackMode = 'strict';

  const routedSpec = {
    ...spec,
    corridors: routedCorridors,
  };

  const strictMargins = [8, 16, 32];
  let strictError = null;
  for (const outerMargin of strictMargins) {
    try {
      corridorRoutes = planOrthogonalCorridors(routedSpec, { outerMargin });
      if (outerMargin !== strictMargins[0]) {
        routingFallbackUsed = true;
        routingFallbackMode = `strict-expanded-${outerMargin}`;
      }
      break;
    } catch (error) {
      strictError = error;
    }
  }

  if (!corridorRoutes) {
    try {
      corridorRoutes = planOrthogonalCorridors(routedSpec, {
        allowCrossings: true,
        outerMargin: 32,
      });
      routingFallbackUsed = true;
      routingFallbackMode = 'crossing-fallback';
    } catch {
      throw strictError;
    }
  }

  for (const corridor of spec.corridors) {
    const shared = touchingByCorridor.get(corridor.id);
    if (!shared) continue;
    corridorRoutes.set(corridor.id, {
      corridorId: corridor.id,
      points: [{ ...shared.point }],
      fromDoor: {
        ...shared.fromDoor,
        width: shared.width,
      },
      toDoor: {
        ...shared.toDoor,
        width: shared.width,
      },
    });
  }

  const doorOpeningsByRoom = collectDoorOpenings(spec, corridorRoutes);
  const roomGroups = spec.rooms.map((room) => buildRoomGroup(room, doorOpeningsByRoom.get(room.id) ?? [], config));
  const corridorGroups = [];
  const markers = [];
  const entitiesByRoom = new Map(spec.rooms.map((room) => [room.id, []]));
  for (const entity of spec.entities) entitiesByRoom.get(entity.roomId)?.push(entity);

  for (const corridor of spec.corridors) {
    const route = corridorRoutes.get(corridor.id);
    const segments = corridorRouteSegments(route);
    const boxes = segments.map((segment, index) => {
      const isFirst = index === 0;
      const isLast = index === segments.length - 1;
      const halfWidth = corridor.width / 2;

      let from = { ...segment.from };
      let to = { ...segment.to };

      if (!isFirst) {
        if (segment.axis === 'x') {
          from.x += Math.sign(to.x - from.x) * halfWidth;
        } else {
          from.z += Math.sign(to.z - from.z) * halfWidth;
        }
      }

      if (!isLast) {
        if (segment.axis === 'x') {
          to.x -= Math.sign(to.x - from.x) * halfWidth;
        } else {
          to.z -= Math.sign(to.z - from.z) * halfWidth;
        }
      }

      const length = Math.abs(to.x - from.x) + Math.abs(to.z - from.z);
      if (length <= EPSILON) {
        throw new Error(`Corridor ${corridor.id} segment ${index} is too short for a clean bend junction.`);
      }

      const rotationY = segment.axis === 'x' ? 0 : -Math.PI / 2;
      return makeBox(
        corridor.id,
        `corridor-floor-${index}`,
        {
          x: (from.x + to.x) / 2,
          y: -config.floorThickness / 2,
          z: (from.z + to.z) / 2,
        },
        { x: length, y: config.floorThickness, z: corridor.width },
        rotationY,
      );
    });

    for (let index = 1; index < route.points.length - 1; index += 1) {
      const point = route.points[index];
      boxes.push(makeBox(
        corridor.id,
        `corridor-junction-${index - 1}`,
        {
          x: point.x,
          y: -config.floorThickness / 2,
          z: point.z,
        },
        {
          x: corridor.width,
          y: config.floorThickness,
          z: corridor.width,
        },
        0,
      ));
    }

    corridorGroups.push({
      specId: corridor.id,
      kind: 'corridor',
      boxes,
      route: route.points.map((point) => ({ ...point })),
      fromDoor: { ...route.fromDoor },
      toDoor: { ...route.toDoor },
    });
  }

  const markerSlots = [
    { x: 0, z: 0 },
    { x: -0.24, z: -0.2 },
    { x: 0.24, z: -0.2 },
    { x: -0.24, z: 0.2 },
    { x: 0.24, z: 0.2 },
    { x: 0, z: 0.28 },
    { x: 0, z: -0.28 },
  ];

  for (const room of spec.rooms) {
    const entities = [...(entitiesByRoom.get(room.id) ?? [])]
      .sort((a, b) => {
        const order = { start: 0, goal: 1, enemy: 2, treasure: 3, trap: 4, recovery: 5 };
        return (order[a.type] ?? 99) - (order[b.type] ?? 99) || a.id.localeCompare(b.id);
      });

    entities.forEach((entity, index) => {
      const slot = markerSlots[index % markerSlots.length];
      const height = entity.type === 'trap' ? 0.18 : entity.type === 'treasure' ? 0.7 : config.markerHeight;
      markers.push({
        specId: entity.id,
        roomId: entity.roomId,
        type: entity.type,
        position: {
          x: room.x + slot.x * Math.max(2, room.width),
          y: height / 2,
          z: room.z + slot.z * Math.max(2, room.depth),
        },
        height,
        warning: entity.warning ?? null,
        ...(entity.type === 'enemy'
          ? { initiallyActive: entity.initiallyActive !== false }
          : {}),
      });
    });
  }

  return {
    sourceSpecId: spec.id,
    roomGroups,
    corridorGroups,
    markers,
    bounds: makeBounds(spec.rooms, corridorRoutes),
    routingFallbackUsed,
    routingFallbackMode,
  };
}
