import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { validateDungeonSpec } from '../packages/core/src/dungeon-spec.js';
import { generateDungeonFromDesignIntent } from '../packages/generator/src/design-intent-generator.js';
import { generateDungeonSpecV3 } from '../packages/generator/src/dungeon-generator.js';
import { createBuiltinGeneratorStrategyRegistry } from '../packages/generator/src/strategy-catalog.js';
import { EditSession } from '../packages/editor-core/src/edit-session.js';
import { startPlaySession, movePlaySession } from '../packages/play-core/src/play-session.js';
import { resolveEnemyCombat } from '../packages/play-core/src/enemy-runtime.js';
import { openTreasure } from '../packages/play-core/src/interaction-runtime.js';
import { purchaseShopOffer } from '../packages/play-core/src/shop-runtime.js';
import { createDungeonRunSpec, validateDungeonRunSpec } from '../packages/run-core/src/dungeon-run.js';
import { createDungeonLayoutExchange, createFullDungeonExport, serializeJsonExport, importDungeonLayoutExchange, importFullDungeonExport } from '../packages/export-core/src/layout-exchange.js';
import { simulateDungeon } from '../packages/simulation-core/src/simulator.js';
import { simulateDungeonRun } from '../packages/simulation-core/src/run-simulator.js';

const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ?? 'artifacts/special-rooms/core-profile-before.json';
const WARMUP = 5;
const LIGHT_REPEATS = 100;
const HEAVY_REPEATS = 30;
const results = [];
const checksum = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const ok = (result) => { assert.equal(result.ok, true, JSON.stringify(result.error ?? result.errors)); return result; };
const quantile = (sorted, portion) => sorted[Math.ceil(sorted.length * portion) - 1];

async function measure(name, run, { setup = () => null, repeats = LIGHT_REPEATS, metadata = {}, verify = () => {} } = {}) {
  const samples = [];
  let firstHash = null;
  let lastHash = null;
  for (let index = -WARMUP; index < repeats; index += 1) {
    const state = await setup();
    const before = performance.now();
    const value = await run(state);
    const elapsed = performance.now() - before;
    verify(value);
    if (index >= 0) {
      samples.push(elapsed);
      if (index === 0) firstHash = checksum(value);
      if (index === repeats - 1) lastHash = checksum(value);
    }
  }
  assert.equal(firstHash, lastHash, `${name}: deterministic output changed during repeats`);
  samples.sort((a, b) => a - b);
  const result = { name, ...metadata, warmup: WARMUP, repeats,
    medianMs: quantile(samples, 0.5), p95Ms: quantile(samples, 0.95), minMs: samples[0], maxMs: samples.at(-1),
    outputSha256: firstHash, outputStable: true };
  results.push(result);
  console.log(JSON.stringify(result));
}

const seed = 20261002;
const options = { seed, prompt: 'core performance fixture', id: 'core-profile' };
for (const version of ['1', '2', '3']) {
  await measure(`generate.intent.v${version}.1floor`, () => generateDungeonFromDesignIntent(DEFAULT_DESIGN_INTENT, { ...options, version }), { metadata: { floors: 1, content: 'baseline-intent' } });
  await measure(`generate.intent.v${version}.10floors`, () => Array.from({ length: 10 }, (_, index) => generateDungeonFromDesignIntent(DEFAULT_DESIGN_INTENT, { ...options, version, seed: seed + index, id: `core-profile-${index}` })), { repeats: HEAVY_REPEATS, metadata: { floors: 10, content: 'baseline-intent' } });
}
const registry = createBuiltinGeneratorStrategyRegistry();
for (const strategy of registry.list().filter(({ family }) => family === 'algorithm-lab')) {
  await measure(`generate.${strategy.id}.1floor`, () => registry.generate(strategy.id, { ...options, intent: DEFAULT_DESIGN_INTENT }), { metadata: { floors: 1, content: 'baseline-intent' } });
}

function fixtureOptions(count, index = 0) {
  return { seed: seed + index, id: `core-size-${count}-floor-${index}`, roomCount: 8, routeChoice: 0,
    specialRoomEntityLimit: Math.max(100, count),
    difficultyProfile: { enemyDamage: 4, trapDamage: 6, recoveryHealing: 8 },
    equipmentRules: { weaponEnemyReductionPerTier: 1, armorDamageReductionPerTier: 1, minimumPositiveDamage: 1 },
    roomPlans: [
      { id: 'shop', kind: 'shop', floorNumber: index + 1, roomId: 'room-002', entityCount: null,
        offers: [{ id: 'weapon', type: 'weapon', price: 30, stock: 1, tier: 3 }, { id: 'healing', type: 'healing', price: 10, stock: 1, healing: 8 }] },
      { id: 'monsters', kind: 'monster-house', floorNumber: index + 1, roomId: 'room-003', entityCount: count / 2, offers: [] },
      { id: 'traps', kind: 'trap-house', floorNumber: index + 1, roomId: 'room-004', entityCount: count / 2, offers: [] },
    ] };
}

// simulator自体の全ステップ負荷を測る政策。defeat-enemyは既存の抽象操作で、戦闘勝率の主張ではない。
function throughputPolicy(observation) {
  if (observation.enemies.length) return { type: 'defeat-enemy', enemyId: observation.enemies[0].id };
  const trap = observation.interactables.find(({ type }) => type === 'trap');
  if (trap) return { type: 'avoid-trap', trapId: trap.id };
  const treasure = observation.interactables.find(({ type }) => type === 'treasure');
  if (treasure) return { type: 'open-treasure', treasureId: treasure.id };
  const next = `room-${String(Number(observation.currentRoomId.slice(5)) + 1).padStart(3, '0')}`;
  return { type: 'move', roomId: next };
}

const started = performance.now();
for (const count of [10, 100, 250]) {
  const meta = { houseEntities: count, roomsPerFloor: 8 };
  const spec = generateDungeonSpecV3(fixtureOptions(count));
  const specHash = checksum(spec);
  const moveEntity = spec.entities.find(({ type }) => type === 'treasure');
  const command = { type: 'move-entity', entityId: moveEntity.id, roomId: 'room-007' };
  await measure(`generate.v3.${count}.1floor`, () => generateDungeonSpecV3(fixtureOptions(count)), { metadata: { ...meta, floors: 1 } });
  await measure(`generate.v3.${count}.10floors`, () => Array.from({ length: 10 }, (_, index) => generateDungeonSpecV3(fixtureOptions(count, index))), { repeats: HEAVY_REPEATS, metadata: { ...meta, floors: 10 } });
  await measure(`validate.spec.${count}`, () => validateDungeonSpec(spec), { metadata: meta, verify: (value) => assert.equal(value.valid, true) });
  await measure(`edit.apply.${count}`, (session) => session.apply(command), { setup: () => new EditSession(spec), metadata: meta, verify: ok });
  await measure(`edit.undo.${count}`, (session) => session.undo(), { setup: () => { const session = new EditSession(spec); ok(session.apply(command)); return session; }, metadata: meta, verify: ok });
  await measure(`play.start.${count}`, () => startPlaySession(spec), { metadata: meta, verify: ok });
  const initial = ok(startPlaySession(spec)).session;
  const budget = spec.entities.find(({ id }) => id.startsWith('v3:shop-budget:'));
  const funded = ok(openTreasure(initial, budget.id)).session;
  const atShop = ok(movePlaySession(funded, 'room-002')).session;
  const equipped = ok(purchaseShopOffer(atShop, 'v3:shop:shop', 'weapon')).session;
  const atHouse = ok(movePlaySession(equipped, 'room-003')).session;
  await measure(`play.move.safe.${count}`, () => movePlaySession(funded, 'room-002'), { metadata: meta, verify: ok });
  await measure(`play.move.spawnHouse.${count}`, () => movePlaySession(equipped, 'room-003'), { metadata: meta, verify: ok });
  await measure(`play.purchase.${count}`, () => purchaseShopOffer(atShop, 'v3:shop:shop', 'weapon'), { metadata: meta, verify: ok });
  await measure(`play.combat.${count}`, () => resolveEnemyCombat(atHouse, 'v3:monsters:enemy-1'), { metadata: meta, verify: ok });
  for (const floorCount of [1, 10]) {
    const floors = Array.from({ length: floorCount }, (_, index) => generateDungeonSpecV3(fixtureOptions(count, index)));
    const run = ok(createDungeonRunSpec(floors, { id: 'core-profile-run' })).spec;
    await measure(`validate.run.${count}.${floorCount}floors`, () => validateDungeonRunSpec(run), { metadata: { ...meta, floors: floorCount }, verify: (value) => assert.equal(value.valid, true) });
    const full = serializeJsonExport(createFullDungeonExport(floors, { id: 'core-full' }));
    const layout = serializeJsonExport(createDungeonLayoutExchange(floors, { id: 'core-layout' }));
    await measure(`export.full.${count}.${floorCount}floors`, () => serializeJsonExport(createFullDungeonExport(floors, { id: 'core-full' })), { metadata: { ...meta, floors: floorCount, bytes: Buffer.byteLength(full) } });
    await measure(`import.full.${count}.${floorCount}floors`, () => importFullDungeonExport(full), { metadata: { ...meta, floors: floorCount, bytes: Buffer.byteLength(full) }, verify: ok });
    await measure(`export.layout.${count}.${floorCount}floors`, () => serializeJsonExport(createDungeonLayoutExchange(floors, { id: 'core-layout' })), { metadata: { ...meta, floors: floorCount, bytes: Buffer.byteLength(layout) } });
    await measure(`import.layout.${count}.${floorCount}floors`, () => importDungeonLayoutExchange(layout), { metadata: { ...meta, floors: floorCount, bytes: Buffer.byteLength(layout) }, verify: ok });
    if (floorCount === 1) {
      await measure(`simulate.single.${count}`, () => simulateDungeon(spec, throughputPolicy, { policyId: 'throughput-abstract-clear', maxSteps: count + 32 }), { repeats: HEAVY_REPEATS, metadata: { ...meta, floors: 1, policy: 'abstract enemy clear, avoid traps, collect treasure; no shop simulation action exists' }, verify: (value) => { ok(value); assert.equal(value.simulation.status, 'cleared'); } });
    } else if (count === 10) {
      await measure(`simulate.run.${count}.10floors`, () => simulateDungeonRun(run, () => throughputPolicy, { policyId: 'throughput-abstract-clear', maxStepsPerFloor: count + 32 }), { repeats: HEAVY_REPEATS, metadata: { ...meta, floors: 10, policy: 'abstract enemy clear, avoid traps, collect treasure' }, verify: (value) => { ok(value); assert.equal(value.simulation.status, 'cleared'); } });
    }
  }
  assert.equal(checksum(spec), specHash, 'profile mutated authoring fixture');
}

const sourceFiles = [
  'packages/core/src/dungeon-spec.js', 'packages/generator/src/versions/v3/shop-placement.js',
  'packages/play-core/src/play-session.js', 'packages/play-core/src/event-runtime.js', 'packages/play-core/src/enemy-runtime.js',
  'packages/play-core/src/gameplay-state.js', 'packages/editor-core/src/edit-session.js',
  'packages/export-core/src/layout-exchange.js', 'packages/simulation-core/src/simulator.js',
];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async (path) => [path, checksum(await readFile(path, 'utf8'))])));
const artifact = { generatedAt: new Date().toISOString(), environment: { node: process.version, platform: process.platform, architecture: process.arch, cpus: os.cpus().length, cpu: os.cpus()[0]?.model },
  methodology: { warmup: WARMUP, lightRepeats: LIGHT_REPEATS, heavyRepeats: HEAVY_REPEATS,
    seed, fixture: 'Eight rooms, linear corridor; explicit shop room2, MonsterHouse room3, TrapHouse room4. Special count split evenly enemies/traps. No paid/network API.',
    measurement: 'Awaited pure-core operation wall time; setup, assertions and output hashing excluded. Warmup excluded; no forced GC. First/last repeated outputs hash-identical.',
    scopeLimits: ['No rendering/DOM/network measured', 'Simulator lacks shop purchase action; throughput uses existing abstract defeat-enemy operation, not survivability validation',
      '10-floor simulator measured for small content only; all content levels use 1/10-floor validation/export/import and generation'],
  }, sourceHashes, durationMs: Math.round(performance.now() - started), results,
  slowestByMedian: [...results].sort((a, b) => b.medianMs - a.medianMs).slice(0, 12),
};
await mkdir('artifacts/special-rooms', { recursive: true });
await writeFile(output, JSON.stringify(artifact, null, 2) + '\n');
console.log(JSON.stringify({ output, cases: results.length, durationMs: artifact.durationMs }));
