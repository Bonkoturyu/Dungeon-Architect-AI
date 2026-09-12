import { validateDungeonSpec } from "../../core/src/dungeon-spec.js";

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

    case "move-entity": {
      const entity = next.entities.find((item) => item.id === command.entityId);
      if (!entity) return fail("ENTITY_NOT_FOUND", `Unknown entity: ${command.entityId}`);
      if (!next.rooms.some((room) => room.id === command.roomId)) {
        return fail("ROOM_NOT_FOUND", `Unknown room: ${command.roomId}`);
      }
      inverse = { type: "move-entity", entityId: entity.id, roomId: entity.roomId };
      entity.roomId = command.roomId;
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
