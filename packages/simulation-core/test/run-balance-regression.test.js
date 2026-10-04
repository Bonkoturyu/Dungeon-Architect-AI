import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateDungeonRun } from '../src/run-simulator.js';
import {
  RISK_FACTORY,
  SAFE_FACTORY,
  TREASURE_FACTORY,
  runFixture,
} from './run-test-fixture.js';

const factories = { safe: SAFE_FACTORY, treasure: TREASURE_FACTORY, risk: RISK_FACTORY };
const finalTrapRoll = 0.7279483226593584;

function simulate(spec, name) {
  const result = simulateDungeonRun(spec, factories[name], {
    policyId: `${name}-run`,
    maxStepsPerFloor: 32,
  });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.simulation;
}

function finalAvoidance(simulation) {
  return simulation.floorSimulations[2].gameplayState.entityStates['f3-trap'].avoidance;
}

function setFinalTrapDamage(spec, damage) {
  spec.floors[2].dungeon.entities.find((entity) => entity.id === 'f3-trap').damage = damage;
  return spec;
}

test('balanced fixture preserves the failed seeded roll while separating safe, treasure, and risk outcomes', () => {
  const spec = runFixture();
  assert.deepEqual(spec.floors.map((floor) => floor.dungeon.seed), [98000, 98001, 98002]);
  assert.deepEqual(spec.floors.map((floor) => floor.dungeon.entities.find((entity) => entity.type === 'trap').damage), [4, 8, 9]);
  const safe = simulate(spec, 'safe');
  const treasure = simulate(spec, 'treasure');
  const risk = simulate(spec, 'risk');

  assert.deepEqual([safe.status, treasure.status, risk.status], ['cleared', 'cleared', 'failed']);
  assert.deepEqual([safe.floorsCleared, treasure.floorsCleared, risk.floorsCleared], [3, 3, 2]);
  assert.equal(risk.failureReason, 'player-defeated');
  assert.equal(risk.floorSimulations[2].trace.at(-1).action.type, 'combat-enemy');
  assert.deepEqual(finalAvoidance(safe), {
    version: 'seeded-avoidance-1',
    successChance: 0.7,
    roll: finalTrapRoll,
    outcome: 'triggered',
  });
  assert.deepEqual(finalAvoidance(treasure), finalAvoidance(safe));
  assert.deepEqual(safe.floorSimulations.map((floor, index) => floor.gameplayState.entityStates[`f${index + 1}-trap`].status), ['avoided', 'avoided', 'triggered']);

  const finalTrace = safe.floorSimulations[2].trace;
  const avoidanceIndex = finalTrace.findIndex((step) => step.action.type === 'avoid-trap');
  assert.equal(finalTrace[avoidanceIndex - 1].playerStateAfter.hp, 10);
  assert.equal(finalTrace[avoidanceIndex].playerStateAfter.hp, 1);
  assert.equal(safe.finalPlayerState.hp, 1);
  assert.ok(treasure.finalPlayerState.hp > safe.finalPlayerState.hp);
  assert.equal(risk.finalPlayerState.hp, 0);
  assert.ok(safe.floorSimulations.every((floor) => floor.result.metrics.lootCollected === 0 && floor.result.metrics.recoveryUsed === 0));
  assert.ok(treasure.floorSimulations.every((floor) => floor.result.metrics.lootCollected === 1 && floor.result.metrics.recoveryUsed === 1));
  assert.ok(risk.floorSimulations.every((floor) => floor.result.metrics.recoveryUsed === 0));
});

test('all three balance policies remain deterministic and preserve authoring input', () => {
  const spec = runFixture();
  const before = structuredClone(spec);
  for (const name of Object.keys(factories)) {
    assert.deepEqual(simulate(spec, name), simulate(spec, name), name);
    assert.deepEqual(spec, before, name);
  }
});

test('the same failed avoidance crosses the HP boundary at damage 10, not at damage 9', () => {
  for (const [damage, status, hp, floorsCleared] of [[9, 'cleared', 1, 3], [10, 'failed', 0, 2]]) {
    const simulation = simulate(setFinalTrapDamage(runFixture(), damage), 'safe');
    assert.equal(simulation.status, status);
    assert.equal(simulation.finalPlayerState.hp, hp);
    assert.equal(simulation.floorsCleared, floorsCleared);
    assert.equal(finalAvoidance(simulation).roll, finalTrapRoll);
    assert.equal(finalAvoidance(simulation).outcome, 'triggered');
  }
});

test('the historical 12-damage trap still reproduces safe-policy defeat under current rules', () => {
  const simulation = simulate(setFinalTrapDamage(runFixture(), 12), 'safe');
  assert.equal(simulation.status, 'failed');
  assert.equal(simulation.failureReason, 'player-defeated');
  assert.equal(simulation.floorsReached, 3);
  assert.equal(simulation.floorsCleared, 2);
  assert.equal(simulation.finalPlayerState.hp, 0);
  assert.equal(simulation.floorSimulations[2].trace.at(-1).action.type, 'avoid-trap');
  assert.equal(finalAvoidance(simulation).roll, finalTrapRoll);
  assert.equal(finalAvoidance(simulation).outcome, 'triggered');
});
