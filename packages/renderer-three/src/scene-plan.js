import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';

export const DEFAULT_SCENE_STYLE = Object.freeze({
  roomHeight: 3,
  wallThickness: 0.2,
  floorThickness: 0.2,
  markerHeight: 0.8,
});

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

function makeBounds(rooms) {
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

export function createDungeonScenePlan(spec, style = {}) {
  const validation = validateDungeonSpec(spec);
  if (!validation.valid) throw new DungeonScenePlanError(validation.errors);

  const config = { ...DEFAULT_SCENE_STYLE, ...style };
  const roomById = new Map(spec.rooms.map((room) => [room.id, room]));
  const roomGroups = [];
  const corridorGroups = [];
  const markers = [];

  for (const room of spec.rooms) {
    const boxes = [
      makeBox(
        room.id,
        'floor',
        { x: room.x, y: -config.floorThickness / 2, z: room.z },
        { x: room.width, y: config.floorThickness, z: room.depth },
      ),
      makeBox(
        room.id,
        'wall-north',
        { x: room.x, y: config.roomHeight / 2, z: room.z - room.depth / 2 },
        { x: room.width, y: config.roomHeight, z: config.wallThickness },
      ),
      makeBox(
        room.id,
        'wall-south',
        { x: room.x, y: config.roomHeight / 2, z: room.z + room.depth / 2 },
        { x: room.width, y: config.roomHeight, z: config.wallThickness },
      ),
      makeBox(
        room.id,
        'wall-west',
        { x: room.x - room.width / 2, y: config.roomHeight / 2, z: room.z },
        { x: config.wallThickness, y: config.roomHeight, z: room.depth },
      ),
      makeBox(
        room.id,
        'wall-east',
        { x: room.x + room.width / 2, y: config.roomHeight / 2, z: room.z },
        { x: config.wallThickness, y: config.roomHeight, z: room.depth },
      ),
    ];
    roomGroups.push({ specId: room.id, kind: 'room', boxes });
  }

  for (const corridor of spec.corridors) {
    const from = roomById.get(corridor.fromRoomId);
    const to = roomById.get(corridor.toRoomId);
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    const rawRotationY = -Math.atan2(dz, dx);
    const rotationY = Object.is(rawRotationY, -0) ? 0 : rawRotationY;
    const box = makeBox(
      corridor.id,
      'corridor-floor',
      { x: (from.x + to.x) / 2, y: -config.floorThickness / 2, z: (from.z + to.z) / 2 },
      { x: length, y: config.floorThickness, z: corridor.width },
      rotationY,
    );
    corridorGroups.push({ specId: corridor.id, kind: 'corridor', boxes: [box] });
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
    bounds: makeBounds(spec.rooms),
  };
}
