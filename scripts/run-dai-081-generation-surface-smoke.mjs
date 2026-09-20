import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_GENERATION_SURFACE_PORT || '4187');
const outputDir = path.resolve('artifacts/generation-surface');
const distDir = path.resolve('dist');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const prompt = 'Create a fair but tense 5-minute dungeon with exploration and a few dangerous rewards.';

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (!fs.existsSync(viteBin)) throw new Error('Vite is not installed.');
if (!fs.existsSync(path.join(distDir, 'index.html'))) throw new Error('dist/index.html missing. Run npm run build:hosting first.');
fs.mkdirSync(outputDir, { recursive: true });

const vite = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
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
  throw new Error(`generation preview server did not become ready.\n${viteOutput}`);
}

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

const url = `http://127.0.0.1:${port}/`;
let browser;
try {
  await waitForServer(url);
  browser = await chromium.launch({ executablePath: chromePath, headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  const designIntentRequests = [];
  const naturalEditRequests = [];

  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }); });

  await page.route('**/api/design-intent', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    designIntentRequests.push({ keys: Object.keys(body).sort(), promptMatches: body.prompt === prompt });
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
          exploration: 0.78,
          greedPunishment: 0.7,
          routeChoice: 0.6,
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

  await page.route('**/api/natural-edit', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    naturalEditRequests.push({
      keys: Object.keys(body).sort(),
      roomCount: body.context?.rooms?.length ?? null,
      entityCount: body.context?.entities?.length ?? null,
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        command: { type: 'move-entity', entityId: 'treasure-1', roomId: 'room-005' },
        meta: { provider: 'openai', model: 'test-model', usage: null },
      }),
    });
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready === true && window.__DAI_ONBOARDING__?.ready === true, null, { timeout: 60_000 });

  const onboardingStart = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());
  const onboardingOrder = [onboardingStart.step.id];
  for (let i = 0; i < 4; i += 1) {
    const state = await page.evaluate(() => window.__DAI_ONBOARDING__.next());
    if (state.open) onboardingOrder.push(state.step.id);
  }
  if ((await page.evaluate(() => window.__DAI_ONBOARDING__.getState().open)) === true) {
    await page.evaluate(() => window.__DAI_ONBOARDING__.close());
  }

  await page.fill('#generationPrompt', prompt);
  await page.click('#generateDungeon');
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.generationBusy === false && state.lastGeneration?.roomCount === 5;
  }, null, { timeout: 30_000 });

  const generated = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  await page.screenshot({ path: path.join(outputDir, 'dai-081-generation-surface.png'), fullPage: true });

  await page.click('[data-workflow-tab="edit"]');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().workflowTab === 'edit');

  await page.fill('#naturalEditInput', 'Move the treasure to the room that contains the goal.');
  await page.click('#applyNaturalEdit');
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.naturalEditBusy === false &&
      state.entities.find((entity) => entity.id === 'treasure-1')?.roomId === 'room-005';
  });
  const afterEdit = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.click('[data-workflow-tab="play"]');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().workflowTab === 'play');

  await page.click('#start');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'play');
  for (const roomId of ['room-002', 'room-003', 'room-004', 'room-005']) {
    await resolveBlockingEvents(page);
    const moved = await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.movePlayToRoom(id), roomId);
    if (!moved) throw new Error(`Play move blocked before ${roomId}`);
  }
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().result?.status === 'cleared');
  const result = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.click('#returnEdit');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');
  const returned = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  const types = new Set(generated.entities.map((entity) => entity.type));
  const checks = {
    onboardingIncludesDescribe: onboardingOrder.join(',') === 'welcome,describe,edit,validate,play',
    designIntentRequestSentOnce: designIntentRequests.length === 1 && designIntentRequests[0].promptMatches,
    generatedFiveRooms: generated.rooms.length === 5 && generated.lastGeneration?.roomCount === 5,
    generationProviderRecorded: generated.lastGeneration?.selectedProvider === 'cloud',
    generatedStartEligible: generated.startAllowed === true && generated.validationCriticalCount === 0,
    generatedMvpEntitiesPresent: ['start', 'goal', 'enemy', 'treasure', 'trap'].every((type) => types.has(type)),
    generatedWorkingLogicPresent: generated.lastGeneration?.eventCount >= 1,
    naturalEditStillWorks: afterEdit.entities.find((entity) => entity.id === 'treasure-1')?.roomId === 'room-005',
    naturalEditContextUsesGeneratedSpec: naturalEditRequests.length === 1 && naturalEditRequests[0].roomCount === 5,
    generatedDungeonPlayableToGoal: result.result?.status === 'cleared' && result.play?.currentRoomId === 'room-005',
    returnToEditPreservesGeneratedSpec: returned.mode === 'edit' && returned.rooms.length === 5 && returned.startAllowed === true,
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
    url,
    passed,
    checks,
    onboardingOrder,
    generation: generated.lastGeneration,
    generatedEntityTypes: [...types].sort(),
    designIntentRequests,
    naturalEditRequests,
    result: result.result,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
    safety: {
      fullGenerationPromptStoredInEvidence: false,
      providerSecretRequiredLocally: false,
    },
  };

  const serialized = JSON.stringify(evidence, null, 2);
  if (serialized.includes(prompt)) throw new Error('generation evidence unexpectedly contains full prompt');
  fs.writeFileSync(path.join(outputDir, 'dai-081-generation-surface.json'), serialized + '\n');
  console.log(serialized);
  if (!passed) throw new Error(`DAI-081 generation-surface invariant failed: ${JSON.stringify(checks)}`);
} finally {
  if (browser) await browser.close();
  vite.kill();
}
