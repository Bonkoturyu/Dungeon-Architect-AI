import test from 'node:test';
import assert from 'node:assert/strict';
import { createDungeonScenePlan, DungeonScenePlanError } from '../src/scene-plan.js';

const fixture = {
  schemaVersion: '1.0',
  id: 'fixture-renderer-three',
  seed: 1,
  rooms: [
    { id: 'a', x: 0, z: 0, width: 8, depth: 8 },
    { id: 'b', x: 12, z: 0, width: 8, depth: 8 },
    { id: 'c', x: 12, z: 12, width: 8, depth: 8 },
  ],
  corridors: [
    { id: 'ab', fromRoomId: 'a', toRoomId: 'b', width: 3 },
    { id: 'bc', fromRoomId: 'b', toRoomId: 'c', width: 2 },
  ],
  entities: [
    { id: 'start', type: 'start', roomId: 'a' },
    { id: 'goal', type: 'goal', roomId: 'c' },
  ],
  events: [],
};

test('builds deterministic room/corridor/marker plan', () => {
  const first = createDungeonScenePlan(fixture);
  const second = createDungeonScenePlan(structuredClone(fixture));

  assert.deepEqual(first, second);
  assert.equal(first.roomGroups.length, 3);
  assert.equal(first.roomGroups[0].boxes.length, 5);
  assert.equal(first.corridorGroups.length, 2);
  assert.equal(first.markers.length, 2);
});

test('corridor geometry follows room centers', () => {
  const plan = createDungeonScenePlan(fixture);
  const horizontal = plan.corridorGroups[0].boxes[0];
  assert.equal(horizontal.position.x, 6);
  assert.equal(horizontal.position.z, 0);
  assert.equal(horizontal.size.x, 12);
  assert.equal(horizontal.rotationY, 0);

  const vertical = plan.corridorGroups[1].boxes[0];
  assert.equal(vertical.position.x, 12);
  assert.equal(vertical.position.z, 6);
  assert.equal(vertical.size.x, 12);
  assert.equal(vertical.rotationY, -Math.PI / 2);
});

test('rejects invalid DungeonSpec before planning', () => {
  const invalid = { ...fixture, entities: [] };
  assert.throws(() => createDungeonScenePlan(invalid), DungeonScenePlanError);
});
