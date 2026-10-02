import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFallbackRoomRequests } from '../src/room-requests.js';
import { createRoomPlanConfig } from '../../../apps/editor-slice/room-plan-review.js';
const base = { requests: [], floorCount: 2, roomsPerFloor: 8, seed: 25 };

test('Start/Goal defaults are seeded random; normal and global exclusions remain safe', () => {
  const first = createRoomPlanConfig(base); assert.deepEqual(createRoomPlanConfig(base), first);
  assert.deepEqual(first.presenceSpec.endpointPolicies, { start: 'random', goal: 'random' });
  const normal = createRoomPlanConfig({ ...base, endpointPolicies: { start: 'normal', goal: 'normal' } });
  assert.ok(normal.roomPlans.every(({ targetRole }) => !targetRole));
  const excluded = createRoomPlanConfig({ ...base, policies: { 'monster-house': 'exclude', 'trap-house': 'exclude', shop: 'exclude' } });
  assert.equal(excluded.roomPlans.length, 0);
  const endpointOnly = createRoomPlanConfig({ ...base, policies: { 'monster-house': 'exclude', 'trap-house': 'exclude', shop: 'exclude' }, endpointPolicies: { start: 'normal', goal: 'shop' } });
  assert.equal(endpointOnly.roomPlans.length, 2); assert.ok(endpointOnly.roomPlans.every(({ targetRole, kind }) => targetRole === 'goal' && kind === 'shop'));
});

test('natural-language endpoint counts and a named floor remain explicit', () => {
  const requests = parseFallbackRoomRequests('2階のスタートに敵2体のモンスターハウス。ゴールに店。');
  assert.equal(requests[0].targetRole, 'start'); assert.equal(requests[1].targetRole, 'goal');
  const config = createRoomPlanConfig({ ...base, requests });
  const start = config.roomPlans.filter(({ targetRole }) => targetRole === 'start');
  assert.equal(start.length, 1); assert.equal(start[0].floorNumber, 2); assert.equal(start[0].entityCount, 2);
  assert.equal(config.roomPlans.filter(({ targetRole }) => targetRole === 'goal').length, 2);
});

test('explicit normal endpoint language and endpoint-specific exclusions do not become extra ordinary plans', () => {
  const requests = parseFallbackRoomRequests('スタートは通常の部屋。ゴールはランダム。');
  assert.equal(requests[0].kind, 'normal'); assert.equal(requests[0].targetRole, 'start');
  assert.equal(requests[1].presence, 'random');
  const config = createRoomPlanConfig({ ...base, requests });
  assert.equal(config.presenceSpec.endpointPolicies.start, 'normal');
  assert.equal(config.presenceSpec.endpointPolicies.goal, 'random');
  assert.ok(config.roomPlans.every(({ targetRole }) => targetRole !== 'start'));
  for (let seed = 0; seed < 30; seed++) {
    const limited = createRoomPlanConfig({ ...base, seed, requests: parseFallbackRoomRequests('No shop at the goal.') });
    assert.ok(limited.roomPlans.every(({ targetRole, kind }) => targetRole !== 'goal' || kind !== 'shop'));
  }
});

test('endpoint capacity keeps explicit counts and drops only seeded optional houses', () => {
  const requests = parseFallbackRoomRequests('スタートに敵100体のモンスターハウス。');
  const config = createRoomPlanConfig({ ...base, floorCount: 1, seed: 2, requests });
  const fixed = config.roomPlans.find(({ targetRole }) => targetRole === 'start');
  assert.equal(fixed.entityCount, 100);
  assert.equal(config.roomPlans.reduce((sum, plan) => sum + (plan.entityCount ?? 0), 0), 100);
  assert.throws(() => createRoomPlanConfig({ ...base, floorCount:1, requests: parseFallbackRoomRequests('スタートに敵100体のモンスターハウス。ゴールに罠4個のトラップハウス。') }), /ENTITY_LIMIT/);
});
