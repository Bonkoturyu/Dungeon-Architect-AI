import { SPECIAL_ROOM_KINDS, resolveRoomRequests } from './room-requests.js';
import { DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT, MAX_SPECIAL_ROOM_ENTITY_LIMIT, validateConfirmedRoomPlanLimits } from './room-limits.js';

export const SPECIAL_ROOM_PRESENCE_VERSION = '1';
export const ROOM_PRESENCE_POLICIES = Object.freeze(['random', 'include', 'exclude']);
function hash(text) { let value = 0x811c9dc5; for (const char of String(text)) { value ^= char.codePointAt(0); value = Math.imul(value, 0x01000193) >>> 0; } return value; }
export function requestedPresencePolicies(requests) {
  const policies = Object.fromEntries(SPECIAL_ROOM_KINDS.map((kind) => [kind, 'random']));
  for (const request of requests) {
    const policy = request.presence ?? 'include';
    if (!ROOM_PRESENCE_POLICIES.includes(policy)) throw new TypeError('Invalid room presence policy');
    if (policies[request.kind] !== 'random' && policies[request.kind] !== policy) throw new RangeError(`Conflicting presence requests for ${request.kind}`);
    policies[request.kind] = policy;
  }
  return policies;
}

// 種類ごとの有無は専用Seed streamで1/3。明示指定を先に予約し、ランダムだけ容量に従う。
export function resolveSpecialRoomPresence({ requests, policies = requestedPresencePolicies(requests), defaults, floorCount, roomsPerFloor, seed, overrides = {}, specialRoomEntityLimit = DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT }) {
  if (!Number.isInteger(roomsPerFloor) || roomsPerFloor < 3 || !Number.isInteger(floorCount) || floorCount < 1 || floorCount > 10) throw new RangeError('Invalid room/floor capacity');
  validateConfirmedRoomPlanLimits([], specialRoomEntityLimit);
  const presence = {}; const warnings = []; const planned = [];
  const roomCounts = new Map(); const entityCounts = new Map(); const roomIds = new Set();
  const expand = (kind) => {
    const matching = requests.filter((request) => request.kind === kind && request.presence !== 'exclude');
    const sources = matching.length ? matching : [{ kind, roomCount: null, entityCount: null, floorNumber: null, roomId: null, offers: [] }];
    return sources.flatMap((request, requestIndex) => resolveRoomRequests([{ ...request, presence: 'include' }], defaults, { floorCount, seed: hash(`${seed}:${kind}:${requestIndex}:floor`) }).map((plan, index) => {
      plan.id = `special-${kind}-${requestIndex + 1}-${index + 1}`;
      const prefix = `${plan.id}/`;
      for (const key of ['entityCount', 'floorNumber', 'roomId']) if (Object.hasOwn(overrides, prefix + key)) plan[key] = overrides[prefix + key];
      for (const offer of plan.offers) for (const key of ['price', 'stock', 'healing', 'tier']) if (Object.hasOwn(overrides, `${prefix}${offer.id}/${key}`)) offer[key] = overrides[`${prefix}${offer.id}/${key}`];
      if (!Number.isSafeInteger(plan.floorNumber) || plan.floorNumber < 1 || plan.floorNumber > floorCount ||
        !(plan.roomId === null || (typeof plan.roomId === 'string' && plan.roomId.trim()))) throw new TypeError('Invalid explicit room location override');
      if (kind !== 'shop' && (!Number.isSafeInteger(plan.entityCount) || plan.entityCount < 1 || plan.entityCount > MAX_SPECIAL_ROOM_ENTITY_LIMIT)) throw new TypeError('Invalid explicit entity count override');
      if (plan.offers.some((offer) => !Number.isSafeInteger(offer.price) || offer.price < 0 || !Number.isSafeInteger(offer.stock) || offer.stock < 1 ||
        !Number.isSafeInteger(offer.type === 'healing' ? offer.healing : offer.tier) || (offer.type === 'healing' ? offer.healing : offer.tier) < 1)) throw new TypeError('Invalid explicit shop offer override');
      return { plan, fixedFloor: request.floorNumber !== null || Object.hasOwn(overrides, prefix + 'floorNumber') };
    }));
  };
  const allocate = (entry) => {
    const { plan, fixedFloor } = entry;
    const candidates = fixedFloor ? [plan.floorNumber] : Array.from({ length: floorCount }, (_, index) => index + 1);
    const eligible = candidates.filter((floor) => floor >= 1 && floor <= floorCount && (roomCounts.get(floor) ?? 0) < roomsPerFloor - 2 &&
      (plan.entityCount ?? 0) <= specialRoomEntityLimit - (entityCounts.get(floor) ?? 0) && (!plan.roomId || !roomIds.has(`${floor}:${plan.roomId}`)));
    if (!eligible.length) throw new RangeError(`ROOM_REQUEST_CAPACITY_EXCEEDED: no room/entity capacity for ${plan.kind}`);
    const floor = fixedFloor ? plan.floorNumber : eligible[hash(`${seed}:${plan.id}:placement`) % eligible.length];
    plan.floorNumber = floor;
    roomCounts.set(floor, (roomCounts.get(floor) ?? 0) + 1); entityCounts.set(floor, (entityCounts.get(floor) ?? 0) + (plan.entityCount ?? 0));
    if (plan.roomId) roomIds.add(`${floor}:${plan.roomId}`);
    planned.push(plan);
  };
  const required = [];
  for (const kind of SPECIAL_ROOM_KINDS) {
    const policy = policies[kind] ?? 'random';
    if (!ROOM_PRESENCE_POLICIES.includes(policy)) throw new TypeError(`Invalid policy for ${kind}`);
    const selected = policy === 'include' || (policy === 'random' && hash(`special-presence-${SPECIAL_ROOM_PRESENCE_VERSION}:${seed}:${kind}`) % 3 === 0);
    presence[kind] = { policy, selected, placed: false, reason: selected ? null : policy === 'exclude' ? 'excluded' : 'chance' };
    if (policy === 'include') required.push(...expand(kind));
  }
  required.sort((a, b) => Number(b.fixedFloor) - Number(a.fixedFloor));
  for (const entry of required) allocate(entry);
  for (const kind of SPECIAL_ROOM_KINDS) if (presence[kind].policy === 'include') presence[kind].placed = true;
  const optionalKinds = SPECIAL_ROOM_KINDS.filter((kind) => presence[kind].policy === 'random' && presence[kind].selected)
    .toSorted((a, b) => hash(`${seed}:optional:${a}`) - hash(`${seed}:optional:${b}`));
  for (const kind of optionalKinds) {
    const saved = { length: planned.length, rooms: new Map(roomCounts), entities: new Map(entityCounts), ids: new Set(roomIds) };
    try { for (const entry of expand(kind)) allocate(entry); presence[kind].placed = true; }
    catch (error) {
      if (!String(error.message).includes('CAPACITY')) throw error;
      planned.length = saved.length; roomCounts.clear(); for (const [key,value] of saved.rooms) roomCounts.set(key,value); entityCounts.clear(); for (const [key,value] of saved.entities) entityCounts.set(key,value); roomIds.clear(); for (const id of saved.ids) roomIds.add(id);
      presence[kind].reason = 'capacity'; warnings.push(`Random ${kind} omitted because explicit rooms or the configured entity limit used the available capacity.`);
    }
  }
  validateConfirmedRoomPlanLimits(planned, specialRoomEntityLimit);
  return { roomPlans: planned, presence, warnings };
}
