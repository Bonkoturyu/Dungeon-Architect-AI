import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';

const chromePath =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_JSON_EXPORT_PORT || '4200');
const outputDir = path.resolve('artifacts/json-export');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const prompt =
  'Create a fair but tense 5-minute dungeon with exploration and a few dangerous rewards.';

if (!fs.existsSync(chromePath)) {
  throw new Error(`Chrome not found: ${chromePath}`);
}
if (!fs.existsSync(viteBin)) {
  throw new Error('Vite is not installed.');
}
fs.mkdirSync(outputDir, { recursive: true });

const vite = spawn(
  process.execPath,
  [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

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
  throw new Error(
    `JSON export server did not become ready.\n${viteOutput}`,
  );
}

const url =
  `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
let browser;

try {
  await waitForServer(url);

  browser = await chromium.launch({
    executablePath: chromePath,
    headless: false,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) =>
    pageErrors.push(String(error)));
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      failure:
        request.failure()?.errorText ?? 'unknown',
    });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      httpErrors.push({
        url: response.url(),
        status: response.status(),
      });
    }
  });

  await page.route('**/api/design-intent', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        selectedProvider: 'cloud',
        difficulty: 'easy',
        // Export契約の検査が特殊部屋の抽選に依存しないよう固定する。
        roomRequests: [
          ...['monster-house', 'trap-house', 'shop'].map((kind) => ({
            kind, presence: 'exclude', roomCount: null, entityCount: null,
            floorNumber: null, roomId: null, offers: [],
          })),
          ...['start', 'goal'].map((targetRole) => ({
            kind: 'normal', targetRole, presence: 'include', roomCount: 1,
            entityCount: null, floorNumber: null, roomId: null, offers: [],
          })),
        ],
        intent: {
          ...DEFAULT_DESIGN_INTENT,
          fairness: 0.82,
          tension: 0.72,
          exploration: 0.82,
          greedPunishment: 0.7,
          routeChoice: 0.65,
          learnability: 0.78,
          combatDensity: 0.35,
          trapDensity: 0.45,
          rewardDensity: 0.65,
          deception: 0.55,
          telegraphStrength: 0.72,
          backtracking: 0.35,
          targetDifficulty: 0.58,
          targetDuration: 300,
        },
      }),
    });
  });

  await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: 60_000,
  });
  await page.waitForFunction(
    () =>
      window.__DAI_EDITOR_SLICE__?.ready === true &&
      window.__DAI_ONBOARDING__?.ready === true,
    null,
    { timeout: 60_000 },
  );

  if (
    await page.evaluate(
      () => window.__DAI_ONBOARDING__.getState().open,
    )
  ) {
    await page.evaluate(
      () => window.__DAI_ONBOARDING__.close(),
    );
  }

  await page.fill('#generationPrompt', prompt);
  await page.fill('#floorCount', '2');

  await page.click('#generateDungeon');
  await page.locator('dialog.special-room-review').waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('dialog.special-room-review button[type="submit"]').click();
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().generationBusy === false,
    null, { timeout: 30_000 });
  const generated = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
  if (generated.lastGeneration?.floorCount !== 2 || generated.floorCount !== 2) {
    throw new Error(`Generation failed during JSON export smoke: ${await page.locator('#generationStatus').innerText()}`);
  }

  await page.click('[data-workflow-tab="create"]');
  await page.waitForFunction(
    () =>
      window.__DAI_EDITOR_SLICE__.getState()
        .workflowTab === 'create',
  );

  const before = await page.evaluate(() => ({
    state: window.__DAI_EDITOR_SLICE__.getState(),
    layout: window.__DAI_EDITOR_SLICE__.getLayoutExport(),
    full: window.__DAI_EDITOR_SLICE__.getFullDungeonExport(),
    layoutDisabled:
      document.querySelector('#exportLayoutJson')?.disabled ?? true,
    fullDisabled:
      document.querySelector('#exportFullJson')?.disabled ?? true,
    layoutText:
      document.querySelector('#exportLayoutJson')?.textContent ?? '',
    fullText:
      document.querySelector('#exportFullJson')?.textContent ?? '',
  }));

  const layoutDownloadPromise = page.waitForEvent('download');
  await page.click('#exportLayoutJson');
  const layoutDownload = await layoutDownloadPromise;
  const layoutPath = await layoutDownload.path();
  if (!layoutPath) throw new Error('Layout JSON download path missing.');
  const layoutDownloaded = JSON.parse(
    fs.readFileSync(layoutPath, 'utf8'),
  );

  const fullDownloadPromise = page.waitForEvent('download');
  await page.click('#exportFullJson');
  const fullDownload = await fullDownloadPromise;
  const fullPath = await fullDownload.path();
  if (!fullPath) throw new Error('Full JSON download path missing.');
  const fullDownloaded = JSON.parse(
    fs.readFileSync(fullPath, 'utf8'),
  );

  await page.screenshot({
    path: path.join(outputDir, 'json-export-controls.png'),
    fullPage: true,
  });

  const layoutRooms =
    layoutDownloaded.floors.flatMap((floor) => floor.rooms);
  const startRoles =
    layoutRooms.filter((room) => room.roles.includes('start'));
  const goalRoles =
    layoutRooms.filter((room) => room.roles.includes('goal'));

  const checks = {
    exportUsesCurrentContentRules:
      fullDownloaded.floors.every(({ dungeon }) =>
        dungeon.trapRules?.version === 'seeded-avoidance-1' && dungeon.difficulty === 'easy'),
    exportButtonsEnabled:
      before.layoutDisabled === false &&
      before.fullDisabled === false,
    exportLabelsVisible:
      before.layoutText.trim() === 'Layout JSON' &&
      before.fullText.trim() === 'Full JSON',
    layoutFilenameVersioned:
      layoutDownload
        .suggestedFilename()
        .endsWith('.layout.v1.json'),
    fullFilenameVersioned:
      fullDownload
        .suggestedFilename()
        .endsWith('.dungeon-run.v1.json'),
    genericLayoutContract:
      layoutDownloaded.schema ===
        'dungeon-layout-exchange' &&
      layoutDownloaded.schemaVersion === '1.0' &&
      layoutDownloaded.floors.length === 2,
    genericCoordinateContract:
      layoutDownloaded.coordinateSystem?.plane === 'XZ' &&
      layoutDownloaded.coordinateSystem?.roomPosition === 'center' &&
      layoutDownloaded.coordinateSystem?.roomSize === 'full-extent',
    genericProvenancePresent:
      layoutDownloaded.source?.application ===
        'Dungeon Architect AI' &&
      layoutDownloaded.source?.dungeonSpecVersion === '1.0' &&
      layoutDownloaded.source?.generatorStrategyId ===
        before.state.lastGeneration?.generatorStrategyId,
    genericOmitsGameSpecificCollections:
      layoutDownloaded.floors.every(
        (floor) =>
          !Object.hasOwn(floor, 'entities') &&
          !Object.hasOwn(floor, 'events'),
      ),
    genericKeepsStartGoalRoles:
      startRoles.length === 2 &&
      goalRoles.length === 2,
    fullUsesDungeonRunSpec:
      fullDownloaded.schemaVersion === '1.0' &&
      fullDownloaded.floors.length === 2 &&
      fullDownloaded.floors.every(
        (floor) =>
          floor.dungeon?.schemaVersion === '1.0' &&
          Array.isArray(floor.dungeon.entities) &&
          Array.isArray(floor.dungeon.events),
      ),
    downloadedLayoutMatchesApi:
      JSON.stringify(layoutDownloaded) ===
        JSON.stringify(before.layout),
    downloadedFullMatchesApi:
      JSON.stringify(fullDownloaded) ===
        JSON.stringify(before.full),
    browserErrorsAbsent:
      consoleErrors.length === 0 &&
      pageErrors.length === 0 &&
      failedRequests.length === 0 &&
      httpErrors.length === 0,
  };

  const falseChecks = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([name]) => name);

  const evidence = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    browserVersion: browser.version(),
    passed: falseChecks.length === 0,
    checks,
    falseChecks,
    layoutFilename: layoutDownload.suggestedFilename(),
    fullFilename: fullDownload.suggestedFilename(),
    layoutSummary: {
      schema: layoutDownloaded.schema,
      schemaVersion: layoutDownloaded.schemaVersion,
      source: layoutDownloaded.source,
      floorCount: layoutDownloaded.floors.length,
      roomCounts: layoutDownloaded.floors.map(
        (floor) => floor.rooms.length,
      ),
      connectionCounts: layoutDownloaded.floors.map(
        (floor) => floor.connections.length,
      ),
    },
    fullSummary: {
      schemaVersion: fullDownloaded.schemaVersion,
      floorCount: fullDownloaded.floors.length,
      dungeonIds: fullDownloaded.floors.map(
        (floor) => floor.dungeon.id,
      ),
    },
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(outputDir, 'json-export.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(
      `JSON export invariant failed: ${falseChecks.join(', ')}`,
    );
  }
} finally {
  if (browser) await browser.close();
  vite.kill();
}
