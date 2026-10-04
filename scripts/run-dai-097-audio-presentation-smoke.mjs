import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { DEFAULT_DESIGN_INTENT } from "../packages/intent/src/design-intent.js";
import { confirmManualGeneration, normalRoomRequests, captureBrowserFailure } from "./browser-smoke-support.mjs";

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = Number(process.env.DAI_AUDIO_PORT || "4198");
const outputDir = path.resolve("artifacts/dai-097-audio");
const viteBin = path.resolve("node_modules/vite/bin/vite.js");
const url = `http://127.0.0.1:${port}/apps/editor-slice/index.html`;

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (!fs.existsSync(viteBin)) throw new Error("Vite is not installed.");
fs.mkdirSync(outputDir, { recursive: true });

const vite = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
});

let viteOutput = "";
vite.stdout.on("data", (chunk) => { viteOutput += chunk.toString(); });
vite.stderr.on("data", (chunk) => { viteOutput += chunk.toString(); });

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`DAI-097 browser server did not become ready.\n${viteOutput}`);
}

async function state(page) {
  return page.evaluate(() => window.__DAI_EDITOR_SLICE__.getState());
}

function adjacency(snapshot) {
  const graph = new Map(snapshot.rooms.map((room) => [room.id, []]));
  for (const corridor of snapshot.corridors) {
    if (corridor.initiallyEnabled === false) continue;
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

  while (!found && queue.length > 0) {
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

async function resolveBlockingEvents(page) {
  let guard = 0;
  while (guard < 30) {
    guard += 1;
    const enemy = page.locator('.room-event.is-blocking [data-action="clear-enemy"]').first();
    if (await enemy.count()) {
      await enemy.click();
      await page.waitForTimeout(30);
      continue;
    }
    const trap = page.locator('.room-event.is-blocking [data-action="avoid-trap"]').first();
    if (await trap.count()) {
      await trap.click();
      await page.waitForTimeout(30);
      continue;
    }
    return;
  }
  throw new Error("Blocking event resolution exceeded guard.");
}

async function moveOne(page, targetRoomId) {
  const before = await state(page);
  const beforeFloor = before.play?.floorIndex ?? -1;
  const moved = await page.evaluate((target) =>
    window.__DAI_EDITOR_SLICE__.movePlayToRoom(target), targetRoomId);
  if (!moved) throw new Error(`movePlayToRoom returned false for ${targetRoomId}`);

  await page.waitForFunction(({ floorIndex, roomId }) => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.mode === "result" ||
      (s.play?.floorIndex ?? -1) > floorIndex ||
      s.play?.currentRoomId === roomId;
  }, { floorIndex: beforeFloor, roomId: targetRoomId }, { timeout: 10_000 });
}

async function moveAlong(page, route) {
  for (const target of route.slice(1)) {
    await resolveBlockingEvents(page);
    await moveOne(page, target);
  }
  await resolveBlockingEvents(page);
}

async function finishCurrentFloor(page) {
  const s = await state(page);
  const route = shortestPath(s.play.snapshot, s.play.currentRoomId, [s.play.goalRoomId]);
  if (route.length < 2) throw new Error("No route to current floor goal.");

  for (const target of route.slice(1, -1)) {
    await resolveBlockingEvents(page);
    await moveOne(page, target);
  }
  await resolveBlockingEvents(page);
  await moveOne(page, route.at(-1));
}

function generatedIntent() {
  return {
    ...DEFAULT_DESIGN_INTENT,
    fairness: 0.8,
    tension: 0.72,
    exploration: 0.75,
    routeChoice: 0.55,
    combatDensity: 0.8,
    trapDensity: 0.45,
    rewardDensity: 0.75,
    telegraphStrength: 0.8,
    targetDifficulty: 0.6,
    targetDuration: 360,
  };
}

let browser;
let page;

try {
  await waitForServer();
  browser = await chromium.launch({ executablePath: chromePath, headless: false });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  const externalAudioRequests = [];

  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("requestfailed", (request) => failedRequests.push({
    url: request.url(),
    failure: request.failure()?.errorText ?? "unknown",
  }));
  page.on("response", (response) => {
    if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
  });
  page.on("request", (request) => {
    if (/\.(?:wav|mp3|ogg|flac|m4a|aac)(?:\?|$)/i.test(request.url())) {
      externalAudioRequests.push(request.url());
    }
  });

  await page.route("**/api/design-intent", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        selectedProvider: "cloud",
        intent: generatedIntent(),
        roomRequests: normalRoomRequests(),
        meta: { provider: "openai", model: "test-model", usage: null },
      }),
    });
  });

  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForFunction(() =>
    window.__DAI_EDITOR_SLICE__?.ready === true &&
    window.__DAI_ONBOARDING__?.ready === true,
  null, { timeout: 60_000 });
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());

  const beforeUnlock = await state(page);

  // Real user gesture: unlock Web Audio while staying in Edit mode.
  await page.click('[data-workflow-tab="play"]');
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().audio?.unlocked === true, null, {
    timeout: 10_000,
  });

  const editAudio = await state(page);
  const audioButtonBeforeMute = await page.locator("#audioToggle").evaluate((button) => ({
    text: button.textContent,
    pressed: button.getAttribute("aria-pressed"),
    state: button.dataset.audioState,
    title: button.title,
  }));

  await page.click("#audioToggle");
  const muted = await state(page);
  await page.click("#audioToggle");
  const unmuted = await state(page);

  await page.locator("#bgmVolume").evaluate((input) => {
    input.value = "34";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#seVolume").evaluate((input) => {
    input.value = "86";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const mixed = await state(page);
  const mixerUi = await page.evaluate(() => ({
    bgm: document.querySelector("#bgmVolume")?.value ?? null,
    se: document.querySelector("#seVolume")?.value ?? null,
    bgmText: document.querySelector("#bgmVolumeValue")?.textContent ?? null,
    seText: document.querySelector("#seVolumeValue")?.textContent ?? null,
  }));

  // Built-in fixture: deterministic Enemy + Treasure in room-middle.
  const started = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.startDungeon());
  if (!started) throw new Error("Built-in test dungeon did not start.");
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === "play");

  const playStart = await state(page);
  await moveOne(page, "room-middle");
  const afterMove = await state(page);

  const cleared = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.clearEnemy("enemy-1"));
  if (!cleared) throw new Error("enemy-1 did not clear.");
  const afterCombat = await state(page);

  const opened = await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.interactWithRoomEntity("open-treasure", "treasure-1"));
  if (!opened) throw new Error("treasure-1 did not open.");
  const afterTreasure = await state(page);

  await moveOne(page, "room-goal");
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === "result");
  const firstResult = await state(page);

  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.returnToEdit());
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === "edit");
  const afterReturn = await state(page);

  // Generate a two-floor run to exercise generated + floor-advance wiring.
  await page.click('[data-workflow-tab="create"]');
  await page.fill("#generationPrompt", "Create a two-floor audio acceptance dungeon.");
  await page.fill("#floorCount", "2");
  await page.click("#generateDungeon");
  await confirmManualGeneration(page);
  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.generationBusy === false && s.floorCount === 2 && s.lastGeneration?.floorCount === 2;
  }, null, { timeout: 30_000 });

  const afterGeneration = await state(page);

  await page.evaluate(() => window.__DAI_EDITOR_SLICE__.startDungeon());
  await page.waitForFunction(() => {
    const s = window.__DAI_EDITOR_SLICE__.getState();
    return s.mode === "play" && s.run?.floorCount === 2 && s.play?.floorIndex === 0;
  });

  await finishCurrentFloor(page);
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().play?.floorIndex === 1, null, {
    timeout: 10_000,
  });
  const afterFloorAdvance = await state(page);

  await finishCurrentFloor(page);
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === "result", null, {
    timeout: 10_000,
  });
  const finalResult = await state(page);

  const audioElements = await page.locator("audio, source[type^='audio/']").count();
  const finalButton = await page.locator("#audioToggle").evaluate((button) => ({
    text: button.textContent,
    pressed: button.getAttribute("aria-pressed"),
    state: button.dataset.audioState,
  }));

  await page.screenshot({
    path: path.join(outputDir, "dai-097-audio-presentation.png"),
    fullPage: true,
  });

  const allCues = finalResult.audio.cueHistory.map((entry) => entry.cue);
  const scheduledCues = finalResult.audio.cueHistory.filter((entry) => entry.scheduled).map((entry) => entry.cue);

  const checks = {
    startsLockedWithoutCreatingAudioContext:
      beforeUnlock.audio.unlocked === false &&
      beforeUnlock.audio.contextState === "not-created" &&
      beforeUnlock.audio.desiredMode === "edit",
    userGestureUnlocksProgrammaticAudio:
      editAudio.audio.unlocked === true &&
      editAudio.audio.contextState === "running" &&
      editAudio.audio.activeMode === "edit" &&
      editAudio.audio.activeBgmVoices >= 1,
    audioToggleMutesAndRestores:
      muted.audio.muted === true &&
      unmuted.audio.muted === false &&
      audioButtonBeforeMute.text === "🔊" &&
      audioButtonBeforeMute.pressed === "false",
    musicalProgramAndMixerAreActive:
      mixed.audio.version === "2.0" &&
      mixed.audio.activeBgmVoices >= 2 &&
      mixed.audio.motifScheduledSeconds > 180 &&
      mixed.audio.bgmLooping === true &&
      mixed.audio.bgmLoopScheduleAheadSeconds === 180 &&
      mixed.audio.bgmLoopSchedulerIntervalMs === 15000 &&
      mixed.audio.bgmLoopExtensionCount >= 1 &&
      mixed.audio.crossfadeSeconds === 0.45 &&
      mixed.audio.bgmVolume === 0.34 &&
      mixed.audio.seVolume === 0.86 &&
      mixerUi.bgm === "34" &&
      mixerUi.se === "86" &&
      mixerUi.bgmText === "34%" &&
      mixerUi.seText === "86%",
    playSwitchesBgmAndSchedulesStartCue:
      playStart.audio.activeMode === "play" &&
      playStart.audio.lastCue === "play-start" &&
      playStart.audio.cueHistory.at(-1)?.scheduled === true,
    movementCueWired:
      afterMove.audio.lastCue === "move" &&
      afterMove.audio.cueHistory.at(-1)?.scheduled === true,
    combatCueWired:
      afterCombat.audio.lastCue === "combat" &&
      afterCombat.audio.cueHistory.at(-1)?.scheduled === true,
    treasureCueWired:
      afterTreasure.audio.lastCue === "treasure" &&
      afterTreasure.audio.cueHistory.at(-1)?.scheduled === true,
    clearResultBgmAndCueWired:
      firstResult.mode === "result" &&
      firstResult.audio.activeMode === "result-cleared" &&
      firstResult.audio.lastCue === "run-clear",
    returnEditRestoresEditBgm:
      afterReturn.mode === "edit" &&
      afterReturn.audio.activeMode === "edit" &&
      afterReturn.audio.lastCue === "return-edit",
    generationCueWired:
      afterGeneration.audio.lastCue === "generated" &&
      afterGeneration.audio.cueHistory.at(-1)?.scheduled === true,
    floorAdvanceCueWired:
      afterFloorAdvance.play?.floorIndex === 1 &&
      afterFloorAdvance.audio.activeMode === "play" &&
      afterFloorAdvance.audio.lastCue === "floor-advance",
    finalRunClearWired:
      finalResult.mode === "result" &&
      finalResult.run?.status === "cleared" &&
      finalResult.audio.activeMode === "result-cleared" &&
      finalResult.audio.lastCue === "run-clear",
    expectedGameplayCuesObserved:
      ["generated", "play-start", "move", "combat", "treasure", "floor-advance", "run-clear", "return-edit"]
        .every((cue) => allCues.includes(cue)),
    expectedGameplayCuesActuallyScheduled:
      ["generated", "play-start", "move", "combat", "treasure", "floor-advance", "run-clear", "return-edit"]
        .every((cue) => scheduledCues.includes(cue)),
    noExternalAudioAssetElementsOrRequests:
      audioElements === 0 &&
      externalAudioRequests.length === 0 &&
      finalResult.audio.provenance === "project-authored-programmatic-web-audio",
    audioButtonReturnsToUnmutedReadyState:
      finalButton.text === "🔊" &&
      finalButton.pressed === "false" &&
      finalButton.state === "ready",
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
    beforeUnlock: beforeUnlock.audio,
    editAudio: editAudio.audio,
    playStart: playStart.audio,
    afterMove: afterMove.audio,
    afterCombat: afterCombat.audio,
    afterTreasure: afterTreasure.audio,
    firstResult: firstResult.audio,
    afterReturn: afterReturn.audio,
    afterGeneration: afterGeneration.audio,
    afterFloorAdvance: afterFloorAdvance.audio,
    finalResult: finalResult.audio,
    externalAudioRequests,
    audioElements,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  fs.writeFileSync(
    path.join(outputDir, "dai-097-audio-presentation.json"),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(`DAI-097 audio invariant failed: ${falseChecks.join(", ")}`);
  }
} catch (error) {
  await captureBrowserFailure({ page, error, outputDir });
  throw error;
} finally {
  if (browser) await browser.close();
  vite.kill();
}
