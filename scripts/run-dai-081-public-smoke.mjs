import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const rawBaseUrl = String(process.env.DAI_PUBLIC_URL || '').trim();
const outputDir = path.resolve('artifacts/hosting-public');
const generationPrompt = 'Create a fair but tense 5-minute dungeon with exploration and a few dangerous rewards.';
const editPrompt = 'Move the treasure to the room that contains the goal.';

if (!rawBaseUrl) throw new Error('DAI_PUBLIC_URL is required for DAI-081 public deployment validation.');
if (!/^https:\/\//i.test(rawBaseUrl)) throw new Error('DAI_PUBLIC_URL must be an https:// URL.');
if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
fs.mkdirSync(outputDir, { recursive: true });

const baseUrl = rawBaseUrl.replace(/\/+$/, '');
async function resolveBlockingEvents(page) {
  let guard = 0;
  while (guard < 20) {
    guard += 1;
    const enemy = page.locator('.room-event.is-blocking [data-action="clear-enemy"]').first();
    if (await enemy.count()) {
      await enemy.click();
      await page.waitForTimeout(25);
      continue;
    }
    const trap = page.locator('.room-event.is-blocking [data-action="avoid-trap"]').first();
    if (await trap.count()) {
      await trap.click();
      await page.waitForTimeout(25);
      continue;
    }
    return;
  }
  throw new Error('Blocking room-event resolution exceeded guard.');
}

const editorUrl = `${baseUrl}/`;

function entityByType(state, type) {
  return state.entities.find((entity) => entity.type === type) ?? null;
}

let browser;
try {
  browser = await chromium.launch({ executablePath: chromePath, headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  const apiResponses = [];

  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => {
    if (response.url().includes('/api/design-intent') || response.url().includes('/api/natural-edit')) {
      apiResponses.push({
        path: new URL(response.url()).pathname,
        status: response.status(),
      });
    }
    if (response.status() >= 400) {
      httpErrors.push({ url: response.url(), status: response.status() });
    }
  });

  const navigationStarted = performance.now();
  await page.goto(editorUrl, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__?.ready === true && window.__DAI_ONBOARDING__?.ready === true,
    null,
    { timeout: 60_000 },
  );
  const navigationReadyMs = performance.now() - navigationStarted;

  const initial = await page.evaluate(() => ({
    editor: window.__DAI_EDITOR_SLICE__.getState(),
    onboarding: window.__DAI_ONBOARDING__.getState(),
    href: location.href,
  }));

  await page.evaluate(() => window.__DAI_ONBOARDING__.close());
  await page.waitForFunction(() => window.__DAI_ONBOARDING__.getState().open === false);

  await page.fill('#generationPrompt', generationPrompt);
  await page.click('#generateDungeon');
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.generationBusy === false && state.lastGeneration && state.rooms.length >= 5;
  }, null, { timeout: 120_000 });

  const generated = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const goal = entityByType(generated, 'goal');
  const treasure = entityByType(generated, 'treasure');
  if (!goal || !treasure) throw new Error('Generated spec is missing goal or treasure.');

  await page.fill('#naturalEditInput', editPrompt);
  await page.click('#applyNaturalEdit');
  await page.waitForFunction(({ treasureId, goalRoomId }) => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.naturalEditBusy === false &&
      state.entities.find((entity) => entity.id === treasureId)?.roomId === goalRoomId;
  }, { treasureId: treasure.id, goalRoomId: goal.roomId }, { timeout: 120_000 });

  const afterEdit = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.click('#start');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'play', null, { timeout: 30_000 });

  const orderedRooms = generated.rooms
    .map((room) => room.id)
    .filter((id) => /^room-\d+$/.test(id))
    .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));

  for (const roomId of orderedRooms.slice(1)) {
    await resolveBlockingEvents(page);
    const moved = await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.movePlayToRoom(id), roomId);
    if (!moved) throw new Error(`Play move blocked before ${roomId}`);
    const state = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
    if (state.result?.status === 'cleared') break;
  }

  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().result?.status === 'cleared', null, { timeout: 30_000 });
  const cleared = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.click('#returnEdit');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');
  const returned = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  const screenshotPath = path.join(outputDir, 'dai-081-public.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const api200 = Object.fromEntries(
    ['/api/design-intent', '/api/natural-edit'].map((apiPath) => [
      apiPath,
      apiResponses.some((entry) => entry.path === apiPath && entry.status === 200),
    ]),
  );

  const checks = {
    httpsDeployment: initial.href.startsWith('https://'),
    onboardingHasDescribe: initial.onboarding.stepCount === 5,
    initialEditorReady: initial.editor.startAllowed === true && initial.editor.validationCriticalCount === 0,
    liveGenerationUsedCloud: generated.lastGeneration?.selectedProvider === 'cloud',
    generatedDungeonValid: generated.startAllowed === true && generated.validationCriticalCount === 0,
    generatedRoomCountSupported: generated.rooms.length >= 5 && generated.rooms.length <= 20,
    generatedMvpEntitiesPresent: ['start', 'goal', 'enemy', 'treasure', 'trap'].every(
      (type) => generated.entities.some((entity) => entity.type === type),
    ),
    generatedWorkingLogicPresent: generated.lastGeneration?.eventCount >= 1,
    liveNaturalEditWorked:
      afterEdit.entities.find((entity) => entity.id === treasure.id)?.roomId === goal.roomId,
    bothApisReturned200: api200['/api/design-intent'] && api200['/api/natural-edit'],
    generatedDungeonCleared: cleared.result?.status === 'cleared' && cleared.play?.currentRoomId === goal.roomId,
    returnToEditPreservedGeneratedSpec:
      returned.mode === 'edit' &&
      returned.rooms.length === generated.rooms.length &&
      returned.startAllowed === true,
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
    chromePath,
    browserVersion: browser.version(),
    publicUrl: editorUrl,
    navigationReadyMs,
    passed,
    checks,
    generation: generated.lastGeneration,
    generatedRoomCount: generated.rooms.length,
    generatedEntityTypes: [...new Set(generated.entities.map((entity) => entity.type))].sort(),
    translatedCommand: afterEdit.lastNaturalEditCommand,
    result: cleared.result,
    apiResponses,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
    safety: {
      localApiKeyRequired: false,
      fullGenerationPromptStoredInEvidence: false,
      fullEditPromptStoredInEvidence: false,
    },
  };

  const serialized = JSON.stringify(evidence, null, 2);
  if (serialized.includes(generationPrompt) || serialized.includes(editPrompt)) {
    throw new Error('DAI-081 public evidence unexpectedly contains full prompt text.');
  }

  const evidencePath = path.join(outputDir, 'dai-081-public.json');
  fs.writeFileSync(evidencePath, `${serialized}\n`);
  console.log(serialized);

  if (!passed) {
    throw new Error(`DAI-081 public deployment invariant failed: ${JSON.stringify(checks)}`);
  }
} finally {
  if (browser) await browser.close();
}
