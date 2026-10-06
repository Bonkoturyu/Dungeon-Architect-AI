import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { exportStagedGlb, GLB_EXPORT_TIMEOUT_MS } from '../src/glb-export.js';

// ブラウザ標準FileReaderの最小shim。exporter/loader本体は固定版の実物を使う。
class BlobReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
}

function fixture(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'FileReader');
  globalThis.FileReader = BlobReader;
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'FileReader', previous);
    else delete globalThis.FileReader;
  });
  const root = new THREE.Group();
  root.name = 'DungeonFloor';
  root.position.set(9, 2, -8);
  root.rotation.y = 0.35;
  const material = new THREE.MeshStandardMaterial({
    color: 0xef4444, roughness: 0.72, metalness: 0.13,
    emissive: 0x5a1111, emissiveIntensity: 0.28,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  mesh.name = 'enemy:body';
  mesh.position.set(2, 0.5, -3);
  mesh.rotation.y = -0.45;
  mesh.scale.set(2, 3, 4);
  mesh.userData.motionStartedAt = 12345;
  root.add(mesh);
  t.after(() => { mesh.geometry.dispose(); material.dispose(); });
  return { root, mesh, material };
}

function glbJson(data) {
  const view = new DataView(data);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), data.byteLength);
  assert.equal(view.getUint32(16, true), 0x4e4f534a);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, view.getUint32(12, true))));
}

function near(actual, expected, tolerance = 1e-5) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < tolerance,
    `${value} differs from ${expected[index]} at ${index}`));
}

test('実GLB roundtripは親子の位置・回転・scale・PBR材質を保持し、内部extrasを除く', async (t) => {
  const { root, mesh, material } = fixture(t);
  const clear = t.mock.method(globalThis, 'clearTimeout');
  const expectedBounds = new THREE.Box3().setFromObject(root);
  const expectedColor = material.color.toArray();
  const expectedEmissive = material.emissive.clone().multiplyScalar(material.emissiveIntensity).toArray();
  let sourceDisposed = 0;
  material.addEventListener('dispose', () => { sourceDisposed++; });
  const promise = exportStagedGlb(root);
  // awaitより前にshared材質を切り離すため、live側変更の影響を受けない。
  assert.notEqual(mesh.material, material);
  let snapshotDisposed = 0;
  mesh.material.addEventListener('dispose', () => { snapshotDisposed++; });
  material.color.setHex(0x0000ff);
  const data = await promise;
  assert.equal(clear.mock.callCount(), 1, '成功後にtimeoutを残さない');
  const json = glbJson(data);
  assert.ok(json.meshes.length > 0);
  assert.ok(json.nodes.every((node) => !node.extras));
  assert.ok(json.materials.every((entry) => !entry.extras));
  assert.ok(json.buffers.every((buffer) => !buffer.uri));
  assert.equal(json.animations, undefined);
  assert.equal(json.cameras, undefined);
  const loaded = await new GLTFLoader().parseAsync(data, '');
  const bounds = new THREE.Box3().setFromObject(loaded.scene);
  near(bounds.min.toArray(), expectedBounds.min.toArray());
  near(bounds.max.toArray(), expectedBounds.max.toArray());
  let loadedMesh;
  loaded.scene.traverse((object) => { if (object.isMesh) loadedMesh = object; });
  near(loadedMesh.material.color.toArray(), expectedColor);
  near(loadedMesh.material.emissive.clone().multiplyScalar(loadedMesh.material.emissiveIntensity).toArray(), expectedEmissive);
  assert.equal(loadedMesh.material.roughness, 0.72);
  assert.equal(loadedMesh.material.metalness, 0.13);
  assert.equal(sourceDisposed, 0);
  assert.equal(snapshotDisposed, 1);
});

test('現rendererは通常Mesh、公式exporterは将来のInstancedMeshの個数・transformも保持する', async (t) => {
  const { root, mesh, material } = fixture(t);
  root.remove(mesh);
  const instances = new THREE.InstancedMesh(mesh.geometry, material, 2);
  instances.setMatrixAt(0, new THREE.Matrix4().makeTranslation(1, 0, 2));
  instances.setMatrixAt(1, new THREE.Matrix4().makeTranslation(7, 0, -4));
  root.add(instances);
  const data = await exportStagedGlb(root);
  assert.ok(glbJson(data).extensionsUsed.includes('EXT_mesh_gpu_instancing'));
  const loaded = await new GLTFLoader().parseAsync(data, '');
  let result;
  loaded.scene.traverse((object) => { if (object.isInstancedMesh) result = object; });
  assert.equal(result.count, 2);
  for (let index = 0; index < 2; index++) {
    const expected = new THREE.Matrix4();
    const actual = new THREE.Matrix4();
    instances.getMatrixAt(index, expected);
    result.getMatrixAt(index, actual);
    near(actual.elements, expected.elements);
  }
});

test('失敗時もsnapshot材質を解放し、live材質・geometryをdisposeしない', async (t) => {
  const { root, mesh, material } = fixture(t);
  globalThis.FileReader = class { readAsArrayBuffer() { throw new Error('read failed'); } };
  let sourceDisposed = 0;
  let geometryDisposed = 0;
  material.addEventListener('dispose', () => { sourceDisposed++; });
  mesh.geometry.addEventListener('dispose', () => { geometryDisposed++; });
  const promise = exportStagedGlb(root);
  let snapshotDisposed = 0;
  mesh.material.addEventListener('dispose', () => { snapshotDisposed++; });
  await assert.rejects(promise, /read failed/);
  assert.equal(snapshotDisposed, 1);
  assert.equal(sourceDisposed, 0);
  assert.equal(geometryDisposed, 0);
});

test('live scene配下や不正なrootは処理前に拒否する', async (t) => {
  const { root, mesh, material } = fixture(t);
  const scene = new THREE.Scene();
  scene.add(root);
  await assert.rejects(exportStagedGlb(root), /detached staging root/);
  await assert.rejects(exportStagedGlb(null), /detached staging root/);
  assert.equal(mesh.material, material);
  assert.equal(mesh.userData.motionStartedAt, 12345);
});

test('非同期readerの停止でもtimeoutで解放し、再試行と遅い完了を分離する', async (t) => {
  const { root, mesh } = fixture(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let release;
  globalThis.FileReader = class extends BlobReader {
    readAsArrayBuffer(blob) {
      release = () => super.readAsArrayBuffer(blob);
    }
  };
  const promise = exportStagedGlb(root);
  const failed = assert.rejects(promise, /timed out/);
  let disposed = 0;
  mesh.material.addEventListener('dispose', () => { disposed++; });
  // dynamic importとexporterのmicrotaskが最初のreaderへ到達するのを待つ。
  for (let attempt = 0; !release && attempt < 100; attempt++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.ok(release, '実exporterが非同期readerへ到達した');
  t.mock.timers.tick(GLB_EXPORT_TIMEOUT_MS);
  await failed;
  assert.equal(disposed, 1);
  globalThis.FileReader = BlobReader;
  const data = await exportStagedGlb(root);
  assert.equal(glbJson(data).asset.version, '2.0');
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(disposed, 1, '遅い完了で二重cleanupしない');
});
