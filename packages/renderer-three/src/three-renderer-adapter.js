import * as THREE from 'three';
import { createDungeonScenePlan, projectDungeonScenePlan } from './scene-plan.js';

const DEFAULT_CLEAR_COLOR = 0x202834;
const DEFAULT_SELECTION_COLOR = 0x66ccff;

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
    room: new THREE.MeshStandardMaterial({ color: 0xb8c5d8, roughness: 0.88, metalness: 0 }),
    roomExplored: new THREE.MeshStandardMaterial({ color: 0x667389, roughness: 0.92, metalness: 0 }),
    roomCurrent: new THREE.MeshStandardMaterial({
      color: 0xe8f1fb,
      roughness: 0.76,
      metalness: 0,
      emissive: 0x2b5268,
      emissiveIntensity: 0.5,
    }),
    currentRing: new THREE.MeshBasicMaterial({
      color: 0x8bdcff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    }),
    resultRing: new THREE.MeshBasicMaterial({
      color: 0xf4c95d,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
    }),
    corridor: new THREE.MeshStandardMaterial({ color: 0x8d9bb1, roughness: 0.94, metalness: 0 }),
    corridorExplored: new THREE.MeshStandardMaterial({ color: 0x566477, roughness: 0.96, metalness: 0 }),
    start: new THREE.MeshStandardMaterial({ color: 0x58d68d, roughness: 0.68, metalness: 0 }),
    goal: new THREE.MeshStandardMaterial({ color: 0xf1c75b, roughness: 0.62, metalness: 0 }),
    enemy: new THREE.MeshStandardMaterial({
      color: 0xe36d73,
      roughness: 0.72,
      metalness: 0,
      emissive: 0x4a171d,
      emissiveIntensity: 0.28,
    }),
    treasure: new THREE.MeshStandardMaterial({
      color: 0xe2b85f,
      roughness: 0.58,
      metalness: 0.12,
      emissive: 0x49350f,
      emissiveIntensity: 0.18,
    }),
    trap: new THREE.MeshStandardMaterial({
      color: 0xd9825b,
      roughness: 0.8,
      metalness: 0,
      emissive: 0x3d1f12,
      emissiveIntensity: 0.2,
    }),
    recovery: new THREE.MeshStandardMaterial({
      color: 0x69c9d4,
      roughness: 0.64,
      metalness: 0,
      emissive: 0x123c42,
      emissiveIntensity: 0.24,
    }),
  };

  const runtimeBySpecId = new Map();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const boundsBox = new THREE.Box3();
  const boundsCenter = new THREE.Vector3();
  let disposed = false;
  let lastPlan = null;
  let selectedSpecId = null;
  let selectionHelper = null;

  function assertAlive() {
    if (disposed) throw new Error('Three renderer adapter has been disposed.');
  }

  function disposeObjectTree(object) {
    object.traverse((node) => {
      if (node.geometry?.dispose) node.geometry.dispose();
    });
  }

  function clearSelectionHelper() {
    if (!selectionHelper) return;
    scene.remove(selectionHelper);
    selectionHelper.geometry?.dispose();
    selectionHelper.material?.dispose();
    selectionHelper = null;
  }

  function clearRenderedSpec() {
    clearSelectionHelper();
    selectedSpecId = null;
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
      mesh.userData.kind = definition.kind;
      mesh.userData.part = box.part;
      applyBoxTransform(mesh, box);
      group.add(mesh);
    }
    targetRoot.add(group);
    targetMap.set(definition.specId, group);
  }

  function markerResolved(marker, entityStates) {
    if (!entityStates || !marker) return false;
    const state = entityStates[marker.specId];
    if (!state) return false;
    if (marker.type === 'enemy') return state.status === 'defeated';
    if (marker.type === 'treasure') return state.status === 'opened';
    if (marker.type === 'trap') return state.status && state.status !== 'armed';
    if (marker.type === 'recovery') return state.status === 'used';
    return false;
  }

  function addMarker(targetRoot, targetMap, marker, entityStates = null) {
    if (markerResolved(marker, entityStates)) return;
    const group = makeSpecGroup(marker.specId, marker.type);
    group.userData.roomId = marker.roomId;
    let geometry;
    let material;

    if (marker.type === 'start') {
      geometry = new THREE.CylinderGeometry(0.75, 0.75, marker.height, 20);
      material = materials.start;
    } else if (marker.type === 'goal') {
      geometry = new THREE.ConeGeometry(0.8, marker.height * 1.5, 20);
      material = materials.goal;
    } else if (marker.type === 'enemy') {
      geometry = new THREE.OctahedronGeometry(0.72, 0);
      material = materials.enemy;
    } else if (marker.type === 'treasure') {
      geometry = new THREE.BoxGeometry(1.0, marker.height, 0.78);
      material = materials.treasure;
    } else if (marker.type === 'trap') {
      geometry = new THREE.CylinderGeometry(0.82, 0.82, marker.height, 6);
      material = materials.trap;
    } else if (marker.type === 'recovery') {
      geometry = new THREE.IcosahedronGeometry(0.58, 0);
      material = materials.recovery;
    } else {
      geometry = new THREE.SphereGeometry(0.5, 12, 8);
      material = materials.room;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${marker.type}:${marker.specId}`;
    mesh.userData.specId = marker.specId;
    mesh.userData.kind = marker.type;
    mesh.userData.roomId = marker.roomId;
    mesh.position.set(marker.position.x, marker.position.y, marker.position.z);
    group.add(mesh);
    targetRoot.add(group);
    targetMap.set(marker.specId, group);
  }

  function buildStagingScene(plan, { resultMode = false, entityStates = null } = {}) {
    const stagingRoot = new THREE.Group();
    const stagingMap = new Map();

    try {
      for (const room of plan.roomGroups) {
        const material = room.visibilityState === 'current'
          ? materials.roomCurrent
          : room.visibilityState === 'explored'
            ? materials.roomExplored
            : materials.room;
        addBoxGroup(stagingRoot, stagingMap, room, material);
      }
      for (const corridor of plan.corridorGroups) {
        const material = corridor.visibilityState === 'explored' ? materials.corridorExplored : materials.corridor;
        addBoxGroup(stagingRoot, stagingMap, corridor, material);
      }
      for (const marker of plan.markers) addMarker(stagingRoot, stagingMap, marker, entityStates);

      if (plan.visibility?.currentRoomId) {
        const currentRoom = plan.roomGroups.find((group) => group.specId === plan.visibility.currentRoomId);
        const floor = currentRoom?.boxes?.find((box) => box.part === 'floor');
        if (floor) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(resultMode ? 0.88 : 0.82, resultMode ? 1.2 : 1.12, 32),
            resultMode ? materials.resultRing : materials.currentRing,
          );
          ring.name = 'current-room-ring';
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(floor.position.x, 0.025, floor.position.z);
          stagingRoot.add(ring);
        }
      }

      return { stagingRoot, stagingMap };
    } catch (error) {
      disposeObjectTree(stagingRoot);
      throw error;
    }
  }

  function fitCamera(bounds, { playMode = false } = {}) {
    const minimumSpan = playMode ? 16 : 16;
    const span = Math.max(bounds.width, bounds.depth, minimumSpan);
    const distance = span * (playMode ? 1.05 : 1.25);
    camera.position.set(
      bounds.centerX + distance * (playMode ? 0.34 : 0.45),
      distance * (playMode ? 0.7 : 0.8),
      bounds.centerZ + distance * (playMode ? 0.92 : 1),
    );
    camera.lookAt(bounds.centerX, 0, bounds.centerZ);
  }

  function draw() {
    renderer.render(scene, camera);
  }

  function render(spec, { visibility = null, resultMode = false, entityStates = null } = {}) {
    assertAlive();
    const fullPlan = createDungeonScenePlan(spec);
    const plan = visibility ? projectDungeonScenePlan(fullPlan, visibility) : fullPlan;
    const { stagingRoot, stagingMap } = buildStagingScene(plan, { resultMode, entityStates });

    clearRenderedSpec();
    for (const child of [...stagingRoot.children]) {
      stagingRoot.remove(child);
      root.add(child);
    }
    for (const [specId, object] of stagingMap) runtimeBySpecId.set(specId, object);

    fitCamera(plan.bounds, { playMode: Boolean(visibility) });
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

  function findSpecMetadata(object) {
    let current = object;
    while (current && current !== root) {
      if (current.userData?.specId) {
        return {
          specId: current.userData.specId,
          kind: current.userData.kind ?? null,
          roomId: current.userData.roomId ?? null,
        };
      }
      current = current.parent;
    }
    return null;
  }

  function pickSpecAt(clientX, clientY) {
    assertAlive();
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const intersections = raycaster.intersectObjects(root.children, true);
    for (const intersection of intersections) {
      const metadata = findSpecMetadata(intersection.object);
      if (metadata) return metadata;
    }
    return null;
  }

  function setSelectedSpecId(id) {
    assertAlive();
    clearSelectionHelper();
    selectedSpecId = null;

    if (id == null) {
      draw();
      return;
    }

    const target = runtimeBySpecId.get(id);
    if (!target) throw new Error(`Unknown rendered Spec ID: ${id}`);
    selectionHelper = new THREE.BoxHelper(target, DEFAULT_SELECTION_COLOR);
    selectionHelper.name = `selection:${id}`;
    scene.add(selectionHelper);
    selectedSpecId = id;
    draw();
  }

  function getScreenPositionForSpecId(id) {
    assertAlive();
    const target = runtimeBySpecId.get(id);
    if (!target) return null;

    target.updateWorldMatrix(true, true);
    camera.updateWorldMatrix(true, false);
    boundsBox.setFromObject(target);
    if (boundsBox.isEmpty()) return null;
    boundsBox.getCenter(boundsCenter);
    boundsCenter.project(camera);

    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + ((boundsCenter.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - boundsCenter.y) / 2) * rect.height,
    };
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
    pickSpecAt,
    setSelectedSpecId,
    getScreenPositionForSpecId,
    dispose,
    get selectedSpecId() {
      return selectedSpecId;
    },
    get plan() {
      return lastPlan;
    },
  };
}
