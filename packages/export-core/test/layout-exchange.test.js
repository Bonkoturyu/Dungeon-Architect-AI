import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createDungeonLayoutExchange,
  createFullDungeonExport,
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
