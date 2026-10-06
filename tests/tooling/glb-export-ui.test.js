import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { getMessage, LANGUAGE_OPTIONS } from '../../apps/editor-slice/i18n.js';

// DOM/WebGLの代替合格ではない。実UI controller関数の非同期分岐を隔離検証する。
const main = readFileSync(new URL('../../apps/editor-slice/main.js', import.meta.url), 'utf8');
const start = main.indexOf('async function exportGlb() {');
const end = main.indexOf('\nfunction applyImportedDungeonJson(', start);
assert.ok(start >= 0 && end > start);
const source = main.slice(start, end);

function fixture() {
  const downloads = [], notices = [];
  const context = vm.createContext({
    glbExportBusy: false, mode: 'edit', generationBusy: false, naturalEditBusy: false,
    session: { spec: { id: 'first' } }, currentFloorIndex: 1,
    exportBaseName: () => 'dungeon', authoringRunSpec: () => ({ ok: true }),
    adapter: { exportDungeonGlb: async () => new ArrayBuffer(32) },
    glbExportStatus: { textContent: '' }, generationStatus: { textContent: 'existing' },
    updateUi: () => {}, Blob,
    downloadBlob: (blob, filename) => downloads.push({ blob, filename }),
    t: (key, values) => getMessage('ja', key, values),
    showViewportNotice: (message) => notices.push(message),
    setGenerationStatus: () => { throw new Error('GLB must not overwrite Generate/Import status'); },
  });
  vm.runInContext(`${source}\nthis.exportGlb = exportGlb;`, context);
  return { context, downloads, notices };
}

test('GLB UIは連打を拒否し、後続Importのstatus・階を上書きしない', async () => {
  const { context, downloads } = fixture();
  let release, snapshot;
  context.adapter.exportDungeonGlb = (spec) => {
    snapshot = structuredClone(spec);
    return new Promise((resolve) => { release = resolve; });
  };
  const pending = context.exportGlb();
  assert.equal(context.glbExportBusy, true);
  assert.equal(context.glbExportStatus.textContent, getMessage('ja', 'export.glbBusy', { floor: 2 }));
  assert.equal((await context.exportGlb()).code, 'EXPORT_BUSY');
  context.session.spec = { id: 'new-import' };
  context.currentFloorIndex = 8;
  context.generationStatus.textContent = 'New import completed';
  release(new ArrayBuffer(32));
  const result = await pending;
  assert.equal(result.ok, true);
  assert.equal(result.filename, 'dungeon.floor-2.glb');
  assert.equal(snapshot.id, 'first');
  assert.equal(context.currentFloorIndex, 8);
  assert.equal(context.generationStatus.textContent, 'New import completed');
  assert.equal(context.glbExportBusy, false);
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].blob.type, 'model/gltf-binary');
  assert.equal(downloads[0].blob.size, 32);
});

test('GLB UIは失敗を通知してbusyを解除し、同じUIで再試行できる', async () => {
  const { context, downloads, notices } = fixture();
  context.adapter.exportDungeonGlb = async () => { throw new Error('injected'); };
  assert.equal((await context.exportGlb()).code, 'EXPORT_GLB_FAILED');
  assert.equal(context.glbExportBusy, false);
  assert.equal(context.glbExportStatus.textContent, getMessage('ja', 'export.glbFailed'));
  assert.equal(context.generationStatus.textContent, 'existing');
  assert.equal(downloads.length, 0);
  assert.equal(notices.length, 1);
  context.adapter.exportDungeonGlb = async () => new ArrayBuffer(32);
  assert.equal((await context.exportGlb()).ok, true);
  assert.equal(downloads.length, 1);
});

test('GLB UIのmode・生成中・無効specのguardはexporterを実行しない', async () => {
  for (const override of [{ mode: 'play' }, { mode: 'result' }, { generationBusy: true }, { naturalEditBusy: true }, { session: null }]) {
    const { context, downloads } = fixture();
    Object.assign(context, override);
    context.adapter.exportDungeonGlb = () => { throw new Error('must not run'); };
    assert.equal((await context.exportGlb()).code, 'EXPORT_EDITOR_BUSY');
    assert.equal(downloads.length, 0);
  }
  const { context } = fixture();
  context.authoringRunSpec = () => ({ ok: false });
  assert.equal((await context.exportGlb()).code, 'EXPORT_INVALID_DUNGEON');
});

test('GLB範囲・進捗・失敗の文言は全5言語に明示定義する', () => {
  const catalog = readFileSync(new URL('../../apps/editor-slice/i18n.js', import.meta.url), 'utf8');
  for (const key of ['export.glb', 'export.glbNote', 'export.glbBusy', 'export.glbFailed']) {
    assert.equal(catalog.split(`'${key}':`).length - 1, LANGUAGE_OPTIONS.length);
    for (const { id } of LANGUAGE_OPTIONS) assert.notEqual(getMessage(id, key, { floor: 2 }), key);
  }
  assert.match(getMessage('ja', 'export.glb'), /表示中の階/);
  assert.match(getMessage('ja', 'export.glbNote'), /再読込/);
});
