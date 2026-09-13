import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_SMOKE_PORT || '4173');
const outputDir = path.resolve('artifacts/renderer-smoke');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (!fs.existsSync(viteBin)) throw new Error('Vite is not installed. Run npm ci/npm install using the reviewed dependency graph first.');

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
  throw new Error(`Vite smoke server did not become ready.\n${viteOutput}`);
}

const url = `http://127.0.0.1:${port}/apps/renderer-smoke/index.html`;
let browser;
try {
  await waitForServer(url);
  browser = await chromium.launch({ executablePath: chromePath, headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
      httpErrors.push({ url: response.url(), status: response.status() });
    }
  });

  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => window.__DAI_RENDERER_SMOKE__?.ready === true, null, { timeout: 60_000 });
  const result = await page.evaluate(() => window.__DAI_RENDERER_SMOKE__);

  await page.screenshot({ path: path.join(outputDir, 'dai-014-renderer-smoke.png'), fullPage: true });

  const evidence = {
    generatedAt: new Date().toISOString(),
    chromePath,
    url,
    result,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };
  fs.writeFileSync(path.join(outputDir, 'dai-014-renderer-smoke.json'), JSON.stringify(evidence, null, 2));

  if (result.failed) throw new Error(result.message || 'renderer smoke reported failure');
  if (consoleErrors.length || pageErrors.length || failedRequests.length || httpErrors.length) {
    throw new Error(`browser smoke emitted errors: ${JSON.stringify({ consoleErrors, pageErrors, failedRequests, httpErrors })}`);
  }

  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (browser) await browser.close();
  vite.kill();
}
