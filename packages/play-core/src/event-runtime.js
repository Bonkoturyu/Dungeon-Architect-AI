import { applyGameplayStateCommand } from "./gameplay-state.js";

const EVENT_FIRED_FLAG_PREFIX = "__dai:event-fired:";
const SHORTCUT_FLAG_PREFIX = "__dai:shortcut-enabled:";
const DOOR_UNLOCKED_FLAG_PREFIX = "__dai:door-unlocked:";
const DOOR_OPEN_FLAG_PREFIX = "__dai:door-open:";
const HINT_REVEALED_FLAG_PREFIX = "__dai:hint-revealed:";

const SUPPORTED_TRIGGER_TYPES = new Set([
  "on_enter_room",
  "on_interact_entity",
  "on_open_treasure",
  "on_enemy_group_cleared"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlaying(session) {
  return session && session.status === "playing";
}

function findEnemy(session, enemyId) {
  return session?.snapshot?.entities?.find((entity) => entity.type === "enemy" && entity.id === enemyId) ?? null;
}

function defaultEnemyState(enemy) {
  return {
    status: enemy?.initiallyActive === false ? "dormant" : "active",
    encounters: 0,
    lastEncounterAt: null,
    defeatedAt: null
  };
}

function enemyState(session, enemyId) {
  const enemy = findEnemy(session, enemyId);
  if (!enemy) return null;
  const stored = session?.gameplayState?.entityStates?.[enemyId];
  return stored ? { ...defaultEnemyState(enemy), ...clone(stored) } : defaultEnemyState(enemy);
}

function enemyGroupCleared(session, enemyIds) {
  return enemyIds.every((enemyId) => enemyState(session, enemyId)?.status === "defeated");
}

function setFlag(session, key, value) {
  session.gameplayState = applyGameplayStateCommand(session.gameplayState, {
    type: "set-flag",
    key,
    value
  });
}

function setEntityState(session, entityId, state) {
  const entityIds = session.snapshot.entities.map((entity) => entity.id);
  session.gameplayState = applyGameplayStateCommand(session.gameplayState, {
    type: "set-entity-state",
    entityId,
    state
  }, { entityIds });
}

function setInventoryCount(session, itemId, count) {
  session.gameplayState = applyGameplayStateCommand(session.gameplayState, {
    type: "set-inventory-count",
    itemId,
    count
  });
}

function triggerMatches(session, eventTrigger, trigger) {
  if (eventTrigger.type !== trigger.type) return false;

  switch (eventTrigger.type) {
    case "on_enter_room":
      return eventTrigger.roomId === trigger.roomId;
    case "on_interact_entity":
    case "on_open_treasure":
      return eventTrigger.entityId === trigger.entityId;
    case "on_enemy_group_cleared":
      return (!trigger.enemyId || eventTrigger.enemyIds.includes(trigger.enemyId)) &&
        enemyGroupCleared(session, eventTrigger.enemyIds);
    default:
      return false;
  }
}

function conditionPasses(session, event, condition) {
  switch (condition.type) {
    case "flag":
      return session.gameplayState.flags[condition.key] === condition.value;
    case "item_owned":
      return (session.gameplayState.inventory[condition.itemId] ?? 0) >= condition.minCount;
    case "enemy_group_state": {
      const cleared = enemyGroupCleared(session, condition.enemyIds);
      return condition.state === "cleared" ? cleared : !cleared;
    }
    case "one_shot":
      return session.gameplayState.flags[`${EVENT_FIRED_FLAG_PREFIX}${event.id}`] !== true;
    default:
      return false;
  }
}

function conditionsPass(session, event) {
  return (event.conditions ?? []).every((condition) => conditionPasses(session, event, condition));
}

function applySpawnEnemyGroup(session, action, at) {
  for (const enemyId of action.enemyIds) {
    const enemy = findEnemy(session, enemyId);
    if (!enemy) {
      return { ok: false, error: { code: "EVENT_ENEMY_NOT_FOUND", message: `Unknown enemy: ${enemyId}` } };
    }

    const current = enemyState(session, enemyId);
    if (current.status === "defeated") {
      return {
        ok: false,
        error: { code: "EVENT_ENEMY_ALREADY_DEFEATED", message: `${enemyId} cannot be spawned after defeat.` }
      };
    }

    if (current.status === "dormant") {
      setEntityState(session, enemyId, { ...current, status: "active", spawnedAt: at });
      session.events.push({ type: "enemy-spawned", enemyId, roomId: enemy.roomId, at });
    }
  }
  return { ok: true };
}

function applyAction(session, action, at) {
  switch (action.type) {
    case "spawn_enemy_group":
      return applySpawnEnemyGroup(session, action, at);
    case "unlock_open_door":
      setFlag(session, `${DOOR_UNLOCKED_FLAG_PREFIX}${action.doorId}`, true);
      setFlag(session, `${DOOR_OPEN_FLAG_PREFIX}${action.doorId}`, true);
      return { ok: true };
    case "enable_shortcut":
      setFlag(session, `${SHORTCUT_FLAG_PREFIX}${action.corridorId}`, true);
      return { ok: true };
    case "give_reward": {
      const current = session.gameplayState.inventory[action.itemId] ?? 0;
      const next = current + action.count;
      if (!Number.isSafeInteger(next)) {
        return { ok: false, error: { code: "EVENT_REWARD_OVERFLOW", message: `Inventory overflow: ${action.itemId}` } };
      }
      setInventoryCount(session, action.itemId, next);
      return { ok: true };
    }
    case "set_flag":
      setFlag(session, action.key, action.value);
      return { ok: true };
    case "reveal_hint":
      setFlag(session, `${HINT_REVEALED_FLAG_PREFIX}${action.hintId}`, true);
      return { ok: true };
    default:
      return { ok: false, error: { code: "EVENT_ACTION_UNSUPPORTED", message: `Unsupported action: ${action.type}` } };
  }
}

export function isRuntimeCorridorEnabled(session, corridor) {
  if (!corridor || corridor.initiallyEnabled !== false) return true;
  return session?.gameplayState?.flags?.[`${SHORTCUT_FLAG_PREFIX}${corridor.id}`] === true;
}

export function getRuntimeDoorState(session, doorId) {
  return {
    unlocked: session?.gameplayState?.flags?.[`${DOOR_UNLOCKED_FLAG_PREFIX}${doorId}`] === true,
    open: session?.gameplayState?.flags?.[`${DOOR_OPEN_FLAG_PREFIX}${doorId}`] === true
  };
}

export function isRuntimeHintRevealed(session, hintId) {
  return session?.gameplayState?.flags?.[`${HINT_REVEALED_FLAG_PREFIX}${hintId}`] === true;
}

export function dispatchSupportedEvents(session, trigger, { at = session?.startedAt ?? 0 } = {}) {
  if (!isPlaying(session)) {
    return { ok: false, error: { code: "SESSION_NOT_PLAYING", message: "Session is not in playing state." } };
  }
  if (!trigger || !SUPPORTED_TRIGGER_TYPES.has(trigger.type)) {
    return { ok: false, error: { code: "EVENT_TRIGGER_UNSUPPORTED", message: `Unsupported trigger: ${trigger?.type}` } };
  }

  let current = clone(session);
  const firedEventIds = [];

  for (const event of current.snapshot.events ?? []) {
    if (!triggerMatches(current, event.trigger, trigger)) continue;
    if (!conditionsPass(current, event)) continue;

    const candidate = clone(current);
    for (const action of event.actions) {
      const applied = applyAction(candidate, action, at);
      if (!applied.ok) {
        return {
          ok: false,
          error: {
            code: "EVENT_ACTION_FAILED",
            eventId: event.id,
            actionType: action.type,
            cause: applied.error
          }
        };
      }
    }

    if ((event.conditions ?? []).some((condition) => condition.type === "one_shot")) {
      setFlag(candidate, `${EVENT_FIRED_FLAG_PREFIX}${event.id}`, true);
    }

    candidate.events.push({
      type: "logic-event-fired",
      eventId: event.id,
      trigger: clone(trigger),
      actionTypes: event.actions.map((action) => action.type),
      at
    });
    current = candidate;
    firedEventIds.push(event.id);
  }

  return { ok: true, session: current, firedEventIds };
}
