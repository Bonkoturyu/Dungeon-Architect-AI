import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_OWNER_UI_PORT || '4194');
const outputDir = path.resolve('artifacts/owner-ui-review');
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
  throw new Error(`Owner UI server did not become ready.\n${viteOutput}`);
}

function distance3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
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
        intent: {
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
        },
        meta: { provider: 'openai', model: 'test-model', usage: null },
      }),
    });
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__?.ready === true && window.__DAI_ONBOARDING__?.ready === true,
    null,
    { timeout: 60_000 },
  );
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());

  // Camera orbit / zoom.
  const cameraBefore = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getCameraState());
  const canvas = page.locator('#renderCanvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounds unavailable.');
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.5;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 110, cy + 45, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(50);
  const cameraAfterOrbit = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getCameraState());

  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -650);
  await page.waitForTimeout(50);
  const cameraAfterZoom = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getCameraState());

  // Ordinary selection/rerender should preserve the user's manual camera.
  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.selectRoom('room-middle'));
  const cameraAfterSelection = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getCameraState());

  // Touch two connected rooms and verify their shared wall/corridor gap collapses into one outer shell.
  await canvas.focus();
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('a');
  const touchingState = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const touchingCorridorVisiblePoint = await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId('corridor-1'));
  await page.screenshot({ path: path.join(outputDir, 'touching-room-shell.png'), fullPage: true });

  // Generate and verify no authored topology is revealed before the choice.
  await page.click('[data-workflow-tab="create"]');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().workflowTab === 'create');
  await page.fill('#generationPrompt', prompt);
  await page.click('#generateDungeon');
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.generationBusy === false && state.lastGeneration?.roomCount === 5;
  }, null, { timeout: 30_000 });

  const generated = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const promptInputAfterGenerate = await page.locator('#generationPrompt').inputValue();
  const coverVisible = await page.locator('#authoringPreviewCover').isVisible();
  const canvasVisibilityWhileConcealed = await page.evaluate(
    () => getComputedStyle(document.querySelector('#renderCanvas')).visibility,
  );
  const historyText = await page.locator('#generationHistory').innerText();
  const authoringSeed = generated.lastGeneration.seed;

  await page.screenshot({ path: path.join(outputDir, 'generated-choice.png'), fullPage: true });

  // Direct Mystery from generated-choice state; never enter Edit first.
  const workflowBeforeMystery = generated.workflowTab;
  await page.click('#mysteryPlay');
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.mode === 'play' && state.playSource === 'mystery';
  });
  const mystery = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const mysteryCoverHidden = !(await page.locator('#authoringPreviewCover').isVisible());
  await page.screenshot({ path: path.join(outputDir, 'direct-mystery.png'), fullPage: true });

  await page.click('#returnEdit');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().workflowTab === 'edit');

  // Room labels, all-room resize, and WASD.
  const roomOptionText = await page.locator('#roomSelect option').allTextContents();
  const goalRoomId = await page.evaluate(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.entities.find((entity) => entity.type === 'goal')?.roomId ?? null;
  });
  const startRoomId = await page.evaluate(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.entities.find((entity) => entity.type === 'start')?.roomId ?? null;
  });
  if (!goalRoomId || !startRoomId) throw new Error('Start/Goal room missing.');

  await page.locator('#roomSelect').selectOption(goalRoomId);
  await page.fill('#roomWidth', '10');
  await page.fill('#roomDepth', '9');
  await page.click('#resizeRoom');
  await page.waitForFunction((id) => {
    const room = window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === id);
    return room?.width === 10 && room?.depth === 9;
  }, goalRoomId);
  const resizedGoal = await page.evaluate((id) =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === id), goalRoomId);

  const middleRoomId = await page.evaluate(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.rooms.find((room) => room.id !== state.entities.find((entity) => entity.type === 'start')?.roomId &&
      room.id !== state.entities.find((entity) => entity.type === 'goal')?.roomId)?.id ?? null;
  });
  if (!middleRoomId) throw new Error('No interior room available.');
  await page.locator('#roomSelect').selectOption(middleRoomId);
  const middleBefore = await page.evaluate((id) =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === id), middleRoomId);
  await canvas.focus();
  await page.keyboard.press('w');
  await page.waitForFunction(({ id, z }) =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === id)?.z === z - 1,
  { id: middleRoomId, z: middleBefore.z });
  const middleAfterW = await page.evaluate((id) =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === id), middleRoomId);
  await page.keyboard.press('s');

  // Start -> Goal path check.
  await page.click('#checkPath');
  const pathState = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState().pathCheckResult);
  const pathText = await page.locator('#pathStatus').innerText();

  // Entity cards + direct 3D selection.
  const entityCount = generated.entities.length;
  const entityCardCount = await page.locator('#entityCards .entity-card').count();
  const entityIconCount = await page.locator('#entityCards .entity-icon').count();
  const startEntityId = await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.getState().entities.find((entity) => entity.type === 'start')?.id ?? null);
  if (!startEntityId) throw new Error('Start entity missing.');
  const startPoint = await page.evaluate((id) =>
    window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId(id), startEntityId);
  if (!startPoint) throw new Error('Start marker screen point unavailable.');
  await page.mouse.click(startPoint.x, startPoint.y);
  await page.waitForFunction((id) =>
    window.__DAI_EDITOR_SLICE__.getState().selectedEntityId === id, startEntityId);
  const selectedEntityState = await page.evaluate(() => ({
    state: window.__DAI_EDITOR_SLICE__.getState(),
    renderedSelection: window.__DAI_EDITOR_SLICE__.getRenderedSelection(),
  }));

  // Same-room Start/Goal protection in UI and validation.
  await page.waitForFunction((goalId) => {
    const option = document.querySelector(`#entityRoom option[value="${goalId}"]`);
    return option?.disabled === true;
  }, goalRoomId);
  const goalOptionDisabledForStart = await page.evaluate((goalId) =>
    document.querySelector(`#entityRoom option[value="${goalId}"]`)?.disabled === true,
  goalRoomId);
  const sameRoomGate = await page.evaluate(async () => {
    const response = await fetch('/spec/dungeon/fixtures/minimal-valid-v1.json', { cache: 'no-store' });
    const spec = await response.json();
    const start = spec.entities.find((entity) => entity.type === 'start');
    const goal = spec.entities.find((entity) => entity.type === 'goal');
    goal.roomId = start.roomId;
    return window.__DAI_EDITOR_SLICE__.evaluateStartGateForSpec(spec);
  });

  await page.screenshot({ path: path.join(outputDir, 'edit-owner-review.png'), fullPage: true });

  const checks = {
    mouseOrbitChangesCamera: distance3(cameraBefore.position, cameraAfterOrbit.position) > 0.1,
    mouseWheelZoomChangesDistance: cameraAfterZoom.distance < cameraAfterOrbit.distance - 0.1,
    cameraPersistsAcrossEditorRerender:
      distance3(cameraAfterZoom.position, cameraAfterSelection.position) < 0.01 &&
      Math.abs(cameraAfterZoom.distance - cameraAfterSelection.distance) < 0.01,
    touchingConnectedRoomsUseOuterShell:
      touchingState.rooms.find((room) => room.id === 'room-middle')?.x === 8 &&
      touchingCorridorVisiblePoint === null,
    promptRemainsVisibleAfterGenerate: promptInputAfterGenerate === prompt,
    promptHistoryRetainsFullPrompt: generated.promptHistory.length === 1 &&
      generated.promptHistory[0].prompt === prompt &&
      historyText.includes(prompt),
    generatedLayoutConcealed:
      generated.authoringPreviewConcealed === true &&
      workflowBeforeMystery === 'play' &&
      coverVisible === true &&
      canvasVisibilityWhileConcealed === 'hidden',
    mysteryStartsDirectlyWithoutEditReveal:
      mystery.playSource === 'mystery' &&
      mystery.play.snapshot.seed !== authoringSeed &&
      mystery.play.map.exploredRoomIds.length === 1 &&
      mysteryCoverHidden === true,
    roomListMarksStartAndGoal:
      roomOptionText.some((text) => text.includes('START')) &&
      roomOptionText.some((text) => text.includes('GOAL')),
    anyRoomCanBeResized: resizedGoal?.width === 10 && resizedGoal?.depth === 9,
    wasdMovesSelectedRoom: middleAfterW?.z === middleBefore.z - 1,
    pathCheckShowsReachableRoute:
      pathState?.reachable === true &&
      pathState.roomIds?.[0] === startRoomId &&
      pathState.roomIds?.at(-1) === goalRoomId &&
      pathText.includes('Reachable'),
    entityCardsReplaceTextWall:
      entityCardCount === entityCount &&
      entityIconCount === entityCount,
    clicking3dEntitySelectsAndHighlights:
      selectedEntityState.state.selectedEntityId === startEntityId &&
      selectedEntityState.renderedSelection === startEntityId,
    goalRoomDisabledForStartEntity: goalOptionDisabledForStart === true,
    sameRoomStartGoalFailsValidation:
      sameRoomGate.allowed === false &&
      sameRoomGate.errors.some((error) => error.code === 'START_GOAL_SAME_ROOM'),
    browserErrorsAbsent:
      consoleErrors.length === 0 &&
      pageErrors.length === 0 &&
      failedRequests.length === 0 &&
      httpErrors.length === 0,
  };

  const falseChecks = Object.entries(checks).filter(([, value]) => value !== true).map(([name]) => name);
  const evidence = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    browserVersion: browser.version(),
    passed: falseChecks.length === 0,
    checks,
    falseChecks,
    cameraBefore,
    cameraAfterOrbit,
    cameraAfterZoom,
    cameraAfterSelection,
    touchingRoomMiddle: touchingState.rooms.find((room) => room.id === 'room-middle'),
    touchingCorridorVisiblePoint,
    roomOptionText,
    resizedGoal,
    middleBefore,
    middleAfterW,
    pathState,
    pathText,
    selectedEntityId: selectedEntityState.state.selectedEntityId,
    renderedSelection: selectedEntityState.renderedSelection,
    sameRoomGateErrors: sameRoomGate.errors,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(outputDir, 'owner-ui-review.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(`Owner UI review invariant failed: ${falseChecks.join(', ')}`);
  }
} finally {
  if (browser) await browser.close();
  vite.kill();
}
