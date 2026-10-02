import { getEffectiveDamage } from '../../../../play-core/src/equipment-runtime.js';
import { DEFAULT_PLAYER_MAX_HP } from '../../../../play-core/src/play-session.js';
import { DEFAULT_ENEMY_DAMAGE } from '../../../../play-core/src/enemy-runtime.js';
import {
  DEFAULT_LEVEL_MAX_HP_GAIN,
  DEFAULT_PLAYER_LEVEL,
  deterministicEnemyReward,
  normalizePlayerState,
  xpRequiredForNextLevel,
} from '../../../../play-core/src/progression-runtime.js';

function adjacencyOf(spec) {
  const adjacency = new Map(spec.rooms.map(({ id }) => [id, []]));
  for (const { fromRoomId, toRoomId } of spec.corridors) {
    adjacency.get(fromRoomId).push(toRoomId);
    adjacency.get(toRoomId).push(fromRoomId);
  }
  return adjacency;
}

function enemiesByRoom(spec, plans, difficultyProfile) {
  const replacements = new Map(plans.map((plan) => [plan.roomId, plan]));
  return new Map(spec.rooms.map(({ id }) => {
    const plan = replacements.get(id);
    const enemies = plan
      ? plan.kind === 'monster-house' ? Array.from({ length: plan.entityCount }, (_, index) => ({
        id: `v3:${plan.id}:enemy-${index + 1}`,
        damage: difficultyProfile?.enemyDamage ?? DEFAULT_ENEMY_DAMAGE,
      })) : []
      : spec.entities.filter((entity) => entity.type === 'enemy' && entity.roomId === id).map((entity) => ({
        id: entity.id, damage: difficultyProfile?.enemyDamage ?? entity.damage ?? DEFAULT_ENEMY_DAMAGE,
      }));
    return [id, enemies];
  }));
}

function evaluateUnassistedPath(spec, pathRoomIds, enemies, initialPlayerState) {
  let hp = initialPlayerState?.hp ?? DEFAULT_PLAYER_MAX_HP;
  let maxHp = initialPlayerState?.maxHp ?? hp;
  let level = initialPlayerState?.level ?? DEFAULT_PLAYER_LEVEL;
  let xp = initialPlayerState?.xp ?? 0;
  let enemyCount = 0;
  let damage = 0n;
  let minimumHp = hp;
  for (const roomId of pathRoomIds) {
    // XPは既存の表示値で比較できる。同室では高XPの敵から処理して早めのLevel Upを狙う。
    const ordered = enemies.get(roomId).map((enemy) => ({ ...enemy,
      xp: deterministicEnemyReward({ dungeonSeed: spec.seed }, enemy.id).xp,
    })).sort((left, right) => right.xp - left.xp || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
    for (const enemy of ordered) {
      enemyCount += 1;
      damage += BigInt(enemy.damage);
      hp -= enemy.damage;
      minimumHp = Math.min(minimumHp, Math.max(0, hp));
      if (hp <= 0) return { survives: false, pathRoomIds, shopRoomId: pathRoomIds.at(-1),
        enemyCount, hp: 0, minimumHp, failedEnemyId: enemy.id };
      xp += enemy.xp;
      while (xp >= xpRequiredForNextLevel(level)) {
        xp -= xpRequiredForNextLevel(level);
        level += 1;
        maxHp += DEFAULT_LEVEL_MAX_HP_GAIN;
        hp = Math.min(maxHp, hp + DEFAULT_LEVEL_MAX_HP_GAIN);
      }
    }
  }
  return { survives: true, pathRoomIds, shopRoomId: pathRoomIds.at(-1), enemyCount, hp, minimumHp,
    unmitigatedDamage: Number(damage), level };
}

function inspectFirstShop(spec, plans, difficultyProfile, adjacency, initialPlayerState, equipmentRules) {
  const shops = new Set(plans.filter(({ kind }) => kind === 'shop').map(({ roomId }) => roomId));
  const start = spec.entities.find(({ type }) => type === 'start').roomId;
  const goal = spec.entities.find(({ type }) => type === 'goal').roomId;
  const enemies = enemiesByRoom(spec, plans, difficultyProfile);
  if (initialPlayerState) for (const entries of enemies.values()) for (const enemy of entries) {
    enemy.damage = getEffectiveDamage({ snapshot: { equipmentRules }, playerState: initialPlayerState }, enemy.damage, 'enemy');
  }
  const costs = new Map([...enemies].map(([id, entries]) => [id, entries.reduce((sum, enemy) => sum + BigInt(enemy.damage), 0n)]));
  const frontier = [{ roomId: start, cost: 0n, path: [start] }];
  const settled = new Set();
  while (frontier.length) {
    frontier.sort((left, right) => left.cost < right.cost ? -1 : left.cost > right.cost ? 1
      : left.path.length - right.path.length || left.path.join(',').localeCompare(right.path.join(',')));
    const current = frontier.shift();
    if (settled.has(current.roomId)) continue;
    settled.add(current.roomId);
    if (shops.has(current.roomId)) return evaluateUnassistedPath(spec, current.path, enemies, initialPlayerState);
    for (const next of adjacency.get(current.roomId)) {
      if ((next === goal && !plans.some(({ roomId }) => roomId === goal)) || settled.has(next)) continue;
      frontier.push({ roomId: next, cost: current.cost + costs.get(next), path: [...current.path, next] });
    }
  }
  return { survives: false, pathRoomIds: [], shopRoomId: null, reason: 'no-pre-goal-shop-path' };
}

function distancesFrom(adjacency, start) {
  const distances = new Map([[start, 0]]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    for (const next of adjacency.get(queue[index])) {
      if (distances.has(next)) continue;
      distances.set(next, distances.get(queue[index]) + 1);
      queue.push(next);
    }
  }
  return distances;
}

// 実行時のHP/XP定数を使用し、無限経路列挙をしない保守的な入口到達判定。
// 罠は既存の回避処理を使う。任意の装備loot/回復には依存しない。
export function guardFirstShopPlacementV3(spec, plans, { difficultyProfile, initialPlayerState = null, equipmentRules = spec.equipmentRules } = {}) {
  if (!plans.some(({ kind }) => kind === 'shop')) return { plans, diagnostics: null };
  if (initialPlayerState !== null) initialPlayerState = normalizePlayerState(initialPlayerState);
  const adjacency = adjacencyOf(spec);
  const initial = inspectFirstShop(spec, plans, difficultyProfile, adjacency, initialPlayerState, equipmentRules);
  const assumptions = `${initialPlayerState ? 'Provided carried HP/XP/equipment' : 'Default fresh-player HP/XP'}; minimum effective-damage route; deterministic enemy XP/level-up healing; traps avoided; optional equipment/recovery ignored.`;
  if (initial.survives) return { plans, diagnostics: { status: 'preserved', assumptions, route: initial, changes: [] } };
  const protectedIds = new Set(spec.entities.filter(({ type }) => type === 'start' || type === 'goal').map(({ roomId }) => roomId));
  const occupied = new Set(plans.map(({ roomId }) => roomId));
  const automaticShops = plans.filter((plan) => plan.kind === 'shop' && plan.autoAssigned);
  for (const shop of automaticShops) {
    const distances = distancesFrom(adjacency, shop.roomId);
    const sortByDisplacement = (left, right) => (distances.get(left) ?? Infinity) - (distances.get(right) ?? Infinity)
      || (left < right ? -1 : left > right ? 1 : 0);
    const ordinaryCandidates = spec.rooms.map(({ id }) => id)
      .filter((id) => !protectedIds.has(id) && !occupied.has(id)).sort(sortByDisplacement);
    for (const roomId of ordinaryCandidates) {
      const candidate = plans.map((plan) => plan.id === shop.id ? { ...plan, roomId } : plan);
      const route = inspectFirstShop(spec, candidate, difficultyProfile, adjacency, initialPlayerState, equipmentRules);
      if (route.survives) return { plans: candidate, diagnostics: { status: 'relocated-auto-shop', assumptions, initialRoute: initial,
        route, changes: [{ planId: shop.id, kind: shop.kind, fromRoomId: shop.roomId, toRoomId: roomId }] } };
    }
    const swapCandidates = plans.filter((plan) => plan.autoAssigned && plan.id !== shop.id && plan.kind !== 'shop')
      .sort((left, right) => sortByDisplacement(left.roomId, right.roomId));
    for (const other of swapCandidates) {
      const candidate = plans.map((plan) => plan.id === shop.id ? { ...plan, roomId: other.roomId }
        : plan.id === other.id ? { ...plan, roomId: shop.roomId } : plan);
      const route = inspectFirstShop(spec, candidate, difficultyProfile, adjacency, initialPlayerState, equipmentRules);
      if (route.survives) return { plans: candidate, diagnostics: { status: 'swapped-auto-rooms', assumptions, initialRoute: initial,
        route, changes: [
          { planId: shop.id, kind: shop.kind, fromRoomId: shop.roomId, toRoomId: other.roomId },
          { planId: other.id, kind: other.kind, fromRoomId: other.roomId, toRoomId: shop.roomId },
        ] } };
    }
  }
  throw new RangeError('FIRST_SHOP_SURVIVAL_CONFLICT: no permitted automatic shop placement passes the conservative pre-shop combat check; explicit room IDs were not changed');
}
