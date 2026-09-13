import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateDungeonSpec } from "../src/dungeon-spec.js";

const fixtureUrl = new URL("../../../spec/dungeon/fixtures/minimal-valid-v1.json", import.meta.url);

async function fixture() {
  return JSON.parse(await readFile(fixtureUrl, "utf8"));
}

test("supported event trigger condition and action vocabulary validates", async () => {
  const spec = await fixture();
  spec.entities.push({ id: "enemy-dormant", type: "enemy", roomId: "room-goal", initiallyActive: false });
  spec.corridors[1].initiallyEnabled = false;
  spec.events = [
    {
      id: "event-enter-middle",
      trigger: { type: "on_enter_room", roomId: "room-middle" },
      conditions: [
        { type: "one_shot" },
        { type: "flag", key: "ready", value: true },
        { type: "item_owned", itemId: "key-a", minCount: 1 },
        { type: "enemy_group_state", enemyIds: ["enemy-1"], state: "not_cleared" }
      ],
      actions: [
        { type: "set_flag", key: "entered", value: true },
        { type: "give_reward", itemId: "token", count: 1 },
        { type: "reveal_hint", hintId: "hint-a" },
        { type: "enable_shortcut", corridorId: "corridor-2" },
        { type: "unlock_open_door", doorId: "door-a" },
        { type: "spawn_enemy_group", enemyIds: ["enemy-dormant"] }
      ]
    },
    {
      id: "event-open-treasure",
      trigger: { type: "on_open_treasure", entityId: "treasure-1" },
      actions: [{ type: "set_flag", key: "treasure-opened", value: true }]
    },
    {
      id: "event-enemies-cleared",
      trigger: { type: "on_enemy_group_cleared", enemyIds: ["enemy-1", "enemy-dormant"] },
      actions: [{ type: "give_reward", itemId: "clear-token", count: 1 }]
    }
  ];

  const result = validateDungeonSpec(spec);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("unsupported event vocabulary is rejected", async () => {
  const spec = await fixture();
  spec.events = [{
    id: "event-bad",
    trigger: { type: "on_timer" },
    conditions: [{ type: "random_chance" }],
    actions: [{ type: "run_javascript", code: "alert(1)" }]
  }];

  const result = validateDungeonSpec(spec);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "EVENT_TRIGGER_UNSUPPORTED"));
  assert.ok(result.errors.some((error) => error.code === "EVENT_CONDITION_UNSUPPORTED"));
  assert.ok(result.errors.some((error) => error.code === "EVENT_ACTION_UNSUPPORTED"));
});

test("event references are type checked", async () => {
  const spec = await fixture();
  spec.events = [
    {
      id: "event-missing-room",
      trigger: { type: "on_enter_room", roomId: "missing-room" },
      actions: [{ type: "set_flag", key: "a", value: true }]
    },
    {
      id: "event-not-treasure",
      trigger: { type: "on_open_treasure", entityId: "enemy-1" },
      actions: [{ type: "set_flag", key: "b", value: true }]
    },
    {
      id: "event-bad-action-refs",
      trigger: { type: "on_interact_entity", entityId: "treasure-1" },
      actions: [
        { type: "enable_shortcut", corridorId: "missing-corridor" },
        { type: "spawn_enemy_group", enemyIds: ["treasure-1"] }
      ]
    }
  ];

  const result = validateDungeonSpec(spec);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "ROOM_REFERENCE_MISSING"));
  assert.ok(result.errors.some((error) => error.code === "TREASURE_REFERENCE_REQUIRED"));
  assert.ok(result.errors.some((error) => error.code === "CORRIDOR_REFERENCE_MISSING"));
  assert.ok(result.errors.some((error) => error.code === "ENEMY_REFERENCE_REQUIRED"));
});

test("event actions must be non-empty and runtime-reserved flag keys are rejected", async () => {
  const spec = await fixture();
  spec.events = [
    {
      id: "event-empty",
      trigger: { type: "on_enter_room", roomId: "room-middle" },
      actions: []
    },
    {
      id: "event-reserved",
      trigger: { type: "on_enter_room", roomId: "room-middle" },
      actions: [{ type: "set_flag", key: "__dai:spoof", value: true }]
    }
  ];

  const result = validateDungeonSpec(spec);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "EVENT_ACTIONS_REQUIRED"));
  assert.ok(result.errors.some((error) => error.code === "FLAG_KEY_RESERVED"));
});
