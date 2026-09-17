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
import { aggregateSimulationMetrics } from '../src/metrics.js';
import {
  deriveObservableIntentProfile,
  scoreIntentFit,
} from '../src/intent-fit.js';
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

function matchedIntent(profile) {
  return {
    ...DEFAULT_DESIGN_INTENT,
    fairness: profile.fairness,
    tension: profile.tension,
    exploration: profile.exploration,
    routeChoice: profile.routeChoice,
    learnability: profile.learnability,
    combatDensity: profile.combatDensity,
    trapDensity: profile.trapDensity,
    rewardDensity: profile.rewardDensity,
    backtracking: profile.backtracking,
  };
}

function opposedIntent(profile) {
  return {
    ...DEFAULT_DESIGN_INTENT,
    fairness: 1 - profile.fairness,
    tension: 1 - profile.tension,
    exploration: 1 - profile.exploration,
    routeChoice: 1 - profile.routeChoice,
    learnability: 1 - profile.learnability,
    combatDensity: 1 - profile.combatDensity,
    trapDensity: 1 - profile.trapDensity,
    rewardDensity: 1 - profile.rewardDensity,
    backtracking: 1 - profile.backtracking,
  };
}

test('observable profile is deterministic and grounded in DAI-062 metrics', () => {
  const metrics = aggregate();
  const profile = deriveObservableIntentProfile(fixture, metrics);

  assert.deepEqual(profile, {
    fairness: 1,
    tension: 0.125,
    exploration: 0.611111,
    routeChoice: 0.933333,
    learnability: 1,
    combatDensity: 0.166667,
    trapDensity: 0.166667,
    rewardDensity: 0.166667,
    backtracking: 0,
  });
});

test('exactly matched observable axes produce fit score 1 with explicit partial coverage', () => {
  const metrics = aggregate();
  const profile = deriveObservableIntentProfile(fixture, metrics);
  const result = scoreIntentFit(fixture, matchedIntent(profile), metrics);

  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal(result.score.observableFitScore, 1);
  assert.equal(result.score.coverage.scoredAxisCount, 9);
  assert.equal(result.score.coverage.normalizedAxisCount, 13);
  assert.equal(result.score.coverage.axisFraction, 0.692308);
  assert.equal(result.score.coverage.coreScoredCount, 5);
  assert.equal(result.score.coverage.coreAxisCount, 6);
  assert.equal(result.score.coverage.supportingScoredCount, 4);
  assert.equal(result.score.coverage.supportingAxisCount, 7);
  assert.equal(result.score.coverage.targetDurationScored, false);
  assert.equal(result.score.axes.greedPunishment.status, 'unscored');
  assert.equal(result.score.axes.deception.status, 'unscored');
  assert.equal(result.score.axes.telegraphStrength.status, 'unscored');
  assert.equal(result.score.axes.targetDifficulty.status, 'unscored');
  assert.equal(result.score.targetDuration.status, 'unscored');
});

test('opposed observable intent scores materially lower than matched intent', () => {
  const metrics = aggregate();
  const profile = deriveObservableIntentProfile(fixture, metrics);
  const matched = scoreIntentFit(fixture, matchedIntent(profile), metrics);
  const opposed = scoreIntentFit(fixture, opposedIntent(profile), metrics);

  assert.equal(matched.ok, true);
  assert.equal(opposed.ok, true);
  assert.equal(matched.score.observableFitScore, 1);
  assert.ok(opposed.score.observableFitScore < 0.4, `opposed score: ${opposed.score.observableFitScore}`);
  assert.ok(opposed.score.observableFitScore < matched.score.observableFitScore);
});

test('invalid DesignIntent fails closed before scoring', () => {
  const metrics = aggregate();
  const invalid = { ...DEFAULT_DESIGN_INTENT, routeChoice: 2 };
  const result = scoreIntentFit(fixture, invalid, metrics);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INTENT_FIT_INVALID_INTENT');
});

test('intent-fit scoring is deterministic and does not mutate inputs', () => {
  const metrics = aggregate();
  const profile = deriveObservableIntentProfile(fixture, metrics);
  const intent = matchedIntent(profile);
  const beforeSpec = JSON.stringify(fixture);
  const beforeMetrics = JSON.stringify(metrics);
  const beforeIntent = JSON.stringify(intent);

  const first = scoreIntentFit(fixture, intent, metrics);
  const second = scoreIntentFit(fixture, intent, metrics);

  assert.deepEqual(second, first);
  assert.equal(JSON.stringify(fixture), beforeSpec);
  assert.equal(JSON.stringify(metrics), beforeMetrics);
  assert.equal(JSON.stringify(intent), beforeIntent);
});
