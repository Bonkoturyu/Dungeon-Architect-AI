import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';

const PORT = Number(process.env.DAI_BENCH_PORT ?? 4173);
const BASE = `http://127.0.0.1:${PORT}/benchmarks/renderers`;
const RUNS = Number(process.env.DAI_BENCH_RUNS ?? 5);

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

const chromePath = findChrome();
if (!chromePath) {
  throw new Error('Chrome/Chromium not found. Set CHROME_PATH.');
}

const viteBin = path.resolve('node_modules/vite/bin/vite.js');
if (!fs.existsSync(viteBin)) {
  throw new Error('Vite is not installed. Run npm install after dependency approval.');
}

const server = spawn(
  process.execPath,
  [viteBin, '--host', '127.0.0.1', '--port', String(PORT)],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/three.html`);
      if (response.ok) return;
    } catch {
      // Retry until timeout.
    }
    await wait(250);
  }
  throw new Error('Vite server did not become ready.');
}

const browser = await chromium.launch({ executablePath: chromePath, headless: true });

try {
  await waitForServer();
  const results = [];

  for (const renderer of ['three', 'babylon']) {
    for (let run = 1; run <= RUNS; run += 1) {
      const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
      const consoleErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => consoleErrors.push(error.message));

      const navigationStartedAt = performance.now();
      await page.goto(`${BASE}/${renderer}.html`, { waitUntil: 'load' });
      await page.waitForFunction(
        () => window.__DAI_BENCHMARK__?.complete === true,
        null,
        { timeout: 30000 },
      );
      const navigationCompleteMs = performance.now() - navigationStartedAt;
      const data = await page.evaluate(() => window.__DAI_BENCHMARK__);

      results.push({
        renderer,
        run,
        navigationCompleteMs,
        consoleErrors,
        ...data,
      });
      await page.close();
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    chromePath,
    runs: RUNS,
    results,
  };

  fs.mkdirSync('artifacts/renderer-benchmark', { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const file = `artifacts/renderer-benchmark/results-${timestamp}.json`;
  fs.writeFileSync(file, JSON.stringify(output, null, 2));
  console.log(file);
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
