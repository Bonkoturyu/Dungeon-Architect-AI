import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import {
  createCautiousAgent,
  createShortestPathAgent,
  createTreasureGreedyAgent,
} from '../packages/simulation-core/src/agents.js';
import {
  deriveObservableIntentProfile,
  scoreIntentFit,
} from '../packages/simulation-core/src/intent-fit.js';
import { aggregateSimulationMetrics } from '../packages/simulation-core/src/metrics.js';
import { simulateDungeon } from '../packages/simulation-core/src/simulator.js';

const fixturePath = fileURLToPath(new URL('../spec/simulation/fixtures/agent-contrast-v1.json', import.meta.url));
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const sourceBefore = JSON.stringify(fixture);

function mustRun(policy) {
  const result = simulateDungeon(fixture, policy, { policyId: policy.policyId, maxSteps: 64 });
  if (!result.ok) throw new Error(`Simulation failed for ${policy.policyId}: ${JSON.stringify(result.error)}`);
  return result.simulation;
}

function makeAggregate() {
  return aggregateSimulationMetrics(fixture, [
    mustRun(createShortestPathAgent(fixture)),
    mustRun(createTreasureGreedyAgent(fixture)),
    mustRun(createCautiousAgent(fixture)),
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

const aggregate = makeAggregate();
const profile = deriveObservableIntentProfile(fixture, aggregate);
const matched = scoreIntentFit(fixture, matchedIntent(profile), aggregate);
const opposed = scoreIntentFit(fixture, opposedIntent(profile), aggregate);
const repeat = scoreIntentFit(fixture, matchedIntent(profile), makeAggregate());
const invalid = scoreIntentFit(fixture, { ...DEFAULT_DESIGN_INTENT, routeChoice: 2 }, aggregate);

if (!matched.ok) throw new Error(`Matched scoring failed: ${JSON.stringify(matched.error)}`);
if (!opposed.ok) throw new Error(`Opposed scoring failed: ${JSON.stringify(opposed.error)}`);
if (!repeat.ok) throw new Error(`Repeated scoring failed: ${JSON.stringify(repeat.error)}`);

const expectedProfile = {
  fairness: 1,
  tension: 0.125,
  exploration: 0.611111,
  routeChoice: 0.933333,
  learnability: 1,
  combatDensity: 0.166667,
  trapDensity: 0.166667,
  rewardDensity: 0.166667,
  backtracking: 0,
};

const checks = {
  aggregateAllClear: aggregate.successRate === 1,
  observableProfileExpected: JSON.stringify(profile) === JSON.stringify(expectedProfile),
  matchedObservableFitIsOne: matched.score.observableFitScore === 1,
  coverageExplicit:
    matched.score.coverage.scoredAxisCount === 9 &&
    matched.score.coverage.normalizedAxisCount === 13 &&
    matched.score.coverage.axisFraction === 0.692308 &&
    matched.score.coverage.coreScoredCount === 5 &&
    matched.score.coverage.coreAxisCount === 6 &&
    matched.score.coverage.supportingScoredCount === 4 &&
    matched.score.coverage.supportingAxisCount === 7,
  opposedScoresLower:
    opposed.score.observableFitScore < 0.4 &&
    opposed.score.observableFitScore < matched.score.observableFitScore,
  unscoredAxesExplicit:
    matched.score.axes.greedPunishment.reason === 'NO_GREED_OUTCOME_PROXY' &&
    matched.score.axes.deception.reason === 'NO_DECEPTION_PROXY' &&
    matched.score.axes.telegraphStrength.reason === 'NO_TELEGRAPH_PROXY' &&
    matched.score.axes.targetDifficulty.reason === 'NO_DIFFICULTY_PROXY',
  targetDurationNotFabricated:
    matched.score.coverage.targetDurationScored === false &&
    matched.score.targetDuration.reason === 'SIMULATION_STEPS_ARE_NOT_REALTIME_SECONDS',
  invalidIntentRejected: invalid.ok === false && invalid.error?.code === 'INTENT_FIT_INVALID_INTENT',
  deterministicRepeat: JSON.stringify(repeat.score) === JSON.stringify(matched.score),
  sourceSpecUnchanged: JSON.stringify(fixture) === sourceBefore,
};

const passed = Object.values(checks).every(Boolean);
const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  fixtureId: fixture.id,
  passed,
  checks,
  observableProfile: profile,
  matched: matched.score,
  opposed: opposed.score,
  invalidIntentError: invalid.error ?? null,
};

const outputDir = path.resolve('artifacts/intent-fit');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'dai-063-intent-fit.json');
evidence.outputPath = outputPath;
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);

console.log(JSON.stringify(evidence, null, 2));
if (!passed) throw new Error(`DAI-063 invariant failed: ${JSON.stringify(checks)}`);
