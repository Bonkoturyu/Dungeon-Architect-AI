import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { validateDesignIntent } from '../../intent/src/design-intent.js';
import { generateDungeonSpec } from './dungeon-generator.js';
import { createPrng, pickIndex } from './prng.js';

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function seedFromPrompt(prompt) {
  const text = String(prompt ?? '').trim().normalize('NFKC');
  if (!text) throw new TypeError('prompt must be a non-empty string');
  let hash = 0x811c9dc5;
  for (const char of text) {
    const code = char.codePointAt(0);
    hash ^= code & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= (code >>> 8) & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= (code >>> 16) & 0xff;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function deriveGenerationProfile(intent, { seed } = {}) {
  const validation = validateDesignIntent(intent);
  if (!validation.valid) {
    throw new TypeError(`invalid DesignIntent: ${validation.errors.map((entry) => entry.code).join(',')}`);
  }
  if (!Number.isSafeInteger(seed) || seed < 0) throw new TypeError('seed must be a non-negative safe integer');

  return Object.freeze({
    seed,
    roomCount: clampInteger(intent.targetDuration / 60, 5, 20),
    routeChoice: intent.routeChoice,
    enemyCount: clampInteger(intent.combatDensity * 4, 1, 4),
    treasureCount: clampInteger(intent.rewardDensity * 4, 1, 4),
    trapCount: clampInteger(intent.trapDensity * 4, 1, 4),
    recoveryCount: intent.targetDifficulty >= 0.65 || intent.fairness >= 0.75 ? 1 : 0,
  });
}

function pickInteriorRoomIds(spec, count, seed) {
  const candidates = spec.rooms.slice(1, -1).map((room) => room.id);
  if (candidates.length === 0) throw new Error('generated dungeon has no interior rooms');
  const prng = createPrng(seed >>> 0);
  return Array.from({ length: count }, () => candidates[pickIndex(prng, candidates.length)]);
}

function appendEntities(spec, type, count, seed, decorate = () => ({})) {
  const roomIds = pickInteriorRoomIds(spec, count, seed);
  for (let index = 0; index < roomIds.length; index += 1) {
    spec.entities.push({
      id: `${type}-${index + 1}`,
      type,
      roomId: roomIds[index],
      ...decorate(index),
    });
  }
}

export function generateDungeonFromDesignIntent(intent, {
  prompt,
  seed = seedFromPrompt(prompt),
  id = `generated-${seed}`,
} = {}) {
  const profile = deriveGenerationProfile(intent, { seed });
  const spec = generateDungeonSpec({
    seed: profile.seed,
    roomCount: profile.roomCount,
    routeChoice: profile.routeChoice,
    id,
  });

  appendEntities(spec, 'enemy', profile.enemyCount, seed ^ 0x11ee11ee, () => ({
    initiallyActive: true,
  }));
  appendEntities(spec, 'treasure', profile.treasureCount, seed ^ 0x22ee22ee, () => ({
    warning: intent.greedPunishment >= 0.6 || intent.deception >= 0.6 ? 'suspicious-glow' : 'none',
  }));
  appendEntities(spec, 'trap', profile.trapCount, seed ^ 0x33ee33ee, () => ({
    warning: intent.telegraphStrength >= 0.5 ? 'floor-cracks' : 'subtle-draft',
  }));
  if (profile.recoveryCount > 0) {
    appendEntities(spec, 'recovery', profile.recoveryCount, seed ^ 0x44ee44ee);
  }

  const firstTreasure = spec.entities.find((entity) => entity.type === 'treasure');
  if (firstTreasure) {
    spec.events.push({
      id: 'event-treasure-hint-1',
      trigger: { type: 'on_open_treasure', entityId: firstTreasure.id },
      conditions: [{ type: 'one_shot' }],
      actions: [{ type: 'reveal_hint', hintId: 'generated-treasure-hint' }],
    });
  }

  const validation = validateDungeonSpec(spec);
  if (!validation.valid) {
    throw new Error(`generated DungeonSpec failed validation: ${validation.errors.map((entry) => entry.code).join(',')}`);
  }

  return {
    spec,
    profile: { ...profile },
  };
}
