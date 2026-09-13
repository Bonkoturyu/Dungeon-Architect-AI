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

function roomGroup(plan, id) {
  return plan.roomGroups.find((room) => room.specId === id);
}

function openings(room, corridorId) {
  return room.doorOpenings.filter((opening) => opening.corridorId === corridorId);
}

test('builds deterministic room/corridor/marker plan', () => {
  const first = createDungeonScenePlan(fixture);
  const second = createDungeonScenePlan(structuredClone(fixture));

  assert.deepEqual(first, second);
  assert.equal(first.roomGroups.length, 3);
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

test('cardinal corridors carve matching wall openings at both endpoints', () => {
  const plan = createDungeonScenePlan(fixture);
  const a = roomGroup(plan, 'a');
  const b = roomGroup(plan, 'b');
  const c = roomGroup(plan, 'c');

  assert.deepEqual(openings(a, 'ab').map((opening) => opening.side), ['east']);
  assert.deepEqual(openings(b, 'ab').map((opening) => opening.side), ['west']);
  assert.deepEqual(openings(b, 'bc').map((opening) => opening.side), ['south']);
  assert.deepEqual(openings(c, 'bc').map((opening) => opening.side), ['north']);

  assert.equal(openings(a, 'ab')[0].width, 3);
  assert.equal(openings(b, 'bc')[0].width, 2);
  assert.equal(a.boxes.filter((box) => box.part.startsWith('wall-east-')).length, 2);
  assert.equal(b.boxes.filter((box) => box.part.startsWith('wall-south-')).length, 2);
});

test('diagonal corridor carves both walls when its width crosses a room corner', () => {
  const diagonal = {
    schemaVersion: '1.0',
    id: 'diagonal-door-fixture',
    seed: 2,
    rooms: [
      { id: 'a', x: 0, z: 0, width: 8, depth: 8 },
      { id: 'b', x: 12, z: 12, width: 8, depth: 8 },
    ],
    corridors: [
      { id: 'diag', fromRoomId: 'a', toRoomId: 'b', width: 3 },
    ],
    entities: [
      { id: 'start', type: 'start', roomId: 'a' },
      { id: 'goal', type: 'goal', roomId: 'b' },
    ],
    events: [],
  };

  const plan = createDungeonScenePlan(diagonal);
  assert.deepEqual(openings(roomGroup(plan, 'a'), 'diag').map((opening) => opening.side).sort(), ['east', 'south']);
  assert.deepEqual(openings(roomGroup(plan, 'b'), 'diag').map((opening) => opening.side).sort(), ['north', 'west']);
});

test('overlapping openings on the same wall are merged for wall segmentation', () => {
  const multi = {
    schemaVersion: '1.0',
    id: 'overlap-door-fixture',
    seed: 3,
    rooms: [
      { id: 'a', x: 0, z: 0, width: 8, depth: 8 },
      { id: 'b', x: 12, z: 0, width: 8, depth: 8 },
      { id: 'c', x: 12, z: 2, width: 8, depth: 8 },
    ],
    corridors: [
      { id: 'ab', fromRoomId: 'a', toRoomId: 'b', width: 3 },
      { id: 'ac', fromRoomId: 'a', toRoomId: 'c', width: 3 },
      { id: 'bc', fromRoomId: 'b', toRoomId: 'c', width: 1 },
    ],
    entities: [
      { id: 'start', type: 'start', roomId: 'a' },
      { id: 'goal', type: 'goal', roomId: 'c' },
    ],
    events: [],
  };

  const plan = createDungeonScenePlan(multi);
  const a = roomGroup(plan, 'a');
  assert.equal(a.doorOpenings.filter((opening) => opening.side === 'east').length, 2);
  assert.equal(a.boxes.filter((box) => box.part.startsWith('wall-east-')).length, 2);
});

test('rejects invalid DungeonSpec before planning', () => {
  const invalid = { ...fixture, entities: [] };
  assert.throws(() => createDungeonScenePlan(invalid), DungeonScenePlanError);
});
