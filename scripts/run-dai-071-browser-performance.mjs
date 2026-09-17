import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_BROWSER_PERF_PORT || '4184');
const outputDir = path.resolve('artifacts/browser-performance');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const viewport = { width: 1440, height: 900 };

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (!fs.existsSync(viteBin)) throw new Error('Vite is not installed. Run npm ci using the reviewed dependency graph first.');
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
  throw new Error(`Vite browser-performance server did not become ready.\n${viteOutput}`);
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

const url = `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
let browser;
try {
  await waitForServer(url);
  browser = await chromium.launch({ executablePath: chromePath, headless: false });
  const browserVersion = browser.version();
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => {
    failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready === true, null, { timeout: 60_000 });
  const editorReady = await page.evaluate(() => ({
    elapsedMs: performance.now(),
    failed: window.__DAI_EDITOR_SLICE__.failed,
    message: window.__DAI_EDITOR_SLICE__.message ?? null,
    state: window.__DAI_EDITOR_SLICE__.getState?.() ?? null,
  }));
  if (editorReady.failed) throw new Error(editorReady.message || 'editor startup failed');

  await page.waitForFunction(() => window.__DAI_ONBOARDING__?.ready === true, null, { timeout: 60_000 });
  const onboardingReadyElapsedMs = await page.evaluate(() => performance.now());
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());
  await page.waitForFunction(() => window.__DAI_ONBOARDING__.getState().open === false);

  const browserSurface = await page.evaluate(() => {
    const canvas = document.querySelector('#renderCanvas');
    const rect = canvas.getBoundingClientRect();
    const memory = performance.memory;
    return {
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemoryGiB: navigator.deviceMemory ?? null,
      devicePixelRatio: window.devicePixelRatio,
      domNodeCount: document.querySelectorAll('*').length,
      canvas: {
        cssWidth: rect.width,
        cssHeight: rect.height,
        backingWidth: canvas.width,
        backingHeight: canvas.height,
        backingPixelCount: canvas.width * canvas.height,
      },
      heap: memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      } : null,
      editorState: window.__DAI_EDITOR_SLICE__.getState(),
    };
  });

  await page.waitForTimeout(100);
  const cadence = await page.evaluate(() => new Promise((resolve) => {
    const stamps = [];
    const start = performance.now();
    function frame(timestamp) {
      stamps.push(timestamp);
      if (stamps.length >= 121) {
        const intervals = [];
        for (let index = 1; index < stamps.length; index += 1) intervals.push(stamps[index] - stamps[index - 1]);
        resolve({ start, end: timestamp, intervals });
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }));

  const cadenceIntervals = cadence.intervals;
  const cadenceMetrics = {
    frameCount: cadenceIntervals.length,
    durationMs: round(cadence.end - cadence.start),
    medianMs: round(percentile(cadenceIntervals, 50)),
    p95Ms: round(percentile(cadenceIntervals, 95)),
    p99Ms: round(percentile(cadenceIntervals, 99)),
    maxMs: round(Math.max(...cadenceIntervals)),
  };

  const interactions = await page.evaluate(() => {
    const api = window.__DAI_EDITOR_SLICE__;
    const measurements = [];
    function measure(name, fn) {
      const started = performance.now();
      const ok = fn();
      const elapsedMs = performance.now() - started;
      const state = api.getState();
      measurements.push({ name, ok, elapsedMs, mode: state.mode });
      return state;
    }

    measure('select-room-middle', () => api.selectRoom('room-middle'));
    const afterStart = measure('start', () => api.startDungeon());
    const afterMiddle = measure('move-middle', () => api.movePlayToRoom('room-middle'));
    const afterGoal = measure('move-goal', () => api.movePlayToRoom('room-goal'));
    const afterReturn = measure('return-edit', () => api.returnToEdit());

    return {
      measurements,
      afterStart,
      afterMiddle,
      afterGoal,
      afterReturn,
    };
  });

  await page.waitForTimeout(100);

  const maxInteractionMs = Math.max(...interactions.measurements.map((entry) => entry.elapsedMs));
  const finalState = interactions.afterReturn;
  const result = {
    editorReadyWithinBudget: editorReady.elapsedMs <= 10_000,
    onboardingReadyWithinBudget: onboardingReadyElapsedMs <= 10_000,
    editorValidAndStartEligible: browserSurface.editorState.startAllowed === true && browserSurface.editorState.validationCriticalCount === 0,
    cadenceFrameCountExpected: cadenceMetrics.frameCount === 120,
    cadenceCompletesWithinBudget: cadenceMetrics.durationMs <= 5_000,
    cadenceP95WithinBudget: cadenceMetrics.p95Ms != null && cadenceMetrics.p95Ms < 100,
    localInteractionsWithinBudget: maxInteractionMs <= 250 && interactions.measurements.every((entry) => entry.ok === true),
    reachesExpectedResult: interactions.afterGoal.mode === 'result' && interactions.afterGoal.result?.status === 'cleared' && interactions.afterGoal.result?.moves === 2,
    returnsToValidEditMode: finalState.mode === 'edit' && finalState.startAllowed === true && finalState.validationCriticalCount === 0,
    domBounded: browserSurface.domNodeCount < 2_000,
    canvasBackingBounded: browserSurface.canvas.backingPixelCount <= viewport.width * viewport.height,
    browserErrorsAbsent: consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0 && httpErrors.length === 0,
  };

  const passed = Object.values(result).every(Boolean);
  const screenshotPath = path.join(outputDir, 'dai-071-browser-performance.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const evidence = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    chromePath,
    browserVersion,
    url,
    viewport,
    passed,
    result,
    startup: {
      editorReadyElapsedMs: round(editorReady.elapsedMs),
      onboardingReadyElapsedMs: round(onboardingReadyElapsedMs),
    },
    browserSurface,
    cadence: cadenceMetrics,
    interactions: interactions.measurements.map((entry) => ({ ...entry, elapsedMs: round(entry.elapsedMs) })),
    maxInteractionMs: round(maxInteractionMs),
    finalResult: interactions.afterGoal.result ?? null,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  const evidencePath = path.join(outputDir, 'dai-071-browser-performance.json');
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  console.log(JSON.stringify(evidence, null, 2));
  if (!passed) throw new Error(`DAI-071 invariant failed: ${JSON.stringify(result)}`);
} finally {
  if (browser) await browser.close();
  vite.kill();
}
