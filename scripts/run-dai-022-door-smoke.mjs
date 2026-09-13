import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_DOOR_SMOKE_PORT || '4176');
const outputDir = path.resolve('artifacts/door-smoke');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');

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
  throw new Error(`Vite door-smoke server did not become ready.\n${viteOutput}`);
}

const url = `http://127.0.0.1:${port}/apps/door-smoke/index.html`;
let browser;
try {
  await waitForServer(url);
  browser = await chromium.launch({ executablePath: chromePath, headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(() => window.__DAI_DOOR_SMOKE__?.ready === true, null, { timeout: 60_000 });
  const result = await page.evaluate(() => window.__DAI_DOOR_SMOKE__);

  const screenshotPath = path.join(outputDir, 'dai-022-door-smoke.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const evidence = {
    generatedAt: new Date().toISOString(),
    chromePath,
    url,
    passed: !result.failed && result.missingOpenings?.length === 0,
    result,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };
  const evidencePath = path.join(outputDir, 'dai-022-door-smoke.json');
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  if (!evidence.passed) throw new Error(result.message || `door smoke invariant failed: ${JSON.stringify(result)}`);
  if (consoleErrors.length || pageErrors.length || failedRequests.length || httpErrors.length) {
    throw new Error(`door smoke emitted errors: ${JSON.stringify({ consoleErrors, pageErrors, failedRequests, httpErrors })}`);
  }

  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (browser) await browser.close();
  vite.kill();
}
