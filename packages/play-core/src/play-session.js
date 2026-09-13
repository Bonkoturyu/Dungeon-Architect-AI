import { validateDungeonSpec } from "../../core/src/dungeon-spec.js";
import { applyGameplayStateCommand, createGameplayState } from "./gameplay-state.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findEntity(spec, type) {
  return spec.entities.find((entity) => entity.type === type);
}

function buildAdjacency(spec) {
  const adjacency = new Map(spec.rooms.map((room) => [room.id, new Set()]));
  for (const corridor of spec.corridors) {
    adjacency.get(corridor.fromRoomId)?.add(corridor.toRoomId);
    adjacency.get(corridor.toRoomId)?.add(corridor.fromRoomId);
  }
  return adjacency;
}

function isPlaying(session) {
  return session && session.status === "playing";
}

export function startPlaySession(authoringSpec, { startedAt = 0 } = {}) {
  const validation = validateDungeonSpec(authoringSpec);
  if (!validation.valid) {
    return { ok: false, blocked: true, errors: validation.errors };
  }

  const snapshot = clone(authoringSpec);
  const start = findEntity(snapshot, "start");
  const goal = findEntity(snapshot, "goal");

  const session = {
    schemaVersion: "1.0",
    dungeonId: snapshot.id,
    dungeonSeed: snapshot.seed,
    snapshot,
    status: "playing",
    startedAt,
    completedAt: null,
    currentRoomId: start.roomId,
    goalRoomId: goal.roomId,
    visitedRoomIds: [start.roomId],
    moves: 0,
    gameplayState: createGameplayState({ roomEntries: 1 }),
    events: []
  };

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

  const spec = session.snapshot;
  const adjacency = buildAdjacency(spec);
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

  const next = clone(session);
  next.currentRoomId = targetRoomId;
  next.moves += 1;
  if (!next.visitedRoomIds.includes(targetRoomId)) next.visitedRoomIds.push(targetRoomId);
  next.gameplayState = applyGameplayStateCommand(next.gameplayState, {
    type: "increment-counter",
    counter: "roomEntries",
    delta: 1
  });
  next.events.push({ type: "move", roomId: targetRoomId, at });

  if (targetRoomId === next.goalRoomId) {
    next.status = "cleared";
    next.completedAt = at;
  }

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
      dungeonId: session.dungeonId,
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      elapsed: session.completedAt - session.startedAt,
      moves: session.moves,
      visitedRoomIds: [...session.visitedRoomIds],
      finalRoomId: session.currentRoomId,
      goalRoomId: session.goalRoomId
    }
  };
}
