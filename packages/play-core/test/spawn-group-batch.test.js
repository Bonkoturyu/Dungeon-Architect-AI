import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDungeonSpecV3 } from '../../generator/src/dungeon-generator.js';
import { startPlaySession, applyPlaySessionStateCommand } from '../src/play-session.js';
import { dispatchSupportedEvents } from '../src/event-runtime.js';

function sessionFixture(count = 3) {
  const spec = generateDungeonSpecV3({ seed: 42, roomCount: 3, routeChoice: 0, specialRoomEntityLimit: 250,
    roomPlans: [{ id: 'batch', kind: 'monster-house', floorNumber: 1, roomId: 'room-002', entityCount: count, offers: [] }] });
  return startPlaySession(spec).session;
}
const trigger = { type: 'on_enter_room', roomId: 'room-002' };

test('spawn batching preserves order, one-shot behavior, and independent snapshot/state for 125/250 enemies', () => {
  for (const count of [125, 250]) {
    const session = sessionFixture(count);
    const before = JSON.stringify(session);
    const result = dispatchSupportedEvents(session, trigger, { at: 7 });
    assert.equal(result.ok, true);
    assert.equal(JSON.stringify(session), before);
    const expectedIds = session.snapshot.entities.filter(({ type }) => type === 'enemy').map(({ id }) => id);
    assert.deepEqual(result.session.events.filter(({ type }) => type === 'enemy-spawned').map(({ enemyId }) => enemyId), expectedIds);
    assert.ok(expectedIds.every((id) => result.session.gameplayState.entityStates[id].status === 'active'));
    assert.equal(result.session.events.at(-1).type, 'logic-event-fired');
    assert.deepEqual(dispatchSupportedEvents(result.session, trigger, { at: 8 }).firedEventIds, []);
    result.session.gameplayState.entityStates[expectedIds[0]].encounters = 55;
    assert.equal(session.gameplayState.entityStates[expectedIds[0]], undefined);
  }
});

test('invalid later group reference or defeated enemy rolls back every staged spawn', () => {
  for (const mode of ['missing', 'defeated']) {
    let session = sessionFixture();
    const ids = session.snapshot.events[0].actions[0].enemyIds;
    if (mode === 'missing') ids.push('missing-enemy');
    else session = applyPlaySessionStateCommand(session, { type: 'set-entity-state', entityId: ids.at(-1), state: { status: 'defeated' } }).session;
    const before = JSON.stringify(session);
    const result = dispatchSupportedEvents(session, trigger, { at: 7 });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'EVENT_ACTION_FAILED');
    assert.equal(result.error.cause.code, mode === 'missing' ? 'EVENT_ENEMY_NOT_FOUND' : 'EVENT_ENEMY_ALREADY_DEFEATED');
    assert.equal(JSON.stringify(session), before);
  }
});

test('later event action failure leaves original session untouched and repeated IDs do not spawn twice', () => {
  const session = sessionFixture();
  session.snapshot.events[0].actions[0].enemyIds.push(session.snapshot.events[0].actions[0].enemyIds[0]);
  const spawned = dispatchSupportedEvents(session, trigger);
  assert.equal(spawned.session.events.filter(({ type }) => type === 'enemy-spawned').length, 3);
  session.gameplayState.inventory.token = Number.MAX_SAFE_INTEGER;
  session.snapshot.events[0].actions.push({ type: 'give_reward', itemId: 'token', count: 1 });
  const before = JSON.stringify(session);
  const result = dispatchSupportedEvents(session, trigger);
  assert.equal(result.ok, false);
  assert.equal(result.error.cause.code, 'EVENT_REWARD_OVERFLOW');
  assert.equal(JSON.stringify(session), before);
});

test('an active enemy stays untouched while dormant prototype-named IDs become own state entries', () => {
  const session = sessionFixture(2);
  const enemies = session.snapshot.entities.filter(({ type }) => type === 'enemy');
  const activeId = enemies[0].id;
  enemies[0].initiallyActive = true;
  enemies[1].id = '__proto__';
  session.snapshot.events[0].actions[0].enemyIds[1] = '__proto__';
  const result = dispatchSupportedEvents(session, trigger);
  assert.equal(result.ok, true);
  assert.equal(result.session.gameplayState.entityStates[activeId], undefined);
  assert.equal(Object.hasOwn(result.session.gameplayState.entityStates, '__proto__'), true);
  assert.equal(result.session.gameplayState.entityStates.__proto__.status, 'active');
  assert.equal(Object.getPrototypeOf(result.session.gameplayState.entityStates), Object.prototype);
});
