import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { DEFAULT_DESIGN_INTENT } from "../packages/intent/src/design-intent.js";

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = Number(process.env.DAI_CHARACTER_PORT || "4196");
const outputDir = path.resolve("artifacts/dai-096");
const viteBin = path.resolve("node_modules/vite/bin/vite.js");
const prompt = "Create a readable combat dungeon with enemies, treasure, recovery, and exploration.";

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (!fs.existsSync(viteBin)) throw new Error("Vite is not installed.");
fs.mkdirSync(outputDir, { recursive: true });

const vite = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"]
});
let viteOutput = "";
vite.stdout.on("data", (chunk) => { viteOutput += chunk.toString(); });
vite.stderr.on("data", (chunk) => { viteOutput += chunk.toString(); });

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`DAI-096 server did not become ready.\n${viteOutput}`);
}

function intentPayload() {
  return {
    ...DEFAULT_DESIGN_INTENT,
    fairness: 0.82,
    tension: 0.78,
    exploration: 0.72,
    greedPunishment: 0.62,
    routeChoice: 0.58,
    learnability: 0.82,
    combatDensity: 0.8,
    trapDensity: 0.45,
    rewardDensity: 0.8,
    deception: 0.4,
    telegraphStrength: 0.85,
    backtracking: 0.3,
    targetDifficulty: 0.62,
    targetDuration: 420
  };
}

function adjacency(snapshot) {
  const graph = new Map(snapshot.rooms.map((room) => [room.id, []]));
  for (const corridor of snapshot.corridors) {
    graph.get(corridor.fromRoomId)?.push(corridor.toRoomId);
    graph.get(corridor.toRoomId)?.push(corridor.fromRoomId);
  }
  return graph;
}

function shortestPath(snapshot, startRoomId, targetRoomIds) {
  const targets = new Set(targetRoomIds);
  const graph = adjacency(snapshot);
  const queue = [startRoomId];
  const previous = new Map([[startRoomId, null]]);
  let found = targets.has(startRoomId) ? startRoomId : null;

  while (!found && queue.length) {
    const current = queue.shift();
    for (const next of graph.get(current) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, current);
      if (targets.has(next)) {
        found = next;
        break;
      }
      queue.push(next);
    }
  }

  if (!found) return [];
  const route = [];
  for (let current = found; current != null; current = previous.get(current)) route.push(current);
  return route.reverse();
}

async function state(page) {
  return page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
}

async function presentation(page) {
  return page.evaluate(() => window.__DAI_EDITOR_SLICE__.getCharacterPresentation());
}

async function resolveBlockingEvents(page, { skipEnemy = false } = {}) {
  let guard = 0;
  while (guard < 20) {
    guard += 1;
    if (!skipEnemy) {
      const enemy = page.locator('.room-event.is-blocking [data-action="clear-enemy"]').first();
      if (await enemy.count()) {
        await enemy.click();
        await page.waitForTimeout(25);
        continue;
      }
    }
    const trap = page.locator('.room-event.is-blocking [data-action="avoid-trap"]').first();
    if (await trap.count()) {
      await trap.click();
      await page.waitForTimeout(25);
      continue;
    }
    return;
  }
  throw new Error("Blocking event resolution exceeded guard.");
}

async function moveAlong(page, route, { stopBeforeLast = false } = {}) {
  const targets = stopBeforeLast ? route.slice(1, -1) : route.slice(1);
  for (const roomId of targets) {
    await resolveBlockingEvents(page);
    const moved = await page.evaluate((target) =>
      window.__DAI_EDITOR_SLICE__.movePlayToRoom(target), roomId);
    if (!moved) throw new Error(`Failed to move to ${roomId}`);
    await page.waitForFunction((target) =>
      window.__DAI_EDITOR_SLICE__.getState().play?.currentRoomId === target,
    roomId, { timeout: 10_000 });
  }
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
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("requestfailed", (request) => failedRequests.push({
    url: request.url(),
    failure: request.failure()?.errorText ?? "unknown"
  }));
  page.on("response", (response) => {
    if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
  });

  await page.route("**/api/design-intent", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        selectedProvider: "cloud",
        intent: intentPayload(),
        meta: { provider: "openai", model: "test-model", usage: null }
      })
    });
  });

  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForFunction(() =>
    window.__DAI_EDITOR_SLICE__?.ready === true &&
    window.__DAI_ONBOARDING__?.ready === true,
  null, { timeout: 60_000 });
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());

  await page.fill("#generationPrompt", prompt);
  await page.click("#generateDungeon");
  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.generationBusy === false && s.lastGeneration?.roomCount === 7;
  }, null, { timeout: 30_000 });

  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.startDungeon());
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === "play");

  const startState = await state(page);
  const startPresentation = await presentation(page);
  await page.waitForTimeout(220);
  const startPresentationLater = await presentation(page);
  const snapshot = startState.play.snapshot;

  const enemyRooms = [...new Set(snapshot.entities
    .filter((entity) => entity.type === "enemy")
    .map((entity) => entity.roomId))];
  const enemyRoute = shortestPath(snapshot, startState.play.currentRoomId, enemyRooms);
  if (enemyRoute.length === 0) throw new Error("No route to an enemy room.");

  await moveAlong(page, enemyRoute, { stopBeforeLast: true });
  await resolveBlockingEvents(page);
  const enemyRoomId = enemyRoute.at(-1);
  await page.evaluate((roomId) => window.__DAI_EDITOR_SLICE__.movePlayToRoom(roomId), enemyRoomId);
  await page.waitForFunction((roomId) =>
    window.__DAI_EDITOR_SLICE__.getState().play?.currentRoomId === roomId,
  enemyRoomId, { timeout: 10_000 });

  const enemyState = await state(page);
  const enemyPresentation = await presentation(page);
  await page.waitForTimeout(180);
  const enemyPresentationLater = await presentation(page);
  const activeEnemyIds = enemyState.play.snapshot.entities
    .filter((entity) => entity.type === "enemy" && entity.roomId === enemyRoomId)
    .map((entity) => entity.id);
  const renderedEnemy = enemyPresentation.enemies.find((entry) => activeEnemyIds.includes(entry.specId));
  if (!renderedEnemy) throw new Error("Enemy character was not rendered in the current room.");

  await page.screenshot({ path: path.join(outputDir, "player-enemy-before-clear.png"), fullPage: true });

  await page.evaluate((enemyId) => window.__DAI_EDITOR_SLICE__.clearEnemy(enemyId), renderedEnemy.specId);
  const defeatImmediate = await presentation(page);
  await page.waitForFunction((enemyId) =>
    !window.__DAI_EDITOR_SLICE__.getCharacterPresentation().enemies
      .some((entry) => entry.specId === enemyId),
  renderedEnemy.specId, { timeout: 10_000 });
  await page.waitForTimeout(420);

  const afterEnemyClear = await presentation(page);

  const afterCombatState = await state(page);
  const treasureRooms = [...new Set(afterCombatState.play.snapshot.entities
    .filter((entity) => entity.type === "treasure")
    .map((entity) => entity.roomId))];
  const treasureRoute = shortestPath(
    afterCombatState.play.snapshot,
    afterCombatState.play.currentRoomId,
    treasureRooms,
  );
  if (treasureRoute.length === 0) throw new Error("No route to a treasure room.");
  await moveAlong(page, treasureRoute);
  await resolveBlockingEvents(page);

  const treasureState = await state(page);
  const treasure = treasureState.play.snapshot.entities.find((entity) =>
    entity.type === "treasure" &&
    entity.roomId === treasureState.play.currentRoomId);
  if (!treasure) throw new Error("No treasure in reached treasure room.");

  const opened = await page.evaluate((treasureId) =>
    window.__DAI_EDITOR_SLICE__.interactWithRoomEntity("open-treasure", treasureId),
  treasure.id);
  if (!opened) throw new Error("Treasure OPEN failed.");

  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return (s.play?.gameplayCounters?.lootCollected ?? 0) >= 1;
  }, null, { timeout: 10_000 });

  const equippedState = await state(page);
  const equippedPresentation = await presentation(page);
  await page.screenshot({ path: path.join(outputDir, "player-after-loot.png"), fullPage: true });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(120);
  const reducedMotionPresentation = await presentation(page);

  const playerParts = equippedPresentation.player?.partNames ?? [];
  const weaponTier = equippedPresentation.player?.equipment?.weaponTier ?? 0;
  const armorTier = equippedPresentation.player?.equipment?.armorTier ?? 0;

  const checks = {
    playerVisibleAtStart:
      startPresentation.player?.roomId === startState.play.currentRoomId &&
      startPresentation.player.partNames.includes("head") &&
      startPresentation.player.partNames.includes("torso"),
    playerIdleMotionChangesOverTime:
      startPresentation.motion?.version === "1" &&
      startPresentation.motion?.reducedMotion === false &&
      startPresentationLater.player?.motion &&
      startPresentation.player?.motion &&
      (
        startPresentationLater.player.motion.offsetY !== startPresentation.player.motion.offsetY ||
        startPresentationLater.player.motion.rotationY !== startPresentation.player.motion.rotationY
      ),
    playerTracksCurrentRoom:
      enemyPresentation.player?.roomId === enemyRoomId &&
      enemyPresentation.player?.roomId === enemyState.play.currentRoomId,
    enemyUsesProgrammaticBody:
      Boolean(renderedEnemy) &&
      renderedEnemy.partNames.includes("head") &&
      renderedEnemy.partNames.includes("torso") &&
      renderedEnemy.partNames.includes("left-horn") &&
      renderedEnemy.partNames.length >= 11,
    enemyEncounterMotionChangesOverTime: (() => {
      const first = enemyPresentation.enemies.find((entry) => entry.specId === renderedEnemy.specId);
      const later = enemyPresentationLater.enemies.find((entry) => entry.specId === renderedEnemy.specId);
      return Boolean(
        first?.motion &&
        later?.motion &&
        (
          first.motion.offsetY !== later.motion.offsetY ||
          first.motion.rotationY !== later.motion.rotationY ||
          first.motion.encounterPulse !== later.motion.encounterPulse
        )
      );
    })(),
    defeatPresentationStartsImmediately:
      defeatImmediate.motion?.transientDefeatCount >= 1 &&
      !defeatImmediate.enemies.some((entry) => entry.specId === renderedEnemy.specId),
    defeatedEnemyDisappears:
      !afterEnemyClear.enemies.some((entry) => entry.specId === renderedEnemy.specId) &&
      afterEnemyClear.motion?.transientDefeatCount === 0,
    lootUpdatesPlayerPresentation:
      equippedState.play?.gameplayCounters?.lootCollected >= 1 &&
      ((weaponTier > 0 && playerParts.includes("weapon-blade")) ||
       (armorTier > 0 && playerParts.includes("left-pauldron"))),
    playerPresentationMatchesEquipment:
      weaponTier === (equippedState.play?.playerState?.equipment?.weapon?.tier ?? 0) &&
      armorTier === (equippedState.play?.playerState?.equipment?.armor?.tier ?? 0),
    reducedMotionStopsAnimationLoop:
      reducedMotionPresentation.motion?.reducedMotion === true &&
      reducedMotionPresentation.motion?.frameActive === false &&
      reducedMotionPresentation.player?.motion?.offsetY === 0 &&
      reducedMotionPresentation.player?.motion?.rotationY === 0 &&
      reducedMotionPresentation.player?.motion?.scaleXz === 1 &&
      reducedMotionPresentation.player?.motion?.scaleY === 1,
    browserErrorsAbsent:
      consoleErrors.length === 0 &&
      pageErrors.length === 0 &&
      failedRequests.length === 0 &&
      httpErrors.length === 0
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
    startPresentation,
    startPresentationLater,
    enemyRoomId,
    renderedEnemy,
    enemyPresentation,
    enemyPresentationLater,
    defeatImmediate,
    afterEnemyClear,
    reducedMotionPresentation,
    equippedPlayerState: equippedState.play?.playerState ?? null,
    equippedPresentation,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors
  };

  fs.writeFileSync(
    path.join(outputDir, "dai-096-programmatic-characters.json"),
    JSON.stringify(evidence, null, 2) + "\n"
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(`DAI-096 character invariant failed: ${falseChecks.join(", ")}`);
  }
} finally {
  if (browser) await browser.close();
  vite.kill();
}
