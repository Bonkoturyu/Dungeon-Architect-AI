import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = String(process.env.DAI_PUBLIC_URL || 'https://dungeon-architect-ai.pages.dev/').replace(/\/+$/, '') + '/';
const outputDir = path.resolve('artifacts/video');
const generationPrompt = 'Create a fair but tense 5-minute dungeon with exploration and a few dangerous rewards.';
const editPrompt = 'Move the treasure to the room that contains the goal.';
const auto = process.env.DAI_RECORDING_AUTOCLOSE === '1';

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
fs.mkdirSync(outputDir, { recursive: true });

const rl = readline.createInterface({ input, output });
const marks = [];
const startedAt = performance.now();

function elapsedMs() {
  return Math.round(performance.now() - startedAt);
}

function mark(stage, extra = {}) {
  const entry = { stage, elapsedMs: elapsedMs(), ...extra };
  marks.push(entry);
  console.log(`[${String(Math.floor(entry.elapsedMs / 1000)).padStart(3, ' ')}s] ${stage}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickSpec(page, specId) {
  const point = await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId(id), specId);
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error(`${specId} screen position unavailable: ${JSON.stringify(point)}`);
  }
  await page.mouse.move(point.x, point.y, { steps: 16 });
  await wait(350);
  await page.mouse.click(point.x, point.y);
}

async function gate(page) {
  return page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
}

let browser;
try {
  browser = await chromium.launch({
    executablePath: chromePath,
    headless: false,
    args: ['--start-maximized'],
  });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }); });

  await page.goto('about:blank');
  console.log('');
  console.log('DAI-082 recording runner ready.');
  console.log('Frame the Chrome window, start OBS / Windows recording, then begin.');
  if (!auto) await rl.question('Press Enter to begin the scripted demo... ');
  mark('recording-begin');

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready === true && window.__DAI_ONBOARDING__?.ready === true, null, { timeout: 60_000 });
  mark('live-demo-ready');
  await wait(3500);

  await page.evaluate(() => window.__DAI_ONBOARDING__.close());
  mark('guide-closed');
  await wait(1200);

  const generationInput = page.locator('#generationPrompt');
  await generationInput.click();
  await generationInput.pressSequentially(generationPrompt, { delay: 18 });
  mark('generation-prompt-entered');
  await wait(1800);

  await page.click('#generateDungeon');
  mark('generate-clicked');
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.generationBusy === false && state.lastGeneration && state.rooms.length >= 5;
  }, null, { timeout: 120_000 });
  const generated = await gate(page);
  mark('dungeon-generated', {
    roomCount: generated.rooms.length,
    entityCount: generated.entities.length,
    provider: generated.lastGeneration?.selectedProvider ?? null,
  });
  await wait(5000);

  const middleRoomId = generated.rooms[Math.floor(generated.rooms.length / 2)]?.id;
  if (middleRoomId) {
    await clickSpec(page, middleRoomId);
    mark('manual-room-selected', { roomId: middleRoomId });
    await wait(1200);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    mark('manual-room-moved');
    await wait(2500);
    await page.keyboard.press('Control+Z');
    mark('manual-edit-undone');
    await wait(1800);
  }

  const editInput = page.locator('#naturalEditInput');
  await editInput.click();
  await editInput.pressSequentially(editPrompt, { delay: 18 });
  mark('natural-edit-prompt-entered');
  await wait(1600);

  await page.click('#applyNaturalEdit');
  mark('natural-edit-clicked');
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    const goal = state.entities.find((entity) => entity.type === 'goal');
    const treasure = state.entities.find((entity) => entity.type === 'treasure');
    return state.naturalEditBusy === false && goal && treasure && treasure.roomId === goal.roomId;
  }, null, { timeout: 120_000 });
  mark('natural-edit-applied');
  await wait(3500);

  await page.click('#start');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'play', null, { timeout: 30_000 });
  mark('play-started');
  await wait(2200);

  const playState = await gate(page);
  const goalRoomId = playState.play?.goalRoomId;
  const orderedRooms = playState.rooms
    .map((room) => room.id)
    .filter((id) => /^room-\d+$/.test(id))
    .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));

  for (const roomId of orderedRooms.slice(1)) {
    await clickSpec(page, roomId);
    await wait(1300);
    const state = await gate(page);
    if (state.result?.status === 'cleared') break;
  }

  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().result?.status === 'cleared', null, { timeout: 30_000 });
  const cleared = await gate(page);
  mark('goal-cleared', {
    moves: cleared.result?.moves ?? null,
    goalRoomId,
  });
  await wait(5000);

  await page.click('#returnEdit');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');
  mark('returned-to-edit');
  await wait(4000);

  const screenshotPath = path.join(outputDir, 'dai-082-recording-end.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const finished = await gate(page);
  const demoDurationMs = elapsedMs();
  const checks = {
    publicHttps: baseUrl.startsWith('https://'),
    liveGenerationUsedCloud: generated.lastGeneration?.selectedProvider === 'cloud',
    generatedDungeonValid: generated.startAllowed === true && generated.validationCriticalCount === 0,
    naturalEditApplied: finished.lastNaturalEditCommand?.type === 'move-entity',
    resultCleared: cleared.result?.status === 'cleared',
    returnedToEdit: finished.mode === 'edit',
    browserErrorsAbsent:
      consoleErrors.length === 0 &&
      pageErrors.length === 0 &&
      failedRequests.length === 0 &&
      httpErrors.length === 0,
    scriptedDemoUnder165Seconds: demoDurationMs < 165_000,
  };

  const evidence = {
    generatedAt: new Date().toISOString(),
    publicUrl: baseUrl,
    chromePath,
    browserVersion: browser.version(),
    passed: Object.values(checks).every(Boolean),
    scriptedDemoDurationMs: demoDurationMs,
    scriptedDemoDurationSeconds: Math.round(demoDurationMs / 100) / 10,
    checks,
    generation: generated.lastGeneration,
    result: cleared.result,
    marks,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
    recordingBoundary: {
      actualVideoFileValidated: false,
      targetFinalVideoSeconds: 150,
      hardSubmissionLimitSeconds: 180,
    },
  };

  fs.writeFileSync(
    path.join(outputDir, 'dai-082-recording-run.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );

  console.log('');
  console.log(`Scripted demo complete in ${evidence.scriptedDemoDurationSeconds}s.`);
  console.log('Stop the screen recording now.');
  console.log('Then upload the recorded video so its real duration and contents can be checked.');
  if (!auto) await rl.question('Press Enter to close Chrome... ');

  if (!evidence.passed) {
    throw new Error(`DAI-082 recording run failed: ${JSON.stringify(checks)}`);
  }
} finally {
  rl.close();
  if (browser) await browser.close();
}
