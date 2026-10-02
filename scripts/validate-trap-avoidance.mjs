import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { createRoomPlanConfig } from '../apps/editor-slice/room-plan-review.js';
import { createBuiltinGeneratorStrategyRegistry } from '../packages/generator/src/strategy-catalog.js';
import { applyRoomContentLayer } from '../packages/generator/src/room-content-layer.js';
import { replayRouteWitnessV3 } from '../packages/generator/src/versions/v3/route-viability.js';
import { createDungeonRunSpec, startDungeonRun, syncDungeonRunFloor } from '../packages/run-core/src/dungeon-run.js';
import { TRAP_RULES_V1 } from '../packages/core/src/trap-rules.js';

const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const seeds = Number(option('seeds', '4'));
assert.ok(Number.isInteger(seeds) && seeds > 0 && seeds <= 64);
const output = option('output', 'artifacts/trap-avoidance/route-matrix.json');
const registry = createBuiltinGeneratorStrategyRegistry();
const strategies = registry.list().filter(({ id }) => option('strategy', 'all') === 'all' || id === option('strategy'));
assert.ok(strategies.length > 0);
const rows = [], started = performance.now();
const shape = (spec) => ({ rooms: spec.rooms.map(({ kind, ...room }) => room), corridors: spec.corridors });
for (const { id: strategyId } of strategies) {
  for (const difficulty of ['easy', 'normal', 'hard']) for (const presence of ['random', 'include', 'exclude']) for (const count of [1, 3, 10]) for (let seed = 0; seed < seeds; seed++) {
    const policies = Object.fromEntries(['monster-house', 'trap-house', 'shop'].map((kind) => [kind, presence]));
    const config = createRoomPlanConfig({ requests: [], floorCount: count, seed, difficulty, policies, endpointPolicies: { start: 'normal', goal: 'normal' } });
    const row = { strategyId, difficulty, presence, count, seed, status: null, floors: [], failuresTriggered: 0 };
    rows.push(row);
    const floors = []; let initialPlayerState = null;
    try {
      for (let index = 0; index < count; index++) {
        const floorConfig = { ...config, trapRules: { ...TRAP_RULES_V1 }, initialPlayerState, roomPlans: config.roomPlans.filter(({ floorNumber }) => floorNumber === index + 1) };
        const request = { seed: (seed + Math.imul(index, 0x9e3779b9)) >>> 0, id: `trap-matrix-${seed}-floor-${index + 1}`, prompt: 'Trap avoidance route validation', intent: DEFAULT_DESIGN_INTENT, options: floorConfig };
        const base = await registry.generate(strategyId, request), original = structuredClone(base);
        let generated;
        try { generated = applyRoomContentLayer(base, DEFAULT_DESIGN_INTENT, floorConfig); }
        finally { assert.deepEqual(base, original); }
        assert.deepEqual(shape(generated.spec), shape(base.spec));
        assert.deepEqual(generated.spec.trapRules, TRAP_RULES_V1);
        assert.equal(generated.provenance.contentLayerVersion, 'special-rooms-3');
        const witness = generated.diagnostics.profile.routeViability.witness;
        assert.ok(witness.survives);
        for (const plan of floorConfig.roomPlans) {
          const type = plan.kind === 'monster-house' ? 'enemy' : plan.kind === 'trap-house' ? 'trap' : 'shop';
          const prefix = `v3:${plan.id}:`;
          const entities = generated.spec.entities.filter(({ id }) => id.startsWith(prefix));
          assert.equal(entities.filter((entity) => entity.type === type).length, type === 'shop' ? 1 : plan.entityCount);
          if (plan.roomId !== null) assert.ok(entities.every(({ roomId }) => roomId === plan.roomId));
        }
        if (seed === 0) assert.deepEqual(applyRoomContentLayer(await registry.generate(strategyId, request), DEFAULT_DESIGN_INTENT, floorConfig), generated);
        row.floors.push({ seed: generated.spec.seed, initialHp: initialPlayerState?.hp ?? 20, finalHp: witness.playerState.hp, policy: witness.policy, adjustments: generated.diagnostics.profile.routeViability.changes });
        initialPlayerState = witness.playerState;
        floors.push(generated);
      }
    } catch (error) {
      if (!/FIRST_SHOP_SURVIVAL_CONFLICT|ROUTE_VIABILITY_CONFLICT|NORMAL_ROOM_.*CONFLICT/.test(error.message)) throw error;
      row.status = 'constraint-rejected'; row.error = error.message; continue;
    }
    const created = createDungeonRunSpec(floors.map(({ spec }) => spec)); assert.equal(created.ok, true);
    let run = startDungeonRun(created.spec).run;
    for (const generated of floors) {
      const witness = generated.diagnostics.profile.routeViability.witness;
      const session = replayRouteWitnessV3(run.currentFloorSession, witness);
      assert.equal(session.status, 'cleared'); assert.deepEqual(session.playerState, witness.playerState);
      row.failuresTriggered += session.gameplayState.counters.trapsTriggered;
      const synced = syncDungeonRunFloor(run, session); assert.equal(synced.ok, true); run = synced.run;
      assert.deepEqual(run.playerState, witness.playerState);
      if (run.status === 'playing') assert.deepEqual(run.currentFloorSession.playerState, witness.playerState);
    }
    assert.equal(run.status, 'cleared'); row.status = 'cleared';
  }
  const subset = rows.filter((row) => row.strategyId === strategyId);
  console.log(JSON.stringify({ strategyId, cases: subset.length, clears: subset.filter(({ status }) => status === 'cleared').length, rejected: subset.filter(({ status }) => status === 'constraint-rejected').length, failuresTriggered: subset.reduce((total, row) => total + row.failuresTriggered, 0) }));
}
assert.ok(rows.some(({ failuresTriggered }) => failuresTriggered > 0));
const summary = { generatedAt: new Date().toISOString(), rules: TRAP_RULES_V1, successChance: 0.7,
  methodology: 'All selected strategies; easy/normal/hard; random/include/exclude; 1/3/10 floors; actual immutable Play/Run witness replay with exact HP/XP/G/equipment carry. Every accepted dungeon has a replayed safe route including fixed avoidance failures. Explicit conflicts reject; no trap-result rerolls or authored house-count/damage/reward changes. The inherited normal-room capacity policy may redistribute or remove automatic overflow. This bounded offline search is not a human-play or universal solvability study.',
  cases: rows.length, clears: rows.filter(({ status }) => status === 'cleared').length,
  rejected: rows.filter(({ status }) => status === 'constraint-rejected').length,
  failuresTriggered: rows.reduce((total, row) => total + row.failuresTriggered, 0), durationMs: Math.round(performance.now() - started), rows };
await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ ...summary, rows: undefined, output }));
