import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCautiousAgent,
  createShortestPathAgent,
  createTreasureGreedyAgent,
} from '../packages/simulation-core/src/agents.js';
import { aggregateSimulationMetrics } from '../packages/simulation-core/src/metrics.js';
import { simulateDungeon } from '../packages/simulation-core/src/simulator.js';

const fixturePath = fileURLToPath(new URL('../spec/simulation/fixtures/agent-contrast-v1.json', import.meta.url));
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const sourceBefore = JSON.stringify(fixture);

function mustRun(policy, policyId = policy.policyId) {
  const result = simulateDungeon(fixture, policy, { policyId, maxSteps: 64 });
  if (!result.ok) throw new Error(`Simulation failed for ${policyId}: ${JSON.stringify(result.error)}`);
  return result.simulation;
}

function runBuiltIns() {
  return [
    mustRun(createShortestPathAgent(fixture)),
    mustRun(createTreasureGreedyAgent(fixture)),
    mustRun(createCautiousAgent(fixture)),
  ];
}

const builtInRuns = runBuiltIns();
const builtInAggregate = aggregateSimulationMetrics(fixture, builtInRuns);
const repeatedAggregate = aggregateSimulationMetrics(fixture, runBuiltIns());
const stoppedRun = mustRun(() => ({ type: 'stop' }), 'stop-immediately');
const failureProbeAggregate = aggregateSimulationMetrics(fixture, [...builtInRuns, stoppedRun]);

const byPolicy = Object.fromEntries(builtInAggregate.runs.map((run) => [run.policyId, run]));
const checks = {
  builtInsAllClear: builtInAggregate.successRate === 1 && builtInAggregate.failureCount === 0,
  aggregateDeterministic: JSON.stringify(repeatedAggregate) === JSON.stringify(builtInAggregate),
  meanStepsExpected: builtInAggregate.means.steps === 3,
  meanMovesExpected: builtInAggregate.means.moves === 2.666667,
  routeDiversityExpected:
    builtInAggregate.routeDiversity.uniqueRouteCount === 3 &&
    builtInAggregate.routeDiversity.meanEdgeJaccardDistance === 0.933333,
  fullRoomCoverage: builtInAggregate.roomCoverageRate === 1,
  shortestHazardExposure: byPolicy['shortest-path']?.hazardRoomEntries === 1,
  greedyTreasureCapture: byPolicy['treasure-greedy']?.treasureCaptureRate === 1,
  cautiousAvoidsHazard: byPolicy.cautious?.hazardRoomEntries === 0,
  builtInsNoBacktracking: builtInAggregate.runs.every((run) => run.backtrackMoves === 0),
  failureProbeSuccessRate: failureProbeAggregate.successRate === 0.75,
  failureProbeConcentration:
    failureProbeAggregate.failureReasonCounts.stopped === 1 &&
    failureProbeAggregate.failureConcentration === 1,
  sourceSpecUnchanged: JSON.stringify(fixture) === sourceBefore,
};

const passed = Object.values(checks).every(Boolean);
const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  fixtureId: fixture.id,
  passed,
  checks,
  builtInAggregate,
  failureProbe: {
    policyId: stoppedRun.policyId,
    status: stoppedRun.status,
    failureReason: stoppedRun.failureReason,
    aggregate: failureProbeAggregate,
  },
};

const outputDir = path.resolve('artifacts/metrics');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'dai-062-metrics.json');
evidence.outputPath = outputPath;
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);

console.log(JSON.stringify(evidence, null, 2));
if (!passed) throw new Error(`DAI-062 invariant failed: ${JSON.stringify(checks)}`);
