import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';

const chromePath =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_EVENT_FEEDBACK_PORT || '4201');
const outputDir = path.resolve('artifacts/event-feedback');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const prompt =
  'Create a tense 7-minute dungeon with exploration, enemies, traps, rewards, and readable warnings.';

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
  throw new Error(`event-feedback server did not become ready.\n${viteOutput}`);
}

function intentPayload() {
  return {
    ...DEFAULT_DESIGN_INTENT,
    fairness: 0.78,
    tension: 0.82,
    exploration: 0.78,
    greedPunishment: 0.72,
    routeChoice: 0.62,
    learnability: 0.8,
    combatDensity: 0.75,
    trapDensity: 0.75,
    rewardDensity: 0.75,
    deception: 0.55,
    telegraphStrength: 0.82,
    backtracking: 0.4,
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
  const path = [];
  for (let current = found; current != null; current = previous.get(current)) {
    path.push(current);
  }
  return path.reverse();
}

async function state(page) {
  return page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
}

async function waitFeedback(page, expectedKind) {
  await page.waitForFunction(
    (kind) => {
      const node = document.querySelector('#actionFeedback');
      return node && node.hidden === false && node.dataset.kind === kind;
    },
    expectedKind,
    { timeout: 2_000 },
  );
  return page.evaluate(() => ({
    kind: document.querySelector('#actionFeedback')?.dataset.kind ?? null,
    text: document.querySelector('#actionFeedback')?.textContent ?? '',
    hidden: document.querySelector('#actionFeedback')?.hidden ?? true,
  }));
}

async function resolveBlockingEvents(page, { captureFirst = false } = {}) {
  let captured = null;
  for (let guard = 0; guard < 20; guard += 1) {
    const enemy = page.locator('.room-event.is-blocking [data-action="clear-enemy"]').first();
    if (await enemy.count()) {
      await enemy.click();
      if (captureFirst && !captured) captured = await waitFeedback(page, 'combat');
      await page.waitForTimeout(40);
      continue;
    }

    const trap = page.locator('.room-event.is-blocking [data-action="avoid-trap"]').first();
    if (await trap.count()) {
      await trap.click();
      if (captureFirst && !captured) captured = await waitFeedback(page, 'trap');
      await page.waitForTimeout(40);
      continue;
    }
    return captured;
  }
  throw new Error('Blocking room-event resolution exceeded guard.');
}

async function moveAlong(page, path) {
  for (const targetRoomId of path.slice(1)) {
    await resolveBlockingEvents(page);
    const corridorId = await page.evaluate((target) => {
      const s = window.__DAI_EDITOR_SLICE__.getState();
      return s.play?.map?.currentExits?.find(
        (exit) => exit.targetRoomId === target,
      )?.corridorId ?? null;
    }, targetRoomId);
    if (!corridorId) throw new Error(`No visible exit to ${targetRoomId}`);

    const before = await state(page);
    const beforeMoves = before.play?.moves ?? 0;
    const beforeFloorIndex = before.currentFloorIndex;

    await page.locator(
      `#playExitButtons .exit-button[data-corridor-id="${corridorId}"]`,
    ).click();

    await page.waitForFunction(
      ({ moves, floorIndex, target }) => {
        const s = window.__DAI_EDITOR_SLICE__.getState();

        // A Goal move can immediately complete the run or advance to the
        // next Floor, where the new PlaySession starts again at moves=0.
        if (s.mode !== 'play') return true;
        if (s.currentFloorIndex !== floorIndex) return true;

        return (
          s.play?.currentRoomId === target &&
          (s.play?.moves ?? -1) === moves + 1
        );
      },
      {
        moves: beforeMoves,
        floorIndex: beforeFloorIndex,
        target: targetRoomId,
      },
      { timeout: 5_000 },
    );

    const after = await state(page);
    if (
      after.mode !== 'play' ||
      after.currentFloorIndex !== beforeFloorIndex
    ) {
      return;
    }
  }
}

async function visitTreasure(page, snapshot) {
  let current = await state(page);
  const treasureRooms = [...new Set(
    snapshot.entities
      .filter((entity) => entity.type === 'treasure')
      .map((entity) => entity.roomId),
  )];
  const path = shortestPath(
    snapshot,
    current.play.currentRoomId,
    treasureRooms,
  );
  if (path.length === 0) return null;
  await moveAlong(page, path);
  await resolveBlockingEvents(page);

  const button = page.locator('.room-event [data-action="open-treasure"]').first();
  if (!(await button.count())) return null;
  await button.click();
  return waitFeedback(page, 'treasure');
}

async function finishFloor(page) {
  let current = await state(page);
  const startingFloorIndex = current.currentFloorIndex;
  const snapshot = current.play.snapshot;
  const path = shortestPath(
    snapshot,
    current.play.currentRoomId,
    [current.play.goalRoomId],
  );
  if (path.length === 0) throw new Error('No path to Goal.');

  await moveAlong(page, path);

  current = await state(page);
  if (
    current.mode === 'play' &&
    current.currentFloorIndex === startingFloorIndex
  ) {
    // Goal-room blockers must be resolved before completion, but never
    // consume blockers from the newly advanced Floor.
    await resolveBlockingEvents(page);
  }
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
    throw new Error('Generated first floor has no blocker.');
  }

  const blockerPath = shortestPath(
    firstSnapshot,
    current.play.currentRoomId,
    blockerRooms,
  );
  await moveAlong(page, blockerPath);

  await page.waitForSelector('#roomEventBar.is-event-intro', {
    timeout: 2_000,
  });
  const roomEventIntro = await page.evaluate(() => ({
    className: document.querySelector('#roomEventBar')?.className ?? '',
    blockingCount:
      document.querySelectorAll('.room-event.is-blocking').length,
  }));

  const blockingFeedback = await resolveBlockingEvents(page, {
    captureFirst: true,
  });
  const treasureFeedback = await visitTreasure(page, firstSnapshot);

  await finishFloor(page);
  await page.waitForFunction(
    () => {
      const s = window.__DAI_EDITOR_SLICE__.getState();
      return s.mode === 'play' && s.currentFloorIndex === 1;
    },
    null,
    { timeout: 10_000 },
  );
  const floorFeedback = await waitFeedback(page, 'floor');

  current = await state(page);
  const secondSnapshot = current.play.snapshot;
  await finishFloor(page);
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__.getState().mode === 'result',
    null,
    { timeout: 10_000 },
  );
  const resultFeedback = await waitFeedback(page, 'result');

  await page.screenshot({
    path: path.join(outputDir, 'event-feedback-result.png'),
    fullPage: true,
  });

  const checks = {
    roomEventIntroEmphasized:
      roomEventIntro.className.includes('is-event-intro') &&
      roomEventIntro.blockingCount > 0,
    blockingResolutionFeedbackVisible:
      Boolean(blockingFeedback) &&
      ['combat', 'trap'].includes(blockingFeedback.kind) &&
      blockingFeedback.hidden === false &&
      blockingFeedback.text.length > 0,
    treasureFeedbackVisible:
      Boolean(treasureFeedback) &&
      treasureFeedback.kind === 'treasure' &&
      treasureFeedback.hidden === false &&
      treasureFeedback.text.length > 0,
    floorAdvanceFeedbackVisible:
      floorFeedback.kind === 'floor' &&
      floorFeedback.hidden === false &&
      floorFeedback.text.length > 0,
    finalResultFeedbackVisible:
      resultFeedback.kind === 'result' &&
      resultFeedback.hidden === false &&
      resultFeedback.text.length > 0,
    twoFloorRunCompletes:
      (await state(page)).result?.status === 'cleared',
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
    blockerPath,
    roomEventIntro,
    blockingFeedback,
    treasureFeedback,
    floorFeedback,
    resultFeedback,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(outputDir, 'event-feedback.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(
      `Event feedback invariant failed: ${falseChecks.join(', ')}`,
    );
  }
} finally {
  if (browser) await browser.close();
  vite.kill();
}
