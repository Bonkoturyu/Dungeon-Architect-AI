import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const chromePath =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_100_AI_EDIT_PORT || '4203');
const outputDir = path.resolve('artifacts/dai-100-ai-edit-v2');
const viteBin = path.resolve('node_modules/vite/bin/vite.js');
const url =
  `http://127.0.0.1:${port}/apps/editor-slice/index.html`;

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
    `DAI-100 AI Edit V2 browser server did not become ready.\n${viteOutput}`,
  );
}

async function state(page) {
  return page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
}

async function submit(page, prompt) {
  await page.fill('#naturalEditInput', prompt);
  await page.click('#applyNaturalEdit');
  await page.waitForFunction(
    () => window.__DAI_EDITOR_SLICE__.getState().naturalEditBusy === false,
    null,
    { timeout: 10_000 },
  );
  return state(page);
}

async function undo(page) {
  await page.click('#undo');
  await page.waitForTimeout(40);
  return state(page);
}

const commandByPrompt = new Map([
  [
    'Move the middle room one unit south.',
    {
      type: 'move-room',
      roomId: 'room-middle',
      x: 12,
      z: 1,
    },
  ],
  [
    'Make the middle room slightly wider.',
    {
      type: 'resize-room',
      roomId: 'room-middle',
      width: 9,
      depth: 8,
    },
  ],
  [
    'Add a recovery point to the middle room.',
    {
      type: 'add-entity',
      entity: {
        id: 'recovery-ai-001',
        type: 'recovery',
        roomId: 'room-middle',
      },
    },
  ],
  [
    'Remove the enemy from the middle room.',
    {
      type: 'remove-entity',
      entityId: 'enemy-1',
    },
  ],
  [
    'Move the treasure to the goal room.',
    {
      type: 'move-entity',
      entityId: 'treasure-1',
      roomId: 'room-goal',
    },
  ],
]);

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

  const requests = [];
  await page.route('**/api/natural-edit', async (route) => {
    let body = null;
    try {
      body = JSON.parse(route.request().postData() || '{}');
    } catch {}

    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    const command = commandByPrompt.get(prompt) ?? null;
    requests.push({
      promptId: [...commandByPrompt.keys()].indexOf(prompt),
      hasCommand: Boolean(command),
      context: body?.context ?? null,
    });

    if (!command) {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: { code: 'EDIT_COMMAND_UNSUPPORTED' },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        command,
        meta: {
          provider: 'openai',
          model: 'test-model',
          usage: null,
        },
      }),
    });
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
  await page.click('[data-workflow-tab="edit"]');

  const initial = await state(page);

  const movedRoom = await submit(
    page,
    'Move the middle room one unit south.',
  );
  const movedRoomApplied =
    movedRoom.rooms.find((room) => room.id === 'room-middle')?.z === 1 &&
    movedRoom.lastNaturalEditCommand?.type === 'move-room' &&
    movedRoom.selectedRoomId === 'room-middle' &&
    movedRoom.inspectorTab === 'rooms';
  const afterMoveUndo = await undo(page);

  const resizedRoom = await submit(
    page,
    'Make the middle room slightly wider.',
  );
  const resizedRoomApplied =
    resizedRoom.rooms.find((room) => room.id === 'room-middle')?.width === 9 &&
    resizedRoom.lastNaturalEditCommand?.type === 'resize-room' &&
    resizedRoom.selectedRoomId === 'room-middle' &&
    resizedRoom.inspectorTab === 'rooms';
  const afterResizeUndo = await undo(page);

  const addedEntity = await submit(
    page,
    'Add a recovery point to the middle room.',
  );
  const addedEntityApplied =
    addedEntity.entities.some(
      (entity) =>
        entity.id === 'recovery-ai-001' &&
        entity.type === 'recovery' &&
        entity.roomId === 'room-middle',
    ) &&
    addedEntity.lastNaturalEditCommand?.type === 'add-entity' &&
    addedEntity.selectedEntityId === 'recovery-ai-001' &&
    addedEntity.inspectorTab === 'entities';
  const afterAddUndo = await undo(page);

  const removedEntity = await submit(
    page,
    'Remove the enemy from the middle room.',
  );
  const removedEntityApplied =
    !removedEntity.entities.some((entity) => entity.id === 'enemy-1') &&
    removedEntity.lastNaturalEditCommand?.type === 'remove-entity' &&
    removedEntity.inspectorTab === 'entities';
  const afterRemoveUndo = await undo(page);

  const movedEntity = await submit(
    page,
    'Move the treasure to the goal room.',
  );
  const movedEntityApplied =
    movedEntity.entities.find((entity) => entity.id === 'treasure-1')
      ?.roomId === 'room-goal' &&
    movedEntity.lastNaturalEditCommand?.type === 'move-entity' &&
    movedEntity.selectedEntityId === 'treasure-1' &&
    movedEntity.inspectorTab === 'entities';
  const afterEntityMoveUndo = await undo(page);

  const roomContextKeys = [
    ...new Set(
      requests.flatMap((entry) =>
        (entry.context?.rooms ?? []).flatMap((room) =>
          Object.keys(room),
        ),
      ),
    ),
  ].sort();
  const entityContextKeys = [
    ...new Set(
      requests.flatMap((entry) =>
        (entry.context?.entities ?? []).flatMap((entity) =>
          Object.keys(entity),
        ),
      ),
    ),
  ].sort();

  const checks = {
    initialFixtureExpected:
      initial.rooms.find((room) => room.id === 'room-middle')?.x === 12 &&
      initial.rooms.find((room) => room.id === 'room-middle')?.z === 0 &&
      initial.entities.find((entity) => entity.id === 'enemy-1')
        ?.roomId === 'room-middle' &&
      initial.entities.find((entity) => entity.id === 'treasure-1')
        ?.roomId === 'room-middle',

    fiveNaturalEditRequestsObserved:
      requests.length === 5 &&
      requests.every((entry) => entry.hasCommand),

    boundedContextShape:
      roomContextKeys.join(',') === 'depth,id,width,x,z' &&
      entityContextKeys.join(',') === 'id,roomId,type' &&
      requests.every(
        (entry) =>
          Array.isArray(entry.context?.rooms) &&
          Array.isArray(entry.context?.entities) &&
          !Object.hasOwn(entry.context ?? {}, 'corridors') &&
          !Object.hasOwn(entry.context ?? {}, 'events'),
      ),

    moveRoomAppliedAndUndoable:
      movedRoomApplied &&
      afterMoveUndo.rooms.find((room) => room.id === 'room-middle')?.z === 0,

    resizeRoomAppliedAndUndoable:
      resizedRoomApplied &&
      afterResizeUndo.rooms.find((room) => room.id === 'room-middle')
        ?.width === 8,

    addEntityAppliedAndUndoable:
      addedEntityApplied &&
      !afterAddUndo.entities.some(
        (entity) => entity.id === 'recovery-ai-001',
      ),

    removeEntityAppliedAndUndoable:
      removedEntityApplied &&
      afterRemoveUndo.entities.some(
        (entity) =>
          entity.id === 'enemy-1' &&
          entity.roomId === 'room-middle',
      ),

    moveEntityAppliedAndUndoable:
      movedEntityApplied &&
      afterEntityMoveUndo.entities.find(
        (entity) => entity.id === 'treasure-1',
      )?.roomId === 'room-middle',

    editorStateRemainsValid:
      afterEntityMoveUndo.startAllowed === true &&
      afterEntityMoveUndo.validationCriticalCount === 0,

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
    browserVersion: await browser.version(),
    passed: falseChecks.length === 0,
    checks,
    falseChecks,
    requestCount: requests.length,
    contextKeys: {
      rooms: roomContextKeys,
      entities: entityContextKeys,
    },
    observedCommandTypes: [
      movedRoom.lastNaturalEditCommand?.type ?? null,
      resizedRoom.lastNaturalEditCommand?.type ?? null,
      addedEntity.lastNaturalEditCommand?.type ?? null,
      removedEntity.lastNaturalEditCommand?.type ?? null,
      movedEntity.lastNaturalEditCommand?.type ?? null,
    ],
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(outputDir, 'dai-100-ai-edit-v2.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  await page.screenshot({
    path: path.join(outputDir, 'dai-100-ai-edit-v2.png'),
    fullPage: true,
  });

  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(
      'DAI-100 AI Edit V2 browser invariant failed: ' +
        falseChecks.join(', '),
    );
  }
} finally {
  if (browser) await browser.close();
  vite.kill();
}
