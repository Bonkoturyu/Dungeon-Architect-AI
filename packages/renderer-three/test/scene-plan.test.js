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
  assert.equal(horizontal.size.x, 4);
  assert.equal(horizontal.rotationY, 0);

  const vertical = plan.corridorGroups[1].boxes[0];
  assert.equal(vertical.position.x, 12);
  assert.equal(vertical.position.z, 6);
  assert.equal(vertical.size.x, 4);
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

test('diagonal logical edge is rendered as an orthogonal path with one doorway per endpoint', () => {
  const diagonal = {
    schemaVersion: '1.0',
    id: 'orthogonal-diagonal-fixture',
    seed: 2,
    rooms: [
      { id: 'a', x: 0, z: 0, width: 8, depth: 8 },
      { id: 'b', x: 12, z: 12, width: 8, depth: 8 },
    ],
    corridors: [
      { id: 'diag', fromRoomId: 'a', toRoomId: 'b', width: 3, kind: 'alternate' },
    ],
    entities: [
      { id: 'start', type: 'start', roomId: 'a' },
      { id: 'goal', type: 'goal', roomId: 'b' },
    ],
    events: [],
  };

  const plan = createDungeonScenePlan(diagonal);
  const corridor = plan.corridorGroups[0];
  assert.ok(corridor.boxes.length >= 2);
  assert.equal(openings(roomGroup(plan, 'a'), 'diag').length, 1);
  assert.equal(openings(roomGroup(plan, 'b'), 'diag').length, 1);
  assert.ok(corridor.route.length >= 3);
  const segmentBoxes = corridor.boxes.filter((box) => box.part.startsWith('corridor-floor-'));
  const junctionBoxes = corridor.boxes.filter((box) => box.part.startsWith('corridor-junction-'));
  assert.ok(segmentBoxes.every((box) =>
    box.rotationY === 0 || box.rotationY === -Math.PI / 2));
  assert.equal(junctionBoxes.length, corridor.route.length - 2);
  for (let index = 1; index < corridor.route.length - 1; index += 1) {
    const point = corridor.route[index];
    const junction = junctionBoxes[index - 1];
    assert.equal(junction.position.x, point.x);
    assert.equal(junction.position.z, point.z);
    assert.equal(junction.size.x, 3);
    assert.equal(junction.size.z, 3);
  }
});

test('multiple corridors incident to one room prefer separate doorway sides', () => {
  const multi = {
    schemaVersion: '1.0',
    id: 'multiple-door-fixture',
    seed: 3,
    rooms: [
      { id: 'a', x: 0, z: 0, width: 8, depth: 8 },
      { id: 'b', x: 12, z: 0, width: 8, depth: 8 },
      { id: 'c', x: 12, z: 12, width: 8, depth: 8 },
    ],
    corridors: [
      { id: 'ab', fromRoomId: 'a', toRoomId: 'b', width: 3, kind: 'backbone' },
      { id: 'ac', fromRoomId: 'a', toRoomId: 'c', width: 3, kind: 'alternate' },
      { id: 'bc', fromRoomId: 'b', toRoomId: 'c', width: 3, kind: 'backbone' },
    ],
    entities: [
      { id: 'start', type: 'start', roomId: 'a' },
      { id: 'goal', type: 'goal', roomId: 'c' },
    ],
    events: [],
  };

  const plan = createDungeonScenePlan(multi);
  const a = roomGroup(plan, 'a');
  const sides = a.doorOpenings.map((opening) => opening.side);
  assert.equal(new Set(sides).size, sides.length);
  assert.equal(sides.length, 2);
});

test('every orthogonal bend has an explicit square junction floor', () => {
  const multi = {
    schemaVersion: '1.0',
    id: 'bend-junction-fixture',
    seed: 4,
    rooms: [
      { id: 'a', x: 0, z: 0, width: 8, depth: 8 },
      { id: 'b', x: 12, z: 12, width: 8, depth: 8 },
      { id: 'c', x: 24, z: 12, width: 8, depth: 8 },
    ],
    corridors: [
      { id: 'ab', fromRoomId: 'a', toRoomId: 'b', width: 3, kind: 'alternate' },
      { id: 'bc', fromRoomId: 'b', toRoomId: 'c', width: 3, kind: 'backbone' },
    ],
    entities: [
      { id: 'start', type: 'start', roomId: 'a' },
      { id: 'goal', type: 'goal', roomId: 'c' },
    ],
    events: [],
  };

  const plan = createDungeonScenePlan(multi);
  for (const corridor of plan.corridorGroups) {
    const junctions = corridor.boxes.filter((box) => box.part.startsWith('corridor-junction-'));
    assert.equal(junctions.length, Math.max(0, corridor.route.length - 2));
    for (let index = 1; index < corridor.route.length - 1; index += 1) {
      const point = corridor.route[index];
      const junction = junctions[index - 1];
      assert.equal(junction.position.x, point.x);
      assert.equal(junction.position.z, point.z);
      assert.ok(junction.size.x > 0);
      assert.ok(junction.size.z > 0);
    }
  }
});

test('rejects invalid DungeonSpec before planning', () => {
  const invalid = { ...fixture, entities: [] };
  assert.throws(() => createDungeonScenePlan(invalid), DungeonScenePlanError);
});
