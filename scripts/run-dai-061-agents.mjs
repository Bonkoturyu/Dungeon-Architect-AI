import fs from 'node:fs';
import path from 'node:path';
import { simulateDungeon } from '../packages/simulation-core/src/simulator.js';
import {
  createCautiousAgent,
  createShortestPathAgent,
  createTreasureGreedyAgent,
} from '../packages/simulation-core/src/agents.js';

const fixturePath = path.resolve('spec/simulation/fixtures/agent-contrast-v1.json');
const outputDir = path.resolve('artifacts/agents');
const outputPath = path.join(outputDir, 'dai-061-agents.json');
const spec = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const sourceBefore = JSON.stringify(spec);

function run(factory) {
  const agent = factory(spec);
  const result = simulateDungeon(spec, agent, { policyId: agent.policyId, maxSteps: 32 });
  if (!result.ok) throw new Error(`${agent.policyId} simulation failed: ${JSON.stringify(result.error)}`);
  return result.simulation;
}

function summary(simulation) {
  return {
    policyId: simulation.policyId,
    status: simulation.status,
    steps: simulation.steps,
    terminationReason: simulation.terminationReason,
    routeRoomIds: simulation.result.routeRoomIds,
    metrics: simulation.result.metrics,
    actions: simulation.trace.map((entry) => entry.action),
  };
}

const factories = [createShortestPathAgent, createTreasureGreedyAgent, createCautiousAgent];
const runs = Object.fromEntries(factories.map((factory) => {
  const first = run(factory);
  const second = run(factory);
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error(`${first.policyId} was not deterministic across identical reruns.`);
  }
  return [first.policyId, { first, deterministicRepeat: true }];
}));

const shortest = runs['shortest-path'].first;
const greedy = runs['treasure-greedy'].first;
const cautious = runs.cautious.first;

const checks = {
  allCleared: [shortest, greedy, cautious].every((run) => run.status === 'cleared' && run.terminationReason === 'play-terminal'),
  deterministicRepeat: Object.values(runs).every((entry) => entry.deterministicRepeat === true),
  shortestUsesMinimumHopRoute:
    JSON.stringify(shortest.result.routeRoomIds) === JSON.stringify(['room-start', 'room-hazard', 'room-goal']) &&
    shortest.result.moves === 2,
  greedyCollectsTreasure:
    JSON.stringify(greedy.result.routeRoomIds) === JSON.stringify(['room-start', 'room-treasure', 'room-safe-2', 'room-goal']) &&
    greedy.result.metrics.treasuresOpened === 1,
  cautiousAvoidsHazard:
    JSON.stringify(cautious.result.routeRoomIds) === JSON.stringify(['room-start', 'room-safe-1', 'room-safe-2', 'room-goal']) &&
    !cautious.result.routeRoomIds.includes('room-hazard') &&
    cautious.result.metrics.trapsTriggered === 0 &&
    cautious.result.metrics.enemiesCleared === 0,
  behavioralContrast:
    JSON.stringify(shortest.result.routeRoomIds) !== JSON.stringify(greedy.result.routeRoomIds) &&
    JSON.stringify(shortest.result.routeRoomIds) !== JSON.stringify(cautious.result.routeRoomIds) &&
    JSON.stringify(greedy.result.routeRoomIds) !== JSON.stringify(cautious.result.routeRoomIds),
  sourceSpecUnchanged: JSON.stringify(spec) === sourceBefore,
};

const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  fixtureId: spec.id,
  passed: Object.values(checks).every(Boolean),
  checks,
  agents: {
    shortestPath: summary(shortest),
    treasureGreedy: summary(greedy),
    cautious: summary(cautious),
  },
  outputPath,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
if (!evidence.passed) process.exitCode = 1;
