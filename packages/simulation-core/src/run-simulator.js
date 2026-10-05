import {
  createDungeonRunResult,
  startDungeonRun,
  syncDungeonRunFloor,
} from '../../run-core/src/dungeon-run.js';
import {
  createPlayResult,
  failPlaySession,
} from '../../play-core/src/play-session.js';
import {
  applySimulationAction,
  createSimulationObservation,
} from './simulator.js';

const MAX_STEPS_PER_FLOOR = 10_000;

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function fail(code, message, details = undefined) {
  const error = { code, message };
  if (details !== undefined) error.details = clone(details);
  return { ok: false, error };
}

function normalizeStepLimit(maxStepsPerFloor) {
  if (
    !Number.isInteger(maxStepsPerFloor) ||
    maxStepsPerFloor <= 0 ||
    maxStepsPerFloor > MAX_STEPS_PER_FLOOR
  ) {
    throw new RangeError(
      `maxStepsPerFloor must be an integer from 1 through ${MAX_STEPS_PER_FLOOR}.`,
    );
  }
  return maxStepsPerFloor;
}

function floorSimulationResult(
  session,
  trace,
  {
    floorIndex,
    floorCount,
    floorId,
    policyId,
    maxStepsPerFloor,
    terminationReason,
    startingPlayerState,
  },
) {
  const playResult = createPlayResult(session);
  if (!playResult.ok) {
    throw new Error(
      `Run simulation floor ended without a terminal PlayResult: ${JSON.stringify(playResult.error)}`,
    );
  }

  return {
    schemaVersion: '1.0',
    policyId,
    floorIndex,
    floorNumber: floorIndex + 1,
    floorCount,
    floorId,
    dungeonId: session.dungeonId,
    dungeonSeed: session.dungeonSeed,
    maxSteps: maxStepsPerFloor,
    steps: trace.length,
    terminationReason,
    status: playResult.result.status,
    failureReason: playResult.result.failureReason,
    startingPlayerState: clone(startingPlayerState),
    trace: clone(trace),
    result: clone(playResult.result),
    gameplayState: clone(session.gameplayState),
  };
}

function createFloorPolicy(
  createPolicyForFloor,
  dungeon,
  run,
  floorIndex,
  priorFloorSimulations,
  runPolicyId,
) {
  const context = {
    schemaVersion: '1.0',
    runPolicyId,
    runId: run.runId,
    floorIndex,
    floorNumber: floorIndex + 1,
    floorCount: run.floorCount,
    floorId: run.snapshot.floors[floorIndex].id,
    dungeonId: dungeon.id,
    playerState: clone(run.currentFloorSession.playerState),
    priorFloorResults: clone(
      priorFloorSimulations.map((simulation) => ({
        floorIndex: simulation.floorIndex,
        status: simulation.status,
        failureReason: simulation.failureReason,
        result: simulation.result,
      })),
    ),
  };

  let policy;
  try {
    policy = createPolicyForFloor(clone(dungeon), clone(context));
  } catch (error) {
    return fail(
      'RUN_SIM_POLICY_FACTORY_ERROR',
      error instanceof Error ? error.message : String(error),
      { floorIndex },
    );
  }

  if (typeof policy !== 'function') {
    return fail(
      'RUN_SIM_POLICY_REQUIRED',
      'createPolicyForFloor must return a decision function for every reached floor.',
      { floorIndex },
    );
  }

  return {
    ok: true,
    policy,
    policyId:
      typeof policy.policyId === 'string' && policy.policyId.trim() !== ''
        ? policy.policyId
        : `${runPolicyId}/floor-${String(floorIndex + 1).padStart(2, '0')}`,
  };
}

function simulateCurrentFloor(
  session,
  decideAction,
  {
    floorIndex,
    floorCount,
    floorId,
    policyId,
    maxStepsPerFloor,
    clockStart,
  },
) {
  let current = clone(session);
  const trace = [];
  const startingPlayerState = clone(current.playerState);
  let clock = clockStart;

  if (current.status !== 'playing') {
    return {
      ok: true,
      session: current,
      clock,
      simulation: floorSimulationResult(current, trace, {
        floorIndex,
        floorCount,
        floorId,
        policyId,
        maxStepsPerFloor,
        terminationReason: 'play-terminal',
        startingPlayerState,
      }),
    };
  }

  for (
    let localStep = 0;
    localStep < maxStepsPerFloor && current.status === 'playing';
    localStep += 1
  ) {
    const observation = createSimulationObservation(current, { step: localStep });
    let action;
    try {
      action = decideAction(clone(observation), clone(trace));
    } catch (error) {
      return fail(
        'RUN_SIM_POLICY_ERROR',
        error instanceof Error ? error.message : String(error),
        { floorIndex, localStep },
      );
    }

    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      return fail(
        'RUN_SIM_POLICY_INVALID_ACTION',
        'Floor policy must return one simulation action object.',
        { floorIndex, localStep },
      );
    }

    try {
      action = clone(action);
    } catch {
      return fail(
        'RUN_SIM_POLICY_INVALID_ACTION',
        'Floor policy action must be JSON-serializable.',
        { floorIndex, localStep },
      );
    }
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      return fail(
        'RUN_SIM_POLICY_INVALID_ACTION',
        'Serialized floor policy action must be an object.',
        { floorIndex, localStep },
      );
    }

    const beforeRoomId = current.currentRoomId;
    clock += 1;
    const applied = applySimulationAction(current, action, { at: clock });
    if (!applied.ok) {
      return fail(
        'RUN_SIM_ACTION_FAILED',
        applied.error?.message ?? 'Run simulation action failed.',
        {
          floorIndex,
          localStep,
          action,
          cause: applied.error ?? null,
        },
      );
    }

    current = applied.session;
    trace.push({
      floorIndex,
      localStep,
      globalStep: clock,
      roomIdBefore: beforeRoomId,
      action: clone(action),
      roomIdAfter: current.currentRoomId,
      playStatusAfter: current.status,
      playerStateAfter: clone(current.playerState),
    });
  }

  let terminationReason = 'play-terminal';
  if (current.status === 'playing') {
    const stopped = failPlaySession(current, 'stopped', { at: clock });
    if (!stopped.ok) {
      return fail(
        'RUN_SIM_STEP_LIMIT_STOP_FAILED',
        stopped.error?.message ?? 'Failed to stop floor simulation.',
        { floorIndex },
      );
    }
    current = stopped.session;
    terminationReason = 'step-limit';
  }

  return {
    ok: true,
    session: current,
    clock,
    simulation: floorSimulationResult(current, trace, {
      floorIndex,
      floorCount,
      floorId,
      policyId,
      maxStepsPerFloor,
      terminationReason,
      startingPlayerState,
    }),
  };
}

export function simulateDungeonRun(
  authoringRunSpec,
  createPolicyForFloor,
  {
    policyId = 'anonymous-run-policy',
    maxStepsPerFloor = 256,
    initialPlayerState = null,
  } = {},
) {
  if (typeof createPolicyForFloor !== 'function') {
    return fail(
      'RUN_SIM_POLICY_FACTORY_REQUIRED',
      'createPolicyForFloor must be a function.',
    );
  }

  let stepLimit;
  try {
    stepLimit = normalizeStepLimit(maxStepsPerFloor);
  } catch (error) {
    return fail(
      'RUN_SIM_STEP_LIMIT_INVALID',
      error instanceof Error ? error.message : String(error),
    );
  }

  const started = startDungeonRun(authoringRunSpec, {
    startedAt: 0,
    ...(initialPlayerState === null ? {} : { initialPlayerState }),
  });
  if (!started.ok) {
    return fail(
      'RUN_SIM_START_BLOCKED',
      'DungeonRunSpec cannot start a simulation.',
      started.errors ?? [],
    );
  }

  let run = started.run;
  let clock = 0;
  const floorSimulations = [];

  while (run.status === 'playing') {
    const floorIndex = run.currentFloorIndex;
    const floor = run.snapshot.floors[floorIndex];

    const policyResult = createFloorPolicy(
      createPolicyForFloor,
      floor.dungeon,
      run,
      floorIndex,
      floorSimulations,
      policyId,
    );
    if (!policyResult.ok) return policyResult;

    const floorResult = simulateCurrentFloor(
      run.currentFloorSession,
      policyResult.policy,
      {
        floorIndex,
        floorCount: run.floorCount,
        floorId: floor.id,
        policyId: policyResult.policyId,
        maxStepsPerFloor: stepLimit,
        clockStart: clock,
      },
    );
    if (!floorResult.ok) return floorResult;

    clock = floorResult.clock;
    floorSimulations.push(floorResult.simulation);

    const synced = syncDungeonRunFloor(run, floorResult.session, { at: clock });
    if (!synced.ok) {
      return fail(
        'RUN_SIM_SYNC_FAILED',
        synced.error?.message ?? 'Failed to synchronize simulated floor.',
        {
          floorIndex,
          cause: synced.error ?? null,
        },
      );
    }

    run = synced.run;
  }

  const runResult = createDungeonRunResult(run);
  if (!runResult.ok) {
    return fail(
      'RUN_SIM_RESULT_INVALID',
      runResult.error?.message ?? 'Failed to create simulated run result.',
    );
  }

  return {
    ok: true,
    simulation: {
      schemaVersion: '1.0',
      policyId,
      runId: run.runId,
      status: run.status,
      failureReason: run.status === 'failed' ? run.failureReason ?? null : null,
      floorCount: run.floorCount,
      floorsReached: floorSimulations.length,
      floorsCleared: floorSimulations.filter((entry) => entry.status === 'cleared').length,
      maxStepsPerFloor: stepLimit,
      totalSteps: floorSimulations.reduce((sum, entry) => sum + entry.steps, 0),
      completedAt: run.completedAt,
      floorSimulations: clone(floorSimulations),
      finalPlayerState: clone(run.playerState),
      events: clone(run.events),
      result: clone(runResult.result),
    },
  };
}
