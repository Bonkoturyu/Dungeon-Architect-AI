import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = Number(process.env.DAI_PLAY_UI_PORT || "4197");
const outputDir = path.resolve("artifacts/play-ui-stack-layout");
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
  throw new Error(`Play UI server did not become ready.\n${viteOutput}`);
}

function adjacency(snapshot) {
  const graph = new Map(snapshot.rooms.map((room) => [room.id, []]));
  for (const corridor of snapshot.corridors) {
    graph.get(corridor.fromRoomId)?.push(corridor.toRoomId);
    graph.get(corridor.toRoomId)?.push(corridor.fromRoomId);
  }
  return graph;
}

function shortestPath(snapshot, start, targets) {
  const targetSet = new Set(targets);
  const graph = adjacency(snapshot);
  const queue = [start];
  const previous = new Map([[start, null]]);
  let found = targetSet.has(start) ? start : null;

  while (!found && queue.length) {
    const current = queue.shift();
    for (const next of graph.get(current) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, current);
      if (targetSet.has(next)) {
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

let browser;
try {
  await waitForServer();
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
    failure: request.failure()?.errorText ?? "unknown",
  }));
  page.on("response", (response) => {
    if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
  });

  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForFunction(() =>
    window.__DAI_EDITOR_SLICE__?.ready === true &&
    window.__DAI_ONBOARDING__?.ready === true,
  null, { timeout: 60_000 });
  await page.evaluate(() => window.__DAI_ONBOARDING__.close());

  const started = await page.evaluate(() => window.__DAI_EDITOR_SLICE__.startDungeon());
  if (!started) throw new Error("Built-in dungeon did not start.");
  await page.waitForFunction(() => window.__DAI_EDITOR_SLICE__.getState().mode === "play");

  const startState = await state(page);
  const bottomLayout = await page.evaluate(() => {
    const viewport = document.querySelector(".viewport-shell")?.getBoundingClientRect();
    const bottomHud = document.querySelector("#playBottomHud")?.getBoundingClientRect();
    const exits = document.querySelector("#playExitBar")?.getBoundingClientRect();
    const stats = document.querySelector(".play-summary")?.getBoundingClientRect();
    const playStatus = document.querySelector("#playStatus");
    const labels = [...(playStatus?.querySelectorAll(".metric-label") ?? [])]
      .map((element) => element.textContent?.trim() ?? "");
    const computedStats = playStatus ? getComputedStyle(playStatus) : null;
    const computedPlate = document.querySelector(".play-summary")
      ? getComputedStyle(document.querySelector(".play-summary"))
      : null;

    return {
      viewport: viewport ? {
        left: viewport.left,
        right: viewport.right,
        top: viewport.top,
        bottom: viewport.bottom,
        width: viewport.width,
        height: viewport.height,
      } : null,
      bottomHud: bottomHud ? {
        left: bottomHud.left,
        right: bottomHud.right,
        top: bottomHud.top,
        bottom: bottomHud.bottom,
      } : null,
      exits: exits ? {
        left: exits.left,
        right: exits.right,
        top: exits.top,
        bottom: exits.bottom,
        hidden: document.querySelector("#playExitBar")?.hidden === true,
      } : null,
      stats: stats ? {
        left: stats.left,
        right: stats.right,
        top: stats.top,
        bottom: stats.bottom,
      } : null,
      labels,
      statsFontPx: computedStats ? Number.parseFloat(computedStats.fontSize) : null,
      plateBackground: computedPlate?.backgroundColor ?? null,
      auxDisplay: getComputedStyle(document.querySelector(".play-aux-metrics")).display,
    };
  });

  await page.screenshot({
    path: path.join(outputDir, "play-ui-bottom-hud.png"),
    fullPage: true,
  });

  const snapshot = startState.play.snapshot;
  const eventRoomIds = [...new Set(snapshot.entities
    .filter((entity) => !["start", "goal"].includes(entity.type))
    .map((entity) => entity.roomId))];
  const route = shortestPath(snapshot, startState.play.currentRoomId, eventRoomIds);
  if (route.length === 0) throw new Error("No route to a room event.");

  for (const roomId of route.slice(1)) {
    const moved = await page.evaluate((target) =>
      window.__DAI_EDITOR_SLICE__.movePlayToRoom(target), roomId);
    if (!moved) throw new Error(`Failed moving to event room ${roomId}`);
    await page.waitForFunction((target) =>
      window.__DAI_EDITOR_SLICE__.getState().play?.currentRoomId === target,
    roomId, { timeout: 10_000 });
    if (await page.locator("#roomEventBar:not([hidden])").count()) break;
  }

  await page.waitForFunction(() => document.querySelector("#roomEventBar")?.hidden === false, null, {
    timeout: 10_000,
  });
  const eventState = await state(page);
  const eventLayout = await page.evaluate(() => {
    const viewport = document.querySelector(".viewport-shell")?.getBoundingClientRect();
    const events = document.querySelector("#roomEventBar")?.getBoundingClientRect();
    const eventIds = [...document.querySelectorAll("#roomEventItems .room-event")]
      .map((element) => element.dataset.entityId);
    const eventCards = [...document.querySelectorAll("#roomEventItems .room-event")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          entityId: element.dataset.entityId,
          top: rect.top,
          bottom: rect.bottom,
        };
      });

    return {
      viewportCenterX: viewport ? viewport.left + viewport.width / 2 : null,
      viewportCenterY: viewport ? viewport.top + viewport.height / 2 : null,
      eventCenterX: events ? events.left + events.width / 2 : null,
      eventCenterY: events ? events.top + events.height / 2 : null,
      eventIds,
      eventCards,
      eventZ: Number.parseInt(getComputedStyle(document.querySelector("#roomEventBar")).zIndex, 10),
      background: getComputedStyle(document.querySelector("#roomEventBar")).backgroundColor,
    };
  });

  await page.evaluate(() =>
    window.__DAI_EDITOR_SLICE__.showViewportNoticeForTest("UI TEST ERROR", { timeoutMs: 10_000 }));
  await page.waitForFunction(() => document.querySelector("#viewportNotice")?.hidden === false);

  const errorLayout = await page.evaluate(() => {
    const viewport = document.querySelector(".viewport-shell")?.getBoundingClientRect();
    const notice = document.querySelector("#viewportNotice")?.getBoundingClientRect();
    const event = document.querySelector("#roomEventBar")?.getBoundingClientRect();
    const noticeStyle = getComputedStyle(document.querySelector("#viewportNotice"));
    const eventStyle = getComputedStyle(document.querySelector("#roomEventBar"));
    return {
      text: document.querySelector("#viewportNotice")?.textContent ?? "",
      centerX: notice ? notice.left + notice.width / 2 : null,
      centerY: notice ? notice.top + notice.height / 2 : null,
      viewportCenterX: viewport ? viewport.left + viewport.width / 2 : null,
      viewportCenterY: viewport ? viewport.top + viewport.height / 2 : null,
      noticeZ: Number.parseInt(noticeStyle.zIndex, 10),
      eventZ: Number.parseInt(eventStyle.zIndex, 10),
      background: noticeStyle.backgroundColor,
      overlapsEventCenter:
        Boolean(notice && event) &&
        notice.left <= event.left + event.width / 2 &&
        notice.right >= event.left + event.width / 2 &&
        notice.top <= event.top + event.height / 2 &&
        notice.bottom >= event.top + event.height / 2,
    };
  });

  const authoringOrder = new Map(
    eventState.play.snapshot.entities.map((entity, index) => [entity.id, index]),
  );
  const domOrderValues = eventLayout.eventIds.map((id) => authoringOrder.get(id));
  const eventOrderStable = domOrderValues.every((value, index) =>
    Number.isInteger(value) && (index === 0 || value >= domOrderValues[index - 1]));

  const viewportCenterX = bottomLayout.viewport
    ? (bottomLayout.viewport.left + bottomLayout.viewport.right) / 2
    : null;
  const hudCenterX = bottomLayout.bottomHud
    ? (bottomLayout.bottomHud.left + bottomLayout.bottomHud.right) / 2
    : null;

  const checks = {
    playUsesViewportBottomHud:
      bottomLayout.bottomHud != null &&
      bottomLayout.viewport != null &&
      Math.abs(hudCenterX - viewportCenterX) <= 3 &&
      bottomLayout.bottomHud.bottom <= bottomLayout.viewport.bottom - 8 &&
      bottomLayout.bottomHud.bottom >= bottomLayout.viewport.bottom - 28,
    directionPadImmediatelyAboveStats:
      bottomLayout.exits?.hidden === false &&
      bottomLayout.stats != null &&
      bottomLayout.exits.bottom <= bottomLayout.stats.top &&
      bottomLayout.stats.top - bottomLayout.exits.bottom <= 14,
    statusOrderIsLvHpExpGold:
      JSON.stringify(bottomLayout.labels) === JSON.stringify(["LV", "HP", "EXP", "G"]),
    statusFontIsReadable:
      Number.isFinite(bottomLayout.statsFontPx) &&
      bottomLayout.statsFontPx >= 16,
    statusHasReadableBackplate:
      typeof bottomLayout.plateBackground === "string" &&
      bottomLayout.plateBackground !== "rgba(0, 0, 0, 0)" &&
      bottomLayout.plateBackground !== "transparent",
    auxiliaryMetricsHidden:
      bottomLayout.auxDisplay === "none",
    roomEventsCentered:
      Number.isFinite(eventLayout.eventCenterX) &&
      Number.isFinite(eventLayout.eventCenterY) &&
      Math.abs(eventLayout.eventCenterX - eventLayout.viewportCenterX) <= 3 &&
      Math.abs(eventLayout.eventCenterY - eventLayout.viewportCenterY) <= 3,
    roomEventsStackInStableEarlyOrder:
      eventLayout.eventIds.length >= 1 &&
      eventOrderStable &&
      eventLayout.eventCards.every((card, index, cards) =>
        index === 0 || card.top >= cards[index - 1].bottom),
    roomEventsHaveReadableBackplate:
      eventLayout.background !== "rgba(0, 0, 0, 0)" &&
      eventLayout.background !== "transparent",
    errorCenteredAboveRoomEvents:
      errorLayout.text === "UI TEST ERROR" &&
      Number.isFinite(errorLayout.centerX) &&
      Number.isFinite(errorLayout.centerY) &&
      Math.abs(errorLayout.centerX - errorLayout.viewportCenterX) <= 3 &&
      Math.abs(errorLayout.centerY - errorLayout.viewportCenterY) <= 3 &&
      errorLayout.noticeZ > errorLayout.eventZ,
    errorHasReadableBackplate:
      errorLayout.background !== "rgba(0, 0, 0, 0)" &&
      errorLayout.background !== "transparent" &&
      errorLayout.overlapsEventCenter === true,
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
    bottomLayout,
    eventRoomId: eventState.play.currentRoomId,
    eventLayout,
    errorLayout,
    consoleErrors,
    pageErrors,
    failedRequests,
    httpErrors,
  };

  await page.screenshot({
    path: path.join(outputDir, "play-ui-stack-layout.png"),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(outputDir, "play-ui-stack-layout.json"),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence, null, 2));

  if (!evidence.passed) {
    throw new Error(`Play UI layout invariant failed: ${falseChecks.join(", ")}`);
  }
} finally {
  if (browser) await browser.close();
  vite.kill();
}
