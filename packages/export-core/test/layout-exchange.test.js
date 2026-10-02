import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { TRAP_RULES_V1 } from '../../core/src/trap-rules.js';
import { fileURLToPath } from 'node:url';

import {
  createDungeonLayoutExchange,
  createFullDungeonExport,
  importDungeonJson,
  importDungeonLayoutExchange,
  importFullDungeonExport,
  serializeJsonExport,
} from '../src/layout-exchange.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(
  here,
  '../../../spec/dungeon/fixtures/minimal-valid-v1.json',
);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('layout exchange keeps generic geometry and Start/Goal roles only', () => {
  const spec = clone(fixture);
  spec.entities.push({
    id: 'enemy-export-test',
    type: 'enemy',
    roomId: spec.rooms[0].id,
  });

  const exchange = createDungeonLayoutExchange([spec], {
    id: 'layout-test',
    provenance: {
      generatorStrategyId: 'version-2-spatial',
      generatorVersion: '2',
      algorithmVersion: '2',
    },
  });

  assert.equal(exchange.schema, 'dungeon-layout-exchange');
  assert.equal(exchange.schemaVersion, '1.0');
  assert.equal(exchange.floors.length, 1);
  assert.equal(exchange.floors[0].rooms.length, spec.rooms.length);
  assert.equal(
    exchange.floors[0].connections.length,
    spec.corridors.length,
  );
  assert.ok(
    exchange.floors[0].rooms.some((room) =>
      room.roles.includes('start')),
  );
  assert.ok(
    exchange.floors[0].rooms.some((room) =>
      room.roles.includes('goal')),
  );
  assert.equal(JSON.stringify(exchange).includes('enemy-export-test'), false);
  assert.deepEqual(exchange.coordinateSystem, {
    plane: 'XZ',
    units: 'abstract',
    roomPosition: 'center',
    roomSize: 'full-extent',
    positiveX: 'east',
    positiveZ: 'south',
  });
});

test('layout exchange supports multiple floors deterministically', () => {
  const second = clone(fixture);
  second.id = 'minimal-valid-v1-floor-02';
  second.seed += 1;

  const options = {
    id: 'multi-floor-layout',
    provenance: {
      generatorStrategyId: 'algorithm-lab.bsp',
      algorithmVersion: '1',
    },
  };

  const first = createDungeonLayoutExchange(
    [clone(fixture), second],
    options,
  );
  const repeated = createDungeonLayoutExchange(
    [clone(fixture), clone(second)],
    options,
  );

  assert.deepEqual(first, repeated);
  assert.deepEqual(
    first.floors.map((floor) => floor.id),
    ['floor-01', 'floor-02'],
  );
  assert.equal(
    serializeJsonExport(first),
    serializeJsonExport(repeated),
  );
});

test('full export preserves complete DungeonSpec data inside DungeonRunSpec', () => {
  const spec = clone(fixture);
  const exported = createFullDungeonExport(
    [spec],
    { id: 'full-export-test' },
  );

  assert.equal(exported.schemaVersion, '1.0');
  assert.equal(exported.id, 'full-export-test');
  assert.equal(exported.floors.length, 1);
  assert.deepEqual(exported.floors[0].dungeon, spec);
});

test('invalid DungeonSpec export fails closed', () => {
  const invalid = clone(fixture);
  invalid.entities = [];
  assert.throws(
    () => createDungeonLayoutExchange([invalid]),
    /DungeonSpec at index 0 is invalid/,
  );
  assert.throws(
    () => createFullDungeonExport([invalid]),
    /DungeonSpec at index 0 is invalid/,
  );
});


test('layout import round-trips generic geometry and roles deterministically', () => {
  const second = clone(fixture);
  second.id = 'layout-import-floor-02';
  second.seed += 10;

  const exported = createDungeonLayoutExchange(
    [clone(fixture), second],
    {
      id: 'layout-roundtrip',
      provenance: {
        generatorStrategyId: 'version-2-spatial',
        generatorVersion: '2',
        algorithmVersion: '2',
      },
    },
  );

  const imported = importDungeonLayoutExchange(
    serializeJsonExport(exported),
  );
  assert.equal(imported.ok, true);
  assert.equal(imported.format, 'layout');
  assert.equal(imported.dungeons.length, 2);
  assert.deepEqual(imported.provenance, exported.source);

  const reexported = createDungeonLayoutExchange(
    imported.dungeons,
    {
      id: exported.id,
      provenance: imported.provenance,
    },
  );
  assert.equal(
    serializeJsonExport(reexported),
    serializeJsonExport(exported),
  );

  for (const dungeon of imported.dungeons) {
    assert.equal(
      dungeon.entities.filter((entity) => entity.type === 'start').length,
      1,
    );
    assert.equal(
      dungeon.entities.filter((entity) => entity.type === 'goal').length,
      1,
    );
    assert.equal(
      dungeon.entities.some((entity) =>
        ['enemy', 'treasure', 'trap', 'recovery'].includes(entity.type)),
      false,
    );
    assert.deepEqual(dungeon.events, []);
  }
});

test('full DungeonRunSpec import preserves authored data and supplies current trap rules', () => {
  const spec = clone(fixture);
  spec.entities.push({
    id: 'trap-import-test',
    type: 'trap',
    roomId: 'room-middle',
    warning: 'floor-cracks',
  });
  spec.events.push({
    id: 'event-import-test',
    trigger: { type: 'on_enter_room', roomId: 'room-middle' },
    conditions: [{ type: 'one_shot' }],
    actions: [{ type: 'reveal_hint', hintId: 'import-roundtrip' }],
  });

  const exported = createFullDungeonExport(
    [spec],
    { id: 'full-roundtrip' },
  );
  const imported = importFullDungeonExport(
    serializeJsonExport(exported),
  );

  assert.equal(imported.ok, true);
  assert.equal(imported.format, 'full');
  assert.deepEqual(imported.dungeons, [{ ...spec, trapRules: { ...TRAP_RULES_V1 } }]);
  assert.equal(spec.trapRules, undefined);
  assert.equal(exported.floors[0].dungeon.trapRules, undefined);

  const reexported = createFullDungeonExport(
    imported.dungeons,
    { id: exported.id },
  );
  assert.equal(
    serializeJsonExport(reexported),
    serializeJsonExport({ ...exported, floors: exported.floors.map((floor) => ({ ...floor, dungeon: { ...floor.dungeon, trapRules: { ...TRAP_RULES_V1 } } })) }),
  );
});

test('automatic JSON import detects Layout and Full formats', () => {
  const layout = createDungeonLayoutExchange([clone(fixture)], {
    id: 'auto-layout',
  });
  const full = createFullDungeonExport([clone(fixture)], {
    id: 'auto-full',
  });

  assert.equal(importDungeonJson(layout).format, 'layout');
  assert.equal(importDungeonJson(full).format, 'full');
});

test('layout import fails closed on unknown fields and invalid role counts', () => {
  const layout = createDungeonLayoutExchange([clone(fixture)], {
    id: 'bad-layout',
  });

  const unknown = clone(layout);
  unknown.extra = true;
  const unknownResult = importDungeonLayoutExchange(unknown);
  assert.equal(unknownResult.ok, false);
  assert.ok(
    unknownResult.errors.some(
      (entry) =>
        entry.code === 'LAYOUT_IMPORT_TOP_LEVEL_FIELDS_INVALID',
    ),
  );

  const missingStart = clone(layout);
  for (const room of missingStart.floors[0].rooms) {
    room.roles = room.roles.filter((role) => role !== 'start');
  }
  const roleResult = importDungeonLayoutExchange(missingStart);
  assert.equal(roleResult.ok, false);
  assert.ok(
    roleResult.errors.some(
      (entry) => entry.code === 'LAYOUT_IMPORT_START_COUNT_INVALID',
    ),
  );
});

test('layout import rejects non-array collections without throwing or mutating input', () => {
  const layout = createDungeonLayoutExchange([clone(fixture)]);
  for (const [field, code] of [
    ['rooms', 'LAYOUT_IMPORT_ROOMS_INVALID'],
    ['connections', 'LAYOUT_IMPORT_CONNECTIONS_INVALID'],
  ]) {
    for (const value of [{}, 'invalid', 42, false, null, undefined]) {
      const invalid = clone(layout);
      if (value === undefined) delete invalid.floors[0][field];
      else invalid.floors[0][field] = value;
      const before = clone(invalid);

      for (const importer of [importDungeonLayoutExchange, importDungeonJson]) {
        for (const input of [invalid, serializeJsonExport(invalid)]) {
          const result = importer(input);
          assert.equal(result.ok, false);
          assert.equal(result.format, 'layout');
          assert.equal(result.dungeons, null);
          assert.ok(result.errors.some((entry) =>
            entry.code === code && entry.path === `floors[0].${field}`));
        }
      }
      assert.deepEqual(invalid, before);
    }
  }
});

test('layout import reports both invalid collections and continues checking other floors', () => {
  const second = clone(fixture);
  second.id = 'invalid-collections-floor-02';
  const layout = createDungeonLayoutExchange([clone(fixture), second]);
  layout.floors[0].rooms = {};
  layout.floors[0].connections = false;
  layout.floors[1].rooms = 'invalid';
  layout.floors[1].connections = 42;

  const result = importDungeonJson(layout);
  assert.equal(result.ok, false);
  assert.equal(result.dungeons, null);
  assert.deepEqual(result.errors.map(({ code, path }) => ({ code, path })), [
    { code: 'LAYOUT_IMPORT_ROOMS_INVALID', path: 'floors[0].rooms' },
    { code: 'LAYOUT_IMPORT_CONNECTIONS_INVALID', path: 'floors[0].connections' },
    { code: 'LAYOUT_IMPORT_ROOMS_INVALID', path: 'floors[1].rooms' },
    { code: 'LAYOUT_IMPORT_CONNECTIONS_INVALID', path: 'floors[1].connections' },
  ]);
});

test('full import fails closed and leaves source values untouched', () => {
  const exported = createFullDungeonExport([clone(fixture)], {
    id: 'bad-full',
  });
  const invalid = clone(exported);
  invalid.floors[0].dungeon.entities = invalid.floors[0].dungeon.entities
    .filter((entity) => entity.type !== 'goal');

  const before = clone(invalid);
  const result = importFullDungeonExport(invalid);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (entry) => entry.code === 'GOAL_COUNT_INVALID',
    ),
  );
  assert.deepEqual(invalid, before);
});

test('automatic import rejects malformed JSON and unsupported objects', () => {
  const malformed = importDungeonJson('{ nope');
  assert.equal(malformed.ok, false);
  assert.equal(
    malformed.errors[0].code,
    'IMPORT_JSON_PARSE_ERROR',
  );

  const unsupported = importDungeonJson({ hello: 'world' });
  assert.equal(unsupported.ok, false);
  assert.equal(
    unsupported.errors[0].code,
    'IMPORT_FORMAT_UNSUPPORTED',
  );
});

test('optional content-layer provenance survives Layout export/import without claiming a new base generator', () => {
  const source = { generatorStrategyId: 'algorithm-lab.bsp', algorithmVersion: '1', contentLayerVersion: 'special-rooms-1' };
  const value = createDungeonLayoutExchange([fixture], { provenance: source });
  assert.equal(value.source.generatorVersion, undefined);
  const imported = importDungeonLayoutExchange(JSON.stringify(value));
  assert.equal(imported.ok, true);
  assert.equal(imported.provenance.contentLayerVersion, source.contentLayerVersion);
  assert.equal(imported.provenance.generatorStrategyId, source.generatorStrategyId);
});
