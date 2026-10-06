import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadBlob } from '../../apps/editor-slice/download-blob.js';

function setup(t, failAt = null) {
  const events = [];
  const anchor = {
    click() { events.push('click'); if (failAt === 'click') throw new Error('download blocked'); },
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
  t.mock.method(URL, 'createObjectURL', () => { events.push('url'); return 'blob:test'; });
  t.mock.method(URL, 'revokeObjectURL', (url) => { assert.equal(url, 'blob:test'); events.push('revoke'); });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  return { events, anchor };
}

test('GLB downloadはDOMを除去し、開始の猶予後にBlob URLを解放する', (t) => {
  const { events, anchor } = setup(t);
  downloadBlob(new Blob(['test'], { type: 'model/gltf-binary' }), 'dungeon.floor-2.glb');
  assert.equal(anchor.download, 'dungeon.floor-2.glb');
  assert.equal(anchor.href, 'blob:test');
  assert.equal(anchor.hidden, true);
  assert.deepEqual(events, ['url', 'append', 'click', 'remove']);
  t.mock.timers.tick(999);
  assert.ok(!events.includes('revoke'));
  t.mock.timers.tick(1);
  assert.equal(events.at(-1), 'revoke');
});

test('download失敗後もURL/anchorを解放し、次のdownloadを妨げない', (t) => {
  const { events, anchor } = setup(t, 'click');
  assert.throws(() => downloadBlob(new Blob(['test']), 'bad.glb'), /download blocked/);
  t.mock.timers.tick(1000);
  assert.deepEqual(events, ['url', 'append', 'click', 'remove', 'revoke']);
  anchor.click = () => { events.push('retry'); };
  downloadBlob(new Blob(['test']), 'retry.glb');
  t.mock.timers.tick(1000);
  assert.equal(events.filter((event) => event === 'revoke').length, 2);
  assert.ok(events.includes('retry'));
});
