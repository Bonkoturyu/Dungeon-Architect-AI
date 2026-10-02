import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  parseDungeonSpec,
  validateDungeonSpec,
  validateEquipmentRules,
  validateShopOffers,
} from '../src/dungeon-spec.js';

const fixture = JSON.parse(readFileSync(new URL('../../../spec/dungeon/fixtures/minimal-valid-v1.json', import.meta.url)));
const offers = [
  { id: 'heal', type: 'healing', price: 10, stock: 1, healing: 8 },
  { id: 'sword', type: 'weapon', price: 20, stock: 2, tier: 2 },
  { id: 'shield', type: 'armor', price: 0, stock: 1, tier: 1 },
];
const rules = { weaponEnemyReductionPerTier: 1, armorDamageReductionPerTier: 1, minimumPositiveDamage: 1 };

test('legacy schema remains valid and optional room kinds/shop/equipment/difficulty round-trip', () => {
  assert.equal(validateDungeonSpec(fixture).valid, true);
  for (const kind of ['normal', 'monster-house', 'trap-house', 'shop']) {
    const spec = structuredClone(fixture);
    spec.rooms[1].kind = kind;
    spec.entities.push({ id: 'shop-1', type: 'shop', roomId: spec.rooms[1].id, offers });
    spec.equipmentRules = rules;
    spec.difficulty = 'normal';
    const parsed = parseDungeonSpec(JSON.stringify(spec));
    assert.equal(parsed.ok, true, JSON.stringify(parsed.errors));
    assert.deepEqual(parsed.spec, spec);
  }
});

test('unsupported room kind and difficulty fail core validation', () => {
  const spec = structuredClone(fixture);
  spec.rooms[1].kind = 'boss-room';
  spec.difficulty = 'extreme';
  const result = validateDungeonSpec(spec);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(({ code }) => code === 'ROOM_KIND_UNSUPPORTED'));
  assert.ok(result.errors.some(({ code }) => code === 'DIFFICULTY_UNSUPPORTED'));
});

test('shop requires explicit complete offers with unique shop-local IDs', () => {
  assert.equal(validateShopOffers(offers).valid, true);
  for (const invalid of [undefined, null, {}, [], [null], [{ ...offers[0], id: '' }], [offers[0], offers[0]]]) {
    assert.equal(validateShopOffers(invalid).valid, false);
  }
  const spec = structuredClone(fixture);
  for (const id of ['shop-1', 'shop-2']) {
    spec.entities.push({ id, type: 'shop', roomId: spec.rooms[1].id, offers });
  }
  assert.equal(validateDungeonSpec(spec).valid, true);
});

test('shop rejects unknown types and missing, negative, fractional, unsafe, or mixed effects', () => {
  for (const change of [
    { type: 'gold' }, { price: -1 }, { price: 0.5 }, { price: Number.MAX_SAFE_INTEGER + 1 },
    { stock: 0 }, { stock: 1.1 }, { stock: undefined }, { healing: 0 },
    { healing: undefined }, { healing: 2.2 }, { tier: 1 },
  ]) {
    assert.equal(validateShopOffers([{ ...offers[0], ...change }]).valid, false, JSON.stringify(change));
  }
  assert.equal(validateShopOffers([{ ...offers[1], tier: undefined }]).valid, false);
  assert.equal(validateShopOffers([{ ...offers[1], healing: 8 }]).valid, false);
  const spec = structuredClone(fixture);
  spec.entities.push({ id: 'shop-1', type: 'shop', roomId: spec.rooms[1].id });
  assert.ok(validateDungeonSpec(spec).errors.some(({ code }) => code === 'SHOP_OFFERS_REQUIRED'));
});

test('equipment rules are all explicit non-negative safe integers, with no implicit defaults', () => {
  assert.equal(validateEquipmentRules(rules).valid, true);
  assert.equal(validateEquipmentRules(Object.fromEntries(Object.keys(rules).map((key) => [key, 0]))).valid, true);
  for (const invalid of [null, [], {}, { ...rules, minimumPositiveDamage: -1 }, { ...rules, weaponEnemyReductionPerTier: 0.5 }, { ...rules, armorDamageReductionPerTier: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.equal(validateEquipmentRules(invalid).valid, false);
    const spec = { ...structuredClone(fixture), equipmentRules: invalid };
    assert.equal(validateDungeonSpec(spec).valid, false);
  }
});

test('treasure budget overrides require safe gold values and boolean item policy', () => {
  for (const goldReward of [0, 10, Number.MAX_SAFE_INTEGER]) {
    const spec = structuredClone(fixture);
    spec.entities.push({ id: 'budget', type: 'treasure', roomId: spec.rooms[0].id, goldReward, rewardItem: false });
    assert.equal(validateDungeonSpec(spec).valid, true);
  }
  for (const changes of [{ goldReward: -1 }, { goldReward: 1.5 }, { goldReward: Number.MAX_SAFE_INTEGER + 1 }, { rewardItem: 'false' }]) {
    const spec = structuredClone(fixture);
    spec.entities.push({ id: 'budget', type: 'treasure', roomId: spec.rooms[0].id, ...changes });
    assert.equal(validateDungeonSpec(spec).valid, false);
  }
});
