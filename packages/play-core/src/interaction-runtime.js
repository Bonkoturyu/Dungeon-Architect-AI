import { applyGameplayStateCommand } from "./gameplay-state.js";
import { dispatchSupportedEvents } from "./event-runtime.js";
import { applyPlayerDamage, applyPlayerHealing } from "./play-session.js";

export const DEFAULT_TRAP_DAMAGE = 6;
export const DEFAULT_RECOVERY_HEALING = 8;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlaying(session) {
  return session && session.status === "playing";
}

function entitiesOfType(session, type) {
  return session?.snapshot?.entities?.filter((entity) => entity.type === type) ?? [];
}

function findEntity(session, type, entityId) {
  return entitiesOfType(session, type).find((entity) => entity.id === entityId) ?? null;
}

function defaultTreasureState() {
  return {
    status: "closed",
    inspections: 0,
    lastInspectedAt: null,
    openedAt: null
  };
}

function defaultTrapState() {
  return {
    status: "armed",
    inspections: 0,
    lastInspectedAt: null,
    resolvedAt: null
  };
}

function defaultRecoveryState() {
  return {
    status: "available",
    usedAt: null
  };
}

function defaultStateForType(type) {
  switch (type) {
    case "treasure": return defaultTreasureState();
    case "trap": return defaultTrapState();
    case "recovery": return defaultRecoveryState();
    default: throw new RangeError(`unsupported interaction entity type: ${type}`);
  }
}

function currentEntityState(session, type, entityId) {
  const stored = session?.gameplayState?.entityStates?.[entityId];
  return stored ? { ...defaultStateForType(type), ...clone(stored) } : defaultStateForType(type);
}

function errorPrefix(type) {
  return type.toUpperCase();
}

function validateAction(session, type, entityId, { requireCurrentRoom = true } = {}) {
  if (!isPlaying(session)) {
    return { ok: false, error: { code: "SESSION_NOT_PLAYING", message: "Session is not in playing state." } };
  }

  const entity = findEntity(session, type, entityId);
  if (!entity) {
    return {
      ok: false,
      error: { code: `${errorPrefix(type)}_NOT_FOUND`, message: `Unknown ${type}: ${entityId}` }
    };
  }

  if (requireCurrentRoom && entity.roomId !== session.currentRoomId) {
    return {
      ok: false,
      error: {
        code: `${errorPrefix(type)}_NOT_IN_CURRENT_ROOM`,
        message: `${entityId} is in ${entity.roomId}, not ${session.currentRoomId}.`
      }
    };
  }

  return { ok: true, entity };
}

function setEntityState(next, entityId, state) {
  const entityIds = next.snapshot.entities.map((entity) => entity.id);
  next.gameplayState = applyGameplayStateCommand(next.gameplayState, {
    type: "set-entity-state",
    entityId,
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

function incrementInteraction(next) {
  incrementCounter(next, "interactions", 1);
}

function entityView(session, type, entityId) {
  const entity = findEntity(session, type, entityId);
  if (!entity) return null;
  return {
    entity: clone(entity),
    warning: entity.warning ?? null,
    state: currentEntityState(session, type, entityId)
  };
}

function dispatchEntityTriggers(session, entityId, triggerTypes, at) {
  let current = session;
  for (const type of triggerTypes) {
    const dispatched = dispatchSupportedEvents(current, { type, entityId }, { at });
    if (!dispatched.ok) return dispatched;
    current = dispatched.session;
  }
  return { ok: true, session: current };
}

export function getTreasureState(session, treasureId) {
  return entityView(session, "treasure", treasureId);
}

export function getTrapState(session, trapId) {
  return entityView(session, "trap", trapId);
}

export function getRecoveryState(session, recoveryId) {
  return entityView(session, "recovery", recoveryId);
}

export function listRoomInteractables(session, roomId = session?.currentRoomId, { includeResolved = false } = {}) {
  if (!session?.snapshot || typeof roomId !== "string") return [];

  const results = [];
  for (const type of ["treasure", "trap", "recovery"]) {
    for (const entity of entitiesOfType(session, type)) {
      if (entity.roomId !== roomId) continue;
      const state = currentEntityState(session, type, entity.id);
      const resolved =
        (type === "treasure" && state.status === "opened") ||
        (type === "trap" && state.status !== "armed") ||
        (type === "recovery" && state.status === "used");
      if (!includeResolved && resolved) continue;
      results.push({ entity: clone(entity), warning: entity.warning ?? null, state });
    }
  }

  return results.sort((a, b) => a.entity.id.localeCompare(b.entity.id));
}

export function inspectTreasure(session, treasureId, { at = session?.startedAt ?? 0 } = {}) {
  const validation = validateAction(session, "treasure", treasureId);
  if (!validation.ok) return validation;

  const previousState = currentEntityState(session, "treasure", treasureId);
  const next = clone(session);
  setEntityState(next, treasureId, {
    ...previousState,
    inspections: previousState.inspections + 1,
    lastInspectedAt: at
  });
  incrementInteraction(next);
  next.events.push({
    type: "treasure-inspected",
    treasureId,
    roomId: validation.entity.roomId,
    warning: validation.entity.warning ?? null,
    at
  });
  return dispatchEntityTriggers(next, treasureId, ["on_interact_entity"], at);
}

export function openTreasure(session, treasureId, { at = session?.startedAt ?? 0 } = {}) {
  const validation = validateAction(session, "treasure", treasureId);
  if (!validation.ok) return validation;

  const previousState = currentEntityState(session, "treasure", treasureId);
  if (previousState.status === "opened") {
    return {
      ok: false,
      error: { code: "TREASURE_ALREADY_OPENED", message: `${treasureId} is already opened.` }
    };
  }

  const next = clone(session);
  setEntityState(next, treasureId, { ...previousState, status: "opened", openedAt: at });
  incrementCounter(next, "treasuresOpened", 1);
  incrementInteraction(next);
  next.events.push({ type: "treasure-opened", treasureId, roomId: validation.entity.roomId, at });
  return dispatchEntityTriggers(next, treasureId, ["on_interact_entity", "on_open_treasure"], at);
}

export function inspectTrap(session, trapId, { at = session?.startedAt ?? 0 } = {}) {
  const validation = validateAction(session, "trap", trapId);
  if (!validation.ok) return validation;

  const previousState = currentEntityState(session, "trap", trapId);
  const next = clone(session);
  setEntityState(next, trapId, {
    ...previousState,
    inspections: previousState.inspections + 1,
    lastInspectedAt: at
  });
  incrementInteraction(next);
  next.events.push({
    type: "trap-inspected",
    trapId,
    roomId: validation.entity.roomId,
    warning: validation.entity.warning ?? null,
    at
  });
  return dispatchEntityTriggers(next, trapId, ["on_interact_entity"], at);
}

function resolveTrap(
  session,
  trapId,
  resolution,
  { at = session?.startedAt ?? 0, damage = resolution === "triggered" ? DEFAULT_TRAP_DAMAGE : 0 } = {}
) {
  const validation = validateAction(session, "trap", trapId);
  if (!validation.ok) return validation;

  const previousState = currentEntityState(session, "trap", trapId);
  if (previousState.status !== "armed") {
    return {
      ok: false,
      error: {
        code: "TRAP_ALREADY_RESOLVED",
        message: `${trapId} is already ${previousState.status}.`
      }
    };
  }

  const next = clone(session);
  setEntityState(next, trapId, { ...previousState, status: resolution, resolvedAt: at });
  if (resolution === "triggered") incrementCounter(next, "trapsTriggered", 1);
  incrementInteraction(next);
  next.events.push({
    type: resolution === "triggered" ? "trap-triggered" : "trap-avoided",
    trapId,
    roomId: validation.entity.roomId,
    warning: validation.entity.warning ?? null,
    at
  });
  const dispatched = dispatchEntityTriggers(next, trapId, ["on_interact_entity"], at);
  if (!dispatched.ok || resolution !== "triggered") return dispatched;

  const configuredDamage = validation.entity.damage ?? damage;
  if (!Number.isSafeInteger(configuredDamage) || configuredDamage < 0) {
    return {
      ok: false,
      error: { code: "TRAP_DAMAGE_INVALID", message: `Invalid trap damage for ${trapId}.` }
    };
  }
  return applyPlayerDamage(dispatched.session, configuredDamage, {
    at,
    sourceType: "trap",
    sourceId: trapId
  });
}

export function avoidTrap(session, trapId, options = {}) {
  return resolveTrap(session, trapId, "avoided", options);
}

export function triggerTrap(session, trapId, options = {}) {
  return resolveTrap(session, trapId, "triggered", options);
}

export function useRecovery(
  session,
  recoveryId,
  { at = session?.startedAt ?? 0, healing = DEFAULT_RECOVERY_HEALING } = {}
) {
  const validation = validateAction(session, "recovery", recoveryId);
  if (!validation.ok) return validation;

  const previousState = currentEntityState(session, "recovery", recoveryId);
  if (previousState.status === "used") {
    return {
      ok: false,
      error: { code: "RECOVERY_ALREADY_USED", message: `${recoveryId} is already used.` }
    };
  }

  const next = clone(session);
  setEntityState(next, recoveryId, { ...previousState, status: "used", usedAt: at });
  incrementCounter(next, "recoveryUsed", 1);
  incrementInteraction(next);
  next.events.push({ type: "recovery-used", recoveryId, roomId: validation.entity.roomId, at });
  const dispatched = dispatchEntityTriggers(next, recoveryId, ["on_interact_entity"], at);
  if (!dispatched.ok) return dispatched;

  const configuredHealing = validation.entity.healing ?? healing;
  if (!Number.isSafeInteger(configuredHealing) || configuredHealing < 0) {
    return {
      ok: false,
      error: { code: "RECOVERY_HEALING_INVALID", message: `Invalid recovery healing for ${recoveryId}.` }
    };
  }
  return applyPlayerHealing(dispatched.session, configuredHealing, {
    at,
    sourceType: "recovery",
    sourceId: recoveryId
  });
}
