import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { getMessage, LANGUAGE_OPTIONS } from '../apps/editor-slice/i18n.js';
import { captureBrowserFailure } from './browser-smoke-support.mjs';
import { floors, importedFixture, inspectGlbDownload } from './glb-export-smoke-support.mjs';

// 実providerを使わず、2階のfixture→実download→Three GLTFLoaderで検証する。
// CHROME_PATH / DAI_SMOKE_HEADLESS=0 / DAI_GLB_EXPORT_PORT / DAI_GLB_ARTIFACT_DIR を指定可能。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.resolve(process.env.DAI_GLB_ARTIFACT_DIR || path.join(root, 'artifacts/glb-export'));
const port = Number(process.env.DAI_GLB_EXPORT_PORT || '4214');
const url = `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
const headless = process.env.DAI_SMOKE_HEADLESS !== '0';
const candidates = process.env.CHROME_PATH ? [process.env.CHROME_PATH] : [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  chromium.executablePath(),
].filter(Boolean);
const chromePath = candidates.find((candidate) => fs.existsSync(candidate));
assert.ok(chromePath, 'Chrome/Chromium not found. Set CHROME_PATH to an installed reviewed browser.');
const viteBin = path.join(root, 'node_modules/vite/bin/vite.js');
assert.ok(fs.existsSync(viteBin), 'Vite is not installed. Use the reviewed dependency graph first.');
fs.mkdirSync(outputDir, { recursive: true });

const checks = [];
const downloads = [];
const roundtrips = [];
const errors = { console: [], page: [], requests: [], http: [], api: [] };
let browser, page, vite;
let viteOutput = '';
const check = (name) => { checks.push(name); console.log(`PASS ${name}`); };
const sha = (buffer) => createHash('sha256').update(buffer).digest('hex');

async function snapshot() {
  return page.evaluate(() => {
    const api = window.__DAI_EDITOR_SLICE__;
    const { audio, ...state } = api.getState(); // audio clock is independent of authoring/export.
    return {
      state, camera: api.getCameraState(), selection: api.getRenderedSelection(),
      full: api.getFullDungeonExport(), layout: api.getLayoutExport(),
      fields: Object.fromEntries(['roomWidth', 'roomDepth', 'entityRoom', 'corridorFromSide', 'corridorToSide']
        .map((id) => [id, document.getElementById(id)?.value ?? null])),
      draftClass: document.querySelector('#renderCanvas').className,
    };
  });
}
async function importFixture(value = importedFixture) {
  const result = await page.evaluate((value) => window.__DAI_EDITOR_SLICE__.importDungeonJsonTextForTest(JSON.stringify(value), { filename: 'glb-smoke.dungeon-run.v1.json' }), value);
  assert.equal(result.ok, true, JSON.stringify(result));
}
async function captureDownload(download, label) {
  assert.equal(await download.failure(), null);
  const filename = download.suggestedFilename();
  const target = path.join(outputDir, `${label}-${filename}`);
  await download.saveAs(target);
  const bytes = fs.readFileSync(target);
  const result = { filename, bytes, target };
  downloads.push({ label, filename, byteLength: bytes.length, sha256: sha(bytes) });
  return result;
}
async function exportApi(label) {
  const pending = page.waitForEvent('download', { timeout: 30_000 });
  pending.catch(() => {});
  const result = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.exportGlb());
  assert.equal(result.ok, true, JSON.stringify(result));
  const download = await captureDownload(await pending, label);
  assert.equal(result.filename, download.filename);
  assert.equal(result.byteLength, download.bytes.length);
  return download;
}
async function waitForCleanup() {
  await page.waitForFunction(() => window.__glbUrlAudit.created.every((entry) => window.__glbUrlAudit.revoked.includes(entry.url)));
  assert.equal(await page.locator('a[download]').count(), 0);
  assert.equal(await page.locator('#exportGlb').getAttribute('aria-busy'), 'false');
  assert.equal((await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState())).glbExportBusy, false);
}

async function roundtrip(download, floorIndex) {
  const summary = await inspectGlbDownload(download, floorIndex);
  roundtrips.push(summary);
  return summary;
}

async function holdExport() {
  await page.evaluate(() => {
    const original = FileReader.prototype.readAsArrayBuffer;
    window.__glbReadRestore = () => { FileReader.prototype.readAsArrayBuffer = original; };
    FileReader.prototype.readAsArrayBuffer = function (blob) {
      FileReader.prototype.readAsArrayBuffer = original;
      window.__glbReleaseRead = () => original.call(this, blob);
    };
    window.__glbPending = window.__DAI_EDITOR_SLICE__.exportGlb();
  });
  await page.waitForFunction(() => typeof window.__glbReleaseRead === 'function');
}
async function releaseExport(label) {
  const pending = page.waitForEvent('download', { timeout: 30_000 });
  pending.catch(() => {});
  const result = await page.evaluate(async () => {
    window.__glbReleaseRead();
    delete window.__glbReleaseRead;
    window.__glbReadRestore();
    return window.__glbPending;
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  const download = await captureDownload(await pending, label);
  assert.equal(result.filename, download.filename);
  assert.equal(result.byteLength, download.bytes.length);
  return download;
}

try {
  vite = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  vite.stdout.on('data', (data) => { viteOutput += data.toString(); });
  vite.stderr.on('data', (data) => { viteOutput += data.toString(); });
  vite.on('error', (error) => { viteOutput += String(error); });
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (vite.exitCode != null) throw new Error(`Vite exited: ${viteOutput}`);
    try { if (viteOutput.includes('Local:') && (await fetch(url)).ok) break; } catch {}
    if (Date.now() > deadline) throw new Error(`Vite did not become ready: ${viteOutput}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: chromePath, headless });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page.setDefaultTimeout(15_000);
  page.on('pageerror', (error) => errors.page.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('requestfailed', (request) => errors.requests.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', (response) => { if (response.status() >= 400) errors.http.push({ url: response.url(), status: response.status() }); });
  await page.route('**/api/**', async (route) => { errors.api.push(route.request().url()); await route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"code":"SMOKE_API_BLOCKED"}' }); });
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    window.__glbUrlAudit = { created: [], revoked: [] };
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      window.__glbUrlAudit.created.push({ url, type: blob.type, size: blob.size });
      return url;
    };
    URL.revokeObjectURL = (url) => { window.__glbUrlAudit.revoked.push(url); return revoke(url); };
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready && window.__DAI_ONBOARDING__?.ready);
  assert.equal(await page.evaluate(() => window.__DAI_EDITOR_SLICE__.failed), false);
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());
  await importFixture();
  const originalExports = await page.evaluate(() => ({ full: window.__DAI_EDITOR_SLICE__.getFullDungeonExport(), layout: window.__DAI_EDITOR_SLICE__.getLayoutExport() }));
  assert.equal(originalExports.full.floors.length, 2);
  assert.deepEqual(originalExports.full.floors.map((floor) => floor.dungeon), floors);
  check('two-floor-full-json-import-fixture');

  await page.click('[data-workflow-tab="create"]');
  for (const { id } of LANGUAGE_OPTIONS) {
    const language = page.locator('#languageCycle');
    for (let count = 0; count < LANGUAGE_OPTIONS.length && await language.getAttribute('data-current-language') !== id; count++) await language.click();
    assert.equal(await language.getAttribute('data-current-language'), id);
    assert.equal(await page.locator('#exportGlb').textContent(), getMessage(id, 'export.glb'));
    assert.equal(await page.locator('[data-i18n="export.glbNote"]').textContent(), getMessage(id, 'export.glbNote'));
    assert.notEqual(getMessage(id, 'export.glb'), 'export.glb');
    assert.equal(await page.locator('#exportGlb').isEnabled(), true);
    if (id === 'ja') await page.screenshot({ path: path.join(outputDir, 'glb-export-ja.png'), fullPage: true });
  }
  while (await page.locator('#languageCycle').getAttribute('data-current-language') !== 'en') await page.locator('#languageCycle').click();
  check('five-language-current-floor-labels-and-scope-notes');

  const beforeUi = await snapshot();
  const uiPending = page.waitForEvent('download');
  uiPending.catch(() => {});
  await page.click('#exportGlb');
  const first = await captureDownload(await uiPending, 'floor1-button');
  assert.match(first.filename, /\.floor-1\.glb$/);
  await waitForCleanup();
  await roundtrip(first, 0);
  assert.deepEqual(await snapshot(), beforeUi);
  check('button-download-real-GLTFLoader-roundtrip-floor1-bounds-materials-and-clean-scope');
  const repeat = await exportApi('floor1-repeat');
  await roundtrip(repeat, 0);
  assert.equal(sha(repeat.bytes), sha(first.bytes), 'Repeat GLB is byte deterministic');
  assert.deepEqual(await snapshot(), beforeUi);
  check('repeat-export-identical-and-authoring-state-preserved');

  await page.click('[data-workflow-tab="edit"]');
  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.selectRoom('f1-room-start'));
  const wall = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getScreenPositionForRoomWall('f1-room-start', 'south'));
  assert.ok(wall);
  await page.mouse.move(wall.x, wall.y);
  await page.mouse.down();
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().corridorDraftPreview !== null);
  const draftBefore = await snapshot();
  assert.equal(draftBefore.selection, 'f1-room-start');
  const canvasBefore = await page.locator('#renderCanvas').screenshot();
  fs.writeFileSync(path.join(outputDir, 'draft-before.png'), canvasBefore);
  const draftDownload = await exportApi('floor1-during-draft');
  await roundtrip(draftDownload, 0);
  assert.deepEqual(await snapshot(), draftBefore);
  const canvasAfter = await page.locator('#renderCanvas').screenshot();
  fs.writeFileSync(path.join(outputDir, 'draft-after.png'), canvasAfter);
  assert.equal(sha(canvasAfter), sha(canvasBefore), 'Live selected/draft scene pixels unchanged');
  assert.equal(sha(draftDownload.bytes), sha(first.bytes), 'No selection or draft material/geometry leaked');
  await page.mouse.up();
  check('active-corridor-draft-selection-camera-and-live-pixels-preserved');

  const beforeBusy = await snapshot();
  await holdExport();
  assert.equal(await page.locator('#exportGlb').isDisabled(), true);
  assert.equal(await page.locator('#exportGlb').getAttribute('aria-busy'), 'true');
  assert.equal((await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState())).glbExportBusy, true);
  assert.deepEqual(await page.evaluate(() => window.__DAI_EDITOR_SLICE__.exportGlb()), { ok: false, code: 'EXPORT_BUSY' });
  assert.equal(await page.locator('#glbExportStatus').textContent(), getMessage('en', 'export.glbBusy', { floor: 1 }));
  const busyDownload = await releaseExport('floor1-busy');
  await roundtrip(busyDownload, 0);
  await waitForCleanup();
  assert.deepEqual(await snapshot(), beforeBusy);
  check('async-busy-state-repeat-click-guard-and-recovery');

  await holdExport();
  assert.equal(await page.evaluate(() => window.__DAI_EDITOR_SLICE__.selectFloor(1)), true);
  const changedFloor = await snapshot();
  const raceDownload = await releaseExport('floor1-floor-switch-race');
  assert.match(raceDownload.filename, /\.floor-1\.glb$/);
  await roundtrip(raceDownload, 0);
  changedFloor.state.glbExportBusy = false;
  assert.deepEqual(await snapshot(), changedFloor);
  assert.equal((await snapshot()).state.currentFloorIndex, 1);
  check('in-flight-floor-switch-keeps-original-floor-snapshot-and-filename');
  const second = await exportApi('floor2');
  assert.match(second.filename, /\.floor-2\.glb$/);
  await roundtrip(second, 1);
  assert.notEqual(sha(second.bytes), sha(first.bytes));
  check('selected-second-floor-only-with-distinct-world-coordinates');

  await holdExport();
  await importFixture(originalExports.full);
  const importedDuringExport = await snapshot();
  const importStatus = await page.locator('#generationStatus').textContent();
  assert.ok(importStatus.includes('glb-smoke.dungeon-run.v1.json'));
  const importRace = await releaseExport('floor2-import-race');
  assert.match(importRace.filename, /\.floor-2\.glb$/);
  await roundtrip(importRace, 1);
  importedDuringExport.state.glbExportBusy = false;
  assert.deepEqual(await snapshot(), importedDuringExport);
  assert.equal(await page.locator('#generationStatus').textContent(), importStatus);
  assert.equal(await page.locator('#glbExportStatus').getAttribute('role'), 'status');
  assert.equal(await page.locator('#glbExportStatus').getAttribute('aria-live'), 'polite');
  assert.equal(await page.evaluate(() => window.__DAI_EDITOR_SLICE__.selectFloor(1)), true);
  check('in-flight-import-preserves-import-status-new-state-and-original-GLB-floor');

  for (const fault of ['file-reader', 'blob-url']) {
    const before = await snapshot();
    const result = await page.evaluate(async (fault) => {
      const target = fault === 'file-reader' ? FileReader.prototype : URL;
      const property = fault === 'file-reader' ? 'readAsArrayBuffer' : 'createObjectURL';
      const original = target[property];
      target[property] = () => { throw new Error(`Injected GLB smoke ${fault} failure`); };
      try { return await window.__DAI_EDITOR_SLICE__.exportGlb(); }
      finally { target[property] = original; }
    }, fault);
    assert.deepEqual(result, { ok: false, code: 'EXPORT_GLB_FAILED' });
    assert.equal(await page.locator('#exportGlb').isEnabled(), true);
    assert.equal(await page.locator('#glbExportStatus').textContent(), getMessage('en', 'export.glbFailed'));
    assert.deepEqual(await snapshot(), before);
    await waitForCleanup();
    const recovered = await exportApi(`floor2-recovered-${fault}`);
    await roundtrip(recovered, 1);
    assert.equal(sha(recovered.bytes), sha(second.bytes));
    check(`${fault}-failure-cleanup-and-successful-retry`);
  }

  // 通常編集/importは無効specを先に拒否するため、getterを一時差替して防御gateを検査。
  // 無効specは永続化せず、既存のUI更新イベントを通してdisabled状態も確認する。
  const beforeInvalid = await snapshot();
  const invalidGate = await page.evaluate(async () => {
    const { EditSession } = await import('/packages/editor-core/src/edit-session.js');
    const descriptor = Object.getOwnPropertyDescriptor(EditSession.prototype, 'spec');
    Object.defineProperty(EditSession.prototype, 'spec', {
      ...descriptor,
      get() { const spec = descriptor.get.call(this); spec.corridors = []; return spec; },
    });
    try {
      document.querySelector('#floorCount').dispatchEvent(new Event('input', { bubbles: true }));
      return { disabled: document.querySelector('#exportGlb').disabled,
        result: await window.__DAI_EDITOR_SLICE__.exportGlb() };
    } finally {
      Object.defineProperty(EditSession.prototype, 'spec', descriptor);
      document.querySelector('#floorCount').dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  assert.equal(invalidGate.disabled, true);
  assert.deepEqual(invalidGate.result, { ok: false, code: 'EXPORT_INVALID_DUNGEON' });
  assert.deepEqual(await snapshot(), beforeInvalid);
  await importFixture(originalExports.full);
  check('injected-invalid-spec-disables-and-rejects-GLB-with-state-restored');

  assert.equal(await page.evaluate(() => window.__DAI_EDITOR_SLICE__.startDungeon()), true);
  assert.equal((await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState())).mode, 'play');
  assert.equal(await page.locator('#exportGlb').isDisabled(), true);
  const playBefore = await snapshot();
  assert.deepEqual(await page.evaluate(() => window.__DAI_EDITOR_SLICE__.exportGlb()), { ok: false, code: 'EXPORT_EDITOR_BUSY' });
  assert.deepEqual(await snapshot(), playBefore);
  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.returnToEdit());
  const afterPlay = await exportApi('floor1-after-play');
  await roundtrip(afterPlay, 0);
  assert.equal(sha(afterPlay.bytes), sha(first.bytes), 'No retained Play state in authoring GLB');
  check('play-mode-disabled-and-edit-export-has-no-runtime-player-or-fog');

  await page.click('[data-workflow-tab="create"]');
  for (const [selector, key] of [['#exportFullJson', 'full'], ['#exportLayoutJson', 'layout']]) {
    const pending = page.waitForEvent('download');
    pending.catch(() => {});
    await page.click(selector);
    const downloaded = await captureDownload(await pending, key);
    assert.deepEqual(JSON.parse(downloaded.bytes.toString('utf8')), originalExports[key]);
  }
  await importFixture(originalExports.full);
  assert.deepEqual(await page.evaluate(() => ({ full: window.__DAI_EDITOR_SLICE__.getFullDungeonExport(), layout: window.__DAI_EDITOR_SLICE__.getLayoutExport() })), originalExports);
  check('full-and-layout-json-downloads-and-full-reimport-remain-compatible');
  await waitForCleanup();
  const urlAudit = await page.evaluate(() => window.__glbUrlAudit);
  assert.equal(urlAudit.created.filter((entry) => entry.type === 'model/gltf-binary').length, roundtrips.length);
  assert.deepEqual(errors, { console: [], page: [], requests: [], http: [], api: [] });
  check('object-URLs-revoked-anchors-removed-no-browser-errors-or-provider-calls');
  await page.screenshot({ path: path.join(outputDir, 'glb-export-complete.png'), fullPage: true });
  const evidence = { generatedAt: new Date().toISOString(), passed: true, node: process.version, browserVersion: browser.version(), chromePath, headless,
    url, checks, downloads, roundtrips, urlAudit: { created: urlAudit.created.length, revoked: urlAudit.revoked.length }, errors };
  fs.writeFileSync(path.join(outputDir, 'glb-export.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, outputDir, browserVersion: browser.version(), headless }));
} catch (error) {
  await captureBrowserFailure({ page, error, outputDir });
  fs.writeFileSync(path.join(outputDir, 'glb-export.json'), JSON.stringify({ generatedAt: new Date().toISOString(), passed: false, node: process.version, headless, checks, downloads, roundtrips, errors, error: String(error), stack: error.stack, viteOutput }, null, 2) + '\n');
  throw error;
} finally {
  try { await browser?.close(); }
  finally { vite?.kill(); }
}
