import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSimulationObservation,
  simulateDungeon,
} from '../src/simulator.js';
import { startPlaySession } from '../../play-core/src/play-session.js';

function fixture() {
  return {
    schemaVersion: '1.0',
    id: 'simulation-fixture-v1',
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

function fullScriptPolicy() {
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

test('simulation observation exposes deterministic runtime choices without PlaySession references', () => {
  const started = startPlaySession(fixture(), { startedAt: 0 });
  assert.equal(started.ok, true);

  const observation = createSimulationObservation(started.session, { step: 0 });
  assert.equal(observation.currentRoomId, 'room-start');
  assert.deepEqual(observation.adjacentRoomIds, ['room-middle']);
  assert.deepEqual(observation.enemies, []);
  assert.deepEqual(observation.interactables, []);
  assert.deepEqual(observation.availableActions, [
    { type: 'move', roomId: 'room-middle' },
    { type: 'stop' },
  ]);
  assert.deepEqual(observation.playerState, {
    hp: 20,
    maxHp: 20,
    level: 1,
    xp: 0,
    gold: 0,
    equipment: { weapon: null, armor: null },
  });
  assert.equal('snapshot' in observation, false);
});

test('simulation executes real PlaySession actions and produces a cleared result', () => {
  const spec = fixture();
  const before = JSON.stringify(spec);
  const result = simulateDungeon(spec, fullScriptPolicy(), { policyId: 'test-full-script', maxSteps: 32 });

  assert.equal(result.ok, true);
  assert.equal(result.simulation.status, 'cleared');
  assert.equal(result.simulation.failureReason, null);
  assert.equal(result.simulation.terminationReason, 'play-terminal');
  assert.equal(result.simulation.steps, 7);
  assert.deepEqual(result.simulation.result.routeRoomIds, ['room-start', 'room-middle', 'room-goal']);
  assert.equal(result.simulation.result.moves, 2);
  assert.equal(result.simulation.result.metrics.roomsVisited, 3);
  assert.equal(result.simulation.result.metrics.enemiesCleared, 1);
  assert.equal(result.simulation.result.metrics.treasuresOpened, 1);
  assert.equal(result.simulation.result.metrics.trapsTriggered, 0);
  assert.equal(result.simulation.result.metrics.recoveryUsed, 1);
  assert.equal(result.simulation.result.metrics.interactions, 3);
  assert.ok(result.simulation.result.metrics.xpEarned > 0);
  assert.ok(result.simulation.result.metrics.goldEarned > 0);
  assert.equal(result.simulation.result.metrics.lootCollected, 1);
  assert.ok(result.simulation.result.playerState.gold > 0);
  assert.equal(JSON.stringify(spec), before);
});

test('same spec and deterministic policy produce the same simulation trace and result', () => {
  const first = simulateDungeon(fixture(), fullScriptPolicy(), { policyId: 'deterministic', maxSteps: 32 });
  const second = simulateDungeon(fixture(), fullScriptPolicy(), { policyId: 'deterministic', maxSteps: 32 });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.simulation, second.simulation);
});

test('step limit bounds non-terminating policies and returns a stopped PlayResult', () => {
  const policy = (observation) => {
    if (observation.enemies.length) return { type: 'combat-enemy', enemyId: observation.enemies[0].id };
    const trap = observation.interactables.find(({ type }) => type === 'trap');
    if (trap) return { type: 'avoid-trap', trapId: trap.id };
    if (observation.currentRoomId === 'room-start') return { type: 'move', roomId: 'room-middle' };
    return { type: 'move', roomId: 'room-start' };
  };

  const result = simulateDungeon(fixture(), policy, { policyId: 'loop', maxSteps: 5 });
  assert.equal(result.ok, true);
  assert.equal(result.simulation.terminationReason, 'step-limit');
  assert.equal(result.simulation.status, 'failed');
  assert.equal(result.simulation.failureReason, 'stopped');
  assert.equal(result.simulation.steps, 5);
});

test('unsupported policy actions fail closed without mutating the authoring spec', () => {
  const spec = fixture();
  const before = JSON.stringify(spec);
  const result = simulateDungeon(spec, () => ({ type: 'teleport', roomId: 'room-goal' }), {
    policyId: 'invalid-action',
    maxSteps: 4,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'SIM_ACTION_FAILED');
  assert.equal(result.error.details.cause.code, 'SIM_ACTION_UNSUPPORTED');
  assert.equal(JSON.stringify(spec), before);
});

test('policy exceptions are normalized and do not escape the simulator', () => {
  const result = simulateDungeon(fixture(), () => {
    throw new Error('policy exploded');
  }, { policyId: 'throws', maxSteps: 4 });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'SIM_POLICY_ERROR');
  assert.match(result.error.message, /policy exploded/);
});


test('combat-enemy simulation action uses real damage and progression reward', () => {
  const actions = [
    { type: 'move', roomId: 'room-middle' },
    { type: 'combat-enemy', enemyId: 'enemy-1' },
    { type: 'avoid-trap', trapId: 'trap-1' },
    { type: 'move', roomId: 'room-goal' },
  ];
  let index = 0;
  const result = simulateDungeon(
    fixture(),
    () => actions[index++],
    { policyId: 'real-combat', maxSteps: 8 },
  );

  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal(result.simulation.status, 'cleared');
  assert.equal(result.simulation.result.playerState.hp, 16);
  assert.ok(result.simulation.result.playerState.xp > 0);
  assert.ok(result.simulation.result.playerState.gold > 0);
  assert.equal(result.simulation.result.metrics.damageTaken, 4);
  assert.equal(result.simulation.result.metrics.enemiesCleared, 1);
  assert.ok(
    result.simulation.trace.some((entry) => entry.action.type === 'combat-enemy'),
  );
});
