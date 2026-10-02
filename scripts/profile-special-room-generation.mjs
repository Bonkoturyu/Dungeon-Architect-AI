import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { resolveSpecialRoomPresence } from '../packages/intent/src/special-room-presence.js';
import { generateDungeonFromDesignIntentV3 } from '../packages/generator/src/versions/v3/design-intent-generator.js';
import { DIFFICULTY_PROFILES, EQUIPMENT_RULES_V1, NORMAL_ROOM_DEFAULTS } from '../apps/editor-slice/room-plan-review.js';

const rows = [];
function generate(floorCount, difficulty, seed) {
  const profile = DIFFICULTY_PROFILES[difficulty];
  const defaults = { ...NORMAL_ROOM_DEFAULTS, 'monster-house': profile.monsterCount, 'trap-house': profile.trapCount,
    offers: NORMAL_ROOM_DEFAULTS.offers.map((offer) => offer.type === 'healing' ? { ...offer, healing: profile.recoveryHealing } : { ...offer }) };
  const resolved = resolveSpecialRoomPresence({ requests: [], defaults, floorCount, roomsPerFloor: 8, seed });
  const floors = [];
  let initialPlayerState = null;
  for (let index = 0; index < floorCount; index += 1) {
    const result = generateDungeonFromDesignIntentV3(DEFAULT_DESIGN_INTENT, { seed: (seed + Math.imul(index, 0x9e3779b9)) >>> 0,
      id: `bench-floor-${index + 1}`, difficulty, difficultyProfile: Object.fromEntries(['enemyDamage', 'trapDamage', 'recoveryHealing'].map((key) => [key, profile[key]])),
      roomPlans: resolved.roomPlans.filter(({ floorNumber }) => floorNumber === index + 1), equipmentRules: EQUIPMENT_RULES_V1, initialPlayerState });
    initialPlayerState = result.profile.routeViability.witness.playerState;
    floors.push(result);
  }
  return floors;
}
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
for (const floorCount of [1, 3, 10]) for (const difficulty of ['easy', 'normal', 'hard']) for (const seed of [0, 45]) {
  for (let index = 0; index < 5; index += 1) generate(floorCount, difficulty, seed);
  const samples = [];
  const baseline = hash(generate(floorCount, difficulty, seed));
  for (let index = 0; index < 30; index += 1) {
    const start = performance.now();
    const result = generate(floorCount, difficulty, seed);
    samples.push(performance.now() - start);
    assert.equal(hash(result), baseline);
  }
  samples.sort((left, right) => left - right);
  const row = { floorCount, difficulty, seed, warmup: 5, repeats: 30, medianMs: samples[15], p95Ms: samples[28], outputSha256: baseline };
  rows.push(row);
  console.log(JSON.stringify(row));
}
await writeFile('artifacts/special-rooms/generation-after-route-guard.json', `${JSON.stringify({ generatedAt: new Date().toISOString(),
  methodology: 'Pure Node total V3 generation including seeded tri-state presence, actual Play route witnesses, any relocation, and carried HP/G/equipment checks. 8 rooms per floor; 5 warmups and 30 samples. Hash validation excluded from timings. Seed 0 representative; seed 45 exercises correction. This supersedes pre-guard generation timings, not a same-code old/new speedup claim.', rows }, null, 2)}\n`);
