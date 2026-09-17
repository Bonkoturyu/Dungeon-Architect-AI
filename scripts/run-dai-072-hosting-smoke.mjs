import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_HOSTING_SMOKE_PORT || '4185');
const outputDir = path.resolve('artifacts/hosting');
const distDir = path.resolve('dist');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (!fs.existsSync(viteBin)) throw new Error('Vite is not installed.');
if (!fs.existsSync(path.join(distDir, 'index.html'))) throw new Error('dist/index.html missing. Run npm run build:hosting first.');
fs.mkdirSync(outputDir, { recursive: true });

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const indexPath = path.join(distDir, 'index.html');
const headersPath = path.join(distDir, '_headers');
const routesPath = path.join(distDir, '_routes.json');
const fixturePath = path.join(distDir, 'spec', 'dungeon', 'fixtures', 'minimal-valid-v1.json');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
const headers = fs.readFileSync(headersPath, 'utf8');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const assetFiles = fs.readdirSync(path.join(distDir, 'assets')).sort();

const vite = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
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
  throw new Error(`Vite preview did not become ready.\n${viteOutput}`);
}

const url = `http://127.0.0.1:${port}/`;
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
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready === true && window.__DAI_ONBOARDING__?.ready === true, null, { timeout: 60_000 });
  const beforeClose = await page.evaluate(() => ({
    editor: window.__DAI_EDITOR_SLICE__.getState(),
    onboarding: window.__DAI_ONBOARDING__.getState(),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  }));
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());
  const afterClose = await page.evaluate(() => ({
    editor: window.__DAI_EDITOR_SLICE__.getState(),
    onboarding: window.__DAI_ONBOARDING__.getState(),
  }));

  const sourceModuleLeak = beforeClose.resources.some((pathname) => pathname.startsWith('/apps/') || pathname.startsWith('/packages/'));
  const checks = {
    indexBuilt: indexHtml.includes('/assets/') && !indexHtml.includes('./main.js') && !indexHtml.includes('./onboarding.js'),
    assetsBuilt: assetFiles.some((name) => name.endsWith('.js')),
    fixtureCopied: fixture.id === 'fixture-minimal-valid-v1',
    securityHeadersPresent: headers.includes('Content-Security-Policy:') && headers.includes('X-Content-Type-Options: nosniff'),
    indexNoStoreConfigured: headers.includes('/index.html') && headers.includes('Cache-Control: no-store'),
    functionsRestrictedToApiRoutes:
      routes.version === 1 &&
      JSON.stringify(routes.include) === JSON.stringify(['/api/*']) &&
      Array.isArray(routes.exclude) && routes.exclude.length === 0,
    functionSourceNotInStaticDist: !fs.existsSync(path.join(distDir, 'functions')),
    editorReadyAndValid: beforeClose.editor.startAllowed === true && beforeClose.editor.validationCriticalCount === 0,
    onboardingReady: beforeClose.onboarding.open === true && beforeClose.onboarding.step?.id === 'welcome',
    onboardingCloseWorks: afterClose.onboarding.open === false,
    productionAssetsUsed: sourceModuleLeak === false,
    browserErrorsAbsent: consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0 && httpErrors.length === 0,
  };
  const passed = Object.values(checks).every(Boolean);

  const screenshotPath = path.join(outputDir, 'dai-072-hosting.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const evidence = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    chromePath,
    browserVersion: browser.version(),
    url,
    passed,
    checks,
    build: {
      indexSha256: sha256(indexPath),
      headersSha256: sha256(headersPath),
      routesSha256: sha256(routesPath),
      fixtureSha256: sha256(fixturePath),
      assets: assetFiles,
      routes,
    },
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };
  const evidencePath = path.join(outputDir, 'dai-072-hosting.json');
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));

  if (!passed) throw new Error(`DAI-072 hosting invariant failed: ${JSON.stringify(checks)}`);
} finally {
  if (browser) await browser.close();
  vite.kill();
}
