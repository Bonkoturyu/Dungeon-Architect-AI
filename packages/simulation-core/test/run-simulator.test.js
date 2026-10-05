import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateDungeonRun } from '../src/run-simulator.js';
import {
  RISK_FACTORY,
  SAFE_FACTORY,
  TREASURE_FACTORY,
  runFixture,
} from './run-test-fixture.js';

function requireSimulation(result) {
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.simulation;
}

test('multi-floor simulation carries PlayerState exactly between reached floors', () => {
  const runSpec = runFixture();
  const simulation = requireSimulation(
    simulateDungeonRun(runSpec, TREASURE_FACTORY, {
      policyId: 'treasure-run',
      maxStepsPerFloor: 32,
    }),
  );

  assert.equal(simulation.status, 'cleared');
  assert.equal(simulation.floorCount, 3);
  assert.equal(simulation.floorsReached, 3);
  assert.equal(simulation.floorsCleared, 3);

  for (let index = 1; index < simulation.floorSimulations.length; index += 1) {
    assert.deepEqual(
      simulation.floorSimulations[index].startingPlayerState,
      simulation.floorSimulations[index - 1].result.playerState,
    );
  }

  assert.deepEqual(
    simulation.finalPlayerState,
    simulation.floorSimulations.at(-1).result.playerState,
  );
  assert.ok(simulation.finalPlayerState.gold > 0);
  assert.ok(simulation.finalPlayerState.level >= 2);
  assert.ok(
    simulation.floorSimulations.some(
      (floor) => (floor.result.metrics.lootCollected ?? 0) > 0,
    ),
  );
});

test('risk policy failure terminates the whole run on the final floor', () => {
  const simulation = requireSimulation(
    simulateDungeonRun(runFixture(), RISK_FACTORY, {
      policyId: 'risk-run',
      maxStepsPerFloor: 32,
    }),
  );

  assert.equal(simulation.status, 'failed');
  assert.equal(simulation.failureReason, 'player-defeated');
  assert.equal(simulation.floorsReached, 3);
  assert.equal(simulation.floorsCleared, 2);
  assert.equal(simulation.floorSimulations[0].status, 'cleared');
  assert.equal(simulation.floorSimulations[1].status, 'cleared');
  assert.equal(simulation.floorSimulations[2].status, 'failed');
  assert.equal(simulation.floorSimulations[2].result.playerState.hp, 0);
});

test('run simulation is deterministic and does not mutate DungeonRunSpec', () => {
  const runSpec = runFixture();
  const before = JSON.stringify(runSpec);

  const first = requireSimulation(
    simulateDungeonRun(runSpec, SAFE_FACTORY, {
      policyId: 'safe-run',
      maxStepsPerFloor: 32,
    }),
  );
  const second = requireSimulation(
    simulateDungeonRun(runSpec, SAFE_FACTORY, {
      policyId: 'safe-run',
      maxStepsPerFloor: 32,
    }),
  );

  assert.deepEqual(second, first);
  assert.equal(JSON.stringify(runSpec), before);
});

test('run simulation normalizes invalid policy factories and step limits', () => {
  const missing = simulateDungeonRun(runFixture(), null);
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, 'RUN_SIM_POLICY_FACTORY_REQUIRED');

  const badLimit = simulateDungeonRun(runFixture(), SAFE_FACTORY, {
    maxStepsPerFloor: 0,
  });
  assert.equal(badLimit.ok, false);
  assert.equal(badLimit.error.code, 'RUN_SIM_STEP_LIMIT_INVALID');

  const invalidFactory = simulateDungeonRun(
    runFixture(),
    () => ({ not: 'a policy' }),
  );
  assert.equal(invalidFactory.ok, false);
  assert.equal(invalidFactory.error.code, 'RUN_SIM_POLICY_REQUIRED');
});

test('run simulation normalizes action serialization failures from floor policies', () => {
  const cyclic = { type: 'stop' };
  cyclic.debug = cyclic;
  const actions = [
    cyclic,
    { type: 'stop', debug: 1n },
    { type: 'stop', toJSON() { throw new Error('serialization failed'); } },
    { type: 'stop', toJSON() { return null; } },
  ];

  for (const action of actions) {
    const result = simulateDungeonRun(runFixture(), () => () => action);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'RUN_SIM_POLICY_INVALID_ACTION');
    assert.deepEqual(result.error.details, { floorIndex: 0, localStep: 0 });
  }
});

test('run simulation snapshots each policy action once for execution and tracing', () => {
  let serializations = 0;
  const result = simulateDungeonRun(runFixture(), () => () => ({
    toJSON() {
      serializations += 1;
      if (serializations > 1) throw new Error('serialized twice');
      return { type: 'stop' };
    },
  }));
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal(serializations, 1);
  assert.deepEqual(result.simulation.floorSimulations[0].trace[0].action, { type: 'stop' });
});
