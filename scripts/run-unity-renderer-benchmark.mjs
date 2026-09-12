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
  });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const url = `http://127.0.0.1:${address.port}/`;

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: false,
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding']
});

const results = [];
try {
  for (let run = 1; run <= runs; run += 1) {
    const context = await browser.newContext({
      viewport: { width: 960, height: 540 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    const started = performance.now();
    await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
    await page.waitForFunction(
      () => window.__DAI_UNITY_BENCHMARK_READY__ === true &&
            window.__DAI_UNITY_BENCHMARK__?.complete === true,
      null,
      { timeout: 120_000 }
    );
    const navigationCompleteMs = performance.now() - started;
    const metrics = await page.evaluate(() => window.__DAI_UNITY_BENCHMARK__);

    results.push({
      renderer: 'unity-webgl',
      run,
      navigationCompleteMs,
      consoleErrors,
      pageErrors,
      ...metrics,
    });

    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

fs.mkdirSync(outputDir, { recursive: true });
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
