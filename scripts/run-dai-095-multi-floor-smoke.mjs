import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_MULTI_FLOOR_PORT || '4195');
const outputDir = path.resolve('artifacts/dai-095-browser');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const prompt = 'Create a fair multi-floor dungeon run with combat, treasure, readable traps, and exploration.';

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
  throw new Error(`DAI-095 browser server did not become ready.\n${viteOutput}`);
}

function intentPayload() {
  return {
    ...DEFAULT_DESIGN_INTENT,
    fairness: 0.82,
    tension: 0.75,
    exploration: 0.8,
    greedPunishment: 0.68,
    routeChoice: 0.62,
    learnability: 0.82,
    combatDensity: 0.78,
    trapDensity: 0.55,
    rewardDensity: 0.78,
    deception: 0.45,
    telegraphStrength: 0.82,
    backtracking: 0.35,
    targetDifficulty: 0.62,
    targetDuration: 420,
  };
}

async function state(page) {
  return page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function adjacency(snapshot) {
  const graph = new Map(snapshot.rooms.map((room) => [room.id, []]));
  for (const corridor of snapshot.corridors) {
    if (corridor.initiallyEnabled === false) continue;
    graph.get(corridor.fromRoomId)?.push(corridor.toRoomId);
    graph.get(corridor.toRoomId)?.push(corridor.fromRoomId);
  }
  return graph;
}

function shortestPath(snapshot, startRoomId, targetRoomIds) {
  const targets = new Set(targetRoomIds);
  const graph = adjacency(snapshot);
  const queue = [startRoomId];
  const previous = new Map([[startRoomId, null]]);
  let found = targets.has(startRoomId) ? startRoomId : null;

  while (!found && queue.length > 0) {
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
  for (let current = found; current != null; current = previous.get(current)) route.push(current);
  return route.reverse();
}

async function resolveBlockingEvents(page) {
  let guard = 0;
  while (guard < 30) {
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
  throw new Error('Blocking event resolution exceeded guard.');
}

async function moveOne(page, targetRoomId) {
  const before = await state(page);
  const beforeFloor = before.play?.floorIndex ?? -1;
  const moved = await page.evaluate((target) =>
    window.__DAI_EDITOR_SLICE__.movePlayToRoom(target), targetRoomId);
  if (!moved) throw new Error(`movePlayToRoom returned false for ${targetRoomId}`);

  await page.waitForFunction(({ floorIndex, roomId }) => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.mode === 'result' ||
      (s.play?.floorIndex ?? -1) > floorIndex ||
      s.play?.currentRoomId === roomId;
  }, { floorIndex: beforeFloor, roomId: targetRoomId }, { timeout: 10_000 });
}

async function moveAlong(page, route, { includeLast = true } = {}) {
  const targets = includeLast ? route.slice(1) : route.slice(1, -1);
  for (const target of targets) {
    await resolveBlockingEvents(page);
    await moveOne(page, target);
  }
  await resolveBlockingEvents(page);
}

async function captureAllAuthoringFloors(page) {
  const initial = await state(page);
  const floors = [];
  for (let index = 0; index < initial.floorCount; index += 1) {
    await page.evaluate((floorIndex) => window.__DAI_EDITOR_SLICE__.selectFloor(floorIndex), index);
    const s = await state(page);
    floors.push({
      floorIndex: index,
      dungeonId: s.floorSummaries[index].dungeonId,
      seed: s.floorSummaries[index].seed,
      rooms: s.rooms,
      corridors: s.corridors,
      entities: s.entities,
    });
  }
  await page.evaluate((floorIndex) => window.__DAI_EDITOR_SLICE__.selectFloor(floorIndex), initial.currentFloorIndex);
  return floors;
}

async function finishFloor(page, expectedFloorIndex) {
  let s = await state(page);
  if (s.play?.floorIndex !== expectedFloorIndex) {
    throw new Error(`Expected floor ${expectedFloorIndex}, got ${s.play?.floorIndex}`);
  }
  const route = shortestPath(s.play.snapshot, s.play.currentRoomId, [s.play.goalRoomId]);
  if (route.length < 2) throw new Error(`No route to goal on floor ${expectedFloorIndex + 1}`);
  await moveAlong(page, route);
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
  await page.waitForFunction(() =>
    window.__DAI_EDITOR_SLICE__?.ready === true &&
    window.__DAI_ONBOARDING__?.ready === true,
  null, { timeout: 60_000 });
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());

  await page.fill('#generationPrompt', prompt);
  await page.fill('#floorCount', '3');
  await page.click('#generateDungeon');
  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.generationBusy === false && s.floorCount === 3 && s.lastGeneration?.floorCount === 3;
  }, null, { timeout: 30_000 });

  const generated = await state(page);
  const floorOneRoomTwoBefore = clone(
    generated.rooms.find((room) => room.id === 'room-002'),
  );
  const floorOptions = await page.locator('#floorSelect option').allTextContents();
  const uniqueDungeonIds = new Set(generated.floorSummaries.map((floor) => floor.dungeonId));
  const uniqueSeeds = new Set(generated.floorSummaries.map((floor) => floor.seed));

  await page.click('[data-workflow-tab="edit"]');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().workflowTab === 'edit');

  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.selectFloor(1));
  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.selectRoom('room-002'));
  const floorTwoBefore = await state(page);
  const roomTwoBefore = floorTwoBefore.rooms.find((room) => room.id === 'room-002');
  await page.fill('#roomWidth', String(roomTwoBefore.width + 1));
  await page.click('#resizeRoom');
  const floorTwoAfterEdit = await state(page);
  const roomTwoAfter = floorTwoAfterEdit.rooms.find((room) => room.id === 'room-002');

  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.selectFloor(0));
  const floorOneAfterFloorTwoEdit = await state(page);
  const floorOneRoomTwo = floorOneAfterFloorTwoEdit.rooms.find((room) => room.id === 'room-002');

  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.selectFloor(1));
  const floorTwoRevisited = await state(page);
  const floorTwoRoomTwoRevisited = floorTwoRevisited.rooms.find((room) => room.id === 'room-002');

  const authoringBeforePlay = await captureAllAuthoringFloors(page);
  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.startDungeon());
  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.mode === 'play' && s.play?.floorIndex === 0 && s.run?.floorCount === 3;
  }, null, { timeout: 10_000 });

  let play = await state(page);
  const enemyRooms = [...new Set(play.play.snapshot.entities
    .filter((entity) => entity.type === 'enemy')
    .map((entity) => entity.roomId))];
  if (enemyRooms.length === 0) throw new Error('Floor 1 has no enemy for carry-over probe.');

  const enemyRoute = shortestPath(play.play.snapshot, play.play.currentRoomId, enemyRooms);
  if (enemyRoute.length === 0) throw new Error('No route to floor 1 enemy.');
  await moveAlong(page, enemyRoute);
  await resolveBlockingEvents(page);

  play = await state(page);
  if ((play.play?.gameplayCounters?.xpEarned ?? 0) <= 0) {
    throw new Error('Floor 1 enemy did not grant XP.');
  }

  const goalRoute = shortestPath(play.play.snapshot, play.play.currentRoomId, [play.play.goalRoomId]);
  if (goalRoute.length < 2) throw new Error('No route to floor 1 goal.');
  await moveAlong(page, goalRoute, { includeLast: false });
  const beforeFloorAdvance = await state(page);
  const carriedPlayerState = JSON.parse(JSON.stringify(beforeFloorAdvance.play.playerState));
  await moveOne(page, goalRoute.at(-1));

  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.mode === 'play' && s.play?.floorIndex === 1;
  }, null, { timeout: 10_000 });
  const floorTwoStart = await state(page);

  await finishFloor(page, 1);
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().play?.floorIndex === 2, null, { timeout: 10_000 });
  await finishFloor(page, 2);
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'result', null, { timeout: 10_000 });

  const result = await state(page);
  const resultText = await page.locator('#resultMetrics').innerText();
  await page.screenshot({ path: path.join(outputDir, 'multi-floor-result.png'), fullPage: true });

  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.returnToEdit());
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');
  const authoringAfterPlay = await captureAllAuthoringFloors(page);

  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.startMysteryDungeon());
  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.mode === 'play' && s.playSource === 'mystery' && s.run?.floorCount === 3;
  }, null, { timeout: 10_000 });
  const mysteryPlay = await state(page);
  const mysteryDungeonIds = [...mysteryPlay.run.floorDungeonIds];

  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.returnToEdit());
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');
  const mysteryAdopted = await state(page);
  const adoptedDungeonIds = mysteryAdopted.floorSummaries.map((floor) => floor.dungeonId);

  const checks = {
    generatedThreeFloors:
      generated.floorCount === 3 &&
      generated.floorSummaries.length === 3 &&
      floorOptions.length === 3,
    generatedFloorIdsUnique: uniqueDungeonIds.size === 3,
    generatedFloorSeedsUnique: uniqueSeeds.size === 3,
    floorSelectorSwitchesCurrentFloor:
      floorTwoBefore.currentFloorIndex === 1 &&
      floorOneAfterFloorTwoEdit.currentFloorIndex === 0 &&
      floorTwoRevisited.currentFloorIndex === 1,
    floorEditsAreIsolated:
      roomTwoAfter.width === roomTwoBefore.width + 1 &&
      JSON.stringify(floorOneRoomTwo) ===
        JSON.stringify(floorOneRoomTwoBefore) &&
      JSON.stringify(floorTwoRoomTwoRevisited) ===
        JSON.stringify(roomTwoAfter),
    testRunAlwaysStartsFloorOne:
      beforeFloorAdvance.run?.floorCount === 3 &&
      beforeFloorAdvance.play?.floorIndex === 0,
    playerStateCarriesExactlyToFloorTwo:
      JSON.stringify(floorTwoStart.play?.playerState) === JSON.stringify(carriedPlayerState),
    progressionActuallyCarried:
      (carriedPlayerState.xp ?? 0) > 0 ||
      (carriedPlayerState.gold ?? 0) > 0 ||
      (carriedPlayerState.level ?? 1) > 1,
    threeFloorRunClears:
      result.mode === 'result' &&
      result.run?.status === 'cleared' &&
      result.run?.floorsCompleted === 3 &&
      result.run?.currentFloorIndex === 2,
    resultShowsFloorCompletion: resultText.includes('FLOOR 3/3'),
    testPlayDoesNotMutateAuthoring:
      JSON.stringify(authoringAfterPlay) === JSON.stringify(authoringBeforePlay),
    mysteryKeepsThreeFloors:
      mysteryPlay.run?.floorCount === 3 &&
      mysteryDungeonIds.length === 3,
    mysteryReturnAdoptsAllFloors:
      mysteryAdopted.floorCount === 3 &&
      JSON.stringify(adoptedDungeonIds) === JSON.stringify(mysteryDungeonIds) &&
      mysteryAdopted.canUndo === false &&
      mysteryAdopted.canRedo === false,
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
    generatedFloorSummaries: generated.floorSummaries,
    floorOptions,
    floorTwoEdit: {
      floorOneBefore: floorOneRoomTwoBefore,
      floorTwoBefore: roomTwoBefore,
      floorTwoAfter: roomTwoAfter,
      floorOneAfterFloorTwoEdit: floorOneRoomTwo,
      floorTwoRevisited: floorTwoRoomTwoRevisited,
    },
    carriedPlayerState,
    floorTwoStartPlayerState: floorTwoStart.play?.playerState ?? null,
    resultRun: result.run,
    resultText,
    authoringBeforePlay,
    authoringAfterPlay,
    mysteryDungeonIds,
    adoptedDungeonIds,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(outputDir, 'dai-095-multi-floor-browser.json'),
    JSON.stringify(evidence, null, 2) + '\n'
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(`DAI-095 browser invariant failed: ${falseChecks.join(', ')}`);
  }
} finally {
  if (browser) await browser.close();
  vite.kill();
}
