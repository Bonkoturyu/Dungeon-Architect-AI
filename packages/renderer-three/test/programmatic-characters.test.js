import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CHARACTER_COLORS,
  PROGRAMMATIC_CHARACTER_VERSION,
  createEnemyCharacterDefinition,
  createPlayerCharacterDefinition
} from "../src/programmatic-characters.js";

test("programmatic character version and palette are frozen", () => {
  assert.equal(PROGRAMMATIC_CHARACTER_VERSION, "1");
  assert.deepEqual(DEFAULT_CHARACTER_COLORS, {
    playerBody: 0x38bdf8,
    playerAccent: 0xfacc15,
    playerSkin: 0xf1c7a5,
    playerBoot: 0x334155,
    playerWeapon: 0xdbeafe,
    playerArmor: 0x64748b,
    enemyBody: 0x991b1b,
    enemySkin: 0xef4444,
    enemyDark: 0x3f0d12,
    enemyHorn: 0xf59e0b
  });
});

test("player definition is deterministic and equipment adds visible programmatic parts", () => {
  const baseInput = {
    position: { x: 4, y: 0, z: 8 },
    roomId: "room-002",
    playerState: {
      hp: 18,
      maxHp: 22,
      level: 2,
      xp: 5,
      gold: 12,
      equipment: {
        weapon: { id: "weapon-tier-3", slot: "weapon", tier: 3 },
        armor: { id: "armor-tier-2", slot: "armor", tier: 2 }
      }
    }
  };

  const first = createPlayerCharacterDefinition(baseInput);
  const second = createPlayerCharacterDefinition(baseInput);
  assert.deepEqual(first, second);
  assert.equal(first.kind, "player-character");
  assert.equal(first.roomId, "room-002");
  assert.equal(first.level, 2);
  assert.deepEqual(first.equipment, { weaponTier: 3, armorTier: 2 });

  const names = first.parts.map((entry) => entry.name);
  assert.ok(names.includes("head"));
  assert.ok(names.includes("torso"));
  assert.ok(names.includes("weapon-blade"));
  assert.ok(names.includes("weapon-guard"));
  assert.ok(names.includes("left-pauldron"));
  assert.ok(names.includes("right-pauldron"));
  assert.ok(first.parts.length >= 13);

  const noGear = createPlayerCharacterDefinition({
    position: { x: 0, y: 0, z: 0 },
    roomId: "room-start",
    playerState: {
      level: 1,
      equipment: { weapon: null, armor: null }
    }
  });
  const noGearNames = noGear.parts.map((entry) => entry.name);
  assert.equal(noGearNames.includes("weapon-blade"), false);
  assert.equal(noGearNames.includes("left-pauldron"), false);
  assert.ok(noGear.parts.length < first.parts.length);
});

test("enemy definition replaces the abstract marker with a deterministic creature silhouette", () => {
  const marker = {
    specId: "enemy-1",
    roomId: "room-middle",
    type: "enemy",
    position: { x: 12, y: 0.4, z: 3 },
    height: 0.8,
    initiallyActive: true
  };

  const enemy = createEnemyCharacterDefinition(marker);
  assert.equal(enemy.kind, "enemy-character");
  assert.equal(enemy.specId, "enemy-1");
  assert.equal(enemy.roomId, "room-middle");
  assert.deepEqual(enemy.position, { x: 12, y: 0, z: 3 });

  const names = enemy.parts.map((entry) => entry.name);
  for (const required of [
    "head",
    "torso",
    "left-arm",
    "right-arm",
    "left-leg",
    "right-leg",
    "left-horn",
    "right-horn",
    "face"
  ]) {
    assert.ok(names.includes(required), `missing enemy part ${required}`);
  }
  assert.ok(enemy.parts.length >= 11);
});

test("programmatic character definitions fail closed on malformed inputs", () => {
  assert.throws(
    () => createPlayerCharacterDefinition({
      position: { x: Number.NaN, y: 0, z: 0 },
      roomId: "room"
    }),
    /finite/
  );
  assert.throws(
    () => createPlayerCharacterDefinition({
      position: { x: 0, y: 0, z: 0 },
      roomId: ""
    }),
    /roomId/
  );
  assert.throws(
    () => createEnemyCharacterDefinition({ type: "treasure" }),
    /enemy marker/
  );
});
