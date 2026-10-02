import test from "node:test";
import assert from "node:assert/strict";
import { generateDungeonSpec } from "../../generator/src/dungeon-generator.js";
import { movePlaySession, startPlaySession } from "../src/play-session.js";
import {
  avoidTrap,
  getRecoveryState,
  getTrapState,
  getTreasureState,
  inspectTrap,
  inspectTreasure,
  listRoomInteractables,
  openTreasure,
  triggerTrap,
  useRecovery
} from "../src/interaction-runtime.js";

function fixture({ seed = 32032 } = {}) {
  const spec = generateDungeonSpec({ seed, roomCount: 6, routeChoice: 0, id: "interaction-fixture" });
  spec.entities.push(
    { id: "treasure-test", type: "treasure", roomId: "room-002", warning: "floor-scratches" },
    { id: "trap-test", type: "trap", roomId: "room-003", warning: "floor-cracks" },
    { id: "recovery-test", type: "recovery", roomId: "room-004" }
  );
  return spec;
}

test("treasure inspection exposes warning metadata without opening the treasure", () => {
  const spec = fixture();
  const authoringBefore = JSON.stringify(spec);
  const started = startPlaySession(spec, { startedAt: 100 }).session;
  const snapshotBefore = JSON.stringify(started.snapshot);
  const moved = movePlaySession(started, "room-002", { at: 101 }).session;

  const view = getTreasureState(moved, "treasure-test");
  assert.equal(view.warning, "floor-scratches");
  assert.equal(view.state.status, "closed");
  assert.equal(view.state.inspections, 0);

  const inspected = inspectTreasure(moved, "treasure-test", { at: 102 });
  assert.equal(inspected.ok, true);
  assert.equal(getTreasureState(moved, "treasure-test").state.inspections, 0);
  assert.equal(getTreasureState(inspected.session, "treasure-test").state.inspections, 1);
  assert.equal(getTreasureState(inspected.session, "treasure-test").state.status, "closed");
  assert.equal(inspected.session.gameplayState.counters.interactions, 1);
  assert.equal(inspected.session.events.at(-1).type, "treasure-inspected");
  assert.equal(JSON.stringify(spec), authoringBefore);
  assert.equal(JSON.stringify(inspected.session.snapshot), snapshotBefore);
});

test("treasure opening requires current room and increments exactly once", () => {
  const started = startPlaySession(fixture()).session;
  const remote = openTreasure(started, "treasure-test");
  assert.equal(remote.ok, false);
  assert.equal(remote.error.code, "TREASURE_NOT_IN_CURRENT_ROOM");

  const moved = movePlaySession(started, "room-002").session;
  const opened = openTreasure(moved, "treasure-test", { at: 20 });
  assert.equal(opened.ok, true);
  assert.equal(getTreasureState(opened.session, "treasure-test").state.status, "opened");
  assert.equal(opened.session.gameplayState.counters.treasuresOpened, 1);
  assert.equal(opened.session.gameplayState.counters.interactions, 1);
  assert.ok(opened.reward.gold >= 5);
  assert.ok(["weapon", "armor"].includes(opened.reward.item.slot));
  assert.equal(opened.session.gameplayState.counters.goldEarned, opened.reward.gold);
  assert.equal(opened.session.gameplayState.counters.lootCollected, 1);
  assert.equal(opened.session.gameplayState.inventory[opened.reward.item.id], 1);
  assert.deepEqual(opened.session.playerState.equipment[opened.reward.item.slot], opened.reward.item);
  assert.equal(opened.session.events.at(-1).type, "progression-reward");
  assert.equal(listRoomInteractables(opened.session).length, 0);
  assert.equal(listRoomInteractables(opened.session, "room-002", { includeResolved: true }).length, 1);

  const repeated = openTreasure(opened.session, "treasure-test");
  assert.equal(repeated.ok, false);
  assert.equal(repeated.error.code, "TREASURE_ALREADY_OPENED");
  assert.equal(opened.session.gameplayState.counters.treasuresOpened, 1);
});

test("trap can be inspected and avoided without incrementing trapsTriggered", () => {
  let session = startPlaySession(fixture({ seed: 0 })).session;
  session = movePlaySession(session, "room-002").session;
  session = movePlaySession(session, "room-003").session;

  const inspected = inspectTrap(session, "trap-test", { at: 30 });
  assert.equal(inspected.ok, true);
  assert.equal(getTrapState(inspected.session, "trap-test").warning, "floor-cracks");
  assert.equal(getTrapState(inspected.session, "trap-test").state.status, "armed");
  assert.equal(getTrapState(inspected.session, "trap-test").state.inspections, 1);

  const avoided = avoidTrap(inspected.session, "trap-test", { at: 31 });
  assert.equal(avoided.ok, true);
  assert.equal(getTrapState(avoided.session, "trap-test").state.status, "avoided");
  assert.equal(avoided.session.gameplayState.counters.trapsTriggered, 0);
  assert.equal(avoided.session.events.at(-1).type, "trap-avoided");

  const repeated = triggerTrap(avoided.session, "trap-test", { at: 32 });
  assert.equal(repeated.ok, false);
  assert.equal(repeated.error.code, "TRAP_ALREADY_RESOLVED");
});

test("trap triggering increments trapsTriggered once", () => {
  let session = startPlaySession(fixture()).session;
  session = movePlaySession(session, "room-002").session;
  session = movePlaySession(session, "room-003").session;

  const triggered = triggerTrap(session, "trap-test", { at: 40 });
  assert.equal(triggered.ok, true);
  assert.equal(getTrapState(triggered.session, "trap-test").state.status, "triggered");
  assert.equal(triggered.session.gameplayState.counters.trapsTriggered, 1);
  assert.equal(triggered.session.gameplayState.counters.damageTaken, 6);
  assert.equal(triggered.session.playerState.hp, 14);
  assert.ok(triggered.session.events.some((event) => event.type === "trap-triggered"));
  assert.equal(triggered.session.events.at(-1).type, "player-damaged");

  const repeated = triggerTrap(triggered.session, "trap-test", { at: 41 });
  assert.equal(repeated.ok, false);
  assert.equal(repeated.error.code, "TRAP_ALREADY_RESOLVED");
  assert.equal(triggered.session.gameplayState.counters.trapsTriggered, 1);
});

test("recovery use is one-shot and increments recoveryUsed", () => {
  let session = startPlaySession(fixture()).session;
  session = movePlaySession(session, "room-002").session;
  session = movePlaySession(session, "room-003").session;
  session = triggerTrap(session, "trap-test", { at: 49 }).session;
  assert.equal(session.playerState.hp, 14);
  session = movePlaySession(session, "room-004").session;

  const used = useRecovery(session, "recovery-test", { at: 50 });
  assert.equal(used.ok, true);
  assert.equal(getRecoveryState(used.session, "recovery-test").state.status, "used");
  assert.equal(used.session.gameplayState.counters.recoveryUsed, 1);
  assert.equal(used.session.gameplayState.counters.interactions, 2);
  assert.equal(used.session.gameplayState.counters.healingReceived, 6);
  assert.equal(used.session.playerState.hp, 20);
  assert.ok(used.session.events.some((event) => event.type === "recovery-used"));
  assert.equal(used.session.events.at(-1).type, "player-healed");

  const repeated = useRecovery(used.session, "recovery-test", { at: 51 });
  assert.equal(repeated.ok, false);
  assert.equal(repeated.error.code, "RECOVERY_ALREADY_USED");
  assert.equal(used.session.gameplayState.counters.recoveryUsed, 1);
});

test("interaction runtime rejects unknown IDs and finished-session actions", () => {
  let session = startPlaySession(fixture()).session;
  const unknown = getTreasureState(session, "missing");
  assert.equal(unknown, null);

  const remoteRecovery = useRecovery(session, "recovery-test");
  assert.equal(remoteRecovery.ok, false);
  assert.equal(remoteRecovery.error.code, "RECOVERY_NOT_IN_CURRENT_ROOM");

  for (const roomId of ["room-002", "room-003", "room-004", "room-005", "room-006"]) {
    session = movePlaySession(session, roomId).session;
    if (roomId === 'room-003') session = avoidTrap(session, 'trap-test').session;
  }
  assert.equal(session.status, "cleared");

  const afterClear = inspectTreasure(session, "treasure-test");
  assert.equal(afterClear.ok, false);
  assert.equal(afterClear.error.code, "SESSION_NOT_PLAYING");
});
