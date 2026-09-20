import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeonSpec } from '../../generator/src/dungeon-generator.js';
import {
  createDungeonScenePlan,
  projectDungeonScenePlan,
  shouldRenderMarkerForRuntime,
} from '../src/scene-plan.js';

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


test('scene plan includes low-poly marker definitions for gameplay entities', () => {
  const spec = fixture();
  spec.entities.push(
    { id: 'enemy-marker', type: 'enemy', roomId: 'room-002', initiallyActive: true },
    { id: 'treasure-marker', type: 'treasure', roomId: 'room-002', warning: 'none' },
    { id: 'trap-marker', type: 'trap', roomId: 'room-003', warning: 'floor-cracks' },
    { id: 'recovery-marker', type: 'recovery', roomId: 'room-004' },
  );

  const plan = createDungeonScenePlan(spec);
  const byType = new Map(plan.markers.map((marker) => [marker.type, marker]));
  for (const type of ['start', 'goal', 'enemy', 'treasure', 'trap', 'recovery']) {
    assert.ok(byType.has(type), `missing marker type: ${type}`);
  }
  assert.equal(byType.get('trap').warning, 'floor-cracks');
  assert.equal(byType.get('enemy').initiallyActive, true);
});

test('dormant enemy marker stays hidden in Play until runtime activation', () => {
  const spec = fixture();
  spec.entities.push({
    id: 'enemy-dormant',
    type: 'enemy',
    roomId: 'room-002',
    initiallyActive: false,
  });

  const plan = createDungeonScenePlan(spec);
  const marker = plan.markers.find((entry) => entry.specId === 'enemy-dormant');
  assert.ok(marker);
  assert.equal(marker.initiallyActive, false);

  assert.equal(shouldRenderMarkerForRuntime(marker, {}), false);
  assert.equal(shouldRenderMarkerForRuntime(marker, {
    'enemy-dormant': { status: 'dormant' },
  }), false);
  assert.equal(shouldRenderMarkerForRuntime(marker, {
    'enemy-dormant': { status: 'active' },
  }), true);
  assert.equal(shouldRenderMarkerForRuntime(marker, {
    'enemy-dormant': { status: 'defeated' },
  }), false);

  // Authoring/Edit render has no runtime state and must still show the entity.
  assert.equal(shouldRenderMarkerForRuntime(marker, null), true);
});

test('play projection hides gameplay markers in unexplored rooms', () => {
  const spec = fixture();
  spec.entities.push({ id: 'enemy-hidden', type: 'enemy', roomId: 'room-003', initiallyActive: true });
  const plan = createDungeonScenePlan(spec);
  const projected = projectDungeonScenePlan(plan, {
    roomIds: ['room-001'],
    corridorIds: [],
    currentRoomId: 'room-001',
  });

  assert.equal(projected.markers.some((marker) => marker.specId === 'enemy-hidden'), false);
});
