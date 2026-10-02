import assert from 'node:assert/strict';
import test from 'node:test';
import * as layers from '../src/room-content-layer.js';
import { createBuiltinGeneratorStrategyRegistry } from '../src/strategy-catalog.js';
import { generateDungeonSpec } from '../src/dungeon-generator.js';
import { DEFAULT_DESIGN_INTENT as intent } from '../../intent/src/design-intent.js';
import { TRAP_RULES_V1 } from '../../core/src/trap-rules.js';
import { createFullDungeonExport, importDungeonJson } from '../../export-core/src/layout-exchange.js';
import { startPlaySession, movePlaySession } from '../../play-core/src/play-session.js';
import { avoidTrap, getTrapAvoidanceChance } from '../../play-core/src/interaction-runtime.js';
import { createShortestPathAgent } from '../../simulation-core/src/agents.js';
import { simulateDungeon } from '../../simulation-core/src/simulator.js';

test('only the current content layer is exposed while all 11 terrain strategies remain available', async () => {
  for (const name of ['applyRoomContentLayerV1', 'applyRoomContentLayerV2', 'ROOM_CONTENT_LAYER_V1_VERSION', 'ROOM_CONTENT_LAYER_V2_VERSION']) assert.equal(Object.hasOwn(layers, name), false);
  const registry = createBuiltinGeneratorStrategyRegistry();
  assert.equal(registry.list().length, 11);
  for (const { id } of registry.list()) {
    const generated = await registry.generate(id, { seed: 0, id: 'rules-fixture', prompt: 'fixture', intent, options: {} });
    const before = structuredClone(generated);
    const session = startPlaySession(generated.spec).session;
    assert.equal(getTrapAvoidanceChance(session), 0.7);
    assert.deepEqual(session.snapshot.trapRules, TRAP_RULES_V1);
    for (const version of ['special-rooms-1', 'special-rooms-2']) assert.throws(() => layers.applyRoomContentLayer(generated, intent, {}, { version }), /ROOM_CONTENT_LAYER_VERSION_UNSUPPORTED/);
    assert.deepEqual(generated, before);
  }
});

test('old multi-floor JSON gains only the current rules, preserving every authored field and explicit count', () => {
  const spec = generateDungeonSpec({ seed: 2, roomCount: 3, routeChoice: 0 });
  spec.entities.push(...Array.from({ length: 100 }, (_, index) => ({ id: `fixed-trap-${index}`, type: 'trap', roomId: 'room-002', damage: 6 })));
  const source = createFullDungeonExport([spec, { ...structuredClone(spec), id: 'floor-two', seed: 3 }]);
  const before = structuredClone(source);
  const result = importDungeonJson(source);
  assert.equal(result.ok, true);
  for (const [index, dungeon] of result.dungeons.entries()) {
    const { trapRules, ...authored } = dungeon;
    assert.deepEqual(trapRules, TRAP_RULES_V1);
    assert.deepEqual(authored, source.floors[index].dungeon);
    assert.equal(dungeon.entities.filter(({ type }) => type === 'trap').length, 100);
  }
  assert.deepEqual(source, before);
  assert.deepEqual(importDungeonJson(createFullDungeonExport(result.dungeons)).dungeons, result.dungeons);
});

test('omitted rules, imported JSON, and explicit current rules share Play and simulation outcomes', () => {
  for (const [seed, hp] of [[0, 20], [2, 14]]) {
    const spec = generateDungeonSpec({ seed, roomCount: 3, routeChoice: 0 });
    spec.entities.push({ id: 'trap-test', type: 'trap', roomId: 'room-002', damage: 6 });
    const explicit = { ...structuredClone(spec), trapRules: { ...TRAP_RULES_V1 } };
    const imported = importDungeonJson(createFullDungeonExport([spec])).dungeons[0];
    const run = (dungeon) => simulateDungeon(dungeon, createShortestPathAgent(dungeon));
    assert.deepEqual(run(spec), run(explicit)); assert.deepEqual(run(spec), run(imported));
    assert.equal(run(spec).simulation.result.playerState.hp, hp);
    const entered = movePlaySession(startPlaySession(spec).session, 'room-002').session;
    assert.equal(movePlaySession(entered, 'room-003').error.code, 'SPECIAL_ROOM_BLOCKED');
    assert.equal(avoidTrap(entered, 'trap-test').session.playerState.hp, hp);
    assert.equal(spec.trapRules, undefined);
  }
});
