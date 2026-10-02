import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeonSpec } from '../../generator/src/dungeon-generator.js';
import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { createFullDungeonExport, importDungeonJson } from '../../export-core/src/layout-exchange.js';
import { startPlaySession, movePlaySession, getGoalCompletionState, completePlayGoal } from '../src/play-session.js';
import { getEnemyState, listRoomEnemies, resolveEnemyCombat } from '../src/enemy-runtime.js';
import { openTreasure, avoidTrap } from '../src/interaction-runtime.js';
import { createSimulationObservation, simulateDungeon } from '../../simulation-core/src/simulator.js';
import { createShortestPathAgent } from '../../simulation-core/src/agents.js';

function fixture(activation = 'none') {
  const spec = generateDungeonSpec({ seed: 0, roomCount: 3, routeChoice: 0 });
  spec.entities.push({ id: 'sleeping-enemy', type: 'enemy', roomId: 'room-003', initiallyActive: false });
  if (activation === 'treasure') spec.entities.push({ id: 'wake-chest', type: 'treasure', roomId: 'room-003' });
  if (activation !== 'none') spec.events.push({
    id: 'wake-enemy',
    trigger: activation === 'treasure' ? { type: 'on_open_treasure', entityId: 'wake-chest' } : { type: 'on_enter_room', roomId: 'room-003' },
    conditions: activation === 'false-flag' ? [{ type: 'flag', key: 'never-set', value: true }] : [{ type: 'one_shot' }],
    actions: [{ type: 'spawn_enemy_group', enemyIds: ['sleeping-enemy'] }],
  });
  return spec;
}

function enterGoal(spec) {
  const result = startPlaySession(spec);
  assert.equal(result.ok, true);
  let session = result.session;
  for (const id of ['room-002', 'room-003']) {
    const moved = movePlaySession(session, id);
    assert.equal(moved.ok, true);
    session = moved.session;
  }
  assert.equal(session.status, 'playing'); // 休眠敵のGoalも明示完了を維持する。
  return session;
}

for (const activation of ['none', 'false-flag']) test(`dormant Goal enemy with ${activation} activation permits explicit completion and simulation`, () => {
  const source = fixture(activation), before = structuredClone(source);
  assert.equal(validateDungeonSpec(source).valid, true);
  const imported = importDungeonJson(createFullDungeonExport([source]));
  assert.equal(imported.ok, true);
  for (const spec of [source, imported.dungeons[0]]) {
    const session = enterGoal(spec);
    assert.equal(getEnemyState(session, 'sleeping-enemy').state.status, 'dormant');
    assert.equal(listRoomEnemies(session).length, 0);
    assert.equal(resolveEnemyCombat(session, 'sleeping-enemy').error.code, 'ENEMY_NOT_ACTIVE');
    assert.deepEqual(getGoalCompletionState(session), { available: true, blocked: false });
    assert.ok(createSimulationObservation(session).availableActions.some(({ type }) => type === 'complete-goal'));
    assert.equal(completePlayGoal(session).session.status, 'cleared');
    const simulation = simulateDungeon(spec, createShortestPathAgent(spec));
    assert.equal(simulation.ok, true);
    assert.equal(simulation.simulation.result.status, 'cleared');
  }
  assert.deepEqual(source, before);
});

test('room-entry activation runs before the Goal blocker check', () => {
  const spec = fixture('entry');
  const session = enterGoal(spec);
  assert.equal(getEnemyState(session, 'sleeping-enemy').state.status, 'active');
  assert.equal(getGoalCompletionState(session).blocked, true);
  assert.equal(completePlayGoal(session).error.code, 'SPECIAL_ROOM_BLOCKED');
  assert.ok(!createSimulationObservation(session).availableActions.some(({ type }) => type === 'complete-goal'));
  const defeated = resolveEnemyCombat(session, 'sleeping-enemy').session;
  assert.equal(completePlayGoal(defeated).session.status, 'cleared');
  assert.equal(simulateDungeon(spec, createShortestPathAgent(spec)).simulation.result.status, 'cleared');
});

test('optional treasure activation re-blocks the Goal until the newly active enemy is defeated', () => {
  const spec = fixture('treasure');
  const dormant = enterGoal(spec);
  assert.equal(getGoalCompletionState(dormant).blocked, false);
  const opened = openTreasure(dormant, 'wake-chest');
  assert.equal(opened.ok, true);
  assert.equal(getEnemyState(opened.session, 'sleeping-enemy').state.status, 'active');
  assert.equal(getGoalCompletionState(opened.session).blocked, true);
  assert.equal(completePlayGoal(opened.session).error.code, 'SPECIAL_ROOM_BLOCKED');
  assert.equal(completePlayGoal(resolveEnemyCombat(opened.session, 'sleeping-enemy').session).session.status, 'cleared');
  const simulated = simulateDungeon(spec, (observation) => {
    const actions = observation.availableActions;
    return actions.find(({ type }) => type === 'open-treasure')
      ?? actions.find(({ type }) => type === 'combat-enemy')
      ?? actions.find(({ type }) => type === 'complete-goal')
      ?? { type: 'move', roomId: observation.currentRoomId === 'room-001' ? 'room-002' : 'room-003' };
  });
  assert.equal(simulated.simulation.result.status, 'cleared');
  assert.deepEqual(simulated.simulation.trace.map(({ action }) => action.type), ['move', 'move', 'open-treasure', 'combat-enemy', 'complete-goal']);
});

test('only active enemies block a Goal containing both active and dormant enemies', () => {
  const spec = fixture();
  spec.entities.push({ id: 'awake-enemy', type: 'enemy', roomId: 'room-003' });
  const session = enterGoal(spec);
  assert.equal(listRoomEnemies(session).length, 1);
  assert.equal(getGoalCompletionState(session).blocked, true);
  const defeated = resolveEnemyCombat(session, 'awake-enemy').session;
  assert.equal(getEnemyState(defeated, 'sleeping-enemy').state.status, 'dormant');
  assert.equal(getGoalCompletionState(defeated).blocked, false);
  assert.equal(completePlayGoal(defeated).session.status, 'cleared');
});

test('armed traps remain Goal blockers alongside dormant enemies', () => {
  const spec = fixture();
  spec.entities.push({ id: 'trap-test', type: 'trap', roomId: 'room-003' });
  const session = enterGoal(spec);
  assert.equal(getGoalCompletionState(session).blocked, true);
  assert.equal(completePlayGoal(session).error.code, 'SPECIAL_ROOM_BLOCKED');
  assert.equal(completePlayGoal(avoidTrap(session, 'trap-test').session).session.status, 'cleared');
});
