import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_EDITOR_SMOKE_PORT || '4174');
const outputDir = path.resolve('artifacts/editor-smoke');
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
  throw new Error(`Vite editor-smoke server did not become ready.\n${viteOutput}`);
}

function roomX(state, id) {
  return state.rooms.find((room) => room.id === id)?.x ?? null;
}

const url = `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
let browser;
try {
  await waitForServer(url);
  browser = await chromium.launch({ executablePath: chromePath, headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__?.ready === true && window.__DAI_ONBOARDING__?.ready === true,
    null,
    { timeout: 60_000 },
  );
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());
  await page.waitForFunction(() => window.__DAI_ONBOARDING__.getState().open === false);

  const startup = await page.evaluate(() => ({
    failed: window.__DAI_EDITOR_SLICE__.failed,
    message: window.__DAI_EDITOR_SLICE__.message ?? null,
    state: window.__DAI_EDITOR_SLICE__.getState?.() ?? null,
  }));
  if (startup.failed) throw new Error(startup.message || 'editor slice startup failed');

  const initialState = startup.state;
  const initialX = roomX(initialState, 'room-middle');
  if (!Number.isFinite(initialX)) throw new Error('room-middle initial x is unavailable');

  const clickPoint = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId('room-middle'));
  if (!clickPoint || !Number.isFinite(clickPoint.x) || !Number.isFinite(clickPoint.y)) {
    throw new Error(`room-middle screen position unavailable: ${JSON.stringify(clickPoint)}`);
  }

  await page.mouse.click(clickPoint.x, clickPoint.y);
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().selectedRoomId === 'room-middle');
  const afterSelect = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.keyboard.press('ArrowRight');
  await page.waitForFunction((expectedX) => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.rooms.find((room) => room.id === 'room-middle')?.x === expectedX;
  }, initialX + 1);
  const afterMove = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.keyboard.press('Control+Z');
  await page.waitForFunction((expectedX) => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.rooms.find((room) => room.id === 'room-middle')?.x === expectedX;
  }, initialX);
  const afterUndo = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.keyboard.press('Control+Y');
  await page.waitForFunction((expectedX) => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.rooms.find((room) => room.id === 'room-middle')?.x === expectedX;
  }, initialX + 1);
  const afterRedo = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  const result = {
    selectedByCanvas: afterSelect.selectedRoomId === 'room-middle',
    initialX,
    movedX: roomX(afterMove, 'room-middle'),
    undoX: roomX(afterUndo, 'room-middle'),
    redoX: roomX(afterRedo, 'room-middle'),
    selectionPreservedAfterMove: afterMove.selectedRoomId === 'room-middle',
    selectionPreservedAfterUndo: afterUndo.selectedRoomId === 'room-middle',
    selectionPreservedAfterRedo: afterRedo.selectedRoomId === 'room-middle',
    canUndoAfterRedo: afterRedo.canUndo,
    canRedoAfterRedo: afterRedo.canRedo,
  };

  const passed =
    result.selectedByCanvas &&
    result.movedX === initialX + 1 &&
    result.undoX === initialX &&
    result.redoX === initialX + 1 &&
    result.selectionPreservedAfterMove &&
    result.selectionPreservedAfterUndo &&
    result.selectionPreservedAfterRedo &&
    result.canUndoAfterRedo === true &&
    result.canRedoAfterRedo === false;

  const screenshotPath = path.join(outputDir, 'dai-015-editor-smoke.png');
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
  const evidencePath = path.join(outputDir, 'dai-015-editor-smoke.json');
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  if (!passed) throw new Error(`editor smoke invariant failed: ${JSON.stringify(result)}`);
  if (consoleErrors.length || pageErrors.length || failedRequests.length || httpErrors.length) {
    throw new Error(`editor smoke emitted errors: ${JSON.stringify({ consoleErrors, pageErrors, failedRequests, httpErrors })}`);
  }

  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (browser) await browser.close();
  vite.kill();
}
