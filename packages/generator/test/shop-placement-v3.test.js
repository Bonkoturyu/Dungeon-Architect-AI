import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import { generateDungeonSpecV2, generateDungeonSpecV3 } from '../src/dungeon-generator.js';
import { generateDungeonFromDesignIntentV3 } from '../src/design-intent-generator.js';
import { guardFirstShopPlacementV3 } from '../src/versions/v3/shop-placement.js';
import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { startPlaySession, movePlaySession } from '../../play-core/src/play-session.js';
import { listRoomEnemies, resolveEnemyCombat } from '../../play-core/src/enemy-runtime.js';
import { deterministicEnemyReward } from '../../play-core/src/progression-runtime.js';
import { listRoomInteractables, avoidTrap } from '../../play-core/src/interaction-runtime.js';

const difficultyProfile = { enemyDamage: 5, trapDamage: 7, recoveryHealing: 8 };
const offers = [{ id: 'weapon', type: 'weapon', price: 30, stock: 1, tier: 3 }];
const plans = [
  { id: 'special-1', kind: 'monster-house', floorNumber: 1, roomId: null, entityCount: 4, offers: [] },
  { id: 'special-2', kind: 'trap-house', floorNumber: 1, roomId: null, entityCount: 5, offers: [] },
  { id: 'special-3', kind: 'shop', floorNumber: 1, roomId: null, entityCount: null, offers },
];

test('previous hard pre-shop bottlenecks receive deterministic auto-shop relocation and an actual survivable route', () => {
  for (const seed of [11, 35, 56, 59]) {
    const options = { seed, roomPlans: plans, difficulty: 'hard', difficultyProfile };
    const { spec, profile } = generateDungeonFromDesignIntentV3(DEFAULT_DESIGN_INTENT, options);
    const guard = profile.shopPlacementGuard;
    assert.equal(guard.status, 'relocated-auto-shop');
    assert.equal(guard.route.survives, true);
    assert.equal(validateDungeonSpec(spec).valid, true);
    assert.deepEqual(generateDungeonFromDesignIntentV3(DEFAULT_DESIGN_INTENT, options), { spec, profile });
    let session = startPlaySession(spec).session;
    for (const roomId of guard.route.pathRoomIds.slice(1)) {
      const moved = movePlaySession(session, roomId);
      assert.equal(moved.ok, true);
      session = moved.session;
      for (const { entity } of listRoomInteractables(session).filter(({ entity }) => entity.type === 'trap')) session = avoidTrap(session, entity.id).session;
      const enemies = listRoomEnemies(session).sort((left, right) => deterministicEnemyReward(session, right.enemy.id).xp - deterministicEnemyReward(session, left.enemy.id).xp || left.enemy.id.localeCompare(right.enemy.id));
      for (const { enemy } of enemies) {
        const combat = resolveEnemyCombat(session, enemy.id);
        assert.equal(combat.ok, true);
        assert.equal(combat.defeated, true);
        session = combat.session;
      }
    }
    assert.equal(session.status, 'playing');
    assert.equal(session.currentRoomId, guard.route.shopRoomId);
    assert.equal(session.playerState.hp, guard.route.hp);
    assert.ok(session.playerState.hp > 0);
    assert.ok(spec.entities.filter(({ type }) => type === 'enemy').every(({ damage }) => damage === 5));
    assert.ok(!spec.entities.some(({ type }) => type === 'recovery'));
  }
});

test('already-safe placement is preserved and does not force an early shop room', () => {
  const result = generateDungeonFromDesignIntentV3(DEFAULT_DESIGN_INTENT, { seed: 0, roomPlans: plans, difficultyProfile });
  assert.equal(result.profile.shopPlacementGuard.status, 'preserved');
  assert.deepEqual(result.profile.shopPlacementGuard.changes, []);
  const base = generateDungeonSpecV2({ seed: 0, roomCount: 8, routeChoice: 0 });
  const selected = [{ ...plans[2], roomId: 'room-007', autoAssigned: true }];
  assert.equal(guardFirstShopPlacementV3(base, selected).plans[0].roomId, 'room-007');
});

test('guard swaps auto rooms only when there is no free ordinary room and never moves explicit assignments', () => {
  const base = generateDungeonSpecV2({ seed: 1, roomCount: 4, routeChoice: 0 });
  const selected = [
    { ...plans[0], entityCount: 5, roomId: 'room-002', autoAssigned: true },
    { ...plans[2], roomId: 'room-003', autoAssigned: true },
  ];
  const swapped = guardFirstShopPlacementV3(base, selected, { difficultyProfile });
  assert.equal(swapped.diagnostics.status, 'swapped-auto-rooms');
  assert.equal(swapped.plans.find(({ kind }) => kind === 'shop').roomId, 'room-002');
  assert.equal(swapped.plans.find(({ kind }) => kind === 'monster-house').roomId, 'room-003');
  const explicit = selected.map((plan) => ({ ...plan, autoAssigned: false }));
  const before = JSON.stringify(explicit);
  assert.throws(() => guardFirstShopPlacementV3(base, explicit, { difficultyProfile }), /FIRST_SHOP_SURVIVAL_CONFLICT/);
  assert.equal(JSON.stringify(explicit), before);
  assert.throws(() => generateDungeonSpecV3({ seed: 1, roomCount: 4, routeChoice: 0, difficultyProfile,
    roomPlans: explicit.map(({ autoAssigned, ...plan }) => plan) }), /FIRST_SHOP_SURVIVAL_CONFLICT/);
});

test('all eight concrete include/exclude combinations are honored; no shop means no budget or guard', () => {
  for (let mask = 0; mask < 8; mask += 1) {
    const included = plans.filter((_, index) => mask & (1 << index));
    const result = generateDungeonFromDesignIntentV3(DEFAULT_DESIGN_INTENT, { seed: 56, roomPlans: included, difficultyProfile });
    const kinds = result.spec.rooms.filter(({ kind }) => kind).map(({ kind }) => kind).sort();
    assert.deepEqual(kinds, included.map(({ kind }) => kind).sort());
    if (!(mask & 4)) {
      assert.equal(result.profile.shopPlacementGuard, undefined);
      assert.equal(result.profile.shopEconomy, undefined);
      assert.ok(!result.spec.entities.some(({ id }) => id.startsWith('v3:shop-budget:')));
    }
  }
});
