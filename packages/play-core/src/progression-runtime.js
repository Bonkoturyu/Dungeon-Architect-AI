import { applyGameplayStateCommand } from "./gameplay-state.js";

export const DEFAULT_PLAYER_LEVEL = 1;
export const DEFAULT_LEVEL_MAX_HP_GAIN = 2;
export const LOOT_TABLE_VERSION = "1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertSafeNonNegative(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

function assertPositiveSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function hash32(text) {
  let hash = 0x811c9dc5;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function rewardHash(session, kind, sourceId) {
  return hash32(`${session?.dungeonSeed ?? 0}:${LOOT_TABLE_VERSION}:${kind}:${sourceId}`);
}

function incrementCounter(next, counter, delta) {
  if (delta <= 0) return;
  next.gameplayState = applyGameplayStateCommand(next.gameplayState, {
    type: "increment-counter",
    counter,
    delta
  });
}

function inventoryCount(next, itemId) {
  return next.gameplayState?.inventory?.[itemId] ?? 0;
}

function addInventoryItem(next, itemId, count = 1) {
  next.gameplayState = applyGameplayStateCommand(next.gameplayState, {
    type: "set-inventory-count",
    itemId,
    count: inventoryCount(next, itemId) + count
  });
}

export function xpRequiredForNextLevel(level) {
  assertPositiveSafeInteger(level, "level");
  return level * 20;
}

export function createInitialPlayerState(maxHp) {
  assertPositiveSafeInteger(maxHp, "maxHp");
  return {
    hp: maxHp,
    maxHp,
    level: DEFAULT_PLAYER_LEVEL,
    xp: 0,
    gold: 0,
    equipment: {
      weapon: null,
      armor: null
    }
  };
}

function validateEquipmentItem(item, slot) {
  if (item === null) return;
  if (
    !item ||
    typeof item !== "object" ||
    Array.isArray(item) ||
    item.slot !== slot ||
    typeof item.id !== "string" ||
    item.id.trim() === "" ||
    !Number.isSafeInteger(item.tier) ||
    item.tier <= 0
  ) {
    throw new TypeError(`equipment.${slot} must be null or a valid ${slot} item`);
  }
}

export function normalizePlayerState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("playerState must be a plain object");
  }

  const { hp, maxHp, level, xp, gold, equipment } = value;
  assertPositiveSafeInteger(maxHp, "playerState.maxHp");
  assertSafeNonNegative(hp, "playerState.hp");
  assertPositiveSafeInteger(level, "playerState.level");
  assertSafeNonNegative(xp, "playerState.xp");
  assertSafeNonNegative(gold, "playerState.gold");

  if (hp > maxHp) {
    throw new RangeError("playerState.hp cannot exceed playerState.maxHp");
  }
  if (xp >= xpRequiredForNextLevel(level)) {
    throw new RangeError("playerState.xp must be below the next level threshold");
  }
  if (!equipment || typeof equipment !== "object" || Array.isArray(equipment)) {
    throw new TypeError("playerState.equipment must be a plain object");
  }

  validateEquipmentItem(equipment.weapon ?? null, "weapon");
  validateEquipmentItem(equipment.armor ?? null, "armor");

  return {
    hp,
    maxHp,
    level,
    xp,
    gold,
    equipment: {
      weapon: equipment.weapon ? clone(equipment.weapon) : null,
      armor: equipment.armor ? clone(equipment.armor) : null
    }
  };
}

export function deterministicEnemyReward(session, enemyId) {
  const hash = rewardHash(session, "enemy", enemyId);
  return {
    xp: 8 + (hash % 5),
    gold: 3 + ((hash >>> 8) % 6)
  };
}

export function deterministicTreasureReward(session, treasureId) {
  const hash = rewardHash(session, "treasure", treasureId);
  const slot = (hash & 1) === 0 ? "weapon" : "armor";
  const tier = 1 + ((hash >>> 4) % 3);
  return {
    gold: 5 + ((hash >>> 8) % 11),
    item: {
      id: `${slot}-tier-${tier}`,
      slot,
      tier
    }
  };
}

export function grantProgressionReward(
  session,
  {
    xp = 0,
    gold = 0,
    item = null,
    sourceType = "unknown",
    sourceId = null,
    at = session?.startedAt ?? 0
  } = {}
) {
  if (!session || session.status !== "playing") {
    return { ok: false, error: { code: "SESSION_NOT_PLAYING", message: "Session is not in playing state." } };
  }

  try {
    assertSafeNonNegative(xp, "xp");
    assertSafeNonNegative(gold, "gold");
  } catch (error) {
    return {
      ok: false,
      error: { code: "PROGRESSION_REWARD_INVALID", message: error instanceof Error ? error.message : String(error) }
    };
  }

  const next = clone(session);
  const player = next.playerState;
  if (
    !player ||
    !Number.isSafeInteger(player.hp) ||
    !Number.isSafeInteger(player.maxHp) ||
    !Number.isSafeInteger(player.level) ||
    !Number.isSafeInteger(player.xp) ||
    !Number.isSafeInteger(player.gold) ||
    !player.equipment ||
    typeof player.equipment !== "object" ||
    Array.isArray(player.equipment) ||
    player.level <= 0 ||
    player.xp < 0 ||
    player.gold < 0
  ) {
    return { ok: false, error: { code: "PLAYER_PROGRESSION_INVALID", message: "Player progression state is invalid." } };
  }

  if (!Number.isSafeInteger(player.xp + xp) || !Number.isSafeInteger(player.gold + gold)) {
    return { ok: false, error: { code: "PROGRESSION_OVERFLOW", message: "Progression reward would overflow safe integer state." } };
  }

  player.xp += xp;
  player.gold += gold;
  incrementCounter(next, "xpEarned", xp);
  incrementCounter(next, "goldEarned", gold);

  let levelUps = 0;
  while (player.xp >= xpRequiredForNextLevel(player.level)) {
    player.xp -= xpRequiredForNextLevel(player.level);
    player.level += 1;
    player.maxHp += DEFAULT_LEVEL_MAX_HP_GAIN;
    player.hp = Math.min(player.maxHp, player.hp + DEFAULT_LEVEL_MAX_HP_GAIN);
    levelUps += 1;
  }
  incrementCounter(next, "levelUps", levelUps);

  let equipped = null;
  if (item !== null) {
    if (
      !item ||
      typeof item !== "object" ||
      !["weapon", "armor"].includes(item.slot) ||
      typeof item.id !== "string" ||
      item.id.trim() === "" ||
      !Number.isSafeInteger(item.tier) ||
      item.tier <= 0
    ) {
      return { ok: false, error: { code: "LOOT_ITEM_INVALID", message: "Loot item is invalid." } };
    }

    addInventoryItem(next, item.id, 1);
    incrementCounter(next, "lootCollected", 1);

    const current = player.equipment?.[item.slot] ?? null;
    if (!current || (current.tier ?? 0) < item.tier) {
      player.equipment[item.slot] = clone(item);
      equipped = clone(item);
    }
  }

  next.events.push({
    type: "progression-reward",
    sourceType,
    sourceId,
    xp,
    gold,
    item: item ? clone(item) : null,
    levelUps,
    level: player.level,
    xpAfter: player.xp,
    goldAfter: player.gold,
    equipped,
    roomId: next.currentRoomId,
    at
  });

  return {
    ok: true,
    session: next,
    reward: {
      xp,
      gold,
      item: item ? clone(item) : null,
      levelUps,
      equipped
    }
  };
}

export function grantEnemyReward(session, enemyId, { at = session?.startedAt ?? 0 } = {}) {
  return grantProgressionReward(session, {
    ...deterministicEnemyReward(session, enemyId),
    sourceType: "enemy",
    sourceId: enemyId,
    at
  });
}

export function grantTreasureReward(session, treasureId, { at = session?.startedAt ?? 0 } = {}) {
  return grantProgressionReward(session, {
    ...deterministicTreasureReward(session, treasureId),
    sourceType: "treasure",
    sourceId: treasureId,
    at
  });
}
