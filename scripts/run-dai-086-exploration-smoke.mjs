import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_EXPLORATION_PORT || '4192');
const outputDir = path.resolve('artifacts/exploration-ux');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const prompt = 'Create a fair but tense 5-minute dungeon with exploration and a few dangerous rewards.';

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (!fs.existsSync(viteBin)) throw new Error('Vite is not installed.');
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
  throw new Error(`Exploration UX server did not become ready.\n${viteOutput}`);
}

function intentPayload() {
  return {
    ...DEFAULT_DESIGN_INTENT,
    fairness: 0.82,
    tension: 0.72,
    exploration: 0.82,
    greedPunishment: 0.7,
    routeChoice: 0.65,
    learnability: 0.78,
    combatDensity: 0.35,
    trapDensity: 0.45,
    rewardDensity: 0.65,
    deception: 0.55,
    telegraphStrength: 0.72,
    backtracking: 0.35,
    targetDifficulty: 0.58,
    targetDuration: 300,
  };
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

  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }); });

  await page.route('**/api/design-intent', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        selectedProvider: 'cloud',
        intent: intentPayload(),
        meta: { provider: 'openai', model: 'test-model', usage: null },
      }),
    });
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready === true && window.__DAI_ONBOARDING__?.ready === true, null, { timeout: 60_000 });
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());

  await page.fill('#generationPrompt', prompt);
  await page.click('#generateDungeon');
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.generationBusy === false && state.lastGeneration?.roomCount === 5;
  }, null, { timeout: 30_000 });

  const authoring = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const authoringSeed = authoring.lastGeneration.seed;
  const authoringRoomIds = authoring.rooms.map((room) => room.id);

  await page.click('#start');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'play');

  const testStart = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const testGoalRoomId = testStart.play.goalRoomId;
  const testCurrentRoomId = testStart.play.currentRoomId;
  const goalVisibleAtStart = await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId(id) !== null, testGoalRoomId);
  const currentVisibleAtStart = await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId(id) !== null, testCurrentRoomId);
  const exitCountAtStart = await page.locator('#playExitButtons .exit-button').count();
  const visiblePlayText = await page.locator('body').innerText();

  await page.screenshot({ path: path.join(outputDir, 'test-play-start.png'), fullPage: true });

  const firstExit = testStart.play.map.currentExits[0];
  if (!firstExit) throw new Error('No exit available from Test Play start room.');
  await page.locator(`#playExitButtons .exit-button[data-corridor-id="${firstExit.corridorId}"]`).click();
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().play?.moves === 1);

  const afterFirstMove = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const destinationVisible = await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId(id) !== null, firstExit.targetRoomId);
  const stillHiddenRoomId = afterFirstMove.play.snapshot.rooms
    .map((room) => room.id)
    .find((roomId) => !afterFirstMove.play.map.exploredRoomIds.includes(roomId));
  const unexploredStillHidden = stillHiddenRoomId
    ? !(await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId(id) !== null, stillHiddenRoomId))
    : true;

  await page.screenshot({ path: path.join(outputDir, 'test-play-after-one-move.png'), fullPage: true });

  await page.click('#returnEdit');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');
  await page.click('[data-workflow-tab="play"]');
  await page.waitForFunction(() => document.body.dataset.workflowTab === 'play');

  const mysteryEnabled = await page.locator('#mysteryPlay').isEnabled();
  if (!mysteryEnabled) throw new Error('Mystery Play should be enabled after generation.');
  await page.click('#mysteryPlay');
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.mode === 'play' && state.playSource === 'mystery';
  });

  const mysteryStart = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const mysteryGoalVisible = await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId(id) !== null, mysteryStart.play.goalRoomId);
  const mysteryCurrentVisible = await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId(id) !== null, mysteryStart.play.currentRoomId);
  const mysteryExitCount = await page.locator('#playExitButtons .exit-button').count();
  const mysteryVisibleText = await page.locator('body').innerText();

  await page.screenshot({ path: path.join(outputDir, 'mystery-play-start.png'), fullPage: true });

  const checks = {
    testStartsWithOnlyStartRoomMapped:
      testStart.play.map.exploredRoomIds.length === 1 &&
      testStart.play.map.traversedCorridorIds.length === 0,
    goalRoomHiddenAtTestStart: goalVisibleAtStart === false,
    currentRoomVisibleAtTestStart: currentVisibleAtStart === true,
    exitButtonsMatchCurrentExits: exitCountAtStart === testStart.play.map.currentExits.length && exitCountAtStart > 0,
    goalIdNotVisibleInPlayText: !visiblePlayText.includes(testGoalRoomId),
    oneMoveExpandsMapByOneRoom:
      afterFirstMove.play.map.exploredRoomIds.length === 2 &&
      afterFirstMove.play.map.traversedCorridorIds.length === 1,
    traversedDestinationVisible: destinationVisible === true,
    unrelatedUnexploredRoomStillHidden: unexploredStillHidden === true,
    mysteryUsesFreshSeed:
      mysteryStart.play.snapshot.seed !== authoringSeed &&
      mysteryStart.play.snapshot.id.startsWith('mystery-'),
    mysteryDoesNotReplaceAuthoringDungeon:
      mysteryStart.lastGeneration.seed === authoringSeed &&
      mysteryStart.rooms.length === authoringRoomIds.length &&
      mysteryStart.rooms.every((room) => authoringRoomIds.includes(room.id)),
    mysteryStartsWithOnlyStartRoomMapped:
      mysteryStart.play.map.exploredRoomIds.length === 1 &&
      mysteryStart.play.map.traversedCorridorIds.length === 0,
    mysteryGoalHiddenAtStart: mysteryGoalVisible === false,
    mysteryCurrentRoomVisible: mysteryCurrentVisible === true,
    mysteryHasExitChoices: mysteryExitCount === mysteryStart.play.map.currentExits.length && mysteryExitCount > 0,
    mysteryGoalIdNotVisibleInPlayText: !mysteryVisibleText.includes(mysteryStart.play.goalRoomId),
    browserErrorsAbsent:
      consoleErrors.length === 0 &&
      pageErrors.length === 0 &&
      failedRequests.length === 0 &&
      httpErrors.length === 0,
  };

  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    browserVersion: browser.version(),
    viewport: { width: 1440, height: 900 },
    passed,
    checks,
    authoring: {
      seed: authoringSeed,
      roomCount: authoring.rooms.length,
    },
    testPlay: {
      startMap: testStart.play.map,
      afterFirstMoveMap: afterFirstMove.play.map,
      exitCountAtStart,
    },
    mysteryPlay: {
      seedDifferentFromAuthoring: mysteryStart.play.snapshot.seed !== authoringSeed,
      startMap: mysteryStart.play.map,
      exitCount: mysteryExitCount,
    },
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(outputDir, 'dai-086-exploration-ux.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!passed) throw new Error(`DAI-086 exploration UX invariant failed: ${JSON.stringify(checks)}`);
} finally {
  if (browser) await browser.close();
  vite.kill();
}
