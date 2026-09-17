const AXIS_LABELS = Object.freeze({
  fairness: 'Fairness',
  tension: 'Tension',
  exploration: 'Exploration',
  greedPunishment: 'Greed punishment',
  routeChoice: 'Route choice',
  learnability: 'Learnability',
  combatDensity: 'Combat density',
  trapDensity: 'Trap density',
  rewardDensity: 'Reward density',
  deception: 'Deception',
  telegraphStrength: 'Telegraph strength',
  backtracking: 'Backtracking',
  targetDifficulty: 'Target difficulty',
});

const UNSCORED_REASON_TEXT = Object.freeze({
  NO_GREED_OUTCOME_PROXY: 'No observable greedy-choice consequence proxy exists in the current simulator.',
  NO_DECEPTION_PROXY: 'No authored/runtime deception proxy exists in the current simulator.',
  NO_TELEGRAPH_PROXY: 'No measurable telegraph exposure/response proxy exists in the current simulator.',
  NO_DIFFICULTY_PROXY: 'Deterministic structural probes are not a calibrated difficulty model.',
  NO_OBSERVABLE_PROXY: 'No supported observable proxy exists for this axis.',
  SIMULATION_STEPS_ARE_NOT_REALTIME_SECONDS: 'Simulation steps are abstract actions, not realtime seconds.',
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function round(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function format(value) {
  return Number.isFinite(value) ? value.toFixed(3) : 'n/a';
}

function axisLabel(axis) {
  return AXIS_LABELS[axis] ?? axis;
}

function reasonText(reason) {
  return UNSCORED_REASON_TEXT[reason] ?? `Unscored: ${reason}.`;
}

function isUnitNumber(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function validateScore(score) {
  if (!score || typeof score !== 'object' || Array.isArray(score)) {
    return 'intentFitScore must be a DAI-063 score object.';
  }
  if (score.schemaVersion !== '1.0') {
    return 'intentFitScore.schemaVersion must be 1.0.';
  }
  if (!isUnitNumber(score.observableFitScore)) {
    return 'intentFitScore.observableFitScore must be a finite number from 0 through 1.';
  }
  if (!score.coverage || typeof score.coverage !== 'object') {
    return 'intentFitScore.coverage is required.';
  }
  for (const key of ['scoredAxisCount', 'normalizedAxisCount', 'coreScoredCount', 'coreAxisCount', 'supportingScoredCount', 'supportingAxisCount']) {
    if (!Number.isInteger(score.coverage[key]) || score.coverage[key] < 0) {
      return `intentFitScore.coverage.${key} must be a non-negative integer.`;
    }
  }
  if (!score.axes || typeof score.axes !== 'object' || Array.isArray(score.axes)) {
    return 'intentFitScore.axes is required.';
  }

  let scoredCount = 0;
  for (const [axis, entry] of Object.entries(score.axes)) {
    if (!entry || typeof entry !== 'object') return `intentFitScore.axes.${axis} must be an object.`;
    if (entry.status === 'scored') {
      scoredCount += 1;
      if (!isUnitNumber(entry.target) || !isUnitNumber(entry.observed) || !isUnitNumber(entry.fit)) {
        return `Scored axis ${axis} must contain unit-interval target, observed, and fit values.`;
      }
      if (!['low', 'medium', 'high'].includes(entry.confidence)) {
        return `Scored axis ${axis} must contain low/medium/high confidence.`;
      }
      if (typeof entry.basis !== 'string' || entry.basis.trim() === '') {
        return `Scored axis ${axis} must contain an evidence basis.`;
      }
    } else if (entry.status === 'unscored') {
      if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
        return `Unscored axis ${axis} must contain a reason code.`;
      }
    } else {
      return `Axis ${axis} has unsupported status ${String(entry.status)}.`;
    }
  }

  if (scoredCount !== score.coverage.scoredAxisCount) {
    return `Coverage scoredAxisCount ${score.coverage.scoredAxisCount} does not match ${scoredCount} scored axes.`;
  }
  if (!score.targetDuration || score.targetDuration.status !== 'unscored' || typeof score.targetDuration.reason !== 'string') {
    return 'intentFitScore.targetDuration must be explicitly unscored with a reason.';
  }
  return null;
}

function projectScoredAxes(score) {
  return Object.entries(score.axes)
    .filter(([, entry]) => entry.status === 'scored')
    .map(([axis, entry], order) => {
      const delta = round(entry.observed - entry.target);
      const absoluteDelta = round(Math.abs(delta));
      const direction = absoluteDelta === 0 ? 'matched' : delta > 0 ? 'above-target' : 'below-target';
      const label = axisLabel(axis);
      const statement = direction === 'matched'
        ? `${label} matches the target at ${format(entry.observed)} (fit ${format(entry.fit)}, confidence ${entry.confidence}).`
        : `${label} is ${format(absoluteDelta)} ${direction === 'above-target' ? 'above' : 'below'} target (target ${format(entry.target)}, observed ${format(entry.observed)}, fit ${format(entry.fit)}, confidence ${entry.confidence}).`;

      return {
        axis,
        label,
        target: entry.target,
        observed: entry.observed,
        delta,
        absoluteDelta,
        direction,
        fit: entry.fit,
        confidence: entry.confidence,
        basis: entry.basis,
        statement,
        order,
      };
    });
}

function projectUnscoredAxes(score) {
  return Object.entries(score.axes)
    .filter(([, entry]) => entry.status === 'unscored')
    .map(([axis, entry]) => ({
      axis,
      label: axisLabel(axis),
      target: entry.target,
      reason: entry.reason,
      explanation: reasonText(entry.reason),
    }));
}

function withoutOrder(entries) {
  return entries.map(({ order, ...entry }) => entry);
}

export function buildExplainableIntentSummary(intentFitScore, { maxHighlights = 3 } = {}) {
  const validationError = validateScore(intentFitScore);
  if (validationError) {
    return {
      ok: false,
      error: {
        code: 'EXPLAINABLE_SUMMARY_INVALID_SCORE',
        message: validationError,
      },
    };
  }
  if (!Number.isInteger(maxHighlights) || maxHighlights < 1 || maxHighlights > 13) {
    return {
      ok: false,
      error: {
        code: 'EXPLAINABLE_SUMMARY_INVALID_OPTIONS',
        message: 'maxHighlights must be an integer from 1 through 13.',
      },
    };
  }

  const scored = projectScoredAxes(intentFitScore);
  const unscored = projectUnscoredAxes(intentFitScore);
  const closestAxes = withoutOrder([...scored]
    .sort((a, b) => b.fit - a.fit || a.order - b.order)
    .slice(0, maxHighlights));
  const largestGaps = withoutOrder([...scored]
    .filter((entry) => entry.absoluteDelta > 0)
    .sort((a, b) => b.absoluteDelta - a.absoluteDelta || a.order - b.order)
    .slice(0, maxHighlights));

  const coverage = clone(intentFitScore.coverage);
  const coverageStatement = `Observable fit covers ${coverage.scoredAxisCount}/${coverage.normalizedAxisCount} normalized axes (${coverage.coreScoredCount}/${coverage.coreAxisCount} core, ${coverage.supportingScoredCount}/${coverage.supportingAxisCount} supporting); target duration is unscored.`;
  const scoreStatement = `Observable intent fit is ${format(intentFitScore.observableFitScore)} across the scored axes only.`;
  const durationExplanation = reasonText(intentFitScore.targetDuration.reason);

  const summary = {
    schemaVersion: '1.0',
    dungeonId: intentFitScore.dungeonId ?? null,
    observableFitScore: intentFitScore.observableFitScore,
    scoreStatement,
    coverage: {
      ...coverage,
      statement: coverageStatement,
    },
    scoredAxes: withoutOrder(scored),
    closestAxes,
    largestGaps,
    unscoredAxes: unscored,
    targetDuration: {
      status: 'unscored',
      targetSeconds: intentFitScore.targetDuration.targetSeconds ?? null,
      reason: intentFitScore.targetDuration.reason,
      explanation: durationExplanation,
    },
    caveats: [
      'Unscored axes are excluded from observableFitScore rather than assigned fabricated neutral values.',
      'The current simulator provides deterministic structural evidence, not calibrated human behavior.',
      'Observable intent fit is not a judgment of fun, accessibility, or final design quality.',
    ],
  };

  return { ok: true, summary };
}

export function renderExplainableIntentSummaryText(summary) {
  if (!summary || summary.schemaVersion !== '1.0' || !Array.isArray(summary.scoredAxes)) {
    throw new TypeError('A valid Explainable Summary v1 object is required.');
  }

  const closest = summary.closestAxes.length
    ? summary.closestAxes.map((entry) => entry.statement).join(' ')
    : 'No scored axes are available.';
  const gaps = summary.largestGaps.length
    ? summary.largestGaps.map((entry) => entry.statement).join(' ')
    : 'No non-zero observable gaps were measured on the scored axes.';
  const unscored = summary.unscoredAxes.length
    ? summary.unscoredAxes.map((entry) => `${entry.label}: ${entry.explanation}`).join(' ')
    : 'No normalized axes are unscored.';

  return [
    summary.scoreStatement,
    summary.coverage.statement,
    `Closest observable matches: ${closest}`,
    `Largest observable gaps: ${gaps}`,
    `Unscored axes: ${unscored}`,
    `Target duration: ${summary.targetDuration.explanation}`,
    `Boundary: ${summary.caveats.join(' ')}`,
  ].join('\n');
}
