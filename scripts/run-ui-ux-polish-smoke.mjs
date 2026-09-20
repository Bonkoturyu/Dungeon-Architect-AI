import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_UI_UX_PORT || '4191');
const outputDir = path.resolve('artifacts/ui-ux-polish');
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
  throw new Error(`UI/UX smoke server did not become ready.\n${viteOutput}`);
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
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }); });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__?.ready === true && window.__DAI_ONBOARDING__?.ready === true, null, { timeout: 60_000 });
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());

  const editLayout = await page.evaluate(() => {
    const workspace = document.querySelector('.workspace').getBoundingClientRect();
    const viewport = document.querySelector('.viewport-shell').getBoundingClientRect();
    const aside = document.querySelector('aside').getBoundingClientRect();
    const headerTitle = document.querySelector('.brand-title').getBoundingClientRect();
    const visibleWorkflowPanels = [...document.querySelectorAll('[data-workflow-panel]')]
      .filter((node) => getComputedStyle(node).display !== 'none').length;
    const workflowTabs = [...document.querySelectorAll('.workflow-tab[data-workflow-tab]')]
      .filter((node) => getComputedStyle(node).display !== 'none').length;
    const validation = document.querySelector('#validationStatus');
    const toolbar = document.querySelector('.toolbar');
    const selected = document.querySelector('#selected');
    const entitySelected = document.querySelector('#entitySelected');
    return {
      bodyMode: document.body.dataset.mode,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      viewportTop: viewport.top,
      viewportBottom: viewport.bottom,
      documentHeight: document.documentElement.clientHeight,
      asideWidth: aside.width,
      workspaceWidth: workspace.width,
      headerTitleVisible: headerTitle.width > 0 && headerTitle.height > 0,
      visibleWorkflowPanels,
      workflowTabs,
      workflowTab: document.body.dataset.workflowTab,
      validationText: validation.textContent,
      validationState: validation.dataset.state,
      toolbarHiddenInCreate: getComputedStyle(toolbar).display === 'none',
      emptySelectionChipsHidden: selected.hidden === true && entitySelected.hidden === true,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  await page.screenshot({
    path: path.join(outputDir, 'ui-ux-edit.png'),
    fullPage: true,
  });

  await page.click('[data-workflow-tab="play"]');
  await page.waitForFunction(() => document.body.dataset.workflowTab === 'play');
  await page.click('#start');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'play', null, { timeout: 30_000 });

  const playLayout = await page.evaluate(() => {
    const viewport = document.querySelector('.viewport-shell').getBoundingClientRect();
    const aside = document.querySelector('aside').getBoundingClientRect();
    const hiddenEditorPanels = [...document.querySelectorAll('.editor-only')]
      .filter((node) => getComputedStyle(node).display === 'none').length;
    const validation = document.querySelector('#validationStatus');
    const exitPad = document.querySelector('#playExitButtons')?.getBoundingClientRect();
    const metricText = document.querySelector('#playStatus')?.innerText ?? '';
    const asideStyle = getComputedStyle(document.querySelector('aside'));
    return {
      bodyMode: document.body.dataset.mode,
      viewportWidth: viewport.width,
      asideWidth: aside.width,
      hiddenEditorPanels,
      viewportHelp: document.querySelector('#viewportHelp')?.textContent ?? '',
      validationHidden: getComputedStyle(validation).display === 'none',
      playMetrics: metricText,
      playAsidePosition: asideStyle.position,
      exitPadWidth: exitPad?.width ?? 0,
      exitPadHeight: exitPad?.height ?? 0,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  await page.screenshot({
    path: path.join(outputDir, 'ui-ux-play.png'),
    fullPage: true,
  });

  const route = await page.evaluate(() => {
    const state = window.__DAI_EDITOR_SLICE__.getState();
    const snapshot = state.play?.snapshot;
    if (!snapshot) return [];
    const adjacency = new Map(snapshot.rooms.map((room) => [room.id, []]));
    for (const corridor of snapshot.corridors) {
      adjacency.get(corridor.fromRoomId)?.push(corridor.toRoomId);
      adjacency.get(corridor.toRoomId)?.push(corridor.fromRoomId);
    }
    const start = state.play.currentRoomId;
    const goal = state.play.goalRoomId;
    const queue = [start];
    const previous = new Map([[start, null]]);
    while (queue.length) {
      const current = queue.shift();
      if (current === goal) break;
      for (const next of adjacency.get(current) ?? []) {
        if (previous.has(next)) continue;
        previous.set(next, current);
        queue.push(next);
      }
    }
    if (!previous.has(goal)) return [];
    const result = [];
    for (let current = goal; current != null; current = previous.get(current)) result.push(current);
    return result.reverse();
  });

  if (route.length < 2) throw new Error(`No Play route: ${JSON.stringify(route)}`);
  for (const roomId of route.slice(1)) {
    const corridorId = await page.evaluate((expectedRoomId) => {
      const state = window.__DAI_EDITOR_SLICE__.getState();
      return state.play?.map?.currentExits?.find((exit) => exit.targetRoomId === expectedRoomId)?.corridorId ?? null;
    }, roomId);
    if (!corridorId) throw new Error(`No visible exit to route room ${roomId}`);
    await page.locator(`#playExitButtons .exit-button[data-corridor-id="${corridorId}"]`).click();
    await page.waitForFunction((expected) => {
      const state = window.__DAI_EDITOR_SLICE__.getState();
      return state.play?.currentRoomId === expected || state.result?.status === 'cleared';
    }, roomId, { timeout: 10_000 });
    if ((await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState().result?.status)) === 'cleared') break;
  }

  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'result', null, { timeout: 30_000 });
  const resultLayout = await page.evaluate(() => ({
    bodyMode: document.body.dataset.mode,
    playText: document.querySelector('#playStatus')?.textContent ?? '',
    resultText: document.querySelector('#resultStatus')?.textContent ?? '',
    viewportHelp: document.querySelector('#viewportHelp')?.textContent ?? '',
    editorPanelsHidden: [...document.querySelectorAll('.editor-only')]
      .every((node) => getComputedStyle(node).display === 'none'),
  }));

  await page.screenshot({
    path: path.join(outputDir, 'ui-ux-result.png'),
    fullPage: true,
  });

  await page.click('#returnEdit');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === 'edit');
  const returnedMode = await page.evaluate(() => document.body.dataset.mode);

  const checks = {
    editorReady: editLayout.bodyMode === 'edit',
    titleVisible: editLayout.headerTitleVisible === true,
    validationReadable: editLayout.validationState === 'pass' && editLayout.validationText.includes('Valid'),
    desktopNoHorizontalOverflow: editLayout.horizontalOverflow <= 0 && playLayout.horizontalOverflow <= 0,
    viewportDominatesSidebar: editLayout.viewportWidth >= editLayout.asideWidth * 2,
    viewportUsableHeight: editLayout.viewportHeight >= 650,
    progressiveDisclosureActive:
      editLayout.workflowTab === 'create' &&
      editLayout.visibleWorkflowPanels === 1 &&
      editLayout.workflowTabs === 3,
    routineChromeReduced:
      editLayout.toolbarHiddenInCreate === true &&
      editLayout.emptySelectionChipsHidden === true,
    playModeApplied: playLayout.bodyMode === 'play',
    authoringPanelsHiddenInPlay: playLayout.hiddenEditorPanels >= 3,
    playViewportExpands: playLayout.viewportWidth > editLayout.viewportWidth,
    playInstructionIsModeAware: playLayout.viewportHelp.includes('Auto-map'),
    playPanelCompact:
      playLayout.validationHidden === true &&
      playLayout.playMetrics.includes('↠') &&
      playLayout.playMetrics.includes('▦') &&
      playLayout.playAsidePosition === 'absolute',
    spatialExitPadPresent:
      playLayout.exitPadWidth >= 130 &&
      playLayout.exitPadWidth <= 150 &&
      playLayout.exitPadHeight >= 130 &&
      playLayout.exitPadHeight <= 150,
    resultModeApplied: resultLayout.bodyMode === 'result',
    resultVisible: resultLayout.resultText.includes('CLEARED') && resultLayout.playText.includes('↠'),
    authoringPanelsHiddenInResult: resultLayout.editorPanelsHidden === true,
    resultInstructionIsModeAware: resultLayout.viewportHelp.toLowerCase().includes('run complete'),
    returnToEditRestoresMode: returnedMode === 'edit',
    browserErrorsAbsent:
      consoleErrors.length === 0 &&
      pageErrors.length === 0 &&
      failedRequests.length === 0 &&
      httpErrors.length === 0,
  };

  const falseChecks = Object.entries(checks).filter(([, value]) => value !== true).map(([name]) => name);
  const passed = falseChecks.length === 0;
  const evidence = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    chromePath,
    browserVersion: browser.version(),
    viewport: { width: 1440, height: 900 },
    passed,
    checks,
    editLayout,
    playLayout,
    resultLayout,
    route,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
    falseChecks,
  };

  fs.writeFileSync(
    path.join(outputDir, 'ui-ux-polish.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!passed) {
    console.error('UI/UX polish failed checks:', falseChecks.join(', '));
    throw new Error(`UI/UX polish invariant failed: ${falseChecks.join(', ')}`);
  }
} finally {
  if (browser) await browser.close();
  vite.kill();
}
