import { generateDungeonSpec } from '../../packages/generator/src/dungeon-generator.js';
import { createThreeRendererAdapter } from '../../packages/renderer-three/src/index.js';

const canvas = document.querySelector('#renderCanvas');
const status = document.querySelector('#status');
const summary = document.querySelector('#summary');

function resize(adapter) {
  const rect = canvas.getBoundingClientRect();
  adapter.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
}

function segmentKey(segment) {
  if (segment.from.x === segment.to.x) {
    return {
      axis: 'z',
      fixed: segment.from.x,
      start: Math.min(segment.from.z, segment.to.z),
      end: Math.max(segment.from.z, segment.to.z),
    };
  }
  return {
    axis: 'x',
    fixed: segment.from.z,
    start: Math.min(segment.from.x, segment.to.x),
    end: Math.max(segment.from.x, segment.to.x),
  };
}

function conflicts(a, b) {
  const first = segmentKey(a);
  const second = segmentKey(b);
  if (first.axis === second.axis) {
    if (first.fixed !== second.fixed) return false;
    return Math.min(first.end, second.end) - Math.max(first.start, second.start) > 1e-9;
  }

  const horizontal = first.axis === 'x' ? first : second;
  const vertical = first.axis === 'z' ? first : second;
  const x = vertical.fixed;
  const z = horizontal.fixed;
  if (x < horizontal.start || x > horizontal.end || z < vertical.start || z > vertical.end) return false;

  const pointIsEndpoint = (segment, xValue, zValue) =>
    (segment.from.x === xValue && segment.from.z === zValue) ||
    (segment.to.x === xValue && segment.to.z === zValue);

  return !pointIsEndpoint(a, x, z) || !pointIsEndpoint(b, x, z);
}

function analyze(plan, spec) {
  const routes = plan.corridorGroups.map((corridor) => ({
    id: corridor.specId,
    route: corridor.route,
    fromDoor: corridor.fromDoor,
    toDoor: corridor.toDoor,
    segments: corridor.route.slice(0, -1).map((from, index) => ({
      from,
      to: corridor.route[index + 1],
    })),
  }));

  const diagonalSegments = [];
  for (const corridor of routes) {
    for (const segment of corridor.segments) {
      if (segment.from.x !== segment.to.x && segment.from.z !== segment.to.z) {
        diagonalSegments.push({ corridorId: corridor.id, segment });
      }
    }
  }

  const routeConflicts = [];
  for (let a = 0; a < routes.length; a += 1) {
    for (let b = a + 1; b < routes.length; b += 1) {
      for (const first of routes[a].segments) {
        for (const second of routes[b].segments) {
          if (conflicts(first, second)) {
            routeConflicts.push({ first: routes[a].id, second: routes[b].id, a: first, b: second });
          }
        }
      }
    }
  }

  const sidesByRoom = new Map(spec.rooms.map((room) => [room.id, []]));
  for (const route of routes) {
    sidesByRoom.get(route.fromDoor.roomId).push(route.fromDoor.side);
    sidesByRoom.get(route.toDoor.roomId).push(route.toDoor.side);
  }
  const duplicateDoorSides = [];
  for (const [roomId, sides] of sidesByRoom) {
    if (sides.length <= 4 && new Set(sides).size !== sides.length) {
      duplicateDoorSides.push({ roomId, sides });
    }
  }

  const logicalDiagonalCorridors = spec.corridors.filter((corridor) => {
    const from = spec.rooms.find((room) => room.id === corridor.fromRoomId);
    const to = spec.rooms.find((room) => room.id === corridor.toRoomId);
    return from.x !== to.x && from.z !== to.z;
  });
  const diagonalLogicalWithoutBend = logicalDiagonalCorridors.filter((corridor) => {
    const route = routes.find((entry) => entry.id === corridor.id);
    return !route || route.route.length < 3;
  });

  return {
    routeCount: routes.length,
    logicalDiagonalCorridorCount: logicalDiagonalCorridors.length,
    diagonalSegments,
    routeConflicts,
    duplicateDoorSides,
    diagonalLogicalWithoutBend,
    allCorridorsOrthogonal: diagonalSegments.length === 0,
    allRoutesConflictFree: routeConflicts.length === 0,
    distinctDoorSidesWherePossible: duplicateDoorSides.length === 0,
    logicalDiagonalsHaveBends: diagonalLogicalWithoutBend.length === 0,
  };
}

async function run() {
  try {
    const spec = generateDungeonSpec({
      seed: 4171513421,
      roomCount: 5,
      routeChoice: 0.55,
      id: 'dai-026-public-demo-geometry',
    });
    const adapter = createThreeRendererAdapter({ canvas });
    resize(adapter);
    adapter.render(spec);
    const result = analyze(adapter.plan, spec);

    window.__DAI_ORTHOGONAL_SMOKE__ = {
      ready: true,
      failed: false,
      ...result,
      plan: adapter.plan,
    };
    status.textContent = 'ready';
    summary.textContent =
      `${result.routeCount} corridors · orthogonal ${result.allCorridorsOrthogonal ? 'PASS' : 'FAIL'} · overlap ${result.allRoutesConflictFree ? 'PASS' : 'FAIL'}`;
    window.addEventListener('resize', () => resize(adapter));
  } catch (error) {
    window.__DAI_ORTHOGONAL_SMOKE__ = {
      ready: true,
      failed: true,
      message: String(error?.stack || error),
    };
    status.textContent = 'failed';
    console.error(error);
  }
}

run();
