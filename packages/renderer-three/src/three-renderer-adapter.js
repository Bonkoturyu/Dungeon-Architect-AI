import { createDrawBatcher } from './draw-batch.js';
import { exportStagedGlb } from './glb-export.js';
import { measurePerformance } from './performance-probe.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  createDungeonScenePlan,
  projectDungeonScenePlan,
  shouldRenderMarkerForRuntime,
} from './scene-plan.js';
import {
  DEFAULT_CHARACTER_COLORS,
  createEnemyCharacterDefinition,
  createPlayerCharacterDefinition,
} from './programmatic-characters.js';
import {
  CHARACTER_MOTION_VERSION,
  characterDefeatPose,
  characterIdlePose,
  characterMotionPhase,
} from './character-motion.js';
import {
  ATMOSPHERE_VERSION,
  createAtmosphereProfile,
} from './atmosphere.js';

const DEFAULT_CLEAR_COLOR = 0x202834;
const DEFAULT_SELECTION_COLOR = 0x66ccff;

export const DEFAULT_MARKER_COLORS = Object.freeze({
  start: 0x22c55e,
  goal: 0x3b82f6,
  enemy: 0xef4444,
  treasure: 0xeab308,
  trap: 0x8b5cf6,
  recovery: 0xf8fafc,
});

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
  const legacyClearColor = new THREE.Color(clearColor).getHex();
  scene.background = new THREE.Color(legacyClearColor);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 1.0;
  controls.minDistance = 5;
  controls.maxDistance = 250;

  const ambient = new THREE.HemisphereLight(0xffffff, 0x222233, 1.5);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(20, 35, 10);
  scene.add(ambient, sun);

  const root = new THREE.Group();
  root.name = 'DungeonSpecRoot';
  scene.add(root);

  const characterEffectsRoot = new THREE.Group();
  characterEffectsRoot.name = 'CharacterMotionEffects';
  scene.add(characterEffectsRoot);

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
    start: new THREE.MeshStandardMaterial({ color: DEFAULT_MARKER_COLORS.start, roughness: 0.68, metalness: 0 }),
    goal: new THREE.MeshStandardMaterial({
      color: DEFAULT_MARKER_COLORS.goal,
      roughness: 0.52,
      metalness: 0.04,
      emissive: 0x102a66,
      emissiveIntensity: 0.42,
    }),
    enemy: new THREE.MeshStandardMaterial({
      color: DEFAULT_MARKER_COLORS.enemy,
      roughness: 0.72,
      metalness: 0,
      emissive: 0x5a1111,
      emissiveIntensity: 0.28,
    }),
    treasure: new THREE.MeshStandardMaterial({
      color: DEFAULT_MARKER_COLORS.treasure,
      roughness: 0.58,
      metalness: 0.12,
      emissive: 0x594100,
      emissiveIntensity: 0.18,
    }),
    trap: new THREE.MeshStandardMaterial({
      color: DEFAULT_MARKER_COLORS.trap,
      roughness: 0.8,
      metalness: 0,
      emissive: 0x2d155f,
      emissiveIntensity: 0.2,
    }),
    recovery: new THREE.MeshStandardMaterial({
      color: DEFAULT_MARKER_COLORS.recovery,
      roughness: 0.64,
      metalness: 0,
      emissive: 0x315f73,
      emissiveIntensity: 0.42,
    }),
    playerBody: new THREE.MeshStandardMaterial({
      color: DEFAULT_CHARACTER_COLORS.playerBody,
      roughness: 0.72,
      metalness: 0,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.2,
    }),
    playerAccent: new THREE.MeshStandardMaterial({
      color: DEFAULT_CHARACTER_COLORS.playerAccent,
      roughness: 0.55,
      metalness: 0.08,
    }),
    playerSkin: new THREE.MeshStandardMaterial({
      color: DEFAULT_CHARACTER_COLORS.playerSkin,
      roughness: 0.78,
      metalness: 0,
    }),
    playerBoot: new THREE.MeshStandardMaterial({
      color: DEFAULT_CHARACTER_COLORS.playerBoot,
      roughness: 0.9,
      metalness: 0,
    }),
    playerWeapon: new THREE.MeshStandardMaterial({
      color: DEFAULT_CHARACTER_COLORS.playerWeapon,
      roughness: 0.32,
      metalness: 0.62,
    }),
    playerArmor: new THREE.MeshStandardMaterial({
      color: DEFAULT_CHARACTER_COLORS.playerArmor,
      roughness: 0.5,
      metalness: 0.3,
    }),
    enemyBody: new THREE.MeshStandardMaterial({
      color: DEFAULT_CHARACTER_COLORS.enemyBody,
      roughness: 0.78,
      metalness: 0,
      emissive: 0x3f0d12,
      emissiveIntensity: 0.2,
    }),
    enemySkin: new THREE.MeshStandardMaterial({
      color: DEFAULT_CHARACTER_COLORS.enemySkin,
      roughness: 0.72,
      metalness: 0,
      emissive: 0x5a1111,
      emissiveIntensity: 0.22,
    }),
    enemyDark: new THREE.MeshStandardMaterial({
      color: DEFAULT_CHARACTER_COLORS.enemyDark,
      roughness: 0.9,
      metalness: 0,
    }),
    enemyHorn: new THREE.MeshStandardMaterial({
      color: DEFAULT_CHARACTER_COLORS.enemyHorn,
      roughness: 0.65,
      metalness: 0.04,
    }),
    draftOpen: new THREE.MeshBasicMaterial({
      color: 0x66ccff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
    draftReady: new THREE.MeshBasicMaterial({
      color: 0x78d89a,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
    draftBlocked: new THREE.MeshBasicMaterial({
      color: 0xff7373,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
  };

  const runtimeBySpecId = new Map();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const boundsBox = new THREE.Box3();
  const boundsCenter = new THREE.Vector3();
  let disposed = false;
  const drawBatch = createDrawBatcher(() => { if (!disposed) measurePerformance('renderer.draw', () => renderer.render(scene, camera)); });
  let lastPlan = null;
  let selectedSpecId = null;
  let selectionHelper = null;
  let selectionFillHelper = null;
  let contextHelper = null;
  let pathHelpers = [];
  let corridorDraftGroup = null;
  let corridorDraftTargetHelper = null;
  let hiddenDraftCorridorId = null;
  let roomDraftRoomId = null;
  let roomDraftEntityIds = [];
  let roomDraftHelper = null;
  let runtimePlayerGroup = null;
  const enemyEncounterSeen = new Set();
  const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  let characterMotionFrame = null;
  let characterMotionLastDraw = 0;
  let characterMotionRenderedFrames = 0;
  let transientDefeats = [];
  let lastAtmosphereProfile = {
    ...createAtmosphereProfile(null, { mode: 'edit' }),
    backgroundColor: legacyClearColor,
  };

  function assertAlive() {
    if (disposed) throw new Error('Three renderer adapter has been disposed.');
  }

  function cloneAtmosphereProfile(profile) {
    return {
      ...profile,
      fog: { ...profile.fog },
      ambient: { ...profile.ambient },
      sun: { ...profile.sun },
    };
  }

  function applyAtmosphere(
    designIntent,
    { mode = 'edit', drawScene = true } = {},
  ) {
    assertAlive();
    const generated = createAtmosphereProfile(designIntent, { mode });
    const profile = generated.enabled
      ? generated
      : {
          ...generated,
          backgroundColor: legacyClearColor,
        };

    scene.background.setHex(profile.backgroundColor);

    if (profile.fog.enabled) {
      scene.fog = new THREE.Fog(
        profile.fog.color,
        profile.fog.near,
        profile.fog.far,
      );
    } else {
      scene.fog = null;
    }

    ambient.color.setHex(profile.ambient.skyColor);
    ambient.groundColor.setHex(profile.ambient.groundColor);
    ambient.intensity = profile.ambient.intensity;

    sun.color.setHex(profile.sun.color);
    sun.intensity = profile.sun.intensity;

    materials.roomCurrent.emissiveIntensity =
      profile.roomCurrentEmissiveIntensity;

    lastAtmosphereProfile = cloneAtmosphereProfile(profile);
    if (drawScene) draw();
    return cloneAtmosphereProfile(lastAtmosphereProfile);
  }

  function getAtmospherePresentationSummary() {
    assertAlive();
    return {
      version: ATMOSPHERE_VERSION,
      ...cloneAtmosphereProfile(lastAtmosphereProfile),
      actual: {
        backgroundColor: scene.background?.getHex?.() ?? null,
        fog: scene.fog
          ? {
              color: scene.fog.color.getHex(),
              near: scene.fog.near,
              far: scene.fog.far,
            }
          : null,
        ambient: {
          skyColor: ambient.color.getHex(),
          groundColor: ambient.groundColor.getHex(),
          intensity: ambient.intensity,
        },
        sun: {
          color: sun.color.getHex(),
          intensity: sun.intensity,
        },
        roomCurrentEmissiveIntensity:
          materials.roomCurrent.emissiveIntensity,
        markerColors: {
          start: materials.start.color.getHex(),
          goal: materials.goal.color.getHex(),
          enemy: materials.enemy.color.getHex(),
          treasure: materials.treasure.color.getHex(),
          trap: materials.trap.color.getHex(),
          recovery: materials.recovery.color.getHex(),
        },
      },
    };
  }

  function prefersReducedMotion() {
    return reducedMotionQuery?.matches === true;
  }

  function motionIdentityForGroup(group) {
    const base = group.userData.motionBase;
    if (!base) return;
    group.position.y = base.positionY;
    group.rotation.y = base.rotationY;
    group.rotation.z = base.rotationZ;
    group.scale.set(base.scaleX, base.scaleY, base.scaleZ);
    for (const child of group.children) {
      const rotation = child.userData?.motionBaseRotation;
      if (!rotation) continue;
      child.rotation.set(rotation.x, rotation.y, rotation.z);
    }
    group.userData.motionPose = {
      offsetY: 0,
      rotationY: 0,
      scaleXz: 1,
      scaleY: 1,
      encounterProgress: 1,
      encounterPulse: 0,
    };
  }

  function applyCharacterMotionPose(group, now) {
    if (!group?.userData?.motionEnabled) return false;
    const base = group.userData.motionBase;
    if (!base) return false;

    const pose = characterIdlePose(
      group.userData.motionKind,
      now - group.userData.motionStartedAt,
      {
        phase: group.userData.motionPhase,
        reducedMotion: prefersReducedMotion(),
        encounterIntro: group.userData.motionEncounterIntro === true,
      },
    );

    group.position.y = base.positionY + pose.offsetY;
    group.rotation.y = base.rotationY + pose.rotationY;
    group.rotation.z = base.rotationZ;
    group.scale.set(
      base.scaleX * pose.scaleXz,
      base.scaleY * pose.scaleY,
      base.scaleZ * pose.scaleXz,
    );

    for (const child of group.children) {
      const rotation = child.userData?.motionBaseRotation;
      if (!rotation) continue;
      child.rotation.set(rotation.x, rotation.y, rotation.z);
      if (child.userData.part === 'left-arm') {
        child.rotation.z += pose.leftArmDeltaZ;
      } else if (child.userData.part === 'right-arm') {
        child.rotation.z += pose.rightArmDeltaZ;
      } else if (child.userData.part === 'head') {
        child.rotation.z += pose.headDeltaZ;
      }
    }

    group.userData.motionPose = {
      offsetY: pose.offsetY,
      rotationY: pose.rotationY,
      scaleXz: pose.scaleXz,
      scaleY: pose.scaleY,
      encounterProgress: pose.encounterProgress,
      encounterPulse: pose.encounterPulse,
    };
    return true;
  }

  function clearTransientDefeats() {
    for (const entry of transientDefeats) {
      characterEffectsRoot.remove(entry.object);
      disposeObjectTree(entry.object);
    }
    transientDefeats = [];
  }

  function captureDefeatedEnemyEffects(nextMap, entityStates) {
    if (prefersReducedMotion()) return;
    const now = performance.now();

    for (const [specId, object] of runtimeBySpecId) {
      if (object.userData?.presentationKind !== 'enemy-character') continue;
      if (nextMap.has(specId)) continue;
      if (entityStates?.[specId]?.status !== 'defeated') continue;

      root.remove(object);
      motionIdentityForGroup(object);
      characterEffectsRoot.add(object);
      transientDefeats.push({
        object,
        startedAt: now,
        baseY: object.position.y,
        baseRotationZ: object.rotation.z,
        baseScale: {
          x: object.scale.x,
          y: object.scale.y,
          z: object.scale.z,
        },
      });
    }
  }

  function updateTransientDefeats(now) {
    if (transientDefeats.length === 0) return false;
    const survivors = [];

    for (const entry of transientDefeats) {
      const pose = characterDefeatPose(now - entry.startedAt, {
        reducedMotion: prefersReducedMotion(),
      });

      if (pose.finished) {
        characterEffectsRoot.remove(entry.object);
        disposeObjectTree(entry.object);
        continue;
      }

      entry.object.position.y = entry.baseY + pose.offsetY;
      entry.object.rotation.z = entry.baseRotationZ + pose.rotationZ;
      entry.object.scale.set(
        entry.baseScale.x * pose.scale,
        entry.baseScale.y * pose.scale,
        entry.baseScale.z * pose.scale,
      );
      survivors.push(entry);
    }

    transientDefeats = survivors;
    return survivors.length > 0;
  }

  function characterMotionTargets() {
    const targets = [];
    if (runtimePlayerGroup?.userData?.motionEnabled) targets.push(runtimePlayerGroup);
    for (const object of runtimeBySpecId.values()) {
      if (
        object.userData?.presentationKind === 'enemy-character' &&
        object.userData?.motionEnabled
      ) {
        targets.push(object);
      }
    }
    return targets;
  }

  function stopCharacterMotionLoop() {
    if (characterMotionFrame != null) {
      cancelAnimationFrame(characterMotionFrame);
      characterMotionFrame = null;
    }
  }

  function characterMotionTick(now) {
    characterMotionFrame = null;
    if (disposed) return;

    const targets = characterMotionTargets();
    if (prefersReducedMotion()) {
      for (const group of targets) motionIdentityForGroup(group);
      clearTransientDefeats();
      draw();
      return;
    }

    const active = targets.length > 0 || transientDefeats.length > 0;
    if (!active) return;

    if (now - characterMotionLastDraw >= 1000 / 30) {
      for (const group of targets) applyCharacterMotionPose(group, now);
      updateTransientDefeats(now);
      characterMotionLastDraw = now;
      characterMotionRenderedFrames += 1;
      measurePerformance('renderer.draw', () => renderer.render(scene, camera));
    }

    if (characterMotionTargets().length > 0 || transientDefeats.length > 0) {
      characterMotionFrame = requestAnimationFrame(characterMotionTick);
    }
  }

  function syncCharacterMotionLoop() {
    const targets = characterMotionTargets();
    if (prefersReducedMotion()) {
      stopCharacterMotionLoop();
      for (const group of targets) motionIdentityForGroup(group);
      clearTransientDefeats();
      return;
    }

    if (targets.length === 0 && transientDefeats.length === 0) {
      stopCharacterMotionLoop();
      return;
    }

    if (characterMotionFrame == null) {
      characterMotionFrame = requestAnimationFrame(characterMotionTick);
    }
  }

  function onReducedMotionChange() {
    const targets = characterMotionTargets();
    if (prefersReducedMotion()) {
      stopCharacterMotionLoop();
      for (const group of targets) motionIdentityForGroup(group);
      clearTransientDefeats();
      draw();
    } else {
      characterMotionLastDraw = 0;
      syncCharacterMotionLoop();
    }
  }

  function disposeObjectTree(object) {
    object.traverse((node) => {
      if (node.geometry?.dispose) node.geometry.dispose();
    });
  }

  function clearSelectionHelper() {
    if (selectionHelper) {
      scene.remove(selectionHelper);
      selectionHelper.geometry?.dispose();
      selectionHelper.material?.dispose();
      selectionHelper = null;
    }
    if (selectionFillHelper) {
      scene.remove(selectionFillHelper);
      selectionFillHelper.geometry?.dispose();
      selectionFillHelper.material?.dispose();
      selectionFillHelper = null;
    }
  }

  function clearContextHelper() {
    if (!contextHelper) return;
    scene.remove(contextHelper);
    contextHelper.geometry?.dispose();
    contextHelper.material?.dispose();
    contextHelper = null;
  }

  function clearPathHelpers() {
    for (const helper of pathHelpers) {
      scene.remove(helper);
      helper.geometry?.dispose();
      helper.material?.dispose();
    }
    pathHelpers = [];
  }

  function clearCorridorDraftPreview() {
    if (corridorDraftGroup) {
      scene.remove(corridorDraftGroup);
      disposeObjectTree(corridorDraftGroup);
      corridorDraftGroup = null;
    }
    if (corridorDraftTargetHelper) {
      scene.remove(corridorDraftTargetHelper);
      corridorDraftTargetHelper.geometry?.dispose();
      corridorDraftTargetHelper.material?.dispose();
      corridorDraftTargetHelper = null;
    }
    if (hiddenDraftCorridorId) {
      const hidden = runtimeBySpecId.get(hiddenDraftCorridorId);
      if (hidden) hidden.visible = true;
      hiddenDraftCorridorId = null;
    }
    draw();
  }

  function clearRoomDraftPreview() {
    if (roomDraftRoomId) {
      const room = runtimeBySpecId.get(roomDraftRoomId);
      if (room) room.position.set(0, 0, 0);
    }
    for (const entityId of roomDraftEntityIds) {
      const entity = runtimeBySpecId.get(entityId);
      if (entity) entity.position.set(0, 0, 0);
    }
    const restoredRoomId = roomDraftRoomId;
    roomDraftRoomId = null;
    roomDraftEntityIds = [];
    if (roomDraftHelper) {
      scene.remove(roomDraftHelper);
      roomDraftHelper.geometry?.dispose();
      roomDraftHelper.material?.dispose();
      roomDraftHelper = null;
    }
    selectionHelper?.update?.();
    if (selectionFillHelper && restoredRoomId) {
      const roomPlan = lastPlan?.roomGroups?.find((entry) => entry.specId === restoredRoomId);
      const floor = roomPlan?.boxes?.find((box) => box.part === 'floor');
      if (floor) {
        selectionFillHelper.position.x = floor.position.x;
        selectionFillHelper.position.z = floor.position.z;
      }
    }
    draw();
  }

  function clearRenderedSpec() {
    stopCharacterMotionLoop();
    clearSelectionHelper();
    clearContextHelper();
    clearPathHelpers();
    clearCorridorDraftPreview();
    clearRoomDraftPreview();
    selectedSpecId = null;
    for (const child of [...root.children]) {
      root.remove(child);
      disposeObjectTree(child);
    }
    runtimeBySpecId.clear();
    runtimePlayerGroup = null;
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

  function characterGeometry(definition) {
    if (definition.primitive === 'box') return new THREE.BoxGeometry(1, 1, 1);
    if (definition.primitive === 'sphere') {
      return new THREE.SphereGeometry(
        0.5,
        definition.segments?.width ?? 8,
        definition.segments?.height ?? 6,
      );
    }
    if (definition.primitive === 'cone') {
      return new THREE.ConeGeometry(
        0.5,
        1,
        definition.segments?.radial ?? 6,
      );
    }
    if (definition.primitive === 'cylinder') {
      return new THREE.CylinderGeometry(
        0.5,
        0.5,
        1,
        definition.segments?.radial ?? 8,
      );
    }
    throw new TypeError(`Unsupported programmatic character primitive: ${definition.primitive}`);
  }

  function addCharacterDefinition(
    targetRoot,
    targetMap,
    definition,
    {
      specId = null,
      kind,
      roomId,
      runtimeOnly = false,
      motionEnabled = false,
      encounterIntro = false,
    } = {},
  ) {
    const group = new THREE.Group();
    group.name = runtimeOnly
      ? `${kind}:runtime`
      : `${kind}:${specId}`;
    group.userData.kind = kind;
    group.userData.roomId = roomId;
    group.userData.presentationKind = definition.kind;
    group.userData.partNames = definition.parts.map((entry) => entry.name);
    group.userData.equipment = definition.equipment ? { ...definition.equipment } : null;
    group.userData.level = definition.level ?? null;
    group.userData.motionEnabled = motionEnabled === true;
    group.userData.motionKind = kind === 'enemy' ? 'enemy' : 'player';
    group.userData.motionEncounterIntro = encounterIntro === true;
    group.userData.motionStartedAt = performance.now();
    group.userData.motionPhase = characterMotionPhase(specId ?? `${kind}:${roomId}`);
    if (!runtimeOnly && specId) group.userData.specId = specId;
    group.position.set(definition.position.x, definition.position.y, definition.position.z);
    group.userData.motionBase = {
      positionY: group.position.y,
      rotationY: group.rotation.y,
      rotationZ: group.rotation.z,
      scaleX: group.scale.x,
      scaleY: group.scale.y,
      scaleZ: group.scale.z,
    };

    for (const partDefinition of definition.parts) {
      const geometry = characterGeometry(partDefinition);
      const material = materials[partDefinition.materialRole];
      if (!material) throw new Error(`Unknown character material role: ${partDefinition.materialRole}`);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `${kind}:${partDefinition.name}`;
      mesh.userData.kind = kind;
      mesh.userData.roomId = roomId;
      mesh.userData.part = partDefinition.name;
      if (!runtimeOnly && specId) mesh.userData.specId = specId;
      mesh.position.set(
        partDefinition.position.x,
        partDefinition.position.y,
        partDefinition.position.z,
      );
      mesh.scale.set(
        partDefinition.scale.x,
        partDefinition.scale.y,
        partDefinition.scale.z,
      );
      if (partDefinition.rotation) {
        mesh.rotation.set(
          partDefinition.rotation.x ?? 0,
          partDefinition.rotation.y ?? 0,
          partDefinition.rotation.z ?? 0,
        );
      }
      mesh.userData.motionBaseRotation = {
        x: mesh.rotation.x,
        y: mesh.rotation.y,
        z: mesh.rotation.z,
      };
      group.add(mesh);
    }

    targetRoot.add(group);
    if (!runtimeOnly && specId) targetMap.set(specId, group);
    return group;
  }

  function addMarker(
    targetRoot,
    targetMap,
    marker,
    entityStates = null,
    { motionEnabled = false } = {},
  ) {
    if (!shouldRenderMarkerForRuntime(marker, entityStates)) return;
    if (marker.type === 'enemy') {
      const definition = createEnemyCharacterDefinition(marker);
      const encounterIntro =
        motionEnabled === true &&
        !enemyEncounterSeen.has(marker.specId);
      if (motionEnabled) enemyEncounterSeen.add(marker.specId);
      addCharacterDefinition(targetRoot, targetMap, definition, {
        specId: marker.specId,
        kind: 'enemy',
        roomId: marker.roomId,
        motionEnabled,
        encounterIntro,
      });
      return;
    }

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
    } else if (marker.type === 'treasure') {
      geometry = new THREE.BoxGeometry(1.0, marker.height, 0.78);
      material = materials.treasure;
    } else if (marker.type === 'trap') {
      geometry = new THREE.CylinderGeometry(0.82, 0.82, marker.height, 6);
      material = materials.trap;
    } else if (marker.type === 'shop') {
      geometry = new THREE.BoxGeometry(1.35, marker.height, 1.0);
      material = materials.treasure;
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

  function buildStagingScene(
    plan,
    { resultMode = false, entityStates = null, showPlayer = false, playerState = null } = {},
  ) {
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
      const motionEnabled = Boolean(plan.visibility);
      for (const marker of plan.markers) {
        addMarker(stagingRoot, stagingMap, marker, entityStates, {
          motionEnabled,
        });
      }

      let playerGroup = null;
      if (showPlayer && plan.visibility?.currentRoomId) {
        const currentRoom = plan.roomGroups.find((group) => group.specId === plan.visibility.currentRoomId);
        const floor = currentRoom?.boxes?.find((box) => box.part === 'floor');
        if (floor) {
          const definition = createPlayerCharacterDefinition({
            roomId: plan.visibility.currentRoomId,
            playerState,
            position: {
              x: floor.position.x + Math.min(1.45, floor.size.x * 0.18),
              y: 0,
              z: floor.position.z,
            },
          });
          playerGroup = addCharacterDefinition(stagingRoot, stagingMap, definition, {
            kind: 'player',
            roomId: plan.visibility.currentRoomId,
            runtimeOnly: true,
            motionEnabled: true,
          });
        }
      }

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

      return { stagingRoot, stagingMap, playerGroup };
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
    controls.target.set(bounds.centerX, 0, bounds.centerZ);
    controls.update();
  }

  async function exportDungeonGlb(spec) {
    assertAlive();
    // 編集確定済みの1階を同じbuilderで再構築する。live rootの一時移動、
    // 選択/ドラッグpreview、Fog of War、Play状態、cameraは参照・変更しない。
    const { stagingRoot } = buildStagingScene(createDungeonScenePlan(spec));
    stagingRoot.name = 'DungeonFloor';
    try {
      return await exportStagedGlb(stagingRoot);
    } finally {
      disposeObjectTree(stagingRoot);
    }
  }

  function draw() { drawBatch.draw(); }

  function withDeferredDraws(operation) { assertAlive(); return drawBatch.run(operation); }

  function render(
    spec,
    {
      visibility = null,
      resultMode = false,
      entityStates = null,
      showPlayer = false,
      playerState = null,
      designIntent = null,
      presentationMode = 'edit',
    } = {},
  ) {
    assertAlive();
    applyAtmosphere(designIntent, {
      mode: presentationMode,
      drawScene: false,
    });
    const previousPlan = lastPlan;
    const fullPlan = measurePerformance('renderer.scenePlan', () => createDungeonScenePlan(spec));
    const plan = visibility ? measurePerformance('renderer.projectPlan', () => projectDungeonScenePlan(fullPlan, visibility)) : fullPlan;
    const { stagingRoot, stagingMap, playerGroup } = measurePerformance('renderer.buildScene', () => buildStagingScene(plan, {
      resultMode,
      entityStates,
      showPlayer,
      playerState,
    }));
    const previousVisibility = previousPlan?.visibility ?? null;
    const nextVisibility = plan.visibility ?? null;
    const visibilityChanged =
      Boolean(previousVisibility) !== Boolean(nextVisibility) ||
      (previousVisibility && nextVisibility && (
        previousVisibility.currentRoomId !== nextVisibility.currentRoomId ||
        previousVisibility.roomIds.join('|') !== nextVisibility.roomIds.join('|') ||
        previousVisibility.corridorIds.join('|') !== nextVisibility.corridorIds.join('|')
      ));
    const shouldFitCamera =
      !previousPlan ||
      previousPlan.sourceSpecId !== plan.sourceSpecId ||
      visibilityChanged;

    captureDefeatedEnemyEffects(stagingMap, entityStates);
    measurePerformance('renderer.disposePrevious', () => clearRenderedSpec());
    for (const child of [...stagingRoot.children]) {
      stagingRoot.remove(child);
      root.add(child);
    }
    for (const [specId, object] of stagingMap) runtimeBySpecId.set(specId, object);
    runtimePlayerGroup = playerGroup ?? null;

    if (shouldFitCamera) fitCamera(plan.bounds, { playMode: Boolean(visibility) });
    lastPlan = plan;

    const motionNow = performance.now();
    for (const group of characterMotionTargets()) {
      applyCharacterMotionPose(group, motionNow);
    }
    draw();
    syncCharacterMotionLoop();

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

  function setRayFromClient(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return true;
  }

  function pickDetailedAt(clientX, clientY) {
    assertAlive();
    if (!setRayFromClient(clientX, clientY)) return null;

    const intersections = raycaster.intersectObjects(root.children, true);
    for (const intersection of intersections) {
      const metadata = findSpecMetadata(intersection.object);
      if (!metadata) continue;
      return {
        ...metadata,
        part: intersection.object.userData?.part ?? null,
        point: {
          x: intersection.point.x,
          y: intersection.point.y,
          z: intersection.point.z,
        },
      };
    }
    return null;
  }

  function pickSpecAt(clientX, clientY) {
    return pickDetailedAt(clientX, clientY);
  }

  function getGroundPointAt(clientX, clientY, y = 0) {
    assertAlive();
    if (!setRayFromClient(clientX, clientY)) return null;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, point)) return null;
    return { x: point.x, y: point.y, z: point.z };
  }

  function setCorridorDraftPreview({
    points = [],
    width = 3,
    state = 'open',
    existingCorridorId = null,
    targetRoomId = null,
  } = {}) {
    assertAlive();

    if (corridorDraftGroup) {
      scene.remove(corridorDraftGroup);
      disposeObjectTree(corridorDraftGroup);
      corridorDraftGroup = null;
    }
    if (corridorDraftTargetHelper) {
      scene.remove(corridorDraftTargetHelper);
      corridorDraftTargetHelper.geometry?.dispose();
      corridorDraftTargetHelper.material?.dispose();
      corridorDraftTargetHelper = null;
    }
    if (hiddenDraftCorridorId && hiddenDraftCorridorId !== existingCorridorId) {
      const oldHidden = runtimeBySpecId.get(hiddenDraftCorridorId);
      if (oldHidden) oldHidden.visible = true;
      hiddenDraftCorridorId = null;
    }

    if (existingCorridorId) {
      const existing = runtimeBySpecId.get(existingCorridorId);
      if (existing) {
        existing.visible = false;
        hiddenDraftCorridorId = existingCorridorId;
      }
    }

    const material = state === 'ready'
      ? materials.draftReady
      : state === 'blocked'
        ? materials.draftBlocked
        : materials.draftOpen;

    const group = new THREE.Group();
    group.name = 'corridor-draft-preview';

    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index];
      const to = points[index + 1];
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const length = Math.abs(dx) + Math.abs(dz);
      if (length <= 1e-9) continue;

      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `corridor-draft-segment-${index}`;
      mesh.position.set((from.x + to.x) / 2, 0.05, (from.z + to.z) / 2);
      if (Math.abs(dx) > Math.abs(dz)) mesh.scale.set(length, 0.1, width);
      else mesh.scale.set(width, 0.1, length);
      group.add(mesh);
    }

    for (let index = 1; index < points.length - 1; index += 1) {
      const point = points[index];
      const junction = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
      junction.name = `corridor-draft-junction-${index}`;
      junction.position.set(point.x, 0.052, point.z);
      junction.scale.set(width, 0.104, width);
      group.add(junction);
    }

    corridorDraftGroup = group;
    scene.add(group);

    if (targetRoomId) {
      const target = runtimeBySpecId.get(targetRoomId);
      if (target) {
        corridorDraftTargetHelper = new THREE.BoxHelper(
          target,
          state === 'blocked' ? 0xff7373 : 0x78d89a,
        );
        corridorDraftTargetHelper.name = `corridor-draft-target:${targetRoomId}`;
        scene.add(corridorDraftTargetHelper);
      }
    }

    draw();
  }

  function setRoomDraftPreview({
    roomId,
    x,
    z,
    state = 'ready',
  } = {}) {
    assertAlive();
    if (typeof roomId !== 'string' || !Number.isFinite(x) || !Number.isFinite(z)) return false;

    if (roomDraftRoomId && roomDraftRoomId !== roomId) clearRoomDraftPreview();

    const room = runtimeBySpecId.get(roomId);
    const roomPlan = lastPlan?.roomGroups?.find((entry) => entry.specId === roomId);
    const floor = roomPlan?.boxes?.find((box) => box.part === 'floor');
    if (!room || !floor) return false;

    const dx = x - floor.position.x;
    const dz = z - floor.position.z;
    room.position.set(dx, 0, dz);

    roomDraftRoomId = roomId;
    roomDraftEntityIds = [];
    for (const [specId, object] of runtimeBySpecId) {
      if (object.userData?.roomId !== roomId) continue;
      object.position.set(dx, 0, dz);
      roomDraftEntityIds.push(specId);
    }

    if (roomDraftHelper) {
      scene.remove(roomDraftHelper);
      roomDraftHelper.geometry?.dispose();
      roomDraftHelper.material?.dispose();
    }
    roomDraftHelper = new THREE.BoxHelper(room, state === 'blocked' ? 0xff7373 : 0x78d89a);
    roomDraftHelper.name = `room-draft:${roomId}`;
    scene.add(roomDraftHelper);

    selectionHelper?.update?.();
    if (selectionFillHelper) {
      selectionFillHelper.position.x = x;
      selectionFillHelper.position.z = z;
    }
    draw();
    return true;
  }

  function setCameraControlsEnabled(enabled) {
    assertAlive();
    controls.enabled = enabled === true;
  }

  function getScreenPositionForWorldPoint(point) {
    assertAlive();
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return null;
    const projected = new THREE.Vector3(
      point.x,
      Number.isFinite(point.y) ? point.y : 0,
      point.z,
    );
    camera.updateWorldMatrix(true, false);
    projected.project(camera);
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + ((projected.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - projected.y) / 2) * rect.height,
    };
  }

  function getScreenPositionForRoomWall(roomId, side) {
    assertAlive();
    const room = lastPlan?.roomGroups?.find((entry) => entry.specId === roomId);
    const floor = room?.boxes?.find((box) => box.part === 'floor');
    if (!floor) return null;
    const point = { x: floor.position.x, y: 1.2, z: floor.position.z };
    if (side === 'north') point.z -= floor.size.z / 2;
    else if (side === 'south') point.z += floor.size.z / 2;
    else if (side === 'west') point.x -= floor.size.x / 2;
    else if (side === 'east') point.x += floor.size.x / 2;
    else return null;
    return getScreenPositionForWorldPoint(point);
  }

  function setSelectedSpecId(...args) { return measurePerformance('renderer.setSelectedSpecId', () => setSelectedSpecIdImplementation(...args)); }

  function setSelectedSpecIdImplementation(id) {
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

    if (target.userData?.kind === 'room') {
      const box = new THREE.Box3().setFromObject(target);
      if (!box.isEmpty()) {
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        selectionFillHelper = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.max(0.5, size.x + 0.4), Math.max(0.5, size.z + 0.4)),
          new THREE.MeshBasicMaterial({
            color: DEFAULT_SELECTION_COLOR,
            transparent: true,
            opacity: 0.18,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        selectionFillHelper.name = `selection-fill:${id}`;
        selectionFillHelper.rotation.x = -Math.PI / 2;
        selectionFillHelper.position.set(center.x, 0.045, center.z);
        scene.add(selectionFillHelper);
      }
    }

    selectedSpecId = id;
    draw();
  }

  function setContextSpecId(...args) { return measurePerformance('renderer.setContextSpecId', () => setContextSpecIdImplementation(...args)); }

  function setContextSpecIdImplementation(id) {
    assertAlive();
    clearContextHelper();
    if (id == null) {
      draw();
      return;
    }
    const target = runtimeBySpecId.get(id);
    if (!target) return;
    const targetBounds = new THREE.Box3().setFromObject(target);
    if (targetBounds.isEmpty()) return;
    contextHelper = new THREE.BoxHelper(target, 0x8bdcff);
    contextHelper.name = `context:${id}`;
    scene.add(contextHelper);
    draw();
  }

  function focusSpecId(id, { preserveDistance = true } = {}) {
    assertAlive();
    const target = runtimeBySpecId.get(id);
    if (!target) return false;
    target.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(target);
    if (box.isEmpty()) return false;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const offset = camera.position.clone().sub(controls.target);
    const distance = Math.max(controls.minDistance, offset.length());
    if (offset.lengthSq() <= 1e-9) offset.set(1, 1, 1).normalize();
    else offset.normalize();
    controls.target.copy(center);
    camera.position.copy(center).add(offset.multiplyScalar(preserveDistance ? distance : Math.max(8, distance)));
    controls.update();
    draw();
    return true;
  }

  function setHighlightedSpecIds(...args) { return measurePerformance('renderer.setHighlightedSpecIds', () => setHighlightedSpecIdsImplementation(...args)); }

  function setHighlightedSpecIdsImplementation(ids = []) {
    assertAlive();
    clearPathHelpers();
    for (const id of [...new Set(ids)].filter((value) => typeof value === 'string')) {
      const target = runtimeBySpecId.get(id);
      if (!target) continue;
      const targetBounds = new THREE.Box3().setFromObject(target);
      if (targetBounds.isEmpty()) continue;
      const helper = new THREE.BoxHelper(target, 0xf4c95d);
      helper.name = `path-highlight:${id}`;
      scene.add(helper);
      pathHelpers.push(helper);
    }
    draw();
  }

  function getCameraState() {
    assertAlive();
    return {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      distance: camera.position.distanceTo(controls.target),
    };
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

  function getCharacterPresentationSummary() {
    assertAlive();
    const enemies = [];
    for (const [specId, object] of runtimeBySpecId) {
      if (object.userData?.presentationKind !== 'enemy-character') continue;
      enemies.push({
        specId,
        roomId: object.userData.roomId ?? null,
        partNames: [...(object.userData.partNames ?? [])],
        motion: object.userData.motionPose
          ? { ...object.userData.motionPose }
          : null,
      });
    }
    enemies.sort((a, b) => a.specId.localeCompare(b.specId));

    return {
      motion: {
        version: CHARACTER_MOTION_VERSION,
        reducedMotion: prefersReducedMotion(),
        frameActive: characterMotionFrame != null,
        renderedFrames: characterMotionRenderedFrames,
        transientDefeatCount: transientDefeats.length,
      },
      player: runtimePlayerGroup
        ? {
            roomId: runtimePlayerGroup.userData.roomId ?? null,
            partNames: [...(runtimePlayerGroup.userData.partNames ?? [])],
            equipment: runtimePlayerGroup.userData.equipment
              ? { ...runtimePlayerGroup.userData.equipment }
              : null,
            level: runtimePlayerGroup.userData.level ?? null,
            motion: runtimePlayerGroup.userData.motionPose
              ? { ...runtimePlayerGroup.userData.motionPose }
              : null,
          }
        : null,
      enemies,
    };
  }

  function dispose() {
    if (disposed) return;
    stopCharacterMotionLoop();
    clearRenderedSpec();
    clearTransientDefeats();
    reducedMotionQuery?.removeEventListener?.('change', onReducedMotionChange);
    canvas.removeEventListener('contextmenu', preventContextMenu);
    controls.dispose();
    for (const material of Object.values(materials)) material.dispose();
    renderer.dispose();
    disposed = true;
  }

  const preventContextMenu = (event) => event.preventDefault();
  canvas.addEventListener('contextmenu', preventContextMenu);
  controls.addEventListener('change', draw);
  reducedMotionQuery?.addEventListener?.('change', onReducedMotionChange);

  return {
    render,
    exportDungeonGlb,
    withDeferredDraws,
    resize,
    getObjectBySpecId,
    pickSpecAt,
    pickDetailedAt,
    getGroundPointAt,
    setCorridorDraftPreview,
    clearCorridorDraftPreview,
    setRoomDraftPreview,
    clearRoomDraftPreview,
    setCameraControlsEnabled,
    setSelectedSpecId,
    setContextSpecId,
    focusSpecId,
    setHighlightedSpecIds,
    getCameraState,
    getScreenPositionForSpecId,
    getScreenPositionForWorldPoint,
    getScreenPositionForRoomWall,
    getCharacterPresentationSummary,
    applyAtmosphere,
    getAtmospherePresentationSummary,
    dispose,
    get selectedSpecId() {
      return selectedSpecId;
    },
    get plan() {
      return lastPlan;
    },
  };
}
