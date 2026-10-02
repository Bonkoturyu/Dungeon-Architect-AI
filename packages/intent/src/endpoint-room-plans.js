import { SPECIAL_ROOM_KINDS, resolveRoomRequests } from './room-requests.js';
import { resolveSpecialRoomPresence, requestedPresencePolicies } from './special-room-presence.js';
import { DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT, validateConfirmedRoomPlanLimits } from './room-limits.js';

export const ENDPOINT_ROOM_POLICIES = Object.freeze(['normal', 'random', ...SPECIAL_ROOM_KINDS]);
function hash(text) { let value = 0x811c9dc5; for (const char of text) { value ^= char.codePointAt(0); value = Math.imul(value, 0x01000193) >>> 0; } return value; }
export function requestedEndpointPolicies(requests) {
  return Object.fromEntries(['start', 'goal'].map((role) => {
    const groups = new Map();
    for (const request of requests.filter(({ targetRole, presence }) => targetRole === role && presence !== 'exclude')) {
      const scope = request.floorNumber ?? 'default';
      const policy = request.presence === 'random' ? 'random' : request.kind;
      if (groups.has(scope) && groups.get(scope) !== policy) throw new RangeError(`ENDPOINT_KIND_CONFLICT: ${role} floor ${scope}`);
      groups.set(scope, policy);
    }
    const floors = Object.fromEntries([...groups].filter(([scope]) => scope !== 'default'));
    return [role, Object.keys(floors).length ? { default: groups.get('default') ?? 'normal', floors } : groups.get('default') ?? 'random'];
  }));
}

export function endpointPolicyAtFloor(policies, role, floor) {
  const value = policies[role] ?? 'normal';
  return typeof value === 'string' ? value : value.floors?.[floor] ?? value.default ?? 'normal';
}

// 端点の既定もRandom。明示指定を優先し、独立したSeed streamで再現する。
export function resolveRoomConfigurationPresence({ endpointPolicies, ...options }) {
  const { requests, seed, defaults, floorCount, policies = requestedPresencePolicies(requests), overrides = {}, specialRoomEntityLimit = DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT } = options;
  endpointPolicies ??= requestedEndpointPolicies(requests);
  if (requests.some(({ targetRole, floorNumber }) => targetRole && floorNumber !== null && floorNumber > floorCount)) throw new RangeError('ROOM_REQUEST_FLOOR_MISSING');
  for (const value of Object.values(endpointPolicies)) if (typeof value !== 'string') {
    if (!value || Array.isArray(value) || Object.keys(value).some((key) => !['default', 'floors'].includes(key)) || !value.floors || Array.isArray(value.floors)) throw new TypeError('ENDPOINT_POLICY_INVALID');
    if (Object.keys(value.floors).some((floor) => !/^[1-9]\d*$/.test(floor) || Number(floor) > floorCount)) throw new RangeError('ROOM_REQUEST_FLOOR_MISSING');
  }
  const resolved = resolveSpecialRoomPresence({ ...options, requests: requests.filter(({ targetRole }) => !targetRole) });
  const endpointPresence = [];
  for (const role of ['start', 'goal']) {
    const sources = requests.filter((request) => request.targetRole === role && request.presence !== 'exclude');
    for (let floor = 1; floor <= floorCount; floor++) {
      const policy = endpointPolicyAtFloor(endpointPolicies, role, floor);
      if (!ENDPOINT_ROOM_POLICIES.includes(policy)) throw new RangeError(`ENDPOINT_POLICY_INVALID: ${role} floor ${floor}`);
      let kind = policy;
      if (policy === 'random') {
        const candidates = SPECIAL_ROOM_KINDS.filter((candidate) => policies[candidate] !== 'exclude' && !requests.some((request) => request.targetRole === role && request.kind === candidate && request.presence === 'exclude' && (request.floorNumber === null || request.floorNumber === floor)) && hash(`endpoint-presence-1:${seed}:${floor}:${role}:${candidate}`) % 3 === 0);
        kind = candidates.length ? candidates[hash(`endpoint-choice-1:${seed}:${floor}:${role}`) % candidates.length] : 'normal';
      }
      const matchesKind = (request) => request.kind === kind || request.presence === 'random';
      const source = sources.find((request) => request.floorNumber === floor && matchesKind(request))
        ?? sources.find((request) => request.floorNumber === null && matchesKind(request));
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
        (plan.targetRole ? endpointPolicyAtFloor(endpointPolicies, plan.targetRole, plan.floorNumber) === 'random' : (policies[plan.kind] ?? 'random') === 'random'))
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
