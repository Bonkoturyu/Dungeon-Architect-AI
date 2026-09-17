import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createCautiousAgent,
  createShortestPathAgent,
  createTreasureGreedyAgent,
} from '../src/agents.js';
import { aggregateSimulationMetrics, projectSimulationMetrics } from '../src/metrics.js';
import { simulateDungeon } from '../src/simulator.js';

const fixtureUrl = new URL('../../../spec/simulation/fixtures/agent-contrast-v1.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fileURLToPath(fixtureUrl), 'utf8'));

function run(policy, policyId = policy.policyId) {
  const result = simulateDungeon(fixture, policy, { policyId, maxSteps: 64 });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.simulation;
}

function builtInRuns() {
  return [
    run(createShortestPathAgent(fixture)),
    run(createTreasureGreedyAgent(fixture)),
    run(createCautiousAgent(fixture)),
  ];
}

test('aggregate metrics capture deterministic contrast across the three built-in agents', () => {
  const aggregate = aggregateSimulationMetrics(fixture, builtInRuns());

  assert.equal(aggregate.runCount, 3);
  assert.equal(aggregate.successRate, 1);
  assert.equal(aggregate.failureCount, 0);
  assert.equal(aggregate.failureConcentration, null);
  assert.equal(aggregate.means.steps, 3);
  assert.equal(aggregate.means.moves, 2.666667);
  assert.equal(aggregate.means.detourMoves, 0.666667);
  assert.equal(aggregate.means.hazardRoomEntries, 0.333333);
  assert.equal(aggregate.means.treasureCaptureRate, 0.333333);
  assert.equal(aggregate.routeDiversity.uniqueRouteCount, 3);
  assert.equal(aggregate.routeDiversity.pairCount, 3);
  assert.equal(aggregate.routeDiversity.meanEdgeJaccardDistance, 0.933333);
  assert.equal(aggregate.roomCoverageRate, 1);

  const shortest = aggregate.runs.find((entry) => entry.policyId === 'shortest-path');
  const greedy = aggregate.runs.find((entry) => entry.policyId === 'treasure-greedy');
  const cautious = aggregate.runs.find((entry) => entry.policyId === 'cautious');

  assert.deepEqual(shortest.routeRoomIds, ['room-start', 'room-hazard', 'room-goal']);
  assert.equal(shortest.baselineShortestMoves, 2);
  assert.equal(shortest.detourMoves, 0);
  assert.equal(shortest.routeStretch, 1);
  assert.equal(shortest.hazardRoomEntries, 1);

  assert.equal(greedy.treasuresOpened, 1);
  assert.equal(greedy.treasureCaptureRate, 1);
  assert.equal(greedy.detourMoves, 1);
  assert.equal(greedy.routeStretch, 1.5);

  assert.equal(cautious.hazardRoomEntries, 0);
  assert.equal(cautious.detourMoves, 1);
  assert.equal(cautious.routeStretch, 1.5);
});

test('failure concentration is derived from actual failed simulation runs', () => {
  const stopImmediately = () => ({ type: 'stop' });
  const stopped = run(stopImmediately, 'stop-immediately');
  const aggregate = aggregateSimulationMetrics(fixture, [...builtInRuns(), stopped]);

  assert.equal(aggregate.runCount, 4);
  assert.equal(aggregate.successCount, 3);
  assert.equal(aggregate.failureCount, 1);
  assert.equal(aggregate.successRate, 0.75);
  assert.equal(aggregate.failureRate, 0.25);
  assert.deepEqual(aggregate.failureReasonCounts, { stopped: 1 });
  assert.equal(aggregate.failureConcentration, 1);
});

test('per-run metrics detect revisit/backtracking and structural detour', () => {
  const scriptedRooms = ['room-safe-1', 'room-start', 'room-hazard', 'room-goal'];
  let cursor = 0;
  const revisitPolicy = () => ({ type: 'move', roomId: scriptedRooms[cursor++] });
  const simulation = run(revisitPolicy, 'revisit-probe');
  const metrics = projectSimulationMetrics(fixture, simulation);

  assert.equal(metrics.status, 'cleared');
  assert.equal(metrics.moves, 4);
  assert.equal(metrics.baselineShortestMoves, 2);
  assert.equal(metrics.detourMoves, 2);
  assert.equal(metrics.routeStretch, 2);
  assert.equal(metrics.backtrackMoves, 1);
  assert.equal(metrics.revisitRate, 0.25);
  assert.equal(metrics.hazardRoomEntries, 1);
});

test('metrics aggregation does not mutate authoring Spec or simulation objects', () => {
  const simulations = builtInRuns();
  const beforeSpec = JSON.stringify(fixture);
  const beforeRuns = JSON.stringify(simulations);

  const first = aggregateSimulationMetrics(fixture, simulations);
  const second = aggregateSimulationMetrics(fixture, simulations);

  assert.deepEqual(second, first);
  assert.equal(JSON.stringify(fixture), beforeSpec);
  assert.equal(JSON.stringify(simulations), beforeRuns);
});
