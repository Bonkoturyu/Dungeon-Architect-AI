import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_MOBILE_SCOPE_PORT || '4186');
const outputDir = path.resolve('artifacts/mobile-scope');
const distDir = path.resolve('dist');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (!fs.existsSync(viteBin)) throw new Error('Vite is not installed.');
if (!fs.existsSync(path.join(distDir, 'index.html'))) throw new Error('dist/index.html missing. Run npm run build:hosting first.');
fs.mkdirSync(outputDir, { recursive: true });

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
  throw new Error(`DAI-075 preview server did not become ready.\n${viteOutput}`);
}

function errorCapture(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }); });
  return { consoleErrors, pageErrors, failedRequests, httpErrors };
}

async function readiness(page) {
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready === true && window.__DAI_ONBOARDING__?.ready === true, null, { timeout: 60_000 });
  return page.evaluate(() => {
    const notice = document.querySelector('#mobileScopeNotice');
    const start = document.querySelector('#start');
    const noticeStyle = getComputedStyle(notice);
    const startRect = start.getBoundingClientRect();
    const html = document.documentElement;
    return {
      editor: window.__DAI_EDITOR_SLICE__.getState(),
      onboarding: window.__DAI_ONBOARDING__.getState(),
      noticeVisible: noticeStyle.display !== 'none' && notice.getBoundingClientRect().height > 0,
      noticeText: notice.textContent.trim(),
      horizontalOverflowPx: Math.max(0, html.scrollWidth - window.innerWidth),
      startVisible: startRect.width > 0 && startRect.height > 0,
      startEnabled: start.disabled === false,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      maxTouchPoints: navigator.maxTouchPoints,
    };
  });
}

const url = `http://127.0.0.1:${port}/`;
let browser;
try {
  await waitForServer(url);
  browser = await chromium.launch({ executablePath: chromePath, headless: false });

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktopContext.newPage();
  const desktopErrors = errorCapture(desktopPage);
  await desktopPage.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  const desktop = await readiness(desktopPage);
  await desktopPage.screenshot({ path: path.join(outputDir, 'dai-075-desktop.png'), fullPage: true });
  await desktopContext.close();

  const narrowContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const narrowPage = await narrowContext.newPage();
  const narrowErrors = errorCapture(narrowPage);
  await narrowPage.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  const narrowBeforeClose = await readiness(narrowPage);
  await narrowPage.click('#onboardingClose');
  await narrowPage.waitForFunction(() => window.__DAI_ONBOARDING__.getState().open === false);
  const narrowAfterClose = await readiness(narrowPage);
  await narrowPage.screenshot({ path: path.join(outputDir, 'dai-075-narrow.png'), fullPage: true });
  await narrowContext.close();

  const limitationTextExpected =
    narrowBeforeClose.noticeText.includes('Desktop demo target') &&
    narrowBeforeClose.noticeText.includes('best-effort') &&
    narrowBeforeClose.noticeText.includes('not a supported judging target');

  const checks = {
    desktopEditorReadyAndValid:
      desktop.editor.startAllowed === true &&
      desktop.editor.validationCriticalCount === 0,
    desktopOnboardingReady:
      desktop.onboarding.open === true &&
      desktop.onboarding.step?.id === 'welcome',
    desktopScopeNoticeHidden: desktop.noticeVisible === false,
    desktopNoHorizontalOverflow: desktop.horizontalOverflowPx <= 1,
    desktopErrorsAbsent:
      desktopErrors.consoleErrors.length === 0 &&
      desktopErrors.pageErrors.length === 0 &&
      desktopErrors.failedRequests.length === 0 &&
      desktopErrors.httpErrors.length === 0,
    narrowEditorReadyAndValid:
      narrowBeforeClose.editor.startAllowed === true &&
      narrowBeforeClose.editor.validationCriticalCount === 0,
    narrowTouchEmulationActive: narrowBeforeClose.maxTouchPoints > 0,
    narrowScopeNoticeVisible: narrowBeforeClose.noticeVisible === true,
    narrowLimitationTextExplicit: limitationTextExpected,
    narrowNoHorizontalOverflow: narrowBeforeClose.horizontalOverflowPx <= 1,
    narrowOnboardingCloseWorks: narrowAfterClose.onboarding.open === false,
    narrowStartVisibleAndEnabled: narrowAfterClose.startVisible === true && narrowAfterClose.startEnabled === true,
    narrowErrorsAbsent:
      narrowErrors.consoleErrors.length === 0 &&
      narrowErrors.pageErrors.length === 0 &&
      narrowErrors.failedRequests.length === 0 &&
      narrowErrors.httpErrors.length === 0,
  };
  const passed = Object.values(checks).every(Boolean);

  const evidence = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    chromePath,
    browserVersion: browser.version(),
    url,
    passed,
    decisionCandidate: {
      supportedJudgingTarget: 'desktop Google Chrome on Windows',
      referenceViewport: { width: 1440, height: 900 },
      mobileScope: 'out-of-scope for submission acceptance; narrow layout is best-effort only',
      pceMobileTasks: 'N/A if DAI-075 is confirmed',
    },
    checks,
    desktop: {
      viewport: desktop.viewport,
      noticeVisible: desktop.noticeVisible,
      horizontalOverflowPx: desktop.horizontalOverflowPx,
      startVisible: desktop.startVisible,
      startEnabled: desktop.startEnabled,
      errors: desktopErrors,
    },
    narrow: {
      viewport: narrowBeforeClose.viewport,
      maxTouchPoints: narrowBeforeClose.maxTouchPoints,
      noticeVisible: narrowBeforeClose.noticeVisible,
      horizontalOverflowPx: narrowBeforeClose.horizontalOverflowPx,
      onboardingClosed: narrowAfterClose.onboarding.open === false,
      startVisible: narrowAfterClose.startVisible,
      startEnabled: narrowAfterClose.startEnabled,
      errors: narrowErrors,
    },
  };

  const evidencePath = path.join(outputDir, 'dai-075-mobile-scope.json');
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));

  if (!passed) throw new Error(`DAI-075 mobile-scope invariant failed: ${JSON.stringify(checks)}`);
} finally {
  if (browser) await browser.close();
  vite.kill();
}
