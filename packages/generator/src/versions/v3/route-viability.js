import { startPlaySession, movePlaySession, completePlayGoal, DEFAULT_PLAYER_MAX_HP } from '../../../../play-core/src/play-session.js';
import { getEnemyState, listRoomEnemies, resolveEnemyCombat, DEFAULT_ENEMY_DAMAGE } from '../../../../play-core/src/enemy-runtime.js';
import { listRoomInteractables, openTreasure, avoidTrap, useRecovery, DEFAULT_RECOVERY_HEALING, DEFAULT_TRAP_DAMAGE, deterministicTrapAvoidance } from '../../../../play-core/src/interaction-runtime.js';
import { listRoomShops, purchaseShopOffer } from '../../../../play-core/src/shop-runtime.js';
import { deterministicEnemyReward } from '../../../../play-core/src/progression-runtime.js';
import { getEffectiveDamage } from '../../../../play-core/src/equipment-runtime.js';

const compareId = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const isNormal = (room) => room.kind === undefined || room.kind === 'normal';

function trapDamage(session, entity) {
  return (session.gameplayState.entityStates[entity.id]?.status ?? 'armed') === 'armed'
    && deterministicTrapAvoidance(session, entity.id).outcome === 'triggered'
    ? getEffectiveDamage(session, entity.damage ?? DEFAULT_TRAP_DAMAGE, 'trap') : 0;
}

function topology(spec) {
  const adjacency = new Map(spec.rooms.map(({ id }) => [id, []]));
  for (const { fromRoomId, toRoomId } of spec.corridors) {
    adjacency.get(fromRoomId).push(toRoomId);
    adjacency.get(toRoomId).push(fromRoomId);
  }
  for (const neighbors of adjacency.values()) neighbors.sort(compareId);
  return adjacency;
}

// 各頂点を高々一度確定する最短路。状態空間/全単純経路の列挙はしない。
function routeTo(session, target, adjacency, weighted = true) {
  const roomCosts = new Map(session.snapshot.rooms.map(({ id }) => [id, 0n]));
  if (weighted) for (const enemy of session.snapshot.entities.filter(({ type }) => type === 'enemy')) {
    if (getEnemyState(session, enemy.id).state.status !== 'defeated') {
      roomCosts.set(enemy.roomId, roomCosts.get(enemy.roomId) + BigInt(getEffectiveDamage(session, enemy.damage ?? DEFAULT_ENEMY_DAMAGE, 'enemy')));
    }
  }
  if (weighted) for (const entity of session.snapshot.entities.filter(({ type }) => type === 'trap')) {
    roomCosts.set(entity.roomId, roomCosts.get(entity.roomId) + BigInt(trapDamage(session, entity)));
  }
  const frontier = [{ roomId: session.currentRoomId, cost: 0n, path: [session.currentRoomId] }];
  const settled = new Set();
  while (frontier.length) {
    frontier.sort((left, right) => left.cost < right.cost ? -1 : left.cost > right.cost ? 1
      : left.path.length - right.path.length || compareId(left.path.join(','), right.path.join(',')));
    const current = frontier.shift();
    if (settled.has(current.roomId)) continue;
    settled.add(current.roomId);
    if (current.roomId === target) return current.path;
    for (const next of adjacency.get(current.roomId)) {
      if (settled.has(next) || (next === session.goalRoomId && target !== next && !['shop', 'monster-house', 'trap-house'].includes(session.snapshot.rooms.find(({ id }) => id === next)?.kind))) continue;
      frontier.push({ roomId: next, cost: current.cost + roomCosts.get(next), path: [...current.path, next] });
    }
  }
  return null;
}

function attemptWitness(spec, policy, adjacency, initialPlayerState) {
  const started = startPlaySession(spec, { initialPlayerState });
  if (!started.ok) throw new Error(`ROUTE_VIABILITY_RUNTIME_ERROR: ${JSON.stringify(started.errors)}`);
  let session = started.session;
  const actions = [];
  const pathRoomIds = [session.currentRoomId];
  let minimumHp = session.playerState.hp;
  function perform(type, id, operation) {
    const result = operation();
    if (!result.ok) throw new Error(`ROUTE_VIABILITY_RUNTIME_ERROR: ${JSON.stringify(result.error ?? result.errors)}`);
    actions.push({ type, id });
    session = result.session;
    minimumHp = Math.min(minimumHp, session.playerState.hp);
  }
  function heal(damage = 0) {
    for (const { entity } of listRoomInteractables(session).filter(({ entity }) => entity.type === 'recovery')) {
      const missing = session.playerState.maxHp - session.playerState.hp;
      if (missing >= (entity.healing ?? DEFAULT_RECOVERY_HEALING) || (missing > 0 && session.playerState.hp <= damage)) {
        perform('use-recovery', entity.id, () => useRecovery(session, entity.id));
      }
    }
  }
  function shop() {
    for (const entry of listRoomShops(session)) {
      // 装備はslotごと高々一回、回復は高々一回。stock/価格の大きさで反復回数を増やさない。
      for (let index = 0; index < 2; index += 1) {
        const candidates = listRoomShops(session).find(({ entity }) => entity.id === entry.entity.id).offers
          .filter((offer) => offer.type !== 'healing' && offer.remaining > 0 && offer.price <= session.playerState.gold
            && offer.tier > (session.playerState.equipment[offer.type]?.tier ?? 0))
          .map((offer) => {
            const projected = { ...session, playerState: { ...session.playerState, equipment: { ...session.playerState.equipment,
              [offer.type]: { id: `witness-${offer.type}`, slot: offer.type, tier: offer.tier } } } };
            const gain = spec.entities.filter(({ type }) => type === 'enemy' || type === 'trap').reduce((sum, entity) => {
              if (entity.type === 'trap') return sum + BigInt(trapDamage(session, entity) - trapDamage(projected, entity));
              if (spec.trapRules && getEnemyState(session, entity.id).state.status === 'defeated') return sum;
              return sum + BigInt(getEffectiveDamage(session, entity.damage ?? DEFAULT_ENEMY_DAMAGE, 'enemy')
                - getEffectiveDamage(projected, entity.damage ?? DEFAULT_ENEMY_DAMAGE, 'enemy'));
            }, 0n);
            return { offer, gain };
          }).filter(({ gain }) => gain > 0n)
          .sort((left, right) => left.gain > right.gain ? -1 : left.gain < right.gain ? 1
            : left.offer.price - right.offer.price || compareId(left.offer.id, right.offer.id));
        if (!candidates.length) break;
        const { offer } = candidates[0];
        perform('purchase', [entry.entity.id, offer.id], () => purchaseShopOffer(session, entry.entity.id, offer.id));
      }
      const healing = listRoomShops(session).find(({ entity }) => entity.id === entry.entity.id).offers
        .filter((offer) => offer.type === 'healing' && offer.remaining > 0 && offer.price <= session.playerState.gold
          && session.playerState.hp < session.playerState.maxHp)
        .sort((left, right) => right.healing - left.healing || left.price - right.price || compareId(left.id, right.id))[0];
      if (healing) perform('purchase', [entry.entity.id, healing.id], () => purchaseShopOffer(session, entry.entity.id, healing.id));
    }
  }
  function resolveRoom() {
    if (session.status !== 'playing') return;
    for (const { entity } of listRoomInteractables(session).filter(({ entity }) => entity.type === 'treasure')) perform('open-treasure', entity.id, () => openTreasure(session, entity.id));
    if (session.snapshot.trapRules) { shop(); heal(); }
    for (const { entity } of listRoomInteractables(session).filter(({ entity }) => entity.type === 'trap')) {
      if (session.snapshot.trapRules) heal(trapDamage(session, entity));
      perform('avoid-trap', entity.id, () => avoidTrap(session, entity.id));
      if (session.status !== 'playing') return;
    }
    shop();
    heal();
    const enemies = listRoomEnemies(session).sort((left, right) => deterministicEnemyReward(session, right.enemy.id).xp - deterministicEnemyReward(session, left.enemy.id).xp
      || compareId(left.enemy.id, right.enemy.id));
    for (const { enemy } of enemies) {
      heal(getEffectiveDamage(session, enemy.damage ?? DEFAULT_ENEMY_DAMAGE, 'enemy'));
      perform('combat', enemy.id, () => resolveEnemyCombat(session, enemy.id));
      if (session.status !== 'playing') return;
    }
    heal();
  }
  function visit(target, weighted = true) {
    const path = routeTo(session, target, adjacency, weighted);
    if (!path) return false;
    for (const roomId of path.slice(1)) {
      if (session.status !== 'playing') break;
      perform('move', roomId, () => movePlaySession(session, roomId));
      pathRoomIds.push(roomId);
      resolveRoom();
    }
    return true;
  }
  resolveRoom();
  if (policy === 'shop-first') {
    const first = spec.entities.filter(({ type }) => type === 'shop').sort((left, right) =>
      (routeTo(session, left.roomId, adjacency, false)?.length ?? Infinity) - (routeTo(session, right.roomId, adjacency, false)?.length ?? Infinity)
      || compareId(left.id, right.id))[0];
    if (first) {
      // 対応する予算箱は安定したshop列順で作られる。同じ部屋の通常箱も回収する。
      const budget = spec.entities.find(({ id }) => id === 'v3:shop-budget:treasure-1');
      if (budget && session.status === 'playing') visit(budget.roomId);
      if (session.status === 'playing') visit(first.roomId);
    }
  }
  if (policy === 'loot-first') {
    const remaining = new Set(spec.entities.filter(({ type, roomId }) => ['treasure', 'recovery', 'shop'].includes(type)
      && roomId !== session.goalRoomId).map(({ roomId }) => roomId));
    // 目的部屋を一回ずつ取り除くため、再訪を含めても高々部屋数回で終了する。
    while (remaining.size && session.status === 'playing') {
      remaining.delete(session.currentRoomId);
      const choices = [...remaining].map((roomId) => ({ roomId, path: routeTo(session, roomId, adjacency) }))
        .filter(({ path }) => path).sort((left, right) => left.path.length - right.path.length || compareId(left.roomId, right.roomId));
      if (!choices.length) break;
      remaining.delete(choices[0].roomId);
      visit(choices[0].roomId);
    }
  }
  if (session.status === 'playing') visit(session.goalRoomId, policy !== 'shortest');
  if (session.status === 'playing' && session.currentRoomId === session.goalRoomId) perform('complete-goal', session.goalRoomId, () => completePlayGoal(session));
  return { policy, survives: session.status === 'cleared', status: session.status, pathRoomIds,
    hp: session.playerState.hp, minimumHp, playerState: session.playerState, actions,
    failedRoomId: session.status === 'failed' ? session.currentRoomId : null };
}

function inspect(spec, adjacency, initialPlayerState) {
  const attempts = [];
  for (const policy of ['risk-aware-goal', 'shortest', 'shop-first', 'loot-first']) {
    if (policy === 'shop-first' && !spec.entities.some(({ type }) => type === 'shop')) continue;
    const witness = attemptWitness(spec, policy, adjacency, initialPlayerState);
    attempts.push(witness);

  }
  const viable = attempts.filter(({ survives }) => survives).sort((left, right) => right.hp - left.hp
    || ((right.playerState.equipment.weapon?.tier ?? 0) + (right.playerState.equipment.armor?.tier ?? 0))
      - ((left.playerState.equipment.weapon?.tier ?? 0) + (left.playerState.equipment.armor?.tier ?? 0))
    || left.actions.length - right.actions.length);
  return { witness: viable[0] ?? null, attempts };
}

// 新規生成の配置だけを補正する。Difficulty未指定の従来互換APIや編集済みSpecは対象外。
// 実Playを再生する有限個の方策による証拠であり、失敗は「数学的に解なし」を意味しない。
export function guardGeneratedRouteV3(spec, { roomPlans = [], difficultyProfile, shopPlacementGuard, initialPlayerState = null, normalRoomCapacity = null } = {}) {
  if (difficultyProfile === undefined) return null;
  const adjacency = topology(spec);
  const initial = inspect(spec, adjacency, initialPlayerState);
  const assumptions = { initialHp: initialPlayerState?.hp ?? DEFAULT_PLAYER_MAX_HP, initialEquipment: initialPlayerState?.equipment ?? 'none', initialGold: initialPlayerState?.gold ?? 0,
    scope: initialPlayerState ? 'provided-carried-player-state' : 'fresh-player-single-floor', traps: spec.trapRules?.version ?? 'avoided', ordinaryRoomEnemies: 'cleared-before-exit',
    search: 'four deterministic bounded policies, not an exhaustive solvability solver',
    carriedStateGuarantee: initialPlayerState !== null };
  const changes = [];
  const result = (checked) => ({ status: changes.length ? 'relocated-existing-content' : 'preserved', assumptions,
    witness: checked.witness, changes, initialFailedPolicies: initial.witness ? [] : initial.attempts.map(({ policy }) => policy) });
  if (initial.witness) return result(initial);
  const start = spec.entities.find(({ type }) => type === 'start').roomId;
  const goal = spec.entities.find(({ type }) => type === 'goal').roomId;
  const candidate = structuredClone(spec);
  const baselineEntities = candidate.entities.filter(({ id }) => !id.startsWith('v3:'));
  const move = (entity, roomId) => {
    if (entity.roomId === roomId) return true;
    if (normalRoomCapacity && ['enemy', 'trap'].includes(entity.type) && isNormal(candidate.rooms.find(({ id }) => id === roomId))
      && candidate.entities.filter((entry) => entry.type === entity.type && entry.roomId === roomId).length >= normalRoomCapacity[entity.type]) return false;
    changes.push({ entityId: entity.id, type: entity.type, fromRoomId: entity.roomId, toRoomId: roomId });
    entity.roomId = roomId;
    return true;
  };
  const accept = (checked) => {
    if (!checked.witness) return null;
    spec.entities = candidate.entities;
    spec.rooms = candidate.rooms;
    spec.events = candidate.events;
    return result(checked);
  };
  // 既存の装備箱だけをStartへ前倒し。ID、固定loot、G、敵/回復数は変えない。
  for (const entity of baselineEntities.filter(({ type, rewardItem }) => type === 'treasure' && rewardItem !== false)) move(entity, start);
  let checked = inspect(candidate, adjacency, initialPlayerState);
  let accepted = accept(checked);
  if (accepted) return accepted;
  // 回復は最後に到達できた通常部屋へ。特殊部屋の指定内容は上書きしない。
  const failedRoute = checked.attempts[0].pathRoomIds;
  const recoveryRoom = [...failedRoute].reverse().find((id) => candidate.rooms.some((room) => room.id === id && isNormal(room))) ?? start;
  for (const entity of baselineEntities.filter(({ type }) => type === 'recovery')) move(entity, recoveryRoom);
  checked = inspect(candidate, adjacency, initialPlayerState);
  accepted = accept(checked);
  if (accepted) return accepted;
  // 低被害経路の外へ通常敵（新ルールでは通常罠も）を寄せる。家の敵/明示された部屋、Goalへは動かさない。
  const session = startPlaySession(candidate, { initialPlayerState }).session;
  const path = routeTo(session, goal, adjacency);
  const protectedShopPath = new Set(shopPlacementGuard?.route?.pathRoomIds ?? []);
  const outside = candidate.rooms.filter((room) => isNormal(room) && room.id !== start && room.id !== goal
    && !path.includes(room.id) && !protectedShopPath.has(room.id)).sort((left, right) => compareId(left.id, right.id));
  if (outside.length) {
    for (const entity of baselineEntities.filter(({ type, roomId }) => (type === 'enemy' || (candidate.trapRules && type === 'trap')) && path.includes(roomId))) {
      for (const destination of normalRoomCapacity ? outside : [outside[0]]) if (move(entity, destination.id)) break;
    }
    checked = inspect(candidate, adjacency, initialPlayerState);
    accepted = accept(checked);
    if (accepted) return accepted;
  }
  // 自動MonsterHouse（新ルールでは自動TrapHouseも）を通常部屋と丸ごと入れ替える。敵・loot・event IDは保持。
  // 候補は部屋数×自動家数まで。明示した部屋、shop、Start/Goalには触れない。
  const budgetRoomIds = new Set(candidate.entities.filter(({ id }) => id.startsWith('v3:shop-budget:')).map(({ roomId }) => roomId));
  const autoHouses = roomPlans.map((plan, index) => ({ ...plan, id: plan.id ?? `room-plan-${index + 1}` }))
    .filter(({ kind, roomId, targetRole }) => (kind === 'monster-house' || (candidate.trapRules && kind === 'trap-house')) && roomId === null && !targetRole);
  for (const plan of autoHouses) {
    const houseRoomId = candidate.entities.find(({ id }) => id === `v3:${plan.id}:${plan.kind === 'monster-house' ? 'enemy' : 'trap'}-1`)?.roomId;
    if (!houseRoomId) continue;
    const destinations = candidate.rooms.filter((room) => isNormal(room) && room.id !== start && room.id !== goal
      && !protectedShopPath.has(room.id) && !budgetRoomIds.has(room.id)).sort((left, right) => compareId(left.id, right.id));
    for (const destination of destinations) {
      const roomId = destination.id;
      const swap = (id) => id === houseRoomId ? roomId : id === roomId ? houseRoomId : id;
      for (const entity of candidate.entities) entity.roomId = swap(entity.roomId);
      for (const event of candidate.events) if (event.trigger.roomId) event.trigger.roomId = swap(event.trigger.roomId);
      const houseRoom = candidate.rooms.find(({ id }) => id === houseRoomId);
      delete houseRoom.kind;
      destination.kind = plan.kind;
      checked = inspect(candidate, adjacency, initialPlayerState);
      if (checked.witness) {
        changes.push({ planId: plan.id, kind: plan.kind, fromRoomId: houseRoomId, toRoomId: roomId, operation: 'swap-existing-room-content' });
        return accept(checked);
      }
      // 失敗候補は完全に巻き戻し、次の有限候補を検査する。
      for (const entity of candidate.entities) entity.roomId = swap(entity.roomId);
      for (const event of candidate.events) if (event.trigger.roomId) event.trigger.roomId = swap(event.trigger.roomId);
      houseRoom.kind = plan.kind;
      delete destination.kind;
    }
  }
  const error = new RangeError('ROUTE_VIABILITY_CONFLICT: bounded route checks for the supplied starting player state found no safe witness without changing fixed special-room contents, counts, damage, or rewards; revise explicit constraints');
  error.code = 'ROUTE_VIABILITY_CONFLICT';
  error.diagnostics = { assumptions, fixedRoomIds: roomPlans.filter(({ roomId }) => roomId !== null).map(({ roomId }) => roomId),
    failedPolicies: checked.attempts.map(({ policy, failedRoomId }) => ({ policy, failedRoomId })) };
  throw error;
}

// 記録済み証拠を実Playに再適用する。複数階ではRunのcurrentFloorSessionに対して使う。
export function replayRouteWitnessV3(session, witness) {
  let current = session;
  for (const { type, id } of witness.actions) {
    let result;
    if (type === 'move') {
      if (listRoomEnemies(current).length || listRoomInteractables(current).some(({ entity }) => entity.type === 'trap')) {
        throw new Error('ROUTE_WITNESS_EXIT_BLOCKED');
      }
      result = movePlaySession(current, id);
    } else if (type === 'complete-goal') result = completePlayGoal(current);
    else if (type === 'combat') result = resolveEnemyCombat(current, id);
    else if (type === 'open-treasure') result = openTreasure(current, id);
    else if (type === 'avoid-trap') result = avoidTrap(current, id);
    else if (type === 'use-recovery') result = useRecovery(current, id);
    else if (type === 'purchase') result = purchaseShopOffer(current, id[0], id[1]);
    else throw new RangeError(`Unknown route witness action: ${type}`);
    if (!result.ok) throw new Error(`ROUTE_WITNESS_REPLAY_FAILED: ${JSON.stringify(result.error)}`);
    current = result.session;
  }
  return current;
}
