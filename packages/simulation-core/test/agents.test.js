import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { simulateDungeon } from '../src/simulator.js';
import {
  BUILTIN_AGENT_IDS,
  createCautiousAgent,
  createShortestPathAgent,
  createTreasureGreedyAgent,
} from '../src/agents.js';

const fixturePath = path.resolve('spec/simulation/fixtures/agent-contrast-v1.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function run(agent) {
  const result = simulateDungeon(fixture, agent, { policyId: agent.policyId, maxSteps: 32 });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.simulation;
}

test('built-in agent IDs are fixed', () => {
  assert.deepEqual(BUILTIN_AGENT_IDS, ['shortest-path', 'treasure-greedy', 'cautious']);
});

test('shortest-path agent takes the minimum-hop hazardous route', () => {
  const simulation = run(createShortestPathAgent(fixture));
  assert.equal(simulation.status, 'cleared');
  assert.deepEqual(simulation.result.routeRoomIds, ['room-start', 'room-hazard', 'room-goal']);
  assert.equal(simulation.result.moves, 2);
  assert.equal(simulation.result.metrics.treasuresOpened, 0);
});

test('treasure-greedy agent detours to unresolved treasure before Goal', () => {
  const simulation = run(createTreasureGreedyAgent(fixture));
  assert.equal(simulation.status, 'cleared');
  assert.deepEqual(simulation.result.routeRoomIds, ['room-start', 'room-treasure', 'room-safe-2', 'room-goal']);
  assert.equal(simulation.result.moves, 3);
  assert.equal(simulation.result.metrics.treasuresOpened, 1);
  assert.ok(simulation.trace.some((entry) => entry.action.type === 'open-treasure' && entry.action.treasureId === 'treasure-side'));
});

test('cautious agent chooses the lower-hazard route even when it is longer', () => {
  const simulation = run(createCautiousAgent(fixture));
  assert.equal(simulation.status, 'cleared');
  assert.deepEqual(simulation.result.routeRoomIds, ['room-start', 'room-safe-1', 'room-safe-2', 'room-goal']);
  assert.equal(simulation.result.moves, 3);
  assert.equal(simulation.result.routeRoomIds.includes('room-hazard'), false);
  assert.equal(simulation.result.metrics.trapsTriggered, 0);
  assert.equal(simulation.result.metrics.enemiesCleared, 0);
});

test('all built-in agents are deterministic across repeated simulations', () => {
  const factories = [createShortestPathAgent, createTreasureGreedyAgent, createCautiousAgent];
  for (const factory of factories) {
    const first = run(factory(fixture));
    const second = run(factory(fixture));
    assert.deepEqual(second, first, factory.name);
  }
});
