import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIXTURE_ID,
  corridorGeometry,
  createFixture,
  expectedBoxCount,
} from './fixture.js';

test('renderer benchmark fixture shape is stable', () => {
  const fixture = createFixture();
  assert.equal(fixture.id, FIXTURE_ID);
  assert.equal(fixture.rooms.length, 20);
  assert.equal(fixture.corridors.length, 19);
  assert.equal(expectedBoxCount(fixture), 119);
});

test('corridor geometry is deterministic', () => {
  const fixture = createFixture();
  const first = corridorGeometry(fixture.corridors[0]);
  const again = corridorGeometry(fixture.corridors[0]);
  assert.deepEqual(first, again);
  assert.ok(first.length > 0);
});
