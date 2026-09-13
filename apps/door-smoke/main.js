import { createThreeRendererAdapter } from '../../packages/renderer-three/src/index.js';

const canvas = document.querySelector('#renderCanvas');
const status = document.querySelector('#status');
const summary = document.querySelector('#summary');

function resize(adapter) {
  const rect = canvas.getBoundingClientRect();
  adapter.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
}

function validateDoorCoverage(spec, plan) {
  const roomById = new Map(plan.roomGroups.map((room) => [room.specId, room]));
  const missing = [];

  for (const corridor of spec.corridors) {
    for (const roomId of [corridor.fromRoomId, corridor.toRoomId]) {
      const room = roomById.get(roomId);
      const found = room?.doorOpenings.some((opening) => opening.corridorId === corridor.id);
      if (!found) missing.push({ corridorId: corridor.id, roomId });
    }
  }

  return missing;
}

async function run() {
  try {
    const response = await fetch('/spec/dungeon/fixtures/pce-perspective-combat-20-v1.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`PCE fixture fetch failed: HTTP ${response.status}`);
    const spec = await response.json();

    const adapter = createThreeRendererAdapter({ canvas });
    resize(adapter);
    const renderSummary = adapter.render(spec);
    const plan = adapter.plan;
    const missingOpenings = validateDoorCoverage(spec, plan);
    const totalDoorOpenings = plan.roomGroups.reduce((count, room) => count + room.doorOpenings.length, 0);
    const roomsWithOpenings = plan.roomGroups.filter((room) => room.doorOpenings.length > 0).length;
    const cornerCorridorCount = spec.corridors.filter((corridor) => {
      const from = spec.rooms.find((room) => room.id === corridor.fromRoomId);
      const to = spec.rooms.find((room) => room.id === corridor.toRoomId);
      return from && to && from.x !== to.x && from.z !== to.z;
    }).length;

    const result = {
      ready: true,
      failed: false,
      renderSummary,
      roomCount: plan.roomGroups.length,
      corridorCount: plan.corridorGroups.length,
      markerCount: plan.markers.length,
      totalDoorOpenings,
      roomsWithOpenings,
      cornerCorridorCount,
      missingOpenings,
    };

    if (
      result.roomCount !== 20 ||
      result.corridorCount !== 22 ||
      result.markerCount !== 2 ||
      result.totalDoorOpenings < spec.corridors.length * 2 ||
      result.roomsWithOpenings !== 20 ||
      result.missingOpenings.length !== 0
    ) {
      throw new Error(`door-opening smoke invariant failed: ${JSON.stringify(result)}`);
    }

    window.__DAI_DOOR_SMOKE__ = result;
    status.textContent = 'ready';
    summary.textContent = `${result.roomCount} rooms · ${result.corridorCount} corridors · ${result.totalDoorOpenings} wall openings`;
    window.addEventListener('resize', () => resize(adapter));
  } catch (error) {
    window.__DAI_DOOR_SMOKE__ = {
      ready: true,
      failed: true,
      message: String(error?.stack || error),
    };
    status.textContent = 'failed';
    console.error(error);
  }
}

run();
