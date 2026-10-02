export const DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT = 100;
// ネイティブChromiumで実測し承認された最大値だけを公開する。
export const MAX_SPECIAL_ROOM_ENTITY_LIMIT = 250;

// 確認済みplanのフロア別House合計を配置前に検査する。価格・在庫・通常敵は対象外。
export function validateConfirmedRoomPlanLimits(plans, limit = DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SPECIAL_ROOM_ENTITY_LIMIT) {
    throw new RangeError(`specialRoomEntityLimit must be an integer from 1 to ${MAX_SPECIAL_ROOM_ENTITY_LIMIT}`);
  }
  if (!Array.isArray(plans)) throw new TypeError('roomPlans must be an array');
  const counts = new Map();
  for (const [index, plan] of plans.entries()) {
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)
      || !['monster-house', 'trap-house', 'shop'].includes(plan.kind)) {
      throw new TypeError(`roomPlans[${index}].kind must be monster-house, trap-house, or shop`);
    }
    if (!Number.isSafeInteger(plan.floorNumber) || plan.floorNumber < 1) {
      throw new TypeError(`roomPlans[${index}].floorNumber must be a positive safe integer`);
    }
    if (plan.kind === 'shop') continue;
    if (!Number.isSafeInteger(plan.entityCount) || plan.entityCount < 1) {
      throw new TypeError(`roomPlans[${index}].entityCount must be an explicit positive safe integer`);
    }
    const prior = counts.get(plan.floorNumber) ?? 0;
    // 巨大入力でも加算やEntity配列展開を行う前に拒否する。
    if (plan.entityCount > limit - prior) {
      throw new RangeError(`SPECIAL_ROOM_ENTITY_LIMIT_EXCEEDED: combined house enemies and traps exceed ${limit} on floor ${plan.floorNumber}`);
    }
    counts.set(plan.floorNumber, prior + plan.entityCount);
  }
  return { limit, entityCountByFloor: Object.fromEntries(counts) };
}
