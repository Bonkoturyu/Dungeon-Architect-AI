function assertPlaySession(session) {
  if (!session || typeof session !== 'object' || !session.snapshot) {
    throw new TypeError('derivePlayMap requires a PlaySession with a snapshot.');
  }
}

function corridorConnects(corridor, roomA, roomB) {
  return (
    (corridor.fromRoomId === roomA && corridor.toRoomId === roomB) ||
    (corridor.fromRoomId === roomB && corridor.toRoomId === roomA)
  );
}

function traversedCorridorIds(session) {
  const ids = [];
  let previousRoomId = session.snapshot.entities.find((entity) => entity.type === 'start')?.roomId ?? null;

  for (const event of session.events ?? []) {
    if (event?.type !== 'move' || typeof event.roomId !== 'string' || !previousRoomId) continue;
    const corridor = session.snapshot.corridors.find((candidate) =>
      corridorConnects(candidate, previousRoomId, event.roomId));
    if (corridor && !ids.includes(corridor.id)) ids.push(corridor.id);
    previousRoomId = event.roomId;
  }

  return ids;
}

export function listCurrentRoomExits(session) {
  assertPlaySession(session);
  const currentRoomId = session.currentRoomId;
  const exits = [];

  for (const corridor of session.snapshot.corridors) {
    let targetRoomId = null;
    if (corridor.fromRoomId === currentRoomId) targetRoomId = corridor.toRoomId;
    else if (corridor.toRoomId === currentRoomId) targetRoomId = corridor.fromRoomId;
    if (!targetRoomId) continue;

    exits.push({
      corridorId: corridor.id,
      targetRoomId,
      explored: session.visitedRoomIds.includes(targetRoomId),
    });
  }

  return exits.sort((a, b) => a.corridorId.localeCompare(b.corridorId));
}

export function derivePlayMap(session) {
  assertPlaySession(session);

  const exploredRoomIds = [...new Set(session.visitedRoomIds ?? [])];
  const corridorIds = traversedCorridorIds(session);
  const exits = listCurrentRoomExits(session);

  return {
    currentRoomId: session.currentRoomId,
    exploredRoomIds,
    traversedCorridorIds: corridorIds,
    currentExits: exits,
  };
}

export function createRendererVisibilityFromPlaySession(session) {
  const map = derivePlayMap(session);
  return {
    roomIds: map.exploredRoomIds,
    corridorIds: map.traversedCorridorIds,
    currentRoomId: map.currentRoomId,
  };
}
