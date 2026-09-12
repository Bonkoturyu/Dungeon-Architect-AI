export const DUNGEON_SPEC_VERSION = "1.0";

export const ENTITY_TYPES = Object.freeze([
  "start",
  "goal",
  "enemy",
  "treasure",
  "trap",
  "recovery"
]);

const ENTITY_TYPE_SET = new Set(ENTITY_TYPES);

function pushError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateId(value, path, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    pushError(errors, "ID_REQUIRED", path, "ID must be a non-empty string.");
    return false;
  }
  return true;
}

function registerId(id, path, ids, errors) {
  if (!validateId(id, path, errors)) return;
  if (ids.has(id)) {
    pushError(errors, "DUPLICATE_ID", path, `Duplicate ID: ${id}`);
    return;
  }
  ids.add(id);
}

function validateRooms(rooms, ids, roomIds, errors) {
  if (!Array.isArray(rooms)) {
    pushError(errors, "ARRAY_REQUIRED", "rooms", "rooms must be an array.");
    return;
  }

  rooms.forEach((room, index) => {
    const path = `rooms[${index}]`;
    if (!isRecord(room)) {
      pushError(errors, "OBJECT_REQUIRED", path, "Room must be an object.");
      return;
    }

    registerId(room.id, `${path}.id`, ids, errors);
    if (typeof room.id === "string" && room.id.trim() !== "") roomIds.add(room.id);

    for (const field of ["x", "z", "width", "depth"]) {
      if (!isFiniteNumber(room[field])) {
        pushError(errors, "NUMBER_REQUIRED", `${path}.${field}`, `${field} must be a finite number.`);
      }
    }

    for (const field of ["width", "depth"]) {
      if (isFiniteNumber(room[field]) && room[field] <= 0) {
        pushError(errors, "ROOM_DIMENSION_INVALID", `${path}.${field}`, `${field} must be greater than zero.`);
      }
    }
  });
}

function validateCorridors(corridors, ids, roomIds, errors) {
  if (!Array.isArray(corridors)) {
    pushError(errors, "ARRAY_REQUIRED", "corridors", "corridors must be an array.");
    return;
  }

  corridors.forEach((corridor, index) => {
    const path = `corridors[${index}]`;
    if (!isRecord(corridor)) {
      pushError(errors, "OBJECT_REQUIRED", path, "Corridor must be an object.");
      return;
    }

    registerId(corridor.id, `${path}.id`, ids, errors);

    for (const field of ["fromRoomId", "toRoomId"]) {
      const value = corridor[field];
      if (typeof value !== "string" || !roomIds.has(value)) {
        pushError(errors, "ROOM_REFERENCE_MISSING", `${path}.${field}`, `Unknown room reference: ${String(value)}`);
      }
    }

    if (corridor.fromRoomId === corridor.toRoomId && typeof corridor.fromRoomId === "string") {
      pushError(errors, "SELF_CORRIDOR", path, "Corridor cannot connect a room to itself.");
    }

    if (!isFiniteNumber(corridor.width) || corridor.width <= 0) {
      pushError(errors, "CORRIDOR_WIDTH_INVALID", `${path}.width`, "Corridor width must be a finite number greater than zero.");
    }
  });
}

function validateEntities(entities, ids, roomIds, errors) {
  if (!Array.isArray(entities)) {
    pushError(errors, "ARRAY_REQUIRED", "entities", "entities must be an array.");
    return;
  }

  let startCount = 0;
  let goalCount = 0;

  entities.forEach((entity, index) => {
    const path = `entities[${index}]`;
    if (!isRecord(entity)) {
      pushError(errors, "OBJECT_REQUIRED", path, "Entity must be an object.");
      return;
    }

    registerId(entity.id, `${path}.id`, ids, errors);

    if (!ENTITY_TYPE_SET.has(entity.type)) {
      pushError(errors, "ENTITY_TYPE_UNSUPPORTED", `${path}.type`, `Unsupported entity type: ${String(entity.type)}`);
    }

    if (entity.type === "start") startCount += 1;
    if (entity.type === "goal") goalCount += 1;

    if (typeof entity.roomId !== "string" || !roomIds.has(entity.roomId)) {
      pushError(errors, "ROOM_REFERENCE_MISSING", `${path}.roomId`, `Unknown room reference: ${String(entity.roomId)}`);
    }
  });

  if (startCount !== 1) {
    pushError(errors, "START_COUNT_INVALID", "entities", `Exactly one start entity is required; found ${startCount}.`);
  }
  if (goalCount !== 1) {
    pushError(errors, "GOAL_COUNT_INVALID", "entities", `Exactly one goal entity is required; found ${goalCount}.`);
  }
}

function validateReachability(spec, roomIds, errors) {
  if (!Array.isArray(spec.corridors) || !Array.isArray(spec.entities)) return;

  const start = spec.entities.find((entity) => entity?.type === "start");
  const goal = spec.entities.find((entity) => entity?.type === "goal");
  if (!start || !goal || !roomIds.has(start.roomId) || !roomIds.has(goal.roomId)) return;

  const adjacency = new Map([...roomIds].map((roomId) => [roomId, []]));
  for (const corridor of spec.corridors) {
    if (!corridor || !roomIds.has(corridor.fromRoomId) || !roomIds.has(corridor.toRoomId)) continue;
    adjacency.get(corridor.fromRoomId).push(corridor.toRoomId);
    adjacency.get(corridor.toRoomId).push(corridor.fromRoomId);
  }

  const visited = new Set([start.roomId]);
  const queue = [start.roomId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }

  if (!visited.has(goal.roomId)) {
    pushError(errors, "GOAL_UNREACHABLE", "corridors", `Goal room ${goal.roomId} is unreachable from start room ${start.roomId}.`);
  }
}

function validateEvents(events, ids, errors) {
  if (!Array.isArray(events)) {
    pushError(errors, "ARRAY_REQUIRED", "events", "events must be an array.");
    return;
  }

  events.forEach((event, index) => {
    const path = `events[${index}]`;
    if (!isRecord(event)) {
      pushError(errors, "OBJECT_REQUIRED", path, "Event must be an object.");
      return;
    }
    registerId(event.id, `${path}.id`, ids, errors);
  });
}

export function validateDungeonSpec(spec) {
  const errors = [];

  if (!isRecord(spec)) {
    pushError(errors, "SPEC_NOT_OBJECT", "$", "DungeonSpec must be an object.");
    return { valid: false, errors };
  }

  if (spec.schemaVersion !== DUNGEON_SPEC_VERSION) {
    pushError(errors, "SCHEMA_VERSION_UNSUPPORTED", "schemaVersion", `Expected schemaVersion ${DUNGEON_SPEC_VERSION}.`);
  }

  validateId(spec.id, "id", errors);

  if (!Number.isSafeInteger(spec.seed) || spec.seed < 0) {
    pushError(errors, "SEED_INVALID", "seed", "seed must be a non-negative safe integer.");
  }

  const ids = new Set();
  const roomIds = new Set();

  validateRooms(spec.rooms, ids, roomIds, errors);
  validateCorridors(spec.corridors, ids, roomIds, errors);
  validateEntities(spec.entities, ids, roomIds, errors);
  validateEvents(spec.events, ids, errors);
  validateReachability(spec, roomIds, errors);

  return { valid: errors.length === 0, errors };
}

export function parseDungeonSpec(input) {
  let parsed = input;

  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch (error) {
      return {
        ok: false,
        spec: null,
        errors: [{ code: "JSON_PARSE_ERROR", path: "$", message: error.message }]
      };
    }
  }

  const result = validateDungeonSpec(parsed);
  if (!result.valid) {
    return { ok: false, spec: null, errors: result.errors };
  }

  return { ok: true, spec: parsed, errors: [] };
}
