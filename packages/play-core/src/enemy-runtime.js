import { applyGameplayStateCommand } from "./gameplay-state.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlaying(session) {
  return session && session.status === "playing";
}

function enemyEntities(session) {
  return session?.snapshot?.entities?.filter((entity) => entity.type === "enemy") ?? [];
}

function findEnemy(session, enemyId) {
  return enemyEntities(session).find((entity) => entity.id === enemyId) ?? null;
}

function defaultEnemyState() {
  return {
    status: "active",
    encounters: 0,
    lastEncounterAt: null,
    defeatedAt: null
  };
}

function currentEnemyState(session, enemyId) {
  const stored = session?.gameplayState?.entityStates?.[enemyId];
  return stored ? clone(stored) : defaultEnemyState();
}

function validateEnemyAction(session, enemyId, { requireCurrentRoom = true } = {}) {
  if (!isPlaying(session)) {
    return { ok: false, error: { code: "SESSION_NOT_PLAYING", message: "Session is not in playing state." } };
  }

  const enemy = findEnemy(session, enemyId);
  if (!enemy) {
    return { ok: false, error: { code: "ENEMY_NOT_FOUND", message: `Unknown enemy: ${enemyId}` } };
  }

  if (requireCurrentRoom && enemy.roomId !== session.currentRoomId) {
    return {
      ok: false,
      error: {
        code: "ENEMY_NOT_IN_CURRENT_ROOM",
        message: `${enemyId} is in ${enemy.roomId}, not ${session.currentRoomId}.`
      }
    };
  }

  return { ok: true, enemy };
}

function setEnemyState(next, enemyId, state) {
  const entityIds = next.snapshot.entities.map((entity) => entity.id);
  next.gameplayState = applyGameplayStateCommand(next.gameplayState, {
    type: "set-entity-state",
    entityId: enemyId,
    state
  }, { entityIds });
}

function incrementCounter(next, counter, delta = 1) {
  next.gameplayState = applyGameplayStateCommand(next.gameplayState, {
    type: "increment-counter",
    counter,
    delta
  });
}

export function getEnemyState(session, enemyId) {
  const enemy = findEnemy(session, enemyId);
  if (!enemy) return null;
  return {
    enemy: clone(enemy),
    state: currentEnemyState(session, enemyId)
  };
}

export function listRoomEnemies(session, roomId = session?.currentRoomId, { includeDefeated = false } = {}) {
  if (!session?.snapshot || typeof roomId !== "string") return [];

  return enemyEntities(session)
    .filter((enemy) => enemy.roomId === roomId)
    .map((enemy) => ({ enemy: clone(enemy), state: currentEnemyState(session, enemy.id) }))
    .filter((entry) => includeDefeated || entry.state.status !== "defeated");
}

export function recordEnemyEncounter(session, enemyId, { at = session?.startedAt ?? 0 } = {}) {
  const validation = validateEnemyAction(session, enemyId);
  if (!validation.ok) return validation;

  const previousState = currentEnemyState(session, enemyId);
  if (previousState.status === "defeated") {
    return { ok: false, error: { code: "ENEMY_ALREADY_DEFEATED", message: `${enemyId} is already defeated.` } };
  }

  const next = clone(session);
  setEnemyState(next, enemyId, {
    ...previousState,
    encounters: previousState.encounters + 1,
    lastEncounterAt: at
  });
  next.events.push({ type: "enemy-encounter", enemyId, roomId: validation.enemy.roomId, at });
  return { ok: true, session: next };
}

export function defeatEnemy(session, enemyId, { at = session?.startedAt ?? 0 } = {}) {
  const validation = validateEnemyAction(session, enemyId);
  if (!validation.ok) return validation;

  const previousState = currentEnemyState(session, enemyId);
  if (previousState.status === "defeated") {
    return { ok: false, error: { code: "ENEMY_ALREADY_DEFEATED", message: `${enemyId} is already defeated.` } };
  }

  const next = clone(session);
  setEnemyState(next, enemyId, {
    ...previousState,
    status: "defeated",
    defeatedAt: at
  });
  incrementCounter(next, "enemiesCleared", 1);
  next.events.push({ type: "enemy-defeated", enemyId, roomId: validation.enemy.roomId, at });
  return { ok: true, session: next };
}
