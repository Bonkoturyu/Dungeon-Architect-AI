import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeonSpec } from '../../generator/src/dungeon-generator.js';
import { startPlaySession, movePlaySession, applyPlayerDamage } from '../src/play-session.js';
import { purchaseShopOffer, getShopState } from '../src/shop-runtime.js';
import { getEffectiveDamage } from '../src/equipment-runtime.js';
function fixture() {
  const spec = generateDungeonSpec({ seed: 42, roomCount: 6, routeChoice: 0 });
  spec.entities.push({ id: 'shop-1', type: 'shop', roomId: 'room-002', offers: [
    { id: 'heal', type: 'healing', price: 10, stock: 1, healing: 8 },
    { id: 'weapon', type: 'weapon', price: 20, stock: 1, tier: 2 },
    { id: 'armor', type: 'armor', price: 10, stock: 1, tier: 1 },
  ] });
  spec.equipmentRules = { weaponEnemyReductionPerTier: 1, armorDamageReductionPerTier: 1, minimumPositiveDamage: 1 };
  const started = startPlaySession(spec);
  assert.equal(started.ok, true, JSON.stringify(started.errors));
  const session = movePlaySession(started.session, 'room-002').session;
  session.playerState.gold = 50; session.playerState.hp = 10;
  return { spec, session };
}
test('shop debit, healing, stock and snapshot isolation are atomic', () => {
  const { spec, session } = fixture(); const before = JSON.stringify(session); const authored = JSON.stringify(spec);
  const bought = purchaseShopOffer(session, 'shop-1', 'heal');
  assert.equal(bought.ok, true); assert.equal(bought.session.playerState.gold, 40); assert.equal(bought.session.playerState.hp, 18);
  assert.equal(getShopState(bought.session, 'shop-1').offers[0].remaining, 0);
  assert.equal(purchaseShopOffer(bought.session, 'shop-1', 'heal').error.code, 'SHOP_SOLD_OUT');
  assert.equal(JSON.stringify(session), before); assert.equal(JSON.stringify(spec), authored);
  assert.equal(getShopState(startPlaySession(spec).session, 'shop-1').offers[0].remaining, 1);
});
test('shop blocks insufficient G, remote use, full HP, invalid offers and nonupgrades without debit', () => {
  const { session } = fixture(); session.playerState.gold = 0;
  assert.equal(purchaseShopOffer(session, 'shop-1', 'heal').error.code, 'SHOP_GOLD_INSUFFICIENT');
  session.playerState.gold = 50; session.currentRoomId = 'room-003';
  assert.equal(purchaseShopOffer(session, 'shop-1', 'heal').error.code, 'SHOP_NOT_IN_CURRENT_ROOM');
  session.currentRoomId = 'room-002'; session.playerState.hp = 20;
  assert.equal(purchaseShopOffer(session, 'shop-1', 'heal').error.code, 'SHOP_HP_FULL');
  session.playerState.equipment.weapon = { id: 'weapon-tier-2', slot: 'weapon', tier: 2 };
  assert.equal(purchaseShopOffer(session, 'shop-1', 'weapon').error.code, 'SHOP_EQUIPMENT_NOT_UPGRADE');
  assert.equal(session.playerState.gold, 50);
});
test('equipped purchases affect enemy and trap costs while legacy rules remain unchanged', () => {
  let { session } = fixture(); session = purchaseShopOffer(session, 'shop-1', 'weapon').session;
  session = purchaseShopOffer(session, 'shop-1', 'armor').session;
  assert.equal(getEffectiveDamage(session, 4, 'enemy'), 1);
  assert.equal(getEffectiveDamage(session, 6, 'trap'), 5);
  assert.equal(getEffectiveDamage(session, 0, 'enemy'), 0);
  assert.equal(getEffectiveDamage(session, 4, 'unknown'), 4);
  assert.equal(applyPlayerDamage(session, 4, { sourceType: 'enemy' }).applied, 1);
  delete session.snapshot.equipmentRules;
  assert.equal(getEffectiveDamage(session, 4, 'enemy'), 4);
});
test('shop offer IDs cannot collide with object prototype fields', () => {
  for (const id of ['__proto__','constructor','toString']) {
    const {session}=fixture(); session.snapshot.entities.find(e=>e.type==='shop').offers[0].id=id;
    assert.equal(getShopState(session,'shop-1').offers[0].remaining,1);
    const purchase=purchaseShopOffer(session,'shop-1',id); assert.equal(purchase.ok,true);
    assert.equal(getShopState(purchase.session,'shop-1').offers[0].remaining,0);
  }
});
test('prototype-named shop IDs preserve sold stock across clones', () => {
  const {session}=fixture(); const shop=session.snapshot.entities.find(e=>e.type==='shop'); shop.id='__proto__';
  const bought=purchaseShopOffer(session,'__proto__','heal'); assert.equal(bought.ok,true);
  assert.equal(getShopState(bought.session,'__proto__').offers[0].remaining,0);
  assert.equal(purchaseShopOffer(bought.session,'__proto__','heal').error.code,'SHOP_SOLD_OUT');
});
