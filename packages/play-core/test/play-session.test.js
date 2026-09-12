import test from "node:test";
import assert from "node:assert/strict";
import { generateDungeonSpec } from "../../generator/src/dungeon-generator.js";
import { startPlaySession, movePlaySession, createPlayResult } from "../src/play-session.js";

function fixture() {
  return generateDungeonSpec({ seed: 909, roomCount: 5, routeChoice: 0, id: "play-fixture" });
}

test("START rejects an invalid authoring spec", () => {
  const spec = fixture();
  spec.corridors = [];
  const result = startPlaySession(spec);
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.ok(result.errors.some((error) => error.code === "GOAL_UNREACHABLE"));
});

test("START creates an execution snapshot independent from later authoring changes", () => {
  const spec = fixture();
  const result = startPlaySession(spec, { startedAt: 100 });
  assert.equal(result.ok, true);
  const originalWidth = result.session.snapshot.rooms[0].width;
  spec.rooms[0].width = 999;
  assert.equal(result.session.snapshot.rooms[0].width, originalWidth);
});

test("movement only allows adjacent rooms", () => {
  const started = startPlaySession(fixture()).session;
  const result = movePlaySession(started, "room-003");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "ROOM_NOT_ADJACENT");
});

test("backbone path can be played from Start to Goal", () => {
  let session = startPlaySession(fixture(), { startedAt: 1000 }).session;
  for (const roomId of ["room-002", "room-003", "room-004", "room-005"]) {
    const moved = movePlaySession(session, roomId, { at: 1000 + session.moves + 1 });
    assert.equal(moved.ok, true);
    session = moved.session;
  }
  assert.equal(session.status, "cleared");
  assert.equal(session.currentRoomId, "room-005");
  assert.deepEqual(session.visitedRoomIds, ["room-001", "room-002", "room-003", "room-004", "room-005"]);
});

test("cleared session produces a deterministic basic Result", () => {
  let session = startPlaySession(fixture(), { startedAt: 10 }).session;
  for (const roomId of ["room-002", "room-003", "room-004", "room-005"]) {
    session = movePlaySession(session, roomId, { at: 10 + session.moves + 5 }).session;
  }
  const result = createPlayResult(session);
  assert.equal(result.ok, true);
  assert.equal(result.result.status, "cleared");
  assert.equal(result.result.moves, 4);
  assert.equal(result.result.finalRoomId, "room-005");
});
