import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createFullDungeonExport,
  createDungeonLayoutExchange,
  serializeJsonExport,
} from '../../packages/export-core/src/layout-exchange.js';
import { getMessage } from '../../apps/editor-slice/i18n.js';
import {
  createFullExport,
  createLayoutExport,
  downloadJsonExport,
  exportBaseName,
  exportProvenance,
} from '../../apps/editor-slice/ui/export-controller.js';

const fixture = JSON.parse(readFileSync(new URL('../../spec/dungeon/fixtures/minimal-valid-v1.json', import.meta.url), 'utf8'));

test('Export名は先頭階のIDを安全な文字に正規化し、空なら dungeon にする', () => {
  assert.equal(exportBaseName([{ id: ' My Dungeon!! ' }]), 'My-Dungeon');
  assert.equal(exportBaseName([{ id: 'a.b_c-1' }, { id: 'ignored' }]), 'a.b_c-1');
  assert.equal(exportBaseName([{ id: '---' }]), 'dungeon');
  assert.equal(exportBaseName([]), 'dungeon');
});

test('来歴は生成結果の4項目だけを取り出し、未生成なら null にする', () => {
  assert.equal(exportProvenance(null), null);
  assert.deepEqual(exportProvenance({ generatorStrategyId: 'v3', generatorVersion: 3, extra: 'x' }), {
    generatorStrategyId: 'v3',
    generatorVersion: 3,
    algorithmVersion: null,
    contentLayerVersion: null,
  });
});

test('Layout／Full Exportはexport-coreへ同じIDと来歴を渡した結果と一致する', () => {
  const specs = [fixture];
  const generation = { generatorStrategyId: 'version-3-special-rooms', generatorVersion: 3, algorithmVersion: 'a1', contentLayerVersion: 'c1' };
  const base = exportBaseName(specs);
  assert.deepEqual(
    createLayoutExport(specs, generation),
    createDungeonLayoutExchange(specs, { id: `${base}-layout`, provenance: exportProvenance(generation) }),
  );
  assert.deepEqual(createLayoutExport(specs, null), createDungeonLayoutExchange(specs, { id: `${base}-layout`, provenance: null }));
  assert.deepEqual(createFullExport(specs), createFullDungeonExport(specs, { id: `${base}-run` }));
});

test('JSONダウンロードは直列化した本文を保存し、Blob URLを解放して保存状況を通知する', async (t) => {
  const events = [];
  const anchor = {
    click() { events.push('click'); },
    remove() { events.push('remove'); },
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  });
  globalThis.document = {
    createElement(tag) { assert.equal(tag, 'a'); return anchor; },
    body: { append(value) { assert.equal(value, anchor); events.push('append'); } },
  };
  let blob;
  t.mock.method(URL, 'createObjectURL', (value) => { blob = value; events.push('url'); return 'blob:json'; });
  t.mock.method(URL, 'revokeObjectURL', (url) => { assert.equal(url, 'blob:json'); events.push('revoke'); });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const statuses = [];
  const value = createFullExport([fixture]);

  const result = downloadJsonExport(value, 'dungeon.dungeon-run.v1.json', { setGenerationStatus: (text) => statuses.push(text) });

  assert.deepEqual(result, { filename: 'dungeon.dungeon-run.v1.json', text: serializeJsonExport(value) });
  assert.equal(anchor.download, 'dungeon.dungeon-run.v1.json');
  assert.equal(anchor.hidden, true);
  assert.equal(blob.type, 'application/json;charset=utf-8');
  assert.equal(await blob.text(), serializeJsonExport(value));
  assert.deepEqual(statuses, [getMessage('en', 'export.saved', { name: 'dungeon.dungeon-run.v1.json' })]);
  assert.deepEqual(events, ['url', 'append', 'click', 'remove']);
  t.mock.timers.tick(0);
  assert.deepEqual(events, ['url', 'append', 'click', 'remove', 'revoke']);
});
