function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function round(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function buildStaticGraph(spec) {
  const graph = new Map((spec?.rooms ?? []).map((room) => [room.id, new Set()]));
  for (const corridor of spec?.corridors ?? []) {
    if (corridor.initiallyEnabled === false) continue;
    graph.get(corridor.fromRoomId)?.add(corridor.toRoomId);
    graph.get(corridor.toRoomId)?.add(corridor.fromRoomId);
  }
  return graph;
}

function shortestMoves(spec, startRoomId, goalRoomId) {
  if (startRoomId === goalRoomId) return 0;
  const graph = buildStaticGraph(spec);
  if (!graph.has(startRoomId) || !graph.has(goalRoomId)) return null;

  const queue = [{ roomId: startRoomId, moves: 0 }];
  const seen = new Set([startRoomId]);
  while (queue.length > 0) {
    const current = queue.shift();
    for (const next of graph.get(current.roomId) ?? []) {
      if (seen.has(next)) continue;
      const moves = current.moves + 1;
      if (next === goalRoomId) return moves;
      seen.add(next);
      queue.push({ roomId: next, moves });
    }
  }
  return null;
}

function entityCount(spec, type) {
  return (spec?.entities ?? []).filter((entity) => entity.type === type).length;
}

function hazardRoomSet(spec) {
  return new Set((spec?.entities ?? [])
    .filter((entity) => entity.type === 'enemy' || entity.type === 'trap')
    .map((entity) => entity.roomId));
}

function routeBacktrackMoves(routeRoomIds) {
  if (!Array.isArray(routeRoomIds) || routeRoomIds.length < 2) return 0;
  const seen = new Set([routeRoomIds[0]]);
  let count = 0;
  for (const roomId of routeRoomIds.slice(1)) {
    if (seen.has(roomId)) count += 1;
    seen.add(roomId);
  }
  return count;
}

function routeDeadEndCostMoves(routeRoomIds) {
  if (!Array.isArray(routeRoomIds) || routeRoomIds.length < 2) return 0;
  const lastIndex = new Map([[routeRoomIds[0], 0]]);
  let cost = 0;
  for (let index = 1; index < routeRoomIds.length; index += 1) {
    const roomId = routeRoomIds[index];
    if (lastIndex.has(roomId)) cost += index - lastIndex.get(roomId);
    lastIndex.set(roomId, index);
  }
  return cost;
}

function routeEdgeSet(routeRoomIds) {
  const edges = new Set();
  for (let index = 1; index < (routeRoomIds?.length ?? 0); index += 1) {
    const a = routeRoomIds[index - 1];
    const b = routeRoomIds[index];
    if (typeof a !== 'string' || typeof b !== 'string') continue;
    edges.add(a.localeCompare(b) <= 0 ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  }
  return edges;
}

function edgeJaccardDistance(a, b) {
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const edge of a) if (b.has(edge)) intersection += 1;
  return 1 - (intersection / union.size);
}

function routeDiversity(runs) {
  const routes = runs.map((run) => run.routeRoomIds ?? []);
  const uniqueRouteCount = new Set(routes.map((route) => route.join('\u0000'))).size;
  const distances = [];
  for (let left = 0; left < routes.length; left += 1) {
    for (let right = left + 1; right < routes.length; right += 1) {
      distances.push(edgeJaccardDistance(routeEdgeSet(routes[left]), routeEdgeSet(routes[right])));
    }
  }

  return {
    uniqueRouteCount,
    pairCount: distances.length,
    meanEdgeJaccardDistance: distances.length
      ? round(distances.reduce((sum, value) => sum + value, 0) / distances.length)
      : 0,
    minEdgeJaccardDistance: distances.length ? round(Math.min(...distances)) : 0,
    maxEdgeJaccardDistance: distances.length ? round(Math.max(...distances)) : 0,
  };
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? round(finite.reduce((sum, value) => sum + value, 0) / finite.length) : null;
}

function sortedCounts(values) {
  const counts = new Map();
  for (const value of values) {
    if (value == null) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function projectSimulationMetrics(authoringSpec, simulation) {
  if (!authoringSpec || typeof authoringSpec !== 'object') {
    throw new TypeError('authoringSpec is required.');
  }
  if (!simulation?.result || typeof simulation.policyId !== 'string') {
    throw new TypeError('A completed simulation result is required.');
  }

  const result = simulation.result;
  const routeRoomIds = Array.isArray(result.routeRoomIds) ? [...result.routeRoomIds] : [];
  const startRoomId = routeRoomIds[0]
    ?? authoringSpec.entities?.find((entity) => entity.type === 'start')?.roomId
    ?? null;
  const goalRoomId = result.goalRoomId
    ?? authoringSpec.entities?.find((entity) => entity.type === 'goal')?.roomId
    ?? null;
  const baselineShortestMoves = startRoomId && goalRoomId
    ? shortestMoves(authoringSpec, startRoomId, goalRoomId)
    : null;
  const metrics = result.metrics ?? {};
  const totalTreasures = entityCount(authoringSpec, 'treasure');
  const totalTraps = entityCount(authoringSpec, 'trap');
  const totalEnemies = entityCount(authoringSpec, 'enemy');
  const hazardRooms = hazardRoomSet(authoringSpec);
  const hazardRoomEntries = routeRoomIds.slice(1).filter((roomId) => hazardRooms.has(roomId)).length;
  const moves = Number.isFinite(result.moves) ? result.moves : Math.max(0, routeRoomIds.length - 1);
  const roomsVisited = Number.isFinite(metrics.roomsVisited)
    ? metrics.roomsVisited
    : new Set(routeRoomIds).size;
  const backtrackMoves = routeBacktrackMoves(routeRoomIds);
  const deadEndCostMoves = routeDeadEndCostMoves(routeRoomIds);

  return {
    policyId: simulation.policyId,
    status: result.status,
    success: result.status === 'cleared',
    failureReason: result.status === 'failed' ? result.failureReason ?? null : null,
    terminationReason: simulation.terminationReason ?? null,
    steps: simulation.steps ?? simulation.trace?.length ?? 0,
    moves,
    routeRoomIds,
    roomsVisited,
    roomEntries: metrics.roomEntries ?? null,
    interactions: metrics.interactions ?? 0,
    enemiesCleared: metrics.enemiesCleared ?? 0,
    treasuresOpened: metrics.treasuresOpened ?? 0,
    trapsTriggered: metrics.trapsTriggered ?? 0,
    recoveryUsed: metrics.recoveryUsed ?? 0,
    damageTaken: metrics.damageTaken ?? 0,
    healingReceived: metrics.healingReceived ?? 0,
    deaths: metrics.deaths ?? 0,
    baselineShortestMoves,
    detourMoves: baselineShortestMoves == null ? null : Math.max(0, moves - baselineShortestMoves),
    routeStretch: baselineShortestMoves == null
      ? null
      : baselineShortestMoves === 0
        ? (moves === 0 ? 1 : null)
        : round(moves / baselineShortestMoves),
    backtrackMoves,
    deadEndCostMoves,
    revisitRate: moves > 0 ? round(backtrackMoves / moves) : 0,
    visitedRoomFraction: authoringSpec.rooms?.length
      ? round(roomsVisited / authoringSpec.rooms.length)
      : null,
    hazardRoomEntries,
    treasureCaptureRate: totalTreasures > 0 ? round((metrics.treasuresOpened ?? 0) / totalTreasures) : null,
    trapTriggerRate: totalTraps > 0 ? round((metrics.trapsTriggered ?? 0) / totalTraps) : null,
    enemyClearRate: totalEnemies > 0 ? round((metrics.enemiesCleared ?? 0) / totalEnemies) : null,
  };
}

export function aggregateSimulationMetrics(authoringSpec, simulations) {
  if (!Array.isArray(simulations) || simulations.length === 0) {
    throw new TypeError('simulations must contain at least one completed simulation.');
  }

  const runs = simulations
    .map((simulation) => projectSimulationMetrics(authoringSpec, simulation))
    .sort((a, b) => a.policyId.localeCompare(b.policyId));
  const successCount = runs.filter((run) => run.success).length;
  const failureCount = runs.length - successCount;
  const failureReasonCounts = sortedCounts(runs.filter((run) => !run.success).map((run) => run.failureReason ?? 'unknown'));
  const topFailureCount = failureCount > 0 ? Math.max(...Object.values(failureReasonCounts)) : 0;
  const visitedUnion = new Set(runs.flatMap((run) => run.routeRoomIds));

  return {
    schemaVersion: '1.0',
    dungeonId: authoringSpec.id ?? null,
    runCount: runs.length,
    successCount,
    failureCount,
    successRate: round(successCount / runs.length),
    failureRate: round(failureCount / runs.length),
    failureReasonCounts,
    failureConcentration: failureCount > 0 ? round(topFailureCount / failureCount) : null,
    routeDiversity: routeDiversity(runs),
    roomCoverageRate: authoringSpec.rooms?.length
      ? round(visitedUnion.size / authoringSpec.rooms.length)
      : null,
    means: {
      steps: mean(runs.map((run) => run.steps)),
      moves: mean(runs.map((run) => run.moves)),
      roomsVisited: mean(runs.map((run) => run.roomsVisited)),
      interactions: mean(runs.map((run) => run.interactions)),
      detourMoves: mean(runs.map((run) => run.detourMoves)),
      routeStretch: mean(runs.map((run) => run.routeStretch)),
      backtrackMoves: mean(runs.map((run) => run.backtrackMoves)),
      deadEndCostMoves: mean(runs.map((run) => run.deadEndCostMoves)),
      revisitRate: mean(runs.map((run) => run.revisitRate)),
      hazardRoomEntries: mean(runs.map((run) => run.hazardRoomEntries)),
      treasureCaptureRate: mean(runs.map((run) => run.treasureCaptureRate)),
      trapTriggerRate: mean(runs.map((run) => run.trapTriggerRate)),
      enemyClearRate: mean(runs.map((run) => run.enemyClearRate)),
      damageTaken: mean(runs.map((run) => run.damageTaken)),
      healingReceived: mean(runs.map((run) => run.healingReceived)),
      deaths: mean(runs.map((run) => run.deaths)),
    },
    runs: clone(runs),
  };
}
