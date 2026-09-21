import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_ROOM_EVENTS_PORT || '4193');
const outputDir = path.resolve('artifacts/room-events');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const prompt = 'Create a tense 7-minute dungeon with exploration, enemies, traps, rewards, and readable warnings.';

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
  throw new Error(`Room-event server did not become ready.\n${viteOutput}`);
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
  for (let current = found; current != null; current = previous.get(current)) path.push(current);
  return path.reverse();
}

async function state(page) {
  return page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
}

async function resolveBlockingEvents(page) {
  let guard = 0;
  while (guard < 20) {
    guard += 1;
    const enemy = page.locator('.room-event.is-blocking [data-action="clear-enemy"]').first();
    if (await enemy.count()) {
      await enemy.click();
      await page.waitForTimeout(30);
      continue;
    }
    const trap = page.locator('.room-event.is-blocking [data-action="avoid-trap"]').first();
    if (await trap.count()) {
      await trap.click();
      await page.waitForTimeout(30);
      continue;
    }
    return;
  }
  throw new Error('Blocking room-event resolution exceeded guard.');
}

async function moveAlong(page, path) {
  for (const targetRoomId of path.slice(1)) {
    await resolveBlockingEvents(page);
    const corridorId = await page.evaluate((target) => {
      const s = window.__DAI_EDITOR_SLICE__.getState();
      return s.play?.map?.currentExits?.find((exit) => exit.targetRoomId === target)?.corridorId ?? null;
    }, targetRoomId);
    if (!corridorId) throw new Error(`No visible exit to ${targetRoomId}`);
    const beforeMoves = (await state(page)).play.moves;
    await page.locator(`#playExitButtons .exit-button[data-corridor-id="${corridorId}"]`).click();
    await page.waitForFunction((moves) => window.__DAI_EDITOR_SLICE__.getState().play?.moves === moves + 1, beforeMoves);
  }
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
        intent: intentPayload(),
        meta: { provider: 'openai', model: 'test-model', usage: null },
      }),
    });
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready === true && window.__DAI_ONBOARDING__?.ready === true, null, { timeout: 60_000 });
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());

  await page.fill('#generationPrompt', prompt);
  await page.click('#generateDungeon');
  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.generationBusy === false && s.lastGeneration?.roomCount === 7;
  }, null, { timeout: 30_000 });

  const authoringBefore = await state(page);
  const authoringProjectionBefore = JSON.stringify({
    rooms: authoringBefore.rooms,
    entities: authoringBefore.entities,
  });

  await page.click('#start');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'play');

  let current = await state(page);
  const snapshot = current.play.snapshot;
  const blockerRooms = [...new Set(snapshot.entities
    .filter((entity) => entity.type === 'enemy' || entity.type === 'trap')
    .map((entity) => entity.roomId))];
  const treasureRooms = [...new Set(snapshot.entities
    .filter((entity) => entity.type === 'treasure')
    .map((entity) => entity.roomId))];

  if (blockerRooms.length === 0) throw new Error('Generated fixture has no blocking room event.');
  if (treasureRooms.length === 0) throw new Error('Generated fixture has no treasure room.');

  const blockerPath = shortestPath(snapshot, current.play.currentRoomId, blockerRooms);
  if (blockerPath.length === 0) throw new Error('No path to a blocking room event.');
  await moveAlong(page, blockerPath);

  current = await state(page);
  const blockingCardsBefore = await page.locator('.room-event.is-blocking').count();
  const exitButtonsWhileBlocked = await page.locator('#playExitButtons .exit-button').count();
  await page.screenshot({ path: path.join(outputDir, 'room-event-blocked.png'), fullPage: true });

  const firstBlockingKind = await page.locator('.room-event.is-blocking').first().getAttribute('data-kind');
  // Resolve all mandatory encounters through the actual visible buttons.
  await resolveBlockingEvents(page);
  const exitButtonsAfterResolve = await page.locator('#playExitButtons .exit-button').count();
  const blockingCardsAfter = await page.locator('.room-event.is-blocking').count();

  // Navigate to a treasure room, resolving any mandatory encounters along the way.
  current = await state(page);
  const treasurePath = shortestPath(snapshot, current.play.currentRoomId, treasureRooms);
  if (treasurePath.length === 0) throw new Error('No path to a treasure room.');
  await moveAlong(page, treasurePath);
  await resolveBlockingEvents(page);

  const treasureButton = page.locator('.room-event [data-action="open-treasure"]').first();
  const treasureVisible = (await treasureButton.count()) > 0;
  if (treasureVisible) {
    await treasureButton.click();
    await page.waitForTimeout(40);
  }

  const interactionState = await page.evaluate(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return {
      counters: s.play?.snapshot ? null : null,
      roomEventText: document.querySelector('#roomEventBar')?.innerText ?? '',
    };
  });

  // Finish through the actual visible exit controls.
  current = await state(page);
  const goalPath = shortestPath(snapshot, current.play.currentRoomId, [current.play.goalRoomId]);
  if (goalPath.length === 0) throw new Error('No path to Goal.');
  await moveAlong(page, goalPath);
  await resolveBlockingEvents(page);

  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'result', null, { timeout: 30_000 });
  const result = await state(page);
  const resultText = await page.locator('#resultMetrics').innerText();
  const hpReadout = await page.locator('#hpCount').innerText();
  await page.screenshot({ path: path.join(outputDir, 'room-event-result.png'), fullPage: true });

  await page.click('#returnEdit');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');
  const authoringAfter = await state(page);
  const authoringProjectionAfter = JSON.stringify({
    rooms: authoringAfter.rooms,
    entities: authoringAfter.entities,
  });

  const metrics = result.result?.metrics ?? {};
  const eventTimes = (result.play?.events ?? [])
    .map((event) => event.at)
    .filter((value) => Number.isFinite(value));
  const eventTimesMonotonic = eventTimes.every(
    (value, index) => index === 0 || value >= eventTimes[index - 1],
  );
  const latestEventAt = eventTimes.length ? Math.max(...eventTimes) : result.play?.startedAt ?? 0;
  const checks = {
    generatedWorkingEntities:
      snapshot.entities.some((entity) => entity.type === 'enemy') &&
      snapshot.entities.some((entity) => entity.type === 'trap') &&
      snapshot.entities.some((entity) => entity.type === 'treasure'),
    blockingRoomEventVisible: blockingCardsBefore > 0,
    unresolvedThreatLocksExits: exitButtonsWhileBlocked === 0,
    mandatoryEncounterCanBeResolved: blockingCardsAfter === 0 && exitButtonsAfterResolve > 0,
    mandatoryRuntimeRecorded:
      (metrics.interactions ?? 0) > 0 &&
      ((metrics.enemiesCleared ?? 0) > 0 || firstBlockingKind === 'trap'),
    optionalTreasureActionAvailable: treasureVisible === true,
    treasureOpenRecorded: (metrics.treasuresOpened ?? 0) >= 1,
    resultShowsInteractionMetrics:
      resultText.includes('ENEMY') &&
      resultText.includes('CHEST') &&
      resultText.includes('TRAP'),
    playerStatsVisible:
      resultText.includes('HP') &&
      resultText.includes('DMG') &&
      resultText.includes('HEAL') &&
      hpReadout === `${result.result?.playerState?.hp ?? 0}/${result.result?.playerState?.maxHp ?? 0}`,
    runClears: result.result?.status === 'cleared',
    playEventTimesMonotonic: eventTimesMonotonic,
    resultTimeNotBeforeEvents:
      Number.isFinite(result.result?.completedAt) &&
      result.result.completedAt >= latestEventAt,
    authoringDungeonUnchanged: authoringProjectionAfter === authoringProjectionBefore,
    browserErrorsAbsent:
      consoleErrors.length === 0 &&
      pageErrors.length === 0 &&
      failedRequests.length === 0 &&
      httpErrors.length === 0,
  };

  const falseChecks = Object.entries(checks).filter(([, value]) => value !== true).map(([name]) => name);
  const passed = falseChecks.length === 0;
  const evidence = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    browserVersion: browser.version(),
    passed,
    checks,
    falseChecks,
    firstBlockingKind,
    blockerPath,
    treasurePath,
    goalPath,
    resultMetrics: metrics,
    playEventTimes: eventTimes,
    resultText,
    hpReadout,
    interactionState,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(outputDir, 'dai-087-room-events.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!passed) {
    console.error('DAI-087 failed checks:', falseChecks.join(', '));
    throw new Error(`DAI-087 room-event invariant failed: ${falseChecks.join(', ')}`);
  }
} finally {
  if (browser) await browser.close();
  vite.kill();
}
