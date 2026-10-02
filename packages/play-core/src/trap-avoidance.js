import { TRAP_AVOIDANCE_VERSION, TRAP_AVOIDANCE_SUCCESS_CHANCE } from '../../core/src/trap-rules.js';

export { TRAP_RULES_V1 } from '../../core/src/trap-rules.js';

// floor固有のDungeonSpec.seedを使う。部屋の移動、操作順、時刻、再Playは再抽選しない。
function hash32(text) {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function getTrapAvoidanceChance(session) {
  const rules = session?.snapshot?.trapRules;
  if (rules === undefined) return 1; // 旧DungeonSpecの確実回避は維持する。
  if (!rules || rules.version !== TRAP_AVOIDANCE_VERSION || Object.keys(rules).some((key) => key !== 'version')) {
    throw new RangeError('TRAP_RULES_UNSUPPORTED');
  }
  return TRAP_AVOIDANCE_SUCCESS_CHANCE;
}

// 生成検査・実Play・simulationが同じ純粋関数を使用する。
export function deterministicTrapAvoidance(session, trapId) {
  const successChance = getTrapAvoidanceChance(session);
  if (successChance === 1) return { version: 'legacy-always-avoid', successChance, roll: null, outcome: 'avoided' };
  const seed = session?.snapshot?.seed;
  if (!Number.isSafeInteger(seed) || seed < 0 || typeof trapId !== 'string' || !trapId.trim()) throw new RangeError('TRAP_ROLL_INPUT_INVALID');
  const roll = hash32(JSON.stringify([TRAP_AVOIDANCE_VERSION, seed, trapId])) / 0x100000000;
  return { version: TRAP_AVOIDANCE_VERSION, successChance, roll, outcome: roll < successChance ? 'avoided' : 'triggered' };
}
