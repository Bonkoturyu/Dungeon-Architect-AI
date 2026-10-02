import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import {
  createDungeonRunSpec,
  validateDungeonRunSpec,
} from '../../run-core/src/dungeon-run.js';

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


function importError(code, path, message) {
  return { code, path, message };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isRecord(value)) return false;
  return Object.keys(value).sort().join(',') === [...expected].sort().join(',');
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseJsonImportValue(input) {
  if (typeof input !== 'string') {
    try {
      return { ok: true, value: clone(input), errors: [] };
    } catch {
      return {
        ok: false,
        value: null,
        errors: [
          importError(
            'IMPORT_JSON_CLONE_FAILED',
            '$',
            'Import value must be JSON serializable.',
          ),
        ],
      };
    }
  }

  try {
    return { ok: true, value: JSON.parse(input), errors: [] };
  } catch (error) {
    return {
      ok: false,
      value: null,
      errors: [
        importError(
          'IMPORT_JSON_PARSE_ERROR',
          '$',
          error?.message ?? 'Invalid JSON.',
        ),
      ],
    };
  }
}

function nextImportedEntityId(kind, usedIds) {
  for (let index = 1; index <= 9999; index += 1) {
    const id = `layout-${kind}-${String(index).padStart(3, '0')}`;
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
  }
  return null;
}

function validateLayoutExchangeShape(value) {
  const errors = [];

  if (!isRecord(value)) {
    return [
      importError(
        'LAYOUT_IMPORT_NOT_OBJECT',
        '$',
        'DungeonLayoutExchange must be an object.',
      ),
    ];
  }

  if (!exactKeys(value, [
    'schema',
    'schemaVersion',
    'id',
    'source',
    'coordinateSystem',
    'floors',
  ])) {
    errors.push(
      importError(
        'LAYOUT_IMPORT_TOP_LEVEL_FIELDS_INVALID',
        '$',
        'DungeonLayoutExchange v1 top-level fields are invalid.',
      ),
    );
  }

  if (value.schema !== DUNGEON_LAYOUT_EXCHANGE_SCHEMA) {
    errors.push(
      importError(
        'LAYOUT_IMPORT_SCHEMA_INVALID',
        'schema',
        `Expected ${DUNGEON_LAYOUT_EXCHANGE_SCHEMA}.`,
      ),
    );
  }
  if (value.schemaVersion !== DUNGEON_LAYOUT_EXCHANGE_VERSION) {
    errors.push(
      importError(
        'LAYOUT_IMPORT_VERSION_UNSUPPORTED',
        'schemaVersion',
        `Expected schemaVersion ${DUNGEON_LAYOUT_EXCHANGE_VERSION}.`,
      ),
    );
  }
  if (!nonEmptyString(value.id)) {
    errors.push(
      importError(
        'LAYOUT_IMPORT_ID_REQUIRED',
        'id',
        'Layout import ID must be a non-empty string.',
      ),
    );
  }

  if (
    !isRecord(value.source) ||
    value.source.application !== 'Dungeon Architect AI' ||
    value.source.dungeonSpecVersion !== '1.0'
  ) {
    errors.push(
      importError(
        'LAYOUT_IMPORT_SOURCE_INVALID',
        'source',
        'Layout source must identify an application and DungeonSpec v1.',
      ),
    );
  } else {
    const allowedSourceKeys = new Set([
      'application',
      'dungeonSpecVersion',
      'generatorStrategyId',
      'generatorVersion',
      'algorithmVersion',
    ]);
    for (const key of Object.keys(value.source)) {
      if (!allowedSourceKeys.has(key)) {
        errors.push(
          importError(
            'LAYOUT_IMPORT_SOURCE_FIELD_UNSUPPORTED',
            `source.${key}`,
            `Unsupported source field: ${key}.`,
          ),
        );
      }
    }
    for (const key of [
      'generatorStrategyId',
      'generatorVersion',
      'algorithmVersion',
    ]) {
      if (
        value.source[key] !== undefined &&
        !nonEmptyString(value.source[key])
      ) {
        errors.push(
          importError(
            'LAYOUT_IMPORT_SOURCE_VALUE_INVALID',
            `source.${key}`,
            `${key} must be a non-empty string when provided.`,
          ),
        );
      }
    }
  }

  if (
    !isRecord(value.coordinateSystem) ||
    !exactKeys(value.coordinateSystem, Object.keys(DUNGEON_LAYOUT_COORDINATE_SYSTEM)) ||
    Object.entries(DUNGEON_LAYOUT_COORDINATE_SYSTEM).some(
      ([key, expected]) => value.coordinateSystem[key] !== expected,
    )
  ) {
    errors.push(
      importError(
        'LAYOUT_IMPORT_COORDINATE_SYSTEM_UNSUPPORTED',
        'coordinateSystem',
        'DungeonLayoutExchange v1 requires the fixed XZ coordinate system.',
      ),
    );
  }

  if (!Array.isArray(value.floors)) {
    errors.push(
      importError(
        'LAYOUT_IMPORT_FLOORS_REQUIRED',
        'floors',
        'floors must be an array.',
      ),
    );
    return errors;
  }
  if (value.floors.length < 1 || value.floors.length > 10) {
    errors.push(
      importError(
        'LAYOUT_IMPORT_FLOOR_COUNT_INVALID',
        'floors',
        'Layout import must contain 1 through 10 floors.',
      ),
    );
  }

  const floorIds = new Set();
  const dungeonIds = new Set();

  value.floors.forEach((floor, floorIndex) => {
    const floorPath = `floors[${floorIndex}]`;
    if (!isRecord(floor)) {
      errors.push(
        importError(
          'LAYOUT_IMPORT_FLOOR_NOT_OBJECT',
          floorPath,
          'Floor must be an object.',
        ),
      );
      return;
    }
    if (!exactKeys(floor, [
      'id',
      'index',
      'dungeonId',
      'seed',
      'rooms',
      'connections',
    ])) {
      errors.push(
        importError(
          'LAYOUT_IMPORT_FLOOR_FIELDS_INVALID',
          floorPath,
          'Floor fields are invalid for DungeonLayoutExchange v1.',
        ),
      );
    }
    if (!nonEmptyString(floor.id) || floorIds.has(floor.id)) {
      errors.push(
        importError(
          'LAYOUT_IMPORT_FLOOR_ID_INVALID',
          `${floorPath}.id`,
          'Floor ID must be non-empty and unique.',
        ),
      );
    } else {
      floorIds.add(floor.id);
    }
    if (floor.index !== floorIndex) {
      errors.push(
        importError(
          'LAYOUT_IMPORT_FLOOR_INDEX_INVALID',
          `${floorPath}.index`,
          `Expected floor index ${floorIndex}.`,
        ),
      );
    }
    if (!nonEmptyString(floor.dungeonId) || dungeonIds.has(floor.dungeonId)) {
      errors.push(
        importError(
          'LAYOUT_IMPORT_DUNGEON_ID_INVALID',
          `${floorPath}.dungeonId`,
          'dungeonId must be non-empty and unique.',
        ),
      );
    } else {
      dungeonIds.add(floor.dungeonId);
    }
    if (!Number.isSafeInteger(floor.seed) || floor.seed < 0) {
      errors.push(
        importError(
          'LAYOUT_IMPORT_SEED_INVALID',
          `${floorPath}.seed`,
          'seed must be a non-negative safe integer.',
        ),
      );
    }

    if (!Array.isArray(floor.rooms) || floor.rooms.length < 2) {
      errors.push(
        importError(
          'LAYOUT_IMPORT_ROOMS_INVALID',
          `${floorPath}.rooms`,
          'Each imported floor requires at least two Rooms.',
        ),
      );
    }
    if (!Array.isArray(floor.connections)) {
      errors.push(
        importError(
          'LAYOUT_IMPORT_CONNECTIONS_INVALID',
          `${floorPath}.connections`,
          'connections must be an array.',
        ),
      );
    }
    if (!Array.isArray(floor.rooms) || !Array.isArray(floor.connections)) {
      return;
    }

    const roomIds = new Set();
    let startRoleCount = 0;
    let goalRoleCount = 0;

    floor.rooms.forEach((room, roomIndex) => {
      const roomPath = `${floorPath}.rooms[${roomIndex}]`;
      if (
        !isRecord(room) ||
        !exactKeys(room, ['id', 'x', 'z', 'width', 'depth', 'roles'])
      ) {
        errors.push(
          importError(
            'LAYOUT_IMPORT_ROOM_FIELDS_INVALID',
            roomPath,
            'Room fields are invalid for DungeonLayoutExchange v1.',
          ),
        );
        return;
      }
      if (!nonEmptyString(room.id) || roomIds.has(room.id)) {
        errors.push(
          importError(
            'LAYOUT_IMPORT_ROOM_ID_INVALID',
            `${roomPath}.id`,
            'Room ID must be non-empty and unique.',
          ),
        );
      } else {
        roomIds.add(room.id);
      }
      for (const field of ['x', 'z', 'width', 'depth']) {
        if (!finiteNumber(room[field])) {
          errors.push(
            importError(
              'LAYOUT_IMPORT_ROOM_NUMBER_INVALID',
              `${roomPath}.${field}`,
              `${field} must be a finite number.`,
            ),
          );
        }
      }
      if (
        finiteNumber(room.width) &&
        finiteNumber(room.depth) &&
        (room.width <= 0 || room.depth <= 0)
      ) {
        errors.push(
          importError(
            'LAYOUT_IMPORT_ROOM_SIZE_INVALID',
            roomPath,
            'Room width/depth must be greater than zero.',
          ),
        );
      }
      if (
        !Array.isArray(room.roles) ||
        room.roles.some((role) => !['start', 'goal'].includes(role)) ||
        new Set(room.roles).size !== room.roles.length
      ) {
        errors.push(
          importError(
            'LAYOUT_IMPORT_ROOM_ROLES_INVALID',
            `${roomPath}.roles`,
            'roles may contain unique start/goal values only.',
          ),
        );
      } else {
        if (room.roles.includes('start')) startRoleCount += 1;
        if (room.roles.includes('goal')) goalRoleCount += 1;
        if (
          room.roles.includes('start') &&
          room.roles.includes('goal')
        ) {
          errors.push(
            importError(
              'LAYOUT_IMPORT_START_GOAL_SAME_ROOM',
              `${roomPath}.roles`,
              'Start and Goal must be on different Rooms.',
            ),
          );
        }
      }
    });

    if (startRoleCount !== 1) {
      errors.push(
        importError(
          'LAYOUT_IMPORT_START_COUNT_INVALID',
          `${floorPath}.rooms`,
          `Expected exactly one start role; found ${startRoleCount}.`,
        ),
      );
    }
    if (goalRoleCount !== 1) {
      errors.push(
        importError(
          'LAYOUT_IMPORT_GOAL_COUNT_INVALID',
          `${floorPath}.rooms`,
          `Expected exactly one goal role; found ${goalRoleCount}.`,
        ),
      );
    }

    const connectionIds = new Set();
    floor.connections.forEach((connection, connectionIndex) => {
      const connectionPath =
        `${floorPath}.connections[${connectionIndex}]`;
      if (!isRecord(connection)) {
        errors.push(
          importError(
            'LAYOUT_IMPORT_CONNECTION_NOT_OBJECT',
            connectionPath,
            'Connection must be an object.',
          ),
        );
        return;
      }
      const requiredKeys = [
        'id',
        'fromRoomId',
        'toRoomId',
        'width',
        'enabled',
      ];
      const allowedKeys = new Set([
        ...requiredKeys,
        'kind',
        'fromSide',
        'toSide',
      ]);
      if (
        requiredKeys.some(
          (key) => !Object.prototype.hasOwnProperty.call(connection, key),
        ) ||
        Object.keys(connection).some((key) => !allowedKeys.has(key))
      ) {
        errors.push(
          importError(
            'LAYOUT_IMPORT_CONNECTION_FIELDS_INVALID',
            connectionPath,
            'Connection fields are invalid for DungeonLayoutExchange v1.',
          ),
        );
      }
      if (
        !nonEmptyString(connection.id) ||
        connectionIds.has(connection.id) ||
        roomIds.has(connection.id)
      ) {
        errors.push(
          importError(
            'LAYOUT_IMPORT_CONNECTION_ID_INVALID',
            `${connectionPath}.id`,
            'Connection ID must be unique and must not collide with Room IDs.',
          ),
        );
      } else {
        connectionIds.add(connection.id);
      }
      for (const field of ['fromRoomId', 'toRoomId']) {
        if (
          !nonEmptyString(connection[field]) ||
          !roomIds.has(connection[field])
        ) {
          errors.push(
            importError(
              'LAYOUT_IMPORT_ROOM_REFERENCE_INVALID',
              `${connectionPath}.${field}`,
              `Unknown Room reference: ${String(connection[field])}.`,
            ),
          );
        }
      }
      if (
        connection.fromRoomId === connection.toRoomId &&
        nonEmptyString(connection.fromRoomId)
      ) {
        errors.push(
          importError(
            'LAYOUT_IMPORT_SELF_CONNECTION',
            connectionPath,
            'Connection cannot connect a Room to itself.',
          ),
        );
      }
      if (!finiteNumber(connection.width) || connection.width <= 0) {
        errors.push(
          importError(
            'LAYOUT_IMPORT_CONNECTION_WIDTH_INVALID',
            `${connectionPath}.width`,
            'Connection width must be greater than zero.',
          ),
        );
      }
      if (typeof connection.enabled !== 'boolean') {
        errors.push(
          importError(
            'LAYOUT_IMPORT_CONNECTION_ENABLED_INVALID',
            `${connectionPath}.enabled`,
            'enabled must be a boolean.',
          ),
        );
      }
      for (const field of ['fromSide', 'toSide']) {
        if (
          connection[field] !== undefined &&
          !['north', 'east', 'south', 'west'].includes(connection[field])
        ) {
          errors.push(
            importError(
              'LAYOUT_IMPORT_CONNECTION_SIDE_INVALID',
              `${connectionPath}.${field}`,
              `${field} must be a cardinal side when provided.`,
            ),
          );
        }
      }
      if (
        connection.kind !== undefined &&
        !nonEmptyString(connection.kind)
      ) {
        errors.push(
          importError(
            'LAYOUT_IMPORT_CONNECTION_KIND_INVALID',
            `${connectionPath}.kind`,
            'kind must be a non-empty string when provided.',
          ),
        );
      }
    });
  });

  return errors;
}

function layoutFloorToDungeonSpec(floor) {
  const usedIds = new Set([
    ...floor.rooms.map((room) => room.id),
    ...floor.connections.map((connection) => connection.id),
  ]);
  const startRoom = floor.rooms.find((room) =>
    room.roles.includes('start'));
  const goalRoom = floor.rooms.find((room) =>
    room.roles.includes('goal'));
  const startId = nextImportedEntityId('start', usedIds);
  const goalId = nextImportedEntityId('goal', usedIds);
  if (!startId || !goalId) {
    return {
      ok: false,
      spec: null,
      errors: [
        importError(
          'LAYOUT_IMPORT_ENTITY_ID_EXHAUSTED',
          'floors',
          'Could not allocate Start/Goal entity IDs.',
        ),
      ],
    };
  }

  const spec = {
    schemaVersion: '1.0',
    id: floor.dungeonId,
    seed: floor.seed,
    rooms: floor.rooms.map((room) => ({
      id: room.id,
      x: room.x,
      z: room.z,
      width: room.width,
      depth: room.depth,
    })),
    corridors: floor.connections.map((connection) => {
      const corridor = {
        id: connection.id,
        fromRoomId: connection.fromRoomId,
        toRoomId: connection.toRoomId,
        width: connection.width,
      };
      if (connection.enabled === false) corridor.initiallyEnabled = false;
      if (connection.kind !== undefined) corridor.kind = connection.kind;
      if (connection.fromSide !== undefined) {
        corridor.fromSide = connection.fromSide;
      }
      if (connection.toSide !== undefined) {
        corridor.toSide = connection.toSide;
      }
      return corridor;
    }),
    entities: [
      { id: startId, type: 'start', roomId: startRoom.id },
      { id: goalId, type: 'goal', roomId: goalRoom.id },
    ],
    events: [],
  };

  const validation = validateDungeonSpec(spec);
  if (!validation.valid) {
    return {
      ok: false,
      spec: null,
      errors: validation.errors.map((entry) => ({
        ...entry,
        path: `dungeon.${entry.path}`,
      })),
    };
  }
  return { ok: true, spec, errors: [] };
}

export function importDungeonLayoutExchange(input) {
  const parsed = parseJsonImportValue(input);
  if (!parsed.ok) {
    return {
      ok: false,
      format: 'layout',
      dungeons: null,
      provenance: null,
      errors: parsed.errors,
    };
  }

  const errors = validateLayoutExchangeShape(parsed.value);
  if (errors.length > 0) {
    return {
      ok: false,
      format: 'layout',
      dungeons: null,
      provenance: null,
      errors,
    };
  }

  const dungeons = [];
  for (const floor of parsed.value.floors) {
    const converted = layoutFloorToDungeonSpec(floor);
    if (!converted.ok) {
      return {
        ok: false,
        format: 'layout',
        dungeons: null,
        provenance: null,
        errors: converted.errors,
      };
    }
    dungeons.push(converted.spec);
  }

  const run = createDungeonRunSpec(dungeons, {
    id: `${parsed.value.id}-import`,
  });
  if (!run.ok) {
    return {
      ok: false,
      format: 'layout',
      dungeons: null,
      provenance: null,
      errors: run.errors,
    };
  }

  return {
    ok: true,
    format: 'layout',
    dungeons,
    provenance: clone(parsed.value.source),
    errors: [],
  };
}

export function importFullDungeonExport(input) {
  const parsed = parseJsonImportValue(input);
  if (!parsed.ok) {
    return {
      ok: false,
      format: 'full',
      dungeons: null,
      provenance: null,
      errors: parsed.errors,
    };
  }

  const envelopeErrors = [];
  if (
    !isRecord(parsed.value) ||
    !exactKeys(parsed.value, ['schemaVersion', 'id', 'floors'])
  ) {
    envelopeErrors.push(
      importError(
        'FULL_IMPORT_TOP_LEVEL_FIELDS_INVALID',
        '$',
        'DungeonRunSpec v1 top-level fields are invalid.',
      ),
    );
  }

  if (Array.isArray(parsed.value?.floors)) {
    parsed.value.floors.forEach((floor, index) => {
      if (!isRecord(floor) || !exactKeys(floor, ['id', 'dungeon'])) {
        envelopeErrors.push(
          importError(
            'FULL_IMPORT_FLOOR_FIELDS_INVALID',
            `floors[${index}]`,
            'DungeonRunSpec v1 Floor fields are invalid.',
          ),
        );
      }
    });
  }

  if (envelopeErrors.length > 0) {
    return {
      ok: false,
      format: 'full',
      dungeons: null,
      provenance: null,
      errors: envelopeErrors,
    };
  }

  const validation = validateDungeonRunSpec(parsed.value);
  if (!validation.valid) {
    return {
      ok: false,
      format: 'full',
      dungeons: null,
      provenance: null,
      errors: validation.errors,
    };
  }

  return {
    ok: true,
    format: 'full',
    dungeons: parsed.value.floors.map((floor) => clone(floor.dungeon)),
    provenance: null,
    errors: [],
  };
}

export function importDungeonJson(input) {
  const parsed = parseJsonImportValue(input);
  if (!parsed.ok) {
    return {
      ok: false,
      format: null,
      dungeons: null,
      provenance: null,
      errors: parsed.errors,
    };
  }

  if (
    parsed.value?.schema === DUNGEON_LAYOUT_EXCHANGE_SCHEMA ||
    Object.prototype.hasOwnProperty.call(
      parsed.value ?? {},
      'coordinateSystem',
    )
  ) {
    return importDungeonLayoutExchange(parsed.value);
  }

  if (
    parsed.value?.schemaVersion === '1.0' &&
    Array.isArray(parsed.value?.floors)
  ) {
    return importFullDungeonExport(parsed.value);
  }

  return {
    ok: false,
    format: null,
    dungeons: null,
    provenance: null,
    errors: [
      importError(
        'IMPORT_FORMAT_UNSUPPORTED',
        '$',
        'Expected DungeonLayoutExchange v1 or DungeonRunSpec v1 JSON.',
      ),
    ],
  };
}
