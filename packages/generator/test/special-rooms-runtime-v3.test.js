import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDungeonSpecV3 } from '../src/dungeon-generator.js';
import { startPlaySession, movePlaySession } from '../../play-core/src/play-session.js';
import { getEnemyState, resolveEnemyCombat } from '../../play-core/src/enemy-runtime.js';
import { openTreasure, avoidTrap, triggerTrap } from '../../play-core/src/interaction-runtime.js';
import { getShopState, purchaseShopOffer } from '../../play-core/src/shop-runtime.js';

const equipmentRules = { weaponEnemyReductionPerTier: 1, armorDamageReductionPerTier: 1, minimumPositiveDamage: 1 };
const profiles = [
  { difficulty: 'easy', count: 2, traps: 3, enemyDamage: 3, trapDamage: 4, recoveryHealing: 10 },
  { difficulty: 'normal', count: 3, traps: 4, enemyDamage: 4, trapDamage: 6, recoveryHealing: 8 },
  { difficulty: 'hard', count: 4, traps: 5, enemyDamage: 5, trapDamage: 7, recoveryHealing: 8 },
];

test('generated chest → shop → blocking houses → Goal is survivable for three explicit profiles with preparation', () => {
  for (const { difficulty, count, traps, ...difficultyProfile } of profiles) {
    const spec = generateDungeonSpecV3({
      seed: 42, roomCount: 5, routeChoice: 0, difficulty, difficultyProfile, equipmentRules,
      roomPlans: [
        { id: 'merchant', kind: 'shop', floorNumber: 1, roomId: 'room-002', entityCount: null,
          offers: [{ id: 'weapon', type: 'weapon', price: 30, stock: 1, tier: 3 }] },
        { id: 'monsters', kind: 'monster-house', floorNumber: 1, roomId: 'room-003', entityCount: count, offers: [] },
        { id: 'traps', kind: 'trap-house', floorNumber: 1, roomId: 'room-004', entityCount: traps, offers: [] },
      ],
    });
    const original = JSON.stringify(spec);
    let session = startPlaySession(spec).session;
    assert.equal(session.playerState.gold, 0);
    const enemies = spec.entities.filter(({ type }) => type === 'enemy');
    assert.ok(enemies.every(({ id }) => getEnemyState(session, id).state.status === 'dormant'));
    const chest = spec.entities.find(({ type }) => type === 'treasure');
    const opened = openTreasure(session, chest.id);
    assert.equal(opened.ok, true);
    assert.equal(opened.reward.item, null);
    session = opened.session;
    assert.equal(session.playerState.gold, 30);
    assert.equal(session.playerState.equipment.weapon, null);
    assert.equal(session.playerState.equipment.armor, null);
    assert.equal(openTreasure(session, chest.id).ok, false);
    session = movePlaySession(session, 'room-002').session;
    const shop = spec.entities.find(({ type }) => type === 'shop');
    const bought = purchaseShopOffer(session, shop.id, 'weapon');
    assert.equal(bought.ok, true);
    session = bought.session;
    assert.equal(session.playerState.gold, 0);
    assert.equal(getShopState(session, shop.id).offers[0].remaining, 0);
    assert.equal(purchaseShopOffer(session, shop.id, 'weapon').error.code, 'SHOP_SOLD_OUT');
    session = movePlaySession(session, 'room-003').session;
    assert.ok(enemies.every(({ id }) => getEnemyState(session, id).state.status === 'active'));
    assert.equal(movePlaySession(session, 'room-002').error.code, 'SPECIAL_ROOM_BLOCKED');
    assert.equal(movePlaySession(session, 'room-004').error.code, 'SPECIAL_ROOM_BLOCKED');
    for (const { id } of enemies) {
      const combat = resolveEnemyCombat(session, id);
      assert.equal(combat.ok, true);
      assert.equal(combat.defeated, true);
      assert.equal(combat.damageApplied, Math.max(1, difficultyProfile.enemyDamage - 3));
      session = combat.session;
    }
    const reentry = movePlaySession(movePlaySession(session, 'room-002').session, 'room-003');
    assert.equal(reentry.ok, true);
    session = reentry.session;
    assert.ok(enemies.every(({ id }) => getEnemyState(session, id).state.status === 'defeated'));
    assert.equal(session.events.filter(({ type }) => type === 'logic-event-fired').length, 1);
    session = movePlaySession(session, 'room-004').session;
    assert.equal(movePlaySession(session, 'room-005').error.code, 'SPECIAL_ROOM_BLOCKED');
    for (const { id } of spec.entities.filter(({ type }) => type === 'trap')) {
      const avoided = avoidTrap(session, id);
      assert.equal(avoided.ok, true);
      session = avoided.session;
    }
    session = movePlaySession(session, 'room-005').session;
    assert.equal(session.status, 'cleared');
    assert.ok(session.playerState.hp > 0);
    assert.ok(session.snapshot.entities.filter(({ type }) => type === 'enemy').every(({ roomId }) => roomId === 'room-003'));
    assert.equal(JSON.stringify(spec), original);
    const reset = startPlaySession(spec).session;
    assert.equal(reset.playerState.gold, 0);
    assert.equal(getShopState(reset, shop.id).offers[0].remaining, 1);
    assert.ok(enemies.every(({ id }) => getEnemyState(reset, id).state.status === 'dormant'));
  }
});

test('triggering every damaging trap can fail while avoiding them can clear the same explicit plan', () => {
  const spec = generateDungeonSpecV3({
    seed: 3, roomCount: 3, routeChoice: 0,
    difficultyProfile: { enemyDamage: 4, trapDamage: 6, recoveryHealing: 8 },
    roomPlans: [{ kind: 'trap-house', floorNumber: 1, roomId: 'room-002', entityCount: 4, offers: [] }],
  });
  const entered = movePlaySession(startPlaySession(spec).session, 'room-002').session;
  let reckless = entered;
  let cautious = entered;
  for (const { id } of spec.entities.filter(({ type }) => type === 'trap')) {
    reckless = triggerTrap(reckless, id).session;
    cautious = avoidTrap(cautious, id).session;
  }
  assert.equal(reckless.status, 'failed');
  assert.equal(reckless.failureReason, 'player-defeated');
  assert.equal(cautious.playerState.hp, 20);
  assert.equal(movePlaySession(cautious, 'room-003').session.status, 'cleared');
});
