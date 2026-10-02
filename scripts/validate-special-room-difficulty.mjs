import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { resolveRoomRequests } from '../packages/intent/src/room-requests.js';
import { resolveSpecialRoomPresence } from '../packages/intent/src/special-room-presence.js';
import { generateDungeonFromDesignIntentV3 } from '../packages/generator/src/versions/v3/design-intent-generator.js';
import { startPlaySession, movePlaySession } from '../packages/play-core/src/play-session.js';
import { getEnemyState, listRoomEnemies, resolveEnemyCombat } from '../packages/play-core/src/enemy-runtime.js';
import { listRoomInteractables, openTreasure, avoidTrap, useRecovery } from '../packages/play-core/src/interaction-runtime.js';
import { listRoomShops, purchaseShopOffer } from '../packages/play-core/src/shop-runtime.js';
import { getEffectiveDamage } from '../packages/play-core/src/equipment-runtime.js';
import { deterministicEnemyReward } from '../packages/play-core/src/progression-runtime.js';
import { DIFFICULTY_PROFILES, EQUIPMENT_RULES_V1, NORMAL_ROOM_DEFAULTS } from '../apps/editor-slice/room-plan-review.js';

const seedCount = Number(process.argv.find((arg) => arg.startsWith('--seeds='))?.split('=')[1] ?? 64);
assert.ok(Number.isSafeInteger(seedCount) && seedCount > 0 && seedCount <= 1024);
const requests = ['monster-house', 'trap-house', 'shop'].map((kind) => ({
  kind, roomCount: 1, entityCount: null, floorNumber: 1, roomId: null, offers: [],
}));
const strategies = ['direct-goal', 'shop-first', 'loot-first'];
const presenceMode = process.argv.find((arg) => arg.startsWith('--presence='))?.slice(11) ?? 'legacy-all';
assert.ok(['legacy-all', 'random', 'include'].includes(presenceMode));
const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ?? 'artifacts/special-rooms/difficulty-solvability.json';

function requireOk(result, operation) {
  assert.equal(result.ok, true, `${operation}: ${JSON.stringify(result.error ?? result.errors)}`);
  return result.session;
}

function pendingEnemies(session) {
  return session.snapshot.entities.filter((entity) => entity.type === 'enemy' && getEnemyState(session, entity.id).state.status !== 'defeated');
}

// 表示済みの価格・装備Tier・敵被害を使って、今購入できる組み合わせの予想HP余裕を比較。
// 同じslotの段階的な買い直しは常に高価なので候補に含めない。
function shopPurchases(session) {
  let current = session;
  for (const shop of listRoomShops(current)) {
    const upgradeOptions = (type) => [null, ...shop.offers.filter((offer) => offer.type === type && offer.remaining > 0 && offer.tier > (current.playerState.equipment[type]?.tier ?? 0))];
    const healingOptions = [null, ...shop.offers.filter((offer) => offer.type === 'healing' && offer.remaining > 0 && current.playerState.hp < current.playerState.maxHp)];
    let best = null;
    for (const weapon of upgradeOptions('weapon')) for (const armor of upgradeOptions('armor')) for (const healing of healingOptions) {
      const offers = [weapon, armor, healing].filter(Boolean);
      const cost = offers.reduce((sum, offer) => sum + offer.price, 0);
      if (cost > current.playerState.gold) continue;
      const projection = structuredClone(current);
      for (const offer of [weapon, armor].filter(Boolean)) projection.playerState.equipment[offer.type] = { id: `projection-${offer.type}`, slot: offer.type, tier: offer.tier };
      const hp = Math.min(current.playerState.maxHp, current.playerState.hp + (healing?.healing ?? 0));
      const projectedDamage = pendingEnemies(current).reduce((sum, enemy) => sum + getEffectiveDamage(projection, enemy.damage, 'enemy'), 0);
      const score = [hp - projectedDamage, hp, -cost];
      if (!best || compareScores(score, best.score) > 0) best = { offers, score };
    }
    for (const offer of best.offers) current = requireOk(purchaseShopOffer(current, shop.entity.id, offer.id), 'purchase');
  }
  return current;
}

function compareScores(left, right) {
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return left[index] - right[index];
  return 0;
}

function resolveRoom(session) {
  let current = session;
  if (current.status !== 'playing') return current;
  for (const { entity } of listRoomInteractables(current).filter(({ entity }) => entity.type === 'treasure')) {
    current = requireOk(openTreasure(current, entity.id), 'treasure');
  }
  for (const { entity } of listRoomInteractables(current).filter(({ entity }) => entity.type === 'trap')) {
    current = requireOk(avoidTrap(current, entity.id), 'avoid trap');
  }
  current = shopPurchases(current);
  const healIfUseful = (damage = 0) => {
    for (const { entity } of listRoomInteractables(current).filter(({ entity }) => entity.type === 'recovery')) {
      const missing = current.playerState.maxHp - current.playerState.hp;
      if (missing >= entity.healing || (missing > 0 && current.playerState.hp <= damage)) {
        current = requireOk(useRecovery(current, entity.id), 'recovery');
      }
    }
  };
  healIfUseful();
  const enemies = listRoomEnemies(current).sort((left, right) =>
    deterministicEnemyReward(current, right.enemy.id).xp - deterministicEnemyReward(current, left.enemy.id).xp
    || left.enemy.id.localeCompare(right.enemy.id));
  for (const { enemy } of enemies) {
    healIfUseful(getEffectiveDamage(current, enemy.damage, 'enemy'));
    current = requireOk(resolveEnemyCombat(current, enemy.id), 'combat');
    if (current.status !== 'playing') return current;
  }
  healIfUseful();
  return current;
}

function pathsTo(session, target) {
  const adjacency = new Map(session.snapshot.rooms.map(({ id }) => [id, []]));
  for (const corridor of session.snapshot.corridors) {
    adjacency.get(corridor.fromRoomId).push(corridor.toRoomId);
    adjacency.get(corridor.toRoomId).push(corridor.fromRoomId);
  }
  const paths = [];
  function visit(path) {
    const roomId = path.at(-1);
    if (roomId === target) { paths.push(path); return; }
    for (const next of adjacency.get(roomId)) {
      if (path.includes(next) || (next === session.goalRoomId && target !== session.goalRoomId)) continue;
      visit([...path, next]);
    }
  }
  visit([session.currentRoomId]);
  return paths.sort((left, right) => left.length - right.length || left.join(',').localeCompare(right.join(',')));
}

function traverse(session, path) {
  let current = session;
  for (const roomId of path.slice(1)) {
    // 通常部屋もbrowser同様、全敵/罠を解決してから退出する。
    assert.equal(listRoomEnemies(current).length, 0);
    assert.ok(!listRoomInteractables(current).some(({ entity }) => entity.type === 'trap'));
    current = requireOk(movePlaySession(current, roomId), 'move');
    current = resolveRoom(current);
    if (current.status !== 'playing') break;
  }
  return current;
}

function choosePath(session, target, riskAware) {
  const paths = pathsTo(session, target);
  assert.ok(paths.length > 0, `No path to ${target}`);
  if (!riskAware) return traverse(session, paths[0]);
  const candidates = paths.map((path) => ({ path, session: traverse(session, path) }));
  const score = ({ path, session: next }) => [
    next.status !== 'failed' ? 1 : 0,
    next.playerState.hp,
    (next.playerState.equipment.weapon?.tier ?? 0) + (next.playerState.equipment.armor?.tier ?? 0),
    -path.length,
  ];
  candidates.sort((left, right) => compareScores(score(right), score(left)));
  return candidates[0].session;
}

function runStrategy(spec, strategy) {
  let session = resolveRoom(requireOk(startPlaySession(spec), 'start'));
  if (strategy === 'shop-first') {
    const budget = spec.entities.find(({ id }) => id.startsWith('v3:shop-budget:'));
    if (budget && budget.roomId !== session.currentRoomId) session = choosePath(session, budget.roomId, true);
    if (session.status === 'playing') {
      const shop = spec.entities.find(({ type }) => type === 'shop');
      if (shop) session = choosePath(session, shop.roomId, true);
    }
  }
  if (strategy === 'loot-first') {
    // 対象は回収/購入で単調に減る。状態変化のない往復は認めない。
    const ignored = new Set();
    while (session.status === 'playing') {
      const targetIds = new Set();
      for (const room of spec.rooms) {
        if (room.id === session.currentRoomId || room.id === session.goalRoomId || ignored.has(room.id)) continue;
        const actionable = listRoomInteractables(session, room.id).some(({ entity }) => entity.type === 'treasure'
          || (entity.type === 'recovery' && session.playerState.hp < session.playerState.maxHp));
        const canBuy = listRoomShops(session, room.id).some((shop) => shop.offers.some((offer) => offer.remaining > 0 && offer.price <= session.playerState.gold
          && (offer.type === 'healing' ? session.playerState.hp < session.playerState.maxHp : offer.tier > (session.playerState.equipment[offer.type]?.tier ?? 0))));
        if (actionable || canBuy) targetIds.add(room.id);
      }
      if (!targetIds.size) break;
      const candidates = [...targetIds].map((target) => ({ target, next: choosePath(session, target, true) }));
      const viable = candidates.filter(({ next }) => next.status !== 'failed');
      if (!viable.length) break;
      const score = ({ next }) => [
        next.playerState.hp + 4 * ((next.playerState.equipment.weapon?.tier ?? 0) + (next.playerState.equipment.armor?.tier ?? 0)),
        -(next.moves - session.moves),
        next.playerState.gold,
      ];
      viable.sort((left, right) => compareScores(score(right), score(left)));
      const { target, next } = viable[0];
      if (next.events.length === session.events.length || next.gameplayState.counters.interactions === session.gameplayState.counters.interactions) ignored.add(target);
      session = next;
      // 同じ回復/店舗を購入なしで訪問する場合だけ除外。装備/G増加で再訪可能になる対象は残す。
      if (!session.events.slice(-2).some(({ type }) => type === 'shop-purchase') && listRoomShops(session).length) ignored.add(target);
    }
  }
  if (session.status === 'playing') session = choosePath(session, session.goalRoomId, strategy !== 'direct-goal');
  return session;
}

function summarizeRun(spec, session, strategy) {
  const shop = spec.entities.find(({ type }) => type === 'shop');
  const source = spec.entities.find(({ id }) => id.startsWith('v3:shop-budget:'));
  const damageEvents = session.events.filter(({ type }) => type === 'player-damaged');
  const lethal = damageEvents.at(-1);
  const route = [spec.entities.find(({ type }) => type === 'start').roomId, ...session.events.filter(({ type }) => type === 'move').map(({ roomId }) => roomId)];
  return {
    strategy, status: session.status, hp: session.playerState.hp, maxHp: session.playerState.maxHp,
    gold: session.playerState.gold, level: session.playerState.level,
    equipment: session.playerState.equipment, route, moves: session.moves,
    purchases: session.events.filter(({ type }) => type === 'shop-purchase'),
    shopRoomId: shop?.roomId ?? null, shopReached: !!shop && session.visitedRoomIds.includes(shop.roomId),
    budgetSourceRoomId: source?.roomId ?? null,
    budgetCollected: !!source && session.events.some((event) => event.type === 'treasure-opened' && event.treasureId === source.id),
    damageTaken: session.gameplayState.counters.damageTaken,
    healingReceived: session.gameplayState.counters.healingReceived,
    enemiesCleared: session.gameplayState.counters.enemiesCleared,
    failure: session.status === 'failed' ? {
      reason: session.failureReason, roomId: session.currentRoomId,
      roomKind: spec.rooms.find(({ id }) => id === session.currentRoomId).kind ?? 'normal',
      lastDamage: lethal, remainingRoomEnemies: listRoomEnemies(session).map(({ enemy, state }) => ({ id: enemy.id, damage: enemy.damage, state: state.status })),
      events: session.events,
    } : null,
  };
}

function initialAssistanceBottleneck(spec) {
  const initial = requireOk(startPlaySession(spec), 'bottleneck start');
  const enemyCountByRoom = new Map(spec.rooms.map(({ id }) => [id, spec.entities.filter((entity) => entity.type === 'enemy' && entity.roomId === id).length]));
  const countBeforeTarget = (target) => Math.min(...pathsTo(initial, target).map((path) =>
    path.slice(0, -1).reduce((sum, roomId) => sum + enemyCountByRoom.get(roomId), 0)));
  const assistanceSources = spec.entities.filter((entity) => entity.type === 'shop' || entity.type === 'recovery'
    || (entity.type === 'treasure' && entity.rewardItem !== false)).map((entity) => ({
    id: entity.id, type: entity.type, roomId: entity.roomId, minimumEnemiesBeforeInteraction: countBeforeTarget(entity.roomId),
  }));
  return {
    minimumEnemiesBeforeGoal: countBeforeTarget(initial.goalRoomId),
    minimumEnemiesBeforeAnyEquipmentHealingOrShop: assistanceSources.length ? Math.min(...assistanceSources.map(({ minimumEnemiesBeforeInteraction }) => minimumEnemiesBeforeInteraction)) : null,
    assistanceSources,
    note: 'Counts enumerate all simple graph paths and allow treasure/recovery before target-room combat; Goal cannot be traversed en route to assistance. Gold-only chests provide no equipment/healing.',
  };
}

const started = performance.now();
const rows = [];
for (const difficulty of ['easy', 'normal', 'hard']) {
  const profile = DIFFICULTY_PROFILES[difficulty];
  const defaults = { ...NORMAL_ROOM_DEFAULTS, 'monster-house': profile.monsterCount, 'trap-house': profile.trapCount,
    offers: NORMAL_ROOM_DEFAULTS.offers.map((offer) => offer.type === 'healing' ? { ...offer, healing: profile.recoveryHealing } : { ...offer }) };
  for (let seed = 0; seed < seedCount; seed += 1) {
    const resolved = presenceMode === 'legacy-all' ? null : resolveSpecialRoomPresence({
      requests: presenceMode === 'random' ? [] : requests.map((request) => ({ ...request, presence: 'include' })),
      defaults, floorCount: 1, roomsPerFloor: 8, seed,
    });
    const roomPlans = resolved?.roomPlans ?? resolveRoomRequests(requests, defaults, { floorCount: 1, seed });
    const { spec, profile: generatedProfile } = generateDungeonFromDesignIntentV3(DEFAULT_DESIGN_INTENT, {
      seed, prompt: 'one monster house, one trap house, one shop', id: `difficulty-${difficulty}-${seed}`,
      roomPlans, difficulty, equipmentRules: EQUIPMENT_RULES_V1,
      difficultyProfile: Object.fromEntries(['enemyDamage', 'trapDamage', 'recoveryHealing'].map((key) => [key, profile[key]])),
    });
    assert.equal(spec.rooms.length, 8);
    assert.deepEqual(spec.rooms.filter(({ kind }) => kind).map(({ kind }) => kind).sort(), roomPlans.map(({ kind }) => kind).sort());
    if (!roomPlans.some(({ kind }) => kind === 'shop')) {
      assert.equal(generatedProfile.shopPlacementGuard, undefined);
      assert.ok(!spec.entities.some(({ id }) => id.startsWith('v3:shop-budget:')));
    }
    const original = JSON.stringify(spec);
    const runs = strategies.map((strategy) => summarizeRun(spec, runStrategy(spec, strategy), strategy));
    assert.equal(JSON.stringify(spec), original);
    rows.push({ difficulty, seed, placements: spec.rooms.filter(({ kind }) => kind).map(({ id, kind }) => ({ roomId: id, kind })),
      presence: resolved?.presence ?? null, profile: generatedProfile, entitySummary: spec.entities.map(({ id, type, roomId, damage, healing, goldReward, rewardItem }) => ({ id, type, roomId, damage, healing, goldReward, rewardItem })), runs });
    if (runs.every(({ status }) => status !== 'cleared')) rows.at(-1).initialBottleneck = initialAssistanceBottleneck(spec);
  }
  const difficultyRows = rows.filter((row) => row.difficulty === difficulty);
  console.log(JSON.stringify({ difficulty, seeds: seedCount, strategies: strategies.map((strategy) => ({ strategy,
    clears: difficultyRows.filter((row) => row.runs.find((run) => run.strategy === strategy).status === 'cleared').length,
    failingSeeds: difficultyRows.filter((row) => row.runs.find((run) => run.strategy === strategy).status !== 'cleared').map(({ seed }) => seed),
  })), noHeuristicClear: difficultyRows.filter((row) => row.runs.every((run) => run.status !== 'cleared')).map(({ seed }) => seed) }));
}
const result = {
  generatedAt: new Date().toISOString(), seedCount, presenceMode, seeds: { first: 0, last: seedCount - 1 },
  methodology: {
    intent: DEFAULT_DESIGN_INTENT, profiles: DIFFICULTY_PROFILES, equipmentRules: EQUIPMENT_RULES_V1,
    plan: `${presenceMode === 'random' ? 'Omitted kinds resolve by seeded1/3 presence' : '1 MonsterHouse,1 TrapHouse,1 shop'}; all roomId=null; eight rooms; default routeChoice0.5`,
    runtime: 'Actual immutable Play runtime for every committed move, combat, avoidance, treasure, recovery, and purchase',
    assumptions: ['Full-spec-aware offline routing, not a fog-discovery or human-play study', 'All traps are avoided; treasure can be opened before combat',
      'All room enemies must be cleared before exits, including ordinary rooms as required by browser UI',
      'Enemies ordered by displayed XP to permit earlier level-ups', 'Purchases compare available weapon/armor/healing combinations by projected remaining enemy damage',
      'Risk-aware strategies evaluate simple paths using actual runtime outcomes; no claim of universal optimality or unsolvability'],
  },
  durationMs: Math.round(performance.now() - started),
  summary: ['easy', 'normal', 'hard'].map((difficulty) => {
    const subset = rows.filter((row) => row.difficulty === difficulty);
    return { difficulty, seeds: subset.length, strategies: strategies.map((strategy) => {
      const runs = subset.map((row) => ({ seed: row.seed, ...row.runs.find((run) => run.strategy === strategy) }));
      const cleared = runs.filter(({ status }) => status === 'cleared');
      return { strategy, clears: cleared.length, failures: runs.length - cleared.length,
        clearRate: cleared.length / runs.length, failingSeeds: runs.filter(({ status }) => status !== 'cleared').map(({ seed }) => seed),
        minimumClearHp: cleared.length ? Math.min(...cleared.map(({ hp }) => hp)) : null,
      };
    }), anyHeuristicClear: subset.filter((row) => row.runs.some((run) => run.status === 'cleared')).length,
    noHeuristicClearSeeds: subset.filter((row) => row.runs.every((run) => run.status !== 'cleared')).map(({ seed }) => seed) };
  }),
  rows,
};
if (process.argv.includes('--check-policies')) {
  let cases = 0;
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const profile = DIFFICULTY_PROFILES[difficulty];
    const defaults = { ...NORMAL_ROOM_DEFAULTS, 'monster-house': profile.monsterCount, 'trap-house': profile.trapCount };
    for (let mask = 0; mask < 27; mask += 1) for (let seed = 0; seed < seedCount; seed += 1) {
      const policies = Object.fromEntries(['monster-house', 'trap-house', 'shop'].map((kind, index) => [kind, ['random', 'include', 'exclude'][Math.floor(mask / (3 ** index)) % 3]]));
      const args = { requests: [], policies, defaults, floorCount: 1, roomsPerFloor: 8, seed };
      const resolved = resolveSpecialRoomPresence(args);
      assert.deepEqual(resolved, resolveSpecialRoomPresence(args));
      const { spec } = generateDungeonFromDesignIntentV3(DEFAULT_DESIGN_INTENT, { seed, roomPlans: resolved.roomPlans, equipmentRules: EQUIPMENT_RULES_V1,
        difficultyProfile: Object.fromEntries(['enemyDamage', 'trapDamage', 'recoveryHealing'].map((key) => [key, profile[key]])) });
      for (const [kind, policy] of Object.entries(policies)) {
        const expected = resolved.roomPlans.filter((plan) => plan.kind === kind).length;
        assert.equal(spec.rooms.filter((room) => room.kind === kind).length, expected);
        if (policy === 'include') assert.equal(expected, 1);
        if (policy === 'exclude') assert.equal(expected, 0);
      }
      cases += 1;
    }
  }
  result.policyCombinationChecks = { cases, combinations: 27, seedsPerCombination: seedCount, profiles: 3, passed: true };
  console.log(JSON.stringify(result.policyCombinationChecks));
}
await mkdir('artifacts/special-rooms', { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output, durationMs: result.durationMs, scenarios: rows.length, runs: rows.length * strategies.length }));
