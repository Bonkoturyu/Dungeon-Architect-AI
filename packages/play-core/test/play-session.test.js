import test from "node:test";
import assert from "node:assert/strict";
import { generateDungeonSpec } from "../../generator/src/dungeon-generator.js";
import {
  applyPlaySessionStateCommand,
  applyPlayerDamage,
  applyPlayerHealing,
  createPlayResult,
  movePlaySession,
  startPlaySession
} from "../src/play-session.js";
import {
  defeatEnemy,
  getEnemyState,
  listRoomEnemies,
  recordEnemyEncounter,
  resolveEnemyCombat
} from "../src/enemy-runtime.js";

function fixture() {
  return generateDungeonSpec({ seed: 909, roomCount: 5, routeChoice: 0, id: "play-fixture" });
}

function enemyFixture({ roomId = "room-002", enemyId = "enemy-test" } = {}) {
  const spec = fixture();
  spec.entities.push({ id: enemyId, type: "enemy", roomId });
  return spec;
}

test("START rejects an invalid authoring spec", () => {
  const spec = fixture();
  spec.corridors = [];
  const result = startPlaySession(spec);
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.ok(result.errors.some((error) => error.code === "GOAL_UNREACHABLE"));
});

test("START blocks cyclic authoring values instead of throwing during snapshot clone", () => {
  const spec = fixture();
  spec.rooms[0].runtime = {};
  spec.rooms[0].runtime.self = spec.rooms[0].runtime;

  const result = startPlaySession(spec);
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.ok(result.errors.some((error) => error.code === "JSON_CYCLE"));
});

test("movement returns SESSION_NOT_PLAYING for a missing session", () => {
  const nullResult = movePlaySession(null, "room-002");
  assert.equal(nullResult.ok, false);
  assert.equal(nullResult.error.code, "SESSION_NOT_PLAYING");

  const undefinedResult = movePlaySession(undefined, "room-002");
  assert.equal(undefinedResult.ok, false);
  assert.equal(undefinedResult.error.code, "SESSION_NOT_PLAYING");
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
  assert.deepEqual(session.playerState, {
    hp: 20,
    maxHp: 20,
    level: 1,
    xp: 0,
    gold: 0,
    equipment: { weapon: null, armor: null }
  });
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
      healingReceived: 0,
      xpEarned: 0,
      goldEarned: 0,
      levelUps: 0,
      lootCollected: 0
    }
  });
});

test("START can carry a validated PlayerState without aliasing the caller", () => {
  const carried = {
    hp: 13,
    maxHp: 24,
    level: 3,
    xp: 7,
    gold: 42,
    equipment: {
      weapon: { id: "weapon-tier-2", slot: "weapon", tier: 2 },
      armor: { id: "armor-tier-1", slot: "armor", tier: 1 }
    }
  };
  const started = startPlaySession(fixture(), {
    startedAt: 5,
    initialPlayerState: carried
  });

  assert.equal(started.ok, true);
  assert.deepEqual(started.session.playerState, carried);
  carried.hp = 1;
  carried.equipment.weapon.tier = 99;
  assert.equal(started.session.playerState.hp, 13);
  assert.equal(started.session.playerState.equipment.weapon.tier, 2);

  const invalid = startPlaySession(fixture(), {
    initialPlayerState: {
      ...started.session.playerState,
      hp: 999
    }
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.blocked, true);
  assert.equal(invalid.errors[0].code, "PLAYER_STATE_INVALID");

  const defeatedCarry = startPlaySession(fixture(), {
    initialPlayerState: {
      ...started.session.playerState,
      hp: 0
    }
  });
  assert.equal(defeatedCarry.ok, false);
  assert.equal(defeatedCarry.blocked, true);
  assert.equal(defeatedCarry.errors[0].code, "PLAYER_STATE_INVALID");
});

test("player damage and healing are immutable, capped, and lethal damage ends the run", () => {
  const started = startPlaySession(fixture(), { startedAt: 10, maxHp: 10 }).session;
  const damaged = applyPlayerDamage(started, 4, {
    at: 11,
    sourceType: "test",
    sourceId: "damage-a"
  });
  assert.equal(damaged.ok, true);
  assert.equal(started.playerState.hp, 10);
  assert.equal(damaged.session.playerState.hp, 6);
  assert.equal(damaged.session.playerState.maxHp, 10);
  assert.equal(damaged.session.playerState.level, 1);
  assert.equal(damaged.session.gameplayState.counters.damageTaken, 4);
  assert.equal(damaged.session.events.at(-1).type, "player-damaged");

  const healed = applyPlayerHealing(damaged.session, 3, {
    at: 12,
    sourceType: "test",
    sourceId: "heal-a"
  });
  assert.equal(healed.ok, true);
  assert.equal(healed.session.playerState.hp, 9);
  assert.equal(healed.session.playerState.maxHp, 10);
  assert.equal(healed.session.playerState.level, 1);
  assert.equal(healed.session.gameplayState.counters.healingReceived, 3);
  assert.equal(healed.session.events.at(-1).type, "player-healed");

  const lethal = applyPlayerDamage(healed.session, 20, {
    at: 13,
    sourceType: "test",
    sourceId: "damage-b"
  });
  assert.equal(lethal.ok, true);
  assert.equal(lethal.session.status, "failed");
  assert.equal(lethal.session.failureReason, "player-defeated");
  assert.equal(lethal.session.completedAt, 13);
  assert.equal(lethal.session.playerState.hp, 0);
  assert.equal(lethal.session.gameplayState.counters.damageTaken, 13);
  assert.equal(lethal.session.events.at(-1).type, "session-failed");
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

test("enemy presence is derived from the fixed snapshot without mutating gameplay state", () => {
  const session = startPlaySession(enemyFixture()).session;
  const beforeState = JSON.stringify(session.gameplayState);
  const enemies = listRoomEnemies(session, "room-002");
  assert.equal(enemies.length, 1);
  assert.equal(enemies[0].enemy.id, "enemy-test");
  assert.deepEqual(enemies[0].state, {
    status: "active",
    encounters: 0,
    lastEncounterAt: null,
    defeatedAt: null
  });
  assert.equal(JSON.stringify(session.gameplayState), beforeState);
});

test("enemy encounter requires the current room and records immutable runtime state", () => {
  const started = startPlaySession(enemyFixture(), { startedAt: 100 }).session;
  const remote = recordEnemyEncounter(started, "enemy-test", { at: 101 });
  assert.equal(remote.ok, false);
  assert.equal(remote.error.code, "ENEMY_NOT_IN_CURRENT_ROOM");

  const moved = movePlaySession(started, "room-002", { at: 102 }).session;
  const snapshotBefore = JSON.stringify(moved.snapshot);
  const encountered = recordEnemyEncounter(moved, "enemy-test", { at: 103 });
  assert.equal(encountered.ok, true);
  assert.equal(getEnemyState(moved, "enemy-test").state.encounters, 0);
  assert.equal(getEnemyState(encountered.session, "enemy-test").state.encounters, 1);
  assert.equal(getEnemyState(encountered.session, "enemy-test").state.lastEncounterAt, 103);
  assert.equal(encountered.session.events.at(-1).type, "enemy-encounter");
  assert.equal(JSON.stringify(encountered.session.snapshot), snapshotBefore);
});

test("enemy defeat marks only the runtime entity and increments enemiesCleared exactly once", () => {
  const started = startPlaySession(enemyFixture(), { startedAt: 200 }).session;
  const moved = movePlaySession(started, "room-002", { at: 201 }).session;
  const encountered = recordEnemyEncounter(moved, "enemy-test", { at: 202 }).session;
  const beforeDefeat = JSON.stringify(encountered);

  const defeated = defeatEnemy(encountered, "enemy-test", { at: 203 });
  assert.equal(defeated.ok, true);
  assert.equal(JSON.stringify(encountered), beforeDefeat);
  assert.equal(getEnemyState(defeated.session, "enemy-test").state.status, "defeated");
  assert.equal(getEnemyState(defeated.session, "enemy-test").state.encounters, 1);
  assert.equal(getEnemyState(defeated.session, "enemy-test").state.defeatedAt, 203);
  assert.equal(defeated.session.gameplayState.counters.enemiesCleared, 1);
  assert.equal(listRoomEnemies(defeated.session, "room-002").length, 0);
  assert.equal(listRoomEnemies(defeated.session, "room-002", { includeDefeated: true }).length, 1);
  assert.ok(defeated.session.events.some((event) => event.type === "enemy-defeated"));
  assert.equal(defeated.session.events.at(-1).type, "progression-reward");
  assert.ok(defeated.session.gameplayState.counters.xpEarned > 0);
  assert.ok(defeated.session.gameplayState.counters.goldEarned > 0);

  const repeated = defeatEnemy(defeated.session, "enemy-test", { at: 204 });
  assert.equal(repeated.ok, false);
  assert.equal(repeated.error.code, "ENEMY_ALREADY_DEFEATED");
  assert.equal(defeated.session.gameplayState.counters.enemiesCleared, 1);
});

test("deterministic enemy combat damages the player and clears the enemy when the player survives", () => {
  const started = startPlaySession(enemyFixture(), { startedAt: 300, maxHp: 10 }).session;
  const moved = movePlaySession(started, "room-002", { at: 301 }).session;
  const resolved = resolveEnemyCombat(moved, "enemy-test", { at: 302 });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.defeated, true);
  assert.equal(resolved.damageApplied, 4);
  assert.equal(resolved.session.playerState.hp, 6);
  assert.equal(resolved.session.playerState.maxHp, 10);
  assert.equal(resolved.session.playerState.level, 1);
  assert.equal(resolved.session.gameplayState.counters.damageTaken, 4);
  assert.equal(resolved.session.gameplayState.counters.enemiesCleared, 1);
  assert.equal(getEnemyState(resolved.session, "enemy-test").state.encounters, 1);
  assert.equal(getEnemyState(resolved.session, "enemy-test").state.status, "defeated");
});

test("enemy runtime rejects unknown enemies and actions after session completion", () => {
  let session = startPlaySession(enemyFixture({ roomId: "room-005" })).session;
  const unknown = recordEnemyEncounter(session, "missing-enemy");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.error.code, "ENEMY_NOT_FOUND");

  for (const roomId of ["room-002", "room-003", "room-004", "room-005"]) {
    session = movePlaySession(session, roomId).session;
  }
  assert.equal(session.status, "cleared");
  const afterClear = defeatEnemy(session, "enemy-test");
  assert.equal(afterClear.ok, false);
  assert.equal(afterClear.error.code, "SESSION_NOT_PLAYING");
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
