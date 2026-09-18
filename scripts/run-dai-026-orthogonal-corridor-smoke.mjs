import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_ORTHOGONAL_SMOKE_PORT || '4188');
const outputDir = path.resolve('artifacts/orthogonal-corridors');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');

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
  throw new Error(`orthogonal smoke server did not become ready.\n${viteOutput}`);
}

const url = `http://127.0.0.1:${port}/apps/orthogonal-corridor-smoke/index.html`;
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

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(() => window.__DAI_ORTHOGONAL_SMOKE__?.ready === true, null, { timeout: 60_000 });
  const result = await page.evaluate(() => window.__DAI_ORTHOGONAL_SMOKE__);

  const checks = {
    rendererReady: result.failed === false,
    allCorridorsOrthogonal: result.allCorridorsOrthogonal === true,
    allRoutesConflictFree: result.allRoutesConflictFree === true,
    distinctDoorSidesWherePossible: result.distinctDoorSidesWherePossible === true,
    logicalDiagonalsHaveBends: result.logicalDiagonalsHaveBends === true,
    publicDemoHasAlternateRoute: result.logicalDiagonalCorridorCount >= 1,
    browserErrorsAbsent:
      consoleErrors.length === 0 &&
      pageErrors.length === 0 &&
      failedRequests.length === 0 &&
      httpErrors.length === 0,
  };
  const passed = Object.values(checks).every(Boolean);

  await page.screenshot({
    path: path.join(outputDir, 'dai-026-orthogonal-corridors.png'),
    fullPage: true,
  });

  const evidence = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    chromePath,
    browserVersion: browser.version(),
    passed,
    checks,
    routeCount: result.routeCount,
    logicalDiagonalCorridorCount: result.logicalDiagonalCorridorCount,
    diagonalSegments: result.diagonalSegments,
    routeConflicts: result.routeConflicts,
    duplicateDoorSides: result.duplicateDoorSides,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };
  fs.writeFileSync(
    path.join(outputDir, 'dai-026-orthogonal-corridors.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!passed) throw new Error(`DAI-026 orthogonal corridor invariant failed: ${JSON.stringify(checks)}`);
} finally {
  if (browser) await browser.close();
  vite.kill();
}
