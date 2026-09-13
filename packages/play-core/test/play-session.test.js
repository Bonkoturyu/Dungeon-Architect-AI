import test from "node:test";
import assert from "node:assert/strict";
import { generateDungeonSpec } from "../../generator/src/dungeon-generator.js";
import {
  applyPlaySessionStateCommand,
  createPlayResult,
  movePlaySession,
  startPlaySession
} from "../src/play-session.js";

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

test("START creates deterministic renderer-independent gameplay state", () => {
  const session = startPlaySession(fixture()).session;
  assert.deepEqual(session.gameplayState, {
    schemaVersion: "1.0",
    flags: {},
    inventory: {},
    entityStates: {},
    counters: {
      roomEntries: 1,
      interactions: 0,
      enemiesCleared: 0,
      treasuresOpened: 0,
      trapsTriggered: 0,
      recoveryUsed: 0,
      damageTaken: 0,
      healingReceived: 0
    }
  });
});

test("movement only allows adjacent rooms", () => {
  const started = startPlaySession(fixture()).session;
  const result = movePlaySession(started, "room-003");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "ROOM_NOT_ADJACENT");
});

test("movement increments roomEntries without mutating the previous session", () => {
  const started = startPlaySession(fixture()).session;
  const moved = movePlaySession(started, "room-002", { at: 10 });
  assert.equal(moved.ok, true);
  assert.equal(started.gameplayState.counters.roomEntries, 1);
  assert.equal(moved.session.gameplayState.counters.roomEntries, 2);
  assert.equal(started.events.length, 0);
  assert.equal(moved.session.events.length, 1);
});

test("generic gameplay state commands are immutable and do not mutate the execution snapshot", () => {
  const started = startPlaySession(fixture(), { startedAt: 50 }).session;
  const snapshotBefore = JSON.stringify(started.snapshot);

  const flagged = applyPlaySessionStateCommand(started, {
    type: "set-flag",
    key: "switch-a",
    value: true
  }, { at: 51 });
  assert.equal(flagged.ok, true);
  assert.equal(started.gameplayState.flags["switch-a"], undefined);
  assert.equal(flagged.session.gameplayState.flags["switch-a"], true);

  const inventory = applyPlaySessionStateCommand(flagged.session, {
    type: "set-inventory-count",
    itemId: "key-a",
    count: 1
  }, { at: 52 });
  assert.equal(inventory.ok, true);
  assert.equal(flagged.session.gameplayState.inventory["key-a"], undefined);
  assert.equal(inventory.session.gameplayState.inventory["key-a"], 1);
  assert.equal(JSON.stringify(inventory.session.snapshot), snapshotBefore);
  assert.equal(inventory.session.events.at(-1).type, "state-command");
});

test("entity state accepts snapshot entities and rejects unknown entity IDs", () => {
  const spec = fixture();
  spec.entities.push({ id: "treasure-test", type: "treasure", roomId: "room-003" });
  const started = startPlaySession(spec).session;

  const accepted = applyPlaySessionStateCommand(started, {
    type: "set-entity-state",
    entityId: "treasure-test",
    state: { opened: true }
  });
  assert.equal(accepted.ok, true);
  assert.deepEqual(accepted.session.gameplayState.entityStates["treasure-test"], { opened: true });

  const rejected = applyPlaySessionStateCommand(started, {
    type: "set-entity-state",
    entityId: "missing-entity",
    state: { opened: true }
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "INVALID_STATE_COMMAND");
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
  assert.equal(session.gameplayState.counters.roomEntries, 5);
});

test("state commands are rejected once the play session is finished", () => {
  let session = startPlaySession(fixture()).session;
  for (const roomId of ["room-002", "room-003", "room-004", "room-005"]) {
    session = movePlaySession(session, roomId).session;
  }
  const result = applyPlaySessionStateCommand(session, {
    type: "set-flag",
    key: "after-clear",
    value: true
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SESSION_NOT_PLAYING");
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
