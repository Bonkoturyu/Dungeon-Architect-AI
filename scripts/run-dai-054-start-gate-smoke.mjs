import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_START_GATE_SMOKE_PORT || '4182');
const outputDir = path.resolve('artifacts/start-gate');
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
  throw new Error(`Vite start-gate server did not become ready.\n${viteOutput}`);
}

function treasureRoom(state) {
  return state.entities.find((entity) => entity.id === 'treasure-1')?.roomId ?? null;
}

function normalizedRooms(rooms) {
  return rooms.map(({ id, x, z }) => ({ id, x, z }));
}

function normalizedEntities(entities) {
  return entities.map(({ id, type, roomId }) => ({ id, type, roomId }));
}

const url = `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
let browser;
try {
  await waitForServer(url);
  browser = await chromium.launch({ executablePath: chromePath, headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
  if (startup.failed) throw new Error(startup.message || 'editor startup failed');

  const initial = startup.state;
  const invalidGate = await page.evaluate(async () => {
    const response = await fetch('/spec/dungeon/fixtures/minimal-valid-v1.json', { cache: 'no-store' });
    const spec = await response.json();
    spec.corridors = [];
    return window.__DAI_EDITOR_SLICE__.evaluateStartGateForSpec(spec);
  });

  await page.click('[data-workflow-tab="play"]');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().workflowTab === 'play');
  const startEnabled = await page.locator('#start').isEnabled();
  await page.locator('#start').click();
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'play');
  const afterStart = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  const controlsDisabledDuringPlay = await page.evaluate(() => ({
    undo: document.querySelector('#undo').disabled,
    redo: document.querySelector('#redo').disabled,
    moveEntity: document.querySelector('#moveEntity').disabled,
    addEntity: document.querySelector('#addEntity').disabled,
    applyNaturalEdit: document.querySelector('#applyNaturalEdit').disabled,
  }));

  const middleMoved = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.movePlayToRoom('room-middle'));
  if (!middleMoved) throw new Error('room-middle movement failed');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().play?.currentRoomId === 'room-middle');
  const afterMiddle = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  const middleEnemy = afterMiddle.play?.snapshot?.entities.find(
    (entity) => entity.type === 'enemy' && entity.roomId === 'room-middle',
  ) ?? null;
  if (middleEnemy) {
    const clearedEnemy = await page.evaluate(
      (enemyId) => window.__DAI_EDITOR_SLICE__.clearEnemy(enemyId),
      middleEnemy.id,
    );
    if (!clearedEnemy) throw new Error(`failed to clear blocking enemy: ${middleEnemy.id}`);
  }

  const goalMoved = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.movePlayToRoom('room-goal'));
  if (!goalMoved) throw new Error('room-goal movement failed');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'result');
  const afterGoal = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.locator('#returnEdit').click();
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');
  const afterReturn = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  const snapshotMatchesAuthoringAtStart =
    JSON.stringify(normalizedRooms(afterStart.play.snapshot.rooms)) === JSON.stringify(initial.rooms) &&
    JSON.stringify(normalizedEntities(afterStart.play.snapshot.entities)) === JSON.stringify(initial.entities);

  const result = {
    initialGateAllowed: initial.startAllowed === true && initial.validationCriticalCount === 0,
    startButtonEnabled: startEnabled,
    invalidGateBlocked: invalidGate.allowed === false && invalidGate.criticalCount > 0,
    invalidGateIncludesUnreachable: invalidGate.errors.some((entry) => entry.code === 'GOAL_UNREACHABLE'),
    startedInStartRoom: afterStart.mode === 'play' && afterStart.play?.currentRoomId === 'room-start',
    snapshotMatchesAuthoringAtStart,
    editingDisabledDuringPlay: Object.values(controlsDisabledDuringPlay).every(Boolean),
    movedToMiddle: afterMiddle.play?.currentRoomId === 'room-middle' && afterMiddle.play?.moves === 1,
    clearedAtGoal: afterGoal.result?.status === 'cleared' && afterGoal.result?.moves === 2,
    visitedThreeRooms: afterGoal.result?.visitedRoomIds?.length === 3,
    returnToEditPreservesAuthoring: afterReturn.mode === 'edit' && treasureRoom(afterReturn) === 'room-middle',
    startReenabledAfterReturn: afterReturn.startAllowed === true,
  };

  const passed = Object.values(result).every(Boolean);
  const screenshotPath = path.join(outputDir, 'dai-054-start-gate.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const evidence = {
    generatedAt: new Date().toISOString(),
    chromePath,
    url,
    passed,
    result,
    invalidGate,
    finalResult: afterGoal.result,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };
  const evidencePath = path.join(outputDir, 'dai-054-start-gate.json');
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  if (!passed) throw new Error(`DAI-054 invariant failed: ${JSON.stringify(result)}`);
  if (consoleErrors.length || pageErrors.length || failedRequests.length || httpErrors.length) {
    throw new Error(`DAI-054 browser errors: ${JSON.stringify({ consoleErrors, pageErrors, failedRequests, httpErrors })}`);
  }

  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (browser) await browser.close();
  vite.kill();
}
