import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const chromePath =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.DAI_100_AI_EDIT_STRUCTURAL_PORT || '4204');
const outputDir = path.resolve('artifacts/dai-100-ai-edit-structural');
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
    `DAI-100 structural AI Edit browser server did not become ready.\n${viteOutput}`,
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
  await page.waitForTimeout(70);
  return state(page);
}

async function redo(page) {
  await page.click('#redo');
  await page.waitForTimeout(70);
  return state(page);
}

const prompts = Object.freeze({
  addRoom: 'Add an 8 by 8 side room at x 0 z 12.',
  addCorridor: 'Connect the start room to the new side room.',
  setDoors: 'Use the south wall of the start room and north wall of the side room.',
  reconnect: 'Reconnect the new corridor from the side room to the middle room.',
  removeCorridor: 'Remove the new AI corridor.',
  removeRoom: 'Remove the new side room.',
});

const commandByPrompt = new Map([
  [
    prompts.addRoom,
    {
      type: 'add-room',
      room: {
        id: 'room-ai-001',
        x: 0,
        z: 12,
        width: 8,
        depth: 8,
      },
    },
  ],
  [
    prompts.addCorridor,
    {
      type: 'add-corridor',
      corridor: {
        id: 'corridor-ai-001',
        fromRoomId: 'room-start',
        toRoomId: 'room-ai-001',
        width: 3,
        kind: 'ai',
      },
    },
  ],
  [
    prompts.setDoors,
    {
      type: 'set-corridor-doors',
      corridorId: 'corridor-ai-001',
      fromSide: 'south',
      toSide: 'north',
    },
  ],
  [
    prompts.reconnect,
    {
      type: 'reconnect-corridor',
      corridorId: 'corridor-ai-001',
      fromRoomId: 'room-ai-001',
      toRoomId: 'room-middle',
      fromSide: 'east',
      toSide: 'south',
    },
  ],
  [
    prompts.removeCorridor,
    {
      type: 'remove-corridor',
      corridorId: 'corridor-ai-001',
    },
  ],
  [
    prompts.removeRoom,
    {
      type: 'remove-room',
      roomId: 'room-ai-001',
    },
  ],
]);

function validEditorState(value) {
  return (
    value.mode === 'edit' &&
    value.startAllowed === true &&
    value.validationCriticalCount === 0
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

  const requests = [];
  await page.route('**/api/natural-edit', async (route) => {
    let body = null;
    try {
      body = JSON.parse(route.request().postData() || '{}');
    } catch {}

    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    const command = commandByPrompt.get(prompt) ?? null;
    requests.push({
      prompt,
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

  const roomAdded = await submit(page, prompts.addRoom);
  const roomAddApplied =
    roomAdded.rooms.some(
      (room) =>
        room.id === 'room-ai-001' &&
        room.x === 0 &&
        room.z === 12 &&
        room.width === 8 &&
        room.depth === 8,
    ) &&
    roomAdded.lastNaturalEditCommand?.type === 'add-room' &&
    roomAdded.selectedRoomId === 'room-ai-001' &&
    roomAdded.inspectorTab === 'rooms' &&
    validEditorState(roomAdded);
  const roomAddUndone = await undo(page);
  const roomAddRedone = await redo(page);

  const corridorAdded = await submit(page, prompts.addCorridor);
  const corridorAddApplied =
    corridorAdded.corridors.some(
      (corridor) =>
        corridor.id === 'corridor-ai-001' &&
        corridor.fromRoomId === 'room-start' &&
        corridor.toRoomId === 'room-ai-001' &&
        corridor.width === 3 &&
        corridor.kind === 'ai',
    ) &&
    corridorAdded.lastNaturalEditCommand?.type === 'add-corridor' &&
    corridorAdded.selectedCorridorId === 'corridor-ai-001' &&
    corridorAdded.inspectorTab === 'corridors' &&
    validEditorState(corridorAdded);
  const corridorAddUndone = await undo(page);
  const corridorAddRedone = await redo(page);

  const doorsSet = await submit(page, prompts.setDoors);
  const corridorAfterDoors = doorsSet.corridors.find(
    (corridor) => corridor.id === 'corridor-ai-001',
  );
  const doorsApplied =
    corridorAfterDoors?.fromSide === 'south' &&
    corridorAfterDoors?.toSide === 'north' &&
    doorsSet.lastNaturalEditCommand?.type === 'set-corridor-doors' &&
    doorsSet.selectedCorridorId === 'corridor-ai-001' &&
    doorsSet.inspectorTab === 'corridors' &&
    validEditorState(doorsSet);
  const doorsUndone = await undo(page);
  const doorsRedone = await redo(page);

  const reconnected = await submit(page, prompts.reconnect);
  const corridorAfterReconnect = reconnected.corridors.find(
    (corridor) => corridor.id === 'corridor-ai-001',
  );
  const reconnectApplied =
    corridorAfterReconnect?.fromRoomId === 'room-ai-001' &&
    corridorAfterReconnect?.toRoomId === 'room-middle' &&
    corridorAfterReconnect?.fromSide === 'east' &&
    corridorAfterReconnect?.toSide === 'south' &&
    reconnected.lastNaturalEditCommand?.type === 'reconnect-corridor' &&
    reconnected.selectedCorridorId === 'corridor-ai-001' &&
    reconnected.inspectorTab === 'corridors' &&
    validEditorState(reconnected);
  const reconnectUndone = await undo(page);
  const reconnectRedone = await redo(page);

  const corridorRemoved = await submit(page, prompts.removeCorridor);
  const corridorRemoveApplied =
    !corridorRemoved.corridors.some(
      (corridor) => corridor.id === 'corridor-ai-001',
    ) &&
    corridorRemoved.lastNaturalEditCommand?.type === 'remove-corridor' &&
    corridorRemoved.selectedCorridorId == null &&
    corridorRemoved.inspectorTab === 'corridors' &&
    validEditorState(corridorRemoved);
  const corridorRemoveUndone = await undo(page);
  const corridorRemoveRedone = await redo(page);

  const roomRemoved = await submit(page, prompts.removeRoom);
  const roomRemoveApplied =
    !roomRemoved.rooms.some((room) => room.id === 'room-ai-001') &&
    roomRemoved.lastNaturalEditCommand?.type === 'remove-room' &&
    roomRemoved.selectedRoomId == null &&
    roomRemoved.inspectorTab === 'rooms' &&
    validEditorState(roomRemoved);
  const roomRemoveUndone = await undo(page);
  const roomRemoveRedone = await redo(page);

  const roomContextKeys = [
    ...new Set(
      requests.flatMap((entry) =>
        (entry.context?.rooms ?? []).flatMap((room) => Object.keys(room)),
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
  const corridorContextKeys = [
    ...new Set(
      requests.flatMap((entry) =>
        (entry.context?.corridors ?? []).flatMap((corridor) =>
          Object.keys(corridor),
        ),
      ),
    ),
  ].sort();

  const addCorridorRequest = requests.find(
    (entry) => entry.prompt === prompts.addCorridor,
  );
  const reconnectRequest = requests.find(
    (entry) => entry.prompt === prompts.reconnect,
  );
  const removeRoomRequest = requests.find(
    (entry) => entry.prompt === prompts.removeRoom,
  );

  const checks = {
    initialFixtureExpected:
      initial.rooms.some((room) => room.id === 'room-start') &&
      initial.rooms.some((room) => room.id === 'room-middle') &&
      initial.rooms.some((room) => room.id === 'room-goal') &&
      initial.corridors.some((corridor) => corridor.id === 'corridor-1') &&
      initial.corridors.some((corridor) => corridor.id === 'corridor-2'),

    sixStructuralRequestsObserved:
      requests.length === 6 &&
      requests.every((entry) => entry.hasCommand),

    boundedStructuralContext:
      roomContextKeys.join(',') === 'depth,id,width,x,z' &&
      entityContextKeys.join(',') === 'id,roomId,type' &&
      corridorContextKeys.join(',') ===
        'fromRoomId,fromSide,id,kind,toRoomId,toSide,width' &&
      requests.every(
        (entry) =>
          Array.isArray(entry.context?.rooms) &&
          Array.isArray(entry.context?.entities) &&
          Array.isArray(entry.context?.corridors) &&
          !Object.hasOwn(entry.context ?? {}, 'events') &&
          !Object.hasOwn(entry.context ?? {}, 'play') &&
          !Object.hasOwn(entry.context ?? {}, 'run'),
      ),

    laterRequestsObservePriorStructuralState:
      addCorridorRequest?.context?.rooms?.some(
        (room) => room.id === 'room-ai-001',
      ) === true &&
      reconnectRequest?.context?.corridors?.some(
        (corridor) => corridor.id === 'corridor-ai-001',
      ) === true &&
      removeRoomRequest?.context?.corridors?.some(
        (corridor) => corridor.id === 'corridor-ai-001',
      ) === false,

    addRoomAppliedUndoRedo:
      roomAddApplied &&
      !roomAddUndone.rooms.some((room) => room.id === 'room-ai-001') &&
      roomAddRedone.rooms.some((room) => room.id === 'room-ai-001') &&
      validEditorState(roomAddRedone),

    addCorridorAppliedUndoRedo:
      corridorAddApplied &&
      !corridorAddUndone.corridors.some(
        (corridor) => corridor.id === 'corridor-ai-001',
      ) &&
      corridorAddRedone.corridors.some(
        (corridor) => corridor.id === 'corridor-ai-001',
      ) &&
      validEditorState(corridorAddRedone),

    setDoorSidesAppliedUndoRedo:
      doorsApplied &&
      (doorsUndone.corridors.find(
        (corridor) => corridor.id === 'corridor-ai-001',
      )?.fromSide ?? null) === null &&
      (doorsUndone.corridors.find(
        (corridor) => corridor.id === 'corridor-ai-001',
      )?.toSide ?? null) === null &&
      doorsRedone.corridors.find(
        (corridor) => corridor.id === 'corridor-ai-001',
      )?.fromSide === 'south' &&
      doorsRedone.corridors.find(
        (corridor) => corridor.id === 'corridor-ai-001',
      )?.toSide === 'north' &&
      validEditorState(doorsRedone),

    reconnectAppliedUndoRedo:
      reconnectApplied &&
      reconnectUndone.corridors.find(
        (corridor) => corridor.id === 'corridor-ai-001',
      )?.fromRoomId === 'room-start' &&
      reconnectUndone.corridors.find(
        (corridor) => corridor.id === 'corridor-ai-001',
      )?.toRoomId === 'room-ai-001' &&
      reconnectRedone.corridors.find(
        (corridor) => corridor.id === 'corridor-ai-001',
      )?.fromRoomId === 'room-ai-001' &&
      reconnectRedone.corridors.find(
        (corridor) => corridor.id === 'corridor-ai-001',
      )?.toRoomId === 'room-middle' &&
      validEditorState(reconnectRedone),

    removeCorridorAppliedUndoRedo:
      corridorRemoveApplied &&
      corridorRemoveUndone.corridors.some(
        (corridor) => corridor.id === 'corridor-ai-001',
      ) &&
      !corridorRemoveRedone.corridors.some(
        (corridor) => corridor.id === 'corridor-ai-001',
      ) &&
      validEditorState(corridorRemoveRedone),

    removeRoomAppliedUndoRedo:
      roomRemoveApplied &&
      roomRemoveUndone.rooms.some((room) => room.id === 'room-ai-001') &&
      !roomRemoveRedone.rooms.some((room) => room.id === 'room-ai-001') &&
      validEditorState(roomRemoveRedone),

    finalStateMatchesOriginalStructuralCounts:
      roomRemoveRedone.rooms.length === initial.rooms.length &&
      roomRemoveRedone.corridors.length === initial.corridors.length &&
      roomRemoveRedone.entities.length === initial.entities.length,

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
      corridors: corridorContextKeys,
    },
    observedCommandTypes: requests.map(
      (entry) => commandByPrompt.get(entry.prompt)?.type ?? null,
    ),
    finalState: {
      rooms: roomRemoveRedone.rooms.length,
      corridors: roomRemoveRedone.corridors.length,
      entities: roomRemoveRedone.entities.length,
      startAllowed: roomRemoveRedone.startAllowed,
      validationCriticalCount: roomRemoveRedone.validationCriticalCount,
    },
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(outputDir, 'dai-100-ai-edit-structural.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  await page.screenshot({
    path: path.join(outputDir, 'dai-100-ai-edit-structural.png'),
    fullPage: true,
  });

  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(
      'DAI-100 structural AI Edit browser invariant failed: ' +
        falseChecks.join(', '),
    );
  }
} finally {
  if (browser) await browser.close();
  vite.kill();
}
