import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawn, spawnSync } from 'node:child_process';
import { stdin as input, stdout as output } from 'node:process';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = String(
  process.env.DAI_PUBLIC_URL || 'https://dungeon-architect-ai.pages.dev/',
).replace(/\/+$/, '') + '/';
const outputDir = path.resolve('artifacts/dai-099-video');
const generationPrompt =
  'Create a fair but tense two-floor dungeon with exploration, combat, readable traps, and dangerous rewards.';
const editPrompt = 'Move the treasure to the room that contains the goal.';
const auto = process.env.DAI_RECORDING_AUTOCLOSE === '1';
const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';
const capturePath = path.join(outputDir, 'dai-099-refreshed-demo.mp4');

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
fs.mkdirSync(outputDir, { recursive: true });

const ffmpegProbe = spawnSync(ffmpegPath, ['-version'], {
  windowsHide: true,
  encoding: 'utf8',
});
const ffprobeProbe = spawnSync(ffprobePath, ['-version'], {
  windowsHide: true,
  encoding: 'utf8',
});
const ffmpegAvailable = !ffmpegProbe.error && ffmpegProbe.status === 0;
const ffprobeAvailable = !ffprobeProbe.error && ffprobeProbe.status === 0;
const useFfmpeg =
  process.env.DAI_RECORD_WITH_FFMPEG !== '0' &&
  ffmpegAvailable;

const rl = readline.createInterface({ input, output });
const marks = [];
let startedAt = null;
let ffmpegProcess = null;
let ffmpegStderr = '';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function elapsedMs() {
  return startedAt === null ? 0 : Math.round(performance.now() - startedAt);
}

function mark(stage, extra = {}) {
  const entry = { stage, elapsedMs: elapsedMs(), ...extra };
  marks.push(entry);
  console.log(`[${String(Math.floor(entry.elapsedMs / 1000)).padStart(3, ' ')}s] ${stage}`);
}

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

async function clickSpec(page, specId) {
  const point = await page.evaluate(
    (id) => window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId(id),
    specId,
  );
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error(`${specId} screen position unavailable`);
  }
  await page.mouse.move(point.x, point.y, { steps: 12 });
  await wait(250);
  await page.mouse.click(point.x, point.y);
}

async function resolveBlockingEvents(page) {
  let guard = 0;
  while (guard < 30) {
    guard += 1;

    const enemy = page.locator(
      '.room-event.is-blocking [data-action="clear-enemy"]',
    ).first();
    if (await enemy.count()) {
      mark('room-event-enemy-visible');
      await wait(900);
      await enemy.click();
      mark('room-event-enemy-cleared');
      await wait(900);
      continue;
    }

    const trap = page.locator(
      '.room-event.is-blocking [data-action="avoid-trap"]',
    ).first();
    if (await trap.count()) {
      mark('room-event-trap-visible');
      await wait(700);
      await trap.click();
      mark('room-event-trap-resolved');
      await wait(700);
      continue;
    }

    return;
  }

  throw new Error('Blocking room-event resolution exceeded guard.');
}

async function clickExitToRoom(page, targetRoomId) {
  const before = await state(page);
  const beforeFloor = before.play?.floorIndex ?? -1;

  const corridorId = before.play?.map?.currentExits
    ?.find((exit) => exit.targetRoomId === targetRoomId)?.corridorId ?? null;

  if (!corridorId) {
    throw new Error(`No current CHOOSE EXIT button targets ${targetRoomId}`);
  }

  const button = page.locator(
    `#playExitButtons .exit-button[data-corridor-id="${corridorId}"]`,
  );
  await button.waitFor({ state: 'visible', timeout: 10_000 });
  await wait(450);
  await button.click();

  await page.waitForFunction(({ expectedRoom, expectedFloor }) => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return (
      s.mode === 'result' ||
      (s.play?.floorIndex ?? -1) > expectedFloor ||
      s.play?.currentRoomId === expectedRoom
    );
  }, { expectedRoom: targetRoomId, expectedFloor: beforeFloor }, {
    timeout: 10_000,
  });

  mark('play-room-reached', {
    targetRoomId,
    corridorId,
  });
  await wait(850);
}

async function traverse(page, route) {
  for (const target of route.slice(1)) {
    await resolveBlockingEvents(page);
    await clickExitToRoom(page, target);
  }
}

async function getViewportCaptureRegion(page) {
  return page.evaluate(() => {
    const dpr = window.devicePixelRatio || 1;
    const horizontalChrome = Math.max(0, window.outerWidth - window.innerWidth);
    const verticalChrome = Math.max(0, window.outerHeight - window.innerHeight);
    const fullscreenLike =
      horizontalChrome <= 2 &&
      verticalChrome <= 2 &&
      Math.abs(window.screenX) <= 2 &&
      Math.abs(window.screenY) <= 2;

    let x;
    let y;
    let rawWidth;
    let rawHeight;

    if (fullscreenLike) {
      x = 0;
      y = 0;
      rawWidth = Math.round(window.innerWidth * dpr);
      rawHeight = Math.round(window.innerHeight * dpr);
    } else {
      x = Math.round(window.screenX * dpr);
      const estimatedTopChrome = Math.max(0, verticalChrome - 2);
      y = Math.round((window.screenY + estimatedTopChrome) * dpr);
      rawWidth = Math.round((window.innerWidth + Math.min(horizontalChrome, 4)) * dpr);
      rawHeight = Math.round(window.innerHeight * dpr);
    }

    return {
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.max(2, Math.floor(rawWidth / 2) * 2),
      height: Math.max(2, Math.floor(rawHeight / 2) * 2),
      dpr,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      screenX: window.screenX,
      screenY: window.screenY,
      fullscreenLike,
    };
  });
}

function startFfmpegCapture(region) {
  if (!useFfmpeg) return false;

  ffmpegProcess = spawn(ffmpegPath, [
    '-y',
    '-f', 'gdigrab',
    '-framerate', '30',
    '-draw_mouse', '1',
    '-offset_x', String(region.x),
    '-offset_y', String(region.y),
    '-video_size', `${region.width}x${region.height}`,
    '-i', 'desktop',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    capturePath,
  ], {
    windowsHide: true,
    stdio: ['pipe', 'ignore', 'pipe'],
  });

  ffmpegProcess.stderr.on('data', (chunk) => {
    ffmpegStderr += chunk.toString();
    if (ffmpegStderr.length > 20000) ffmpegStderr = ffmpegStderr.slice(-20000);
  });

  return true;
}

async function stopFfmpegCapture() {
  if (!ffmpegProcess) return;

  const processToStop = ffmpegProcess;
  ffmpegProcess = null;
  const stopped = new Promise((resolve) => processToStop.once('exit', resolve));

  try {
    processToStop.stdin.write('q\n');
  } catch {
    processToStop.kill('SIGTERM');
  }

  await Promise.race([stopped, wait(8000)]);
  if (processToStop.exitCode === null) processToStop.kill('SIGTERM');
}

function probeCapture(filePath) {
  if (!ffprobeAvailable || !fs.existsSync(filePath)) return null;

  const result = spawnSync(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration,size',
    '-show_entries', 'stream=codec_type,width,height,r_frame_rate',
    '-of', 'json',
    filePath,
  ], {
    windowsHide: true,
    encoding: 'utf8',
  });

  if (result.status !== 0) return null;

  try {
    const parsed = JSON.parse(result.stdout);
    return {
      durationSeconds: Number(parsed.format?.duration ?? 0),
      sizeBytes: Number(parsed.format?.size ?? 0),
      streams: parsed.streams ?? [],
    };
  } catch {
    return null;
  }
}

let browser;
try {
  browser = await chromium.launch({
    executablePath: chromePath,
    headless: false,
    args: [
      '--no-first-run',
      '--disable-session-crashed-bubble',
      '--disable-extensions',
      '--disable-features=Translate,TranslateUI',
      '--disable-translate',
      '--window-position=0,0',
    ],
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  try {
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'fullscreen' },
    });
  } catch {
    try {
      const { windowId } = await cdp.send('Browser.getWindowForTarget');
      await cdp.send('Browser.setWindowBounds', {
        windowId,
        bounds: { windowState: 'maximized' },
      });
    } catch {}
  }

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];

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
      httpErrors.push({ url: response.url(), status: response.status() });
    }
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForFunction(
    () =>
      window.__DAI_EDITOR_SLICE__?.ready === true &&
      window.__DAI_ONBOARDING__?.ready === true,
    null,
    { timeout: 60_000 },
  );

  await page.bringToFront();
  await wait(700);
  const viewportCaptureRegion = await getViewportCaptureRegion(page);

  if (useFfmpeg) {
    startFfmpegCapture(viewportCaptureRegion);
    await wait(1200);
    if (ffmpegProcess?.exitCode !== null) {
      throw new Error(
        `ffmpeg exited before recording started. ${ffmpegStderr.slice(-2000)}`,
      );
    }
  } else if (!auto) {
    console.log('ffmpeg automatic capture unavailable or disabled.');
    await rl.question('Start your recorder, then press Enter to begin... ');
  }

  startedAt = performance.now();
  mark('recording-begin');
  await wait(1500);

  await page.evaluate(() => window.__DAI_ONBOARDING__.close());
  mark('guide-closed');
  await wait(600);

  await page.fill('#generationPrompt', generationPrompt);
  await page.fill('#floorCount', '2');
  mark('generation-prompt-entered');
  await wait(600);

  await page.click('#generateDungeon');
  mark('generate-clicked');

  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return (
      s.generationBusy === false &&
      s.lastGeneration?.selectedProvider === 'cloud' &&
      s.floorCount === 2
    );
  }, null, { timeout: 120_000 });

  const generated = await state(page);
  mark('two-floor-dungeon-generated', {
    floorCount: generated.floorCount,
    roomCount: generated.rooms.length,
  });
  await wait(1600);

  await page.click('[data-workflow-tab="edit"]');
  await page.waitForFunction(() =>
    window.__DAI_EDITOR_SLICE__.getState().workflowTab === 'edit');
  mark('edit-revealed');
  await wait(900);

  const middleRoomId = generated.rooms[Math.floor(generated.rooms.length / 2)]?.id;
  if (middleRoomId) {
    await clickSpec(page, middleRoomId);
    mark('manual-room-selected', { roomId: middleRoomId });
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    mark('manual-room-moved');
    await wait(700);
    await page.keyboard.press('Control+Z');
    mark('manual-edit-undone');
    await wait(700);
  }

  const goal = generated.entities.find((entity) => entity.type === 'goal');
  const treasure = generated.entities.find((entity) => entity.type === 'treasure');
  if (!goal || !treasure) throw new Error('Generated floor missing goal or treasure.');

  await page.fill('#naturalEditInput', editPrompt);
  mark('natural-edit-prompt-entered');
  await wait(500);

  await page.click('#applyNaturalEdit');
  mark('natural-edit-clicked');
  await page.waitForFunction(({ treasureId, goalRoomId }) => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return (
      s.naturalEditBusy === false &&
      s.entities.find((entity) => entity.id === treasureId)?.roomId === goalRoomId
    );
  }, {
    treasureId: treasure.id,
    goalRoomId: goal.roomId,
  }, { timeout: 120_000 });
  mark('natural-edit-applied');
  await wait(1000);

  await page.click('[data-workflow-tab="play"]');
  await page.waitForFunction(() =>
    window.__DAI_EDITOR_SLICE__.getState().workflowTab === 'play');
  mark('play-choice-visible');
  await wait(900);

  await page.click('#start');
  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.mode === 'play' && s.run?.floorCount === 2 && s.play?.floorIndex === 0;
  }, null, { timeout: 30_000 });
  mark('test-started');
  await wait(1100);

  let play = await state(page);
  const enemyRooms = [...new Set(
    play.play.snapshot.entities
      .filter((entity) => entity.type === 'enemy')
      .map((entity) => entity.roomId),
  )];

  if (enemyRooms.length > 0) {
    const enemyRoute = shortestPath(
      play.play.snapshot,
      play.play.currentRoomId,
      enemyRooms,
    );
    if (enemyRoute.length > 0) {
      await traverse(page, enemyRoute);
      await resolveBlockingEvents(page);
      mark('programmatic-combat-shown');
      await wait(800);
    }
  }

  play = await state(page);
  let route = shortestPath(
    play.play.snapshot,
    play.play.currentRoomId,
    [play.play.goalRoomId],
  );
  if (route.length < 2) throw new Error('No route to Floor 1 goal.');
  await traverse(page, route);

  await page.waitForFunction(() =>
    window.__DAI_EDITOR_SLICE__.getState().play?.floorIndex === 1,
  null, { timeout: 15_000 });
  mark('floor-two-started');
  await wait(1100);

  play = await state(page);
  route = shortestPath(
    play.play.snapshot,
    play.play.currentRoomId,
    [play.play.goalRoomId],
  );
  if (route.length < 2) throw new Error('No route to Floor 2 goal.');
  await traverse(page, route);

  await page.waitForFunction(() =>
    window.__DAI_EDITOR_SLICE__.getState().mode === 'result',
  null, { timeout: 30_000 });

  const result = await state(page);
  mark('two-floor-run-cleared', {
    floorsCompleted: result.run?.floorsCompleted ?? null,
  });
  await wait(1800);

  await page.click('#returnEdit');
  await page.waitForFunction(() =>
    window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');
  mark('returned-to-edit');
  await wait(1000);

  const screenshotPath = path.join(outputDir, 'dai-099-recording-end.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const finished = await state(page);
  const demoDurationMs = elapsedMs();

  const checks = {
    publicHttps: baseUrl.startsWith('https://'),
    liveGenerationUsedCloud:
      generated.lastGeneration?.selectedProvider === 'cloud',
    generatedTwoFloors:
      generated.floorCount === 2,
    naturalEditApplied:
      finished.lastNaturalEditCommand?.type === 'move-entity',
    currentTestFlowUsed:
      marks.some((entry) => entry.stage === 'test-started'),
    roomEventOrCombatShown:
      marks.some((entry) =>
        entry.stage === 'room-event-enemy-visible' ||
        entry.stage === 'room-event-trap-visible' ||
        entry.stage === 'programmatic-combat-shown'),
    secondFloorShown:
      marks.some((entry) => entry.stage === 'floor-two-started'),
    runCleared:
      result.run?.status === 'cleared' &&
      result.run?.floorsCompleted === 2,
    returnedToEdit:
      finished.mode === 'edit',
    browserErrorsAbsent:
      consoleErrors.length === 0 &&
      pageErrors.length === 0 &&
      failedRequests.length === 0 &&
      httpErrors.length === 0,
    scriptedDemoUnder165Seconds:
      demoDurationMs < 165_000,
  };

  const evidence = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    publicUrl: baseUrl,
    browserVersion: browser.version(),
    passed: Object.values(checks).every(Boolean),
    scriptedDemoDurationMs: demoDurationMs,
    scriptedDemoDurationSeconds: Math.round(demoDurationMs / 100) / 10,
    checks,
    marks,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
    recordingBoundary: {
      hardSubmissionLimitSeconds: 180,
      internalTargetMaxSeconds: 165,
      captureMode: useFfmpeg ? 'browser-viewport-region' : 'manual',
      viewportCaptureRegion,
      actualVideoFileValidated: false,
    },
  };

  if (useFfmpeg) {
    await stopFfmpegCapture();
    const captureProbe = probeCapture(capturePath);
    evidence.recordingBoundary.actualVideoFileCreated = fs.existsSync(capturePath);
    evidence.recordingBoundary.capturePath = capturePath;
    evidence.recordingBoundary.ffprobeAvailable = ffprobeAvailable;
    evidence.recordingBoundary.captureProbe = captureProbe;

    evidence.checks.actualCaptureCreated =
      evidence.recordingBoundary.actualVideoFileCreated === true;
    evidence.checks.captureViewportNotNarrow =
      viewportCaptureRegion.innerWidth >= 1280 &&
      viewportCaptureRegion.innerHeight >= 720;
    evidence.checks.captureIsBrowserViewportOnly =
      evidence.recordingBoundary.captureMode === 'browser-viewport-region';
    evidence.checks.actualCaptureUnder180Seconds =
      captureProbe === null ||
      (
        Number.isFinite(captureProbe.durationSeconds) &&
        captureProbe.durationSeconds > 0 &&
        captureProbe.durationSeconds < 180
      );
    evidence.passed = Object.values(evidence.checks).every(Boolean);
  }

  fs.writeFileSync(
    path.join(outputDir, 'dai-099-recording-run.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );

  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(
      `DAI-099 recording invariant failed: ${JSON.stringify(evidence.checks)}`,
    );
  }
} finally {
  if (ffmpegProcess) {
    try {
      await stopFfmpegCapture();
    } catch {}
  }
  if (browser) await browser.close();
  rl.close();
}
