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
  const initialBackLabel = await page.locator('#onboardingBack').textContent();
  const initialNextLabel = await page.locator('#onboardingNext').textContent();
  const initialLanguageCycleLabel = await page.locator('#onboardingLanguageCycle').textContent();

  await page.locator('#onboardingNext').click();
  const afterDescribe = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());
  await page.locator('#onboardingNext').click();
  const afterEdit = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());
  await page.locator('#onboardingNext').click();
  const afterValidate = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());
  await page.locator('#onboardingBack').click();
  const afterBack = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());

  await page.locator('#onboardingLanguageCycle').click();
  const japanese = await page.evaluate(() => ({
    state: window.__DAI_ONBOARDING__.getState(),
    title: document.querySelector('#onboardingTitle')?.textContent ?? '',
    next: document.querySelector('#onboardingNext')?.textContent ?? '',
    htmlLang: document.documentElement.lang,
    cycleText: document.querySelector('#onboardingLanguageCycle')?.textContent ?? '',
  }));
  await page.locator('#onboardingLanguageCycle').click();
  const simplified = await page.evaluate(() => ({
    title: document.querySelector('#onboardingTitle')?.textContent ?? '',
    htmlLang: document.documentElement.lang,
    cycleText: document.querySelector('#onboardingLanguageCycle')?.textContent ?? '',
  }));
  await page.locator('#onboardingLanguageCycle').click();
  const traditional = await page.evaluate(() => ({
    title: document.querySelector('#onboardingTitle')?.textContent ?? '',
    htmlLang: document.documentElement.lang,
    cycleText: document.querySelector('#onboardingLanguageCycle')?.textContent ?? '',
  }));
  await page.locator('#onboardingLanguageCycle').click();
  const korean = await page.evaluate(() => ({
    title: document.querySelector('#onboardingTitle')?.textContent ?? '',
    htmlLang: document.documentElement.lang,
    cycleText: document.querySelector('#onboardingLanguageCycle')?.textContent ?? '',
  }));
  await page.locator('#onboardingLanguageCycle').click();

  await page.locator('#onboardingClose').click();
  const afterClose = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());
  const hiddenAfterClose = !(await page.locator('#onboarding').isVisible());

  await page.locator('#guide').click();
  const afterReopen = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());
  for (let index = 0; index < 4; index += 1) await page.locator('#onboardingNext').click();
  const finalStep = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());
  const doneLabel = await page.locator('#onboardingNext').textContent();
  await page.locator('#onboardingNext').click();
  const afterDone = await page.evaluate(() => window.__DAI_ONBOARDING__.getState());

  const startStillEnabled = await page.locator('#start').isEnabled();
  const result = {
    editorReadyAndValid: editorState.mode === 'edit' && editorState.startAllowed === true && editorState.validationCriticalCount === 0,
    opensAutomatically: initialVisible && initial.open === true && initial.step?.id === 'welcome' && initial.stepCount === 5 && initial.language === 'en',
    backDisabledAtFirstStep: backDisabledInitially,
    navigationSymbolsConsistent:
      initialBackLabel === '◀ Back' &&
      initialNextLabel === 'Next ▶' &&
      initialLanguageCycleLabel === 'EN ▶ 日本語',
    nextMovesToDescribe: afterDescribe.step?.id === 'describe' && afterDescribe.stepIndex === 1,
    nextMovesToEdit: afterEdit.step?.id === 'edit' && afterEdit.stepIndex === 2,
    nextMovesToValidate: afterValidate.step?.id === 'validate' && afterValidate.stepIndex === 3,
    backReturnsToEdit: afterBack.step?.id === 'edit' && afterBack.stepIndex === 2,
    japaneseSwitchWorks:
      japanese.state?.language === 'ja' &&
      japanese.htmlLang === 'ja' &&
      japanese.title === 'ダンジョンを調整' &&
      japanese.next === '次へ ▶' &&
      japanese.cycleText === '日本語 ▶ 简中',
    simplifiedChineseSwitchWorks:
      simplified.htmlLang === 'zh-Hans' &&
      simplified.title === '调整地牢' &&
      simplified.cycleText === '简中 ▶ 繁中',
    traditionalChineseSwitchWorks:
      traditional.htmlLang === 'zh-Hant' &&
      traditional.title === '調整地城' &&
      traditional.cycleText === '繁中 ▶ 한국어',
    koreanSwitchWorks:
      korean.htmlLang === 'ko' &&
      korean.title === '던전 조정' &&
      korean.cycleText === '한국어 ▶ EN',
    closeHidesGuide: afterClose.open === false && hiddenAfterClose,
    guideReopensAtWelcome: afterReopen.open === true && afterReopen.step?.id === 'welcome' && afterReopen.stepIndex === 0 && afterReopen.language === 'en',
    finalStepIsPlay: finalStep.step?.id === 'play' && finalStep.stepIndex === 4 && doneLabel === 'Done',
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
    japanese,
    simplified,
    traditional,
    korean,
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
