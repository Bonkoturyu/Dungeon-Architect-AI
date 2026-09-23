import {
  Color3,
  DirectionalLight,
  Engine,
  FreeCamera,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
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
const engine = new Engine(canvas, false, { preserveDrawingBuffer: false, stencil: false, antialias: false }, false);
engine.setSize(960, 540);

const scene = new Scene(engine);
scene.clearColor.set(0.063, 0.063, 0.078, 1);
const camera = new FreeCamera('camera', new Vector3(24, 38, 62), scene);
camera.setTarget(new Vector3(24, 0, 18));
new HemisphericLight('ambient', new Vector3(0, 1, 0), scene).intensity = 0.8;
const sun = new DirectionalLight('sun', new Vector3(-1, -2, -1), scene);
sun.position = new Vector3(20, 35, 10);
sun.intensity = 0.8;
const material = new StandardMaterial('material', scene);
material.diffuseColor = new Color3(0.557, 0.604, 0.686);

const addBox = (sx, sy, sz, x, y, z, rotationY = 0) => {
  const mesh = MeshBuilder.CreateBox(`box-${scene.meshes.length}`, { width: sx, height: sy, depth: sz }, scene);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotationY;
  mesh.material = material;
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

scene.render();
const firstRenderMs = performance.now() - startedAt;
exposeResult({
  fixtureId: fixture.id,
  renderer: 'babylon',
  version: Engine.Version,
  objectCount: expectedBoxCount(fixture),
  sceneGenerationMs,
  firstRenderMs,
});

runFrameSampler({
  onFrame: () => {
    scene.render();
  },
  onComplete: (frames) => {
    finishResult({
      ...frames,
      drawCalls: null,
      triangles: scene.getActiveIndices() / 3,
      runtimeErrors: 0,
    });
  },
});
