import { isRuntimeCorridorEnabled } from '../../play-core/src/event-runtime.js';
import { defeatEnemy, listRoomEnemies, recordEnemyEncounter, resolveEnemyCombat } from '../../play-core/src/enemy-runtime.js';
import {
  avoidTrap,
  inspectTrap,
  inspectTreasure,
  listRoomInteractables,
  openTreasure,
  triggerTrap,
  useRecovery,
} from '../../play-core/src/interaction-runtime.js';
import {
  createPlayResult,
  failPlaySession,
  movePlaySession,
  startPlaySession,
} from '../../play-core/src/play-session.js';

export const SIMULATION_ACTION_TYPES = Object.freeze([
  'move',
  'encounter-enemy',
  'combat-enemy',
  'defeat-enemy',
  'inspect-treasure',
  'open-treasure',
  'inspect-trap',
  'avoid-trap',
  'trigger-trap',
  'use-recovery',
  'stop',
]);

const ACTION_TYPE_SET = new Set(SIMULATION_ACTION_TYPES);
const MAX_STEP_LIMIT = 10_000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fail(code, message, details = undefined) {
  const error = { code, message };
  if (details !== undefined) error.details = clone(details);
  return { ok: false, error };
}

function currentAdjacency(session) {
  const adjacency = new Set();
  for (const corridor of session.snapshot.corridors) {
    if (!isRuntimeCorridorEnabled(session, corridor)) continue;
    if (corridor.fromRoomId === session.currentRoomId) adjacency.add(corridor.toRoomId);
    if (corridor.toRoomId === session.currentRoomId) adjacency.add(corridor.fromRoomId);
  }
  return [...adjacency].sort((a, b) => a.localeCompare(b));
}

function enemyObservation(session) {
  return listRoomEnemies(session)
    .map(({ enemy, state }) => ({
      id: enemy.id,
      roomId: enemy.roomId,
      status: state.status,
      encounters: state.encounters,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function interactableObservation(session) {
  return listRoomInteractables(session)
    .map(({ entity, warning, state }) => ({
      id: entity.id,
      type: entity.type,
      roomId: entity.roomId,
      warning,
      status: state.status,
      inspections: state.inspections ?? 0,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function availableActions(adjacentRoomIds, enemies, interactables) {
  const actions = [];
  for (const roomId of adjacentRoomIds) actions.push({ type: 'move', roomId });

  for (const enemy of enemies) {
    actions.push({ type: 'encounter-enemy', enemyId: enemy.id });
    actions.push({ type: 'combat-enemy', enemyId: enemy.id });
    actions.push({ type: 'defeat-enemy', enemyId: enemy.id });
  }

  for (const entity of interactables) {
    switch (entity.type) {
      case 'treasure':
        actions.push({ type: 'inspect-treasure', treasureId: entity.id });
        actions.push({ type: 'open-treasure', treasureId: entity.id });
        break;
      case 'trap':
        actions.push({ type: 'inspect-trap', trapId: entity.id });
        actions.push({ type: 'avoid-trap', trapId: entity.id });
        actions.push({ type: 'trigger-trap', trapId: entity.id });
        break;
      case 'recovery':
        actions.push({ type: 'use-recovery', recoveryId: entity.id });
        break;
      default:
        break;
    }
  }

  actions.push({ type: 'stop' });
  return actions;
}

export function createSimulationObservation(session, { step = 0 } = {}) {
  if (!session?.snapshot || session.status !== 'playing') {
    throw new TypeError('Simulation observation requires a playing PlaySession.');
  }

  const adjacentRoomIds = currentAdjacency(session);
  const enemies = enemyObservation(session);
  const interactables = interactableObservation(session);

  return {
    schemaVersion: '1.0',
    step,
    playStatus: session.status,
    currentRoomId: session.currentRoomId,
    goalRoomId: session.goalRoomId,
    adjacentRoomIds,
    visitedRoomIds: [...session.visitedRoomIds],
    moves: session.moves,
    playerState: clone(session.playerState),
    enemies,
    interactables,
    counters: clone(session.gameplayState?.counters ?? {}),
    availableActions: availableActions(adjacentRoomIds, enemies, interactables),
  };
}

function requireActionId(action, field) {
  if (typeof action[field] !== 'string' || action[field].trim() === '') {
    return fail('SIM_ACTION_INVALID', `${action.type} requires a non-empty ${field}.`);
  }
  return null;
}

export function applySimulationAction(session, action, { at = 0 } = {}) {
  if (!session || session.status !== 'playing') {
    return fail('SIM_SESSION_NOT_PLAYING', 'Simulation action requires a playing PlaySession.');
  }
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    return fail('SIM_ACTION_INVALID', 'Simulation action must be an object.');
  }
  if (!ACTION_TYPE_SET.has(action.type)) {
    return fail('SIM_ACTION_UNSUPPORTED', `Unsupported simulation action: ${String(action.type)}`);
  }

  switch (action.type) {
    case 'move': {
      const invalid = requireActionId(action, 'roomId');
      if (invalid) return invalid;
      return movePlaySession(session, action.roomId, { at });
    }
    case 'encounter-enemy': {
      const invalid = requireActionId(action, 'enemyId');
      if (invalid) return invalid;
      return recordEnemyEncounter(session, action.enemyId, { at });
    }
    case 'combat-enemy': {
      const invalid = requireActionId(action, 'enemyId');
      if (invalid) return invalid;
      return resolveEnemyCombat(session, action.enemyId, { at });
    }
    case 'defeat-enemy': {
      const invalid = requireActionId(action, 'enemyId');
      if (invalid) return invalid;
      return defeatEnemy(session, action.enemyId, { at });
    }
    case 'inspect-treasure': {
      const invalid = requireActionId(action, 'treasureId');
      if (invalid) return invalid;
      return inspectTreasure(session, action.treasureId, { at });
    }
    case 'open-treasure': {
      const invalid = requireActionId(action, 'treasureId');
      if (invalid) return invalid;
      return openTreasure(session, action.treasureId, { at });
    }
    case 'inspect-trap': {
      const invalid = requireActionId(action, 'trapId');
      if (invalid) return invalid;
      return inspectTrap(session, action.trapId, { at });
    }
    case 'avoid-trap': {
      const invalid = requireActionId(action, 'trapId');
      if (invalid) return invalid;
      return avoidTrap(session, action.trapId, { at });
    }
    case 'trigger-trap': {
      const invalid = requireActionId(action, 'trapId');
      if (invalid) return invalid;
      return triggerTrap(session, action.trapId, { at });
    }
    case 'use-recovery': {
      const invalid = requireActionId(action, 'recoveryId');
      if (invalid) return invalid;
      return useRecovery(session, action.recoveryId, { at });
    }
    case 'stop':
      return failPlaySession(session, 'stopped', { at });
    default:
      return fail('SIM_ACTION_UNSUPPORTED', `Unsupported simulation action: ${String(action.type)}`);
  }
}

function normalizeStepLimit(maxSteps) {
  if (!Number.isInteger(maxSteps) || maxSteps <= 0 || maxSteps > MAX_STEP_LIMIT) {
    throw new RangeError(`maxSteps must be an integer from 1 through ${MAX_STEP_LIMIT}.`);
  }
  return maxSteps;
}

function simulationResult(session, trace, { policyId, maxSteps, terminationReason }) {
  const playResult = createPlayResult(session);
  if (!playResult.ok) {
    throw new Error(`Simulation ended without a terminal PlayResult: ${JSON.stringify(playResult.error)}`);
  }

  return {
    schemaVersion: '1.0',
    policyId,
    dungeonId: session.dungeonId,
    dungeonSeed: session.dungeonSeed,
    maxSteps,
    steps: trace.length,
    terminationReason,
    status: playResult.result.status,
    failureReason: playResult.result.failureReason,
    trace: clone(trace),
    result: clone(playResult.result),
    gameplayState: clone(session.gameplayState),
  };
}

export function simulateDungeon(authoringSpec, decideAction, {
  policyId = 'anonymous-policy',
  maxSteps = 256,
} = {}) {
  if (typeof decideAction !== 'function') {
    return fail('SIM_POLICY_REQUIRED', 'decideAction must be a function.');
  }

  let stepLimit;
  try {
    stepLimit = normalizeStepLimit(maxSteps);
  } catch (error) {
    return fail('SIM_STEP_LIMIT_INVALID', error instanceof Error ? error.message : String(error));
  }

  const started = startPlaySession(authoringSpec, { startedAt: 0 });
  if (!started.ok) {
    return fail('SIM_START_BLOCKED', 'DungeonSpec cannot start a simulation.', started.errors ?? []);
  }

  let session = started.session;
  const trace = [];

  if (session.status !== 'playing') {
    return {
      ok: true,
      simulation: simulationResult(session, trace, {
        policyId,
        maxSteps: stepLimit,
        terminationReason: 'play-terminal',
      }),
    };
  }

  for (let step = 0; step < stepLimit && session.status === 'playing'; step += 1) {
    const observation = createSimulationObservation(session, { step });
    let action;
    try {
      action = decideAction(clone(observation), clone(trace));
    } catch (error) {
      return fail('SIM_POLICY_ERROR', error instanceof Error ? error.message : String(error), { step });
    }

    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      return fail('SIM_POLICY_INVALID_ACTION', 'Policy must return one simulation action object.', { step });
    }

    const beforeRoomId = session.currentRoomId;
    const applied = applySimulationAction(session, clone(action), { at: step + 1 });
    if (!applied.ok) {
      return fail('SIM_ACTION_FAILED', applied.error?.message ?? 'Simulation action failed.', {
        step,
        action,
        cause: applied.error ?? null,
      });
    }

    session = applied.session;
    trace.push({
      step,
      roomIdBefore: beforeRoomId,
      action: clone(action),
      roomIdAfter: session.currentRoomId,
      playStatusAfter: session.status,
    });
  }

  let terminationReason = 'play-terminal';
  if (session.status === 'playing') {
    const stopped = failPlaySession(session, 'stopped', { at: stepLimit });
    if (!stopped.ok) return fail('SIM_STEP_LIMIT_STOP_FAILED', stopped.error?.message ?? 'Failed to stop simulation.');
    session = stopped.session;
    terminationReason = 'step-limit';
  }

  return {
    ok: true,
    simulation: simulationResult(session, trace, {
      policyId,
      maxSteps: stepLimit,
      terminationReason,
    }),
  };
}
