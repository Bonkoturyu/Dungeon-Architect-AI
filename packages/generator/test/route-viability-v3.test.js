import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import { resolveSpecialRoomPresence } from '../../intent/src/special-room-presence.js';
import { generateDungeonSpecV3 } from '../src/dungeon-generator.js';
import { generateDungeonFromDesignIntentV3 } from '../src/design-intent-generator.js';
import { guardGeneratedRouteV3, replayRouteWitnessV3 } from '../src/versions/v3/route-viability.js';
import { startPlaySession } from '../../play-core/src/play-session.js';
import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { DIFFICULTY_PROFILES, EQUIPMENT_RULES_V1, NORMAL_ROOM_DEFAULTS } from '../../../apps/editor-slice/room-plan-review.js';

const difficultyProfile = { enemyDamage: 5, trapDamage: 7, recoveryHealing: 8 };
const defaults = { ...NORMAL_ROOM_DEFAULTS, 'monster-house': 4, 'trap-house': 5 };
const hpState = (hp = 20, tier = 0) => ({ hp, maxHp: 20, level: 1, xp: 0, gold: 0, equipment: {
  weapon: tier ? { id: `weapon-tier-${tier}`, slot: 'weapon', tier } : null, armor: null } });

test('previous shopless failures get actual replayable witnesses without new kinds, enemies, or rewards', () => {
  for (const seed of [25, 41, 45, 49, 56]) {
    const roomPlans = resolveSpecialRoomPresence({ requests: [], defaults, floorCount: 1, roomsPerFloor: 8, seed }).roomPlans;
    const options = { seed, roomPlans, difficultyProfile, equipmentRules: EQUIPMENT_RULES_V1 };
    const generated = generateDungeonFromDesignIntentV3(DEFAULT_DESIGN_INTENT, options);
    const guard = generated.profile.routeViability;
    assert.equal(guard.status, 'relocated-existing-content');
    assert.equal(validateDungeonSpec(generated.spec).valid, true);
    assert.ok(!generated.spec.entities.some(({ type }) => type === 'shop'));
    assert.deepEqual(generated.spec.rooms.filter(({ kind }) => kind).map(({ kind }) => kind).sort(), roomPlans.map(({ kind }) => kind).sort());
    const session = replayRouteWitnessV3(startPlaySession(generated.spec).session, guard.witness);
    assert.equal(session.status, 'cleared');
    assert.deepEqual(session.playerState, guard.witness.playerState);
    assert.deepEqual(generateDungeonFromDesignIntentV3(DEFAULT_DESIGN_INTENT, options), generated);
    assert.ok(generated.spec.entities.filter(({ type }) => type === 'enemy').every(({ damage }) => damage === 5));
  }
});

test('already viable difficulty layouts retain placement and legacy no-profile APIs omit the guard', () => {
  const options = { seed: 0, difficultyProfile: { ...difficultyProfile, enemyDamage: 3 }, equipmentRules: EQUIPMENT_RULES_V1 };
  const result = generateDungeonFromDesignIntentV3(DEFAULT_DESIGN_INTENT, options);
  assert.equal(result.profile.routeViability.status, 'preserved');
  assert.deepEqual(result.profile.routeViability.changes, []);
  assert.equal(generateDungeonFromDesignIntentV3(DEFAULT_DESIGN_INTENT, { seed: 0 }).profile.routeViability, undefined);
});

test('fixed extreme house conflict rejects transactionally instead of dropping enemies or changing damage', () => {
  const spec = generateDungeonSpecV3({ seed: 1, roomCount: 3, routeChoice: 0, roomPlans: [
    { id: 'fixed', kind: 'monster-house', floorNumber: 1, roomId: 'room-002', entityCount: 100, offers: [] },
  ] });
  for (const entity of spec.entities.filter(({ type }) => type === 'enemy')) entity.damage = 5;
  const before = structuredClone(spec);
  assert.throws(() => guardGeneratedRouteV3(spec, { difficultyProfile, roomPlans: [{ id: 'fixed', kind: 'monster-house', roomId: 'room-002' }] }), /ROUTE_VIABILITY_CONFLICT/);
  assert.deepEqual(spec, before);
  assert.throws(() => generateDungeonSpecV3({ seed: 1, roomCount: 3, routeChoice: 0, difficultyProfile, roomPlans: [
    { id: 'fixed', kind: 'monster-house', floorNumber: 1, roomId: 'room-002', entityCount: 100, offers: [] },
  ] }), /ROUTE_VIABILITY_CONFLICT/);
});

test('carried HP/XP/equipment is honored by both shop placement and full route witness', () => {
  const roomPlans = [
    { id: 'house', kind: 'monster-house', floorNumber: 2, roomId: 'room-002', entityCount: 6, offers: [] },
    { id: 'shop', kind: 'shop', floorNumber: 2, roomId: 'room-003', entityCount: null, offers: [{ id: 'heal', type: 'healing', healing: 8, price: 10, stock: 1 }] },
  ];
  const options = { seed: 3, roomCount: 4, routeChoice: 0, roomPlans, difficultyProfile, equipmentRules: EQUIPMENT_RULES_V1 };
  assert.throws(() => generateDungeonSpecV3(options), /FIRST_SHOP_SURVIVAL_CONFLICT/);
  const initialPlayerState = hpState(20, 4);
  const spec = generateDungeonSpecV3({ ...options, initialPlayerState });
  const guard = guardGeneratedRouteV3(spec, { ...options, initialPlayerState });
  assert.equal(guard.assumptions.scope, 'provided-carried-player-state');
  assert.equal(replayRouteWitnessV3(startPlaySession(spec, { initialPlayerState }).session, guard.witness).status, 'cleared');
  assert.deepEqual(initialPlayerState, hpState(20, 4));
  assert.throws(() => generateDungeonSpecV3({ ...options, initialPlayerState: hpState(1, 4) }), /SURVIVAL_CONFLICT|VIABILITY_CONFLICT/);
});

test('last-resort automatic house swap preserves complete content and spawn references; explicit house remains fixed', () => {
  const plan = { id: 'auto', kind: 'monster-house', floorNumber: 1, roomId: 'room-002', entityCount: 4, offers: [] };
  const spec = generateDungeonSpecV3({ seed: 7, roomCount: 5, routeChoice: 0, roomPlans: [plan], equipmentRules: EQUIPMENT_RULES_V1 });
  spec.corridors = [['room-001', 'room-002'], ['room-002', 'room-003'], ['room-003', 'room-005'], ['room-002', 'room-004']]
    .map(([fromRoomId, toRoomId], index) => ({ id: `route-${index}`, fromRoomId, toRoomId, width: 2 }));
  for (const entity of spec.entities.filter(({ type }) => type === 'enemy')) entity.damage = 5;
  const original = structuredClone(spec);
  const initialPlayerState = hpState(1, 4);
  assert.throws(() => guardGeneratedRouteV3(structuredClone(spec), { roomPlans: [plan], difficultyProfile, initialPlayerState }), /ROUTE_VIABILITY_CONFLICT/);
  const guard = guardGeneratedRouteV3(spec, { roomPlans: [{ ...plan, roomId: null }], difficultyProfile, initialPlayerState });
  assert.ok(guard.changes.some(({ operation }) => operation === 'swap-existing-room-content'));
  assert.deepEqual(spec.entities.map(({ roomId, ...entity }) => entity), original.entities.map(({ roomId, ...entity }) => entity));
  assert.deepEqual(spec.events.map(({ trigger, ...event }) => event), original.events.map(({ trigger, ...event }) => event));
  const house = spec.rooms.find(({ kind }) => kind === 'monster-house');
  assert.equal(spec.events.find(({ id }) => id === 'v3:auto:enter').trigger.roomId, house.id);
  assert.equal(validateDungeonSpec(spec).valid, true);
  assert.equal(replayRouteWitnessV3(startPlaySession(spec, { initialPlayerState }).session, guard.witness).status, 'cleared');
});
