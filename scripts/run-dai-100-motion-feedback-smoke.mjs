import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { confirmManualGeneration, normalRoomRequests, captureBrowserFailure } from './browser-smoke-support.mjs';

const chromePath =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_MOTION_FEEDBACK_PORT || '4199');
const outputDir = path.resolve('artifacts/motion-feedback');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const prompt =
  'Create a fair but tense 5-minute dungeon with exploration and a few dangerous rewards.';

if (!fs.existsSync(chromePath)) {
  throw new Error(`Chrome not found: ${chromePath}`);
}
if (!fs.existsSync(viteBin)) {
  throw new Error('Vite is not installed.');
}
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
    `motion/feedback server did not become ready.\n${viteOutput}`,
  );
}

function distance3(a, b) {
  return Math.hypot(
    (a?.x ?? 0) - (b?.x ?? 0),
    (a?.y ?? 0) - (b?.y ?? 0),
    (a?.z ?? 0) - (b?.z ?? 0),
  );
}

const url =
  `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
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
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) =>
    pageErrors.push(String(error)));
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      failure:
        request.failure()?.errorText ?? 'unknown',
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        selectedProvider: 'cloud',
        roomRequests: normalRoomRequests(),
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
    await page.evaluate(
      () => window.__DAI_ONBOARDING__.getState().open,
    )
  ) {
    await page.evaluate(
      () => window.__DAI_ONBOARDING__.close(),
    );
  }

  await page.fill('#generationPrompt', prompt);
  await page.click('#generateDungeon');
  await confirmManualGeneration(page);
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__.getState().generationBusy === false,
    null,
    { timeout: 30_000 },
  );
  const generatedOk = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.getState().lastGeneration !== null,
  );
  if (!generatedOk) {
    throw new Error('Generation failed during motion smoke.');
  }

  const generationTransition =
    await page.evaluate(() => {
      const shell =
        document.querySelector('.viewport-shell');
      const card =
        document.querySelector('.preview-cover-card');
      return {
        generationClass:
          shell?.classList.contains(
            'is-generation-reveal',
          ) ?? false,
        modeClass:
          shell?.classList.contains(
            'is-mode-transition',
          ) ?? false,
        coverVisible:
          document.querySelector(
            '#authoringPreviewCover',
          )?.hidden === false,
        cardAnimation:
          card
            ? getComputedStyle(card).animationName
            : '',
      };
    });

  await page.screenshot({
    path: path.join(
      outputDir,
      'generation-reveal.png',
    ),
    fullPage: true,
  });

  await page.waitForTimeout(700);
  await page.click('[data-workflow-tab="edit"]');
  await page.waitForFunction(
    () =>
      window.__DAI_EDITOR_SLICE__.getState()
        .workflowTab === 'edit',
  );

  const beforeSelection =
    await page.evaluate(() => ({
      camera:
        window.__DAI_EDITOR_SLICE__.getCameraState(),
      state:
        window.__DAI_EDITOR_SLICE__.getState(),
      shellClass:
        document.querySelector('.viewport-shell')
          ?.className ?? '',
    }));

  const roomId = beforeSelection.state.rooms[0]?.id;
  if (!roomId) {
    throw new Error('Generated dungeon has no room.');
  }

  const selected = await page.evaluate(
    (id) =>
      window.__DAI_EDITOR_SLICE__.selectRoom(id),
    roomId,
  );
  if (!selected) {
    throw new Error('Could not select room.');
  }

  const afterSelection =
    await page.evaluate(() => ({
      camera:
        window.__DAI_EDITOR_SLICE__.getCameraState(),
      shellClass:
        document.querySelector('.viewport-shell')
          ?.className ?? '',
    }));

  const started = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.startDungeon(),
  );
  if (!started) {
    throw new Error('Test run failed to start.');
  }

  const playTransition =
    await page.evaluate(() => ({
      state:
        window.__DAI_EDITOR_SLICE__.getState(),
      modeClass:
        document.querySelector('.viewport-shell')
          ?.classList.contains(
            'is-mode-transition',
          ) ?? false,
      canvasAnimation:
        getComputedStyle(
          document.querySelector('#renderCanvas'),
        ).animationName,
    }));

  await page.waitForTimeout(520);

  const returned = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.returnToEdit(),
  );
  if (!returned) {
    throw new Error('Return to Edit failed.');
  }

  const returnTransition =
    await page.evaluate(() => ({
      state:
        window.__DAI_EDITOR_SLICE__.getState(),
      modeClass:
        document.querySelector('.viewport-shell')
          ?.classList.contains(
            'is-mode-transition',
          ) ?? false,
      canvasAnimation:
        getComputedStyle(
          document.querySelector('#renderCanvas'),
        ).animationName,
    }));

  await page.screenshot({
    path: path.join(
      outputDir,
      'return-edit-transition.png',
    ),
    fullPage: true,
  });

  const checks = {
    generationRevealClassActive:
      generationTransition.generationClass === true &&
      generationTransition.modeClass === false,
    generationCoverRemainsConcealed:
      generationTransition.coverVisible === true,
    generationCardUsesRevealAnimation:
      generationTransition.cardAnimation.includes(
        'dai-generation-card-reveal',
      ),
    roomSelectionDoesNotTriggerTransition:
      !afterSelection.shellClass.includes(
        'is-generation-reveal',
      ) &&
      !afterSelection.shellClass.includes(
        'is-mode-transition',
      ),
    roomSelectionPreservesCamera:
      distance3(
        beforeSelection.camera.position,
        afterSelection.camera.position,
      ) < 0.05 &&
      distance3(
        beforeSelection.camera.target,
        afterSelection.camera.target,
      ) < 0.05,
    testStartUsesModeTransition:
      playTransition.state.mode === 'play' &&
      playTransition.modeClass === true &&
      playTransition.canvasAnimation.includes(
        'dai-camera-settle',
      ),
    returnEditUsesModeTransition:
      returnTransition.state.mode === 'edit' &&
      returnTransition.modeClass === true &&
      returnTransition.canvasAnimation.includes(
        'dai-camera-settle',
      ),
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
    generationTransition,
    beforeSelection: {
      camera: beforeSelection.camera,
      roomId,
    },
    afterSelection,
    playTransition,
    returnTransition,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(
      outputDir,
      'motion-feedback.json',
    ),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(
      `Motion / feedback invariant failed: ${falseChecks.join(', ')}`,
    );
  }
} catch (error) {
  await captureBrowserFailure({ page, error, outputDir });
  throw error;
} finally {
  if (browser) await browser.close();
  vite.kill();
}
