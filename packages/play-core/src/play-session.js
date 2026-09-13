import { validateDungeonSpec } from "../../core/src/dungeon-spec.js";
import { applyGameplayStateCommand, createGameplayState } from "./gameplay-state.js";
import { dispatchSupportedEvents, isRuntimeCorridorEnabled } from "./event-runtime.js";

export const PLAY_FAILURE_REASONS = Object.freeze([
  "player-defeated",
  "timeout",
  "progression-blocked",
  "stopped"
]);

const PLAY_FAILURE_REASON_SET = new Set(PLAY_FAILURE_REASONS);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findEntity(spec, type) {
  return spec.entities.find((entity) => entity.type === type);
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
    deaths: session.status === "failed" && session.failureReason === "player-defeated" ? 1 : 0
  };
}

export function startPlaySession(authoringSpec, { startedAt = 0 } = {}) {
  const validation = validateDungeonSpec(authoringSpec);
  if (!validation.valid) {
    return { ok: false, blocked: true, errors: validation.errors };
  }

  const snapshot = clone(authoringSpec);
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

  if (session.currentRoomId === session.goalRoomId) {
    session.status = "cleared";
    session.completedAt = startedAt;
  }

  return { ok: true, blocked: false, session };
}

export function movePlaySession(session, targetRoomId, { at = session?.startedAt ?? 0 } = {}) {
  if (!isPlaying(session)) {
    return { ok: false, error: { code: "SESSION_NOT_PLAYING", message: "Session is not in playing state." } };
  }

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

  let next = clone(session);
  next.currentRoomId = targetRoomId;
  next.moves += 1;
  if (!next.visitedRoomIds.includes(targetRoomId)) next.visitedRoomIds.push(targetRoomId);
  next.gameplayState = applyGameplayStateCommand(next.gameplayState, {
    type: "increment-counter",
    counter: "roomEntries",
    delta: 1
  });
  next.events.push({ type: "move", roomId: targetRoomId, at });

  const dispatched = dispatchSupportedEvents(next, {
    type: "on_enter_room",
    roomId: targetRoomId
  }, { at });
  if (!dispatched.ok) return dispatched;
  next = dispatched.session;

  if (targetRoomId === next.goalRoomId) {
    next.status = "cleared";
    next.failureReason = null;
    next.completedAt = at;
  }

  return { ok: true, session: next };
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
      metrics: gameplayMetrics(session)
    }
  };
}
