import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_PLAY_SMOKE_PORT || '4175');
const outputDir = path.resolve('artifacts/play-smoke');
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
  throw new Error(`Vite play-smoke server did not become ready.\n${viteOutput}`);
}

async function getState(page) {
  return page.evaluate(() => window.__DAI_PLAY_SLICE__.getState());
}

async function clickSpec(page, specId) {
  const point = await page.evaluate((id) => window.__DAI_PLAY_SLICE__.getScreenPositionForSpecId(id), specId);
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error(`${specId} screen position unavailable: ${JSON.stringify(point)}`);
  }
  await page.mouse.click(point.x, point.y);
}

const url = `http://127.0.0.1:${port}/apps/play-slice/index.html`;
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
  await page.waitForFunction(() => window.__DAI_PLAY_SLICE__?.ready === true, null, { timeout: 60_000 });

  const startup = await page.evaluate(() => ({
    failed: window.__DAI_PLAY_SLICE__.failed,
    message: window.__DAI_PLAY_SLICE__.message ?? null,
    state: window.__DAI_PLAY_SLICE__.getState?.() ?? null,
  }));
  if (startup.failed) throw new Error(startup.message || 'play slice startup failed');

  const beforeStart = startup.state;
  if (beforeStart.mode !== 'authoring') throw new Error(`unexpected initial mode: ${beforeStart.mode}`);

  await page.click('#start');
  await page.waitForFunction(() => window.__DAI_PLAY_SLICE__.getState().mode === 'playing');
  const afterStart = await getState(page);

  await clickSpec(page, 'room-middle');
  await page.waitForFunction(() => window.__DAI_PLAY_SLICE__.getState().currentRoomId === 'room-middle');
  const afterMiddle = await getState(page);

  await clickSpec(page, 'room-goal');
  await page.waitForFunction(() => window.__DAI_PLAY_SLICE__.getState().mode === 'result');
  const afterGoal = await getState(page);

  const result = {
    initialMode: beforeStart.mode,
    started: afterStart.mode === 'playing',
    snapshotDetached: afterStart.snapshotDetached,
    authoringUnchangedAfterStart: afterStart.authoringUnchanged,
    startRoomId: afterStart.currentRoomId,
    middleReached: afterMiddle.currentRoomId === 'room-middle' && afterMiddle.moves === 1,
    goalReached: afterGoal.currentRoomId === 'room-goal',
    finalMode: afterGoal.mode,
    finalStatus: afterGoal.sessionStatus,
    finalMoves: afterGoal.moves,
    visitedRoomIds: afterGoal.visitedRoomIds,
    result: afterGoal.result,
  };

  const passed =
    result.initialMode === 'authoring' &&
    result.started &&
    result.snapshotDetached === true &&
    result.authoringUnchangedAfterStart === true &&
    result.startRoomId === 'room-start' &&
    result.middleReached &&
    result.goalReached &&
    result.finalMode === 'result' &&
    result.finalStatus === 'cleared' &&
    result.finalMoves === 2 &&
    JSON.stringify(result.visitedRoomIds) === JSON.stringify(['room-start', 'room-middle', 'room-goal']) &&
    result.result?.status === 'cleared' &&
    result.result?.moves === 2 &&
    result.result?.finalRoomId === 'room-goal';

  const screenshotPath = path.join(outputDir, 'dai-016-play-smoke.png');
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
  const evidencePath = path.join(outputDir, 'dai-016-play-smoke.json');
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  if (!passed) throw new Error(`play smoke invariant failed: ${JSON.stringify(result)}`);
  if (consoleErrors.length || pageErrors.length || failedRequests.length || httpErrors.length) {
    throw new Error(`play smoke emitted errors: ${JSON.stringify({ consoleErrors, pageErrors, failedRequests, httpErrors })}`);
  }

  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (browser) await browser.close();
  vite.kill();
}
