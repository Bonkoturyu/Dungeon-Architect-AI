import test from "node:test";
import assert from "node:assert/strict";
import { generateDungeonSpec } from "../../generator/src/dungeon-generator.js";
import { startPlaySession } from "../src/play-session.js";
import {
  createInitialPlayerState,
  deterministicEnemyReward,
  deterministicTreasureReward,
  grantProgressionReward,
  xpRequiredForNextLevel
} from "../src/progression-runtime.js";

function fixture(seed = 94094) {
  return generateDungeonSpec({ seed, roomCount: 5, routeChoice: 0, id: "progression-fixture" });
}

test("initial progression state is deterministic and has two empty equipment slots", () => {
  assert.deepEqual(createInitialPlayerState(20), {
    hp: 20,
    maxHp: 20,
    level: 1,
    xp: 0,
    gold: 0,
    equipment: {
      weapon: null,
      armor: null
    }
  });
  assert.equal(xpRequiredForNextLevel(1), 20);
  assert.equal(xpRequiredForNextLevel(3), 60);
});

test("enemy and treasure reward tables are deterministic for seed plus entity ID", () => {
  const first = startPlaySession(fixture(111)).session;
  const second = startPlaySession(fixture(111)).session;

  assert.deepEqual(
    deterministicEnemyReward(first, "enemy-a"),
    deterministicEnemyReward(second, "enemy-a")
  );
  assert.deepEqual(
    deterministicTreasureReward(first, "treasure-a"),
    deterministicTreasureReward(second, "treasure-a")
  );

  const treasure = deterministicTreasureReward(first, "treasure-a");
  assert.ok(treasure.gold >= 5 && treasure.gold <= 15);
  assert.ok(["weapon", "armor"].includes(treasure.item.slot));
  assert.ok(treasure.item.tier >= 1 && treasure.item.tier <= 3);
});

test("progression rewards level up, grow MaxHP, add inventory, and auto-equip upgrades", () => {
  const started = startPlaySession(fixture(), { maxHp: 20 }).session;
  const first = grantProgressionReward(started, {
    xp: 25,
    gold: 7,
    item: { id: "weapon-tier-1", slot: "weapon", tier: 1 },
    sourceType: "test",
    sourceId: "reward-a",
    at: 1
  });

  assert.equal(first.ok, true);
  assert.equal(started.playerState.level, 1);
  assert.equal(first.session.playerState.level, 2);
  assert.equal(first.session.playerState.xp, 5);
  assert.equal(first.session.playerState.gold, 7);
  assert.equal(first.session.playerState.maxHp, 22);
  assert.equal(first.session.playerState.hp, 22);
  assert.deepEqual(first.session.playerState.equipment.weapon, {
    id: "weapon-tier-1",
    slot: "weapon",
    tier: 1
  });
  assert.equal(first.session.gameplayState.inventory["weapon-tier-1"], 1);
  assert.equal(first.session.gameplayState.counters.xpEarned, 25);
  assert.equal(first.session.gameplayState.counters.goldEarned, 7);
  assert.equal(first.session.gameplayState.counters.levelUps, 1);
  assert.equal(first.session.gameplayState.counters.lootCollected, 1);

  const weaker = grantProgressionReward(first.session, {
    item: { id: "weapon-tier-1b", slot: "weapon", tier: 1 },
    sourceType: "test",
    sourceId: "reward-b",
    at: 2
  });
  assert.equal(weaker.ok, true);
  assert.equal(weaker.session.playerState.equipment.weapon.id, "weapon-tier-1");

  const stronger = grantProgressionReward(weaker.session, {
    item: { id: "weapon-tier-3", slot: "weapon", tier: 3 },
    sourceType: "test",
    sourceId: "reward-c",
    at: 3
  });
  assert.equal(stronger.ok, true);
  assert.equal(stronger.session.playerState.equipment.weapon.id, "weapon-tier-3");
  assert.equal(stronger.session.gameplayState.counters.lootCollected, 3);
});

test("progression reward rejects malformed loot without mutating source session", () => {
  const started = startPlaySession(fixture()).session;
  const before = JSON.stringify(started);
  const result = grantProgressionReward(started, {
    item: { id: "bad", slot: "ring", tier: 1 }
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "LOOT_ITEM_INVALID");
  assert.equal(JSON.stringify(started), before);
});
