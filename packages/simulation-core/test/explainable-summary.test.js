import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import {
  createCautiousAgent,
  createShortestPathAgent,
  createTreasureGreedyAgent,
} from '../src/agents.js';
import {
  buildExplainableIntentSummary,
  renderExplainableIntentSummaryText,
} from '../src/explainable-summary.js';
import { scoreIntentFit, deriveObservableIntentProfile } from '../src/intent-fit.js';
import { aggregateSimulationMetrics } from '../src/metrics.js';
import { simulateDungeon } from '../src/simulator.js';

const fixtureUrl = new URL('../../../spec/simulation/fixtures/agent-contrast-v1.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fileURLToPath(fixtureUrl), 'utf8'));

function run(policy) {
  const result = simulateDungeon(fixture, policy, { policyId: policy.policyId, maxSteps: 64 });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.simulation;
}

function aggregate() {
  return aggregateSimulationMetrics(fixture, [
    run(createShortestPathAgent(fixture)),
    run(createTreasureGreedyAgent(fixture)),
    run(createCautiousAgent(fixture)),
  ]);
}

function intentFromProfile(profile, { opposed = false } = {}) {
  const map = (value) => opposed ? 1 - value : value;
  return {
    ...DEFAULT_DESIGN_INTENT,
    fairness: map(profile.fairness),
    tension: map(profile.tension),
    exploration: map(profile.exploration),
    routeChoice: map(profile.routeChoice),
    learnability: map(profile.learnability),
    combatDensity: map(profile.combatDensity),
    trapDensity: map(profile.trapDensity),
    rewardDensity: map(profile.rewardDensity),
    backtracking: map(profile.backtracking),
  };
}

function score({ opposed = false } = {}) {
  const metrics = aggregate();
  const profile = deriveObservableIntentProfile(fixture, metrics);
  const result = scoreIntentFit(fixture, intentFromProfile(profile, { opposed }), metrics);
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.score;
}

test('matched intent produces grounded coverage, matches, no fabricated gaps, and explicit caveats', () => {
  const result = buildExplainableIntentSummary(score());
  assert.equal(result.ok, true, JSON.stringify(result.error));

  const summary = result.summary;
  assert.equal(summary.observableFitScore, 1);
  assert.equal(summary.coverage.scoredAxisCount, 9);
  assert.equal(summary.coverage.normalizedAxisCount, 13);
  assert.equal(summary.closestAxes.length, 3);
  assert.deepEqual(summary.closestAxes.map((entry) => entry.axis), ['fairness', 'tension', 'exploration']);
  assert.deepEqual(summary.largestGaps, []);
  assert.deepEqual(summary.unscoredAxes.map((entry) => entry.axis), [
    'greedPunishment',
    'deception',
    'telegraphStrength',
    'targetDifficulty',
  ]);
  assert.equal(summary.targetDuration.reason, 'SIMULATION_STEPS_ARE_NOT_REALTIME_SECONDS');
  assert.equal(summary.caveats.length, 3);

  const text = renderExplainableIntentSummaryText(summary);
  assert.match(text, /Observable intent fit is 1\.000/);
  assert.match(text, /9\/13 normalized axes/);
  assert.match(text, /No non-zero observable gaps were measured/);
  assert.match(text, /Greed punishment: No observable greedy-choice consequence proxy exists/);
  assert.match(text, /not a judgment of fun, accessibility, or final design quality/);
});

test('opposed intent surfaces the largest observed deltas without inventing quality judgments', () => {
  const result = buildExplainableIntentSummary(score({ opposed: true }));
  assert.equal(result.ok, true, JSON.stringify(result.error));

  const summary = result.summary;
  assert.equal(summary.observableFitScore, 0.240124);
  assert.deepEqual(summary.largestGaps.map((entry) => entry.axis), [
    'fairness',
    'learnability',
    'backtracking',
  ]);
  assert.deepEqual(summary.largestGaps.map((entry) => entry.absoluteDelta), [1, 1, 1]);
  assert.deepEqual(summary.largestGaps.map((entry) => entry.direction), [
    'above-target',
    'above-target',
    'below-target',
  ]);

  const text = renderExplainableIntentSummaryText(summary);
  assert.match(text, /Fairness is 1\.000 above target/);
  assert.match(text, /Learnability is 1\.000 above target/);
  assert.match(text, /Backtracking is 1\.000 below target/);
});

test('summary construction fails closed on malformed or internally inconsistent DAI-063 scores', () => {
  const validScore = score();

  const malformed = buildExplainableIntentSummary({ ...validScore, observableFitScore: 2 });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error.code, 'EXPLAINABLE_SUMMARY_INVALID_SCORE');

  const inconsistent = buildExplainableIntentSummary({
    ...validScore,
    coverage: { ...validScore.coverage, scoredAxisCount: 8 },
  });
  assert.equal(inconsistent.ok, false);
  assert.equal(inconsistent.error.code, 'EXPLAINABLE_SUMMARY_INVALID_SCORE');

  const invalidOptions = buildExplainableIntentSummary(validScore, { maxHighlights: 0 });
  assert.equal(invalidOptions.ok, false);
  assert.equal(invalidOptions.error.code, 'EXPLAINABLE_SUMMARY_INVALID_OPTIONS');
});

test('explainable summary is deterministic and does not mutate the DAI-063 score', () => {
  const intentFitScore = score({ opposed: true });
  const before = JSON.stringify(intentFitScore);

  const first = buildExplainableIntentSummary(intentFitScore);
  const second = buildExplainableIntentSummary(intentFitScore);

  assert.equal(first.ok, true);
  assert.deepEqual(second, first);
  assert.equal(renderExplainableIntentSummaryText(second.summary), renderExplainableIntentSummaryText(first.summary));
  assert.equal(JSON.stringify(intentFitScore), before);
});
