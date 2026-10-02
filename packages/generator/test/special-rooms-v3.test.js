import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import { validateConfirmedRoomPlanLimits } from '../../intent/src/room-limits.js';
import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT, MAX_SPECIAL_ROOM_ENTITY_LIMIT, generateDungeonSpec, generateDungeonSpecV2, generateDungeonSpecV3 } from '../src/dungeon-generator.js';
import {
  deriveGenerationProfile,
  generateDungeonFromDesignIntent,
  generateDungeonFromDesignIntentV2,
  generateDungeonFromDesignIntentV3,
  seedFromPrompt,
} from '../src/design-intent-generator.js';
import { createBuiltinGeneratorStrategyRegistry, GENERATOR_STRATEGY_V3_SPECIAL_ROOMS_ID } from '../src/strategy-catalog.js';

const intent = { ...DEFAULT_DESIGN_INTENT, targetDuration: 480, fairness: 0.8 };
const options = { seed: 20261002, id: 'v3-fixture', prompt: 'explicit special rooms' };
const offers = [{ id: 'potion', type: 'healing', price: 10, stock: 1, healing: 8 }];
const roomPlans = [
  { id: 'monsters', kind: 'monster-house', floorNumber: 1, roomId: 'room-002', entityCount: 3, offers: [] },
  { id: 'traps', kind: 'trap-house', floorNumber: 1, roomId: 'room-003', entityCount: 4, offers: [] },
  { id: 'supplies', kind: 'shop', floorNumber: 1, roomId: 'room-004', entityCount: null, offers },
];
const equipmentRules = { weaponEnemyReductionPerTier: 1, armorDamageReductionPerTier: 1, minimumPositiveDamage: 1 };

test('V3 without plans or explicit rules is byte-identical to the V2 baseline', () => {
  assert.equal(JSON.stringify(generateDungeonSpecV3(options)), JSON.stringify(generateDungeonSpecV2(options)));
  assert.equal(JSON.stringify(generateDungeonFromDesignIntentV3(intent, options)), JSON.stringify(generateDungeonFromDesignIntentV2(intent, options)));
  assert.equal(seedFromPrompt('fixture', { version: '3' }), seedFromPrompt('fixture', { version: '2' }));
  assert.deepEqual(deriveGenerationProfile(intent, { version: '3', seed: options.seed }), deriveGenerationProfile(intent, { version: '2', seed: options.seed }));
});

test('V3 generates exact house contents, a safe shop, and one-shot entry spawn events', () => {
  const baseline = generateDungeonFromDesignIntentV2(intent, options).spec;
  const result = generateDungeonFromDesignIntentV3(intent, { ...options, roomPlans, equipmentRules });
  const { spec, profile } = result;
  assert.equal(validateDungeonSpec(spec).valid, true);
  assert.deepEqual(spec.equipmentRules, equipmentRules);
  assert.notEqual(spec.equipmentRules, equipmentRules);
  for (const plan of roomPlans) {
    assert.equal(spec.rooms.find(({ id }) => id === plan.roomId).kind, plan.kind);
    const entities = spec.entities.filter(({ roomId }) => roomId === plan.roomId);
    assert.equal(entities.length, plan.entityCount ?? 1);
    assert.ok(entities.every(({ type }) => type === (plan.kind === 'monster-house' ? 'enemy' : plan.kind === 'trap-house' ? 'trap' : 'shop')));
  }
  const enemies = spec.entities.filter(({ roomId }) => roomId === 'room-002');
  assert.ok(enemies.every(({ initiallyActive }) => initiallyActive === false));
  const event = spec.events.find(({ trigger }) => trigger.type === 'on_enter_room' && trigger.roomId === 'room-002');
  assert.deepEqual(event.conditions, [{ type: 'one_shot' }]);
  assert.deepEqual(event.actions, [{ type: 'spawn_enemy_group', enemyIds: enemies.map(({ id }) => id) }]);
  const shop = spec.entities.find(({ type }) => type === 'shop');
  assert.deepEqual(shop.offers, offers);
  assert.notEqual(shop.offers, offers);
  const selected = new Set(roomPlans.map(({ roomId }) => roomId));
  assert.deepEqual(spec.entities.filter(({ roomId, id }) => !selected.has(roomId) && !id.startsWith('v3:shop-budget:')), baseline.entities.filter(({ roomId }) => !selected.has(roomId)));
  assert.deepEqual(spec.rooms.filter(({ id }) => !selected.has(id)), baseline.rooms.filter(({ id }) => !selected.has(id)));
  assert.deepEqual(spec.corridors, baseline.corridors);
  for (const type of ['enemy', 'trap', 'treasure', 'recovery']) {
    assert.equal(profile[`${type}Count`], spec.entities.filter((entity) => entity.type === type).length);
  }
  assert.deepEqual(generateDungeonFromDesignIntentV3(intent, { ...options, roomPlans, equipmentRules }), result);
});

test('replaced V2 content removes affected event references without invalidating output', () => {
  const baseline = generateDungeonFromDesignIntentV2(intent, options).spec;
  const treasure = baseline.entities.find(({ type }) => type === 'treasure');
  const spec = generateDungeonFromDesignIntentV3(intent, {
    ...options,
    roomPlans: [{ ...roomPlans[2], roomId: treasure.roomId }],
  }).spec;
  assert.ok(!spec.entities.some(({ id }) => id === treasure.id));
  assert.ok(!spec.events.some(({ id }) => id === 'event-treasure-hint-1'));
  assert.equal(validateDungeonSpec(spec).valid, true);
});

test('seed-selected rooms are distinct and exclude Start/Goal and all explicit reservations', () => {
  const plans = roomPlans.map((plan, index) => ({ ...plan, roomId: index === 2 ? 'room-002' : null }));
  const seen = new Set();
  for (let seed = 0; seed < 20; seed += 1) {
    const spec = generateDungeonSpecV3({ seed, roomCount: 8, roomPlans: plans });
    const special = spec.rooms.filter(({ kind }) => kind);
    assert.equal(special.length, 3);
    assert.equal(new Set(special.map(({ id }) => id)).size, 3);
    assert.equal(spec.rooms.find(({ id }) => id === 'room-002').kind, 'shop');
    assert.ok(!special.some(({ id }) => id === 'room-001' || id === 'room-008'));
    assert.deepEqual(spec, generateDungeonSpecV3({ seed, roomCount: 8, roomPlans: plans }));
    seen.add(JSON.stringify(special.map(({ id, kind }) => [id, kind])));
  }
  assert.ok(seen.size > 1);
});

test('explicit difficulty affects all baseline and house entities and recovery effects', () => {
  const difficultyProfile = { enemyDamage: 2, trapDamage: 3, recoveryHealing: 9 };
  const { spec } = generateDungeonFromDesignIntentV3(intent, {
    ...options, roomPlans: roomPlans.slice(0, 1), difficulty: 'easy', difficultyProfile,
  });
  assert.equal(spec.difficulty, 'easy');
  for (const type of ['enemy', 'trap', 'recovery']) {
    const entities = spec.entities.filter((entity) => entity.type === type);
    assert.ok(entities.length > 0);
    assert.ok(entities.every((entity) => type === 'recovery' ? entity.healing === 9 : entity.damage === (type === 'enemy' ? 2 : 3)));
  }
  for (const invalid of [null, {}, [], { ...difficultyProfile, monsterCount: 2 }, { ...difficultyProfile, enemyDamage: 0 }, { ...difficultyProfile, recoveryHealing: 1.2 }]) {
    assert.throws(() => generateDungeonSpecV3({ ...options, difficultyProfile: invalid }), /difficultyProfile/);
  }
  assert.throws(() => generateDungeonSpecV3({ ...options, difficulty: 'extreme' }), /difficulty/);
});

test('V3 rejects unresolved counts and invalid, conflicting, or excessive plans without clamping', () => {
  for (const entityCount of [undefined, null, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => generateDungeonSpecV3({ ...options, roomPlans: [{ ...roomPlans[0], entityCount }] }), /entityCount/);
  }
  for (const roomId of ['missing-room', 'room-001', 'room-008']) {
    assert.throws(() => generateDungeonSpecV3({ ...options, roomPlans: [{ ...roomPlans[0], roomId }] }), /room|Room|Start/);
  }
  for (const change of [{ kind: 'normal' }, { floorNumber: null }, { offers }, { id: '' }, { roomId: undefined }]) {
    assert.throws(() => generateDungeonSpecV3({ ...options, roomPlans: [{ ...roomPlans[0], ...change }] }));
  }
  assert.throws(() => generateDungeonSpecV3({ ...options, roomPlans: null }), /array/);
  assert.throws(() => generateDungeonSpecV3({ ...options, roomPlans: [{ ...roomPlans[2], offers: [] }] }), /SHOP_OFFERS_REQUIRED/);
  assert.throws(() => generateDungeonSpecV3({ ...options, roomPlans: [{ ...roomPlans[2], entityCount: 1 }] }), /entityCount/);
  assert.throws(() => generateDungeonSpecV3({ ...options, roomPlans: [roomPlans[0], roomPlans[0]] }), /Duplicate/);
  assert.throws(() => generateDungeonSpecV3({ ...options, roomPlans: [roomPlans[0], { ...roomPlans[1], roomId: roomPlans[0].roomId }] }), /same room/);
  assert.throws(() => generateDungeonSpecV3({ ...options, roomPlans: [roomPlans[0], { ...roomPlans[1], floorNumber: 2 }] }), /current floor/);
  assert.throws(() => generateDungeonSpecV3({ ...options, roomCount: 3, roomPlans: roomPlans.map((plan) => ({ ...plan, roomId: null })) }), /Insufficient/);
});

test('per-floor house entity budget defaults to 100 and validates totals before allocation', () => {
  assert.equal(DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT, 100);
  const house = { ...roomPlans[0], entityCount: 100 };
  const spec = generateDungeonSpecV3({ ...options, roomPlans: [house] });
  assert.equal(spec.entities.filter(({ type }) => type === 'enemy').length, 100);
  for (const entityCount of [101, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => generateDungeonSpecV3({ ...options, roomPlans: [{ ...house, entityCount }] }), /SPECIAL_ROOM_ENTITY_LIMIT_EXCEEDED/);
  }
  const plans = [{ ...roomPlans[0], entityCount: 60 }, { ...roomPlans[1], entityCount: 41 }];
  assert.throws(() => generateDungeonSpecV3({ ...options, roomPlans: plans }), /SPECIAL_ROOM_ENTITY_LIMIT_EXCEEDED/);
  plans[1].entityCount = 40;
  assert.equal(generateDungeonSpecV3({ ...options, roomPlans: plans }).entities.filter(({ type }) => ['enemy', 'trap'].includes(type)).length, 100);
});

test('advanced entity budget rejects unmeasured, invalid, or exceeded limits and supports a smaller explicit cap', async () => {
  for (const specialRoomEntityLimit of [null, 0, -1, 1.5, MAX_SPECIAL_ROOM_ENTITY_LIMIT + 1, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => generateDungeonSpecV3({ ...options, specialRoomEntityLimit }), /specialRoomEntityLimit/);
  }
  const house = { ...roomPlans[0], entityCount: 10 };
  assert.equal(generateDungeonSpecV3({ ...options, roomPlans: [house], specialRoomEntityLimit: 10 }).entities.filter(({ type }) => type === 'enemy').length, 10);
  assert.throws(() => generateDungeonFromDesignIntentV3(intent, { ...options, roomPlans: [house], specialRoomEntityLimit: 9 }), /SPECIAL_ROOM_ENTITY_LIMIT_EXCEEDED/);
  const registry = createBuiltinGeneratorStrategyRegistry();
  await assert.rejects(() => registry.generate(GENERATOR_STRATEGY_V3_SPECIAL_ROOMS_ID, {
    ...options, intent, options: { roomPlans: [house], specialRoomEntityLimit: 9 },
  }), /SPECIAL_ROOM_ENTITY_LIMIT_EXCEEDED/);
  const result = await registry.generate(GENERATOR_STRATEGY_V3_SPECIAL_ROOMS_ID, {
    ...options, intent, options: { roomPlans: [house], specialRoomEntityLimit: 10 },
  });
  assert.equal(result.spec.entities.filter(({ roomId }) => roomId === house.roomId).length, 10);
});

test('measured advanced cap allows 250, rejects 251, and honors an explicit 200 combined budget', () => {
  assert.equal(MAX_SPECIAL_ROOM_ENTITY_LIMIT, 250);
  const plans = [{ ...roomPlans[0], entityCount: 125 }, { ...roomPlans[1], entityCount: 125 }];
  assert.equal(generateDungeonSpecV3({ ...options, roomPlans: plans, specialRoomEntityLimit: 250 }).entities.filter(({ type }) => ['enemy', 'trap'].includes(type)).length, 250);
  assert.throws(() => generateDungeonSpecV3({ ...options, roomPlans: [{ ...roomPlans[0], entityCount: 251 }], specialRoomEntityLimit: 250 }), /SPECIAL_ROOM_ENTITY_LIMIT_EXCEEDED/);
  assert.throws(() => generateDungeonSpecV3({ ...options, roomPlans: plans, specialRoomEntityLimit: 251 }), /specialRoomEntityLimit/);
  plans[0].entityCount = 100;
  plans[1].entityCount = 100;
  assert.equal(generateDungeonSpecV3({ ...options, roomPlans: plans, specialRoomEntityLimit: 200 }).entities.filter(({ type }) => ['enemy', 'trap'].includes(type)).length, 200);
  plans[1].entityCount = 101;
  assert.throws(() => generateDungeonSpecV3({ ...options, roomPlans: plans, specialRoomEntityLimit: 200 }), /SPECIAL_ROOM_ENTITY_LIMIT_EXCEEDED/);
});

test('shared confirmed-plan budget separates floors and checks all expanded room plans', () => {
  const plans = Array.from({ length: 4 }, (_, index) => ({
    ...roomPlans[0], id: `expanded-${index}`, floorNumber: index < 2 ? 1 : 2, entityCount: 50,
  }));
  assert.deepEqual(validateConfirmedRoomPlanLimits(plans), { limit: 100, entityCountByFloor: { 1: 100, 2: 100 } });
  assert.throws(() => validateConfirmedRoomPlanLimits([...plans, { ...roomPlans[1], floorNumber: 2, entityCount: 1 }]), /SPECIAL_ROOM_ENTITY_LIMIT_EXCEEDED/);
  assert.deepEqual(validateConfirmedRoomPlanLimits([roomPlans[2]]), { limit: 100, entityCountByFloor: {} });
});

test('plans and shop offers are not mutated and missing plan IDs are deterministic', () => {
  const plan = { ...roomPlans[2], roomId: null };
  delete plan.id;
  const before = structuredClone(plan);
  const first = generateDungeonSpecV3({ ...options, roomPlans: [plan] });
  assert.deepEqual(plan, before);
  assert.deepEqual(first, generateDungeonSpecV3({ ...options, roomPlans: [plan] }));
  first.entities.find(({ type }) => type === 'shop').offers[0].price = 999;
  assert.equal(plan.offers[0].price, 10);
});

test('shop budgets stay in each pre-shop path room, with Start fallback only for the earliest shop', () => {
  const plans = [
    { ...roomPlans[2], id: 'near', roomId: 'room-002' },
    { ...roomPlans[2], id: 'far', roomId: 'room-006', offers: [{ id: 'armor', type: 'armor', price: 30, stock: 1, tier: 3 }] },
  ];
  const { spec, profile } = generateDungeonFromDesignIntentV3({ ...intent, routeChoice: 0 }, { ...options, roomPlans: plans });
  const start = spec.entities.find(({ type }) => type === 'start');
  const chests = spec.entities.filter(({ id }) => id.startsWith('v3:shop-budget:'));
  assert.equal(chests.length, 2);
  assert.ok(chests.every(({ type, rewardItem }) => type === 'treasure' && rewardItem === false));
  assert.equal(chests.reduce((total, { goldReward }) => total + goldReward, 0), 40);
  assert.equal(spec.playerState, undefined);
  assert.equal(profile.shopEconomy.requiredG, 40);
  assert.equal(profile.shopEconomy.availableAtStartG, 10);
  assert.equal(profile.shopEconomy.goldSource, 'pre-shop-path-treasures');
  assert.equal(profile.shopEconomy.budgets[0].distanceFromStart, 1);
  assert.equal(profile.shopEconomy.budgets[0].sourceRoomId, start.roomId);
  assert.equal(profile.shopEconomy.budgets[0].isStartFallback, true);
  assert.equal(profile.shopEconomy.budgets[1].sourceRoomId, 'room-005');
  assert.equal(profile.shopEconomy.budgets[1].isStartFallback, false);
  assert.deepEqual(profile.shopEconomy.budgets[1].pathRoomIds, ['room-001', 'room-002', 'room-003', 'room-004', 'room-005', 'room-006']);
  assert.equal(chests.find(({ goldReward }) => goldReward === 30).roomId, 'room-005');
  assert.ok(profile.shopEconomy.budgets.every(({ collectibleG, requiredG }) => collectibleG >= requiredG));
  assert.equal(validateDungeonSpec(spec).valid, true);
});

test('zero-price shops need no supplement and huge safe prices use one chest instead of unbounded entities', () => {
  for (const price of [0, Number.MAX_SAFE_INTEGER]) {
    const plan = { ...roomPlans[2], offers: [{ ...offers[0], price }] };
    const { spec, profile } = generateDungeonFromDesignIntentV3(intent, { ...options, roomPlans: [plan] });
    assert.equal(profile.shopEconomy.addedTreasureCount, price === 0 ? 0 : 1);
    assert.equal(profile.shopEconomy.collectibleG, price);
    assert.ok(spec.entities.length < 30);
    assert.equal(validateDungeonSpec(spec).valid, true);
  }
  assert.throws(() => generateDungeonSpecV3({
    ...options,
    roomPlans: [
      { ...roomPlans[2], offers: [{ ...offers[0], price: Number.MAX_SAFE_INTEGER }] },
      { ...roomPlans[2], id: 'other', roomId: 'room-005' },
    ],
  }), /safe integer range/);
});

test('V3 public dispatch and strategy adapter pass explicit options and provenance', async () => {
  assert.deepEqual(generateDungeonSpec({ ...options, roomPlans, version: '3' }), generateDungeonSpecV3({ ...options, roomPlans }));
  const direct = generateDungeonFromDesignIntentV3(intent, { ...options, roomPlans, equipmentRules });
  const dispatched = generateDungeonFromDesignIntent(intent, { ...options, roomPlans, equipmentRules, version: '3' });
  assert.deepEqual(dispatched.spec, direct.spec);
  assert.equal(dispatched.generatorVersion, '3');
  const registry = createBuiltinGeneratorStrategyRegistry();
  const result = await registry.generate(GENERATOR_STRATEGY_V3_SPECIAL_ROOMS_ID, {
    ...options, intent, options: { roomPlans, equipmentRules },
  });
  assert.deepEqual(result.spec, direct.spec);
  assert.equal(result.provenance.generatorVersion, '3');
  assert.equal(result.provenance.strategyId, GENERATOR_STRATEGY_V3_SPECIAL_ROOMS_ID);
  await assert.rejects(() => registry.generate(GENERATOR_STRATEGY_V3_SPECIAL_ROOMS_ID, options), /requires request.intent/);
});

test('frozen V1/V2 direct and DesignIntent fixture byte hashes remain unchanged', () => {
  const fixtures = [
    ['1', 0, 'ca43a195e6e2f78e1182a7852bd0b5c33fcb005ad52f6f1661dde1bceb94bd5a'],
    ['1', 777, '539db2cd4d46d40afc1226eb5451cc9463946ce8540b02d3d10d88215f3d409b'],
    ['1', 20261002, 'a38a7f3520a54746af1cb4cf4dcf16ff4dcc840394ac2ec4baeb417d7a411b8f'],
    ['2', 0, '3c5f63ba5e08d60cca6ca5f014a6822690bd5cfb0e4e94c0fa1dee0fe81d05ca'],
    ['2', 777, '15d6e9112388d221f981dbb1152da97aaa2e7623e4822fbc9bb6c0a9e9e4e7eb'],
    ['2', 20261002, 'e54667cd846e353ad26d0e136dd237c566798cf5d37569c0e5a15183fabc7283'],
  ];
  for (const [version, seed, hash] of fixtures) {
    const direct = generateDungeonSpec({ version, seed, roomCount: 8, routeChoice: 0.5, id: 'frozen-fixture' });
    const intent = generateDungeonFromDesignIntent(DEFAULT_DESIGN_INTENT, { version, seed, prompt: 'frozen fixture', id: 'frozen-fixture' });
    assert.equal(createHash('sha256').update(JSON.stringify({ direct, intent })).digest('hex'), hash);
  }
});
