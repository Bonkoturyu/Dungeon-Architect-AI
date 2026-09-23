import { validateDesignIntent } from '../../intent/src/design-intent.js';
import { scoreIntentFit } from './intent-fit.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function round(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length
    ? round(finite.reduce((sum, value) => sum + value, 0) / finite.length)
    : null;
}

function pressureProxy(floor) {
  const damage = floor?.means?.damageFractionOfStartMaxHp;
  const clearRate = floor?.clearRateAmongReached;
  const components = [];

  if (Number.isFinite(damage)) components.push(clamp01(damage));
  if (Number.isFinite(clearRate)) components.push(clamp01(1 - clearRate));

  return components.length ? round(mean(components)) : null;
}

function requireAggregate(runSpec, aggregateMetrics) {
  if (!runSpec || typeof runSpec !== 'object' || !Array.isArray(runSpec.floors)) {
    throw new TypeError('runSpec must be a DungeonRunSpec.');
  }
  if (
    !aggregateMetrics ||
    typeof aggregateMetrics !== 'object' ||
    aggregateMetrics.runId !== runSpec.id ||
    !Array.isArray(aggregateMetrics.floors)
  ) {
    throw new TypeError('aggregateMetrics must be a DAI-098 run aggregate for runSpec.');
  }
}

export function scoreDungeonRunIntentFit(runSpec, designIntent, aggregateMetrics) {
  const validation = validateDesignIntent(designIntent);
  if (!validation.valid) {
    return {
      ok: false,
      error: {
        code: 'RUN_INTENT_FIT_INVALID_INTENT',
        message: 'DesignIntent must validate before run intent-fit scoring.',
        details: clone(validation.errors),
      },
    };
  }

  try {
    requireAggregate(runSpec, aggregateMetrics);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'RUN_INTENT_FIT_INVALID_METRICS',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const floorScores = [];
  for (const floorProfile of aggregateMetrics.floors) {
    const floorSpec = runSpec.floors[floorProfile.floorIndex]?.dungeon;
    if (!floorSpec || !floorProfile.simulationAggregate) continue;

    const scored = scoreIntentFit(
      floorSpec,
      designIntent,
      floorProfile.simulationAggregate,
    );
    if (!scored.ok) {
      return {
        ok: false,
        error: {
          code: 'RUN_INTENT_FIT_FLOOR_FAILED',
          message: `Floor ${floorProfile.floorIndex + 1} intent-fit scoring failed.`,
          details: clone(scored.error),
        },
      };
    }

    floorScores.push({
      floorIndex: floorProfile.floorIndex,
      floorNumber: floorProfile.floorNumber,
      floorId: floorProfile.floorId,
      dungeonId: floorProfile.dungeonId,
      reachedCount: floorProfile.reachedCount,
      clearRateOverall: floorProfile.clearRateOverall,
      observableFitScore: scored.score.observableFitScore,
      coverage: clone(scored.score.coverage),
      axes: clone(scored.score.axes),
    });
  }

  const pressureByFloor = aggregateMetrics.floors.map((floor) => ({
    floorIndex: floor.floorIndex,
    floorNumber: floor.floorNumber,
    pressureProxy: pressureProxy(floor),
    meanDamageFractionOfStartMaxHp:
      floor.means?.damageFractionOfStartMaxHp ?? null,
    clearRateAmongReached: floor.clearRateAmongReached ?? null,
  }));

  return {
    ok: true,
    score: {
      schemaVersion: '1.0',
      runId: runSpec.id,
      intentSchemaVersion: designIntent.schemaVersion,
      observableFitScore: mean(
        floorScores.map((floor) => floor.observableFitScore),
      ),
      floorCoverage: {
        scoredFloorCount: floorScores.length,
        floorCount: runSpec.floors.length,
        fraction:
          runSpec.floors.length > 0
            ? round(floorScores.length / runSpec.floors.length)
            : null,
      },
      floorScores,
      targetDifficulty: {
        status: 'descriptive-proxy-only',
        target: designIntent.targetDifficulty,
        observedPressureProxy: mean(
          pressureByFloor.map((floor) => floor.pressureProxy),
        ),
        basis:
          'mean of normalized damage fraction and one-minus clear rate among reached policies',
        excludedFromObservableFitScore: true,
        floors: pressureByFloor,
      },
      targetDuration: {
        status: 'unscored',
        targetSeconds: designIntent.targetDuration,
        reason: 'SIMULATION_STEPS_ARE_NOT_REALTIME_SECONDS',
      },
    },
  };
}
