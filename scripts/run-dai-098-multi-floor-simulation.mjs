import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { simulateDungeonRun } from '../packages/simulation-core/src/run-simulator.js';
import {
  aggregateDungeonRunSimulationMetrics,
  projectDungeonRunSimulationMetrics,
} from '../packages/simulation-core/src/run-metrics.js';
import { scoreDungeonRunIntentFit } from '../packages/simulation-core/src/run-intent-fit.js';

const outputDir = path.resolve('artifacts/dai-098');
fs.mkdirSync(outputDir, { recursive: true });

const runSpec = JSON.parse(
  fs.readFileSync(
    path.resolve('spec/simulation/fixtures/dai-098-run-balance-v1.json'),
    'utf8',
  ),
);

function nextUnvisitedRoom(observation) {
  if (observation.adjacentRoomIds.includes(observation.goalRoomId)) {
    return observation.goalRoomId;
  }
  return (
    observation.adjacentRoomIds.find(
      (roomId) => !observation.visitedRoomIds.includes(roomId),
    ) ??
    observation.adjacentRoomIds[0] ??
    null
  );
}

function createFactory({
  id,
  trapMode = 'avoid',
  openTreasure = false,
  useRecovery = false,
}) {
  return (_dungeon, context) => {
    const policy = (observation) => {
      const enemy = observation.enemies[0];
      if (enemy) return { type: 'combat-enemy', enemyId: enemy.id };

      const trap = observation.interactables
        .filter((entry) => entry.type === 'trap')
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (trap) {
        return trapMode === 'trigger'
          ? { type: 'trigger-trap', trapId: trap.id }
          : { type: 'avoid-trap', trapId: trap.id };
      }

      const treasure = observation.interactables
        .filter((entry) => entry.type === 'treasure')
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (treasure && openTreasure) {
        return { type: 'open-treasure', treasureId: treasure.id };
      }

      const recovery = observation.interactables
        .filter((entry) => entry.type === 'recovery')
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (
        recovery &&
        useRecovery &&
        observation.playerState.hp < observation.playerState.maxHp
      ) {
        return { type: 'use-recovery', recoveryId: recovery.id };
      }

      const next = nextUnvisitedRoom(observation);
      return next ? { type: 'move', roomId: next } : { type: 'stop' };
    };

    Object.defineProperty(policy, 'policyId', {
      value: `${id}/floor-${context.floorNumber}`,
      enumerable: true,
    });
    return policy;
  };
}

const policies = Object.freeze({
  safe: createFactory({
    id: 'safe',
    trapMode: 'avoid',
  }),
  treasure: createFactory({
    id: 'treasure',
    trapMode: 'avoid',
    openTreasure: true,
    useRecovery: true,
  }),
  risk: createFactory({
    id: 'risk',
    trapMode: 'trigger',
    openTreasure: true,
    useRecovery: false,
  }),
});

function requireSimulation(result, label) {
  if (!result?.ok) {
    throw new Error(`${label} failed: ${JSON.stringify(result?.error ?? result)}`);
  }
  return result.simulation;
}

const authoringBefore = JSON.stringify(runSpec);

const safe = requireSimulation(
  simulateDungeonRun(runSpec, policies.safe, {
    policyId: 'safe-run',
    maxStepsPerFloor: 32,
  }),
  'safe run',
);
const treasure = requireSimulation(
  simulateDungeonRun(runSpec, policies.treasure, {
    policyId: 'treasure-run',
    maxStepsPerFloor: 32,
  }),
  'treasure run',
);
const risk = requireSimulation(
  simulateDungeonRun(runSpec, policies.risk, {
    policyId: 'risk-run',
    maxStepsPerFloor: 32,
  }),
  'risk run',
);
const safeRepeat = requireSimulation(
  simulateDungeonRun(runSpec, policies.safe, {
    policyId: 'safe-run',
    maxStepsPerFloor: 32,
  }),
  'safe repeat',
);

const aggregate = aggregateDungeonRunSimulationMetrics(
  runSpec,
  [safe, treasure, risk],
);
const safeMetrics = projectDungeonRunSimulationMetrics(runSpec, safe);
const treasureMetrics = projectDungeonRunSimulationMetrics(runSpec, treasure);
const riskMetrics = projectDungeonRunSimulationMetrics(runSpec, risk);

// 現行70%判定の失敗を残したまま、safeはHP1で生存するfixture。
// Seed/罠IDや回避確率は変更せず、riskとの差をHP被害・回復選択で検証する。
const safeFinalTrapAvoidance = safe.floorSimulations[2]
  ?.gameplayState.entityStates['f3-trap']?.avoidance;

const intentFit = scoreDungeonRunIntentFit(
  runSpec,
  DEFAULT_DESIGN_INTENT,
  aggregate,
);
if (!intentFit.ok) {
  throw new Error(`run intent-fit failed: ${JSON.stringify(intentFit.error)}`);
}

const carryPairs = treasure.floorSimulations.slice(1).map((floor, index) => ({
  fromFloorIndex: index,
  toFloorIndex: index + 1,
  exact:
    JSON.stringify(floor.startingPlayerState) ===
    JSON.stringify(treasure.floorSimulations[index].result.playerState),
  carried: floor.startingPlayerState,
}));

const authoredDamagePerRoom = aggregate.floors.map(
  (floor) => floor.authored.hazardDamageBudgetPerRoom,
);
const observedDamageFractions = aggregate.floors.map(
  (floor) => floor.means.damageFractionOfStartMaxHp,
);

const checks = {
  safeRunClearsAllFloors:
    safe.status === 'cleared' &&
    safe.floorsCleared === 3 &&
    safe.floorsReached === 3,
  treasureRunClearsAllFloors:
    treasure.status === 'cleared' &&
    treasure.floorsCleared === 3 &&
    treasure.floorsReached === 3,
  riskRunFailsOnFinalFloor:
    risk.status === 'failed' &&
    risk.failureReason === 'player-defeated' &&
    risk.floorsReached === 3 &&
    risk.floorsCleared === 2 &&
    risk.floorSimulations.at(-1)?.floorIndex === 2,
  playerStateCarryIsExact:
    carryPairs.length === 2 &&
    carryPairs.every((entry) => entry.exact),
  hpAttritionIsObserved:
    safeMetrics.totals.damageTaken > 0 &&
    riskMetrics.totals.damageTaken > safeMetrics.totals.damageTaken &&
    riskMetrics.final.hp === 0,
  safeSurvivesASeededAvoidanceFailure:
    safeFinalTrapAvoidance?.version === 'seeded-avoidance-1' &&
    safeFinalTrapAvoidance.successChance === 0.7 &&
    safeFinalTrapAvoidance.roll === 0.7279483226593584 &&
    safeFinalTrapAvoidance.outcome === 'triggered' &&
    safeMetrics.totals.trapsTriggered === 1 &&
    safeMetrics.totals.damageTaken === 21 &&
    safeMetrics.final.hp === 1,
  riskAndSafePreserveTheirPolicyChoices:
    safeMetrics.totals.lootCollected === 0 &&
    safeMetrics.totals.recoveryUsed === 0 &&
    riskMetrics.totals.trapsTriggered === 2 &&
    riskMetrics.totals.recoveryUsed === 0 &&
    risk.floorSimulations[2]?.trace.at(-1)?.action.type === 'combat-enemy',
  treasureRecoveryGivesSurvivalMargin:
    treasureMetrics.totals.healingReceived > 0 &&
    treasureMetrics.totals.recoveryUsed === 3 &&
    treasureMetrics.final.hp > safeMetrics.final.hp,
  progressionCarriesAcrossFloors:
    treasureMetrics.totals.xpEarned > 0 &&
    treasureMetrics.totals.goldEarned > 0 &&
    treasureMetrics.totals.lootCollected === 3 &&
    treasureMetrics.final.level >= 2 &&
    treasureMetrics.final.gold > 0,
  equipmentCarryIsObservable:
    treasure.floorSimulations.slice(1).some((floor) =>
      (floor.startingPlayerState.equipment?.weapon?.tier ?? 0) > 0 ||
      (floor.startingPlayerState.equipment?.armor?.tier ?? 0) > 0),
  aggregateCapturesPolicyOutcomes:
    aggregate.runCount === 3 &&
    aggregate.successCount === 2 &&
    aggregate.failureCount === 1 &&
    aggregate.successRate === 0.666667,
  finalFloorIsBottleneck:
    aggregate.progressionSignals.bottleneckFloorIndex === 2 &&
    aggregate.progressionSignals.bottleneckClearRate === 0.666667,
  authoredPressureIncreasesByFloor:
    authoredDamagePerRoom.length === 3 &&
    authoredDamagePerRoom[0] < authoredDamagePerRoom[1] &&
    authoredDamagePerRoom[1] < authoredDamagePerRoom[2] &&
    aggregate.progressionSignals
      .authoredHazardDamageBudgetPerRoomDeltaPerFloor > 0,
  observedPressureSignalsAreAvailable:
    observedDamageFractions.every(Number.isFinite) &&
    Number.isFinite(
      aggregate.progressionSignals.observedDamageFractionDeltaPerFloor,
    ) &&
    aggregate.progressionSignals.clearRateDeltaPerFloor < 0,
  runIntentFitCoversEveryFloor:
    intentFit.score.floorCoverage.scoredFloorCount === 3 &&
    intentFit.score.floorCoverage.fraction === 1 &&
    Number.isFinite(intentFit.score.observableFitScore),
  difficultyProxyRemainsDescriptive:
    intentFit.score.targetDifficulty.status === 'descriptive-proxy-only' &&
    intentFit.score.targetDifficulty.excludedFromObservableFitScore === true &&
    Number.isFinite(intentFit.score.targetDifficulty.observedPressureProxy),
  repeatedRunIsDeterministic:
    JSON.stringify(safeRepeat) === JSON.stringify(safe),
  authoringRunSpecUnchanged:
    JSON.stringify(runSpec) === authoringBefore,
};

const falseChecks = Object.entries(checks)
  .filter(([, value]) => value !== true)
  .map(([name]) => name);

const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed: falseChecks.length === 0,
  checks,
  falseChecks,
  fixture: {
    runId: runSpec.id,
    floorCount: runSpec.floors.length,
    authoredDamagePerRoom,
    trapDamageByFloor: runSpec.floors.map((floor) =>
      floor.dungeon.entities.find((entity) => entity.type === 'trap')?.damage),
  },
  safeFinalTrapAvoidance,
  carryPairs,
  safe: {
    simulation: safe,
    metrics: safeMetrics,
  },
  treasure: {
    simulation: treasure,
    metrics: treasureMetrics,
  },
  risk: {
    simulation: risk,
    metrics: riskMetrics,
  },
  aggregate,
  intentFit: intentFit.score,
};

fs.writeFileSync(
  path.join(outputDir, 'dai-098-multi-floor-simulation.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);
console.log(JSON.stringify(evidence, null, 2));

if (!evidence.passed) {
  throw new Error(
    `DAI-098 multi-floor simulation invariant failed: ${falseChecks.join(', ')}`,
  );
}
