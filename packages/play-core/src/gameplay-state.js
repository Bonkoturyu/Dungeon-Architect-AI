const COUNTER_KEYS = Object.freeze([
  "roomEntries",
  "interactions",
  "enemiesCleared",
  "treasuresOpened",
  "trapsTriggered",
  "recoveryUsed",
  "damageTaken",
  "healingReceived"
]);

export const GAMEPLAY_COUNTER_KEYS = COUNTER_KEYS;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function assertJsonScalar(value, name) {
  const valid = value === null || typeof value === "boolean" || typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value));
  if (!valid) throw new TypeError(`${name} must be a JSON scalar`);
}

function assertPlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be a plain object`);
  }
  try {
    JSON.stringify(value);
  } catch {
    throw new TypeError(`${name} must be JSON serializable`);
  }
}

export function createGameplayState({ roomEntries = 1 } = {}) {
  if (!Number.isSafeInteger(roomEntries) || roomEntries < 0) {
    throw new RangeError("roomEntries must be a non-negative safe integer");
  }

  const counters = Object.fromEntries(COUNTER_KEYS.map((key) => [key, 0]));
  counters.roomEntries = roomEntries;

  return {
    schemaVersion: "1.0",
    flags: {},
    inventory: {},
    entityStates: {},
    counters
  };
}

export function applyGameplayStateCommand(state, command, { entityIds = [] } = {}) {
  if (!state || state.schemaVersion !== "1.0") {
    throw new TypeError("gameplay state must be schemaVersion 1.0");
  }
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    throw new TypeError("command must be an object");
  }

  const next = clone(state);

  switch (command.type) {
    case "set-flag": {
      assertNonEmptyString(command.key, "flag key");
      assertJsonScalar(command.value, "flag value");
      next.flags[command.key] = command.value;
      return next;
    }

    case "set-inventory-count": {
      assertNonEmptyString(command.itemId, "itemId");
      if (!Number.isSafeInteger(command.count) || command.count < 0) {
        throw new RangeError("inventory count must be a non-negative safe integer");
      }
      if (command.count === 0) delete next.inventory[command.itemId];
      else next.inventory[command.itemId] = command.count;
      return next;
    }

    case "set-entity-state": {
      assertNonEmptyString(command.entityId, "entityId");
      if (!entityIds.includes(command.entityId)) {
        throw new RangeError(`unknown entityId: ${command.entityId}`);
      }
      assertPlainObject(command.state, "entity state");
      next.entityStates[command.entityId] = clone(command.state);
      return next;
    }

    case "increment-counter": {
      if (!COUNTER_KEYS.includes(command.counter)) {
        throw new RangeError(`unknown gameplay counter: ${command.counter}`);
      }
      const delta = command.delta ?? 1;
      if (!Number.isSafeInteger(delta) || delta < 0) {
        throw new RangeError("counter delta must be a non-negative safe integer");
      }
      const value = next.counters[command.counter] + delta;
      if (!Number.isSafeInteger(value)) {
        throw new RangeError(`gameplay counter overflow: ${command.counter}`);
      }
      next.counters[command.counter] = value;
      return next;
    }

    default:
      throw new RangeError(`unsupported gameplay state command: ${command.type}`);
  }
}
