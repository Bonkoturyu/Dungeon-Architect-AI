import { getEffectiveDamage } from './equipment-runtime.js';
import { TRAP_RULES_V1 } from '../../core/src/trap-rules.js';
import { validateDungeonSpec } from "../../core/src/dungeon-spec.js";
import { applyGameplayStateCommand, createGameplayState } from "./gameplay-state.js";
import { dispatchSupportedEvents, isRuntimeCorridorEnabled } from "./event-runtime.js";
import { createInitialPlayerState, normalizePlayerState } from "./progression-runtime.js";

export const PLAY_FAILURE_REASONS = Object.freeze([
  "player-defeated",
  "timeout",
  "progression-blocked",
  "stopped"
]);

const PLAY_FAILURE_REASON_SET = new Set(PLAY_FAILURE_REASONS);

export const DEFAULT_PLAYER_MAX_HP = 20;

function assertNonNegativeSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findEntity(spec, type) {
  return spec.entities.find((entity) => entity.type === type);
}

function corridorConnects(corridor, roomA, roomB) {
  return (
    (corridor.fromRoomId === roomA && corridor.toRoomId === roomB) ||
    (corridor.fromRoomId === roomB && corridor.toRoomId === roomA)
  );
}

function buildAdjacency(session) {
  const spec = session.snapshot;
  const adjacency = new Map(spec.rooms.map((room) => [room.id, new Set()]));
  for (const corridor of spec.corridors) {
    if (!isRuntimeCorridorEnabled(session, corridor)) continue;
    adjacency.get(corridor.fromRoomId)?.add(corridor.toRoomId);
    adjacency.get(corridor.toRoomId)?.add(corridor.fromRoomId);
  }
  return adjacency;
}

function isPlaying(session) {
  return session && session.status === "playing";
}

function resultRouteRoomIds(session) {
  const startRoomId = findEntity(session.snapshot, "start")?.roomId ?? session.visitedRoomIds?.[0] ?? null;
  const route = startRoomId ? [startRoomId] : [];
  for (const event of session.events ?? []) {
    if (event?.type === "move" && typeof event.roomId === "string") route.push(event.roomId);
  }
  return route;
}

function gameplayMetrics(session) {
  const counters = session.gameplayState?.counters ?? {};
  return {
    roomsVisited: session.visitedRoomIds?.length ?? 0,
    roomEntries: counters.roomEntries ?? 0,
    interactions: counters.interactions ?? 0,
    enemiesCleared: counters.enemiesCleared ?? 0,
    treasuresOpened: counters.treasuresOpened ?? 0,
    trapsTriggered: counters.trapsTriggered ?? 0,
    recoveryUsed: counters.recoveryUsed ?? 0,
    damageTaken: counters.damageTaken ?? 0,
    healingReceived: counters.healingReceived ?? 0,
    xpEarned: counters.xpEarned ?? 0,
    goldEarned: counters.goldEarned ?? 0,
    levelUps: counters.levelUps ?? 0,
    lootCollected: counters.lootCollected ?? 0,
    deaths: session.status === "failed" && session.failureReason === "player-defeated" ? 1 : 0
  };
}

export function startPlaySession(
  authoringSpec,
  { startedAt = 0, maxHp = DEFAULT_PLAYER_MAX_HP, initialPlayerState = null } = {}
) {
  const validation = validateDungeonSpec(authoringSpec);
  if (!validation.valid) {
    return { ok: false, blocked: true, errors: validation.errors };
  }
  let playerState;
  if (initialPlayerState !== null) {
    try {
      playerState = normalizePlayerState(initialPlayerState);
    } catch (error) {
      return {
        ok: false,
        blocked: true,
        errors: [{
          code: "PLAYER_STATE_INVALID",
          path: "playerState",
          message: error instanceof Error ? error.message : String(error)
        }]
      };
    }
    if (playerState.hp <= 0) {
      return {
        ok: false,
        blocked: true,
        errors: [{
          code: "PLAYER_STATE_INVALID",
          path: "playerState.hp",
          message: "A new PlaySession requires playerState.hp to be greater than zero."
        }]
      };
    }
  } else {
    if (!Number.isSafeInteger(maxHp) || maxHp <= 0) {
      return {
        ok: false,
        blocked: true,
        errors: [{ code: "PLAYER_MAX_HP_INVALID", path: "playerState.maxHp", message: "maxHp must be a positive safe integer." }]
      };
    }
    playerState = createInitialPlayerState(maxHp);
  }

  const snapshot = clone(authoringSpec);
  if (snapshot.trapRules === undefined) snapshot.trapRules = { ...TRAP_RULES_V1 };
  const start = findEntity(snapshot, "start");
  const goal = findEntity(snapshot, "goal");

  let session = {
    schemaVersion: "1.0",
    dungeonId: snapshot.id,
    dungeonSeed: snapshot.seed,
    snapshot,
    status: "playing",
    failureReason: null,
    startedAt,
    completedAt: null,
    currentRoomId: start.roomId,
    goalRoomId: goal.roomId,
    visitedRoomIds: [start.roomId],
    moves: 0,
    playerState,
    gameplayState: createGameplayState({ roomEntries: 1 }),
    events: []
  };

  const dispatched = dispatchSupportedEvents(session, {
    type: "on_enter_room",
    roomId: start.roomId
  }, { at: startedAt });
  if (!dispatched.ok) {
    return {
      ok: false,
      blocked: true,
      errors: [{ code: "EVENT_RUNTIME_FAILURE", path: "events", message: JSON.stringify(dispatched.error) }]
    };
  }
  session = dispatched.session;

  if (session.currentRoomId === session.goalRoomId && !isSpecialGoal(session)) {
    session.status = "cleared";
    session.completedAt = startedAt;
  }

  return { ok: true, blocked: false, session };
}

function isSpecialGoal(session) {
  return ['monster-house', 'trap-house', 'shop'].includes(session.snapshot.rooms.find(({ id }) => id === session.goalRoomId)?.kind)
    || session.snapshot.entities.some(({ type, roomId }) => roomId === session.goalRoomId && ['trap', 'enemy'].includes(type));
}

export function getGoalCompletionState(session) {
  if (!isPlaying(session) || session.currentRoomId !== session.goalRoomId) return { available: false, blocked: false };
  const blocked = session.snapshot.entities.some((entity) => {
    if (entity.roomId !== session.goalRoomId) return false;
    const status = session.gameplayState.entityStates[entity.id]?.status;
    return (entity.type === 'enemy' && (status ?? (entity.initiallyActive === false ? 'dormant' : 'active')) === 'active') ||
      (entity.type === 'trap' && (status ?? 'armed') === 'armed');
  });
  return { available: true, blocked };
}

// 店での購入は一切クリア条件にしない。特殊Goalは任意のタイミングで明示終了できる。
export function completePlayGoal(session, { at = session?.startedAt ?? 0 } = {}) {
  const state = getGoalCompletionState(session);
  if (!state.available) return { ok: false, error: { code: 'GOAL_NOT_AVAILABLE' } };
  if (state.blocked) return { ok: false, error: { code: 'SPECIAL_ROOM_BLOCKED' } };
  const next = clone(session);
  next.status = 'cleared'; next.failureReason = null; next.completedAt = at;
  next.events.push({ type: 'complete-goal', roomId: next.goalRoomId, at });
  return { ok: true, session: next };
}

export function movePlaySession(session, targetRoomId, { at = session?.startedAt ?? 0, corridorId = null } = {}) {
  if (!isPlaying(session)) {
    return { ok: false, error: { code: "SESSION_NOT_PLAYING", message: "Session is not in playing state." } };
  }

  const blocked = session.snapshot.entities.some((entity) => {
    if (entity.roomId !== session.currentRoomId) return false;
    const state = session.gameplayState.entityStates[entity.id];
    return (entity.type === 'enemy' && (state?.status ?? (entity.initiallyActive === false ? 'dormant' : 'active')) === 'active') ||
      (entity.type === 'trap' && (state?.status ?? 'armed') === 'armed');
  });
  if (blocked) return { ok: false, error: { code: 'SPECIAL_ROOM_BLOCKED', message: 'Resolve all enemies and traps before leaving this room.' } };

  const adjacency = buildAdjacency(session);
  if (!adjacency.has(targetRoomId)) {
    return { ok: false, error: { code: "ROOM_NOT_FOUND", message: `Unknown room: ${targetRoomId}` } };
  }

  if (!adjacency.get(session.currentRoomId)?.has(targetRoomId)) {
    return {
      ok: false,
      error: {
        code: "ROOM_NOT_ADJACENT",
        message: `${targetRoomId} is not adjacent to ${session.currentRoomId}.`
      }
    };
  }

  const enabledCandidates = session.snapshot.corridors.filter((corridor) =>
    corridorConnects(corridor, session.currentRoomId, targetRoomId) &&
    isRuntimeCorridorEnabled(session, corridor)
  );

  let traversedCorridor = enabledCandidates[0] ?? null;
  if (corridorId !== null) {
    const requestedCorridor = session.snapshot.corridors.find((corridor) => corridor.id === corridorId) ?? null;
    if (!requestedCorridor) {
      return {
        ok: false,
        error: { code: "CORRIDOR_NOT_FOUND", message: `Unknown corridor: ${corridorId}` }
      };
    }
    if (!corridorConnects(requestedCorridor, session.currentRoomId, targetRoomId)) {
      return {
        ok: false,
        error: {
          code: "CORRIDOR_TARGET_MISMATCH",
          message: `${corridorId} does not connect ${session.currentRoomId} to ${targetRoomId}.`
        }
      };
    }
    if (!isRuntimeCorridorEnabled(session, requestedCorridor)) {
      return {
        ok: false,
        error: { code: "CORRIDOR_DISABLED", message: `${corridorId} is disabled.` }
      };
    }
    traversedCorridor = requestedCorridor;
  }

  if (!traversedCorridor) {
    return {
      ok: false,
      error: {
        code: "ROOM_NOT_ADJACENT",
        message: `${targetRoomId} is not adjacent to ${session.currentRoomId}.`
      }
    };
  }

  let next = clone(session);
  next.currentRoomId = targetRoomId;
  next.moves += 1;
  if (!next.visitedRoomIds.includes(targetRoomId)) next.visitedRoomIds.push(targetRoomId);
  next.gameplayState = applyGameplayStateCommand(next.gameplayState, {
    type: "increment-counter",
    counter: "roomEntries",
    delta: 1
  });
  next.events.push({ type: "move", roomId: targetRoomId, corridorId: traversedCorridor.id, at });

  const dispatched = dispatchSupportedEvents(next, {
    type: "on_enter_room",
    roomId: targetRoomId
  }, { at });
  if (!dispatched.ok) return dispatched;
  next = dispatched.session;

  if (targetRoomId === next.goalRoomId && !isSpecialGoal(next)) {
    next.status = "cleared";
    next.failureReason = null;
    next.completedAt = at;
  }

  return { ok: true, session: next };
}

export function applyPlayerDamage(
  session,
  amount,
  { at = session?.startedAt ?? 0, sourceType = "unknown", sourceId = null } = {}
) {
  if (!isPlaying(session)) {
    return { ok: false, error: { code: "SESSION_NOT_PLAYING", message: "Session is not in playing state." } };
  }

  try {
    assertNonNegativeSafeInteger(amount, "damage amount");
  } catch (error) {
    return {
      ok: false,
      error: { code: "PLAYER_DAMAGE_INVALID", message: error instanceof Error ? error.message : String(error) }
    };
  }

  const next = clone(session);
  const hpBefore = next.playerState?.hp;
  const maxHp = next.playerState?.maxHp;
  if (!Number.isSafeInteger(hpBefore) || !Number.isSafeInteger(maxHp) || maxHp <= 0 || hpBefore < 0 || hpBefore > maxHp) {
    return { ok: false, error: { code: "PLAYER_STATE_INVALID", message: "Player HP state is invalid." } };
  }

  let effectiveDamage;
  try { effectiveDamage = getEffectiveDamage(next, amount, sourceType); }
  catch (error) { return { ok: false, error: { code: "EQUIPMENT_RULES_INVALID", message: error.message } }; }
  const applied = Math.min(effectiveDamage, hpBefore);
  next.playerState.hp = hpBefore - applied;
  if (applied > 0) {
    next.gameplayState = applyGameplayStateCommand(next.gameplayState, {
      type: "increment-counter",
      counter: "damageTaken",
      delta: applied
    });
  }
  next.events.push({
    type: "player-damaged",
    amount: applied,
    requestedAmount: amount,
    hpBefore,
    hpAfter: next.playerState.hp,
    sourceType,
    sourceId,
    roomId: next.currentRoomId,
    at
  });

  if (next.playerState.hp === 0) {
    next.status = "failed";
    next.failureReason = "player-defeated";
    next.completedAt = at;
    next.events.push({ type: "session-failed", reason: "player-defeated", roomId: next.currentRoomId, at });
  }

  return { ok: true, session: next, applied };
}

export function applyPlayerHealing(
  session,
  amount,
  { at = session?.startedAt ?? 0, sourceType = "unknown", sourceId = null } = {}
) {
  if (!isPlaying(session)) {
    return { ok: false, error: { code: "SESSION_NOT_PLAYING", message: "Session is not in playing state." } };
  }

  try {
    assertNonNegativeSafeInteger(amount, "healing amount");
  } catch (error) {
    return {
      ok: false,
      error: { code: "PLAYER_HEALING_INVALID", message: error instanceof Error ? error.message : String(error) }
    };
  }

  const next = clone(session);
  const hpBefore = next.playerState?.hp;
  const maxHp = next.playerState?.maxHp;
  if (!Number.isSafeInteger(hpBefore) || !Number.isSafeInteger(maxHp) || maxHp <= 0 || hpBefore < 0 || hpBefore > maxHp) {
    return { ok: false, error: { code: "PLAYER_STATE_INVALID", message: "Player HP state is invalid." } };
  }

  const applied = Math.min(amount, maxHp - hpBefore);
  next.playerState.hp = hpBefore + applied;
  if (applied > 0) {
    next.gameplayState = applyGameplayStateCommand(next.gameplayState, {
      type: "increment-counter",
      counter: "healingReceived",
      delta: applied
    });
  }
  next.events.push({
    type: "player-healed",
    amount: applied,
    requestedAmount: amount,
    hpBefore,
    hpAfter: next.playerState.hp,
    sourceType,
    sourceId,
    roomId: next.currentRoomId,
    at
  });

  return { ok: true, session: next, applied };
}

export function failPlaySession(session, reason, { at = session?.startedAt ?? 0 } = {}) {
  if (!isPlaying(session)) {
    return { ok: false, error: { code: "SESSION_NOT_PLAYING", message: "Session is not in playing state." } };
  }
  if (!PLAY_FAILURE_REASON_SET.has(reason)) {
    return {
      ok: false,
      error: {
        code: "FAILURE_REASON_UNSUPPORTED",
        message: `Unsupported failure reason: ${String(reason)}`
      }
    };
  }

  const next = clone(session);
  next.status = "failed";
  next.failureReason = reason;
  if (reason === "player-defeated" && next.playerState) next.playerState.hp = 0;
  next.completedAt = at;
  next.events.push({ type: "session-failed", reason, roomId: next.currentRoomId, at });
  return { ok: true, session: next };
}

export function applyPlaySessionStateCommand(session, command, { at = session?.startedAt ?? 0 } = {}) {
  if (!isPlaying(session)) {
    return { ok: false, error: { code: "SESSION_NOT_PLAYING", message: "Session is not in playing state." } };
  }

  try {
    const next = clone(session);
    const entityIds = next.snapshot.entities.map((entity) => entity.id);
    next.gameplayState = applyGameplayStateCommand(next.gameplayState, command, { entityIds });
    next.events.push({ type: "state-command", command: clone(command), at });
    return { ok: true, session: next };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INVALID_STATE_COMMAND",
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

export function createPlayResult(session) {
  if (!session || !["cleared", "failed"].includes(session.status)) {
    return { ok: false, error: { code: "SESSION_NOT_FINISHED", message: "Session must be cleared or failed." } };
  }

  return {
    ok: true,
    result: {
      schemaVersion: "1.0",
      dungeonId: session.dungeonId,
      status: session.status,
      failureReason: session.status === "failed" ? session.failureReason ?? null : null,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      elapsed: session.completedAt - session.startedAt,
      moves: session.moves,
      routeRoomIds: resultRouteRoomIds(session),
      visitedRoomIds: [...session.visitedRoomIds],
      finalRoomId: session.currentRoomId,
      goalRoomId: session.goalRoomId,
      playerState: clone(session.playerState),
      metrics: gameplayMetrics(session)
    }
  };
}
