export const FIXTURE_ID = 'DAI-M1-RENDERER-20-v1';
export const ROOM_SIZE = 8;
export const ROOM_HEIGHT = 3;
export const WALL_THICKNESS = 0.2;
export const CORRIDOR_WIDTH = 3;

export function createFixture() {
  const rooms = [];
  const corridors = [];
  const spacing = 12;

  for (let z = 0; z < 4; z += 1) {
    for (let x = 0; x < 5; x += 1) {
      const index = z * 5 + x;
      rooms.push({ id: `room-${index}`, x: x * spacing, z: z * spacing });

      if (index > 0) {
        const previous = rooms[index - 1];
        corridors.push({
          id: `corridor-${index - 1}`,
          ax: previous.x,
          az: previous.z,
          bx: x * spacing,
          bz: z * spacing,
        });
      }
    }
  }

  return { id: FIXTURE_ID, rooms, corridors };
}

export function corridorGeometry(corridor) {
  const dx = corridor.bx - corridor.ax;
  const dz = corridor.bz - corridor.az;
  return {
    x: (corridor.ax + corridor.bx) / 2,
    z: (corridor.az + corridor.bz) / 2,
    length: Math.hypot(dx, dz),
    rotationY: Math.atan2(dz, dx),
  };
}

export function expectedBoxCount(fixture) {
  return fixture.rooms.length * 5 + fixture.corridors.length;
}
