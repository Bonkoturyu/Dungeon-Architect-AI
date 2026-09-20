import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeonSpec } from '../../generator/src/dungeon-generator.js';
import { movePlaySession, startPlaySession } from '../src/play-session.js';
import {
  createRendererVisibilityFromPlaySession,
  derivePlayMap,
  listCurrentRoomExits,
} from '../src/play-map.js';

function fixture() {
  return generateDungeonSpec({ seed: 909, roomCount: 5, routeChoice: 0, id: 'play-map-fixture' });
}

test('play map begins with only the Start room explored and no traversed corridors', () => {
  const session = startPlaySession(fixture()).session;
  const map = derivePlayMap(session);

  assert.deepEqual(map.exploredRoomIds, ['room-001']);
  assert.deepEqual(map.traversedCorridorIds, []);
  assert.equal(map.currentRoomId, 'room-001');
  assert.ok(map.currentExits.length >= 1);
  assert.ok(map.currentExits.every((exit) => exit.targetRoomId !== session.goalRoomId));
});

test('moving reveals the destination room and only the corridor actually traversed', () => {
  const started = startPlaySession(fixture()).session;
  const moved = movePlaySession(started, 'room-002', { at: 1 }).session;
  const map = derivePlayMap(moved);

  assert.deepEqual(map.exploredRoomIds, ['room-001', 'room-002']);
  assert.equal(map.traversedCorridorIds.length, 1);
  assert.equal(map.currentRoomId, 'room-002');

  const corridor = moved.snapshot.corridors.find((item) => item.id === map.traversedCorridorIds[0]);
  assert.ok(corridor);
  assert.ok(
    (corridor.fromRoomId === 'room-001' && corridor.toRoomId === 'room-002') ||
    (corridor.fromRoomId === 'room-002' && corridor.toRoomId === 'room-001')
  );
});

test('backtracking preserves explored map without duplicating rooms or corridors', () => {
  let session = startPlaySession(fixture()).session;
  session = movePlaySession(session, 'room-002', { at: 1 }).session;
  session = movePlaySession(session, 'room-001', { at: 2 }).session;

  const map = derivePlayMap(session);
  assert.deepEqual(map.exploredRoomIds, ['room-001', 'room-002']);
  assert.equal(map.traversedCorridorIds.length, 1);
  assert.equal(map.currentRoomId, 'room-001');
});

test('current exits expose traversal choices without exposing the complete dungeon graph', () => {
  const session = startPlaySession(fixture()).session;
  const exits = listCurrentRoomExits(session);
  const incident = session.snapshot.corridors.filter((corridor) =>
    corridor.fromRoomId === session.currentRoomId || corridor.toRoomId === session.currentRoomId);

  assert.equal(exits.length, incident.length);
  assert.ok(exits.every((exit) => typeof exit.corridorId === 'string'));
  assert.ok(exits.every((exit) => typeof exit.targetRoomId === 'string'));
  assert.ok(exits.every((exit) => exit.explored === false));
});

test('renderer visibility contains explored rooms, traversed corridors, and current room only', () => {
  let session = startPlaySession(fixture()).session;
  session = movePlaySession(session, 'room-002', { at: 1 }).session;

  const visibility = createRendererVisibilityFromPlaySession(session);
  assert.deepEqual(visibility.roomIds, ['room-001', 'room-002']);
  assert.equal(visibility.corridorIds.length, 1);
  assert.equal(visibility.currentRoomId, 'room-002');
});


test('parallel corridor traversal preserves the selected enabled corridor', () => {
  const spec = fixture();
  const first = spec.corridors.find((corridor) =>
    (corridor.fromRoomId === 'room-001' && corridor.toRoomId === 'room-002') ||
    (corridor.fromRoomId === 'room-002' && corridor.toRoomId === 'room-001'));
  assert.ok(first);

  first.initiallyEnabled = false;
  const selected = {
    ...first,
    id: `${first.id}-parallel`,
    initiallyEnabled: true,
  };
  spec.corridors.push(selected);

  const started = startPlaySession(spec).session;
  const exits = listCurrentRoomExits(started).filter((exit) => exit.targetRoomId === 'room-002');
  assert.deepEqual(exits.map((exit) => exit.corridorId), [selected.id]);

  const disabledMove = movePlaySession(started, 'room-002', {
    at: 1,
    corridorId: first.id,
  });
  assert.equal(disabledMove.ok, false);
  assert.equal(disabledMove.error.code, 'CORRIDOR_DISABLED');

  const moved = movePlaySession(started, 'room-002', {
    at: 1,
    corridorId: selected.id,
  });
  assert.equal(moved.ok, true);
  assert.equal(moved.session.events.find((event) => event.type === 'move')?.corridorId, selected.id);

  const map = derivePlayMap(moved.session);
  assert.deepEqual(map.traversedCorridorIds, [selected.id]);
  assert.equal(map.traversedCorridorIds.includes(first.id), false);
});
