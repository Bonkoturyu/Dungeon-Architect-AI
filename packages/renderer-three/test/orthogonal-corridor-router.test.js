import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDungeonSpec } from '../../generator/src/dungeon-generator.js';
import {
  corridorRouteSegments,
  planOrthogonalCorridors,
} from '../src/orthogonal-corridor-router.js';

function segmentsConflict(a, b) {
  if (a.axis === b.axis) {
    const fixedA = a.axis === 'x' ? a.from.z : a.from.x;
    const fixedB = b.axis === 'x' ? b.from.z : b.from.x;
    if (fixedA !== fixedB) return false;
    const a1 = a.axis === 'x' ? Math.min(a.from.x, a.to.x) : Math.min(a.from.z, a.to.z);
    const a2 = a.axis === 'x' ? Math.max(a.from.x, a.to.x) : Math.max(a.from.z, a.to.z);
    const b1 = b.axis === 'x' ? Math.min(b.from.x, b.to.x) : Math.min(b.from.z, b.to.z);
    const b2 = b.axis === 'x' ? Math.max(b.from.x, b.to.x) : Math.max(b.from.z, b.to.z);
    return Math.min(a2, b2) - Math.max(a1, b1) > 1e-9;
  }

  const horizontal = a.axis === 'x' ? a : b;
  const vertical = a.axis === 'z' ? a : b;
  const hx1 = Math.min(horizontal.from.x, horizontal.to.x);
  const hx2 = Math.max(horizontal.from.x, horizontal.to.x);
  const vz1 = Math.min(vertical.from.z, vertical.to.z);
  const vz2 = Math.max(vertical.from.z, vertical.to.z);
  const x = vertical.from.x;
  const z = horizontal.from.z;
  if (x < hx1 || x > hx2 || z < vz1 || z > vz2) return false;
  const sharedEndpoint =
    [horizontal.from, horizontal.to].some((p) => p.x === x && p.z === z) &&
    [vertical.from, vertical.to].some((p) => p.x === x && p.z === z);
  return !sharedEndpoint;
}

test('public-demo five-room generation uses only orthogonal corridor segments', () => {
  const spec = generateDungeonSpec({
    seed: 4171513421,
    roomCount: 5,
    routeChoice: 0.55,
    id: 'public-demo-routing',
  });
  const routes = planOrthogonalCorridors(spec);

  assert.equal(routes.size, spec.corridors.length);
  for (const route of routes.values()) {
    for (const segment of corridorRouteSegments(route)) {
      assert.ok(segment.axis === 'x' || segment.axis === 'z');
      assert.ok(segment.from.x === segment.to.x || segment.from.z === segment.to.z);
    }
  }
});

test('public-demo routing avoids corridor overlaps and crossings', () => {
  const spec = generateDungeonSpec({
    seed: 4171513421,
    roomCount: 5,
    routeChoice: 0.55,
    id: 'public-demo-routing',
  });
  const routes = planOrthogonalCorridors(spec);
  const byCorridor = [...routes.values()].map((route) => ({
    id: route.corridorId,
    segments: corridorRouteSegments(route),
  }));

  for (let a = 0; a < byCorridor.length; a += 1) {
    for (let b = a + 1; b < byCorridor.length; b += 1) {
      for (const first of byCorridor[a].segments) {
        for (const second of byCorridor[b].segments) {
          assert.equal(
            segmentsConflict(first, second),
            false,
            `${byCorridor[a].id} conflicts with ${byCorridor[b].id}`,
          );
        }
      }
    }
  }
});

test('multiple incident corridors prefer distinct room doorway sides', () => {
  const spec = generateDungeonSpec({
    seed: 4171513421,
    roomCount: 5,
    routeChoice: 0.55,
    id: 'public-demo-routing',
  });
  const routes = planOrthogonalCorridors(spec);
  const sidesByRoom = new Map(spec.rooms.map((room) => [room.id, []]));

  for (const route of routes.values()) {
    sidesByRoom.get(route.fromDoor.roomId).push(route.fromDoor.side);
    sidesByRoom.get(route.toDoor.roomId).push(route.toDoor.side);
  }

  for (const [roomId, sides] of sidesByRoom) {
    if (sides.length <= 4) {
      assert.equal(new Set(sides).size, sides.length, `duplicate doorway side in ${roomId}`);
    }
  }
});

test('orthogonal routing is deterministic', () => {
  const spec = generateDungeonSpec({
    seed: 4171513421,
    roomCount: 5,
    routeChoice: 0.55,
    id: 'public-demo-routing',
  });
  const a = planOrthogonalCorridors(spec);
  const b = planOrthogonalCorridors(structuredClone(spec));
  assert.deepEqual([...a.entries()], [...b.entries()]);
});


test('explicit cardinal doorway sides override automatic endpoint selection', () => {
  const spec = {
    schemaVersion: '1.0',
    id: 'explicit-door-sides',
    seed: 7,
    rooms: [
      { id: 'a', x: 0, z: 0, width: 8, depth: 8 },
      { id: 'b', x: 16, z: 0, width: 8, depth: 8 },
    ],
    corridors: [
      {
        id: 'ab',
        fromRoomId: 'a',
        toRoomId: 'b',
        width: 3,
        kind: 'manual',
        fromSide: 'north',
        toSide: 'south',
      },
    ],
    entities: [
      { id: 'start', type: 'start', roomId: 'a' },
      { id: 'goal', type: 'goal', roomId: 'b' },
    ],
    events: [],
  };

  const route = planOrthogonalCorridors(spec).get('ab');
  assert.equal(route.fromDoor.side, 'north');
  assert.equal(route.toDoor.side, 'south');
  assert.ok(corridorRouteSegments(route).every((segment) =>
    segment.axis === 'x' || segment.axis === 'z'));
});


test('forced wall side can shift its doorway along the wall when the center is blocked', () => {
  const spec = {
    schemaVersion: '1.0',
    id: 'shifted-doorway-resilience',
    seed: 11,
    rooms: [
      { id: 'a', x: 0, z: 0, width: 8, depth: 8 },
      { id: 'blocker', x: 6, z: 0, width: 4, depth: 4 },
      { id: 'b', x: 20, z: 0, width: 8, depth: 8 },
    ],
    corridors: [
      {
        id: 'ab',
        fromRoomId: 'a',
        toRoomId: 'b',
        width: 3,
        kind: 'manual',
        fromSide: 'east',
        toSide: 'west',
      },
    ],
    entities: [
      { id: 'start', type: 'start', roomId: 'a' },
      { id: 'goal', type: 'goal', roomId: 'b' },
    ],
    events: [],
  };

  const route = planOrthogonalCorridors(spec, { allowCrossings: true }).get('ab');
  assert.equal(route.fromDoor.side, 'east');
  assert.equal(route.toDoor.side, 'west');
  assert.notEqual(route.fromDoor.offset, 0);
  assert.ok(corridorRouteSegments(route).every((segment) =>
    segment.axis === 'x' || segment.axis === 'z'));
});
