import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const buildDir = path.resolve(process.env.DAI_UNITY_BUILD_DIR || '.tmp/unity-webgl-build');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const runs = Number(process.env.DAI_BENCH_RUNS || '5');
const outputDir = path.resolve('artifacts/renderer-benchmark');

if (!fs.existsSync(path.join(buildDir, 'index.html'))) {
  throw new Error(`Unity WebGL build not found: ${buildDir}`);
}
if (!fs.existsSync(chromePath)) {
  throw new Error(`Chrome not found: ${chromePath}`);
}

fs.mkdirSync(outputDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const filePath = path.join(buildDir, requestPath === '/' ? 'index.html' : requestPath.slice(1));

  if (!filePath.startsWith(buildDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const url = `http://127.0.0.1:${address.port}/`;

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: false,
  args: [
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ]
});

const results = [];

async function writeDiagnostics({ page, run, consoleMessages, consoleErrors, pageErrors, failedRequests, httpErrors, reason }) {
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const prefix = path.join(outputDir, `unity-diagnostic-run-${run}-${stamp}`);

  let pageState = null;
  let bodyText = null;
  try {
    pageState = await page.evaluate(() => ({
      href: location.href,
      readyState: document.readyState,
      benchmarkReady: window.__DAI_UNITY_BENCHMARK_READY__ ?? null,
      benchmarkStatus: window.__DAI_UNITY_BENCHMARK_STATUS__ ?? null,
      benchmark: window.__DAI_UNITY_BENCHMARK__ ?? null,
      canvasCount: document.querySelectorAll('canvas').length,
      unityCanvasExists: Boolean(document.querySelector('#unity-canvas')),
    }));
    bodyText = await page.locator('body').innerText().catch(() => null);
    await page.screenshot({ path: `${prefix}.png`, fullPage: true }).catch(() => {});
  } catch {
    // Keep whatever diagnostics were already captured.
  }

  const diagnostic = {
    generatedAt: new Date().toISOString(),
    run,
    reason,
    pageState,
    bodyText,
    consoleMessages,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(`${prefix}.json`, JSON.stringify(diagnostic, null, 2));
  console.error(`Unity benchmark diagnostic: ${prefix}.json`);
  if (fs.existsSync(`${prefix}.png`)) {
    console.error(`Unity benchmark screenshot: ${prefix}.png`);
  }
  console.error('Unity benchmark page state:', JSON.stringify(pageState));
  if (consoleErrors.length) console.error('Console errors:', consoleErrors);
  if (pageErrors.length) console.error('Page errors:', pageErrors);
  if (failedRequests.length) console.error('Failed requests:', failedRequests);
  if (httpErrors.length) console.error('HTTP errors:', httpErrors);
}

try {
  for (let run = 1; run <= runs; run += 1) {
    const context = await browser.newContext({
      viewport: { width: 960, height: 540 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    const httpErrors = [];

    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('DAI_BENCH_')) {
        consoleMessages.push(`${message.type()}: ${text}`);
        console.log(`[Unity browser] ${text}`);
      }
      if (message.type() === 'error') consoleErrors.push(text);
    });
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('requestfailed', (request) => {
      failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' });
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        httpErrors.push({ url: response.url(), status: response.status() });
      }
    });

    const started = performance.now();
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
      await page.waitForFunction(
        () => window.__DAI_UNITY_BENCHMARK_READY__ === true,
        null,
        { timeout: 180_000 }
      );
    } catch (error) {
      await writeDiagnostics({
        page,
        run,
        consoleMessages,
        consoleErrors,
        pageErrors,
        failedRequests,
        httpErrors,
        reason: String(error),
      });
      throw error;
    }

    const navigationCompleteMs = performance.now() - started;
    const metrics = await page.evaluate(() => window.__DAI_UNITY_BENCHMARK__);

    const invalidReasons = [];
    if (!metrics?.complete || metrics?.failed) invalidReasons.push(metrics?.failureMessage || metrics?.bridgeError || 'Unity benchmark reported failure');
    if ((metrics?.runtimeErrors ?? 0) > 0) invalidReasons.push(`runtimeErrors=${metrics.runtimeErrors}`);
    if (consoleErrors.length > 0) invalidReasons.push(`consoleErrors=${consoleErrors.length}`);
    if (pageErrors.length > 0) invalidReasons.push(`pageErrors=${pageErrors.length}`);
    if (failedRequests.length > 0) invalidReasons.push(`failedRequests=${failedRequests.length}`);
    if (httpErrors.length > 0) invalidReasons.push(`httpErrors=${httpErrors.length}`);

    if (invalidReasons.length > 0) {
      const reason = invalidReasons.filter(Boolean).join(', ');
      await writeDiagnostics({
        page,
        run,
        consoleMessages,
        consoleErrors,
        pageErrors,
        failedRequests,
        httpErrors,
        reason,
      });
      throw new Error(`Unity benchmark run ${run} is invalid: ${reason}`);
    }

    results.push({
      renderer: 'unity-webgl',
      run,
      navigationCompleteMs,
      consoleMessages,
      consoleErrors,
      pageErrors,
      failedRequests,
      httpErrors,
      ...metrics,
    });

    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

const generatedAt = new Date().toISOString();
const output = {
  generatedAt,
  node: process.version,
  chromePath,
  runs,
  buildDir,
  results,
};

const safe = generatedAt.replaceAll(':', '-');
const outputPath = path.join(outputDir, `unity-results-${safe}.json`);
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(outputPath);
