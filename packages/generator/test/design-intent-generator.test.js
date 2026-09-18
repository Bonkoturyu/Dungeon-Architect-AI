import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import {
  deriveGenerationProfile,
  generateDungeonFromDesignIntent,
  seedFromPrompt,
} from '../src/design-intent-generator.js';

test('prompt seed is stable and changes with normalized content', () => {
  assert.equal(seedFromPrompt('fair dungeon'), seedFromPrompt('fair dungeon'));
  assert.notEqual(seedFromPrompt('fair dungeon'), seedFromPrompt('tense dungeon'));
});

test('DesignIntent maps deterministically to bounded generator parameters', () => {
  const profile = deriveGenerationProfile(
    { ...DEFAULT_DESIGN_INTENT, targetDuration: 300, routeChoice: 0.8, combatDensity: 0.2 },
    { seed: 123 },
  );
  assert.equal(profile.seed, 123);
  assert.equal(profile.roomCount, 5);
  assert.equal(profile.routeChoice, 0.8);
  assert.equal(profile.enemyCount, 1);
});

test('generated intent dungeon is deterministic, valid, and includes MVP content/logic', () => {
  const intent = {
    ...DEFAULT_DESIGN_INTENT,
    targetDuration: 480,
    routeChoice: 0.75,
    combatDensity: 0.5,
    rewardDensity: 0.7,
    trapDensity: 0.5,
    greedPunishment: 0.8,
  };
  const a = generateDungeonFromDesignIntent(intent, { prompt: 'fair but deceptive treasure dungeon' });
  const b = generateDungeonFromDesignIntent(intent, { prompt: 'fair but deceptive treasure dungeon' });

  assert.deepEqual(a, b);
  assert.equal(a.profile.roomCount, 8);
  assert.ok(a.spec.entities.some((entity) => entity.type === 'enemy'));
  assert.ok(a.spec.entities.some((entity) => entity.type === 'treasure'));
  assert.ok(a.spec.entities.some((entity) => entity.type === 'trap'));
  assert.ok(a.spec.events.some((event) => event.trigger.type === 'on_open_treasure'));
  assert.ok(a.spec.corridors.length >= a.spec.rooms.length - 1);
});
