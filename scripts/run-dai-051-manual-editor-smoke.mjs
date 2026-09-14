import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_MANUAL_EDITOR_SMOKE_PORT || '4178');
const outputDir = path.resolve('artifacts/manual-editor');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (!fs.existsSync(viteBin)) throw new Error('Vite is not installed. Run npm ci using the reviewed dependency graph first.');
fs.mkdirSync(outputDir, { recursive: true });

const vite = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
});

let viteOutput = '';
vite.stdout.on('data', (chunk) => { viteOutput += chunk.toString(); });
vite.stderr.on('data', (chunk) => { viteOutput += chunk.toString(); });

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite manual-editor smoke server did not become ready.\n${viteOutput}`);
}

function entityRoom(state, id) {
  return state.entities.find((entity) => entity.id === id)?.roomId ?? null;
}

function hasEntity(state, id) {
  return state.entities.some((entity) => entity.id === id);
}

const url = `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
let browser;
try {
  await waitForServer(url);
  browser = await chromium.launch({ executablePath: chromePath, headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 840 } });
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => {
    failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready === true, null, { timeout: 60_000 });

  const startup = await page.evaluate(() => ({
    failed: window.__DAI_EDITOR_SLICE__.failed,
    message: window.__DAI_EDITOR_SLICE__.message ?? null,
    state: window.__DAI_EDITOR_SLICE__.getState?.() ?? null,
  }));
  if (startup.failed) throw new Error(startup.message || 'manual editor startup failed');

  const initial = startup.state;
  if (entityRoom(initial, 'treasure-1') !== 'room-middle') {
    throw new Error(`unexpected treasure-1 initial room: ${entityRoom(initial, 'treasure-1')}`);
  }

  await page.locator('#entitySelect').selectOption('treasure-1');
  await page.locator('#entityRoom').selectOption('room-goal');
  await page.locator('#moveEntity').click();
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.entities.find((entity) => entity.id === 'treasure-1')?.roomId === 'room-goal';
  });
  const afterMove = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.locator('#undo').click();
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.entities.find((entity) => entity.id === 'treasure-1')?.roomId === 'room-middle';
  });
  const afterUndoMove = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.locator('#redo').click();
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.entities.find((entity) => entity.id === 'treasure-1')?.roomId === 'room-goal';
  });
  const afterRedoMove = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.locator('#entityType').selectOption('trap');
  await page.locator('#entityRoom').selectOption('room-start');
  await page.locator('#addEntity').click();
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().entities.some((entity) => entity.id === 'trap-editor-1'));
  const afterAdd = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.locator('#removeEntity').click();
  await page.waitForFunction(() => !window.__DAI_EDITOR_SLICE__.getState().entities.some((entity) => entity.id === 'trap-editor-1'));
  const afterRemove = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.locator('#undo').click();
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().entities.some((entity) => entity.id === 'trap-editor-1'));
  const afterUndoRemove = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.locator('#entitySelect').selectOption('start-1');
  const protectedRemoveDisabled = await page.locator('#removeEntity').isDisabled();

  const roomClickPoint = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId('room-middle'));
  if (!roomClickPoint || !Number.isFinite(roomClickPoint.x) || !Number.isFinite(roomClickPoint.y)) {
    throw new Error(`room-middle screen position unavailable: ${JSON.stringify(roomClickPoint)}`);
  }
  await page.mouse.click(roomClickPoint.x, roomClickPoint.y);
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().selectedRoomId === 'room-middle');
  const roomSelectionTargetsInspector = await page.locator('#entityRoom').inputValue() === 'room-middle';

  const result = {
    initialEntityCount: initial.entities.length,
    treasureMovedToGoal: entityRoom(afterMove, 'treasure-1') === 'room-goal',
    treasureUndoReturnedToMiddle: entityRoom(afterUndoMove, 'treasure-1') === 'room-middle',
    treasureRedoReturnedToGoal: entityRoom(afterRedoMove, 'treasure-1') === 'room-goal',
    trapAddedToStart: hasEntity(afterAdd, 'trap-editor-1') && entityRoom(afterAdd, 'trap-editor-1') === 'room-start',
    addedEntitySelected: afterAdd.selectedEntityId === 'trap-editor-1',
    trapRemoved: !hasEntity(afterRemove, 'trap-editor-1'),
    trapRestoredByUndo: hasEntity(afterUndoRemove, 'trap-editor-1') && entityRoom(afterUndoRemove, 'trap-editor-1') === 'room-start',
    protectedRemoveDisabled,
    roomSelectionTargetsInspector,
  };

  const passed = Object.values(result).every((value, index) => index === 0 ? value === 4 : value === true);

  const screenshotPath = path.join(outputDir, 'dai-051-manual-editor.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const evidence = {
    generatedAt: new Date().toISOString(),
    chromePath,
    url,
    passed,
    result,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };
  const evidencePath = path.join(outputDir, 'dai-051-manual-editor.json');
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  if (!passed) throw new Error(`manual editor smoke invariant failed: ${JSON.stringify(result)}`);
  if (consoleErrors.length || pageErrors.length || failedRequests.length || httpErrors.length) {
    throw new Error(`manual editor smoke emitted errors: ${JSON.stringify({ consoleErrors, pageErrors, failedRequests, httpErrors })}`);
  }

  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (browser) await browser.close();
  vite.kill();
}
