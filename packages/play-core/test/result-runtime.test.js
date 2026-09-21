import test from "node:test";
import assert from "node:assert/strict";
import { generateDungeonSpec } from "../../generator/src/dungeon-generator.js";
import {
  PLAY_FAILURE_REASONS,
  applyPlaySessionStateCommand,
  createPlayResult,
  failPlaySession,
  movePlaySession,
  startPlaySession
} from "../src/play-session.js";

function fixture() {
  return generateDungeonSpec({ seed: 34034, roomCount: 5, routeChoice: 0, id: "result-fixture" });
}

function move(session, roomId, at) {
  const result = movePlaySession(session, roomId, { at });
  assert.equal(result.ok, true);
  return result.session;
}

function increment(session, counter, delta, at) {
  const result = applyPlaySessionStateCommand(session, {
    type: "increment-counter",
    counter,
    delta
  }, { at });
  assert.equal(result.ok, true);
  return result.session;
}

test("supported terminal failure reasons are fixed", () => {
  assert.deepEqual(PLAY_FAILURE_REASONS, [
    "player-defeated",
    "timeout",
    "progression-blocked",
    "stopped"
  ]);
});

test("failure transition is immutable and terminal", () => {
  const started = startPlaySession(fixture(), { startedAt: 100 }).session;
  const moved = move(started, "room-002", 110);
  const beforeFailure = JSON.stringify(moved);

  const failed = failPlaySession(moved, "timeout", { at: 160 });
  assert.equal(failed.ok, true);
  assert.equal(JSON.stringify(moved), beforeFailure);
  assert.equal(failed.session.status, "failed");
  assert.equal(failed.session.failureReason, "timeout");
  assert.equal(failed.session.completedAt, 160);
  assert.deepEqual(failed.session.events.at(-1), {
    type: "session-failed",
    reason: "timeout",
    roomId: "room-002",
    at: 160
  });

  const moveAfterFailure = movePlaySession(failed.session, "room-003", { at: 170 });
  assert.equal(moveAfterFailure.ok, false);
  assert.equal(moveAfterFailure.error.code, "SESSION_NOT_PLAYING");

  const stateAfterFailure = applyPlaySessionStateCommand(failed.session, {
    type: "set-flag",
    key: "after-failure",
    value: true
  });
  assert.equal(stateAfterFailure.ok, false);
  assert.equal(stateAfterFailure.error.code, "SESSION_NOT_PLAYING");
});

test("invalid failure reasons are rejected without mutation", () => {
  const session = startPlaySession(fixture()).session;
  const before = JSON.stringify(session);
  const result = failPlaySession(session, "unknown-reason", { at: 5 });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "FAILURE_REASON_UNSUPPORTED");
  assert.equal(JSON.stringify(session), before);
});

test("cleared Result exposes route and gameplay metrics", () => {
  let session = startPlaySession(fixture(), { startedAt: 1000 }).session;
  session = increment(session, "damageTaken", 7, 1001);
  session = increment(session, "healingReceived", 3, 1002);
  session = increment(session, "interactions", 2, 1003);
  session = increment(session, "treasuresOpened", 1, 1004);
  session = increment(session, "trapsTriggered", 1, 1005);
  session = increment(session, "enemiesCleared", 1, 1006);
  session = increment(session, "recoveryUsed", 1, 1007);

  session = move(session, "room-002", 1010);
  session = move(session, "room-003", 1020);
  session = move(session, "room-004", 1030);
  session = move(session, "room-005", 1040);

  assert.equal(session.status, "cleared");
  const result = createPlayResult(session);
  assert.equal(result.ok, true);
  assert.equal(result.result.schemaVersion, "1.0");
  assert.equal(result.result.status, "cleared");
  assert.equal(result.result.failureReason, null);
  assert.deepEqual(result.result.playerState, { hp: 20, maxHp: 20 });
  assert.equal(result.result.elapsed, 40);
  assert.deepEqual(result.result.routeRoomIds, [
    "room-001", "room-002", "room-003", "room-004", "room-005"
  ]);
  assert.deepEqual(result.result.visitedRoomIds, [
    "room-001", "room-002", "room-003", "room-004", "room-005"
  ]);
  assert.deepEqual(result.result.metrics, {
    roomsVisited: 5,
    roomEntries: 5,
    interactions: 2,
    enemiesCleared: 1,
    treasuresOpened: 1,
    trapsTriggered: 1,
    recoveryUsed: 1,
    damageTaken: 7,
    healingReceived: 3,
    deaths: 0
  });
});

test("failed Result preserves route, reason, metrics, and final room", () => {
  let session = startPlaySession(fixture(), { startedAt: 2000 }).session;
  session = move(session, "room-002", 2010);
  session = move(session, "room-003", 2020);
  session = increment(session, "damageTaken", 12, 2021);

  const failed = failPlaySession(session, "timeout", { at: 2060 });
  assert.equal(failed.ok, true);
  const result = createPlayResult(failed.session);
  assert.equal(result.ok, true);
  assert.equal(result.result.status, "failed");
  assert.equal(result.result.failureReason, "timeout");
  assert.equal(result.result.elapsed, 60);
  assert.equal(result.result.finalRoomId, "room-003");
  assert.deepEqual(result.result.routeRoomIds, ["room-001", "room-002", "room-003"]);
  assert.equal(result.result.metrics.roomsVisited, 3);
  assert.equal(result.result.metrics.roomEntries, 3);
  assert.equal(result.result.metrics.damageTaken, 12);
  assert.equal(result.result.metrics.deaths, 0);
});

test("player-defeated failure reports one terminal death", () => {
  const started = startPlaySession(fixture(), { startedAt: 3000 }).session;
  const failed = failPlaySession(started, "player-defeated", { at: 3015 });
  assert.equal(failed.ok, true);
  const result = createPlayResult(failed.session);
  assert.equal(result.ok, true);
  assert.equal(result.result.failureReason, "player-defeated");
  assert.deepEqual(result.result.playerState, { hp: 0, maxHp: 20 });
  assert.equal(result.result.metrics.deaths, 1);
});

test("unfinished sessions do not produce Result", () => {
  const session = startPlaySession(fixture()).session;
  const result = createPlayResult(session);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SESSION_NOT_FINISHED");
});

test("clear is terminal and cannot be overwritten by failure", () => {
  let session = startPlaySession(fixture(), { startedAt: 10 }).session;
  for (const roomId of ["room-002", "room-003", "room-004", "room-005"]) {
    session = move(session, roomId, 10 + session.moves + 1);
  }
  assert.equal(session.status, "cleared");
  const failed = failPlaySession(session, "stopped", { at: 99 });
  assert.equal(failed.ok, false);
  assert.equal(failed.error.code, "SESSION_NOT_PLAYING");
});
