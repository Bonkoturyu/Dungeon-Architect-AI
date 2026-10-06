// 実adapter/builder/exporter/loaderのNode統合検証。GPU/browser描画の証拠ではない。
// WebGLRendererとOrbitControlsだけを差し替え、FileReaderはBlob.arrayBufferで補う。
// DAI_GLB_ADAPTER_ARTIFACT_DIRでJSON/GLB出力先を変更可能。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = path.resolve(process.env.DAI_GLB_ADAPTER_ARTIFACT_DIR || path.join(root, 'artifacts/glb-adapter'));
fs.mkdirSync(evidenceDir, { recursive: true });
const threeUrl = import.meta.resolve('three');
const adapterUrl = pathToFileURL(path.join(root, 'packages/renderer-three/src/three-renderer-adapter.js')).href;
const checks = [], exports = [];
const globals = new Map(['HTMLCanvasElement', 'window', 'FileReader', '__adapterScene']
  .map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const pass = (name) => { checks.push(name); console.log(`PASS ${name}`); };
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === adapterUrl && specifier === 'three') return { url: 'dai-smoke:three-renderer', shortCircuit: true };
    if (context.parentURL === adapterUrl && specifier === 'three/addons/controls/OrbitControls.js') return { url: 'dai-smoke:controls', shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'dai-smoke:three-renderer') return { format: 'module', shortCircuit: true, source: `
      export * from ${JSON.stringify(threeUrl)};
      export class WebGLRenderer {
        setPixelRatio() {} setSize() {} dispose() {}
        render(scene, camera) { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); globalThis.__adapterScene = scene; }
      }` };
    if (url === 'dai-smoke:controls') return { format: 'module', shortCircuit: true, source: `
      import { Vector3, EventDispatcher } from ${JSON.stringify(threeUrl)};
      export class OrbitControls extends EventDispatcher {
        constructor(camera) { super(); this.target = new Vector3(); this.camera = camera; this.mouseButtons = {}; }
        update() { this.camera.lookAt(this.target); this.camera.updateMatrixWorld(true); }
        dispose() {}
      }` };
    return nextLoad(url, context);
  },
});
class Canvas { addEventListener() {} removeEventListener() {} getBoundingClientRect() { return { left: 0, top: 0, width: 1440, height: 900 }; } }
globalThis.HTMLCanvasElement = Canvas;
globalThis.window = { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) };
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((data) => { this.result = data; this.onloadend?.(); }); }
};
const { floors, importedFixture, inspectGlbDownload } = await import(pathToFileURL(path.join(root, 'scripts/glb-export-smoke-support.mjs')));
const { createThreeRendererAdapter } = await import(adapterUrl);
const originalJSON = JSON.stringify(importedFixture);
let adapter;
const state = () => ({ camera: adapter.getCameraState(), selection: adapter.selectedSpecId, plan: structuredClone(adapter.plan), scene: globalThis.__adapterScene.toJSON() });
async function inspect(data, floor, label) {
  const bytes = Buffer.from(data);
  const filename = `adapter-${label}.floor-${floor + 1}.glb`;
  fs.writeFileSync(path.join(evidenceDir, filename), bytes);
  const summary = await inspectGlbDownload({ bytes, filename }, floor);
  exports.push({ ...summary, sha256: sha(bytes) });
  return bytes;
}
try {
  adapter = createThreeRendererAdapter({ canvas: new Canvas() });
  adapter.resize(1440, 900);
  adapter.render(floors[0]);
  const cleanBefore = state();
  const first = await inspect(await adapter.exportDungeonGlb(floors[0]), 0, 'clean');
  assert.deepEqual(state(), cleanBefore);
  pass('actual-adapter-builder-exporter-loader-floor1-clean-roundtrip-and-live-state');
  const second = await inspect(await adapter.exportDungeonGlb(floors[1]), 1, 'floor2');
  assert.deepEqual(state(), cleanBefore);
  assert.notEqual(sha(first), sha(second));
  pass('actual-adapter-current-spec-floor2-distinct-world-coordinates');

  adapter.setSelectedSpecId('f1-room-start');
  adapter.setContextSpecId('f1-room-middle');
  adapter.setHighlightedSpecIds(['f1-corridor-1']);
  adapter.setCorridorDraftPreview({ points: [{ x: -2, z: -9 }, { x: 2, z: -9 }, { x: 2, z: 6 }], existingCorridorId: 'f1-corridor-1', targetRoomId: 'f1-room-goal', state: 'ready' });
  adapter.setRoomDraftPreview({ roomId: 'f1-room-start', x: 2, z: -4, state: 'ready' });
  assert.equal(adapter.getObjectBySpecId('f1-corridor-1').visible, false);
  assert.equal(adapter.getObjectBySpecId('f1-room-start').position.x, 8);
  const liveObjects = [];
  globalThis.__adapterScene.traverse((object) => liveObjects.push(object));
  const liveMaterials = new Set(liveObjects.flatMap((object) => object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []));
  const liveGeometries = new Set(liveObjects.map((object) => object.geometry).filter(Boolean));
  let disposedLive = 0;
  for (const resource of [...liveMaterials, ...liveGeometries]) resource.addEventListener('dispose', () => { disposedLive += 1; });
  const draftedBefore = state();
  const draftBytes = await inspect(await adapter.exportDungeonGlb(floors[0]), 0, 'drafted');
  assert.equal(sha(draftBytes), sha(first));
  assert.deepEqual(state(), draftedBefore);
  assert.equal(disposedLive, 0);
  pass('selected-highlighted-hidden-corridor-room-draft-do-not-leak-or-mutate-live-scene');
  for (let i = 0; i < 3; i++) {
    const repeated = Buffer.from(await adapter.exportDungeonGlb(floors[0]));
    assert.equal(sha(repeated), sha(first));
    assert.deepEqual(state(), draftedBefore);
    assert.equal(disposedLive, 0);
  }
  pass('three-repeat-exports-deterministic-and-no-live-resource-disposal');
  const reader = FileReader.prototype.readAsArrayBuffer;
  FileReader.prototype.readAsArrayBuffer = () => { throw new Error('injected-reader-failure'); };
  try { await assert.rejects(adapter.exportDungeonGlb(floors[0]), /injected-reader-failure/); }
  finally { FileReader.prototype.readAsArrayBuffer = reader; }
  assert.deepEqual(state(), draftedBefore);
  assert.equal(disposedLive, 0);
  assert.equal(sha(Buffer.from(await adapter.exportDungeonGlb(floors[0]))), sha(first));
  pass('actual-exporter-failure-restores-no-live-state-and-next-export-succeeds');

  const pending = adapter.exportDungeonGlb(floors[0]);
  adapter.clearRoomDraftPreview();
  adapter.clearCorridorDraftPreview();
  adapter.render(floors[1]);
  const floorChanged = state();
  const raced = await inspect(await pending, 0, 'in-flight-floor-switch');
  assert.equal(sha(raced), sha(first));
  assert.deepEqual(state(), floorChanged);
  pass('in-flight-export-snapshot-independent-of-live-floor-switch-and-disposal');

  adapter.render(floors[0], { showPlayer: true, presentationMode: 'play', visibility: { roomIds: ['f1-room-start'], corridorIds: [], currentRoomId: 'f1-room-start' } });
  assert.ok(adapter.getCharacterPresentationSummary().player);
  assert.equal(adapter.plan.roomGroups.length, 1);
  const playBefore = state();
  const fromPlay = await inspect(await adapter.exportDungeonGlb(floors[0]), 0, 'live-play');
  assert.equal(sha(fromPlay), sha(first));
  assert.deepEqual(state(), playBefore);
  pass('adapter-export-clean-even-with-live-player-current-ring-fog-and-projected-floor');
  assert.equal(JSON.stringify(importedFixture), originalJSON);
  pass('two-floor-authoring-json-fixture-unmodified');
  fs.writeFileSync(path.join(evidenceDir, 'adapter-roundtrip.json'), JSON.stringify({ generatedAt: new Date().toISOString(), passed: true, verificationType: 'Node simulated-renderer integration', node: process.version, scope: 'Actual Three adapter, builder, GLTFExporter, GLTFLoader, authoring fixtures and geometry/material checks. WebGLRenderer and OrbitControls are stubbed. FileReader uses Blob.arrayBuffer. No browser, GPU, DOM/download/UI or visual pixel claim.', checks, exports }, null, 2) + '\n');
} catch (error) {
  fs.writeFileSync(path.join(evidenceDir, 'adapter-roundtrip.json'), JSON.stringify({ generatedAt: new Date().toISOString(), passed: false, verificationType: 'Node simulated-renderer integration', checks, exports, error: String(error), stack: error.stack }, null, 2) + '\n');
  throw error;
} finally {
  try { adapter?.dispose(); }
  finally {
    hooks.deregister();
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}
