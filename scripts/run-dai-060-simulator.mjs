import fs from 'node:fs';
import path from 'node:path';
import { simulateDungeon } from '../packages/simulation-core/src/simulator.js';

const outputDir = path.resolve('artifacts/simulator');
fs.mkdirSync(outputDir, { recursive: true });

function fixture() {
  return {
    schemaVersion: '1.0',
    id: 'dai-060-simulator-fixture-v1',
    seed: 6060,
    rooms: [
      { id: 'room-start', x: 0, z: 0, width: 8, depth: 8 },
      { id: 'room-middle', x: 12, z: 0, width: 8, depth: 8 },
      { id: 'room-goal', x: 24, z: 0, width: 8, depth: 8 },
    ],
    corridors: [
      { id: 'corridor-1', fromRoomId: 'room-start', toRoomId: 'room-middle', width: 3 },
      { id: 'corridor-2', fromRoomId: 'room-middle', toRoomId: 'room-goal', width: 3 },
    ],
    entities: [
      { id: 'start-1', type: 'start', roomId: 'room-start' },
      { id: 'enemy-1', type: 'enemy', roomId: 'room-middle' },
      { id: 'treasure-1', type: 'treasure', roomId: 'room-middle', warning: 'greedy choice' },
      { id: 'trap-1', type: 'trap', roomId: 'room-middle', warning: 'floor seam' },
      { id: 'recovery-1', type: 'recovery', roomId: 'room-middle' },
      { id: 'goal-1', type: 'goal', roomId: 'room-goal' },
    ],
    events: [],
  };
}

function scriptedPolicy() {
  const actions = [
    { type: 'move', roomId: 'room-middle' },
    { type: 'encounter-enemy', enemyId: 'enemy-1' },
    { type: 'defeat-enemy', enemyId: 'enemy-1' },
    { type: 'open-treasure', treasureId: 'treasure-1' },
    { type: 'avoid-trap', trapId: 'trap-1' },
    { type: 'use-recovery', recoveryId: 'recovery-1' },
    { type: 'move', roomId: 'room-goal' },
  ];
  let index = 0;
  return () => actions[index++];
}

const source = fixture();
const sourceBefore = JSON.stringify(source);
const cleared = simulateDungeon(source, scriptedPolicy(), { policyId: 'dai-060-scripted', maxSteps: 32 });
const repeated = simulateDungeon(fixture(), scriptedPolicy(), { policyId: 'dai-060-scripted', maxSteps: 32 });
const looped = simulateDungeon(fixture(), (observation) => {
  if (observation.currentRoomId === 'room-start') return { type: 'move', roomId: 'room-middle' };
  return { type: 'move', roomId: 'room-start' };
}, { policyId: 'dai-060-loop', maxSteps: 5 });
const invalid = simulateDungeon(fixture(), () => ({ type: 'teleport', roomId: 'room-goal' }), {
  policyId: 'dai-060-invalid',
  maxSteps: 4,
});

const metrics = cleared.ok ? cleared.simulation.result.metrics : null;
const checks = {
  clearedRun: cleared.ok && cleared.simulation.status === 'cleared' && cleared.simulation.result.moves === 2,
  deterministicRepeat: cleared.ok && repeated.ok && JSON.stringify(cleared.simulation) === JSON.stringify(repeated.simulation),
  interactionCounters: Boolean(metrics) &&
    metrics.enemiesCleared === 1 &&
    metrics.treasuresOpened === 1 &&
    metrics.trapsTriggered === 0 &&
    metrics.recoveryUsed === 1 &&
    metrics.interactions === 3,
  stepLimitBounded: looped.ok &&
    looped.simulation.terminationReason === 'step-limit' &&
    looped.simulation.status === 'failed' &&
    looped.simulation.failureReason === 'stopped' &&
    looped.simulation.steps === 5,
  invalidActionRejected: invalid.ok === false &&
    invalid.error?.code === 'SIM_ACTION_FAILED' &&
    invalid.error?.details?.cause?.code === 'SIM_ACTION_UNSUPPORTED',
  sourceSpecUnchanged: JSON.stringify(source) === sourceBefore,
};

const passed = Object.values(checks).every(Boolean);
const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed,
  checks,
  cleared: cleared.ok ? {
    policyId: cleared.simulation.policyId,
    steps: cleared.simulation.steps,
    terminationReason: cleared.simulation.terminationReason,
    status: cleared.simulation.status,
    routeRoomIds: cleared.simulation.result.routeRoomIds,
    metrics: cleared.simulation.result.metrics,
    trace: cleared.simulation.trace,
  } : { error: cleared.error },
  stepLimit: looped.ok ? {
    steps: looped.simulation.steps,
    terminationReason: looped.simulation.terminationReason,
    status: looped.simulation.status,
    failureReason: looped.simulation.failureReason,
  } : { error: looped.error },
  invalidAction: invalid.ok ? { unexpectedSuccess: true } : { error: invalid.error },
};

const outputPath = path.join(outputDir, 'dai-060-simulator.json');
fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ ...evidence, outputPath }, null, 2));

if (!passed) throw new Error(`DAI-060 simulator validation failed: ${JSON.stringify(checks)}`);
