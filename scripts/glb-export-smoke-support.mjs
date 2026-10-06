import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createDungeonScenePlan } from '../packages/renderer-three/src/scene-plan.js';
import { createEnemyCharacterDefinition, DEFAULT_CHARACTER_COLORS } from '../packages/renderer-three/src/programmatic-characters.js';
import { createFullDungeonExport } from '../packages/export-core/src/layout-exchange.js';

// Browser downloadとNode補助検証で同じ独立したfixture/roundtrip契約を使う。
// 描画adapterは参照せず、ScenePlanと実際のGLTFLoaderから座標・材質を照合する。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const near = (actual, expected, label, tolerance = 2e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} != ${expected}`);
const vectorNear = (actual, expected, label) => ['x', 'y', 'z'].forEach((axis) => near(actual[axis], expected[axis], `${label}.${axis}`));

const fixture = JSON.parse(fs.readFileSync(path.join(root, 'spec/dungeon/fixtures/minimal-valid-v1.json'), 'utf8'));
fixture.entities.push(
  { id: 'trap-1', type: 'trap', roomId: 'room-middle' },
  { id: 'recovery-1', type: 'recovery', roomId: 'room-start' },
  { id: 'shop-1', type: 'shop', roomId: 'room-goal', offers: [
    { id: 'DO_NOT_EXPORT_GAMEPLAY_OFFER', type: 'healing', price: 73, stock: 2, healing: 12 },
  ] },
);
fixture.trapRules = { version: 'seeded-avoidance-1' };
fixture.difficulty = 'easy';
function makeFloor(index, x, z) {
  const spec = structuredClone(fixture);
  const id = (value) => `f${index}-${value}`;
  spec.id = `glb-smoke-floor-${index}`;
  spec.seed += index;
  spec.rooms = spec.rooms.map((room) => ({ ...room, id: id(room.id), x: room.x + x, z: room.z + z }));
  spec.corridors = spec.corridors.map((corridor) => ({ ...corridor, id: id(corridor.id), fromRoomId: id(corridor.fromRoomId), toRoomId: id(corridor.toRoomId) }));
  spec.entities = spec.entities.map((entity) => ({ ...entity, id: id(entity.id), roomId: id(entity.roomId) }));
  return spec;
}
export const floors = [makeFloor(1, -6, -9), makeFloor(2, 100, 50)];
export const importedFixture = createFullDungeonExport(floors, { id: 'glb-two-floor-fixture' });
const materialDefinitions = {
  room: [0xb8c5d8, 0.88, 0], corridor: [0x8d9bb1, 0.94, 0],
  start: [0x22c55e, 0.68, 0], goal: [0x3b82f6, 0.52, 0.04, 0x102a66, 0.42],
  treasure: [0xeab308, 0.58, 0.12, 0x594100, 0.18], shop: [0xeab308, 0.58, 0.12, 0x594100, 0.18],
  trap: [0x8b5cf6, 0.8, 0, 0x2d155f, 0.2], recovery: [0xf8fafc, 0.64, 0, 0x315f73, 0.42],
  enemyBody: [DEFAULT_CHARACTER_COLORS.enemyBody, 0.78, 0, 0x3f0d12, 0.2],
  enemySkin: [DEFAULT_CHARACTER_COLORS.enemySkin, 0.72, 0, 0x5a1111, 0.22],
  enemyDark: [DEFAULT_CHARACTER_COLORS.enemyDark, 0.9, 0],
  enemyHorn: [DEFAULT_CHARACTER_COLORS.enemyHorn, 0.65, 0.04],
};
function assertMaterial(mesh, role) {
  const expected = materialDefinitions[role];
  assert.ok(expected, `Known material role: ${role}`);
  const material = mesh.material;
  assert.equal(material.isMeshStandardMaterial, true);
  const color = new THREE.Color(expected[0]);
  for (const component of ['r', 'g', 'b']) near(material.color[component], color[component], `${role}.color.${component}`);
  near(material.roughness, expected[1], `${role}.roughness`);
  near(material.metalness, expected[2], `${role}.metalness`);
  near(material.opacity, 1, `${role}.opacity`);
  assert.equal(material.transparent, false);
  assert.equal(material.side, THREE.FrontSide);
  const emissive = new THREE.Color(expected[3] ?? 0).multiplyScalar(expected[4] ?? 1);
  for (const component of ['r', 'g', 'b']) near(material.emissive[component] * material.emissiveIntensity,
    emissive[component], `${role}.emissive.${component}`);
}
export async function inspectGlbDownload(download, floorIndex) {
  const { bytes } = download;
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB magic');
  assert.equal(bytes.readUInt32LE(4), 2, 'GLB version');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB length');
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, 'GLB JSON chunk');
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  assert.equal(json.asset.version, '2.0');
  assert.ok(json.buffers?.length === 1 && json.buffers.every((buffer) => !buffer.uri), 'Self-contained binary buffer');
  assert.equal(json.images?.length ?? 0, 0);
  assert.equal(json.animations?.length ?? 0, 0);
  assert.equal(json.cameras?.length ?? 0, 0);
  assert.ok(!json.extensions?.KHR_lights_punctual);
  assert.ok(json.nodes.every((node) => !node.extras || Object.keys(node.extras).length === 0), 'No runtime/editor/gameplay metadata');
  assert.ok(!JSON.stringify(json).includes('DO_NOT_EXPORT_GAMEPLAY_OFFER'));
  assert.ok(!json.nodes.some((node) => /player|draft|preview|selection|grid|helper|current-room-ring|CharacterMotionEffects/i.test(node.name ?? '')), 'No editor/play helpers');
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const originalName = (object) => json.nodes[gltf.parser.associations.get(object)?.nodes]?.name ?? object.name;
  const rootGroup = gltf.scene.children.find((object) => originalName(object) === 'DungeonFloor');
  assert.ok(rootGroup, 'Current-floor root exists');
  const spec = floors[floorIndex];
  const plan = createDungeonScenePlan(spec);
  const expectedGroupNames = [...plan.roomGroups.map((group) => `room:${group.specId}`),
    ...plan.corridorGroups.map((group) => `corridor:${group.specId}`), ...plan.markers.map((marker) => `${marker.type}:${marker.specId}`)];
  assert.deepEqual(rootGroup.children.map(originalName).sort(), expectedGroupNames.sort(), 'Exact selected-floor groups');
  const findGroup = (name) => rootGroup.children.find((object) => originalName(object) === name);
  const expectedBounds = new THREE.Box3();
  const loadedGeometryBounds = new THREE.Box3();
  let expectedMeshes = 0;
  for (const definition of [...plan.roomGroups, ...plan.corridorGroups]) {
    const group = findGroup(`${definition.kind}:${definition.specId}`);
    assert.equal(group.children.length, definition.boxes.length);
    for (const box of definition.boxes) {
      const mesh = group.children.find((object) => originalName(object) === `${definition.specId}:${box.part}`);
      assert.ok(mesh?.isMesh, `Rendered box ${definition.specId}:${box.part}`);
      vectorNear(mesh.getWorldPosition(new THREE.Vector3()), box.position, mesh.name);
      vectorNear(mesh.getWorldScale(new THREE.Vector3()), box.size, `${mesh.name}.scale`);
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3(box.position.x, box.position.y, box.position.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), box.rotationY), new THREE.Vector3(box.size.x, box.size.y, box.size.z));
      mesh.matrixWorld.elements.forEach((value, index) => near(value, matrix.elements[index], `${mesh.name}.matrix[${index}]`));
      expectedBounds.union(new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5)).applyMatrix4(matrix));
      loadedGeometryBounds.union(new THREE.Box3().setFromObject(mesh, true));
      assertMaterial(mesh, definition.kind);
      expectedMeshes += 1;
    }
  }
  vectorNear(loadedGeometryBounds.min, expectedBounds.min, 'Geometry bounds min');
  vectorNear(loadedGeometryBounds.max, expectedBounds.max, 'Geometry bounds max');
  for (const marker of plan.markers) {
    const group = findGroup(`${marker.type}:${marker.specId}`);
    if (marker.type === 'enemy') {
      const definition = createEnemyCharacterDefinition(marker);
      vectorNear(group.getWorldPosition(new THREE.Vector3()), definition.position, 'Enemy position');
      assert.equal(group.children.length, definition.parts.length);
      for (const part of definition.parts) {
        const mesh = group.children.find((object) => originalName(object) === `enemy:${part.name}`);
        assert.ok(mesh?.isMesh, `Enemy visual part ${part.name}`);
        vectorNear(mesh.getWorldPosition(new THREE.Vector3()), {
          x: definition.position.x + part.position.x, y: definition.position.y + part.position.y, z: definition.position.z + part.position.z,
        }, part.name);
        vectorNear(mesh.getWorldScale(new THREE.Vector3()), part.scale, `${part.name}.scale`);
        assertMaterial(mesh, part.materialRole);
      }
      expectedMeshes += definition.parts.length;
    } else {
      assert.equal(group.children.length, 1);
      assert.ok(group.children[0].isMesh);
      vectorNear(group.children[0].getWorldPosition(new THREE.Vector3()), marker.position, marker.type);
      assertMaterial(group.children[0], marker.type);
      expectedMeshes += 1;
    }
  }
  let meshCount = 0;
  gltf.scene.traverse((object) => {
    assert.equal(Boolean(object.isLight || object.isCamera || object.isLine || object.isPoints), false);
    if (!object.isMesh) return;
    meshCount += 1;
    assert.ok(object.geometry.attributes.position.count > 0);
    assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite));
  });
  assert.equal(meshCount, expectedMeshes, 'Exact authored mesh count');
  const summary = { filename: download.filename, floor: floorIndex + 1, meshCount,
    groupCount: rootGroup.children.length, bounds: { min: expectedBounds.min.toArray(), max: expectedBounds.max.toArray() },
    materialCount: json.materials.length, byteLength: bytes.length };
  const materials = new Set();
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) material.dispose();
  return summary;
}
