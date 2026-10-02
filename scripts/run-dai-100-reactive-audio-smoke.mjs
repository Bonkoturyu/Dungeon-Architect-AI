import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const chromePath =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_REACTIVE_AUDIO_PORT || '4205');
const outputDir = path.resolve('artifacts/dai-100-reactive-audio');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const url = `http://127.0.0.1:${port}/apps/editor-slice/index.html`;

if (!fs.existsSync(chromePath)) {
  throw new Error(`Chrome not found: ${chromePath}`);
}
if (!fs.existsSync(viteBin)) {
  throw new Error('Vite is not installed.');
}
fs.mkdirSync(outputDir, { recursive: true });

const vite = spawn(
  process.execPath,
  [
    viteBin,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let viteOutput = '';
vite.stdout.on('data', (chunk) => {
  viteOutput += chunk.toString();
});
vite.stderr.on('data', (chunk) => {
  viteOutput += chunk.toString();
});

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `Reactive audio browser server did not become ready.\n${viteOutput}`,
  );
}

async function state(page) {
  return page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
}

async function moveTo(page, roomId) {
  const moved = await page.evaluate(
    (target) => window.__DAI_EDITOR_SLICE__.movePlayToRoom(target),
    roomId,
  );
  if (!moved) throw new Error(`movePlayToRoom returned false for ${roomId}`);
  await page.waitForFunction(
    (target) => {
      const s = window.__DAI_EDITOR_SLICE__.getState();
      return s.mode === 'result' || s.play?.currentRoomId === target;
    },
    roomId,
    { timeout: 10_000 },
  );
  return state(page);
}

let browser;
try {
  await waitForServer();
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
  const externalAudioRequests = [];

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
  page.on('request', (request) => {
    if (/\.(?:wav|mp3|ogg|flac|m4a|aac)(?:\?|$)/i.test(request.url())) {
      externalAudioRequests.push(request.url());
    }
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

  const lockedEdit = await state(page);

  // Real gesture unlocks the existing Web Audio graph.
  await page.click('[data-workflow-tab="play"]');
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__.getState().audio?.unlocked === true,
    null,
    { timeout: 10_000 },
  );
  const unlockedEdit = await state(page);

  // Fix user-authored mixer values and ensure reactive intensity never rewrites them.
  await page.locator('#bgmVolume').evaluate((input) => {
    input.value = '34';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#seVolume').evaluate((input) => {
    input.value = '86';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const mixedEdit = await state(page);

  const started = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.startDungeon(),
  );
  if (!started) throw new Error('Built-in test dungeon did not start.');
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__.getState().mode === 'play',
  );
  const exploration = await state(page);

  const encounter = await moveTo(page, 'room-middle');

  const cleared = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.clearEnemy('enemy-1'),
  );
  if (!cleared) throw new Error('enemy-1 did not clear.');
  await page.waitForTimeout(40);
  const resolved = await state(page);

  // Treasure is optional and does not keep the danger layer elevated.
  const opened = await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.interactWithRoomEntity(
      'open-treasure',
      'treasure-1',
    ),
  );
  if (!opened) throw new Error('treasure-1 did not open.');
  const afterTreasure = await state(page);

  await moveTo(page, 'room-goal');
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__.getState().mode === 'result',
    null,
    { timeout: 10_000 },
  );
  const result = await state(page);

  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.returnToEdit());
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit',
  );
  const returned = await state(page);

  const audioElements = await page.locator(
    "audio, source[type^='audio/']",
  ).count();

  await page.screenshot({
    path: path.join(outputDir, 'reactive-audio.png'),
    fullPage: true,
  });

  const checks = {
    lockedEditHasLowReactiveProfile:
      lockedEdit.audio.unlocked === false &&
      lockedEdit.audio.reactiveIntensityVersion === '1' &&
      lockedEdit.audio.reactiveReason === 'edit' &&
      lockedEdit.audio.reactiveEnemyCount === 0 &&
      lockedEdit.audio.reactiveArmedTrapCount === 0,

    unlockPreservesEditProfile:
      unlockedEdit.audio.unlocked === true &&
      unlockedEdit.audio.activeMode === 'edit' &&
      unlockedEdit.audio.reactiveReason === 'edit',

    userMixIsIndependent:
      mixedEdit.audio.bgmVolume === 0.34 &&
      mixedEdit.audio.seVolume === 0.86,

    playStartsAtExplorationIntensity:
      exploration.mode === 'play' &&
      exploration.audio.activeMode === 'play' &&
      exploration.audio.reactiveReason === 'exploration' &&
      exploration.audio.reactiveEnemyCount === 0 &&
      exploration.audio.reactiveArmedTrapCount === 0,

    enemyRoomRaisesIntensity:
      encounter.play?.currentRoomId === 'room-middle' &&
      encounter.audio.reactiveReason === 'encounter' &&
      encounter.audio.reactiveEnemyCount >= 1 &&
      encounter.audio.reactiveIntensity >
        exploration.audio.reactiveIntensity &&
      encounter.audio.reactiveBgmMultiplier >
        exploration.audio.reactiveBgmMultiplier,

    eventResolutionReturnsToExploration:
      resolved.audio.reactiveEnemyCount === 0 &&
      resolved.audio.reactiveReason === 'exploration' &&
      resolved.audio.reactiveIntensity <
        encounter.audio.reactiveIntensity &&
      resolved.audio.reactiveBgmMultiplier <
        encounter.audio.reactiveBgmMultiplier,

    optionalTreasureDoesNotReenterDanger:
      afterTreasure.audio.reactiveReason === 'exploration' &&
      afterTreasure.audio.reactiveEnemyCount === 0 &&
      afterTreasure.audio.reactiveArmedTrapCount === 0,

    userMixRemainsUnchangedThroughDanger:
      encounter.audio.bgmVolume === 0.34 &&
      encounter.audio.seVolume === 0.86 &&
      resolved.audio.bgmVolume === 0.34 &&
      resolved.audio.seVolume === 0.86 &&
      result.audio.bgmVolume === 0.34 &&
      result.audio.seVolume === 0.86,

    reactiveMultipliersRemainBounded:
      [
        lockedEdit,
        exploration,
        encounter,
        resolved,
        result,
        returned,
      ].every(
        (entry) =>
          entry.audio.reactiveBgmMultiplier >= 0.82 &&
          entry.audio.reactiveBgmMultiplier <= 1.18 &&
          entry.audio.reactiveSeMultiplier >= 0.94 &&
          entry.audio.reactiveSeMultiplier <= 1.06,
      ),

    resultContinuityUsesResultProfile:
      result.mode === 'result' &&
      result.audio.activeMode === 'result-cleared' &&
      result.audio.reactiveReason === 'result-cleared' &&
      result.audio.reactiveIntensity <
        encounter.audio.reactiveIntensity,

    returnEditRestoresEditIntensity:
      returned.mode === 'edit' &&
      returned.audio.activeMode === 'edit' &&
      returned.audio.reactiveReason === 'edit',

    rampIsBoundedAndStable:
      encounter.audio.reactiveRampSeconds === 0.28 &&
      resolved.audio.reactiveRampSeconds === 0.28 &&
      result.audio.reactiveRampSeconds === 0.28,

    noExternalAudioAssets:
      audioElements === 0 &&
      externalAudioRequests.length === 0 &&
      result.audio.provenance ===
        'project-authored-programmatic-web-audio',

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
    lockedEdit: lockedEdit.audio,
    unlockedEdit: unlockedEdit.audio,
    mixedEdit: mixedEdit.audio,
    exploration: exploration.audio,
    encounter: encounter.audio,
    resolved: resolved.audio,
    afterTreasure: afterTreasure.audio,
    result: result.audio,
    returned: returned.audio,
    externalAudioRequests,
    audioElements,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(outputDir, 'reactive-audio.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(
      'Reactive audio invariant failed: ' +
        falseChecks.join(', '),
    );
  }
} finally {
  if (browser) await browser.close();
  vite.kill();
}
