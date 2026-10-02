import { SPECIAL_ROOM_KINDS, resolveRoomRequests } from './room-requests.js';
import { resolveSpecialRoomPresence, requestedPresencePolicies } from './special-room-presence.js';
import { DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT, validateConfirmedRoomPlanLimits } from './room-limits.js';

export const ENDPOINT_ROOM_POLICIES = Object.freeze(['normal', 'random', ...SPECIAL_ROOM_KINDS]);
function hash(text) { let value = 0x811c9dc5; for (const char of text) { value ^= char.codePointAt(0); value = Math.imul(value, 0x01000193) >>> 0; } return value; }
export function requestedEndpointPolicies(requests) {
  return Object.fromEntries(['start', 'goal'].map((role) => {
    const matching = requests.filter(({ targetRole }) => targetRole === role && targetRole != null);
    const kinds = [...new Set(matching.filter(({ presence }) => presence !== 'exclude').map(({ kind, presence }) => presence === 'random' ? 'random' : kind))];
    if (kinds.length > 1) throw new RangeError(`ENDPOINT_KIND_CONFLICT: ${role}`);
    return [role, kinds[0] ?? 'random'];
  }));
}

// 端点の既定もRandom。明示指定を優先し、独立したSeed streamで再現する。
export function resolveRoomConfigurationPresence({ endpointPolicies, ...options }) {
  const { requests, seed, defaults, floorCount, policies = requestedPresencePolicies(requests), overrides = {}, specialRoomEntityLimit = DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT } = options;
  endpointPolicies ??= requestedEndpointPolicies(requests);
  const resolved = resolveSpecialRoomPresence({ ...options, requests: requests.filter(({ targetRole }) => !targetRole) });
  const endpointPresence = [];
  for (const role of ['start', 'goal']) {
    const policy = endpointPolicies[role] ?? 'normal';
    if (!ENDPOINT_ROOM_POLICIES.includes(policy)) throw new RangeError(`ENDPOINT_POLICY_INVALID: ${role}`);
    const sources = requests.filter((request) => request.targetRole === role && request.presence !== 'exclude');
    for (let floor = 1; floor <= floorCount; floor++) {
      let kind = policy;
      if (policy === 'random') {
        const candidates = SPECIAL_ROOM_KINDS.filter((candidate) => policies[candidate] !== 'exclude' && !requests.some((request) => request.targetRole === role && request.kind === candidate && request.presence === 'exclude' && (request.floorNumber === null || request.floorNumber === floor)) && hash(`endpoint-presence-1:${seed}:${floor}:${role}:${candidate}`) % 3 === 0);
        kind = candidates.length ? candidates[hash(`endpoint-choice-1:${seed}:${floor}:${role}`) % candidates.length] : 'normal';
      }
      const source = sources.find((request) => (request.floorNumber === null || request.floorNumber === floor) && (request.kind === kind || request.presence === 'random'));
      // 自然文で対象階を限定した場合は、その指定以外の階へ複製しない。
      if (sources.length && sources.every(({ floorNumber }) => floorNumber !== null) && !source) kind = 'normal';
      endpointPresence.push({ role, floorNumber: floor, policy, kind });
      if (kind === 'normal') continue;
      const request = { kind, presence: 'include', roomCount: 1, entityCount: null, floorNumber: floor, roomId: null, offers: [], ...source, kind, targetRole: role, floorNumber: floor, roomCount: 1, roomId: null };
      const [plan] = resolveRoomRequests([request], defaults, { floorCount, seed });
      plan.id = `endpoint-${role}-${kind}-${floor}`;
      for (const key of ['entityCount']) if (Object.hasOwn(overrides, `${plan.id}/${key}`)) plan[key] = overrides[`${plan.id}/${key}`];
      for (const offer of plan.offers) for (const key of ['price', 'stock', 'healing', 'tier']) if (Object.hasOwn(overrides, `${plan.id}/${offer.id}/${key}`)) offer[key] = overrides[`${plan.id}/${offer.id}/${key}`];
      resolved.roomPlans.push(plan);
    }
  }
  // 容量不足ではランダム候補だけを外す。明示した端点・個数は減らさない。
  for (let floor = 1; floor <= floorCount; floor++) {
    const count = () => resolved.roomPlans.filter(({ floorNumber }) => floorNumber === floor).reduce((sum, plan) => sum + (plan.entityCount ?? 0), 0);
    while (count() > specialRoomEntityLimit) {
      const optional = resolved.roomPlans.filter((plan) => plan.floorNumber === floor && plan.entityCount > 0 &&
        (plan.targetRole ? endpointPolicies[plan.targetRole] === 'random' : (policies[plan.kind] ?? 'random') === 'random'))
        .toSorted((a, b) => hash(`capacity:${seed}:${a.id}`) - hash(`capacity:${seed}:${b.id}`))[0];
      if (!optional) break;
      if (optional.targetRole) {
        resolved.roomPlans = resolved.roomPlans.filter(({ id }) => id !== optional.id);
        const entry = endpointPresence.find(({ role, floorNumber }) => role === optional.targetRole && floorNumber === floor);
        entry.kind = 'normal'; entry.reason = 'capacity';
      } else {
        resolved.roomPlans = resolved.roomPlans.filter((plan) => plan.targetRole || plan.kind !== optional.kind);
        resolved.presence[optional.kind].placed = false; resolved.presence[optional.kind].reason = 'capacity';
      }
      resolved.warnings.push(`Random ${optional.targetRole ?? optional.kind} omitted because explicit rooms used the configured entity limit on floor ${floor}.`);
    }
  }
  validateConfirmedRoomPlanLimits(resolved.roomPlans, specialRoomEntityLimit);
  return { ...resolved, endpointPresence };
}
