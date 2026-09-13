import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateDungeonSpec } from '../src/dungeon-spec.js';

const fixtureUrl = new URL('../../../spec/dungeon/fixtures/pce-perspective-combat-20-v1.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fixtureUrl, 'utf8'));

test('PCE-1.0 production fixture is a valid DungeonSpec', () => {
  const validation = validateDungeonSpec(fixture);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(fixture.rooms.length, 20);
  assert.equal(fixture.corridors.length, 22);
  assert.equal(fixture.entities.filter((entity) => entity.type === 'start').length, 1);
  assert.equal(fixture.entities.filter((entity) => entity.type === 'goal').length, 1);
  assert.equal(fixture.entities.find((entity) => entity.type === 'start').roomId, 'room-00');
  assert.equal(fixture.entities.find((entity) => entity.type === 'goal').roomId, 'room-10');
});

test('PCE-1.0 production fixture preserves the frozen candidate-change boundary', () => {
  assert.deepEqual(fixture.evaluationMetadata.candidateMayChange, ['play-camera', 'combat-policy']);
  assert.deepEqual(fixture.evaluationMetadata.candidateMustNotChange, [
    'room-graph',
    'entity-placement',
    'landmarks',
    'edit-camera',
    'task-order',
  ]);
});
