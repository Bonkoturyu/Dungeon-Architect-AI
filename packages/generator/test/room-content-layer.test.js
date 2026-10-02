import assert from 'node:assert/strict';
import test from 'node:test';
import { createBuiltinGeneratorStrategyRegistry } from '../src/strategy-catalog.js';
import { applyRoomContentLayer, ROOM_CONTENT_LAYER_VERSION } from '../src/room-content-layer.js';
import { createRoomPlanConfig } from '../../../apps/editor-slice/room-plan-review.js';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { startPlaySession } from '../../play-core/src/play-session.js';
import { replayRouteWitnessV3 } from '../src/versions/v3/route-viability.js';
const registry = createBuiltinGeneratorStrategyRegistry();
const shape = (spec) => ({ rooms: spec.rooms.map(({ kind, ...room }) => room), corridors: spec.corridors });
const request = (seed, config = {}) => ({ seed, id: 'layer-fixture', prompt: 'layer fixture', intent: DEFAULT_DESIGN_INTENT, options: config });

test('all 11 strategies preserve geometry/provenance or reject infeasible content atomically and deterministically', async () => {
  for (const metadata of registry.list()) for (const seed of [0, 9, 25, 64]) for (const difficulty of ['easy', 'normal', 'hard']) {
    const config = createRoomPlanConfig({ requests: [], floorCount: 1, roomsPerFloor: 8, seed, difficulty, endpointPolicies: { start: 'normal', goal: 'normal' } });
    const base = await registry.generate(metadata.id, request(seed, metadata.id === 'version-3-special-rooms' ? config : {}));
    const before = structuredClone(base);
    assert.equal(applyRoomContentLayer(base, DEFAULT_DESIGN_INTENT, null), base);
    let result;
    try { result = applyRoomContentLayer(base, DEFAULT_DESIGN_INTENT, config); }
    catch (error) {
      assert.match(error.message, /FIRST_SHOP_SURVIVAL_CONFLICT|ROUTE_VIABILITY_CONFLICT/);
      assert.deepEqual(base, before);
      assert.throws(() => applyRoomContentLayer(base, DEFAULT_DESIGN_INTENT, config), (repeat) => repeat.message === error.message);
      continue;
    }
    assert.deepEqual(base, before);
    assert.deepEqual(shape(result.spec), shape(base.spec));
    assert.equal(result.provenance.strategyId, metadata.id);
    assert.equal(result.provenance.algorithmVersion, metadata.algorithmVersion);
    assert.equal(result.provenance.generatorVersion, base.provenance.generatorVersion);
    assert.equal(result.provenance.contentLayerVersion, ROOM_CONTENT_LAYER_VERSION);
    assert.equal(validateDungeonSpec(result.spec).valid, true);
    for (const [type, houseKind] of [['enemy','monster-house'],['trap','trap-house']]) for (const room of result.spec.rooms.filter(({kind})=>kind!==houseKind)) assert.ok(result.spec.entities.filter(e=>e.roomId===room.id&&e.type===type).length<=result.diagnostics.profile.normalRoomDistinction.limits[type]);
    assert.deepEqual(applyRoomContentLayer(base, DEFAULT_DESIGN_INTENT, config), result);
    const witness = result.diagnostics.profile.routeViability.witness;
    assert.equal(replayRouteWitnessV3(startPlaySession(result.spec).session, witness).status, 'cleared');
  }
});

test('all strategies support fixed endpoint kinds without moving Start/Goal or topology', async () => {
  for (const metadata of registry.list()) for (const [start, goal] of [['monster-house', 'shop'], ['shop', 'trap-house'], ['trap-house', 'monster-house']]) {
    const config = createRoomPlanConfig({ requests: [], floorCount: 1, roomsPerFloor: 8, seed: 25, difficulty: 'easy', policies: { 'monster-house': 'exclude', 'trap-house': 'exclude', shop: 'exclude' }, endpointPolicies: { start, goal } });
    const base = await registry.generate(metadata.id, request(25, metadata.id === 'version-3-special-rooms' ? config : {}));
    const result = applyRoomContentLayer(base, DEFAULT_DESIGN_INTENT, config);
    assert.deepEqual(shape(result.spec), shape(base.spec));
    for (const [role, kind] of Object.entries({ start, goal })) {
      const id = result.spec.entities.find(({ type }) => type === role).roomId;
      assert.equal(result.spec.rooms.find((room) => room.id === id).kind, kind);
    }
    assert.equal(replayRouteWitnessV3(startPlaySession(result.spec).session, result.diagnostics.profile.routeViability.witness).status, 'cleared');
  }
});

test('BSP multi-floor layer carries the prior witness state rather than restoring HP', async () => {
  let state = null;
  const config = createRoomPlanConfig({ requests: [], floorCount: 3, roomsPerFloor: 8, seed: 25, difficulty: 'easy', endpointPolicies: { start: 'trap-house', goal: 'shop' } });
  for (let floor = 1; floor <= 3; floor++) {
    const floorConfig = { ...config, initialPlayerState: state, roomPlans: config.roomPlans.filter(({ floorNumber }) => floorNumber === floor) };
    const base = await registry.generate('algorithm-lab.bsp', request(25 + floor));
    const result = applyRoomContentLayer(base, DEFAULT_DESIGN_INTENT, floorConfig);
    const witness = result.diagnostics.profile.routeViability.witness;
    const session = replayRouteWitnessV3(startPlaySession(result.spec, { initialPlayerState: state }).session, witness);
    assert.equal(session.status, 'cleared'); assert.deepEqual(session.playerState, witness.playerState); state = session.playerState;
  }
});

test('content layer V1 remains selectable while V2 enforces smaller non-house counts', async () => {
  let adjusted = 0;
  for (let seed=0;seed<24;seed++) {
    const config=createRoomPlanConfig({requests:[],floorCount:1,roomsPerFloor:8,seed,difficulty:'easy',policies:{'monster-house':'exclude','trap-house':'exclude',shop:'exclude'},endpointPolicies:{start:'normal',goal:'normal'}});
    const base=await registry.generate('algorithm-lab.bsp',request(seed));
    const archived=applyRoomContentLayer(base,DEFAULT_DESIGN_INTENT,config,{version:'special-rooms-1'});
    assert.equal(archived.provenance.contentLayerVersion,'special-rooms-1');
    const next=applyRoomContentLayer(base,DEFAULT_DESIGN_INTENT,config,{version:'special-rooms-2'});
    assert.equal(next.provenance.contentLayerVersion,'special-rooms-2');
    assert.equal(next.spec.trapRules,undefined);
    assert.deepEqual(shape(next.spec),shape(archived.spec));
    const limits=next.diagnostics.profile.normalRoomDistinction.limits;
    assert.deepEqual(limits,{enemy:1,trap:2});
    for(const room of next.spec.rooms)for(const type of ['enemy','trap'])assert.ok(next.spec.entities.filter(e=>e.roomId===room.id&&e.type===type).length<=limits[type]);
    adjusted+=Number(next.diagnostics.profile.normalRoomDistinction.changes.length>0);
  }
  assert.ok(adjusted>0);
});
