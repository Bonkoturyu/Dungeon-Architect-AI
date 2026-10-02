import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeonSpecV3 } from '../src/dungeon-generator.js';
import { guardGeneratedRouteV3, replayRouteWitnessV3 } from '../src/versions/v3/route-viability.js';
import { guardFirstShopPlacementV3 } from '../src/versions/v3/shop-placement.js';
import { startPlaySession } from '../../play-core/src/play-session.js';
import { deterministicTrapAvoidance } from '../../play-core/src/trap-avoidance.js';
import { TRAP_RULES_V1 } from '../../core/src/trap-rules.js';
import { EQUIPMENT_RULES_V1 } from '../../../apps/editor-slice/room-plan-review.js';

const difficultyProfile = { enemyDamage: 4, trapDamage: 6, recoveryHealing: 8 };
function testSpec(seed = 2) {
  const spec = generateDungeonSpecV3({ seed, roomCount: 3, routeChoice: 0 });
  spec.trapRules = { ...TRAP_RULES_V1 };
  spec.entities.push({ id: 'trap-test', type: 'trap', roomId: 'room-002', damage: 6 });
  return spec;
}

test('route witness includes failed avoidance damage and survives with matching carried state', () => {
  const spec = testSpec(), before = structuredClone(spec);
  const guard = guardGeneratedRouteV3(spec, { difficultyProfile });
  assert.equal(guard.assumptions.traps, TRAP_RULES_V1.version);
  assert.equal(guard.witness.hp, 14);
  const session = replayRouteWitnessV3(startPlaySession(spec).session, guard.witness);
  assert.equal(session.status, 'cleared');
  assert.equal(session.gameplayState.counters.trapsTriggered, 1);
  assert.deepEqual(session.playerState, guard.witness.playerState);
  assert.deepEqual(spec, before);
});

test('fixed lethal trap house rejects atomically without dropping traps or rerolling', () => {
  const plan = { id: 'fixed', kind: 'trap-house', roomId: 'room-002', floorNumber: 1, entityCount: 100, offers: [] };
  const spec = generateDungeonSpecV3({ seed: 2, roomCount: 3, routeChoice: 0, roomPlans: [plan], trapRules: TRAP_RULES_V1 });
  for (const entity of spec.entities.filter(({ type }) => type === 'trap')) entity.damage = 6;
  const before = structuredClone(spec);
  assert.throws(() => guardGeneratedRouteV3(spec, { difficultyProfile, roomPlans: [plan] }), /ROUTE_VIABILITY_CONFLICT/);
  assert.deepEqual(spec, before);
  assert.equal(spec.entities.filter(({ type }) => type === 'trap').length, 100);
});

test('conservative first-shop guard accounts for fixed trap failures and carried armor', () => {
  const spec = testSpec();
  const plans = [{ id: 'shop', kind: 'shop', roomId: 'room-003', autoAssigned: false }];
  const initialPlayerState = { hp: 5, maxHp: 20, level: 1, xp: 0, gold: 0, equipment: { weapon: null, armor: null } };
  assert.throws(() => guardFirstShopPlacementV3(spec, plans, { difficultyProfile, initialPlayerState }), /FIRST_SHOP_SURVIVAL_CONFLICT/);
  initialPlayerState.equipment.armor = { id: 'armor', slot: 'armor', tier: 3 };
  const result = guardFirstShopPlacementV3(spec, plans, { difficultyProfile, initialPlayerState, equipmentRules: EQUIPMENT_RULES_V1 });
  assert.equal(result.diagnostics.route.hp, 2);
  assert.match(result.diagnostics.assumptions, /seeded-avoidance-1/);
});

test('new-rule witness buys armor for trap-only risk and heals before a failing trap', () => {
  const spec = testSpec(); spec.equipmentRules = { ...EQUIPMENT_RULES_V1 };
  spec.entities.push({ id: 'shop', type: 'shop', roomId: 'room-001', offers: [{ id: 'armor', type: 'armor', price: 1, stock: 1, tier: 3 }] });
  const initialPlayerState = { hp: 5, maxHp: 20, level: 1, xp: 0, gold: 1, equipment: { weapon: null, armor: null } };
  const guard = guardGeneratedRouteV3(spec, { difficultyProfile, initialPlayerState });
  assert.equal(guard.witness.hp, 2);
  assert.ok(guard.witness.actions.some(({ type }) => type === 'purchase'));
  const session = replayRouteWitnessV3(startPlaySession(spec, { initialPlayerState }).session, guard.witness);
  assert.equal(session.playerState.equipment.armor.tier, 3);
  const withRecovery = testSpec();
  withRecovery.entities.push({ id: 'recovery', type: 'recovery', roomId: 'room-002', healing: 8 });
  const healed = guardGeneratedRouteV3(withRecovery, { difficultyProfile, initialPlayerState });
  assert.equal(healed.witness.hp, 7);
  assert.ok(healed.witness.actions.findIndex(({ type }) => type === 'use-recovery') < healed.witness.actions.findIndex(({ type }) => type === 'avoid-trap'));
});

test('automatic trap repair preserves per-ID outcomes, counts, damage, and topology', () => {
  const spec = testSpec();
  spec.rooms.push({ id: 'room-004', x: 12, z: 14, width: 6, depth: 6 });
  spec.corridors.push({ id: 'optional', fromRoomId: 'room-001', toRoomId: 'room-004', width: 2 });
  const before = structuredClone(spec);
  const initialPlayerState = { hp: 1, maxHp: 20, level: 1, xp: 0, gold: 0, equipment: { weapon: null, armor: null } };
  const guard = guardGeneratedRouteV3(spec, { difficultyProfile, initialPlayerState, normalRoomCapacity: { enemy: 1, trap: 2 } });
  assert.equal(guard.status, 'relocated-existing-content');
  assert.deepEqual(spec.rooms, before.rooms); assert.deepEqual(spec.corridors, before.corridors);
  assert.deepEqual(spec.entities.map(({ roomId, ...entity }) => entity), before.entities.map(({ roomId, ...entity }) => entity));
  assert.equal(spec.entities.find(({ id }) => id === 'trap-test').roomId, 'room-004');
  assert.equal(deterministicTrapAvoidance({ snapshot: spec }, 'trap-test').outcome, 'triggered');
  assert.equal(replayRouteWitnessV3(startPlaySession(spec, { initialPlayerState }).session, guard.witness).status, 'cleared');
});
