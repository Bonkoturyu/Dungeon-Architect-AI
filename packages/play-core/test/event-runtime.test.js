import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyPlaySessionStateCommand,
  movePlaySession,
  startPlaySession
} from "../src/play-session.js";
import { defeatEnemy, getEnemyState, listRoomEnemies } from "../src/enemy-runtime.js";
import { avoidTrap, listRoomInteractables, inspectTreasure, openTreasure } from "../src/interaction-runtime.js";
import {
  dispatchSupportedEvents,
  getRuntimeDoorState,
  isRuntimeHintRevealed
} from "../src/event-runtime.js";

const fixtureUrl = new URL("../../../spec/dungeon/fixtures/minimal-valid-v1.json", import.meta.url);

async function fixture() {
  return JSON.parse(await readFile(fixtureUrl, "utf8"));
}

function stateCommand(session, command, at = 1) {
  const result = applyPlaySessionStateCommand(session, command, { at });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.session;
}

test("on_open_treasure executes constrained actions once and enables a disabled shortcut", async () => {
  const spec = await fixture();
  spec.corridors[1].initiallyEnabled = false;
  spec.events = [{
    id: "event-open",
    trigger: { type: "on_open_treasure", entityId: "treasure-1" },
    conditions: [{ type: "one_shot" }],
    actions: [
      { type: "enable_shortcut", corridorId: "corridor-2" },
      { type: "set_flag", key: "opened-event", value: true },
      { type: "give_reward", itemId: "event-token", count: 1 },
      { type: "reveal_hint", hintId: "goal-hint" },
      { type: "unlock_open_door", doorId: "gold-door" }
    ]
  }];

  let session = startPlaySession(spec, { startedAt: 100 }).session;
  session = movePlaySession(session, "room-middle", { at: 101 }).session;
  for (const { enemy } of listRoomEnemies(session)) session = defeatEnemy(session, enemy.id).session;
  for (const { entity } of listRoomInteractables(session).filter(({ entity }) => entity.type === 'trap')) session = avoidTrap(session, entity.id).session;

  const blocked = movePlaySession(session, "room-goal", { at: 102 });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error.code, "ROOM_NOT_ADJACENT");

  const beforeOpen = JSON.stringify(session);
  const opened = openTreasure(session, "treasure-1", { at: 103 });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  session = opened.session;
  assert.equal(JSON.stringify(JSON.parse(beforeOpen)), beforeOpen);
  assert.equal(session.gameplayState.flags["opened-event"], true);
  assert.equal(session.gameplayState.inventory["event-token"], 1);
  assert.equal(isRuntimeHintRevealed(session, "goal-hint"), true);
  assert.deepEqual(getRuntimeDoorState(session, "gold-door"), { unlocked: true, open: true });
  assert.equal(session.events.filter((event) => event.type === "logic-event-fired" && event.eventId === "event-open").length, 1);

  const repeated = dispatchSupportedEvents(session, { type: "on_open_treasure", entityId: "treasure-1" }, { at: 104 });
  assert.equal(repeated.ok, true);
  assert.deepEqual(repeated.firedEventIds, []);
  assert.equal(repeated.session.gameplayState.inventory["event-token"], 1);

  const moved = movePlaySession(repeated.session, "room-goal", { at: 105 });
  assert.equal(moved.ok, true);
  assert.equal(moved.session.status, "cleared");
});

test("on_interact_entity evaluates flag item and enemy-group conditions", async () => {
  const spec = await fixture();
  spec.events = [{
    id: "event-conditional-interact",
    trigger: { type: "on_interact_entity", entityId: "treasure-1" },
    conditions: [
      { type: "flag", key: "ready", value: true },
      { type: "item_owned", itemId: "key-a", minCount: 1 },
      { type: "enemy_group_state", enemyIds: ["enemy-1"], state: "not_cleared" }
    ],
    actions: [{ type: "set_flag", key: "conditions-passed", value: true }]
  }];

  let session = startPlaySession(spec).session;
  session = stateCommand(session, { type: "set-flag", key: "ready", value: true });
  session = stateCommand(session, { type: "set-inventory-count", itemId: "key-a", count: 1 });
  session = movePlaySession(session, "room-middle").session;

  const inspected = inspectTreasure(session, "treasure-1", { at: 10 });
  assert.equal(inspected.ok, true);
  assert.equal(inspected.session.gameplayState.flags["conditions-passed"], true);
});

test("same-trigger events execute in stable array order and can form deterministic chains", async () => {
  const spec = await fixture();
  spec.events = [
    {
      id: "event-first",
      trigger: { type: "on_enter_room", roomId: "room-middle" },
      actions: [{ type: "set_flag", key: "chain-ready", value: true }]
    },
    {
      id: "event-second",
      trigger: { type: "on_enter_room", roomId: "room-middle" },
      conditions: [{ type: "flag", key: "chain-ready", value: true }],
      actions: [{ type: "give_reward", itemId: "chain-token", count: 1 }]
    }
  ];

  const started = startPlaySession(spec).session;
  const moved = movePlaySession(started, "room-middle", { at: 20 });
  assert.equal(moved.ok, true);
  assert.equal(moved.session.gameplayState.inventory["chain-token"], 1);
  assert.deepEqual(
    moved.session.events.filter((event) => event.type === "logic-event-fired").map((event) => event.eventId),
    ["event-first", "event-second"]
  );
});

test("on_enemy_group_cleared fires only after the last referenced enemy is defeated", async () => {
  const spec = await fixture();
  spec.entities.push({ id: "enemy-2", type: "enemy", roomId: "room-middle" });
  spec.events = [{
    id: "event-group-cleared",
    trigger: { type: "on_enemy_group_cleared", enemyIds: ["enemy-1", "enemy-2"] },
    conditions: [{ type: "one_shot" }],
    actions: [{ type: "give_reward", itemId: "group-token", count: 1 }]
  }];

  let session = startPlaySession(spec).session;
  session = movePlaySession(session, "room-middle").session;
  session = defeatEnemy(session, "enemy-1", { at: 31 }).session;
  assert.equal(session.gameplayState.inventory["group-token"], undefined);
  session = defeatEnemy(session, "enemy-2", { at: 32 }).session;
  assert.equal(session.gameplayState.inventory["group-token"], 1);
  assert.equal(session.events.filter((event) => event.type === "logic-event-fired" && event.eventId === "event-group-cleared").length, 1);
});

test("spawn_enemy_group activates predeclared dormant enemies on room entry", async () => {
  const spec = await fixture();
  spec.entities.push({ id: "enemy-dormant", type: "enemy", roomId: "room-middle", initiallyActive: false });
  spec.events = [{
    id: "event-spawn",
    trigger: { type: "on_enter_room", roomId: "room-middle" },
    conditions: [{ type: "one_shot" }],
    actions: [{ type: "spawn_enemy_group", enemyIds: ["enemy-dormant"] }]
  }];

  let session = startPlaySession(spec).session;
  assert.equal(getEnemyState(session, "enemy-dormant").state.status, "dormant");
  assert.equal(listRoomEnemies(session, "room-middle").some((entry) => entry.enemy.id === "enemy-dormant"), false);
  session = movePlaySession(session, "room-middle", { at: 40 }).session;
  assert.equal(getEnemyState(session, "enemy-dormant").state.status, "active");
  assert.equal(listRoomEnemies(session, "room-middle").some((entry) => entry.enemy.id === "enemy-dormant"), true);
  assert.ok(session.events.some((event) => event.type === "enemy-spawned" && event.enemyId === "enemy-dormant"));
});

test("START rejects unsupported event definitions through the DungeonSpec gate", async () => {
  const spec = await fixture();
  spec.events = [{
    id: "event-invalid",
    trigger: { type: "on_enter_room", roomId: "room-middle" },
    actions: [{ type: "run_javascript", code: "evil()" }]
  }];

  const started = startPlaySession(spec);
  assert.equal(started.ok, false);
  assert.equal(started.blocked, true);
  assert.ok(started.errors.some((error) => error.code === "EVENT_ACTION_UNSUPPORTED"));
});
