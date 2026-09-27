import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { createDungeonRunSpec } from '../../run-core/src/dungeon-run.js';

export const DUNGEON_LAYOUT_EXCHANGE_SCHEMA = 'dungeon-layout-exchange';
export const DUNGEON_LAYOUT_EXCHANGE_VERSION = '1.0';

export const DUNGEON_LAYOUT_COORDINATE_SYSTEM = Object.freeze({
  plane: 'XZ',
  units: 'abstract',
  roomPosition: 'center',
  roomSize: 'full-extent',
  positiveX: 'east',
  positiveZ: 'south',
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDungeonSpecs(dungeons) {
  if (!Array.isArray(dungeons) || dungeons.length === 0) {
    throw new TypeError('Export requires at least one DungeonSpec.');
  }

  for (const [index, dungeon] of dungeons.entries()) {
    const validation = validateDungeonSpec(dungeon);
    if (!validation.valid) {
      throw new Error(
        `DungeonSpec at index ${index} is invalid: ${validation.errors
          .map((entry) => entry.code)
          .join(',')}`,
      );
    }
  }
}

function roomRoles(spec) {
  const roles = new Map(spec.rooms.map((room) => [room.id, []]));
  for (const entity of spec.entities) {
    if (entity.type !== 'start' && entity.type !== 'goal') continue;
    roles.get(entity.roomId)?.push(entity.type);
  }
  return roles;
}

function exportConnection(corridor) {
  const result = {
    id: corridor.id,
    fromRoomId: corridor.fromRoomId,
    toRoomId: corridor.toRoomId,
    width: corridor.width,
    enabled: corridor.initiallyEnabled !== false,
  };
  if (typeof corridor.kind === 'string' && corridor.kind.trim() !== '') {
    result.kind = corridor.kind;
  }
  if (corridor.fromSide !== undefined) result.fromSide = corridor.fromSide;
  if (corridor.toSide !== undefined) result.toSide = corridor.toSide;
  return result;
}

function normalizeProvenance(provenance) {
  const result = {
    application: 'Dungeon Architect AI',
    dungeonSpecVersion: '1.0',
  };
  if (!provenance || typeof provenance !== 'object') return result;

  for (const key of [
    'generatorStrategyId',
    'generatorVersion',
    'algorithmVersion',
  ]) {
    const value = provenance[key];
    if (typeof value === 'string' && value.trim() !== '') {
      result[key] = value;
    }
  }
  return result;
}

export function createDungeonLayoutExchange(
  dungeons,
  { id = 'dungeon-layout', provenance = null } = {},
) {
  assertDungeonSpecs(dungeons);
  if (typeof id !== 'string' || id.trim() === '') {
    throw new TypeError('Layout exchange id must be a non-empty string.');
  }

  return {
    schema: DUNGEON_LAYOUT_EXCHANGE_SCHEMA,
    schemaVersion: DUNGEON_LAYOUT_EXCHANGE_VERSION,
    id,
    source: normalizeProvenance(provenance),
    coordinateSystem: { ...DUNGEON_LAYOUT_COORDINATE_SYSTEM },
    floors: dungeons.map((spec, index) => {
      const roles = roomRoles(spec);
      return {
        id: `floor-${String(index + 1).padStart(2, '0')}`,
        index,
        dungeonId: spec.id,
        seed: spec.seed,
        rooms: spec.rooms.map((room) => ({
          id: room.id,
          x: room.x,
          z: room.z,
          width: room.width,
          depth: room.depth,
          roles: [...(roles.get(room.id) ?? [])].sort(),
        })),
        connections: spec.corridors.map(exportConnection),
      };
    }),
  };
}

export function createFullDungeonExport(
  dungeons,
  { id = 'dungeon-export' } = {},
) {
  assertDungeonSpecs(dungeons);
  const result = createDungeonRunSpec(
    dungeons.map((dungeon) => clone(dungeon)),
    { id },
  );
  if (!result.ok) {
    throw new Error(
      `DungeonRunSpec export is invalid: ${result.errors
        .map((entry) => entry.code)
        .join(',')}`,
    );
  }
  return result.spec;
}

export function serializeJsonExport(value) {
  return JSON.stringify(value, null, 2) + '\n';
}
