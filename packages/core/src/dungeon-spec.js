export const DUNGEON_SPEC_VERSION = "1.0";

export const ENTITY_TYPES = Object.freeze([
  "start",
  "goal",
  "enemy",
  "treasure",
  "trap",
  "recovery"
]);

export const CORRIDOR_SIDES = Object.freeze([
  "north",
  "east",
  "south",
  "west"
]);

export const EVENT_TRIGGER_TYPES = Object.freeze([
  "on_enter_room",
  "on_interact_entity",
  "on_open_treasure",
  "on_enemy_group_cleared"
]);

export const EVENT_CONDITION_TYPES = Object.freeze([
  "flag",
  "item_owned",
  "enemy_group_state",
  "one_shot"
]);

export const EVENT_ACTION_TYPES = Object.freeze([
  "spawn_enemy_group",
  "unlock_open_door",
  "enable_shortcut",
  "give_reward",
  "set_flag",
  "reveal_hint"
]);

const ENTITY_TYPE_SET = new Set(ENTITY_TYPES);
const CORRIDOR_SIDE_SET = new Set(CORRIDOR_SIDES);
const EVENT_TRIGGER_TYPE_SET = new Set(EVENT_TRIGGER_TYPES);
const EVENT_CONDITION_TYPE_SET = new Set(EVENT_CONDITION_TYPES);
const EVENT_ACTION_TYPE_SET = new Set(EVENT_ACTION_TYPES);
const RESERVED_RUNTIME_FLAG_PREFIX = "__dai:";

function pushError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isJsonScalar(value) {
  return value === null || typeof value === "boolean" || typeof value === "string" || isFiniteNumber(value);
}

function validateId(value, path, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    pushError(errors, "ID_REQUIRED", path, "ID must be a non-empty string.");
    return false;
  }
  return true;
}

function validateNonEmptyString(value, path, errors, code = "STRING_REQUIRED") {
  if (typeof value !== "string" || value.trim() === "") {
    pushError(errors, code, path, "Value must be a non-empty string.");
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

function validateRoomGeometry(rooms, errors) {
  if (!Array.isArray(rooms)) return;

  for (let leftIndex = 0; leftIndex < rooms.length; leftIndex += 1) {
    const left = rooms[leftIndex];
    if (!isRecord(left) ||
        !["x", "z", "width", "depth"].every((field) => isFiniteNumber(left[field])) ||
        left.width <= 0 ||
        left.depth <= 0) {
      continue;
    }

    const leftMinX = left.x - left.width / 2;
    const leftMaxX = left.x + left.width / 2;
    const leftMinZ = left.z - left.depth / 2;
    const leftMaxZ = left.z + left.depth / 2;

    for (let rightIndex = leftIndex + 1; rightIndex < rooms.length; rightIndex += 1) {
      const right = rooms[rightIndex];
      if (!isRecord(right) ||
          !["x", "z", "width", "depth"].every((field) => isFiniteNumber(right[field])) ||
          right.width <= 0 ||
          right.depth <= 0) {
        continue;
      }

      const rightMinX = right.x - right.width / 2;
      const rightMaxX = right.x + right.width / 2;
      const rightMinZ = right.z - right.depth / 2;
      const rightMaxZ = right.z + right.depth / 2;

      const overlapX = Math.min(leftMaxX, rightMaxX) - Math.max(leftMinX, rightMinX);
      const overlapZ = Math.min(leftMaxZ, rightMaxZ) - Math.max(leftMinZ, rightMinZ);

      // Zero-width contact is allowed so connected rooms may intentionally share a wall.
      if (overlapX > 1e-9 && overlapZ > 1e-9) {
        pushError(
          errors,
          "ROOM_OVERLAP",
          `rooms[${rightIndex}]`,
          `Rooms ${String(left.id)} and ${String(right.id)} overlap; touching edges are allowed, overlapping interiors are not.`
        );
      }
    }
  }
}

function validateCorridors(corridors, ids, roomIds, corridorIds, errors) {
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
    if (typeof corridor.id === "string" && corridor.id.trim() !== "") corridorIds.add(corridor.id);

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

    if (corridor.initiallyEnabled !== undefined && typeof corridor.initiallyEnabled !== "boolean") {
      pushError(errors, "BOOLEAN_REQUIRED", `${path}.initiallyEnabled`, "initiallyEnabled must be a boolean when provided.");
    }

    for (const field of ["fromSide", "toSide"]) {
      if (corridor[field] !== undefined && !CORRIDOR_SIDE_SET.has(corridor[field])) {
        pushError(
          errors,
          "CORRIDOR_SIDE_INVALID",
          `${path}.${field}`,
          `${field} must be one of: ${CORRIDOR_SIDES.join(", ")}.`
        );
      }
    }
  });
}

function validateEntities(entities, ids, roomIds, entityIds, entityTypeById, errors) {
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
    if (typeof entity.id === "string" && entity.id.trim() !== "") {
      entityIds.add(entity.id);
      entityTypeById.set(entity.id, entity.type);
    }

    if (!ENTITY_TYPE_SET.has(entity.type)) {
      pushError(errors, "ENTITY_TYPE_UNSUPPORTED", `${path}.type`, `Unsupported entity type: ${String(entity.type)}`);
    }

    if (entity.type === "start") startCount += 1;
    if (entity.type === "goal") goalCount += 1;

    if (entity.type === "enemy" && entity.initiallyActive !== undefined && typeof entity.initiallyActive !== "boolean") {
      pushError(errors, "BOOLEAN_REQUIRED", `${path}.initiallyActive`, "initiallyActive must be a boolean when provided.");
    }

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

  if (startCount === 1 && goalCount === 1) {
    const start = entities.find((entity) => entity?.type === "start");
    const goal = entities.find((entity) => entity?.type === "goal");
    if (
      start &&
      goal &&
      typeof start.roomId === "string" &&
      typeof goal.roomId === "string" &&
      roomIds.has(start.roomId) &&
      roomIds.has(goal.roomId) &&
      start.roomId === goal.roomId
    ) {
      pushError(
        errors,
        "START_GOAL_SAME_ROOM",
        "entities",
        `Start and Goal must be in different rooms; both reference ${start.roomId}.`
      );
    }
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

function validateEntityReference(entityId, path, entityIds, errors) {
  if (typeof entityId !== "string" || !entityIds.has(entityId)) {
    pushError(errors, "ENTITY_REFERENCE_MISSING", path, `Unknown entity reference: ${String(entityId)}`);
    return false;
  }
  return true;
}

function validateEnemyIdArray(enemyIds, path, entityIds, entityTypeById, errors) {
  if (!Array.isArray(enemyIds) || enemyIds.length === 0) {
    pushError(errors, "ENEMY_GROUP_INVALID", path, "enemyIds must be a non-empty array.");
    return false;
  }

  const seen = new Set();
  let valid = true;
  enemyIds.forEach((enemyId, index) => {
    const itemPath = `${path}[${index}]`;
    if (!validateEntityReference(enemyId, itemPath, entityIds, errors)) {
      valid = false;
      return;
    }
    if (entityTypeById.get(enemyId) !== "enemy") {
      pushError(errors, "ENEMY_REFERENCE_REQUIRED", itemPath, `${enemyId} is not an enemy entity.`);
      valid = false;
    }
    if (seen.has(enemyId)) {
      pushError(errors, "DUPLICATE_REFERENCE", itemPath, `Duplicate enemy reference: ${enemyId}`);
      valid = false;
    }
    seen.add(enemyId);
  });
  return valid;
}

function validateTrigger(trigger, path, roomIds, entityIds, entityTypeById, errors) {
  if (!isRecord(trigger)) {
    pushError(errors, "OBJECT_REQUIRED", path, "Event trigger must be an object.");
    return;
  }
  if (!EVENT_TRIGGER_TYPE_SET.has(trigger.type)) {
    pushError(errors, "EVENT_TRIGGER_UNSUPPORTED", `${path}.type`, `Unsupported event trigger: ${String(trigger.type)}`);
    return;
  }

  switch (trigger.type) {
    case "on_enter_room":
      if (typeof trigger.roomId !== "string" || !roomIds.has(trigger.roomId)) {
        pushError(errors, "ROOM_REFERENCE_MISSING", `${path}.roomId`, `Unknown room reference: ${String(trigger.roomId)}`);
      }
      break;
    case "on_interact_entity":
      validateEntityReference(trigger.entityId, `${path}.entityId`, entityIds, errors);
      break;
    case "on_open_treasure":
      if (validateEntityReference(trigger.entityId, `${path}.entityId`, entityIds, errors) && entityTypeById.get(trigger.entityId) !== "treasure") {
        pushError(errors, "TREASURE_REFERENCE_REQUIRED", `${path}.entityId`, `${trigger.entityId} is not a treasure entity.`);
      }
      break;
    case "on_enemy_group_cleared":
      validateEnemyIdArray(trigger.enemyIds, `${path}.enemyIds`, entityIds, entityTypeById, errors);
      break;
  }
}

function validateCondition(condition, path, entityIds, entityTypeById, errors) {
  if (!isRecord(condition)) {
    pushError(errors, "OBJECT_REQUIRED", path, "Event condition must be an object.");
    return;
  }
  if (!EVENT_CONDITION_TYPE_SET.has(condition.type)) {
    pushError(errors, "EVENT_CONDITION_UNSUPPORTED", `${path}.type`, `Unsupported event condition: ${String(condition.type)}`);
    return;
  }

  switch (condition.type) {
    case "flag":
      validateNonEmptyString(condition.key, `${path}.key`, errors, "FLAG_KEY_REQUIRED");
      if (!isJsonScalar(condition.value)) {
        pushError(errors, "JSON_SCALAR_REQUIRED", `${path}.value`, "Flag condition value must be a JSON scalar.");
      }
      break;
    case "item_owned":
      validateNonEmptyString(condition.itemId, `${path}.itemId`, errors, "ITEM_ID_REQUIRED");
      if (!Number.isSafeInteger(condition.minCount) || condition.minCount < 1) {
        pushError(errors, "ITEM_COUNT_INVALID", `${path}.minCount`, "minCount must be a positive safe integer.");
      }
      break;
    case "enemy_group_state":
      validateEnemyIdArray(condition.enemyIds, `${path}.enemyIds`, entityIds, entityTypeById, errors);
      if (!["cleared", "not_cleared"].includes(condition.state)) {
        pushError(errors, "ENEMY_GROUP_STATE_INVALID", `${path}.state`, "enemy group state must be cleared or not_cleared.");
      }
      break;
    case "one_shot":
      break;
  }
}

function validateAction(action, path, corridorIds, entityIds, entityTypeById, errors) {
  if (!isRecord(action)) {
    pushError(errors, "OBJECT_REQUIRED", path, "Event action must be an object.");
    return;
  }
  if (!EVENT_ACTION_TYPE_SET.has(action.type)) {
    pushError(errors, "EVENT_ACTION_UNSUPPORTED", `${path}.type`, `Unsupported event action: ${String(action.type)}`);
    return;
  }

  switch (action.type) {
    case "spawn_enemy_group":
      validateEnemyIdArray(action.enemyIds, `${path}.enemyIds`, entityIds, entityTypeById, errors);
      break;
    case "unlock_open_door":
      validateNonEmptyString(action.doorId, `${path}.doorId`, errors, "DOOR_ID_REQUIRED");
      break;
    case "enable_shortcut":
      if (typeof action.corridorId !== "string" || !corridorIds.has(action.corridorId)) {
        pushError(errors, "CORRIDOR_REFERENCE_MISSING", `${path}.corridorId`, `Unknown corridor reference: ${String(action.corridorId)}`);
      }
      break;
    case "give_reward":
      validateNonEmptyString(action.itemId, `${path}.itemId`, errors, "ITEM_ID_REQUIRED");
      if (!Number.isSafeInteger(action.count) || action.count < 1) {
        pushError(errors, "ITEM_COUNT_INVALID", `${path}.count`, "reward count must be a positive safe integer.");
      }
      break;
    case "set_flag":
      if (validateNonEmptyString(action.key, `${path}.key`, errors, "FLAG_KEY_REQUIRED") && action.key.startsWith(RESERVED_RUNTIME_FLAG_PREFIX)) {
        pushError(errors, "FLAG_KEY_RESERVED", `${path}.key`, `${RESERVED_RUNTIME_FLAG_PREFIX} is reserved for runtime bookkeeping.`);
      }
      if (!isJsonScalar(action.value)) {
        pushError(errors, "JSON_SCALAR_REQUIRED", `${path}.value`, "Flag action value must be a JSON scalar.");
      }
      break;
    case "reveal_hint":
      validateNonEmptyString(action.hintId, `${path}.hintId`, errors, "HINT_ID_REQUIRED");
      break;
  }
}

function validateEvents(events, ids, roomIds, corridorIds, entityIds, entityTypeById, errors) {
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
    validateTrigger(event.trigger, `${path}.trigger`, roomIds, entityIds, entityTypeById, errors);

    if (event.conditions !== undefined && !Array.isArray(event.conditions)) {
      pushError(errors, "ARRAY_REQUIRED", `${path}.conditions`, "conditions must be an array when provided.");
    } else {
      (event.conditions ?? []).forEach((condition, conditionIndex) => {
        validateCondition(condition, `${path}.conditions[${conditionIndex}]`, entityIds, entityTypeById, errors);
      });
    }

    if (!Array.isArray(event.actions) || event.actions.length === 0) {
      pushError(errors, "EVENT_ACTIONS_REQUIRED", `${path}.actions`, "actions must be a non-empty array.");
    } else {
      event.actions.forEach((action, actionIndex) => {
        validateAction(action, `${path}.actions[${actionIndex}]`, corridorIds, entityIds, entityTypeById, errors);
      });
    }
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
  const corridorIds = new Set();
  const entityIds = new Set();
  const entityTypeById = new Map();

  validateRooms(spec.rooms, ids, roomIds, errors);
  validateRoomGeometry(spec.rooms, errors);
  validateCorridors(spec.corridors, ids, roomIds, corridorIds, errors);
  validateEntities(spec.entities, ids, roomIds, entityIds, entityTypeById, errors);
  validateEvents(spec.events, ids, roomIds, corridorIds, entityIds, entityTypeById, errors);
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
