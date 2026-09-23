import * as THREE from 'three';
import {
  CORRIDOR_WIDTH,
  ROOM_HEIGHT,
  ROOM_SIZE,
  WALL_THICKNESS,
  corridorGeometry,
  createFixture,
  expectedBoxCount,
} from './fixture.js';
import { exposeResult, finishResult, runFrameSampler } from './benchmark-common.js';

const startedAt = performance.now();
const fixture = createFixture();
const canvas = document.querySelector('#renderCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(960, 540, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);
const camera = new THREE.PerspectiveCamera(60, 960 / 540, 0.1, 500);
camera.position.set(24, 38, 62);
camera.lookAt(24, 0, 18);
scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(20, 35, 10);
scene.add(sun);
const material = new THREE.MeshStandardMaterial({ color: 0x8e9aaf, roughness: 1 });

const addBox = (sx, sy, sz, x, y, z, rotationY = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotationY;
  scene.add(mesh);
};

const generationStartedAt = performance.now();
for (const room of fixture.rooms) {
  addBox(ROOM_SIZE, 0.2, ROOM_SIZE, room.x, -0.1, room.z);
  addBox(ROOM_SIZE, ROOM_HEIGHT, WALL_THICKNESS, room.x, ROOM_HEIGHT / 2, room.z - ROOM_SIZE / 2);
  addBox(ROOM_SIZE, ROOM_HEIGHT, WALL_THICKNESS, room.x, ROOM_HEIGHT / 2, room.z + ROOM_SIZE / 2);
  addBox(WALL_THICKNESS, ROOM_HEIGHT, ROOM_SIZE, room.x - ROOM_SIZE / 2, ROOM_HEIGHT / 2, room.z);
  addBox(WALL_THICKNESS, ROOM_HEIGHT, ROOM_SIZE, room.x + ROOM_SIZE / 2, ROOM_HEIGHT / 2, room.z);
}
for (const corridor of fixture.corridors) {
  const geometry = corridorGeometry(corridor);
  addBox(geometry.length, 0.2, CORRIDOR_WIDTH, geometry.x, -0.1, geometry.z, -geometry.rotationY);
}
const sceneGenerationMs = performance.now() - generationStartedAt;

renderer.render(scene, camera);
const firstRenderMs = performance.now() - startedAt;
exposeResult({
  fixtureId: fixture.id,
  renderer: 'three',
  version: THREE.REVISION,
  objectCount: expectedBoxCount(fixture),
  sceneGenerationMs,
  firstRenderMs,
});

runFrameSampler({
  onFrame: () => {
    renderer.render(scene, camera);
  },
  onComplete: (frames) => {
    finishResult({
      ...frames,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      runtimeErrors: 0,
    });
  },
});
