import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCorridorDragPreview,
  corridorSideForRoom,
  findCorridorOpeningAtWall,
  oppositeCorridorSide,
  roomDoorPoint,
  wallSideFromPart,
} from '../src/corridor-drag.js';

function fixture() {
  return {
    rooms: [
      { id: 'a', x: 0, z: 0, width: 8, depth: 8 },
      { id: 'b', x: 16, z: 0, width: 8, depth: 8 },
      { id: 'c', x: 16, z: 12, width: 8, depth: 8 },
    ],
    corridors: [],
  };
}

test('wallSideFromPart extracts cardinal room wall sides', () => {
  assert.equal(wallSideFromPart('wall-north-0'), 'north');
  assert.equal(wallSideFromPart('wall-east-2'), 'east');
  assert.equal(wallSideFromPart('floor'), null);
});

test('roomDoorPoint uses the center of the chosen wall', () => {
  const room = fixture().rooms[0];
  assert.deepEqual(roomDoorPoint(room, 'north'), { x: 0, z: -4 });
  assert.deepEqual(roomDoorPoint(room, 'east'), { x: 4, z: 0 });
  assert.equal(oppositeCorridorSide('east'), 'west');
});

test('dragging east into another room yields a ready corridor candidate', () => {
  const spec = fixture();
  const preview = buildCorridorDragPreview(spec, {
    sourceRoomId: 'a',
    sourceSide: 'east',
    pointer: { x: 20, z: 0 },
    width: 3,
  });

  assert.equal(preview.state, 'ready');
  assert.equal(preview.targetRoomId, 'b');
  assert.equal(preview.targetSide, 'west');
  assert.deepEqual(preview.points.at(-1), { x: 12, z: 0 });
});

test('dragging without reaching a room remains an open cancellable preview', () => {
  const preview = buildCorridorDragPreview(fixture(), {
    sourceRoomId: 'a',
    sourceSide: 'north',
    pointer: { x: 6, z: -10 },
  });
  assert.equal(preview.state, 'open');
  assert.equal(preview.targetRoomId, null);
  assert.ok(preview.points.length >= 2);
});

test('dragging toward an already-connected room is blocked as duplicate', () => {
  const spec = fixture();
  spec.corridors.push({
    id: 'ab',
    fromRoomId: 'a',
    toRoomId: 'b',
    width: 3,
  });

  const preview = buildCorridorDragPreview(spec, {
    sourceRoomId: 'a',
    sourceSide: 'east',
    pointer: { x: 20, z: 0 },
  });
  assert.equal(preview.state, 'blocked');
  assert.equal(preview.blockedCode, 'DUPLICATE_CORRIDOR');
  assert.equal(preview.blockedCorridorId, 'ab');
});

test('existing corridor is excluded when previewing its own reconnection', () => {
  const spec = fixture();
  spec.corridors.push({
    id: 'ab',
    fromRoomId: 'a',
    toRoomId: 'b',
    width: 3,
  });

  const preview = buildCorridorDragPreview(spec, {
    sourceRoomId: 'a',
    sourceSide: 'east',
    pointer: { x: 20, z: 0 },
    existingCorridorId: 'ab',
    corridorRoutes: [
      {
        corridorId: 'ab',
        points: [{ x: 4, z: 0 }, { x: 12, z: 0 }],
      },
    ],
  });
  assert.equal(preview.state, 'ready');
  assert.equal(preview.targetRoomId, 'b');
});

test('crossing a different existing corridor blocks the draft', () => {
  const spec = {
    rooms: [
      { id: 'a', x: 0, z: 0, width: 8, depth: 8 },
      { id: 'b', x: 20, z: 12, width: 8, depth: 8 },
      { id: 'c', x: 10, z: -8, width: 8, depth: 8 },
      { id: 'd', x: 10, z: 8, width: 8, depth: 8 },
    ],
    corridors: [
      { id: 'cd', fromRoomId: 'c', toRoomId: 'd', width: 3 },
    ],
  };

  const preview = buildCorridorDragPreview(spec, {
    sourceRoomId: 'a',
    sourceSide: 'east',
    pointer: { x: 20, z: 12 },
    corridorRoutes: [
      {
        corridorId: 'cd',
        points: [{ x: 10, z: -4 }, { x: 10, z: 4 }],
      },
    ],
  });

  assert.equal(preview.state, 'blocked');
  assert.equal(preview.blockedCode, 'CORRIDOR_COLLISION');
});

test('wall opening lookup chooses the nearest corridor opening on that wall', () => {
  const plan = {
    roomGroups: [
      {
        specId: 'a',
        doorOpenings: [
          { corridorId: 'ab', side: 'east', centerOffset: -1.5, width: 2 },
          { corridorId: 'ac', side: 'east', centerOffset: 2, width: 2 },
        ],
      },
    ],
  };
  const room = { id: 'a', x: 0, z: 0, width: 8, depth: 8 };
  const opening = findCorridorOpeningAtWall(plan, {
    roomId: 'a',
    side: 'east',
    point: { x: 4, z: 1.8 },
    room,
  });
  assert.equal(opening.corridorId, 'ac');
});

test('corridorSideForRoom resolves rendered endpoint side', () => {
  const plan = {
    corridorGroups: [
      {
        specId: 'ab',
        fromDoor: { roomId: 'a', side: 'east' },
        toDoor: { roomId: 'b', side: 'west' },
      },
    ],
  };
  assert.equal(corridorSideForRoom(plan, 'ab', 'a'), 'east');
  assert.equal(corridorSideForRoom(plan, 'ab', 'b'), 'west');
});
