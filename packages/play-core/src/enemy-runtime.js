import { applyGameplayStateCommand } from "./gameplay-state.js";
import { dispatchSupportedEvents } from "./event-runtime.js";
import { applyPlayerDamage } from "./play-session.js";
import { grantEnemyReward } from "./progression-runtime.js";

export const DEFAULT_ENEMY_DAMAGE = 4;

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

function defaultEnemyState(enemy) {
  return {
    status: enemy?.initiallyActive === false ? "dormant" : "active",
    encounters: 0,
    lastEncounterAt: null,
    defeatedAt: null
  };
}

function currentEnemyState(session, enemyId) {
  const enemy = findEnemy(session, enemyId);
  if (!enemy) return null;
  const stored = session?.gameplayState?.entityStates?.[enemyId];
  return stored ? { ...defaultEnemyState(enemy), ...clone(stored) } : defaultEnemyState(enemy);
}

function validateEnemyAction(session, enemyId, { requireCurrentRoom = true } = {}) {
  if (!isPlaying(session)) {
    return { ok: false, error: { code: "SESSION_NOT_PLAYING", message: "Session is not in playing state." } };
  }

  const enemy = findEnemy(session, enemyId);
  if (!enemy) {
    return { ok: false, error: { code: "ENEMY_NOT_FOUND", message: `Unknown enemy: ${enemyId}` } };
  }

  const state = currentEnemyState(session, enemyId);
  if (state.status === "dormant") {
    return { ok: false, error: { code: "ENEMY_NOT_ACTIVE", message: `${enemyId} is dormant.` } };
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

export function listRoomEnemies(session, roomId = session?.currentRoomId, { includeDefeated = false, includeDormant = false } = {}) {
  if (!session?.snapshot || typeof roomId !== "string") return [];

  return enemyEntities(session)
    .filter((enemy) => enemy.roomId === roomId)
    .map((enemy) => ({ enemy: clone(enemy), state: currentEnemyState(session, enemy.id) }))
    .filter((entry) => (includeDefeated || entry.state.status !== "defeated") &&
      (includeDormant || entry.state.status !== "dormant"));
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

export function resolveEnemyCombat(
  session,
  enemyId,
  { at = session?.startedAt ?? 0, damage = null } = {}
) {
  const validation = validateEnemyAction(session, enemyId);
  if (!validation.ok) return validation;

  const previousState = currentEnemyState(session, enemyId);
  if (previousState.status === "defeated") {
    return { ok: false, error: { code: "ENEMY_ALREADY_DEFEATED", message: `${enemyId} is already defeated.` } };
  }

  const configuredDamage = damage ?? validation.enemy.damage ?? DEFAULT_ENEMY_DAMAGE;
  if (!Number.isSafeInteger(configuredDamage) || configuredDamage < 0) {
    return {
      ok: false,
      error: { code: "ENEMY_DAMAGE_INVALID", message: `Invalid enemy damage for ${enemyId}.` }
    };
  }

  let current = session;
  if ((previousState.encounters ?? 0) === 0) {
    const encountered = recordEnemyEncounter(current, enemyId, { at });
    if (!encountered.ok) return encountered;
    current = encountered.session;
  }

  const damaged = applyPlayerDamage(current, configuredDamage, {
    at,
    sourceType: "enemy",
    sourceId: enemyId
  });
  if (!damaged.ok) return damaged;

  if (damaged.session.status === "failed") {
    return { ok: true, session: damaged.session, defeated: false, damageApplied: damaged.applied };
  }

  const defeated = defeatEnemy(damaged.session, enemyId, { at });
  if (!defeated.ok) return defeated;
  return {
    ok: true,
    session: defeated.session,
    defeated: true,
    damageApplied: damaged.applied,
    reward: defeated.reward ?? null
  };
}

export function defeatEnemy(session, enemyId, { at = session?.startedAt ?? 0 } = {}) {
  const validation = validateEnemyAction(session, enemyId);
  if (!validation.ok) return validation;

  const previousState = currentEnemyState(session, enemyId);
  if (previousState.status === "defeated") {
    return { ok: false, error: { code: "ENEMY_ALREADY_DEFEATED", message: `${enemyId} is already defeated.` } };
  }

  let next = clone(session);
  setEnemyState(next, enemyId, {
    ...previousState,
    status: "defeated",
    defeatedAt: at
  });
  incrementCounter(next, "enemiesCleared", 1);
  next.events.push({ type: "enemy-defeated", enemyId, roomId: validation.enemy.roomId, at });

  const dispatched = dispatchSupportedEvents(next, {
    type: "on_enemy_group_cleared",
    enemyId
  }, { at });
  if (!dispatched.ok) return dispatched;
  next = dispatched.session;

  const rewarded = grantEnemyReward(next, enemyId, { at });
  if (!rewarded.ok) return rewarded;
  return { ok: true, session: rewarded.session, reward: rewarded.reward };
}
