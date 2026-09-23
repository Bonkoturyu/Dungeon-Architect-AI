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

  // English must be the default. The same live language state is shared by
  // the main UI and the first-run onboarding dialog.
  const languageSamples = {};
  languageSamples.en = await page.evaluate(() => ({
    htmlLang: document.documentElement.lang,
    title: document.querySelector('#onboardingTitle')?.textContent ?? '',
    createTab: document.querySelector('[data-workflow-tab="create"]')?.textContent ?? '',
    headerCurrentLanguage: document.querySelector('#languageCycle')?.dataset.currentLanguage ?? null,
    headerNextLanguage: document.querySelector('#languageCycle')?.dataset.nextLanguage ?? null,
    dialogCurrentLanguage: document.querySelector('#onboardingLanguageCycle')?.dataset.currentLanguage ?? null,
    dialogNextLanguage: document.querySelector('#onboardingLanguageCycle')?.dataset.nextLanguage ?? null,
    headerCycleText: document.querySelector('#languageCycle')?.textContent ?? '',
    dialogCycleText: document.querySelector('#onboardingLanguageCycle')?.textContent ?? '',
    headerButtonCount: document.querySelectorAll('.app-header [data-language-cycle]').length,
    dialogButtonCount: document.querySelectorAll('#onboarding [data-language-cycle]').length,
    legacyHeaderLanguageButtons: document.querySelectorAll('.app-header [data-language]').length,
    legacyDialogLanguageButtons: document.querySelectorAll('#onboarding [data-language]').length,
    stateLanguage: window.__DAI_EDITOR_SLICE__.getState().language,
  }));

  for (const [language, expectedTitle, expectedCreate] of [
    ['ja', 'Dungeon Architect AIへようこそ', '✨ 作成'],
    ['zh-Hans', '欢迎使用 Dungeon Architect AI', '✨ 创建'],
    ['zh-Hant', '歡迎使用 Dungeon Architect AI', '✨ 建立'],
    ['ko', 'Dungeon Architect AI에 오신 것을 환영합니다', '✨ 생성'],
  ]) {
    await page.locator('#onboardingLanguageCycle').click();
    await page.waitForTimeout(30);
    languageSamples[language] = await page.evaluate(
      ({ expectedTitle, expectedCreate }) => ({
        htmlLang: document.documentElement.lang,
        title: document.querySelector('#onboardingTitle')?.textContent ?? '',
        createTab: document.querySelector('[data-workflow-tab="create"]')?.textContent ?? '',
        headerCurrentLanguage: document.querySelector('#languageCycle')?.dataset.currentLanguage ?? null,
        headerNextLanguage: document.querySelector('#languageCycle')?.dataset.nextLanguage ?? null,
        dialogCurrentLanguage: document.querySelector('#onboardingLanguageCycle')?.dataset.currentLanguage ?? null,
        dialogNextLanguage: document.querySelector('#onboardingLanguageCycle')?.dataset.nextLanguage ?? null,
        headerCycleText: document.querySelector('#languageCycle')?.textContent ?? '',
        dialogCycleText: document.querySelector('#onboardingLanguageCycle')?.textContent ?? '',
        stateLanguage: window.__DAI_EDITOR_SLICE__.getState().language,
        expectedTitle,
        expectedCreate,
      }),
      { expectedTitle, expectedCreate },
    );
  }

  await page.locator('#onboardingLanguageCycle').click();
  await page.waitForTimeout(30);
  const englishRestored = await page.evaluate(() => ({
    htmlLang: document.documentElement.lang,
    title: document.querySelector('#onboardingTitle')?.textContent ?? '',
    createTab: document.querySelector('[data-workflow-tab="create"]')?.textContent ?? '',
    headerCurrentLanguage: document.querySelector('#languageCycle')?.dataset.currentLanguage ?? null,
    headerNextLanguage: document.querySelector('#languageCycle')?.dataset.nextLanguage ?? null,
    dialogCurrentLanguage: document.querySelector('#onboardingLanguageCycle')?.dataset.currentLanguage ?? null,
    dialogNextLanguage: document.querySelector('#onboardingLanguageCycle')?.dataset.nextLanguage ?? null,
    headerCycleText: document.querySelector('#languageCycle')?.textContent ?? '',
    dialogCycleText: document.querySelector('#onboardingLanguageCycle')?.textContent ?? '',
    stateLanguage: window.__DAI_EDITOR_SLICE__.getState().language,
  }));
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());

  // Camera controls: right drag orbits, left drag pans, wheel zooms.
  const cameraBefore = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getCameraState());
  const canvas = page.locator('#renderCanvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounds unavailable.');
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.5;

  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(cx + 110, cy + 45, { steps: 12 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(50);
  const cameraAfterOrbit = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getCameraState());

  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(cx + 90, cy - 55, { steps: 10 });
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(50);
  const cameraAfterPan = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getCameraState());

  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -650);
  await page.waitForTimeout(50);
  const cameraAfterZoom = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getCameraState());

  // Room selection should preserve the user's manual camera rather than recentering.
  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.selectRoom('room-middle'));
  const cameraAfterSelection = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getCameraState());

  // Owner regression: from the fixed fixture, move Goal to (27, 4) and then one
  // step upward. This exact neighborhood previously produced LAYOUT_NOT_RENDERABLE.
  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.selectRoom('room-goal'));
  const goalInspectorAfterSelection = await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.getState().inspectorTab);
  await canvas.focus();
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('d');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('s');
  const goalBeforeOwnerUp = await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.find((room) => room.id === 'room-goal'));
  await page.keyboard.press('w');
  await page.waitForFunction(() => {
    const room = window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === 'room-goal');
    return room?.x === 27 && room?.z === 3;
  });
  const goalAfterOwnerUp = await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.find((room) => room.id === 'room-goal'));

  // Restore the fixture coordinates before the touching-room regression.
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('a');
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('w');
  await page.waitForFunction(() => {
    const room = window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === 'room-goal');
    return room?.x === 24 && room?.z === 0;
  });

  // Touch two connected rooms and verify their shared wall/corridor gap collapses into one outer shell.
  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.selectRoom('room-middle'));
  await canvas.focus();
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('a');
  const touchingState = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const touchingCorridorVisiblePoint = await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId('corridor-1'));

  await canvas.focus();
  await page.keyboard.press('a');
  await page.waitForTimeout(40);
  const afterBlockedTouchMove = await page.evaluate(() => {
    const notice = document.querySelector('#viewportNotice');
    const viewport = document.querySelector('.viewport-shell');
    const noticeRect = notice?.getBoundingClientRect();
    const viewportRect = viewport?.getBoundingClientRect();
    return {
      room: window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === 'room-middle'),
      notice: notice?.textContent ?? '',
      noticeVisible: notice?.hidden === false,
      noticeRect: noticeRect ? {
        left: noticeRect.left,
        right: noticeRect.right,
        top: noticeRect.top,
        bottom: noticeRect.bottom,
        width: noticeRect.width,
        height: noticeRect.height,
      } : null,
      viewportRect: viewportRect ? {
        left: viewportRect.left,
        right: viewportRect.right,
        top: viewportRect.top,
        bottom: viewportRect.bottom,
        width: viewportRect.width,
        height: viewportRect.height,
      } : null,
    };
  });
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
  const afterMysteryReturn = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  const sidebarHierarchy = await page.evaluate(() => {
    const goal = document.querySelector('.goal-check-card').getBoundingClientRect();
    const modes = document.querySelector('.workflow-tabs').getBoundingClientRect();
    const ai = document.querySelector('fieldset.panel-ai').getBoundingClientRect();
    const inspector = document.querySelector('#editInspector').getBoundingClientRect();
    return {
      goal: { top: goal.top, bottom: goal.bottom },
      modes: { top: modes.top, bottom: modes.bottom },
      ai: { top: ai.top, bottom: ai.bottom },
      inspector: { top: inspector.top, bottom: inspector.bottom },
      inspectorLabels: [...document.querySelectorAll('.inspector-tab')]
        .map((button) => button.textContent.trim()),
    };
  });
  const uiScale = await page.evaluate(() => {
    const button = document.querySelector('#checkPath').getBoundingClientRect();
    const workflow = document.querySelector('.workflow-tab').getBoundingClientRect();
    const select = document.querySelector('#roomSelect').getBoundingClientRect();
    const helper = getComputedStyle(document.querySelector('.panel-kicker'));
    const label = getComputedStyle(document.querySelector('label'));
    return {
      buttonHeight: button.height,
      workflowHeight: workflow.height,
      selectHeight: select.height,
      helperFontPx: Number.parseFloat(helper.fontSize),
      labelFontPx: Number.parseFloat(label.fontSize),
    };
  });
  const sidebarOverflow = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const inspector = document.querySelector('#editInspector');
    const visiblePanel = document.querySelector('.inspector-panel:not([style*="display: none"])') ??
      [...document.querySelectorAll('.inspector-panel')].find((panel) => getComputedStyle(panel).display !== 'none');
    return {
      asideClientWidth: aside?.clientWidth ?? 0,
      asideScrollWidth: aside?.scrollWidth ?? 0,
      inspectorClientWidth: inspector?.clientWidth ?? 0,
      inspectorScrollWidth: inspector?.scrollWidth ?? 0,
      panelClientWidth: visiblePanel?.clientWidth ?? 0,
      panelScrollWidth: visiblePanel?.scrollWidth ?? 0,
    };
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
  const generatedGoalRoomInspectorTab = await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.getState().inspectorTab);
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

  // Structural authoring: direction-button Room creation plus direct 3D corridor drag.
  const structuralSetup = await page.evaluate(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    const rooms = state.rooms;
    const candidates = [
      { room: rooms.reduce((best, room) => room.x < best.x ? room : best), side: 'west', opposite: 'east' },
      { room: rooms.reduce((best, room) => room.x > best.x ? room : best), side: 'east', opposite: 'west' },
      { room: rooms.reduce((best, room) => room.z < best.z ? room : best), side: 'north', opposite: 'south' },
      { room: rooms.reduce((best, room) => room.z > best.z ? room : best), side: 'south', opposite: 'north' },
    ];
    for (const candidate of candidates) {
      window.__DAI_EDITOR_SLICE__.selectRoom(candidate.room.id);
      const plan = window.__DAI_EDITOR_SLICE__.getCurrentRoomPlan?.();
      const occupied = (plan?.doorOpenings ?? []).some((opening) => opening.side === candidate.side);
      if (!occupied) {
        return {
          roomId: candidate.room.id,
          side: candidate.side,
          opposite: candidate.opposite,
        };
      }
    }
    return null;
  });
  if (!structuralSetup) throw new Error('No free outward room wall available for direct corridor smoke.');

  const structuralAnchorId = structuralSetup.roomId;
  await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.selectRoom(id), structuralAnchorId);
  const structuralBefore = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.click(`[data-room-add-direction="${structuralSetup.side}"]`);
  await page.waitForFunction((roomCount) =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.length === roomCount + 1,
  structuralBefore.rooms.length);
  const structuralAfterAddRoom = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const addedRoomId = structuralAfterAddRoom.selectedRoomId;
  if (!addedRoomId) throw new Error('Added room did not become selected.');

  await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.selectRoom(id), structuralAnchorId);
  const dragPoints = await page.evaluate(({ fromRoomId, toRoomId, side }) => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    const target = state.rooms.find((room) => room.id === toRoomId);
    return {
      start: window.__DAI_EDITOR_SLICE__.getScreenPositionForRoomWall(fromRoomId, side),
      end: window.__DAI_EDITOR_SLICE__.getScreenPositionForWorldPoint({
        x: target.x,
        y: 0,
        z: target.z,
      }),
    };
  }, { fromRoomId: structuralAnchorId, toRoomId: addedRoomId, side: structuralSetup.side });
  if (!dragPoints.start || !dragPoints.end) throw new Error('Direct corridor drag screen points unavailable.');

  await page.mouse.move(dragPoints.start.x, dragPoints.start.y);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(dragPoints.end.x, dragPoints.end.y, { steps: 14 });
  const corridorDraftBeforeRelease = await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.getState().corridorDraftPreview);
  await page.mouse.up({ button: 'left' });
  await page.waitForFunction((corridorCount) =>
    window.__DAI_EDITOR_SLICE__.getState().corridors.length === corridorCount + 1,
  structuralBefore.corridors.length);
  const structuralAfterAddCorridor = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const addedCorridorId = structuralAfterAddCorridor.selectedCorridorId;
  if (!addedCorridorId) throw new Error('Direct corridor drag did not select the created corridor.');

  const structuralAfterSides = await page.evaluate((corridorId) => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return {
      corridor: state.corridors.find((entry) => entry.id === corridorId),
      selectedCorridorId: state.selectedCorridorId,
      selectionText: document.querySelector('#selected')?.textContent ?? '',
    };
  }, addedCorridorId);

  // Dragging a wall into empty space and releasing must cancel without adding a corridor.
  await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.selectRoom(id), addedRoomId);
  const beforeCancelledDraft = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState().corridors.length);
  const cancelPoints = await page.evaluate((roomId) => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    const room = state.rooms.find((entry) => entry.id === roomId);
    return {
      start: window.__DAI_EDITOR_SLICE__.getScreenPositionForRoomWall(roomId, 'north'),
      end: window.__DAI_EDITOR_SLICE__.getScreenPositionForWorldPoint({
        x: room.x,
        y: 0,
        z: room.z - 24,
      }),
    };
  }, addedRoomId);
  await page.mouse.move(cancelPoints.start.x, cancelPoints.start.y);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(cancelPoints.end.x, cancelPoints.end.y, { steps: 10 });
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(60);
  const afterCancelledDraft = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState().corridors.length);

  await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.selectCorridor(id), addedCorridorId);
  await page.click('#removeCorridor');
  await page.waitForFunction((corridorId) =>
    !window.__DAI_EDITOR_SLICE__.getState().corridors.some((entry) => entry.id === corridorId),
  addedCorridorId);

  await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.selectRoom(id), addedRoomId);
  await page.click('#removeRoom');
  await page.waitForFunction((roomId) =>
    !window.__DAI_EDITOR_SLICE__.getState().rooms.some((entry) => entry.id === roomId),
  addedRoomId);
  const structuralAfterCleanup = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  // With no Room selected, Add Room should place a new isolated Room near the
  // current view center. That unconnected Room can then be freely dragged.
  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.selectRoom(null));
  const noSelectionRoomUi = await page.evaluate(() => ({
    selectedVisible: document.querySelector('#roomAddFromSelection')?.hidden === false,
    unselectedVisible: document.querySelector('#roomAddWithoutSelection')?.hidden === false,
  }));
  const beforeCenteredAdd = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  await page.click('#addRoomAtViewCenter');
  await page.waitForFunction((roomCount) =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.length === roomCount + 1,
  beforeCenteredAdd.rooms.length);
  const centeredAddState = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const centeredRoomId = centeredAddState.selectedRoomId;
  if (!centeredRoomId) throw new Error('Centered room add did not select the new room.');

  const centeredRoomScreen = await page.evaluate((roomId) => {
    const room = window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === roomId);
    return room
      ? window.__DAI_EDITOR_SLICE__.getScreenPositionForWorldPoint({ x: room.x, y: 0, z: room.z })
      : null;
  }, centeredRoomId);
  if (!centeredRoomScreen) throw new Error('Centered room floor screen point unavailable.');

  const centeredRoomDragPlan = await page.evaluate((roomId) => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    const room = state.rooms.find((entry) => entry.id === roomId);
    const overlaps = (candidate, other) => {
      const overlapX =
        Math.min(candidate.x + candidate.width / 2, other.x + other.width / 2) -
        Math.max(candidate.x - candidate.width / 2, other.x - other.width / 2);
      const overlapZ =
        Math.min(candidate.z + candidate.depth / 2, other.z + other.depth / 2) -
        Math.max(candidate.z - candidate.depth / 2, other.z - other.depth / 2);
      return overlapX > 1e-9 && overlapZ > 1e-9;
    };
    const offsets = [
      [16, 0], [-16, 0], [0, 16], [0, -16],
      [16, 16], [-16, 16], [16, -16], [-16, -16],
      [24, 0], [-24, 0], [0, 24], [0, -24],
    ];
    for (const [dx, dz] of offsets) {
      const candidate = { ...room, x: room.x + dx, z: room.z + dz };
      if (!state.rooms.some((other) => other.id !== roomId && overlaps(candidate, other))) {
        return {
          before: { x: room.x, z: room.z },
          target: { x: candidate.x, z: candidate.z },
          screen: window.__DAI_EDITOR_SLICE__.getScreenPositionForWorldPoint({
            x: candidate.x,
            y: 0,
            z: candidate.z,
          }),
        };
      }
    }
    return null;
  }, centeredRoomId);
  if (!centeredRoomDragPlan?.screen) throw new Error('No safe target available for isolated room drag.');

  await page.mouse.move(centeredRoomScreen.x, centeredRoomScreen.y);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(centeredRoomDragPlan.screen.x, centeredRoomDragPlan.screen.y, { steps: 14 });
  await page.mouse.up({ button: 'left' });
  await page.waitForFunction(({ roomId, target }) => {
    const room = window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === roomId);
    return room &&
      Math.abs(room.x - target.x) <= 0.25 &&
      Math.abs(room.z - target.z) <= 0.25;
  }, { roomId: centeredRoomId, target: centeredRoomDragPlan.target });
  const centeredRoomAfterDrag = await page.evaluate((roomId) =>
    window.__DAI_EDITOR_SLICE__.getState().rooms.find((entry) => entry.id === roomId),
  centeredRoomId);

  await page.click('#removeRoom');
  await page.waitForFunction((roomId) =>
    !window.__DAI_EDITOR_SLICE__.getState().rooms.some((entry) => entry.id === roomId),
  centeredRoomId);
  const afterCenteredRoomCleanup = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  // In Edit, Goal Check may reveal the actual route.
  await page.click('#checkPath');
  const pathState = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState().pathCheckResult);
  const pathText = await page.locator('#pathStatus').innerText();

  // Viewport HUD replaces the previous right-side entity card wall.
  const rightEntityCardCount = await page.locator('aside .entity-card').count();
  const legendState = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#entityLegend .legend-item')];
    return {
      visible: document.querySelector('#entityLegend')?.hidden === false &&
        getComputedStyle(document.querySelector('#entityLegend')).display !== 'none',
      count: items.length,
      kinds: items.map((item) => item.dataset.kind),
      markerColors: Object.fromEntries(items.map((item) => {
        const marker = item.querySelector('.entity-marker');
        return [item.dataset.kind, marker ? getComputedStyle(marker).color : null];
      })),
    };
  });

  const startEntityId = await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.getState().entities.find((entity) => entity.type === 'start')?.id ?? null);
  if (!startEntityId) throw new Error('Start entity missing.');

  // Selecting a room shows its current entity contents in the upper-right HUD.
  await page.locator('#roomSelect').selectOption(startRoomId);
  await page.waitForFunction((roomId) => {
    const overlay = document.querySelector('#roomContentsOverlay');
    const room = document.querySelector('#roomContentsRoom')?.textContent ?? '';
    return overlay?.hidden === false && room.includes(roomId);
  }, startRoomId);
  const roomContentsBeforeEntityClick = await page.evaluate((startId) => ({
    overlayVisible: document.querySelector('#roomContentsOverlay')?.hidden === false,
    roomText: document.querySelector('#roomContentsRoom')?.textContent ?? '',
    entityIds: [...document.querySelectorAll('#roomContentsItems .room-content-item')]
      .map((button) => button.dataset.entityId),
    itemCount: document.querySelectorAll('#roomContentsItems .room-content-item').length,
    hasStart: [...document.querySelectorAll('#roomContentsItems .room-content-item')]
      .some((button) => button.dataset.entityId === startId),
  }), startEntityId);

  const editHudLayout = await page.evaluate(() => {
    const viewport = document.querySelector('.viewport-shell').getBoundingClientRect();
    const selection = document.querySelector('#selectionOverlay').getBoundingClientRect();
    const legend = document.querySelector('#entityLegend').getBoundingClientRect();
    const contents = document.querySelector('#roomContentsOverlay').getBoundingClientRect();
    return {
      viewport: { left: viewport.left, right: viewport.right, top: viewport.top, width: viewport.width },
      selection: { left: selection.left, right: selection.right, top: selection.top, bottom: selection.bottom, width: selection.width },
      legend: { left: legend.left, right: legend.right, top: legend.top, bottom: legend.bottom, width: legend.width },
      contents: { left: contents.left, right: contents.right, top: contents.top, bottom: contents.bottom },
    };
  });

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
    selectionOverlayVisible: document.querySelector('#selectionOverlay')?.hidden === false,
    selectionText: document.querySelector('#selected')?.textContent ?? '',
    containingRoomText: document.querySelector('#entitySelected')?.textContent ?? '',
    roomContentsVisible: document.querySelector('#roomContentsOverlay')?.hidden === false,
    selectedRoomContentId: document.querySelector('#roomContentsItems .room-content-item.is-selected')?.dataset.entityId ?? null,
  }));

  const entityCreateSpacing = await page.evaluate(() => {
    const panel = document.querySelector('[data-inspector-panel="entities"]');
    const buttonRow = panel?.querySelector('.button-row');
    const label = panel?.querySelector('.entity-create-label');
    const labelText = label?.querySelector('span');
    const select = document.querySelector('#entityType');
    const add = document.querySelector('#addEntity');
    const buttonRect = buttonRow?.getBoundingClientRect() ?? null;
    const labelRect = labelText?.getBoundingClientRect() ?? null;
    const selectRect = select?.getBoundingClientRect() ?? null;
    const addRect = add?.getBoundingClientRect() ?? null;
    return {
      buttonToLabelGap: buttonRect && labelRect ? labelRect.top - buttonRect.bottom : null,
      labelToSelectGap: labelRect && selectRect ? selectRect.top - labelRect.bottom : null,
      selectToAddGap: selectRect && addRect ? addRect.top - selectRect.bottom : null,
      labelLineHeight: labelText ? parseFloat(getComputedStyle(labelText).lineHeight) : null,
    };
  });

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
    const viewport = document.querySelector('.viewport-shell')?.getBoundingClientRect();
    const eventVisible = document.querySelector('#roomEventBar')?.hidden === false;
    return {
      reticleVisible: document.querySelector('#playReticle')?.hidden === false,
      eventVisible,
      reticleCenterY: reticle ? reticle.top + reticle.height / 2 : null,
      eventTop: events?.top ?? null,
      eventCenterX: events ? events.left + events.width / 2 : null,
      eventCenterY: events ? events.top + events.height / 2 : null,
      viewportCenterX: viewport ? viewport.left + viewport.width / 2 : null,
      viewportCenterY: viewport ? viewport.top + viewport.height / 2 : null,
    };
  });

  const playResultCentering = await page.evaluate(() => {
    const modeBadge = document.querySelector('#modeBadge');
    const playSummary = document.querySelector('.play-summary');
    const playMetrics = document.querySelector('#playStatus');
    const pill = document.querySelector('#playModeLabel');
    const summaryRect = playSummary?.getBoundingClientRect() ?? null;
    const visibleChildren = [pill, playMetrics]
      .filter((element) => element && element.hidden === false)
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0);
    const groupLeft = visibleChildren.length
      ? Math.min(...visibleChildren.map((rect) => rect.left))
      : null;
    const groupRight = visibleChildren.length
      ? Math.max(...visibleChildren.map((rect) => rect.right))
      : null;
    const groupCenter = groupLeft != null && groupRight != null
      ? (groupLeft + groupRight) / 2
      : null;
    const summaryCenter = summaryRect
      ? (summaryRect.left + summaryRect.right) / 2
      : null;

    let modeLampTextGap = null;
    if (modeBadge) {
      const textNode = [...modeBadge.childNodes].find((node) =>
        node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0);
      if (textNode) {
        const range = document.createRange();
        range.selectNodeContents(textNode);
        const textRect = range.getBoundingClientRect();
        const badgeRect = modeBadge.getBoundingClientRect();
        const pseudo = getComputedStyle(modeBadge, '::before');
        const lampLeft = Number.parseFloat(pseudo.left);
        const lampWidth = Number.parseFloat(pseudo.width);
        if (Number.isFinite(lampLeft) && Number.isFinite(lampWidth)) {
          modeLampTextGap = textRect.left - (badgeRect.left + lampLeft + lampWidth);
        }
      }
    }

    return {
      modeBadgeJustify: modeBadge ? getComputedStyle(modeBadge).justifyContent : null,
      modeBadgeTextAlign: modeBadge ? getComputedStyle(modeBadge).textAlign : null,
      modeLampTextGap,
      returnEditText: document.querySelector('#returnEdit')?.textContent?.trim() ?? '',
      playSummaryJustify: playSummary ? getComputedStyle(playSummary).justifyContent : null,
      playSummaryTextAlign: playSummary ? getComputedStyle(playSummary).textAlign : null,
      playMetricsJustify: playMetrics ? getComputedStyle(playMetrics).justifyContent : null,
      groupCenter,
      summaryCenter,
    };
  });

  await page.click('#returnEdit');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');

  const checks = {
    englishIsDefaultLanguage:
      languageSamples.en.htmlLang === 'en' &&
      languageSamples.en.stateLanguage === 'en',
    allFiveLanguagesSwitchLive:
      Object.entries(languageSamples)
        .filter(([language]) => language !== 'en')
        .every(([language, sample]) =>
          sample.htmlLang === language &&
          sample.stateLanguage === language &&
          sample.headerCurrentLanguage === language &&
          sample.dialogCurrentLanguage === language &&
          sample.headerCycleText === sample.dialogCycleText &&
          sample.title.trim().length > 0 &&
          sample.createTab.trim().length > 0) &&
      englishRestored.htmlLang === 'en' &&
      englishRestored.stateLanguage === 'en' &&
      englishRestored.headerCurrentLanguage === 'en' &&
      englishRestored.dialogCurrentLanguage === 'en' &&
      englishRestored.headerCycleText === englishRestored.dialogCycleText,
    compactLanguageCycleControls:
      languageSamples.en.headerButtonCount === 1 &&
      languageSamples.en.dialogButtonCount === 1 &&
      languageSamples.en.legacyHeaderLanguageButtons === 0 &&
      languageSamples.en.legacyDialogLanguageButtons === 0 &&
      languageSamples.en.headerCycleText === 'EN ▶ 日本語' &&
      languageSamples.en.dialogCycleText === 'EN ▶ 日本語',
    sidebarHierarchyMatchesAiFirstWorkflow:
      sidebarHierarchy.goal.bottom <= sidebarHierarchy.modes.top &&
      sidebarHierarchy.modes.bottom <= sidebarHierarchy.ai.top &&
      sidebarHierarchy.ai.bottom <= sidebarHierarchy.inspector.top &&
      sidebarHierarchy.inspectorLabels.length === 3 &&
      /Entities/.test(sidebarHierarchy.inspectorLabels[0]) &&
      /Rooms/.test(sidebarHierarchy.inspectorLabels[1]) &&
      /Corridors/.test(sidebarHierarchy.inspectorLabels[2]),
    controlsAndTypographyUseReadableScale:
      uiScale.buttonHeight >= 44 &&
      uiScale.workflowHeight >= 44 &&
      uiScale.selectHeight >= 40 &&
      uiScale.helperFontPx >= 13 &&
      uiScale.labelFontPx >= 14,
    editorSidebarHasNoHorizontalOverflow:
      sidebarOverflow.asideScrollWidth <= sidebarOverflow.asideClientWidth + 1 &&
      sidebarOverflow.inspectorScrollWidth <= sidebarOverflow.inspectorClientWidth + 1 &&
      sidebarOverflow.panelScrollWidth <= sidebarOverflow.panelClientWidth + 1,
    rightMouseDragOrbitsCamera:
      distance3(cameraBefore.position, cameraAfterOrbit.position) > 0.1 &&
      distance3(cameraBefore.target, cameraAfterOrbit.target) < 0.05,
    leftMouseDragPansCamera:
      distance3(cameraAfterOrbit.target, cameraAfterPan.target) > 0.1 &&
      Math.abs(cameraAfterOrbit.distance - cameraAfterPan.distance) < 0.1,
    mouseWheelZoomChangesDistance: cameraAfterZoom.distance < cameraAfterPan.distance - 0.1,
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
    mysteryReturnAdoptsPlayedSnapshot:
      afterMysteryReturn.mode === 'edit' &&
      afterMysteryReturn.workflowTab === 'edit' &&
      afterMysteryReturn.authoringPreviewConcealed === false &&
      afterMysteryReturn.lastGeneration?.seed === mystery.play.snapshot.seed &&
      afterMysteryReturn.canUndo === false &&
      JSON.stringify(afterMysteryReturn.rooms) === JSON.stringify(
        mystery.play.snapshot.rooms.map((room) => ({
          id: room.id,
          x: room.x,
          z: room.z,
          width: room.width,
          depth: room.depth,
        })),
      ) &&
      JSON.stringify(afterMysteryReturn.corridors) === JSON.stringify(
        mystery.play.snapshot.corridors.map((corridor) => ({
          id: corridor.id,
          fromRoomId: corridor.fromRoomId,
          toRoomId: corridor.toRoomId,
          width: corridor.width,
          kind: corridor.kind ?? null,
          fromSide: corridor.fromSide ?? null,
          toSide: corridor.toSide ?? null,
        })),
      ) &&
      JSON.stringify(afterMysteryReturn.entities) === JSON.stringify(
        mystery.play.snapshot.entities.map((entity) => ({
          id: entity.id,
          type: entity.type,
          roomId: entity.roomId,
        })),
      ),
    roomListMarksStartAndGoal:
      roomOptionText.some((text) => /start/i.test(text)) &&
      roomOptionText.some((text) => /goal/i.test(text)),
    goalCheckIsTopLevelCard:
      sidebarHierarchy.goal.top < sidebarHierarchy.modes.top &&
      sidebarHierarchy.goal.bottom <= sidebarHierarchy.modes.top,
    ownerGoalUpwardMoveIsRenderable:
      goalBeforeOwnerUp?.x === 27 &&
      goalBeforeOwnerUp?.z === 4 &&
      goalAfterOwnerUp?.x === 27 &&
      goalAfterOwnerUp?.z === 3,
    roomSelectionAutoSwitchesInspector:
      goalInspectorAfterSelection === 'rooms' &&
      generatedGoalRoomInspectorTab === 'rooms',
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
    roomAddRemoveWorks:
      structuralAfterAddRoom.rooms.length === structuralBefore.rooms.length + 1 &&
      structuralAfterAddRoom.inspectorTab === 'rooms' &&
      structuralAfterCleanup.rooms.length === structuralBefore.rooms.length,
    noSelectionShowsCenteredRoomAdd:
      noSelectionRoomUi.selectedVisible === false &&
      noSelectionRoomUi.unselectedVisible === true,
    centeredRoomAddCreatesAndSelectsIsolatedRoom:
      centeredAddState.rooms.length === beforeCenteredAdd.rooms.length + 1 &&
      centeredAddState.selectedRoomId === centeredRoomId &&
      !centeredAddState.corridors.some((corridor) =>
        corridor.fromRoomId === centeredRoomId || corridor.toRoomId === centeredRoomId),
    unconnectedRoomCanBeDraggedFreely:
      Math.abs(centeredRoomAfterDrag.x - centeredRoomDragPlan.target.x) <= 0.25 &&
      Math.abs(centeredRoomAfterDrag.z - centeredRoomDragPlan.target.z) <= 0.25 &&
      afterCenteredRoomCleanup.rooms.length === structuralAfterCleanup.rooms.length,
    directCorridorDragPreviewMatchesFinalRouting:
      corridorDraftBeforeRelease?.state === 'ready' &&
      corridorDraftBeforeRelease?.targetRoomId === addedRoomId &&
      corridorDraftBeforeRelease?.targetSide == null &&
      corridorDraftBeforeRelease?.hasCommitCommand === true &&
      corridorDraftBeforeRelease?.commitCorridorId != null &&
      corridorDraftBeforeRelease?.routedFromSide === structuralSetup.side &&
      corridorDraftBeforeRelease?.routedToSide === structuralSetup.opposite,
    directCorridorDragAddRemoveWorks:
      structuralAfterAddCorridor.corridors.length === structuralBefore.corridors.length + 1 &&
      structuralAfterAddCorridor.inspectorTab === 'corridors' &&
      structuralAfterCleanup.corridors.length === structuralBefore.corridors.length,
    corridorSourceSideAndAutoTargetWork:
      structuralAfterSides.corridor?.fromSide === structuralSetup.side &&
      structuralAfterSides.corridor?.toSide == null &&
      structuralAfterSides.selectedCorridorId === addedCorridorId &&
      structuralAfterSides.selectionText.includes(addedCorridorId),
    corridorDraftReleaseWithoutRoomCancels:
      afterCancelledDraft === beforeCancelledDraft,
    generatedRoomSelectionDoesNotRecenterCamera:
      distance3(cameraBeforeGeneratedRoomSelection.position, cameraAfterGeneratedRoomSelection.position) < 0.01 &&
      distance3(cameraBeforeGeneratedRoomSelection.target, cameraAfterGeneratedRoomSelection.target) < 0.01,
    blockedRoomMoveShowsReason:
      afterBlockedTouchMove.room?.x === 8 &&
      afterBlockedTouchMove.noticeVisible === true &&
      /Blocked:/.test(afterBlockedTouchMove.notice),
    viewportNoticeUsesLowerCenterPlacement:
      afterBlockedTouchMove.noticeRect != null &&
      afterBlockedTouchMove.viewportRect != null &&
      Math.abs(
        (afterBlockedTouchMove.noticeRect.left + afterBlockedTouchMove.noticeRect.right) / 2 -
        (afterBlockedTouchMove.viewportRect.left + afterBlockedTouchMove.viewportRect.right) / 2
      ) <= 2 &&
      afterBlockedTouchMove.noticeRect.bottom <= afterBlockedTouchMove.viewportRect.bottom - 20 &&
      afterBlockedTouchMove.noticeRect.bottom >= afterBlockedTouchMove.viewportRect.bottom - 48 &&
      afterBlockedTouchMove.noticeRect.top > afterBlockedTouchMove.viewportRect.top +
        afterBlockedTouchMove.viewportRect.height * 0.55,
    editGoalCheckShowsReachableRoute:
      pathState?.reachable === true &&
      pathState?.routeVisible === true &&
      pathState.roomIds?.[0] === startRoomId &&
      pathState.roomIds?.at(-1) === goalRoomId &&
      pathText.includes('Reachable') &&
      pathText.includes('START') &&
      pathText.includes('GOAL'),
    rightEntityCardWallRemoved:
      rightEntityCardCount === 0,
    editLegendVisibleAndComplete:
      legendState.visible === true &&
      legendState.count === 6 &&
      ['start', 'goal', 'enemy', 'treasure', 'trap', 'recovery']
        .every((kind) => legendState.kinds.includes(kind)),
    editLegendPaletteSeparated:
      legendState.markerColors.start === 'rgb(34, 197, 94)' &&
      legendState.markerColors.goal === 'rgb(59, 130, 246)' &&
      legendState.markerColors.enemy === 'rgb(239, 68, 68)' &&
      legendState.markerColors.treasure === 'rgb(234, 179, 8)' &&
      legendState.markerColors.trap === 'rgb(139, 92, 246)' &&
      legendState.markerColors.recovery === 'rgb(248, 250, 252)',
    roomSelectionShowsCurrentRoomEntities:
      roomContentsBeforeEntityClick.overlayVisible === true &&
      roomContentsBeforeEntityClick.roomText.includes(startRoomId) &&
      roomContentsBeforeEntityClick.itemCount >= 1 &&
      roomContentsBeforeEntityClick.hasStart === true,
    editHudMatchesRequestedPlacement:
      editHudLayout.legend.left >= editHudLayout.viewport.left &&
      editHudLayout.legend.left <= editHudLayout.viewport.left + 32 &&
      editHudLayout.selection.left === editHudLayout.legend.left &&
      editHudLayout.legend.top < editHudLayout.selection.top &&
      editHudLayout.legend.bottom <= editHudLayout.selection.top &&
      Math.abs(editHudLayout.legend.width - editHudLayout.selection.width) < 1 &&
      editHudLayout.contents.right <= editHudLayout.viewport.right &&
      editHudLayout.contents.right >= editHudLayout.viewport.right - 32 &&
      editHudLayout.contents.left > editHudLayout.viewport.left + editHudLayout.viewport.width * 0.55,
    clicking3dEntitySelectsAndHighlights:
      selectedEntityState.state.selectedEntityId === startEntityId &&
      selectedEntityState.state.inspectorTab === 'entities' &&
      selectedEntityState.renderedSelection === startEntityId,
    entitySelectionMovesSummaryIntoViewport:
      selectedEntityState.selectionOverlayVisible === true &&
      selectedEntityState.selectionText.includes(startEntityId) &&
      selectedEntityState.containingRoomText.includes(startRoomId),
    entitySelectionShowsContainingRoom:
      selectedEntityState.roomListValue === startRoomId &&
      selectedEntityState.roomContentsVisible === true &&
      selectedEntityState.selectedRoomContentId === startEntityId,
    entityCreateControlsHaveBalancedVerticalRhythm:
      Number.isFinite(entityCreateSpacing.buttonToLabelGap) &&
      Number.isFinite(entityCreateSpacing.labelToSelectGap) &&
      Number.isFinite(entityCreateSpacing.selectToAddGap) &&
      entityCreateSpacing.buttonToLabelGap >= 14 &&
      entityCreateSpacing.labelToSelectGap >= 8 &&
      entityCreateSpacing.selectToAddGap >= 10 &&
      entityCreateSpacing.labelLineHeight >= 18,
    playKeyboardMovesOrReachesRoomEvent:
      playAfterKeyboard.play?.moves === playBeforeKeyboard.play.moves + 1 ||
      eventLayout.eventVisible === true,
    playReticleVisible: eventLayout.reticleVisible === true,
    playAndResultSummaryAreCentered:
      playResultCentering.modeBadgeJustify === 'center' &&
      playResultCentering.modeBadgeTextAlign === 'center' &&
      playResultCentering.playSummaryJustify === 'center' &&
      playResultCentering.playSummaryTextAlign === 'center' &&
      playResultCentering.playMetricsJustify === 'center' &&
      Number.isFinite(playResultCentering.groupCenter) &&
      Number.isFinite(playResultCentering.summaryCenter) &&
      Math.abs(playResultCentering.groupCenter - playResultCentering.summaryCenter) <= 2,
    modeLampDoesNotOverlapLabel:
      Number.isFinite(playResultCentering.modeLampTextGap) &&
      playResultCentering.modeLampTextGap >= 8,
    returnEditUsesSolidTriangle:
      playResultCentering.returnEditText.startsWith('◀'),
    roomEventStackCentered:
      eventLayout.eventVisible === false ||
      (Number.isFinite(eventLayout.eventCenterX) &&
       Number.isFinite(eventLayout.eventCenterY) &&
       Number.isFinite(eventLayout.viewportCenterX) &&
       Number.isFinite(eventLayout.viewportCenterY) &&
       Math.abs(eventLayout.eventCenterX - eventLayout.viewportCenterX) <= 3 &&
       Math.abs(eventLayout.eventCenterY - eventLayout.viewportCenterY) <= 3),
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
    languageSamples,
    englishRestored,
    sidebarHierarchy,
    uiScale,
    sidebarOverflow,
    falseChecks,
    cameraBefore,
    cameraAfterOrbit,
    cameraAfterPan,
    cameraAfterZoom,
    cameraAfterSelection,
    goalInspectorAfterSelection,
    goalBeforeOwnerUp,
    goalAfterOwnerUp,
    generatedGoalRoomInspectorTab,
    concealedGoalCheck,
    afterMysteryReturn,
    touchingRoomMiddle: touchingState.rooms.find((room) => room.id === 'room-middle'),
    touchingCorridorVisiblePoint,
    afterBlockedTouchMove,
    roomOptionText,
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
    structuralSetup,
    structuralBefore,
    structuralAfterAddRoom,
    corridorDraftBeforeRelease,
    structuralAfterAddCorridor,
    structuralAfterSides,
    beforeCancelledDraft,
    afterCancelledDraft,
    structuralAfterCleanup,
    noSelectionRoomUi,
    beforeCenteredAdd,
    centeredAddState,
    centeredRoomScreen,
    centeredRoomDragPlan,
    centeredRoomAfterDrag,
    afterCenteredRoomCleanup,
    pathState,
    pathText,
    rightEntityCardCount,
    legendState,
    roomContentsBeforeEntityClick,
    editHudLayout,
    selectedEntityId: selectedEntityState.state.selectedEntityId,
    renderedSelection: selectedEntityState.renderedSelection,
    selectedEntityRoomListValue: selectedEntityState.roomListValue,
    entityCreateSpacing,
    keyboardExit,
    playBeforeKeyboard,
    playAfterKeyboard,
    eventLayout,
    playResultCentering,
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
