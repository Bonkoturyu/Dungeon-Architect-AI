import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import { simulateDungeonRun } from '../src/run-simulator.js';
import {
  aggregateDungeonRunSimulationMetrics,
  projectDungeonRunSimulationMetrics,
} from '../src/run-metrics.js';
import { scoreDungeonRunIntentFit } from '../src/run-intent-fit.js';
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

function simulations() {
  const runSpec = runFixture();
  return {
    runSpec,
    safe: requireSimulation(
      simulateDungeonRun(runSpec, SAFE_FACTORY, {
        policyId: 'safe-run',
        maxStepsPerFloor: 32,
      }),
    ),
    treasure: requireSimulation(
      simulateDungeonRun(runSpec, TREASURE_FACTORY, {
        policyId: 'treasure-run',
        maxStepsPerFloor: 32,
      }),
    ),
    risk: requireSimulation(
      simulateDungeonRun(runSpec, RISK_FACTORY, {
        policyId: 'risk-run',
        maxStepsPerFloor: 32,
      }),
    ),
  };
}

test('run metrics expose carry-aware progression and whole-run totals', () => {
  const { runSpec, treasure } = simulations();
  const metrics = projectDungeonRunSimulationMetrics(runSpec, treasure);

  assert.equal(metrics.success, true);
  assert.equal(metrics.floorCount, 3);
  assert.equal(metrics.floorsReached, 3);
  assert.equal(metrics.floorsCleared, 3);
  assert.equal(metrics.floorCompletionRate, 1);
  assert.equal(metrics.floors.length, 3);
  assert.equal(metrics.totals.lootCollected, 3);
  assert.equal(metrics.totals.enemiesCleared, 3);
  assert.equal(metrics.totals.trapsTriggered, 0);
  assert.ok(metrics.totals.damageTaken >= 12);
  assert.ok(metrics.totals.healingReceived > 0);
  assert.ok(metrics.totals.xpEarned > 0);
  assert.ok(metrics.totals.goldEarned > 0);
  assert.ok(metrics.final.level >= 2);
  assert.ok(metrics.final.gold > 0);

  for (const floor of metrics.floors) {
    assert.equal(floor.authored.roomCount, 3);
    assert.equal(floor.authored.enemyCount, 1);
    assert.equal(floor.authored.trapCount, 1);
    assert.equal(floor.authored.treasureCount, 1);
    assert.equal(floor.authored.recoveryCount, 1);
    assert.equal(floor.authored.hazardDensity, 0.666667);
    assert.equal(floor.authored.rewardDensity, 0.666667);
    assert.ok(Number.isFinite(floor.pressure.endHpFraction));
  }
});

test('aggregate run metrics identify reach loss and the first bottleneck floor', () => {
  const { runSpec, safe, treasure, risk } = simulations();
  const aggregate = aggregateDungeonRunSimulationMetrics(
    runSpec,
    [safe, treasure, risk],
  );

  assert.equal(aggregate.runCount, 3);
  assert.equal(aggregate.successCount, 2);
  assert.equal(aggregate.failureCount, 1);
  assert.equal(aggregate.successRate, 0.666667);
  assert.equal(aggregate.failureRate, 0.333333);
  assert.deepEqual(aggregate.failureFloorCounts, {
    '0': 0,
    '1': 0,
    '2': 1,
  });

  assert.equal(aggregate.floors[0].reachedCount, 3);
  assert.equal(aggregate.floors[0].clearRateOverall, 1);

  assert.equal(aggregate.floors[1].reachedCount, 3);
  assert.equal(aggregate.floors[1].clearedCount, 3);
  assert.equal(aggregate.floors[1].clearRateOverall, 1);

  assert.equal(aggregate.floors[2].reachedCount, 3);
  assert.equal(aggregate.floors[2].clearedCount, 2);
  assert.equal(aggregate.floors[2].reachRate, 1);
  assert.equal(aggregate.floors[2].clearRateOverall, 0.666667);

  assert.equal(aggregate.progressionSignals.bottleneckFloorIndex, 2);
  assert.equal(aggregate.progressionSignals.bottleneckClearRate, 0.666667);
  assert.ok(Number.isFinite(aggregate.means.damageTaken));
  assert.ok(Number.isFinite(aggregate.means.finalHpFraction));

  const safeMetrics = aggregate.runs.find((run) => run.policyId === 'safe-run');
  const treasureMetrics = aggregate.runs.find((run) => run.policyId === 'treasure-run');
  const riskMetrics = aggregate.runs.find((run) => run.policyId === 'risk-run');

  assert.equal(safeMetrics.totals.lootCollected, 0);
  assert.equal(treasureMetrics.totals.lootCollected, 3);
  assert.equal(riskMetrics.failureFloorIndex, 2);
  assert.equal(riskMetrics.floorsReached, 3);
});

test('run-level DesignIntent fit reuses floor evidence without scoring duration or difficulty proxy', () => {
  const { runSpec, safe, treasure, risk } = simulations();
  const aggregate = aggregateDungeonRunSimulationMetrics(
    runSpec,
    [safe, treasure, risk],
  );

  const scored = scoreDungeonRunIntentFit(
    runSpec,
    DEFAULT_DESIGN_INTENT,
    aggregate,
  );

  assert.equal(scored.ok, true, JSON.stringify(scored.error));
  assert.equal(scored.score.floorCoverage.scoredFloorCount, 3);
  assert.equal(scored.score.floorCoverage.floorCount, 3);
  assert.equal(scored.score.floorCoverage.fraction, 1);
  assert.ok(Number.isFinite(scored.score.observableFitScore));
  assert.equal(scored.score.floorScores.length, 3);
  assert.equal(scored.score.targetDifficulty.status, 'descriptive-proxy-only');
  assert.equal(scored.score.targetDifficulty.excludedFromObservableFitScore, true);
  assert.ok(Number.isFinite(scored.score.targetDifficulty.observedPressureProxy));
  assert.equal(scored.score.targetDifficulty.floors.length, 3);
  assert.equal(scored.score.targetDuration.status, 'unscored');
});

test('run aggregation and intent scoring are deterministic and immutable', () => {
  const { runSpec, safe, treasure, risk } = simulations();
  const all = [safe, treasure, risk];
  const beforeSpec = JSON.stringify(runSpec);
  const beforeRuns = JSON.stringify(all);

  const first = aggregateDungeonRunSimulationMetrics(runSpec, all);
  const second = aggregateDungeonRunSimulationMetrics(runSpec, all);
  assert.deepEqual(second, first);

  const firstScore = scoreDungeonRunIntentFit(
    runSpec,
    DEFAULT_DESIGN_INTENT,
    first,
  );
  const secondScore = scoreDungeonRunIntentFit(
    runSpec,
    DEFAULT_DESIGN_INTENT,
    second,
  );
  assert.deepEqual(secondScore, firstScore);

  assert.equal(JSON.stringify(runSpec), beforeSpec);
  assert.equal(JSON.stringify(all), beforeRuns);
});
