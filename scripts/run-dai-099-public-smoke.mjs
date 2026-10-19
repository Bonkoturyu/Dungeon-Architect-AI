import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { captureBrowserFailure, confirmManualGeneration } from './browser-smoke-support.mjs';
import { evaluateRoomEventLayout, readRoomEventLayout } from './room-event-layout-checks.mjs';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const rawBaseUrl = String(
  process.env.DAI_PUBLIC_URL || 'https://dungeon-architect-ai.pages.dev/',
).trim();
const outputDir = path.resolve('artifacts/dai-099-public');
const localBuildInfoPath = path.resolve('dist/build-info.json');
const generationPrompt =
  'Create a fair but tense two-floor dungeon with exploration, combat, readable traps, and dangerous rewards.';
const editPrompt = 'Move the treasure to the room that contains the goal.';

if (!/^https:\/\//i.test(rawBaseUrl)) {
  throw new Error('DAI_PUBLIC_URL must be an https:// URL.');
}
if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (!fs.existsSync(localBuildInfoPath)) {
  throw new Error('dist/build-info.json is missing. Run npm run build:hosting before DAI-099 public validation.');
}

const localBuildInfo = JSON.parse(fs.readFileSync(localBuildInfoPath, 'utf8'));
if (
  localBuildInfo?.schemaVersion !== '1.0' ||
  typeof localBuildInfo?.runtimeSourceSha256 !== 'string' ||
  localBuildInfo.runtimeSourceSha256.length !== 64 ||
  typeof localBuildInfo?.runtimeBundleSha256 !== 'string' ||
  localBuildInfo.runtimeBundleSha256.length !== 64
) {
  throw new Error('Local dist/build-info.json is invalid.');
}

fs.mkdirSync(outputDir, { recursive: true });
const baseUrl = rawBaseUrl.replace(/\/+$/, '');
const editorUrl = `${baseUrl}/`;

async function state(page) {
  return page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
}

function adjacency(snapshot) {
  const graph = new Map((snapshot?.rooms ?? []).map((room) => [room.id, []]));
  for (const corridor of snapshot?.corridors ?? []) {
    if (corridor.initiallyEnabled === false) continue;
    graph.get(corridor.fromRoomId)?.push(corridor.toRoomId);
    graph.get(corridor.toRoomId)?.push(corridor.fromRoomId);
  }
  for (const neighbors of graph.values()) neighbors.sort((a, b) => a.localeCompare(b));
  return graph;
}

// Rooms with enemies or traps cost HP. Since DAI-100 balance, a plain shortest
// path can wear the player down to 0 HP on some layouts, so prefer safer routes.
function roomDanger(snapshot, roomId) {
  return (snapshot?.entities ?? []).filter((entity) =>
    entity.roomId === roomId && (entity.type === 'enemy' || entity.type === 'trap')).length;
}

function shortestPath(snapshot, startRoomId, targetRoomIds, { avoidRoomIds = [] } = {}) {
  const targets = new Set(targetRoomIds);
  const avoid = new Set(avoidRoomIds);
  const graph = adjacency(snapshot);
  const cost = new Map([[startRoomId, 0]]);
  const previous = new Map([[startRoomId, null]]);
  const done = new Set();
  let found = null;

  for (;;) {
    let current = null;
    for (const [roomId, value] of cost) {
      if (!done.has(roomId) && (current === null || value < cost.get(current))) current = roomId;
    }
    if (current === null) break;
    if (targets.has(current)) {
      found = current;
      break;
    }
    done.add(current);
    for (const next of graph.get(current) ?? []) {
      if (done.has(next) || (avoid.has(next) && !targets.has(next))) continue;
      const nextCost = cost.get(current) + 1 + 10 * roomDanger(snapshot, next);
      if (!cost.has(next) || nextCost < cost.get(next)) {
        cost.set(next, nextCost);
        previous.set(next, current);
      }
    }
  }

  if (!found) return [];
  const route = [];
  for (let current = found; current != null; current = previous.get(current)) route.push(current);
  return route.reverse();
}

async function resolveBlockingEvents(page, evidence) {
  let guard = 0;
  while (guard < 40) {
    guard += 1;

    const enemy = page.locator('.room-event.is-blocking [data-action="clear-enemy"]').first();
    if (await enemy.count()) {
      // DAI-100 placement contract: centered horizontally, offset above the viewport center.
      // The intro animation starts at opacity 0; measure once the panel is visible (center is unchanged).
      await page.waitForFunction(() => {
        const events = document.querySelector('#roomEventBar');
        return events && !events.hidden && Number(getComputedStyle(events).opacity) > 0;
      }, null, { timeout: 2_000 });
      const roomEvent = evaluateRoomEventLayout(await readRoomEventLayout(page));
      evidence.roomEventObservations.push(roomEvent);

      const characters = await page.evaluate(() =>
        window.__DAI_EDITOR_SLICE__.getCharacterPresentation());
      evidence.characterObservations.push(characters);

      await enemy.click();
      await page.waitForTimeout(80);
      continue;
    }

    const trap = page.locator('.room-event.is-blocking [data-action="avoid-trap"]').first();
    if (await trap.count()) {
      // DAI-100 placement contract: centered horizontally, offset above the viewport center.
      // The intro animation starts at opacity 0; measure once the panel is visible (center is unchanged).
      await page.waitForFunction(() => {
        const events = document.querySelector('#roomEventBar');
        return events && !events.hidden && Number(getComputedStyle(events).opacity) > 0;
      }, null, { timeout: 2_000 });
      const roomEvent = evaluateRoomEventLayout(await readRoomEventLayout(page));
      evidence.roomEventObservations.push(roomEvent);
      await trap.click();
      await page.waitForTimeout(80);
      continue;
    }

    // Treasure can grant equipment that reduces later damage, as a player would take it.
    const treasure = page.locator('[data-action="open-treasure"]:not([disabled])').first();
    if (await treasure.count()) {
      await treasure.click();
      await page.waitForTimeout(80);
      continue;
    }

    const recovery = page.locator('[data-action="use-recovery"]:not([disabled])').first();
    if (await recovery.count()) {
      const player = (await state(page)).play?.playerState;
      if (player && player.hp < player.maxHp) {
        await recovery.click();
        await page.waitForTimeout(80);
        continue;
      }
    }

    return;
  }

  throw new Error('Blocking room-event resolution exceeded guard.');
}

async function moveOne(page, roomId) {
  const before = await state(page);
  const floorIndex = before.play?.floorIndex ?? -1;
  const moved = await page.evaluate((target) =>
    window.__DAI_EDITOR_SLICE__.movePlayToRoom(target), roomId);
  if (!moved) throw new Error(`movePlayToRoom returned false for ${roomId}`);

  await page.waitForFunction(({ expectedFloor, expectedRoom }) => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.mode === 'result' ||
      (s.play?.floorIndex ?? -1) > expectedFloor ||
      s.play?.currentRoomId === expectedRoom;
  }, { expectedFloor: floorIndex, expectedRoom: roomId }, { timeout: 10_000 });
}

async function traverse(page, route, evidence, { resolveAfterLast = true } = {}) {
  for (const roomId of route.slice(1)) {
    await resolveBlockingEvents(page, evidence);
    await moveOne(page, roomId);
  }
  if (resolveAfterLast) await resolveBlockingEvents(page, evidence);
}

// A normal Goal completes on entry. A special Goal (shop, monster/trap house, or a
// Goal room with enemies/traps) waits for the explicit Finish action instead.
// Returns the state just before Finish (the state carried to the next floor), or null.
async function completeGoalIfWaiting(page, evidence) {
  const s = await state(page);
  if (s.mode !== 'play' || s.play?.currentRoomId !== s.play?.goalRoomId) return null;
  await resolveBlockingEvents(page, evidence);
  const finish = page.locator('[data-action="complete-goal"]:not([disabled])').first();
  if (!(await finish.count())) return null;
  const beforeFinish = await state(page);
  await finish.click();
  return beforeFinish;
}

async function finishCurrentFloor(page, evidence) {
  const s = await state(page);
  const route = shortestPath(s.play.snapshot, s.play.currentRoomId, [s.play.goalRoomId]);
  if (route.length < 2) throw new Error(`No route to goal on floor ${(s.play?.floorIndex ?? 0) + 1}`);
  await traverse(page, route, evidence, { resolveAfterLast: false });
  await completeGoalIfWaiting(page, evidence);
}

let browser;
let page;
try {
  browser = await chromium.launch({
    executablePath: chromePath,
    headless: false,
    args: [
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  const apiResponses = [];
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
  page.on('request', (request) => {
    if (/\.(?:wav|mp3|ogg|flac|m4a|aac)(?:\?|$)/i.test(request.url())) {
      externalAudioRequests.push(request.url());
    }
  });
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname === '/api/design-intent' || pathname === '/api/natural-edit') {
      apiResponses.push({ path: pathname, status: response.status() });
    }
    if (response.status() >= 400) {
      httpErrors.push({ url: response.url(), status: response.status() });
    }
  });

  const buildInfoResponse = await page.request.get(`${baseUrl}/build-info.json`, {
    headers: { 'cache-control': 'no-cache' },
  });
  const remoteBuildInfoStatus = buildInfoResponse.status();
  let remoteBuildInfo = null;
  let remoteBuildInfoParseError = null;
  if (remoteBuildInfoStatus === 200) {
    try {
      remoteBuildInfo = await buildInfoResponse.json();
    } catch (error) {
      remoteBuildInfoParseError = error instanceof Error ? error.message : String(error);
    }
  }

  const navigationStarted = performance.now();
  await page.goto(editorUrl, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForFunction(
    () =>
      window.__DAI_EDITOR_SLICE__?.ready === true &&
      window.__DAI_ONBOARDING__?.ready === true,
    null,
    { timeout: 60_000 },
  );
  const navigationReadyMs = performance.now() - navigationStarted;

  const initial = await state(page);
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());

  const currentUi = await page.evaluate(() => ({
    testLabel: document.querySelector('#start')?.textContent?.trim() ?? '',
    mysteryLabel: document.querySelector('#mysteryPlay')?.textContent?.trim() ?? '',
    audioToggle: Boolean(document.querySelector('#audioToggle')),
    floorCountInput: Boolean(document.querySelector('#floorCount')),
    statusLabels: [...document.querySelectorAll('#playStatus .metric-label')]
      .map((element) => element.textContent?.trim() ?? ''),
  }));

  // First real user gesture also unlocks Web Audio.
  await page.click('[data-workflow-tab="create"]');
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__.getAudioPresentation().unlocked === true,
    null,
    { timeout: 10_000 },
  );
  const audioAfterUnlock = await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.getAudioPresentation());

  await page.fill('#generationPrompt', generationPrompt);
  await page.fill('#floorCount', '2');
  await page.click('#generateDungeon');
  // Manual is the default: generation waits for the reviewed special-room plan.
  const manualConfirmation = await confirmManualGeneration(page);
  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return (
      s.generationBusy === false &&
      s.lastGeneration &&
      s.floorCount === 2 &&
      s.lastGeneration.floorCount === 2
    );
  }, null, { timeout: 120_000 });

  const generated = await state(page);
  const firstFloorGoal = generated.entities.find((entity) => entity.type === 'goal');
  const firstFloorTreasure = generated.entities.find((entity) => entity.type === 'treasure');
  if (!firstFloorGoal || !firstFloorTreasure) {
    throw new Error('Generated first floor is missing goal or treasure.');
  }

  await page.click('[data-workflow-tab="edit"]');
  await page.waitForFunction(() =>
    window.__DAI_EDITOR_SLICE__.getState().workflowTab === 'edit');

  await page.fill('#naturalEditInput', editPrompt);
  await page.click('#applyNaturalEdit');
  // Wait for the edit to finish either way, then judge it below so a failed or
  // rejected edit still leaves evidence instead of a bare timeout.
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__.getState().naturalEditBusy === false,
    null,
    { timeout: 120_000 },
  );

  const afterEdit = await state(page);
  const naturalEditStatusText = await page.locator('#naturalEditStatus').innerText();
  // The prompt names "the treasure"; the model may pick any treasure on the floor.
  const treasureIds = new Set(
    generated.entities.filter((entity) => entity.type === 'treasure').map((entity) => entity.id),
  );
  const editCommand = afterEdit.lastNaturalEditCommand;
  const movedTreasure = editCommand?.type === 'move-entity' && treasureIds.has(editCommand.entityId)
    ? afterEdit.entities.find((entity) => entity.id === editCommand.entityId) ?? null
    : null;

  await page.click('[data-workflow-tab="play"]');
  await page.waitForFunction(() =>
    window.__DAI_EDITOR_SLICE__.getState().workflowTab === 'play');

  await page.click('#start');
  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.mode === 'play' && s.run?.floorCount === 2 && s.play?.floorIndex === 0;
  }, null, { timeout: 30_000 });

  const playStart = await state(page);
  const initialPlayerState = JSON.parse(JSON.stringify(playStart.play.playerState));
  const evidenceRuntime = {
    roomEventObservations: [],
    characterObservations: [],
  };

  // Force one real enemy encounter on floor 1 so Room Event + character presentation are observed.
  const enemyRooms = [...new Set(
    playStart.play.snapshot.entities
      .filter((entity) => entity.type === 'enemy')
      .map((entity) => entity.roomId),
  )];
  if (enemyRooms.length === 0) throw new Error('Generated floor 1 has no enemy.');

  // Entering a normal Goal clears the floor, so the detour to an enemy must not
  // pass through the floor-1 Goal room.
  const enemyRoute = shortestPath(
    playStart.play.snapshot,
    playStart.play.currentRoomId,
    enemyRooms,
    { avoidRoomIds: [playStart.play.goalRoomId] },
  );
  if (enemyRoute.length === 0) throw new Error('No route to floor 1 enemy that avoids the Goal room.');
  await traverse(page, enemyRoute, evidenceRuntime);
  const afterEnemy = await state(page);
  if (afterEnemy.mode !== 'play' || afterEnemy.play?.floorIndex !== 0) {
    throw new Error(`Enemy detour left floor 1 (mode=${afterEnemy.mode}, floorIndex=${afterEnemy.play?.floorIndex}).`);
  }

  const routeToGoal = shortestPath(
    afterEnemy.play.snapshot,
    afterEnemy.play.currentRoomId,
    [afterEnemy.play.goalRoomId],
  );
  if (routeToGoal.length < 2) throw new Error('No route to floor 1 goal.');

  for (const target of routeToGoal.slice(1, -1)) {
    await resolveBlockingEvents(page, evidenceRuntime);
    await moveOne(page, target);
  }
  await resolveBlockingEvents(page, evidenceRuntime);

  const beforeAdvance = await state(page);
  let carriedPlayerState = JSON.parse(JSON.stringify(beforeAdvance.play.playerState));
  await moveOne(page, routeToGoal.at(-1));
  // A special Goal is resolved inside the Goal room first, so carry what Finish carried.
  const beforeFinish = await completeGoalIfWaiting(page, evidenceRuntime);
  if (beforeFinish) carriedPlayerState = JSON.parse(JSON.stringify(beforeFinish.play.playerState));

  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.mode === 'play' && s.play?.floorIndex === 1;
  }, null, { timeout: 15_000 });
  const floorTwoStart = await state(page);

  await finishCurrentFloor(page, evidenceRuntime);
  await page.waitForFunction(() =>
    window.__DAI_EDITOR_SLICE__.getState().mode === 'result',
  null, { timeout: 30_000 });

  const result = await state(page);
  const resultText = await page.locator('#resultMetrics').innerText();
  const audioAtResult = await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.getAudioPresentation());

  const screenshotPath = path.join(outputDir, 'dai-099-refreshed-public.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await page.click('#returnEdit');
  await page.waitForFunction(() =>
    window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');
  const returned = await state(page);

  const audioElements = await page.locator("audio, source[type^='audio/']").count();
  const api200 = Object.fromEntries(
    ['/api/design-intent', '/api/natural-edit'].map((apiPath) => [
      apiPath,
      apiResponses.some((entry) => entry.path === apiPath && entry.status === 200),
    ]),
  );

  const roomEventsCentered =
    evidenceRuntime.roomEventObservations.length > 0 &&
    evidenceRuntime.roomEventObservations.every((entry) =>
      entry.checks.horizontalCentered &&
      entry.checks.offsetAboveViewportCenter &&
      entry.checks.insideViewport);

  const characterEnemyObserved = evidenceRuntime.characterObservations.some(
    (entry) => (entry?.enemies ?? []).length > 0,
  );
  const characterPlayerObserved = evidenceRuntime.characterObservations.some(
    (entry) =>
      typeof entry?.player?.roomId === 'string' &&
      Array.isArray(entry?.player?.partNames) &&
      entry.player.partNames.includes('head') &&
      entry.player.partNames.includes('torso'),
  );

  const checks = {
    httpsDeployment: editorUrl.startsWith('https://'),
    buildFingerprintEndpointAvailable:
      remoteBuildInfoStatus === 200 &&
      remoteBuildInfo?.schemaVersion === '1.0',
    publicRuntimeSourceMatchesLocalCandidate:
      remoteBuildInfo?.runtimeSourceSha256 ===
      localBuildInfo.runtimeSourceSha256,
    publicCommitMatchesLocalCandidate:
      typeof localBuildInfo.commitSha === 'string' &&
      localBuildInfo.commitSha.length === 40 &&
      remoteBuildInfo?.commitSha === localBuildInfo.commitSha,
    refreshedUiPresent:
      currentUi.testLabel.includes('Test') &&
      currentUi.mysteryLabel.includes('Mystery') &&
      currentUi.audioToggle &&
      currentUi.floorCountInput &&
      JSON.stringify(currentUi.statusLabels.slice(0, 4)) === JSON.stringify(['LV', 'HP', 'EXP', 'G']),
    initialEditorReady:
      initial.startAllowed === true &&
      initial.validationCriticalCount === 0,
    audioUnlocksFromUserGesture:
      audioAfterUnlock.available === true &&
      audioAfterUnlock.unlocked === true &&
      audioAfterUnlock.contextState === 'running',
    liveGenerationUsedCloud:
      generated.lastGeneration?.selectedProvider === 'cloud',
    generatedTwoFloors:
      generated.floorCount === 2 &&
      generated.floorSummaries?.length === 2 &&
      generated.lastGeneration?.floorCount === 2,
    generatedDungeonValid:
      generated.startAllowed === true &&
      generated.validationCriticalCount === 0,
    liveNaturalEditWorked:
      movedTreasure?.roomId === firstFloorGoal.roomId,
    bothApisReturned200:
      api200['/api/design-intent'] && api200['/api/natural-edit'],
    roomEventStackObservedCentered: roomEventsCentered,
    programmaticPlayerAndEnemyObserved:
      characterPlayerObserved && characterEnemyObserved,
    realCombatChangedPlayerState:
      afterEnemy.play.playerState.hp < initialPlayerState.hp &&
      (
        afterEnemy.play.playerState.xp > initialPlayerState.xp ||
        afterEnemy.play.playerState.gold > initialPlayerState.gold ||
        afterEnemy.play.playerState.level > initialPlayerState.level
      ),
    playerStateCarriesExactlyToFloorTwo:
      JSON.stringify(floorTwoStart.play?.playerState) ===
      JSON.stringify(carriedPlayerState),
    twoFloorRunClears:
      result.mode === 'result' &&
      result.run?.status === 'cleared' &&
      result.run?.floorsCompleted === 2 &&
      result.run?.currentFloorIndex === 1,
    resultShowsFloorCompletion: /(^|\n)Floors\n2\/2(\n|$)/.test(resultText),
    resultAudioModeCurrent:
      audioAtResult.activeMode === 'result-cleared' &&
      audioAtResult.lastCue === 'run-clear',
    noExternalAudioAssets:
      audioElements === 0 &&
      externalAudioRequests.length === 0 &&
      audioAtResult.provenance === 'project-authored-programmatic-web-audio',
    returnToEditPreservesTwoFloorAuthoring:
      returned.mode === 'edit' &&
      returned.floorCount === 2 &&
      returned.startAllowed === true,
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
    publicUrl: editorUrl,
    navigationReadyMs,
    passed: falseChecks.length === 0,
    checks,
    buildFingerprint: {
      local: localBuildInfo,
      remoteStatus: remoteBuildInfoStatus,
      remote: remoteBuildInfo,
      parseError: remoteBuildInfoParseError,
      bundleDiagnosticMatches:
        remoteBuildInfo?.runtimeBundleSha256 === localBuildInfo.runtimeBundleSha256,
    },
    falseChecks,
    currentUi,
    audioAfterUnlock,
    generation: {
      manualConfirmation,
      selectedProvider: generated.lastGeneration?.selectedProvider ?? null,
      floorCount: generated.lastGeneration?.floorCount ?? null,
      roomCount: generated.rooms.length,
      entityTypes: [...new Set(generated.entities.map((entity) => entity.type))].sort(),
    },
    translatedCommand: afterEdit.lastNaturalEditCommand,
    naturalEditStatus: naturalEditStatusText,
    playerState: {
      start: initialPlayerState,
      afterEnemy: afterEnemy.play.playerState,
      beforeFloorAdvance: carriedPlayerState,
      floorTwoStart: floorTwoStart.play?.playerState ?? null,
      final: result.run?.finalPlayerState ?? result.play?.playerState ?? null,
    },
    roomEventObservations: evidenceRuntime.roomEventObservations,
    characterObservations: evidenceRuntime.characterObservations,
    result: result.run,
    resultText,
    audioAtResult,
    apiResponses,
    externalAudioRequests,
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
    throw new Error('DAI-099 public evidence unexpectedly contains full prompt text.');
  }

  fs.writeFileSync(
    path.join(outputDir, 'dai-099-refreshed-public.json'),
    serialized + '\n',
  );
  console.log(serialized);

  if (!evidence.passed) {
    throw new Error(
      `DAI-099 refreshed public invariant failed: ${falseChecks.join(', ')}`,
    );
  }
} catch (error) {
  await captureBrowserFailure({ page, error, outputDir });
  throw error;
} finally {
  if (browser) await browser.close();
}
