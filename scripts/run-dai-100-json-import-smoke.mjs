import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const chromePath =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_JSON_IMPORT_PORT || '4206');
const outputDir = path.resolve('artifacts/dai-100-json-import');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const url = `http://127.0.0.1:${port}/apps/editor-slice/index.html`;

if (!fs.existsSync(chromePath)) {
  throw new Error(`Chrome not found: ${chromePath}`);
}
if (!fs.existsSync(viteBin)) {
  throw new Error('Vite is not installed.');
}
fs.mkdirSync(outputDir, { recursive: true });

const vite = spawn(
  process.execPath,
  [
    viteBin,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let viteOutput = '';
vite.stdout.on('data', (chunk) => {
  viteOutput += chunk.toString();
});
vite.stderr.on('data', (chunk) => {
  viteOutput += chunk.toString();
});

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `JSON import browser server did not become ready.\n${viteOutput}`,
  );
}

async function state(page) {
  return page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
}

async function exportValues(page) {
  return page.evaluate(() => ({
    layout: window.__DAI_EDITOR_SLICE__.getLayoutExport(),
    full: window.__DAI_EDITOR_SLICE__.getFullDungeonExport(),
  }));
}

async function importJson(page, value, filename) {
  return page.evaluate(
    ({ text, name }) =>
      window.__DAI_EDITOR_SLICE__.importDungeonJsonTextForTest(
        text,
        { filename: name },
      ),
    {
      text: JSON.stringify(value, null, 2) + '\n',
      name: filename,
    },
  );
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    executablePath: chromePath,
    headless: false,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      failure: request.failure()?.errorText ?? 'unknown',
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
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());

  const importUi = await page.evaluate(() => ({
    buttonText: document.querySelector('#importJson')?.textContent ?? null,
    fileInputPresent: Boolean(document.querySelector('#importJsonInput')),
    fileInputAccept: document.querySelector('#importJsonInput')?.getAttribute('accept') ?? null,
  }));

  const original = await exportValues(page);
  const originalState = await state(page);

  // Mutate the existing Editor before importing so restoration is observable.
  await page.evaluate(() => {
    window.__DAI_EDITOR_SLICE__.selectRoom('room-middle');
  });
  await page.locator('#roomWidth').fill('10');
  await page.locator('#roomDepth').fill('9');
  await page.click('#resizeRoom');
  const mutatedState = await state(page);

  const fullImported = await importJson(
    page,
    original.full,
    'fixture-full.dungeon-run.v1.json',
  );
  const afterFull = await state(page);
  const fullReexport = (await exportValues(page)).full;

  // Existing editor remains usable after import.
  await page.evaluate(() => {
    window.__DAI_EDITOR_SLICE__.selectRoom('room-middle');
  });
  await page.locator('#roomWidth').fill('9');
  await page.locator('#roomDepth').fill('8');
  await page.click('#resizeRoom');
  const editedAfterImport = await state(page);

  // Restore Full again, then import the generic Layout form.
  await importJson(page, original.full, 'fixture-full-again.json');
  const layoutImported = await importJson(
    page,
    original.layout,
    'fixture.layout.v1.json',
  );
  const afterLayout = await state(page);
  const layoutReexport = (await exportValues(page)).layout;

  // Invalid input must fail closed and keep the current authored state.
  const beforeInvalid = await state(page);
  const invalidLayout = structuredClone(original.layout);
  invalidLayout.unexpectedExecutableField =
    '<script>globalThis.__DAI_IMPORT_EXECUTED__=true</script>';
  const invalidResult = await importJson(
    page,
    invalidLayout,
    'invalid.layout.v1.json',
  );
  const afterInvalid = await state(page);
  const executionMarker = await page.evaluate(
    () => globalThis.__DAI_IMPORT_EXECUTED__ ?? null,
  );

  await page.screenshot({
    path: path.join(outputDir, 'json-import.png'),
    fullPage: true,
  });

  const afterFullFloor = afterFull.rooms;
  const originalFloor = original.full.floors[0].dungeon;
  const afterLayoutEntityTypes = new Set(
    afterLayout.entities.map((entity) => entity.type),
  );

  const checks = {
    importUiPresent:
      importUi.fileInputPresent === true &&
      importUi.fileInputAccept?.includes('.json') === true &&
      typeof importUi.buttonText === 'string' &&
      importUi.buttonText.length > 0,

    editorWasActuallyMutatedBeforeImport:
      mutatedState.rooms.find((room) => room.id === 'room-middle')?.width === 10 &&
      mutatedState.rooms.find((room) => room.id === 'room-middle')?.depth === 9,

    fullImportSucceeds:
      fullImported.ok === true &&
      fullImported.format === 'full' &&
      fullImported.floorCount === 1,

    fullImportRestoresCompleteDungeon:
      JSON.stringify(fullReexport) === JSON.stringify(original.full) &&
      JSON.stringify(afterFullFloor) === JSON.stringify(originalFloor.rooms) &&
      JSON.stringify(afterFull.entities) === JSON.stringify(originalFloor.entities),

    fullImportResetsEditorHistoryAndRuntime:
      afterFull.mode === 'edit' &&
      afterFull.canUndo === false &&
      afterFull.canRedo === false &&
      afterFull.play == null &&
      afterFull.run == null &&
      afterFull.lastDesignIntent == null &&
      afterFull.lastGeneration?.selectedProvider === 'import',

    importedDungeonRemainsEditable:
      editedAfterImport.rooms.find((room) => room.id === 'room-middle')?.width === 9 &&
      editedAfterImport.canUndo === true &&
      editedAfterImport.startAllowed === true &&
      editedAfterImport.validationCriticalCount === 0,

    layoutImportSucceeds:
      layoutImported.ok === true &&
      layoutImported.format === 'layout' &&
      layoutImported.floorCount === 1,

    layoutImportKeepsGenericGeometryOnly:
      afterLayout.rooms.length === original.layout.floors[0].rooms.length &&
      afterLayout.corridors.length === original.layout.floors[0].connections.length &&
      afterLayout.entities.length === 2 &&
      afterLayoutEntityTypes.has('start') &&
      afterLayoutEntityTypes.has('goal') &&
      !afterLayoutEntityTypes.has('enemy') &&
      !afterLayoutEntityTypes.has('treasure') &&
      afterLayout.startAllowed === true &&
      afterLayout.validationCriticalCount === 0,

    layoutRoundTripIsStable:
      JSON.stringify(layoutReexport) === JSON.stringify(original.layout),

    invalidImportFailsClosed:
      invalidResult.ok === false &&
      invalidResult.errors?.some(
        (entry) =>
          entry.code === 'LAYOUT_IMPORT_TOP_LEVEL_FIELDS_INVALID',
      ) &&
      JSON.stringify(afterInvalid.rooms) === JSON.stringify(beforeInvalid.rooms) &&
      JSON.stringify(afterInvalid.corridors) === JSON.stringify(beforeInvalid.corridors) &&
      JSON.stringify(afterInvalid.entities) === JSON.stringify(beforeInvalid.entities),

    importDoesNotExecuteJsonText:
      executionMarker === null,

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
    importUi,
    originalCounts: {
      rooms: originalState.rooms.length,
      corridors: originalState.corridors.length,
      entities: originalState.entities.length,
    },
    fullImported,
    afterFull: {
      mode: afterFull.mode,
      floorCount: afterFull.floorCount,
      rooms: afterFull.rooms.length,
      corridors: afterFull.corridors.length,
      entities: afterFull.entities.length,
      canUndo: afterFull.canUndo,
      startAllowed: afterFull.startAllowed,
    },
    layoutImported,
    afterLayout: {
      mode: afterLayout.mode,
      floorCount: afterLayout.floorCount,
      rooms: afterLayout.rooms.length,
      corridors: afterLayout.corridors.length,
      entities: afterLayout.entities.length,
      entityTypes: [...afterLayoutEntityTypes].sort(),
      startAllowed: afterLayout.startAllowed,
    },
    invalidResult,
    executionMarker,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(outputDir, 'json-import.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(
      'JSON import invariant failed: ' +
        falseChecks.join(', '),
    );
  }
} finally {
  if (browser) await browser.close();
  vite.kill();
}
