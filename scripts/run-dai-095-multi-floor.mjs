import fs from "node:fs";
import path from "node:path";
import { generateDungeonSpec } from "../packages/generator/src/dungeon-generator.js";
import { applyPlayerDamage, movePlaySession } from "../packages/play-core/src/play-session.js";
import { grantProgressionReward } from "../packages/play-core/src/progression-runtime.js";
import {
  MAX_DUNGEON_RUN_FLOORS,
  createDungeonRunResult,
  createDungeonRunSpec,
  startDungeonRun,
  syncDungeonRunFloor
} from "../packages/run-core/src/dungeon-run.js";

const outputDir = path.resolve("artifacts/dai-095");
fs.mkdirSync(outputDir, { recursive: true });

function dungeon(index) {
  return generateDungeonSpec({
    seed: 95095 + index,
    roomCount: 5,
    routeChoice: 0,
    id: `dai-095-floor-${index}`
  });
}

function shortestPath(spec, startId, goalId) {
  const graph = new Map(spec.rooms.map((room) => [room.id, []]));
  for (const corridor of spec.corridors) {
    if (corridor.initiallyEnabled === false) continue;
    graph.get(corridor.fromRoomId)?.push(corridor.toRoomId);
    graph.get(corridor.toRoomId)?.push(corridor.fromRoomId);
  }
  const queue = [[startId]];
  const seen = new Set([startId]);
  while (queue.length > 0) {
    const route = queue.shift();
    const current = route.at(-1);
    if (current === goalId) return route;
    for (const next of graph.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push([...route, next]);
    }
  }
  throw new Error(`No route from ${startId} to ${goalId}`);
}

function clearFloor(session, atBase) {
  let current = session;
  const route = shortestPath(current.snapshot, current.currentRoomId, current.goalRoomId);
  for (let index = 1; index < route.length; index += 1) {
    const moved = movePlaySession(current, route[index], { at: atBase + index });
    if (!moved.ok) throw new Error(`move failed: ${JSON.stringify(moved.error)}`);
    current = moved.session;
  }
  if (current.status !== "cleared") throw new Error("floor did not clear");
  return current;
}

const oneFloorSpec = createDungeonRunSpec([dungeon(1)], { id: "dai-095-one-floor" });
if (!oneFloorSpec.ok) throw new Error(JSON.stringify(oneFloorSpec.errors));
const oneStarted = startDungeonRun(oneFloorSpec.spec, { startedAt: 10 });
if (!oneStarted.ok) throw new Error(JSON.stringify(oneStarted.errors));
const oneClearedFloor = clearFloor(oneStarted.run.currentFloorSession, 20);
const oneSynced = syncDungeonRunFloor(oneStarted.run, oneClearedFloor, { at: 30 });
if (!oneSynced.ok) throw new Error(JSON.stringify(oneSynced.error));
const oneResult = createDungeonRunResult(oneSynced.run);
if (!oneResult.ok) throw new Error(JSON.stringify(oneResult.error));

const maxFloorSpec = createDungeonRunSpec(
  Array.from({ length: MAX_DUNGEON_RUN_FLOORS }, (_, index) => dungeon(index + 20)),
  { id: "dai-095-ten-floor" }
);

const threeFloors = [dungeon(101), dungeon(102), dungeon(103)];
const authoringBefore = JSON.stringify(threeFloors);
const runSpec = createDungeonRunSpec(threeFloors, { id: "dai-095-three-floor" });
if (!runSpec.ok) throw new Error(JSON.stringify(runSpec.errors));
const started = startDungeonRun(runSpec.spec, { startedAt: 100 });
if (!started.ok) throw new Error(JSON.stringify(started.errors));

let run = started.run;
let firstSession = grantProgressionReward(run.currentFloorSession, {
  xp: 25,
  gold: 12,
  item: { id: "weapon-tier-3", slot: "weapon", tier: 3 },
  sourceType: "validation",
  sourceId: "floor-one-reward",
  at: 101
}).session;
firstSession = applyPlayerDamage(firstSession, 7, {
  at: 102,
  sourceType: "validation",
  sourceId: "floor-one-damage"
}).session;
const floorOneBeforeGoal = JSON.parse(JSON.stringify(firstSession.playerState));
firstSession = clearFloor(firstSession, 110);
const floorOneFinalState = JSON.parse(JSON.stringify(firstSession.playerState));

const firstAdvance = syncDungeonRunFloor(run, firstSession, { at: 120 });
if (!firstAdvance.ok) throw new Error(JSON.stringify(firstAdvance.error));
run = firstAdvance.run;
const floorTwoStartState = JSON.parse(JSON.stringify(run.currentFloorSession.playerState));

let secondSession = grantProgressionReward(run.currentFloorSession, {
  xp: 7,
  gold: 5,
  item: { id: "armor-tier-2", slot: "armor", tier: 2 },
  sourceType: "validation",
  sourceId: "floor-two-reward",
  at: 121
}).session;
secondSession = clearFloor(secondSession, 130);
const floorTwoFinalState = JSON.parse(JSON.stringify(secondSession.playerState));

const secondAdvance = syncDungeonRunFloor(run, secondSession, { at: 140 });
if (!secondAdvance.ok) throw new Error(JSON.stringify(secondAdvance.error));
run = secondAdvance.run;
const floorThreeStartState = JSON.parse(JSON.stringify(run.currentFloorSession.playerState));

const thirdSession = clearFloor(run.currentFloorSession, 150);
const finished = syncDungeonRunFloor(run, thirdSession, { at: 160 });
if (!finished.ok) throw new Error(JSON.stringify(finished.error));
const runResult = createDungeonRunResult(finished.run);
if (!runResult.ok) throw new Error(JSON.stringify(runResult.error));

const failedSpec = createDungeonRunSpec([dungeon(201), dungeon(202)], { id: "dai-095-fail-run" });
if (!failedSpec.ok) throw new Error(JSON.stringify(failedSpec.errors));
const failedStarted = startDungeonRun(failedSpec.spec, { startedAt: 200 });
const lethal = applyPlayerDamage(failedStarted.run.currentFloorSession, 999, {
  at: 201,
  sourceType: "validation",
  sourceId: "lethal"
});
const failedSynced = syncDungeonRunFloor(failedStarted.run, lethal.session, { at: 201 });
if (!failedSynced.ok) throw new Error(JSON.stringify(failedSynced.error));

const checks = {
  oneFloorCompatibility:
    oneSynced.run.status === "cleared" &&
    oneResult.result.floorCount === 1 &&
    oneResult.result.floorsCompleted === 1,
  tenFloorMaximumAccepted:
    maxFloorSpec.ok === true &&
    maxFloorSpec.spec.floors.length === 10,
  firstFloorProgressionApplied:
    floorOneBeforeGoal.level === 2 &&
    floorOneBeforeGoal.xp === 5 &&
    floorOneBeforeGoal.gold === 12 &&
    floorOneBeforeGoal.maxHp === 22 &&
    floorOneBeforeGoal.hp === 15 &&
    floorOneBeforeGoal.equipment.weapon?.tier === 3,
  floorOneToTwoCarryExact:
    JSON.stringify(floorTwoStartState) === JSON.stringify(floorOneFinalState),
  floorTwoToThreeCarryExact:
    JSON.stringify(floorThreeStartState) === JSON.stringify(floorTwoFinalState),
  secondFloorEquipmentPersists:
    floorThreeStartState.equipment.weapon?.tier === 3 &&
    floorThreeStartState.equipment.armor?.tier === 2 &&
    floorThreeStartState.gold === 17,
  threeFloorRunClears:
    finished.run.status === "cleared" &&
    finished.run.floorResults.length === 3 &&
    runResult.result.floorCount === 3 &&
    runResult.result.floorsCompleted === 3,
  finalPlayerStateMatchesLastFloor:
    JSON.stringify(runResult.result.finalPlayerState) === JSON.stringify(thirdSession.playerState),
  failedFloorStopsRun:
    failedSynced.run.status === "failed" &&
    failedSynced.run.failureReason === "player-defeated" &&
    failedSynced.run.currentFloorIndex === 0 &&
    failedSynced.run.floorResults.length === 1,
  authoringSpecsUnchanged:
    JSON.stringify(threeFloors) === authoringBefore
};

const falseChecks = Object.entries(checks)
  .filter(([, value]) => value !== true)
  .map(([name]) => name);

const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed: falseChecks.length === 0,
  checks,
  falseChecks,
  oneFloorResult: oneResult.result,
  floorOneFinalState,
  floorTwoStartState,
  floorTwoFinalState,
  floorThreeStartState,
  runResult: runResult.result,
  failedRun: {
    status: failedSynced.run.status,
    failureReason: failedSynced.run.failureReason,
    currentFloorIndex: failedSynced.run.currentFloorIndex,
    floorsCompleted: failedSynced.run.floorResults.length,
    playerState: failedSynced.run.playerState
  }
};

fs.writeFileSync(
  path.join(outputDir, "dai-095-multi-floor-run.json"),
  JSON.stringify(evidence, null, 2) + "\n"
);
console.log(JSON.stringify(evidence, null, 2));

if (!evidence.passed) {
  throw new Error(`DAI-095 multi-floor invariant failed: ${falseChecks.join(", ")}`);
}
