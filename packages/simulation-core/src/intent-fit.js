import {
  CORE_AXES,
  SUPPORTING_AXES,
  validateDesignIntent,
} from '../../intent/src/design-intent.js';

const NORMALIZED_AXES = Object.freeze([...CORE_AXES, ...SUPPORTING_AXES]);

const OBSERVABLE_AXIS_META = Object.freeze({
  fairness: Object.freeze({ confidence: 'low', basis: 'cross-agent successRate' }),
  tension: Object.freeze({ confidence: 'medium', basis: 'mean hazardous-room entries per gameplay move' }),
  exploration: Object.freeze({ confidence: 'high', basis: 'mean visited-room fraction across simulation policies' }),
  routeChoice: Object.freeze({ confidence: 'high', basis: 'mean pairwise route-edge Jaccard distance' }),
  learnability: Object.freeze({ confidence: 'medium', basis: 'one minus mean revisit rate' }),
  combatDensity: Object.freeze({ confidence: 'high', basis: 'authored enemy entity count divided by room count' }),
  trapDensity: Object.freeze({ confidence: 'high', basis: 'authored trap entity count divided by room count' }),
  rewardDensity: Object.freeze({ confidence: 'high', basis: 'authored treasure entity count divided by room count' }),
  backtracking: Object.freeze({ confidence: 'high', basis: 'mean revisit rate' }),
});

const UNSCORED_AXIS_REASONS = Object.freeze({
  greedPunishment: 'NO_GREED_OUTCOME_PROXY',
  deception: 'NO_DECEPTION_PROXY',
  telegraphStrength: 'NO_TELEGRAPH_PROXY',
  targetDifficulty: 'NO_DIFFICULTY_PROXY',
});

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
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function entityDensity(spec, type) {
  const roomCount = spec?.rooms?.length ?? 0;
  if (roomCount <= 0) return null;
  const count = (spec?.entities ?? []).filter((entity) => entity.type === type).length;
  return round(clamp01(count / roomCount));
}

function requireMetrics(authoringSpec, aggregateMetrics) {
  if (!aggregateMetrics || typeof aggregateMetrics !== 'object' || !Array.isArray(aggregateMetrics.runs)) {
    throw new TypeError('aggregateMetrics must be a DAI-062 aggregate metrics object.');
  }
  if (aggregateMetrics.runs.length === 0) {
    throw new TypeError('aggregateMetrics.runs must contain at least one completed simulation projection.');
  }
  if (authoringSpec?.id && aggregateMetrics.dungeonId && authoringSpec.id !== aggregateMetrics.dungeonId) {
    throw new RangeError(`aggregateMetrics dungeonId ${aggregateMetrics.dungeonId} does not match ${authoringSpec.id}.`);
  }
}

export function deriveObservableIntentProfile(authoringSpec, aggregateMetrics) {
  requireMetrics(authoringSpec, aggregateMetrics);

  const meanVisitedRoomFraction = mean(aggregateMetrics.runs.map((run) => run.visitedRoomFraction));
  const meanMoves = aggregateMetrics.means?.moves;
  const meanHazardEntries = aggregateMetrics.means?.hazardRoomEntries;
  const hazardEntryPerMove = Number.isFinite(meanMoves) && meanMoves > 0 && Number.isFinite(meanHazardEntries)
    ? meanHazardEntries / meanMoves
    : 0;
  const meanRevisitRate = Number.isFinite(aggregateMetrics.means?.revisitRate)
    ? aggregateMetrics.means.revisitRate
    : 0;

  return Object.freeze({
    fairness: round(clamp01(aggregateMetrics.successRate ?? 0)),
    tension: round(clamp01(hazardEntryPerMove)),
    exploration: round(clamp01(meanVisitedRoomFraction ?? 0)),
    routeChoice: round(clamp01(aggregateMetrics.routeDiversity?.meanEdgeJaccardDistance ?? 0)),
    learnability: round(clamp01(1 - meanRevisitRate)),
    combatDensity: entityDensity(authoringSpec, 'enemy'),
    trapDensity: entityDensity(authoringSpec, 'trap'),
    rewardDensity: entityDensity(authoringSpec, 'treasure'),
    backtracking: round(clamp01(meanRevisitRate)),
  });
}

function axisFit(target, observed) {
  return round(clamp01(1 - Math.abs(target - observed)));
}

export function scoreIntentFit(authoringSpec, designIntent, aggregateMetrics) {
  const validation = validateDesignIntent(designIntent);
  if (!validation.valid) {
    return {
      ok: false,
      error: {
        code: 'INTENT_FIT_INVALID_INTENT',
        message: 'DesignIntent must validate before intent-fit scoring.',
        details: clone(validation.errors),
      },
    };
  }

  try {
    requireMetrics(authoringSpec, aggregateMetrics);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'INTENT_FIT_INVALID_METRICS',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const observed = deriveObservableIntentProfile(authoringSpec, aggregateMetrics);
  const axes = {};
  const scoredFits = [];

  for (const axis of NORMALIZED_AXES) {
    if (Object.hasOwn(observed, axis) && Number.isFinite(observed[axis])) {
      const fit = axisFit(designIntent[axis], observed[axis]);
      scoredFits.push(fit);
      axes[axis] = {
        status: 'scored',
        target: designIntent[axis],
        observed: observed[axis],
        fit,
        confidence: OBSERVABLE_AXIS_META[axis].confidence,
        basis: OBSERVABLE_AXIS_META[axis].basis,
      };
    } else {
      axes[axis] = {
        status: 'unscored',
        target: designIntent[axis],
        reason: UNSCORED_AXIS_REASONS[axis] ?? 'NO_OBSERVABLE_PROXY',
      };
    }
  }

  const scoredAxisCount = scoredFits.length;
  const coreScoredCount = CORE_AXES.filter((axis) => axes[axis]?.status === 'scored').length;
  const supportingScoredCount = SUPPORTING_AXES.filter((axis) => axes[axis]?.status === 'scored').length;

  return {
    ok: true,
    score: {
      schemaVersion: '1.0',
      dungeonId: authoringSpec?.id ?? aggregateMetrics.dungeonId ?? null,
      intentSchemaVersion: designIntent.schemaVersion,
      observableFitScore: scoredFits.length
        ? round(scoredFits.reduce((sum, value) => sum + value, 0) / scoredFits.length)
        : null,
      coverage: {
        scoredAxisCount,
        normalizedAxisCount: NORMALIZED_AXES.length,
        axisFraction: round(scoredAxisCount / NORMALIZED_AXES.length),
        coreScoredCount,
        coreAxisCount: CORE_AXES.length,
        coreFraction: round(coreScoredCount / CORE_AXES.length),
        supportingScoredCount,
        supportingAxisCount: SUPPORTING_AXES.length,
        supportingFraction: round(supportingScoredCount / SUPPORTING_AXES.length),
        targetDurationScored: false,
      },
      axes,
      targetDuration: {
        status: 'unscored',
        targetSeconds: designIntent.targetDuration,
        reason: 'SIMULATION_STEPS_ARE_NOT_REALTIME_SECONDS',
      },
      instantDeathAllowed: {
        status: 'constraint-only',
        target: false,
      },
    },
  };
}

export const INTENT_FIT_SCORED_AXES = Object.freeze(Object.keys(OBSERVABLE_AXIS_META));
export const INTENT_FIT_UNSCORED_AXES = Object.freeze(Object.keys(UNSCORED_AXIS_REASONS));
