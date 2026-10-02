function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildGraph(spec) {
  const graph = new Map(spec.rooms.map((room) => [room.id, new Set()]));
  for (const corridor of spec.corridors) {
    if (corridor.initiallyEnabled === false) continue;
    graph.get(corridor.fromRoomId)?.add(corridor.toRoomId);
    graph.get(corridor.toRoomId)?.add(corridor.fromRoomId);
  }
  return new Map([...graph].map(([roomId, neighbors]) => [roomId, [...neighbors].sort((a, b) => a.localeCompare(b))]));
}

function shortestPath(graph, startRoomId, goalRoomId) {
  if (startRoomId === goalRoomId) return [startRoomId];
  if (!graph.has(startRoomId) || !graph.has(goalRoomId)) return null;

  const queue = [startRoomId];
  const previous = new Map([[startRoomId, null]]);
  while (queue.length > 0) {
    const roomId = queue.shift();
    for (const next of graph.get(roomId) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, roomId);
      if (next === goalRoomId) {
        const path = [goalRoomId];
        let cursor = roomId;
        while (cursor !== null) {
          path.push(cursor);
          cursor = previous.get(cursor) ?? null;
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}

function pathKey(path) {
  return path.join('\u0000');
}

function weightedPath(graph, startRoomId, goalRoomId, roomPenalty) {
  if (startRoomId === goalRoomId) return [startRoomId];
  if (!graph.has(startRoomId) || !graph.has(goalRoomId)) return null;

  const frontier = [{ roomId: startRoomId, cost: 0, hops: 0, path: [startRoomId] }];
  const best = new Map();

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost || a.hops - b.hops || pathKey(a.path).localeCompare(pathKey(b.path)));
    const current = frontier.shift();
    const bestSeen = best.get(current.roomId);
    if (bestSeen && (bestSeen.cost < current.cost || (bestSeen.cost === current.cost && bestSeen.hops <= current.hops))) continue;
    best.set(current.roomId, { cost: current.cost, hops: current.hops });
    if (current.roomId === goalRoomId) return current.path;

    for (const next of graph.get(current.roomId) ?? []) {
      if (current.path.includes(next)) continue;
      frontier.push({
        roomId: next,
        cost: current.cost + 1 + (roomPenalty.get(next) ?? 0),
        hops: current.hops + 1,
        path: [...current.path, next],
      });
    }
  }
  return null;
}

function chooseObservedNext(observation, targetRoomId, graph, { roomPenalty = null } = {}) {
  if (observation.currentRoomId === targetRoomId) return null;
  const candidates = [];
  for (const roomId of observation.adjacentRoomIds) {
    const path = roomPenalty
      ? weightedPath(graph, roomId, targetRoomId, roomPenalty)
      : shortestPath(graph, roomId, targetRoomId);
    if (!path) continue;
    const cost = roomPenalty
      ? path.slice(1).reduce((sum, id) => sum + 1 + (roomPenalty.get(id) ?? 0), 1 + (roomPenalty.get(roomId) ?? 0))
      : path.length;
    candidates.push({ roomId, cost, hops: path.length, path });
  }
  candidates.sort((a, b) => a.cost - b.cost || a.hops - b.hops || a.roomId.localeCompare(b.roomId));
  return candidates[0]?.roomId ?? null;
}

function openedTreasureIds(trace) {
  return new Set(trace.filter((entry) => entry?.action?.type === 'open-treasure').map((entry) => entry.action.treasureId));
}

function treasureTargets(spec, trace) {
  const opened = openedTreasureIds(trace);
  return spec.entities
    .filter((entity) => entity.type === 'treasure' && !opened.has(entity.id))
    .map((entity) => ({ id: entity.id, roomId: entity.roomId }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function chooseNearestTreasure(spec, graph, observation, trace) {
  const candidates = [];
  for (const treasure of treasureTargets(spec, trace)) {
    const path = shortestPath(graph, observation.currentRoomId, treasure.roomId);
    if (!path) continue;
    candidates.push({ ...treasure, path, distance: path.length - 1 });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id) || a.roomId.localeCompare(b.roomId));
  return candidates[0] ?? null;
}

function hazardPenaltyByRoom(spec) {
  const penalty = new Map(spec.rooms.map((room) => [room.id, 0]));
  for (const entity of spec.entities) {
    if (!penalty.has(entity.roomId)) continue;
    if (entity.type === 'trap') penalty.set(entity.roomId, penalty.get(entity.roomId) + 6);
    if (entity.type === 'enemy') penalty.set(entity.roomId, penalty.get(entity.roomId) + 4);
  }
  return penalty;
}

function policy(fn, id) {
  const wrapped = (observation, trace) => {
    if (['monster-house', 'trap-house'].includes(observation.currentRoomKind)) {
      const enemy = observation.enemies[0];
      if (enemy) return { type: 'combat-enemy', enemyId: enemy.id };
      const trap = observation.interactables.find(({ type }) => type === 'trap');
      if (trap) return { type: 'avoid-trap', trapId: trap.id };
    }
    if (observation.availableActions.some(({ type }) => type === 'complete-goal')) return { type: 'complete-goal' };
    return fn(observation, trace);
  };
  Object.defineProperty(wrapped, 'policyId', { value: id, enumerable: true });
  return wrapped;
}

export function createShortestPathAgent(spec) {
  const graph = buildGraph(clone(spec));
  return policy((observation) => {
    const next = chooseObservedNext(observation, observation.goalRoomId, graph);
    return next ? { type: 'move', roomId: next } : { type: 'stop' };
  }, 'shortest-path');
}

export function createTreasureGreedyAgent(spec) {
  const frozenSpec = clone(spec);
  const graph = buildGraph(frozenSpec);

  return policy((observation, trace) => {
    const localTreasure = observation.interactables
      .filter((entry) => entry.type === 'treasure')
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (localTreasure) return { type: 'open-treasure', treasureId: localTreasure.id };

    const target = chooseNearestTreasure(frozenSpec, graph, observation, trace);
    const targetRoomId = target?.roomId ?? observation.goalRoomId;
    const next = chooseObservedNext(observation, targetRoomId, graph);
    return next ? { type: 'move', roomId: next } : { type: 'stop' };
  }, 'treasure-greedy');
}

export function createCautiousAgent(spec) {
  const frozenSpec = clone(spec);
  const graph = buildGraph(frozenSpec);
  const roomPenalty = hazardPenaltyByRoom(frozenSpec);

  return policy((observation) => {
    const localTrap = observation.interactables
      .filter((entry) => entry.type === 'trap')
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (localTrap) {
      if ((localTrap.inspections ?? 0) === 0) return { type: 'inspect-trap', trapId: localTrap.id };
      return { type: 'avoid-trap', trapId: localTrap.id };
    }

    const next = chooseObservedNext(observation, observation.goalRoomId, graph, { roomPenalty });
    return next ? { type: 'move', roomId: next } : { type: 'stop' };
  }, 'cautious');
}

export const BUILTIN_AGENT_IDS = Object.freeze(['shortest-path', 'treasure-greedy', 'cautious']);
