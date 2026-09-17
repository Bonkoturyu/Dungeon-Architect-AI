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
  buildExplainableIntentSummary,
  renderExplainableIntentSummaryText,
} from '../packages/simulation-core/src/explainable-summary.js';
import {
  deriveObservableIntentProfile,
  scoreIntentFit,
} from '../packages/simulation-core/src/intent-fit.js';
import { aggregateSimulationMetrics } from '../packages/simulation-core/src/metrics.js';
import { simulateDungeon } from '../packages/simulation-core/src/simulator.js';

const fixturePath = fileURLToPath(new URL('../spec/simulation/fixtures/agent-contrast-v1.json', import.meta.url));
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

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

function makeIntent(profile, opposed = false) {
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

const aggregate = makeAggregate();
const profile = deriveObservableIntentProfile(fixture, aggregate);
const matchedFit = scoreIntentFit(fixture, makeIntent(profile), aggregate);
const opposedFit = scoreIntentFit(fixture, makeIntent(profile, true), aggregate);
if (!matchedFit.ok) throw new Error(`Matched DAI-063 scoring failed: ${JSON.stringify(matchedFit.error)}`);
if (!opposedFit.ok) throw new Error(`Opposed DAI-063 scoring failed: ${JSON.stringify(opposedFit.error)}`);

const matchedBefore = JSON.stringify(matchedFit.score);
const opposedBefore = JSON.stringify(opposedFit.score);
const matched = buildExplainableIntentSummary(matchedFit.score);
const opposed = buildExplainableIntentSummary(opposedFit.score);
const repeat = buildExplainableIntentSummary(JSON.parse(JSON.stringify(opposedFit.score)));
const invalid = buildExplainableIntentSummary({ ...matchedFit.score, observableFitScore: 2 });
if (!matched.ok) throw new Error(`Matched summary failed: ${JSON.stringify(matched.error)}`);
if (!opposed.ok) throw new Error(`Opposed summary failed: ${JSON.stringify(opposed.error)}`);
if (!repeat.ok) throw new Error(`Repeated summary failed: ${JSON.stringify(repeat.error)}`);

const matchedText = renderExplainableIntentSummaryText(matched.summary);
const opposedText = renderExplainableIntentSummaryText(opposed.summary);
const expectedLargestGaps = ['fairness', 'learnability', 'backtracking'];

const checks = {
  matchedSummaryBuilt: matched.ok === true,
  matchedScorePreserved: matched.summary.observableFitScore === 1,
  coveragePreserved:
    matched.summary.coverage.scoredAxisCount === 9 &&
    matched.summary.coverage.normalizedAxisCount === 13 &&
    matched.summary.coverage.coreScoredCount === 5 &&
    matched.summary.coverage.coreAxisCount === 6 &&
    matched.summary.coverage.supportingScoredCount === 4 &&
    matched.summary.coverage.supportingAxisCount === 7,
  matchedHasNoNonzeroGaps: matched.summary.largestGaps.length === 0,
  unscoredAxesExplicit:
    JSON.stringify(matched.summary.unscoredAxes.map((entry) => entry.axis)) ===
    JSON.stringify(['greedPunishment', 'deception', 'telegraphStrength', 'targetDifficulty']),
  targetDurationExplicitlyUnscored:
    matched.summary.targetDuration.status === 'unscored' &&
    matched.summary.targetDuration.reason === 'SIMULATION_STEPS_ARE_NOT_REALTIME_SECONDS',
  opposedScorePreserved: opposed.summary.observableFitScore === 0.240124,
  opposedLargestGapsExpected:
    JSON.stringify(opposed.summary.largestGaps.map((entry) => entry.axis)) === JSON.stringify(expectedLargestGaps) &&
    opposed.summary.largestGaps.every((entry) => entry.absoluteDelta === 1),
  opposedDirectionsExpected:
    JSON.stringify(opposed.summary.largestGaps.map((entry) => entry.direction)) ===
    JSON.stringify(['above-target', 'above-target', 'below-target']),
  evidenceBasisPreserved: matched.summary.scoredAxes.every((entry) =>
    typeof entry.basis === 'string' && entry.basis.length > 0 && ['low', 'medium', 'high'].includes(entry.confidence)),
  boundaryTextPresent:
    matchedText.includes('not a judgment of fun, accessibility, or final design quality') &&
    matchedText.includes('9/13 normalized axes') &&
    opposedText.includes('Largest observable gaps:'),
  invalidScoreRejected: invalid.ok === false && invalid.error?.code === 'EXPLAINABLE_SUMMARY_INVALID_SCORE',
  deterministicRepeat:
    JSON.stringify(repeat.summary) === JSON.stringify(opposed.summary) &&
    renderExplainableIntentSummaryText(repeat.summary) === opposedText,
  inputScoresUnchanged:
    JSON.stringify(matchedFit.score) === matchedBefore && JSON.stringify(opposedFit.score) === opposedBefore,
};

const passed = Object.values(checks).every(Boolean);
const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  fixtureId: fixture.id,
  passed,
  checks,
  matchedSummary: matched.summary,
  matchedText,
  opposedSummary: opposed.summary,
  opposedText,
  invalidScoreError: invalid.error ?? null,
};

const outputDir = path.resolve('artifacts/explainable-summary');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'dai-064-explainable-summary.json');
evidence.outputPath = outputPath;
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);

console.log(JSON.stringify(evidence, null, 2));
if (!passed) throw new Error(`DAI-064 invariant failed: ${JSON.stringify(checks)}`);
