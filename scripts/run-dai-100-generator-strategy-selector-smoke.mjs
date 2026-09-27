import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import {
  GENERATOR_STRATEGY_V1_CLASSIC_ID,
  GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
  GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
  GENERATOR_STRATEGY_BSP_LAB_ID,
} from '../packages/generator/src/strategy-catalog.js';

const chromePath =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_GENERATOR_STRATEGY_PORT || '4196');
const outputDir = path.resolve('artifacts/generator-strategy-selector');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const prompt =
  'Create a fair but tense 5-minute dungeon with exploration and a few dangerous rewards.';

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (!fs.existsSync(viteBin)) throw new Error('Vite is not installed.');
fs.mkdirSync(outputDir, { recursive: true });

const vite = spawn(
  process.execPath,
  [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  },
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
  throw new Error(
    `generator strategy server did not become ready.\n${viteOutput}`,
  );
}

function layoutSignature(state) {
  return JSON.stringify(
    state.rooms.map(({ x, z, width, depth }) => ({
      x,
      z,
      width,
      depth,
    })),
  );
}

const url = `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
let browser;

try {
  await waitForServer(url);
  browser = await chromium.launch({
    executablePath: chromePath,
    headless: false,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  const designIntentRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      failure: request.failure()?.errorText ?? 'unknown',
    });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      httpErrors.push({
        url: response.url(),
        status: response.status(),
      });
    }
  });

  await page.route('**/api/design-intent', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    designIntentRequests.push({
      keys: Object.keys(body).sort(),
      promptMatches: body.prompt === prompt,
    });
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

  if (
    (await page.evaluate(
      () => window.__DAI_ONBOARDING__.getState().open,
    )) === true
  ) {
    await page.evaluate(() => window.__DAI_ONBOARDING__.close());
  }

  const initial = await page.evaluate(() => {
    const selector = document.querySelector('#generatorStrategy');
    const rect = selector?.getBoundingClientRect() ?? null;
    return {
      state: window.__DAI_EDITOR_SLICE__.getState(),
      strategies: window.__DAI_EDITOR_SLICE__.getGeneratorStrategies(),
      selectedValue: selector?.value ?? null,
      optionValues: [
        ...document.querySelectorAll('#generatorStrategy option'),
      ].map((option) => option.value),
      selectorVisible:
        Boolean(selector) &&
        rect !== null &&
        rect.width > 0 &&
        rect.height > 0 &&
        getComputedStyle(selector).visibility !== 'hidden' &&
        getComputedStyle(selector).display !== 'none',
    };
  });

  await page.fill('#generationPrompt', prompt);

  const selectedClassic = await page.evaluate(
    (id) => window.__DAI_EDITOR_SLICE__.setGeneratorStrategy(id),
    GENERATOR_STRATEGY_V1_CLASSIC_ID,
  );
  if (!selectedClassic) throw new Error('Could not select Version 1 Classic.');
  await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.generateDungeonFromPrompt(),
  );
  const classic = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.getState(),
  );

  const selectedRecommended = await page.evaluate(
    (id) => window.__DAI_EDITOR_SLICE__.setGeneratorStrategy(id),
    GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
  );
  if (!selectedRecommended) {
    throw new Error('Could not select Version 2 Recommended.');
  }
  await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.generateDungeonFromPrompt(),
  );
  const recommended = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.getState(),
  );

  const selectedDelaunay = await page.evaluate(
    (id) => window.__DAI_EDITOR_SLICE__.setGeneratorStrategy(id),
    GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
  );
  if (!selectedDelaunay) {
    throw new Error('Could not select Algorithm Lab Delaunay + MST + Loops.');
  }
  await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.generateDungeonFromPrompt(),
  );
  const delaunay = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.getState(),
  );

  const selectedBsp = await page.evaluate(
    (id) => window.__DAI_EDITOR_SLICE__.setGeneratorStrategy(id),
    GENERATOR_STRATEGY_BSP_LAB_ID,
  );
  if (!selectedBsp) {
    throw new Error('Could not select Algorithm Lab BSP.');
  }
  await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.generateDungeonFromPrompt(),
  );
  const bsp = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.getState(),
  );

  await page.screenshot({
    path: path.join(outputDir, 'generator-strategy-selector.png'),
    fullPage: true,
  });

  const classicLayout = layoutSignature(classic);
  const recommendedLayout = layoutSignature(recommended);
  const delaunayLayout = layoutSignature(delaunay);
  const bspLayout = layoutSignature(bsp);

  const checks = {
    strategySelectorVisible: initial.selectorVisible === true,
    registryListsAllAcceptedStrategies:
      initial.strategies.some(
        (entry) => entry.id === GENERATOR_STRATEGY_V1_CLASSIC_ID,
      ) &&
      initial.strategies.some(
        (entry) => entry.id === GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
      ) &&
      initial.strategies.some(
        (entry) => entry.id === GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
      ) &&
      initial.strategies.some(
        (entry) => entry.id === GENERATOR_STRATEGY_BSP_LAB_ID,
      ),
    selectorListsAllAcceptedStrategies:
      initial.optionValues.includes(GENERATOR_STRATEGY_V1_CLASSIC_ID) &&
      initial.optionValues.includes(GENERATOR_STRATEGY_V2_RECOMMENDED_ID) &&
      initial.optionValues.includes(GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID) &&
      initial.optionValues.includes(GENERATOR_STRATEGY_BSP_LAB_ID),
    recommendedSelectedByDefault:
      initial.selectedValue === GENERATOR_STRATEGY_V2_RECOMMENDED_ID &&
      initial.state.generatorStrategyId ===
        GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
    classicSelectionGeneratesV1:
      classic.lastGeneration?.generatorVersion === '1' &&
      classic.lastGeneration?.generatorStrategyId ===
        GENERATOR_STRATEGY_V1_CLASSIC_ID,
    recommendedSelectionGeneratesV2:
      recommended.lastGeneration?.generatorVersion === '2' &&
      recommended.lastGeneration?.generatorStrategyId ===
        GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
    delaunaySelectionUsesAlgorithmLabStrategy:
      delaunay.lastGeneration?.generatorVersion === null &&
      delaunay.lastGeneration?.generatorStrategyId ===
        GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID &&
      delaunay.lastGeneration?.algorithmVersion === '1',
    bspSelectionUsesAlgorithmLabStrategy:
      bsp.lastGeneration?.generatorVersion === null &&
      bsp.lastGeneration?.generatorStrategyId ===
        GENERATOR_STRATEGY_BSP_LAB_ID &&
      bsp.lastGeneration?.algorithmVersion === '1',
    samePromptKeepsSameSeedAcrossStrategies:
      classic.lastGeneration?.seed === recommended.lastGeneration?.seed &&
      recommended.lastGeneration?.seed === delaunay.lastGeneration?.seed &&
      delaunay.lastGeneration?.seed === bsp.lastGeneration?.seed,
    strategyLayoutsAreDistinct:
      new Set([
        classicLayout,
        recommendedLayout,
        delaunayLayout,
        bspLayout,
      ]).size === 4,
    allOutputsRemainStartEligible:
      classic.startAllowed === true &&
      recommended.startAllowed === true &&
      delaunay.startAllowed === true &&
      bsp.startAllowed === true,
    designIntentRequestedFourTimes:
      designIntentRequests.length === 4 &&
      designIntentRequests.every((entry) => entry.promptMatches),
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
    initial: {
      selectedValue: initial.selectedValue,
      strategies: initial.strategies,
      optionValues: initial.optionValues,
      selectorVisible: initial.selectorVisible,
    },
    classic: {
      generatorVersion: classic.lastGeneration?.generatorVersion ?? null,
      generatorStrategyId:
        classic.lastGeneration?.generatorStrategyId ?? null,
      algorithmVersion:
        classic.lastGeneration?.algorithmVersion ?? null,
      seed: classic.lastGeneration?.seed ?? null,
      roomCount: classic.rooms.length,
      layoutSignature: classicLayout,
    },
    recommended: {
      generatorVersion:
        recommended.lastGeneration?.generatorVersion ?? null,
      generatorStrategyId:
        recommended.lastGeneration?.generatorStrategyId ?? null,
      algorithmVersion:
        recommended.lastGeneration?.algorithmVersion ?? null,
      seed: recommended.lastGeneration?.seed ?? null,
      roomCount: recommended.rooms.length,
      layoutSignature: recommendedLayout,
    },
    delaunay: {
      generatorVersion:
        delaunay.lastGeneration?.generatorVersion ?? null,
      generatorStrategyId:
        delaunay.lastGeneration?.generatorStrategyId ?? null,
      algorithmVersion:
        delaunay.lastGeneration?.algorithmVersion ?? null,
      seed: delaunay.lastGeneration?.seed ?? null,
      roomCount: delaunay.rooms.length,
      corridorCount: delaunay.corridors.length,
      layoutSignature: delaunayLayout,
    },
    bsp: {
      generatorVersion:
        bsp.lastGeneration?.generatorVersion ?? null,
      generatorStrategyId:
        bsp.lastGeneration?.generatorStrategyId ?? null,
      algorithmVersion:
        bsp.lastGeneration?.algorithmVersion ?? null,
      seed: bsp.lastGeneration?.seed ?? null,
      roomCount: bsp.rooms.length,
      corridorCount: bsp.corridors.length,
      layoutSignature: bspLayout,
    },
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(outputDir, 'generator-strategy-selector.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(
      `Generator strategy selector invariant failed: ${falseChecks.join(', ')}`,
    );
  }
} finally {
  if (browser) await browser.close();
  vite.kill();
}
