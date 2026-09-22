import test from "node:test";
import assert from "node:assert/strict";
import { generateDungeonSpec } from "../../generator/src/dungeon-generator.js";
import { applyPlayerDamage, movePlaySession } from "../../play-core/src/play-session.js";
import { grantProgressionReward } from "../../play-core/src/progression-runtime.js";
import {
  MAX_DUNGEON_RUN_FLOORS,
  createDungeonRunResult,
  createDungeonRunSpec,
  startDungeonRun,
  syncDungeonRunFloor,
  validateDungeonRunSpec
} from "../src/dungeon-run.js";

function dungeon(index) {
  return generateDungeonSpec({
    seed: 95000 + index,
    roomCount: 5,
    routeChoice: 0,
    id: `run-floor-dungeon-${index}`
  });
}

function shortestPath(spec, fromRoomId, toRoomId) {
  const graph = new Map(spec.rooms.map((room) => [room.id, []]));
  for (const corridor of spec.corridors) {
    if (corridor.initiallyEnabled === false) continue;
    graph.get(corridor.fromRoomId)?.push(corridor.toRoomId);
    graph.get(corridor.toRoomId)?.push(corridor.fromRoomId);
  }

  const queue = [[fromRoomId]];
  const seen = new Set([fromRoomId]);
  while (queue.length) {
    const path = queue.shift();
    const roomId = path.at(-1);
    if (roomId === toRoomId) return path;
    for (const next of graph.get(roomId) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push([...path, next]);
    }
  }
  throw new Error(`No path from ${fromRoomId} to ${toRoomId}`);
}

function clearCurrentFloor(run, atBase) {
  let session = run.currentFloorSession;
  const path = shortestPath(session.snapshot, session.currentRoomId, session.goalRoomId);
  for (let index = 1; index < path.length; index += 1) {
    const moved = movePlaySession(session, path[index], { at: atBase + index });
    assert.equal(moved.ok, true, JSON.stringify(moved.error));
    session = moved.session;
  }
  assert.equal(session.status, "cleared");
  return session;
}

test("DungeonRunSpec accepts 1 through 10 validated floors and rejects invalid counts", () => {
  const one = createDungeonRunSpec([dungeon(1)], { id: "one-floor" });
  assert.equal(one.ok, true);
  assert.equal(validateDungeonRunSpec(one.spec).valid, true);

  const ten = createDungeonRunSpec(
    Array.from({ length: MAX_DUNGEON_RUN_FLOORS }, (_, index) => dungeon(index + 1)),
    { id: "ten-floor" }
  );
  assert.equal(ten.ok, true);
  assert.equal(ten.spec.floors.length, 10);

  const empty = createDungeonRunSpec([], { id: "empty" });
  assert.equal(empty.ok, false);
  assert.ok(empty.errors.some((entry) => entry.code === "RUN_FLOOR_COUNT_INVALID"));

  const eleven = createDungeonRunSpec(
    Array.from({ length: MAX_DUNGEON_RUN_FLOORS + 1 }, (_, index) => dungeon(index + 1)),
    { id: "eleven-floor" }
  );
  assert.equal(eleven.ok, false);
  assert.ok(eleven.errors.some((entry) => entry.code === "RUN_FLOOR_COUNT_INVALID"));
});

test("DungeonRunSpec rejects duplicate dungeon IDs and invalid floor DungeonSpecs", () => {
  const first = dungeon(1);
  const duplicate = JSON.parse(JSON.stringify(first));
  const created = createDungeonRunSpec([first, duplicate], { id: "duplicate-dungeon" });
  assert.equal(created.ok, false);
  assert.ok(created.errors.some((entry) => entry.code === "RUN_DUNGEON_ID_DUPLICATE"));

  const invalid = dungeon(2);
  invalid.corridors = [];
  const invalidRun = createDungeonRunSpec([invalid], { id: "invalid-floor" });
  assert.equal(invalidRun.ok, false);
  assert.ok(invalidRun.errors.some((entry) => entry.path.startsWith("floors[0].dungeon.")));
});

test("single-floor run preserves existing PlaySession semantics and produces a run result", () => {
  const runSpec = createDungeonRunSpec([dungeon(1)], { id: "single-floor-run" }).spec;
  const started = startDungeonRun(runSpec, { startedAt: 100 });
  assert.equal(started.ok, true);
  assert.equal(started.run.floorCount, 1);
  assert.equal(started.run.currentFloorIndex, 0);
  assert.equal(started.run.currentFloorSession.playerState.level, 1);

  const clearedFloor = clearCurrentFloor(started.run, 110);
  const synced = syncDungeonRunFloor(started.run, clearedFloor, { at: 120 });
  assert.equal(synced.ok, true);
  assert.equal(synced.finished, true);
  assert.equal(synced.run.status, "cleared");
  assert.equal(synced.run.floorResults.length, 1);

  const result = createDungeonRunResult(synced.run);
  assert.equal(result.ok, true);
  assert.equal(result.result.status, "cleared");
  assert.equal(result.result.floorCount, 1);
  assert.equal(result.result.floorsCompleted, 1);
});

test("multi-floor run carries PlayerState exactly between floors", () => {
  const runSpec = createDungeonRunSpec(
    [dungeon(1), dungeon(2), dungeon(3)],
    { id: "carry-run" }
  ).spec;
  const started = startDungeonRun(runSpec, { startedAt: 200 });
  assert.equal(started.ok, true);

  let run = started.run;
  let floor = grantProgressionReward(run.currentFloorSession, {
    xp: 25,
    gold: 7,
    item: { id: "weapon-tier-2", slot: "weapon", tier: 2 },
    sourceType: "test",
    sourceId: "carry-probe",
    at: 201
  }).session;
  floor = applyPlayerDamage(floor, 5, {
    at: 202,
    sourceType: "test",
    sourceId: "carry-damage"
  }).session;

  assert.deepEqual(floor.playerState, {
    hp: 17,
    maxHp: 22,
    level: 2,
    xp: 5,
    gold: 7,
    equipment: {
      weapon: { id: "weapon-tier-2", slot: "weapon", tier: 2 },
      armor: null
    }
  });

  run = syncDungeonRunFloor(run, floor, { at: 203 }).run;
  const clearedFirst = clearCurrentFloor({ ...run, currentFloorSession: floor }, 210);
  const advanced = syncDungeonRunFloor(run, clearedFirst, { at: 220 });
  assert.equal(advanced.ok, true);
  assert.equal(advanced.advanced, true);
  assert.equal(advanced.run.currentFloorIndex, 1);
  assert.deepEqual(advanced.run.currentFloorSession.playerState, clearedFirst.playerState);
  assert.deepEqual(advanced.run.playerState, clearedFirst.playerState);

  run = advanced.run;
  const clearedSecond = clearCurrentFloor(run, 230);
  const advancedAgain = syncDungeonRunFloor(run, clearedSecond, { at: 240 });
  assert.equal(advancedAgain.ok, true);
  assert.equal(advancedAgain.advanced, true);
  assert.equal(advancedAgain.run.currentFloorIndex, 2);
  assert.deepEqual(advancedAgain.run.currentFloorSession.playerState, clearedSecond.playerState);

  run = advancedAgain.run;
  const clearedThird = clearCurrentFloor(run, 250);
  const finished = syncDungeonRunFloor(run, clearedThird, { at: 260 });
  assert.equal(finished.ok, true);
  assert.equal(finished.finished, true);
  assert.equal(finished.run.status, "cleared");
  assert.equal(finished.run.floorResults.length, 3);
  assert.deepEqual(finished.run.playerState, clearedThird.playerState);

  const result = createDungeonRunResult(finished.run);
  assert.equal(result.ok, true);
  assert.equal(result.result.floorsCompleted, 3);
  assert.deepEqual(result.result.finalPlayerState, clearedThird.playerState);
});

test("failed floor terminates the whole run without starting the next floor", () => {
  const runSpec = createDungeonRunSpec([dungeon(1), dungeon(2)], { id: "failed-run" }).spec;
  const started = startDungeonRun(runSpec, { startedAt: 300 });
  const lethal = applyPlayerDamage(started.run.currentFloorSession, 999, {
    at: 301,
    sourceType: "test",
    sourceId: "lethal"
  });
  assert.equal(lethal.ok, true);
  assert.equal(lethal.session.status, "failed");

  const synced = syncDungeonRunFloor(started.run, lethal.session, { at: 301 });
  assert.equal(synced.ok, true);
  assert.equal(synced.finished, true);
  assert.equal(synced.advanced, false);
  assert.equal(synced.run.status, "failed");
  assert.equal(synced.run.failureReason, "player-defeated");
  assert.equal(synced.run.currentFloorIndex, 0);
  assert.equal(synced.run.floorResults.length, 1);
  assert.equal(synced.run.playerState.hp, 0);
});

test("sync rejects a PlaySession from a different floor", () => {
  const runSpec = createDungeonRunSpec([dungeon(1), dungeon(2)], { id: "mismatch-run" }).spec;
  const first = startDungeonRun(runSpec).run;
  const other = startDungeonRun(
    createDungeonRunSpec([dungeon(3)], { id: "other-run" }).spec
  ).run.currentFloorSession;

  const synced = syncDungeonRunFloor(first, other);
  assert.equal(synced.ok, false);
  assert.equal(synced.error.code, "RUN_FLOOR_SESSION_MISMATCH");
});
