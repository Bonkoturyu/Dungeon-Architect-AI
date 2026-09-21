import {
  CORRIDOR_SIDES,
  validateDungeonSpec,
} from "../../core/src/dungeon-spec.js";

function cloneSpec(spec) {
  return JSON.parse(JSON.stringify(spec));
}

function fail(code, message) {
  return { ok: false, error: { code, message } };
}

function validateResult(spec) {
  const validation = validateDungeonSpec(spec);
  if (!validation.valid) {
    return fail("EDIT_RESULT_INVALID", JSON.stringify(validation.errors));
  }
  return null;
}

const CORRIDOR_SIDE_SET = new Set(CORRIDOR_SIDES);

function normalizeCorridorSide(value) {
  if (value == null || value === "" || value === "auto") return null;
  return CORRIDOR_SIDE_SET.has(value) ? value : undefined;
}

function eventReferences(event, {
  roomIds = new Set(),
  corridorIds = new Set(),
  entityIds = new Set(),
} = {}) {
  const trigger = event?.trigger ?? {};
  if (typeof trigger.roomId === "string" && roomIds.has(trigger.roomId)) return true;
  if (typeof trigger.entityId === "string" && entityIds.has(trigger.entityId)) return true;
  if (Array.isArray(trigger.enemyIds) && trigger.enemyIds.some((id) => entityIds.has(id))) return true;

  for (const condition of event?.conditions ?? []) {
    if (Array.isArray(condition?.enemyIds) && condition.enemyIds.some((id) => entityIds.has(id))) return true;
  }

  for (const action of event?.actions ?? []) {
    if (typeof action?.corridorId === "string" && corridorIds.has(action.corridorId)) return true;
    if (Array.isArray(action?.enemyIds) && action.enemyIds.some((id) => entityIds.has(id))) return true;
  }

  return false;
}

export function applyEditCommand(spec, command) {
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    return fail("EDIT_COMMAND_INVALID", "Edit command must be an object.");
  }

  const next = cloneSpec(spec);
  let inverse;

  switch (command.type) {
    case "move-room": {
      const room = next.rooms.find((item) => item.id === command.roomId);
      if (!room) return fail("ROOM_NOT_FOUND", `Unknown room: ${command.roomId}`);
      if (!Number.isFinite(command.x) || !Number.isFinite(command.z)) {
        return fail("POSITION_INVALID", "Room x/z must be finite numbers.");
      }
      inverse = { type: "move-room", roomId: room.id, x: room.x, z: room.z };
      room.x = command.x;
      room.z = command.z;
      break;
    }

    case "add-room": {
      const room = command.room;
      if (!room || typeof room !== "object" || Array.isArray(room)) {
        return fail("ROOM_INVALID", "add-room requires a room object.");
      }
      if (next.rooms.some((item) => item.id === room.id)) {
        return fail("DUPLICATE_ID", `Duplicate room ID: ${room.id}`);
      }
      next.rooms.push(cloneSpec(room));
      inverse = { type: "remove-room", roomId: room.id };
      break;
    }

    case "remove-room": {
      const roomIndex = next.rooms.findIndex((item) => item.id === command.roomId);
      if (roomIndex < 0) return fail("ROOM_NOT_FOUND", `Unknown room: ${command.roomId}`);
      const protectedEntity = next.entities.find((entity) =>
        entity.roomId === command.roomId && ["start", "goal"].includes(entity.type));
      if (protectedEntity) {
        return fail(
          "PROTECTED_ROOM",
          `Room ${command.roomId} contains protected ${protectedEntity.type} entity ${protectedEntity.id}.`
        );
      }

      const removedRoom = next.rooms[roomIndex];
      const removedCorridors = next.corridors.filter((corridor) =>
        corridor.fromRoomId === command.roomId || corridor.toRoomId === command.roomId);
      const removedCorridorIds = new Set(removedCorridors.map((corridor) => corridor.id));
      const removedEntities = next.entities.filter((entity) => entity.roomId === command.roomId);
      const removedEntityIds = new Set(removedEntities.map((entity) => entity.id));
      const removedEvents = next.events.filter((event) => eventReferences(event, {
        roomIds: new Set([command.roomId]),
        corridorIds: removedCorridorIds,
        entityIds: removedEntityIds,
      }));

      next.rooms.splice(roomIndex, 1);
      next.corridors = next.corridors.filter((corridor) => !removedCorridorIds.has(corridor.id));
      next.entities = next.entities.filter((entity) => !removedEntityIds.has(entity.id));
      const removedEventIds = new Set(removedEvents.map((event) => event.id));
      next.events = next.events.filter((event) => !removedEventIds.has(event.id));

      inverse = {
        type: "restore-room",
        room: cloneSpec(removedRoom),
        corridors: cloneSpec(removedCorridors),
        entities: cloneSpec(removedEntities),
        events: cloneSpec(removedEvents),
      };
      break;
    }

    case "restore-room": {
      if (!command.room || typeof command.room !== "object") {
        return fail("ROOM_INVALID", "restore-room requires a room object.");
      }
      next.rooms.push(cloneSpec(command.room));
      next.corridors.push(...cloneSpec(command.corridors ?? []));
      next.entities.push(...cloneSpec(command.entities ?? []));
      next.events.push(...cloneSpec(command.events ?? []));
      inverse = { type: "remove-room", roomId: command.room.id };
      break;
    }

    case "add-corridor": {
      const corridor = command.corridor;
      if (!corridor || typeof corridor !== "object" || Array.isArray(corridor)) {
        return fail("CORRIDOR_INVALID", "add-corridor requires a corridor object.");
      }
      if (next.corridors.some((item) => item.id === corridor.id)) {
        return fail("DUPLICATE_ID", `Duplicate corridor ID: ${corridor.id}`);
      }
      next.corridors.push(cloneSpec(corridor));
      inverse = { type: "remove-corridor", corridorId: corridor.id };
      break;
    }

    case "remove-corridor": {
      const corridorIndex = next.corridors.findIndex((item) => item.id === command.corridorId);
      if (corridorIndex < 0) return fail("CORRIDOR_NOT_FOUND", `Unknown corridor: ${command.corridorId}`);
      const removedCorridor = next.corridors[corridorIndex];
      const removedEvents = next.events.filter((event) => eventReferences(event, {
        corridorIds: new Set([command.corridorId]),
      }));
      const removedEventIds = new Set(removedEvents.map((event) => event.id));
      next.corridors.splice(corridorIndex, 1);
      next.events = next.events.filter((event) => !removedEventIds.has(event.id));
      inverse = {
        type: "restore-corridor",
        corridor: cloneSpec(removedCorridor),
        events: cloneSpec(removedEvents),
      };
      break;
    }

    case "restore-corridor": {
      if (!command.corridor || typeof command.corridor !== "object") {
        return fail("CORRIDOR_INVALID", "restore-corridor requires a corridor object.");
      }
      next.corridors.push(cloneSpec(command.corridor));
      next.events.push(...cloneSpec(command.events ?? []));
      inverse = { type: "remove-corridor", corridorId: command.corridor.id };
      break;
    }

    case "set-corridor-doors": {
      const corridor = next.corridors.find((item) => item.id === command.corridorId);
      if (!corridor) return fail("CORRIDOR_NOT_FOUND", `Unknown corridor: ${command.corridorId}`);

      const fromSide = normalizeCorridorSide(command.fromSide);
      const toSide = normalizeCorridorSide(command.toSide);
      if (fromSide === undefined || toSide === undefined) {
        return fail(
          "CORRIDOR_SIDE_INVALID",
          `Corridor side must be auto or one of: ${CORRIDOR_SIDES.join(", ")}.`
        );
      }

      inverse = {
        type: "set-corridor-doors",
        corridorId: corridor.id,
        fromSide: corridor.fromSide ?? null,
        toSide: corridor.toSide ?? null,
      };

      if (fromSide == null) delete corridor.fromSide;
      else corridor.fromSide = fromSide;
      if (toSide == null) delete corridor.toSide;
      else corridor.toSide = toSide;
      break;
    }

    case "move-entity": {
      const entity = next.entities.find((item) => item.id === command.entityId);
      if (!entity) return fail("ENTITY_NOT_FOUND", `Unknown entity: ${command.entityId}`);
      if (!next.rooms.some((room) => room.id === command.roomId)) {
        return fail("ROOM_NOT_FOUND", `Unknown room: ${command.roomId}`);
      }
      if (entity.type === "start" || entity.type === "goal") {
        const counterpartType = entity.type === "start" ? "goal" : "start";
        const counterpart = next.entities.find((item) => item.type === counterpartType);
        if (counterpart?.roomId === command.roomId) {
          return fail(
            "START_GOAL_SAME_ROOM",
            `Start and Goal must be in different rooms; ${command.roomId} already contains ${counterpartType}.`
          );
        }
      }
      inverse = { type: "move-entity", entityId: entity.id, roomId: entity.roomId };
      entity.roomId = command.roomId;
      break;
    }

    case "resize-room": {
      const room = next.rooms.find((item) => item.id === command.roomId);
      if (!room) return fail("ROOM_NOT_FOUND", `Unknown room: ${command.roomId}`);
      if (!Number.isFinite(command.width) || command.width <= 0 ||
          !Number.isFinite(command.depth) || command.depth <= 0) {
        return fail("ROOM_DIMENSION_INVALID", "Room width/depth must be finite numbers greater than zero.");
      }
      inverse = {
        type: "resize-room",
        roomId: room.id,
        width: room.width,
        depth: room.depth
      };
      room.width = command.width;
      room.depth = command.depth;
      break;
    }

    case "add-entity": {
      const entity = command.entity;
      if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
        return fail("ENTITY_INVALID", "add-entity requires an entity object.");
      }
      if (["start", "goal"].includes(entity.type)) {
        return fail("PROTECTED_ENTITY_TYPE", "Start/Goal creation is not supported by generic add-entity.");
      }
      if (next.entities.some((item) => item.id === entity.id)) {
        return fail("DUPLICATE_ID", `Duplicate entity ID: ${entity.id}`);
      }
      next.entities.push(cloneSpec(entity));
      inverse = { type: "remove-entity", entityId: entity.id };
      break;
    }

    case "remove-entity": {
      const index = next.entities.findIndex((item) => item.id === command.entityId);
      if (index < 0) return fail("ENTITY_NOT_FOUND", `Unknown entity: ${command.entityId}`);
      const entity = next.entities[index];
      if (["start", "goal"].includes(entity.type)) {
        return fail("PROTECTED_ENTITY_TYPE", "Start/Goal cannot be removed by generic remove-entity.");
      }
      next.entities.splice(index, 1);
      inverse = { type: "add-entity", entity: cloneSpec(entity) };
      break;
    }

    default:
      return fail("EDIT_COMMAND_UNSUPPORTED", `Unsupported edit command: ${String(command.type)}`);
  }

  const invalid = validateResult(next);
  if (invalid) return invalid;

  return { ok: true, spec: next, inverse };
}
