import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { resolveSpecialRoomPresence } from '../packages/intent/src/special-room-presence.js';
import { generateDungeonFromDesignIntentV3 } from '../packages/generator/src/versions/v3/design-intent-generator.js';
import { replayRouteWitnessV3 } from '../packages/generator/src/versions/v3/route-viability.js';
import { createDungeonRunSpec, startDungeonRun, syncDungeonRunFloor } from '../packages/run-core/src/dungeon-run.js';
import { DIFFICULTY_PROFILES, EQUIPMENT_RULES_V1, NORMAL_ROOM_DEFAULTS } from '../apps/editor-slice/room-plan-review.js';

const seedCount = Number(process.argv.find((arg) => arg.startsWith('--seeds='))?.slice(8) ?? 64);
assert.ok(Number.isSafeInteger(seedCount) && seedCount > 0 && seedCount <= 1024);
const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ?? 'artifacts/special-rooms/multifloor-route-viability.json';
const floorSeed = (seed, floorIndex) => (seed + Math.imul(floorIndex, 0x9e3779b9)) >>> 0;
const started = performance.now();
const rows = [];
for (const mode of ['random', 'include', 'exclude']) for (const count of [2, 3, 10]) for (const difficulty of ['easy', 'normal', 'hard']) {
  const profile = DIFFICULTY_PROFILES[difficulty];
  const defaults = { ...NORMAL_ROOM_DEFAULTS, 'monster-house': profile.monsterCount, 'trap-house': profile.trapCount,
    offers: NORMAL_ROOM_DEFAULTS.offers.map((offer) => offer.type === 'healing' ? { ...offer, healing: profile.recoveryHealing } : { ...offer }) };
  for (let seed = 0; seed < seedCount; seed += 1) {
    const requests = mode === 'random' ? [] : ['monster-house', 'trap-house', 'shop'].map((kind) => ({ kind, presence: mode,
      roomCount: 1, entityCount: null, floorNumber: null, roomId: null, offers: [] }));
    const resolved = resolveSpecialRoomPresence({ requests, defaults, floorCount: count, roomsPerFloor: 8, seed });
    const row = { mode, floorCount: count, difficulty, seed, presence: resolved.presence, floors: [], status: null };
    rows.push(row);
    let initialPlayerState = null;
    const generated = [];
    try {
      for (let index = 0; index < count; index += 1) {
        const result = generateDungeonFromDesignIntentV3(DEFAULT_DESIGN_INTENT, { seed: floorSeed(seed, index),
          id: `run-${seed}-floor-${index + 1}`, roomPlans: resolved.roomPlans.filter(({ floorNumber }) => floorNumber === index + 1),
          difficulty, equipmentRules: EQUIPMENT_RULES_V1, initialPlayerState,
          difficultyProfile: Object.fromEntries(['enemyDamage', 'trapDamage', 'recoveryHealing'].map((key) => [key, profile[key]])) });
        const guard = result.profile.routeViability;
        row.floors.push({ floorNumber: index + 1, seed: result.spec.seed, initialPlayerState,
          status: guard.status, changes: guard.changes, policy: guard.witness.policy, pathRoomIds: guard.witness.pathRoomIds,
          finalPlayerState: guard.witness.playerState });
        initialPlayerState = guard.witness.playerState;
        generated.push(result);
      }
      const created = createDungeonRunSpec(generated.map(({ spec }) => spec), { id: `run-${seed}` });
      assert.equal(created.ok, true);
      let run = startDungeonRun(created.spec).run;
      for (const result of generated) {
        const witness = result.profile.routeViability.witness;
        const session = replayRouteWitnessV3(run.currentFloorSession, witness);
        assert.equal(session.status, 'cleared');
        assert.deepEqual(session.playerState, witness.playerState);
        const synced = syncDungeonRunFloor(run, session);
        assert.equal(synced.ok, true);
        run = synced.run;
        assert.deepEqual(run.playerState, witness.playerState);
        if (run.status === 'playing') assert.deepEqual(run.currentFloorSession.playerState, witness.playerState);
      }
      assert.equal(run.status, 'cleared');
      row.status = run.status;
      row.finalPlayerState = run.playerState;
    } catch (error) {
      row.status = 'rejected';
      row.error = { message: error.message, diagnostics: error.diagnostics ?? null };
    }
  }
  const selected = rows.filter((row) => row.mode === mode && row.floorCount === count && row.difficulty === difficulty);
  console.log(JSON.stringify({ mode, count, difficulty, clears: selected.filter(({ status }) => status === 'cleared').length,
    failures: selected.filter(({ status }) => status !== 'cleared').map(({ seed, floors, error }) => ({ seed, floor: floors.length + 1, error: error.message })) }));
}
await mkdir('artifacts/special-rooms', { recursive: true });
await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), seedCount,
  methodology: 'Actual Run/Play witness replay, derivedFloorSeed parity with browser, 8 rooms, default profiles, one special of each included kind across entire run, no HP/G/equipment reset between floors. Bounded deterministic policies demonstrate a route, not every player choice.',
  durationMs: Math.round(performance.now() - started), runCount: rows.length, clearCount: rows.filter(({ status }) => status === 'cleared').length, rows }, null, 2)}\n`);
console.log(JSON.stringify({ output, runs: rows.length, clears: rows.filter(({ status }) => status === 'cleared').length, durationMs: Math.round(performance.now() - started) }));
if (rows.some(({ status }) => status !== 'cleared')) process.exitCode = 1;
