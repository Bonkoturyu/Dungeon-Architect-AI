import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { confirmManualGeneration, normalRoomRequests, captureBrowserFailure } from './browser-smoke-support.mjs';

const chromePath =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_ATMOSPHERE_PORT || '4203');
const outputDir = path.resolve('artifacts/atmosphere');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (!fs.existsSync(viteBin)) throw new Error('Vite is not installed.');
fs.mkdirSync(outputDir, { recursive: true });

const tenseIntent = {
  ...DEFAULT_DESIGN_INTENT,
  tension: 0.95,
  exploration: 0.25,
  fairness: 0.45,
  deception: 0.8,
  telegraphStrength: 0.45,
  trapDensity: 0.85,
  targetDifficulty: 0.9,
  rewardDensity: 0.5,
  targetDuration: 420,
};

const readableIntent = {
  ...DEFAULT_DESIGN_INTENT,
  tension: 0.25,
  exploration: 0.95,
  fairness: 0.9,
  deception: 0.15,
  telegraphStrength: 0.95,
  trapDensity: 0.2,
  targetDifficulty: 0.35,
  rewardDensity: 0.55,
  targetDuration: 420,
};

const markerPalette = {
  start: 0x22c55e,
  goal: 0x3b82f6,
  enemy: 0xef4444,
  treasure: 0xeab308,
  trap: 0x8b5cf6,
  recovery: 0xf8fafc,
};

const vite = spawn(
  process.execPath,
  [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] },
);

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
  throw new Error(`atmosphere server did not become ready.\n${viteOutput}`);
}

async function atmosphere(page) {
  return page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.getAtmospherePresentation());
}

async function stateShape(page) {
  return page.evaluate(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return {
      mode: state.mode,
      rooms: state.rooms,
      corridors: state.corridors,
      entities: state.entities,
    };
  });
}

function sameMarkerPalette(actual) {
  return Object.entries(markerPalette).every(
    ([key, value]) => actual?.[key] === value,
  );
}

const url = `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
let browser;
let page;

try {
  await waitForServer(url);
  browser = await chromium.launch({
    executablePath: chromePath,
    headless: false,
  });
  page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({
    url: request.url(),
    failure: request.failure()?.errorText ?? 'unknown',
  }));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      httpErrors.push({ url: response.url(), status: response.status() });
    }
  });

  await page.route('**/api/design-intent', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        selectedProvider: 'cloud',
        intent: tenseIntent,
        roomRequests: normalRoomRequests(),
      }),
    });
  });

  await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: 60_000,
  });
  await page.waitForFunction(
    () =>
      window.__DAI_EDITOR_SLICE__?.ready === true &&
      window.__DAI_ONBOARDING__?.ready === true,
    null,
    { timeout: 60_000 },
  );
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());

  const initial = await atmosphere(page);

  await page.fill(
    '#generationPrompt',
    'Create a tense dungeon with dangerous traps and limited visibility.',
  );
  await page.click('#generateDungeon');
  await confirmManualGeneration(page);
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__.getState().generationBusy === false,
    null,
    { timeout: 30_000 },
  );

  const generatedEdit = await atmosphere(page);
  const beforeVariants = await stateShape(page);

  const tensePlay = await page.evaluate(
    (intent) =>
      window.__DAI_EDITOR_SLICE__.setAtmosphereForTest(intent, 'play'),
    tenseIntent,
  );
  const tenseActual = await atmosphere(page);

  const readablePlay = await page.evaluate(
    (intent) =>
      window.__DAI_EDITOR_SLICE__.setAtmosphereForTest(intent, 'play'),
    readableIntent,
  );
  const readableActual = await atmosphere(page);

  const tenseEdit = await page.evaluate(
    (intent) =>
      window.__DAI_EDITOR_SLICE__.setAtmosphereForTest(intent, 'edit'),
    tenseIntent,
  );
  const afterVariants = await stateShape(page);

  await page.click('#start');
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__.getState().mode === 'play',
  );
  const wiredPlay = await atmosphere(page);

  await page.screenshot({
    path: path.join(outputDir, 'atmosphere-play.png'),
    fullPage: true,
  });

  await page.click('#returnEdit');
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit',
  );
  const wiredEditAfterReturn = await atmosphere(page);

  const checks = {
    legacyPresentationPreservedWithoutIntent:
      initial.enabled === false &&
      initial.fog.enabled === false &&
      initial.actual.fog === null,
    generatedIntentEnablesAtmosphere:
      generatedEdit.enabled === true &&
      generatedEdit.mode === 'edit' &&
      generatedEdit.effectScale === 0.4 &&
      generatedEdit.actual.fog != null,
    tensePlayHasStrongerFog:
      tensePlay.fog.strength > readablePlay.fog.strength &&
      tensePlay.fog.far < readablePlay.fog.far,
    readablePlayUsesBrighterAmbient:
      readablePlay.ambient.intensity > tensePlay.ambient.intensity,
    editModeAttenuatesAtmosphere:
      tenseEdit.effectScale < tensePlay.effectScale &&
      tenseEdit.fog.far > tensePlay.fog.far &&
      tenseEdit.ambient.intensity > tensePlay.ambient.intensity,
    actualRendererMatchesProfiles:
      tenseActual.actual.backgroundColor === tensePlay.backgroundColor &&
      tenseActual.actual.fog?.far === tensePlay.fog.far &&
      readableActual.actual.backgroundColor === readablePlay.backgroundColor &&
      readableActual.actual.fog?.far === readablePlay.fog.far,
    semanticMarkerPaletteUnchanged:
      sameMarkerPalette(tenseActual.actual.markerColors) &&
      sameMarkerPalette(readableActual.actual.markerColors),
    atmosphereDoesNotMutateDungeonState:
      JSON.stringify(beforeVariants.rooms) === JSON.stringify(afterVariants.rooms) &&
      JSON.stringify(beforeVariants.corridors) === JSON.stringify(afterVariants.corridors) &&
      JSON.stringify(beforeVariants.entities) === JSON.stringify(afterVariants.entities),
    normalPlayWiringUsesFullIntentProfile:
      wiredPlay.enabled === true &&
      wiredPlay.mode === 'play' &&
      wiredPlay.effectScale === 1 &&
      wiredPlay.fog.strength === tensePlay.fog.strength &&
      wiredPlay.fog.far === tensePlay.fog.far,
    returnEditRestoresAttenuatedProfile:
      wiredEditAfterReturn.enabled === true &&
      wiredEditAfterReturn.mode === 'edit' &&
      wiredEditAfterReturn.effectScale === 0.4,
    readabilityBoundsRemainSafe:
      tensePlay.fog.near >= 26 &&
      tensePlay.fog.far >= tensePlay.fog.near + 60 &&
      tensePlay.ambient.intensity >= 1.08 &&
      tensePlay.sun.intensity >= 1.12 &&
      tensePlay.roomCurrentEmissiveIntensity >= 0.5,
    browserErrorsAbsent:
      consoleErrors.length === 0 &&
      pageErrors.length === 0 &&
      failedRequests.length === 0 &&
      httpErrors.length === 0,
  };

  const falseChecks = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([name]) => name);

  const evidence = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    browserVersion: browser.version(),
    passed: falseChecks.length === 0,
    checks,
    falseChecks,
    initial,
    generatedEdit,
    tensePlay,
    readablePlay,
    tenseEdit,
    wiredPlay,
    wiredEditAfterReturn,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(outputDir, 'atmosphere.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(
      `Atmosphere invariant failed: ${falseChecks.join(', ')}`,
    );
  }
} catch (error) {
  await captureBrowserFailure({ page, error, outputDir });
  throw error;
} finally {
  if (browser) await browser.close();
  vite.kill();
}
