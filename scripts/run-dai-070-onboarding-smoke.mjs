import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_ONBOARDING_SMOKE_PORT || '4183');
const outputDir = path.resolve('artifacts/onboarding');
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
  throw new Error(`Vite onboarding server did not become ready.\n${viteOutput}`);
}

const url = `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
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
  page.on('requestfailed', (request) => failedRequests.push({
    url: request.url(),
    failure: request.failure()?.errorText ?? 'unknown',
  }));
  page.on('response', (response) => {
    if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready === true && window.__DAI_ONBOARDING__?.ready === true, null, { timeout: 60_000 });

  const editorState = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  const initial = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());
  const initialVisible = await page.locator('#onboarding').isVisible();
  const backDisabledInitially = await page.locator('#onboardingBack').isDisabled();

  await page.locator('#onboardingNext').click();
  const afterEdit = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());
  await page.locator('#onboardingNext').click();
  const afterValidate = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());
  await page.locator('#onboardingBack').click();
  const afterBack = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());

  await page.locator('#onboardingClose').click();
  const afterClose = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());
  const hiddenAfterClose = !(await page.locator('#onboarding').isVisible());

  await page.locator('#guide').click();
  const afterReopen = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());
  for (let index = 0; index < 3; index += 1) await page.locator('#onboardingNext').click();
  const finalStep = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());
  const doneLabel = await page.locator('#onboardingNext').textContent();
  await page.locator('#onboardingNext').click();
  const afterDone = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());

  const startStillEnabled = await page.locator('#start').isEnabled();
  const result = {
    editorReadyAndValid: editorState.mode === 'edit' && editorState.startAllowed === true && editorState.validationCriticalCount === 0,
    opensAutomatically: initialVisible && initial.open === true && initial.step?.id === 'welcome' && initial.stepCount === 4,
    backDisabledAtFirstStep: backDisabledInitially,
    nextMovesToEdit: afterEdit.step?.id === 'edit' && afterEdit.stepIndex === 1,
    nextMovesToValidate: afterValidate.step?.id === 'validate' && afterValidate.stepIndex === 2,
    backReturnsToEdit: afterBack.step?.id === 'edit' && afterBack.stepIndex === 1,
    closeHidesGuide: afterClose.open === false && hiddenAfterClose,
    guideReopensAtWelcome: afterReopen.open === true && afterReopen.step?.id === 'welcome' && afterReopen.stepIndex === 0,
    finalStepIsPlay: finalStep.step?.id === 'play' && finalStep.stepIndex === 3 && doneLabel === 'Done',
    doneClosesGuide: afterDone.open === false,
    onboardingDoesNotBlockStartAfterClose: startStillEnabled,
  };

  const passed = Object.values(result).every(Boolean);
  const screenshotPath = path.join(outputDir, 'dai-070-onboarding.png');
  await page.locator('#guide').click();
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const evidence = {
    generatedAt: new Date().toISOString(),
    chromePath,
    url,
    passed,
    result,
    initial,
    finalStep,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };
  const evidencePath = path.join(outputDir, 'dai-070-onboarding.json');
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  if (!passed) throw new Error(`DAI-070 invariant failed: ${JSON.stringify(result)}`);
  if (consoleErrors.length || pageErrors.length || failedRequests.length || httpErrors.length) {
    throw new Error(`DAI-070 browser errors: ${JSON.stringify({ consoleErrors, pageErrors, failedRequests, httpErrors })}`);
  }

  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (browser) await browser.close();
  vite.kill();
}
