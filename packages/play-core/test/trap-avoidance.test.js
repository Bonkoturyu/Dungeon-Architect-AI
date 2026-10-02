import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeonSpecV3 } from '../../generator/src/dungeon-generator.js';
import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { TRAP_RULES_V1 } from '../../core/src/trap-rules.js';
import { deterministicTrapAvoidance, getTrapAvoidanceChance, avoidTrap, triggerTrap } from '../src/interaction-runtime.js';
import { startPlaySession, movePlaySession, completePlayGoal } from '../src/play-session.js';
import { createFullDungeonExport, importDungeonJson } from '../../export-core/src/layout-exchange.js';
import { createSimulationObservation, simulateDungeon } from '../../simulation-core/src/simulator.js';
import { createShortestPathAgent } from '../../simulation-core/src/agents.js';

function fixture(seed = 2, rules = TRAP_RULES_V1) {
  const spec = generateDungeonSpecV3({ seed, roomCount: 3, routeChoice: 0, enemyCount: 0, treasureCount: 0, trapCount: 0 });
  if (rules !== undefined) spec.trapRules = structuredClone(rules);
  spec.entities.push({ id: 'trap-test', type: 'trap', roomId: 'room-002', damage: 6 });
  return spec;
}
const entered = (spec) => movePlaySession(startPlaySession(spec).session, 'room-002').session;

test('versioned 70% fixed vectors depend on floor seed and entity ID, not clocks, order, or room', () => {
  for (const [seed, outcome, roll] of [[0, 'avoided', 0.12335764244198799], [2, 'triggered', 0.7924126419238746]]) {
    const spec = fixture(seed);
    const session = entered(spec);
    const actual = deterministicTrapAvoidance(session, 'trap-test');
    assert.deepEqual(actual, { version: TRAP_RULES_V1.version, successChance: 0.7, roll, outcome });
    assert.deepEqual(deterministicTrapAvoidance({ ...session, startedAt: 999, moves: 111, currentRoomId: 'elsewhere' }, 'trap-test'), actual);
    const exported = createFullDungeonExport([spec]);
    const restored = importDungeonJson(JSON.stringify(exported));
    assert.equal(restored.ok, true);
    assert.deepEqual(deterministicTrapAvoidance(entered(restored.dungeons[0]), 'trap-test'), actual);
    assert.notEqual(deterministicTrapAvoidance(session, 'another-trap').roll, roll);
  }
});

test('success is harmless, failure damages once, and neither action grants a reward or changes authoring', () => {
  for (const [seed, outcome, hp] of [[0, 'avoided', 20], [2, 'triggered', 14]]) {
    const spec = fixture(seed), original = structuredClone(spec), session = entered(spec);
    assert.equal(movePlaySession(session, 'room-003').error.code, 'SPECIAL_ROOM_BLOCKED');
    const result = avoidTrap(session, 'trap-test', { at: 100 });
    assert.equal(result.ok, true);
    assert.equal(result.avoidance.outcome, outcome);
    assert.equal(result.session.gameplayState.entityStates['trap-test'].status, outcome);
    assert.equal(result.session.playerState.hp, hp);
    assert.equal(result.session.playerState.gold, 0);
    assert.equal(result.session.playerState.xp, 0);
    assert.equal(result.session.gameplayState.counters.trapsTriggered, outcome === 'triggered' ? 1 : 0);
    assert.equal(result.session.gameplayState.counters.interactions, 1);
    for (const action of [avoidTrap, triggerTrap]) assert.equal(action(result.session, 'trap-test').error.code, 'TRAP_ALREADY_RESOLVED');
    assert.equal(movePlaySession(result.session, 'room-003').session.status, 'cleared');
    assert.deepEqual(spec, original);
    assert.equal(session.playerState.hp, 20);
    assert.deepEqual(avoidTrap(entered(spec), 'trap-test', { at: 888 }).avoidance, result.avoidance);
  }
});

test('trap avoidance results are stable when traps are processed in either order', () => {
  const spec = fixture(2);
  spec.entities.push({ id: 'second-trap', type: 'trap', roomId: 'room-002', damage: 2 });
  const resolve = (ids) => ids.reduce((session, id) => avoidTrap(session, id).session, entered(spec));
  const a = resolve(['trap-test', 'second-trap']), b = resolve(['second-trap', 'trap-test']);
  assert.deepEqual(a.playerState, b.playerState);
  for (const id of ['trap-test', 'second-trap']) assert.deepEqual(a.gameplayState.entityStates[id], b.gameplayState.entityStates[id]);
});

test('failed avoidance applies armor and can end a run without leaving an armed/retryable trap', () => {
  const spec = fixture(2);
  spec.equipmentRules = { weaponEnemyReductionPerTier: 1, armorDamageReductionPerTier: 1, minimumPositiveDamage: 1 };
  const session = entered(spec);
  session.playerState.equipment.armor = { id: 'armor', slot: 'armor', tier: 2 };
  session.playerState.equipment.weapon = { id: 'weapon', slot: 'weapon', tier: 99 };
  assert.equal(avoidTrap(session, 'trap-test').session.playerState.hp, 16);
  session.playerState.hp = 1;
  const failed = avoidTrap(session, 'trap-test').session;
  assert.equal(failed.status, 'failed');
  assert.equal(failed.playerState.hp, 0);
  assert.equal(failed.gameplayState.entityStates['trap-test'].status, 'triggered');
  assert.equal(avoidTrap(failed, 'trap-test').error.code, 'SESSION_NOT_PLAYING');
});

test('legacy schema without trapRules retains guaranteed avoidance; invalid rules fail closed', () => {
  const spec = fixture(2); delete spec.trapRules;
  assert.equal(validateDungeonSpec(spec).valid, true);
  assert.equal(getTrapAvoidanceChance(entered(spec)), 1);
  assert.equal(avoidTrap(entered(spec), 'trap-test').session.playerState.hp, 20);
  for (const rules of [null, {}, { version: 'unknown' }, { version: TRAP_RULES_V1.version, successChance: 1 }]) {
    assert.ok(validateDungeonSpec({ ...spec, trapRules: rules }).errors.some(({ code }) => code === 'TRAP_RULES_UNSUPPORTED'));
    assert.equal(startPlaySession({ ...spec, trapRules: rules }).ok, false);
  }
});

test('normal Goal with armed hazards cannot auto-clear under the new rule', () => {
  const spec = fixture(2);
  spec.entities.find(({ id }) => id === 'trap-test').roomId = 'room-003';
  let session = movePlaySession(entered(spec), 'room-003').session;
  assert.equal(session.status, 'playing');
  assert.equal(completePlayGoal(session).error.code, 'SPECIAL_ROOM_BLOCKED');
  session = avoidTrap(session, 'trap-test').session;
  assert.equal(completePlayGoal(session).session.status, 'cleared');
});

test('simulation shows one trap resolution option and matches real Play success/failure damage', () => {
  for (const seed of [0, 2]) {
    const spec = fixture(seed), session = entered(spec);
    const observation = createSimulationObservation(session);
    assert.equal(observation.interactables[0].avoidanceChance, 0.7);
    assert.equal(observation.interactables[0].failureDamage, 6);
    assert.ok(!observation.availableActions.some(({ type }) => ['trigger-trap', 'move'].includes(type)));
    const simulation = simulateDungeon(spec, createShortestPathAgent(spec));
    assert.equal(simulation.ok, true);
    assert.equal(simulation.simulation.status, 'cleared');
    assert.equal(simulation.simulation.result.playerState.hp, avoidTrap(session, 'trap-test').session.playerState.hp);
  }
});

test('fixed roll sample has both results and no shared mutable RNG state', () => {
  let successes = 0;
  for (let seed = 0; seed < 1000; seed++) successes += deterministicTrapAvoidance({ snapshot: { seed, trapRules: TRAP_RULES_V1 } }, 'trap-test').outcome === 'avoided';
  assert.ok(successes >= 650 && successes <= 750, String(successes));
});
