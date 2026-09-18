import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawn, spawnSync } from 'node:child_process';
import { stdin as input, stdout as output } from 'node:process';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = String(process.env.DAI_PUBLIC_URL || 'https://dungeon-architect-ai.pages.dev/').replace(/\/+$/, '') + '/';
const outputDir = path.resolve('artifacts/video');
const generationPrompt = 'Create a fair but tense 5-minute dungeon with exploration and a few dangerous rewards.';
const editPrompt = 'Move the treasure to the room that contains the goal.';
const auto = process.env.DAI_RECORDING_AUTOCLOSE === '1';
const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';
const ffmpegProbe = spawnSync(ffmpegPath, ['-version'], { windowsHide: true, encoding: 'utf8' });
const ffprobeProbe = spawnSync(ffprobePath, ['-version'], { windowsHide: true, encoding: 'utf8' });
const ffmpegAvailable = !ffmpegProbe.error && ffmpegProbe.status === 0;
const ffprobeAvailable = !ffprobeProbe.error && ffprobeProbe.status === 0;
const useFfmpeg = process.env.DAI_RECORD_WITH_FFMPEG !== '0' && ffmpegAvailable;
const capturePath = path.join(outputDir, 'dai-082-demo-capture.mp4');
let ffmpegProcess = null;
let ffmpegStderr = '';

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
fs.mkdirSync(outputDir, { recursive: true });

const rl = readline.createInterface({ input, output });
const marks = [];
let startedAt = null;

function elapsedMs() {
  return startedAt === null ? 0 : Math.round(performance.now() - startedAt);
}

function mark(stage, extra = {}) {
  const entry = { stage, elapsedMs: elapsedMs(), ...extra };
  marks.push(entry);
  console.log(`[${String(Math.floor(entry.elapsedMs / 1000)).padStart(3, ' ')}s] ${stage}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickSpec(page, specId) {
  const point = await page.evaluate((id) => window.__DAI_EDITOR_SLICE__.getScreenPositionForSpecId(id), specId);
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error(`${specId} screen position unavailable: ${JSON.stringify(point)}`);
  }
  await page.mouse.move(point.x, point.y, { steps: 16 });
  await wait(350);
  await page.mouse.click(point.x, point.y);
}

async function gate(page) {
  return page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
}

function startFfmpegCapture() {
  if (!useFfmpeg) return false;
  ffmpegProcess = spawn(ffmpegPath, [
    '-y',
    '-f', 'gdigrab',
    '-framerate', '30',
    '-draw_mouse', '1',
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
  const stopped = new Promise((resolve) => {
    processToStop.once('exit', resolve);
  });
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
    args: ['--start-maximized'],
  });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }); });

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready === true && window.__DAI_ONBOARDING__?.ready === true, null, { timeout: 60_000 });

  console.log('');
  console.log('DAI-082 recording runner ready.');
  if (useFfmpeg) {
    console.log(`ffmpeg detected. Recording will be written automatically to: ${capturePath}`);
    startFfmpegCapture();
    await wait(1200);
    if (ffmpegProcess?.exitCode !== null) {
      throw new Error(`ffmpeg exited before recording started. ${ffmpegStderr.slice(-2000)}`);
    }
  } else {
    console.log('ffmpeg automatic capture is unavailable or disabled.');
    console.log('Start any screen recorder now, then continue.');
    if (!auto) await rl.question('Press Enter to begin the scripted demo... ');
  }
  startedAt = performance.now();
  mark('recording-begin');
  mark('live-demo-ready');
  await wait(3500);

  await page.evaluate(() => window.__DAI_ONBOARDING__.close());
  mark('guide-closed');
  await wait(1200);

  const generationInput = page.locator('#generationPrompt');
  await generationInput.click();
  await generationInput.pressSequentially(generationPrompt, { delay: 18 });
  mark('generation-prompt-entered');
  await wait(1800);

  await page.click('#generateDungeon');
  mark('generate-clicked');
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.generationBusy === false && state.lastGeneration && state.rooms.length >= 5;
  }, null, { timeout: 120_000 });
  const generated = await gate(page);
  mark('dungeon-generated', {
    roomCount: generated.rooms.length,
    entityCount: generated.entities.length,
    provider: generated.lastGeneration?.selectedProvider ?? null,
  });
  await wait(5000);

  const middleRoomId = generated.rooms[Math.floor(generated.rooms.length / 2)]?.id;
  if (middleRoomId) {
    await clickSpec(page, middleRoomId);
    mark('manual-room-selected', { roomId: middleRoomId });
    await wait(1200);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    mark('manual-room-moved');
    await wait(2500);
    await page.keyboard.press('Control+Z');
    mark('manual-edit-undone');
    await wait(1800);
  }

  const editInput = page.locator('#naturalEditInput');
  await editInput.click();
  await editInput.pressSequentially(editPrompt, { delay: 18 });
  mark('natural-edit-prompt-entered');
  await wait(1600);

  await page.click('#applyNaturalEdit');
  mark('natural-edit-clicked');
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    const goal = state.entities.find((entity) => entity.type === 'goal');
    const treasure = state.entities.find((entity) => entity.type === 'treasure');
    return state.naturalEditBusy === false && goal && treasure && treasure.roomId === goal.roomId;
  }, null, { timeout: 120_000 });
  mark('natural-edit-applied');
  await wait(3500);

  await page.click('#start');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'play', null, { timeout: 30_000 });
  mark('play-started');
  await wait(2200);

  const playState = await gate(page);
  const goalRoomId = playState.play?.goalRoomId;
  const orderedRooms = playState.rooms
    .map((room) => room.id)
    .filter((id) => /^room-\d+$/.test(id))
    .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));

  for (const roomId of orderedRooms.slice(1)) {
    await clickSpec(page, roomId);
    await wait(1300);
    const state = await gate(page);
    if (state.result?.status === 'cleared') break;
  }

  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().result?.status === 'cleared', null, { timeout: 30_000 });
  const cleared = await gate(page);
  mark('goal-cleared', {
    moves: cleared.result?.moves ?? null,
    goalRoomId,
  });
  await wait(5000);

  await page.click('#returnEdit');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');
  mark('returned-to-edit');
  await wait(4000);

  const screenshotPath = path.join(outputDir, 'dai-082-recording-end.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const finished = await gate(page);
  const demoDurationMs = elapsedMs();
  const checks = {
    publicHttps: baseUrl.startsWith('https://'),
    liveGenerationUsedCloud: generated.lastGeneration?.selectedProvider === 'cloud',
    generatedDungeonValid: generated.startAllowed === true && generated.validationCriticalCount === 0,
    naturalEditApplied: finished.lastNaturalEditCommand?.type === 'move-entity',
    resultCleared: cleared.result?.status === 'cleared',
    returnedToEdit: finished.mode === 'edit',
    browserErrorsAbsent:
      consoleErrors.length === 0 &&
      pageErrors.length === 0 &&
      failedRequests.length === 0 &&
      httpErrors.length === 0,
    scriptedDemoUnder165Seconds: demoDurationMs < 165_000,
  };

  const evidence = {
    generatedAt: new Date().toISOString(),
    publicUrl: baseUrl,
    chromePath,
    browserVersion: browser.version(),
    passed: Object.values(checks).every(Boolean),
    scriptedDemoDurationMs: demoDurationMs,
    scriptedDemoDurationSeconds: Math.round(demoDurationMs / 100) / 10,
    checks,
    generation: generated.lastGeneration,
    result: cleared.result,
    marks,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
    recordingBoundary: {
      actualVideoFileValidated: false,
      targetFinalVideoSeconds: 150,
      hardSubmissionLimitSeconds: 180,
    },
  };

  fs.writeFileSync(
    path.join(outputDir, 'dai-082-recording-run.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );

  if (useFfmpeg) {
    await stopFfmpegCapture();
    const captureProbe = probeCapture(capturePath);
    evidence.recordingBoundary.actualVideoFileCreated = fs.existsSync(capturePath);
    evidence.recordingBoundary.capturePath = capturePath;
    evidence.recordingBoundary.ffprobeAvailable = ffprobeAvailable;
    evidence.recordingBoundary.captureProbe = captureProbe;
    evidence.checks.actualCaptureCreated = evidence.recordingBoundary.actualVideoFileCreated === true;
    if (captureProbe) {
      evidence.checks.actualCaptureUnder180Seconds =
        Number.isFinite(captureProbe.durationSeconds) &&
        captureProbe.durationSeconds > 0 &&
        captureProbe.durationSeconds < 180;
    }
    evidence.passed = Object.values(evidence.checks).every(Boolean);
    fs.writeFileSync(
      path.join(outputDir, 'dai-082-recording-run.json'),
      JSON.stringify(evidence, null, 2) + '\n',
    );
  }

  console.log('');
  console.log(`Scripted demo complete in ${evidence.scriptedDemoDurationSeconds}s.`);
  if (useFfmpeg) {
    console.log(`ffmpeg capture complete: ${capturePath}`);
  } else {
    console.log('Stop the screen recording now.');
  }
  console.log('Upload the recorded video so its real duration and contents can be checked.');
  if (!auto && !useFfmpeg) await rl.question('Press Enter to close Chrome... ');

  if (!evidence.passed) {
    throw new Error(`DAI-082 recording run failed: ${JSON.stringify(checks)}`);
  }
} finally {
  await stopFfmpegCapture();
  rl.close();
  if (browser) await browser.close();
}
