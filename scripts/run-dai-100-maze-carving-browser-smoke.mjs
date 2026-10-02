import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import {
  GENERATOR_STRATEGY_MAZE_CARVING_LAB_ID,
} from '../packages/generator/src/strategy-catalog.js';

const chromePath =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(
  process.env.DAI_MAZE_CARVING_BROWSER_PORT || '4210',
);
const outputDir = path.resolve(
  'artifacts/maze-carving-browser',
);
const viteBin = path.resolve(
  'node_modules/vite/bin/vite.js',
);
const prompt =
  'Create a compact 8-minute carved maze dungeon with several route choices.';

if (!fs.existsSync(chromePath)) {
  throw new Error('Chrome not found: ' + chromePath);
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

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    'Maze Carving browser server did not become ready.\n' +
      viteOutput,
  );
}

function spatialSignature(state) {
  return JSON.stringify(
    state.rooms.map(({ x, z, width, depth }) => ({
      x,
      z,
      width,
      depth,
    })),
  );
}

const url =
  'http://127.0.0.1:' +
  port +
  '/apps/editor-slice/index.html';
let browserInstance;

try {
  await waitForServer(url);
  browserInstance = await chromium.launch({
    executablePath: chromePath,
    headless: false,
  });
  const page = await browserInstance.newPage({
    viewport: { width: 1440, height: 900 },
  });

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  const designIntentRequests = [];

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

  await page.route(
    '**/api/design-intent',
    async (route) => {
      const body = JSON.parse(
        route.request().postData() || '{}',
      );
      designIntentRequests.push({
        keys: Object.keys(body).sort(),
        promptMatches: body.prompt === prompt,
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          selectedProvider: 'cloud',
          intent: {
            ...DEFAULT_DESIGN_INTENT,
            fairness: 0.8,
            tension: 0.68,
            exploration: 0.9,
            greedPunishment: 0.6,
            routeChoice: 0.7,
            learnability: 0.75,
            combatDensity: 0.4,
            trapDensity: 0.42,
            rewardDensity: 0.64,
            deception: 0.45,
            telegraphStrength: 0.7,
            backtracking: 0.58,
            targetDifficulty: 0.6,
            targetDuration: 480,
          },
          meta: {
            provider: 'openai',
            model: 'test-model',
            usage: null,
          },
        }),
      });
    },
  );

  await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForFunction(
    () =>
      window.__DAI_EDITOR_SLICE__?.ready === true &&
      window.__DAI_ONBOARDING__?.ready === true,
    null,
    { timeout: 60000 },
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

  const selected = await page.evaluate(
    (id) =>
      window.__DAI_EDITOR_SLICE__
        .setGeneratorStrategy(id),
    GENERATOR_STRATEGY_MAZE_CARVING_LAB_ID,
  );
  if (!selected) {
    throw new Error(
      'Maze Carving strategy could not be selected.',
    );
  }

  await page.fill('#generationPrompt', prompt);
  await page.fill('#floorCount', '3');

  const selectorBeforeGenerate =
    await page.evaluate(() => ({
      value:
        document.querySelector('#generatorStrategy')
          ?.value ?? null,
      text:
        document.querySelector(
          '#generatorStrategy option:checked',
        )?.textContent ?? '',
      family:
        document.querySelector(
          '#generatorStrategy option:checked',
        )?.dataset.family ?? null,
    }));

  const generatedOk = await page.evaluate(
    () =>
      window.__DAI_EDITOR_SLICE__
        .generateDungeonFromPrompt(),
  );
  if (!generatedOk) {
    throw new Error(
      'Maze Carving Product generation returned false.',
    );
  }

  const generated = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.getState(),
  );

  await page.click('[data-workflow-tab="edit"]');
  await page.waitForFunction(
    () =>
      window.__DAI_EDITOR_SLICE__.getState()
        .workflowTab === 'edit',
  );

  const floorStates = [];
  for (
    let floorIndex = 0;
    floorIndex < 3;
    floorIndex += 1
  ) {
    if (floorIndex > 0) {
      const selectedFloor = await page.evaluate(
        (index) =>
          window.__DAI_EDITOR_SLICE__
            .selectFloor(index),
        floorIndex,
      );
      if (!selectedFloor) {
        throw new Error(
          'Could not select Maze Carving floor ' +
            (floorIndex + 1),
        );
      }
    }
    await page.waitForTimeout(30);
    floorStates.push(
      await page.evaluate(
        () => window.__DAI_EDITOR_SLICE__.getState(),
      ),
    );
  }

  await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.selectFloor(0),
  );

  const testStarted = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.startDungeon(),
  );
  if (!testStarted) {
    throw new Error(
      'Maze Carving three-floor Test did not start.',
    );
  }
  const testPlay = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.getState(),
  );
  await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.returnToEdit(),
  );
  const afterTestReturn = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.getState(),
  );

  const mysteryStarted = await page.evaluate(
    () =>
      window.__DAI_EDITOR_SLICE__
        .startMysteryDungeon(),
  );
  if (!mysteryStarted) {
    throw new Error(
      'Maze Carving three-floor Mystery did not start.',
    );
  }
  const mysteryPlay = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.getState(),
  );
  await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.returnToEdit(),
  );
  const afterMysteryReturn = await page.evaluate(
    () => window.__DAI_EDITOR_SLICE__.getState(),
  );

  await page.screenshot({
    path: path.join(
      outputDir,
      'maze-carving-final.png',
    ),
    fullPage: true,
  });

  const floorSpatialSignatures =
    floorStates.map(spatialSignature);
  const generatedIds =
    generated.floorSummaries.map(
      (floor) => floor.dungeonId,
    );
  const generatedSeeds =
    generated.floorSummaries.map(
      (floor) => floor.seed,
    );
  const mysteryIds =
    mysteryPlay.run?.floorDungeonIds ?? [];
  const adoptedIds =
    afterMysteryReturn.floorSummaries.map(
      (floor) => floor.dungeonId,
    );

  const checks = {
    selectorShowsMazeCarvingLab:
      selectorBeforeGenerate.value ===
        GENERATOR_STRATEGY_MAZE_CARVING_LAB_ID &&
      selectorBeforeGenerate.text.includes(
        'Maze Carving',
      ) &&
      selectorBeforeGenerate.family ===
        'algorithm-lab',

    generatedThreeFloors:
      generated.floorCount === 3 &&
      generated.lastGeneration?.floorCount === 3,

    generationProvenanceUsesMazeCarving:
      generated.lastGeneration?.generatorVersion === null &&
      generated.lastGeneration?.generatorStrategyId ===
        GENERATOR_STRATEGY_MAZE_CARVING_LAB_ID &&
      generated.lastGeneration?.algorithmVersion === '1',

    generatedFloorIdsUnique:
      new Set(generatedIds).size === 3,

    generatedFloorSeedsUnique:
      new Set(generatedSeeds).size === 3,

    generatedFloorsSpatiallyDistinct:
      new Set(floorSpatialSignatures).size === 3,

    everyRenderedFloorStartEligible:
      floorStates.every(
        (state) =>
          state.startAllowed === true &&
          state.validationCriticalCount === 0,
      ),

    everyFloorHasMazeCarvingGraphShape:
      floorStates.every(
        (state) =>
          state.rooms.length === 8 &&
          state.corridors.length >=
            state.rooms.length - 1 &&
          state.corridors.every(
            (corridor) =>
              ['north', 'south', 'east', 'west']
                .includes(corridor.fromSide) &&
              ['north', 'south', 'east', 'west']
                .includes(corridor.toSide),
          ),
      ),

    testRunKeepsThreeFloors:
      testPlay.mode === 'play' &&
      testPlay.playSource === 'test' &&
      testPlay.run?.floorCount === 3 &&
      testPlay.play?.floorCount === 3,

    testReturnPreservesMazeCarvingAuthoring:
      afterTestReturn.mode === 'edit' &&
      afterTestReturn.floorCount === 3 &&
      afterTestReturn.lastGeneration
        ?.generatorStrategyId ===
        GENERATOR_STRATEGY_MAZE_CARVING_LAB_ID &&
      JSON.stringify(
        afterTestReturn.floorSummaries.map(
          (floor) => floor.dungeonId,
        ),
      ) === JSON.stringify(generatedIds),

    mysteryKeepsMazeCarvingAndThreeFloors:
      mysteryPlay.mode === 'play' &&
      mysteryPlay.playSource === 'mystery' &&
      mysteryPlay.run?.floorCount === 3 &&
      mysteryPlay.play?.floorCount === 3 &&
      mysteryPlay.play?.snapshot?.seed !==
        generated.lastGeneration?.seed,

    mysteryReturnAdoptsMazeCarvingRun:
      afterMysteryReturn.mode === 'edit' &&
      afterMysteryReturn.floorCount === 3 &&
      afterMysteryReturn.lastGeneration
        ?.generatorStrategyId ===
        GENERATOR_STRATEGY_MAZE_CARVING_LAB_ID &&
      afterMysteryReturn.lastGeneration
        ?.algorithmVersion === '1' &&
      JSON.stringify(adoptedIds) ===
        JSON.stringify(mysteryIds),

    designIntentRequestedOnce:
      designIntentRequests.length === 1 &&
      designIntentRequests[0].promptMatches === true &&
      JSON.stringify(
        designIntentRequests[0].keys,
      ) === JSON.stringify(['includeRoomRequests', 'prompt']),

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
    browserVersion: browserInstance.version(),
    passed: falseChecks.length === 0,
    checks,
    falseChecks,
    selectorBeforeGenerate,
    generated: {
      lastGeneration: generated.lastGeneration,
      floorSummaries: generated.floorSummaries,
      floorSpatialSignatures,
    },
    testPlay: {
      playSource: testPlay.playSource,
      run: testPlay.run,
    },
    mysteryPlay: {
      playSource: mysteryPlay.playSource,
      run: mysteryPlay.run,
      firstFloorSeed:
        mysteryPlay.play?.snapshot?.seed ?? null,
    },
    afterMysteryReturn: {
      lastGeneration:
        afterMysteryReturn.lastGeneration,
      floorSummaries:
        afterMysteryReturn.floorSummaries,
    },
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(
      outputDir,
      'maze-carving-browser.json',
    ),
    JSON.stringify(evidence, null, 2) + '\n',
  );

  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(
      'Maze Carving browser invariant failed: ' +
        falseChecks.join(', '),
    );
  }
} finally {
  if (browserInstance) await browserInstance.close();
  vite.kill();
}
