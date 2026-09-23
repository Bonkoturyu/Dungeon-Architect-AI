import {
  aggregateSimulationMetrics,
  projectSimulationMetrics,
} from './metrics.js';
import { DEFAULT_ENEMY_DAMAGE } from '../../play-core/src/enemy-runtime.js';
import { DEFAULT_TRAP_DAMAGE } from '../../play-core/src/interaction-runtime.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function round(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length
    ? round(finite.reduce((sum, value) => sum + value, 0) / finite.length)
    : null;
}

function sum(values) {
  return values.filter(Number.isFinite).reduce((total, value) => total + value, 0);
}

function entityCount(spec, type) {
  return (spec?.entities ?? []).filter((entity) => entity.type === type).length;
}

function damageBudget(spec, type, defaultDamage) {
  return (spec?.entities ?? [])
    .filter((entity) => entity.type === type)
    .reduce((sum, entity) => {
      const damage = Number.isSafeInteger(entity.damage) && entity.damage >= 0
        ? entity.damage
        : defaultDamage;
      return sum + damage;
    }, 0);
}

function authoredFloorProfile(spec) {
  const roomCount = spec?.rooms?.length ?? 0;
  const enemyDamageBudget = damageBudget(spec, 'enemy', DEFAULT_ENEMY_DAMAGE);
  const trapDamageBudget = damageBudget(spec, 'trap', DEFAULT_TRAP_DAMAGE);
  const hazardDamageBudget = enemyDamageBudget + trapDamageBudget;

  return {
    roomCount,
    enemyCount: entityCount(spec, 'enemy'),
    trapCount: entityCount(spec, 'trap'),
    treasureCount: entityCount(spec, 'treasure'),
    recoveryCount: entityCount(spec, 'recovery'),
    hazardDensity: density(spec, ['enemy', 'trap']),
    rewardDensity: density(spec, ['treasure', 'recovery']),
    enemyDamageBudget,
    trapDamageBudget,
    hazardDamageBudget,
    hazardDamageBudgetPerRoom:
      roomCount > 0 ? round(hazardDamageBudget / roomCount) : null,
  };
}

function density(spec, types) {
  const roomCount = spec?.rooms?.length ?? 0;
  if (roomCount <= 0) return null;
  const count = (spec?.entities ?? []).filter((entity) => types.includes(entity.type)).length;
  return round(count / roomCount);
}

function equipmentTier(playerState, slot) {
  return playerState?.equipment?.[slot]?.tier ?? 0;
}

function deltaPerFloor(values) {
  const finite = values.filter(Number.isFinite);
  if (finite.length <= 1) return 0;
  return round((finite.at(-1) - finite[0]) / (finite.length - 1));
}

function failureFloor(simulation) {
  if (simulation.status !== 'failed') return null;
  return simulation.floorSimulations?.at(-1)?.floorIndex ?? null;
}

function requireRunSimulation(runSpec, simulation) {
  if (!runSpec || typeof runSpec !== 'object' || !Array.isArray(runSpec.floors)) {
    throw new TypeError('runSpec must be a DungeonRunSpec.');
  }
  if (
    !simulation ||
    typeof simulation !== 'object' ||
    typeof simulation.policyId !== 'string' ||
    !Array.isArray(simulation.floorSimulations) ||
    !simulation.result
  ) {
    throw new TypeError('A completed DungeonRun simulation is required.');
  }
  if (simulation.runId !== runSpec.id) {
    throw new RangeError(
      `Simulation runId ${simulation.runId} does not match DungeonRunSpec ${runSpec.id}.`,
    );
  }
}

function projectFloor(runSpec, floorSimulation) {
  const floorIndex = floorSimulation.floorIndex;
  const floor = runSpec.floors[floorIndex];
  if (!floor) {
    throw new RangeError(`Unknown simulated floor index: ${floorIndex}`);
  }

  const metrics = projectSimulationMetrics(floor.dungeon, floorSimulation);
  const start = floorSimulation.startingPlayerState ?? {};
  const end = floorSimulation.result?.playerState ?? {};
  const startMaxHp = Number.isFinite(start.maxHp) ? start.maxHp : null;
  const endMaxHp = Number.isFinite(end.maxHp) ? end.maxHp : null;
  const endHp = Number.isFinite(end.hp) ? end.hp : null;

  return {
    floorIndex,
    floorNumber: floorIndex + 1,
    floorId: floor.id,
    dungeonId: floor.dungeon.id,
    status: metrics.status,
    success: metrics.success,
    failureReason: metrics.failureReason,
    authored: authoredFloorProfile(floor.dungeon),
    startingPlayerState: clone(start),
    endingPlayerState: clone(end),
    progression: {
      levelGain:
        Number.isFinite(end.level) && Number.isFinite(start.level)
          ? end.level - start.level
          : null,
      xpEarned: metrics.xpEarned,
      goldEarned: metrics.goldEarned,
      lootCollected: metrics.lootCollected,
      weaponTierGain: equipmentTier(end, 'weapon') - equipmentTier(start, 'weapon'),
      armorTierGain: equipmentTier(end, 'armor') - equipmentTier(start, 'armor'),
    },
    pressure: {
      damageTaken: metrics.damageTaken,
      healingReceived: metrics.healingReceived,
      damageFractionOfStartMaxHp:
        startMaxHp && startMaxHp > 0 ? round(metrics.damageTaken / startMaxHp) : null,
      endHpFraction:
        endMaxHp && endMaxHp > 0 && endHp !== null ? round(endHp / endMaxHp) : null,
      deaths: metrics.deaths,
    },
    navigation: {
      steps: metrics.steps,
      moves: metrics.moves,
      roomsVisited: metrics.roomsVisited,
      visitedRoomFraction: metrics.visitedRoomFraction,
      routeStretch: metrics.routeStretch,
      revisitRate: metrics.revisitRate,
      hazardRoomEntries: metrics.hazardRoomEntries,
    },
    interactions: {
      interactions: metrics.interactions,
      enemiesCleared: metrics.enemiesCleared,
      treasuresOpened: metrics.treasuresOpened,
      trapsTriggered: metrics.trapsTriggered,
      recoveryUsed: metrics.recoveryUsed,
      enemyClearRate: metrics.enemyClearRate,
      treasureCaptureRate: metrics.treasureCaptureRate,
      trapTriggerRate: metrics.trapTriggerRate,
    },
  };
}

export function projectDungeonRunSimulationMetrics(runSpec, simulation) {
  requireRunSimulation(runSpec, simulation);

  const floors = simulation.floorSimulations
    .map((floorSimulation) => projectFloor(runSpec, floorSimulation))
    .sort((a, b) => a.floorIndex - b.floorIndex);

  const finalState = simulation.finalPlayerState ?? simulation.result?.finalPlayerState ?? {};
  const finalMaxHp = Number.isFinite(finalState.maxHp) ? finalState.maxHp : null;
  const finalHp = Number.isFinite(finalState.hp) ? finalState.hp : null;

  return {
    schemaVersion: '1.0',
    policyId: simulation.policyId,
    runId: simulation.runId,
    status: simulation.status,
    success: simulation.status === 'cleared',
    failureReason: simulation.status === 'failed' ? simulation.failureReason ?? null : null,
    failureFloorIndex: failureFloor(simulation),
    floorCount: runSpec.floors.length,
    floorsReached: floors.length,
    floorsCleared: floors.filter((floor) => floor.success).length,
    floorCompletionRate:
      runSpec.floors.length > 0
        ? round(floors.filter((floor) => floor.success).length / runSpec.floors.length)
        : null,
    totalSteps: simulation.totalSteps ?? sum(floors.map((floor) => floor.navigation.steps)),
    totals: {
      moves: sum(floors.map((floor) => floor.navigation.moves)),
      interactions: sum(floors.map((floor) => floor.interactions.interactions)),
      damageTaken: sum(floors.map((floor) => floor.pressure.damageTaken)),
      healingReceived: sum(floors.map((floor) => floor.pressure.healingReceived)),
      xpEarned: sum(floors.map((floor) => floor.progression.xpEarned)),
      goldEarned: sum(floors.map((floor) => floor.progression.goldEarned)),
      levelUps: sum(floors.map((floor) => floor.progression.levelGain)),
      lootCollected: sum(floors.map((floor) => floor.progression.lootCollected)),
      enemiesCleared: sum(floors.map((floor) => floor.interactions.enemiesCleared)),
      treasuresOpened: sum(floors.map((floor) => floor.interactions.treasuresOpened)),
      trapsTriggered: sum(floors.map((floor) => floor.interactions.trapsTriggered)),
      recoveryUsed: sum(floors.map((floor) => floor.interactions.recoveryUsed)),
      deaths: sum(floors.map((floor) => floor.pressure.deaths)),
    },
    final: {
      hp: finalHp,
      maxHp: finalMaxHp,
      hpFraction:
        finalMaxHp && finalMaxHp > 0 && finalHp !== null
          ? round(finalHp / finalMaxHp)
          : null,
      level: finalState.level ?? null,
      xp: finalState.xp ?? null,
      gold: finalState.gold ?? null,
      weaponTier: equipmentTier(finalState, 'weapon'),
      armorTier: equipmentTier(finalState, 'armor'),
    },
    floors: clone(floors),
  };
}

export function aggregateDungeonRunSimulationMetrics(runSpec, simulations) {
  if (!Array.isArray(simulations) || simulations.length === 0) {
    throw new TypeError('simulations must contain at least one completed run simulation.');
  }

  const runs = simulations
    .map((simulation) => projectDungeonRunSimulationMetrics(runSpec, simulation))
    .sort((a, b) => a.policyId.localeCompare(b.policyId));

  const successCount = runs.filter((run) => run.success).length;
  const failureCount = runs.length - successCount;
  const floorProfiles = runSpec.floors.map((floor, floorIndex) => {
    const reachedSimulations = simulations
      .map((simulation) =>
        simulation.floorSimulations.find((entry) => entry.floorIndex === floorIndex) ?? null)
      .filter(Boolean);

    const projected = runs
      .map((run) => run.floors.find((entry) => entry.floorIndex === floorIndex) ?? null)
      .filter(Boolean);

    const clearedCount = projected.filter((entry) => entry.success).length;
    const reachedCount = projected.length;
    const aggregate = reachedSimulations.length > 0
      ? aggregateSimulationMetrics(floor.dungeon, reachedSimulations)
      : null;

    return {
      floorIndex,
      floorNumber: floorIndex + 1,
      floorId: floor.id,
      dungeonId: floor.dungeon.id,
      authored: authoredFloorProfile(floor.dungeon),
      reachedCount,
      reachRate: round(reachedCount / runs.length),
      clearedCount,
      clearRateOverall: round(clearedCount / runs.length),
      clearRateAmongReached:
        reachedCount > 0 ? round(clearedCount / reachedCount) : null,
      means: {
        damageTaken: mean(projected.map((entry) => entry.pressure.damageTaken)),
        damageFractionOfStartMaxHp: mean(
          projected.map((entry) => entry.pressure.damageFractionOfStartMaxHp),
        ),
        endHpFraction: mean(projected.map((entry) => entry.pressure.endHpFraction)),
        xpEarned: mean(projected.map((entry) => entry.progression.xpEarned)),
        goldEarned: mean(projected.map((entry) => entry.progression.goldEarned)),
        levelGain: mean(projected.map((entry) => entry.progression.levelGain)),
        lootCollected: mean(projected.map((entry) => entry.progression.lootCollected)),
        weaponTierGain: mean(projected.map((entry) => entry.progression.weaponTierGain)),
        armorTierGain: mean(projected.map((entry) => entry.progression.armorTierGain)),
        moves: mean(projected.map((entry) => entry.navigation.moves)),
        routeStretch: mean(projected.map((entry) => entry.navigation.routeStretch)),
        visitedRoomFraction: mean(
          projected.map((entry) => entry.navigation.visitedRoomFraction),
        ),
      },
      simulationAggregate: aggregate ? clone(aggregate) : null,
    };
  });

  const clearRates = floorProfiles.map((floor) => floor.clearRateOverall);
  const bottleneck = floorProfiles.length > 0
    ? [...floorProfiles].sort((a, b) =>
        (a.clearRateOverall ?? 1) - (b.clearRateOverall ?? 1) ||
        a.floorIndex - b.floorIndex)[0]
    : null;

  return {
    schemaVersion: '1.0',
    runId: runSpec.id,
    runCount: runs.length,
    successCount,
    failureCount,
    successRate: round(successCount / runs.length),
    failureRate: round(failureCount / runs.length),
    failureFloorCounts: Object.fromEntries(
      runSpec.floors.map((_, floorIndex) => [
        String(floorIndex),
        runs.filter((run) => run.failureFloorIndex === floorIndex).length,
      ]),
    ),
    means: {
      floorsReached: mean(runs.map((run) => run.floorsReached)),
      floorsCleared: mean(runs.map((run) => run.floorsCleared)),
      floorCompletionRate: mean(runs.map((run) => run.floorCompletionRate)),
      totalSteps: mean(runs.map((run) => run.totalSteps)),
      moves: mean(runs.map((run) => run.totals.moves)),
      damageTaken: mean(runs.map((run) => run.totals.damageTaken)),
      healingReceived: mean(runs.map((run) => run.totals.healingReceived)),
      xpEarned: mean(runs.map((run) => run.totals.xpEarned)),
      goldEarned: mean(runs.map((run) => run.totals.goldEarned)),
      lootCollected: mean(runs.map((run) => run.totals.lootCollected)),
      finalHpFraction: mean(runs.map((run) => run.final.hpFraction)),
      finalLevel: mean(runs.map((run) => run.final.level)),
      finalGold: mean(runs.map((run) => run.final.gold)),
      finalWeaponTier: mean(runs.map((run) => run.final.weaponTier)),
      finalArmorTier: mean(runs.map((run) => run.final.armorTier)),
    },
    progressionSignals: {
      authoredHazardDensityDeltaPerFloor: deltaPerFloor(
        floorProfiles.map((floor) => floor.authored.hazardDensity),
      ),
      authoredRewardDensityDeltaPerFloor: deltaPerFloor(
        floorProfiles.map((floor) => floor.authored.rewardDensity),
      ),
      authoredHazardDamageBudgetPerRoomDeltaPerFloor: deltaPerFloor(
        floorProfiles.map((floor) => floor.authored.hazardDamageBudgetPerRoom),
      ),
      observedDamageFractionDeltaPerFloor: deltaPerFloor(
        floorProfiles.map((floor) => floor.means.damageFractionOfStartMaxHp),
      ),
      observedEndHpFractionDeltaPerFloor: deltaPerFloor(
        floorProfiles.map((floor) => floor.means.endHpFraction),
      ),
      observedLevelGainDeltaPerFloor: deltaPerFloor(
        floorProfiles.map((floor) => floor.means.levelGain),
      ),
      clearRateDeltaPerFloor: deltaPerFloor(clearRates),
      bottleneckFloorIndex: bottleneck?.floorIndex ?? null,
      bottleneckClearRate: bottleneck?.clearRateOverall ?? null,
    },
    floors: clone(floorProfiles),
    runs: clone(runs),
  };
}
