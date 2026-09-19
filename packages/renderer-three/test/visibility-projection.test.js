import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeonSpec } from '../../generator/src/dungeon-generator.js';
import { createDungeonScenePlan, projectDungeonScenePlan } from '../src/scene-plan.js';

function fixture() {
  return generateDungeonSpec({ seed: 909, roomCount: 5, routeChoice: 0, id: 'visibility-fixture' });
}

test('scene-plan projection hides every unexplored room and corridor', () => {
  const plan = createDungeonScenePlan(fixture());
  const projected = projectDungeonScenePlan(plan, {
    roomIds: ['room-001'],
    corridorIds: [],
    currentRoomId: 'room-001',
  });

  assert.deepEqual(projected.roomGroups.map((group) => group.specId), ['room-001']);
  assert.deepEqual(projected.corridorGroups, []);
  assert.ok(projected.markers.every((marker) => marker.roomId === 'room-001'));
  assert.equal(projected.roomGroups[0].visibilityState, 'current');
});

test('scene-plan projection preserves discovered room door openings without revealing corridor geometry', () => {
  const plan = createDungeonScenePlan(fixture());
  const fullStart = plan.roomGroups.find((group) => group.specId === 'room-001');
  const projected = projectDungeonScenePlan(plan, {
    roomIds: ['room-001'],
    corridorIds: [],
    currentRoomId: 'room-001',
  });
  const visibleStart = projected.roomGroups[0];

  assert.deepEqual(visibleStart.doorOpenings, fullStart.doorOpenings);
  assert.equal(projected.corridorGroups.length, 0);
});

test('exploration projection retains traversed geometry and dims previous rooms', () => {
  const plan = createDungeonScenePlan(fixture());
  const firstCorridor = plan.corridorGroups.find((group) => {
    const rooms = new Set([group.fromDoor.roomId, group.toDoor.roomId]);
    return rooms.has('room-001') && rooms.has('room-002');
  });
  assert.ok(firstCorridor);

  const projected = projectDungeonScenePlan(plan, {
    roomIds: ['room-001', 'room-002'],
    corridorIds: [firstCorridor.specId],
    currentRoomId: 'room-002',
  });

  assert.equal(projected.roomGroups.length, 2);
  assert.equal(projected.corridorGroups.length, 1);
  assert.equal(projected.roomGroups.find((group) => group.specId === 'room-001').visibilityState, 'explored');
  assert.equal(projected.roomGroups.find((group) => group.specId === 'room-002').visibilityState, 'current');
  assert.equal(projected.corridorGroups[0].visibilityState, 'explored');
});

test('goal marker stays hidden until the goal room is explored', () => {
  const plan = createDungeonScenePlan(fixture());
  const goalMarker = plan.markers.find((marker) => marker.type === 'goal');
  assert.ok(goalMarker);

  const before = projectDungeonScenePlan(plan, {
    roomIds: ['room-001'],
    corridorIds: [],
    currentRoomId: 'room-001',
  });
  assert.equal(before.markers.some((marker) => marker.type === 'goal'), false);

  const after = projectDungeonScenePlan(plan, {
    roomIds: ['room-001', goalMarker.roomId],
    corridorIds: [],
    currentRoomId: goalMarker.roomId,
  });
  assert.equal(after.markers.some((marker) => marker.type === 'goal'), true);
});
