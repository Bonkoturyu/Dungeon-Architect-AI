import * as THREE from 'three';
import { createDungeonScenePlan } from './scene-plan.js';

const DEFAULT_CLEAR_COLOR = 0x101014;

function applyBoxTransform(mesh, box) {
  mesh.position.set(box.position.x, box.position.y, box.position.z);
  mesh.scale.set(box.size.x, box.size.y, box.size.z);
  mesh.rotation.y = box.rotationY;
}

function makeSpecGroup(specId, kind) {
  const group = new THREE.Group();
  group.name = `${kind}:${specId}`;
  group.userData.specId = specId;
  group.userData.kind = kind;
  return group;
}

export function createThreeRendererAdapter({ canvas, clearColor = DEFAULT_CLEAR_COLOR } = {}) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new TypeError('createThreeRendererAdapter requires an HTMLCanvasElement canvas.');
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(clearColor);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  const ambient = new THREE.HemisphereLight(0xffffff, 0x222233, 1.5);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(20, 35, 10);
  scene.add(ambient, sun);

  const root = new THREE.Group();
  root.name = 'DungeonSpecRoot';
  scene.add(root);

  const materials = {
    room: new THREE.MeshStandardMaterial({ color: 0x8e9aaf, roughness: 0.9, metalness: 0 }),
    corridor: new THREE.MeshStandardMaterial({ color: 0x6c7890, roughness: 0.95, metalness: 0 }),
    start: new THREE.MeshStandardMaterial({ color: 0x5bd17f, roughness: 0.7, metalness: 0 }),
    goal: new THREE.MeshStandardMaterial({ color: 0xe5b65c, roughness: 0.65, metalness: 0 }),
  };

  const runtimeBySpecId = new Map();
  let disposed = false;
  let lastPlan = null;

  function assertAlive() {
    if (disposed) throw new Error('Three renderer adapter has been disposed.');
  }

  function disposeObjectTree(object) {
    object.traverse((node) => {
      if (node.geometry?.dispose) node.geometry.dispose();
    });
  }

  function clearRenderedSpec() {
    for (const child of [...root.children]) {
      root.remove(child);
      disposeObjectTree(child);
    }
    runtimeBySpecId.clear();
    lastPlan = null;
  }

  function addBoxGroup(targetRoot, targetMap, definition, material) {
    const group = makeSpecGroup(definition.specId, definition.kind);
    for (const box of definition.boxes) {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `${definition.specId}:${box.part}`;
      mesh.userData.specId = definition.specId;
      mesh.userData.part = box.part;
      applyBoxTransform(mesh, box);
      group.add(mesh);
    }
    targetRoot.add(group);
    targetMap.set(definition.specId, group);
  }

  function addMarker(targetRoot, targetMap, marker) {
    const group = makeSpecGroup(marker.specId, marker.type);
    let geometry;
    let material;

    if (marker.type === 'start') {
      geometry = new THREE.CylinderGeometry(0.75, 0.75, marker.height, 20);
      material = materials.start;
    } else {
      geometry = new THREE.ConeGeometry(0.8, marker.height * 1.5, 20);
      material = materials.goal;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${marker.type}:${marker.specId}`;
    mesh.userData.specId = marker.specId;
    mesh.userData.roomId = marker.roomId;
    mesh.position.set(marker.position.x, marker.position.y, marker.position.z);
    group.add(mesh);
    targetRoot.add(group);
    targetMap.set(marker.specId, group);
  }

  function buildStagingScene(plan) {
    const stagingRoot = new THREE.Group();
    const stagingMap = new Map();

    try {
      for (const room of plan.roomGroups) addBoxGroup(stagingRoot, stagingMap, room, materials.room);
      for (const corridor of plan.corridorGroups) addBoxGroup(stagingRoot, stagingMap, corridor, materials.corridor);
      for (const marker of plan.markers) addMarker(stagingRoot, stagingMap, marker);
      return { stagingRoot, stagingMap };
    } catch (error) {
      disposeObjectTree(stagingRoot);
      throw error;
    }
  }

  function fitCamera(bounds) {
    const span = Math.max(bounds.width, bounds.depth, 16);
    const distance = span * 1.25;
    camera.position.set(bounds.centerX + distance * 0.45, distance * 0.8, bounds.centerZ + distance);
    camera.lookAt(bounds.centerX, 0, bounds.centerZ);
  }

  function draw() {
    renderer.render(scene, camera);
  }

  function render(spec) {
    assertAlive();
    const plan = createDungeonScenePlan(spec);
    const { stagingRoot, stagingMap } = buildStagingScene(plan);

    clearRenderedSpec();
    for (const child of [...stagingRoot.children]) {
      stagingRoot.remove(child);
      root.add(child);
    }
    for (const [specId, object] of stagingMap) runtimeBySpecId.set(specId, object);

    fitCamera(plan.bounds);
    lastPlan = plan;
    draw();

    return {
      sourceSpecId: plan.sourceSpecId,
      runtimeObjectCount: runtimeBySpecId.size,
      roomCount: plan.roomGroups.length,
      corridorCount: plan.corridorGroups.length,
      markerCount: plan.markers.length,
    };
  }

  function resize(width, height) {
    assertAlive();
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      throw new RangeError('resize width and height must be positive finite numbers.');
    }
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw();
  }

  function getObjectBySpecId(id) {
    assertAlive();
    return runtimeBySpecId.get(id) ?? null;
  }

  function dispose() {
    if (disposed) return;
    clearRenderedSpec();
    for (const material of Object.values(materials)) material.dispose();
    renderer.dispose();
    disposed = true;
  }

  return {
    render,
    resize,
    getObjectBySpecId,
    dispose,
    get plan() {
      return lastPlan;
    },
  };
}
