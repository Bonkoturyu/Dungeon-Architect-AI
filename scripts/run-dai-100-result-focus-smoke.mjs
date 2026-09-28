import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';

const chromePath =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_RESULT_FOCUS_PORT || '4202');
const outputDir = path.resolve('artifacts/result-focus');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const prompt =
  'Create a tense two-floor dungeon with enemies, traps, rewards, and readable warnings.';

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (!fs.existsSync(viteBin)) throw new Error('Vite is not installed.');
fs.mkdirSync(outputDir, { recursive: true });

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
  throw new Error(`result-focus server did not become ready.\n${viteOutput}`);
}

function intentPayload() {
  return {
    ...DEFAULT_DESIGN_INTENT,
    fairness: 0.78,
    tension: 0.82,
    exploration: 0.76,
    greedPunishment: 0.7,
    routeChoice: 0.64,
    learnability: 0.8,
    combatDensity: 0.78,
    trapDensity: 0.72,
    rewardDensity: 0.72,
    deception: 0.5,
    telegraphStrength: 0.82,
    backtracking: 0.38,
    targetDifficulty: 0.68,
    targetDuration: 420,
  };
}

function adjacency(snapshot) {
  const map = new Map(snapshot.rooms.map((room) => [room.id, []]));
  for (const corridor of snapshot.corridors) {
    map.get(corridor.fromRoomId)?.push(corridor.toRoomId);
    map.get(corridor.toRoomId)?.push(corridor.fromRoomId);
  }
  return map;
}

function shortestPath(snapshot, startRoomId, targetRoomIds) {
  const targets = new Set(targetRoomIds);
  const graph = adjacency(snapshot);
  const queue = [startRoomId];
  const previous = new Map([[startRoomId, null]]);
  let found = targets.has(startRoomId) ? startRoomId : null;

  while (!found && queue.length) {
    const current = queue.shift();
    for (const next of graph.get(current) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, current);
      if (targets.has(next)) {
        found = next;
        break;
      }
      queue.push(next);
    }
  }

  if (!found) return [];
  const route = [];
  for (let current = found; current != null; current = previous.get(current)) {
    route.push(current);
  }
  return route.reverse();
}

async function state(page) {
  return page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
}

async function presentation(page) {
  return page.evaluate(() => {
    const api = window.__DAI_EDITOR_SLICE__;
    const camera = api.getCameraState();
    const room = api.getCurrentRoomPlan();
    const floor = room?.boxes?.find((box) => box.part === 'floor') ?? null;
    const shell = document.querySelector('.viewport-shell');
    const resultStatus = document.querySelector('#resultStatus');
    const resultMetrics = document.querySelector('#resultMetrics');
    return {
      camera,
      roomId: room?.specId ?? null,
      roomFloorCenter: floor
        ? { x: floor.position.x, z: floor.position.z }
        : null,
      viewportClassName: shell?.className ?? '',
      resultStatus: {
        hidden: resultStatus?.hidden ?? true,
        className: resultStatus?.className ?? '',
        text: resultStatus?.textContent ?? '',
      },
      resultMetrics: {
        hidden: resultMetrics?.hidden ?? true,
        className: resultMetrics?.className ?? '',
        text: resultMetrics?.textContent ?? '',
      },
    };
  });
}

async function resolveBlockingEvents(page) {
  for (let guard = 0; guard < 24; guard += 1) {
    const enemy = page.locator(
      '.room-event.is-blocking [data-action="clear-enemy"]',
    ).first();
    if (await enemy.count()) {
      await enemy.click();
      await page.waitForTimeout(40);
      continue;
    }

    const trap = page.locator(
      '.room-event.is-blocking [data-action="avoid-trap"]',
    ).first();
    if (await trap.count()) {
      await trap.click();
      await page.waitForTimeout(40);
      continue;
    }
    return;
  }
  throw new Error('Blocking room-event resolution exceeded guard.');
}

async function moveTo(page, targetRoomId) {
  await resolveBlockingEvents(page);
  const before = await state(page);
  const corridorId = before.play?.map?.currentExits?.find(
    (exit) => exit.targetRoomId === targetRoomId,
  )?.corridorId ?? null;
  if (!corridorId) throw new Error(`No visible exit to ${targetRoomId}`);

  const beforeFloorIndex = before.currentFloorIndex;
  const beforeMoves = before.play?.moves ?? 0;
  await page.locator(
    `#playExitButtons .exit-button[data-corridor-id="${corridorId}"]`,
  ).click();

  await page.waitForFunction(
    ({ floorIndex, moves, roomId }) => {
      const s = window.__DAI_EDITOR_SLICE__.getState();
      if (s.mode !== 'play') return true;
      if (s.currentFloorIndex !== floorIndex) return true;
      return s.play?.currentRoomId === roomId && (s.play?.moves ?? -1) === moves + 1;
    },
    {
      floorIndex: beforeFloorIndex,
      moves: beforeMoves,
      roomId: targetRoomId,
    },
    { timeout: 7_000 },
  );

  return {
    beforeFloorIndex,
    after: await state(page),
  };
}

async function moveAlong(page, route) {
  for (const roomId of route.slice(1)) {
    const moved = await moveTo(page, roomId);
    if (
      moved.after.mode !== 'play' ||
      moved.after.currentFloorIndex !== moved.beforeFloorIndex
    ) {
      return;
    }
  }
}

async function finishFloor(page) {
  const before = await state(page);
  const floorIndex = before.currentFloorIndex;
  const route = shortestPath(
    before.play.snapshot,
    before.play.currentRoomId,
    [before.play.goalRoomId],
  );
  if (route.length === 0) throw new Error('No route to Goal.');
  await moveAlong(page, route);

  const after = await state(page);
  if (after.mode === 'play' && after.currentFloorIndex === floorIndex) {
    await resolveBlockingEvents(page);
  }
}

function cameraTargetsRoom(info) {
  return Boolean(
    info?.roomFloorCenter &&
    Number.isFinite(info.camera?.target?.x) &&
    Number.isFinite(info.camera?.target?.z) &&
    Math.abs(info.camera.target.x - info.roomFloorCenter.x) <= 0.01 &&
    Math.abs(info.camera.target.z - info.roomFloorCenter.z) <= 0.01
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
        intent: intentPayload(),
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

  await page.fill('#generationPrompt', prompt);
  await page.fill('#floorCount', '2');
  await page.click('#generateDungeon');
  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.generationBusy === false && s.floorCount === 2;
  }, null, { timeout: 30_000 });

  await page.click('#start');
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__.getState().mode === 'play',
  );

  let current = await state(page);
  const firstSnapshot = current.play.snapshot;
  const blockerRooms = [...new Set(
    firstSnapshot.entities
      .filter((entity) => entity.type === 'enemy' || entity.type === 'trap')
      .map((entity) => entity.roomId),
  )];
  if (blockerRooms.length === 0) {
    throw new Error('Generated first Floor has no blocking-event room.');
  }

  const blockerRoute = shortestPath(
    firstSnapshot,
    current.play.currentRoomId,
    blockerRooms,
  );
  await moveAlong(page, blockerRoute);
  await page.waitForSelector('.viewport-shell.is-event-focus', {
    timeout: 1_000,
  });
  const eventFocus = await presentation(page);

  await resolveBlockingEvents(page);
  await finishFloor(page);
  await page.waitForFunction(
    () => {
      const s = window.__DAI_EDITOR_SLICE__.getState();
      return s.mode === 'play' && s.currentFloorIndex === 1;
    },
    null,
    { timeout: 10_000 },
  );
  await page.waitForSelector('.viewport-shell.is-floor-transition', {
    timeout: 1_000,
  });
  const floorTransition = await presentation(page);

  current = await state(page);
  await finishFloor(page);
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__.getState().mode === 'result',
    null,
    { timeout: 10_000 },
  );
  await page.waitForSelector('.viewport-shell.is-result-transition', {
    timeout: 1_000,
  });
  const resultTransition = await presentation(page);

  await page.waitForTimeout(1_050);
  const resultSettled = await presentation(page);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    window.__DAI_EDITOR_SLICE__.triggerViewportTransitionForTest('result');
    window.__DAI_EDITOR_SLICE__.triggerResultRevealForTest();
  });
  const reducedMotion = await page.evaluate(() => {
    const canvas = document.querySelector('#renderCanvas');
    const status = document.querySelector('#resultStatus');
    const metrics = document.querySelector('#resultMetrics');
    return {
      canvasAnimation: getComputedStyle(canvas).animationName,
      statusAnimation: getComputedStyle(status).animationName,
      metricsAnimation: getComputedStyle(metrics).animationName,
    };
  });

  await page.screenshot({
    path: path.join(outputDir, 'result-focus.png'),
    fullPage: true,
  });

  const checks = {
    eventFocusTriggered:
      eventFocus.viewportClassName.includes('is-event-focus'),
    eventFocusTargetsCurrentRoom:
      cameraTargetsRoom(eventFocus),
    floorTransitionTriggered:
      floorTransition.viewportClassName.includes('is-floor-transition'),
    floorTransitionTargetsNewStartRoom:
      cameraTargetsRoom(floorTransition),
    resultTransitionTriggered:
      resultTransition.viewportClassName.includes('is-result-transition'),
    resultTargetsFinalRoom:
      cameraTargetsRoom(resultTransition),
    resultBannerRevealTriggered:
      resultTransition.resultStatus.hidden === false &&
      resultTransition.resultStatus.className.includes('is-result-reveal') &&
      resultTransition.resultStatus.text.length > 0,
    resultMetricsRevealTriggered:
      resultTransition.resultMetrics.hidden === false &&
      resultTransition.resultMetrics.className.includes('is-result-reveal') &&
      resultTransition.resultMetrics.text.length > 0,
    resultSettlesWithoutHidingContent:
      !resultSettled.viewportClassName.includes('is-result-transition') &&
      resultSettled.resultStatus.hidden === false &&
      resultSettled.resultMetrics.hidden === false &&
      !resultSettled.resultStatus.className.includes('is-result-reveal') &&
      !resultSettled.resultMetrics.className.includes('is-result-reveal'),
    twoFloorRunClears:
      (await state(page)).result?.status === 'cleared',
    reducedMotionDisablesNewAnimations:
      reducedMotion.canvasAnimation === 'none' &&
      reducedMotion.statusAnimation === 'none' &&
      reducedMotion.metricsAnimation === 'none',
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
    blockerRoute,
    eventFocus,
    floorTransition,
    resultTransition,
    resultSettled,
    reducedMotion,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(outputDir, 'result-focus.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(
      `Result/focus invariant failed: ${falseChecks.join(', ')}`,
    );
  }
} finally {
  if (browser) await browser.close();
  vite.kill();
}
