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


test('fallback scopes mixed normal and special endpoint sentences independently in both languages', () => {
  for (const prompt of ['初心者向けダンジョン。スタートは通常の部屋。ゴールに店。', 'A beginner dungeon. The start is a normal room. A shop at the goal.']) {
    const requests = parseFallbackRoomRequests(prompt);
    assert.equal(requests.find(({ targetRole }) => targetRole === 'start').kind, 'normal');
    assert.equal(requests.find(({ targetRole }) => targetRole === 'goal').kind, 'shop');
    const config = createRoomPlanConfig({ ...base, requests });
    assert.equal(config.presenceSpec.endpointPolicies.start, 'normal');
    assert.equal(config.presenceSpec.endpointPolicies.goal, 'shop');
  }
  for (const prompt of ['スタートに店。ゴールは通常の部屋。', 'A shop at the start. A normal room at the goal.']) {
    const requests = parseFallbackRoomRequests(prompt);
    assert.equal(requests.find(({ targetRole }) => targetRole === 'start').kind, 'shop');
    assert.equal(requests.find(({ targetRole }) => targetRole === 'goal').kind, 'normal');
  }
  const negative = parseFallbackRoomRequests('店はなし。スタートに敵2体のモンスターハウス。ゴールは通常の部屋。');
  assert.equal(negative.find(({ kind, targetRole }) => kind === 'shop' && !targetRole).presence, 'exclude');
  assert.equal(negative.find(({ targetRole }) => targetRole === 'start').entityCount, 2);
  assert.equal(negative.find(({ targetRole }) => targetRole === 'goal').kind, 'normal');
  assert.throws(() => parseFallbackRoomRequests('2.5階のスタートは通常の部屋。'), /INTEGER_REQUIRED/);
  assert.throws(() => parseFallbackRoomRequests('A normal room at the start on floor -2.'), /INTEGER_REQUIRED/);
});

test('endpoint kinds are preserved per floor, with specific floors overriding a shared default', () => {
  const requests = parseFallbackRoomRequests('1階のゴールに店。2階のゴールに敵3体のモンスターハウス。');
  const config = createRoomPlanConfig({ ...base, requests });
  assert.deepEqual(config.presenceSpec.endpointPolicies.goal, { default:'normal', floors:{1:'shop',2:'monster-house'} });
  assert.deepEqual(config.roomPlans.filter(({targetRole})=>targetRole==='goal').map(({floorNumber,kind})=>[floorNumber,kind]), [[1,'shop'],[2,'monster-house']]);
  const edited = createRoomPlanConfig({ ...base, requests, endpointPolicies:{ ...config.presenceSpec.endpointPolicies, goal:{default:'normal',floors:{1:'shop',2:'trap-house'}} } });
  assert.equal(edited.roomPlans.find(({targetRole,floorNumber})=>targetRole==='goal'&&floorNumber===2).kind,'trap-house');
  const defaultRequests = parseFallbackRoomRequests('ゴールに店。2階のゴールに敵3体のモンスターハウス。');
  const shared = createRoomPlanConfig({ ...base, floorCount:3, requests:defaultRequests });
  assert.deepEqual(shared.roomPlans.filter(({targetRole})=>targetRole==='goal').map(({floorNumber,kind})=>[floorNumber,kind]),[[1,'shop'],[2,'monster-house'],[3,'shop']]);
  assert.throws(()=>createRoomPlanConfig({...base,requests:parseFallbackRoomRequests('1階のゴールに店。1階のゴールにモンスターハウス。')}),/ENDPOINT_KIND_CONFLICT/);
  assert.throws(()=>createRoomPlanConfig({...base,requests:parseFallbackRoomRequests('3階のゴールに店。')}),/ROOM_REQUEST_FLOOR_MISSING/);
});

test('compound endpoint clauses preserve each role, random policy, and explicit negation', () => {
  for(const prompt of ['Start in a normal room and make the Goal random','スタートは通常の部屋、ゴールはランダム','スタートは通常の部屋にしてゴールはランダム']) {
    const config=createRoomPlanConfig({...base,requests:parseFallbackRoomRequests(prompt)});
    assert.deepEqual(config.presenceSpec.endpointPolicies,{start:'normal',goal:'random'});
  }
  for(const prompt of ['Start in a normal room and make the Goal a shop','スタートは通常の部屋、ゴールに店']) {
    const config=createRoomPlanConfig({...base,requests:parseFallbackRoomRequests(prompt)});
    assert.deepEqual(config.presenceSpec.endpointPolicies,{start:'normal',goal:'shop'});
  }
  for(const prompt of ['No shop at Start and make the Goal a normal room','スタートに店は置かない、ゴールは通常の部屋']) {
    const requests=parseFallbackRoomRequests(prompt);
    assert.equal(requests.find(({targetRole})=>targetRole==='start').presence,'exclude');
    assert.equal(requests.find(({targetRole})=>targetRole==='goal').kind,'normal');
  }
});


test('integer sentence endings separate endpoint policies without accepting decimal or negative floors', () => {
  for (const prompt of [
    'A normal room at the start on floor 2. The goal is random.',
    '2階のスタートは通常の部屋。ゴールはランダム。',
  ]) {
    const requests = parseFallbackRoomRequests(prompt);
    assert.deepEqual(requests.map(({ targetRole, presence, floorNumber }) => [targetRole, presence, floorNumber]), [['start', 'include', 2], ['goal', 'random', null]]);
  }
  for (const prompt of [
    'A shop at the start on floor 2. A normal room at the goal.',
    'A normal room at the start on floor 2. A shop at the goal.',
    'No shop at the start on floor 2. The goal is random.',
  ]) {
    const requests = parseFallbackRoomRequests(prompt);
    assert.equal(requests.length, 2);
    assert.equal(requests.find(({ targetRole }) => targetRole === 'start').floorNumber, 2);
    assert.equal(requests.find(({ targetRole }) => targetRole === 'goal').floorNumber, null);
    if (prompt.startsWith('No')) assert.equal(requests.find(({ targetRole }) => targetRole === 'start').presence, 'exclude');
  }
  for (const floor of ['2.5', '-2', '-2.5']) {
    for (const kind of ['normal room', 'shop']) {
      assert.throws(() => parseFallbackRoomRequests(`A ${kind} at the start on floor ${floor}. The goal is random.`), /INTEGER_REQUIRED/);
    }
  }
});
