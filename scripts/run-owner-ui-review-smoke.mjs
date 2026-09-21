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

  // Room selection should preserve the user's manual camera rather than recentering.
  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.selectRoom('room-middle'));
  const cameraAfterSelection = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getCameraState());

  // Touch two connected rooms and verify their shared wall/corridor gap collapses into one outer shell.
  await canvas.focus();
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('a');
  const touchingState = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const touchingCorridorVisiblePoint = await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId('corridor-1'));

  await canvas.focus();
  await page.keyboard.press('a');
  await page.waitForTimeout(40);
  const afterBlockedTouchMove = await page.evaluate(() => ({
    room: window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === 'room-middle'),
    notice: document.querySelector('#viewportNotice')?.textContent ?? '',
    noticeVisible: document.querySelector('#viewportNotice')?.hidden === false,
  }));
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

  await page.click('#checkPath');
  const concealedGoalCheck = await page.evaluate(() => ({
    result: window.__DAI_EDITOR_SLICE__.getState().pathCheckResult,
    text: document.querySelector('#pathStatus')?.textContent ?? '',
  }));

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

  const goalCheckLayout = await page.evaluate(() => {
    const card = document.querySelector('.goal-check-card').getBoundingClientRect();
    const tabs = document.querySelector('.workflow-tabs').getBoundingClientRect();
    return { cardTop: card.top, cardBottom: card.bottom, tabsTop: tabs.top };
  });

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

  await page.click('#roomWidthPlus');
  await page.waitForFunction((id) =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === id)?.width === 11,
  goalRoomId);
  const afterWidthStepper = await page.evaluate((id) =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === id), goalRoomId);
  await page.click('#roomWidthMinus');
  await page.waitForFunction((id) =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === id)?.width === 10,
  goalRoomId);

  await page.fill('#roomWidth', '100');
  await page.fill('#roomDepth', '100');
  await page.click('#resizeRoom');
  await page.waitForTimeout(50);
  const afterUnsafeResize = await page.evaluate((id) => ({
    room: window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === id),
    editStatus: document.querySelector('#editStatus')?.textContent ?? '',
  }), goalRoomId);

  // Moving a room outward must not be rejected merely because strict non-crossing
  // corridor routing can no longer satisfy the layout.
  const leftmostBefore = await page.evaluate(() => {
    const rooms = window.__DAI_EDITOR_SLICE__.getState().rooms;
    return rooms.reduce((best, room) => room.x < best.x ? room : best);
  });
  await page.locator('#roomSelect').selectOption(leftmostBefore.id);
  await canvas.focus();
  for (let index = 0; index < 8; index += 1) await page.keyboard.press('a');
  const leftmostAfter = await page.evaluate((id) =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.find((room) => room.id === id),
  leftmostBefore.id);

  const southmostBefore = await page.evaluate(() => {
    const rooms = window.__DAI_EDITOR_SLICE__.getState().rooms;
    return rooms.reduce((best, room) => room.z > best.z ? room : best);
  });
  await page.locator('#roomSelect').selectOption(southmostBefore.id);
  await canvas.focus();
  for (let index = 0; index < 8; index += 1) await page.keyboard.press('s');
  const southmostAfter = await page.evaluate((id) =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.find((room) => room.id === id),
  southmostBefore.id);

  const middleRoomId = await page.evaluate(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.rooms.find((room) => room.id !== state.entities.find((entity) => entity.type === 'start')?.roomId &&
      room.id !== state.entities.find((entity) => entity.type === 'goal')?.roomId)?.id ?? null;
  });
  if (!middleRoomId) throw new Error('No interior room available.');
  const cameraBeforeGeneratedRoomSelection = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getCameraState());
  await page.locator('#roomSelect').selectOption(middleRoomId);
  const cameraAfterGeneratedRoomSelection = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getCameraState());
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
  await page.waitForFunction(({ id, z }) =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === id)?.z === z,
  { id: middleRoomId, z: middleBefore.z });

  const middleAfterRestore = await page.evaluate((id) =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === id), middleRoomId);

  // In Edit, Goal Check may reveal the actual route.
  await page.click('#checkPath');
  const pathState = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState().pathCheckResult);
  const pathText = await page.locator('#pathStatus').innerText();

  // Entity cards + direct 3D selection.
  const entityCount = generated.entities.length;
  const entityCardCount = await page.locator('#entityCards .entity-card').count();
  const entityIconCount = await page.locator('#entityCards .entity-icon').count();
  const entityCardColors = await page.evaluate(() => {
    const kinds = ['goal', 'enemy', 'treasure', 'trap', 'recovery'];
    return Object.fromEntries(kinds.map((kind) => {
      const icon = document.querySelector(`.entity-card[data-kind="${kind}"] .entity-icon`);
      return [kind, icon ? getComputedStyle(icon).color : null];
    }));
  });
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
    roomListValue: document.querySelector('#roomSelect')?.value ?? null,
    selectedEntityChip: document.querySelector('#entitySelected')?.textContent ?? '',
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

  // Play keyboard navigation and centered room-event controls.
  await page.click('[data-workflow-tab="play"]');
  await page.click('#start');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'play');

  const playBeforeKeyboard = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  let keyboardExit = null;
  const directionKeys = {
    north: 'ArrowUp',
    east: 'd',
    south: 's',
    west: 'a',
  };
  const planExits = await page.evaluate(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    const roomPlan = window.__DAI_EDITOR_SLICE__.getCurrentRoomPlan?.() ?? null;
    return {
      exits: state.play?.map?.currentExits ?? [],
      openings: roomPlan?.doorOpenings ?? [],
    };
  });
  for (const exit of planExits.exits) {
    const side = planExits.openings.find((opening) => opening.corridorId === exit.corridorId)?.side;
    if (side && directionKeys[side]) {
      keyboardExit = { ...exit, side, key: directionKeys[side] };
      break;
    }
  }
  if (!keyboardExit) throw new Error('No directional Play exit found for keyboard smoke.');

  await canvas.focus();
  await page.keyboard.press(keyboardExit.key);
  await page.waitForFunction((beforeMoves) => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.play?.moves === beforeMoves + 1 || document.querySelector('#roomEventBar')?.hidden === false;
  }, playBeforeKeyboard.play.moves);

  const playAfterKeyboard = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const eventLayout = await page.evaluate(() => {
    const reticle = document.querySelector('#playReticle')?.getBoundingClientRect();
    const events = document.querySelector('#roomEventBar')?.getBoundingClientRect();
    const eventVisible = document.querySelector('#roomEventBar')?.hidden === false;
    return {
      reticleVisible: document.querySelector('#playReticle')?.hidden === false,
      eventVisible,
      reticleCenterY: reticle ? reticle.top + reticle.height / 2 : null,
      eventTop: events?.top ?? null,
    };
  });

  await page.click('#returnEdit');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');

  const checks = {
    mouseOrbitChangesCamera: distance3(cameraBefore.position, cameraAfterOrbit.position) > 0.1,
    mouseWheelZoomChangesDistance: cameraAfterZoom.distance < cameraAfterOrbit.distance - 0.1,
    roomSelectionDoesNotRecenterCamera:
      distance3(cameraAfterZoom.position, cameraAfterSelection.position) < 0.01 &&
      distance3(cameraAfterZoom.target, cameraAfterSelection.target) < 0.01 &&
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
    concealedGoalCheckDoesNotRevealRoute:
      concealedGoalCheck.result?.reachable === true &&
      concealedGoalCheck.result?.routeVisible === false &&
      concealedGoalCheck.result?.roomIds?.length === 0 &&
      concealedGoalCheck.result?.corridorIds?.length === 0 &&
      concealedGoalCheck.result?.highlightIds?.length === 0 &&
      concealedGoalCheck.text.trim() === '✓ Reachable',
    mysteryStartsDirectlyWithoutEditReveal:
      mystery.playSource === 'mystery' &&
      mystery.play.snapshot.seed !== authoringSeed &&
      mystery.play.map.exploredRoomIds.length === 1 &&
      mysteryCoverHidden === true,
    roomListMarksStartAndGoal:
      roomOptionText.some((text) => text.includes('START')) &&
      roomOptionText.some((text) => text.includes('GOAL')),
    goalCheckIsTopLevelCard:
      goalCheckLayout.cardTop < goalCheckLayout.tabsTop &&
      goalCheckLayout.cardBottom <= goalCheckLayout.tabsTop,
    anyRoomCanBeResized: resizedGoal?.width === 10 && resizedGoal?.depth === 9,
    roomResizeStepperWorks: afterWidthStepper?.width === 11,
    unsafeRoomResizeRejected:
      afterUnsafeResize.room?.width === 10 &&
      afterUnsafeResize.room?.depth === 9 &&
      afterUnsafeResize.editStatus.includes('EDIT_RESULT_INVALID'),
    leftwardRoomMoveNotBlockedByCorridorRouting:
      leftmostAfter?.x === leftmostBefore.x - 8,
    downwardRoomMoveNotBlockedByCorridorRouting:
      southmostAfter?.z === southmostBefore.z + 8,
    wasdMovesSelectedRoom: middleAfterW?.z === middleBefore.z - 1,
    generatedRoomSelectionDoesNotRecenterCamera:
      distance3(cameraBeforeGeneratedRoomSelection.position, cameraAfterGeneratedRoomSelection.position) < 0.01 &&
      distance3(cameraBeforeGeneratedRoomSelection.target, cameraAfterGeneratedRoomSelection.target) < 0.01,
    blockedRoomMoveShowsReason:
      afterBlockedTouchMove.room?.x === 8 &&
      afterBlockedTouchMove.noticeVisible === true &&
      /Blocked:/.test(afterBlockedTouchMove.notice),
    editGoalCheckShowsReachableRoute:
      pathState?.reachable === true &&
      pathState?.routeVisible === true &&
      pathState.roomIds?.[0] === startRoomId &&
      pathState.roomIds?.at(-1) === goalRoomId &&
      pathText.includes('Reachable') &&
      pathText.includes('START') &&
      pathText.includes('GOAL'),
    entityCardsReplaceTextWall:
      entityCardCount === entityCount &&
      entityIconCount === entityCount,
    entityCardPaletteSeparated:
      entityCardColors.goal === 'rgb(59, 130, 246)' &&
      entityCardColors.enemy === 'rgb(239, 68, 68)' &&
      entityCardColors.treasure === 'rgb(234, 179, 8)' &&
      entityCardColors.trap === 'rgb(139, 92, 246)' &&
      entityCardColors.recovery === 'rgb(248, 250, 252)',
    clicking3dEntitySelectsAndHighlights:
      selectedEntityState.state.selectedEntityId === startEntityId &&
      selectedEntityState.renderedSelection === startEntityId,
    entitySelectionShowsContainingRoom:
      selectedEntityState.roomListValue === startRoomId &&
      selectedEntityState.selectedEntityChip.includes('START'),
    playKeyboardMovesOrReachesRoomEvent:
      playAfterKeyboard.play?.moves === playBeforeKeyboard.play.moves + 1 ||
      eventLayout.eventVisible === true,
    playReticleVisible: eventLayout.reticleVisible === true,
    roomEventCommandsAppearBelowReticle:
      eventLayout.eventVisible === false ||
      (Number.isFinite(eventLayout.eventTop) &&
       Number.isFinite(eventLayout.reticleCenterY) &&
       eventLayout.eventTop > eventLayout.reticleCenterY),
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
    concealedGoalCheck,
    touchingRoomMiddle: touchingState.rooms.find((room) => room.id === 'room-middle'),
    touchingCorridorVisiblePoint,
    afterBlockedTouchMove,
    roomOptionText,
    goalCheckLayout,
    resizedGoal,
    afterWidthStepper,
    afterUnsafeResize,
    leftmostBefore,
    leftmostAfter,
    southmostBefore,
    southmostAfter,
    cameraBeforeGeneratedRoomSelection,
    cameraAfterGeneratedRoomSelection,
    middleBefore,
    middleAfterW,
    middleAfterRestore,
    pathState,
    pathText,
    entityCardColors,
    selectedEntityId: selectedEntityState.state.selectedEntityId,
    renderedSelection: selectedEntityState.renderedSelection,
    selectedEntityRoomListValue: selectedEntityState.roomListValue,
    keyboardExit,
    playBeforeKeyboard,
    playAfterKeyboard,
    eventLayout,
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
