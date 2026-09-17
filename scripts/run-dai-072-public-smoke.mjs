import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const rawBaseUrl = String(process.env.DAI_PUBLIC_URL || '').trim();
const outputDir = path.resolve('artifacts/hosting-public');
const testPrompt = 'Move the treasure to the room that contains the goal.';

if (!rawBaseUrl) throw new Error('DAI_PUBLIC_URL is required for DAI-072 public deployment validation.');
if (!/^https:\/\//i.test(rawBaseUrl)) throw new Error('DAI_PUBLIC_URL must be an https:// URL.');
if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
fs.mkdirSync(outputDir, { recursive: true });

const baseUrl = rawBaseUrl.replace(/\/+$/, '');
const editorUrl = `${baseUrl}/`;

function entityRoom(state, id) {
  return state.entities.find((entity) => entity.id === id)?.roomId ?? null;
}

let browser;
try {
  browser = await chromium.launch({ executablePath: chromePath, headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  const apiResponses = [];

  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => {
    if (response.url().includes('/api/natural-edit')) {
      apiResponses.push({ url: response.url(), status: response.status() });
    }
    if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
  });

  const navigationStarted = performance.now();
  await page.goto(editorUrl, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready === true && window.__DAI_ONBOARDING__?.ready === true, null, { timeout: 60_000 });
  const navigationReadyMs = performance.now() - navigationStarted;

  const initial = await page.evaluate(() => ({
    editor: window.__DAI_EDITOR_SLICE__.getState(),
    onboarding: window.__DAI_ONBOARDING__.getState(),
    href: location.href,
  }));
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());
  await page.waitForFunction(() => window.__DAI_ONBOARDING__.getState().open === false);

  const initialTreasureRoom = entityRoom(initial.editor, 'treasure-1');
  await page.fill('#naturalEditInput', testPrompt);
  await page.click('#applyNaturalEdit');
  await page.waitForFunction(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    return state.naturalEditBusy === false && state.entities.find((entity) => entity.id === 'treasure-1')?.roomId === 'room-goal';
  }, null, { timeout: 90_000 });
  const afterNaturalEdit = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.click('#undo');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().entities.find((entity) => entity.id === 'treasure-1')?.roomId === 'room-middle');
  const afterUndo = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  await page.click('#redo');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().entities.find((entity) => entity.id === 'treasure-1')?.roomId === 'room-goal');
  const afterRedo = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());

  const checks = {
    httpsDeployment: initial.href.startsWith('https://'),
    editorReadyAndValid: initial.editor.startAllowed === true && initial.editor.validationCriticalCount === 0,
    onboardingReady: initial.onboarding.open === true && initial.onboarding.step?.id === 'welcome',
    initialTreasureExpected: initialTreasureRoom === 'room-middle',
    deployedNaturalEditWorked: entityRoom(afterNaturalEdit, 'treasure-1') === 'room-goal',
    deployedCommandExpected:
      afterNaturalEdit.lastNaturalEditCommand?.type === 'move-entity' &&
      afterNaturalEdit.lastNaturalEditCommand?.entityId === 'treasure-1' &&
      afterNaturalEdit.lastNaturalEditCommand?.roomId === 'room-goal',
    undoWorked: entityRoom(afterUndo, 'treasure-1') === 'room-middle',
    redoWorked: entityRoom(afterRedo, 'treasure-1') === 'room-goal',
    apiReturned200: apiResponses.length === 1 && apiResponses[0].status === 200,
    browserErrorsAbsent: consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0 && httpErrors.length === 0,
  };
  const passed = Object.values(checks).every(Boolean);

  const screenshotPath = path.join(outputDir, 'dai-072-public.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const evidence = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    chromePath,
    browserVersion: browser.version(),
    publicUrl: editorUrl,
    navigationReadyMs,
    passed,
    checks,
    apiResponses,
    translatedCommand: afterNaturalEdit.lastNaturalEditCommand,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
    safety: {
      localApiKeyRequired: false,
      fullPromptStoredInEvidence: false,
    },
  };

  const evidencePath = path.join(outputDir, 'dai-072-public.json');
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  console.log(JSON.stringify(evidence, null, 2));
  if (!passed) throw new Error(`DAI-072 public deployment invariant failed: ${JSON.stringify(checks)}`);
} finally {
  if (browser) await browser.close();
}
